process.env.WHATSAPP_AI_ENABLED = 'true';
process.env.WHATSAPP_AGENT_OWNER = 'cloud_api';
const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { OrderIntakeService, parseRequest } = require('../src/services/order-intake.service');
const { ORDER_OFFER, ARRIVAL_PENDING, PRICE_PENDING, briefReply } = require('../src/services/customer-service-policy');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { PdvService } = require('../src/orders/pdv.service');
const { dispatch } = require('./helpers/in-process-http');
const phone = '5564999990001';
const fixture = () => {
  const repo = new FirestoreRepository({ isInMemory: true });
  repo.inMemoryProducts.set('alface', { id: 'alface', name: 'Alface', price: 4, unit: 'UN', status: 'ATIVO', stockQuantity: 20, reservedQuantity: 0 });
  repo.getInventorySettings = async () => ({ stockControlEnabled: true });
  const intake = new OrderIntakeService(repo, { env: { STORE_NOTIFICATION_PHONE: '5564999990002', JUNIOR_WHATSAPP_NUMBER: '5564999990003' } });
  const handle = (message, messageId = message) => intake.handle({ phone, message, messageId, customerName: 'Cliente teste' });
  return { repo, intake, handle };
};

test('intake preserves every quantity and unknown product without inventing product IDs', () => {
  assert.deepEqual(parseRequest('Quero 2 galos combatentes e 3 galinhas da angola.').items.map(item => [item.quantity, item.requestedName]),
    [[2, 'galos combatentes'], [3, 'galinhas da angola']]);
  assert.equal(parseRequest('Bom dia'), null);
  assert.equal(parseRequest('Quero pagar no Pix'), null);
  assert.throws(() => parseRequest('Quero 0 galinhas'), /quantidade válida/);
});

test('an absent product receives a brief order offer, never a denial or a fixed deadline', async () => {
  const { handle, intake } = fixture();
  assert.equal((await handle('Tem galinha da angola francesa?')).reply, ORDER_OFFER);
  assert.equal((await handle('Quando chega?')).reply, ARRIVAL_PENDING);
  assert.equal((await handle('Quanto custa?')).reply, PRICE_PENDING);
  assert.equal((await handle('sim')).intent, 'ORDER_QUANTITY_REQUIRED');
  assert.equal((await handle('3')).intent, 'ORDER_INTAKE_REGISTERED');
  assert.equal((await handle('sim', 'confirm')).intent, 'ORDER_INTAKE_REGISTERED');
  const records = await intake.store.scanPage('agent_handoffs', 'kind', 'ORDER_REQUEST');
  assert.equal(records[0].items[0].quantity, 3);
  assert.equal(records[0].items[0].priceMinor, null);
  assert.equal(records[0].total, null);
});

test('mixed requests preserve ready and procurement items and commit notifications with the ticket', async () => {
  const { repo, intake, handle } = fixture();
  const offer = await handle('Quero 4 alfaces e 2 galinhas da angola.');
  assert.match(offer.reply, /4 alfaces para hoje/);
  assert.match(offer.reply, /2 galinhas da angola por encomenda/);
  assert.equal((await intake.store.scanPage('agent_handoffs', 'kind', 'ORDER_REQUEST')).length, 0);
  const confirmed = await handle('Pode registrar', 'confirmed-1');
  const record = await intake.store.read('agent_handoffs', confirmed.requestId);
  assert.deepEqual(record.items.map(item => item.fulfillment), ['IMMEDIATE', 'PROCUREMENT']);
  assert.equal(record.status, 'open');
  assert.equal(record.requestStatus, 'AWAITING_QUOTE');
  assert.deepEqual((await intake.store.scanPage('pdv_outbox', 'kind', 'order-request-notice')).map(job => job.target).sort(), ['admin', 'junior', 'store']);
  assert.equal(repo.inMemoryOrders.size, 1);
  assert.equal([...repo.inMemoryOrders.values()][0].total, null);
  assert.equal(repo.inMemoryProducts.get('alface').stockQuantity, 20);
  assert.equal(repo.inMemoryProducts.get('alface').reservedQuantity, 0);
});

