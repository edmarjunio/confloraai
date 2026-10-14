process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SicrediPixClient } = require('../src/integrations/sicredi-pix.client');
const { SicrediPaymentService } = require('../src/orders/sicredi-payment.service');
const txid = 'a'.repeat(32);
const endToEndId = 'E' + '1'.repeat(31);
const receipt = { txid, endToEndId, valor: '25.00', horario: '2026-10-14T12:00:00Z' };
const charge = { txid, chave: '12345678901', valor: { original: '25.00' }, status: 'CONCLUIDA', pix: [receipt], pixCopiaECola: 'payload', calendario: { criacao: receipt.horario, expiracao: 3600 } };
function client(overrides = {}, bankCharge = charge, bankReceipt = receipt) {
  const calls = [];
  const instance = new SicrediPixClient({ clientId: 'id', clientSecret: 'secret', certificate: 'cert', privateKey: 'key', pixKey: charge.chave,
    transport: async (url, options) => {
      calls.push({ url, options });
      if (url.includes('/oauth/token')) {return { access_token: 'test', expires_in: 3600 };}
      return structuredClone(url.includes('/cob/') ? bankCharge : bankReceipt);
    }, ...overrides });
  return { instance, calls };
}
const expected = { total: 25, pixKey: charge.chave };
test('Confirma somente cobrança concluída e recebimento consultado no banco', async () => {
  const { instance, calls } = client();
  const result = await instance.checkChargeStatus(txid, expected);
  assert.equal(result.isPaid, true);
  assert.equal(result.endToEndId, endToEndId);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].options.agent.options.cert, 'cert');
  assert.equal(calls[0].options.agent.options.rejectUnauthorized, true);
  assert.match(calls[1].url, /api\/v2\/cob/);
});
for (const [label, change, payment] of [
  ['chave errada', { chave: 'outra' }], ['txid errado', { txid: 'b'.repeat(32) }],
  ['valor errado', { valor: { original: '24.00' } }], ['status sem recebimento', { pix: [] }],
  ['múltiplos recebimentos', { pix: [receipt, receipt] }],
  ['recebimento de outra venda', {}, { ...receipt, txid: 'b'.repeat(32) }],
  ['recebimento de outro valor', {}, { ...receipt, valor: '24.99' }],
  ['devolução', {}, { ...receipt, devolucoes: [{ status: 'DEVOLVIDO' }] }],
]) {
  test(`Não confirma: ${label}`, async () => {
    const { instance } = client({}, { ...charge, ...change }, payment || receipt);
    await assert.rejects(instance.checkChargeStatus(txid, expected));
  });
}
test('Cobrança ativa não é pagamento mesmo contendo pix', async () => {
  const { instance } = client({}, { ...charge, status: 'ATIVA' });
  assert.equal((await instance.checkChargeStatus(txid, expected)).isPaid, false);
});
test('Sem credenciais não gera QR estático', async () => {
  const { instance } = client({ privateKey: '' });
  await assert.rejects(instance.createCharge({ amount: 25, txid }));
});
test('Timeout não vira aprovação nem nova cobrança', async () => {
  const { instance } = client({ transport: async () => { throw new Error('timeout'); } });
  await assert.rejects(instance.createCharge({ amount: 25, txid }), /timeout/);
});
test('PUT trava valor e GET recupera cobrança sem recriar', async () => {
  let body;
  const { instance } = client({ transport: async (url, options) => {
    if (url.includes('/oauth')) {return { access_token: 'token', expires_in: 3600 };}
    if (options.method === 'GET') { const error = new Error('missing'); error.status = 404; throw error; }
    body = JSON.parse(options.body);
    return charge;
  } });
  const result = await instance.createCharge({ amount: 25, txid });
  assert.equal(body.valor.modalidadeAlteracao, 0);
  assert.equal(body.valor.original, '25.00');
  assert.match(result.qrCodeBase64, /^data:image\/png;base64,/);
  const recovered = client();
  await recovered.instance.createCharge({ amount: 25, txid });
  assert.equal(recovered.calls.filter(c => c.options.method === 'PUT').length, 0);
});
test('OAuth concorrente compartilha token e renova uma vez no 401', async () => {
  let tokens = 0, gets = 0;
  const { instance } = client({ transport: async (url) => {
    if (url.includes('/oauth')) { tokens++; return { access_token: 'token', expires_in: 3600 }; }
    if (++gets === 1) { const error = new Error('expired'); error.status = 401; throw error; }
    return charge;
  } });
  await Promise.all([instance.getAccessToken(), instance.getAccessToken()]);
  assert.equal(tokens, 1);
  await instance.getCharge(txid);
  assert.equal(tokens, 2);
});

