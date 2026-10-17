const { remainingStock, validateStockQuantity } = require('./order-integrity');

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

  async create(order) {
    return this.transaction(async (tx) => {
      const previous = await tx.get('orders', order.id);
      if (previous) {
        if (previous.requestHash !== order.requestHash || previous.createdBy.id !== order.createdBy.id) { throw new Error('Identificador já utilizado por outra venda.'); }
        return previous;
      }
      tx.set('orders', order.id, order);
      if (order.status !== 'CREATING_PIX') {
        tx.set('pdv_outbox', `${order.id}-receipt`, { id: `${order.id}-receipt`, orderId: order.id, kind: 'receipt', status: 'PENDING', attempts: 0 });
      }
      return order;
    });
  }

  async attachCharge(orderId, charge) {
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      const jobId = `${orderId}-receipt`;
      const job = await tx.get('pdv_outbox', jobId);
      if (!order || order.pixData?.txid !== charge.txid) { throw new Error('Cobrança sem pedido correspondente.'); }
      if (order.status === 'CANCELLED') { throw new Error('Pedido cancelado; concilie a cobrança no Sicredi.'); }
      if (!Number.isFinite(Number(charge.amount)) || Math.round(Number(charge.amount) * 100) !== Math.round(Number(order.total) * 100) || !String(charge.pixCopiaECola || '').trim() || !String(charge.qrCodeBase64 || '').startsWith('data:image/')) {
        throw new Error('Cobrança Pix divergente do pedido ou sem QR Code válido.');
      }
      const updated = { ...order, pixData: charge, pixCopiaECola: charge.pixCopiaECola, status: order.completedAt ? order.status : 'AWAITING_PIX' };
      tx.set('orders', orderId, updated);
      if (!job) { tx.set('pdv_outbox', jobId, { id: jobId, orderId, kind: 'receipt', status: 'PENDING', attempts: 0 }); }
      return updated;
    });
  }

  async requestPixAtCashier(orderId, receiver) {
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      if (!order || order.source !== 'PDV') { throw new Error('Comanda não encontrada.'); }
      if (order.completedAt || order.status === 'CANCELLED') { throw new Error('Esta comanda já foi finalizada ou cancelada.'); }
      if (!['ADMIN', 'CAIXA'].includes(receiver?.role)) { throw new Error('Somente o caixa pode gerar a cobrança Pix.'); }
      if (order.paymentMethod === 'PIX') { return order; }
      if (order.status !== 'AWAITING_CASHIER') { throw new Error('A comanda não está aguardando recebimento no caixa.'); }
      const pixData = { txid: order.id.replace(/-/g, '').toUpperCase(), provider: 'SICREDI' };
      const updated = { ...order, paymentMethod: 'PIX', paymentStatus: 'PENDING', status: 'CREATING_PIX', pixData, pixCopiaECola: '', updatedAt: new Date().toISOString() };
      tx.set('orders', order.id, updated);
      return updated;
    });
  }

  async queuePixChargeReceipt(orderId) {
    return this.transaction(async (tx) => {
      const id = `${orderId}-pix-charge`;
      const previous = await tx.get('pdv_outbox', id);
      if (!previous || previous.status === 'FAILED') {
        tx.set('pdv_outbox', id, { id, orderId, kind: 'pix-charge', status: 'PENDING', attempts: 0 });
      }
      return id;
    });
  }

  /** Stock, debt, attribution, payment and notification intent commit together. */
  async receive(orderId, receiver, verification = null, cashReceived = null, paymentMethodOverride = null, { sendFinalReceipt = false } = {}) {
    const inventory = await this.repository.getInventorySettings();
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      if (!order || order.source !== 'PDV') { throw new Error('Comanda não encontrada.'); }
      if (order.status === 'CANCELLED') { throw new Error('Comanda cancelada.'); }
      if (order.completedAt) { return { ...order, alreadyConfirmed: true }; }
      const paymentMethod = paymentMethodOverride ? String(paymentMethodOverride).toUpperCase() : order.paymentMethod;
      if (paymentMethodOverride && order.status !== 'AWAITING_CASHIER') { throw new Error('A forma de pagamento só pode ser escolhida antes do recebimento.'); }
      if (paymentMethodOverride && !['DINHEIRO', 'DEBITO', 'CREDITO', 'FIADO', 'SALDO_CLIENTE'].includes(paymentMethod)) { throw new Error('Forma de pagamento inválida para recebimento manual.'); }
      if (order.paymentMethod === 'PIX' && paymentMethod !== 'PIX') { throw new Error('Uma cobrança Pix já emitida não pode ser convertida; aguarde a confirmação do Sicredi.'); }
      if (paymentMethod === 'PIX' && (!verification || verification.txid !== order.pixData?.txid || verification.amountMinor !== Math.round(order.total * 100))) {
        throw new Error('Pix exige confirmação do Sicredi com identificador e valor exatos.');
      }
      if (paymentMethod !== 'PIX' && !['ADMIN', 'CAIXA'].includes(receiver?.role)) { throw new Error('Somente o caixa pode receber esta comanda.'); }
      const tendered = cashReceived ?? order.cashTendered ?? order.total;
      if (paymentMethod === 'DINHEIRO' && (!Number.isFinite(tendered) || Math.round(tendered * 100) < Math.round(order.total * 100))) { throw new Error('Valor recebido em dinheiro menor que o total.'); }
      const now = new Date().toISOString();
      const quantities = new Map();
      for (const item of order.items) {
        const total = (quantities.get(item.productId) || 0) + validateStockQuantity(item);
        quantities.set(item.productId, Number(total.toFixed(3)));
      }
      const products = [];
      if (inventory.stockControlEnabled && !order.stockDeducted) {
        for (const [id, quantity] of quantities) {
          const product = await tx.get('products', id);
          if (!product) { throw new Error('Produto não encontrado para baixa.'); }
          products.push({ id, quantity, product, stock: remainingStock(product, quantity) });
        }
      }
      const onAccount = paymentMethod === 'FIADO';
      const usingCredit = paymentMethod === 'SALDO_CLIENTE';
      const customer = onAccount || usingCredit ? await tx.get('customers', order.customerId) : null;
      if ((onAccount || usingCredit) && !customer) { throw new Error('Fiado ou uso de crédito exige cliente cadastrado.'); }
      const creditMinor = Math.round(Number(customer?.creditBalance || 0) * 100);
      const totalMinor = Math.round(Number(order.total) * 100);
      if (usingCredit && creditMinor < totalMinor) { throw new Error('O crédito disponível foi alterado e não cobre mais o total. Atualize o saldo antes de confirmar.'); }
      // No transaction reads after this point.
      for (const { id, quantity, product, stock } of products) {
        tx.set('products', id, { ...product, stockQuantity: stock, estoque: stock, updatedAt: now });
        tx.set('stock_movements', `${order.id}-${id}`, { productId: id, productName: product.name, orderId, quantityDeducted: quantity, previousStock: stock + quantity, newStock: stock, type: 'SALE_PDV', createdAt: now });
      }
      const receivedBy = paymentMethod === 'PIX' ? order.createdBy : receiver;
      const completed = { ...order, paymentMethod, receivedBy, cashierName: receivedBy.name, cashierEmail: receivedBy.email || '', status: 'CONFIRMED',
        paymentStatus: onAccount ? 'ON_ACCOUNT' : 'APPROVED', paidAt: onAccount ? null : now,
        completedAt: now, stockDeducted: true, stockDeductedAt: order.stockDeductedAt || now,
        verifiedVia: verification ? 'SICREDI_PIX_WEBHOOK' : 'CAIXA', updatedAt: now,
        ...(paymentMethod === 'DINHEIRO' ? { cashReceived: tendered, changeGiven: (Math.round(tendered * 100) - Math.round(order.total * 100)) / 100 } : {}),
        ...(verification ? { paymentTransactionId: verification.endToEndId, paymentVerifiedAmount: verification.amountMinor / 100, pixVerified: true } : {}) };
      if (onAccount) {
        tx.set('customers', order.customerId, { ...customer, debtBalance: (Math.round(Number(customer.debtBalance || 0) * 100) + Math.round(order.total * 100)) / 100, updatedAt: now });
        tx.set('customer_debts', order.id, { id: order.id, orderId, customerKey: order.customerId, customerName: order.customerName, amount: order.total, type: 'DEBITO_FIADO', createdBy: order.createdBy, receivedBy, createdAt: now });
      }
      if (usingCredit) {
        const newCreditBalance = (creditMinor - totalMinor) / 100;
        tx.set('customers', order.customerId, { ...customer, creditBalance: newCreditBalance, updatedAt: now });
        tx.set('debt_settlements', `credit-use-${order.id}`, {
          id: `credit-use-${order.id}`, orderId, customerKey: order.customerId,
          customerName: order.customerName, amount: order.total, paymentMethod: 'SALDO_CLIENTE',
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

  async settle({ id, customerKey, amount, paymentMethod, notes, receivedBy, entryType = 'QUITACAO_FIADO' }) {
    return this.transaction(async (tx) => {
      const previous = await tx.get('debt_settlements', id);
      if (previous) {
        if (previous.customerKey !== customerKey || previous.amount !== amount || previous.paymentMethod !== paymentMethod || previous.entryType !== entryType || previous.receivedBy.id !== receivedBy.id) { throw new Error('Identificador de recebimento já utilizado.'); }
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
      const settlement = { id, customerKey, customerName: customer.name, customerPhone: customer.phone || '', amount, paymentMethod, notes, receivedBy, operatorName: receivedBy.name, newBalance, newCreditBalance, entryType, type: entryType, createdAt: now };
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
