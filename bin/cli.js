#!/usr/bin/env node
import chalk from 'chalk';
import readline from 'readline';
import { check, install, update } from '../index.js';
import { printBody, printHead, printInstall, printTitle, printUpdate, printUpdatePreview, printWarn } from '../render.js';

let rl = null;
const raw = process.argv.slice(2), has = (...a) => raw.some(arg => a.includes(arg)),
  refresh = has('--refresh', '-r'), stable = has('--stable', '-s'), pre = has('--prerelease', '-p'),
  overrides = has('--overrides'), chooseAt = (() => {
    const i = raw.findIndex(a => a === '--choose' || a === '-c');
    return i >= 0 ? (raw[i + 1] && !raw[i + 1].startsWith('-') ? raw[i + 1] : 'p') : null;
  })(), chooseArg = chooseAt || (stable ? 's' : pre ? 'p' : null),
  rest = raw.filter((arg, i) => {
    if (['--refresh', '-r', '--stable', '-s', '--prerelease', '-p'].includes(arg)) return false;
    if (arg === '--overrides') return false;
    if (arg === '--choose' || arg === '-c') return false;
    if (i > 0 && (raw[i - 1] === '--choose' || raw[i - 1] === '-c')) return false;
    return true;
  }), cmd = rest[0],
  // 显式 --choose/-c 或 -s/-p 决定预发布/稳定版(与函数 choose 同形);都不传则询问交互
  askChoose = item => new Promise(resolve => {
    const open = () => { rl || (rl = readline.createInterface({ input: process.stdin, output: process.stdout })); };
    if (item.mode === 'stable') {
      const nm = chalk.cyanBright(String(item.name).padEnd(24)), cur = chalk.blue(String(item.current).padEnd(8)),
        lat = chalk.green(String(item.latest).padEnd(9));
      console.log(`    ${nm}${cur}${chalk.gray('→ ')}${lat}${chalk.greenBright('(稳定版)')}`);
      return resolve(item.latest);
    }
    if (item.mode === 'choose') {
      console.log(`    ${chalk.cyan(item.name)}${chalk.gray(` 当前 ${item.current},预发布已无更新`)}`);
      console.log(`      ${chalk.green('1)')} 保持不变   ${chalk.gray('(默认)')}`);
      console.log(`      ${chalk.green('2)')} 稳定版 ${chalk.green(item.latest)} ${chalk.gray('更高')}`);
      if (!process.stdin.isTTY) return resolve(item.current);
      open();
      return rl.question(chalk.gray('    请输入 1/2,回车默认 1: '), ans => resolve(ans.trim() === '2' ? item.latest
        : item.current));
    }
    const head = `${chalk.cyanBright(String(item.name).padEnd(24))}${chalk.blue(String(item.current).padEnd(8))}→ `,
      pre = `${chalk.magenta(item.target)}${chalk.magenta(' (预发布版)')}`,
      or = `${chalk.gray('或')}  ${chalk.green(item.latest)}${chalk.greenBright(' (稳定版)')}`;
    console.log(`    ${head}${pre}  ${or}`);
    console.log(chalk.gray('    请输入 1/2,输入2为稳定版,否则回车或1或任意键→预发布'));
    if (!process.stdin.isTTY) return resolve(item.target);
    open();
    return rl.question(chalk.gray('    > '), ans => resolve(ans.trim() === '2' ? item.latest : item.target));
  }),
  closeAsk = () => {
    if (!rl) return;
    rl.close(), rl = null;
  },
  resolveOverrides = async (probe) => {
    if (overrides) return true;
    if (!process.stdin.isTTY) return false;
    try {
      probe = probe || await check({ refresh, overrides: true, print: false });
      const n = (probe.overrides || []).length;
      if (!n) return false;
      rl || (rl = readline.createInterface({ input: process.stdin, output: process.stdout }));
      return await new Promise(resolve => rl.question(
        chalk.gray(`    是否同时更新 ${n} 项 overrides? [y/N]: `), ans => resolve(/^y(es)?$/i.test(String(ans).trim()))));
    } catch { return false; }
  }, fail = err => {
    console.error(`    ${chalk.red('✗ ')}${chalk.gray(err?.message || String(err))}`), process.exitCode = 1;
  },
  printHelp = () => {
    const cmdLine = (name, desc) => `      ${chalk.cyanBright(name.padEnd(12))}${chalk.gray(desc)}`,
      grp = name => `    ${chalk.cyan(name)}`;
    console.log([
      `  ${chalk.blueBright('用法:')} pkgs <命令> [选项]`, '',
      grp('命令'),
      cmdLine('c', '查询项目中可升级的依赖(全写 check)'),
      cmdLine('u', '更新 package.json 中的依赖版本,不执行安装(全写 update)'),
      cmdLine('i', '逐包升级并安装依赖,失败不中断继续下一个(全写 install)'),
      cmdLine('help', '输出本帮助'), '',
      grp('选项'),
      cmdLine('-r', '重新查询 registry,忽略 1 小时缓存;完整写法 --refresh'),
      cmdLine('--choose', '预发布/稳定版: p|prerelease 预发布(缺省), s|stable 稳定版(简写 -c);仅 update/install 有效'),
      cmdLine('-s', '等价于 --choose s(稳定版);对称地 -p/--prerelease 等价于 --choose p'),
      cmdLine('--overrides', '连同 overrides 可升项一起更新/安装;仅 update/install 有效,不传则交互询问'), '',
      `  ${chalk.gray('无参数、help、-h、--help 输出本帮助;')}`
    ].join('\n'));
  },
  runCheck = async refresh => {
    try {
      const result = await check({ refresh, overrides, print: false });
      printHead('检查可升级依赖', result.root), printWarn(result.warnings), printBody(result), printOverrides(result);
    } catch (err) { fail(err); }
  },
  runInstall = async refresh => {
    try {
      printTitle('安装');
      const probe = await check({ refresh, overrides: true, print: false });
      printWarn(probe.warnings);
      printUpdatePreview(probe, '安装依赖');
      const ovr = await resolveOverrides(probe),
        result = await install({
          refresh, overrides: ovr, print: false, choose: chooseArg || askChoose, interactive: true
        });
      printInstall(result, ovr ? [] : (result.overrides || []), true);
    } catch (err) { fail(err); } finally { closeAsk(); }
  },
  runUpdate = async refresh => {
    try {
      printTitle('更新');
      const probe = await check({ refresh, overrides: true, print: false });
      printWarn(probe.warnings);
      printUpdatePreview(probe, '更新依赖');
      const ovr = await resolveOverrides(probe),
        result = await update({
          refresh, overrides: ovr, print: false, choose: chooseArg || askChoose, interactive: true
        });
      printUpdate(result, ovr ? [] : (result.overrides || []), true);
    } catch (err) { fail(err); } finally { closeAsk(); }
  };

// 命令以简写为默认用法;全写兼容:check=c, update=u, install=i
if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') printHelp();
else if (cmd === 'c' || cmd === 'check') await runCheck(refresh);
else if (cmd === 'u' || cmd === 'update') await runUpdate(refresh);
else if (cmd === 'i' || cmd === 'install') await runInstall(refresh);
else fail(new Error(`未知命令: ${cmd}`)), printHelp();