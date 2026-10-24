const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { OrderIntakeService } = require('../src/services/order-intake.service');
const { PdvService } = require('../src/orders/pdv.service');
const { payableTotal } = require('../src/orders/procurement-payment');
const { summarizeDailyExecutiveMetrics } = require('../src/reports/daily-executive-metrics');
const { dispatch } = require('./helpers/in-process-http');
const phone = '5564999990001';
const cashier = { id: 'cashier', name: 'Caixa', role: 'CAIXA' };

async function fixture() {
  const repo = new FirestoreRepository({ isInMemory: true });
  require('./helpers/open-cashier-fixture').seedOpenCashier(repo, cashier);
  const now = () => new Date('2026-10-22T16:00:00Z');
  const intake = new OrderIntakeService(repo, { now, env: {} });
  const flow = intake.procurement;
  const handle = (message, messageId = randomUUID()) => intake.handle({ phone, message, messageId, customerName: 'Ana' });
  await handle('Quero 2 galinhas da angola');
  const saved = await handle('sim');
  const id = saved.requestId;
  const request = () => intake.store.read('agent_handoffs', id);
  const order = () => intake.store.read('orders', id);
  const quote = async (overrides = {}) => flow.quote(id, { version: (await request()).version,
    confirmed: true, commercializationAllowed: true, items: [{ unitPriceMinor: 4000, arrivalDate: '2026-11-05' }], ...overrides }, cashier);
  const accept = async () => { await quote(); await handle('sim'); };
  const deposit = async (overrides = {}) => flow.receiveDeposit(id, { version: (await request()).version, received: true, amountMinor: 4000, paymentMethod: 'DINHEIRO', ...overrides }, cashier);
  const arrive = async () => {
    repo.inMemoryProducts.set('galinha', { id: 'galinha', name: 'Galinha da angola', price: 45, status: 'ATIVO', stockQuantity: 10, reservedQuantity: 0, unit: 'UN' });
    return flow.arrive(id, { version: (await request()).version, confirmed: true, items: [{ productId: 'galinha' }] }, cashier);
  };
  return { repo, intake, flow, handle, id, request, order, quote, accept, deposit, arrive };
}

test('registration creates an unpaid unquoted comanda; quote requires every price/date and sends the 50/50 offer', async () => {
  const s = await fixture();
  assert.equal((await s.order()).status, 'AWAITING_QUOTE'); assert.equal((await s.order()).total, null);
  const quoted = await s.quote();
  assert.equal(quoted.totalMinor, 8000); assert.equal(quoted.depositRequiredMinor, 4000);
  assert.equal((await s.order()).status, 'AWAITING_QUOTE_ACCEPTANCE');
  const job = (await s.intake.store.list('pdv_outbox', 'event', 'quote'))[0];
  assert.match(job.text, /Encontramos.*encomenda/); assert.match(job.text, /80,00/); assert.match(job.text, /05\/11\/2026/);
  assert.match(job.text, /50%.*40,00 agora.*40,00 na retirada ou entrega.*confirmar/s);
  assert.equal((await s.intake.store.list('debt_settlements')).length, 0);
});

test('stale, missing, fractional prices and invalid arrival dates cannot become a quote', async () => {
  const s = await fixture();
  await assert.rejects(s.quote({ items: [{ unitPriceMinor: 1.5, arrivalDate: '2026-11-05' }] }), /valor em centavos/);
  await assert.rejects(s.quote({ items: [{ unitPriceMinor: 4000, arrivalDate: '2026-02-30' }] }), /data de chegada/);
  await assert.rejects(s.quote({ items: [{ unitPriceMinor: 4000, arrivalDate: '2026-10-21' }] }), /data de chegada/);
  await assert.rejects(s.quote({ items: [] }), /valores e as datas/);
  await assert.rejects(s.quote({ commercializationAllowed: false }), /comercialização/);
  await assert.rejects(s.quote({ version: 99 }), /mudou/);
  assert.equal((await s.order()).total, null);
});