// Serial transaction double: no partial commits and no reads after writes.
function database(initial = {}) {
  let docs = new Map(Object.entries(initial));
  let queue = Promise.resolve();
  const snapshot = ref => ({ id: ref.id, exists: docs.has(ref.path), data: () => structuredClone(docs.get(ref.path)), ref });
  const db = { fail: false, docs: () => docs,
    collection: name => ({ doc: id => {
      const ref = { id, path: `${name}/${id}` };
      ref.get = async () => snapshot(ref);
      ref.update = async data => docs.set(ref.path, { ...docs.get(ref.path), ...structuredClone(data) });
      return ref;
    } }),
    runTransaction: callback => {
      const promise = queue.then(async () => {
        const writes = [];
        const result = await callback({ get: async ref => { assert.equal(writes.length, 0); return snapshot(ref); },
          set: (ref, data) => writes.push([ref.path, data, false]), update: (ref, data) => writes.push([ref.path, data, true]) });
        if (db.fail) {throw new Error('commit failed');}
        const next = new Map(docs);
        for (const [key, data, merge] of writes) {next.set(key, structuredClone({ ...(merge ? next.get(key) : {}), ...data }));}
        docs = next;
        return result;
      });
      queue = promise.catch(() => {});
      return promise;
    },
  };
  return db;
}
function serviceSetup() {
  const id = `sicredi_${txid}`;
  const order = { id, txid, pixKey: charge.chave, total: 25, paymentProvider: 'SICREDI', status: 'AGUARDANDO_PAGAMENTO', customerPhone: '64999999999', items: [], ticketNumber: '123', pix: { pixCopiaECola: 'payload' } };
  const db = database({ [`orders/${id}`]: order, [`sicredi_jobs/${txid}`]: { orderId: id, pending: true } });
  const sent = [];
  const service = new SicrediPaymentService({ repository: { firestore: db }, client: client().instance,
    whatsapp: { sendTextMessage: async (phone, text) => { sent.push({ phone, text }); return { messages: [{ id: 'wamid.test' }] }; } } });
  const evidence = { isPaid: true, txid, endToEndId, pixKey: charge.chave, amount: 25, paidAt: receipt.horario };
  return { db, service, evidence, id, sent };
}
test('Webhooks/consultas concorrentes criam um lançamento e uma fila de recibo', async () => {
  const s = serviceSetup();
  await Promise.all(Array.from({ length: 5 }, () => s.service.settle(s.id, s.evidence)));
  assert.equal(s.db.docs().get(`orders/${s.id}`).status, 'PAGO');
  assert.equal([...s.db.docs().keys()].filter(k => k.startsWith('cash_movements/')).length, 1);
  assert.equal(s.db.docs().get(`cash_movements/sicredi_${endToEndId}`).amountCents, 2500);
  await Promise.all([s.service.deliver(s.id), s.service.deliver(s.id)]);
  assert.equal(s.sent.length, 1);
});
test('Commit falho não deixa baixa parcial nem recibo', async () => {
  const s = serviceSetup(); s.db.fail = true;
  await assert.rejects(s.service.settle(s.id, s.evidence));
  assert.equal(s.db.docs().get(`orders/${s.id}`).status, 'AGUARDANDO_PAGAMENTO');
  assert.equal(s.db.docs().size, 2);
});
test('Mesmo endToEndId não pode pagar outra venda', async () => {
  const s = serviceSetup();
  await s.service.settle(s.id, s.evidence);
  const ref = s.db.collection('orders').doc('other');
  await ref.update({ ...s.db.docs().get(`orders/${s.id}`), id: 'other', status: 'AGUARDANDO_PAGAMENTO', paymentStatus: '' });
  await assert.rejects(s.service.settle('other', s.evidence), /outro lançamento/);
});
test('Falha no WhatsApp mantém recibo pendente sem desfazer pagamento', async () => {
  const s = serviceSetup();
  await s.service.settle(s.id, s.evidence);
  s.service.whatsapp.sendTextMessage = async () => ({ mock: true });
  await assert.rejects(s.service.deliver(s.id));
  assert.equal(s.db.docs().get(`sicredi_outbox/${s.id}_receipt`).pending, true);
  assert.equal(s.db.docs().get(`orders/${s.id}`).paymentStatus, 'PAGO');
});
test('Após reinício a cobrança persistida continua conciliável', async () => {
  const s = serviceSetup();
  const restarted = new SicrediPaymentService({ repository: { firestore: s.db }, client: client().instance, whatsapp: s.service.whatsapp });
  assert.equal((await restarted.reconcile(s.id)).paymentStatus, 'PAGO');
});
test('Venda cancelada recebida vai para caixa com sinalização de conciliação', async () => {
  const s = serviceSetup();
  await s.db.collection('orders').doc(s.id).update({ status: 'CANCELLED' });
  await s.service.settle(s.id, s.evidence);
  assert.equal(s.db.docs().get(`orders/${s.id}`).reconciliationRequired, true);
});

