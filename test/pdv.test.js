process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { PdvService } = require('../src/orders/pdv.service');
const { SicrediPixClient, normalizePem } = require('../src/integrations/sicredi-pix.client');
const { createApp } = require('../src/http/app');

const seller = { id: 'seller', name: 'Vendedor', email: 'vendedor@conflora.test', role: 'VENDEDOR', pin: '4321' };
const cashier = { id: 'cashier', name: 'Caixa', email: 'caixa@conflora.test', role: 'CAIXA', pin: '1234' };
const secondCashier = { id: 'cashier-2', name: 'Outro Caixa', email: 'caixa2@conflora.test', role: 'CAIXA', pin: '5678' };
const actor = ({ id, name, email, role }) => ({ id, name, email, role });

function setup() {
  const base = new FirestoreRepository({ isInMemory: true });
  base.inMemoryUsers.set(seller.id, { ...seller, active: true });
  base.inMemoryUsers.set(cashier.id, { ...cashier, active: true });
  base.inMemoryUsers.set(secondCashier.id, { ...secondCashier, active: true });
  base.inMemoryProducts.set('plant', { id: 'plant', name: 'Muda', price: 10, stockQuantity: 20, status: 'ATIVO' });
  base.inMemoryCustomers.set('customer', { id: 'customer', name: 'Cliente', phone: '5564999991234', debtBalance: 0 });
  const repository = new PdvRepository(base);
  const sent = [];
  const chargeCalls = [];
  const whatsapp = {
    sendTextMessage: async (phone, text) => { sent.push({ phone, text }); return { messages: [{ id: 'wamid.text' }] }; },
    sendImageBuffer: async (phone, buffer, caption) => { sent.push({ phone, image: true, imageBase64: buffer.toString('base64'), caption }); return { messages: [{ id: 'wamid.image' }] }; },
  };
  const pix = {
    pixKey: 'pix-key',
    createCharge: async ({ amount, txid }) => { chargeCalls.push({ amount, txid }); return { txid, amount, pixCopiaECola: 'pix-code', qrCodeBase64: 'data:image/png;base64,aGVsbG8=', provider: 'SICREDI' }; },
    checkReceivedPayment: async (endToEndId) => ({ isPaid: true, raw: { txid: 'replace', endToEndId, chave: 'pix-key', valor: '20.00', devolucoes: [] } }),
  };
  const service = new PdvService({ repository, whatsapp, pix, ownerPhone: '5564999994321' });
  const input = { requestId: randomUUID(), items: [{ productId: 'plant', quantity: 2 }], paymentMethod: 'DINHEIRO' };
  return { base, repository, service, sent, input, pix, whatsapp, chargeCalls };
}

test('seller creates a pending order; cashier receives once and attribution survives', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, sellerName: 'Forged', receivedBy: actor(cashier) }, seller);
  assert.equal(order.status, 'AWAITING_CASHIER');
  assert.equal(order.createdBy.name, seller.name);
  assert.equal(order.createdBy.email, seller.email);
  assert.equal(Object.hasOwn(order, 'assignedCashier'), false);
  assert.equal(order.receivedBy, null);
  assert.equal(s.sent.length, 0);
  await assert.rejects(s.repository.receive(order.id, actor(seller)));
  const received = await Promise.all(Array.from({ length: 5 }, () => s.repository.receive(order.id, actor(secondCashier))));
  assert.equal(received.filter((row) => !row.alreadyConfirmed).length, 1);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal(received[0].createdBy.id, seller.id);
  assert.equal(received[0].receivedBy.id, secondCashier.id);
  assert.equal(received[0].receivedBy.email, secondCashier.email);
  await assert.rejects(s.base.confirmOrderPayment(order.id), /PDV/);
});