test('quote acceptance enters awaiting arrival without treating a customer payment claim as a receipt', async () => {
  const s = await fixture(); await s.accept();
  assert.equal((await s.order()).status, 'AWAITING_ARRIVAL');
  assert.equal((await s.order()).paymentStatus, 'PENDING');
  assert.match((await s.handle('já paguei')).reply, /aguardando conferência/);
  await s.handle('sim'); assert.equal(s.repo.inMemoryOrders.size, 1);
  assert.equal((await s.order()).procurement.deposit, undefined);
  await assert.rejects(s.quote(), /aceita/);
  await assert.rejects(s.intake.updateForecast(s.id, { version: (await s.request()).version, forecast: 'amanhã', confirmed: true }, cashier), /Use a cotação/);
});

test('a declined quote cancels only the unpaid comanda and cannot be charged', async () => {
  const s = await fixture(); await s.quote(); await s.handle('não');
  assert.equal((await s.order()).status, 'CANCELLED');
  await assert.rejects(s.deposit(), /mudou|aceite/);
  await assert.rejects(s.intake.store.receive(s.id, cashier), /cancelada/);
});

test('deposit is exact, authorized, durable, idempotent and does not reserve/deduct stock', async () => {
  const s = await fixture(); await s.accept();
  await assert.rejects(s.deposit({ amountMinor: 8000 }), /50%/);
  await assert.rejects(s.deposit({ received: false }), /recebimento efetivo/);
  const input = { version: (await s.request()).version, received: true, amountMinor: 4000, paymentMethod: 'DINHEIRO' };
  await assert.rejects(s.flow.receiveDeposit(s.id, input, { id: 'driver', role: 'ENTREGADOR' }), /Somente caixa/);
  await Promise.all([s.flow.receiveDeposit(s.id, input, cashier), s.flow.receiveDeposit(s.id, input, cashier)]);
  assert.equal((await s.order()).paymentStatus, 'PARTIAL'); assert.equal(payableTotal(await s.order()), 40);
  assert.equal((await s.intake.store.list('debt_settlements')).length, 1);
  assert.equal((await s.intake.store.list('pdv_outbox', 'event', 'deposit')).length, 1);
  assert.equal((await s.order()).stockDeducted, undefined); assert.equal((await s.order()).inventoryReserved, undefined);
  await assert.rejects(s.repo.cancelOrder(s.id), /conciliação/);
  await assert.rejects(s.intake.store.receive(s.id, cashier), /chegada/);
});

test('Pix deposit requires the private proof of this order and bank confirmation by the cashier', async () => {
  const s = await fixture(); await s.accept();
  await assert.rejects(s.deposit({ paymentMethod: 'PIX' }), /crédito na conta/);
  await assert.rejects(s.deposit({ paymentMethod: 'PIX', proofSeen: true, note: 'Conferido no banco' }), /Anexe/);
  const proofId = randomUUID();
  await s.intake.store.transaction(tx => tx.set('payment_proofs', proofId, { id: proofId, targetType: 'ORDER', targetId: s.id, uploadedBy: cashier.id, fileName: 'pix.pdf', contentType: 'application/pdf', size: 100 }));
  await s.deposit({ paymentMethod: 'PIX', proofSeen: true, note: 'Crédito conferido no banco', proofId });
  assert.equal((await s.order()).procurement.deposit.verifiedVia, 'MANUAL_CAIXA_PIX');
  await s.arrive(); await s.handle('retirada');
  await assert.rejects(s.intake.store.receive(s.id, cashier, { manualPixProofId: proofId }, null, 'PIX'), /comprovante do sinal/);
});

test('arrival requires acceptance, receipt and actual stock mapping; retries reserve once and ask fulfillment once', async () => {
  const s = await fixture();
  await assert.rejects(s.arrive(), /aceite/);
  await s.accept(); await assert.rejects(s.arrive(), /sinal/); await s.deposit();
  const input = { version: (await s.request()).version, confirmed: true, items: [{ productId: 'galinha' }] };
  s.repo.inMemoryProducts.get('galinha').stockQuantity = 1;
  await assert.rejects(s.flow.arrive(s.id, input, cashier), /Estoque disponível insuficiente/);
  assert.equal((await s.order()).procurement.arrivedAt, undefined);
  s.repo.inMemoryProducts.get('galinha').stockQuantity = 10;
  await s.flow.arrive(s.id, input, cashier); await s.flow.arrive(s.id, input, cashier);
  assert.equal(s.repo.inMemoryProducts.get('galinha').reservedQuantity, 2);
  assert.equal(s.repo.inMemoryProducts.get('galinha').stockQuantity, 10);
  assert.equal((await s.order()).status, 'AWAITING_FULFILLMENT');
  assert.equal((await s.intake.store.list('pdv_outbox', 'event', 'arrival')).length, 1);
});

