#!/usr/bin/env node
import chalk from 'chalk';
import readline from 'readline';
import { check, install, update } from '../index.js';
import { printBody, printHead, printInstall, printTitle, printWarn } from '../render.js';

let rl = null;

const raw = process.argv.slice(2), refresh = raw.some(arg => arg === '--refresh' || arg === '-r'),
  rest = raw.filter(arg => arg !== '--refresh' && arg !== '-r'), cmd = rest[0],
  // 命令行靠询问决定预发布/稳定版;函数方式用 choose 传参,不交互
  askChoose = item => new Promise(resolve => {
    rl || (rl = readline.createInterface({ input: process.stdin, output: process.stdout }));
    console.log(`    ${chalk.cyan(item.name)}${chalk.gray(` 当前 ${item.current}`)}`);
    console.log(`      ${chalk.green('1)')} 最新预发布版 ${chalk.magenta(item.prerelease)} ${chalk.gray('(默认)')}`);
    console.log(`      ${chalk.green('2)')} 最新稳定版   ${chalk.green(item.latest)}`);
    if (!process.stdin.isTTY) return resolve(item.prerelease);
    rl.question(chalk.gray('    请输入 1/2,回车默认 1: '), ans => resolve(ans.trim() === '2'
      ? item.latest : item.prerelease));
  }),
  closeAsk = () => {
    if (!rl) return;
    rl.close(), rl = null;
  },
  fail = err => {
    console.error(`    ${chalk.red('✗ ')}${chalk.gray(err?.message || String(err))}`), process.exitCode = 1;
  },
  printHelp = () => {
    const cmdLine = (name, desc) => `      ${chalk.cyanBright(name.padEnd(12))}${chalk.gray(desc)}`,
      grp = name => `    ${chalk.cyan(name)}`;
    console.log([
      `  ${chalk.blueBright('用法:')} pags <命令> [选项]`, '',
      grp('命令'),
      cmdLine('c', '查询项目中可升级的依赖(全写 check)'),
      cmdLine('u', '更新 package.json 中的依赖版本,不执行安装(全写 update)'),
      cmdLine('i', '逐包安装最新依赖,失败不中断继续下一个(全写 install)'),
      cmdLine('help', '输出本帮助'), '',
      grp('选项'),
      cmdLine('-r', '重新查询 registry,忽略 1 小时缓存;完整写法 --refresh'), '',
      `  ${chalk.gray('无参数、help、-h、--help 输出本帮助;')}`
    ].join('\n'));
  },
  runCheck = async refresh => {
    try {
      const result = await check({ refresh, print: false });
      printHead('检查可升级依赖', result.root), printWarn(result.warnings), printBody(result);
    } catch (err) { fail(err); }
  },
  runInstall = async refresh => {
    try {
      printTitle('更新并安装依赖');
      const result = await install({ refresh, print: false, choose: askChoose });
      printInstall(result);
    } catch (err) { fail(err); } finally { closeAsk(); }
  },
  runUpdate = async refresh => {
    try {
      const result = await update({ refresh, print: false, choose: askChoose });
      printHead('更新 package.json', result.root), printWarn(result.warnings), printBody(result, true);
    } catch (err) { fail(err); } finally { closeAsk(); }
  };

// 命令以简写为默认用法;全写兼容:check=c, update=u, install=i
if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') printHelp();
else if (cmd === 'c' || cmd === 'check') await runCheck(refresh);
else if (cmd === 'u' || cmd === 'update') await runUpdate(refresh);
else if (cmd === 'i' || cmd === 'install') await runInstall(refresh);
else fail(new Error(`未知命令: ${cmd}`)), printHelp();