process.env.NODE_ENV = 'test';
process.env.OWNER_WHATSAPP_NUMBER = '5564999994321';
const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { TextDecoder } = require('node:util');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { PdvService } = require('../src/orders/pdv.service');
const { SicrediPixClient, normalizePem } = require('../src/integrations/sicredi-pix.client');
const { createApp } = require('../src/http/app');

const seller = { id: 'seller', name: 'Vendedor', email: 'vendedor@conflora.test', role: 'VENDEDOR', pin: '4321' };
const cashier = { id: 'cashier', name: 'Caixa', email: 'caixa@conflora.test', role: 'CAIXA', pin: '1234' };
const secondCashier = { id: 'cashier-2', name: 'Outro Caixa', email: 'caixa2@conflora.test', role: 'CAIXA', pin: '5678' };
const actor = ({ id, name, email, role }) => ({ id, name, email, role });

const proofData = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\nComprovante de teste\n%%EOF').toString('base64');
async function uploadProof(base, cookie, targetId, targetType = 'ORDER') {
  const response = await fetch(base + '/api/caixa/payment-proofs', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ targetType, targetId, dataUrl: proofData, fileName: 'comprovante.pdf' }) });
  assert.equal(response.status, 201); return (await response.json()).id;
}
async function seedProof(repository, targetId, targetType = 'ORDER') {
  const id = randomUUID();
  await repository.transaction(async (tx) => tx.set('payment_proofs', id, { id, targetId, targetType, uploadedBy: cashier.id, fileName: 'comprovante.pdf', contentType: 'application/pdf', size: 35 }));
  return id;
}

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

test('deferred Pix creates only a command; mixed receipts allocate amounts, debt and stock once', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, paymentMethod: 'PIX', deferToCashier: true }, cashier);
  assert.equal(order.status, 'AWAITING_PAYMENT');
  assert.equal(order.pixData, null);
  assert.equal(s.chargeCalls.length, 0);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
  const parts = [{ method: 'DINHEIRO', amount: 5 }, { method: 'CREDITO', amount: 10 }, { method: 'FIADO', amount: 5 }];
  const mixed = await s.service.create({ ...s.input, requestId: randomUUID(), customerId: 'customer', paymentParts: parts }, cashier);
  assert.equal(mixed.paymentMethod, 'MISTO');
  assert.equal(mixed.paymentStatus, 'ON_ACCOUNT');
  assert.equal(s.base.inMemoryCustomers.get('customer').debtBalance, 5);
  assert.equal(mixed.paymentParts.length, 3);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  await s.repository.receive(mixed.id, actor(cashier));
  assert.equal(s.base.inMemoryCustomers.get('customer').debtBalance, 5);
  await assert.rejects(s.service.create({ ...s.input, requestId: randomUUID(), paymentParts: [{ method: 'DINHEIRO', amount: 1 }] }, cashier), /soma/);
});

test('mixed Pix charges only the Pix share and finalizes the full sale after bank verification', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, paymentParts: [{ method: 'DINHEIRO', amount: 8 }, { method: 'PIX', amount: 12 }] }, cashier);
  assert.equal(s.chargeCalls[0].amount, 12);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
  s.pix.checkReceivedPayment = async (endToEndId) => ({ isPaid: true, raw: { txid: order.pixData.txid, endToEndId, chave: 'pix-key', valor: '12.00' } });
  await s.service.handlePix(order.pixData.txid, 'E' + '2'.repeat(31));
  assert.equal((await s.repository.read('orders', order.id)).paymentStatus, 'APPROVED');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
});

test('expiration scheduling failure releases the reservation and preserves cash already received', async () => {
  const s = setup();
  s.service.taskQueueClient = { enqueuePixExpiration: async () => { throw new Error('Fila indisponível'); } };
  const input = { ...s.input, paymentParts: [
    { method: 'DINHEIRO', amount: 8 }, { method: 'PIX', amount: 12 },
  ] };
  await assert.rejects(s.service.create(input, cashier), /Fila indisponível/);
  const order = await s.repository.read('orders', s.input.requestId);
  assert.equal(order.status, 'CANCELLED');
  assert.equal(order.paymentStatus, 'PARTIAL_RECONCILIATION');
  assert.equal(order.refundDue, 8);
  assert.equal(order.requiresRefund, true);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 0);
  assert.equal(s.chargeCalls.length, 0);
  s.service.taskQueueClient = { enqueuePixExpiration: async () => ({ name: 'task-recovered' }) };
  await assert.rejects(s.service.create(input, cashier), /cancelada/);
  assert.equal(s.chargeCalls.length, 0);
});

