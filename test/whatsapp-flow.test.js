process.env.NODE_ENV = 'test';
process.env.CONFLORA_ENV_FILE = '.env.whatsapp-test-unused';
process.env.META_APP_SECRET = 'local-whatsapp-test-secret';
process.env.WHATSAPP_VERIFY_TOKEN = 'local-verify-token';
process.env.WHATSAPP_TOKEN = 'local-test-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'local-phone-id';
process.env.WHATSAPP_AI_ENABLED = 'true';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { createApp } = require('../src/http/app');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { WhatsAppClient } = require('../src/integrations/whatsapp.client');

test('WhatsApp receives a signed message and rejects forged webhooks without external services', { timeout: 10000 }, async t => {
  let received;
  const processed = new Promise(resolve => { received = resolve; });
  const app = createApp({ messageService: {
    firestoreRepo: new FirestoreRepository({ isInMemory: true }),
    catalogRepo: { items: [], refreshCatalog: async () => {} },
    handleCustomerMessage: async payload => { received(payload); },
  } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/webhook`;
  const challenge = await fetch(`${url}?hub.mode=subscribe&hub.verify_token=local-verify-token&hub.challenge=12345`);
  assert.equal(challenge.status, 200);
  assert.equal(await challenge.text(), '12345');
  assert.equal((await fetch(`${url}?hub.mode=subscribe&hub.verify_token=invalid`)).status, 403);
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ value: {
    contacts: [{ profile: { name: 'Cliente Teste' } }],
    messages: [{ from: '5564999990000', id: 'wamid.local-test', text: { body: 'Quanto custa a muda?' } }],
  } }] }] });
  const headers = { 'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=invalid' };
  assert.equal((await fetch(url, { method: 'POST', headers, body })).status, 401);
  headers['x-hub-signature-256'] = 'sha256=' + createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('hex');
  assert.equal((await fetch(url, { method: 'POST', headers, body })).status, 200);
  assert.deepEqual(await processed, {
    phone: '5564999990000', message: 'Quanto custa a muda?',
    customerName: 'Cliente Teste', messageId: 'wamid.local-test',
  });
});

test('WhatsApp sends the correct API payload using a simulated Meta response', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent = { url, options, body: JSON.parse(options.body) };
    return new globalThis.Response(JSON.stringify({ messages: [{ id: 'wamid.simulated' }] }), { status: 200 });
  });
  const result = await new WhatsAppClient().sendTextMessage('5564999990000', 'Teste Conflora');
  assert.match(sent.url, /\/local-phone-id\/messages$/);
  assert.equal(sent.options.headers.Authorization, 'Bearer local-test-token');
  assert.equal(sent.body.to, '5564999990000');
  assert.equal(sent.body.text.body, 'Teste Conflora');
  assert.equal(result.messages[0].id, 'wamid.simulated');
});


test('WhatsApp rejects expired credentials instead of reporting a successful delivery', async t => {
  t.mock.method(globalThis, 'fetch', async () => new globalThis.Response(JSON.stringify({ error: { code: 190 } }), { status: 401 }));
  await assert.rejects(new WhatsAppClient().sendTextMessage('5564999990000', 'Recibo'), /token recusado/);
});

test('WhatsApp uploads QR image and sends its media ID; failed upload never sends a message', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    return new globalThis.Response(JSON.stringify(url.endsWith('/media') ? { id: 'qr-media' } : { messages: [{ id: 'wamid.qr' }] }), { status: 200 });
  });
  const client = new WhatsAppClient();
  await client.sendImageBuffer('5564999990000', Buffer.from('image'), 'Pix R$ 20,00');
  assert.equal(calls.length, 2);
  assert.ok(calls[0].options.body instanceof FormData);
  const payload = JSON.parse(calls[1].options.body);
  assert.equal(payload.image?.id || payload.template?.components[0].parameters[0].image.id, 'qr-media');
  calls.length = 0;
  t.mock.method(globalThis, 'fetch', async url => { calls.push(url); return new globalThis.Response('{}', { status: 503 }); });
  await assert.rejects(client.sendImageBuffer('5564999990000', Buffer.from('image')), /HTTP 503/);
  assert.equal(calls.length, 1);
});


test('cashier report uploads a PDF and sends its media ID using the approved document template', async t => {
  const originalFetch = global.fetch;
  const previousTemplate = process.env.WHATSAPP_CASHIER_REPORT_TEMPLATE;
  process.env.WHATSAPP_CASHIER_REPORT_TEMPLATE = 'relatorio_caixa_pdf';
  t.after(() => { global.fetch = originalFetch; if (previousTemplate === undefined) delete process.env.WHATSAPP_CASHIER_REPORT_TEMPLATE; else process.env.WHATSAPP_CASHIER_REPORT_TEMPLATE = previousTemplate; });
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => String(url).endsWith('/media') ? { id: 'report-media' } : { messages: [{ id: 'wamid.report' }] } };
  };
  const client = new WhatsAppClient();
  const result = await client.sendDocumentBuffer('5564999994321', Buffer.from('%PDF-test'), 'caixa.pdf', 'Caixa geral de hoje');
  assert.equal(result.messages[0].id, 'wamid.report');
  assert.equal(calls.length, 2);
  const file = calls[0].options.body.get('file');
  assert.equal(file.type, 'application/pdf'); assert.equal(file.name, 'caixa.pdf');
  const message = JSON.parse(calls[1].options.body);
  assert.equal(message.type, 'template');
  assert.equal(message.template.components[0].parameters[0].document.id, 'report-media');
  assert.equal(message.template.components[1].parameters[0].text, 'Caixa geral de hoje');
});