test('Pix receipt includes image; bank verification finalizes exactly once under repeated webhooks', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, paymentMethod: 'PIX', customerId: 'customer' }, seller);
  assert.equal(s.sent.length, 2);
  assert.match(s.sent[0].text, /Valor exato: \*R\$\s20,00\* \(Sem alteração de valor\)/);
  assert.match(s.sent[0].text, /PIX COPIA E COLA/);
  assert.match(s.sent[0].text, /pix-code/);
  assert.ok(s.sent[1].image);
  assert.equal(s.sent[1].imageBase64, 'aGVsbG8=');
  assert.match(s.sent[1].caption, /R\$\s20,00/);
  assert.match(order.qrCodeBase64, /^data:image\/png;base64,/);
  assert.equal(order.pixCopiaECola, 'pix-code');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 2);
  assert.equal(order.inventoryReserved, true);
  s.pix.checkReceivedPayment = async (endToEndId) => ({ isPaid: true, raw: { txid: order.pixData.txid, endToEndId, chave: 'pix-key', valor: '20.00', devolucoes: [] } });
  await Promise.all(Array.from({ length: 4 }, () => s.service.handlePix(order.pixData.txid, 'E' + '1'.repeat(31))));
  const paid = await s.repository.read('orders', order.id);
  assert.equal(paid.receivedBy.id, seller.id);
  assert.equal(paid.paymentStatus, 'APPROVED');
  assert.equal(paid.verifiedVia, 'SICREDI_PIX_WEBHOOK');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 0);
  assert.equal(s.sent.length, 4);
});

test('Pix generated at the cashier reserves stock and blocks a competing receipt until payment', async () => {
  const s = setup();
  const order = await s.service.create(s.input, seller);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity || 0, 0);

  const pixOrder = await s.repository.requestPixAtCashier(order.id, actor(cashier));
  assert.equal(pixOrder.inventoryReserved, true);
  assert.ok(pixOrder.pixExpiresAt);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 2);

  const competing = await s.service.create({ ...s.input, requestId: randomUUID(), items: [{ productId: 'plant', quantity: 18 }] }, seller);
  await s.repository.receive(competing.id, actor(cashier));
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 2);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 2);

  const verified = { txid: pixOrder.pixData.txid, amountMinor: 2000, verifiedVia: 'MANUAL_CAIXA_PIX',
    manualPixProofSeen: true, manualPixNote: 'Comprovante conferido', endToEndId: '' };
  const paid = await s.repository.receive(order.id, actor(cashier), verified);
  assert.equal(paid.status, 'CONFIRMED');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 0);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 0);
});

test('Pix expiration cancels the unpaid command and releases held stock without a deduction', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, paymentMethod: 'PIX', customerId: 'customer' }, seller);
  await s.repository.transaction(async (tx) => tx.set('orders', order.id, {
    ...order, pixExpiresAt: new Date(Date.now() - 1000).toISOString(),
  }));

  assert.equal(await s.service.expirePixOrder(order.id), true);
  assert.equal(await s.service.expirePixOrder(order.id), false);
  const expired = await s.repository.read('orders', order.id);
  assert.equal(expired.status, 'CANCELLED');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 0);
});

test('Pix never trusts webhook amounts, altered bank values or manual confirmation', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, paymentMethod: 'PIX' }, seller);
  await assert.rejects(s.repository.receive(order.id, actor(cashier)));
  s.pix.checkReceivedPayment = async (endToEndId) => ({ isPaid: true, raw: { txid: order.pixData.txid, endToEndId, chave: 'pix-key', valor: '1', devolucoes: [] } });
  await assert.rejects(s.service.handlePix(order.pixData.txid, 'E' + '1'.repeat(31)), /divergente/);
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
  const chargeCountBeforeInsufficientOrder = s.chargeCalls.length;
  await assert.rejects(s.service.create({ ...s.input, requestId: randomUUID(), paymentMethod: 'PIX', customerId: 'customer', items: [{ productId: 'plant', quantity: 100 }] }, seller), /Estoque disponível insuficiente/);
  assert.equal(s.chargeCalls.length, chargeCountBeforeInsufficientOrder);
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

