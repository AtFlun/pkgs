const fs = require('fs');
function rep(text, oldStr, newStr, what) {
  const i = text.indexOf(oldStr);
  if (i < 0) throw new Error('锚点未找到: ' + what);
  if (text.indexOf(oldStr, i + 1) >= 0) throw new Error('锚点非唯一: ' + what);
  return text.slice(0, i) + newStr + text.slice(i + oldStr.length);
}
// ================= render.js: 组装函数收口在 render 层 =================
const RB = 'D:/flun/pkgs/render.js';
let r = fs.readFileSync(RB, 'utf8');
if (r.indexOf('\r\n') >= 0) throw new Error('render.js 含 CR');
if (r.indexOf('printFlowStart') >= 0) console.log('OK render 已含 printFlowStart,跳过');
else {
  const def = "\n/**\n * 流程起始组装(标题+警告+预览表+按需询问 overrides),顺序在此收口;\n * 返回解析后的 overrides(询问为真则含 overrides 项)\n * @param {'安装'|'更新'} verb 表头动词\n * @param {object} probe check 结果(含 warnings/overrides/upgrades)\n * @param {(probe)=>Promise<boolean>} askOverrides 交互询问回调,无则跳过\n * @param {*} overridesOpt 显式 overrides 参数(函数用法)\n */\nconst printFlowStart = async (verb, probe, askOverrides, overridesOpt) => {\n  let overrides = overridesOpt;\n  printTitle(verb);\n  printWarn(probe.warnings);\n  printUpdatePreview(probe, verb + '依赖');\n  if ((probe.overrides || []).length && overridesOpt === undefined && askOverrides)\n    overrides = await askOverrides(probe);\n  return overrides;\n};\n";
  r = rep(r,
    "export { printBody, printHead, printInstall, printOverrides, printTitle, printUpdate, printUpdatePreview, printWarn };",
    def + "export { printBody, printHead, printInstall, printOverrides, printTitle, printUpdate, printUpdatePreview, printWarn, printFlowStart };",
    'render 加 printFlowStart 并导出');
  console.log('OK render 已加 printFlowStart 并导出');
  fs.writeFileSync(RB, r, 'utf8');
}
// ================= pkgs.js: 调用组装函数,去掉内联 print 序列 =================
const PB = 'D:/flun/pkgs/pkgs.js';
let p = fs.readFileSync(PB, 'utf8');
if (p.indexOf('\r\n') >= 0) throw new Error('pkgs.js 含 CR');
// import 补 printFlowStart
if (p.indexOf('printFlowStart') >= 0) console.log('OK pkgs import 已含 printFlowStart,跳过');
else {
  p = rep(p,
    "import { printBody, printHead, printInstall, printOverrides, printTitle, printUpdate, printUpdatePreview, printWarn } from './render.js';",
    "import { printBody, printHead, printInstall, printOverrides, printTitle, printUpdate, printUpdatePreview, printWarn, printFlowStart } from './render.js';",
    'pkgs import 补 printFlowStart');
  console.log('OK pkgs import 已补 printFlowStart');
}
// install:内联 print 块 -> printFlowStart
const insOld = "  if (options.print !== false) {\n    printTitle('安装'), printWarn(probe.warnings), printUpdatePreview(probe, '安装依赖');\n    if ((probe.overrides || []).length && overrides === undefined && options.askOverrides)\n      overrides = await options.askOverrides(probe);\n  }";
if (p.indexOf("overrides = await printFlowStart('安装'") >= 0) console.log('OK install 已用 printFlowStart,跳过');
else { p = rep(p, insOld, "  if (options.print !== false) overrides = await printFlowStart('安装', probe, options.askOverrides, overrides);", 'install 用 printFlowStart'); console.log('OK install 已改用 printFlowStart'); }
// update:内联 print 块 -> printFlowStart
const updOld = "  if (options.print !== false) {\n    printTitle('更新'), printWarn(probe.warnings), printUpdatePreview(probe, '更新依赖');\n    if ((probe.overrides || []).length && overrides === undefined && options.askOverrides)\n      overrides = await options.askOverrides(probe);\n  }";
if (p.indexOf("overrides = await printFlowStart('更新'") >= 0) console.log('OK update 已用 printFlowStart,跳过');
else { p = rep(p, updOld, "  if (options.print !== false) overrides = await printFlowStart('更新', probe, options.askOverrides, overrides);", 'update 用 printFlowStart'); console.log('OK update 已改用 printFlowStart'); }
fs.writeFileSync(PB, p, 'utf8');
console.log('pkgs.js 已写入');
console.log('ALL-DONE');
