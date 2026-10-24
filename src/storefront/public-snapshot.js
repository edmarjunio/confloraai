/** Public read projection only. Checkout always reads authoritative documents. */
function createPublicSnapshot(load, { ttlMs = 15000, now = Date.now, sourceExpiresAt = () => Infinity } = {}) {
  let pending, generation = 0, value, expiresAt = 0;
  const metrics = { hits: 0, misses: 0, shared: 0, invalidations: 0 };
  function invalidate() {
    generation++;
    value = undefined;
    expiresAt = 0;
    pending = null;
    metrics.invalidations++;
  }
  async function read() {
    if (value !== undefined && now() < expiresAt) { metrics.hits++; return value; }
    if (pending) { metrics.shared++; return pending; }
    const version = generation;
    metrics.misses++;
    const request = Promise.resolve().then(load).then(async result => {
      // A concurrent edit must not repopulate the cache with the old snapshot.
      if (version !== generation) return read();
      value = result;
      // A derived cache cannot extend the lifetime of its upstream projection.
      expiresAt = Math.min(now() + ttlMs, sourceExpiresAt());
      return result;
    });
    pending = request;
    try { return await request; }
    finally { if (pending === request) pending = null; }
  }
  return { read, invalidate, metrics };
}
module.exports = { createPublicSnapshot };
