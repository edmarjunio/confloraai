const { requestId, normalizePhone } = require('./pdv.service');

class CustomerDebtPixService {
  constructor({ store, pix, pdv }) { Object.assign(this, { store, pix, pdv }); }

  async profile(user) {
    if (!user) throw new Error('Entre na sua conta.');
    const profiles = await this.store.repository.findCustomerProfilesByEmail(user.email);
    if (profiles.length !== 1) throw new Error('Peça à loja para verificar o vínculo do seu cadastro.');
    return profiles[0];
  }

  async create(input, user) {
    if (require('./pix-mode').pixMode() !== 'SICREDI') {
      throw Object.assign(new Error('A quitação por Pix está sendo conferida pelo caixa. Fale com a loja para registrar o pagamento da dívida.'), { status: 409 });
    }
    const customer = await this.profile(user);
    const id = requestId(input.requestId);
    const amount = Number(input.amount);
    const minor = Math.round(amount * 100);
    if (!Number.isSafeInteger(minor) || minor <= 0 || Math.abs(amount * 100 - minor) > 0.00001) throw new Error('Informe um valor válido em centavos.');
    let charge = await this.store.transaction(async (tx) => {
      const previous = await tx.get('customer_debt_pix', id);
      if (previous) {
        if (previous.userId !== user.id || previous.customerKey !== customer.id || previous.amount !== amount) throw new Error('Operação já utilizada.');
        return previous;
      }
      const current = await tx.get('customers', customer.id);
      if (minor > Math.round(Number(current?.debtBalance || 0) * 100)) throw new Error('O valor não pode superar a dívida atual. Atualize o saldo.');
      // Dedicated non-hex prefix prevents collision with sale UUID txids.
      const entry = { id, txid: 'DBT' + id.replace(/-/g, '').toUpperCase(), customerKey: customer.id, userId: user.id, amount, customerName: customer.name, customerPhone: normalizePhone(customer.phone), status: 'CREATING_PIX', createdAt: new Date().toISOString() };
      tx.set('customer_debt_pix', id, entry);
      return entry;
    });
    if (charge.pixData || charge.status === 'PAID') return charge;
    const pixData = await this.pix.createCharge({ amount, txid: charge.txid, ticketNumber: 'DÍVIDA-' + id.slice(0, 8) });
    charge = await this.store.transaction(async (tx) => {
      const current = await tx.get('customer_debt_pix', id);
      const updated = { ...current, pixData, status: current.status === 'PAID' ? 'PAID' : 'AWAITING_PIX' };
      tx.set('customer_debt_pix', id, updated);
      return updated;
    });
    return charge;
  }

  async handlePix(txid, endToEndId) {
    const entries = await this.store.list('customer_debt_pix', 'txid', txid);
    const charge = entries[0];
    if (!charge) return false;
    if (charge.status !== 'PAID') {
      const result = await this.pix.checkReceivedPayment(endToEndId);
      const payment = result.raw;
      if (!result.isPaid || payment?.endToEndId !== endToEndId || payment.txid !== txid || payment.chave !== this.pix.pixKey || Math.round(Number(payment.valor) * 100) !== Math.round(charge.amount * 100) || (payment.devolucoes || []).length) throw new Error('Pagamento de dívida divergente no Sicredi.');
      await this.store.transaction(async (tx) => {
        const current = await tx.get('customer_debt_pix', charge.id);
        const customer = await tx.get('customers', charge.customerKey);
        if (current.status === 'PAID') return;
        if (!customer) throw new Error('Cadastro financeiro não encontrado.');
        const balance = Math.round(Number(customer.debtBalance || 0) * 100);
        const amount = Math.round(charge.amount * 100);
        const applied = Math.min(Math.max(balance, 0), amount);
        const excess = amount - applied;
        const now = new Date().toISOString();
        const receiver = { id: 'SICREDI', name: 'Sicredi · confirmação automática', role: 'SYSTEM' };
        const newBalance = (balance - applied) / 100;
        const newCreditBalance = (Math.round(Number(customer.creditBalance || 0) * 100) + excess) / 100;
        tx.set('customers', charge.customerKey, { ...customer, debtBalance: newBalance, creditBalance: newCreditBalance, updatedAt: now });
        const settlement = { id: charge.id, customerKey: charge.customerKey, customerName: charge.customerName, customerPhone: charge.customerPhone, amount: charge.amount, appliedAmount: applied / 100, excessCredit: excess / 100, paymentMethod: 'PIX', type: 'QUITACAO_FIADO', entryType: 'QUITACAO_FIADO', receivedBy: receiver, operatorName: receiver.name, newBalance, newCreditBalance, paymentTransactionId: endToEndId, verifiedVia: 'SICREDI_PIX_WEBHOOK', createdAt: now, notes: 'Pagamento autônomo pelo cliente' };
        tx.set('debt_settlements', charge.id, settlement);
        tx.set('customer_debt_pix', charge.id, { ...current, status: 'PAID', paidAt: now, newBalance, excessCredit: excess / 100, paymentTransactionId: endToEndId });
        tx.set('pdv_outbox', charge.id, { id: charge.id, settlementId: charge.id, kind: 'debt-receipt', status: 'PENDING', attempts: 0 });
        const ownerId = charge.id + '-owner';
        tx.set('pdv_outbox', ownerId, { id: ownerId, settlementId: charge.id, kind: 'owner-debt-paid', status: 'PENDING', attempts: 0 });
      });
    }
    await this.pdv.deliver(charge.id);
    await this.pdv.deliver(charge.id + '-owner');
    return true;
  }

  async read(id, user) {
    requestId(id);
    const customer = await this.profile(user);
    const charge = await this.store.read('customer_debt_pix', id);
    if (!charge || charge.userId !== user.id || charge.customerKey !== customer.id) throw new Error('Cobrança não encontrada.');
    return charge;
  }
}
module.exports = { CustomerDebtPixService };