test('confirmed web Pix recovers missing notification intents without staff fields or duplicate sends', async () => {
  const s = setup();
  const txid = 'A'.repeat(32);
  const endToEndId = 'E' + '1'.repeat(31);
  const order = await s.base.createDirectOrder({
    id: randomUUID(), ticketNumber: 'WEB-RECOVERY', source: 'WEB_CATALOG', status: 'CONFIRMED',
    paymentMethod: 'PIX', paymentStatus: 'APPROVED', verifiedVia: 'SICREDI_PIX_WEBHOOK',
    paymentTransactionId: endToEndId, completedAt: new Date().toISOString(),
    customerName: 'Cliente Online', customerPhone: '5564999991234', total: 20,
    pixData: { txid }, items: [{ productId: 'plant', name: 'Muda', quantity: 2, price: 10 }],
  });
  await s.service.handlePix(txid, endToEndId);
  assert.equal(s.sent.length, 2);
  assert.match(s.sent[1].text, /Sicredi · confirmação automática/);
  assert.equal((await s.repository.read('pdv_outbox', `${order.id}-owner-paid`)).status, 'SENT');
  await s.service.handlePix(txid, endToEndId);
  assert.equal(s.sent.length, 2);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
});

test('customer debt Pix applies once, validates Sicredi, isolates accounts and preserves concurrent surplus as credit', async () => {
  const s = setup();
  const { CustomerDebtPixService } = require('../src/orders/customer-debt-pix.service');
  const user = { id: 'client-login', email: 'client@example.com', name: 'Cliente' };
  Object.assign(s.base.inMemoryCustomers.get('customer'), { email: user.email, debtBalance: 20 });
  const service = new CustomerDebtPixService({ store: s.repository, pix: s.pix, pdv: s.service });
  s.service.debtPix = service;
  const charge = await service.create({ requestId: randomUUID(), amount: 20 }, user);
  await assert.rejects(service.read(charge.id, { id: 'other', email: user.email }), /não encontrada/);
  s.base.inMemoryCustomers.get('customer').debtBalance = 5;
  s.pix.checkReceivedPayment = async (endToEndId) => ({ isPaid: true, raw: { txid: charge.txid, endToEndId, chave: 'wrong', valor: '20' } });
  await assert.rejects(s.service.handlePix(charge.txid, 'E' + '3'.repeat(31)), /divergente/);
  assert.equal(s.base.inMemoryCustomers.get('customer').debtBalance, 5);
  s.pix.checkReceivedPayment = async (endToEndId) => ({ isPaid: true, raw: { txid: charge.txid, endToEndId, chave: 'pix-key', valor: '20' } });
  await Promise.all([s.service.handlePix(charge.txid, 'E' + '3'.repeat(31)), s.service.handlePix(charge.txid, 'E' + '3'.repeat(31))]);
  assert.equal(s.base.inMemoryCustomers.get('customer').debtBalance, 0);
  assert.equal(s.base.inMemoryCustomers.get('customer').creditBalance, 15);
  assert.equal(s.base.inMemoryDebtSettlements.length, 1);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
  assert.equal(s.sent.length, 2);
});

test('HTTP autonomous debt payment updates the logged-in customer through the official webhook only', async (t) => {
  const s = setup();
  const previous = process.env.SICREDI_WEBHOOK_SECRET;
  const secret = 'debt-pix-test-secret-01234567890123456789';
  process.env.SICREDI_WEBHOOK_SECRET = secret;
  t.after(() => { if (previous === undefined) delete process.env.SICREDI_WEBHOOK_SECRET; else process.env.SICREDI_WEBHOOK_SECRET = previous; });
  const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '') => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
  assert.equal((await post('/api/customer/debt-pix', { amount: 20 })).status, 401);
  await post('/api/auth/register', { email: 'debt@test.com', name: 'Cliente dívida', password: 'senha123' });
  const login = await post('/api/auth/login', { email: 'debt@test.com', password: 'senha123' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  Object.assign(s.base.inMemoryCustomers.get('customer'), { email: 'debt@test.com', debtBalance: 20 });
  const response = await post('/api/customer/debt-pix', { requestId: randomUUID(), amount: 20, customerKey: 'forged-customer' }, cookie);
  const { charge } = await response.json();
  assert.ok(charge?.pixData);
  assert.equal(charge.customerKey, 'customer');
  assert.equal(s.base.inMemoryCustomers.get('customer').debtBalance, 20);
  const endToEndId = 'E' + '4'.repeat(31);
  s.pix.checkReceivedPayment = async () => ({ isPaid: true, raw: { txid: charge.txid, endToEndId, chave: 'pix-key', valor: '20' } });
  assert.equal((await post('/webhooks/sicredi-pix', { pix: [{ txid: charge.txid, endToEndId }] })).status, 401);
  const webhook = () => post('/webhooks/sicredi-pix/' + secret + '/pix', { pix: [{ txid: charge.txid, endToEndId }] });
  assert.equal((await webhook()).status, 200);
  assert.equal((await webhook()).status, 200);
  const ledger = await (await fetch(base + '/api/customer/ledger', { headers: { cookie } })).json();
  assert.equal(ledger.balance, 0);
  assert.equal(ledger.transactions.length, 1);
  assert.equal(ledger.transactions[0].paymentMethod, 'PIX');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
});

test('seller creates a pending order; cashier receives once and attribution survives', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, sellerName: 'Forged', receivedBy: actor(cashier) }, seller);
  assert.equal(order.status, 'AWAITING_PAYMENT');
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

