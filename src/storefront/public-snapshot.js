/** Short, process-local cache. Never use this snapshot to authorize a sale. */
function createPublicSnapshot(load, { ttlMs = 15000, now = Date.now } = {}) {
  let value, expiresAt = 0, pending, generation = 0;
  const metrics = { hits: 0, misses: 0, shared: 0, invalidations: 0 };
  function invalidate() {
    generation++;
    expiresAt = 0;
    pending = null;
    metrics.invalidations++;
  }
  async function read() {
    if (value && now() < expiresAt) { metrics.hits++; return value; }
    if (pending) { metrics.shared++; return pending; }
    const version = generation;
    metrics.misses++;
    const request = Promise.resolve().then(load).then(async result => {
      // A concurrent edit must not repopulate the cache with the old snapshot.
      if (version !== generation) return read();
      value = result;
      expiresAt = now() + ttlMs;
      return value;
    });
    pending = request;
    try { return await request; }
    finally { if (pending === request) pending = null; }
  }
  return { read, invalidate, metrics };
}
module.exports = { createPublicSnapshot };
