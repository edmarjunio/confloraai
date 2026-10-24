/** One transaction boundary for commercial domains. Never fail over to local money/stock. */
async function runTransaction(repo, work) {
  const stamped = (collection, value) => collection === 'pdv_outbox' && !value.createdAt ? { ...value, createdAt: new Date().toISOString() } : value;
  if (repo.firestore && !repo._firestoreClientDisabled) {
    return repo.firestore.runTransaction(tx => work({
      get: async (collection, id) => {
        const doc = await tx.get(repo.firestore.collection(collection).doc(String(id)));
        return doc.exists ? { ...doc.data(), id: doc.id || String(id) } : null;
      },
      set: (collection, id, value) => tx.set(repo.firestore.collection(collection).doc(String(id)), stamped(collection, value)),
    }));
  }
  if (!repo.isInMemory || repo.firestore) throw new Error('Firestore indisponível. Operação não registrada.');
  const memory = repo.pdvMemory ||= new Map();
  const operation = (repo.pdvQueue || Promise.resolve()).then(async () => {
    const collections = { orders: repo.inMemoryOrders, products: repo.inMemoryProducts,
      customers: repo.inMemoryCustomers, users: repo.inMemoryUsers, discount_approvals: repo.inMemoryDiscountApprovals };
    const writes = [];
    const mapFor = collection => {
      if (collections[collection]) return collections[collection];
      if (!memory.has(collection)) memory.set(collection, new Map());
      return memory.get(collection);
    };
    const result = await work({
      get: async (collection, id) => collection === 'store_settings' && id === 'inventory'
        ? repo.getInventorySettings() : structuredClone(mapFor(collection).get(id) || null),
      set: (collection, id, value) => writes.push([collection, id, structuredClone(stamped(collection, value))]),
    });
    for (const [collection, id, value] of writes) {
      mapFor(collection).set(id, value);
      const mirrorField = collection === 'customer_debts' ? 'inMemoryCustomerDebts'
        : collection === 'debt_settlements' ? 'inMemoryDebtSettlements' : '';
      if (mirrorField) {
        const entries = repo[mirrorField] ||= [];
        const index = entries.findIndex(entry => String(entry.id) === String(id));
        if (index >= 0) entries[index] = structuredClone(value);
        else entries.push(structuredClone(value));
      }
    }
    return result;
  });
  repo.pdvQueue = operation.catch(() => {});
  return operation;
}

module.exports = { runTransaction };
