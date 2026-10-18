const { driverPerformance } = require('./delivery-metrics');
const { isDelivery, isDeliverySettled, assertAssignedDelivery } = require('./delivery-policy');
const { createHash } = require('node:crypto');
const { formatOrderReceipt, money } = require('./receipt.util');
const { normalizePaymentParts, partAmount } = require('./payment-parts');
const { formatCustomerOrderMessage } = require('./customer-order-message');
const { pixMode, manualPixSettings } = require('./pix-mode');

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

function normalizeDeliveryLocation(raw) {
  if (!raw || typeof raw !== 'object' || raw.lat === null || raw.lng === null || raw.lat === '' || raw.lng === '') return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }
  const address = String(raw.address || '').trim().slice(0, 300);
  const reference = String(raw.reference || '').trim().slice(0, 200);
  const accuracy = Number.isFinite(Number(raw.accuracy)) ? Math.round(Number(raw.accuracy)) : null;
  return {
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    address,
    reference,
    ...(accuracy !== null ? { accuracy } : {}),
    mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`,
    wazeUrl: `https://waze.com/ul?ll=${lat.toFixed(6)},${lng.toFixed(6)}&navigate=yes`,
  };
}

class PdvService {
  constructor({ repository, pix, whatsapp, ownerPhone = '', taskQueueClient = null }) { Object.assign(this, { repository, pix, whatsapp, ownerPhone, taskQueueClient }); }

