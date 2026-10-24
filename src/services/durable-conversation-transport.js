const { createHash, randomUUID } = require('node:crypto');
const { runTransaction } = require('../database/transactions');
const { conversationAutomation } = require('./conversation-automation');

/** Persist submission checkpoints before native sends. Uncertain outcomes require a human, never replay. */
function durableConversationTransport(repo, client, { phone, messageId, version }) {
  if (!client) return null;
  const scope = messageId || randomUUID();
  const calls = new Map();
  return new Proxy(client, { get(target, method) {
    const original = target[method];
    if (typeof original !== 'function') return original;
    if (!String(method).startsWith('send')) return original.bind(target);
    return async (...args) => {
      const { assertAutomation, withAutomation } = require('./automation-send-guard');
      await assertAutomation(repo, phone, version);
      const key = `${String(method)}:${String(args[0])}`;
      const index = calls.get(key) || 0; calls.set(key, index + 1);
      const id = 'native-' + createHash('sha256').update(`${scope}:${key}:${index}`).digest('hex');
      const claim = await runTransaction(repo, async tx => {
        const previous = await tx.get('pdv_outbox', id);
        if (previous?.status === 'SENT') return { acknowledged: previous.providerMessageId };
        if (previous && Number(previous.conversationVersion || 0) !== Number(version || 0)) return { blocked: true };
        if (previous && previous.status !== 'RETRYABLE') return { uncertain: true };
        if (Number(previous?.attempts || 0) >= 12) return { uncertain: true };
        const job = { id, kind: 'conversation-native', recipient: phone, sourceMessageId: messageId || '', conversationVersion: Number(version || 0), status: 'SENDING',
          sendingStage: String(method), createdAt: previous?.createdAt || new Date().toISOString(),
          sendingAt: new Date().toISOString(), attempts: Number(previous?.attempts || 0) + 1, leaseUntil: 0 };
        tx.set('pdv_outbox', id, job);
        return { job };
      });
      if (claim.acknowledged) return { messages: [{ id: claim.acknowledged }] };
      if (claim.blocked) throw require('./automation-send-guard').blocked();
      const uncertain = async () => {
        const error = Object.assign(new Error('Entrega WhatsApp incerta. Atendimento humano necessário.'), { requiresReconciliation: true });
        try { await conversationAutomation(repo, phone, { pauseReason: 'native_delivery_unconfirmed', messageId: id }); }
        catch { /* The durable SENDING marker still blocks every future submission. */ }
        throw error;
      };
      if (claim.uncertain) return uncertain();
      try {
        const result = await withAutomation(repo, phone, version, async () => {
          await assertAutomation(repo, phone, version);
          return original.apply(target, args);
        });
        const providerMessageId = result?.messages?.[0]?.id;
        if (!providerMessageId || result.mock) throw new Error('PROVIDER_NOT_ACKNOWLEDGED');
        await runTransaction(repo, async tx => {
          const job = await tx.get('pdv_outbox', id);
          if (job?.status !== 'SENDING') throw new Error('SUBMISSION_CHECKPOINT_CHANGED');
          tx.set('pdv_outbox', id, { ...job, status: 'SENT', providerMessageId, sentAt: new Date().toISOString(), completedAt: new Date().toISOString() });
          const providerKey = createHash('sha256').update(providerMessageId).digest('hex');
          tx.set('whatsapp_delivery', providerKey, { id: providerKey, providerMessageId, outboxId: id, source: 'CLOUD_API_AUTOMATION', createdAt: new Date().toISOString() });
        });
        return result;
      } catch (error) {
        try {
          await runTransaction(repo, async tx => {
            const job = await tx.get('pdv_outbox', id);
            tx.set('pdv_outbox', id, { ...job, status: error.definitelyNotSent === true ? 'RETRYABLE' : 'NEEDS_RECONCILIATION', lastError: error.definitelyNotSent === true ? 'NOT_SUBMITTED' : 'PROVIDER_OUTCOME_UNCERTAIN' });
          });
        } catch { /* Keep the original durable submission marker. */ }
        if (error.definitelyNotSent === true) throw error;
        return uncertain();
      }
    };
  } });
}

module.exports = { durableConversationTransport };
