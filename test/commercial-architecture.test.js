const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { meteredFirestore } = require('./helpers/metered-firestore');
const { createInMemoryFirestore } = require('./helpers/agent-firestore');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { PdvService } = require('../src/orders/pdv.service');
const { OrderService } = require('../src/orders/order.service');
const { MessageService } = require('../src/services/message.service');
const { commercialLine, commercialProduct } = require('../src/catalog/commercial-product');
const { conversationAutomation } = require('../src/services/conversation-automation');
const { normalizeExistingCheckout, readStoreSettings, toProduct } = require('../src/storefront/existing-store');

const phone = '5564999990000';
const cashier = { id: 'cashier', role: 'CAIXA', name: 'Caixa' };
const plant = { id: 'plant', name: 'Muda', price: 10, unit: 'UN', stockQuantity: 10, status: 'ATIVO' };
function fixture(data = {}) {
  const db = meteredFirestore({ 'products/plant': plant, 'store_settings/inventory': { stockControlEnabled: true }, ...data });
  const repo = new FirestoreRepository({ firestoreInstance: db, isInMemory: true });
  const store = new PdvRepository(repo);
  return { db, repo, store };
}
const sale = (id = randomUUID(), source = 'WEB_CATALOG') => ({ id, source, status: 'AWAITING_PAYMENT',
  paymentMethod: 'DINHEIRO', total: 20, customerPhone: phone,
  items: [{ productId: 'plant', name: 'Muda', price: 10, quantity: 2, unit: 'UN' }] });

test('canonical product preserves aliases, editable zero price and kilogram precision', () => {
  const raw = { id: 'kg', 'DESCRIÇÃO': 'Adubo KG', VALOR: 'R$ 1.234,56', estoque: 2.5, reservedQuantity: 0.5, CATEGORIA: 'Horta' };
  const view = commercialProduct(raw);
  assert.equal(view.priceMinor, 123456); assert.equal(view.unit, 'KG');
  assert.equal(commercialLine(raw, 0.1).subtotalMinor, 12346);
  assert.equal(toProduct(raw).stock.quantity, 2);
  assert.equal(commercialProduct({ ...raw, price: 0 }).price, 0);
  assert.equal(commercialProduct({ ...raw, price: 'R$ 1,234.56' }).priceMinor, 123456);
  assert.equal(commercialLine({ ...plant, unit: 'KG', price: 11.15 }, 0.1).subtotalMinor, 112);
  assert.equal(raw.name, undefined);
  for (const quantity of [NaN, Infinity, -1, 0, 0.01, 0.1111]) assert.throws(() => commercialLine(raw, quantity));
  assert.throws(() => commercialLine({ ...plant, price: undefined }, 1));
});

