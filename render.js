import chalk from 'chalk';
import { compareVer } from './net.js';

const dispWidth = text => {
  let width = 0;
  for (const ch of text) width += ch.codePointAt(0) > 127 ? 2 : 1;
  return width;
},
  padWidth = (text, width) => {
    const current = dispWidth(text);
    return current >= width ? text : text + ' '.repeat(width - current);
  },
  skipPaint = item => item.reason.startsWith('星号') ? chalk.dim : chalk.yellow,
  formatSkip = (item, widths) => `      ${skipPaint(item)(padWidth(item.name, widths.name))}  `
    + chalk.gray(`${padWidth(item.range, widths.range)} · ${item.reason}`),
  formatUpgrade = (item, widths, written = false) => {
    const target = written ? (item.picked || item.next || item.target || item.latest) : (item.target || item.latest),
      pre = /-[0-9A-Za-z.-]+$/.test(String(target).replace(/[\^~]|>=|<=|>|<|=/g, '')),
      tag = pre ? chalk.magenta(' (预发布)') : chalk.greenBright(written ? ' (稳定版)' : ' (最新)');
    return `      ${chalk.cyanBright(padWidth(item.name, widths.name))}  `
      + chalk.blue(`${padWidth(item.current, widths.current)} → `) + chalk.green(padWidth(target, widths.latest))
      + tag
      + chalk.gray(`  ${item.field}`);
  },
  printChoices = (result, written = false) => {
    const done = new Set((result.updated || []).map(item => item.name));
    const base = result.updated ? (result.pending || []) : (result.choices || []);
    const list = base.filter(item => !done.has(item.name));
    if (!list.length) return;
    const width = Math.max(...list.map(item => dispWidth(item.name)));
    if (written) {
      console.log(`    ${chalk.cyan('保持 ')}${chalk.yellowBright(String(list.length))}${chalk.cyan(' 项')}`);
      for (const item of list) console.log(
        `      ${chalk.cyanBright(padWidth(item.name, width))}  `
        + chalk.blue(item.current) + chalk.gray(' 保持不变')
        + chalk.gray(`  ${item.field}`));
      return;
    }
    console.log(`    ${chalk.cyan('可选 ')}${chalk.yellowBright(String(list.length))}${chalk.cyan(' 项(预发布无更新,稳定版更高)')}`);
    for (const item of list) console.log(
      `      ${chalk.cyanBright(padWidth(item.name, width))}  `
      + chalk.gray('最新预发布 ') + chalk.magenta((item.prerelease || item.current))
      + chalk.gray('   最新稳定版 ') + chalk.green(item.latest));
  },
  printTitle = title => console.log(chalk.blueBright(`\n  ${title}`)),
  printRoot = root => console.log(`    ${chalk.cyan('根目录 ')}${chalk.gray(root)}`),
  printHead = (title, root) => (printTitle(title), printRoot(root)),
  printWarn = texts => {
    for (const text of texts) console.log(`    ${chalk.yellow('⚠ ')}${chalk.gray(text)}`);
  },
  printBody = (result, written = false, verb) => {
    const label = verb || (written ? '已更新' : '可升级'), paint = written ? chalk.green : chalk.cyan,
      updMap = written ? new Map((result.updated || []).map(u => [u.name, u])) : null,
      view = written ? (result.updated || result.upgrades) : result.upgrades;
    if (view.length) printVersionTable(view, written, label);
    else if (!(result.choices || []).length && !(result.pending || []).length)
      console.log(`    ${chalk.cyan('状态 ')}${chalk.green(written ? '全部依赖已是最新' : '没有可升级的依赖')}`);
    if (result.skipped.length) {
      const widths = {
        name: Math.max(...result.skipped.map(item => dispWidth(item.name))),
        range: Math.max(...result.skipped.map(item => dispWidth(item.range)))
      };
      console.log(`    ${chalk.yellow('跳过 ')}${chalk.yellowBright(String(result.skipped.length))}` + chalk.yellow(' 项'));
      for (const item of result.skipped) console.log(formatSkip(item, widths));
    }
    if (written) printRoot(result.root);
    if (written) printGroups(result.updated, result.failed, '更新');
    printChoices(result, written), printStableHint(result), console.log('');
  },
  printGroups = (okList, failList, verb) => {
    const ok = okList || [], fail = failList || [];
    if (!ok.length && !fail.length) return;
    console.log(`    ${chalk.cyan(verb + '结果:')}`);
    if (ok.length)
      console.log(`      ${chalk.green('✓ 成功')}  ${chalk.cyanBright(ok.map(i => i.name).join('、'))}`);
    if (fail.length)
      console.log(`      ${chalk.red('✗ 失败')}  ${chalk.yellowBright(fail.map(i => i.name).join('、'))}`);
  },
  printVersionTable = (view, written, label) => {
    const paint = written ? chalk.green : chalk.cyan,
      widths = {
        name: Math.max(...view.map(item => dispWidth(item.name))),
        current: Math.max(...view.map(item => dispWidth(item.current))),
        latest: Math.max(...view.map(item => dispWidth(item.target || (written ? (item.picked || item.latest)
          : item.latest))))
      };
    if (label && !written) console.log(`    ${paint(label + ' ')}${chalk.greenBright(String(view.length))}` + paint(' 项'));
    for (const item of view) console.log(formatUpgrade(item, widths, written));
  },

  isPreVer = v => /-[0-9A-Za-z.-]+$/.test(String(v).replace(/[\^~]|>=|<=|>|<|=/g, '')),
  printStableHint = result => {
    if (result.interactive) return;
    const src = (result.updated && result.updated.length) ? result.updated
      : (result.installed && result.installed.length) ? result.installed : (result.upgrades || []);
    const list = (src || []).filter(item => {
      const fin = item.picked || item.target || item.latest;
      return fin && isPreVer(fin) && item.latest && !isPreVer(item.latest) && compareVer(item.latest, fin) > 0;
    });
    if (!list.length) return;
    const width = Math.max(...list.map(item => dispWidth(item.name)));
    const names = list.map(item => chalk.cyanBright(item.name)).join(chalk.gray('、'));
    const vers = list.map(item => chalk.green(item.latest)).join(chalk.gray('、'));
    console.log(`    ${chalk.yellow('提示 ')}${names}${chalk.gray(' 有更高稳定版 → ')}${vers}`);
    console.log(`    ${chalk.gray('如需升级最新稳定版请传参 ')}${chalk.cyan('{choose:s}')}${chalk.gray(' 后重新执行')}`);
  },
  printInstall = result => {
    printWarn(result.warnings);
    if (result.installed.length) printVersionTable(result.installed, true);
    printRoot(result.root);
    printGroups(result.installed, result.failed, '安装');
    printStableHint(result);
    console.log('');
  };
export { printBody, printChoices, printHead, printInstall, printRoot, printTitle, printWarn };