test('Sicredi creates a fixed-amount charge; payment is verified by end-to-end ID', async () => {
  const requests = [];
  const client = new SicrediPixClient({ clientId: 'id', clientSecret: 'secret', certificate: 'cert', privateKey: 'key', pixKey: 'pix', request: async (url, options) => {
    requests.push({ url, options });
    if (url.includes('/oauth/token')) return { access_token: 'token', expires_in: 3600 };
    if (url.includes('/cob/')) return { txid: 'A'.repeat(32), chave: 'pix', valor: { original: '20.00', modalidadeAlteracao: 0 }, pixCopiaECola: 'sicredi-code', status: 'ATIVA' };
    return { endToEndId: 'E' + '1'.repeat(31), txid: 'A'.repeat(32), chave: 'pix', valor: '20.00', devolucoes: [] };
  } });
  const charge = await client.createCharge({ amount: 20, txid: 'A'.repeat(32), ticketNumber: '123' });
  assert.equal(charge.pixCopiaECola, 'sicredi-code');
  assert.equal(charge.mode, 'API_SICREDI_FIXED_AMOUNT');
  assert.equal(client.generateTxId().length, 32);
  assert.equal(requests[1].options.method, 'PUT');
  assert.deepEqual(JSON.parse(requests[1].options.body).valor, { original: '20.00', modalidadeAlteracao: 0 });
  assert.match(charge.qrCodeBase64, /^data:image\/png;base64,/);
  assert.ok(Buffer.from(charge.qrCodeBase64.split(',')[1], 'base64').length > 0);
  assert.match(requests[0].options.headers.Authorization, /^Basic /);
  assert.match(requests[0].options.body, /scope=cob\.read\+cob\.write\+pix\.read\+webhook\.read\+webhook\.write/);
  await client.checkReceivedPayment('E' + '1'.repeat(31));
  assert.ok(requests[2].url.includes('/api/v2/pix/'));
  assert.ok(requests[2].url.endsWith('/api/v2/pix/E' + '1'.repeat(31)));
  assert.equal(requests[2].options.cert, 'cert');
  assert.equal(requests[2].options.method, 'GET');
  client.request = async () => { throw new Error('offline'); };
  await assert.rejects(client.checkReceivedPayment('E' + '1'.repeat(31)));
  const editableCharge = new SicrediPixClient({ clientId: 'id', clientSecret: 'secret', certificate: 'cert', privateKey: 'key', pixKey: 'pix', request: async (url) => (
    url.includes('/oauth/token') ? { access_token: 'token', expires_in: 3600 } : { txid: 'B'.repeat(32), chave: 'pix', valor: { original: '20.00', modalidadeAlteracao: 1 }, pixCopiaECola: 'editable-code' }
  ) });
  await assert.rejects(editableCharge.createCharge({ amount: 20, txid: 'B'.repeat(32) }), /cobrança fixa/);
});

test('Sicredi PEM credentials accept escaped newlines from environment variables', () => {
  assert.equal(normalizePem('-----BEGIN CERTIFICATE-----\\nline\\n-----END CERTIFICATE-----'), '-----BEGIN CERTIFICATE-----\nline\n-----END CERTIFICATE-----');
  const client = new SicrediPixClient({ certificate: 'cert\\nline', privateKey: 'key\\nline' });
  assert.equal(client.certificate, 'cert\nline');
  assert.equal(client.privateKey, 'key\nline');
});

