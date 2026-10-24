process.env.NODE_ENV = 'test';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = 'isolated-account';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'isolated-number';
process.env.META_APP_SECRET = 'isolated-diagnostic-secret';
const test = require('node:test');
const assert = require('node:assert/strict');
const { eventDiagnostic, inspectMetaConfiguration } = require('../src/integrations/whatsapp-diagnostics');
const { welcomeContract, welcomeComponents } = require('../src/integrations/whatsapp-welcome');
const contract = { name: 'isolated_welcome', language: 'pt_BR', status: 'APPROVED', verifiedAt: 'isolated-verification', header: 'IMAGE',
  bodyParameters: ['greeting_fragment'], buttons: [
    { type: 'URL', text: 'Catálogo virtual', mode: 'static', url: 'https://isolated.invalid/' },
    { type: 'QUICK_REPLY', text: 'Montar minha sacola' }, { type: 'QUICK_REPLY', text: 'Falar com atendente' },
  ] };
const env = { WHATSAPP_BUSINESS_ACCOUNT_ID: '1111111111111111', WHATSAPP_WELCOME_TEMPLATE: contract.name,
  WHATSAPP_WELCOME_CONTRACT: JSON.stringify(contract), WHATSAPP_CATALOG_URL: 'https://isolated.invalid/', WHATSAPP_TOKEN: 'sensitive-fixture-value' };
const config = { whatsapp: { graphVersion: 'v21.0', phoneNumberId: '2222222222222222', token: env.WHATSAPP_TOKEN, assistantEnabled: false, templates: { language: 'pt_BR' } }, envSource: { path: 'isolated.env', loaded: true } };

