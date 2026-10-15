process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { PdvService } = require('../src/orders/pdv.service');
const { SicrediPixClient } = require('../src/integrations/sicredi-pix.client');
const { createApp } = require('../src/http/app');

const seller = { id: 'seller', name: 'Vendedor', role: 'VENDEDOR', pin: '4321' };
const cashier = { id: 'cashier', name: 'Caixa', role: 'CAIXA', pin: '1234' };
const actor = ({ id, name, role }) => ({ id, name, role });

function setup() {
  const base = new FirestoreRepository({ isInMemory: true });
  base.inMemoryProducts.set('plant', { id: 'plant', name: 'Muda', price: 10, stockQuantity: 20, status: 'ATIVO' });
  base.inMemoryCustomers.set('customer', { id: 'customer', name: 'Cliente', phone: '5564999991234', debtBalance: 0 });
  const repository = new PdvRepository(base);
  const sent = [];
  const whatsapp = {
    sendTextMessage: async (phone, text) => { sent.push({ phone, text }); return { messages: [{ id: 'wamid.text' }] }; },
    sendImageBuffer: async (phone) => { sent.push({ phone, image: true }); return { messages: [{ id: 'wamid.image' }] }; },
  };
  const pix = {
    pixKey: 'pix-key',
    createCharge: async ({ amount, txid }) => ({ txid, amount, pixCopiaECola: 'pix-code', qrCodeBase64: 'data:image/png;base64,aGVsbG8=', provider: 'SICREDI' }),
    checkChargeStatus: async (txid) => ({ isPaid: true, raw: { status: 'CONCLUIDA', txid, chave: 'pix-key', valor: { original: '20.00' }, pix: [{ txid, valor: '20.00', endToEndId: 'E' + '1'.repeat(31) }] } }),
  };
  const service = new PdvService({ repository, whatsapp, pix, ownerPhone: '5564999994321' });
  const input = { requestId: randomUUID(), items: [{ productId: 'plant', quantity: 2 }], paymentMethod: 'DINHEIRO' };
  return { base, repository, service, sent, input, pix, whatsapp };
}

test('seller creates a pending order; cashier receives once and attribution survives', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, sellerName: 'Forged', receivedBy: actor(cashier) }, seller);
  assert.equal(order.status, 'AWAITING_CASHIER');
  assert.equal(order.createdBy.name, seller.name);
  assert.equal(order.receivedBy, null);
  assert.equal(s.sent.length, 0);
  await assert.rejects(s.repository.receive(order.id, actor(seller)));
  const received = await Promise.all(Array.from({ length: 5 }, () => s.repository.receive(order.id, actor(cashier))));
  assert.equal(received.filter((row) => !row.alreadyConfirmed).length, 1);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal(received[0].createdBy.id, seller.id);
  assert.equal(received[0].receivedBy.id, cashier.id);
  await assert.rejects(s.base.confirmOrderPayment(order.id), /PDV/);
});

test('Pix receipt includes image; bank verification finalizes exactly once under repeated webhooks', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, paymentMethod: 'PIX', customerId: 'customer' }, seller);
  assert.equal(s.sent.length, 2);
  assert.ok(s.sent[1].image);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
  await Promise.all(Array.from({ length: 4 }, () => s.service.handlePix(order.pixData.txid)));
  const paid = await s.repository.read('orders', order.id);
  assert.equal(paid.receivedBy.id, seller.id);
  assert.equal(paid.paymentStatus, 'APPROVED');
  assert.equal(paid.verifiedVia, 'SICREDI_PIX_WEBHOOK');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal(s.sent.length, 4);
});

test('Pix never trusts webhook amounts, altered bank values or manual confirmation', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, paymentMethod: 'PIX' }, seller);
  await assert.rejects(s.repository.receive(order.id, actor(cashier)));
  s.pix.checkChargeStatus = async () => ({ isPaid: true, raw: { chave: 'pix-key', valor: { original: '20' }, pix: [{ txid: order.pixData.txid, valor: '1', endToEndId: 'E' + '1'.repeat(31) }] } });
  await assert.rejects(s.service.handlePix(order.pixData.txid), /divergente/);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
  assert.equal((await s.repository.read('orders', order.id)).status, 'AWAITING_PIX');
});

test('fiado is not paid; concurrent debt settlements cannot overdraw or change sales/stock', async () => {
  const s = setup();
  await assert.rejects(s.service.create({ ...s.input, paymentMethod: 'FIADO' }, seller), /cadastrado/);
  const order = await s.service.create({ ...s.input, paymentMethod: 'FIADO', customerId: 'customer' }, seller);
  const received = await s.repository.receive(order.id, actor(cashier));
  assert.equal(received.paidAt, null);
  assert.equal(received.paymentStatus, 'ON_ACCOUNT');
  assert.equal(s.base.inMemoryCustomers.get('customer').debtBalance, 20);
  const results = await Promise.allSettled([1, 2].map(() => s.repository.settle({ id: randomUUID(), customerKey: 'customer', amount: 15, paymentMethod: 'DINHEIRO', notes: '', receivedBy: actor(cashier) })));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(s.base.inMemoryCustomers.get('customer').debtBalance, 5);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  const settlement = results.find((result) => result.status === 'fulfilled').value;
  await s.repository.settle(settlement);
  assert.equal(s.base.inMemoryCustomers.get('customer').debtBalance, 5);
});