test('web/PDV/WhatsApp share stock under concurrent creation; duplicate reservation is impossible', async () => {
  const { db, repo, store } = fixture({ 'products/plant': { ...plant, stockQuantity: 2 } });
  const candidates = [sale('web'), sale('pdv', 'PDV'), sale('whatsapp', 'WHATSAPP_BOT')];
  const results = await Promise.allSettled(candidates.map(order => order.source === 'PDV' ? store.create(order)
    : repo.createDirectOrder(order, { reserveInventory: true })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(db.data.get('products/plant').stockQuantity, 2);
  assert.equal(db.data.get('products/plant').reservedQuantity, 2);
  const winner = results.find(result => result.status === 'fulfilled').value;
  const writes = db.metrics.writes;
  await repo.createDirectOrder(winner, { reserveInventory: true });
  assert.equal(db.metrics.writes, writes);
  assert.ok(db.data.has(`pdv_outbox/${winner.id}-receipt`));
  await repo.cancelOrder(winner.id, 'Teste de cancelamento');
  await repo.cancelOrder(winner.id, 'Replay');
  assert.equal(db.data.get('products/plant').reservedQuantity, 0);
});

test('price/status/unit changes between presentation and reservation fail without financial writes', async () => {
  for (const change of [{ price: 12 }, { status: 'INATIVO' }, { unit: 'KG' }, { name: 'Outra muda' }, { reservedQuantity: NaN }]) {
    const { db, repo } = fixture({ 'products/plant': { ...plant, ...change } });
    const before = db.metrics.writes;
    await assert.rejects(repo.createDirectOrder(sale(), { reserveInventory: true }));
    assert.equal(db.metrics.writes, before);
    assert.equal([...db.data.keys()].filter(path => path.startsWith('orders/')).length, 0);
  }
});

test('a failed commit cannot leave either a reservation or a receipt intent behind', async () => {
  const { db, repo } = fixture();
  const transaction = db.runTransaction;
  db.runTransaction = work => transaction(async tx => { await work(tx); throw new Error('COMMIT_FAILED'); });
  await assert.rejects(repo.createDirectOrder(sale(), { reserveInventory: true }), /COMMIT_FAILED/);
  assert.equal(db.data.get('products/plant').reservedQuantity, undefined);
  assert.equal(db.metrics.writes, 0);
});

test('idempotency keys cannot overwrite another sale or silently change its contents', async () => {
  const { db, repo } = fixture();
  const order = await repo.createDirectOrder(sale('fixed'), { reserveInventory: true });
  await assert.rejects(repo.createDirectOrder({ ...sale('fixed'), total: 50 }, { reserveInventory: true }), /outra venda/);
  assert.equal(db.data.get('orders/fixed').total, order.total);
  assert.equal(db.data.get('products/plant').reservedQuantity, 2);
});

test('fractional stock reservations and payment use the same quantity, only once', async () => {
  const { db, repo, store } = fixture({ 'products/plant': { ...plant, name: 'Adubo KG', unit: 'KG', stockQuantity: 1.5 } });
  const order = await repo.createDirectOrder({ ...sale('kg'), total: 3,
    items: [{ productId: 'plant', name: 'Adubo KG', price: 10, quantity: 0.3, unit: 'KG' }] }, { reserveInventory: true });
  await Promise.all([store.receive(order.id, cashier, null, 5), store.receive(order.id, cashier, null, 5)]);
  assert.equal(db.data.get('products/plant').stockQuantity, 1.2);
  assert.equal(db.data.get('products/plant').reservedQuantity, 0);
  assert.equal(db.data.get('orders/kg').changeGiven, 2);
  assert.equal([...db.data.keys()].filter(path => path.startsWith('stock_movements/')).length, 1);
});

test('conversational carts are isolated in sessions; historical phone orders remain unchanged', async () => {
  const history = { id: phone, source: 'WHATSAPP_BOT', status: 'CONFIRMED', total: 999 };
  const { db, repo } = fixture({ [`orders/${phone}`]: history });
  assert.equal(await repo.getOrder(phone), null);
  await repo.saveOrder(phone, { items: [], status: 'AWAITING_CONFIRMATION' });
  assert.deepEqual(db.data.get(`orders/${phone}`), history);
  assert.equal(db.data.get(`sessions/${phone}`).orderDraft.draft, true);
});

test('legacy pending cart is read compatibly, copied only when edited and never deleted', async () => {
  const legacy = { status: 'AWAITING_CONFIRMATION', items: sale().items };
  const { db, repo } = fixture({ [`orders/${phone}`]: legacy });
  assert.equal((await repo.getOrder(phone)).items.length, 1);
  assert.equal(db.data.has(`sessions/${phone}`), false);
  await repo.updateOrder(phone, { paymentMethod: 'DINHEIRO' });
  assert.equal((await repo.getOrder(phone)).paymentMethod, 'DINHEIRO');
  assert.deepEqual(db.data.get(`orders/${phone}`), legacy);
});

test('WhatsApp confirmation creates an official pending order; cashier payment deducts once', async () => {
  const { db, repo, store } = fixture();
  const service = new OrderService({ firestoreRepo: repo, catalogRepo: {} });
  await service.createPendingOrder(phone, [{ product: { id: 'plant' }, quantity: 2 }], { paymentMethod: 'DINHEIRO' }, 'wamid.order');
  const [first, replay] = await Promise.all([service.confirmOrder(phone, 'Cliente'), service.confirmOrder(phone, 'Cliente')]);
  assert.equal(first.order.id, replay.order.id); assert.notEqual(first.order.id, phone);
  assert.equal(first.order.paymentStatus, 'PENDING');
  assert.equal(db.data.get('products/plant').stockQuantity, 10);
  assert.equal(db.data.get('products/plant').reservedQuantity, 2);
  await store.receive(first.order.id, cashier, null, 50);
  assert.equal(db.data.get('products/plant').stockQuantity, 8);
  assert.equal(db.data.get(`orders/${first.order.id}`).changeGiven, 30);
  const paidReplay = await service.confirmOrder(phone, 'Cliente');
  assert.doesNotMatch(paidReplay.reply, /pagamento permanece pendente/);
  assert.equal(db.data.get('products/plant').stockQuantity, 8);
});

test('native cart additions from different messages serialize; repeated Meta event adds once', async () => {
  const { repo } = fixture();
  const service = new OrderService({ firestoreRepo: repo, catalogRepo: {} });
  await Promise.all([service.addProductToDraft(phone, 'plant', 'm1'), service.addProductToDraft(phone, 'plant', 'm2')]);
  await service.addProductToDraft(phone, 'plant', 'm1');
  assert.equal((await repo.getOrder(phone)).items[0].quantity, 2);
});

test('stale WhatsApp prices and unknown product identity cannot become orders', async () => {
  const { db, repo } = fixture(); const service = new OrderService({ firestoreRepo: repo, catalogRepo: {} });
  await assert.rejects(service.createPendingOrder(phone, [{ product: { canonicalName: 'Muda', prices: [10] }, quantity: 2 }]));
  await service.createPendingOrder(phone, [{ product: { id: 'plant' }, quantity: 2 }], { paymentMethod: 'DINHEIRO' });
  db.data.set('products/plant', { ...plant, price: 12 });
  await assert.rejects(service.confirmOrder(phone), /preço mudou/);
  assert.equal([...db.data.keys()].filter(path => path.startsWith('orders/')).length, 0);
});

test('paused human conversation blocks greetings, native cart and native payment in every environment', async () => {
  const { db, repo } = fixture();
  const state = await conversationAutomation(repo, phone, { pauseReason: 'human_requested', messageId: 'm1' });
  const unexpected = () => { throw new Error('Unexpected automation side effect'); };
  const messages = new MessageService({ firestoreRepo: repo,
    whatsappClient: { sendTextMessage: unexpected, sendWelcomeTemplate: unexpected },
    orderService: { confirmOrder: unexpected, addProductToDraft: unexpected }, catalogRepo: { refreshCatalog: unexpected } });
  for (const input of [{ message: 'Oi' }, { message: 'Muda', interactiveId: 'add_plant' }, { message: 'Pix', interactiveId: 'pay_pix' }]) {
    assert.equal((await messages.processCustomerMessage({ phone, messageId: randomUUID(), ...input })).intent, 'HUMAN_HANDOFF_ACTIVE');
  }
  assert.equal(db.data.get(`agent_handoffs/${state.handoffId}`).status, 'open');
  assert.equal(db.data.has(`sessions/${phone}`), false);
});

test('unavailable conversation persistence fails closed before any native send', async () => {
  const repo = new FirestoreRepository({ firestoreInstance: { runTransaction: async () => { throw new Error('OFFLINE'); } } });
  repo.appendMessage = async () => {};
  let sends = 0;
  const messages = new MessageService({ firestoreRepo: repo, whatsappClient: { sendWelcomeTemplate: () => { sends++; } } });
  await assert.rejects(messages.processCustomerMessage({ phone, message: 'Oi' }), /OFFLINE/);
  assert.equal(sends, 0);
});

test('bank/configuration outage cannot use process-local checkout configuration', async () => {
  const repo = { firestore: { collection: () => ({ doc: () => ({ get: async () => { throw new Error('OFFLINE'); } }) }) },
    storefrontSettings: { config: { checkout: { delivery: { feeMinor: 0 } } } } };
  await assert.rejects(readStoreSettings(repo), { status: 503 });
});

test('PDV revalidates prices inside the same transaction as order creation', async () => {
  const { repo, db, store } = fixture();
  const read = repo.getProductsByIds.bind(repo);
  repo.getProductsByIds = async ids => { const products = await read(ids); db.data.set('products/plant', { ...plant, price: 20 }); return products; };
  const service = new PdvService({ repository: store });
  await assert.rejects(service.create({ requestId: randomUUID(), paymentMethod: 'DINHEIRO', items: [{ productId: 'plant', quantity: 1 }] }, cashier), /preço mudou/);
  assert.equal([...db.data.keys()].filter(path => path.startsWith('orders/')).length, 0);
});

test('checkout displays available stock after reservations and ignores browser prices', async () => {
  const { repo } = fixture({ 'products/plant': { ...plant, reservedQuantity: 9 } });
  const req = { path: '/api/storefront/orders', body: { customer: { name: 'Cliente', phone: '64999990000' },
    fulfillment: 'pickup', paymentMethod: 'PIX', items: [{ productId: 'plant', quantity: 1, price: 0.01 }] } };
  await normalizeExistingCheckout(req, repo); assert.equal(req.body.subtotal, 10);
  req.body = { customer: { name: 'Cliente', phone: '64999990000' }, fulfillment: 'pickup', paymentMethod: 'PIX', items: [{ productId: 'plant', quantity: 2 }] };
  await assert.rejects(normalizeExistingCheckout(req, repo), /indisponível/);
});

test('callback that precedes provider acknowledgement is reconciled without regressing delivery', async () => {
  const { db, store } = fixture();
  assert.equal(await store.recordWhatsAppStatus({ id: 'wamid.early', status: 'read' }), false);
  const event = [...db.data.values()].find(row => row.providerMessageId === 'wamid.early');
  assert.equal(event.status, 'PENDING');
  db.data.set('pdv_outbox/job', { id: 'job', status: 'SENT', providerMessageId: 'wamid.early' });
  await store.recordWhatsAppStatus({ id: 'wamid.early', status: 'read' });
  await store.recordWhatsAppStatus({ id: 'wamid.early', status: 'failed' });
  assert.equal(db.data.get('pdv_outbox/job').deliveryStatus, 'READ');
});

test('draft writes preserve message subcollections with a Firestore-compatible adapter', async () => {
  const db = createInMemoryFirestore({ [`sessions/${phone}/messages/m1`]: { text: 'preserve' } });
  const repo = new FirestoreRepository({ firestoreInstance: db });
  await repo.saveOrder(phone, { status: 'AWAITING_CONFIRMATION', items: [] });
  assert.equal(db.raw.get(`sessions/${phone}/messages/m1`).text, 'preserve');
});

test('uncertain native send persists a marker, pauses automation and never submits twice', async () => {
  const { repo, db } = fixture(); let sends = 0;
  const { durableConversationTransport } = require('../src/services/durable-conversation-transport');
  const client = { sendTextMessage: async () => { sends++; throw new Error('TIMEOUT_AFTER_SUBMISSION'); } };
  for (let n = 0; n < 2; n++) {
    const transport = durableConversationTransport(repo, client, { phone, messageId: 'wamid.uncertain' });
    await assert.rejects(transport.sendTextMessage(phone, 'Mensagem'), { requiresReconciliation: true });
  }
  assert.equal(sends, 1);
  assert.ok([...db.data.values()].some(row => row.kind === 'conversation-native' && row.status === 'NEEDS_RECONCILIATION'));
  assert.equal((await conversationAutomation(repo, phone)).automation, 'paused');
});

test('acknowledged native send replays its provider ID without another submission', async () => {
  const { repo } = fixture(); let sends = 0;
  const { durableConversationTransport } = require('../src/services/durable-conversation-transport');
  const client = { sendTextMessage: async () => { sends++; return { messages: [{ id: 'wamid.ok' }] }; } };
  for (let n = 0; n < 2; n++) {
    const transport = durableConversationTransport(repo, client, { phone, messageId: 'wamid.ack' });
    assert.equal((await transport.sendTextMessage(phone, 'Mensagem')).messages[0].id, 'wamid.ok');
  }
  assert.equal(sends, 1);
});

test('cashier reads only requested history while preserving old open orders and active deliveries', async () => {
  const { repo, db } = fixture({
    'orders/old-paid': { id: 'old-paid', status: 'CONFIRMED', createdAt: '2020-01-01T12:00:00.000Z', completedAt: '2020-01-01T12:00:00.000Z' },
    'orders/old-open': { id: 'old-open', status: 'AWAITING_PAYMENT', createdAt: '2020-01-01T12:00:00.000Z' },
    'orders/old-delivery': { id: 'old-delivery', status: 'CONFIRMED', deliveryStatus: 'OUT_FOR_DELIVERY', completedAt: '2020-01-01T12:00:00.000Z' },
    'orders/today': { id: 'today', status: 'CONFIRMED', createdAt: '2026-10-22T12:00:00.000Z', paidAt: '2026-10-22T12:00:00.000Z' },
  });
  const { cashierSnapshotRecords } = require('../src/database/repositories/cashier-snapshot');
  const snapshot = await cashierSnapshotRecords(repo, { from: '2026-10-22', to: '2026-10-22' });
  assert.deepEqual(snapshot.orders.map(order => order.id).sort(), ['old-delivery', 'old-open', 'today']);
  assert.equal(db.metrics.writes, 0);
});

test('Cloud Tasks worker authenticates and processes only the signed persisted payload, including buttons', async () => {
  const { repo } = fixture();
  const { IncomingMessageService } = require('../src/services/incoming-message.service');
  const { incomingTaskHandler } = require('../src/http/incoming-task');
  const incoming = new IncomingMessageService(repo);
  const payload = { messageId: 'wamid.task', phone, message: 'Muda', interactiveId: 'add_plant' };
  await incoming.accept(payload);
  let processed;
  const handler = incomingTaskHandler({ incoming, messageService: { handleCustomerMessage: async value => { processed = value; return { ok: true }; } },
    config: { whatsapp: { assistantEnabled: true }, tasks: { taskSecret: 'local-fixture-secret' } } });
  const request = { headers: { 'x-conflora-task-secret': 'invalid' }, body: { messageId: payload.messageId, interactiveId: 'pay_pix' } };
  const response = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return this; }, sendStatus(value) { this.statusCode = value; return this; } };
  await handler(request, response); assert.equal(response.statusCode, 401); assert.equal(processed, undefined);
  request.headers['x-conflora-task-secret'] = 'local-fixture-secret';
  await handler(request, response); assert.equal(response.statusCode, 200); assert.deepEqual(processed, payload);
  request.body.messageId = 'not-persisted';
  await handler(request, response); assert.equal(response.statusCode, 409);
});

