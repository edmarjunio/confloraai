const { PdvRepository } = require('../orders/pdv.repository');
const { createHash, randomUUID } = require('node:crypto');

class IncomingMessageService {
  constructor(repository) { this.store = new PdvRepository(repository); }
  id(value) { return createHash('sha256').update(String(value)).digest('hex'); }
  async accept(payload) {
    const id = this.id(payload.messageId);
    await this.store.transaction(async tx => {
      if (await tx.get('incoming_messages', id)) return;
      tx.set('incoming_messages', id, { id, payload, status: 'PENDING', attempts: 0, createdAt: new Date().toISOString() });
    });
  }
  async claim(messageId) {
    const id = this.id(messageId); const owner = randomUUID();
    return this.store.transaction(async tx => {
      const current = await tx.get('incoming_messages', id);
      if (current?.status === 'COMPLETED') return { completed: true };
      if (current?.status === 'NEEDS_RECONCILIATION') throw Object.assign(new Error('Mensagem exige conferência operacional.'), { status: 409 });
      if (current?.nextAttemptAt > Date.now()) throw Object.assign(new Error('Mensagem em backoff.'), { status: 503 });
      if (current?.leaseUntil > Date.now()) throw Object.assign(new Error('Mensagem em processamento. Tente novamente.'), { status: 503 });
      tx.set('incoming_messages', id, { ...current, id, status: 'PROCESSING', owner, attempts: Number(current?.attempts || 0) + 1, leaseUntil: Date.now() + 120000, expiresAt: null });
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
        status: error ? (current.attempts >= maximum ? 'NEEDS_RECONCILIATION' : 'PENDING') : 'COMPLETED',
        leaseUntil: 0, lastError: error ? 'PROCESSING_FAILED' : '',
        nextAttemptAt: error ? Date.now() + Math.min(3600000, 15000 * 2 ** Math.min(current.attempts, 8)) : 0,
        ...(error ? {} : { completedAt: new Date().toISOString(), compactAfter: new Date(Date.now() + 30 * 86400000) }),
        // Completion tombstones must survive indefinitely for persistent deduplication.
        expiresAt: null });
    });
  }
  async retry(processMessage) {
    const pending = await this.store.scanPage('incoming_messages', 'status', 'PENDING', 25);
    const interrupted = await this.store.scanPage('incoming_messages', 'status', 'PROCESSING', 25);
    for (const event of [...pending, ...interrupted].filter(row => row.payload && !(row.leaseUntil > Date.now()) && !(row.nextAttemptAt > Date.now())).slice(0, 50)) {
      try { await processMessage(event.payload); }
      catch (error) { require('../shared/logger').error('Falha ao processar mensagem recebida', error, { source: 'WHATSAPP', eventId: event.id }); }
    }
  }
}
module.exports = { IncomingMessageService };
