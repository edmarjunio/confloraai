/** Remove previous business snapshots. Session credentials and UI preferences remain scoped. */
export function clearLegacyBusinessStorage(storage = globalThis.localStorage) {
  try {
    const keys = Array.from({ length: storage.length }, (_value, index) => storage.key(index));
    for (const key of keys) {
      if (/^conflora:public-catalog:|^conflora_catalog_cache|^conflora_cart_items|^conflora_customer_info|^conflora_(?:user|op)$|^store:.*:cart:/.test(key || '')) {
        storage.removeItem(key);
      }
    }
  } catch { /* Disabled storage does not prevent a live Firestore request. */ }
}