test('Firestore permission failure never accepts a financial write in process memory', async () => {
  const s = setup();
  s.base.firestore = { runTransaction: async () => {
    throw Object.assign(new Error('PERMISSION_DENIED'), { code: 7 });
  } };
  await assert.rejects(s.repository.transaction(async (tx) => {
    const product = await tx.get('products', 'plant');
    tx.set('products', 'plant', { ...product, stockQuantity: 0 });
  }), /PERMISSION_DENIED/);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
});

test('Pix receipt includes image; bank verification finalizes exactly once under repeated webhooks', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, paymentMethod: 'PIX', customerId: 'customer' }, seller);
  assert.equal(s.sent.length, 2);
  assert.match(s.sent[0].text, /CONFLORA \| HORTA E VIVEIRO/);
  assert.match(s.sent[0].text, /Aguardamos a confirmação do pagamento via Pix/);
  assert.match(s.sent[1].caption, /PIX COPIA E COLA:\npix-code/);
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
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 2);

  const pixOrder = await s.repository.requestPixAtCashier(order.id, actor(cashier));
  assert.equal(pixOrder.inventoryReserved, true);
  assert.ok(pixOrder.pixExpiresAt);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 2);

  const competing = await s.service.create({ ...s.input, requestId: randomUUID(), items: [{ productId: 'plant', quantity: 18 }] }, seller);
  await s.repository.receive(competing.id, actor(cashier));
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 2);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 2);

  const verified = { txid: pixOrder.pixData.txid, amountMinor: 2000, verifiedVia: 'MANUAL_CAIXA_PIX',
    manualPixProofId: await seedProof(s.repository, order.id), manualPixProofSeen: true, manualPixNote: 'Comprovante conferido', endToEndId: '' };
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
  assert.equal(documents.get('orders/' + order.id).status, 'AWAITING_PAYMENT');
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
  assert.equal(cashOrder.status, 'AWAITING_PAYMENT');
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
  assert.equal((await post({ proofSeen: true, note: 'Comprovante conferido no caixa' })).status, 400);
  const proofId = await uploadProof(base, cashierCookie, order.id);
  assert.equal((await post({ proofSeen: true, proofId, note: 'Comprovante conferido no caixa' })).status, 200);
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

test('manual mixed Pix uses the Pix installment and concurrent confirmations send one receipt', async (t) => {
  const s = setup();
  const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(base + '/api/admin/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: cashier.id, pin: cashier.pin }),
  });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const order = await app.locals.pdv.service.create({ ...s.input, customerId: 'customer',
    paymentParts: [{ method: 'DINHEIRO', amount: 8 }, { method: 'PIX', amount: 12 }],
  }, cashier);
  const proofId = await uploadProof(base, cookie, order.id);
  const sentBefore = s.sent.length;
  const receive = app.locals.pdv.store.receive.bind(app.locals.pdv.store);
  let release;
  const bothRequestsReadPending = new Promise((resolve) => { release = resolve; });
  let attempts = 0;
  app.locals.pdv.store.receive = async (...args) => {
    if (++attempts === 2) release();
    await bothRequestsReadPending;
    return receive(...args);
  };
  const confirm = () => fetch(`${base}/api/caixa/orders/${order.id}/confirm-manual-pix`, {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ proofSeen: true, proofId, note: 'Comprovante da parcela de doze reais' }),
  });
  const responses = await Promise.all([confirm(), confirm()]);
  for (const response of responses) assert.equal(response.status, 200);
  const saved = await s.base.getOrderById(order.id);
  assert.equal(saved.paymentVerifiedAmount, 12);
  assert.equal(saved.paymentStatus, 'APPROVED');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 0);
  assert.equal(s.sent.length - sentBefore, 2);
  const receipt = require('../src/orders/receipt.util').formatOrderReceipt(saved);
  assert.match(receipt, /Pix conferido manualmente/);
  assert.doesNotMatch(receipt, /Sicredi Pix Automático/);
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
  assert.deepEqual(board.pendingConfirmation, []);
  assert.deepEqual(board.pendingPayment.map((order) => order.id).sort(), [awaitingCash.id, pixOrder.id].sort());
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
  assert.deepEqual(secondCashierBoard.pendingConfirmation, []);
  assert.deepEqual(secondCashierBoard.pendingPayment.map((order) => order.id).sort(), [awaitingCash.id, pixOrder.id].sort());
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

