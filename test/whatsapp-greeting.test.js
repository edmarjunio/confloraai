process.env.NODE_ENV = 'test';
process.env.WHATSAPP_AI_ENABLED = 'true';
process.env.WHATSAPP_AGENT_OWNER = 'cloud_api';

const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { MessageService } = require('../src/services/message.service');
const { recognizeGreeting } = require('../src/shared/greeting');
const { conversationAutomation, setConversationChannel } = require('../src/services/conversation-automation');

const phone = '5564999990000';

function fixture() {
  const repository = new FirestoreRepository({ isInMemory: true });
  const sends = [];
  const send = async (kind, recipient, body) => {
    sends.push({ kind, recipient, body });
    return { messages: [{ id: `wamid.greeting-${sends.length}` }] };
  };
  const unexpected = () => { throw new Error('A greeting must not enter product or order processing.'); };
  const service = new MessageService({ firestoreRepo: repository, whatsappClient: {
    sendTextMessage: (recipient, body) => send('text', recipient, body),
    sendInteractiveButtons: (recipient, body) => send('menu', recipient, body),
  } });
  service.orderIntake = { handle: unexpected };
  service.metaAgentService = { execute: unexpected };
  return { repository, store: new PdvRepository(repository), service, sends };
}

for (const message of ['Boa noiteeee', 'BOAAA NOITEEE!!! 🌙', 'Bom diaaaa!', 'Boa tardeee, tudo beeem?', 'Oiiii', 'Olááá!!!']) {
  test(`standalone greeting opens the menu without offering an order: ${message}`, async () => {
    const { store, service, sends } = fixture();
    const result = await service.handleCustomerMessage({ phone, message });
    assert.equal(result.intent, 'MAIN_MENU_SENT');
    assert.doesNotMatch(result.reply, /encomendar|registrar/i);
    assert.equal(sends.length, 1);
    assert.equal(sends[0].kind, 'menu');
    assert.deepEqual(sends[0].body.buttons.map(button => button.id), ['catalogo_virtual', 'montar_sacola', 'btn_atendente']);
    assert.equal((await store.read('sessions', phone))?.orderIntake, undefined);
  });
}

for (const channel of ['cart', 'agent']) {
  test(`greeting preserves the active ${channel} channel and pending order`, async () => {
    const { repository, store, service, sends } = fixture();
    await setConversationChannel(repository, phone, channel);
    const draft = { id: 'existing-request', status: 'AWAITING_CONFIRMATION', items: [{ requestedName: 'Alface', quantity: 2 }] };
    await store.transaction(async tx => tx.set('sessions', phone, { orderIntake: draft }));
    const result = await service.handleCustomerMessage({ phone, message: 'Boa noiteeee' });
    assert.equal(result.intent, 'GREETING_SENT');
    assert.match(result.reply, /^Boa noite!/);
    assert.equal(sends[0].kind, 'text');
    assert.equal((await conversationAutomation(repository, phone)).channel, channel);
    assert.deepEqual((await store.read('sessions', phone)).orderIntake, draft);
  });
}

test('greetings never resume a conversation paused for human review', async () => {
  const { repository, service, sends } = fixture();
  await conversationAutomation(repository, phone, { pauseReason: 'customer_declined_bot' });
  const result = await service.handleCustomerMessage({ phone, message: 'Boa noiteeee' });
  assert.equal(result.intent, 'HUMAN_HANDOFF_ACTIVE');
  assert.equal(sends.length, 0);
});

test('any first message opens the three choices before processing products', async () => {
  const { service, sends } = fixture();
  const message = 'Boa noite, tem alface?';
  assert.equal(recognizeGreeting(message), null);
  const result = await service.handleCustomerMessage({ phone, message });
  assert.equal(result.intent, 'MAIN_MENU_SENT');
  assert.equal(sends[0].kind, 'menu');
});