test('pickup confirms a short reply and existing checkout only collects the remaining half, once', async () => {
  const s = await fixture(); await s.accept(); await s.deposit(); await s.arrive();
  const answer = await s.handle('retirada'); assert.equal(answer.reply, 'Combinado, estamos te esperando aqui!');
  const paid = await s.intake.store.receive(s.id, cashier, null, 50, 'DINHEIRO');
  assert.equal(paid.total, 80); assert.equal(paid.paymentParts[0].amount, 40); assert.equal(paid.changeGiven, 10);
  assert.equal(paid.amountDue, 0); assert.ok(paid.completedAt);
  assert.equal((await s.request()).requestStatus, 'COMPLETED');
  await s.intake.store.receive(s.id, cashier, null, 40, 'DINHEIRO');
  assert.equal(s.repo.inMemoryProducts.get('galinha').stockQuantity, 8);
  assert.equal(s.repo.inMemoryProducts.get('galinha').reservedQuantity, 0);
});

test('existing address is shown for confirmation and the delivery proceeds through driver assignment and balance receipt', async () => {
  const s = await fixture(); await s.accept(); await s.deposit(); await s.arrive();
  s.repo.inMemoryCustomers.set('profile-id', { id: 'profile-id', phoneDigits: phone, address: 'Rua das Flores, 10, Centro, Mineiros', name: 'Ana' });
  assert.match((await s.handle('entrega')).reply, /Rua das Flores, 10/);
  assert.equal((await s.order()).orderType, 'PICKUP');
  await s.handle('sim'); const order = await s.order();
  assert.equal(order.deliveryStatus, 'PENDING_DELIVERY'); assert.equal(order.customerId, 'profile-id');
  const driver = { id: 'driver', name: 'Entregador', role: 'ENTREGADOR' };
  await s.intake.store.assignDelivery(s.id, driver); await s.intake.store.startDelivery(s.id, driver);
  const paid = await s.intake.store.receive(s.id, driver, null, 40, 'DINHEIRO', { finishDelivery: true });
  assert.equal(paid.deliveryStatus, 'DELIVERED'); assert.equal(paid.paymentParts[0].amount, 40);
  assert.equal(paid.deliveryAddress, 'Rua das Flores, 10, Centro, Mineiros');
});

test('a changed address is separately confirmed, stored only on this sale and drops stale location coordinates', async () => {
  const s = await fixture(); await s.accept(); await s.deposit(); await s.arrive();
  s.repo.inMemoryCustomers.set(phone, { phone, address: 'Rua Antiga, 11, Centro, Mineiros', deliveryLocation: { lat: -17, lng: -52 } });
  await s.handle('entrega'); await s.handle('outro endereço');
  const answer = await s.handle('Rua Nova, 42, Jardim, Mineiros');
  assert.match(answer.reply, /Confirma a entrega em Rua Nova/);
  assert.equal((await s.order()).deliveryStatus, undefined);
  await s.handle('sim');
  assert.equal((await s.order()).deliveryAddress, 'Rua Nova, 42, Jardim, Mineiros');
  assert.equal((await s.order()).deliveryLocation, null);
  assert.equal(s.repo.inMemoryCustomers.get(phone).address, 'Rua Antiga, 11, Centro, Mineiros');
  const replay = await s.handle('sim'); assert.match(replay.reply, /já está confirmado/);
});

test('a customer without an address must provide and confirm it before any driver can assume delivery', async () => {
  const s = await fixture(); await s.accept(); await s.deposit(); await s.arrive();
  assert.match((await s.handle('entrega')).reply, /endereço completo/);
  assert.match((await s.handle('sim')).reply, /rua, número/);
  await assert.rejects(s.intake.store.assignDelivery(s.id, { id: 'd', role: 'ENTREGADOR' }), /não encontrado/);
  await s.handle('Avenida Goiás, 33, Centro, Mineiros'); await s.handle('não');
  assert.equal((await s.order()).deliveryStatus, undefined);
});