test('command progression holds inventory atomically, final payment deducts once, expiry releases only the hold', async () => {
  const s = setup();
  const order = await s.service.create({ ...s.input, deferToCashier: true }, seller);
  assert.equal(order.status, 'AWAITING_PAYMENT');
  await s.repository.transaction(async (tx) => { const row = await tx.get('orders', order.id); tx.set('orders', order.id, { ...row, status: 'AWAITING_CONFIRMATION' }); });
  await assert.rejects(s.repository.advanceToPayment(order.id, actor(seller)), /Caixa/);
  const [pending] = await Promise.all([s.repository.advanceToPayment(order.id, actor(cashier)), s.repository.advanceToPayment(order.id, actor(cashier))]);
  assert.equal(pending.status, 'AWAITING_PAYMENT');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 2);
  const paid = await s.repository.receive(order.id, actor(cashier), null, 20, 'DINHEIRO');
  assert.equal(paid.paymentStatus, 'APPROVED');
  await s.repository.receive(order.id, actor(cashier));
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 0);
  await assert.rejects(s.repository.advanceToPayment(order.id, actor(cashier)), /Só é possível/);
  const next = await s.service.create({ ...s.input, requestId: randomUUID(), deferToCashier: true }, seller);
  await s.repository.advanceToPayment(next.id, actor(cashier));
  await s.repository.transaction(async (tx) => { const row = await tx.get('orders', next.id); tx.set('orders', next.id, { ...row, paymentExpiresAt: new Date(Date.now() - 1000).toISOString() }); });
  await assert.rejects(s.repository.receive(next.id, actor(cashier)), /prazo/);
  await assert.rejects(s.repository.requestPixAtCashier(next.id, actor(cashier)), /prazo/);
  await s.service.expirePixOrder(next.id);
  assert.equal((await s.repository.read('orders', next.id)).status, 'CANCELLED');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 0);
});

test('debt accepts successive and mixed receipts without changing stock or duplicating payment', async () => {
  const s = setup(); s.base.inMemoryCustomers.get('customer').debtBalance = 200;
  const first = { id: randomUUID(), customerKey: 'customer', amount: 100, paymentMethod: 'DINHEIRO', receivedBy: actor(cashier) };
  assert.equal((await s.repository.settle(first)).newBalance, 100);
  assert.equal((await s.repository.settle(first)).newBalance, 100);
  const remainder = { id: randomUUID(), customerKey: 'customer', amount: 100, paymentParts: [{ method: 'DEBITO', amount: 40 }, { method: 'PIX', amount: 60 }], receivedBy: actor(cashier), verification: { manualPixProofSeen: true, manualPixNote: 'Transferência conferida na conta' } };
  remainder.verification.manualPixProofId = await seedProof(s.repository, remainder.id, 'DEBT');
  const settled = await s.repository.settle(remainder);
  assert.equal(settled.newBalance, 0); assert.equal(settled.paymentMethod, 'MISTO');
  await s.repository.settle(remainder);
  await assert.rejects(s.repository.settle({ ...first, id: randomUUID() }), /maior que a dívida/);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
});

test('HTTP restricts board moves and manually receives direct Pix without creating a bank charge', async (t) => {
  const s = setup(); const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '') => fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
  const login = async (user) => (await post('/api/admin/auth/login', { userId: user.id, pin: user.pin })).headers.get('set-cookie').split(';')[0];
  const sellerCookie = await login(seller); const cookie = await login(cashier);
  const response = await post('/api/caixa/orders', { ...s.input, deferToCashier: true }, sellerCookie);
  const { order } = await response.json(); assert.ok(order?.id);
  assert.equal(order.status, 'AWAITING_PAYMENT');
  await app.locals.pdv.store.transaction(async (tx) => { const row = await tx.get('orders', order.id); tx.set('orders', order.id, { ...row, status: 'AWAITING_CONFIRMATION' }); });
  const move = `/api/caixa/orders/${order.id}/move`;
  assert.equal((await post(move, { from: 'confirmation', to: 'paid' }, cookie)).status, 400);
  assert.equal((await post(move, { from: 'confirmation', to: 'payment' }, sellerCookie)).status, 403);
  assert.equal((await post(move, { from: 'confirmation', to: 'payment' }, cookie)).status, 200);
  assert.equal((await post(move, { from: 'payment', to: 'confirmation' }, cookie)).status, 400);
  const drop = await (await post(move, { from: 'payment', to: 'paid' }, cookie)).json(); assert.equal(drop.requiresPayment, true);
  const confirm = `/api/caixa/orders/${order.id}/confirm`;
  assert.equal((await post(confirm, { paymentMethod: 'PIX_MANUAL' }, cookie)).status, 400);
  const proofId = await uploadProof(origin, cookie, order.id);
  const result = await post(confirm, { paymentMethod: 'PIX_MANUAL', proofSeen: true, proofId, note: 'Pix recebido na chave da loja' }, cookie);
  assert.equal(result.status, 200); const { order: paid } = await result.json();
  assert.equal(paid.paymentStatus, 'APPROVED'); assert.equal(paid.manualPixConfirmedBy.id, cashier.id);
  assert.equal(paid.paymentVerificationStopReason, 'MANUAL_CONFIRMATION'); assert.equal(s.chargeCalls.length, 0);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal((await post(move, { from: 'payment', to: 'paid' }, cookie)).status, 400);
});

