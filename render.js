import chalk from 'chalk';
import { compareVer } from './net.js';

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
  // 版本前缀剥离与预发布判定,统一正则避免各处写法漂移
  joinNames = list => list.map(i => i.name).join('、'),
  maxDisp = (rows, extraRows, fn, min = 0) => Math.max(min, ...rows.map(fn), ...extraRows.map(fn)),
  rowTarget = r => r.target != null ? r.target : r.latest, stripPrefix = v => String(v).replace(/[\^~]|>=|<=|>|<|=/g, ''),
  isPreVer = v => /-[0-9A-Za-z.-]+$/.test(stripPrefix(v)),
  rowWidths = (rows, extraRows = [], minLatest = 0) => ({
    name: maxDisp(rows, extraRows, r => dispWidth(String(r.name))),
    current: maxDisp(rows, extraRows, r => dispWidth(String(r.current))),
    latest: maxDisp(rows, extraRows, r => dispWidth(String(rowTarget(r))), minLatest),
    altVer: maxDisp(rows, extraRows, r => r.alt ? dispWidth(String(r.alt.version)) : 0)
  }),
  altOf = item => {
    const target = item.target || item.latest, pre = isPreVer(target);
    if (!pre && item.prerelease && compareVer(item.prerelease, target) > 0)
      return { label: '最新预发布', version: item.prerelease, pre: true };
    if (pre && item.latest && !isPreVer(item.latest) && compareVer(item.latest, target) > 0)
      return { label: '最新稳定版', version: item.latest, pre: false };
    return null;
  },
  buildView = (result, written = false) => {
    const base = ((written ? (result.updated || result.upgrades) : result.upgrades) || [])
      .filter(item => item.field !== 'overrides'),
      choiceRows = written ? [] : (result.choices || []).filter(item => item.field !== 'overrides')
        .map(item => ({ ...item, target: item.latest, choice: true }));
    return base.concat(choiceRows).sort((a, b) => a.name.localeCompare(b.name))
      .map(item => ({ ...item, target: item.target || item.latest, alt: written ? null : altOf(item) }));
  },
  ovrRowsOf = result => ((result && result.overrides) || [])
    .map(item => ({
      name: item.path ? item.path.join(' > ') : item.name,
      current: item.current, target: item.target || item.latest, field: 'overrides'
    })),
  padWidth = (text, width) => {
    const current = dispWidth(text);
    return current >= width ? text : text + ' '.repeat(width - current);
  },
  printRow = (row, widths, written) => {
    const target = rowTarget(row), pre = isPreVer(target),
      rawTag = pre ? '预发布' : '稳定版', tag = (pre ? chalk.magenta : chalk.greenBright)(padWidth('(' + rawTag + ')', 8)),
      altText = row.alt ? (row.alt.pre ? ' (预发布)' : ' (稳定版)') : '',
      alt = row.alt ? chalk.gray('、') + (row.alt.pre ? chalk.magenta : chalk.green)
        (padWidth(String(row.alt.version), widths.altVer)) + (row.alt.pre ? chalk.magenta : chalk.greenBright)(altText)
        : (widths.altVer ? ' '.repeat(dispWidth('、') + widths.altVer + dispWidth(' (稳定版)')) : '');
    console.log(`      ${chalk.cyanBright(padWidth(String(row.name), widths.name))}  `
      + chalk.blue(`${padWidth(String(row.current), widths.current)} → `) +
      chalk.green(padWidth(String(target), widths.latest + 1)) + tag + alt + chalk.gray(`  ${row.field}`));
  },
  // 按 overrides 字段切分主表项与 overrides 项,成功/失败两组共用同一模式
  splitOvr = list => [list.filter(i => i.field !== 'overrides'), list.filter(i => i.field === 'overrides')],
  printGroups = (okList, failList, verb, ignoredList, pendingList, interactive = false) => {
    const ok = okList || [], fail = failList || [], ignored = ignoredList || [], pending = pendingList || [];
    if (!ok.length && !fail.length && (!ignored.length || interactive)
      && !pending.some(i => i.explicit) && (interactive || !pending.length)) return;

    const [okMain, okOvr] = splitOvr(ok), [failMain, failOvr] = splitOvr(fail),
      verOf = i => i.picked || i.next || i.target || i.latest, isPre = i => isPreVer(verOf(i)),
      fmt = arr => arr.map(i => `${i.name}@${stripPrefix(verOf(i))}`).join('、'),
      tags = ['✓ 稳定版', '✓ 预发布版', '✓ overrides', '✗ 失败', '✗ overrides', '✗ 忽略', '✗ 保持'],
      tagW = Math.max(...tags.map(dispWidth)), preOk = okMain.filter(isPre), stableOk = okMain.filter(i => !isPre(i)),
      line = (paint, tag, content, tail = '') => console.log(`      ${paint(padWidth(tag, tagW))}  ${content}${tail}`);

    console.log(`    ${chalk.cyan(verb + '结果:')}`);
    if (stableOk.length) line(chalk.green, '✓ 稳定版', chalk.cyanBright(fmt(stableOk)));
    if (preOk.length) line(chalk.magenta, '✓ 预发布版', chalk.cyanBright(fmt(preOk)));
    if (okOvr.length) line(chalk.green, '✓ overrides', chalk.cyanBright(fmt(okOvr)));
    if (failMain.length) line(chalk.red, '✗ 失败', chalk.yellowBright(fmt(failMain)));
    if (failOvr.length) line(chalk.red, '✗ overrides', chalk.yellowBright(fmt(failOvr)));
    const holdLines = [];
    if (ignored.length && !interactive)
      holdLines.push({
        tag: '✗ 忽略', names: joinNames(ignored), tail: ' (未显式指定 overrides 指令参数)'
      });
    const pendingExplicit = pending.filter(i => i.explicit && !i.reason),
      pendingAuto = pending.filter(i => !i.explicit && !i.reason), pendingHeld = pending.filter(i => i.reason)
        .reduce((m, i) => m.set(i.reason, (m.get(i.reason) || []).concat(i)), new Map());
    if (pendingExplicit.length)
      holdLines.push({
        tag: '✗ 保持', names: joinNames(pendingExplicit), tail: ' (已是最新可用版本,无更高版本)'
      });
    for (const [reason, group] of pendingHeld)
      holdLines.push({ tag: '✗ 忽略', names: joinNames(group), tail: ` (${reason})` });
    if (pendingAuto.length && !interactive)
      holdLines.push({
        tag: '✗ 忽略', names: joinNames(pendingAuto), tail: ' (未显式指定 choose 参数,保持当前版本)'
      });
    if (holdLines.length) {
      const nameW = Math.max(...holdLines.map(h => dispWidth(h.names)));
      for (const h of holdLines)
        line(chalk.yellow, h.tag, chalk.cyanBright(padWidth(h.names, nameW)), chalk.gray(h.tail));
    }
  },
  printRoot = root => console.log(`    ${chalk.cyan('根目录 ')}${chalk.gray(root)}`),
  printTitle = title => console.log(chalk.blueBright(`\n  ${title}`)),
  printHead = (title, root) => (printTitle(title), printRoot(root)),
  // 主表与 overrides 子表共用一次列宽计算,保证两表同列对齐;返回是否打印了内容
  printTables = (mainRows, ovrRows, written, title) => {
    if (!mainRows.length && !ovrRows.length) return false;
    const widths = rowWidths(mainRows.concat(ovrRows));
    if (mainRows.length) {
      if (title) console.log(`    ${chalk.cyan(title)}`);
      for (const row of mainRows) printRow(row, widths, written);
    }
    if (ovrRows.length) {
      console.log(`    ${chalk.cyan('overrides 可升项')}`);
      for (const row of ovrRows) printRow(row, widths, false);
      console.log('');
    }
    return true;
  },
  printUpdatePreview = (result, verb) => {
    const mainRows = buildView(result, false).filter(item => item.field !== 'overrides')
      .filter((item, i, arr) => arr.findIndex(x => x.name === item.name) === i)
      .map(item => ({ ...item, field: item.field || 'dependencies' }));
    printTables(mainRows, ovrRowsOf(result), true, verb);
  },
  // 打印主体(版本表 / 跳过 / 分组 / 忽略)
  printBody = (result, written = false, verb, tail = true) => {
    if (!printTables(buildView(result, written), ovrRowsOf(result), written)
      && !(result.pending || []).length)
      console.log(`    ${chalk.cyan('状态 ')}${chalk.green(written ? '全部依赖已是最新' : '没有可升级的依赖')}`);
    if (result.skipped.length) {
      const widths = {
        name: Math.max(...result.skipped.map(item => dispWidth(item.name))),
        range: Math.max(...result.skipped.map(item => dispWidth(item.range)))
      };
      console.log(`    ${chalk.yellow('跳过 ')}` +
        `${chalk.yellowBright(String(result.skipped.length))}${chalk.yellow(' 项')}`);
      for (const item of result.skipped) {
        const paint = chalk.yellow;
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
    printRoot(result.root), printGroups(list, result.failed, verb, ignoredList, result.pending, result.interactive);
  };

/**
 * 检查结果的展示组装(标题+警告+版本表+overrides 表),命令行与函数路径共用;
 * >查看定义:@see {@link printCheck}
 * @param {object} result check 结果(含 root/warnings/overrides)
 */
const printCheck = result => {
  printHead('可升级依赖', result.root), printWarn(result.warnings), printBody(result);
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
  printWarn(probe.warnings), printUpdatePreview(probe, verb + '依赖');
  if ((probe.overrides || []).length && overridesOpt === undefined && askOverrides) overrides = await askOverrides(probe);
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