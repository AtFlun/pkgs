import chalk from 'chalk';
import { compareVer } from './net.js';

let _previewWidths = null;

const dispWidth = text => {
  let width = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    width += (cp >= 0x2E80 && cp <= 0xA4CF) || (cp >= 0xAC00 && cp <= 0xD7A3)
      || (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0xFE30 && cp <= 0xFE6F)
      || (cp >= 0xFF00 && cp <= 0xFF60) || (cp >= 0xFFE0 && cp <= 0xFFE6) ? 2 : 1;
  }
  return width;
},
  _rowWidths = (rows, extraRows = [], minLatest = 0) => ({
    name: Math.max(0, ...rows.map(r => dispWidth(String(r.name))), ...extraRows.map(r => dispWidth(String(r.name)))),
    current: Math.max(0, ...rows.map(r => dispWidth(String(r.current))),
      ...extraRows.map(r => dispWidth(String(r.current)))),
    latest: Math.max(minLatest, ...rows.map(r => dispWidth(String(r.target != null ? r.target : r.latest))),
      ...extraRows.map(r => dispWidth(String(r.target != null ? r.target : r.latest)))),
    altVer: Math.max(0, ...rows.map(r => r.alt ? dispWidth(String(r.alt.version)) : 0),
      ...extraRows.map(r => r.alt ? dispWidth(String(r.alt.version)) : 0))
  }),
  altOf = item => {
    const target = item.target || item.latest,
      pre = /-[0-9A-Za-z.-]+$/.test(String(target).replace(/[\^~]|>=|<=|>|<|=/g, ''));
    if (!pre && item.prerelease && compareVer(item.prerelease, target) > 0)
      return { label: '最新预发布', version: item.prerelease, pre: true };
    if (pre && item.latest && !/-/.test(String(item.latest).replace(/[\^~]|>=|<=|>|<|=/g, ''))
      && compareVer(item.latest, target) > 0)
      return { label: '最新稳定版', version: item.latest, pre: false };
    return null;
  },
  padWidth = (text, width) => {
    const current = dispWidth(text);
    return current >= width ? text : text + ' '.repeat(width - current);
  },
  _printRow = (row, widths, written) => {
    const target = row.target != null ? row.target : row.latest,
      pre = /-[0-9A-Za-z.-]+$/.test(String(target).replace(/[\^~]|>=|<=|>|<|=/g, '')),
      rawTag = pre ? '预发布' : '稳定版', tag = (pre ?
        chalk.magenta : chalk.greenBright)(padWidth('(' + rawTag + ')', 8)),
      alt = row.alt
        ? chalk.gray('  、 ')
        + (row.alt.pre ? chalk.magenta : chalk.green)(padWidth(String(row.alt.version), widths.altVer))
        + (row.alt.pre ? chalk.magenta : chalk.greenBright)(row.alt.pre ? ' (预发布)' : ' (稳定版)')
        : (widths.altVer ? ' '.repeat(widths.altVer + 14) : '');
    console.log(`      ${chalk.cyanBright(padWidth(String(row.name), widths.name))}  `
      + chalk.blue(`${padWidth(String(row.current), widths.current)} → `) +
      chalk.green(padWidth(String(target), widths.latest + 1)) + tag + alt + chalk.gray(`  ${row.field}`));
  },
  // 打印可选列表(预发布无更新但稳定版更高), 按是否已写入分两种呈现
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
  printGroups = (okList, failList, verb, ignoredList) => {
    const ok = okList || [], fail = failList || [], ignored = ignoredList || [];
    if (!ok.length && !fail.length && !ignored.length) return;
    const okMain = ok.filter(i => i.field !== 'overrides'), okOvr = ok.filter(i => i.field === 'overrides'),
      failMain = fail.filter(i => i.field !== 'overrides'), failOvr = fail.filter(i => i.field === 'overrides'),
      verOf = i => i.picked || i.next || i.target || i.latest,
      isPre = i => /-[0-9A-Za-z.-]+$/.test(String(verOf(i)).replace(/[\^~]|>=|<=|>|<|=/g, '')),
      fmt = arr => arr.map(i => `${i.name}@${String(verOf(i)).replace(/^[\^~]/, '')}`).join('、'),
      tagW = Math.max(...['✓ 稳定版', '✓ 预发布版', '✓ overrides', '✗ 失败', '✗ overrides', '! 忽略'].map(dispWidth)),
      line = (paint, tag, content, tail = '') => console.log(`      ${paint(padWidth(tag, tagW))}  ${content}${tail}`),
      preOk = okMain.filter(isPre), stableOk = okMain.filter(i => !isPre(i));
    console.log(`    ${chalk.cyan(verb + '结果:')}`);
    if (stableOk.length) line(chalk.green, '✓ 稳定版', chalk.cyanBright(fmt(stableOk)));
    if (preOk.length) line(chalk.magenta, '✓ 预发布版', chalk.cyanBright(fmt(preOk)));
    if (okOvr.length) line(chalk.green, '✓ overrides', chalk.cyanBright(fmt(okOvr)));
    if (failMain.length) line(chalk.red, '✗ 失败', chalk.yellowBright(fmt(failMain)));
    if (failOvr.length) line(chalk.red, '✗ overrides', chalk.yellowBright(fmt(failOvr)));
    if (ignored.length) line(chalk.yellow, '! 忽略', chalk.cyanBright(ignored.map(i => i.name).join('、')),
      chalk.gray(' (未显式指定 overrides 指令参数)'));
  },
  printRoot = root => console.log(`    ${chalk.cyan('根目录 ')}${chalk.gray(root)}`),
  printRows = (rows, opts = {}) => {
    const { written = false, extra } = opts, ex = extra || {}, widths = _rowWidths(rows, ex.rows || [], ex.minLatest || 0);
    for (const row of rows) _printRow(row, widths, written);
  },
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
  // 交互询问首行与预览表同列对齐;无预览宽度时退回自身宽度
  pickLine = (item, tail) => {
    const widths = _previewWidths || {
      name: dispWidth(String(item.name)), current: dispWidth(String(item.current))
    };
    console.log(`      ${chalk.cyanBright(padWidth(String(item.name), widths.name))}  `
      + chalk.blue(padWidth(String(item.current), widths.current)) + ' → ' + tail);
  },
  printTitle = title => console.log(chalk.blueBright(`\n  ${title}`)),
  printHead = (title, root) => (printTitle(title), printRoot(root)),
  printUpdatePreview = (result, verb) => {
    const mainRows = ((result && result.upgrades) || [])
      .concat((result && result.updated) || [])
      .filter(item => item && item.field !== 'overrides')
      .filter((item, i, arr) => arr.findIndex(x => x.name === item.name) === i)
      .map(item => ({
        name: item.name, current: item.current, target: item.target || item.latest,
        field: item.field || 'dependencies', alt: altOf(item)
      })),
      ovrRows = ((result && result.overrides) || [])
        .map(item => ({
          name: item.path ? item.path.join(' > ') : item.name, current: item.current,
          target: item.target || item.latest, field: 'overrides'
        }));
    if (!mainRows.length && !ovrRows.length) return;
    const widths = _rowWidths(mainRows.concat(ovrRows)); _previewWidths = widths;
    if (mainRows.length) {
      console.log(`    ${chalk.green(verb || '更新依赖')}`);
      for (const r of mainRows) _printRow(r, widths, true);
    }
    if (ovrRows.length) {
      console.log(`    ${chalk.cyan('overrides 可升项')}`);
      for (const r of ovrRows) _printRow(r, widths, false);
      console.log('');
    }
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
      field: item.field, choice: item.choice, alt: item.alt
    })), { written, extra: { minLatest: extraLatest || 0 } });
  },
  // 主表与 overrides 子表共用一次列宽计算,保证两表同列对齐
  printCombined = (mainRows, ovrRows, written, label) => {
    const widths = _rowWidths(mainRows.concat(ovrRows));
    _previewWidths = widths;
    if (label && !written && mainRows.length) {
      const paint = chalk.cyan;
      console.log(`    ${paint(label + ' ')}${chalk.greenBright(String(mainRows.length))}${paint(' 项')}`);
    }
    for (const row of mainRows) _printRow(row, widths, written);
    if (ovrRows.length) {
      console.log(`    ${chalk.cyan('overrides 可升项')}`);
      for (const row of ovrRows) _printRow(row, widths, false);
      console.log('');
    }
  },
  // 打印主体(版本表 / 跳过 / 分组 / 可选 / 稳定版提示)
  printBody = (result, written = false, verb, tail = true) => {
    const label = verb || (written ? '已更新' : '可升级'),
      base = ((written ? (result.updated || result.upgrades) : result.upgrades) || [])
        .filter(item => item.field !== 'overrides'),
      choiceRows = written ? [] : (result.choices || [])
        .filter(item => item.field !== 'overrides')
        .map(item => ({ ...item, target: item.latest, choice: true })),
      view = base.concat(choiceRows).sort((a, b) => a.name.localeCompare(b.name))
        .map(item => ({ ...item, target: item.target || item.latest, alt: written ? null : altOf(item) })),
      ovrRows = ((result && result.overrides) || [])
        .map(item => ({
          name: item.path ? item.path.join(' > ') : item.name,
          current: item.current, target: item.target || item.latest, field: 'overrides'
        }));
    if (view.length || ovrRows.length) printCombined(view, ovrRows, written, label);
    else if (!(result.pending || []).length)
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
  },
  printWarn = texts => {
    for (const text of texts) console.log(`    ${chalk.yellow('⚠ ')}${chalk.gray(text)}`);
  },
  printResult = (result, ignoredList, verb, list, previewed) => {
    printWarn(result.warnings);
    if (!previewed) printUpdatePreview(result, verb + '依赖');
    printRoot(result.root), printGroups(list, result.failed, verb, ignoredList);
    if (result.pending && result.pending.length)
      console.log(`      ${chalk.yellow('! 忽略')}  ${chalk.cyanBright(result.pending.map(i => i.name).join('、'))}`
        + chalk.gray(' (未显式指定 choose 参数,保持当前版本)'));
  };