test('Sicredi webhook registration accepts HTTPS only and uses the configured Pix key', async () => {
  const requests = [];
  const client = new SicrediPixClient({ clientId: 'id', clientSecret: 'secret', certificate: 'cert', privateKey: 'key', pixKey: 'pix', request: async (url, options) => {
    requests.push({ url, options });
    if (url.includes('/oauth/token')) return { access_token: 'token', expires_in: 3600 };
    return {};
  } });
  await client.registerWebhook('https://conflora.example/webhooks/sicredi-pix/secret');
  assert.ok(requests[1].url.endsWith('/api/v2/webhook/pix'));
  assert.equal(requests[1].options.method, 'PUT');
  assert.deepEqual(JSON.parse(requests[1].options.body), { webhookUrl: 'https://conflora.example/webhooks/sicredi-pix/secret' });
  await assert.rejects(client.registerWebhook('http://conflora.example/webhook'), /HTTPS/);
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

test('Sicredi callback secret route authenticates before it accepts bank events', async (t) => {
  const originalSecret = process.env.SICREDI_WEBHOOK_SECRET;
  process.env.SICREDI_WEBHOOK_SECRET = 'a'.repeat(48);
  t.after(() => {
    if (originalSecret === undefined) delete process.env.SICREDI_WEBHOOK_SECRET;
    else process.env.SICREDI_WEBHOOK_SECRET = originalSecret;
  });
  const s = setup();
  const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const payload = JSON.stringify({ pix: [] });
  const valid = await fetch(`${base}/webhooks/sicredi-pix/${process.env.SICREDI_WEBHOOK_SECRET}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
  assert.equal(valid.status, 200);
  const invalid = await fetch(`${base}/webhooks/sicredi-pix/${'b'.repeat(48)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
  assert.equal(invalid.status, 401);
});

test('HTTP sale flow sends fixed Pix receipt and QR, confirms by Sicredi webhook once, and preserves seller/cashier attribution', async (t) => {
  const originalSecret = process.env.SICREDI_WEBHOOK_SECRET;
  process.env.SICREDI_WEBHOOK_SECRET = 'c'.repeat(48);
  t.after(() => {
    if (originalSecret === undefined) delete process.env.SICREDI_WEBHOOK_SECRET;
    else process.env.SICREDI_WEBHOOK_SECRET = originalSecret;
  });
  const s = setup();
  await s.base.saveUser(seller);
  await s.base.saveUser(cashier);
  const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '') => fetch(base + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body),
  });
  const login = async (user) => {
    const response = await post('/api/admin/auth/login', { userId: user.id, pin: user.pin });
    assert.equal(response.status, 200);
    return response.headers.get('set-cookie').split(';')[0];
  };
  const sellerCookie = await login(seller);
  const cashierCookie = await login(cashier);
  const pixResponse = await post('/api/caixa/orders', {
    requestId: randomUUID(), items: [{ productId: 'plant', quantity: 2 }], paymentMethod: 'PIX',
    customerId: 'customer', customerPhone: '5564999991234',
  }, sellerCookie);
  assert.equal(pixResponse.status, 200);
  const pixBody = await pixResponse.json();
  const pixOrder = pixBody.order;
  assert.equal(pixOrder.status, 'AWAITING_PIX');
  assert.equal(pixOrder.paymentStatus, 'PENDING');
  assert.equal(pixBody.receiptDelivery.sent, true);
  assert.match(pixOrder.receiptText, /Valor exato: \*R\$\s20,00\* \(Sem alteração de valor\)/);
  assert.match(pixOrder.receiptText, /pix-code/);
  assert.match(pixOrder.qrCodeBase64, /^data:image\/png;base64,/);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);

  const endToEndId = 'E' + '2'.repeat(31);
  s.pix.checkReceivedPayment = async () => ({ isPaid: true, raw: {
    txid: pixOrder.pixData.txid, endToEndId, chave: 'pix-key', valor: '20.00', devolucoes: [],
  } });
  const webhookPath = `/webhooks/sicredi-pix/${process.env.SICREDI_WEBHOOK_SECRET}`;
  const webhookBody = { pix: [{ txid: pixOrder.pixData.txid, endToEndId }] };
  const webhookResults = await Promise.all([
    post(webhookPath, webhookBody), post(webhookPath, webhookBody),
  ]);
  assert.deepEqual(webhookResults.map((response) => response.status), [200, 200]);
  const paidPix = await app.locals.pdv.store.read('orders', pixOrder.id);
  assert.equal(paidPix.status, 'CONFIRMED');
  assert.equal(paidPix.paymentStatus, 'APPROVED');
  assert.equal(paidPix.verifiedVia, 'SICREDI_PIX_WEBHOOK');
  assert.equal(paidPix.paymentTransactionId, endToEndId);
  assert.equal(paidPix.createdBy.id, seller.id);
  assert.equal(paidPix.receivedBy.id, seller.id);
  assert.ok(paidPix.paidAt);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal((await app.locals.pdv.store.read('stock_movements', `${pixOrder.id}-plant`)).quantityDeducted, 2);
  assert.equal((await app.locals.pdv.store.read('pdv_pix_events', `${pixOrder.pixData.txid}-${endToEndId}`)).status, 'DONE');
  assert.equal(s.sent.filter((message) => message.text?.includes('PIX CONFIRMADO')).length, 1);
  const finalCustomerReceipt = s.sent.find((message) => message.phone === pixOrder.customerPhone && message.text?.includes('Pago e finalizado'));
  assert.ok(finalCustomerReceipt, 'cliente recebe o comprovante completo após a confirmação do Pix');
  assert.match(finalCustomerReceipt.text, /Muda/);
  assert.match(finalCustomerReceipt.text, /R\$\s20,00/);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const sellerBoardResponse = await fetch(`${base}/api/caixa/orders?from=${today}&to=${today}`, { headers: { cookie: sellerCookie } });
  const sellerBoard = await sellerBoardResponse.json();
  assert.ok(sellerBoard.paid.some((order) => order.id === pixOrder.id));
  assert.equal(sellerBoard.metrics.sales, 20);
  const cashierBoardResponse = await fetch(`${base}/api/caixa/orders?from=${today}&to=${today}`, { headers: { cookie: cashierCookie } });
  const cashierBoard = await cashierBoardResponse.json();
  assert.equal(cashierBoard.closing.totalReceived, 0);

  const cashOrderResponse = await post('/api/caixa/orders', {
    requestId: randomUUID(), items: [{ productId: 'plant', quantity: 1 }], paymentMethod: 'DEBITO',
    customerId: 'customer', customerPhone: '5564999991234',
  }, sellerCookie);
  assert.equal(cashOrderResponse.status, 200);
  const cashOrder = (await cashOrderResponse.json()).order;
  assert.equal(cashOrder.status, 'AWAITING_CASHIER');
  const receive = () => post(`/api/caixa/orders/${cashOrder.id}/confirm`, {}, cashierCookie);
  const received = await receive();
  assert.equal(received.status, 200);
  const confirmed = await received.json();
  assert.equal(confirmed.order.createdBy.id, seller.id);
  assert.equal(confirmed.order.receivedBy.id, cashier.id);
  assert.equal(confirmed.order.paymentStatus, 'APPROVED');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 17);
  const duplicateReceive = await receive();
  assert.equal((await duplicateReceive.json()).order.alreadyConfirmed, true);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 17);
});