  /** @param {import('./pdv.contracts').SaleInput} input @param {import('./pdv.contracts').StaffActor} user */
  async create(input, user, { approvedDiscount = false } = {}) {
    if (!['ADMIN', 'CAIXA', 'VENDEDOR'].includes(user?.role)) throw new Error('Seu perfil não pode criar pedidos.');
    const createdBy = actor(user);
    if (input.orderType === 'DELIVERY' && (!String(input.customerName || '').trim() || input.customerName === 'Cliente Balcão' || !normalizePhone(input.customerPhone) || String(input.deliveryAddress || '').trim().length < 8)) throw new Error('Entrega exige nome, WhatsApp com DDD e endereço completo (rua, número, bairro e cidade).');
    const id = requestId(input.requestId);
    const deliveryLocation = input.orderType === 'DELIVERY' ? normalizeDeliveryLocation(input.deliveryLocation) : null;
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
      deferToCashier: input.deferToCashier === true,
      paymentParts: input.paymentParts,
      ...(deliveryLocation ? { deliveryLocation } : {}),
    };
    const requestHash = createHash('sha256').update(JSON.stringify(requestPayload)).digest('hex');
    const previous = await this.repository.read('orders', id);
    if (previous) {
      if (previous.createdBy?.id !== user.id || previous.requestHash !== requestHash) { throw new Error('Esta operação já pertence a outra venda.'); }
      if (previous.status === 'CANCELLED') throw new Error('Esta comanda foi cancelada. Inicie uma nova venda.');
      if (previous.pixData && !previous.completedAt) await this.schedulePixExpiration(previous);
      return this.finishCreation(await this.preparePix(previous), user, approvedDiscount);
    }
    let paymentMethod = String(input.paymentMethod || '').toUpperCase();
    if (paymentMethod !== 'PIX' && paymentMethod !== 'MISTO' && !ORDER_PAYMENT_METHODS.has(paymentMethod)) { throw new Error('Forma de pagamento inválida.'); }
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
    if (inventory.stockControlEnabled) {
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
    const paymentParts = normalizePaymentParts(input.paymentParts, paymentMethod, total);
    const amountFor = (method) => paymentParts.find((part) => part.method === method)?.amount || 0;
    const hasPix = amountFor('PIX') > 0;
    const manualPix = hasPix && pixMode() === 'MANUAL' ? manualPixSettings() : null;
    paymentMethod = hasPix ? 'PIX' : paymentParts.length > 1 ? 'MISTO' : paymentParts[0].method;
    const deferToCashier = Boolean(manualPix) || input.deferToCashier === true || (input.orderType === 'DELIVERY' && !hasPix) || (user.role === 'VENDEDOR' && paymentParts.some((part) => part.method !== 'PIX'));
    const cashTendered = amountFor('DINHEIRO') && !deferToCashier ? Number(input.cashReceived ?? amountFor('DINHEIRO')) : null;
    if (cashTendered !== null && (!Number.isFinite(cashTendered) || Math.round(cashTendered * 100) < Math.round(amountFor('DINHEIRO') * 100))) { throw new Error('Valor recebido em dinheiro menor que o total.'); }
    const customerId = String(input.customerId || '');
    if (customerId.includes('/')) { throw new Error('Cliente inválido.'); }
    const customer = customerId ? await this.repository.read('customers', customerId) : null;
    if ((customerId || amountFor('FIADO') || amountFor('SALDO_CLIENTE')) && !customer) { throw new Error('Selecione um cliente cadastrado para o fiado ou uso de crédito.'); }
    if (amountFor('SALDO_CLIENTE') && Math.round(Number(customer?.creditBalance || 0) * 100) < Math.round(amountFor('SALDO_CLIENTE') * 100)) throw new Error('Crédito disponível insuficiente.');
    if (hasPix && amountFor('SALDO_CLIENTE')) throw new Error('Use o saldo do cliente com dinheiro ou cartão. A combinação de saldo com Pix ainda não está disponível.');
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
    const creditPending = amountFor('FIADO') > 0 && (user.role !== 'ADMIN' || deferToCashier);
    const pixData = hasPix && !deferToCashier && !creditPending ? { txid: id.replace(/-/g, '').toUpperCase(), provider: 'SICREDI' } : null;
    const isDelivery = input.orderType === 'DELIVERY';
    const order = await this.repository.create({
      id, requestHash, source: 'PDV', ticketNumber, items, subtotal: subtotalMinor / 100,
      discountPercent, discountAmount: discountMinor / 100, freightValue, total,
      customerId, customerName: String(input.customerName || customer?.name || 'Cliente Balcão').slice(0, 100), customerPhone: phone,
      orderType: isDelivery ? 'DELIVERY' : 'PICKUP', deliveryAddress: String(input.deliveryAddress || '').slice(0, 250), notes: String(input.notes || '').slice(0, 500),
      ...(isDelivery ? { deliveryStatus: hasPix || creditPending ? 'PENDING_DISPATCH' : 'PENDING_DELIVERY' } : {}),
      ...(deliveryLocation ? { deliveryLocation } : {}),
      createdBy, sellerName: createdBy.name, sellerEmail: createdBy.email, operatorId: user.id, operatorName: createdBy.name, operatorEmail: createdBy.email,
      receivedBy: null, paymentMethod, paymentStatus: 'PENDING', status: creditPending ? 'AWAITING_CONFIRMATION' : pixData ? 'CREATING_PIX' : deferToCashier ? 'AWAITING_PAYMENT' : 'AWAITING_CASHIER',
      cashTendered, ...(creditPending ? { creditApprovalStatus: 'PENDING' } : {}),
      paymentParts: paymentParts.map((part) => ({ ...part, ...(hasPix && !deferToCashier && !creditPending && ['DINHEIRO', 'DEBITO', 'CREDITO'].includes(part.method) ? { status: 'RECEIVED_AT_CASHIER', receivedBy: createdBy } : {}) })), deferToCashier,
      ...(hasPix && !deferToCashier && !creditPending && paymentParts.length > 1 ? { mixedReceivedBy: createdBy } : {}),
      pixData, pixCopiaECola: pixData?.pixCopiaECola || '',
      ...(pixData ? { pixTtlSeconds: Math.min(86400, Math.max(300, Number(process.env.PIX_PAYMENT_TTL_SECONDS) || 3600)), pixExpiresAt: new Date(Date.now() + Math.min(86400, Math.max(300, Number(process.env.PIX_PAYMENT_TTL_SECONDS) || 3600)) * 1000).toISOString() } : {}),
      createdAt: new Date().toISOString(),
      ...(hasPix ? { pixMode: manualPix ? 'MANUAL' : 'SICREDI' } : {}),
      ...(manualPix ? { manualPix, paymentReviewStatus: 'AWAITING_PAYMENT' } : {}),
    });
    if (pixData) await this.schedulePixExpiration(order);
    return this.finishCreation(await this.preparePix(order), user, approvedDiscount);
  }