test('event diagnostics distinguish account mismatch from phone mismatch and expose no credentials or full IDs', () => {
  const diagnostic = eventDiagnostic({ id: '3333333333333333' }, { field: 'messages', value: { metadata: { phone_number_id: config.whatsapp.phoneNumberId } } }, config, env);
  assert.deepEqual(diagnostic.reasons, ['WABA_MISMATCH']); assert.equal(diagnostic.phoneMatches, true);
  const serialized = JSON.stringify(diagnostic);
  for (const secret of [env.WHATSAPP_TOKEN, env.WHATSAPP_BUSINESS_ACCOUNT_ID, config.whatsapp.phoneNumberId, '3333333333333333']) assert.equal(serialized.includes(secret), false);
  const missingPhone = eventDiagnostic({ id: env.WHATSAPP_BUSINESS_ACCOUNT_ID }, { field: 'messages', value: {} }, config, env);
  assert.deepEqual(missingPhone.reasons, ['EVENT_PHONE_ID_MISSING']);
});
test('template diagnostics distinguish absent contract, invalid JSON and a static CTA mismatch', () => {
  assert.throws(() => welcomeContract({}), error => error.diagnosticCode === 'WELCOME_CONTRACT_MISSING');
  assert.throws(() => welcomeContract({ ...env, WHATSAPP_WELCOME_CONTRACT: '{invalid' }), error => error.diagnosticCode === 'WELCOME_CONTRACT_INVALID_JSON');
  assert.throws(() => welcomeContract({ ...env, WHATSAPP_CATALOG_URL: 'https://other.invalid/' }), error => error.diagnosticCode === 'WELCOME_STATIC_URL_MISMATCH');
  const components = welcomeComponents(welcomeContract(env), 'Cliente', { id: 'logo-fixture' });
  assert.equal('_Olá' + components[1].parameters[0].text + 'eja bem-vindo', '_Olá Cliente, seja bem-vindo');
});
test('Meta inspection performs only reads and compares actual approved template components', async () => {
  const paths = [];
  const fetcher = async (url, options) => {
    assert.equal(options.method, undefined); assert.equal(options.body, undefined); paths.push(url);
    let data;
    if (url.includes('/phone_numbers?')) data = { data: [{ id: config.whatsapp.phoneNumberId }] };
    else if (url.includes('/message_templates?')) data = { data: [{ name: contract.name, language: 'pt_BR', status: 'APPROVED', parameter_format: 'POSITIONAL', components: [
      { type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: '_Olá{{1}}eja bem-vindo' }, { type: 'BUTTONS', buttons: contract.buttons.map(({ type, text, url }) => ({ type, text, ...(url ? { url } : {}) })) },
    ] }] };
    else data = { id: url.includes(`/${config.whatsapp.phoneNumberId}?`) ? config.whatsapp.phoneNumberId : env.WHATSAPP_BUSINESS_ACCOUNT_ID, verified_name: 'Isolated Test Number' };
    return new Response(JSON.stringify(data), { status: 200 });
  };
  const result = await inspectMetaConfiguration(config, env, fetcher);
  assert.equal(result.passed, true); assert.equal(result.readOnly, true); assert.equal(paths.length, 4);
  assert.equal(JSON.stringify(result).includes(env.WHATSAPP_TOKEN), false);
});
test('Meta access failure remains a failure without exposing the provider response body', async () => {
  const result = await inspectMetaConfiguration(config, env, async () => new Response(JSON.stringify({ error: { code: 100, error_subcode: 33, message: env.WHATSAPP_TOKEN } }), { status: 400 }));
  assert.equal(result.passed, false); assert.equal(result.account.graphCode, 100);
  assert.equal(JSON.stringify(result).includes(env.WHATSAPP_TOKEN), false);
});
test('disabled conversational agent preserves transactional notifications while human ownership still blocks them', async () => {
  const { FirestoreRepository } = require('./helpers/repository-fixture');
  const { assertAutomation } = require('../src/services/automation-send-guard');
  const { conversationAutomation } = require('../src/services/conversation-automation');
  const runtime = require('../src/config/env');
  const old = runtime.whatsapp.assistantEnabled;
  runtime.whatsapp.assistantEnabled = false;
  try {
    const repository = new FirestoreRepository({ isInMemory: true });
    const phone = '5564999991000';
    await assert.rejects(assertAutomation(repository, phone, 0), error => error.automationBlocked);
    await assertAutomation(repository, phone, 0, { requireAssistant: false });
    await conversationAutomation(repository, phone, { pauseReason: 'human_requested' });
    await assert.rejects(assertAutomation(repository, phone, 0, { requireAssistant: false }), error => error.automationBlocked);
  } finally { runtime.whatsapp.assistantEnabled = old; }
});
test('unsupported webhook fields are ignored; signed message account mismatches retain strict rejection and useful logs', async t => {
  const { createHmac } = require('node:crypto');
  const { createApp } = require('../src/http/app');
  const { FirestoreRepository } = require('./helpers/repository-fixture');
  const Logger = require('../src/shared/logger');
  const warnings = [];
  t.mock.method(Logger, 'warn', (message, metadata) => warnings.push({ message, metadata }));
  const repository = new FirestoreRepository({ isInMemory: true });
  const app = createApp({ messageService: { firestoreRepo: repository, catalogRepo: { items: [], refreshCatalog: async () => {} }, handleCustomerMessage: async () => { assert.fail('Mismatched events must not reach processing'); } } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); }));
  async function send(entry) {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [entry] });
    return fetch(`http://127.0.0.1:${server.address().port}/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': 'sha256=' + createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('hex') }, body });
  }
  assert.equal((await send({ id: 'isolated-account', changes: [{ field: 'message_template_status_update', value: {} }] })).status, 200);
  assert.equal(warnings.some(row => row.metadata?.code === 'WHATSAPP_EVENT_ACCOUNT_MISMATCH'), false);
  assert.equal((await send({ id: 'other-account', changes: [{ field: 'messages', value: { metadata: { phone_number_id: 'isolated-number' }, messages: [] } }] })).status, 200);
  const rejection = warnings.find(row => row.metadata?.code === 'WHATSAPP_EVENT_ACCOUNT_MISMATCH');
  assert.deepEqual(rejection.metadata.reasons, ['WABA_MISMATCH']); assert.equal(rejection.metadata.phoneMatches, true);
});
