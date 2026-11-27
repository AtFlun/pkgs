const fs = require('fs');
const PB = 'D:/flun/pkgs/pkgs.js';
let p = fs.readFileSync(PB, 'utf8');
if (p.indexOf('\r\n') >= 0) throw new Error('pkgs.js 含 CR');
if (p.indexOf('applyUpgrade') >= 0) { console.log('OK 已含 applyUpgrade,跳过'); process.exit(0); }

const def = `const applyUpgrade = (ctx, { recordInstall = false, skipMissing = false } = {}) => {
  const { item, picked, next, manifest, updated, installed } = ctx;
  if (item.field === 'overrides') setOverride(manifest, item.path, next);
  else {
    const block = manifest[item.field];
    if (!block || !(item.name in block)) { if (skipMissing) return; }
    else if (block[item.name] !== next) block[item.name] = next;
  }
  if (recordInstall) installed.push({ ...item, picked, next });
  updated.push({ ...item, picked, next });
};
`;

// 1) 在 install 定义前插入公共函数
const insAnchor = 'const install = async (options = {}) => {';
const i1 = p.indexOf(insAnchor);
if (i1 < 0) throw new Error('锚点未找到: install 定义');
if (p.indexOf(insAnchor, i1 + 1) >= 0) throw new Error('锚点非唯一: install 定义');
p = p.slice(0, i1) + def + p.slice(i1);

// 2) install handleItem 写回块 -> 调用
const insRe = /if \(item\.field === 'overrides'\) setOverride\(manifest, item\.path, next\);\s*else\s*\{\s*const block = manifest\[item\.field\];\s*if \(block && item\.name in block && block\[item\.name\] !== next\) block\[item\.name\] = next;\s*\}\s*installed\.push\(\{ \.\.\.item, picked, next \}\), updated\.push\(\{ \.\.\.item, picked, next \}\);/;
if (!insRe.test(p)) throw new Error('锚点未匹配: install 写回块');
p = p.replace(insRe, 'applyUpgrade({ item, picked, next, manifest, updated, installed }, { recordInstall: true });');

// 3) update handleItem 写回块 -> 调用
const updRe = /if \(item\.field === 'overrides'\) setOverride\(manifest, item\.path, next\);\s*else\s*\{\s*const block = manifest\[item\.field\];\s*if \(!block || !\(item\.name in block\)\) return;\s*block\[item\.name\] = next;\s*\}\s*updated\.push\(\{ \.\.\.item, picked, next \}\);/;
if (!updRe.test(p)) throw new Error('锚点未匹配: update 写回块');
p = p.replace(updRe, 'applyUpgrade({ item, picked, next, manifest, updated }, { skipMissing: true });');

fs.writeFileSync(PB, p, 'utf8');
console.log('OK 已提取 applyUpgrade 并替换两处调用');
console.log('ALL-DONE');
