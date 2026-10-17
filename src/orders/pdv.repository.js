const { createHash } = require('node:crypto');
const { remainingStock, validateStockQuantity } = require('./order-integrity');
const { normalizePaymentParts, partAmount } = require('./payment-parts');
const { prepareStockReservation, applyStockReservation } = require('./stock-reservation');
const { setInterval, clearInterval } = require('node:timers');

/** PDV writes never fall back to process memory when Firestore fails. */
class PdvRepository {
  constructor(repository) {
    this.repository = repository;
    this.memory = new Map();
    this.queue = Promise.resolve();
  }

  async transaction(work) {
    const repo = this.repository;
    if (repo.firestore && !repo._firestoreClientDisabled) {
      return repo.firestore.runTransaction(async (tx) => work({
        get: async (collection, id) => {
          const doc = await tx.get(repo.firestore.collection(collection).doc(id));
          return doc.exists ? { ...doc.data(), id: doc.id || id } : null;
        },
        set: (collection, id, value) => tx.set(repo.firestore.collection(collection).doc(id), value),
      }));
    }
    if (!repo.isInMemory || repo.firestore) { throw new Error('Firestore indisponível. Operação não registrada.'); }
    const operation = this.queue.then(async () => {
      const collections = { orders: repo.inMemoryOrders, products: repo.inMemoryProducts, customers: repo.inMemoryCustomers, users: repo.inMemoryUsers, discount_approvals: repo.inMemoryDiscountApprovals };
      const writes = [];
      const mapFor = (collection) => {
        if (collections[collection]) { return collections[collection]; }
        if (!this.memory.has(collection)) { this.memory.set(collection, new Map()); }
        return this.memory.get(collection);
      };
      const result = await work({
        get: async (collection, id) => structuredClone(mapFor(collection).get(id) || null),
        set: (collection, id, value) => writes.push([collection, id, structuredClone(value)]),
      });
      for (const [collection, id, value] of writes) {
        mapFor(collection).set(id, value);
        const mirrorField = collection === 'customer_debts'
          ? 'inMemoryCustomerDebts'
          : collection === 'debt_settlements' ? 'inMemoryDebtSettlements' : '';
        if (mirrorField) {
          const entries = repo[mirrorField] || (repo[mirrorField] = []);
          const existingIndex = entries.findIndex((entry) => String(entry.id) === String(id));
          if (existingIndex >= 0) { entries[existingIndex] = structuredClone(value); }
          else { entries.push(structuredClone(value)); }
        }
      }
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }

  async read(collection, id) { return this.transaction((tx) => tx.get(collection, id)); }

  async list(collection, field, value) {
    const repo = this.repository;
    if (repo.firestore && !repo._firestoreClientDisabled) {
      const result = await repo.firestore.collection(collection).where(field, '==', value).get();
      return result.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    }
    if (!repo.isInMemory || repo.firestore) { throw new Error('Firestore indisponível.'); }
    const map = collection === 'orders' ? repo.inMemoryOrders : this.memory.get(collection);
    return [...(map?.values() || [])].filter((row) => field.split('.').reduce((current, key) => current?.[key], row) === value);
  }

  watchOpenOrders(onChange, onError = () => {}) {
    const repo = this.repository;
    if (repo.firestore && !repo._firestoreClientDisabled) {
      return repo.firestore.collection('orders')
        .where('status', 'in', ['AWAITING_CASHIER', 'AWAITING_PAYMENT', 'CREATING_PIX', 'AWAITING_PIX', 'PENDING', 'CONFIRMED', 'PAID_CONFIRMED', 'DELIVERED'])
        .onSnapshot((snapshot) => {
          onChange(snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id })));
        }, onError);
    }
    if (!repo.isInMemory || repo.firestore) {
      onError(new Error('Firestore indisponível para acompanhar comandas em tempo real.'));
      return () => {};
    }
    let active = true;
    const notify = () => {
      if (!active) return;
      const orders = [...repo.inMemoryOrders.values()].filter((order) =>
        ['AWAITING_CASHIER', 'AWAITING_PAYMENT', 'CREATING_PIX', 'AWAITING_PIX', 'PENDING', 'CONFIRMED', 'PAID_CONFIRMED', 'DELIVERED'].includes(order.status),
      );
      onChange(orders);
    };
    const timer = setInterval(notify, 2500);
    timer.unref?.();
    notify();
    return () => { active = false; clearInterval(timer); };
  }

  async create(order) {
    return this.transaction(async (tx) => {
      const previous = await tx.get('orders', order.id);
      if (previous) {
        if (previous.requestHash !== order.requestHash || previous.createdBy.id !== order.createdBy.id) { throw new Error('Identificador já utilizado por outra venda.'); }
        return previous;
      }
      let savedOrder = order;
      if (String(order.paymentMethod || '').toUpperCase() === 'PIX' && order.pixData) {
        const reservation = await prepareStockReservation(tx, order.items);
        applyStockReservation(tx, reservation, new Date().toISOString());
        savedOrder = { ...order, inventoryReserved: true, reservedItems: reservation.reservedItems };
      }
      tx.set('orders', savedOrder.id, savedOrder);
      if (savedOrder.status !== 'CREATING_PIX') {
        tx.set('pdv_outbox', `${savedOrder.id}-receipt`, { id: `${savedOrder.id}-receipt`, orderId: savedOrder.id, kind: 'receipt', status: 'PENDING', attempts: 0 });
      }
      return savedOrder;
    });
  }

  async attachCharge(orderId, charge) {
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      const jobId = `${orderId}-receipt`;
      const job = await tx.get('pdv_outbox', jobId);
      if (!order || order.pixData?.txid !== charge.txid) { throw new Error('Cobrança sem pedido correspondente.'); }
      if (order.status === 'CANCELLED') { throw new Error('Pedido cancelado; concilie a cobrança no Sicredi.'); }
      if (!Number.isFinite(Number(charge.amount)) || Math.round(Number(charge.amount) * 100) !== Math.round(partAmount(order, 'PIX') * 100) || !String(charge.pixCopiaECola || '').trim() || !String(charge.qrCodeBase64 || '').startsWith('data:image/')) {
        throw new Error('Cobrança Pix divergente do pedido ou sem QR Code válido.');
      }
      const updated = { ...order, pixData: charge, pixCopiaECola: charge.pixCopiaECola, status: order.completedAt ? order.status : 'AWAITING_PIX' };
      tx.set('orders', orderId, updated);
      if (!job) { tx.set('pdv_outbox', jobId, { id: jobId, orderId, kind: 'receipt', status: 'PENDING', attempts: 0 }); }
      return updated;
    });
  }

  async cancelOrder(orderId, reason) {
    return this.repository.cancelOrder(orderId, reason);
  }

  async advanceToPayment(orderId, receiver) {
    if (!['ADMIN', 'CAIXA'].includes(receiver?.role)) throw new Error('Somente Caixa/Admin podem confirmar comandas.');
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      if (!order || !['PDV', 'WEB_CATALOG'].includes(order.source)) throw new Error('Comanda não encontrada.');
      if (order.status === 'AWAITING_PAYMENT' && !order.completedAt) return order;
      if (order.completedAt || !['AWAITING_CASHIER', 'PENDING'].includes(order.status) || order.pixData?.txid) {
        throw new Error('Só é possível mover de esperando confirmação para esperando pagamento.');
      }
      const reservation = order.inventoryReserved ? null : await prepareStockReservation(tx, order.items);
      const now = new Date().toISOString();
      const ttl = Math.min(86400, Math.max(300, Number(process.env.PIX_PAYMENT_TTL_SECONDS) || 3600));
      if (reservation) applyStockReservation(tx, reservation, now);
      const updated = { ...order, status: 'AWAITING_PAYMENT', paymentStatus: 'PENDING', confirmedBy: receiver,
        confirmedAt: now, updatedAt: now, paymentExpiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        inventoryReserved: true, reservedItems: reservation?.reservedItems || order.reservedItems };
      tx.set('orders', orderId, updated);
      return updated;
    });
  }

  async ensurePaymentNotifications(orderId) {
    const kinds = ['customer-paid', 'owner-paid'];
    return this.transaction(async (tx) => {
      const ids = kinds.map((kind) => `${orderId}-${kind}`);
      const jobs = await Promise.all(ids.map((id) => tx.get('pdv_outbox', id)));
      kinds.forEach((kind, index) => {
        if (jobs[index]) return;
        const id = ids[index];
        tx.set('pdv_outbox', id, { id, kind, orderId, status: 'PENDING', attempts: 0 });
      });
      return ids;
    });
  }

  async requestPixAtCashier(orderId, receiver, requestedParts) {
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      if (!order || !['PDV', 'WEB_CATALOG'].includes(order.source)) { throw new Error('Comanda não encontrada.'); }
      if (order.completedAt || order.status === 'CANCELLED') { throw new Error('Esta comanda já foi finalizada ou cancelada.'); }
      if (!['ADMIN', 'CAIXA'].includes(receiver?.role)) { throw new Error('Somente o caixa pode gerar a cobrança Pix.'); }
      if (Date.parse(order.pixExpiresAt || order.paymentExpiresAt || '') <= Date.now()) throw new Error('O prazo de pagamento venceu. Inicie uma nova comanda.');
      if (order.paymentMethod === 'PIX' && order.pixData) { return order; }
      if (!['AWAITING_CASHIER', 'AWAITING_PAYMENT'].includes(order.status)) { throw new Error('A comanda não está aguardando recebimento no caixa.'); }
      const paymentParts = normalizePaymentParts(requestedParts, 'PIX', order.total);
      if (!paymentParts.some((part) => part.method === 'PIX') || paymentParts.some((part) => part.method === 'SALDO_CLIENTE')) throw new Error('Combine Pix com dinheiro, débito, crédito ou fiado.');
      if (paymentParts.some((part) => part.method === 'FIADO') && !order.customerId) throw new Error('Fiado exige cliente cadastrado.');
      const reservation = order.inventoryReserved ? null : await prepareStockReservation(tx, order.items);
      const now = new Date().toISOString();
      const pixTtlSeconds = Math.min(86400, Math.max(300, Number(process.env.PIX_PAYMENT_TTL_SECONDS) || 3600));
      const pixData = { txid: createHash('sha256').update(order.id).digest('hex').slice(0, 32).toUpperCase(), provider: 'SICREDI', expiresInSeconds: pixTtlSeconds };
      if (reservation) applyStockReservation(tx, reservation, now);
      const updated = { ...order, paymentMethod: 'PIX', paymentStatus: 'PENDING', status: 'CREATING_PIX', pixData, pixCopiaECola: '',
        paymentParts: paymentParts.map((part) => ({ ...part, ...(['DINHEIRO', 'DEBITO', 'CREDITO'].includes(part.method) ? { status: 'RECEIVED_AT_CASHIER', receivedBy: receiver } : {}) })), mixedReceivedBy: receiver, deferToCashier: false,
        inventoryReserved: true, reservedItems: reservation?.reservedItems || order.reservedItems,
        pixTtlSeconds, pixExpiresAt: new Date(Date.now() + pixTtlSeconds * 1000).toISOString(), updatedAt: now };
      tx.set('orders', order.id, updated);
      return updated;
    });
  }

  /** Stock, debt, attribution, payment and notification intent commit together. */
  async receive(orderId, receiver, verification = null, cashReceived = null, paymentMethodOverride = null, { sendFinalReceipt = false, requestedParts } = {}) {
    const inventory = await this.repository.getInventorySettings();
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      if (!order || !['PDV', 'WEB_CATALOG'].includes(order.source)) { throw new Error('Comanda não encontrada.'); }
      if (order.status === 'CANCELLED') { throw new Error('Comanda cancelada.'); }
      if (order.completedAt) { return { ...order, alreadyConfirmed: true }; }
      if (Date.parse(order.pixExpiresAt || order.paymentExpiresAt || '') <= Date.now()) {
        throw new Error('O prazo de pagamento venceu. Aguarde o cancelamento e a liberação do estoque.');
      }
      const paymentParts = normalizePaymentParts(requestedParts || (paymentMethodOverride ? undefined : order.paymentParts), paymentMethodOverride || order.paymentMethod, order.total);
      if (order.pixData?.txid && requestedParts) {
        const issuedParts = normalizePaymentParts(order.paymentParts, order.paymentMethod, order.total);
        const allocation = (parts) => JSON.stringify(parts.map(({ method, amount }) => ({ method, amount })).sort((a, b) => a.method.localeCompare(b.method)));
        if (allocation(paymentParts) !== allocation(issuedParts)) throw new Error('As parcelas da cobrança Pix emitida não podem ser alteradas.');
      }
      const amountFor = (method) => paymentParts.find((part) => part.method === method)?.amount || 0;
      const paymentMethod = amountFor('PIX') ? 'PIX' : paymentParts.length > 1 ? 'MISTO' : paymentParts[0].method;
      if (paymentMethodOverride && !['AWAITING_CASHIER', 'AWAITING_PAYMENT'].includes(order.status)) { throw new Error('A forma de pagamento só pode ser escolhida antes do recebimento.'); }
      if (paymentMethodOverride && paymentMethod === 'PIX' && verification?.verifiedVia !== 'MANUAL_CAIXA_PIX') { throw new Error('Pix exige cobrança Sicredi ou comprovante conferido pelo caixa.'); }
      if (order.paymentMethod === 'PIX' && order.pixData && paymentMethod !== 'PIX') { throw new Error('Uma cobrança Pix já emitida não pode ser convertida; aguarde a confirmação do Sicredi.'); }
      if (paymentMethod === 'PIX' && (!verification || verification.txid !== order.pixData?.txid || verification.amountMinor !== Math.round(amountFor('PIX') * 100))) {
        throw new Error('Pix exige confirmação do Sicredi com identificador e valor exatos.');
      }
      if (paymentMethod === 'PIX' && verification.verifiedVia === 'MANUAL_CAIXA_PIX' &&
        (!verification.manualPixProofSeen || String(verification.manualPixNote || '').trim().length < 8 || !['ADMIN', 'CAIXA'].includes(receiver?.role))) {
        throw new Error('Confirmação manual do Pix exige comprovante conferido e justificativa pelo menos 8 caracteres.');
      }
      if (paymentMethod !== 'PIX' && !['ADMIN', 'CAIXA'].includes(receiver?.role)) { throw new Error('Somente o caixa pode receber esta comanda.'); }
      const tendered = cashReceived ?? order.cashTendered ?? amountFor('DINHEIRO');
      if (amountFor('DINHEIRO') && (!Number.isFinite(tendered) || Math.round(tendered * 100) < Math.round(amountFor('DINHEIRO') * 100))) { throw new Error('Valor recebido em dinheiro menor que a parcela em dinheiro.'); }
      const now = new Date().toISOString();
      const quantities = new Map();
      for (const item of order.items) {
        const total = (quantities.get(item.productId) || 0) + validateStockQuantity(item);
        quantities.set(item.productId, Number(total.toFixed(3)));
      }
      let hasActiveReservations = false;
      if (!inventory.stockControlEnabled && !order.inventoryReserved) {
        for (const id of quantities.keys()) {
          const product = await tx.get('products', id);
          if (Number(product?.reservedQuantity || 0) > 0) { hasActiveReservations = true; break; }
        }
      }
      const products = [];
      if ((inventory.stockControlEnabled || order.inventoryReserved || hasActiveReservations) && !order.stockDeducted) {
        for (const [id, quantity] of quantities) {
          const product = await tx.get('products', id);
          if (!product) { throw new Error('Produto não encontrado para baixa.'); }
          const ownReservation = order.inventoryReserved
            ? Number((order.reservedItems || []).find((item) => String(item.productId) === id)?.quantity || 0)
            : 0;
          const otherReservations = Math.max(0, Number(product.reservedQuantity || 0) - ownReservation);
          const currentStock = Number(product.stockQuantity ?? product.estoque ?? 0);
          if (currentStock - otherReservations < quantity) throw new Error(`Estoque disponível insuficiente para ${product.name || id}.`);
          products.push({ id, quantity, product, stock: remainingStock(product, quantity), ownReservation });
        }
      }
      const onAccount = amountFor('FIADO') > 0;
      const usingCredit = amountFor('SALDO_CLIENTE') > 0;
      const customer = onAccount || usingCredit ? await tx.get('customers', order.customerId) : null;
      if ((onAccount || usingCredit) && !customer) { throw new Error('Fiado ou uso de crédito exige cliente cadastrado.'); }
      const creditMinor = Math.round(Number(customer?.creditBalance || 0) * 100);
      const totalMinor = Math.round(amountFor('SALDO_CLIENTE') * 100);
      if (usingCredit && creditMinor < totalMinor) { throw new Error('O crédito disponível foi alterado e não cobre mais o total. Atualize o saldo antes de confirmar.'); }
      // No transaction reads after this point.
      for (const { id, quantity, product, stock, ownReservation } of products) {
        tx.set('products', id, { ...product, stockQuantity: stock, estoque: stock,
          ...(ownReservation ? { reservedQuantity: Math.max(0, Number(product.reservedQuantity || 0) - ownReservation) } : {}), updatedAt: now });
        tx.set('stock_movements', `${order.id}-${id}`, { productId: id, productName: product.name, orderId, quantityDeducted: quantity, previousStock: stock + quantity, newStock: stock, type: 'SALE_PDV', createdAt: now });
      }
      const receivedBy = paymentMethod === 'PIX' && verification?.verifiedVia !== 'MANUAL_CAIXA_PIX'
        ? (order.mixedReceivedBy || order.createdBy || { id: 'SICREDI', name: 'Sicredi · confirmação automática', role: 'SYSTEM' }) : receiver;
      const completed = { ...order, paymentMethod, paymentParts: paymentParts.map((part) => ({ ...part, receivedBy, status: part.method === 'FIADO' ? 'ON_ACCOUNT' : 'APPROVED' })), receivedBy, cashierName: receivedBy.name, cashierEmail: receivedBy.email || '', status: 'CONFIRMED',
        paymentStatus: onAccount ? 'ON_ACCOUNT' : 'APPROVED', paidAt: onAccount ? null : now,
        completedAt: now, stockDeducted: true, stockDeductedAt: order.stockDeductedAt || now,
        inventoryReserved: false, reservationReleasedAt: order.inventoryReserved ? now : order.reservationReleasedAt || '',
        verifiedVia: verification ? (verification.verifiedVia || 'SICREDI_PIX_WEBHOOK') : 'CAIXA', updatedAt: now,
        ...(amountFor('DINHEIRO') ? { cashReceived: tendered, changeGiven: (Math.round(tendered * 100) - Math.round(amountFor('DINHEIRO') * 100)) / 100 } : {}),
        ...(verification ? { paymentTransactionId: verification.endToEndId || `MANUAL-${order.id}`, paymentVerifiedAmount: verification.amountMinor / 100, pixVerified: true } : {}),
        ...(verification?.verifiedVia === 'MANUAL_CAIXA_PIX' ? { manualPixProofSeen: true, manualPixNote: String(verification.manualPixNote).trim().slice(0, 500), manualPixConfirmedBy: receiver,
          paymentVerificationStoppedAt: now, paymentVerificationStopReason: 'MANUAL_CONFIRMATION' } : {}) };
      if (onAccount) {
        tx.set('customers', order.customerId, { ...customer, debtBalance: (Math.round(Number(customer.debtBalance || 0) * 100) + Math.round(amountFor('FIADO') * 100)) / 100, ...(usingCredit ? { creditBalance: (creditMinor - totalMinor) / 100 } : {}), updatedAt: now });
        tx.set('customer_debts', order.id, { id: order.id, orderId, customerKey: order.customerId, customerName: order.customerName, amount: amountFor('FIADO'), type: 'DEBITO_FIADO', createdBy: order.createdBy, receivedBy, createdAt: now });
      }
      if (usingCredit) {
        const newCreditBalance = (creditMinor - totalMinor) / 100;
        tx.set('customers', order.customerId, { ...customer, creditBalance: newCreditBalance, ...(onAccount ? { debtBalance: (Math.round(Number(customer.debtBalance || 0) * 100) + Math.round(amountFor('FIADO') * 100)) / 100 } : {}), updatedAt: now });
        tx.set('debt_settlements', `credit-use-${order.id}`, {
          id: `credit-use-${order.id}`, orderId, customerKey: order.customerId,
          customerName: order.customerName, amount: amountFor('SALDO_CLIENTE'), paymentMethod: 'SALDO_CLIENTE',
          entryType: 'USO_CREDITO', type: 'USO_CREDITO', newCreditBalance,
          receivedBy, notes: 'Crédito do cliente utilizado em uma venda.', createdAt: now,
        });
      }
      tx.set('orders', order.id, completed);
      if (verification) {
        for (const kind of ['customer-paid', 'owner-paid']) {
          const id = `${order.id}-${kind}`;
          tx.set('pdv_outbox', id, { id, kind, orderId, status: 'PENDING', attempts: 0 });
        }
      }
      if (sendFinalReceipt) {
        const id = `${order.id}-final-receipt`;
        tx.set('pdv_outbox', id, { id, kind: 'receipt', orderId: order.id, status: 'PENDING', attempts: 0 });
      }
      return completed;
    });
  }

  async settle({ id, customerKey, amount, paymentMethod, paymentParts, verification, notes, receivedBy, entryType = 'QUITACAO_FIADO' }) {
    const parts = normalizePaymentParts(paymentParts, paymentMethod, amount);
    if (parts.some((part) => !['DINHEIRO', 'DEBITO', 'CREDITO', 'PIX'].includes(part.method))) throw new Error('Receba a dívida em dinheiro, cartão ou Pix conferido.');
    if (parts.some((part) => part.method === 'PIX') && (!verification?.manualPixProofSeen || String(verification.manualPixNote || '').trim().length < 8 || !['ADMIN', 'CAIXA'].includes(receivedBy?.role))) {
      throw new Error('Confira o comprovante Pix e registre a justificativa antes de quitar a dívida.');
    }
    const method = parts.length > 1 ? 'MISTO' : parts[0].method;
    return this.transaction(async (tx) => {
      const previous = await tx.get('debt_settlements', id);
      if (previous) {
        const previousParts = previous.paymentParts || [{ method: previous.paymentMethod, amount: previous.amount }];
        if (previous.customerKey !== customerKey || previous.amount !== amount || JSON.stringify(previousParts) !== JSON.stringify(parts) || previous.entryType !== entryType || previous.receivedBy.id !== receivedBy.id) { throw new Error('Identificador de recebimento já utilizado.'); }
        return previous;
      }
      const customer = await tx.get('customers', customerKey);
      const balanceMinor = Math.round(Number(customer?.debtBalance || 0) * 100);
      const amountMinor = Math.round(amount * 100);
      if (!customer || amountMinor <= 0 || !['QUITACAO_FIADO', 'CREDITO_CLIENTE'].includes(entryType)) { throw new Error('Recebimento inválido ou cliente não cadastrado.'); }
      if (entryType === 'QUITACAO_FIADO' && amountMinor > balanceMinor) { throw new Error('O valor recebido não pode ser maior que a dívida atual.'); }
      const now = new Date().toISOString();
      const newBalance = entryType === 'QUITACAO_FIADO' ? (balanceMinor - amountMinor) / 100 : Number(customer.debtBalance || 0);
      const newCreditBalance = entryType === 'CREDITO_CLIENTE'
        ? (Math.round(Number(customer.creditBalance || 0) * 100) + amountMinor) / 100
        : Number(customer.creditBalance || 0);
      const settlement = { id, customerKey, customerName: customer.name, customerPhone: customer.phone || '', amount,
        paymentMethod: method, paymentParts: parts, notes, receivedBy, operatorName: receivedBy.name, newBalance, newCreditBalance, entryType, type: entryType, createdAt: now,
        ...(verification ? { verifiedVia: 'MANUAL_CAIXA_PIX', manualPixProofSeen: true, manualPixNote: verification.manualPixNote } : {}) };
      tx.set('customers', customerKey, { ...customer, debtBalance: newBalance, creditBalance: newCreditBalance, updatedAt: now });
      tx.set('debt_settlements', id, settlement);
      tx.set('pdv_outbox', id, { id, settlementId: id, kind: 'debt-receipt', status: 'PENDING', attempts: 0 });
      return settlement;
    });
  }

  async claimMessage(id) {
    return this.transaction(async (tx) => {
      const job = await tx.get('pdv_outbox', id);
      if (!job || job.status === 'SENT' || job.nextAttemptAt > Date.now() || job.leaseUntil > Date.now()) { return null; }
      const claimed = { ...job, leaseUntil: Date.now() + 120000, attempts: job.attempts + 1 };
      tx.set('pdv_outbox', id, claimed);
      return claimed;
    });
  }

  async updateMessage(id, updates) {
    return this.transaction(async (tx) => {
      const job = await tx.get('pdv_outbox', id);
      tx.set('pdv_outbox', id, { ...job, ...updates });
    });
  }
}

module.exports = { PdvRepository };