test('concurrent confirmations create exactly one ticket and one set of notifications', async () => {
  const { intake, handle } = fixture();
  await handle('Quero 2 galinhas da angola');
  const confirmations = await Promise.all([handle('sim', 'a'), handle('sim', 'b')]);
  assert.equal(confirmations[0].requestId, confirmations[1].requestId);
  assert.equal((await intake.store.scanPage('agent_handoffs', 'kind', 'ORDER_REQUEST')).length, 1);
  assert.equal((await intake.store.scanPage('pdv_outbox', 'kind', 'order-request-notice')).length, 3);
  await handle('sim', 'c');
  assert.equal((await intake.store.scanPage('agent_handoffs', 'kind', 'ORDER_REQUEST')).length, 1);
});

test('stock is checked again and uncertainty never becomes a financial sale', async () => {
  const { repo, intake, handle } = fixture();
  await handle('Quero 4 alfaces e 2 galinhas');
  repo.inMemoryProducts.get('alface').stockQuantity = 0;
  const result = await handle('sim');
  const saved = await intake.store.read('agent_handoffs', result.requestId);
  assert.ok(saved.items.every(item => item.fulfillment === 'PROCUREMENT'));
  assert.equal(repo.inMemoryOrders.size, 1);
  assert.equal([...repo.inMemoryOrders.values()][0].paymentStatus, 'PENDING');
});

test('sold-out or inactive items can be requested without pretending immediate availability', async () => {
  const { repo, handle } = fixture();
  repo.inMemoryProducts.get('alface').status = 'INATIVO';
  assert.equal((await handle('Tem alface?')).reply, ORDER_OFFER);
  assert.equal((await handle('sim')).intent, 'ORDER_QUANTITY_REQUIRED');
});

test('ready-to-sell purchases retain the existing checkout and fresh price queries use current records', async () => {
  const { repo, handle } = fixture();
  assert.equal(await handle('Quero 4 alfaces'), null);
  assert.match((await handle('Quanto custa alface?')).reply, /4,00/);
  repo.inMemoryProducts.get('alface').price = 9;
  assert.match((await handle('Tem alface?')).reply, /9,00/);
});

test('declining cancels the draft without creating a ticket', async () => {
  const { intake, handle } = fixture();
  await handle('Quero 2 galinhas');
  assert.equal((await handle('não')).intent, 'ORDER_INTAKE_CANCELLED');
  await handle('sim');
  assert.equal((await intake.store.scanPage('agent_handoffs', 'kind', 'ORDER_REQUEST')).length, 0);
});

test('explicit illicit purpose is not offered while a breed name alone is not rejected', async () => {
  const { handle, intake } = fixture();
  assert.equal((await handle('Quero 2 galos para rinha')).intent, 'ORDER_REQUIRES_REVIEW');
  assert.equal((await handle('Quero 2 galos combatentes')).intent, 'ORDER_INTAKE_CONFIRM');
  assert.equal((await intake.store.scanPage('agent_handoffs', 'kind', 'ORDER_REQUEST')).length, 0);
});

test('a database failure cannot result in a false registered reply', async () => {
  const { repo, intake, handle } = fixture();
  await handle('Quero 2 galinhas');
  intake.store.read = async () => { throw new Error('offline'); };
  await assert.rejects(handle('sim'), /offline/);
  repo.firestore = null;
  assert.equal((await intake.store.scanPage('agent_handoffs', 'kind', 'ORDER_REQUEST')).length, 0);
});

