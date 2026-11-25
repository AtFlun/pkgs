import { check, install, update } from './pkgs.js';

// =================================== pkgs.js ===================================
/**
 * ```js
 * // 文件导出内容
 * check();    // 查询根目录 package.json 中可升级的依赖
 * install();  // 逐包升级并安装依赖
 * update();   // 更新根目录 package.json 中可升级的依赖(不执行 npm install)
 * ```
 * >查看定义:@see {@link check}、{@link install}、{@link update}
 */
declare module './pkgs.js' {
  export * from './pkgs.js';
}


// ================================ 导出入口 ================================
/**
 * @flun/pkgs - 依赖包升级检查、版本更新、安装最新依赖模块 主要功能:
 * ```js
 * check();    // 查询根目录 package.json 中可升级的依赖
 * install();  // 逐包升级并安装依赖
 * update();   // 更新根目录 package.json 中可升级的依赖(不执行 npm install)
 * ```
 * ---
 * >
 * ```js
 *  // 默认使用示例
 *  import { check, install, update } from '@flun/pkgs';
 *
 *  await check();
 *  await install();
 *  await update();
 * ```
 * ---
 * >查看定义:@see {@link check}、{@link install}、{@link update}
 */
declare module './index.js' {
  export * from './pkgs.js';
}