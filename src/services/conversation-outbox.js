const { AsyncLocalStorage } = require('node:async_hooks');
const { createHash } = require('node:crypto');
const { PdvRepository } = require('../orders/pdv.repository');

function createConversationOutbox(repository, client) {
  const context = new AsyncLocalStorage(); const store = new PdvRepository(repository);
  const transport = client && new Proxy(client, {
    get(target, property) {
      const original = target[property];
      if (typeof original !== 'function') return original;
      if (property !== 'sendTextMessage') return original.bind(target);
      return async (phone, text) => {
        const current = context.getStore();
        if (!current) return original.call(target, phone, text);
        const id = 'conversation-' + createHash('sha256').update(current.messageId + ':' + current.sequence++).digest('hex');
        await store.transaction(async tx => {
          if (await tx.get('pdv_outbox', id)) return;
          tx.set('pdv_outbox', id, { id, recipient: phone, text, kind: 'conversation-text', status: 'PENDING', attempts: 0, createdAt: new Date().toISOString() });
        });
        // Persistence acknowledges intent; only provider callbacks acknowledge delivery.
        return { queued: true, messages: [] };
      };
    },
  });
  return { client: transport, run: (messageId, work) => context.run({ messageId, sequence: 0 }, work) };
}
module.exports = { createConversationOutbox };