test('cashier can manually confirm a Pix only after recording proof review; audit and stock are atomic', async (t) => {
  const s = setup();
  await s.base.saveUser(seller);
  await s.base.saveUser(cashier);
  const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = async (user) => {
    const response = await fetch(base + '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, pin: user.pin }) });
    return response.headers.get('set-cookie').split(';')[0];
  };
  const sellerCookie = await login(seller);
  const cashierCookie = await login(cashier);
  const order = await app.locals.pdv.service.create({ ...s.input, paymentMethod: 'PIX' }, seller);
  const post = (body) => fetch(`${base}/api/caixa/orders/${order.id}/confirm-manual-pix`, {
    method: 'POST', headers: { cookie: cashierCookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await post({ proofSeen: true, note: 'Comprovante conferido no caixa' })).status, 200);
  const saved = await s.base.getOrderById(order.id);
  assert.equal(saved.paymentStatus, 'APPROVED');
  assert.equal(saved.verifiedVia, 'MANUAL_CAIXA_PIX');
  assert.equal(saved.manualPixConfirmedBy.id, cashier.id);
  assert.equal(saved.receivedBy.id, cashier.id);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  const duplicate = await post({ proofSeen: true, note: 'Comprovante conferido no caixa' });
  assert.equal(duplicate.status, 400);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  const sellerAttempt = await fetch(`${base}/api/caixa/orders/${order.id}/confirm-manual-pix`, {
    method: 'POST', headers: { cookie: sellerCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ proofSeen: true, note: 'Comprovante conferido no caixa' }),
  });
  assert.equal(sellerAttempt.status, 403);
});

test('cashier order stream emits a change immediately after a new command is created', async (t) => {
  const s = setup();
  await s.base.saveUser(seller);
  await s.base.saveUser(cashier);
  const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(base + '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: cashier.id, pin: cashier.pin }) });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const stream = await fetch(`${base}/api/caixa/orders/stream`, { headers: { cookie } });
  assert.equal(stream.status, 200);
  assert.match(stream.headers.get('content-type'), /text\/event-stream/);
  const reader = stream.body.getReader();
  await reader.read();
  const order = await app.locals.pdv.service.create({ ...s.input }, seller);
  const event = await Promise.race([
    reader.read(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Comanda não apareceu no stream em tempo hábil.')), 5000)),
  ]);
  assert.match(new TextDecoder().decode(event.value), new RegExp(order.id));
  await reader.cancel();
});

test('Cashier board filters history, separates pending stages, and calculates closing totals', async (t) => {
  const s = setup();
  await s.base.saveUser(seller);
  await s.base.saveUser(cashier);
  await s.base.saveUser(secondCashier);
  const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = async (user) => {
    const response = await fetch(base + '/api/admin/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, pin: user.pin }) });
    return response.headers.get('set-cookie').split(';')[0];
  };
  const cashierCookie = await login(cashier);
  const secondCashierCookie = await login(secondCashier);
  const pdv = app.locals.pdv;
  const createOrder = (paymentMethod, overrides = {}) => pdv.service.create({ requestId: randomUUID(), items: [{ productId: 'plant', quantity: 2 }], paymentMethod, ...overrides }, seller);
  const awaitingCash = await createOrder('DEBITO');
  const paidOrder = await createOrder('DINHEIRO');
  await pdv.store.receive(paidOrder.id, actor(cashier));
  const onAccount = await createOrder('FIADO', { customerId: 'customer' });
  await pdv.store.receive(onAccount.id, actor(cashier));
  await pdv.store.settle({ id: randomUUID(), customerKey: 'customer', amount: 5, paymentMethod: 'DINHEIRO', notes: '', receivedBy: actor(cashier) });
  const pixOrder = await createOrder('PIX');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const response = await fetch(`${base}/api/caixa/orders?from=${today}&to=${today}`, { headers: { cookie: cashierCookie } });
  assert.equal(response.status, 200);
  const board = await response.json();
  assert.deepEqual(board.pendingConfirmation.map((order) => order.id), [awaitingCash.id]);
  assert.deepEqual(board.pendingPayment.map((order) => order.id), [pixOrder.id]);
  assert.deepEqual(board.confirmed.map((order) => order.id), [onAccount.id]);
  assert.deepEqual(board.paid.map((order) => order.id), [paidOrder.id]);
  assert.equal(board.closing.salesReceived, 20);
  assert.equal(board.closing.debtReceived, 5);
  assert.equal(board.closing.totalReceived, 25);
  assert.equal(board.closing.confirmedDebt, 20);
  assert.equal(board.closing.byPayment.DINHEIRO.sales, 20);
  assert.equal(board.closing.byPayment.DINHEIRO.debt, 5);

  const secondCashierResponse = await fetch(`${base}/api/caixa/orders?from=${today}&to=${today}`, { headers: { cookie: secondCashierCookie } });
  assert.equal(secondCashierResponse.status, 200);
  const secondCashierBoard = await secondCashierResponse.json();
  assert.deepEqual(secondCashierBoard.pendingConfirmation.map((order) => order.id), [awaitingCash.id]);
  assert.deepEqual(secondCashierBoard.pendingPayment.map((order) => order.id), [pixOrder.id]);
  assert.deepEqual(secondCashierBoard.history, []);
  assert.equal(secondCashierBoard.closing.totalReceived, 0);

  await pdv.store.receive(awaitingCash.id, actor(secondCashier));
  const refreshedSecondCashierResponse = await fetch(`${base}/api/caixa/orders?from=${today}&to=${today}`, { headers: { cookie: secondCashierCookie } });
  const refreshedSecondCashierBoard = await refreshedSecondCashierResponse.json();
  assert.deepEqual(refreshedSecondCashierBoard.pendingConfirmation, []);
  assert.deepEqual(refreshedSecondCashierBoard.history.map((order) => order.id), [awaitingCash.id]);
  assert.equal(refreshedSecondCashierBoard.closing.salesReceived, 20);

  const sellerCookie = await login(seller);
  const sellerBoardResponse = await fetch(`${base}/api/caixa/orders?from=${today}&to=${today}`, { headers: { cookie: sellerCookie } });
  const sellerBoard = await sellerBoardResponse.json();
  assert.deepEqual(sellerBoard.pendingPayment.map((order) => order.id), [pixOrder.id]);
  const receivedByAnotherCashier = await fetch(`${base}/api/caixa/orders/${awaitingCash.id}`, { headers: { cookie: cashierCookie } });
  assert.equal(receivedByAnotherCashier.status, 400);
  const receivedOrder = await fetch(`${base}/api/caixa/orders/${awaitingCash.id}`, { headers: { cookie: secondCashierCookie } });
  assert.equal(receivedOrder.status, 200);
  assert.equal((await receivedOrder.json()).receivedBy.id, secondCashier.id);

  const invalidRange = await fetch(`${base}/api/caixa/orders?from=2026-02-31&to=2026-03-01`, { headers: { cookie: cashierCookie } });
  assert.equal(invalidRange.status, 400);
});
