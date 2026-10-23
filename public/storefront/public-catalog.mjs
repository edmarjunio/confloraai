// A new empty namespace: never migrate a historical commercial snapshot.
import { PUBLIC_CACHE_DATABASE } from './cache-generation.mjs';
export const PUBLIC_FRESH_TIME = 60000;
const MAX_AGE = 24 * 3600000;
const MAX_BYTES = 4 * 1024 * 1024;
let database;
function invalidatedAt() {
  try { return Number(globalThis.localStorage?.getItem('cf-public-invalidated')) || 0; }
  catch { return 0; }
}
function openDatabase() {
  return database ||= new Promise(resolve => {
    if (!globalThis.indexedDB) return resolve(null);
    let request;
    try { request = indexedDB.open(PUBLIC_CACHE_DATABASE, 1); } catch { resolve(null); return; }
    request.onupgradeneeded = () => request.result.createObjectStore('catalog');
    request.onsuccess = () => {
      request.result.onversionchange = () => { request.result.close(); database = undefined; };
      resolve(request.result);
    };
    request.onerror = request.onblocked = () => resolve(null);
  });
}
async function disk(mode, work) {
  try {
    const db = await openDatabase();
    if (!db) return null;
    return await new Promise(resolve => {
      const tx = db.transaction('catalog', mode);
      const request = work(tx.objectStore('catalog'));
      tx.oncomplete = () => resolve(request?.result ?? null);
      tx.onerror = tx.onabort = () => resolve(null);
    });
  } catch { return null; }
}
export function createPublicCatalog(slug) {
  const key = String(slug);
  let memory, revision = 0;
  const valid = entry => entry?.version === 1 && entry.key === key &&
    Number.isFinite(entry.savedAt) && entry.savedAt <= Date.now() &&
    entry.savedAt > invalidatedAt() &&
    Date.now() - entry.savedAt < MAX_AGE && entry.config?.identity && Array.isArray(entry.products);
  return {
    async read() {
      const version = revision;
      let timer;
      const entry = memory || await Promise.race([disk('readonly', store => store.get(key)),
        new Promise(resolve => { timer = setTimeout(() => resolve(null), 150); })]);
      clearTimeout(timer);
      if (version !== revision || !valid(entry)) return null;
      memory = entry;
      return { config: entry.config, products: entry.products, savedAt: entry.savedAt,
        fresh: Date.now() - entry.savedAt < PUBLIC_FRESH_TIME };
    },
    revision: () => revision,
    write({ config, products }, expectedRevision = revision) {
      if (expectedRevision !== revision) return;
      if (!config?.identity || !Array.isArray(products)) return;
      const entry = { version: 1, key, savedAt: Date.now(), config, products };
      memory = entry;
      // Only the public projection; never session, user, orders or cart.
      try {
        if (new TextEncoder().encode(JSON.stringify(entry)).byteLength > MAX_BYTES) {
          void disk('readwrite', store => store.delete(key)); return;
        }
        void disk('readwrite', store => store.put(entry, key));
      } catch { /* Storage must not fail a successful live read. */ }
    },
    invalidate() {
      revision++;
      memory = undefined;
      void disk('readwrite', store => store.delete(key));
    },
  };
}
