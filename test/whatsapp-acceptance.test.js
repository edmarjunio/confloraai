process.env.NODE_ENV = 'test';
process.env.WHATSAPP_AI_ENABLED = 'true';
process.env.WHATSAPP_AGENT_OWNER = 'cloud_api';
process.env.WHATSAPP_META_CATALOG_ID = '123456789';
process.env.WHATSAPP_TOKEN = 'isolated-token';
process.env.WHATSAPP_PHONE_NUMBER_ID = 'isolated-number';
process.env.WHATSAPP_BUSINESS_ACCOUNT_ID = 'isolated-account';
process.env.META_APP_SECRET = 'isolated-secret';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { OrderService } = require('../src/orders/order.service');
const { SalesConversationService } = require('../src/services/sales-conversation.service');
const { MessageService } = require('../src/services/message.service');
const { WhatsAppClient } = require('../src/integrations/whatsapp.client');
const { normalizeAction, normalizeOrder } = require('../src/integrations/whatsapp-inbound');
const { welcomeContract, welcomeComponents } = require('../src/integrations/whatsapp-welcome');
const { conversationAutomation, resumeAgentRequestedConversation, resetConversationContext, evaluateDailyReset } = require('../src/services/conversation-automation');
const { durableConversationTransport } = require('../src/services/durable-conversation-transport');
const { MetaCatalogSyncService, projection } = require('../src/services/meta-catalog-sync.service');
const phone = '5564999991000';
const review = { approved: true, reviewedBy: 'isolated-admin', reviewedAt: '2026-10-23T12:00:00Z', policyVersion: 'isolated-policy', category: 'PERMITTED_PLANT_OR_GARDEN_PRODUCT' };
const { actualPhotoFixture } = require('./helpers/actual-photo-fixture');
function fixture() {
  const repository = new FirestoreRepository({ isInMemory: true });
  repository.getInventorySettings = async () => ({ stockControlEnabled: true });
  for (const [id, name, price] of [['arugula', 'Rúcula', 14], ['lettuce', 'Alface', 8], ['mustard', 'Mostarda', 6]]) repository.inMemoryProducts.set(id,
    { id, name, price, unit: 'UN', status: 'ATIVO', stockQuantity: 100, reservedQuantity: 0, metaCommerceReview: review, ...actualPhotoFixture(id) });
  const store = new PdvRepository(repository);
  const orders = new OrderService({ firestoreRepo: repository, catalogRepo: {} });
  const service = new SalesConversationService({ repository, orders });
  const sends = [];
  const send = async (kind, to, body) => { sends.push({ kind, to, body }); return { messages: [{ id: `wamid.isolated-${sends.length}` }] }; };
  const client = { sendWelcomeTemplate: (to, name) => send('template', to, name), sendCatalogMessage: to => send('catalog', to),
    sendTextMessage: (to, body) => send('text', to, body), sendInteractiveButtons: (to, body) => send('buttons', to, body) };
  const catalogRepo = new (require('../src/catalog/catalog.repository').CatalogRepository)({ firestoreRepo: repository });
  const messages = new MessageService({ firestoreRepo: repository, catalogRepo, whatsappClient: client, orderService: orders });
  const say = (message, messageId = '') => service.handle({ phone, message, messageId });
  const choose = (result, name) => service.handle({ phone, interactiveId: result.buttons.find(button => button.id.startsWith(`sales_${name}:`)).id });
  return { repository, store, orders, service, messages, client, sends, say, choose };
}
test('actual presentation and menu use template transport; quick replies normalize both webhook shapes', async () => {
  const { messages, sends } = fixture();
  await messages.processCustomerMessage({ phone, message: 'Oi', customerName: 'Cliente' });
  await messages.processCustomerMessage({ phone, message: 'menu', customerName: 'Cliente' });
  assert.deepEqual(sends.map(row => row.kind), ['template', 'template']);
  assert.equal(normalizeAction({ button: { payload: 'montar_sacola', text: 'Montar minha sacola' } }), 'montar_sacola');
  assert.equal(normalizeAction({ interactive: { button_reply: { id: 'btn_atendente' } } }), 'btn_atendente');
  assert.equal(normalizeAction({ button: { text: 'Montar minha sacola' } }), 'montar_sacola');
});
test('Falar com atendente queues human attention silently and never starts AI or checkout', async () => {
  const { messages, repository, store, sends } = fixture();
  messages.agentService = { extractSalesIntent: async () => { assert.fail('WhatsApp human selection must not call AI'); } };
  messages.catalogRepo.refreshCatalog = async () => { assert.fail('Human selection must not query catalogue'); };
  const inbox = new (require('../src/services/incoming-message.service').IncomingMessageService)(repository);
  const button = { phone, message: 'Falar com atendente', interactiveId: normalizeAction({ button: { payload: 'btn_atendente', text: 'Falar com atendente' } }), messageId: 'wamid.human-button', customerName: 'Cliente' };
  await inbox.accept(button);
  const result = await messages.handleCustomerMessage(button);
  assert.equal(result.intent, 'HUMAN_HANDOFF_REQUESTED'); assert.equal(result.reply, '');
  const conversation = await conversationAutomation(repository, phone);
  assert.equal(conversation.automation, 'paused'); assert.equal(conversation.reason, 'human_requested');
  assert.equal(conversation.attentionStatus, 'NEEDS_HUMAN_ATTENTION'); assert.equal(conversation.customerName, 'Cliente');
  const handoff = await store.read('agent_handoffs', conversation.handoffId);
  assert.equal(handoff.customerPhone, phone); assert.equal(handoff.status, 'open');
  assert.equal(messages.salesConversation, undefined); assert.equal(sends.length, 0);
  assert.equal((await messages.handleCustomerMessage(button)).intent, 'DUPLICATE');
  for (const [index, message] of ['4 rúculas', 'menu', 'reiniciar'].entries()) {
    const payload = { phone, message, messageId: `wamid.after-human-${index}` };
    await inbox.accept(payload);
    assert.equal((await messages.handleCustomerMessage(payload)).intent, 'HUMAN_HANDOFF_ACTIVE');
  }
  assert.equal(repository.inMemoryOrders.size, 0); assert.equal(sends.length, 0);
  assert.equal((await store.list('agent_handoffs', 'status', 'open')).length, 1);
});
test('WhatsApp text checkout does not invoke the removed conversational AI fallback', async () => {
  const { messages, sends } = fixture();
  messages.agentService = { extractSalesIntent: async () => { assert.fail('Removed WhatsApp AI must not be invoked'); } };
  await evaluateDailyReset(messages.firestoreRepo, phone);
  await require('../src/services/conversation-automation').setConversationChannel(messages.firestoreRepo, phone, 'agent');
  const result = await messages.processCustomerMessage({ phone, message: 'Talvez pudéssemos avaliar alternativas para esse espaço.' });
  assert.equal(result.reply, ''); assert.equal(result.intent, 'AMBIGUOUS_NEEDS_HUMAN'); assert.equal(sends.length, 0);
});
test('approved contract preserves logo, language, exact labels, CTA and configured variables', () => {
  const raw = { name: 'isolated_welcome', language: 'pt_BR', status: 'APPROVED', verifiedAt: '2026-10-23', header: 'IMAGE', bodyParameters: ['customer_name'],
    buttons: [{ type: 'URL', text: 'Catálogo virtual', mode: 'static', url: 'https://isolated.invalid' }, { type: 'QUICK_REPLY', text: 'Montar minha sacola' }, { type: 'QUICK_REPLY', text: 'Falar com atendente' }] };
  const env = { WHATSAPP_WELCOME_TEMPLATE: raw.name, WHATSAPP_WELCOME_CONTRACT: JSON.stringify(raw), WHATSAPP_CATALOG_URL: 'https://isolated.invalid' };
  const contract = welcomeContract(env);
  const components = welcomeComponents(contract, 'Cliente', { id: 'logo' });
  assert.deepEqual(components[0].parameters[0], { type: 'image', image: { id: 'logo' } });
  assert.equal(components[1].parameters[0].text, 'Cliente');
  assert.equal(components.filter(component => component.sub_type === 'url').length, 0);
  assert.deepEqual(components.slice(-2).map(component => component.parameters[0].payload), ['montar_sacola', 'btn_atendente']);
  assert.throws(() => welcomeContract({ ...env, WHATSAPP_CATALOG_URL: 'https://wrong.invalid' }));
});
test('template failure is not replaced by a generic menu', async () => {
  const { messages, sends } = fixture();
  messages.whatsappClient.sendWelcomeTemplate = async () => { throw Object.assign(new Error('unavailable'), { definitelyNotSent: true }); };
  await assert.rejects(messages.processCustomerMessage({ phone, message: 'menu' }), error => error.requiresReconciliation);
  assert.equal(sends.length, 0);
});
test('initial webhook consumer reaches real template JSON with logo and approved parameters, without an intermediate URL message', async t => {
  const keys = ['WHATSAPP_WELCOME_TEMPLATE', 'WHATSAPP_WELCOME_CONTRACT', 'WHATSAPP_CATALOG_URL'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => { for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  process.env.WHATSAPP_WELCOME_TEMPLATE = 'isolated_welcome';
  process.env.WHATSAPP_CATALOG_URL = 'https://isolated.invalid/shop/plants';
  process.env.WHATSAPP_WELCOME_CONTRACT = JSON.stringify({ name: 'isolated_welcome', language: 'pt_BR', status: 'APPROVED', verifiedAt: '2026-10-23', header: 'IMAGE', bodyParameters: ['customer_name'],
    buttons: [{ type: 'URL', text: 'Catálogo virtual', mode: 'dynamic', url: 'https://isolated.invalid/shop/{{1}}' }, { type: 'QUICK_REPLY', text: 'Montar minha sacola' }, { type: 'QUICK_REPLY', text: 'Falar com atendente' }] });
  const submitted = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url.endsWith('/media')) { assert.equal(options.body.get('file').name, 'conflora-logo.png'); return new Response(JSON.stringify({ id: 'official-logo-media' }), { status: 200 }); }
    submitted.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.approved-welcome' }] }), { status: 200 });
  });
  const { messages } = fixture(); messages.whatsappClient = new WhatsAppClient();
  await messages.processCustomerMessage({ phone, message: 'Oi', customerName: 'Cliente' });
  assert.equal(submitted.length, 1); assert.equal(submitted[0].type, 'template');
  const template = submitted[0].template;
  assert.equal(template.name, 'isolated_welcome'); assert.equal(template.language.code, 'pt_BR');
  assert.equal(template.components[0].parameters[0].image.id, 'official-logo-media');
  assert.equal(template.components[1].parameters[0].text, 'Cliente');
  assert.equal(template.components.find(component => component.sub_type === 'url').parameters[0].text, 'plants');
});
test('buy button emits official catalog payload and legacy category callbacks never mutate carts', async t => {
  const previous = process.env.WHATSAPP_META_CATALOG_ENABLED;
  process.env.WHATSAPP_META_CATALOG_ENABLED = 'true';
  t.after(() => { if (previous === undefined) delete process.env.WHATSAPP_META_CATALOG_ENABLED; else process.env.WHATSAPP_META_CATALOG_ENABLED = previous; });
  let payload;
  t.mock.method(globalThis, 'fetch', async (_url, options) => { payload = JSON.parse(options.body); return new Response(JSON.stringify({ messages: [{ id: 'wamid.catalog' }] }), { status: 200 }); });
  const { messages, store } = fixture();
  messages.whatsappClient = new WhatsAppClient();
  const result = await messages.processCustomerMessage({ phone, message: '', interactiveId: 'montar_sacola' });
  assert.equal(result.intent, 'META_CATALOG_SENT');
  assert.equal(payload.interactive.type, 'catalog_message');
  assert.equal(payload.interactive.action.name, 'catalog_message');
  await messages.processCustomerMessage({ phone, message: '', interactiveId: 'add_arugula' });
  assert.equal((await store.read('sessions', phone))?.orderDraft, undefined);
});
test('deterministic quantities work without AI and distinguish add, remove and set', async () => {
  const { say, store } = fixture();
  await say('quero 5 rúculas de 14 e 2 alfaces de 8', 'm1');
  await say('adiciona mais 3 alfaces', 'm2');
  await say('tira uma rúcula', 'm3');
  await say('muda para 6 mostardas', 'm4');
  const items = (await store.read('sessions', phone)).salesConversation.items;
  assert.deepEqual(items.map(item => item.quantity), [4, 5, 6]);
  assert.deepEqual(items.map(item => item.priceMinor), [1400, 800, 600]);
  await say('adiciona mais 3 alfaces', 'm5');
  await say('adiciona mais 3 alfaces', 'm5');
  assert.equal((await store.read('sessions', phone)).salesConversation.items.find(item => item.productId === 'lettuce').quantity, 8);
});
test('Meta cart ignores incoming price, requires fulfillment/payment/final acceptance, creates one official pending comanda', async () => {
  const { service, repository, store, say, choose } = fixture();
  const commerceOrder = normalizeOrder({ catalog_id: process.env.WHATSAPP_META_CATALOG_ID, product_items: [{ product_retailer_id: 'arugula', quantity: 4, item_price: '0.01', currency: 'BRL' }] });
  const quote = await service.receiveMetaCart({ phone, commerceOrder, messageId: 'wamid.cart' });
  assert.match(quote.reply, /56,00/);
  assert.equal(repository.inMemoryOrders.size, 0);
  const final = await say('retirada e dinheiro');
  assert.match(final.reply, /Confirma a criação/);
  assert.equal(repository.inMemoryOrders.size, 0);
  const receipt = await choose(final, 'yes');
  const official = await repository.getOrderById(receipt.orderId);
  assert.equal(official.source, 'WHATSAPP_BOT');
  assert.equal(official.paymentStatus, 'PENDING');
  assert.equal(official.total, 56);
  assert.equal(repository.inMemoryProducts.get('arugula').stockQuantity, 100);
  await service.receiveMetaCart({ phone, commerceOrder, messageId: 'wamid.cart' });
  assert.equal(repository.inMemoryOrders.size, 1);
  assert.equal((await store.read('sessions', phone)).salesConversation.metaMessageId, 'wamid.cart');
});
test('invalid currency/catalog/quantities are rejected and variants require objective clarification', async () => {
  assert.throws(() => normalizeOrder({ catalog_id: 'wrong', product_items: [] }));
  for (const quantity of [-1, 0, 1.5, 10001]) assert.throws(() => normalizeOrder({ catalog_id: process.env.WHATSAPP_META_CATALOG_ID, product_items: [{ product_retailer_id: 'arugula', quantity, currency: 'BRL' }] }));
  const { repository, say } = fixture();
  repository.inMemoryProducts.set('other-arugula', { ...repository.inMemoryProducts.get('arugula'), id: 'other-arugula', price: 8 });
  assert.match((await say('quero rúcula')).reply, /Qual rúcula/i);
  assert.equal(repository.inMemoryOrders.size, 0);
});
test('two variants of the same name are preserved and a vague quantity edit asks which one', async () => {
  const { repository, say, store } = fixture();
  repository.inMemoryProducts.set('other-arugula', { ...repository.inMemoryProducts.get('arugula'), id: 'other-arugula', price: 8 });
  await say('quero 2 rúculas de 14 e 3 rúculas de 8');
  const before = (await store.read('sessions', phone)).salesConversation.items;
  assert.equal(before.length, 2); assert.deepEqual(before.map(item => item.quantity), [2, 3]);
  assert.match((await say('adiciona mais 1 rúcula')).reply, /Qual opção/);
  assert.deepEqual((await store.read('sessions', phone)).salesConversation.items, before);
  await say('adiciona mais 1 rúcula de 14');
  assert.deepEqual((await store.read('sessions', phone)).salesConversation.items.map(item => item.quantity), [3, 3]);
});
test('ambiguity is silent, procurement requires consent, unknown price never creates payment', async () => {
  const f = fixture();
  const silent = await f.messages.processCustomerMessage({ phone, message: 'Não sei ainda.' });
  assert.equal(silent.reply, '');
  assert.equal(f.sends.length, 0);
  assert.equal(f.repository.inMemoryOrders.size, 0);
  const g = fixture();
  const offer = await g.say('quero 2 lavandas');
  assert.match(offer.reply, /sujeito à confirmação do fornecedor/);
  assert.equal(g.repository.inMemoryOrders.size, 0);
  await g.choose(offer, 'yes');
  const requests = await g.store.list('agent_handoffs', 'kind', 'ORDER_REQUEST');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].total, null);
  assert.equal(requests[0].items[0].priceMinor, null);
});
test('human pause survives customer/day/reload and blocks in-flight replies after authorized resume', async () => {
  const { repository, client, messages, sends } = fixture();
  const transport = durableConversationTransport(repository, client, { phone, messageId: 'old-response', version: 0 });
  await conversationAutomation(repository, phone, { pauseReason: 'human_requested' });
  await evaluateDailyReset(repository, phone, { now: new Date('2026-10-25T12:00:00Z') });
  assert.equal((await messages.processCustomerMessage({ phone, message: 'menu' })).intent, 'HUMAN_HANDOFF_ACTIVE');
  await assert.rejects(transport.sendTextMessage(phone, 'old'), error => error.automationBlocked);
  await resumeAgentRequestedConversation(repository, phone, { id: 'admin', role: 'ADMIN' });
  await assert.rejects(transport.sendTextMessage(phone, 'old'), error => error.automationBlocked);
  assert.equal(sends.length, 0);
});
test('outbox retries suppress jobs from before human takeover', async () => {
  const { repository, store } = fixture();
  await store.transaction(async tx => tx.set('pdv_outbox', 'old-job', { id: 'old-job', kind: 'conversation-text', recipient: phone, status: 'PENDING', createdAt: '2026-10-20T10:00:00Z' }));
  await conversationAutomation(repository, phone, { pauseReason: 'human_requested' });
  await resumeAgentRequestedConversation(repository, phone, { id: 'admin', role: 'ADMIN' });
  assert.equal(await store.claimMessage('old-job'), null);
  assert.equal((await store.read('pdv_outbox', 'old-job')).status, 'SKIPPED');
});
test('reset archives working items, preserves all commercial data and human pause', async () => {
  const { repository, store, say } = fixture();
  await say('4 rúculas');
  const reset = await resetConversationContext(repository, phone);
  assert.ok(reset.conversation.version > 0);
  assert.equal((await store.read('agent_handoffs', reset.preservedContextId)).salesConversation.items[0].quantity, 4);
  await store.transaction(async tx => { const session = await tx.get('sessions', phone); tx.set('sessions', phone, { ...session, salesConversation: null, orderDraft: { id: 'pending' }, pendingOperation: { id: 'op' } }); });
  await conversationAutomation(repository, phone, { pauseReason: 'human_requested' });
  await resetConversationContext(repository, phone, { id: 'admin', role: 'ADMIN' });
  const session = await store.read('sessions', phone);
  assert.equal(session.orderDraft.id, 'pending');
  assert.equal(session.pendingOperation.id, 'op');
  assert.equal((await conversationAutomation(repository, phone)).automation, 'paused');
});
test('sync is blocked until explicit authorization and excludes animals even when marked approved', async () => {
  const { repository, store } = fixture();
  const sync = new MetaCatalogSyncService(repository);
  const id = await sync.queue('arugula', { id: 'admin' });
  const job = await store.claimMessage(id);
  await sync.deliver(job);
  assert.equal((await store.read('pdv_outbox', id)).status, 'BLOCKED_CONFIGURATION');
  assert.deepEqual(projection({ ...repository.inMemoryProducts.get('arugula'), name: 'Galinha' }, 'animal', 'https://isolated.invalid'), { retailer_id: 'animal', availability: 'discontinued' });
});