  async schedulePixExpiration(order) {
    if (!order?.id || order.paymentMethod !== 'PIX') return;
    return this.schedulePaymentExpiration(order);
  }

  async schedulePaymentExpiration(order) {
    if (process.env.NODE_ENV === 'production' && typeof this.taskQueueClient?.enqueuePixExpiration !== 'function') {
      await this.repository.cancelOrder(order.id, 'Cloud Tasks não está disponível para expirar a reserva Pix.').catch(() => {});
      throw new Error('Cloud Tasks não está disponível para expirar a reserva Pix.');
    }
    try {
      await this.taskQueueClient?.enqueuePixExpiration?.(order.id, Math.max(1, Math.ceil((Date.parse(order.pixExpiresAt || order.paymentExpiresAt) - Date.now()) / 1000)) || Number(order.pixTtlSeconds || order.pixData?.expiresInSeconds) || 3600);
    } catch (error) {
      await this.repository.cancelOrder(order.id, 'Não foi possível agendar a expiração da reserva Pix.').catch(() => {});
      throw error;
    }
  }

  async expirePixOrder(orderId) {
    const order = await this.repository.read('orders', String(orderId));
    if (!order || order.completedAt || order.status === 'CANCELLED' || order.paymentTransactionId) return false;
    const expiresAt = Date.parse(order.pixExpiresAt || order.paymentExpiresAt || '');
    if (!Number.isFinite(expiresAt) || expiresAt > Date.now()) return false;
    await this.repository.repository.cancelOrder(order.id, 'Prazo de pagamento expirado');
    return true;
  }

  async expirePixOrders() {
    const orders = await this.repository.expiredPixOrders();
    for (const order of orders) {
      try { await this.expirePixOrder(order.id); }
      catch (error) { require('../shared/logger').error('Falha ao liberar reserva de pedido vencido', error, { source: 'ORDERS', orderId: order.id }); }
    }
  }

  async preparePix(order) {
    if (order.pixMode === 'MANUAL') return order;
    if (order.status === 'CANCELLED') throw new Error('Esta comanda foi cancelada. Inicie uma nova venda.');
    if (order.completedAt || order.paidAt) return order;
    if (order.pixData && Date.parse(order.pixExpiresAt || '') <= Date.now()) {
      await this.expirePixOrder(order.id);
      throw new Error('Esta cobrança Pix venceu. Inicie uma nova venda.');
    }
    if (order.paymentMethod !== 'PIX' || !order.pixData || order.pixData.pixCopiaECola) { return order; }
    const charge = await this.pix.createCharge({ amount: partAmount(order, 'PIX'), txid: order.pixData.txid, ticketNumber: order.ticketNumber,
      expiresInSeconds: Number(order.pixTtlSeconds || order.pixData?.expiresInSeconds) || 3600 });
    return this.repository.attachCharge(order.id, charge);
  }

  async requestPixAtCashier(orderId, user, paymentParts) {
    if (pixMode() === 'MANUAL') {
      const settings = manualPixSettings();
      return this.repository.transaction(async tx => {
        const current = await tx.get('orders', orderId);
        if (!current || current.completedAt || current.status === 'CANCELLED' || current.pixData?.txid) throw new Error('A comanda não pode ser alterada.');
        const updated = { ...current, paymentMethod: 'PIX', paymentParts: normalizePaymentParts(paymentParts, 'PIX', current.total), pixMode: 'MANUAL', manualPix: settings, status: 'AWAITING_PAYMENT', paymentReviewStatus: 'AWAITING_PAYMENT' };
        tx.set('orders', orderId, updated); return updated;
      });
    }
    let order = await this.repository.requestPixAtCashier(orderId, actor(user), paymentParts);
    await this.schedulePixExpiration(order);
    order = await this.preparePix(order);
    await this.deliver(`${order.id}-receipt`);
    return { ...order, receiptText: formatOrderReceipt(order) };
  }

