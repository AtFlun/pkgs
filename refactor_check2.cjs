const fs = require('fs');
function rep(text, oldStr, newStr, what) {
  const i = text.indexOf(oldStr);
  if (i < 0) throw new Error('锚点未找到: ' + what);
  if (text.indexOf(oldStr, i + 1) >= 0) throw new Error('锚点非唯一: ' + what);
  return text.slice(0, i) + newStr + text.slice(i + oldStr.length);
}
// ================= pkgs.js: check 用 printCheck =================
const PB = 'D:/flun/pkgs/pkgs.js';
let p = fs.readFileSync(PB, 'utf8');
if (p.indexOf('\r\n') >= 0) throw new Error('pkgs.js 含 CR');
if (p.indexOf('printCheck') >= 0) console.log('OK pkgs 已含 printCheck,跳过');
else {
  p = rep(p,
    "import { printBody, printHead, printInstall, printOverrides, printUpdate, printWarn, printFlowStart } from './render.js';",
    "import { printBody, printHead, printInstall, printOverrides, printUpdate, printWarn, printFlowStart, printCheck } from './render.js';",
    'pkgs import 补 printCheck');
  p = rep(p,
    "  if (options.print !== false) {\n    printHead('检查可升级依赖', root), printWarn(warnings), printBody(result);\n    (result.overrides || []).length && printOverrides(result);\n  }",
    "  if (options.print !== false) printCheck(result);",
    'check 用 printCheck');
  console.log('OK pkgs 已补 printCheck import 并改用 printCheck');
  fs.writeFileSync(PB, p, 'utf8');
}
// ================= cli.js: runCheck 用 printCheck,清多余 import =================
const CB = 'D:/flun/pkgs/bin/cli.js';
let c = fs.readFileSync(CB, 'utf8');
if (c.indexOf('\r\n') >= 0) throw new Error('cli.js 含 CR');
if (c.indexOf('printCheck') >= 0) console.log('OK cli 已含 printCheck,跳过');
else {
  c = rep(c,
    "import { printBody, printHead, printWarn } from '../render.js';",
    "import { printCheck } from '../render.js';",
    'cli import 收敛为 printCheck');
  c = rep(c,
    "      const result = await check({ refresh, overrides, print: false });\n      printHead('检查可升级依赖', result.root), printWarn(result.warnings), printBody(result), printOverrides(result);",
    "      await check({ refresh, overrides, print: true });",
    'runCheck 委托 check 打印');
  console.log('OK cli runCheck 已委托 check(print:true)');
  fs.writeFileSync(CB, c, 'utf8');
}
console.log('ALL-DONE');
