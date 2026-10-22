process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { SicrediPixClient } = require('../src/integrations/sicredi-pix.client');

function setup({ mismatch = false, recover = false } = {}) {
  const calls = []; const txid = 'A'.repeat(32);
  const client = new SicrediPixClient({ clientId: 'isolated', clientSecret: 'isolated', certificate: 'CERT', privateKey: 'KEY', pixKey: '52998224725', request: async (url, options) => {
    calls.push({ url, options });
    if (url.includes('/oauth/')) return { access_token: 'isolated-token', expires_in: 3600 };
    if (recover && options.method === 'PUT' && url.includes('/cob/')) throw new Error('Resposta perdida');
    if (url.includes('/cob/')) return { txid, chave: client.pixKey, valor: { original: mismatch ? '99.00' : '20.00', modalidadeAlteracao: 0 }, pixCopiaECola: 'codigo-isolado-sem-validade', status: 'ATIVA' };
    if (url.includes('/webhook/')) return JSON.parse(options.body);
    return { endToEndId: 'E' + '1'.repeat(31), valor: '20.00' };
  } });
  return { client, calls, txid };
}
test('Sicredi autentica uma vez, envia mTLS e gera QR somente de cobrança validada', async () => {
  const { client, calls, txid } = setup();
  const charge = await client.createCharge({ amount: 20, txid });
  assert.equal(charge.provider, 'SICREDI'); assert.match(charge.qrCodeBase64, /^data:image\/png;base64,/);
  assert.equal(calls[0].options.cert, 'CERT'); assert.equal(calls[0].options.key, 'KEY');
  const body = JSON.parse(calls[1].options.body); assert.equal(body.valor.original, '20.00'); assert.equal(body.valor.modalidadeAlteracao, 0);
  await client.checkReceivedPayment('E' + '1'.repeat(31)); assert.equal(calls.filter(call => call.url.includes('/oauth/')).length, 1);
});
test('Sicredi recupera cobrança após perda de resposta e recusa valor divergente', async () => {
  const recovery = setup({ recover: true }); await recovery.client.createCharge({ amount: 20, txid: recovery.txid });
  assert.ok(recovery.calls.some(call => call.options.method === 'GET' && call.url.includes('/cob/')));
  const mismatch = setup({ mismatch: true }); await assert.rejects(mismatch.client.createCharge({ amount: 20, txid: mismatch.txid }), /fixa solicitada/);
});
test('Sicredi bloqueia configuração ausente, identificador inválido e callback sem HTTPS', async () => {
  const { client } = setup();
  await assert.rejects(client.registerWebhook('http://invalid.test/hook'), /HTTPS/);
  await assert.rejects(client.checkReceivedPayment('invalido'), /inválido/);
  const missing = new SicrediPixClient({ clientId: '', clientSecret: '', certificate: '', privateKey: '', pixKey: '' });
  await assert.rejects(missing.getAccessToken(), /Configure/);
});
test('Sicredi resolve URL de webhook via SICREDI_WEBHOOK_URL ou SERVICE_URL + SICREDI_WEBHOOK_SECRET e registra com PUT /webhook/:pixKey', async () => {
  const secret = 's'.repeat(32);
  const { client, calls } = setup();
  client.serviceUrl = 'https://conflora.example.com';
  client.webhookSecret = secret;
  assert.equal(client.resolveWebhookUrl(), `https://conflora.example.com/webhooks/sicredi-pix/${secret}`);
  const registered = await client.registerWebhook();
  assert.equal(registered.webhookUrl, `https://conflora.example.com/webhooks/sicredi-pix/${secret}`);
  assert.ok(calls.some(call => call.options.method === 'PUT' && call.url.endsWith('/webhook/52998224725')));
});