  async finishCreation(order, user, deferReceipt = false) {
    if (order.creditApprovalStatus !== 'PENDING' && !deferReceipt && !order.deferToCashier && order.paymentMethod !== 'PIX' && ['ADMIN', 'CAIXA'].includes(user.role)) { order = await this.repository.receive(order.id, actor(user)); }
    await this.queueOperationalNotifications(order);
    await this.deliver(`${order.id}-receipt`);
    const delivery = await this.repository.read('pdv_outbox', `${order.id}-receipt`);
    return { ...order, receiptText: formatOrderReceipt(order), qrCodeBase64: order.pixData?.qrCodeBase64 || '', receiptDelivery: { sent: delivery?.status === 'SENT' && Boolean(order.customerPhone), reason: delivery?.lastError || (order.customerPhone ? '' : 'Sem WhatsApp informado.') } };
  }

  async listDeliveries(user) {
    if (!user || !['ADMIN', 'CAIXA', 'ENTREGADOR'].includes(user.role)) {
      throw new Error('Sem permissão para consultar entregas.');
    }
    const [orders, metrics] = await Promise.all([
      this.repository.listDeliveryOrders(user),
      this.repository.list('delivery_driver_metrics', 'scope', 'ALL_TIME'),
    ]);
    const enriched = orders.filter((order) => isDelivery(order) && order.status !== 'CANCELLED').map((order) => ({
      ...order, deliveryStatus: order.deliveryStatus || 'PENDING_DISPATCH', isPaid: isDeliverySettled(order),
    })).sort((left, right) => String(left.createdAt || '').localeCompare(String(right.createdAt || '')));
    const available = enriched.filter(order => {
      if (order.assignedDriver?.id || order.creditApprovalStatus === 'PENDING') return false;
      const includesCredit = (order.paymentParts || [{ method: order.paymentMethod }]).some(part => part.method === 'FIADO');
      if ((order.paymentMethod === 'PIX' || includesCredit) && !isDeliverySettled(order)) return false;
      return ['PENDING_DELIVERY', 'PENDING_DISPATCH'].includes(order.deliveryStatus);
    });
    const inRoute = enriched.filter((order) =>
      order.deliveryStatus === 'OUT_FOR_DELIVERY' &&
      Boolean(order.assignedDriver?.id)
    );
    const completed = enriched.filter((order) =>
      order.deliveryStatus === 'DELIVERED' &&
      Boolean(order.deliveredBy?.id || order.assignedDriver?.id)
    );
    const preparing = ['ADMIN', 'CAIXA'].includes(user.role) ? enriched.filter((order) => order.deliveryStatus === 'PENDING_DISPATCH') : [];
    const separating = enriched.filter(order => order.deliveryStatus === 'PREPARING_DELIVERY');
    const recentCompleted = completed.sort((a, b) => String(b.deliveredAt).localeCompare(String(a.deliveredAt))).slice(0, 100);
    return { available, separating, inRoute, completed: recentCompleted, preparing, performance: metrics.length ? metrics : driverPerformance(recentCompleted), performanceScope: metrics.length ? 'SINCE_TRACKING' : 'RECENT_100' };
  }

  async assignDelivery(orderId, user) {
    if (!user || !['ADMIN', 'CAIXA', 'ENTREGADOR'].includes(user.role)) {
      throw new Error('Apenas entregadores, caixa ou administrador podem assumir entregas.');
    }
    const order = await this.repository.assignDelivery(orderId, actor(user));
    const driver = await this.repository.repository.getUserById(order.assignedDriver.id);
    if (driver?.phone) {
      const id = `${order.id}-driver-${order.acceptedAt.replace(/\D/g, '')}`;
      await this.repository.transaction(async tx => tx.set('pdv_outbox', id, { id, orderId, recipient: normalizePhone(driver.phone), kind: 'driver-assigned', status: 'PENDING', attempts: 0 }));
    }
    return order;
  }

