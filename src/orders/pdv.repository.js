const { activeSession, recordReceipt } = require('./cashier-sessions');
const { recordDeliveryEvent, completionMetrics, mergeDriverPerformance } = require('./delivery-metrics');
const { formatOrderReceipt } = require('./receipt.util');
const { isDelivery, isDeliverySettled, assertAssignedDelivery, canReceiveOrder, canConfirmManualPix } = require('./delivery-policy');
const { requireManualProof } = require('./payment-proof');
const { createHash, randomUUID } = require('node:crypto');
const { remainingStock, validateStockQuantity } = require('./order-integrity');
const { normalizePaymentParts, partAmount } = require('./payment-parts');
const { prepareStockReservation, applyStockReservation } = require('./stock-reservation');
const { setInterval, clearInterval } = require('node:timers');
const { runTransaction } = require('../database/transactions');
const { createCommercialOrder, COMMERCIAL_SOURCES } = require('./commercial-order');
const { payableTotal, assertProcurementReady } = require('./procurement-payment');

/** PDV writes never fall back to process memory when Firestore fails. */
class PdvRepository {
  constructor(repository) {
    this.repository = repository;
    this.memory = repository.pdvMemory ||= new Map();
    this.queue = Promise.resolve();
    this.scanCursors = new Map();
  }

  async transaction(work) {
    return runTransaction(this.repository, work);
  }

  async read(collection, id) {
    const repo = this.repository;
    if (repo.firestore && !repo._firestoreClientDisabled) {
      const doc = await repo.firestore.collection(collection).doc(id).get();
      return doc.exists ? { ...doc.data(), id: doc.id } : null;
    }
    return this.transaction((tx) => tx.get(collection, id));
  }

  async recordWhatsAppStatus(callback) {
    return require('../database/repositories/whatsapp-delivery').recordWhatsAppStatus(this.repository, callback);
  }

  // Cursor rotation prevents delayed/leased jobs at the beginning from starving later jobs.
  // Equality + document ID ordering uses the existing automatic single-field index.
  async scanPage(collection, field, value, limit = 100) {
    const size = Math.max(1, Math.min(500, Math.floor(Number(limit) || 100)));
    const key = JSON.stringify([collection, field, value]);
    const cursor = this.scanCursors.get(key);
    const repo = this.repository;
    let rows;
    if (repo.firestore && !repo._firestoreClientDisabled) {
      try {
        let query = repo.firestore.collection(collection).where(field, Array.isArray(value) ? 'in' : '==', value).orderBy('__name__').limit(size);
        if (cursor) query = query.startAfter(cursor);
        rows = (await query.get()).docs.map(doc => ({ ...doc.data(), id: doc.id }));
      } catch (err) {
        if (err.code === 7 || String(err.message || '').includes('PERMISSION_DENIED')) {
          repo._firestoreClientDisabled = true;
        }
        throw err;
      }
    } else {
      const matched = Array.isArray(value) ? (await Promise.all(value.map(item => this.list(collection, field, item)))).flat() : await this.list(collection, field, value);
      rows = matched.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        .filter(row => !cursor || row.id > cursor).slice(0, size);
    }
    if (rows.length === size) this.scanCursors.set(key, rows[rows.length - 1].id);
    else this.scanCursors.delete(key);
    return rows;
  }

  isAvailable() {
    const repo = this.repository;
    return Boolean((repo.firestore && !repo._firestoreClientDisabled) || (repo.isInMemory && !repo.firestore));
  }

  async expiredPixOrders() {
    const repo = this.repository;
    const now = new Date().toISOString();
    const statuses = ['AWAITING_PAYMENT', 'CREATING_PIX', 'AWAITING_PIX', 'PENDING'];
    if (repo.firestore && !repo._firestoreClientDisabled) {
      try {
        const orders = await this.scanPage('orders', 'status', statuses, 500);
        return orders
          .filter(order => Date.parse(order.pixExpiresAt || order.paymentExpiresAt || '') <= Date.parse(now))
          .slice(0, 100);
      } catch (err) {
        if (err.code === 7 || String(err.message || '').includes('PERMISSION_DENIED')) {
          repo._firestoreClientDisabled = true;
        }
        throw err;
      }
    }
    if (!repo.isInMemory || repo.firestore) throw new Error('Firestore indisponível.');
    return [...repo.inMemoryOrders.values()].filter(order => statuses.includes(order.status) && Date.parse(order.pixExpiresAt || order.paymentExpiresAt || '') <= Date.parse(now)).slice(0, 100);
  }

