process.env.NODE_ENV = 'test';
process.env.WHATSAPP_AI_ENABLED = 'true';
process.env.WHATSAPP_AGENT_OWNER = 'cloud_api';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createInMemoryFirestore } = require('./helpers/agent-firestore');
const { FirestoreProductSource } = require('../src/agent/product-source');
const { ProductIndex } = require('../src/agent/product-search');
const { ConfloraAgentService } = require('../src/agent/agent-service');
const { HandoffStore, CartStore, customerKeyFor } = require('../src/agent/agent-store');
const { MessageService } = require('../src/services/message.service');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { PdvService } = require('../src/orders/pdv.service');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { createMetaAgentRoutes } = require('../src/http/meta-agent.routes');
const { SignatureValidator } = require('../src/security/signature.validator');
const { verifiedProductImage } = require('../src/agent/product-image');
const { interpretTraits } = require('../src/agent/plant-search');
const phone = '5564999990000';
const botanical = traits => ({ approved: true, reviewedBy: 'staff-fixture', traits });

function fixture(overrides = {}) {
  const db = createInMemoryFirestore({
    'products/a': { name: 'Maranta tigrina', price: 25, unit: 'UN', status: 'ATIVO', botanical: botanical({ environment: ['interno'], light: ['sombra'] }) },
    'products/b': { name: 'Hibisco', price: 30, unit: 'UN', status: 'ATIVO', botanical: botanical({ light: ['sol_pleno'], use: ['cerca_viva'] }) },
    'products/c': { name: 'Jabuticaba', price: 50, unit: 'UN', status: 'ATIVO' },
    'products/d': { name: 'Hortelã', price: 7, unit: 'UN', status: 'ATIVO' },
    'agent_synonyms/m': { term: 'marantinha', approved: true, productIds: ['a'] },
    'store_settings/inventory': { stockControlEnabled: false },
    ...overrides,
  });
  const source = new FirestoreProductSource(db);
  const index = new ProductIndex({ source });
  const handoffs = new HandoffStore(db);
  const agent = new ConfloraAgentService({ productSource: source, productIndex: index, cartStore: new CartStore(db), handoffStore: handoffs, imageResolver: async () => null });
  const ask = (message, customerPhone = phone) => agent.execute('atender_mensagem', { customer_phone: customerPhone, message_id: 'fixture-message', message });
  return { db, source, index, handoffs, agent, ask };
}

function silent(envelope) {
  assert.equal(envelope.next_action.send_customer_message, false);
  assert.equal(envelope.next_action.handoff_to_human, true);
  assert.equal(envelope.data.customer_message, undefined);
}