test('manual confirmation stops subsequent Sicredi checks and fixes issued payment allocation', async () => {
  const s = setup(); const order = await s.service.create({ ...s.input, paymentParts: [{ method: 'DINHEIRO', amount: 8 }, { method: 'PIX', amount: 12 }] }, cashier);
  const verification = { manualPixProofId: await seedProof(s.repository, order.id), txid: order.pixData.txid, amountMinor: 1200, verifiedVia: 'MANUAL_CAIXA_PIX', manualPixProofSeen: true, manualPixNote: 'Comprovante conferido no caixa' };
  await assert.rejects(s.repository.receive(order.id, actor(cashier), { ...verification, amountMinor: 1100 }, null, null, { requestedParts: [{ method: 'DINHEIRO', amount: 9 }, { method: 'PIX', amount: 11 }] }), /parcelas/);
  await s.repository.receive(order.id, actor(cashier), verification);
  let checks = 0; s.pix.checkReceivedPayment = async () => { checks++; throw new Error('Não consultar após confirmação manual'); };
  await s.service.handlePix(order.pixData.txid, 'E' + '7'.repeat(31));
  assert.equal(checks, 0); assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 0);
});


test('mixed debt receipts are allocated to actual payment methods in executive reports', () => {
  const { summarizeExecutivePeriod } = require('../src/reports/period-executive-metrics');
  const report = summarizeExecutivePeriod({ from: '2026-10-16', to: '2026-10-16', settlements: [{ amount: 100, entryType: 'QUITACAO_FIADO', createdAt: '2026-10-16T15:00:00Z', paymentMethod: 'MISTO', paymentParts: [{ method: 'DINHEIRO', amount: 40 }, { method: 'PIX', amount: 60 }] }] });
  assert.equal(report.current.byPayment.DINHEIRO.receipts, 40);
  assert.equal(report.current.byPayment.PIX.receipts, 60);
  assert.equal(report.current.totalCashIn, 100);
});


for (const orderType of ['PICKUP', 'DELIVERY']) {
  for (const paymentMethod of ['DINHEIRO', 'CREDITO']) {
    test(`seller ${orderType} ${paymentMethod}: choosing payment does not receive money or deduct stock`, async () => {
      const s = setup();
      const order = await s.service.create({ ...s.input, paymentMethod, orderType, customerName: 'Cliente Teste', customerPhone: '64999991234', deliveryAddress: 'Rua das Flores, 10, Centro, Mineiros GO' }, seller);
      assert.equal(order.status, 'AWAITING_PAYMENT'); assert.equal(order.paymentStatus, 'PENDING');
      assert.equal(order.completedAt, undefined); assert.equal(order.receivedBy, null);
      assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
      assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 2);
      assert.equal(s.chargeCalls.length, 0);
      const paid = await s.repository.receive(order.id, actor(cashier));
      assert.equal(paid.paymentStatus, 'APPROVED'); assert.ok(paid.completedAt);
      assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
      assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 0);
    });
  }
}

test('online pickup and delivery cash/card orders appear directly in payment queue without automatic confirmation', async (t) => {
  const s = setup(); const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close()); const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '') => fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie }, body: JSON.stringify(body) });
  const login = await post('/api/admin/auth/login', { userId: cashier.id, pin: cashier.pin });
  const cookie = login.headers.get('set-cookie').split(';')[0]; const ids = [];
  for (const orderType of ['PICKUP', 'DELIVERY']) {
    for (const paymentMethod of ['DINHEIRO', 'CARTAO']) {
      const response = await post('/api/orders', { customerName: 'Cliente online', customerPhone: '64999991234', orderType, paymentMethod, deliveryAddress: 'Rua Teste 10', items: [{ productId: 'plant', quantity: 1 }] });
      assert.equal(response.status, 200); const { order } = await response.json(); ids.push(order.id);
      assert.equal(order.status, 'AWAITING_PAYMENT'); assert.equal(order.paymentStatus, 'PENDING');
      assert.equal(order.completedAt, undefined); assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
    }
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const board = await (await fetch(`${origin}/api/caixa/orders?from=${today}&to=${today}`, { headers: { cookie } })).json();
  assert.deepEqual(board.pendingConfirmation, []);
  assert.deepEqual(board.pendingPayment.map((order) => order.id).sort(), ids.sort());
  assert.equal(s.chargeCalls.length, 0); assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 4);
  const response = await post(`/api/caixa/orders/${ids[0]}/confirm`, { paymentMethod: 'DINHEIRO', receivedAmount: 10 }, cookie);
  assert.equal(response.status, 200); assert.equal((await response.json()).order.paymentStatus, 'APPROVED');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 19);
});