test('the existing automatic Pix balance charge uses half the full sale, without repeating the deposit', async () => {
  const s = await fixture(); await s.accept(); await s.deposit(); await s.arrive(); await s.handle('retirada');
  const chargeCalls = [];
  const pdv = new PdvService({ repository: s.intake.store, pix: { createCharge: async input => { chargeCalls.push(input); return { ...input, pixCopiaECola: 'code', qrCodeBase64: 'data:image/png;base64,aA==' }; } } });
  const charged = await pdv.requestPixAtCashier(s.id, cashier);
  assert.equal(charged.total, 80); assert.equal(charged.pixData.amount, 40); assert.equal(chargeCalls.length, 1);
  const paid = await s.intake.store.receive(s.id, null, { verifiedVia: 'SICREDI_PIX_WEBHOOK', txid: charged.pixData.txid, endToEndId: 'E' + '1'.repeat(31), amountMinor: 4000 });
  assert.equal(paid.paymentVerifiedAmount, 40); assert.equal(paid.paymentStatus, 'APPROVED');
});

test('daily receipts report the deposit on its day and the remaining payment on completion, without double count', async () => {
  const s = await fixture(); await s.accept(); await s.deposit();
  const depositDay = summarizeDailyExecutiveMetrics({ date: '2026-10-22', orders: [await s.order()], settlements: await s.intake.store.list('debt_settlements') });
  assert.equal(depositDay.totalRevenue, 0); assert.equal(depositDay.advanceCreditReceived, 40); assert.equal(depositDay.totalReceivedSales, 0);
  await s.arrive(); await s.handle('retirada');
  const paid = await s.intake.store.receive(s.id, cashier, null, 40, 'DINHEIRO');
  const completionDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(paid.completedAt));
  const report = summarizeDailyExecutiveMetrics({ date: completionDay, orders: [paid], settlements: [] });
  assert.equal(report.totalReceivedSales, 40);
  assert.equal(report.byPayment.DINHEIRO.total, 40);
});