test('order retries reuse ID; insufficient stock leaves debt and inventory unchanged', async () => {
  const s = setup();
  const order = await s.service.create(s.input, cashier);
  const retry = await s.service.create(s.input, cashier);
  assert.equal(retry.id, order.id);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  await assert.rejects(s.service.create({ ...s.input, items: [{ productId: 'plant', quantity: 1 }] }, cashier), /outra venda/);
  const pending = await s.service.create({ ...s.input, requestId: randomUUID(), paymentMethod: 'FIADO', customerId: 'customer', items: [{ productId: 'plant', quantity: 100 }] }, seller);
  await assert.rejects(s.repository.receive(pending.id, actor(cashier)), /Estoque insuficiente/);
  assert.equal(s.base.inMemoryCustomers.get('customer').debtBalance, 0);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
});

test('WhatsApp failure is retried independently from the sale and resumes after sent text', async () => {
  const s = setup();
  s.whatsapp.sendImageBuffer = async () => { throw new Error('offline'); };
  const order = await s.service.create({ ...s.input, paymentMethod: 'PIX', customerId: 'customer' }, seller);
  assert.equal(order.receiptDelivery.sent, false);
  assert.equal(s.sent.length, 1);
  s.whatsapp.sendImageBuffer = async () => { s.sent.push({ image: true }); return { messages: [{ id: 'image' }] }; };
  await s.repository.updateMessage(`${order.id}-receipt`, { nextAttemptAt: 0 });
  await s.service.retryMessages();
  assert.equal(s.sent.length, 2);
  assert.equal((await s.repository.read('pdv_outbox', `${order.id}-receipt`)).status, 'SENT');
});

test('Sicredi uses real TLS credentials, fixed amount and never falls back to static code', async () => {
  const requests = [];
  const client = new SicrediPixClient({ clientId: 'id', clientSecret: 'secret', certificate: 'cert', privateKey: 'key', pixKey: 'pix', request: async (url, options) => {
    requests.push({ url, options });
    if (url.includes('/oauth/token')) return { access_token: 'token', expires_in: 3600 };
    return { txid: '1'.repeat(32), pixCopiaECola: 'code' };
  } });
  await client.createCharge({ amount: 20, txid: '1'.repeat(32) });
  assert.ok(requests[1].url.includes('/api/v2/cob/'));
  assert.equal(requests[1].options.cert, 'cert');
  assert.equal(JSON.parse(requests[1].options.body).valor.modalidadeAlteracao, 0);
  client.request = async () => { throw new Error('offline'); };
  await assert.rejects(client.createCharge({ amount: 20 }));
});

test('Firestore transaction rolls back stock, debt and order together on failed commit', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, paymentMethod: 'FIADO', customerId: 'customer' }, seller);
  let documents = new Map([
    ['orders/' + order.id, order], ['products/plant', s.base.inMemoryProducts.get('plant')],
    ['customers/customer', s.base.inMemoryCustomers.get('customer')],
  ]);
  let fail = true;
  let queue = Promise.resolve();
  const firestore = {
    collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}`, id }) }),
    runTransaction: (callback) => {
      const operation = queue.then(async () => {
        const writes = [];
        const result = await callback({
          get: async (ref) => { assert.equal(writes.length, 0, 'All reads precede writes'); return { exists: documents.has(ref.path), id: ref.id, data: () => structuredClone(documents.get(ref.path)) }; },
          set: (ref, value) => writes.push([ref.path, structuredClone(value)]),
        });
        if (fail) { throw new Error('Commit failed'); }
        documents = new Map([...documents, ...writes]);
        return result;
      });
      queue = operation.catch(() => {});
      return operation;
    },
  };
  s.base.firestore = firestore;
  s.base.getInventorySettings = async () => ({ stockControlEnabled: true });
  await assert.rejects(s.repository.receive(order.id, actor(cashier)), /Commit failed/);
  assert.equal(documents.get('customers/customer').debtBalance, 0);
  assert.equal(documents.get('products/plant').stockQuantity, 20);
  assert.equal(documents.get('orders/' + order.id).status, 'AWAITING_CASHIER');
  fail = false;
  const results = await Promise.all([s.repository.receive(order.id, actor(cashier)), s.repository.receive(order.id, actor(cashier))]);
  assert.equal(results.filter((result) => !result.alreadyConfirmed).length, 1);
  assert.equal(documents.get('products/plant').stockQuantity, 18);
  assert.equal(documents.get('customers/customer').debtBalance, 20);
});

test('HTTP requires real login, isolates staff and refuses manual/forged Pix', async (t) => {
  const s = setup();
  await s.base.saveUser(seller); await s.base.saveUser(cashier);
  const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '') => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
  assert.equal((await post('/api/caixa/orders', s.input)).status, 401);
  const login = await post('/api/admin/auth/login', { userId: seller.id, pin: seller.pin });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const response = await post('/api/caixa/orders', { ...s.input, paymentMethod: 'PIX' }, cookie);
  const { order } = await response.json();
  assert.ok(order, JSON.stringify(order));
  assert.equal((await post(`/api/caixa/orders/${order.id}/confirm`, {}, cookie)).status, 403);
  assert.equal((await post(`/api/caixa/orders/${order.id}/confirm-sicredi-pix`, {}, cookie)).status, 202);
  assert.equal((await post('/webhooks/sicredi-pix', { pix: [{ txid: order.pixData.txid, valor: 20 }] })).status, 401);
  assert.equal((await post('/api/caixa/debts/settle', { amount: 1 }, cookie)).status, 403);
});
