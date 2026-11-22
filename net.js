import fs from 'fs';
import os from 'os';
import path from 'path';

const CACHE_FILE = path.join(os.homedir(), '.pags-cache.json'), CACHE_TTL = 3600 * 1000,
  REGISTRY = (process.env.npm_config_registry || 'https://registry.npmjs.org').replace(/\/+$/, ''),
  compareLoose = (a, b) => {
    const pa = a.split('+')[0].split('-'), pb = b.split('+')[0].split('-'),
      na = pa[0].split('.').map(n => Number(n) || 0), nb = pb[0].split('.').map(n => Number(n) || 0);
    for (let i = 0; i < 3; i++) if ((na[i] || 0) !== (nb[i] || 0)) return (na[i] || 0) - (nb[i] || 0);
    if (!pa[1] && !pb[1]) return 0;
    if (!pa[1]) return 1;
    if (!pb[1]) return -1;
    const cmpIdent = (x, y) => {
      if (x === y) return 0;
      const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
      if (nx && ny) return Number(x) - Number(y);
      if (nx) return -1;
      if (ny) return 1;
      return x < y ? -1 : 1;
    };
    const sa = pa[1].split('.'), sb = pb[1].split('.');
    for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
      const c = cmpIdent(sa[i] || '', sb[i] || '');
      if (c !== 0) return c;
    }
    return 0;
  },
  fetchLatest = async name => {
    try {
      const url = `${REGISTRY}/${name.replace('/', '%2f')}/latest`,
        res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      return (await res.json()).version || null;
    } catch { return null; }
  },
  fetchPrerelease = async (name, timeout) => {
    const enc = name.replace('/', '%2f');
    try {
      const tagRes = await fetch(`${REGISTRY}/-/package/${enc}/dist-tags`, { signal: AbortSignal.timeout(8000) });
      if (tagRes.ok) {
        const tags = await tagRes.json(), vals = Object.values(tags).filter(v => typeof v === 'string' && v.includes('-'));
        let bestTag = null;
        for (const v of vals) if (!bestTag || compareLoose(v, bestTag) > 0) bestTag = v;
        if (bestTag) return bestTag;
      }
    } catch { }
    try {
      const res = await fetch(`${REGISTRY}/${enc}`, {
        headers: { accept: 'application/vnd.npm.install-v1+json' }, signal: AbortSignal.timeout(timeout || 5000)
      });
      if (!res.ok) return null;
      const versions = Object.keys((await res.json()).versions || {});
      let best = null;
      for (const v of versions) if (v.includes('-') && (!best || compareLoose(v, best) > 0)) best = v;
      return best;
    } catch { return null; }
  },
  readCache = () => {
    try {
      const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (raw.registry !== REGISTRY || Date.now() - raw.ts > CACHE_TTL) return {};
      return raw.data || {};
    } catch { return {}; }
  },
  writeCache = data => {
    try { fs.writeFileSync(CACHE_FILE, JSON.stringify({ registry: REGISTRY, ts: Date.now(), data })); } catch { }
  };

/**
 * 批量查询各包在 registry 上的最新版本
 * >查看定义:@see {@link resolveLatest}
 * @param {string[]} names 包名数组
 * @param {boolean} refresh 是否跳过缓存强制刷新
 * @returns {Promise<{data: object, online: boolean}>} 版本映射与是否联网成功
 */
const resolveLatest = async (names, refresh) => {
  const cached = refresh ? {} : readCache(), missing = names.filter(n => !cached[n]);
  if (!missing.length) return { data: cached, online: true };

  const pairs = await Promise.all(missing.map(async n => [n, await fetchLatest(n)])), data = { ...cached };
  let ok = 0;
  for (const [n, v] of pairs) if (v) data[n] = v, ok++;
  if (ok) writeCache(data);
  return { data, online: ok > 0 };
};

/**
 * 批量查询各包在 registry 上的最高预发布版本(带内存缓存)
 * >查看定义:@see {@link resolvePrerelease}
 * @param {string[]} names 包名数组
 * @returns {Promise<{data: object, online: boolean}>} 预发布版本映射与是否联网成功
 */
const resolvePrerelease = async names => {
  const preMem = {}, data = {}, timeout = Math.min(30000, 8000 + Math.max(0, names.length - 1) * 1000);
  await Promise.all(names.map(async n => {
    if (preMem[n] === undefined) preMem[n] = await fetchPrerelease(n, timeout);
    if (preMem[n]) data[n] = preMem[n];
  }));
  return { data, online: Object.keys(data).length > 0 };
};

export { resolveLatest, resolvePrerelease };