test('manual Pix requires a stored proof bound to this order and cashier before any stock deduction', async () => {
  const s = setup(); const order = await s.service.create({ ...s.input, deferToCashier: true }, seller);
  const verification = { verifiedVia: 'MANUAL_CAIXA_PIX', amountMinor: 2000, manualPixProofSeen: true, manualPixNote: 'Comprovante conferido no banco' };
  await assert.rejects(s.repository.receive(order.id, actor(cashier), verification, null, 'PIX'), /Anexe obrigatoriamente/);
  verification.manualPixProofId = await seedProof(s.repository, randomUUID());
  await assert.rejects(s.repository.receive(order.id, actor(cashier), verification, null, 'PIX'), /Anexe obrigatoriamente/);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
  verification.manualPixProofId = await seedProof(s.repository, order.id);
  const paid = await s.repository.receive(order.id, actor(cashier), verification, null, 'PIX');
  assert.equal(paid.manualPixProofId, verification.manualPixProofId);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
});

test('payment proof upload validates content, protects files, and rejects seller uploads', async (t) => {
  const s = setup(); const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close()); const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '') => fetch(origin + path, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const login = async (user) => (await post('/api/admin/auth/login', { userId: user.id, pin: user.pin })).headers.get('set-cookie').split(';')[0];
  const cookie = await login(cashier); const sellerCookie = await login(seller);
  const order = await app.locals.pdv.service.create({ ...s.input, deferToCashier: true }, seller);
  const body = { targetType: 'ORDER', targetId: order.id, dataUrl: proofData, fileName: 'comprovante.pdf' };
  assert.equal((await post('/api/caixa/payment-proofs', body, sellerCookie)).status, 403);
  assert.equal((await post('/api/caixa/payment-proofs', { ...body, dataUrl: 'data:image/png;base64,' + Buffer.from('<html>fake</html>').toString('base64') }, cookie)).status, 400);
  const proofId = await uploadProof(origin, cookie, order.id);
  assert.equal((await fetch(origin + '/api/caixa/payment-proofs/' + proofId)).status, 401);
  const proof = await fetch(origin + '/api/caixa/payment-proofs/' + proofId, { headers: { cookie } });
  assert.equal(proof.status, 200); assert.equal(proof.headers.get('content-type'), 'application/pdf');
  assert.match(proof.headers.get('cache-control'), /no-store/);
  assert.match(await proof.text(), /%PDF/);
  const { decodeProof } = require('../src/orders/payment-proof');
  assert.throws(() => decodeProof('data:application/pdf;base64,' + Buffer.alloc(3 * 1024 * 1024 + 1, 65).toString('base64')), /inválido/);
});

test('delivery refuses incomplete customer information and allows optional CPF and email', async () => {
  const s = setup();
  for (const missing of ['customerName', 'customerPhone', 'deliveryAddress']) {
    const input = { ...s.input, requestId: randomUUID(), orderType: 'DELIVERY', customerName: 'Maria', customerPhone: '64999991234', deliveryAddress: 'Rua 10, 123, Centro, Mineiros GO', [missing]: '' };
    await assert.rejects(s.service.create(input, seller), /Entrega exige/);
  }
  assert.equal(s.base.inMemoryOrders.size, 0);
});

test('cashier customer selection keeps the existing record and email optional; delivery API rejects missing data', async (t) => {
  const s = setup(); const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close()); const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '') => fetch(origin + path, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const login = await post('/api/admin/auth/login', { userId: cashier.id, pin: cashier.pin }); const cookie = login.headers.get('set-cookie').split(';')[0];
  const created = await post('/api/caixa/customers', { name: 'Cliente sem email', phone: '64977771234', address: 'Rua 10, 20, Centro, Mineiros GO' }, cookie);
  assert.equal(created.status, 201); const { customer } = await created.json(); assert.equal(customer.email, '');
  const selected = await post('/api/caixa/customers', { customerId: customer.id, name: customer.name, phone: '64966661234', address: customer.address }, cookie);
  assert.equal(selected.status, 201); assert.equal((await selected.json()).customer.id, customer.id);
  assert.equal(s.base.inMemoryCustomers.size, 2);
  for (const missing of ['customerName', 'customerPhone', 'deliveryAddress']) {
    const data = { customerName: 'Cliente Web', customerPhone: '64999991234', deliveryAddress: 'Rua 10, 20, Centro, Mineiros GO', orderType: 'DELIVERY', paymentMethod: 'DINHEIRO', items: [{ productId: 'plant', quantity: 1 }], [missing]: '' };
    assert.equal((await post('/api/orders', data)).status, 400);
  }
  assert.equal(s.base.inMemoryOrders.size, 0);
  assert.equal((await fetch(origin + '/api/customer/profile')).status, 401);
});

