process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { installPdvRoutes } = require('../src/http/pdv.routes');

function setup(profiles = [{ id: 'linked-customer' }]) {
  const routes = new Map();
  const app = { locals: {}, use() {}, post() {}, put() {}, patch() {}, delete() {}, get(path, ...handlers) { routes.set(path, handlers); } };
  const { store } = installPdvRoutes(app, { repository: { isInMemory: true, findCustomerProfilesByEmail: async () => profiles } });
  let callback;
  let disconnected = false;
  store.watchOpenOrders = change => { callback = change; return () => { disconnected = true; }; };
  const response = Object.assign(new EventEmitter(), {
    statusCode: 200, chunks: [], set(headers) { this.headers = headers; }, flushHeaders() {},
    write(chunk) { this.chunks.push(chunk); }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
  });
  const handlers = routes.get('/api/customer/orders/stream');
  return { handlers, response, emit: orders => callback(orders), disconnected: () => disconnected };
}

test('customer stream rejects unauthenticated access and ambiguous email links', async () => {
  const guest = setup();
  guest.handlers[0]({}, guest.response, () => assert.fail('Guest passed authentication'));
  assert.equal(guest.response.statusCode, 401);
  const ambiguous = setup([{ id: 'a' }, { id: 'b' }]);
  await ambiguous.handlers[1]({ user: { id: 'account', email: 'customer@test.com' } }, ambiguous.response);
  assert.equal(ambiguous.response.statusCode, 409);
});

test('customer stream sends only owned status fields, deduplicates snapshots and unsubscribes on disconnect', async () => {
  const s = setup();
  await s.handlers[1]({ user: { id: 'account', email: 'customer@test.com' } }, s.response);
  try {
    const orders = [
      { id: 'linked', customerId: 'linked-customer', status: 'CONFIRMED', total: 123, customerPhone: 'secret-phone' },
      { id: 'direct', customerId: 'account', status: 'AWAITING_PAYMENT' },
      { id: 'email', customerEmail: 'CUSTOMER@test.com', deliveryStatus: 'OUT_FOR_DELIVERY' },
      { id: 'other', customerId: 'someone-else', customerEmail: 'other@test.com', total: 999 },
    ];
    s.emit(orders);
    const payload = s.response.chunks.join('');
    assert.match(payload, /order-status/);
    assert.match(payload, /OUT_FOR_DELIVERY/);
    assert.doesNotMatch(payload, /someone-else|other@test|secret-phone|"total"|"customerId"/);
    const snapshot = JSON.parse(payload.split('data: ')[1].trim());
    assert.deepEqual(snapshot.orders.map(order => order.id), ['direct', 'email', 'linked']);
    const count = s.response.chunks.length;
    s.emit(orders);
    assert.equal(s.response.chunks.length, count);
    s.response.emit('close');
    assert.equal(s.disconnected(), true);
  } finally { s.response.emit('close'); }
});
