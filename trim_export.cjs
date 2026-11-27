const fs = require('fs');
function rep(text, oldStr, newStr, what) {
  const i = text.indexOf(oldStr);
  if (i < 0) throw new Error('锚点未找到: ' + what);
  if (text.indexOf(oldStr, i + 1) >= 0) throw new Error('锚点非唯一: ' + what);
  return text.slice(0, i) + newStr + text.slice(i + oldStr.length);
}
const RB = 'D:/flun/pkgs/render.js';
let r = fs.readFileSync(RB, 'utf8');
if (r.indexOf('\r\n') >= 0) throw new Error('render.js 含 CR');
const oldExp = "export { printBody, printHead, printInstall, printOverrides, printTitle, printUpdate, printUpdatePreview, printWarn, printFlowStart, printCheck };";
const newExp = "export { printInstall, printUpdate, printFlowStart, printCheck };";
if (r.indexOf(newExp) >= 0) console.log('OK export 已收敛,跳过');
else { r = rep(r, oldExp, newExp, 'export 行收敛为 4 个'); console.log('OK export 已收敛为 printInstall/printUpdate/printFlowStart/printCheck'); }
fs.writeFileSync(RB, r, 'utf8');
console.log('ALL-DONE');
