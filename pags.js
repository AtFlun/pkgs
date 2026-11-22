import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { resolveLatest, resolvePrerelease } from './net.js';

const FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'],
  SEMVER = /^(?<prefix>\^|~|>=|<=|>|<|=)?(?<version>\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/,
  parseVer = text => {
    const [core, pre] = String(text).split('+')[0].split('-'), nums = core.split('.').map(n => Number(n) || 0);
    return { nums, pre: pre || '' };
  },
  compareVer = (left, right) => {
    const x = parseVer(left), y = parseVer(right);
    for (let i = 0; i < 3; i++)  if ((x.nums[i] || 0) !== (y.nums[i] || 0)) return (x.nums[i] || 0) - (y.nums[i] || 0);
    if (x.pre === y.pre) return 0;
    if (!x.pre) return 1;
    if (!y.pre) return -1;
    const cmpIdent = (xv, yv) => {
      if (xv === yv) return 0;
      const nx = /^\d+$/.test(xv), ny = /^\d+$/.test(yv);
      if (nx && ny) return Number(xv) - Number(yv);
      if (nx) return -1;
      if (ny) return 1;
      return xv < yv ? -1 : 1;
    };
    const sa = x.pre.split('.'), sb = y.pre.split('.');
    for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
      const c = cmpIdent(sa[i] || '', sb[i] || '');
      if (c !== 0) return c;
    }
    return 0;
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
 * 查询根目录 package.json 中可升级的依赖
 * >查看定义:@see {@link check}
 * @param {{root?: string, refresh?: boolean}} [options] root 指定项目根目录;refresh 忽略缓存
 * @returns {Promise<object>} root、upgrades、skipped、online、warnings
 */
const check = async (options = {}) => {
  const root = resolveRoot(options.root), manifest = readManifest(root), upgrades = [], skipped = [], items = [],
    names = new Set(), warnings = [];

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
    const target = latest[item.name];
    if (!target) {
      skipped.push({ ...item, reason: online ? 'registry 无此包' : '离线,未取到版本' });
      continue;
    }
    const preTarget = item.pre ? pre[item.name] || null : null;
    if (compareVer(target, item.current) <= 0 && !(preTarget && compareVer(preTarget, item.current) > 0)) continue;
    upgrades.push({ ...item, latest: target, prerelease: preTarget, next: item.prefix + target });
  }
  return { root, upgrades, skipped, online, warnings };
};

/**
 * 更新根目录 package.json 中可升级的依赖(不执行 npm install)
 * >查看定义:@see {@link update}
 * @param {{root?: string, refresh?: boolean, choose?: Function}} [options] 同 check;
 *   choose 预发布选择回调,缺省取预发布版(传回 item.latest 则选稳定版)
 * @returns {Promise<object>} check 结果加 updated 已写入项
 */
const update = async (options = {}) => {
  const result = await check(options), manifest = readManifest(result.root), updated = [];
  if (!result.upgrades.length) return { ...result, updated };
  for (const item of result.upgrades) {
    const picked = item.prerelease
      ? (options.choose ? await options.choose(item) : item.prerelease)
      : item.latest,
      next = item.prerelease && picked === item.prerelease ? item.prefix + item.prerelease : item.next;
    const block = manifest[item.field];
    if (!block || !(item.name in block)) continue;
    block[item.name] = next, updated.push({ ...item, picked, next });
  }
  if (updated.length) writeManifest(result.root, manifest);
  return { ...result, updated };
};

/**
 * 逐包升级并安装依赖:每个包单独执行 npm install <name>@<latest>,
 * 成功写入 package.json 并计入 installed,失败计入 failed 且不中断继续下一个
 * >查看定义:@see {@link install}
 * @param {{root?: string, refresh?: boolean, stdio?: string, choose?: Function}} [options] 同 check;
 *   stdio 传给 npm;choose 预发布选择回调,缺省取预发布版
 * @returns {Promise<object>} check 结果加 installed 成功项、failed 失败项、command(npm 命令名)
 */
const install = async (options = {}) => {
  const result = await check(options), npm = process.platform === 'win32' ? 'npm.cmd' : 'npm',
    manifest = readManifest(result.root), installed = [], failed = [];
  for (const item of result.upgrades) {
    const picked = item.prerelease
      ? (options.choose ? await options.choose(item) : item.prerelease)
      : item.latest,
      next = item.prerelease && picked === item.prerelease ? item.prefix + item.prerelease : item.next;
    try {
      execFileSync(npm, ['install', `${item.name}@${picked}`],
        { cwd: result.root, stdio: options.stdio || 'pipe', shell: false });
      const block = manifest[item.field];
      if (block && item.name in block) block[item.name] = next;
      installed.push({ ...item, picked, next });
    }
    catch (err) { failed.push({ ...item, reason: err.message || String(err) }); }
  }
  if (installed.length) writeManifest(result.root, manifest);
  return { ...result, installed, failed, command: npm };
};

export { check, install, update };