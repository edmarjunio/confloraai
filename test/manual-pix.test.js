process.env.NODE_ENV = 'test';
process.env.PIX_MODE = 'MANUAL';
process.env.PIX_KEY = '52998224725';
process.env.PIX_TITULAR = 'Loja isolada';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { createApp } = require('../src/http/app');
const { IncomingMessageService } = require('../src/services/incoming-message.service');
const { summarizeExecutivePeriod } = require('../src/reports/period-executive-metrics');

async function setup(t) {
  const repo = new FirestoreRepository({ isInMemory: true });
  repo.inMemoryProducts.set('plant', { id: 'plant', name: 'Planta', price: 10, stockQuantity: 20, status: 'ATIVO' });
  let bankCalls = 0;
  const app = createApp({ messageService: { firestoreRepo: repo, catalogRepo: { items: [], refreshCatalog: async () => {} } }, sicrediClient: { isOfficialApiConfigured: false, createCharge: async () => { bankCalls++; throw new Error('Banco não deve ser chamado.'); } } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => server.close()); const base = 'http://127.0.0.1:' + server.address().port;
  const request = (path, data, headers = {}) => fetch(base + path, { method: data === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...headers }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
  const create = async () => {
    const response = await request('/api/storefront/orders', { customer: { name: 'Cliente', phone: '64999990000' }, fulfillment: 'pickup', paymentMethod: 'PIX', items: [{ productId: 'plant', quantity: 2 }] }, { 'Idempotency-Key': randomUUID() });
    const body = await response.json(); assert.equal(response.status, 200, JSON.stringify(body)); return body.order;
  };
  const login = async (userId = 'usr-edmar', pin = '1234') => (await request('/api/admin/auth/login', { userId, pin })).headers.get('set-cookie').split(';')[0];
  const upload = order => request(`/api/storefront/orders/${order.id}/payment-proof`, { dataUrl: 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\nreview\n%%EOF').toString('base64'), fileName: 'comprovante.pdf' }, { 'X-Order-Token': order.accessToken });
  return { repo, app, request, create, login, upload, bankCalls: () => bankCalls };
}

test('Pix manual cria reserva sem banco; somente Caixa/Admin aprova o comprovante uma vez', async t => {
  const s = await setup(t); const order = await s.create();
  assert.equal(order.pixMode, 'MANUAL'); assert.equal(order.status, 'AWAITING_PAYMENT'); assert.equal(s.bankCalls(), 0);
  assert.equal(s.repo.inMemoryProducts.get('plant').stockQuantity, 20);
  assert.equal((await s.request(`/api/storefront/orders/${order.id}/payment`)).status, 404);
  const uploaded = await s.upload(order); assert.equal(uploaded.status, 201); const proofId = (await uploaded.json()).proofId;
  assert.equal(s.repo.inMemoryOrders.get(order.id).paymentStatus, 'PENDING');
  const cookie = await s.login();
  const body = { decision: 'APPROVE', proofId, bankReceived: true, note: 'Recebimento conferido no banco.' };
  const results = await Promise.all([s.request(`/api/caixa/orders/${order.id}/review-proof`, body, { cookie }), s.request(`/api/caixa/orders/${order.id}/review-proof`, body, { cookie })]);
  assert.ok(results.every(response => response.status === 200));
  assert.equal(s.repo.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal(s.repo.inMemoryOrders.get(order.id).paymentReviewStatus, 'APPROVED'); assert.equal(s.bankCalls(), 0);
});

test('recusar comprovante preserva pedido e reserva; reenvio mantém histórico e invalida comprovante anterior', async t => {
  const s = await setup(t); const order = await s.create(); const first = await (await s.upload(order)).json(); const cookie = await s.login();
  const path = `/api/caixa/orders/${order.id}/review-proof`;
  assert.equal((await s.request(path, { decision: 'APPROVE', proofId: first.proofId, note: 'Conferido no banco' }, { cookie })).status, 400);
  assert.equal((await s.request(path, { decision: 'REJECT', proofId: first.proofId, note: 'Valor do comprovante incorreto.' }, { cookie })).status, 200);
  const second = await (await s.upload(order)).json(); assert.notEqual(second.proofId, first.proofId);
  assert.equal((await s.request(path, { decision: 'APPROVE', proofId: first.proofId, bankReceived: true, note: 'Conferido no banco' }, { cookie })).status, 409);
  assert.equal(s.repo.inMemoryOrders.get(order.id).paymentProofHistory.length, 2);
  assert.equal(s.repo.inMemoryProducts.get('plant').stockQuantity, 20);
});

test('comprovante não pode ser enviado a outro pedido nem aprovado por vendedor', async t => {
  const s = await setup(t); const first = await s.create(); const second = await s.create();
  assert.equal((await s.request(`/api/storefront/orders/${second.id}/payment`, undefined, { 'X-Order-Token': first.accessToken })).status, 404);
  await s.repo.saveUser({ id: 'seller-review', name: 'Vendedor', role: 'VENDEDOR', pin: '4321', active: true });
  const cookie = await s.login('seller-review', '4321');
  assert.equal((await s.request(`/api/caixa/orders/${first.id}/review-proof`, { decision: 'APPROVE' }, { cookie })).status, 403);
  assert.equal((await s.request('/reports/fechamento-caixa-2026-10-18.pdf')).status, 403);
});

test('senhas novas e PIN legado são protegidos e nunca retornam no usuário público', async t => {
  const s = await setup(t);
  const response = await s.request('/api/auth/register', { name: 'Conta segura', email: 'secure@test.com', password: 'senha-segura' });
  const { user } = await response.json(); assert.equal(response.status, 200);
  const stored = await s.repo.getUserById(user.id); assert.equal(stored.password, undefined); assert.match(stored.passwordHash, /^scrypt:/); assert.equal(user.passwordHash, undefined);
  await s.login(); assert.equal((await s.repo.getUserById('usr-edmar')).pin, undefined);
  assert.equal((await s.request('/api/auth/login', { email: 'edmarjuniob@gmail.com', password: '1234' })).status, 401);
});

test('mensagem interrompida pode ser retomada e reivindicações concorrentes são bloqueadas', async () => {
  const repo = new FirestoreRepository({ isInMemory: true }); const inbox = new IncomingMessageService(repo);
  await inbox.accept({ messageId: 'wamid-review', phone: 'test', message: 'test' });
  const claim = await inbox.claim('wamid-review'); await assert.rejects(inbox.claim('wamid-review'));
  await inbox.finish(claim, new Error('Falha temporária')); const retry = await inbox.claim('wamid-review');
  await inbox.finish(retry); assert.equal((await inbox.claim('wamid-review')).completed, true);
});

test('recebimento vai para o mês do pagamento e unidade de produto aceita saleUnit.code', () => {
  const order = { id: 'cross-month', createdAt: '2026-01-31T15:00:00Z', paidAt: '2026-02-01T15:00:00Z', status: 'CONFIRMED', paymentStatus: 'APPROVED', paymentMethod: 'PIX', total: 100, items: [{ productId: 'kg', name: 'Produto', quantity: 2, price: 50, saleUnit: { code: 'KG' } }] };
  const january = summarizeExecutivePeriod({ from: '2026-01-01', to: '2026-01-31', orders: [order] }).current;
  const february = summarizeExecutivePeriod({ from: '2026-02-01', to: '2026-02-28', orders: [order] }).current;
  assert.equal(january.totalCashIn, 0); assert.equal(february.totalCashIn, 100); assert.equal(january.rankings.mostByQuantity[0].unit, 'kg');
});

test('tentativas de login são limitadas e JSON inválido recebe erro público em JSON', async t => {
  const previous = process.env.REQUEST_AUTH_LIMIT;
  process.env.REQUEST_AUTH_LIMIT = '2';
  t.after(() => { process.env.REQUEST_AUTH_LIMIT = previous; });
  const s = await setup(t);
  for (let i = 0; i < 2; i++) assert.equal((await s.request('/api/admin/auth/login', { userId: 'inexistente', pin: 'errado' })).status, 401);
  const limited = await s.request('/api/admin/auth/login', { userId: 'inexistente', pin: 'errado' });
  assert.equal(limited.status, 429); assert.equal((await limited.json()).code, 'RATE_LIMITED');
  const server = s.app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve)); t.after(() => server.close());
  const invalid = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(invalid.status, 400); assert.match((await invalid.json()).error, /inválidos/);
});

test('modo manual impede cobrança bancária para quitar dívida', async () => {
  const { CustomerDebtPixService } = require('../src/orders/customer-debt-pix.service');
  let calls = 0;
  const service = new CustomerDebtPixService({ store: {}, pix: { createCharge: () => { calls++; } } });
  await assert.rejects(service.create({}, {}), /conferida pelo caixa/);
  assert.equal(calls, 0);
});

test('configuração manual normaliza CPF formatado e rejeita CPF inválido', t => {
  const previous = process.env.PIX_KEY;
  t.after(() => { process.env.PIX_KEY = previous; });
  const { manualPixSettings } = require('../src/orders/pix-mode');
  process.env.PIX_KEY = '529.982.247-25'; assert.equal(manualPixSettings().key, '52998224725');
  process.env.PIX_KEY = '11111111111'; assert.throws(() => manualPixSettings(), /válida/);
  assert.equal(manualPixSettings({ required: false }).configured, false);
});