test('signed webhook → durable inbox → real sales service → official comanda: repeated Meta events create one order', async t => {
  const { createHmac } = require('node:crypto');
  const { createApp } = require('../src/http/app');
  const { repository, messages, store } = fixture();
  const app = createApp({ messageService: messages });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); }));
  const url = `http://127.0.0.1:${server.address().port}/webhook`;
  async function post(message) {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: 'isolated-account', changes: [{ field: 'messages', value: {
      metadata: { phone_number_id: 'isolated-number' }, messages: [{ from: phone, ...message }],
    } }] }] });
    const signature = 'sha256=' + createHmac('sha256', process.env.META_APP_SECRET).update(body).digest('hex');
    assert.equal((await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature }, body })).status, 200);
    const id = require('node:crypto').createHash('sha256').update(message.id).digest('hex');
    for (let attempt = 0; attempt < 200; attempt++) {
      const row = await store.read('incoming_messages', id);
      if (row?.status === 'COMPLETED') return;
      if (row?.status === 'NEEDS_RECONCILIATION') assert.fail('Unexpected reconciliation: ' + row.lastError);
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.fail('Inbox did not complete');
  }
  const cart = { id: 'wamid.native-cart', type: 'order', order: { catalog_id: '123456789', product_items: [{ product_retailer_id: 'arugula', quantity: 4, item_price: '0.01', currency: 'BRL' }] } };
  await post(cart);
  await post(cart);
  assert.equal(repository.inMemoryOrders.size, 0);
  await post({ id: 'wamid.fulfillment', type: 'text', text: { body: 'retirada e dinheiro' } });
  const state = (await store.read('sessions', phone)).salesConversation;
  assert.equal(state.stage, 'FINAL_CONFIRMATION');
  const confirm = { id: 'wamid.confirm-native', type: 'button', button: { payload: `sales_yes:${state.version}`, text: 'Confirmar pedido' } };
  await post(confirm);
  await post(confirm);
  assert.equal(repository.inMemoryOrders.size, 1);
  const order = [...repository.inMemoryOrders.values()][0];
  assert.equal(order.source, 'WHATSAPP_BOT'); assert.equal(order.total, 56); assert.equal(order.paymentStatus, 'PENDING');
});

