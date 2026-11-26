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
  /**
   * 打印可选列表(预发布无更新但稳定版更高),按是否已写入分两种呈现
   * @param {object} result 检查结果
   * @param {boolean} [written=false] 是否已写入(决定文案)
   * @returns {void}
   */
  printChoices = (result, written = false) => {
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
  },
  printGroups = (okList, failList, verb) => {
    const ok = okList || [], fail = failList || [];
    if (!ok.length && !fail.length) return;
    const okMain = ok.filter(i => i.field !== 'overrides'), okOvr = ok.filter(i => i.field === 'overrides'),
      failMain = fail.filter(i => i.field !== 'overrides'), failOvr = fail.filter(i => i.field === 'overrides');
    console.log(`    ${chalk.cyan(verb + '结果:')}`);
    if (okMain.length) console.log(`      ${chalk.green('✓ 成功')}  ${chalk.cyanBright(okMain.map(i => i.name).join('、'))}`);
    if (okOvr.length) console.log(`      ${chalk.green('✓ 成功')}  ${chalk.cyanBright(okOvr.map(i => i.name).join('、'))}${chalk.gray('  overrides')}`);
    if (failMain.length) console.log(`      ${chalk.red('✗ 失败')}  ${chalk.yellowBright(failMain.map(i => i.name).join('、'))}`);
    if (failOvr.length) console.log(`      ${chalk.red('✗ 失败')}  ${chalk.yellowBright(failOvr.map(i => i.name).join('、'))}${chalk.gray('  overrides')}`);
  },
  printRoot = root => console.log(`    ${chalk.cyan('根目录 ')}${chalk.gray(root)}`),
  printOverrides = (result, hint) => {
    const list = (result && result.overrides) || [];
    if (!list.length) { console.log(''); return; }
    console.log(`    ${chalk.cyan(hint ? 'overrides 可升项(' + hint + ')' : 'overrides 可升项')}`);
    const mainRows = [].concat((result && result.upgrades) || [], (result && result.updated) || [])
      .filter(item => item && item.field !== 'overrides')
      .map(item => ({ name: item.name, current: item.current, target: item.target || item.latest }));
    printRows(list.map(item => ({
      name: item.path ? item.path.join(' > ') : item.name,
      current: item.current, target: item.target || item.latest, field: 'overrides'
    })), { written: false, extra: { rows: mainRows } });
    console.log('');
  },
  printUpdatePreview = (result) => {
    const mainRows = ((result && result.upgrades) || []).concat((result && result.upgrades) || []).concat((result && result.updated) || [])
      .filter(item => item && item.field !== 'overrides')
      .filter((item, i, arr) => arr.findIndex(x => x.name === item.name) === i)
      .map(item => ({ name: item.name, current: item.current, target: item.target || item.latest, field: item.field || 'dependencies' })),
      ovrRows = ((result && result.overrides) || [])
      .map(item => ({ name: item.path ? item.path.join(' > ') : item.name, current: item.current, target: item.target || item.latest, field: 'overrides' }));
    if (!mainRows.length && !ovrRows.length) return;
    const widths = _rowWidths(mainRows.concat(ovrRows));
    if (mainRows.length) {
      console.log(`    ${chalk.green('更新依赖')}`);
      for (const r of mainRows) _printRow(r, widths, true);
    }
    if (ovrRows.length) {
      console.log(`    ${chalk.cyan('overrides 可升项')}`);
      for (const r of ovrRows) _printRow(r, widths, false);
      console.log('');
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
  },
  _rowWidths = (rows, extraRows = [], minLatest = 0) => ({
    name: Math.max(0, ...rows.map(r => dispWidth(String(r.name))), ...extraRows.map(r => dispWidth(String(r.name)))),
    current: Math.max(0, ...rows.map(r => dispWidth(String(r.current))), ...extraRows.map(r => dispWidth(String(r.current)))),
    latest: Math.max(minLatest, ...rows.map(r => dispWidth(String(r.target != null ? r.target : r.latest))), ...extraRows.map(r => dispWidth(String(r.target != null ? r.target : r.latest))))
  }),
  _printRow = (row, widths, written) => {
    const target = row.target != null ? row.target : row.latest,
      pre = /-[0-9A-Za-z.-]+$/.test(String(target).replace(/[\^~]|>=|<=|>|<|=/g, '')),
      rawTag = pre ? '预发布' : (written ? '稳定版' : '最新'), tag = (pre ? chalk.magenta : chalk.greenBright)(padWidth('(' + rawTag + ')', 8));
    console.log(`      ${chalk.cyanBright(padWidth(String(row.name), widths.name))}  `
      + chalk.blue(`${padWidth(String(row.current), widths.current)} → `) + chalk.green(padWidth(String(target), widths.latest + 1))
      + tag + chalk.gray(`  ${row.field}`));
  },
  printRows = (rows, opts = {}) => {
    const { written = false, extra } = opts, ex = extra || {},
      widths = _rowWidths(rows, ex.rows || [], ex.minLatest || 0);
    for (const row of rows) _printRow(row, widths, written);
  },
  printVersionTable = (view, written, label, extraLatest = 0) => {
    const paint = written ? chalk.green : chalk.cyan;
    if (label && !written) {
      const _ln = `    ${paint(label + ' ')}${chalk.greenBright(String(view.length))}`;
      console.log(_ln + paint(' 项'));
    }
    printRows(view.map(item => ({
      name: item.name, current: item.current,
      target: written ? (item.picked || item.next || item.target || item.latest) : (item.target || item.latest),
      field: item.field
    })), { written, extra: { minLatest: extraLatest || 0 } });
  };
/**
 * 打印主体(版本表/跳过/分组/可选/稳定版提示)
 * >查看定义:@see {@link printBody}
 * @param {object} result 检查结果
 * @param {boolean} [written=false] 是否已写入
 * @param {string} [verb] 表头动词,缺省按 written 推导
 * @returns {void}
 */
const printBody = (result, written = false, verb, tail = true) => {
  const label = verb || (written ? '已更新' : '可升级'),
    view = ((written ? (result.updated || result.upgrades) : result.upgrades) || [])
      .filter(item => item.field !== 'overrides');
  if (view.length) {
    const ovrLatest = Math.max(0, ...((result && result.overrides) || []).map(o => dispWidth(String(o.target || o.latest))));
    printVersionTable(view, written, label, ovrLatest);
  }
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
  if (written && tail) printRoot(result.root);
  if (written && tail) printGroups(result.updated, result.failed, '更新');
  if (tail) printChoices(result, written), printStableHint(result);
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
export { printBody, printGroups, printHead, printInstall, printOverrides, printRoot, printTitle, printUpdatePreview, printWarn };