const MAX_AGE = 24 * 60 * 60 * 1000;
export const PUBLIC_FRESH_TIME = 60 * 1000;
const PREFIX = 'conflora:public-catalog:v1:';

/** Only the public catalogue is persisted; identity and transactions never enter here. */
export function createPublicCache(slug, storage, now = Date.now) {
  const key = PREFIX + encodeURIComponent(slug);
  function read() {
    try {
      const saved = JSON.parse((storage || globalThis.localStorage).getItem(key));
      if (!saved || !Number.isFinite(saved.savedAt) || saved.savedAt > now() ||
          now() - saved.savedAt > MAX_AGE || !saved.config?.identity ||
          !Array.isArray(saved.products)) return null;
      return { config: saved.config, products: saved.products };
    } catch {
      return null;
    }
  }
  function write({ config, products }) {
    if (!config?.identity || !Array.isArray(products)) return;
    try {
      (storage || globalThis.localStorage).setItem(key, JSON.stringify({ savedAt: now(), config, products }));
    } catch {
      // Storage can be disabled or full. The live catalogue still works.
    }
  }
  function isFresh() {
    if (!read()) return false;
    try {
      const saved = JSON.parse((storage || globalThis.localStorage).getItem(key));
      return now() - saved.savedAt < PUBLIC_FRESH_TIME;
    } catch { return false; }
  }
  function age() {
    if (!read()) return Infinity;
    try { return now() - JSON.parse((storage || globalThis.localStorage).getItem(key)).savedAt; }
    catch { return Infinity; }
  }
  function invalidate() {
    try { (storage || globalThis.localStorage).removeItem(key); } catch {}
  }
  return { key, read, write, isFresh, invalidate, age };
}