for (const [label, query, id] of [
  ['01 exact name', 'Quanto custa Maranta tigrina?', 'a'],
  ['02 accents', 'hortela', 'd'],
  ['03 approved synonym', 'marantinha', 'a'],
  ['04 verified characteristics', 'Tem alguma planta pra fazer cerca viva?', 'b'],
  ['05 indoor plants', 'Quero uma planta pra colocar dentro de casa.', 'a'],
  ['06 strong sun', 'Tem alguma planta que aguenta sol forte?', 'b'],
]) test(label, async () => {
  const f = fixture(); const before = structuredClone([...f.db.raw]);
  const result = await f.ask(query);
  assert.equal(result.status, 'found', JSON.stringify(result));
  assert.equal(result.data.products[0].id, id);
  for (const [path, doc] of before) assert.deepEqual(f.db.raw.get(path), doc);
  assert.ok(![...f.db.raw.keys()].some(k => /^(orders|stock_movements|agent_pilot_carts)\//.test(k)));
});

test('07 no photo still returns only official text', async () => {
  const r = await fixture().ask('Jabuticaba');
  assert.equal(r.data.cards[0].image_url, null);
  assert.match(r.data.customer_message, /R\$ 50,00/);
  assert.doesNotMatch(r.data.customer_message, /mais algum|disponível/i);
});

test('08 price change bypasses identification cache', async () => {
  const f = fixture(); await f.ask('Hibisco');
  await f.db.doc('products/b').update({ price: 39 });
  assert.equal((await f.ask('Hibisco')).data.products[0].price_cents, 3900);
});

for (const [label, patch] of [
  ['09 inactive', { status: 'INATIVO' }],
  ['10 missing price', { price: null }],
  ['11 conflicting price', { valor_num: 99 }],
]) test(label, async () => {
  const f = fixture(); await f.db.doc('products/b').update(patch);
  const result = await f.ask('Hibisco');
  if (patch.valor_num) silent(result);
  else {
    assert.equal(result.next_action.send_customer_message, true);
    assert.match(result.data.customer_message, /encomenda/);
    assert.deepEqual(result.data.products, []);
  }
});

for (const [label, message] of [
  ['12 unmatched', 'Planta inexistente'], ['13 unintelligible', 'asdjhqw'],
  ['14 human requested', 'Quero falar com alguém'],
]) test(label, async () => {
  const f = fixture(); const result = await f.ask(message);
  if (label.startsWith('14')) {
    silent(result);
    assert.equal((await f.handoffs.listOpen('conflora')).length, 1);
    assert.equal((await f.handoffs.getConversation('conflora', customerKeyFor('conflora', phone))).automation, 'paused');
  } else {
    assert.equal(result.next_action.send_customer_message, true);
    assert.match(result.data.customer_message, /encomenda/);
    assert.deepEqual(result.data.products, []);
    assert.equal((await f.handoffs.listOpen('conflora')).length, 0);
  }
});

test('15 Firestore unavailable remains silent even if handoff persistence fails', async () => {
  const f = fixture(); f.source.listIdentity = async () => { throw new Error('offline'); };
  f.handoffs.open = async () => { throw new Error('offline'); };
  silent(await f.ask('Hibisco'));
});

function deliveryFixture(f, send) {
  const repo = new FirestoreRepository({ firestoreInstance: f.db });
  const pdv = new PdvService({ repository: new PdvRepository(repo), whatsapp: { sendTextMessage: send, sendImageMessage: send } });
  pdv.catalogAgent = f.agent;
  const messages = new MessageService({ firestoreRepo: repo, whatsappClient: { sendTextMessage: send } });
  messages.metaAgentService = f.agent;
  const handle = messages.handleCustomerMessage.bind(messages);
  messages.handleCustomerMessage = async input => {
    await require('../src/services/conversation-automation').setConversationChannel(repo, input.phone, 'catalog');
    const payload = { ...input, message: input.message === 'Hibisco' ? 'Quanto custa Hibisco?' : input.message };
    await new (require('../src/services/incoming-message.service').IncomingMessageService)(repo).accept(payload);
    return handle(payload);
  };
  return { repo, pdv, messages };
}

test('16 Meta error/timeout pauses conversation and never retries uncertain send', async () => {
  for (const error of [new Error('HTTP 503'), Object.assign(new Error('timeout'), { name: 'TimeoutError' })]) {
    const f = fixture(); let count = 0;
    const { pdv, messages } = deliveryFixture(f, async () => { count++; throw error; });
    await messages.handleCustomerMessage({ phone, message: 'Hibisco', messageId: 'wamid.meta-error' });
    const job = [...f.db.raw.values()].find(v => v.kind === 'conversation-catalog');
    await pdv.deliver(job.id); await pdv.deliver(job.id);
    assert.equal(count, 1); assert.equal((await f.handoffs.listOpen('conflora')).length, 1);
  }
});

test('17 duplicate message queues and sends once, with current price at delivery', async () => {
  const f = fixture(); const sent = [];
  const { pdv, messages } = deliveryFixture(f, async (_phone, text) => { sent.push(text); return { messages: [{ id: 'wamid.sent' }] }; });
  const payload = { phone, message: 'Hibisco', messageId: 'wamid.duplicate' };
  await messages.handleCustomerMessage(payload); await messages.handleCustomerMessage(payload);
  const jobs = [...f.db.raw.values()].filter(v => v.kind === 'conversation-catalog');
  assert.equal(jobs.length, 1); assert.equal(jobs[0].text, undefined);
  await f.db.doc('products/b').update({ price: 42 });
  await pdv.deliver(jobs[0].id); await pdv.deliver(jobs[0].id);
  assert.equal(sent.length, 1); assert.match(sent[0], /R\$ 42,00/);
  assert.equal([...f.db.raw.keys()].filter(k => k.startsWith('orders/')).length, 0);
});

test('18 paused conversation stays paused and pending replies are cancelled', async () => {
  const f = fixture(); let count = 0;
  const { pdv, messages } = deliveryFixture(f, async () => { count++; });
  await messages.handleCustomerMessage({ phone, message: 'Hibisco', messageId: 'wamid.before-pause' });
  silent(await f.ask('Atendente')); silent(await f.ask('Hibisco'));
  const job = [...f.db.raw.values()].find(v => v.kind === 'conversation-catalog');
  await pdv.deliver(job.id); assert.equal(count, 0);
});

test('19 first option photo uses IDs and rereads its price', async () => {
  const f = fixture(); f.agent.imageResolver = async () => 'https://fixture.invalid/registered-photo.jpg';
  const result = await f.ask('Quero uma planta dentro de casa');
  const id = result.data.products[0].id;
  await f.db.doc(`products/${id}`).update({ price: 28 });
  const photo = await f.ask('Manda foto da primeira');
  assert.equal(photo.data.cards[0].id, id); assert.equal(photo.data.cards[0].price_cents, 2800);
  assert.equal(photo.data.photo_requested, true);
  silent(await f.ask('Quanto custa a grande?'));
});

test('20 similar names never picked arbitrarily', async () => {
  const f = fixture({ 'products/e': { name: 'Hibisco vermelho', price: 31, unit: 'UN' }, 'products/f': { name: 'Hibisco amarelo', price: 32, unit: 'UN' } });
  await f.db.doc('products/b').delete(); silent(await f.ask('Hibisco'));
});

test('21 disabled stock cannot produce availability claim', async () => {
  const f = fixture(); await f.db.doc('products/b').update({ stockQuantity: 5 });
  const r = await f.ask('Hibisco'); assert.doesNotMatch(r.data.customer_message, /disponível|estoque/i);
  silent(await f.agent.execute('consultar_produto', { customer_phone: phone, product_id: 'b', intent: 'disponibilidade' }));
});

test('22 image inaccessible, private, generic or redirected is never included', async () => {
  const fixturePhoto = require('./helpers/actual-photo-fixture').actualPhotoFixture('a', 'photo.jpg');
  const bucket = require('../src/config/env').firebase.storageBucket;
  const good = fixturePhoto.imageUrl;
  let calls = 0;
  const fetcher = async (_url, options) => { calls++; assert.equal(options.redirect, 'error'); return { ok: false }; };
  assert.equal(await verifiedProductImage({ id: 'a', ...fixturePhoto, images: ['http://127.0.0.1/private', 'https://images.unsplash.com/photo', good] }, { bucket, fetcher }), null);
  assert.equal(calls, 1);
  assert.equal(await verifiedProductImage({ id: 'a', ...fixturePhoto }, { bucket, fetcher: async () => ({ ok: true, headers: new Map([['content-type', 'image/jpeg'], ['content-length', '100']]) }) }), good);
});

function callRoute(router, url, { key, body = {}, method = 'POST', user } = {}) {
  return new Promise((resolve, reject) => {
    const req = { method, url, headers: key ? { 'x-conflora-agent-key': key } : {}, body, user };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { resolve({ status: this.statusCode, body: value }); } };
    router.handle(req, res, error => error ? reject(error) : resolve({ status: 404 }));
  });
}

test('23 connector credentials absent/invalid fail closed; no default or admin fallback', async () => {
  const f = fixture();
  const disabled = createMetaAgentRoutes({ agentService: f.agent, handoffStore: f.handoffs, apiKey: '' });
  assert.equal((await callRoute(disabled, '/consultar_produto', { key: 'conflora-agent-secret-key' })).status, 401);
  const router = createMetaAgentRoutes({ agentService: f.agent, handoffStore: f.handoffs, apiKey: 'fixture-key', connectorEnabled: true });
  assert.equal((await callRoute(router, '/consultar_produto', { key: 'wrong' })).status, 401);
  const result = await callRoute(router, '/consultar_produto', { key: 'fixture-key', body: { customer_phone: phone, query: 'Hibisco' } });
  assert.equal(result.body.status, 'found');
});

test('24 invalid webhook signature rejected', () => {
  const v = new SignatureValidator('fixture-secret');
  assert.equal(v.validate(Buffer.from('{}'), 'sha256=invalid'), false);
  assert.equal(v.validate(Buffer.from('{}'), undefined), false);
});

test('25 Cloud API owner prevents connector replies when both integrations exist', async () => {
  const f = fixture(); const router = createMetaAgentRoutes({ agentService: f.agent, handoffStore: f.handoffs, apiKey: 'fixture-key' });
  const r = await callRoute(router, '/consultar_produto', { key: 'fixture-key', body: { customer_phone: phone, query: 'Hibisco' } });
  assert.equal(r.status, 409); assert.equal(r.body.next_action.send_customer_message, false);
});

test('26 handoff never calls transport, AI, cart, payment or stock services', async () => {
  const f = fixture(); const fail = () => { assert.fail('Unexpected side effect'); };
  const { messages } = deliveryFixture(f, fail);
  messages.agentService = { generateResponse: fail }; messages.orderService = new Proxy({}, { get: () => fail });
  const r = await messages.handleCustomerMessage({ phone, message: 'não sei qual é', messageId: 'wamid.handoff' });
  assert.equal(r.reply, ''); assert.equal(r.intent, 'AMBIGUOUS_NEEDS_HUMAN');
  assert.equal([...f.db.raw.values()].filter(v => v.kind === 'conversation-catalog').length, 0);
});

test('27 expired identity index refresh failure cannot serve old catalog', async () => {
  const f = fixture(); await f.ask('Hibisco');
  f.index.loadedAt = Date.now() - 600000; f.source.listIdentity = async () => { throw new Error('offline'); };
  silent(await f.ask('Hibisco'));
});

test('traits revoked after identification are rejected on fresh document read', async () => {
  const f = fixture(); await f.index.ensureFresh();
  await f.db.doc('products/b').update({ botanical: { approved: false } });
  const result = await f.ask('Tem plantas pra sol?');
  assert.deepEqual(result.data.products, []);
  assert.equal(result.data.kind, 'ORDER_INTAKE');
});

test('AI descriptions and unknown/negative qualifiers are never botanical evidence', async () => {
  const f = fixture({ 'products/g': { name: 'Planta teste', price: 9, unit: 'UN', iluminacao: 'Sol pleno', ambiente_ideal: 'Dentro de casa' } });
  const r = await f.ask('Tem planta pra sol?'); assert.deepEqual(r.data.products.map(p => p.id), ['b']);
  silent(await f.ask('Quero uma planta para sol forte que não seja tóxica'));
  assert.equal(interpretTraits('Quero uma planta para sol forte e resistente ao frio').unsupported, true);
});

test('handoff creation is atomic and idempotent across concurrent requests; authorized resume only', async () => {
  const f = fixture(); const customerKey = customerKeyFor('conflora', phone);
  await Promise.all(Array.from({ length: 5 }, (_, n) => f.handoffs.open({ tenantId: 'conflora', customerKey, requestId: `req-${n}`, reason: 'fixture' })));
  const list = await f.handoffs.listOpen('conflora'); assert.equal(list.length, 1);
  assert.equal((await f.handoffs.resume('other', list[0].id, { id: 'staff', role: 'ADMIN' })).ok, false);
  assert.equal((await f.handoffs.resume('conflora', list[0].id, { id: 'staff', role: 'ADMIN' })).ok, true);
  assert.equal((await f.ask('Hibisco')).status, 'found');
});

test('at most three verified options; names remain ambiguous for a specific query', async () => {
  const f = fixture();
  for (let n = 0; n < 5; n++) await f.db.doc(`products/extra-${n}`).set({ name: `Planta ${n}`, price: 10 + n, unit: 'UN', botanical: botanical({ environment: ['interno'] }) });
  const r = await f.ask('Quero uma planta dentro de casa');
  assert.equal(r.data.products.length, 3);
});

test('index TTL cannot be extended by refresh throttle after an expired load', async () => {
  const f = fixture(); let clock = 1000;
  const index = new ProductIndex({ source: f.source, now: () => clock, ttlMs: 100, minRefreshGapMs: 15000 });
  await index.ensureFresh(); clock += 200;
  f.source.listIdentity = async () => { throw new Error('offline'); };
  await assert.rejects(index.ensureFresh(), /offline/);
  assert.equal(index.isFresh(), false);
});

test('mixed numeric/string price conflicts are not silently ignored', async () => {
  const f = fixture(); await f.db.doc('products/b').update({ VALOR: 'R$ 99,00' });
  silent(await f.ask('Hibisco'));
});

test('Meta owner disables Cloud API processing and delivery', async () => {
  const config = require('../src/config/env'); const previous = config.whatsapp.agentOwner;
  try {
    config.whatsapp.agentOwner = 'meta_native';
    const f = fixture(); let sends = 0;
    const { messages } = deliveryFixture(f, async () => { sends++; });
    const result = await messages.handleCustomerMessage({ phone, message: 'Hibisco', messageId: 'wamid.native-owned' });
    assert.equal(result.intent, 'AUTOMATION_DISABLED'); assert.equal(sends, 0);
    assert.equal(f.agent.metrics.requests, 0);
  } finally { config.whatsapp.agentOwner = previous; }
});

test('agent timeout cannot authorize a late response or reactivate automation', async () => {
  const f = fixture(); f.agent.timeoutMs = 5;
  const original = f.source.getProducts.bind(f.source);
  let release;
  f.source.getProducts = async ids => { await new Promise(resolve => { release = resolve; }); return original(ids); };
  const result = await f.ask('Hibisco'); silent(result); release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((await f.handoffs.getConversation('conflora', customerKeyFor('conflora', phone))).automation, 'paused');
});
