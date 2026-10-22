const OPEN_STATES = ['AWAITING_CONFIRMATION', 'AWAITING_CASHIER', 'AWAITING_PAYMENT', 'CREATING_PIX', 'AWAITING_PIX', 'PENDING'];
const DELIVERY_STATES = ['PENDING_DISPATCH', 'PENDING_DELIVERY', 'PREPARING_DELIVERY', 'OUT_FOR_DELIVERY'];

async function pages(query) {
  const records = [];
  let cursor;
  while (true) {
    const page = await (cursor ? query.startAfter(cursor) : query).limit(500).get();
    records.push(...page.docs.map(doc => ({ ...doc.data(), id: doc.id })));
    if (page.docs.length < 500) return records;
    cursor = page.docs[page.docs.length - 1];
  }
}

/** Read open work independently of date, and only the requested historical period. */
async function loadSnapshotRecords(repo, range) {
  if ((!repo.firestore || repo._firestoreClientDisabled) && (!repo.isInMemory || repo.firestore)) throw new Error('Firestore indisponível para o caixa.');
  const rangeReads = ['createdAt', 'completedAt', 'paidAt'].map(field => repo.getExecutiveRecordsForRange('orders', range.from, range.to, field));
  let live;
  if (repo.firestore) {
    const collection = repo.firestore.collection('orders');
    live = Promise.all([
      pages(collection.where('status', 'in', OPEN_STATES).orderBy('__name__')),
      pages(collection.where('deliveryStatus', 'in', DELIVERY_STATES).orderBy('__name__')),
    ]);
  } else live = Promise.resolve([[...repo.inMemoryOrders.values()].filter(order => OPEN_STATES.includes(order.status) || DELIVERY_STATES.includes(order.deliveryStatus))]);
  const [open, history, settlements] = await Promise.all([
    live, Promise.all(rangeReads), repo.getExecutiveRecordsForRange('debt_settlements', range.from, range.to),
  ]);
  return { orders: [...new Map([...open.flat(), ...history.flat()].map(order => [order.id, order])).values()], settlements };
}

const pending = new WeakMap();
async function cashierSnapshotRecords(repo, range) {
  let queries = pending.get(repo);
  if (!queries) { queries = new Map(); pending.set(repo, queries); }
  const key = `${range.from}:${range.to}`;
  if (!queries.has(key)) queries.set(key, loadSnapshotRecords(repo, range).finally(() => queries.delete(key)));
  // Share only in-flight reads. Never cache a settled financial snapshot.
  return structuredClone(await queries.get(key));
}

module.exports = { cashierSnapshotRecords };
