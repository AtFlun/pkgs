import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { compareVer, resolveLatest, resolvePrerelease } from './net.js';
import { printBody, printHead, printInstall, printTitle, printWarn } from './render.js';

const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'],
  SEMVER = /^(?<prefix>\^|~|>=|<=|>|<|=)?(?<version>\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/,
  // 目标版本已由 check 定好:回调优先;choose 为 s/stable 时切稳定版(不降级);否则跟随 check 结论
  decideNext = async (item, choose) => {
    if (typeof choose === 'function') {
      const picked = await choose(item);
      if (picked) return { picked, next: item.prefix + picked };
    }
    if ((choose === 's' || choose === 'stable') && compareVer(item.latest, item.current) > 0)
      return { picked: item.latest, next: item.prefix + item.latest };
    return { picked: item.target, next: item.next };
  },
  findRoot = start => {
    let dir = path.resolve(start || process.cwd());
    while (true) {
      if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  },
  parseRange = raw => {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) return { skip: '版本范围为空' };
    if (/^(?:workspace|file|link|portal|patch):/i.test(text)) return { skip: '本地或工作区引用' };
    if (/^(?:git|git\+|ssh|https?):/i.test(text) || /^[\w.-]+\/[\w.-]+(?:#|$)/.test(text)) return { skip: '非 npm 来源' };
    if (/^npm:/i.test(text)) return { skip: '包别名引用' };
    if (text === '*') return { skip: '星号通配,保留原值' };
    if (text === 'latest' || text === 'next') return { skip: '标签名,需手动升级' };
    if (text.includes('||') || /\s/.test(text)) return { skip: '复合范围' };
    const matched = SEMVER.exec(text);
    if (!matched) return { skip: /[xX*]/.test(text) ? '通配范围' : '无法识别的范围' };
    return { prefix: matched.groups.prefix || '', version: matched.groups.version };
  },
  readManifest = root => {
    const file = path.join(root, 'package.json');
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (err) { throw new Error(`读取 ${file} 失败:${err.message}`); }
  },
  resolveRoot = start => {
    const root = findRoot(start);
    if (!root) throw new Error('未找到 package.json,请在项目内运行或通过 root 指定目录');
    return root;
  },
  writeManifest = (root, manifest) => {
    const file = path.join(root, 'package.json'), raw = fs.readFileSync(file, 'utf8'),
      sample = /\n([ \t]+)\S/.exec(raw), indent = sample ? sample[1] : '  ',
      eol = raw.includes('\r\n') ? '\r\n' : '\n', tail = /\r?\n$/.test(raw) ? eol : '',
      text = JSON.stringify(manifest, null, indent).replace(/\n/g, eol) + tail;
    fs.writeFileSync(file, text);
  };

/**
 * 查询根目录 package.json 中可升级的依赖,默认打印结果
 * >查看定义:@see {@link check}
 * @param {{root?: string, refresh?: boolean, print?: boolean}} [options] root 指定项目根目录;
 *   refresh 忽略缓存;print 传 false 时不打印,便于调用方自行输出
 * @returns {Promise<object>} root、upgrades、skipped、online、warnings
 */
const check = async (options = {}) => {
  const root = resolveRoot(options.root), manifest = readManifest(root), upgrades = [], choices = [], skipped = [],
    items = [], names = new Set(), warnings = [];

  for (const field of FIELDS) {
    const block = manifest[field];
    if (!block || typeof block !== 'object') continue;
    for (const [name, range] of Object.entries(block)) {
      const parsed = parseRange(range);
      if (parsed.skip) { skipped.push({ name, field, range, reason: parsed.skip }); continue; }
      names.add(name), items.push({
        name, field, range, prefix: parsed.prefix, current: parsed.version, pre: parsed.version.includes('-')
      });
    }
  }
  for (const key of ['overrides', 'resolutions']) if (manifest[key]) warnings.push(`根目录 ${key} 未自动处理,请手动核对`);

  const { data: latest, online } = await resolveLatest([...names], Boolean(options.refresh)),
    { data: pre } = await resolvePrerelease(items.filter(i => i.pre && latest[i.name]).map(i => i.name));
  for (const item of items) {
    const stable = latest[item.name];
    if (!stable) {
      skipped.push({ ...item, reason: online ? 'registry 无此包' : '离线,未取到版本' });
      continue;
    }
    const preTarget = item.pre ? pre[item.name] || null : null,
      stableNewer = compareVer(stable, item.current) > 0,
      preNewer = Boolean(preTarget) && compareVer(preTarget, item.current) > 0;
    if (item.pre) {
      if (preNewer)
        upgrades.push({
          ...item, latest: stable, prerelease: preTarget, target: preTarget, mode: 'pre',
          next: item.prefix + preTarget
        });
      else if (stableNewer) choices.push({
        ...item, latest: stable, prerelease: preTarget, target: item.current,
        mode: 'choose', next: item.prefix + item.current
      });
    }
    else if (stableNewer) upgrades.push({
      ...item, latest: stable, prerelease: null, target: stable, mode: 'stable',
      next: item.prefix + stable
    });
  }
  const result = { root, upgrades, choices, skipped, online, warnings };
  if (options.print !== false) printHead('检查可升级依赖', root), printWarn(warnings), printBody(result);
  return result;
},
  // 抽出 update/install 共用骨架,差异由 handleItem 承担;依赖 check 与 writeManifest 故排其后
  withUpgrades = async (options, handleItem) => {
    const result = await check({ ...options, print: false }), manifest = readManifest(result.root),
      updated = [], installed = [], failed = [], pending = [];
    for (const item of [...result.upgrades, ...result.choices]) {
      const { picked, next } = await decideNext(item, options.choose);
      if (next === item.range) {
        if (item.mode === 'choose') pending.push({ ...item, picked, next });
        continue;
      }
      await handleItem({ item, picked, next, manifest, result, updated, installed, failed });
    }
    if (updated.length || installed.length) writeManifest(result.root, manifest);
    return { result, updated, installed, failed, pending };
  };

/**
 * 逐包升级并安装依赖,默认打印结果;每个包单独执行 npm install <name>@<picked>,
 * 成功写入 package.json 并计入 installed,失败计入 failed 且不中断继续下一个
 * >查看定义:@see {@link install}
 * @param {{root?: string, refresh?: boolean, stdio?: string, choose?: 'p'|'s'|Function, print?: boolean}} [options]
 * 同 check; stdio 传给 npm;choose 同 update('p'/'s' 或回调);print 传 false 时不打印
 * @returns {Promise<object>} check 结果加 installed 成功项、failed 失败项、command(npm 命令名)
 */
const install = async (options = {}) => {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm', { result, installed, failed, pending } =
    await withUpgrades(options, async ({ item, picked, next, manifest, result, installed, failed }) => {
      try {
        // 优先直调 npm-cli.js(shell:false)规避 DEP0190 与 win32 的 npm.cmd EINVAL;找不到再回退 npm.cmd
        const npmCli = (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) ? process.env.npm_execpath
          : (() => {
            const guess = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
            return fs.existsSync(guess) ? guess : null;
          })();
        if (npmCli) execFileSync(process.execPath, [npmCli, 'install', `${item.name}@${picked}`],
          { cwd: result.root, stdio: options.stdio || 'pipe', shell: false });
        else execFileSync(npm, ['install', `${item.name}@${picked}`],
          { cwd: result.root, stdio: options.stdio || 'pipe', shell: true });

        const block = manifest[item.field];
        if (block && item.name in block && block[item.name] !== next) block[item.name] = next;
        installed.push({ ...item, picked, next });
      }
      catch (err) { failed.push({ ...item, reason: err.message || String(err) }); }
    });
  const out = { ...result, installed, failed, pending, command: npm };
  if (options.print !== false) printTitle('更新并安装依赖'), printInstall(out);
  return out;
};

/**
 * 更新根目录 package.json 中可升级的依赖(不执行 npm install),默认打印结果
 * >查看定义:@see {@link update}
 * @param {{root?: string, refresh?: boolean, choose?: 'p'|'s'|Function, print?: boolean}} [options] 同 check;
 *   choose 预发布选择:'p'/'prerelease' 取预发布(缺省),'s'/'stable' 取稳定版,也可传回调 (item)=>version;
 *   print 传 false 时不打印
 * @returns {Promise<object>} check 结果加 updated 已写入项
 */
const update = async (options = {}) => {
  const { result, updated, pending } = await withUpgrades(options, ({ item, picked, next, manifest, updated }) => {
    const block = manifest[item.field];
    if (!block || !(item.name in block)) return;
    block[item.name] = next, updated.push({ ...item, picked, next });
  });
  const out = { ...result, updated, pending };
  if (options.print !== false) printHead('更新 package.json', out.root), printWarn(out.warnings), printBody(out, true);
  return out;
};

export { check, install, update };