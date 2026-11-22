import { check, install, update } from './pags.js';

// =================================== index.js ===================================
/**
 * @flun/pags - 依赖升级检查、版本更新、安装最新依赖
 * ```js
 * // 文件导出内容
 * check()     // 查询可升级依赖;
 * update()    // 升级依赖版本;
 * install()   // 安装最新依赖;
 * ```
 * >查看定义:@see {@link check}、{@link update}、{@link install}
 */
declare module './index.js' {
  export * from './index.js';
}