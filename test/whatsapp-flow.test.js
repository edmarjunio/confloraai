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