test('intake notifications are attempted immediately and transport failure preserves durable jobs', async () => {
  const { intake, handle } = fixture();
  const attempts = [];
  intake.notify = async id => { attempts.push(id); throw new Error('transport offline'); };
  await handle('Quero 2 galinhas');
  const result = await handle('sim');
  assert.equal(attempts.length, 3);
  assert.ok(await intake.store.read('agent_handoffs', result.requestId));
  assert.ok((await intake.store.scanPage('pdv_outbox', 'kind', 'order-request-notice')).every(job => job.status === 'PENDING'));
});

test('notification worker notifies staff and Junior without creating financial effects', async t => {
  const { repo, intake, handle } = fixture();
  const previous = { STORE_NOTIFICATION_PHONE: process.env.STORE_NOTIFICATION_PHONE, JUNIOR_WHATSAPP_NUMBER: process.env.JUNIOR_WHATSAPP_NUMBER };
  Object.assign(process.env, { STORE_NOTIFICATION_PHONE: '5564999990002', JUNIOR_WHATSAPP_NUMBER: '5564999990003' });
  t.after(() => { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const sends = [];
  const pdv = new PdvService({ repository: new PdvRepository(repo), whatsapp: { sendTextMessage: async (to, text) => {
    sends.push({ to, text }); return { messages: [{ id: 'wamid.' + sends.length }] };
  } }, ownerPhone: '5564999990002' });
  intake.notify = id => pdv.deliver(id);
  await handle('Quero 2 galinhas'); await handle('sim');
  assert.deepEqual(sends.map(send => send.to).sort(), ['5564999990002', '5564999990003']);
  assert.equal(repo.inMemoryNotifications.length, 1);
  assert.equal(repo.inMemoryNotifications[0].type, 'ORDER_REQUEST');
  assert.equal(repo.inMemoryOrders.size, 1);
  assert.equal([...repo.inMemoryOrders.values()][0].total, null);
  await pdv.retryMessages();
  assert.equal(sends.length, 2);
});

test('same configured recipient combines Conflora and Junior into one durable job', async () => {
  const { intake, handle } = fixture();
  intake.env = { STORE_NOTIFICATION_PHONE: '5564999990002', JUNIOR_WHATSAPP_NUMBER: '5564999990002' };
  await handle('Quero 2 galinhas'); await handle('sim');
  const jobs = await intake.store.scanPage('pdv_outbox', 'kind', 'order-request-notice');
  assert.deepEqual(jobs.map(job => job.target), ['admin', 'store-and-junior']);
});

test('only staff-confirmed forecasts create a customer notification, with idempotency and a legality check', async () => {
  const { intake, handle } = fixture();
  await handle('Quero 2 galinhas'); const result = await handle('sim');
  const input = { version: 1, forecast: '30/10, período da manhã', confirmed: true, commercializationAllowed: true };
  await assert.rejects(intake.updateForecast(result.requestId, input, { id: 'driver', role: 'ENTREGADOR' }), /permissão/);
  await assert.rejects(intake.updateForecast(result.requestId, { ...input, commercializationAllowed: false }, { id: 'admin', role: 'ADMIN' }), /comercialização/);
  await assert.rejects(intake.updateForecast(result.requestId, { ...input, confirmed: false }, { id: 'admin', role: 'ADMIN' }), /previsão confirmada/);
  await intake.updateForecast(result.requestId, input, { id: 'admin', role: 'ADMIN' });
  await intake.updateForecast(result.requestId, input, { id: 'admin', role: 'ADMIN' });
  assert.equal((await intake.store.scanPage('pdv_outbox', 'kind', 'order-request-forecast')).length, 1);
  assert.match((await handle('Quando chega?')).reply, /30\/10/);
});

test('cashier endpoints reject guests and drivers and allow authorized forecast updates', async () => {
  const { intake, handle } = fixture();
  await handle('Quero 2 galinhas'); const saved = await handle('sim');
  const express = require('express');
  const app = express(); app.use(express.json());
  app.use((req, _res, next) => { if (req.headers['x-test-role']) req.user = { id: 'tester', role: req.headers['x-test-role'] }; next(); });
  require('../src/http/order-intake.routes').installOrderIntakeRoutes(app, intake);
  assert.equal((await dispatch(app, 'https://conflora.test/api/caixa/encomendas')).status, 403);
  assert.equal((await dispatch(app, 'https://conflora.test/api/caixa/encomendas', { headers: { 'x-test-role': 'ENTREGADOR' } })).status, 403);
  const response = await dispatch(app, 'https://conflora.test/api/caixa/encomendas', { headers: { 'x-test-role': 'CAIXA' } });
  assert.equal((await response.json()).requests.length, 1);
  const update = await dispatch(app, 'https://conflora.test/api/caixa/encomendas/' + saved.requestId + '/previsao', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-role': 'ADMIN' },
    body: JSON.stringify({ version: 1, forecast: '30/10', confirmed: true, commercializationAllowed: true }),
  });
  assert.equal(update.status, 200);
});

test('the language policy removes denials, unsupported dates, fake registrations and repeated sales closings', async () => {
  assert.equal(briefReply('Não temos esse produto.'), ORDER_OFFER);
  assert.equal(briefReply('Chega em 7 dias.'), ARRIVAL_PENDING);
  assert.equal(briefReply('Chega amanhã.'), ARRIVAL_PENDING);
  assert.equal(briefReply('Custa R$ 99,00.', { allowedCents: [400] }), PRICE_PENDING);
  assert.equal(briefReply('Seu pedido foi registrado!'), 'Posso registrar seu pedido?');
  assert.equal(briefReply('Olá! A alface custa R$ 4,00. (Se preferir falar com um atendente, é só avisar!)'), 'A alface custa R$ 4,00.');
  const { AgentService } = require('../src/ai/agent.service');
  const ai = new AgentService({ aiClient: { models: { generateContent: async () => ({ text: 'Não vendemos galinha da angola.' }) } } });
  assert.equal(await ai.generateResponse({ userMessage: 'Tem galinha?' }), ORDER_OFFER);
  assert.match(ai.buildSystemPrompt({ mode: 'GENERAL_CHAT' }), /Ausência no catálogo NÃO significa/);
});

test('cached identification only fetches current matching product IDs instead of rescanning the full catalogue', async () => {
  const { repo, intake, handle } = fixture();
  const alface = repo.inMemoryProducts.get('alface');
  const requested = [];
  const getById = repo.getProductsByIds.bind(repo);
  repo.getProductsByIds = async ids => { requested.push(ids); return getById(ids); };
  repo.getAllProducts = async () => { throw new Error('Full scan not allowed'); };
  intake.catalog = { rawItems: [alface], refreshCatalog: async () => {} };
  const result = await handle('Quero 4 alfaces e 2 galinhas');
  assert.match(result.reply, /4 alfaces para hoje/);
  assert.deepEqual(requested, [['alface']]);
  await handle('sim');
  assert.deepEqual(requested, [['alface'], ['alface']]);
});

test('a quantity answer completes an already accepted mixed request without dropping the ready items or asking again', async () => {
  const { intake, handle } = fixture();
  await handle('Quero 4 alfaces e galinhas da angola');
  assert.equal((await handle('sim')).intent, 'ORDER_QUANTITY_REQUIRED');
  const result = await handle('2');
  assert.equal(result.intent, 'ORDER_INTAKE_REGISTERED');
  const saved = await intake.store.read('agent_handoffs', result.requestId);
  assert.deepEqual(saved.items.map(item => item.quantity), [4, 2]);
  assert.deepEqual(saved.items.map(item => item.fulfillment), ['IMMEDIATE', 'PROCUREMENT']);
});

test('legacy intake registers unknown items after the customer selected a conversation channel', async () => {
  const { repo } = fixture();
  const sent = [];
  const { MessageService } = require('../src/services/message.service');
  const service = new MessageService({ firestoreRepo: repo, whatsappClient: { sendTextMessage: async (_phone, text) => {
    sent.push(text); return { messages: [{ id: 'wamid.' + sent.length }] };
  } } });
  await require('../src/services/conversation-automation').setConversationChannel(repo, phone, 'catalog');
  const offer = await service.handleCustomerMessage({ phone, message: 'Quero 2 galos combatentes e 3 galinhas da angola', messageId: 'offer', customerName: 'Cliente' });
  assert.equal(offer.intent, 'ORDER_INTAKE_CONFIRM');
  assert.match(offer.reply, /2 galos combatentes e 3 galinhas da angola/);
  const registered = await service.handleCustomerMessage({ phone, message: 'Pode registrar', messageId: 'confirm', customerName: 'Cliente' });
  assert.equal(registered.intent, 'ORDER_INTAKE_REGISTERED');
  assert.match(sent.at(-1), /Pedido registrado/);
  assert.ok(sent.at(-1).split(/\s+/).length < 20);
  const duplicate = await service.handleCustomerMessage({ phone, message: 'Pode registrar', messageId: 'confirm', customerName: 'Cliente' });
  assert.equal(duplicate.intent, 'DUPLICATE');
  assert.equal(sent.length, 2);
});

test('failed Firestore ticket transaction leaves no partial request or notifications and can retry', async () => {
  const { createInMemoryFirestore } = require('./helpers/agent-firestore');
  const db = createInMemoryFirestore({ 'store_settings/inventory': { stockControlEnabled: true } });
  const repo = new FirestoreRepository({ firestoreInstance: db });
  const intake = new OrderIntakeService(repo);
  const handle = (message, messageId) => intake.handle({ phone, message, messageId });
  await handle('Quero 3 galinhas', 'offer');
  const transaction = db.runTransaction;
  db.runTransaction = async () => { throw new Error('Commit unavailable'); };
  await assert.rejects(handle('sim', 'confirmation'), /Commit unavailable/);
  assert.equal([...db.raw.keys()].filter(path => /^agent_handoffs\/|^pdv_outbox\//.test(path)).length, 0);
  db.runTransaction = transaction;
  const result = await handle('sim', 'confirmation');
  assert.equal(result.intent, 'ORDER_INTAKE_REGISTERED');
});

test('customer forecast is sent only after the staff update and is not repeated on worker retry', async () => {
  const { repo, intake, handle } = fixture();
  const sent = [];
  const pdv = new PdvService({ repository: new PdvRepository(repo), whatsapp: { sendTextMessage: async (to, text) => {
    sent.push({ to, text }); return { messages: [{ id: 'wamid.forecast' }] };
  } } });
  await handle('Quero 2 galinhas'); const result = await handle('sim');
  assert.equal(sent.length, 0);
  intake.notify = id => pdv.deliver(id);
  await intake.updateForecast(result.requestId, { version: 1, forecast: '30/10', confirmed: true, commercializationAllowed: true }, { id: 'admin', role: 'ADMIN' });
  assert.equal(sent.length, 1); assert.equal(sent[0].to, phone); assert.match(sent[0].text, /30\/10/);
  await pdv.deliver(result.requestId + '-forecast-2');
  assert.equal(sent.length, 1);
});

test('advisory chat without a registration context does not pretend to register an anonymous order', async () => {
  const { StoreAssistant } = require('../src/storefront/assistant');
  const assistant = new StoreAssistant();
  const response = await assistant.recommend({}, {}, [], { message: 'Pode registrar' });
  assert.equal(response.mode, 'ORDER_CONTACT');
  assert.match(response.message, /WhatsApp/);
  assert.doesNotMatch(response.message, /registrado/);
  const { DirectPriceService } = require('../src/services/direct-price.service');
  const price = new DirectPriceService();
  assert.equal(price.formatDirectPriceResponse(null), PRICE_PENDING);
  assert.doesNotMatch(price.formatDirectPriceResponse({ canonicalName: 'mini cabra', category: 'Pets', prices: [100] }), /gaiola|ração|reserv/i);
});
