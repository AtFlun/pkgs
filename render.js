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
  printGroups = (okList, failList, verb) => {
    const ok = okList || [], fail = failList || [];
    if (!ok.length && !fail.length) return;
    console.log(`    ${chalk.cyan(verb + '结果:')}`);
    if (ok.length) console.log(`      ${chalk.green('✓ 成功')}  ${chalk.cyanBright(ok.map(i => i.name).join('、'))}`);
    if (fail.length) console.log(`      ${chalk.red('✗ 失败')}  ${chalk.yellowBright(fail.map(i => i.name).join('、'))}`);
  },
  printVersionTable = (view, written, label) => {
    const paint = written ? chalk.green : chalk.cyan,
      widths = {
        name: Math.max(...view.map(item => dispWidth(item.name))),
        current: Math.max(...view.map(item => dispWidth(item.current))),
        latest: Math.max(...view.map(item => dispWidth(item.target || (written ? (item.picked || item.latest)
          : item.latest))))
      };
    if (label && !written) {
      const _ln127 = `    ${paint(label + ' ')}${chalk.greenBright(String(view.length))}`;
      console.log(_ln127 + paint(' 项'));
    }
    for (const item of view) {
      const target = written ? (item.picked || item.next || item.target || item.latest) : (item.target || item.latest),
        pre = /-[0-9A-Za-z.-]+$/.test(String(target).replace(/[\^~]|>=|<=|>|<|=/g, '')),
        tag = pre ? chalk.magenta(' (预发布)') : chalk.greenBright(written ? ' (稳定版)' : ' (最新)');
      console.log(`      ${chalk.cyanBright(padWidth(item.name, widths.name))}  `
        + chalk.blue(`${padWidth(item.current, widths.current)} → `) + chalk.green(padWidth(target, widths.latest))
        + tag + chalk.gray(`  ${item.field}`));
    }
  },
  printStableHint = result => {
    if (result.interactive) return;
    const isPreVer = v => /-[0-9A-Za-z.-]+$/.test(String(v).replace(/[\^~]|>=|<=|>|<|=/g, '')),
      src = (result.updated?.length) ? result.updated : (result.installed?.length) ? result.installed
        : (result.upgrades || []), list = (src || []).filter(item => {
          const fin = item.picked || item.target || item.latest;
          return fin && isPreVer(fin) && item.latest && !isPreVer(item.latest) && compareVer(item.latest, fin) > 0;
        });
    if (!list.length) return;
    const names = list.map(item => chalk.cyanBright(item.name)).join(chalk.gray('、')),
      vers = list.map(item => chalk.green(item.latest)).join(chalk.gray('、'));
    console.log(`    ${chalk.yellow('提示 ')}${names}${chalk.gray(' 有更高稳定版 → ')}${vers}`);
    console.log(`    ${chalk.gray('如需升级最新稳定版请传参 ')}${chalk.cyan('{choose:s}')}${chalk.gray(' 后重新执行')}`);
  };

/**
 * 打印可选列表(预发布无更新但稳定版更高),按是否已写入分两种呈现
 * >查看定义:@see {@link printChoices}
 * @param {object} result 检查结果
 * @param {boolean} [written=false] 是否已写入(决定文案)
 * @returns {void}
 */
const printChoices = (result, written = false) => {
  const done = new Set((result.updated || []).map(item => item.name)),
    base = result.updated ? (result.pending || []) : (result.choices || []),
    list = base.filter(item => !done.has(item.name));
  if (!list.length) return;
  const width = Math.max(...list.map(item => dispWidth(item.name)));
  if (written) {
    console.log(`    ${chalk.cyan('保持 ')}${chalk.yellowBright(String(list.length))}${chalk.cyan(' 项')}`);
    for (const item of list) console.log(
      `      ${chalk.cyanBright(padWidth(item.name, width))}  ` + chalk.blue(item.current) + chalk.gray(' 保持不变')
      + chalk.gray(`  ${item.field}`));
    return;
  }
  const _ln46 = `    ${chalk.cyan('可选 ')}${chalk.yellowBright(String(list.length))}` +
    `${chalk.cyan(' 项(预发布无更新,稳定版更高)')}`;
  console.log(_ln46);
  for (const item of list) console.log(
    `      ${chalk.cyanBright(padWidth(item.name, width))}  `
    + chalk.gray('最新预发布 ') + chalk.magenta((item.prerelease || item.current))
    + chalk.gray('   最新稳定版 ') + chalk.green(item.latest));
};

/**
 * 打印根目录行
 * >查看定义:@see {@link printRoot}
 * @param {string} root 根目录路径
 * @returns {void}
 */
const printRoot = root => console.log(`    ${chalk.cyan('根目录 ')}${chalk.gray(root)}`);

/**
 * 打印主体(版本表/跳过/分组/可选/稳定版提示)
 * >查看定义:@see {@link printBody}
 * @param {object} result 检查结果
 * @param {boolean} [written=false] 是否已写入
 * @param {string} [verb] 表头动词,缺省按 written 推导
 * @returns {void}
 */
const printBody = (result, written = false, verb) => {
  const label = verb || (written ? '已更新' : '可升级'),
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
    for (const item of result.skipped) {
      const paint = item.reason.startsWith('星号') ? chalk.dim : chalk.yellow;
      console.log(`      ${paint(padWidth(item.name, widths.name))}  `
        + chalk.gray(`${padWidth(item.range, widths.range)} · ${item.reason}`));
    }
  }
  if (written) printRoot(result.root);
  if (written) printGroups(result.updated, result.failed, '更新');
  printChoices(result, written), printStableHint(result), console.log('');
};

/**
 * 打印分组标题
 * >查看定义:@see {@link printTitle}
 * @param {string} title 标题文本
 * @returns {void}
 */
const printTitle = title => console.log(chalk.blueBright(`\n  ${title}`));

/**
 * 打印标题与根目录(组合 printTitle + printRoot)
 * >查看定义:@see {@link printHead}
 * @param {string} title 标题文本
 * @param {string} root 根目录路径
 * @returns {void}
 */
const printHead = (title, root) => (printTitle(title), printRoot(root));

/**
 * 逐条打印警告
 * >查看定义:@see {@link printWarn}
 * @param {string[]} texts 警告文本数组
 * @returns {void}
 */
const printWarn = texts => {
  for (const text of texts) console.log(`    ${chalk.yellow('⚠ ')}${chalk.gray(text)}`);
};

/**
 * 打印安装结果(警告/版本表/根目录/分组/稳定版提示)
 * >查看定义:@see {@link printInstall}
 * @param {object} result 安装结果
 * @returns {void}
 */
const printInstall = result => {
  printWarn(result.warnings);
  if (result.installed.length) printVersionTable(result.installed, true);
  printRoot(result.root), printGroups(result.installed, result.failed, '安装');
  printStableHint(result), console.log('');
};
export { printBody, printChoices, printHead, printInstall, printRoot, printTitle, printWarn };