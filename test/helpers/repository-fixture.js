// Test-only operators. This file is excluded from every deployment package.
const original = require('../../src/database/firestore.repository');

class FirestoreRepository extends original.FirestoreRepository {
  constructor(options = {}) {
    super(options);
    const config = structuredClone(require('../../config/stores/conflora.json'));
    config.checkout.enabledPayments = ['PIX', 'CASH', 'CREDITO', 'DEBITO'];
    config.checkout.pix = { key: process.env.PIX_KEY || '52998224725', recipientName: 'Loja de teste' };
    config.checkout.pickup.enabled = true;
    config.checkout.delivery = { enabled: true, label: 'Entrega', serviceAreas: ['Mineiros'], feeMinor: 0 };
    this.storefrontSettings = { config };
    if (!this.isInMemory || this.firestore) return;
    for (const user of [
      { id: 'usr-edmar', name: 'Edmar Júnio (Izibola)', email: 'edmarjuniob@gmail.com', role: 'ADMIN', pin: '1234' },
      { id: 'usr-caixa1', name: 'Atendente do Caixa', email: 'caixa1@conflora.com.br', role: 'CAIXA', pin: '0000' },
      { id: 'usr-entregador1', name: 'Entregador Conflora', email: 'entregador1@conflora.test', role: 'ENTREGADOR', pin: '2222' },
    ]) this.inMemoryUsers.set(user.id, { ...user, active: true, createdAt: new Date().toISOString() });
  }
}

module.exports = { ...original, FirestoreRepository };
