const assert = require('node:assert/strict');
function createInMemoryFirestore(initialData = {}) {
  const documents = new Map(Object.entries(initialData));
  let sequence = 0;
  let transactionQueue = Promise.resolve();

  const makeSnapshot = (path) => ({
    id: path.split('/').pop(),
    exists: documents.has(path),
    data: () => structuredClone(documents.get(path)),
    readTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
  });

  const firestore = {
    doc: (path) => ({
      id: path.split('/').pop(),
      path,
      collection: name => firestore.collection(`${path}/${name}`),
      get: async () => makeSnapshot(path),
      set: async (val, opts = {}) => {
        if (opts.merge && documents.has(path)) {
          documents.set(path, { ...documents.get(path), ...structuredClone(val) });
        } else {
          documents.set(path, structuredClone(val));
        }
      },
      update: async (val) => {
        if (!documents.has(path)) throw new Error(`Not found: ${path}`);
        documents.set(path, { ...documents.get(path), ...structuredClone(val) });
      },
      delete: async () => {
        documents.delete(path);
      },
    }),
    collection: (collName) => {
      const getDocsInternal = (filters = []) => {
        const docs = [];
        const prefix = `${collName}/`;
        for (const [k, v] of documents.entries()) {
          if (k.startsWith(prefix) && !k.slice(prefix.length).includes('/')) {
            let pass = true;
            for (const f of filters) {
              if (v[f.field] !== f.value) { pass = false; break; }
            }
            if (pass) {
              docs.push(makeSnapshot(k));
            }
          }
        }
        return docs;
      };

      const makeQuery = (filters = []) => ({
        where: (field, op, value) => {
          assert.equal(op, '==');
          return makeQuery([...filters, { field, value }]);
        },
        limit: (n) => ({
          get: async () => {
            const list = getDocsInternal(filters).slice(0, n);
            return { docs: list, empty: list.length === 0, size: list.length };
          },
        }),
        select: (...fields) => ({
          get: async () => {
            const list = getDocsInternal(filters).map(d => {
              const fullData = d.data();
              const projected = {};
              for (const f of fields) {
                if (fullData[f] !== undefined) projected[f] = fullData[f];
              }
              return { ...d, data: () => projected };
            });
            return { docs: list, empty: list.length === 0, size: list.length };
          },
        }),
        get: async () => {
          const list = getDocsInternal(filters);
          return { docs: list, empty: list.length === 0, size: list.length };
        },
      });

      return {
        doc: (id) => {
          const docId = id || `doc_${++sequence}`;
          return firestore.doc(`${collName}/${docId}`);
        },
        ...makeQuery([]),
      };
    },
    getAll: async (...refs) => {
      return refs.map(ref => makeSnapshot(ref.path));
    },
    batch: () => {
      const writes = [];
      return {
        set: (ref, val, opts = {}) => writes.push({ type: 'set', path: ref.path, val, opts }),
        update: (ref, val) => writes.push({ type: 'update', path: ref.path, val }),
        delete: (ref) => writes.push({ type: 'delete', path: ref.path }),
        commit: async () => {
          for (const w of writes) {
            if (w.type === 'delete') {
              documents.delete(w.path);
            } else if (w.type === 'update') {
              documents.set(w.path, { ...documents.get(w.path), ...structuredClone(w.val) });
            } else if (w.opts && w.opts.merge && documents.has(w.path)) {
              documents.set(w.path, { ...documents.get(w.path), ...structuredClone(w.val) });
            } else {
              documents.set(w.path, structuredClone(w.val));
            }
          }
        },
      };
    },
    runTransaction: (callback) => {
      const work = transactionQueue.then(async () => {
      const writes = [];
      const tx = {
        get: async (ref) => makeSnapshot(ref.path),
        set: (ref, val, opts = {}) => writes.push({ type: 'set', path: ref.path, val, opts }),
        update: (ref, val) => writes.push({ type: 'update', path: ref.path, val }),
        delete: (ref) => writes.push({ type: 'delete', path: ref.path }),
      };
      const res = await callback(tx);
      for (const w of writes) {
        if (w.type === 'delete') {
          documents.delete(w.path);
        } else if (w.type === 'update') {
          documents.set(w.path, { ...documents.get(w.path), ...structuredClone(w.val) });
        } else if (w.opts && w.opts.merge && documents.has(w.path)) {
          documents.set(w.path, { ...documents.get(w.path), ...structuredClone(w.val) });
        } else {
          documents.set(w.path, structuredClone(w.val));
        }
      }
      return res;
      });
      transactionQueue = work.catch(() => {});
      return work;
    },
    raw: documents,
  };

  return firestore;
}


module.exports = { createInMemoryFirestore };
