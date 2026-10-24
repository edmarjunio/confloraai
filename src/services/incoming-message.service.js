const { PdvRepository } = require('../orders/pdv.repository');
const { createHash, randomUUID } = require('node:crypto');

class IncomingMessageService {
  constructor(repository, { now = Date.now } = {}) { this.store = new PdvRepository(repository); this.now = now; }
  id(value) { return createHash('sha256').update(String(value)).digest('hex'); }
  async accept(payload) {
    const id = this.id(payload.messageId);
    await this.store.transaction(async tx => {
      if (await tx.get('incoming_messages', id)) return;
      tx.set('incoming_messages', id, { id, payload, status: 'PENDING', attempts: 0, createdAt: new Date(this.now()).toISOString() });
    });
  }
  async claim(messageId) {
    const id = this.id(messageId); const owner = randomUUID();
    return this.store.transaction(async tx => {
      const current = await tx.get('incoming_messages', id);
      if (current?.status === 'COMPLETED') return { completed: true };
      if (current?.status === 'NEEDS_RECONCILIATION') throw Object.assign(new Error('Mensagem exige conferência operacional.'), { status: 409 });
      if (current?.nextAttemptAt > this.now()) throw Object.assign(new Error('Mensagem em backoff.'), { status: 503 });
      if (current?.leaseUntil > this.now()) throw Object.assign(new Error('Mensagem em processamento. Tente novamente.'), { status: 503 });

      // Agregação e concatenação durável de mensagens do mesmo remetente na janela curta de 3.5s
      const phone = current?.payload?.phone;
      if (phone) {
        const senderKey = this.id(`aggregation_${phone}`);
        const aggState = await tx.get('incoming_aggregations', senderKey);
        const windowMs = Number(process.env.MESSAGE_AGGREGATION_WINDOW_MS) || 3500;
        const now = this.now();

        let aggregatedMessage = current?.payload?.message || '';
        let messageIds = [messageId];

        if (aggState && aggState.lastMessageAt && (now - aggState.lastMessageAt) < windowMs) {
          if (aggState.aggregatedMessage) {
            aggregatedMessage = `${aggState.aggregatedMessage}\n${aggregatedMessage}`;
          }
          if (Array.isArray(aggState.messageIds)) {
            messageIds = [...new Set([...aggState.messageIds, messageId])];
          }
        }

        tx.set('incoming_aggregations', senderKey, {
          id: senderKey,
          phone,
          lastMessageAt: now,
          processingMessageId: messageId,
          aggregatedMessage,
          messageIds,
          updatedAt: new Date(now).toISOString(),
        });

        if (current?.payload) {
          current.payload.message = aggregatedMessage;
        }
      }

      tx.set('incoming_messages', id, { ...current, id, status: 'PROCESSING', owner, attempts: Number(current?.attempts || 0) + 1, leaseUntil: this.now() + 120000, expiresAt: null });
      return { id, owner };
    });
  }
  async finish(claim, error = null) {
    await this.store.transaction(async tx => {
      const current = await tx.get('incoming_messages', claim.id);
      if (current?.status === 'COMPLETED') return;
      if (current?.owner !== claim.owner) throw new Error('A posse do processamento mudou.');
      const maximum = Math.max(1, Number(process.env.INCOMING_MAX_ATTEMPTS) || 12);
      tx.set('incoming_messages', claim.id, { ...current,
        status: error ? (error.requiresReconciliation === true || current.attempts >= maximum ? 'NEEDS_RECONCILIATION' : 'PENDING') : 'COMPLETED',
        leaseUntil: 0, lastError: error ? 'PROCESSING_FAILED' : '',
        nextAttemptAt: error ? this.now() + Math.min(3600000, 15000 * 2 ** Math.min(current.attempts, 8)) : 0,
        ...(error ? {} : { completedAt: new Date(this.now()).toISOString(), compactAfter: new Date(this.now() + 30 * 86400000) }),
        // Completion tombstones must survive indefinitely for persistent deduplication.
        expiresAt: null });
    });
  }
  async retry(processMessage) {
    const pending = await this.store.scanPage('incoming_messages', 'status', 'PENDING', 25);
    const interrupted = await this.store.scanPage('incoming_messages', 'status', 'PROCESSING', 25);
    for (const event of [...pending, ...interrupted].filter(row => row.payload && !(row.leaseUntil > this.now()) && !(row.nextAttemptAt > this.now())).slice(0, 50)) {
      try { await processMessage(event.payload); }
      catch (error) { require('../shared/logger').error('Falha ao processar mensagem recebida', error, { source: 'WHATSAPP', eventId: event.id }); }
    }
  }
}
module.exports = { IncomingMessageService };