test('coexistence human echoes pause once and own provider IDs never claim a human takeover', async () => {
  const { processHumanEcho } = require('../src/services/whatsapp-echo.service');
  const { repository, store } = fixture();
  const echo = { message_echoes: [{ id: 'wamid.human', to: phone }] };
  await processHumanEcho(repository, echo);
  assert.equal((await conversationAutomation(repository, phone)).automation, 'paused');
  await resumeAgentRequestedConversation(repository, phone, { id: 'admin', role: 'ADMIN' });
  await processHumanEcho(repository, echo);
  assert.equal((await conversationAutomation(repository, phone)).automation, 'active');
  const id = require('node:crypto').createHash('sha256').update('wamid.bot').digest('hex');
  await store.transaction(async tx => tx.set('whatsapp_delivery', id, { id, providerMessageId: 'wamid.bot', source: 'CLOUD_API_AUTOMATION' }));
  await processHumanEcho(repository, { message_echoes: [{ id: 'wamid.bot', to: phone }] });
  assert.equal((await conversationAutomation(repository, phone)).automation, 'active');
});

test('incremental sync uses latest backend state, deduplicates projection and disables deactivated products', async t => {
  const previous = process.env.WHATSAPP_META_SYNC_ENABLED;
  process.env.WHATSAPP_META_SYNC_ENABLED = 'true';
  t.after(() => { if (previous === undefined) delete process.env.WHATSAPP_META_SYNC_ENABLED; else process.env.WHATSAPP_META_SYNC_ENABLED = previous; });
  const { repository, store } = fixture();
  await store.transaction(async tx => tx.set('store_settings', 'whatsapp_commerce', { enabled: true, catalogId: '123456789', initialSyncAuthorizedAt: 'isolated-authorization' }));
  const sync = new MetaCatalogSyncService(repository);
  const calls = [];
  let published = false;
  sync.request = async (path, options = {}) => {
    calls.push({ path, options });
    if (options.method === 'POST') { published = true; return { id: 'remote-product' }; }
    return { data: published ? [{ id: 'remote-product', retailer_id: 'arugula' }] : [] };
  };
  const id = await sync.queue('arugula', { id: 'admin' });
  repository.inMemoryProducts.get('arugula').price = 16;
  await sync.deliver(await store.claimMessage(id));
  assert.equal(calls.find(call => call.options.method === 'POST').options.data.price, 1600);
  await sync.queue('arugula', { id: 'admin' });
  await sync.deliver(await store.claimMessage(id));
  assert.equal(calls.length, 2);
  repository.inMemoryProducts.get('arugula').status = 'INATIVO';
  await sync.queue('arugula', { id: 'admin' });
  await sync.deliver(await store.claimMessage(id));
  assert.equal(calls.at(-1).options.data.availability, 'discontinued');
  assert.equal(repository.inMemoryProducts.get('arugula').stockQuantity, 100);
});