  async list(collection, field, value) {
    const repo = this.repository;
    if (repo.firestore && !repo._firestoreClientDisabled) {
      try {
        let query = repo.firestore.collection(collection);
        if (field) query = query.where(field, '==', value);
        const result = await query.get();
        return result.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
      } catch (err) {
        if (err.code === 7 || String(err.message || '').includes('PERMISSION_DENIED')) {
          repo._firestoreClientDisabled = true;
        }
        throw err;
      }
    }
    if (!repo.isInMemory || repo.firestore) { throw new Error('Firestore indisponível.'); }
    const map = collection === 'orders' ? repo.inMemoryOrders : this.memory.get(collection);
    const rows = [...(map?.values() || [])];
    if (!field) return rows;
    return rows.filter((row) => field.split('.').reduce((current, key) => current?.[key], row) === value);
  }

  watchOpenOrders(onChange, onError = () => {}) {
    if (!this.openOrdersFeed) {
      const feed = { subscribers: new Set(), last: null, stop: null };
      this.openOrdersFeed = feed;
      feed.start = () => this._watchOpenOrders(rows => {
        feed.last = rows;
        for (const subscriber of feed.subscribers) {
          try { subscriber.change(structuredClone(rows)); } catch { /* One disconnected SSE cannot stop the other clients. */ }
        }
      }, error => {
        for (const subscriber of feed.subscribers) {
          try { subscriber.error(error); } catch { /* Per-client error isolation. */ }
        }
      });
    }
    const feed = this.openOrdersFeed;
    const subscriber = { change: onChange, error: onError };
    feed.subscribers.add(subscriber);
    if (!feed.stop) feed.stop = feed.start();
    else if (feed.last) onChange(structuredClone(feed.last));
    let closed = false;
    return () => {
      if (closed) return;
      closed = true;
      feed.subscribers.delete(subscriber);
      if (!feed.subscribers.size) {
        feed.stop?.();
        if (this.openOrdersFeed === feed) this.openOrdersFeed = null;
      }
    };
  }

