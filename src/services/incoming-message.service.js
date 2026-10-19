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
      if (current?.leaseUntil > Date.now()) throw Object.assign(new Error('Mensagem em processamento. Tente novamente.'), { status: 503 });
      tx.set('incoming_messages', id, { ...current, id, status: 'PROCESSING', owner, attempts: Number(current?.attempts || 0) + 1, leaseUntil: Date.now() + 120000 });
      return { id, owner };
    });
  }
  async finish(claim, error = null) {
    await this.store.transaction(async tx => {
      const current = await tx.get('incoming_messages', claim.id);
      if (current?.owner !== claim.owner) throw new Error('A posse do processamento mudou.');
      tx.set('incoming_messages', claim.id, { ...current, status: error ? 'PENDING' : 'COMPLETED', leaseUntil: 0, lastError: error ? 'PROCESSING_FAILED' : '', expiresAt: new Date(Date.now() + 30 * 86400000) });
    });
  }
  async retry(processMessage) {
    const pending = await this.store.list('incoming_messages', 'status', 'PENDING');
    const interrupted = await this.store.list('incoming_messages', 'status', 'PROCESSING');
    for (const event of [...pending, ...interrupted].filter(row => row.payload && !(row.leaseUntil > Date.now())).slice(0, 50)) {
      try { await processMessage(event.payload); }
      catch (error) { require('../shared/logger').error('Falha ao processar mensagem recebida', error, { source: 'WHATSAPP', eventId: event.id }); }
    }
  }
}
module.exports = { IncomingMessageService };
