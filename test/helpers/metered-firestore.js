// Deterministic, instrumented mock. Serial transactions model atomicity, not real contention retries.
function meteredFirestore(initial = {}) {
  const data = new Map(Object.entries(initial));
  const metrics = { reads: 0, writes: 0, deletes: 0, queries: 0, transactions: 0, queryMs: [] };
  let queue = Promise.resolve();
  let autoId = 0;
  const field = (row, path) => path.split('.').reduce((value, key) => value?.[key], row);
  const snap = path => ({ id: path.split('/').pop(), exists: data.has(path), ref: doc(path), data: () => structuredClone(data.get(path)) });
  const read = path => { metrics.reads++; return snap(path); };
  const set = (path, value, opts = {}) => { metrics.writes++; data.set(path, opts.merge ? { ...data.get(path), ...structuredClone(value) } : structuredClone(value)); };
  function doc(path) {
    return { path, id: path.split('/').pop(), get: async () => read(path), set: async (value, opts) => set(path, value, opts),
      create: async value => { if (data.has(path)) throw Object.assign(new Error('exists'), { code: 6 }); set(path, value); },
      update: async value => set(path, { ...data.get(path), ...value }),
      delete: async () => { metrics.deletes++; data.delete(path); },
      collection: name => collection(`${path}/${name}`) };
  }
  function collection(path, filters = [], orders = [], count = Infinity, cursor = null, projection = null) {
    return {
      doc: id => doc(`${path}/${id || `auto-${++autoId}`}`),
      where: (key, op, value) => collection(path, [...filters, [key, op, value]], orders, count, cursor, projection),
      orderBy: (key, direction = 'asc') => collection(path, filters, [...orders, [key, direction]], count, cursor, projection),
      limit: size => collection(path, filters, orders, size, cursor, projection),
      startAfter: value => collection(path, filters, orders, count, value, projection),
      select: (...fields) => collection(path, filters, orders, count, cursor, fields),
      get: async () => {
        const start = performance.now();
        metrics.queries++;
        const prefix = `${path}/`;
        let rows = [...data.entries()].filter(([key, value]) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/') && filters.every(([key, op, expected]) => {
          const actual = field(value, key);
          if (op === '==') return actual === expected;
          if (op === 'in') return expected.includes(actual);
          if (op === '>=') return actual >= expected;
          if (op === '<') return actual < expected;
          throw new Error(`Unsupported filter ${op}`);
        })).map(([key]) => snap(key));
        const sort = orders.length ? orders : [['__name__', 'asc']];
        const compare = (a, b) => {
          for (const [key, direction] of sort) {
            const x = key === '__name__' ? a.id : field(a.data(), key);
            const y = key === '__name__' ? b.id : field(b.data(), key);
            if (x !== y) return (x < y ? -1 : 1) * (direction === 'desc' ? -1 : 1);
          }
          return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        };
        rows.sort(compare);
        if (cursor) rows = rows.filter(row => typeof cursor === 'string' ? row.id > cursor : compare(row, cursor) > 0);
        rows = rows.slice(0, count);
        metrics.reads += Math.max(1, rows.length);
        metrics.queryMs.push(performance.now() - start);
        const projected = projection ? rows.map(row => ({ ...row, data: () => Object.fromEntries(projection.filter(key => field(row.data(), key) !== undefined).map(key => [key, field(row.data(), key)])) })) : rows;
        return { docs: projected, size: rows.length, empty: !rows.length };
      },
    };
  }
  return { data, metrics, collection, doc,
    getAll: async (...refs) => refs.map(ref => read(ref.path)),
    runTransaction: work => {
      const result = queue.then(async () => {
        metrics.transactions++;
        const writes = [];
        const value = await work({
          get: async ref => { if (writes.length) throw new Error('Firestore requires all reads before writes'); return read(ref.path); },
          set: (ref, val, opts) => writes.push(() => set(ref.path, val, opts)),
          update: (ref, val) => writes.push(() => set(ref.path, { ...data.get(ref.path), ...val })),
        });
        writes.forEach(write => write());
        return value;
      });
      queue = result.catch(() => {});
      return result;
    },
  };
}
module.exports = { meteredFirestore };
