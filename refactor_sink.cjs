const fs = require('fs');
function rep(text, oldStr, newStr, what) {
  const i = text.indexOf(oldStr);
  if (i < 0) throw new Error('锚点未找到: ' + what);
  if (text.indexOf(oldStr, i + 1) >= 0) throw new Error('锚点非唯一: ' + what);
  return text.slice(0, i) + newStr + text.slice(i + oldStr.length);
}
// ================= pkgs.js =================
const PB = 'D:/flun/pkgs/pkgs.js';
let p = fs.readFileSync(PB, 'utf8');
if (p.indexOf('\r\n') >= 0) throw new Error('pkgs.js 含 CR');
// 1) import 补 printUpdatePreview
if (p.indexOf('printUpdatePreview') >= 0) console.log('OK pkgs import 已含 printUpdatePreview,跳过');
else {
  p = rep(p,
    "import { printBody, printHead, printInstall, printOverrides, printTitle, printUpdate, printWarn } from './render.js';",
    "import { printBody, printHead, printInstall, printOverrides, printTitle, printUpdate, printUpdatePreview, printWarn } from './render.js';",
    'pkgs import 补 printUpdatePreview');
  console.log('OK pkgs import 已补 printUpdatePreview');
}
// 2) withUpgrades 加 preResult + overrides 拼接
const wuOld = "  withUpgrades = async (options, handleItem) => {\n    const result = await check({ ...options, print: false }), manifest = readManifest(result.root), updated = [],\n      installed = [], failed = [], pending = [];\n    for (const item of [...result.upgrades, ...result.choices]) {";
const wuNew = "  withUpgrades = async (options, handleItem, preResult) => {\n    const result = preResult || await check({ ...options, print: false }), manifest = readManifest(result.root), updated = [],\n      installed = [], failed = [], pending = [];\n    const list = [...result.upgrades, ...result.choices].concat(options.overrides ? (result.overrides || []) : []);\n    for (const item of list) {";
if (p.indexOf('withUpgrades = async (options, handleItem, preResult)') >= 0) console.log('OK withUpgrades 已是新形式,跳过');
else { p = rep(p, wuOld, wuNew, 'withUpgrades preResult'); console.log('OK withUpgrades 已加 preResult+overrides 拼接'); }
// 3) install 整体替换
const insOld = p.slice(p.indexOf('const install = async (options = {}) => {'));
const insEnd = insOld.indexOf('\n};\n') + '\n};\n'.length;
const insNew = "const install = async (options = {}) => {\n  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';\n  let overrides = options.overrides;\n  const probe = await check({ ...options, overrides: true, print: false });\n  if (options.print !== false) {\n    printTitle('安装'), printWarn(probe.warnings), printUpdatePreview(probe, '安装依赖');\n    if ((probe.overrides || []).length && overrides === undefined && options.askOverrides)\n      overrides = await options.askOverrides(probe);\n  }\n  const { result, updated, installed, failed, pending } = await withUpgrades({ ...options, overrides, print: false }, async ({\n    item, picked, next, manifest, result, updated, installed, failed\n  }) => {\n    try {\n      const npmCli = (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) ? process.env.npm_execpath\n        : (() => {\n          const guess = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');\n          return fs.existsSync(guess) ? guess : null;\n        })();\n      if (npmCli) execFileSync(process.execPath, [npmCli, 'install', `${item.name}@${picked}`],\n        { cwd: result.root, stdio: options.stdio || 'pipe', shell: false });\n      else execFileSync(npm, ['install', `${item.name}@${picked}`],\n        { cwd: result.root, stdio: options.stdio || 'pipe', shell: true });\n\n      if (item.field === 'overrides') setOverride(manifest, item.path, next);\n      else {\n        const block = manifest[item.field];\n        if (block && item.name in block && block[item.name] !== next) block[item.name] = next;\n      }\n      installed.push({ ...item, picked, next }), updated.push({ ...item, picked, next });\n    }\n    catch (err) { failed.push({ ...item, reason: err.message || String(err) }); }\n  }, probe);\n  const out = { ...result, updated, installed, failed, pending, command: npm, interactive: options.interactive === true };\n  if (options.print !== false) printInstall(out, overrides ? [] : (out.overrides || []), true);\n  return out;\n};\n";
if (p.indexOf("const probe = await check({ ...options, overrides: true, print: false });\n  if (options.print !== false) {\n    printTitle('安装')") >= 0) console.log('OK install 已是新形式,跳过');
else { p = p.slice(0, p.indexOf('const install = async (options = {}) => {')) + insNew + p.slice(p.indexOf('const install = async (options = {}) => {') + insEnd); console.log('OK install 已重写(编排下沉)'); }
// 4) update 整体替换
const updOld = "const update = async (options = {}) => {\n  const { result, updated, pending } = await withUpgrades(options, ({ item, picked, next, manifest, updated }) => {\n    if (item.field === 'overrides') setOverride(manifest, item.path, next);\n    else {\n      const block = manifest[item.field];\n      if (!block || !(item.name in block)) return;\n      block[item.name] = next;\n    }\n    updated.push({ ...item, picked, next });\n  }), out = { ...result, updated, pending, interactive: options.interactive === true };\n\n  if (options.print !== false) printTitle('更新'), printUpdate(out, options.overrides ? [] : (out.overrides || []));\n  return out;\n};";
const updNew = "const update = async (options = {}) => {\n  let overrides = options.overrides;\n  const probe = await check({ ...options, overrides: true, print: false });\n  if (options.print !== false) {\n    printTitle('更新'), printWarn(probe.warnings), printUpdatePreview(probe, '更新依赖');\n    if ((probe.overrides || []).length && overrides === undefined && options.askOverrides)\n      overrides = await options.askOverrides(probe);\n  }\n  const { result, updated, pending } = await withUpgrades({ ...options, overrides, print: false }, ({\n    item, picked, next, manifest, updated\n  }) => {\n    if (item.field === 'overrides') setOverride(manifest, item.path, next);\n    else {\n      const block = manifest[item.field];\n      if (!block || !(item.name in block)) return;\n      block[item.name] = next;\n    }\n    updated.push({ ...item, picked, next });\n  }, probe);\n  const out = { ...result, updated, pending, interactive: options.interactive === true };\n  if (options.print !== false) printUpdate(out, overrides ? [] : (out.overrides || []), true);\n  return out;\n};";
if (p.indexOf("const update = async (options = {}) => {\n  let overrides = options.overrides;") >= 0) console.log('OK update 已是新形式,跳过');
else { p = rep(p, updOld, updNew, 'update 编排下沉'); console.log('OK update 已重写(编排下沉)'); }
fs.writeFileSync(PB, p, 'utf8');
console.log('pkgs.js 已写入');
// ================= cli.js =================
const CB = 'D:/flun/pkgs/bin/cli.js';
let c = fs.readFileSync(CB, 'utf8');
if (c.indexOf('\r\n') >= 0) throw new Error('cli.js 含 CR');
// resolveOverrides -> askOverrideCount(probe) 只问不查
const roOld = "  resolveOverrides = async (probe) => {\n    if (overrides) return true;\n    if (!process.stdin.isTTY) return false;\n    try {\n      probe = probe || await check({ refresh, overrides: true, print: false });\n      const n = (probe.overrides || []).length;\n      if (!n) return false;\n      rl || (rl = readline.createInterface({ input: process.stdin, output: process.stdout }));\n      return await new Promise(resolve => rl.question(\n        chalk.gray(`    是否同时更新 ${n} 项 overrides? [y/N]: `), ans => resolve(/^y(es)?$/i.test(String(ans).trim()))));\n    } catch { return false; }\n  },";
const roNew = "  askOverrideCount = async (probe) => {\n    if (!process.stdin.isTTY) return false;\n    try {\n      const n = (probe.overrides || []).length;\n      if (!n) return false;\n      rl || (rl = readline.createInterface({ input: process.stdin, output: process.stdout }));\n      return await new Promise(resolve => rl.question(\n        chalk.gray(`    是否同时更新 ${n} 项 overrides? [y/N]: `), ans => resolve(/^y(es)?$/i.test(String(ans).trim()))));\n    } catch { return false; }\n  },";
if (c.indexOf('askOverrideCount = async') >= 0) console.log('OK resolveOverrides 已是 askOverrideCount,跳过');
else { c = rep(c, roOld, roNew, 'resolveOverrides->askOverrideCount'); console.log('OK resolveOverrides 已改 askOverrideCount(只问不查)'); }
// runInstall/runUpdate 缩回薄壳
const runOld = "  runInstall = async refresh => {\n    try {\n      printTitle('安装');\n      const probe = await check({ refresh, overrides: true, print: false });\n      printWarn(probe.warnings);\n      printUpdatePreview(probe, '安装依赖');\n      const ovr = await resolveOverrides(probe),\n        result = await install({\n          refresh, overrides: ovr, print: false, choose: chooseArg || askChoose, interactive: true\n        });\n      printInstall(result, ovr ? [] : (result.overrides || []), true);\n    } catch (err) { fail(err); } finally { closeAsk(); }\n  },\n  runUpdate = async refresh => {\n    try {\n      printTitle('更新');\n      const probe = await check({ refresh, overrides: true, print: false });\n      printWarn(probe.warnings);\n      printUpdatePreview(probe, '更新依赖');\n      const ovr = await resolveOverrides(probe),\n        result = await update({\n          refresh, overrides: ovr, print: false, choose: chooseArg || askChoose, interactive: true\n        });\n      printUpdate(result, ovr ? [] : (result.overrides || []), true);\n    } catch (err) { fail(err); } finally { closeAsk(); }\n  };";
const runNew = "  runInstall = async refresh => {\n    try {\n      await install({\n        refresh, overrides: overrides || undefined, askOverrides: askOverrideCount, print: true,\n        choose: chooseArg || askChoose, interactive: true, stdio: 'inherit'\n      });\n    } catch (err) { fail(err); } finally { closeAsk(); }\n  },\n  runUpdate = async refresh => {\n    try {\n      await update({\n        refresh, overrides: overrides || undefined, askOverrides: askOverrideCount, print: true,\n        choose: chooseArg || askChoose, interactive: true\n      });\n    } catch (err) { fail(err); } finally { closeAsk(); }\n  };";
if (c.indexOf('askOverrideCount, print: true') >= 0) console.log('OK runInstall/runUpdate 已是薄壳,跳过');
else { c = rep(c, runOld, runNew, 'runInstall/runUpdate 薄壳'); console.log('OK runInstall/runUpdate 已缩回薄壳'); }
fs.writeFileSync(CB, c, 'utf8');
console.log('cli.js 已写入');
console.log('ALL-DONE');
