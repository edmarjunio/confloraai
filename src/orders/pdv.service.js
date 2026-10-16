const { createHash } = require('node:crypto');
const { formatOrderReceipt, money } = require('./receipt.util');

const ORDER_PAYMENT_METHODS = new Set(['DINHEIRO', 'DEBITO', 'CREDITO', 'FIADO', 'SALDO_CLIENTE']);
function actor(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const name = String(user?.name || '').trim() || email || String(user?.id || 'Colaborador');
  return { id: user.id, name, email, role: user.role };
}
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
  constructor({ repository, pix, whatsapp, ownerPhone = '', taskQueueClient = null }) { Object.assign(this, { repository, pix, whatsapp, ownerPhone, taskQueueClient }); }

  /** @param {import('./pdv.contracts').SaleInput} input @param {import('./pdv.contracts').StaffActor} user */
  async create(input, user, { approvedDiscount = false } = {}) {
    const createdBy = actor(user);
    const id = requestId(input.requestId);
    const requestPayload = {
      requestId: input.requestId,
      items: input.items,
      discountPercent: input.discountPercent,
      paymentMethod: input.paymentMethod,
      freightValue: input.freightValue,
      orderType: input.orderType,
      cashReceived: input.cashReceived,
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerCpf: input.customerCpf,
      deliveryAddress: input.deliveryAddress,
      notes: input.notes,
    };
    const requestHash = createHash('sha256').update(JSON.stringify(requestPayload)).digest('hex');
    const previous = await this.repository.read('orders', id);
    if (previous) {
      if (previous.createdBy?.id !== user.id || previous.requestHash !== requestHash) { throw new Error('Esta operação já pertence a outra venda.'); }
      return this.finishCreation(await this.preparePix(previous), user, approvedDiscount);
    }
    const paymentMethod = String(input.paymentMethod || '').toUpperCase();
    if (paymentMethod !== 'PIX' && !ORDER_PAYMENT_METHODS.has(paymentMethod)) { throw new Error('Forma de pagamento inválida.'); }
    if (paymentMethod === 'SALDO_CLIENTE' && !['ADMIN', 'CAIXA'].includes(user.role)) { throw new Error('Somente o caixa pode usar o crédito disponível do cliente.'); }
    if (!Array.isArray(input.items) || !input.items.length || input.items.length > 150) { throw new Error('Adicione os produtos à comanda.'); }
    const products = new Map((await this.repository.repository.getAllProducts()).map((product) => [String(product.id), product]));
    const items = input.items.map((item) => {
      const product = products.get(String(item.productId));
      const quantity = Number(item.quantity);
      const price = Number(product?.price ?? product?.valor_num);
      const name = product?.name || product?.descricao || 'Produto';
      const savedUnit = String(product?.saleUnit?.code || product?.unit || product?.unidade || '').trim().toUpperCase();
      const unit = savedUnit || (/(^|[^A-Z])KG([^A-Z]|$)/i.test(name) ? 'KG' : 'UN');
      const minimum = Number(product?.saleUnit?.minimum) || (unit === 'KG' ? 0.1 : 1);
      const increment = Number(product?.saleUnit?.increment) || (unit === 'KG' ? 0.1 : 1);
      const quantityMatchesUnit = Number.isFinite(quantity)
        && quantity >= minimum
        && Math.abs(quantity / increment - Math.round(quantity / increment)) < 0.00001;
      if (!product || product.status === 'INATIVO' || product.isAvailable === false || !quantityMatchesUnit || !Number.isFinite(price) || price < 0) { throw new Error('Produto ou quantidade inválida para a unidade de venda.'); }
      return { productId: String(product.id), name, quantity, price, unit, subtotalMinor: Math.round(price * quantity * 100) };
    });
    const inventory = await this.repository.repository.getInventorySettings();
    if (inventory.stockControlEnabled || paymentMethod === 'PIX') {
      const quantities = new Map();
      for (const item of items) { quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity); }
      for (const [productId, quantity] of quantities) {
        const product = products.get(productId);
        const availableStock = Number(product.stockQuantity ?? product.estoque ?? 0) - Number(product.reservedQuantity || 0);
        if (availableStock < quantity) throw new Error(`Estoque disponível insuficiente para ${product.name}.`);
      }
    }
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
    if ((customerId || ['FIADO', 'SALDO_CLIENTE'].includes(paymentMethod)) && !customer) { throw new Error('Selecione um cliente cadastrado para o fiado ou uso de crédito.'); }
    if (paymentMethod === 'SALDO_CLIENTE' && Math.round(Number(customer?.creditBalance || 0) * 100) < Math.round(total * 100)) { throw new Error('O crédito disponível do cliente não cobre o valor total da venda.'); }
    const phone = normalizePhone(input.customerPhone || customer?.phone || customer?.phoneDigits);
    if (discountPercent > 5 && user.role !== 'ADMIN' && !approvedDiscount) {
      const approval = await this.repository.transaction(async (tx) => {
        const existing = await tx.get('discount_approvals', id);
        if (existing) {
          if (existing.requestHash !== requestHash || existing.requestedBy !== user.id) { throw new Error('Solicitação de desconto divergente.'); }
          return existing;
        }
        const pending = { id, source: 'PDV', requestHash, input: requestPayload, createdBy, requestedBy: user.id, operatorName: createdBy.name, operatorEmail: createdBy.email, customerName: input.customerName || customer?.name || 'Cliente Balcão', customerPhone: phone, items, paymentMethod, subtotal: subtotalMinor / 100, discountPercent, discountAmount: discountMinor / 100, total, status: 'PENDING', createdAt: new Date().toISOString() };
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
      createdBy, sellerName: createdBy.name, sellerEmail: createdBy.email, operatorId: user.id, operatorName: createdBy.name, operatorEmail: createdBy.email,
      receivedBy: null, paymentMethod, paymentStatus: 'PENDING', status: pixData ? 'CREATING_PIX' : 'AWAITING_CASHIER',
      cashTendered,
      pixData, pixCopiaECola: pixData?.pixCopiaECola || '',
      ...(pixData ? { pixTtlSeconds: Math.min(86400, Math.max(300, Number(process.env.PIX_PAYMENT_TTL_SECONDS) || 3600)), pixExpiresAt: new Date(Date.now() + Math.min(86400, Math.max(300, Number(process.env.PIX_PAYMENT_TTL_SECONDS) || 3600)) * 1000).toISOString() } : {}),
      createdAt: new Date().toISOString(),
    });
    if (pixData) await this.schedulePixExpiration(order);
    return this.finishCreation(await this.preparePix(order), user, approvedDiscount);
  }

  async schedulePixExpiration(order) {
    if (!order?.id || order.paymentMethod !== 'PIX') return;
    if (process.env.NODE_ENV === 'production' && typeof this.taskQueueClient?.enqueuePixExpiration !== 'function') {
      await this.repository.cancelOrder(order.id, 'Cloud Tasks não está disponível para expirar a reserva Pix.').catch(() => {});
      throw new Error('Cloud Tasks não está disponível para expirar a reserva Pix.');
    }
    try {
      await this.taskQueueClient?.enqueuePixExpiration?.(order.id, Number(order.pixTtlSeconds || order.pixData?.expiresInSeconds) || 3600);
    } catch (error) {
      await this.repository.cancelOrder(order.id, 'Não foi possível agendar a expiração da reserva Pix.').catch(() => {});
      throw error;
    }
  }

  async expirePixOrder(orderId) {
    const order = await this.repository.read('orders', String(orderId));
    if (!order || order.paymentMethod !== 'PIX' || order.completedAt || order.status === 'CANCELLED' || order.paymentTransactionId) return false;
    const expiresAt = Date.parse(order.pixExpiresAt || '');
    if (!Number.isFinite(expiresAt) || expiresAt > Date.now()) return false;
    await this.repository.repository.cancelOrder(order.id, 'Prazo de pagamento Pix expirado');
    return true;
  }

  async expirePixOrders() {
    const orders = await this.repository.repository.getAllOrders(10000);
    for (const order of orders.filter((item) => ['CREATING_PIX', 'AWAITING_PIX', 'PENDING'].includes(item.status) && item.paymentMethod === 'PIX')) {
      try { await this.expirePixOrder(order.id); } catch {}
    }
  }

  async preparePix(order) {
    if (order.paymentMethod !== 'PIX' || order.pixData?.pixCopiaECola) { return order; }
    const charge = await this.pix.createCharge({ amount: order.total, txid: order.pixData.txid, ticketNumber: order.ticketNumber,
      expiresInSeconds: Number(order.pixTtlSeconds || order.pixData?.expiresInSeconds) || 3600 });
    return this.repository.attachCharge(order.id, charge);
  }

  async requestPixAtCashier(orderId, user) {
    let order = await this.repository.requestPixAtCashier(orderId, actor(user));
    await this.schedulePixExpiration(order);
    order = await this.preparePix(order);
    await this.deliver(`${order.id}-receipt`);
    return { ...order, receiptText: formatOrderReceipt(order) };
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
    if (!order || !['PDV', 'WEB_CATALOG'].includes(order.source) || order.paymentMethod !== 'PIX') { return true; }
    if (!order.completedAt) {
      const status = await this.pix.checkReceivedPayment(endToEndId);
      if (!status.isPaid) { return false; }
      const payment = status.raw;
      if (payment.txid !== txid || payment.endToEndId !== endToEndId || payment.chave !== this.pix.pixKey || Math.round(Number(payment.valor) * 100) !== Math.round(order.total * 100) || (payment.devolucoes || []).length) { throw new Error('Pagamento Sicredi divergente. Verifique a conciliação.'); }
      if (order.status === 'CANCELLED' || (Date.parse(order.pixExpiresAt || '') > 0 && Date.parse(order.pixExpiresAt) <= Date.now())) {
        const eventId = `${txid}-${endToEndId}`;
        await this.repository.transaction(async (tx) => {
          if (await tx.get('pdv_pix_late_payments', eventId)) return;
          tx.set('pdv_pix_late_payments', eventId, { id: eventId, orderId: order.id, txid, endToEndId, amount: Number(payment.valor), status: 'NEEDS_RECONCILIATION', createdAt: new Date().toISOString() });
        });
        if (order.status !== 'CANCELLED') await this.expirePixOrder(order.id);
        return true;
      }
      const verification = { txid, endToEndId, amountMinor: Math.round(Number(payment.valor) * 100), verifiedVia: 'SICREDI_PIX_WEBHOOK' };
      if (order.source === 'PDV') {
        await this.repository.receive(order.id, null, verification);
      } else {
        const result = await this.repository.repository.confirmOrderPayment(order.id, {
          verifiedVia: verification.verifiedVia,
          paymentTransactionId: endToEndId,
          paymentAmount: Number(payment.valor),
          pixTxid: txid,
        });
        if (!result.alreadyConfirmed) {
          await this.repository.transaction(async (tx) => {
            for (const kind of ['customer-paid', 'owner-paid']) {
              const id = `${order.id}-${kind}`;
              tx.set('pdv_outbox', id, { id, kind, orderId: order.id, status: 'PENDING', attempts: 0 });
            }
          });
        }
      }
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
      if (job.kind === 'receipt' || job.kind === 'customer-paid' || job.kind === 'pix-charge') { text = formatOrderReceipt(order); }
      else if (settlement?.entryType === 'CREDITO_CLIENTE') { text = `CONFLORA — CRÉDITO DO CLIENTE\nCliente: ${settlement.customerName}\nValor recebido: ${money(settlement.amount)}\nCrédito disponível: ${money(settlement.newCreditBalance)}\nRecebido por: ${settlement.receivedBy.name}\nForma: ${settlement.paymentMethod}`; }
      else if (settlement) { text = `CONFLORA — QUITAÇÃO DE FIADO\nCliente: ${settlement.customerName}\nValor: ${money(settlement.amount)}\nSaldo devedor: ${money(settlement.newBalance)}\nRecebido por: ${settlement.receivedBy.name}\nForma: ${settlement.paymentMethod}`; }
      else { text = `CONFLORA — PIX CONFIRMADO\nPedido #${order.ticketNumber}\nCliente: ${order.customerName}\nValor: ${money(order.total)}\nPedido feito por: ${order.createdBy.name}\nRecebido por: ${order.receivedBy.name}\nPedido pago e finalizado. Estoque atualizado.`; }
      const chunks = messageChunks(text, this.whatsapp.sendPdvText ? 900 : 3500);
      for (let index = job.textChunksSent || 0; index < chunks.length; index++) {
        const send = this.whatsapp.sendPdvText || this.whatsapp.sendTextMessage;
        const result = await send.call(this.whatsapp, phone, chunks[index]);
        if (result?.mock || !result?.messages?.[0]?.id) { throw new Error('WhatsApp não confirmou o envio.'); }
        await this.repository.updateMessage(id, { textChunksSent: index + 1, leaseUntil: Date.now() + 120000 });
      }
      if (['receipt', 'pix-charge'].includes(job.kind) && order.pixData && !order.paidAt && !job.qrSent) {
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

module.exports = { PdvService, actor, normalizePhone, requestId, ORDER_PAYMENT_METHODS };