test('staff endpoints enforce roles, version checks and private caching on the procurement mutations', async () => {
  const s = await fixture(); const express = require('express'); const app = express(); app.use(express.json());
  app.use((req, _res, next) => { if (req.headers['x-role']) req.user = { id: cashier.id, role: req.headers['x-role'] }; next(); });
  require('../src/http/order-intake.routes').installOrderIntakeRoutes(app, s.intake);
  const url = 'https://conflora.test/api/caixa/encomendas/' + s.id + '/cotacao';
  const body = JSON.stringify({ version: 1, confirmed: true, commercializationAllowed: true, items: [{ unitPriceMinor: 4000, arrivalDate: '2026-11-05' }] });
  for (const role of ['', 'CLIENTE', 'ENTREGADOR', 'VENDEDOR']) assert.equal((await dispatch(app, url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-role': role }, body })).status, 403);
  const response = await dispatch(app, url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-role': 'CAIXA' }, body });
  assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private, no-store/);
});

test('superseded quote notices are skipped and arrival notices use the durable outbox once', async () => {
  const s = await fixture(); await s.quote(); const first = (await s.intake.store.list('pdv_outbox', 'event', 'quote'))[0];
  await s.quote({ items: [{ unitPriceMinor: 4500, arrivalDate: '2026-11-06' }] });
  const sent = [];
  const pdv = new PdvService({ repository: s.intake.store, whatsapp: { sendTextMessage: async (recipient, text) => { sent.push({ recipient, text }); return { messages: [{ id: randomUUID() }] }; } } });
  await pdv.deliver(first.id); assert.equal((await s.intake.store.read('pdv_outbox', first.id)).status, 'SKIPPED'); assert.equal(sent.length, 0);
  const latest = (await s.intake.store.list('pdv_outbox', 'event', 'quote')).find(job => job.id !== first.id);
  await pdv.deliver(latest.id); await pdv.deliver(latest.id); assert.equal(sent.length, 1); assert.match(sent[0].text, /90,00/);
});

test('an unrelated new request cannot make a yes accept the wrong quote or overwrite an address', async () => {
  const s = await fixture(); await s.quote();
  const response = await s.handle('Quero 3 orquídeas raras');
  assert.match(response.reply, /Antes, confirma a cotação/);
  assert.equal(s.repo.inMemoryOrders.size, 1);
  await s.handle('sim');
  assert.equal((await s.order()).items[0].name, 'galinhas da angola');
});

test('multiple waiting orders preserve the pending draft and prevent simultaneous ambiguous customer questions', async () => {
  const s = await fixture(); await s.accept(); await s.deposit();
  await s.handle('Quero 3 orquídeas raras');
  const second = await s.handle('sim');
  assert.equal(second.intent, 'ORDER_INTAKE_REGISTERED'); assert.notEqual(second.requestId, s.id);
  await s.flow.quote(second.requestId, { version: 1, confirmed: true, commercializationAllowed: true,
    items: [{ unitPriceMinor: 3000, arrivalDate: '2026-11-06' }] }, cashier);
  await assert.rejects(s.arrive(), /outra encomenda/);
  assert.equal(s.repo.inMemoryProducts.get('galinha').reservedQuantity, 0);
  assert.equal((await s.order()).status, 'AWAITING_ARRIVAL');
  await s.handle('sim');
  assert.equal((await s.intake.store.read('orders', second.requestId)).status, 'AWAITING_ARRIVAL');
  await s.arrive(); assert.equal((await s.order()).status, 'AWAITING_FULFILLMENT');
});

test('Firestore-style transactions read before writing and a failed deposit commit leaves no receipt or paid signal', async () => {
  const s = await fixture();
  const maps = new Map(s.repo.pdvMemory);
  for (const [name, map] of Object.entries({ orders: s.repo.inMemoryOrders, products: s.repo.inMemoryProducts, customers: s.repo.inMemoryCustomers })) maps.set(name, map);
  maps.set('store_settings', new Map([['inventory', { stockControlEnabled: true }]]));
  const records = name => { if (!maps.has(name)) maps.set(name, new Map()); return maps.get(name); };
  let failCommit = false;
  s.repo.firestore = {
    collection: name => ({ doc: id => ({ name, id, get: async () => ({ exists: records(name).has(id), id, data: () => structuredClone(records(name).get(id)) }) }) }),
    runTransaction: async work => {
      const writes = [];
      const result = await work({ get: async ref => { assert.equal(writes.length, 0, 'all transaction reads must precede writes'); return ref.get(); }, set: (ref, value) => writes.push([ref, structuredClone(value)]) });
      if (failCommit) throw new Error('FIRESTORE_COMMIT_UNAVAILABLE');
      for (const [ref, value] of writes) records(ref.name).set(ref.id, value);
      return result;
    },
  };
  await s.quote(); await s.handle('sim');
  failCommit = true; await assert.rejects(s.deposit(), /FIRESTORE_COMMIT_UNAVAILABLE/);
  assert.equal((await s.order()).procurement.deposit, undefined); assert.equal(records('debt_settlements').size, 0);
  failCommit = false; await s.deposit(); assert.equal(records('debt_settlements').size, 1);
  await s.arrive(); await s.handle('retirada');
  const paid = await s.intake.store.receive(s.id, cashier, null, 40, 'DINHEIRO');
  assert.equal(paid.paymentParts[0].amount, 40); assert.equal(s.repo.inMemoryProducts.get('galinha').stockQuantity, 8);
});

test('cashier reports and the normal confirmation endpoint count the signal and balance exactly once', async () => {
  const s = await fixture(); await s.accept(); await s.deposit();
  const express = require('express'); const app = express(); app.use(express.json());
  app.use((req, _res, next) => { req.user = { id: 'admin', name: 'Admin', role: 'ADMIN' }; next(); });
  require('../src/http/pdv.routes').installPdvRoutes(app, { repository: s.repo });
  const until = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const url = 'https://conflora.test/api/caixa/orders?from=2026-10-22&to=' + until;
  let board = await (await dispatch(app, url)).json();
  assert.equal(board.procurementOrders.length, 1); assert.equal(board.closing.totalReceived, 40); assert.equal(board.closing.salesReceived, 0);
  await s.arrive(); await s.handle('retirada');
  const confirmUrl = 'https://conflora.test/api/caixa/orders/' + s.id + '/confirm';
  const wrong = await dispatch(app, confirmUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentMethod: 'DINHEIRO', paymentParts: [{ method: 'DINHEIRO', amount: 80 }] }) });
  assert.equal(wrong.status, 400); assert.equal((await s.order()).completedAt, undefined);
  const paid = await dispatch(app, confirmUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paymentMethod: 'DINHEIRO', receivedAmount: 40 }) });
  assert.equal(paid.status, 200);
  board = await (await dispatch(app, url)).json();
  assert.equal(board.closing.totalReceived, 80); assert.equal(board.closing.salesReceived, 40); assert.equal(board.closing.debtReceived, 40);
  assert.equal(board.closing.byPayment.DINHEIRO.total, 80); assert.equal(board.paid[0].total, 80);
});

