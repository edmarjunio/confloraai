'use strict';
const config = require('../config/env');

// Apply the same staff-attested Storage photo contract as every product listing.
async function verifiedProductImage(data, { bucket = config.firebase.storageBucket, fetcher = fetch } = {}) {
  const entries = require('../catalog/product-media').normalizeProductMedia(data).entries;
  for (const entry of entries.slice(0, 3)) {
    const candidate = entry.url;
    // Never issue server-side fetches to arbitrary external hosts. Their rights
    // and identity are staff-confirmed; availability is handled by the provider.
    if (entry.source === 'EXTERNAL') return candidate;
    if (typeof candidate !== 'string' || !bucket) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) continue;
      if (!require('../catalog/product-media').storageObjectPath(candidate, data.id)) continue;
      const response = await fetcher(url.toString(), { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(1500) });
      if (response.ok && /^image\/(jpeg|png)(?:;|$)/i.test(response.headers.get('content-type') || '')
        && Number(response.headers.get('content-length')) > 0 && Number(response.headers.get('content-length')) <= 5 * 1024 * 1024) return url.toString();
    } catch { /* An absent or inaccessible photo is omitted, never replaced. */ }
  }
  return null;
}

module.exports = { verifiedProductImage };
