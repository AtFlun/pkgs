# 更新日志

## [1.0.0] - 2026-11-22 21:54
### 新增
- 首次发布 @flun/pags;提供依赖升级检查、版本更新与安装三大能力;
- `check()` 查询根目录 package.json 中可升级依赖,返回可升级项、跳过项与联网状态;
- `update()` 将可升级版本写回根目录 package.json;
- `install()` 写回后执行 npm install 安装最新依赖;