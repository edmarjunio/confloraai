const { createHash, randomUUID } = require('node:crypto');
const { moneyCents } = require('../integrations/sicredi-pix.client');

/**
 * @typedef {Object} PaymentEvidence
 * @property {boolean} isPaid
 * @property {string} txid
 * @property {string} pixKey
 * @property {string} endToEndId
 * @property {number} amount
 * @property {string} paidAt ISO 8601 timestamp returned by the bank.
 */

class SicrediPaymentService {
  constructor({ repository, client, whatsapp }) {
    this.repository = repository;
    this.client = client;
    this.whatsapp = whatsapp;
  }

  get db() {
    if (!this.repository.firestore || this.repository._firestoreClientDisabled) {
      throw new Error('Firestore indisponível para conciliação Sicredi.');
    }
    return this.repository.firestore;
  }

  async readOrder(id) {
    const snap = await this.db.collection('orders').doc(id).get();
    if (!snap.exists || snap.data().paymentProvider !== 'SICREDI') { throw new Error('Venda Sicredi não encontrada.'); }
    return { ...snap.data(), id: snap.id };
  }

  /** Persist intent before contacting bank; request key survives retries/restarts. */
  async create(order, requestId) {
    if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId || '')) { throw new Error('Envie Idempotency-Key válido.'); }
    if (!this.client.isOfficialApiConfigured) { throw new Error('Integração Sicredi ainda não configurada.'); }
    moneyCents(Number(order.total).toFixed(2));
    const txid = createHash('sha256').update(`${order.operatorId}:${requestId}`).digest('hex').slice(0, 32);
    const id = `sicredi_${txid}`;
    const fingerprint = createHash('sha256').update(JSON.stringify(order)).digest('hex');
    const ref = this.db.collection('orders').doc(id);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) {
        if (snapshot.data().requestFingerprint !== fingerprint) { throw new Error('Chave de tentativa reutilizada para outra venda.'); }
        return;
      }
      const now = new Date().toISOString();
      transaction.set(ref, { ...order, id, ticketNumber: txid.slice(-6), txid, pixKey: this.client.pixKey,
        paymentProvider: 'SICREDI', paymentMethod: 'PIX', status: 'AGUARDANDO_PAGAMENTO',
        requestFingerprint: fingerprint, createdAt: now, updatedAt: now });
      transaction.set(this.db.collection('sicredi_jobs').doc(txid), { orderId: id, pending: true, createdAt: now });
    });
    await this.ensureCharge(id);
    // Falha de envio não invalida a cobrança já persistida.
    await this.deliver(id).catch(() => {});
    return this.readOrder(id);
  }

  async ensureCharge(id) {
    const order = await this.readOrder(id);
    if (order.pix || order.paymentStatus === 'PAGO') { return order; }
    if (order.status !== 'AGUARDANDO_PAGAMENTO') { throw new Error('Venda não está aguardando Pix.'); }
    const charge = await this.client.createCharge({ txid: order.txid, amount: order.total, description: `Pedido Conflora #${order.ticketNumber}` });
    await this.db.runTransaction(async (transaction) => {
      const ref = this.db.collection('orders').doc(id);
      const current = (await transaction.get(ref)).data();
      if (current.pix) { return; }
      transaction.update(ref, { pix: charge, pixCode: charge.pixCopiaECola, updatedAt: new Date().toISOString() });
      transaction.set(this.db.collection('sicredi_outbox').doc(`${id}_charge`), { orderId: id, kind: 'charge', step: 0, pending: true, leaseUntil: 0 });
    });
    return this.readOrder(id);
  }

  async reconcile(id) {
    let order = await this.readOrder(id);
    if (order.paymentStatus === 'PAGO') { return order; }
    const jobRef = this.db.collection('sicredi_jobs').doc(order.txid);
    const owner = randomUUID();
    const acquired = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(jobRef);
      if (!snapshot.exists || (snapshot.data().leaseUntil || 0) > Date.now()) { return false; }
      transaction.update(jobRef, { owner, leaseUntil: Date.now() + 90000 });
      return true;
    });
    if (!acquired) { return order; }
    try {
      // A cobrança pode ter sido criada antes de uma queda na persistência da resposta.
      if (!order.pix) { order = await this.ensureCharge(id); }
      const evidence = await this.client.checkChargeStatus(order.txid, order);
      if (!evidence.isPaid) { return order; }
      await this.settle(id, evidence);
      await this.deliver(id).catch(() => {});
      return this.readOrder(id);
    } finally {
      await this.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(jobRef);
        if (snapshot.data()?.owner === owner) { transaction.update(jobRef, { leaseUntil: Date.now() + 3000 }); }
      });
    }
  }

  /**
   * Payment + ledger + receipt outbox commit atomically, using bank's E2E as unique key.
   * @param {string} id
   * @param {PaymentEvidence} evidence Evidence obtained exclusively via the bank client.
   */
  async settle(id, evidence) {
    const db = this.db;
    await db.runTransaction(async (transaction) => {
      const ref = db.collection('orders').doc(id);
      const snapshot = await transaction.get(ref);
      const order = snapshot.data();
      if (!order || order.paymentProvider !== 'SICREDI' || !evidence.isPaid || evidence.txid !== order.txid ||
          evidence.pixKey !== order.pixKey || evidence.pixKey !== this.client.pixKey ||
          !/^E[a-zA-Z0-9]{31}$/.test(evidence.endToEndId || '') ||
          !Number.isFinite(Date.parse(evidence.paidAt)) ||
          moneyCents(Number(order.total).toFixed(2)) !== moneyCents(Number(evidence.amount).toFixed(2))) {
        throw new Error('Evidência bancária incompatível com a venda.');
      }
      if (order.paymentStatus === 'PAGO') {
        if (order.paymentTransactionId !== evidence.endToEndId) { throw new Error('Pagamento duplicado exige conciliação.'); }
        return;
      }
      const ledgerRef = db.collection('cash_movements').doc(`sicredi_${evidence.endToEndId}`);
      const ledger = await transaction.get(ledgerRef);
      if (ledger.exists) { throw new Error('Liquidação já vinculada a outro lançamento.'); }
      const now = new Date().toISOString();
      transaction.set(ledgerRef, { orderId: id, type: 'ENTRADA', paymentMethod: 'PIX', provider: 'SICREDI',
        amount: evidence.amount, amountCents: moneyCents(Number(evidence.amount).toFixed(2)),
        txid: order.txid, endToEndId: evidence.endToEndId, paidAt: evidence.paidAt, createdAt: now });
      transaction.update(ref, { status: 'PAGO', paymentStatus: 'PAGO', paidAt: evidence.paidAt,
        paymentTransactionId: evidence.endToEndId, paymentVerifiedAmount: evidence.amount,
        verifiedVia: 'SICREDI_API', pixVerified: true, updatedAt: now,
        reconciliationRequired: order.status === 'CANCELLED' });
      transaction.set(db.collection('sicredi_outbox').doc(`${id}_receipt`), {
        orderId: id, kind: 'receipt', pending: true, step: 0, leaseUntil: 0,
      });
      transaction.update(db.collection('sicredi_jobs').doc(order.txid), { pending: false });
      transaction.set(db.collection('sicredi_stock_jobs').doc(id), { orderId: id, pending: true });
    });
  }

  async deliver(id) {
    for (const kind of ['charge', 'receipt']) {
      const ref = this.db.collection('sicredi_outbox').doc(`${id}_${kind}`);
      const owner = randomUUID();
      const job = await this.db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) { return null; }
        const data = snapshot.data();
        if (!data.pending || data.leaseUntil > Date.now()) { return null; }
        transaction.update(ref, { owner, leaseUntil: Date.now() + 120000 });
        return data;
      });
      if (!job) { continue; }
      try {
        const order = await this.readOrder(id);
        let phone = String(order.customerPhone || '').replace(/\D/g, '');
        if (phone.length === 10 || phone.length === 11) { phone = `55${phone}`; }
        if (!/^\d{12,15}$/.test(phone)) {
          await ref.update({ pending: false, skipped: 'Cliente sem WhatsApp válido', leaseUntil: 0 });
          continue;
        }
        if (kind === 'charge' && order.paymentStatus === 'PAGO') {
          await ref.update({ pending: false, skipped: 'Pagamento já confirmado', leaseUntil: 0 });
          continue;
        }
        const amount = Number(order.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const summary = (order.items || []).map(item => `${item.quantity} × ${item.name}`).join('\n');
        const messages = kind === 'charge'
          ? [`Pedido #${order.ticketNumber}\n${summary}\nTotal: ${amount}\nAguardando pagamento Pix na conta Sicredi.`, order.pix.pixCopiaECola]
          : [`Pagamento Pix confirmado pelo Sicredi.\nPedido #${order.ticketNumber}\nTotal recebido: ${amount}\nLiquidação: ${order.paidAt}\nIdentificador: ${order.paymentTransactionId}\nObrigado pela compra!`];
        for (let step = job.step; step < messages.length; step++) {
          const template = kind === 'receipt' ? process.env.SICREDI_WHATSAPP_RECEIPT_TEMPLATE
            : step === 0 ? process.env.SICREDI_WHATSAPP_CHARGE_TEMPLATE : process.env.SICREDI_WHATSAPP_CODE_TEMPLATE;
          const result = template
            ? await this.whatsapp?.sendTemplate(phone, template, 'pt_BR', [{ type: 'body', parameters: [{ type: 'text', text: messages[step] }] }])
            : await this.whatsapp?.sendTextMessage(phone, messages[step]);
          if (result?.mock || result?.error || !result?.messages?.[0]?.id) { throw new Error('WhatsApp não confirmou aceite da mensagem.'); }
          await ref.update({ step: step + 1, messageId: result.messages[0].id, leaseUntil: Date.now() + 120000 });
        }
        await ref.update({ pending: false, leaseUntil: 0, sentAt: new Date().toISOString() });
      } catch (error) {
        await ref.update({ leaseUntil: 0, lastError: error.message, lastAttemptAt: new Date().toISOString() });
        throw error;
      }
    }
  }

  /** Run from a scheduler; cursors prevent old pending sales starving newer ones. */
  async processJobs() {
    const results = { processed: 0, failed: 0 };
    for (const name of ['sicredi_jobs', 'sicredi_outbox', 'sicredi_stock_jobs']) {
      let cursor;
      while (true) {
        let query = this.db.collection(name).where('pending', '==', true).limit(100);
        if (cursor) { query = query.startAfter(cursor); }
        const page = await query.get();
        for (const doc of page.docs) {
          try {
            const { orderId } = doc.data();
            if (name === 'sicredi_jobs') { await this.reconcile(orderId); }
            if (name === 'sicredi_outbox') { await this.deliver(orderId); }
            if (name === 'sicredi_stock_jobs') {
              const order = await this.readOrder(orderId);
              if (order.reconciliationRequired) { throw new Error('Pagamento de venda cancelada: revisar estoque e entrega.'); }
              await this.repository.deductStock(order.items, order.customerPhone, orderId);
              await doc.ref.update({ pending: false });
            }
            results.processed++;
          } catch (error) {
            results.failed++;
            await doc.ref.update({ lastError: error.message, lastAttemptAt: new Date().toISOString() });
          }
        }
        if (page.docs.length < 100) { break; }
        cursor = page.docs.at(-1);
      }
    }
    return results;
  }
}
module.exports = { SicrediPaymentService };