test('Criação persiste intenção antes do banco e reutiliza chave de tentativa', async () => {
  const db = database();
  let calls = 0;
  const bank = { isOfficialApiConfigured: true, pixKey: charge.chave, createCharge: async args => {
    calls++;
    assert.equal(db.docs().get(`orders/sicredi_${args.txid}`).total, 25);
    return { txid: args.txid, pixCopiaECola: 'payload', qrCodeBase64: 'qr' };
  } };
  const service = new SicrediPaymentService({ repository: { firestore: db }, client: bank });
  const order = { total: 25, items: [], operatorId: 'operator', customerPhone: '' };
  const first = await service.create(order, 'attempt-1234567890');
  const second = await service.create(order, 'attempt-1234567890');
  assert.equal(first.id, second.id);
  assert.equal(calls, 1);
  await assert.rejects(service.create({ ...order, total: 30 }, 'attempt-1234567890'), /outra venda/);
});

test('HTTP: PDV calcula frete, webhook não confia no payload e confirma só pelo banco', async t => {
  const { createApp } = require('../src/http/app');
  const { FirestoreRepository } = require('../src/database/firestore.repository');
  const repo = new FirestoreRepository({ isInMemory: true });
  await repo.saveProduct({ id: 'sicredi-plant', name: 'Planta', price: 20, status: 'ATIVO' });
  let paid = false;
  const bank = {
    isOfficialApiConfigured: true, pixKey: charge.chave,
    createCharge: async args => ({ txid: args.txid, pixCopiaECola: 'payload', qrCodeBase64: 'qr' }),
    checkChargeStatus: async id => paid ? { isPaid: true, txid: id, endToEndId, pixKey: charge.chave, amount: 25, paidAt: receipt.horario } : { isPaid: false },
  };
  const db = database();
  const app = createApp({ messageService: { firestoreRepo: repo }, sicrediPixClient: bank });
  app.locals.sicredi.repository = { firestore: db };
  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = await fetch(`${base}/api/admin/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: 'usr-caixa1', pin: '0000' }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const payload = { items: [{ productId: 'sicredi-plant', price: 1, quantity: 1 }], paymentMethod: 'PIX', freightValue: 5, orderType: 'DELIVERY' };
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json', cookie, 'Idempotency-Key': 'attempt-http-123456789' }, body: JSON.stringify(payload) };
  const response = await fetch(`${base}/api/caixa/orders`, options);
  assert.equal(response.status, 200);
  const { order } = await response.json();
  assert.equal(order.total, 25);
  assert.equal(order.status, 'AGUARDANDO_PAGAMENTO');
  const repeated = await (await fetch(`${base}/api/caixa/orders`, options)).json();
  assert.equal(repeated.order.id, order.id);
  const event = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pix: [{ txid: order.txid, valor: '25.00', endToEndId }] }) };
  assert.equal((await fetch(`${base}/webhooks/sicredi/pix`, event)).status, 204);
  assert.equal(db.docs().get(`orders/${order.id}`).status, 'AGUARDANDO_PAGAMENTO');
  paid = true;
  await db.collection('sicredi_jobs').doc(order.txid).update({ leaseUntil: 0 });
  assert.equal((await fetch(`${base}/webhooks/sicredi/pix`, event)).status, 204);
  const status = await (await fetch(`${base}/api/caixa/orders/${order.id}/pix`, { headers: { cookie } })).json();
  assert.equal(status.order.paymentStatus, 'PAGO');
  assert.equal((await fetch(`${base}/api/caixa/orders/${order.id}/pix`)).status, 401);
  assert.equal((await fetch(`${base}/tasks/reconcile-sicredi`, { method: 'POST' })).status, 401);
});