test('delivery: dispatcher releases cash order, only one driver accepts and payment finishes stock once', async () => {
  const s = setup(); const driver = { id: 'driver', name: 'Entregador', role: 'ENTREGADOR' }; const other = { id: 'driver2', name: 'Outro', role: 'ENTREGADOR' };
  const order = await s.service.create({ ...s.input, orderType: 'DELIVERY', customerName: 'Maria', customerPhone: '64999991234', deliveryAddress: 'Rua 10, 20, Centro, Mineiros GO', deliveryLocation: { lat: -17.56, lng: -52.55, reference: 'Portão azul' } }, seller);
  assert.equal(order.deliveryStatus, 'PENDING_DISPATCH'); assert.equal((await s.service.listDeliveries(driver)).available.length, 0);
  await assert.rejects(s.repository.dispatchDelivery(order.id, driver), /Somente/);
  await s.repository.dispatchDelivery(order.id, actor(cashier));
  const attempts = await Promise.allSettled([s.service.assignDelivery(order.id, driver), s.service.assignDelivery(order.id, other)]);
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1);
  const assigned = await s.repository.read('orders', order.id); const winner = assigned.assignedDriver;
  assert.equal(assigned.deliveryStatus, 'OUT_FOR_DELIVERY');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 20);
  await assert.rejects(s.service.completeDelivery(order.id, winner), /recebimento/);
  await assert.rejects(s.repository.receive(order.id, winner.id === driver.id ? other : driver, null, 20, 'DINHEIRO', { finishDelivery: true }), /responsável/);
  const paid = await s.repository.receive(order.id, winner, null, 20, 'DINHEIRO', { finishDelivery: true });
  assert.equal(paid.deliveryStatus, 'DELIVERED'); assert.equal(paid.paymentStatus, 'APPROVED'); assert.equal(paid.receivedBy.id, winner.id); assert.equal(paid.deliveredBy.id, winner.id);
  await s.repository.receive(order.id, winner, null, 20, 'DINHEIRO', { finishDelivery: true });
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18); assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 0);
  assert.equal((await s.service.listDeliveries(winner)).completed.length, 1);
  assert.equal((await s.service.listDeliveries(winner.id === driver.id ? other : driver)).completed.length, 0);
});

test('delivery: verified prepaid Pix becomes available and delivery completion does not deduct stock again', async () => {
  const s = setup(); const driver = { id: 'driver', name: 'Entregador', role: 'ENTREGADOR' };
  const order = await s.service.create({ ...s.input, paymentMethod: 'PIX', orderType: 'DELIVERY', customerName: 'Maria', customerPhone: '64999991234', deliveryAddress: 'Rua 10, 20, Centro, Mineiros GO' }, seller);
  await assert.rejects(s.repository.dispatchDelivery(order.id, actor(cashier)), /Confirme o Pix/);
  s.pix.checkReceivedPayment = async (endToEndId) => ({ isPaid: true, raw: { txid: order.pixData.txid, endToEndId, chave: 'pix-key', valor: '20.00', devolucoes: [] } });
  await s.service.handlePix(order.pixData.txid, 'E' + '8'.repeat(31));
  assert.equal((await s.repository.read('orders', order.id)).deliveryStatus, 'PENDING_DELIVERY');
  await s.service.assignDelivery(order.id, driver);
  const result = await s.service.completeDelivery(order.id, driver);
  assert.equal(result.order.deliveryStatus, 'DELIVERED');
  await s.service.completeDelivery(order.id, driver);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  assert.equal(s.sent.filter((message) => message.text?.includes('saiu para entrega')).length, 1);
});

test('delivery HTTP isolates drivers, permits assigned payment with proof and denies other orders', async (t) => {
  const s = setup(); const driver = { id: 'driver', name: 'Motorista', role: 'ENTREGADOR', active: true, pin: '1212' }; const other = { id: 'other-driver', name: 'Outro motorista', role: 'ENTREGADOR', active: true, pin: '3434' };
  s.base.inMemoryUsers.set(driver.id, driver); s.base.inMemoryUsers.set(other.id, other);
  const app = createApp({ messageService: { firestoreRepo: s.base, whatsappClient: s.whatsapp }, sicrediClient: s.pix });
  const server = app.listen(0); t.after(() => server.close()); const origin = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, cookie = '') => fetch(origin + path, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const login = async (user) => (await post('/api/admin/auth/login', { userId: user.id, pin: user.pin })).headers.get('set-cookie').split(';')[0];
  const cookie = await login(driver); const otherCookie = await login(other); const cashierCookie = await login(cashier);
  for (const path of ['/api/caixa/products', '/api/caixa/orders', '/api/caixa/customers', '/api/admin/orders']) assert.equal((await fetch(origin + path, { headers: { cookie } })).status, 403);
  const order = await app.locals.pdv.service.create({ ...s.input, orderType: 'DELIVERY', customerName: 'Maria', customerPhone: '64999991234', deliveryAddress: 'Rua 10, 20, Centro, Mineiros GO' }, seller);
  const base = '/api/caixa/deliveries/' + order.id;
  assert.equal((await post(base + '/dispatch', {}, cookie)).status, 403);
  assert.equal((await post(base + '/dispatch', {}, cashierCookie)).status, 200);
  assert.equal((await post(base + '/accept', {}, cookie)).status, 200);
  assert.equal((await post(base + '/accept', {}, otherCookie)).status, 400);
  assert.equal((await post(base + '/complete', {}, cookie)).status, 400);
  assert.equal((await post(base + '/receive', { paymentMethod: 'PIX_MANUAL', proofSeen: true, note: 'Pix conferido na entrega' }, cookie)).status, 400);
  const proofId = await uploadProof(origin, cookie, order.id);
  assert.equal((await post(base + '/receive', { paymentMethod: 'PIX_MANUAL', proofSeen: true, note: 'Pix conferido na entrega', proofId }, otherCookie)).status, 400);
  const payment = await post(base + '/receive', { paymentMethod: 'PIX_MANUAL', proofSeen: true, note: 'Pix conferido na entrega', proofId }, cookie);
  assert.equal(payment.status, 200); const { order: paid } = await payment.json();
  assert.equal(paid.deliveredBy.id, driver.id); assert.equal(paid.manualPixProofId, proofId); assert.equal(paid.paymentStatus, 'APPROVED');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
});

