# @flun/pkgs

## 简介

Flun 依赖升级工具:查询项目中可升级的依赖,写新版本到根目录 package.json,安装最新依赖;

提供 `check`、`install`、`update` 三个函数,以及 `pkgs` 命令行;库入口只导出这三个函数,联网查询与本地缓存逻辑在内部完成;

---

## 特性

- `check` 查询根目录 package.json 中可升级的依赖,返回可升级项、跳过项与联网状态;
- `install` 逐包执行 `npm install <name>@<latest>`,成功计入 installed、失败计入 failed 且不中断继续下一个;
- `update` 把可升级版本写回根目录 package.json,不执行 npm install;
- 版本对比忽略 build 元数据,预发布版低于对应正式版;缺省选预发布版,`choose` 回调可改选稳定版;
- npm 版本查询缓存 1 小时,`-r` 或 `--refresh` 可重新查询最新版本;
- 联网失败或超时时降级处理并标注离线状态,不中断使用;
- 支持 `dependencies`、`devDependencies`、`optionalDependencies`、`peerDependencies` 四个字段;
  - 工作区与本地引用等非常规范围自动跳过;

---

## 包目录结构

随包发布的文件:

```
@flun/pkgs/
├── bin/
│   └── cli.js       命令行入口(bin: pkgs)
├── CHANGELOG.md     更新日志
├── README.md        本文件
├── index.d.ts       类型声明
├── index.js         库入口,转发 pkgs.js 的导出
├── net.js           联网查询最新版本与本地缓存
├── pkgs.js          check / install / update 三个函数
├── render.js         终端输出渲染与格式化
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
    "@flun/pkgs": true
  }
}
```

---

## 安装

```sh
npm i -D @flun/pkgs # 项目内安装(作为开发工具)

npm i -g @flun/pkgs # 全局安装(建议);之后使用 `pkgs help` 查看用法
```

---

## 命令行

### 快速开始

```sh
npx @flun/pkgs c
```

### 子命令

| 参数           | 作用                                      |
| -------------- | ----------------------------------------- |
| `c`, `check`   | 查询项目中可升级的依赖                    |
| `i`, `install` | 逐包安装最新依赖,失败不中断继续下一个     |
| `u`, `update`  | 更新 package.json 中的依赖版本,不执行安装 |
| `help`         | 输出本帮助                                |

### 选项

| 参数                 | 作用                                                                                |
| -------------------- | ----------------------------------------------------------------------------------- |
| `-r`, `--refresh`    | 重新查询 registry,忽略 1 小时缓存                                                   |
| `--choose`, `-c`     | 预发布/稳定版:`p`／`prerelease` 预发布(缺省),`s`／`stable` 稳定版;仅 update/install |
| `-s`, `--stable`     | 等价 `--choose s`(稳定版)                                                           |
| `-p`, `--prerelease` | 等价 `--choose p`(预发布)                                                           |

无参数、`help`、`-h`、`--help` 输出帮助;全局安装后把 `npx @flun/pkgs` 换成 `pkgs`;
`update`/`install` 不显式指定 `--choose`/`-s`/`-p` 时进入交互选择;
命令行显式指定与函数 `choose` 同形:`--choose p|prerelease`(预发布,缺省)、`--choose s|stable`(稳定版);
并有短别名 `-s`/`--stable`、`-p`/`--prerelease`;
```sh
pkgs u --choose s      # 更新时选稳定版
pkgs i -s              # 安装时选稳定版(-s 等价 --choose s)
pkgs i --choose p -r   # 安装时选预发布并忽略缓存
```

---

## 函数方式

导入 `check`、、`install``update` 三个函数:

```js
import { check, install, update } from '@flun/pkgs';

const r1 = await check();     // 查询可升级依赖;
const r2 = await install();   // 逐包安装最新依赖;
const r3 = await update();    // 更新package.js中 包为最新依赖;
```

### 配置对象

| 字段      | 用于                | 说明                                                      |
| --------- | ------------------- | --------------------------------------------------------- |
| `root`    | 三者                | 指定项目根目录;默认从当前工作目录向上查找 package.json    |
| `refresh` | 三者                | 忽略 1 小时缓存,强制查询 registry                         |
| `choose`  | `install`、`update` | 预发布选择:`'p'` 取预发布(缺省),`'s'` 取稳定版;也可传回调 |
| `stdio`   | `install`           | 透传给 npm install 的标准 IO 方式                         |

`check` 不写回,没有 `choose`;它的每个可升级项同时给出 `latest`(稳定最新)与 `prerelease`(最高预发布),供自行判断;

### 预发布选择(choose)

当某依赖存在预发布版本时,只需给 `choose` 传一个值决定选哪个:`'p'`/`'prerelease'`(缺省)选预发布,`'s'`/`'stable'`选稳定版;
不传 `choose` 时默认选预发布;package.json中包无预发布字段值的始终用稳定版,不看 `choose`;

```js
// 默认:有预发布就选预发布
await update();

// 显式选预发布(等价缺省)
await install({ choose: 'p' });

// 选稳定版:传 's' 即可
await update({ choose: 's' });
await install({ choose: 's' });

// 搭配其它选项
await install({ choose: 's', refresh: true, stdio: 'inherit' });
```

命令行显式指定、短别名与交互选择见「命令行」章节;
高级用法:`choose` 也可传异步回调 `(item) => version`,按项自定义(入参为整条升级项,返回值决定装哪个版本);
函数方式以 `choose` 替代命令行交互;

---

## 许可证

ISC

---

## 贡献

- 主页:[npm 包页面](https://www.npmjs.com/package/@flun/pkgs#readme)
- 源码:[GitHub](https://github.com/AtFlun/pkgs)
- 中国镜像:[gitee](https://gitee.com/AtFlun/pkgs.git)
- 问题反馈:[Issues](https://github.com/AtFlun/pkgs/issues)