  _watchOpenOrders(onChange, onError = () => {}) {
    const repo = this.repository;
    if (repo.firestore && !repo._firestoreClientDisabled) {
      const snapshots = new Map();
      const queries = [
        repo.firestore.collection('orders').where('status', 'in', ['AWAITING_CONFIRMATION', 'AWAITING_CASHIER', 'AWAITING_PAYMENT', 'CREATING_PIX', 'AWAITING_PIX', 'PENDING', 'AWAITING_QUOTE', 'AWAITING_QUOTE_ACCEPTANCE', 'AWAITING_ARRIVAL', 'AWAITING_FULFILLMENT', 'AWAITING_RECONCILIATION']).limit(1000),
        repo.firestore.collection('orders').where('completedAt', '>=', new Date(Date.now() - 7 * 86400000).toISOString()).orderBy('completedAt', 'desc').limit(200),
      ];
      const stops = queries.map((query, index) => query.onSnapshot(snapshot => {
        snapshots.set(index, snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
        if (snapshots.size === queries.length) onChange([...new Map([...snapshots.values()].flat().map(order => [order.id, order])).values()]);
      }, onError));
      return () => stops.forEach(stop => stop());
    }
    if (!repo.isInMemory || repo.firestore) {
      onError(new Error('Firestore indisponível para acompanhar comandas em tempo real.'));
      return () => {};
    }
    let active = true;
    const notify = () => {
      if (!active) return;
      const orders = [...repo.inMemoryOrders.values()].filter((order) =>
        ['AWAITING_CONFIRMATION', 'AWAITING_CASHIER', 'AWAITING_PAYMENT', 'CREATING_PIX', 'AWAITING_PIX', 'PENDING', 'AWAITING_QUOTE', 'AWAITING_QUOTE_ACCEPTANCE', 'AWAITING_ARRIVAL', 'AWAITING_FULFILLMENT', 'AWAITING_RECONCILIATION', 'CONFIRMED', 'PAID_CONFIRMED', 'DELIVERED'].includes(order.status),
      );
      onChange(orders);
    };
    const timer = setInterval(notify, 2500);
    timer.unref?.();
    notify();
    return () => { active = false; clearInterval(timer); };
  }

  async create(order) {
    return createCommercialOrder(this.repository, order, {
      reserveInventory: order.status === 'AWAITING_PAYMENT' || (String(order.paymentMethod || '').toUpperCase() === 'PIX' && Boolean(order.pixData)),
      receipt: order.status !== 'CREATING_PIX',
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

  async listDeliveryOrders(_actor) {
    const database = this.repository.firestore;
    if (database && !this.repository._firestoreClientDisabled) {
      const collection = database.collection('orders');
      const open = collection.where('deliveryStatus', 'in', ['PENDING_DISPATCH', 'PENDING_DELIVERY', 'PREPARING_DELIVERY', 'OUT_FOR_DELIVERY']);
      const completed = collection.where('deliveryStatus', '==', 'DELIVERED').orderBy('deliveredAt', 'desc').limit(100);
      const [openSnap, completedSnap] = await Promise.all([open.get(), completed.get()]);
      const openDocs = openSnap.docs.map((document) => ({ ...document.data(), id: document.id }));
      const completedDocs = completedSnap.docs
        .map((document) => ({ ...document.data(), id: document.id }))
        .sort((a, b) => String(b.deliveredAt || '').localeCompare(String(a.deliveredAt || '')))
        .slice(0, 100);
      return [...openDocs, ...completedDocs];
    }
    return this.list('orders', 'orderType', 'DELIVERY');
  }

  async dispatchDelivery(orderId, actor) {
    if (!['ADMIN', 'CAIXA'].includes(actor?.role)) throw new Error('Somente Caixa/Admin podem liberar pedidos para entrega.');
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      if (!isDelivery(order) || order.status === 'CANCELLED') throw new Error('Pedido de entrega não encontrado.');
      assertProcurementReady(order);
      if (['PREPARING_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(order.deliveryStatus)) throw new Error('Este pedido já saiu para entrega.');
      if (order.paymentMethod === 'PIX' && !isDeliverySettled(order)) throw new Error('Confirme o Pix antes de liberar a entrega.');
      const reservation = !order.inventoryReserved && !order.stockDeducted ? await prepareStockReservation(tx, order.items) : null;
      const now = new Date().toISOString();
      if (reservation) applyStockReservation(tx, reservation, now);
      const updated = { ...order, deliveryStatus: 'PENDING_DELIVERY', dispatchedBy: actor, dispatchedAt: order.dispatchedAt || now, updatedAt: now,
        ...(reservation ? { inventoryReserved: !reservation.trackingDisabled, reservedItems: reservation.reservedItems } : {}) };
      tx.set('orders', orderId, updated); return updated;
    });
  }

  async assignDelivery(orderId, actor) {
    if (!['ADMIN', 'CAIXA', 'ENTREGADOR'].includes(actor?.role)) throw new Error('Sem permissão para assumir entregas.');
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      if (!isDelivery(order) || order.status === 'CANCELLED') throw new Error('Pedido de entrega não encontrado.');
      assertProcurementReady(order);
      if (['PREPARING_DELIVERY', 'OUT_FOR_DELIVERY'].includes(order.deliveryStatus) && order.assignedDriver?.id === actor.id) return order;
      if ((!['PENDING_DELIVERY', 'PENDING_DISPATCH'].includes(order.deliveryStatus)) || order.creditApprovalStatus === 'PENDING' || order.assignedDriver?.id) throw new Error('Esta entrega não está disponível. Outro entregador pode ter aceitado.');
      if (order.paymentMethod === 'PIX' && !isDeliverySettled(order)) throw new Error('O pagamento Pix ainda não foi confirmado.');
      if ((order.paymentParts || [{ method: order.paymentMethod }]).some(part => part.method === 'FIADO') && !isDeliverySettled(order)) throw new Error('O fiado aguarda aprovação de um administrador.');
      const now = new Date().toISOString();
      const reservation = !order.inventoryReserved && !order.stockDeducted ? await prepareStockReservation(tx, order.items) : null;
      if (reservation) applyStockReservation(tx, reservation, now);
      const updated = { ...order, ...(reservation ? { inventoryReserved: !reservation.trackingDisabled, reservedItems: reservation.reservedItems } : {}), deliveryStatus: 'PREPARING_DELIVERY', assignedDriver: actor, acceptedAt: now, departedAt: null, deliveryRoute: null, deliveryMetrics: null, updatedAt: now, deliveryHistory: recordDeliveryEvent(tx, order, 'PREPARING_DELIVERY', actor, now) };
      tx.set('orders', orderId, updated);
      return updated;
    });
  }

  async startDelivery(orderId, actor, route) {
    if (!['ADMIN', 'CAIXA', 'ENTREGADOR'].includes(actor?.role)) throw new Error('Sem permissão para iniciar entregas.');
    return this.transaction(async tx => {
      const order = await tx.get('orders', orderId);
      if (!isDelivery(order) || order.status === 'CANCELLED' || (actor.role !== 'ADMIN' && order.assignedDriver?.id !== actor.id)) throw new Error('Apenas o responsável pode iniciar esta entrega.');
      if (order.deliveryStatus === 'OUT_FOR_DELIVERY') return order;
      if (order.deliveryStatus !== 'PREPARING_DELIVERY') throw new Error('Assuma e separe os produtos antes de sair para entrega.');
      if (order.creditApprovalStatus === 'PENDING' || (order.paymentMethod === 'PIX' && !isDeliverySettled(order))) throw new Error('Aguarde a aprovação do pagamento antes de sair.');
      const now = new Date().toISOString();
      const distanceMeters = Number(route?.distanceMeters);
      const durationSeconds = Number(route?.durationSeconds);
      const deliveryRoute = route ? { distanceMeters, durationSeconds, source: 'GOOGLE_ROUTE_ESTIMATE', calculatedAt: now } : null;
      if (route && (!Number.isFinite(distanceMeters) || distanceMeters <= 0 || distanceMeters > 10000000 || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 604800)) throw new Error('Distância ou duração da rota inválida.');
      const updated = { ...order, deliveryStatus: 'OUT_FOR_DELIVERY', departedAt: now, departedBy: actor, deliveryRoute, updatedAt: now,
        deliveryHistory: recordDeliveryEvent(tx, order, 'OUT_FOR_DELIVERY', actor, now, { deliveryRoute }) };
      tx.set('orders', orderId, updated);
      const id = `${orderId}-departure-${order.acceptedAt.replace(/[^0-9]/g, '')}`;
      tx.set('pdv_outbox', id, { id, kind: 'delivery-departure', orderId, status: 'PENDING', attempts: 0 });
      return updated;
    });
  }

  async releaseDelivery(orderId, actor) {
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      if (!isDelivery(order) || order.status === 'CANCELLED' || !['PREPARING_DELIVERY', 'OUT_FOR_DELIVERY'].includes(order.deliveryStatus) || (actor?.role !== 'ADMIN' && order.assignedDriver?.id !== actor?.id)) throw new Error('Apenas o responsável pode devolver esta entrega.');
      const now = new Date().toISOString();
      const updated = { ...order, deliveryStatus: 'PENDING_DELIVERY', assignedDriver: null, acceptedAt: null, departedAt: null, deliveryRoute: null, deliveryMetrics: null, updatedAt: now, deliveryHistory: recordDeliveryEvent(tx, order, 'PENDING_DELIVERY', actor, now, { previousDriver: order.assignedDriver || null, previousDeparture: order.departedAt || '' }) };
      tx.set('orders', orderId, updated); return updated;
    });
  }

