/** Coalesce simultaneous reads; keep no completed business snapshot. */
function createPublicSnapshot(load) {
  let pending, generation = 0;
  const metrics = { hits: 0, misses: 0, shared: 0, invalidations: 0 };
  function invalidate() {
    generation++;
    pending = null;
    metrics.invalidations++;
  }
  async function read() {
    if (pending) { metrics.shared++; return pending; }
    const version = generation;
    metrics.misses++;
    const request = Promise.resolve().then(load).then(async result => {
      // A concurrent edit must not repopulate the cache with the old snapshot.
      if (version !== generation) return read();
      return result;
    });
    pending = request;
    try { return await request; }
    finally { if (pending === request) pending = null; }
  }
  return { read, invalidate, metrics };
}
module.exports = { createPublicSnapshot };
