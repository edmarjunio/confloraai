'use strict';
const config = require('../config/env');

// Apply the same staff-attested Storage photo contract as every product listing.
async function verifiedProductImage(data, { bucket = config.firebase.storageBucket, fetcher = fetch } = {}) {
  const urls = require('../catalog/actual-product-photo').actualProductImages(data);
  for (const candidate of [...new Set(urls)].slice(0, 3)) {
    if (typeof candidate !== 'string' || !bucket) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) continue;
      const prefix = `/v0/b/${bucket}/o/`;
      if (url.hostname !== 'firebasestorage.googleapis.com' || !url.pathname.startsWith(prefix)) continue;
      const objectPath = decodeURIComponent(url.pathname.slice(prefix.length));
      if (!/^products\/[a-zA-Z0-9_-]+\/[^/]+$/.test(objectPath) || objectPath.includes('..')) continue;
      const response = await fetcher(url.toString(), { method: 'HEAD', redirect: 'error', signal: AbortSignal.timeout(1500) });
      if (response.ok && /^image\/(jpeg|png)(?:;|$)/i.test(response.headers.get('content-type') || '')
        && Number(response.headers.get('content-length')) > 0 && Number(response.headers.get('content-length')) <= 5 * 1024 * 1024) return url.toString();
    } catch { /* An absent or inaccessible photo is omitted, never replaced. */ }
  }
  return null;
}

module.exports = { verifiedProductImage };
