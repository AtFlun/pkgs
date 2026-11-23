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
    const target = written ? (item.picked || item.latest) : item.latest,
      tag = written ? (item.prerelease && target === item.prerelease
        ? chalk.magenta(' (预发布)') : chalk.greenBright(' (稳定版)')) : chalk.greenBright(' (最新)');
    return `      ${chalk.cyanBright(padWidth(item.name, widths.name))}  `
      + chalk.blue(`${padWidth(item.current, widths.current)} → `) + chalk.green(padWidth(target, widths.latest))
      + tag
      + (!written && item.prerelease ? chalk.magenta(`  预发布 ${item.prerelease}`) : '')
      + chalk.gray(`  ${item.field}`);
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
        latest: Math.max(...view.map(item => dispWidth(written ? (item.picked || item.latest) : item.latest)))
      };
      console.log(`    ${paint(label + ' ')}${chalk.greenBright(String(view.length))}` + paint(' 项'));
      for (const item of view) console.log(formatUpgrade(item, widths, written));
    }
    else console.log(`    ${chalk.cyan('状态 ')}${chalk.green(written ? '全部依赖已是最新' : '没有可升级的依赖')}`);
    if (result.skipped.length) {
      const widths = {
        name: Math.max(...result.skipped.map(item => dispWidth(item.name))),
        range: Math.max(...result.skipped.map(item => dispWidth(item.range)))
      };
      console.log(`    ${chalk.yellow('跳过 ')}${chalk.yellowBright(String(result.skipped.length))}`
        + chalk.yellow(' 项'));
      for (const item of result.skipped) console.log(formatSkip(item, widths));
    }
    console.log('');
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

export { printBody, printHead, printInstall, printRoot, printTitle, printWarn };