test('staff routes enforce ownership, pause before manual send and deduplicate provider submissions', async t => {
  const express = require('express');
  const { installWhatsappAdminRoutes } = require('../src/http/whatsapp-admin.routes');
  const { store, sends, client, repository } = fixture();
  let staff = { id: 'admin', name: 'Equipe isolada', role: 'ADMIN' };
  const app = express(); app.use(express.json()); app.use((req, _res, next) => { req.user = staff; next(); });
  installWhatsappAdminRoutes(app, { store, whatsapp: client });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections?.(); }));
  const base = `http://127.0.0.1:${server.address().port}/api/admin/whatsapp/conversations/${phone}`;
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await post('/takeover', {})).status, 200);
  assert.equal((await conversationAutomation(repository, phone)).automation, 'paused');
  const body = { text: 'Atendimento humano isolado', requestId: 'isolated-request-0001' };
  assert.equal((await post('/send', body)).status, 200);
  assert.equal((await post('/send', body)).status, 200);
  assert.equal(sends.length, 1);
  staff = { id: 'other', role: 'CAIXA' };
  assert.equal((await post('/takeover', {})).status, 409);
  assert.equal((await post('/release', {})).status, 409);
  staff = { id: 'customer', role: 'CLIENTE' };
  assert.equal((await post('/send', body)).status, 403);
});
