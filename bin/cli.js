#!/usr/bin/env node
import chalk from 'chalk';
import { check, install, update } from '../index.js';

const raw = process.argv.slice(2), refresh = raw.some(arg => arg === '--refresh' || arg === '-r'),
  rest = raw.filter(arg => arg !== '--refresh' && arg !== '-r'), cmd = rest[0],
  dispWidth = text => {
    let width = 0;
    for (const ch of text) width += ch.codePointAt(0) > 127 ? 2 : 1;
    return width;
  },
  fail = err => {
    console.error(`    ${chalk.red('✗ ')}${chalk.gray(err?.message || String(err))}`);
    process.exitCode = 1;
  },
  padWidth = (text, width) => {
    const current = dispWidth(text);
    return current >= width ? text : text + ' '.repeat(width - current);
  },
  skipPaint = item => item.reason.startsWith('星号') ? chalk.dim : chalk.yellow,
  formatSkip = (item, widths) => `      ${skipPaint(item)(padWidth(item.name, widths.name))}  `
    + chalk.gray(`${padWidth(item.range, widths.range)} · ${item.reason}`),
  formatUpgrade = (item, widths) => `      ${chalk.cyanBright(padWidth(item.name, widths.name))}  `
    + chalk.blue(`${padWidth(item.current, widths.current)} → `) + chalk.green(padWidth(item.latest, widths.latest))
    + chalk.greenBright(' (最新)') + chalk.gray(`  ${item.field}`),
  printBody = (result, written = false) => {
    const label = written ? '已更新' : '可升级', paint = written ? chalk.green : chalk.cyan;
    if (result.upgrades.length) {
      const widths = {
        name: Math.max(...result.upgrades.map(item => dispWidth(item.name))),
        current: Math.max(...result.upgrades.map(item => dispWidth(item.current))),
        latest: Math.max(...result.upgrades.map(item => dispWidth(item.latest)))
      };
      console.log(`    ${paint(label + ' ')}${chalk.greenBright(String(result.upgrades.length))}` + paint(' 项'));
      for (const item of result.upgrades) console.log(formatUpgrade(item, widths));
    }
    else console.log(`    ${chalk.cyan('状态 ')}${chalk.green(written ? '全部依赖已是最新' : '没有可升级的依赖')}`);
    if (result.skipped.length) {
      const widths = {
        name: Math.max(...result.skipped.map(item => dispWidth(item.name))),
        range: Math.max(...result.skipped.map(item => dispWidth(item.range)))
      };
      console.log(`    ${chalk.yellow('跳过 ')}${chalk.yellowBright(String(result.skipped.length))}` + chalk.yellow(' 项'));
      for (const item of result.skipped) console.log(formatSkip(item, widths));
    }
    console.log('');
  },
  printHead = (title, root) => {
    console.log(chalk.blueBright(`\n  ${title}`)), console.log(`    ${chalk.cyan('根目录 ')}${chalk.gray(root)}`);
  },
  printHelp = () => {
    const cmdLine = (name, desc) => `      ${chalk.cyanBright(name.padEnd(12))}${chalk.gray(desc)}`,
      grp = name => `    ${chalk.cyan(name)}`;
    console.log([
      `  ${chalk.blueBright('用法:')} pags <命令> [选项]`, '',
      grp('命令'),
      cmdLine('c', '查询项目中可升级的依赖(全写 check)'),
      cmdLine('u', '更新 package.json 中的依赖版本,不执行安装(全写 update)'),
      cmdLine('i', '执行安装最新依赖,等同于 u + npm install(全写 install)'),
      cmdLine('help', '输出本帮助'), '',
      grp('选项'),
      cmdLine('-r', '重新查询 registry,忽略 1 小时缓存;完整写法 --refresh'), '',
      `  ${chalk.gray('无参数、help、-h、--help 输出本帮助;')}`
    ].join('\n'));
  },
  printWarn = texts => {
    for (const text of texts) console.log(`    ${chalk.yellow('⚠ ')}${chalk.gray(text)}`);
  },
  runCheck = async refresh => {
    try {
      const result = await check({ refresh });
      printHead('检查可升级依赖', result.root), printWarn(result.warnings), printBody(result);
    } catch (err) { fail(err); }
  },
  runInstall = async refresh => {
    try {
      console.log(chalk.blueBright('\n  更新并安装依赖'));
      console.log(`    ${chalk.cyan('步骤 ')}${chalk.gray('更新 package.json → 执行 npm install')}`);
      const result = await install({ refresh });
      console.log(`    ${chalk.cyan('根目录 ')}${chalk.gray(result.root)}`), printWarn(result.warnings);
      printBody(result, true);
      if (result.updated.length) console.log(`    ${chalk.cyan('安装 ')}${chalk.green('完成')}`
        + chalk.gray(`,命令: ${result.command}`));
      else console.log(`    ${chalk.cyan('安装 ')}${chalk.gray('跳过,无依赖需要更新')}`);
    } catch (err) { fail(err); }
  },
  runUpdate = async refresh => {
    try {
      const result = await update({ refresh });
      printHead('更新 package.json', result.root), printWarn(result.warnings), printBody(result, true);
    } catch (err) { fail(err); }
  };

// 命令以简写为默认用法;全写兼容:check=c, update=u, install=i
if (!cmd || cmd === 'help' || cmd === '-h' || cmd === '--help') printHelp();
else if (cmd === 'c' || cmd === 'check') await runCheck(refresh);
else if (cmd === 'u' || cmd === 'update') await runUpdate(refresh);
else if (cmd === 'i' || cmd === 'install') await runInstall(refresh);
else fail(new Error(`未知命令: ${cmd}`)), printHelp();