const fs = require('fs');
function rep(text, oldStr, newStr, what) {
  const i = text.indexOf(oldStr);
  if (i < 0) throw new Error('锚点未找到: ' + what);
  if (text.indexOf(oldStr, i + 1) >= 0) throw new Error('锚点非唯一: ' + what);
  return text.slice(0, i) + newStr + text.slice(i + oldStr.length);
}
const PB = 'D:/flun/pkgs/pkgs.js';
let p = fs.readFileSync(PB, 'utf8');
if (p.indexOf('\r\n') >= 0) throw new Error('pkgs.js 含 CR');

// 1) 删掉文件开头游离的 applyUpgrade 调用行(在首个 import 之前)
const orphan = "applyUpgrade({ item, picked, next, manifest, updated }, { skipMissing: true });\n";
if (p.indexOf(orphan) === 0) { p = p.slice(orphan.length); console.log('OK 1 已删除顶部游离 applyUpgrade 调用'); }
else if (p.indexOf(orphan) < 0) console.log('OK 1 无游离调用,跳过');
else { p = p.replace(orphan, ''); console.log('OK 1 已删除非首行的游离 applyUpgrade 调用'); }

// 2) update 内联块 -> applyUpgrade 调用
const updOld = "  }) => {\n    if (item.field === 'overrides') setOverride(manifest, item.path, next);\n    else {\n      const block = manifest[item.field];\n      if (!block || !(item.name in block)) return;\n      block[item.name] = next;\n    }\n    updated.push({ ...item, picked, next });\n  }, probe);";
const updNew = "  }) => {\n    applyUpgrade({ item, picked, next, manifest, updated }, { skipMissing: true });\n  }, probe);";
if (p.indexOf('applyUpgrade({ item, picked, next, manifest, updated }, { skipMissing: true });\n  }, probe);') >= 0) console.log('OK 2 update 已用 applyUpgrade,跳过');
else { p = rep(p, updOld, updNew, 'update 用 applyUpgrade'); console.log('OK 2 update 已改用 applyUpgrade'); }

fs.writeFileSync(PB, p, 'utf8');
console.log('ALL-DONE');
