import chalk from 'chalk';

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
  printChoices = result => {
    const done = new Set((result.updated || []).map(item => item.name));
    const base = result.updated ? (result.pending || []) : (result.choices || []);
    const list = base.filter(item => !done.has(item.name));
    if (!list.length) return;
    const width = Math.max(...list.map(item => dispWidth(item.name)));
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
  printBody = (result, written = false) => {
    const label = written ? '已更新' : '可升级', paint = written ? chalk.green : chalk.cyan,
      updMap = written ? new Map((result.updated || []).map(u => [u.name, u])) : null,
      view = written ? result.upgrades.map(item => updMap.get(item.name) || item) : result.upgrades;
    if (view.length) {
      const widths = {
        name: Math.max(...view.map(item => dispWidth(item.name))),
        current: Math.max(...view.map(item => dispWidth(item.current))),
        latest: Math.max(...view.map(item => dispWidth(item.target || (written ? (item.picked || item.latest)
          : item.latest))))
      };
      console.log(`    ${paint(label + ' ')}${chalk.greenBright(String(view.length))}` + paint(' 项'));
      for (const item of view) console.log(formatUpgrade(item, widths, written));
    }
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
    printChoices(result), console.log('');
  },
  printInstall = result => {
    printRoot(result.root), printWarn(result.warnings);
    if (!result.upgrades.length) console.log(`    ${chalk.cyan('安装 ')}${chalk.gray('跳过,无依赖需要更新')}`);
    else {
      for (const item of result.installed) console.log(`    ${chalk.green('✓ ')}${chalk.cyanBright(item.name)}  `
        + chalk.blue(item.current + ' → ') + chalk.green(item.picked || item.latest) + chalk.gray(`  ${item.field}`));
      for (const item of result.failed) console.log(`    ${chalk.red('✗ ')}${chalk.yellowBright(item.name)}  `
        + chalk.gray(item.reason));
      console.log(''), console.log(`    ${chalk.cyan('安装 ')}${chalk.green('成功 ' + result.installed.length)}`
        + chalk.red(' 失败 ' + result.failed.length));
    }
  };

export { printBody, printChoices, printHead, printInstall, printRoot, printTitle, printWarn };