test('delivery: mixed Pix at the door preserves reservation and bank confirmation still requires physical delivery', async () => {
  const s = setup(); const driver = { id: 'driver', name: 'Entregador', role: 'ENTREGADOR' };
  const order = await s.service.create({ ...s.input, orderType: 'DELIVERY', customerName: 'Maria', customerPhone: '64999991234', deliveryAddress: 'Rua 10, 20, Centro, Mineiros GO' }, seller);
  await s.repository.dispatchDelivery(order.id, actor(cashier)); await s.service.assignDelivery(order.id, driver);
  const pending = await s.service.requestPixAtCashier(order.id, driver, [{ method: 'DINHEIRO', amount: 8 }, { method: 'PIX', amount: 12 }]);
  assert.equal(s.chargeCalls[0].amount, 12); assert.equal(s.base.inMemoryProducts.get('plant').reservedQuantity, 2);
  s.pix.checkReceivedPayment = async (endToEndId) => ({ isPaid: true, raw: { txid: pending.pixData.txid, endToEndId, chave: 'pix-key', valor: '12.00', devolucoes: [] } });
  await s.service.handlePix(pending.pixData.txid, 'E' + '9'.repeat(31));
  const paid = await s.repository.read('orders', order.id);
  assert.equal(paid.paymentStatus, 'APPROVED'); assert.equal(paid.deliveryStatus, 'OUT_FOR_DELIVERY'); assert.equal(paid.receivedBy.id, driver.id);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
  await s.service.completeDelivery(order.id, driver); assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 18);
});

test('free sales permit cash, Pix and delivery without entries; activating stock blocks new zero-stock sales', async () => {
  const s = setup();
  await s.base.saveInventorySettings({ stockControlEnabled: false });
  s.base.inMemoryProducts.get('plant').stockQuantity = 0;
  const cash = await s.service.create({ ...s.input, requestId: randomUUID() }, cashier);
  assert.equal(cash.paymentStatus, 'APPROVED');
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 0);
  const pending = await s.service.create({ ...s.input, requestId: randomUUID(), deferToCashier: true }, cashier);
  assert.equal(pending.inventoryReserved, false);
  const pix = await s.service.requestPixAtCashier(pending.id, cashier);
  assert.equal(pix.inventoryReserved, false);
  s.pix.checkReceivedPayment = async (endToEndId) => ({ isPaid: true, raw: { txid: pix.pixData.txid, endToEndId, chave: 'pix-key', valor: '20.00' } });
  await s.service.handlePix(pix.pixData.txid, 'E' + '4'.repeat(31));
  const directPix = await s.service.create({ ...s.input, requestId: randomUUID(), paymentMethod: 'PIX' }, cashier);
  assert.equal(directPix.inventoryReserved, false);
  assert.equal(s.base.inMemoryProducts.get('plant').stockQuantity, 0);
  assert.equal(Number(s.base.inMemoryProducts.get('plant').reservedQuantity || 0), 0);
  const delivery = await s.service.create({ ...s.input, requestId: randomUUID(), deferToCashier: true, orderType: 'DELIVERY', customerName: 'Cliente', customerPhone: '64999991234', deliveryAddress: 'Rua das Flores, 20, Centro' }, cashier);
  const dispatched = await s.repository.dispatchDelivery(delivery.id, cashier);
  assert.equal(dispatched.inventoryReserved, false);
  await s.base.saveInventorySettings({ stockControlEnabled: true });
  await assert.rejects(s.service.create({ ...s.input, requestId: randomUUID(), paymentMethod: 'PIX' }, cashier), /Estoque disponível insuficiente/);
});
