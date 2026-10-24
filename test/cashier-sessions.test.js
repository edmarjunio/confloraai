const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { PdvService } = require('../src/orders/pdv.service');
const sessions = require('../src/orders/cashier-sessions');
const rose = { id: 'rose', role: 'CAIXA', name: 'Rose' };
const edmar = { id: 'edmar', role: 'CAIXA', name: 'Edmar' };
function setup() {
  const repo = new FirestoreRepository({ isInMemory: true });
  repo.inMemoryProducts.set('plant', { id: 'plant', name: 'Planta', price: 50, stockQuantity: 100, status: 'ATIVO' });
  repo.inMemoryCustomers.set('customer', { id: 'customer', name: 'Cliente', debtBalance: 100 });
  const store = new PdvRepository(repo);
  const service = new PdvService({ repository: store });
  return { store, service };
}
const open = (store, user = rose, openingFloat = 100) => sessions.open(store, user, { requestId: randomUUID(), openingFloat });
const close = (store, session, cash, user = rose, extra = {}) => sessions.close(store, user, { sessionId: session.id, counted: { cash, pix: 0, credit: 0, debit: 0 }, ...extra });
const sale = (service, user = rose) => service.create({ requestId: randomUUID(), items: [{ productId: 'plant', quantity: 1 }], paymentMethod: 'DINHEIRO', cashReceived: 100 }, user);

test('abertura obrigatória, valores inválidos e duas aberturas concorrentes', async () => {
  const { store, service } = setup();
  await assert.rejects(sale(service), /Abra seu caixa/);
  for (const value of [undefined, null, '', -1, 'abc', Infinity, {}, true]) await assert.rejects(open(store, rose, value === undefined ? NaN : value), /valor monetário/);
  const results = await Promise.allSettled([open(store), open(store)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(results.find(r => r.status === 'rejected').reason.message, /caixa anterior/);
  const session = results.find(r => r.status === 'fulfilled').value;
  assert.equal((await sessions.open(store, rose, { requestId: session.id, openingFloat: 100 })).id, session.id);
  await assert.rejects(close(store, session, 100, edmar), /Abra seu caixa/);
});

test('troco + venda líquida + recebimento de dívida; novo turno não duplica valores', async () => {
  const { store, service } = setup();
  const first = await open(store);
  const order = await sale(service);
  assert.equal(order.cashierSessionId, first.id);
  assert.equal(order.changeGiven, 50);
  await store.settle({ id: randomUUID(), customerKey: 'customer', amount: 20, paymentMethod: 'DINHEIRO', receivedBy: rose, notes: '' });
  const state = await sessions.status(store, rose);
  assert.equal(state.myExpected.cashReceipts, 70);
  assert.equal(state.myExpected.openingFloat, 100);
  assert.equal(state.myExpected.cash, 170);
  const result = await close(store, first, 170);
  assert.equal(result.closing.differences.cash, 0);
  await assert.rejects(sale(service), /Abra seu caixa/);
  const second = await open(store, rose, 40);
  await assert.rejects(close(store, first, 170), /Abra seu caixa/);
  assert.equal((await sessions.status(store, rose)).myExpected.cash, 40);
  await sale(service);
  const secondClose = await close(store, second, 90);
  assert.notEqual(secondClose.jobId, result.jobId);
  assert.equal(secondClose.closing.expected.cashReceipts, 50);
  assert.equal((await store.list('cashier_closings')).length, 2);
  assert.equal((await store.read('pdv_outbox', secondClose.jobId)).cashierTotals.cash, 260);
});

test('caixa sem vendas impede resumo; fechamentos simultâneos criam apenas um envio', async () => {
  const { store } = setup();
  const a = await open(store, rose, 0);
  const b = await open(store, edmar, 25);
  const first = await close(store, a, 0);
  assert.equal(first.allClosed, false);
  assert.equal((await store.list('pdv_outbox')).length, 0);
  const results = await Promise.allSettled([close(store, b, 25, edmar), close(store, b, 25, edmar)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await store.list('pdv_outbox')).length, 1);
  assert.equal((await sessions.status(store, rose)).allClosed, true);
});

test('venda e fechamento concorrentes não perdem recebimento', async () => {
  const { store, service } = setup();
  const session = await open(store);
  const results = await Promise.allSettled([sale(service), close(store, session, 100)]);
  const saved = await store.read('cashier_sessions', session.id);
  if (results[0].status === 'fulfilled') {
    assert.equal(saved.receipts.cash, 50);
    assert.equal(results[1].status, 'rejected');
  } else {
    assert.equal(saved.status, 'CLOSED');
    assert.equal(saved.receipts.cash, 0);
  }
});

test('valores conferidos obrigatórios e divergências justificadas', async () => {
  const { store } = setup();
  const session = await open(store);
  await assert.rejects(sessions.close(store, rose, { sessionId: session.id }), /valor monetário/);
  await assert.rejects(close(store, session, -1), /valor monetário/);
  await assert.rejects(close(store, session, 99), /Explique a diferença/);
  const result = await close(store, session, 99, rose, { notes: 'Faltou uma moeda de R$ 1.' });
  assert.equal(result.closing.differences.cash, -1);
});

test('Pix pendente impede fechamento e comprovante precisa pertencer à sessão', async () => {
  const { store } = setup();
  const session = await open(store);
  await store.transaction(async tx => {
    tx.set('orders', 'pending', { id: 'pending', status: 'AWAITING_PIX' });
    tx.set('cashier_sessions', session.id, { ...session, pendingOrders: ['pending'] });
  });
  await assert.rejects(close(store, session, 100), /Pix pendentes/);
  await store.transaction(async tx => tx.set('orders', 'pending', { id: 'pending', status: 'CANCELLED' }));
  await assert.rejects(close(store, session, 100, rose, { proofId: randomUUID() }), /Comprovante inválido/);
  assert.equal((await close(store, session, 100)).allClosed, true);
});

test('data operacional usa São Paulo', () => {
  assert.equal(sessions.businessDate('2026-10-24T01:00:00Z'), '2026-10-23');
});

test('falha de WhatsApp preserva fechamento e intenção de envio; outro caixa não vê valores do colega', async () => {
  const { store } = setup();
  const session = await open(store);
  const result = await close(store, session, 100);
  const service = new PdvService({ repository: store, whatsapp: { sendTextMessage: async () => { throw Object.assign(new Error('Sem conexão'), { definitelyNotSent: true }); } } });
  await store.transaction(async tx => {
    tx.set('store_settings', 'whatsapp_notifications', { version: 1, recipients: [{ id: 'junior', phone: '5564999994321', enabled: true, closing: true }] });
  });
  await service.deliver(result.jobId);
  assert.equal((await store.read('cashier_sessions', session.id)).status, 'CLOSED');
  const parent = await store.read('pdv_outbox', result.jobId);
  assert.equal(parent.deliveryStatus, 'FANOUT_QUEUED');
  assert.equal((await store.read('pdv_outbox', parent.childIds[0])).status, 'PENDING');
  const otherView = await sessions.status(store, edmar);
  assert.equal(otherView.activeOperators[0].counted, undefined);
  assert.equal(otherView.activeOperators[0].expected, undefined);
});
