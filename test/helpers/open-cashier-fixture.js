const { randomUUID } = require('node:crypto');
const { businessDate } = require('../../src/orders/cashier-sessions');

// Existing sales tests start during an open shift. Opening rules are exercised
// through the real API in cashier-sessions and cashier-operator-closing tests.
function seedOpenCashier(repo, user) {
  const date = businessDate();
  const id = randomUUID();
  const database = repo.firestore?.data;
  const memory = repo.pdvMemory ||= new Map();
  const get = (collection, key) => database ? database.get(`${collection}/${key}`) : memory.get(collection)?.get(key);
  const set = (collection, key, value) => {
    if (database) database.set(`${collection}/${key}`, value);
    else {
      if (!memory.has(collection)) memory.set(collection, new Map());
      memory.get(collection).set(key, value);
    }
  };
  const day = get('cashier_days', date) || { id: date, sessions: {}, revision: 0 };
  set('cashier_sessions', id, { id, userId: user.id, userName: user.name || 'Caixa', userRole: 'CAIXA', date,
    status: 'OPEN', openingFloat: 0, receipts: { cash: 0, pix: 0, debit: 0, credit: 0 }, pendingOrders: [], openedAt: new Date().toISOString() });
  set('cashier_active', user.id, { sessionId: id });
  set('cashier_days', date, { ...day, revision: day.revision + 1, sessions: { ...day.sessions, [id]: { id, userId: user.id, name: user.name || 'Caixa', role: 'CAIXA', closed: false } } });
}
module.exports = { seedOpenCashier };
