/**
 * @flun/pags - 依赖升级检查、版本写回与安装
 * ```ts
 * check()    // 查询可升级依赖
 * update()   // 写回根目录 package.json
 * install()  // 写回后执行 npm install
 * ```
 * >查看定义:@see {@link check}、{@link update}、{@link install}
 */

/** 函数选项 */
export interface PagsOptions {
  /** 项目根目录;默认从当前工作目录向上查找 package.json */
  root?: string;
  /** 忽略 1 小时缓存,强制查询 registry */
  refresh?: boolean;
  /** npm install 的输出方式;默认 inherit */
  stdio?: 'inherit' | 'ignore' | 'pipe';
}

/** 可升级项 */
export interface UpgradeItem {
  /** 包名 */
  name: string;
  /** 所在字段 */
  field: string;
  /** 原始范围 */
  range: string;
  /** 范围前缀,如 ^ 与 ~ */
  prefix: string;
  /** 当前版本 */
  current: string;
  /** registry 最新版本 */
  latest: string;
  /** 写回后的范围 */
  next: string;
}

/** 跳过项 */
export interface SkipItem {
  /** 包名 */
  name: string;
  /** 所在字段 */
  field: string;
  /** 原始范围 */
  range: string;
  /** 跳过原因 */
  reason: string;
}

/** check 返回值 */
export interface CheckResult {
  /** 项目根目录 */
  root: string;
  /** 可升级项 */
  upgrades: UpgradeItem[];
  /** 跳过项 */
  skipped: SkipItem[];
  /** registry 是否连通 */
  online: boolean;
  /** 提示信息 */
  warnings: string[];
}

/** update 返回值 */
export interface UpdateResult extends CheckResult {
  /** 已写入项 */
  updated: UpgradeItem[];
}

/** install 返回值 */
export interface InstallResult extends UpdateResult {
  /** 是否执行了 npm install */
  installed: boolean;
  /** 执行过的命令 */
  command: string | null;
}

/**
 * 查询根目录 package.json 中可升级的依赖
 * >查看定义:@see {@link check}
 * @param options 选项
 * @returns 可升级项、跳过项与是否联网成功
 */
export function check(options?: PagsOptions): Promise<CheckResult>;

/**
 * 把可升级版本写回根目录 package.json
 * >查看定义:@see {@link update}
 * @param options 选项
 * @returns 在 check 结果上追加已写入项
 */
export function update(options?: PagsOptions): Promise<UpdateResult>;

/**
 * 更新根目录 package.json 并执行 npm install
 * >查看定义:@see {@link install}
 * @param options 选项
 * @returns 在 update 结果上追加是否安装与执行过的命令
 */
export function install(options?: PagsOptions): Promise<InstallResult>;