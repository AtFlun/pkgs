import { check, install, update } from './pags.js';

// =================================== pags.js ===================================
/**
 * ```js
 * // 文件导出内容
 * check();    // 查询可升级依赖;
 * install();  // 安装最新依赖;
 * update();   // 升级依赖版本;
 * ```
 * >查看定义:@see {@link check}、{@link install}、{@link update}
 */
declare module './pags.js' {
  export * from './pags.js';
}


// ================================ 导出入口 ================================
/**
 * @flun/pags - 依赖包升级检查、版本更新、安装最新依赖模块 主要功能:
 * ```js
 * check();    // 查询可升级依赖;
 * install();  // 安装最新依赖;
 * update();   // 升级依赖版本;
 * ```
 * ---
 * >
 * ```js
 *  // 默认使用示例
 *  import { check, install, update } from '@flun/pags';
 *
 *  await check();    // 查询可升级依赖;
 *  await install();  // 安装最新依赖;
 *  await update();   // 升级依赖版本;
 * ```
 * ---
 * >查看定义:@see {@link check}、{@link install}、{@link update}
 */
declare module './index.js' {
  export * from './pags.js';
}