test('durable administrator notification is idempotent and preserves a read notification', async () => {
  const { repo, db, store } = fixture();
  const order = await repo.createDirectOrder(sale('notify'), { reserveInventory: true });
  const service = new PdvService({ repository: store });
  await service.deliver('notify-admin-new');
  const notifications = [...db.data.entries()].filter(([path]) => path.startsWith('notifications/'));
  assert.equal(notifications.length, 1);
  const [path, notification] = notifications[0]; db.data.set(path, { ...notification, read: true });
  const writes = db.metrics.writes;
  await repo.notifyAllAdminUsersOfSale(order); await service.deliver('notify-admin-new');
  assert.equal(db.metrics.writes, writes);
  assert.equal(db.data.get(path).read, true);
});

test('a simultaneous cart edit prevents checkout and never loses the newly added item', async () => {
  const { repo, db } = fixture(); const service = new OrderService({ firestoreRepo: repo, catalogRepo: {} });
  await service.createPendingOrder(phone, [{ product: { id: 'plant' }, quantity: 1 }], { paymentMethod: 'DINHEIRO' });
  const create = repo.createDirectOrder.bind(repo);
  repo.createDirectOrder = async (order, options) => { await service.addProductToDraft(phone, 'plant', 'new-item'); return create(order, options); };
  await assert.rejects(service.confirmOrder(phone), /sacola mudou/);
  assert.equal((await repo.getOrder(phone)).items[0].quantity, 2);
  assert.equal([...db.data.keys()].filter(path => path.startsWith('orders/')).length, 0);
});

test('payment details and cart quantities survive concurrent changes', async () => {
  const { repo } = fixture(); const service = new OrderService({ firestoreRepo: repo, catalogRepo: {} });
  await service.addProductToDraft(phone, 'plant', 'm1');
  await Promise.all([service.updateOrderDetails(phone, { paymentMethod: 'DEBITO' }), service.addProductToDraft(phone, 'plant', 'm2')]);
  const draft = await repo.getOrder(phone);
  assert.equal(draft.paymentMethod, 'DEBITO'); assert.equal(draft.items[0].quantity, 2);
});
