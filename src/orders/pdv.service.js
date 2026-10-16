const { createHash } = require('node:crypto');
const { formatOrderReceipt, money } = require('./receipt.util');

const CASH_METHODS = new Set(['DINHEIRO', 'DEBITO', 'CREDITO', 'FIADO']);
function actor(user) { return { id: user.id, name: user.name, role: user.role }; }
function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) { return ''; }
  const phone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (!/^55\d{10,11}$/.test(phone)) { throw new Error('Informe WhatsApp com DDD válido.'); }
  return phone;
}
function requestId(value) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value || '')) { throw new Error('Identificador da operação inválido. Reabra a venda.'); }
  return value.toLowerCase();
}
function messageChunks(text, limit) {
  const chunks = [];
  let current = '';
  for (const line of text.split('\n')) {
    if (line.length > limit) { throw new Error('Linha do recibo excede o limite de mensagem.'); }
    if (current.length + line.length + 1 > limit) { chunks.push(current); current = ''; }
    current += (current ? '\n' : '') + line;
  }
  if (current) { chunks.push(current); }
  return chunks;
}

class PdvService {
  constructor({ repository, pix, whatsapp, ownerPhone = '' }) { Object.assign(this, { repository, pix, whatsapp, ownerPhone }); }

  /** @param {import('./pdv.contracts').SaleInput} input @param {import('./pdv.contracts').StaffActor} user */
  async create(input, user, { approvedDiscount = false } = {}) {
    const id = requestId(input.requestId);
    const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const previous = await this.repository.read('orders', id);
    if (previous) {
      if (previous.createdBy?.id !== user.id || previous.requestHash !== requestHash) { throw new Error('Esta operação já pertence a outra venda.'); }
      return this.finishCreation(await this.preparePix(previous), user, approvedDiscount);
    }
    const paymentMethod = String(input.paymentMethod || '').toUpperCase();
    if (paymentMethod !== 'PIX' && !CASH_METHODS.has(paymentMethod)) { throw new Error('Forma de pagamento inválida.'); }
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 150) { throw new Error('Adicione os produtos à comanda.'); }
    const products = new Map((await this.repository.repository.getAllProducts()).map((product) => [String(product.id), product]));
    const items = input.items.map((item) => {
      const product = products.get(String(item.productId));
      const quantity = Number(item.quantity);
      const price = Number(product?.price ?? product?.valor_num);
      if (!product || product.status === 'INATIVO' || product.isAvailable === false || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) { throw new Error('Produto ou quantidade inválida.'); }
      return { productId: String(product.id), name: product.name || product.descricao, quantity, price, unit: product.unit || product.unidade || 'UN', subtotalMinor: Math.round(price * quantity * 100) };
    });
    const discountPercent = Number(input.discountPercent || 0);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) { throw new Error('Desconto inválido.'); }
    const freightValue = input.orderType === 'DELIVERY' ? Number(input.freightValue || 0) : 0;
    if (!Number.isFinite(freightValue) || freightValue < 0) { throw new Error('Frete inválido.'); }
    const subtotalMinor = items.reduce((sum, item) => sum + item.subtotalMinor, 0);
    const discountMinor = Math.round(subtotalMinor * discountPercent / 100);
    const total = (subtotalMinor - discountMinor + Math.round(freightValue * 100)) / 100;
    if (total <= 0 || !Number.isSafeInteger(Math.round(total * 100))) { throw new Error('Valor total inválido.'); }
    const cashTendered = paymentMethod === 'DINHEIRO' && user.role !== 'VENDEDOR' ? Number(input.cashReceived ?? total) : null;
    if (cashTendered !== null && (!Number.isFinite(cashTendered) || Math.round(cashTendered * 100) < Math.round(total * 100))) { throw new Error('Valor recebido em dinheiro menor que o total.'); }
    const customerId = String(input.customerId || '');
    if (customerId.includes('/')) { throw new Error('Cliente inválido.'); }
    const customer = customerId ? await this.repository.read('customers', customerId) : null;
    if ((customerId || paymentMethod === 'FIADO') && !customer) { throw new Error('Selecione um cliente cadastrado para o fiado.'); }
    const phone = normalizePhone(input.customerPhone || customer?.phone || customer?.phoneDigits);
    if (discountPercent > 5 && user.role !== 'ADMIN' && !approvedDiscount) {
      const approval = await this.repository.transaction(async (tx) => {
        const existing = await tx.get('discount_approvals', id);
        if (existing) {
          if (existing.requestHash !== requestHash || existing.requestedBy !== user.id) { throw new Error('Solicitação de desconto divergente.'); }
          return existing;
        }
        const pending = { id, source: 'PDV', requestHash, input, createdBy: actor(user), requestedBy: user.id, operatorName: user.name, customerName: input.customerName || customer?.name || 'Cliente Balcão', customerPhone: phone, items, paymentMethod, subtotal: subtotalMinor / 100, discountPercent, discountAmount: discountMinor / 100, total, status: 'PENDING', createdAt: new Date().toISOString() };
        tx.set('discount_approvals', id, pending);
        return pending;
      });
      if (approval.status === 'REJECTED') { throw new Error('Desconto recusado: ' + approval.rejectionReason); }
      return { approvalRequired: true, approval };
    }
    const ticketNumber = id.replace(/-/g, '').slice(0, 10).toUpperCase();
    const pixData = paymentMethod === 'PIX' ? { txid: id.replace(/-/g, '').toUpperCase(), provider: 'SICREDI' } : null;
    const order = await this.repository.create({
      id, requestHash, source: 'PDV', ticketNumber, items, subtotal: subtotalMinor / 100,
      discountPercent, discountAmount: discountMinor / 100, freightValue, total,
      customerId, customerName: String(input.customerName || customer?.name || 'Cliente Balcão').slice(0, 100), customerPhone: phone,
      orderType: input.orderType === 'DELIVERY' ? 'DELIVERY' : 'PICKUP', deliveryAddress: String(input.deliveryAddress || '').slice(0, 250), notes: String(input.notes || '').slice(0, 500),
      createdBy: actor(user), sellerName: user.name, operatorId: user.id, operatorName: user.name,
      receivedBy: null, paymentMethod, paymentStatus: 'PENDING', status: pixData ? 'CREATING_PIX' : 'AWAITING_CASHIER',
      cashTendered,
      pixData, pixCopiaECola: pixData?.pixCopiaECola || '', createdAt: new Date().toISOString(),
    });
    return this.finishCreation(await this.preparePix(order), user, approvedDiscount);
  }

  async preparePix(order) {
    if (order.paymentMethod !== 'PIX' || order.pixData?.pixCopiaECola) { return order; }
    const charge = await this.pix.createCharge({ amount: order.total, txid: order.pixData.txid, ticketNumber: order.ticketNumber });
    return this.repository.attachCharge(order.id, charge);
  }

  async finishCreation(order, user, deferReceipt = false) {
    if (!deferReceipt && order.paymentMethod !== 'PIX' && ['ADMIN', 'CAIXA'].includes(user.role)) { order = await this.repository.receive(order.id, actor(user)); }
    await this.deliver(`${order.id}-receipt`);
    const delivery = await this.repository.read('pdv_outbox', `${order.id}-receipt`);
    return { ...order, receiptText: formatOrderReceipt(order), qrCodeBase64: order.pixData?.qrCodeBase64 || '', receiptDelivery: { sent: delivery?.status === 'SENT' && Boolean(order.customerPhone), reason: delivery?.lastError || (order.customerPhone ? '' : 'Sem WhatsApp informado.') } };
  }

  async handlePix(txid, endToEndId) {
    if (!/^[a-zA-Z0-9]{26,35}$/.test(txid) || !/^E[a-zA-Z0-9]{31}$/.test(endToEndId || '')) { throw new Error('Identificador Pix inválido.'); }
    const orders = await this.repository.list('orders', 'pixData.txid', txid);
    // Memory collections use flat filtering; production query targets the exact txid.
    const order = orders[0];
    if (!order || order.source !== 'PDV' || order.paymentMethod !== 'PIX') { return true; }
    if (!order.completedAt) {
      const status = await this.pix.checkReceivedPayment(endToEndId);
      if (!status.isPaid) { return false; }
      const payment = status.raw;
      if (payment.txid !== txid || payment.endToEndId !== endToEndId || payment.chave !== this.pix.pixKey || Math.round(Number(payment.valor) * 100) !== Math.round(order.total * 100) || (payment.devolucoes || []).length) { throw new Error('Pagamento Sicredi divergente. Verifique a conciliação.'); }
      await this.repository.receive(order.id, null, { txid, endToEndId, amountMinor: Math.round(Number(payment.valor) * 100) });
    }
    await this.deliver(`${order.id}-customer-paid`);
    await this.deliver(`${order.id}-owner-paid`);
    return true;
  }

  async processPixEvent(txid, endToEndId) {
    if (!await this.handlePix(txid, endToEndId)) { return; }
    await this.repository.transaction(async (tx) => {
      const eventId = `${txid}-${endToEndId}`;
      const event = await tx.get('pdv_pix_events', eventId);
      if (event) { tx.set('pdv_pix_events', eventId, { ...event, status: 'DONE' }); }
    });
  }

  async deliver(id) {
    const job = await this.repository.claimMessage(id);
    if (!job) { return; }
    try {
      const order = job.orderId ? await this.repository.read('orders', job.orderId) : null;
      const settlement = job.settlementId ? await this.repository.read('debt_settlements', job.settlementId) : null;
      const phone = normalizePhone(job.kind === 'owner-paid' ? this.ownerPhone : (order?.customerPhone || settlement?.customerPhone));
      if (!phone && job.kind === 'owner-paid') { throw new Error('WhatsApp da horta não configurado.'); }
      if (!phone) { await this.repository.updateMessage(id, { status: 'SENT', skipped: true, leaseUntil: 0 }); return; }
      let text;
      if (job.kind === 'receipt') { text = formatOrderReceipt(order); }
      else if (settlement) { text = `CONFLORA — QUITAÇÃO DE FIADO\nCliente: ${settlement.customerName}\nValor: ${money(settlement.amount)}\nSaldo devedor: ${money(settlement.newBalance)}\nRecebido por: ${settlement.receivedBy.name}\nForma: ${settlement.paymentMethod}`; }
      else { text = `CONFLORA — PIX CONFIRMADO\nPedido #${order.ticketNumber}\nCliente: ${order.customerName}\nValor: ${money(order.total)}\nPedido feito por: ${order.createdBy.name}\nRecebido por: ${order.receivedBy.name}\nPedido pago e finalizado. Estoque atualizado.`; }
      const chunks = messageChunks(text, this.whatsapp.sendPdvText ? 900 : 3500);
      for (let index = job.textChunksSent || 0; index < chunks.length; index++) {
        const send = this.whatsapp.sendPdvText || this.whatsapp.sendTextMessage;
        const result = await send.call(this.whatsapp, phone, chunks[index]);
        if (result?.mock || !result?.messages?.[0]?.id) { throw new Error('WhatsApp não confirmou o envio.'); }
        await this.repository.updateMessage(id, { textChunksSent: index + 1, leaseUntil: Date.now() + 120000 });
      }
      if (job.kind === 'receipt' && order.pixData && !order.paidAt && !job.qrSent) {
        const image = Buffer.from(order.pixData.qrCodeBase64.split(',')[1], 'base64');
        const result = await this.whatsapp.sendImageBuffer(phone, image, `Pix pedido #${order.ticketNumber} — ${money(order.total)}`);
        if (!result?.messages?.[0]?.id) { throw new Error('WhatsApp não confirmou o QR Code.'); }
        await this.repository.updateMessage(id, { qrSent: true });
      }
      await this.repository.updateMessage(id, { status: 'SENT', leaseUntil: 0, sentAt: new Date().toISOString(), lastError: '' });
    } catch (error) {
      await this.repository.updateMessage(id, { leaseUntil: 0, nextAttemptAt: Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)), lastError: error.message });
    }
  }

  async retryMessages() {
    const events = await this.repository.list('pdv_pix_events', 'status', 'PENDING');
    for (const event of events.slice(0, 100)) {
      try { await this.processPixEvent(event.txid, event.endToEndId); }
      catch (error) {
        await this.repository.transaction(async (tx) => {
          const current = await tx.get('pdv_pix_events', event.id);
          tx.set('pdv_pix_events', event.id, { ...current, lastError: error.message });
        });
      }
    }
    const pending = await this.repository.list('pdv_outbox', 'status', 'PENDING');
    const eligible = pending.filter((job) => !(job.nextAttemptAt > Date.now()) && !(job.leaseUntil > Date.now()));
    for (const job of eligible.slice(0, 100)) { await this.deliver(job.id); }
  }
}

module.exports = { PdvService, actor, normalizePhone, requestId, CASH_METHODS };