  async queueOperationalNotifications(order) {
    const intents = [{ id: `${order.id}-owner-new`, orderId: order.id, kind: 'owner-new' }];
    if (isDelivery(order) && !order.assignedDriver?.id && order.creditApprovalStatus !== 'PENDING' && (order.paymentMethod !== 'PIX' || isDeliverySettled(order))) {
      const drivers = (await this.repository.repository.getAllUsers()).filter(user => user.active !== false && user.role === 'ENTREGADOR' && user.phone);
      for (const driver of drivers) intents.push({ id: `${order.id}-available-${driver.id}`, orderId: order.id, kind: 'driver-available', recipient: normalizePhone(driver.phone) });
    }
    await this.repository.transaction(async tx => {
      const previous = await Promise.all(intents.map(intent => tx.get('pdv_outbox', intent.id)));
      intents.forEach((intent, index) => { if (!previous[index]) tx.set('pdv_outbox', intent.id, { ...intent, status: 'PENDING', attempts: 0, createdAt: new Date().toISOString() }); });
    });
  }

  async startDelivery(orderId, user, payload = {}) {
    const order = await this.repository.startDelivery(orderId, actor(user), payload.route);
    const jobs = await this.repository.list('pdv_outbox', 'orderId', orderId);
    for (const job of jobs.filter(job => job.kind === 'delivery-departure' && job.status !== 'SENT')) await this.deliver(job.id);
    return order;
  }

  async releaseDelivery(orderId, user) {
    if (!user || !['ADMIN', 'CAIXA', 'ENTREGADOR'].includes(user.role)) {
      throw new Error('Sem permissão para devolver entrega.');
    }
    return this.repository.releaseDelivery(orderId, actor(user));
  }

  async completeDelivery(orderId, user, payload = {}) {
    if (!user || !['ADMIN', 'CAIXA', 'ENTREGADOR'].includes(user.role)) {
      throw new Error('Sem permissão para concluir entrega.');
    }
    const existing = await this.repository.read('orders', orderId);
    if (!existing) throw new Error('Pedido não encontrado.');
    if (existing.deliveryStatus === 'DELIVERED') return { order: await this.repository.markDelivered(orderId, actor(user)) };
    assertAssignedDelivery(existing, user);
    if (!isDeliverySettled(existing)) throw new Error('Registre o recebimento antes de concluir a entrega.');
    const delivered = await this.repository.markDelivered(orderId, actor(user), payload.notes || '', payload.actualDistanceKm);
    return { order: { ...delivered, receiptText: formatOrderReceipt(delivered) } };
  }

