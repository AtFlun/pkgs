#!/usr/bin/env node
import chalk from 'chalk';
import readline from 'readline';
import { check, install, update } from '../index.js';
import { compareVer } from '../net.js';

let rl = null, queue = [], waiter = null;
const open = () => {
  if (rl) return;
  rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
  rl.on('line', line => {
    if (waiter) { const w = waiter; waiter = null; w(line); }
    else queue.push(line);
  });
  rl.once('close', () => {
    rl = null;
    if (waiter) { const w = waiter; waiter = null; w(null); }
  });
},
  readLine = () => new Promise(resolve => {
    if (queue.length) return resolve(queue.shift());
    waiter = resolve;
  }),
  // 管道模式 readline 不回显输入,补回显避免提示与下一行挤在一起;终端下由 readline 自行回显
  echo = line => {
    if (!process.stdin.isTTY && line !== null) process.stdout.write(chalk.gray(String(line)) + '\n');
  },
  prompt = async (fallback, pick) => {
    open();
    process.stdout.write(chalk.gray('    > '));
    const line = await readLine();
    echo(line);
    return line === null ? fallback : pick(String(line).trim());
  },
  askLine = (item, ctx, text, fallback, pick) => {
    const nm = chalk.cyanBright(String(item.name).padEnd(ctx.maxNameW || 0));
    console.log(chalk.gray('    ') + nm + chalk.gray(' ' + text));
    return prompt(fallback, pick);
  };
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
  askChoose = (item, ctx = {}) => {
    const curPre = item.pre, sameVer = curPre ? item.prerelease : item.latest,
      oppVer = curPre ? item.latest : item.prerelease,
      sameNewer = Boolean(sameVer) && compareVer(sameVer, item.current) > 0,
      oppNewer = Boolean(oppVer) && compareVer(oppVer, item.current) > 0,
      sameName = curPre ? '预发布' : '稳定版', oppName = curPre ? '稳定版' : '预发布';
    if (sameNewer && oppNewer)
      return askLine(item, ctx, `输入2为${oppName},输入任意键或1或确认键为${sameName}`,
        sameVer, ans => ans === '2' ? oppVer : sameVer);
    if (sameNewer) return Promise.resolve(sameVer);
    if (oppNewer)
      return askLine(item, ctx, `输入2为${oppName},输入任意键或1或确认键不升级${oppName}`,
        item.current, ans => ans === '2' ? oppVer : item.current);
    return Promise.resolve(item.current);
  },
  askOverrideCount = async probe => {
    const n = (probe.overrides || []).length;
    if (!n) return false;
    try {
      open();
      process.stdout.write(chalk.gray(`    是否同时更新 ${n} 项 overrides? [y/N]: `));
      const line = await readLine();
      echo(line);
      return /^y(es)?$/i.test(String(line || '').trim());
    } catch { return false; }
  },
  closeAsk = () => {
    if (!rl) return;
    rl.close(), rl = null, queue = [], waiter = null;
  },
  fail = err => {
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
      cmdLine('--choose', '预发布/稳定版: p|prerelease 预发布, s|stable 稳定版(简写 -c);仅 update/install 有效'),
      cmdLine('-s', '等价于 --choose s(稳定版);对称地 -p/--prerelease 等价于 --choose p'),
      cmdLine('--overrides', '连同 overrides 可升项一起更新/安装;仅 update/install 有效,不传则交互询问'), '',
      `  ${chalk.gray('无参数、help、-h、--help 输出本帮助;')}`
    ].join('\n'));
  },
  runCheck = async refresh => {
    try { await check({ refresh, overrides, print: true }); } catch (err) { fail(err); }
  },
  runInstall = async refresh => {
    try {
      await install({
        refresh, overrides: overrides || undefined, askOverrides: askOverrideCount, print: true,
        choose: chooseArg || askChoose, interactive: true, stdio: 'inherit'
      });
    } catch (err) { fail(err); } finally { closeAsk(); }
  },
  runUpdate = async refresh => {
    try {
      await update({
        refresh, overrides: overrides || undefined, askOverrides: askOverrideCount, print: true,
        choose: chooseArg || askChoose, interactive: true
      });
    } catch (err) { fail(err); } finally { closeAsk(); }
  };

// 命令以简写为默认用法;全写兼容:check=c, update=u, install=i
if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') printHelp();
else if (cmd === 'c' || cmd === 'check') await runCheck(refresh);
else if (cmd === 'u' || cmd === 'update') await runUpdate(refresh);
else if (cmd === 'i' || cmd === 'install') await runInstall(refresh);
else fail(new Error(`未知命令: ${cmd}`)), printHelp();