test('expiration of the balance Pix preserves the deposit and goods, requiring verified reconciliation', async () => {
  const s = await fixture(); await s.accept(); await s.deposit(); await s.arrive(); await s.handle('retirada');
  const pending = await s.intake.store.requestPixAtCashier(s.id, cashier);
  await s.intake.store.transaction(tx => tx.set('orders', s.id, { ...pending, pixExpiresAt: '2020-01-01T00:00:00Z' }));
  const pdv = new PdvService({ repository: s.intake.store });
  assert.equal(await pdv.expirePixOrder(s.id), true);
  const expired = await s.order();
  assert.equal(expired.status, 'AWAITING_RECONCILIATION'); assert.equal(expired.procurement.deposit.amountMinor, 4000);
  assert.equal(s.repo.inMemoryProducts.get('galinha').reservedQuantity, 2);
  await assert.rejects(s.intake.store.receive(s.id, null, { txid: expired.pixData.txid, amountMinor: 4000 }), /venceu/);
  const proofId = randomUUID();
  await s.intake.store.transaction(tx => tx.set('payment_proofs', proofId, { id: proofId, targetType: 'ORDER', targetId: s.id, uploadedBy: cashier.id, fileName: 'saldo.pdf', contentType: 'application/pdf', size: 100 }));
  const paid = await s.intake.store.receive(s.id, cashier, { txid: expired.pixData.txid, amountMinor: 4000,
    verifiedVia: 'MANUAL_CAIXA_PIX', manualPixProofSeen: true, manualPixProofId: proofId, manualPixNote: 'Saldo creditado e conferido na conta' });
  assert.equal(paid.paymentStatus, 'APPROVED'); assert.equal(paid.paymentParts[0].amount, 40); assert.equal(paid.procurement.deposit.amountMinor, 4000);
});

test('customer procurement forecasts reuse the template adapter and checkpoint long item lists without loss', async () => {
  const s = await fixture();
  const record = await s.request();
  const longItems = Array.from({ length: 20 }, (_, index) => ({ requestedName: 'Produto ' + index + ' ' + 'especial '.repeat(10), quantity: 2 }));
  const jobId = s.id + '-forecast';
  await s.intake.store.transaction(tx => {
    tx.set('agent_handoffs', s.id, { ...record, items: longItems, arrivalForecast: 'Previsão confirmada' });
    tx.set('pdv_outbox', jobId, { id: jobId, requestId: s.id, kind: 'order-request-forecast', forecast: 'Previsão confirmada', status: 'PENDING', attempts: 0 });
  });
  const sent = [];
  const pdv = new PdvService({ repository: s.intake.store, ownerPhone: '5564999990002', whatsapp: {
    sendTextMessage: async () => { throw new Error('use the existing template adapter'); },
    sendPdvText: async (_recipient, text) => { sent.push(text); return { messages: [{ id: randomUUID() }] }; },
  } });
  await pdv.deliver(jobId); await pdv.deliver(jobId);
  assert.ok(sent.length > 1); assert.ok(sent.every(text => text.length > 0 && text.length <= 900));
  for (let index = 0; index < 20; index++) assert.ok(sent.join(' ').includes('Produto ' + index + ' '));
  assert.equal((await s.intake.store.read('pdv_outbox', jobId)).status, 'SENT');
});