  async handlePix(txid, endToEndId) {
    if (!/^[a-zA-Z0-9]{26,35}$/.test(txid) || !/^E[a-zA-Z0-9]{31}$/.test(endToEndId || '')) { throw new Error('Identificador Pix inválido.'); }
    if (await this.debtPix?.handlePix(txid, endToEndId)) return true;
    const orders = await this.repository.list('orders', 'pixData.txid', txid);
    // Memory collections use flat filtering; production query targets the exact txid.
    const order = orders[0];
    if (!order || !['PDV', 'WEB_CATALOG'].includes(order.source) || order.paymentMethod !== 'PIX') { return true; }
    if (!order.completedAt) {
      const status = await this.pix.checkReceivedPayment(endToEndId);
      if (!status.isPaid) { return false; }
      const payment = status.raw;
      if (payment.txid !== txid || payment.endToEndId !== endToEndId || payment.chave !== this.pix.pixKey || Math.round(Number(payment.valor) * 100) !== Math.round(partAmount(order, 'PIX') * 100) || (payment.devolucoes || []).length) { throw new Error('Pagamento Sicredi divergente. Verifique a conciliação.'); }
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
      await this.repository.receive(order.id, null, verification);
    }
    const notificationIds = await this.repository.ensurePaymentNotifications(order.id);
    for (const id of notificationIds) await this.deliver(id);
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
      const staleDeparture = job.kind === 'delivery-departure' && order?.deliveryStatus !== 'OUT_FOR_DELIVERY';
        const staleAvailability = job.kind === 'driver-available' && (!order || order.assignedDriver?.id || ['DELIVERED', 'OUT_FOR_DELIVERY'].includes(order.deliveryStatus));
        if (order?.status === 'CANCELLED' || staleDeparture || staleAvailability) {
        await this.repository.updateMessage(id, { status: 'SKIPPED', skipped: true, leaseUntil: 0, lastError: 'Mensagem substituída pelo estado atual do pedido.' });
        return;
      }
      const settlement = job.settlementId ? await this.repository.read('debt_settlements', job.settlementId) : null;
      const settlementMethods = settlement ? (settlement.paymentParts || [{ method: settlement.paymentMethod, amount: settlement.amount }])
        .map((part) => `${part.method}: ${money(part.amount)}`).join(' + ') : '';
      const isOwner = ['owner-paid', 'owner-debt-paid', 'owner-new', 'proof-review', 'closing'].includes(job.kind);
      const recipient = job.kind === 'closing' ? process.env.OWNER_WHATSAPP_NUMBER : ['owner-new', 'proof-review', 'owner-paid'].includes(job.kind) ? process.env.STORE_NOTIFICATION_PHONE || this.ownerPhone : this.ownerPhone;
      const phone = normalizePhone(job.recipient || (isOwner ? recipient : (order?.customerPhone || settlement?.customerPhone)));
      if (!phone && isOwner) { throw new Error('WhatsApp da horta não configurado.'); }
      if (!phone) { await this.repository.updateMessage(id, { status: 'SENT', skipped: true, leaseUntil: 0 }); return; }
      let text;
      if (job.kind === 'closing' || job.kind === 'conversation-text') text = job.text;
      else if (job.kind === 'owner-new') text = `CONFLORA — NOVO PEDIDO #${order.ticketNumber || order.id}\nCliente: ${order.customerName}\nValor: ${money(order.total)}\nPagamento: ${order.completedAt ? 'confirmado' : 'ainda não confirmado'}`;
      else if (job.kind === 'proof-review') text = `CONFLORA — COMPROVANTE AGUARDANDO CONFERÊNCIA\nPedido #${order.ticketNumber || order.id}\nValor: ${money(partAmount(order, 'PIX'))}\nConfira o recebimento na conta bancária antes de aprovar no caixa.`;
      else if (job.kind === 'proof-rejected') text = `CONFLORA — COMPROVANTE RECUSADO\nPedido #${order.ticketNumber || order.id}\n${order.paymentReviewNote}\nEnvie um novo comprovante na página do seu pedido.`;
      else if (job.kind === 'driver-available') text = 'CONFLORA — ENTREGA DISPONÍVEL\nAbra a aba Entregas para consultar e assumir o pedido.';
      else if (job.kind === 'driver-assigned') text = `CONFLORA — ENTREGA ATRIBUÍDA\nPedido #${order.ticketNumber || order.id}\nConsulte os detalhes na aba Entregas.`;
      else if (job.kind === 'delivery-departure') { text = `Seu pedido #${order.ticketNumber || order.id.slice(-6)} saiu para entrega! Responsável: ${order.assignedDriver?.name || 'Equipe Conflora'}. ${isDeliverySettled(order) ? 'Pagamento já registrado.' : 'Pagamento será recebido na entrega.'}`; }
      else if (job.kind === 'receipt' || job.kind === 'customer-paid' || job.kind === 'pix-charge') {
        text = !order.completedAt && !order.paidAt && job.kind !== 'customer-paid' ? formatCustomerOrderMessage(order) : formatOrderReceipt(order);
      }
      else if (settlement?.entryType === 'CREDITO_CLIENTE') { text = `CONFLORA — CRÉDITO DO CLIENTE\nCliente: ${settlement.customerName}\nValor recebido: ${money(settlement.amount)}\nCrédito disponível: ${money(settlement.newCreditBalance)}\nRecebido por: ${settlement.receivedBy.name}\nForma: ${settlementMethods}`; }
      else if (settlement) { text = `CONFLORA — QUITAÇÃO DE FIADO\nCliente: ${settlement.customerName}\nValor: ${money(settlement.amount)}\nSaldo devedor: ${money(settlement.newBalance)}${settlement.excessCredit ? '\nExcedente registrado como crédito: ' + money(settlement.excessCredit) : ''}\nRecebido por: ${settlement.receivedBy.name}\nForma: ${settlementMethods}`; }
      else {
        const author = order.createdBy?.name || order.customerName || 'Catálogo online';
        const receiver = order.receivedBy?.name || (order.verifiedVia === 'SICREDI_PIX_WEBHOOK' ? 'Sicredi · confirmação automática' : 'Equipe Conflora');
        text = `CONFLORA — PIX CONFIRMADO\nPedido #${order.ticketNumber}\nCliente: ${order.customerName}\nTotal da venda: ${money(order.total)}\nValor Pix: ${money(partAmount(order, 'PIX'))}\nPedido feito por: ${author}\nRecebido por: ${receiver}\nPedido finalizado. Estoque atualizado.`;
      }
      const chunks = messageChunks(text, this.whatsapp.sendPdvText ? 900 : 3500);
      for (let index = job.textChunksSent || 0; index < chunks.length; index++) {
        const send = this.whatsapp.sendPdvText || this.whatsapp.sendTextMessage;
        const result = await send.call(this.whatsapp, phone, chunks[index]);
        if (result?.mock || !result?.messages?.[0]?.id) { throw new Error('WhatsApp não confirmou o envio.'); }
        await this.repository.updateMessage(id, { textChunksSent: index + 1, providerMessageId: result.messages[0].id, deliveryStatus: 'ACCEPTED', leaseUntil: Date.now() + 120000 });
      }
      if (['receipt', 'pix-charge'].includes(job.kind) && order.pixData && !order.completedAt && !order.paidAt && !job.qrSent) {
      const image = Buffer.from(order.pixData.qrCodeBase64.split(',')[1], 'base64');
        const result = await this.whatsapp.sendImageBuffer(phone, image, `Pix pedido #${order.ticketNumber} — ${money(order.pixData.amount || order.total)}\n\nPIX COPIA E COLA:\n${order.pixData.pixCopiaECola}`);
        if (!result?.messages?.[0]?.id) { throw new Error('WhatsApp não confirmou o QR Code.'); }
        await this.repository.updateMessage(id, { qrSent: true });
      }
      if (job.reportFileName && !job.documentSent) {
        const storage = new (require('../reports/private-report-storage').PrivateReportStorage)(this.repository.repository);
        const result = await this.whatsapp.sendDocumentBuffer(phone, await storage.read(job.reportFileName), 'fechamento-conflora.pdf', 'Fechamento de caixa Conflora');
        if (!result?.messages?.[0]?.id) throw new Error('A API não confirmou o relatório.');
        await this.repository.updateMessage(id, { documentSent: true, providerDocumentId: result.messages[0].id });
      }
      await this.repository.updateMessage(id, { status: 'SENT', leaseUntil: 0, sentAt: new Date().toISOString(), lastError: '' });
    } catch (error) {
      require('../shared/logger').error('Falha no envio de notificação operacional', error, { source: 'WHATSAPP', jobId: id, kind: job.kind });
      await this.repository.updateMessage(id, { leaseUntil: 0, nextAttemptAt: Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)), lastError: error.message });
    }
  }

  async retryMessages() {
    if (this.retryMessagesPromise) return this.retryMessagesPromise;
    this.retryMessagesPromise = this.retryPendingMessages().finally(() => { this.retryMessagesPromise = null; });
    return this.retryMessagesPromise;
  }

  async retryPendingMessages() {
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

module.exports = { PdvService, actor, normalizePhone, requestId, ORDER_PAYMENT_METHODS, normalizeDeliveryLocation };
