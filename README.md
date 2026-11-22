# @flun/pags

## 简介

Flun 依赖升级工具:查询项目中可升级的依赖,写新版本到根目录 package.json,安装最新依赖;

提供 `check`、`update`、`install` 三个函数,以及 `pags` 命令行;库入口只导出这三个函数,联网查询与本地缓存逻辑在内部完成;

---

## 特性

- `check` 查询根目录 package.json 中可升级的依赖,返回可升级项、跳过项与联网状态;
- `update` 把可升级版本写回根目录 package.json,不执行 npm install;
- `install` 逐包执行 `npm install <name>@<latest>`,成功计入 installed、失败计入 failed 且不中断继续下一个;
- 版本对比忽略 build 元数据,预发布版低于对应正式版;缺省选预发布版,`choose` 回调可改选稳定版;
- npm 版本查询缓存 1 小时,`-r` 或 `--refresh` 可重新查询最新版本;
- 联网失败或超时时降级处理并标注离线状态,不中断使用;
- 支持 `dependencies`、`devDependencies`、`optionalDependencies`、`peerDependencies` 四个字段,工作区与本地引用等非常规范围自动跳过;

---

## 包目录结构

随包发布的文件:

```
@flun/pags/
├── bin/
│   └── cli.js       命令行入口(bin: pags)
├── CHANGELOG.md     更新日志
├── README.md        本文件
├── index.d.ts       类型声明
├── index.js         库入口,转发 pags.js 的导出
├── net.js           联网查询最新版本与本地缓存
├── pags.js          check / update / install 三个函数
├── LICENSE          许可
└── package.json     包配置
```

---

## 安装前准备

### 允许安装脚本执行

本包在安装时可能触发某些依赖包的自动脚本(如 `postinstall` 等);如果你的 npm 全局配置或项目配置禁止了脚本执行(例如设置了
`ignore-scripts=true`),可能会导致安装不完整或运行时异常;

推荐在项目根目录的 `package.json` 中添加 `allowScripts` 字段,显式放行本包及其依赖的脚本:

```json
{
  "allowScripts": {
    "@flun/pags": true
  }
}
```

---

## 安装

```sh
npm i -D @flun/pags # 项目内安装(作为开发工具)

npm i -g @flun/pags # 全局安装(建议);之后使用 `pags help` 查看用法
```

---

## 命令行

### 快速开始

```sh
npx @flun/pags c
```

### 子命令

| 参数           | 作用                                      |
| -------------- | ----------------------------------------- |
| `c`, `check`   | 查询项目中可升级的依赖                    |
| `u`, `update`  | 更新 package.json 中的依赖版本,不执行安装 |
| `i`, `install` | 逐包安装最新依赖,失败不中断继续下一个     |
| `help`         | 输出本帮助                                |

### 选项

| 参数              | 作用                              |
| ----------------- | --------------------------------- |
| `-r`, `--refresh` | 重新查询 registry,忽略 1 小时缓存 |

无参数、`help`、`-h`、`--help` 输出帮助;全局安装后把 `npx @flun/pags` 换成 `pags`;

---

## 函数方式

导入 `check`、`update`、`install` 三个函数:

```js
import { check, update, install } from '@flun/pags';

const r1 = await check();     // 查询可升级依赖,返回 root、upgrades、skipped、online、warnings
const r2 = await update();    // 把可升级版本写回 package.json,追加 updated 已写入项
const r3 = await install();   // 逐包安装最新依赖,追加 installed 成功项、failed 失败项与 command
```

### 配置对象

三个函数均接受可选配置对象;命令行没有的预发布选择,在函数方式里通过 `choose` 回调完成:

| 字段      | 用于                | 说明                                                              |
| --------- | ------------------- | ----------------------------------------------------------------- |
| `root`    | 三者                | 指定项目根目录;默认从当前工作目录向上查找 package.json            |
| `refresh` | 三者                | 忽略 1 小时缓存,强制查询 registry                                 |
| `choose`  | `update`、`install` | 预发布选择回调;**缺省取预发布版**,返回 `item.latest` 则改选稳定版  |
| `stdio`   | `install`           | 透传给 npm install 的标准 IO 方式                                 |

`check` 不写回,没有 `choose`;它的每个可升级项同时给出 `latest`(稳定最新)与 `prerelease`(最高预发布),供自行判断;

### 预发布选择(choose)

当某依赖存在预发布版本时,`update` 与 `install` 默认选预发布版;传入 `choose` 回调可逐项决定选哪个。回调为**异步**,入参是整条升级项
`{ name, field, range, prefix, current, latest, prerelease, next }`,**返回值决定安装的版本**:返回 `item.prerelease` 选预发布,返回
`item.latest` 选稳定版;某项无预发布(`prerelease` 为空)时始终用 `item.latest`,不走回调;

```js
// 1) 默认行为:有预发布就选预发布,无需传 choose
await update();

// 2) 全部改选稳定版:回调统一返回 item.latest
await update({ choose: (item) => item.latest });
await install({ choose: (item) => item.latest });

// 3) 全部选预发布(等价默认,显式写出)
await install({ choose: (item) => item.prerelease });

// 4) 按包名区分:指定包走稳定版,其余走预发布
const stableOnly = new Set(['typescript', 'webpack']);
await install({
  refresh: true,
  stdio: 'inherit',
  choose: (item) => (stableOnly.has(item.name) ? item.latest : item.prerelease),
});

// 5) 异步回调:装前查询/确认(回调支持 async,内部会 await)
await update({
  choose: async (item) => {
    const useStable = await askUser(item.name); // 自定义异步逻辑
    return useStable ? item.latest : item.prerelease;
  },
});
```

命令行用 `请输入 1/2` 交互完成同样选择,函数方式则以 `choose` 回调替代该交互;

---

## 许可证## 许可证

ISC

---

## 贡献

- 主页:[npm 包页面](https://www.npmjs.com/package/@flun/pags#readme)
- 源码:[GitHub](https://github.com/AtFlun/pkgs)
- 中国:[gitee](https://gitee.com/AtFlun/pkgs.git)
- 问题反馈:[Issues](https://github.com/AtFlun/pkgs/issues)