/**
 * 检查结果的展示组装(标题+警告+版本表+overrides 表),命令行与函数路径共用;
 * >查看定义:@see {@link printCheck}
 * @param {object} result check 结果(含 root/warnings/overrides)
 */
const printCheck = result => {
  printHead('检查可升级依赖', result.root), printWarn(result.warnings), printBody(result);
};

/**
 * 流程起始组装(标题+警告+预览表+按需询问 overrides),顺序在此收口;
 * 返回解析后的 overrides(询问为真则含 overrides 项)
 * >查看定义:@see {@link printFlowStart}
 * @param {'安装'|'更新'} verb 表头动词
 * @param {object} probe check 结果(含 warnings/overrides/upgrades)
 * @param {(probe)=>Promise<boolean>} askOverrides 交互询问回调,无则跳过
 * @param {*} overridesOpt 显式 overrides 参数(函数用法)
 */
const printFlowStart = async (verb, probe, askOverrides, overridesOpt) => {
  let overrides = overridesOpt;
  printTitle(verb), printWarn(probe.warnings), printUpdatePreview(probe, verb + '依赖');
  if ((probe.overrides || []).length && overridesOpt === undefined && askOverrides)
    overrides = await askOverrides(probe);
  return overrides;
};

/**
 * 打印安装结果(警告/版本表/根目录/分组/稳定版提示)
 * >查看定义:@see {@link printInstall}
 * @param {object} result 安装结果
 * @returns {void}
 */
const printInstall = (result, ignoredList, previewed) => {
  printResult(result, ignoredList, '安装', result.installed, previewed);
  printStableHint(result), console.log('');
};

/**
 * 打印更新结果(警告/版本表/根目录/分组/稳定版提示)
 * >查看定义:@see {@link printUpdate}
 * @param {object} result 更新结果
 * @returns {void}
 */
const printUpdate = (result, ignoredList, previewed) => {
  printResult(result, ignoredList, '更新', result.updated, previewed);
};

export { printCheck, printFlowStart, printInstall, printUpdate };