  async markDelivered(orderId, actor, notes = '', actualDistanceKm) {
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      if (order?.deliveryStatus === 'DELIVERED' && (actor.role === 'ADMIN' || order.deliveredBy?.id === actor.id)) return order;
      assertAssignedDelivery(order, actor);
      if (!isDeliverySettled(order)) throw new Error('Receba o pagamento antes de concluir a entrega.');
      const now = new Date().toISOString();
      const deliveryMetrics = completionMetrics(order, now, actualDistanceKm);
      const driver = order.assignedDriver || actor;
      const previousStats = await tx.get('delivery_driver_metrics', driver.id);
      const updated = { ...order, deliveryStatus: 'DELIVERED', deliveredAt: now, deliveredBy: actor, deliveryNotes: String(notes).slice(0, 500), deliveryMetrics, deliveryHistory: recordDeliveryEvent(tx, order, 'DELIVERED', actor, now), updatedAt: now };
      tx.set('delivery_driver_metrics', driver.id, mergeDriverPerformance(previousStats, updated, now));
      updated.receiptText = formatOrderReceipt(updated);
      tx.set('orders', orderId, updated); return updated;
    });
  }

  async advanceToPayment(orderId, receiver) {
    if (!['ADMIN', 'CAIXA'].includes(receiver?.role)) throw new Error('Somente Caixa/Admin podem confirmar comandas.');
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      if (!order || !COMMERCIAL_SOURCES.has(order.source)) throw new Error('Comanda não encontrada.');
      if (order.status === 'AWAITING_PAYMENT' && !order.completedAt) return order;
      if (order.completedAt || !['AWAITING_CONFIRMATION', 'AWAITING_CASHIER', 'PENDING'].includes(order.status) || order.pixData?.txid) {
        throw new Error('Só é possível mover de esperando confirmação para esperando pagamento.');
      }
      if (order.creditApprovalStatus === 'PENDING') throw new Error('Somente um Admin pode aprovar o fiado no recebimento.');
      const reservation = order.inventoryReserved ? null : await prepareStockReservation(tx, order.items);
      const now = new Date().toISOString();
      const ttl = Math.min(86400, Math.max(300, Number(process.env.PIX_PAYMENT_TTL_SECONDS) || 3600));
      if (reservation) applyStockReservation(tx, reservation, now);
      const updated = { ...order, status: 'AWAITING_PAYMENT', paymentStatus: 'PENDING', confirmedBy: receiver,
        confirmedAt: now, updatedAt: now, paymentExpiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        inventoryReserved: reservation ? !reservation.trackingDisabled : Boolean(order.inventoryReserved), reservedItems: reservation?.reservedItems || order.reservedItems };
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
      if (!order || !COMMERCIAL_SOURCES.has(order.source)) { throw new Error('Comanda não encontrada.'); }
      assertProcurementReady(order);
      if (order.completedAt || order.status === 'CANCELLED') { throw new Error('Esta comanda já foi finalizada ou cancelada.'); }
      if (!canReceiveOrder(order, receiver)) { throw new Error('Sem permissão para gerar Pix deste pedido.'); }
      if (Date.parse(order.pixExpiresAt || order.paymentExpiresAt || '') <= Date.now()) throw new Error('O prazo de pagamento venceu. Inicie uma nova comanda.');
      if (order.paymentMethod === 'PIX' && order.pixData) { return order; }
      if (!['AWAITING_CONFIRMATION', 'AWAITING_CASHIER', 'AWAITING_PAYMENT', 'PENDING'].includes(order.status)) { throw new Error('A comanda não está aguardando recebimento no caixa.'); }
      const paymentParts = normalizePaymentParts(requestedParts, 'PIX', payableTotal(order));
      const approvingCredit = paymentParts.some(part => part.method === 'FIADO');
      if (approvingCredit && receiver.role !== 'ADMIN' && order.creditApprovedBy?.role !== 'ADMIN') throw new Error('Fiado exige aprovação de um Admin antes de gerar o Pix.');
      if (!paymentParts.some((part) => part.method === 'PIX') || paymentParts.some((part) => part.method === 'SALDO_CLIENTE')) throw new Error('Combine Pix com dinheiro, débito, crédito ou fiado.');
      if (paymentParts.some((part) => part.method === 'FIADO') && !order.customerId) throw new Error('Fiado exige cliente cadastrado.');
      const reservation = order.inventoryReserved ? null : await prepareStockReservation(tx, order.items);
      const now = new Date().toISOString();
      const pixTtlSeconds = Math.min(86400, Math.max(300, Number(process.env.PIX_PAYMENT_TTL_SECONDS) || 3600));
      const pixData = { txid: createHash('sha256').update(order.id).digest('hex').slice(0, 32).toUpperCase(), provider: 'SICREDI', expiresInSeconds: pixTtlSeconds };
      const cashier = await activeSession(tx, receiver);
      if (cashier) tx.set('cashier_sessions', cashier.id, { ...cashier, pendingOrders: [...new Set([...cashier.pendingOrders, order.id])] });
      if (reservation) applyStockReservation(tx, reservation, now);
      const updated = { ...order, ...(cashier ? { cashierSessionId: cashier.id } : {}), ...(!approvingCredit && order.creditApprovalStatus === 'PENDING' ? { creditApprovalStatus: 'NOT_REQUIRED' } : {}), ...(approvingCredit && receiver.role === 'ADMIN' ? { creditApprovalStatus: 'APPROVED', creditApprovedBy: receiver, creditApprovedAt: now } : {}), paymentMethod: 'PIX', paymentStatus: 'PENDING', status: 'CREATING_PIX', pixData, pixCopiaECola: '',
        paymentParts: paymentParts.map((part) => ({ ...part, ...(['DINHEIRO', 'DEBITO', 'CREDITO'].includes(part.method) ? { status: 'RECEIVED_AT_CASHIER', receivedBy: receiver } : {}) })), mixedReceivedBy: receiver, deferToCashier: false,
        inventoryReserved: reservation ? !reservation.trackingDisabled : Boolean(order.inventoryReserved), reservedItems: reservation?.reservedItems || order.reservedItems,
        pixTtlSeconds, pixExpiresAt: new Date(Date.now() + pixTtlSeconds * 1000).toISOString(), updatedAt: now };
      tx.set('orders', order.id, updated);
      return updated;
    });
  }

  /** Stock, debt, attribution, payment and notification intent commit together. */
  async receive(orderId, receiver, verification = null, cashReceived = null, paymentMethodOverride = null, { sendFinalReceipt = false, requestedParts, finishDelivery = false, actualDistanceKm } = {}) {
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', orderId);
      if (!order || !COMMERCIAL_SOURCES.has(order.source)) { throw new Error('Comanda não encontrada.'); }
      if (order.status === 'CANCELLED') { throw new Error('Comanda cancelada.'); }
      if (finishDelivery && order.deliveryStatus === 'DELIVERED' && order.deliveredBy?.id === receiver?.id) return { ...order, alreadyConfirmed: true };
      if (finishDelivery) assertAssignedDelivery(order, receiver);
      if (receiver?.role === 'ENTREGADOR' && !canReceiveOrder(order, receiver)) throw new Error('Sem permissão para receber esta entrega.');
      if (order.completedAt) { return { ...order, alreadyConfirmed: true }; }
      assertProcurementReady(order);
      const inventory = { stockControlEnabled: (await tx.get('store_settings', 'inventory'))?.stockControlEnabled ?? process.env.STORE_STOCK_CONTROL_ENABLED !== 'false' };
      if (order.pixMode === 'MANUAL' && order.paymentProofId && verification?.manualPixProofId !== order.paymentProofId) throw new Error('O comprovante mudou. Atualize a comanda.');
      if (verification?.manualPixProofId && verification.manualPixProofId === order.procurement?.deposit?.proof?.id) throw new Error('Anexe o comprovante do saldo. O comprovante do sinal não pode quitar o restante.');
      if (Date.parse(order.pixExpiresAt || order.paymentExpiresAt || '') <= Date.now() && !(order.procurement && verification?.verifiedVia === 'MANUAL_CAIXA_PIX')) {
        throw new Error('O prazo de pagamento venceu. Aguarde o cancelamento e a liberação do estoque.');
      }
      const paymentParts = normalizePaymentParts(requestedParts || (paymentMethodOverride ? undefined : order.paymentParts?.length ? order.paymentParts : undefined), paymentMethodOverride || order.paymentMethod, payableTotal(order));
      if (order.pixData?.txid && requestedParts) {
        const issuedParts = normalizePaymentParts(order.paymentParts, order.paymentMethod, payableTotal(order));
        const allocation = (parts) => JSON.stringify(parts.map(({ method, amount }) => ({ method, amount })).sort((a, b) => a.method.localeCompare(b.method)));
        if (allocation(paymentParts) !== allocation(issuedParts)) throw new Error('As parcelas da cobrança Pix emitida não podem ser alteradas.');
      }
      const amountFor = (method) => paymentParts.find((part) => part.method === method)?.amount || 0;
      if (amountFor('FIADO') && receiver?.role !== 'ADMIN' && order.creditApprovedBy?.role !== 'ADMIN') throw new Error('Fiado exige aprovação de um administrador antes de registrar a dívida.');
      const paymentMethod = amountFor('PIX') ? 'PIX' : paymentParts.length > 1 ? 'MISTO' : paymentParts[0].method;
      if (paymentMethodOverride && !['AWAITING_CONFIRMATION', 'AWAITING_CASHIER', 'AWAITING_PAYMENT', 'PENDING'].includes(order.status)) { throw new Error('A forma de pagamento só pode ser escolhida antes do recebimento.'); }
      if (paymentMethodOverride && paymentMethod === 'PIX' && verification?.verifiedVia !== 'MANUAL_CAIXA_PIX') { throw new Error('Pix exige cobrança Sicredi ou comprovante conferido pelo caixa.'); }
      if (order.paymentMethod === 'PIX' && order.pixData && paymentMethod !== 'PIX') { throw new Error('Uma cobrança Pix já emitida não pode ser convertida; aguarde a confirmação do Sicredi.'); }
      if (paymentMethod === 'PIX' && (!verification || verification.txid !== order.pixData?.txid || verification.amountMinor !== Math.round(amountFor('PIX') * 100))) {
        throw new Error('Pix exige confirmação do Sicredi com identificador e valor exatos.');
      }
      if (paymentMethod === 'PIX' && verification.verifiedVia === 'MANUAL_CAIXA_PIX' &&
        (!verification.manualPixProofSeen || String(verification.manualPixNote || '').trim().length < 8 || !canConfirmManualPix(order, receiver))) {
        throw new Error('Confirmação manual do Pix exige comprovante conferido e justificativa pelo menos 8 caracteres.');
      }
      if (paymentMethod !== 'PIX' && !canReceiveOrder(order, receiver)) { throw new Error('Somente o caixa pode receber esta comanda.'); }
      const tendered = cashReceived ?? order.cashTendered ?? amountFor('DINHEIRO');
      if (amountFor('DINHEIRO') && (!Number.isFinite(tendered) || Math.round(tendered * 100) < Math.round(amountFor('DINHEIRO') * 100))) { throw new Error('Valor recebido em dinheiro menor que a parcela em dinheiro.'); }
      if (receiver?.role === 'ENTREGADOR' && paymentParts.some((part) => ['FIADO', 'SALDO_CLIENTE'].includes(part.method))) throw new Error('Fiado e saldo do cliente precisam ser autorizados no caixa.');
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
      const manualPixProof = verification?.verifiedVia === 'MANUAL_CAIXA_PIX' ? await requireManualProof(tx, verification, receiver, 'ORDER', order.id) : null;
      const deliveryMetrics = finishDelivery ? completionMetrics(order, now, actualDistanceKm) : null;
      const deliveryDriver = finishDelivery ? order.assignedDriver || receiver : null;
      const previousDeliveryStats = finishDelivery ? await tx.get('delivery_driver_metrics', deliveryDriver.id) : null;
      const procurementRequest = order.procurement ? await tx.get('agent_handoffs', order.procurementRequestId) : null;
      const collectingActor = paymentMethod === 'PIX' && verification?.verifiedVia !== 'MANUAL_CAIXA_PIX'
        ? (order.mixedReceivedBy || order.createdBy || { id: 'SICREDI', name: 'Sicredi · confirmação automática', role: 'SYSTEM' }) : receiver;
      const receivedBy = collectingActor.role === 'ENTREGADOR' ? order.createdBy || { id: 'ONLINE', name: 'Catálogo online', role: 'SYSTEM' } : collectingActor;
      const cashier = await activeSession(tx, collectingActor, order.cashierSessionId);
      // No transaction reads after this point.
      recordReceipt(tx, cashier, paymentParts);
      for (const { id, quantity, product, stock, ownReservation } of products) {
        tx.set('products', id, { ...product, stockQuantity: stock, estoque: stock,
          ...(ownReservation ? { reservedQuantity: Math.max(0, Number(product.reservedQuantity || 0) - ownReservation) } : {}), updatedAt: now });
        tx.set('stock_movements', `${order.id}-${id}`, { productId: id, productName: product.name, orderId, quantityDeducted: quantity, previousStock: stock + quantity, newStock: stock, type: 'SALE_PDV', createdAt: now });
      }
      const completed = { ...order, ...(cashier ? { cashierSessionId: cashier.id } : {}),
        ...(collectingActor.role === 'ENTREGADOR' ? { collectedBy: collectingActor } : {}),
        ...(order.creditApprovalStatus === 'PENDING' && !onAccount ? { creditApprovalStatus: 'NOT_REQUIRED' } : {}),
        ...(onAccount && receiver?.role === 'ADMIN' ? { creditApprovalStatus: 'APPROVED', creditApprovedBy: receiver, creditApprovedAt: now } : {}),
        ...(isDelivery(order) && (!order.deliveryStatus || order.deliveryStatus === 'PENDING_DISPATCH') ? { deliveryStatus: 'PENDING_DELIVERY' } : {}),
        ...(finishDelivery ? { deliveryStatus: 'DELIVERED', deliveredBy: receiver, deliveredAt: now, deliveryMetrics, deliveryHistory: recordDeliveryEvent(tx, order, 'DELIVERED', receiver, now) } : {}), paymentMethod, paymentParts: paymentParts.map((part) => ({ ...part, receivedBy, receivedAt: part.receivedAt || (part.status === 'RECEIVED_AT_CASHIER' ? order.createdAt : now), status: part.method === 'FIADO' ? 'ON_ACCOUNT' : 'APPROVED' })), receivedBy, cashierName: receivedBy.name, cashierEmail: receivedBy.email || '', status: 'CONFIRMED',
        paymentStatus: onAccount ? 'ON_ACCOUNT' : 'APPROVED', paidAt: onAccount ? null : now,
        completedAt: now, ...(order.pixMode === 'MANUAL' ? { paymentReviewStatus: 'APPROVED' } : {}), stockDeducted: true, stockDeductedAt: order.stockDeductedAt || now,
        ...(order.procurement ? { amountDue: 0, procurement: { ...order.procurement, stage: 'COMPLETED', completedAt: now } } : {}),
        inventoryReserved: false, reservationReleasedAt: order.inventoryReserved ? now : order.reservationReleasedAt || '',
        verifiedVia: verification ? (verification.verifiedVia || 'SICREDI_PIX_WEBHOOK') : 'CAIXA', updatedAt: now,
        ...(amountFor('DINHEIRO') ? { cashReceived: tendered, changeGiven: (Math.round(tendered * 100) - Math.round(amountFor('DINHEIRO') * 100)) / 100 } : {}),
        ...(verification ? { paymentTransactionId: verification.endToEndId || `MANUAL-${order.id}`, paymentVerifiedAmount: verification.amountMinor / 100, pixVerified: true } : {}),
        ...(verification?.verifiedVia === 'MANUAL_CAIXA_PIX' ? { manualPixProof, manualPixProofId: manualPixProof.id, manualPixProofSeen: true, manualPixNote: String(verification.manualPixNote).trim().slice(0, 500), manualPixConfirmedBy: receiver,
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
      if (finishDelivery) {
        completed.receiptText = formatOrderReceipt(completed);
        tx.set('delivery_driver_metrics', deliveryDriver.id, mergeDriverPerformance(previousDeliveryStats, completed, now));
      }
      tx.set('orders', order.id, completed);
      if (procurementRequest) tx.set('agent_handoffs', procurementRequest.id, { ...procurementRequest, status: 'closed', requestStatus: 'COMPLETED', version: procurementRequest.version + 1, updatedAt: now });
      if (!onAccount && completed.source === 'WEB_CATALOG' && /^[a-f0-9-]{36}$/.test(completed.analyticsClientId || '') && require('../integrations/ga4-purchase.client').ga4PurchaseEnabled()) {
        const id = `${order.id}-ga4-purchase`;
        tx.set('pdv_outbox', id, { id, kind: 'ga4-purchase', orderId, status: 'PENDING', attempts: 0, createdAt: now });
      }
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
      const manualPixProof = parts.some((part) => part.method === 'PIX') ? await requireManualProof(tx, verification, receivedBy, 'DEBT', id) : null;
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
      const cashier = await activeSession(tx, receivedBy);
      const settlement = { id, ...(cashier ? { cashierSessionId: cashier.id } : {}), customerKey, customerName: customer.name, customerPhone: customer.phone || '', amount,
        paymentMethod: method, paymentParts: parts, notes, receivedBy, operatorName: receivedBy.name, newBalance, newCreditBalance, entryType, type: entryType, createdAt: now,
        ...(manualPixProof ? { manualPixProof, manualPixProofId: manualPixProof.id, verifiedVia: 'MANUAL_CAIXA_PIX', manualPixProofSeen: true, manualPixNote: verification.manualPixNote } : {}) };
      tx.set('customers', customerKey, { ...customer, debtBalance: newBalance, creditBalance: newCreditBalance, updatedAt: now });
      recordReceipt(tx, cashier, parts);
      tx.set('debt_settlements', id, settlement);
      tx.set('pdv_outbox', id, { id, settlementId: id, kind: 'debt-receipt', status: 'PENDING', attempts: 0 });
      return settlement;
    });
  }

  async claimMessage(id) {
    return this.transaction(async (tx) => {
      const job = await tx.get('pdv_outbox', id);
      if (!job || job.status !== 'PENDING' || job.nextAttemptAt > Date.now() || job.leaseUntil > Date.now()) { return null; }
      const maxAttempts = Math.max(1, Number(process.env.PDV_OUTBOX_MAX_ATTEMPTS) || 12);
      if (Number(job.attempts || 0) >= maxAttempts) {
        tx.set('pdv_outbox', id, { ...job, status: 'NEEDS_RECONCILIATION', lastError: 'MAX_ATTEMPTS', leaseUntil: 0 });
        return null;
      }
      const claimed = { ...job, leaseOwner: randomUUID(), leaseUntil: Date.now() + 120000, attempts: Number(job.attempts || 0) + 1 };
      tx.set('pdv_outbox', id, claimed);
      return claimed;
    });
  }

  async updateMessage(id, updates, owner = null) {
    return this.transaction(async (tx) => {
      const job = await tx.get('pdv_outbox', id);
      if (!job) throw new Error('Mensagem não encontrada.');
      if (owner && job.leaseOwner !== owner) throw new Error('A posse do envio mudou.');
      if (owner && updates.status === 'SENDING' && !(job.leaseUntil > Date.now())) throw new Error('A posse do envio expirou.');
      const updated = { ...job, ...updates };
      if (['SENT', 'SKIPPED'].includes(updated.status) && !updated.completedAt) updated.completedAt = new Date().toISOString();
      if (Object.keys(updated).every(key => Object.is(updated[key], job[key]))) return;
      tx.set('pdv_outbox', id, updated);
    });
  }

  async submitFeedback(orderId, input = {}, submitter = {}) {
    const cleanId = String(orderId || '').trim();
    if (!cleanId) throw new Error('Identificador do pedido inválido.');
    const serviceRating = Number(input.serviceRating ?? input.rating);
    const deliveryRating = Number(input.deliveryRating ?? serviceRating);
    if (!Number.isInteger(serviceRating) || serviceRating < 1 || serviceRating > 5) {
      throw new Error('Informe uma nota de 1 a 5 para o atendimento da Conflora.');
    }
    if (!Number.isInteger(deliveryRating) || deliveryRating < 1 || deliveryRating > 5) {
      throw new Error('Informe uma nota de 1 a 5 para a entrega.');
    }
    const highlights = Array.isArray(input.highlights)
      ? [...new Set(input.highlights.map(item => String(item || '').trim().slice(0, 60)).filter(Boolean))].slice(0, 6)
      : [];
    const comment = String(input.comment || '').trim().slice(0, 500);
    return this.transaction(async (tx) => {
      const order = await tx.get('orders', cleanId);
      if (!order) throw new Error('Pedido não encontrado.');
      if (order.status === 'CANCELLED') throw new Error('Pedidos cancelados não podem ser avaliados.');
      if (order.deliveryStatus !== 'DELIVERED' && order.status !== 'DELIVERED') {
        throw new Error('A avaliação só fica disponível após o pedido ser marcado como entregue.');
      }
      const now = new Date().toISOString();
      const overallRating = Number(((serviceRating + deliveryRating) / 2).toFixed(1));
      const feedback = {
        serviceRating,
        deliveryRating,
        overallRating,
        highlights,
        comment,
        submittedAt: now,
        submittedBy: {
          id: String(submitter.id || order.customerId || 'customer'),
          name: String(submitter.name || order.customerName || 'Cliente').slice(0, 120),
          role: String(submitter.role || 'CLIENTE').toUpperCase(),
        },
      };
      const updated = { ...order, feedback, updatedAt: now };
      tx.set('orders', cleanId, updated);
      tx.set('order_feedback', cleanId, {
        id: cleanId,
        orderId: cleanId,
        ticketNumber: order.ticketNumber || '',
        customerId: order.customerId || '',
        driverId: order.deliveredBy?.id || order.assignedDriver?.id || '',
        ...feedback,
      });
      return updated;
    });
  }
}

module.exports = { PdvRepository };
