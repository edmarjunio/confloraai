const { COMMERCIAL_SOURCES } = require('../orders/commercial-order');
const { financialReceiver, isDelivery, isDeliverySettled, assertAssignedDelivery, canConfirmManualPix } = require('../orders/delivery-policy');
const { PaymentProofStorage } = require('../orders/payment-proof');
const { timingSafeEqual, randomUUID } = require('node:crypto');
const { PdvRepository } = require('../orders/pdv.repository');
const { PdvService, actor, requestId, normalizePhone } = require('../orders/pdv.service');
const { formatOrderReceipt, money } = require('../orders/receipt.util');
const Logger = require('../shared/logger');
const { setInterval, clearInterval } = require('node:timers');
const { normalizePaymentParts, partAmount } = require('../orders/payment-parts');

function secureEqual(left, right) {
  const a = Buffer.from(left || ''); const b = Buffer.from(right || '');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
function requireStaff(req, res, next) {
  if (!req.user) { return res.status(401).json({ error: 'Entre na sua conta para acessar o PDV.' }); }
  if (!['ADMIN', 'CAIXA', 'VENDEDOR', 'ENTREGADOR'].includes(req.user.role)) { return res.status(403).json({ error: 'Perfil sem acesso ao PDV.' }); }
  next();
}
function requireCashier(req, res, next) {
  if (!['ADMIN', 'CAIXA'].includes(req.user?.role)) { return res.status(403).json({ error: 'Somente o caixa pode receber valores.' }); }
  next();
}

function manualPixVerification(order, parts, body) {
  if (body?.proofSeen !== true) throw new Error('Confirme que conferiu o comprovante Pix antes de finalizar.');
  const note = String(body?.note || '').trim();
  if (note.length < 8) throw new Error('Registre uma observação sobre o comprovante (mínimo 8 caracteres).');
  return { verifiedVia: 'MANUAL_CAIXA_PIX', txid: order.pixData?.txid,
    amountMinor: Math.round(parts.filter((part) => part.method === 'PIX').reduce((sum, part) => sum + part.amount, 0) * 100),
    manualPixProofId: String(body.proofId || ''), endToEndId: String(body.endToEndId || '').trim().slice(0, 80), manualPixProofSeen: true, manualPixNote: note };
}

function businessDate(value) {
  if (!value) { return ''; }
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function reportRange(query = {}) {
  const today = businessDate(new Date());
  const from = String(query.from || today);
  const to = String(query.to || today);
  const isDate = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { return false; }
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!isDate(from) || !isDate(to) || from > to) { throw new Error('Selecione um período válido para o relatório.'); }
  return { from, to };
}

function isWithinRange(value, range) {
  const date = businessDate(value);
  return Boolean(date && date >= range.from && date <= range.to);
}

function paymentTotals(orders, settlements) {
  const methods = ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'SALDO_CLIENTE'];
  const totals = Object.fromEntries(methods.map((method) => [method, { sales: 0, debt: 0, count: 0, debtCount: 0 }]));
  for (const order of orders) {
    for (const part of order.paymentParts || [{ method: order.paymentMethod, amount: order.total }]) {
      const row = totals[part.method];
      if (!row) continue;
      row.sales += Number(part.amount || 0);
      row.count += 1;
    }
  }
  for (const settlement of settlements) {
    for (const part of settlement.paymentParts || [{ method: settlement.paymentMethod, amount: settlement.amount }]) {
      const row = totals[part.method];
      if (!row) continue;
      row.debt += Number(part.amount || 0);
      row.debtCount += 1;
    }
  }
  for (const row of Object.values(totals)) { row.total = row.sales + row.debt; }
  return totals;
}

function installPdvRoutes(app, { repository, pix, whatsapp, ownerPhone, taskQueueClient, catalogAgent }) {
  const store = new PdvRepository(repository);
  const proofStorage = new PaymentProofStorage({ inMemory: repository.isInMemory && !repository.firestore });
  const service = new PdvService({ repository: store, pix, whatsapp, ownerPhone, taskQueueClient });
  service.catalogAgent = catalogAgent;
  const { CustomerDebtPixService } = require('../orders/customer-debt-pix.service');
  const debtPix = new CustomerDebtPixService({ store, pix, pdv: service });
  service.debtPix = debtPix;
  const route = (handler) => async (req, res) => {
    try { await handler(req, res); }
    catch (error) { Logger.warn('Operação PDV não concluída', { error: error.message, requestId: req.requestId }); res.status(error.status || (/Firestore|banco.*indisponível/i.test(error.message) ? 503 : 400)).json({ error: error.message, requestId: req.requestId }); }
  };
  const requireCustomer = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Entre na sua conta.' });
  app.get('/api/customer/orders/stream', requireCustomer, route(async (req, res) => {
    const profiles = req.user.email ? await repository.findCustomerProfilesByEmail(req.user.email) : [];
    if (profiles.length > 1) return res.status(409).json({ error: 'Peça à equipe para corrigir o vínculo da sua conta.' });
    if (res.destroyed) return;
    const ids = new Set([req.user.id, ...profiles.map(profile => profile.id)].map(String));
    const email = String(req.user.email || '').trim().toLowerCase();
    res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'private, no-store, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders?.();
    res.write('retry: 5000\n\n');
    let closed = false;
    let lastPayload = '';
    const heartbeat = setInterval(() => { if (!closed) res.write(': keep-alive\n\n'); }, 20000);
    heartbeat.unref?.();
    const unsubscribe = store.watchOpenOrders(orders => {
      if (closed) return;
      const visible = orders.filter(order => ids.has(String(order.customerId || '')) || (email && String(order.customerEmail || '').trim().toLowerCase() === email));
      const payload = JSON.stringify({ orders: visible.map(({ id, ticketNumber, status, deliveryStatus, paymentStatus, paidAt }) => ({ id, ticketNumber, status, deliveryStatus, paymentStatus, paidAt })).sort((a, b) => String(a.id).localeCompare(String(b.id))) });
      if (payload !== lastPayload) { res.write(`event: order-status\ndata: ${payload}\n\n`); lastPayload = payload; }
    }, () => { if (!closed) res.write('event: stream-fallback\ndata: {}\n\n'); });
    res.on('close', () => { closed = true; clearInterval(heartbeat); unsubscribe?.(); });
  }));
  app.post('/api/customer/debt-pix', requireCustomer, route(async (req, res) => res.json({ success: true, charge: await debtPix.create(req.body, req.user) })));
  app.get('/api/customer/debt-pix/:id', requireCustomer, route(async (req, res) => res.json({ success: true, charge: await debtPix.read(req.params.id, req.user) })));
  app.use('/api/caixa', requireStaff, (req, res, next) => {
    if (req.user.role !== 'ENTREGADOR') return next();
    if (/^\/deliveries(?:\/[^/]+\/(?:accept|start|release|complete|receive|notify-arriving|feedback))?$/.test(req.path) || req.path === '/orders/stream' || /^\/payment-proofs(?:\/[^/]+)?$/.test(req.path)) return next();
    res.status(403).json({ error: 'Seu perfil permite apenas suas entregas e os recebimentos vinculados a elas.' });
  });
  require('../orders/manual-pix.routes').installManualPixRoutes(app, { store, proofStorage, service });
  const requireDeliveryStaff = (req, res, next) => ['ADMIN', 'CAIXA', 'ENTREGADOR'].includes(req.user.role) ? next() : res.status(403).json({ error: 'Sem acesso às entregas.' });
  app.get('/api/caixa/deliveries', requireDeliveryStaff, route(async (req, res) => res.json(await service.listDeliveries(req.user))));
  app.post('/api/caixa/deliveries/:id/dispatch', requireCashier, route(async (req, res) => res.json({ order: await store.dispatchDelivery(req.params.id, actor(req.user)) })));
  app.post('/api/caixa/deliveries/:id/accept', requireDeliveryStaff, route(async (req, res) => res.json({ order: await service.assignDelivery(req.params.id, req.user) })));
  app.post('/api/caixa/deliveries/:id/start', requireDeliveryStaff, route(async (req, res) => res.json({ order: await service.startDelivery(req.params.id, req.user, req.body) })));
  app.post('/api/caixa/deliveries/:id/release', requireDeliveryStaff, route(async (req, res) => res.json({ order: await service.releaseDelivery(req.params.id, req.user) })));
  app.post('/api/caixa/deliveries/:id/complete', requireDeliveryStaff, route(async (req, res) => res.json(await service.completeDelivery(req.params.id, req.user, req.body))));
  app.post('/api/caixa/deliveries/:id/notify-arriving', requireDeliveryStaff, route(async (req, res) => res.json(await service.notifyArriving(req.params.id, req.user))));
  app.post('/api/caixa/deliveries/:id/feedback', requireDeliveryStaff, route(async (req, res) => {
    const order = await service.submitFeedback(req.params.id, req.body, req.user);
    res.json({ order, feedback: order.feedback });
  }));
  app.post('/api/caixa/deliveries/:id/receive', requireDeliveryStaff, route(async (req, res) => {
    const existing = await store.read('orders', req.params.id); assertAssignedDelivery(existing, req.user);
    const isManualPix = req.body.manualPix === true || req.body.paymentMethod === 'PIX_MANUAL';
    const method = req.body.paymentMethod === 'PIX_MANUAL' ? 'PIX' : req.body.paymentMethod;
    const parts = normalizePaymentParts(req.body.paymentParts, method || existing.paymentMethod, existing.total);
    if (parts.some((part) => ['FIADO', 'SALDO_CLIENTE'].includes(part.method))) throw new Error('Fiado e crédito devem ser autorizados no caixa antes da entrega.');
    if (parts.some((part) => part.method === 'PIX') && !isManualPix) return res.status(202).json({ order: await service.requestPixAtCashier(existing.id, req.user, parts) });
    const verification = parts.some((part) => part.method === 'PIX') ? manualPixVerification(existing, parts, req.body) : null;
    const order = await store.receive(existing.id, actor(req.user), verification, (req.body.receivedAmount === null || req.body.receivedAmount === undefined) ? null : Number(req.body.receivedAmount), existing.pixData?.txid ? null : method, { requestedParts: parts, finishDelivery: true, actualDistanceKm: req.body.actualDistanceKm, sendFinalReceipt: !verification });
    if (verification) { for (const id of await store.ensurePaymentNotifications(order.id)) await service.deliver(id); }
    else await service.deliver(`${order.id}-final-receipt`);
    res.json({ order });
  }));

  app.get('/api/caixa/favorites', route(async (req, res) => {
    const user = await store.read('users', String(req.user.id));
    res.json({ favoriteProductIds: Array.isArray(user?.favoriteProductIds) ? user.favoriteProductIds : [] });
  }));

  app.put('/api/caixa/favorites', route(async (req, res) => {
    const ids = Array.isArray(req.body?.favoriteProductIds) ? req.body.favoriteProductIds : [];
    if (ids.length > 2000) { throw new Error('Limite de favoritos excedido.'); }
    const favoriteProductIds = [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
    const userId = String(req.user.id);
    const saved = await store.transaction(async (tx) => {
      const user = await tx.get('users', userId);
      if (!user) { throw new Error('Usuário autenticado não encontrado.'); }
      const updated = { ...user, favoriteProductIds, updatedAt: new Date().toISOString() };
      tx.set('users', userId, updated);
      return updated.favoriteProductIds;
    });
    res.json({ success: true, favoriteProductIds: saved });
  }));

  app.post('/api/caixa/customers', route(async (req, res) => {
    const name = String(req.body.name || '').trim().slice(0, 100);
    if (!name) { throw new Error('Informe o nome do cliente.'); }
    const phone = normalizePhone(req.body.phone);
    const email = String(req.body.email || '').trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { throw new Error('Informe um e-mail válido para vincular a conta do cliente.'); }
    const selectedId = String(req.body.customerId || '');
    if (selectedId && (!/^[a-zA-Z0-9_-]{1,128}$/.test(selectedId) || !await store.read('customers', selectedId))) throw new Error('Cliente selecionado não encontrado.');
    const id = selectedId || phone || randomUUID();
    if (email) {
      const matches = await repository.findCustomerProfilesByEmail(email);
      if (matches.some((profile) => String(profile.id) !== id)) { throw new Error('Este e-mail já está vinculado a outro cadastro de cliente.'); }
    }
    const customer = await store.transaction(async (tx) => {
      const previous = await tx.get('customers', id);
      const identityId = email ? require('node:crypto').createHash('sha256').update(email).digest('hex') : null;
      const identity = identityId ? await tx.get('customer_emails', identityId) : null;
      if (identity && identity.customerId !== id) throw Object.assign(new Error('Este e-mail já está vinculado a outro cadastro de cliente.'), { status: 409 });
      const nameSearch = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const saved = { ...previous, id, name, nameSearch, phone, phoneDigits: phone, email, ...(req.body.deliveryLocation ? { deliveryLocation: require('../orders/pdv.service').normalizeDeliveryLocation(req.body.deliveryLocation) } : {}), cpfCnpj: String(req.body.cpfCnpj || '').slice(0, 30), address: String(req.body.address || '').slice(0, 250), notes: String(req.body.notes || '').slice(0, 250), updatedAt: new Date().toISOString() };
      tx.set('customers', id, saved);
      if (identityId) tx.set('customer_emails', identityId, { customerId: id });
      return saved;
    });
    res.status(201).json({ success: true, customer });
  }));

  app.post('/api/caixa/orders', route(async (req, res) => {
    const order = await service.create(req.body, req.user);
    if (order.approvalRequired) { return res.status(202).json({ success: true, ...order }); }
    res.json({ success: true, order, receiptDelivery: order.receiptDelivery });
  }));
  app.get('/api/caixa/orders/stream', (req, res) => {
    res.status(200);
    res.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders?.();
    res.write('retry: 3000\n\n');
    const send = (event, payload) => res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    let closed = false;
    const heartbeat = setInterval(() => { if (!closed) res.write(': keep-alive\n\n'); }, 20000);
    heartbeat.unref?.();
    const unsubscribe = store.watchOpenOrders((orders) => {
      if (closed) return;
      const visibleOrders = orders.filter((order) => COMMERCIAL_SOURCES.has(order.source) && (req.user.role !== 'ENTREGADOR' || isDelivery(order)) && (req.user.role !== 'VENDEDOR' || order.createdBy?.id === req.user.id));
      send('orders-changed', { orderIds: visibleOrders.map((order) => order.id), updatedAt: new Date().toISOString() });
    }, () => {
      if (!closed) send('stream-fallback', { updatedAt: new Date().toISOString() });
    });
    req.on('close', () => {
      closed = true;
      clearInterval(heartbeat);
      unsubscribe?.();
    });
  });
  app.get('/api/caixa/discount-approvals/:id', route(async (req, res) => {
    const approval = await store.read('discount_approvals', req.params.id);
    if (!approval || (req.user.role !== 'ADMIN' && approval.requestedBy !== req.user.id)) { return res.sendStatus(404); }
    res.json(approval);
  }));
  const cashierSnapshot = async (user, query = {}) => {
    const range = reportRange(query);
    const snapshot = await require('../database/repositories/cashier-snapshot').cashierSnapshotRecords(repository, range);
    const orders = snapshot.orders.filter(order => COMMERCIAL_SOURCES.has(order.source));
    const isAdmin = user.role === 'ADMIN';
    const canViewPersonalOrder = (order) => isAdmin || order.createdBy?.id === user.id || financialReceiver(order)?.id === user.id;
    const canViewOpenOrder = (order) => canViewPersonalOrder(order) || (user.role === 'CAIXA' && !order.completedAt && order.status !== 'CANCELLED');
    const openOrders = orders.filter((order) => !order.completedAt && order.status !== 'CANCELLED' &&
      canViewOpenOrder(order));
    const activeDeliveries = orders.filter(order => isDelivery(order) && order.status !== 'CANCELLED' &&
      order.deliveryStatus !== 'DELIVERED' && (canViewPersonalOrder(order) || user.role === 'CAIXA') &&
      order.creditApprovalStatus !== 'PENDING' &&
      (['PREPARING_DELIVERY', 'OUT_FOR_DELIVERY'].includes(order.deliveryStatus) ||
        (order.paymentMethod !== 'PIX' && !(order.paymentParts || []).some(part => ['PIX', 'FIADO'].includes(part.method))) || isDeliverySettled(order)));
    const awaitingDriver = activeDeliveries.filter(order => ['PENDING_DELIVERY', 'PENDING_DISPATCH', 'PREPARING_DELIVERY'].includes(order.deliveryStatus));
    const outForDelivery = activeDeliveries.filter(order => order.deliveryStatus === 'OUT_FOR_DELIVERY');
    const deliveryIds = new Set([...awaitingDriver, ...outForDelivery].map(order => order.id));
    const pendingConfirmation = openOrders.filter((order) => order.status === 'AWAITING_CONFIRMATION');
    const pendingPayment = openOrders.filter((order) => !deliveryIds.has(order.id) && ['AWAITING_CASHIER', 'AWAITING_PAYMENT', 'CREATING_PIX', 'AWAITING_PIX', 'PENDING'].includes(order.status));
    const history = orders.filter((order) => canViewPersonalOrder(order) && isWithinRange(order.paidAt || order.completedAt || order.createdAt, range));
    const completed = history.filter((order) => order.completedAt && order.status !== 'CANCELLED');
    const confirmed = completed.filter((order) => order.paymentStatus === 'ON_ACCOUNT');
    const paid = completed.filter((order) => order.paymentStatus === 'APPROVED' && (order.paidAt || order.completedAt));
    const allSettlements = snapshot.settlements;
    const debtHistory = allSettlements.filter((row) => ['QUITACAO_FIADO', 'CREDITO_CLIENTE'].includes(row.entryType || row.type || 'QUITACAO_FIADO') && (isAdmin || row.receivedBy?.id === user.id) && isWithinRange(row.createdAt, range));
    const mySales = completed.filter((order) => order.createdBy?.id === user.id);
    const myReceipts = completed.filter((order) => financialReceiver(order)?.id === user.id);
    const myDebtReceipts = debtHistory.filter((row) => row.receivedBy?.id === user.id);
    const receivedOrders = completed.filter((order) => order.paymentStatus === 'APPROVED' || order.paymentParts?.some((part) => ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO'].includes(part.method)));
    const closingOrders = isAdmin ? receivedOrders : receivedOrders.filter((order) => financialReceiver(order)?.id === user.id);
    const closingSettlements = isAdmin ? debtHistory : myDebtReceipts;
    const byPayment = paymentTotals(closingOrders, closingSettlements);
    const sum = (rows, field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
    const receivedTotal = (rows) => rows.reduce((sum, order) => sum + ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO'].reduce((amount, method) => amount + partAmount(order, method), 0), 0);
    const closing = {
      orderCount: closingOrders.length,
      debtSettlementCount: closingSettlements.length,
      salesReceived: receivedTotal(closingOrders),
      customerCreditUsed: closingOrders.reduce((sum, order) => sum + partAmount(order, 'SALDO_CLIENTE'), 0),
      debtReceived: sum(closingSettlements, 'amount'),
      totalReceived: receivedTotal(closingOrders) + sum(closingSettlements, 'amount'),
      confirmedDebt: (isAdmin ? confirmed : confirmed.filter((order) => order.createdBy?.id === user.id || financialReceiver(order)?.id === user.id)).reduce((sum, order) => sum + partAmount(order, 'FIADO'), 0),
      byPayment,
    };
    return {
      range,
      pendingConfirmation,
      pendingPayment,
      confirmed,
      paid,
      awaitingDriver,
      outForDelivery,
      history: history.sort((a, b) => String(b.paidAt || b.completedAt || b.createdAt).localeCompare(String(a.paidAt || a.completedAt || a.createdAt))),
      debtHistory: debtHistory.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      metrics: {
        sales: sum(mySales, 'total'),
        receipts: receivedTotal(myReceipts),
        debtReceipts: sum(myDebtReceipts, 'amount'),
        orderCount: mySales.length,
      },
      closing,
      cashierOrders: closingOrders,
      cashierSettlements: closingSettlements,
    };
  };
  app.get('/api/caixa/orders', route(async (req, res) => {
    const { cashierOrders, ...board } = await cashierSnapshot(req.user, req.query);
    delete board.cashierSettlements;
    res.json({ ...board, cashierOrderIds: cashierOrders.map(order => order.id) });
  }));
  const createReport = async (user, query) => {
    const snapshot = await cashierSnapshot(user, query);
    const { createCashierSnapshotPdf } = require('../reports/cashier-snapshot-pdf');
    return { buffer: await createCashierSnapshotPdf(snapshot, user), range: snapshot.range };
  };
  app.get('/api/caixa/report.pdf', requireCashier, route(async (req, res) => {
    const report = await createReport(req.user, req.query);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="caixa-' + report.range.from + '.pdf"', 'Cache-Control': 'private, no-store' });
    res.send(report.buffer);
  }));
  app.post('/api/caixa/report/send-whatsapp', requireCashier, route(async (req, res) => {
    const phone = normalizePhone(ownerPhone);
    if (!phone || !whatsapp?.sendDocumentBuffer) return res.status(503).json({ error: 'Configure o WhatsApp da loja para enviar o relatório.' });
    const report = await createReport(req.user, req.body);
    const result = await whatsapp.sendDocumentBuffer(phone, report.buffer, 'caixa-' + report.range.from + '.pdf', 'Relatório do caixa ' + report.range.from + ' - ' + (req.user.role === 'ADMIN' ? 'Geral da loja' : req.user.name));
    if (result?.mock || !result?.messages?.length) return res.status(502).json({ error: 'O WhatsApp não confirmou o envio. O PDF continua disponível para baixar.' });
    res.json({ success: true, message: 'PDF enviado ao WhatsApp da loja.' });
  }));

  app.get('/api/caixa/closing-status', requireCashier, route(async (req, res) => {
    const date = businessDate(new Date());
    const closings = await store.list('cashier_closings', 'date', date);
    const myClosing = closings.find((c) => c.userId === req.user.id) || null;

    const allOrders = await store.list('orders');
    const todayOrders = allOrders.filter((o) => o.completedAt && businessDate(o.completedAt) === date);
    const allSettlements = await store.list('debt_settlements');
    const todaySettlements = allSettlements.filter((s) => s.settledAt && businessDate(s.settledAt) === date);

    const operatorMap = new Map();
    for (const order of todayOrders) {
      const receiver = financialReceiver(order) || order.receivedBy || order.createdBy;
      if (receiver?.id && ['ADMIN', 'CAIXA'].includes(receiver.role)) {
        operatorMap.set(receiver.id, { id: receiver.id, name: receiver.name || 'Operador', role: receiver.role });
      }
    }
    for (const s of todaySettlements) {
      if (s.receivedBy?.id && ['ADMIN', 'CAIXA'].includes(s.receivedBy.role)) {
        operatorMap.set(s.receivedBy.id, { id: s.receivedBy.id, name: s.receivedBy.name || 'Operador', role: s.receivedBy.role });
      }
    }
    for (const c of closings) {
      if (!operatorMap.has(c.userId)) {
        operatorMap.set(c.userId, { id: c.userId, name: c.userName || 'Operador', role: c.userRole });
      }
    }
    if (!operatorMap.has(req.user.id) && ['ADMIN', 'CAIXA'].includes(req.user.role)) {
      operatorMap.set(req.user.id, { id: req.user.id, name: req.user.name || req.user.email, role: req.user.role });
    }

    const myOrders = todayOrders.filter((order) => {
      const r = financialReceiver(order) || order.receivedBy || order.createdBy;
      return r?.id === req.user.id;
    });
    const mySettlements = todaySettlements.filter((s) => s.receivedBy?.id === req.user.id);
    const myTotals = paymentTotals(myOrders, mySettlements);
    const myExpected = {
      cash: Math.round((myTotals.DINHEIRO?.total || 0) * 100) / 100,
      pix: Math.round((myTotals.PIX?.total || 0) * 100) / 100,
      credit: Math.round((myTotals.CREDITO?.total || 0) * 100) / 100,
      debit: Math.round((myTotals.DEBITO?.total || 0) * 100) / 100,
      total: Math.round(((myTotals.DINHEIRO?.total || 0) + (myTotals.PIX?.total || 0) + (myTotals.CREDITO?.total || 0) + (myTotals.DEBITO?.total || 0)) * 100) / 100,
    };

    const activeOperators = Array.from(operatorMap.values()).map((op) => {
      const opClosing = closings.find((c) => c.userId === op.id);
      return {
        id: op.id,
        name: op.name,
        role: op.role,
        closed: Boolean(opClosing),
        closedAt: opClosing?.closedAt || null,
        closingId: opClosing?.id || null,
        proofId: opClosing?.proofId || null,
      };
    });

    const allClosed = activeOperators.length > 0 && activeOperators.every((op) => op.closed);
    res.json({ date, myClosing, myExpected, activeOperators, allClosed });
  }));

  app.post('/api/caixa/close-my-cashier', requireCashier, route(async (req, res) => {
    const date = req.body.date || businessDate(new Date());
    const closingId = `${req.user.id}_${date}`;
    const existing = await store.read('cashier_closings', closingId);
    if (existing) {
      return res.status(409).json({ error: 'O seu caixa para esta data já foi fechado e não pode ser reaberto.' });
    }

    const allOrders = await store.list('orders');
    const todayOrders = allOrders.filter((o) => o.completedAt && businessDate(o.completedAt) === date);
    const allSettlements = await store.list('debt_settlements');
    const todaySettlements = allSettlements.filter((s) => s.settledAt && businessDate(s.settledAt) === date);

    const myOrders = todayOrders.filter((order) => {
      const r = financialReceiver(order) || order.receivedBy || order.createdBy;
      return r?.id === req.user.id;
    });
    const mySettlements = todaySettlements.filter((s) => s.receivedBy?.id === req.user.id);
    const myTotals = paymentTotals(myOrders, mySettlements);
    const expected = {
      cash: Math.round((myTotals.DINHEIRO?.total || 0) * 100) / 100,
      pix: Math.round((myTotals.PIX?.total || 0) * 100) / 100,
      credit: Math.round((myTotals.CREDITO?.total || 0) * 100) / 100,
      debit: Math.round((myTotals.DEBITO?.total || 0) * 100) / 100,
      total: Math.round(((myTotals.DINHEIRO?.total || 0) + (myTotals.PIX?.total || 0) + (myTotals.CREDITO?.total || 0) + (myTotals.DEBITO?.total || 0)) * 100) / 100,
    };

    const countedInput = req.body.counted || {};
    const counted = {
      cash: Math.round(Number(countedInput.cash || 0) * 100) / 100,
      pix: Math.round(Number(countedInput.pix || 0) * 100) / 100,
      credit: Math.round(Number(countedInput.credit || 0) * 100) / 100,
      debit: Math.round(Number(countedInput.debit || 0) * 100) / 100,
    };
    const countedTotal = Math.round((counted.cash + counted.pix + counted.credit + counted.debit) * 100) / 100;
    const differences = {
      cash: Math.round((counted.cash - expected.cash) * 100) / 100,
      pix: Math.round((counted.pix - expected.pix) * 100) / 100,
      credit: Math.round((counted.credit - expected.credit) * 100) / 100,
      debit: Math.round((counted.debit - expected.debit) * 100) / 100,
      total: Math.round((countedTotal - expected.total) * 100) / 100,
    };

    const closingDoc = {
      id: closingId,
      userId: req.user.id,
      userName: req.user.name || req.user.email,
      userRole: req.user.role,
      date,
      status: 'CLOSED',
      closedAt: new Date().toISOString(),
      expected,
      counted: { ...counted, total: countedTotal },
      differences,
      notes: String(req.body.notes || '').slice(0, 500),
      proofId: req.body.proofId || null,
    };

    await store.transaction(async (tx) => {
      tx.set('cashier_closings', closingId, closingDoc);
    });

    const closings = await store.list('cashier_closings', 'date', date);
    const operatorMap = new Map();
    for (const order of todayOrders) {
      const receiver = financialReceiver(order) || order.receivedBy || order.createdBy;
      if (receiver?.id && ['ADMIN', 'CAIXA'].includes(receiver.role)) {
        operatorMap.set(receiver.id, { id: receiver.id, name: receiver.name || 'Operador', role: receiver.role });
      }
    }
    for (const s of todaySettlements) {
      if (s.receivedBy?.id && ['ADMIN', 'CAIXA'].includes(s.receivedBy.role)) {
        operatorMap.set(s.receivedBy.id, { id: s.receivedBy.id, name: s.receivedBy.name || 'Operador', role: s.receivedBy.role });
      }
    }
    for (const c of closings) {
      if (!operatorMap.has(c.userId)) {
        operatorMap.set(c.userId, { id: c.userId, name: c.userName || 'Operador', role: c.userRole });
      }
    }

    const activeOperators = Array.from(operatorMap.values());
    const allClosed = activeOperators.length > 0 && activeOperators.every((op) => closings.some((c) => c.userId === op.id));

    let whatsappSent = false;
    let whatsappQueued = false;

    if (allClosed) {
      const ownerWhatsApp = process.env.OWNER_WHATSAPP_NUMBER || '5564999994321';
      const grandTotalExpected = closings.reduce((sum, c) => sum + (c.expected?.total || 0), 0);
      const grandTotalCounted = closings.reduce((sum, c) => sum + (c.counted?.total || 0), 0);
      const totalCountedCash = closings.reduce((sum, c) => sum + (c.counted?.cash || 0), 0);
      const totalCountedPix = closings.reduce((sum, c) => sum + (c.counted?.pix || 0), 0);
      const totalCountedDebit = closings.reduce((sum, c) => sum + (c.counted?.debit || 0), 0);
      const totalCountedCredit = closings.reduce((sum, c) => sum + (c.counted?.credit || 0), 0);

      const operatorsSummary = closings.map((c) => {
        const diffTotal = c.differences.total;
        const diffSign = diffTotal === 0 ? 'Exato' : (diffTotal > 0 ? `+${money(diffTotal)} (Sobra)` : `${money(diffTotal)} (Falta)`);
        return `👤 *${c.userName}* (${c.userRole}):\n  - Apurado Sistema: ${money(c.expected.total)}\n  - Conferido Caixa: ${money(c.counted.total)}\n  - Diferença: ${diffSign}${c.proofId ? '\n  - Comprovante de maquininha anexado' : ''}`;
      }).join('\n\n');

      const consolidatedText = `📊 *CONFLORA — FECHAMENTO GERAL DE TODOS OS CAIXAS*
📅 Data: ${date}

✅ *Todos os operadores fecharam seus caixas com sucesso!*

👥 *Detalhamento por Operador:*
${operatorsSummary}

💰 *Total Conferido em Caixa:*
💵 Dinheiro: ${money(totalCountedCash)}
⚡ PIX: ${money(totalCountedPix)}
💳 Cartão Débito: ${money(totalCountedDebit)}
💳 Cartão Crédito: ${money(totalCountedCredit)}
━━━━━━━━━━━━━━━━━━━
💎 TOTAL GERAL: ${money(grandTotalCounted)} (Apurado Sistema: ${money(grandTotalExpected)})

Operação diária Conflora finalizada.`;

      const jobId = `closing-summary-${date}`;
      await store.transaction(async (tx) => {
        tx.set('pdv_outbox', jobId, {
          id: jobId,
          kind: 'closing',
          recipient: ownerWhatsApp,
          text: consolidatedText,
          status: 'PENDING',
          attempts: 0,
          createdAt: new Date().toISOString(),
        });
      });
      whatsappQueued = true;
      try {
        await service.deliver(jobId);
        whatsappSent = true;
      } catch (err) {
        Logger.error('Falha ao enviar resumo de fechamento para o WhatsApp do proprietário', err);
      }
    }

    res.json({ success: true, closing: closingDoc, allClosed, whatsappQueued, whatsappSent });
  }));

  const findOrder = async (req) => {
    const order = await store.read('orders', req.params.id);
    const canViewOrder = order && (
      req.user.role === 'ADMIN' || order.createdBy?.id === req.user.id || financialReceiver(order)?.id === req.user.id ||
      (req.user.role === 'CAIXA' && (!order.completedAt || isDelivery(order) && order.deliveryStatus !== 'DELIVERED') && order.status !== 'CANCELLED')
    );
    if (!order || !COMMERCIAL_SOURCES.has(order.source) || !canViewOrder) { throw new Error('Comanda não encontrada para este usuário.'); }
    return order;
  };
  app.get('/api/caixa/orders/:id', route(async (req, res) => res.json(await findOrder(req))));
  app.post('/api/caixa/payment-proofs', requireStaff, route(async (req, res) => {
    const { targetType, targetId, dataUrl } = req.body;
    if (!['ORDER', 'DEBT', 'CLOSING'].includes(targetType) || !/^[a-zA-Z0-9_-]{1,128}$/.test(targetId || '')) throw new Error('Selecione o pagamento do comprovante.');
    if (targetType === 'ORDER') {
      const order = await store.read('orders', targetId);
      if (!order || order.completedAt || order.status === 'CANCELLED' || !canConfirmManualPix(order, req.user)) throw new Error('Pagamento não está pendente ou não pertence a você.');
    }
    if (['ENTREGADOR', 'VENDEDOR'].includes(req.user.role) && targetType !== 'ORDER') throw new Error('Este perfil só pode anexar comprovante de uma comanda própria.');
    const file = await proofStorage.save(dataUrl);
    const proof = { ...file, fileName: String(req.body.fileName || 'comprovante').replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 100), targetType, targetId, uploadedBy: req.user.id, createdAt: new Date().toISOString() };
    await store.transaction(async (tx) => tx.set('payment_proofs', proof.id, proof));
    res.status(201).json({ id: proof.id, fileName: proof.fileName, size: proof.size, url: '/api/caixa/payment-proofs/' + proof.id });
  }));
  app.get('/api/caixa/payment-proofs/:id', requireStaff, route(async (req, res) => {
    const proof = await store.read('payment_proofs', req.params.id);
    if (!proof || (['ENTREGADOR', 'VENDEDOR'].includes(req.user.role) && proof.uploadedBy !== req.user.id)) return res.sendStatus(404);
    if (req.user.role === 'ENTREGADOR') {
      const order = proof.targetType === 'ORDER' ? await store.read('orders', proof.targetId) : null;
      if (!order || order.assignedDriver?.id !== req.user.id || order.status === 'CANCELLED') return res.sendStatus(404);
    }
    const buffer = await proofStorage.read(proof.path);
    if (!buffer) return res.sendStatus(404);
    res.set({ 'Content-Type': proof.contentType, 'Content-Disposition': 'inline', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }).send(buffer);
  }));
  app.post('/api/caixa/orders/:id/move', requireCashier, route(async (req, res) => {
    const order = await findOrder(req);
    const { from, to } = req.body || {};
    const stage = order.status === 'AWAITING_CONFIRMATION' ? 'confirmation'
      : !order.completedAt && ['AWAITING_CASHIER', 'AWAITING_PAYMENT', 'CREATING_PIX', 'AWAITING_PIX', 'PENDING'].includes(order.status) ? 'payment' : 'closed';
    if (from !== stage || !((from === 'confirmation' && to === 'payment') || (from === 'payment' && to === 'paid'))) {
      throw new Error('Movimento permitido: confirmação → pagamento → pago. Atualize a comanda se ela mudou.');
    }
    if (to === 'paid') return res.json({ order, requiresPayment: true });
    const updated = await store.advanceToPayment(order.id, actor(req.user));
    await service.schedulePaymentExpiration(updated);
    res.json({ order: updated });
  }));
  app.post('/api/caixa/orders/:id/confirm', requireCashier, route(async (req, res) => {
    const existing = await findOrder(req);
    const isManualPix = req.body.manualPix === true || req.body.paymentMethod === 'PIX_MANUAL';
    const requestedMethod = req.body.paymentMethod === 'PIX_MANUAL' ? 'PIX' : req.body.paymentMethod;
    const parts = normalizePaymentParts(req.body.paymentParts, requestedMethod || existing.paymentMethod, existing.total);
    const paymentMethod = parts.some((part) => part.method === 'PIX') ? 'PIX' : parts.length > 1 ? 'MISTO' : parts[0].method;
    if (paymentMethod === 'PIX' && !isManualPix) {
      const order = await service.requestPixAtCashier(existing.id, req.user, parts);
      return res.status(202).json({ success: true, awaitingPayment: true, order, receiptText: formatOrderReceipt(order) });
    }
    const receivedAmount = req.body.receivedAmount === null || req.body.receivedAmount === undefined || req.body.receivedAmount === ''
      ? null : Number(req.body.receivedAmount);
    const verification = isManualPix && paymentMethod === 'PIX' ? manualPixVerification(existing, parts, req.body) : null;
    const order = await store.receive(existing.id, actor(req.user), verification, receivedAmount,
      existing.pixData?.txid ? null : paymentMethod, { sendFinalReceipt: !verification, requestedParts: parts });
    if (verification) {
      for (const id of await store.ensurePaymentNotifications(order.id)) await service.deliver(id);
    }
    const receiptId = `${order.id}-${verification ? 'customer-paid' : 'final-receipt'}`;
    await service.queueOperationalNotifications(order);
    await service.deliver(receiptId);
    const delivery = await store.read('pdv_outbox', receiptId);
    res.json({ success: true, order, receiptText: formatOrderReceipt(order), receiptDelivery: { sent: delivery?.status === 'SENT' && Boolean(order.customerPhone), reason: delivery?.lastError || (order.customerPhone ? '' : 'Sem WhatsApp informado.') } });
  }));
  app.post('/api/caixa/orders/:id/confirm-manual-pix', requireStaff, route(async (req, res) => {
    const existing = await findOrder(req);
    if (!canConfirmManualPix(existing, req.user) || !['CREATING_PIX', 'AWAITING_PIX', 'AWAITING_CASHIER', 'AWAITING_PAYMENT', 'PENDING'].includes(existing.status)) { throw new Error('Este pedido não está aguardando confirmação Pix.'); }
    if (Number.isFinite(Date.parse(existing.pixExpiresAt || '')) && Date.parse(existing.pixExpiresAt) <= Date.now()) {
      await service.expirePixOrder(existing.id);
      throw new Error('Esta cobrança Pix venceu e o estoque está sendo liberado. Confira o histórico do pedido.');
    }
    const receiver = actor(req.user);
    const parts = existing.pixData?.txid ? existing.paymentParts || [{ method: 'PIX', amount: existing.total }] : [{ method: 'PIX', amount: existing.total }];
    const verification = manualPixVerification(existing, parts, req.body);
    const order = await store.receive(existing.id, receiver, verification, null, existing.pixData?.txid ? null : 'PIX', { requestedParts: parts });
    const notificationIds = await store.ensurePaymentNotifications(order.id);
    await service.queueOperationalNotifications(order);
    for (const id of notificationIds) await service.deliver(id);
    res.json({ success: true, order, receiptText: formatOrderReceipt(order) });
  }));
  // This compatibility endpoint only reads persisted status; it cannot confirm payment.
  app.post('/api/caixa/orders/:id/confirm-sicredi-pix', route(async (req, res) => {
    const order = await findOrder(req);
    res.status(order.completedAt ? 200 : 202).json({ success: Boolean(order.completedAt), order });
  }));
  app.post('/api/caixa/orders/:id/send-whatsapp', route(async (req, res) => {
    const order = await findOrder(req);
    await service.deliver(`${order.id}-receipt`);
    res.json({ success: true, delivery: await store.read('pdv_outbox', `${order.id}-receipt`) });
  }));
  app.post('/api/caixa/orders/:id/cancel', route(async (req, res) => {
    const order = await findOrder(req);
    if (order.paymentMethod === 'PIX' && order.pixMode !== 'MANUAL') { return res.status(409).json({ error: 'Cobranças Pix exigem cancelamento e conciliação no Sicredi.' }); }
    res.json(await repository.cancelOrder(req.params.id, String(req.body.reason || '')));
  }));
  app.post('/tasks/expire-pix', async (req, res) => {
    const secret = process.env.TASK_SECRET || '';
    if (!secureEqual(req.headers['x-conflora-task-secret'], secret)) return res.sendStatus(401);
    const orderId = String(req.body?.orderId || '');
    if (!orderId || orderId.includes('/')) return res.sendStatus(400);
    try {
      const order = await store.read('orders', orderId);
      if (!order || order.status === 'CANCELLED' || order.completedAt || order.paymentTransactionId) return res.sendStatus(200);
      if (!order.pixExpiresAt && !order.paymentExpiresAt) return res.sendStatus(200);
      if (Date.parse(order.pixExpiresAt || order.paymentExpiresAt || '') > Date.now()) return res.sendStatus(503);
      await service.expirePixOrder(orderId);
      return res.sendStatus(200);
    } catch (error) {
      Logger.warn('Falha ao expirar pedido Pix agendado.', { orderId, error: error.message });
      return res.sendStatus(503);
    }
  });
  app.get('/api/caixa/customers/:key/debts', requireCashier, route(async (req, res) => {
    const customer = await store.read('customers', req.params.key);
    if (!customer) { throw new Error('Cliente não cadastrado.'); }
    const debts = await store.list('customer_debts', 'customerKey', req.params.key);
    const payments = await store.list('debt_settlements', 'customerKey', req.params.key);
    res.json({ success: true, balance: Number(customer.debtBalance || 0), creditBalance: Number(customer.creditBalance || 0), transactions: [...debts, ...payments] });
  }));
  app.post('/api/caixa/debts/settle', requireCashier, route(async (req, res) => {
    const amount = Number(req.body.amount);
    const paymentMethod = String(req.body.paymentMethod || '').toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) throw new Error('Informe o valor recebido em centavos.');
    const parts = normalizePaymentParts(req.body.paymentParts, paymentMethod, amount);
    if (parts.some((part) => !['DINHEIRO', 'DEBITO', 'CREDITO', 'PIX'].includes(part.method))) throw new Error('Use dinheiro, cartão ou Pix conferido.');
    const verification = parts.some((part) => part.method === 'PIX') ? manualPixVerification({}, parts, req.body) : null;
    const customerKey = String(req.body.customerKey || '');
    if (!customerKey || customerKey.includes('/')) { throw new Error('Selecione o cliente cadastrado.'); }
    const entryType = String(req.body.entryType || 'QUITACAO_FIADO').toUpperCase();
    if (!['QUITACAO_FIADO', 'CREDITO_CLIENTE'].includes(entryType)) { throw new Error('Tipo de recebimento inválido.'); }
    const result = await store.settle({ id: requestId(req.body.requestId), customerKey, amount: Math.round(amount * 100) / 100, paymentMethod, paymentParts: parts, verification,
      notes: String(req.body.notes || '').slice(0, 500), receivedBy: actor(req.user), entryType });
    await service.deliver(result.id);
    res.json({ success: true, ...result });
  }));

  const normalizeFingerprint = (fp) => String(fp || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  app.post([
    '/webhooks/sicredi-pix',
    '/webhooks/sicredi-pix/pix',
    '/api/webhooks/sicredi-pix',
    '/api/webhooks/sicredi-pix/pix',
    '/webhooks/sicredi-pix/:secret',
    '/webhooks/sicredi-pix/:secret/pix',
    '/api/webhooks/sicredi-pix/:secret',
    '/api/webhooks/sicredi-pix/:secret/pix',
  ], async (req, res) => {
    // Gateway must validate the Sicredi client certificate and replace this header.
    const gatewayVerified = secureEqual(req.headers['x-sicredi-gateway-secret'], process.env.SICREDI_WEBHOOK_GATEWAY_SECRET);
    const certificate = req.socket.getPeerCertificate?.();
    const expectedFp = normalizeFingerprint(process.env.SICREDI_WEBHOOK_CERT_FINGERPRINT);
    const actualFp = normalizeFingerprint(certificate?.fingerprint256);
    const directlyVerified = Boolean(req.socket.authorized && (
      secureEqual(certificate?.fingerprint256, process.env.SICREDI_WEBHOOK_CERT_FINGERPRINT) ||
      (expectedFp.length === 64 && secureEqual(actualFp, expectedFp))
    ));
    const webhookSecret = process.env.SICREDI_WEBHOOK_SECRET || '';
    const candidateSecret = req.params.secret || req.headers['x-sicredi-webhook-secret'] || '';
    const secretRouteVerified = webhookSecret.length >= 32 && secureEqual(candidateSecret, webhookSecret);
    if (!gatewayVerified && !directlyVerified && !secretRouteVerified) { return res.sendStatus(401); }
    if (!Array.isArray(req.body?.pix) || req.body.pix.length > 100) { return res.sendStatus(400); }
    try {
      for (const entry of req.body.pix) {
        const txid = String(entry.txid || '');
        const endToEndId = String(entry.endToEndId || '');
        if (!/^[a-zA-Z0-9]{26,35}$/.test(txid) || !/^E[a-zA-Z0-9]{31}$/.test(endToEndId)) { return res.sendStatus(400); }
        await store.transaction(async (tx) => {
          const eventId = `${txid}-${endToEndId}`;
          const previous = await tx.get('pdv_pix_events', eventId);
          if (!previous) { tx.set('pdv_pix_events', eventId, { id: eventId, txid, endToEndId, status: 'PENDING', receivedAt: new Date().toISOString() }); }
        });
        await service.processPixEvent(txid, endToEndId);
      }
      res.sendStatus(200);
    } catch (error) { Logger.error('Conciliação Sicredi pendente', { error: error.message }); res.sendStatus(503); }
  });
  app.get('/api/admin/sicredi-pix/status', route(async (_req, res) => {
    const mode = require('../orders/pix-mode').pixMode();
    const resolvedWebhookUrl = typeof pix?.resolveWebhookUrl === 'function' ? pix.resolveWebhookUrl() : (process.env.SICREDI_WEBHOOK_URL || '');
    res.json({
      success: true,
      pixMode: mode,
      isOfficialApiConfigured: Boolean(pix?.isOfficialApiConfigured),
      pixKey: pix?.pixKey || process.env.SICREDI_PIX_KEY || process.env.PIX_KEY || process.env.STORE_PIX_KEY || '',
      beneficiario: pix?.beneficiario || process.env.SICREDI_BENEFICIARIO || process.env.PIX_TITULAR || 'Conflora Horta e Viveiro',
      cidade: pix?.cidade || process.env.SICREDI_CIDADE || 'Mineiros',
      ttlSeconds: Math.min(86400, Math.max(300, Number(process.env.PIX_PAYMENT_TTL_SECONDS) || 3600)),
      webhookUrl: resolvedWebhookUrl,
      hasWebhookSecret: String(process.env.SICREDI_WEBHOOK_SECRET || '').length >= 32,
      hasGatewaySecret: Boolean(process.env.SICREDI_WEBHOOK_GATEWAY_SECRET),
      hasCertFingerprint: Boolean(process.env.SICREDI_WEBHOOK_CERT_FINGERPRINT),
    });
  }));
  app.post('/api/admin/sicredi-pix/webhook', route(async (req, res) => {
    if (typeof pix?.registerWebhook !== 'function') {
      throw new Error('Cliente Sicredi PIX não suporta registro de webhook.');
    }
    const targetUrl = String(req.body?.webhookUrl || (typeof pix.resolveWebhookUrl === 'function' ? pix.resolveWebhookUrl() : process.env.SICREDI_WEBHOOK_URL) || '').trim();
    const result = await pix.registerWebhook(targetUrl);
    res.json({ success: true, webhookUrl: targetUrl, result });
  }));
  app.post('/api/admin/sicredi-pix/simulate', route(async (req, res) => {
    const { FirestoreRepository } = require('../database/firestore.repository');
    const { SicrediPixClient } = require('../integrations/sicredi-pix.client');
    const sandboxRepo = new FirestoreRepository({ isInMemory: true });
    const unitPrice = Math.max(1, Number(req.body?.unitPrice) || 45);
    const quantity = Math.max(1, Math.floor(Number(req.body?.quantity) || 2));
    const initialStock = quantity + 8;
    const expectedTotal = Number((unitPrice * quantity).toFixed(2));
    sandboxRepo.inMemoryProducts.set('sim-prod', {
      id: 'sim-prod',
      name: String(req.body?.productName || 'Muda de Ipê Amarelo (Simulação)'),
      price: unitPrice,
      stockQuantity: initialStock,
      reservedQuantity: 0,
      unit: 'UN',
      status: 'ATIVO',
      isAvailable: true,
    });

    const sicrediCalls = [];
    const simPixKey = pix?.pixKey || process.env.SICREDI_PIX_KEY || process.env.PIX_KEY || '52998224725';
    const simClient = new SicrediPixClient({
      clientId: 'sim-client-id',
      clientSecret: 'sim-client-secret',
      certificate: 'CERT-SIM',
      privateKey: 'KEY-SIM',
      pixKey: simPixKey,
      request: async (url, options) => {
        const parsedBody = options.body && options.headers?.['Content-Type'] === 'application/json'
          ? JSON.parse(options.body)
          : options.body;
        sicrediCalls.push({ method: options.method, url, body: parsedBody });
        if (url.includes('/oauth/token')) {
          return { access_token: 'sim-oauth-token', expires_in: 3600 };
        }
        if (options.method === 'PUT' && url.includes('/cob/')) {
          const txid = decodeURIComponent(url.split('/cob/')[1]);
          return {
            txid,
            chave: simPixKey,
            status: 'ATIVA',
            valor: { original: parsedBody.valor.original, modalidadeAlteracao: parsedBody.valor.modalidadeAlteracao },
            pixCopiaECola: `00020101021226850014br.gov.bcb.pix2563pix.sicredi.com.br/qr/v2/${txid}5204000053039865405${parsedBody.valor.original}5802BR5924Conflora6008Mineiros6304SIM0`,
          };
        }
        if (options.method === 'GET' && url.includes('/pix/')) {
          const endToEndId = decodeURIComponent(url.split('/pix/')[1]);
          const cob = sicrediCalls.find((c) => c.method === 'PUT' && c.url.includes('/cob/'));
          return {
            endToEndId,
            txid: cob ? decodeURIComponent(cob.url.split('/cob/')[1]) : '',
            valor: expectedTotal.toFixed(2),
            chave: simPixKey,
            devolucoes: [],
          };
        }
        return {};
      },
    });

    const sandboxStore = new PdvRepository(sandboxRepo);
    const sandboxWhatsapp = {
      sendTextMessage: async () => ({ messages: [{ id: 'wamid.sim.txt' }] }),
      sendImageBuffer: async () => ({ messages: [{ id: 'wamid.sim.img' }] }),
    };
    const sandboxService = new PdvService({
      repository: sandboxStore,
      pix: simClient,
      whatsapp: sandboxWhatsapp,
      ownerPhone: '5564999994321',
      taskQueueClient: { enqueuePixExpiration: async () => ({ simulated: true }) },
    });

    const previousMode = process.env.PIX_MODE;
    process.env.PIX_MODE = 'SICREDI';
    try {
      const created = await sandboxService.create(
        {
          requestId: randomUUID(),
          customerName: 'Cliente Simulação Sicredi',
          customerPhone: '5564999112233',
          orderType: 'PICKUP',
          paymentMethod: 'PIX',
          items: [{ productId: 'sim-prod', quantity, price: 0.01 }],
        },
        req.user,
      );
      const stockAfterCharge = structuredClone(sandboxRepo.inMemoryProducts.get('sim-prod'));
      const cobRequest = sicrediCalls.find((c) => c.method === 'PUT' && c.url.includes('/cob/'));

      const txid = created.pixData.txid;
      const endToEndId = 'E' + '8'.repeat(31);
      await sandboxStore.transaction(async (tx) => {
        tx.set('pdv_pix_events', `${txid}-${endToEndId}`, {
          id: `${txid}-${endToEndId}`,
          txid,
          endToEndId,
          status: 'PENDING',
          receivedAt: new Date().toISOString(),
        });
      });
      await sandboxService.processPixEvent(txid, endToEndId);

      const finalOrder = await sandboxStore.read('orders', created.id);
      const finalEvent = await sandboxStore.read('pdv_pix_events', `${txid}-${endToEndId}`);
      const stockAfterWebhook = structuredClone(sandboxRepo.inMemoryProducts.get('sim-prod'));

      const getPixCall = sicrediCalls.find((c) => c.method === 'GET' && c.url.includes(`/pix/${endToEndId}`));
      res.json({
        success: true,
        isolatedSandbox: true,
        steps: {
          step1_qrCodeGeneration: {
            orderId: created.id,
            lockedAmount: created.total,
            modalidadeAlteracao: cobRequest?.body?.valor?.modalidadeAlteracao,
            txid,
            pixCopiaECola: created.pixData.pixCopiaECola,
            qrCodeBase64: created.pixData.qrCodeBase64,
            hasQrCodeBase64: String(created.pixData.qrCodeBase64 || '').startsWith('data:image/png;base64,'),
            cobRequestPayload: cobRequest?.body || null,
            statusBeforeWebhook: created.status,
            paymentStatusBeforeWebhook: created.paymentStatus,
            stockBeforeWebhook: {
              stockQuantity: stockAfterCharge.stockQuantity,
              reservedQuantity: stockAfterCharge.reservedQuantity,
            },
          },
          step2_webhookReception: {
            payloadReceived: {
              pix: [{
                endToEndId,
                txid,
                chave: simPixKey,
                valor: expectedTotal.toFixed(2),
                horario: new Date().toISOString(),
              }],
            },
            bankCheckPerformed: Boolean(getPixCall),
            bankCheckResponse: {
              endToEndId,
              txid,
              valor: expectedTotal.toFixed(2),
              chave: simPixKey,
              devolucoes: [],
            },
            eventStatus: finalEvent?.status,
          },
          step3_firebaseUpdate: {
            statusAfterWebhook: finalOrder.status,
            paymentStatusAfterWebhook: finalOrder.paymentStatus,
            verifiedVia: finalOrder.verifiedVia,
            paymentTransactionId: finalOrder.paymentTransactionId,
            paidAt: finalOrder.paidAt,
            stockAfterWebhook: {
              stockQuantity: stockAfterWebhook.stockQuantity,
              reservedQuantity: stockAfterWebhook.reservedQuantity,
            },
          },
        },
      });
    } finally {
      if (previousMode === undefined) delete process.env.PIX_MODE;
      else process.env.PIX_MODE = previousMode;
    }
  }));

  const classifyPixStatus = (order) => {
    const isConfirmado = order.paymentStatus === 'APPROVED'
      || Boolean(order.paidAt || order.completedAt)
      || ['CONFIRMED', 'PAID_CONFIRMED', 'DELIVERED'].includes(order.status);
    if (isConfirmado) return 'confirmado';
    const isExpirado = order.status === 'CANCELLED'
      || (order.pixExpiresAt && Date.parse(order.pixExpiresAt) <= Date.now());
    if (isExpirado) return 'expirado';
    return 'pendente';
  };

  const formatPixMonitorOrder = (order, eventsByTxid = new Map()) => {
    const txid = order.pixData?.txid || '';
    const event = txid ? eventsByTxid.get(txid) || null : null;
    const pixAmount = Number(partAmount(order, 'PIX') || order.pixData?.amount || order.total || 0);
    return {
      id: order.id,
      ticketNumber: order.ticketNumber || String(order.id || '').slice(-8).toUpperCase(),
      customerName: order.customerName || 'Cliente Balcão',
      customerPhone: order.customerPhone || '',
      total: Number(order.total || 0),
      pixAmount,
      pixStatus: classifyPixStatus(order),
      rawStatus: order.status || 'PENDING',
      paymentStatus: order.paymentStatus || 'PENDING',
      pixMode: order.pixMode || (order.pixData?.provider === 'SICREDI' ? 'SICREDI' : 'MANUAL'),
      txid,
      endToEndId: order.paymentTransactionId || event?.endToEndId || '',
      verifiedVia: order.verifiedVia || null,
      modalidadeAlteracao: 0,
      pixCopiaECola: order.pixData?.pixCopiaECola || order.pixCopiaECola || '',
      qrCodeBase64: order.pixData?.qrCodeBase64 || '',
      createdAt: order.createdAt || null,
      paidAt: order.paidAt || order.completedAt || null,
      pixExpiresAt: order.pixExpiresAt || null,
      cancellationReason: order.cancellationReason || null,
      items: (order.items || []).map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
      webhookEvent: event,
    };
  };

  const queryPixMonitorData = async (query = {}, { defaultToday = false } = {}) => {
    const rawOrders = typeof repository.getAllOrders === 'function'
      ? await repository.getAllOrders(5000)
      : await store.list('orders');
    const pixOrders = (rawOrders || []).filter((o) => (
      o.paymentMethod === 'PIX'
      || (o.paymentParts || []).some((p) => p.method === 'PIX')
      || Boolean(o.pixData?.txid)
    ));
    const events = await store.list('pdv_pix_events').catch(() => []);
    const eventsByTxid = new Map();
    for (const ev of events || []) {
      if (ev?.txid) eventsByTxid.set(ev.txid, ev);
    }

    const todayStr = businessDate(new Date());
    const dateParam = String(query.date || '').trim();
    const fromParam = String(query.from || '').trim();
    const toParam = String(query.to || '').trim();
    const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v);

    let filterFrom = '';
    let filterTo = '';
    if (isIsoDate(dateParam)) {
      filterFrom = dateParam;
      filterTo = dateParam;
    } else if (isIsoDate(fromParam) || isIsoDate(toParam)) {
      filterFrom = isIsoDate(fromParam) ? fromParam : (isIsoDate(toParam) ? toParam : '');
      filterTo = isIsoDate(toParam) ? toParam : filterFrom;
      if (filterFrom > filterTo) {
        [filterFrom, filterTo] = [filterTo, filterFrom];
      }
    } else if (defaultToday && dateParam !== 'all') {
      filterFrom = todayStr;
      filterTo = todayStr;
    }

    const formattedAll = pixOrders
      .map((o) => {
        const formatted = formatPixMonitorOrder(o, eventsByTxid);
        const refDate = businessDate(formatted.paidAt || formatted.createdAt || new Date());
        return { ...formatted, businessDate: refDate };
      })
      .filter((row) => {
        if (!filterFrom && !filterTo) return true;
        return Boolean(row.businessDate && row.businessDate >= filterFrom && row.businessDate <= filterTo);
      })
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    const summary = {
      total: formattedAll.length,
      pendente: 0,
      confirmado: 0,
      expirado: 0,
      totalPendenteValor: 0,
      totalConfirmadoValor: 0,
      totalExpiradoValor: 0,
      pendentesVsConfirmados: {
        pendente: 0,
        confirmado: 0,
        activeTotal: 0,
        pendentePercent: 0,
        confirmadoPercent: 0,
        pendenteValor: 0,
        confirmadoValor: 0,
        confirmadoValorPercent: 0,
      },
    };
    for (const row of formattedAll) {
      summary[row.pixStatus] = (summary[row.pixStatus] || 0) + 1;
      if (row.pixStatus === 'pendente') summary.totalPendenteValor = Math.round((summary.totalPendenteValor + row.pixAmount) * 100) / 100;
      if (row.pixStatus === 'confirmado') summary.totalConfirmadoValor = Math.round((summary.totalConfirmadoValor + row.pixAmount) * 100) / 100;
      if (row.pixStatus === 'expirado') summary.totalExpiradoValor = Math.round((summary.totalExpiradoValor + row.pixAmount) * 100) / 100;
    }

    const activeTotal = summary.pendente + summary.confirmado;
    const activeValorTotal = summary.totalPendenteValor + summary.totalConfirmadoValor;
    summary.pendentesVsConfirmados = {
      pendente: summary.pendente,
      confirmado: summary.confirmado,
      activeTotal,
      pendentePercent: activeTotal > 0 ? Math.round((summary.pendente / activeTotal) * 100) : 0,
      confirmadoPercent: activeTotal > 0 ? Math.round((summary.confirmado / activeTotal) * 100) : 0,
      pendenteValor: summary.totalPendenteValor,
      confirmadoValor: summary.totalConfirmadoValor,
      confirmadoValorPercent: activeValorTotal > 0 ? Math.round((summary.totalConfirmadoValor / activeValorTotal) * 100) : 0,
    };

    const statusFilter = String(query.status || '').trim().toLowerCase();
    const filteredOrders = ['pendente', 'confirmado', 'expirado'].includes(statusFilter)
      ? formattedAll.filter((o) => o.pixStatus === statusFilter)
      : formattedAll;

    return {
      dateFilter: {
        from: filterFrom || null,
        to: filterTo || null,
        today: todayStr,
      },
      summary,
      orders: filteredOrders,
    };
  };

  app.get('/api/admin/sicredi-pix/orders', route(async (req, res) => {
    const data = await queryPixMonitorData(req.query || {}, { defaultToday: false });
    res.json({
      success: true,
      ...data,
    });
  }));

  app.get('/api/admin/sicredi-pix/export.csv', route(async (req, res) => {
    const data = await queryPixMonitorData(req.query || {}, { defaultToday: true });
    const periodLabel = data.dateFilter.from
      ? (data.dateFilter.from === data.dateFilter.to ? data.dateFilter.from : `${data.dateFilter.from}_a_${data.dateFilter.to}`)
      : 'completo';
    const csvEscape = (val) => {
      const str = String(val ?? '').replace(/\r?\n/g, ' ').trim();
      if (/[";,]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
      return str;
    };
    const header = [
      'Data_Ref',
      'Criado_Em',
      'Pago_Em',
      'Pedido',
      'Cliente',
      'Telefone',
      'Status_PIX',
      'Status_Sistema',
      'Modo_PIX',
      'Valor_PIX_BRL',
      'Modalidade_Alteracao',
      'TXID_Sicredi',
      'EndToEndId_Bacen',
      'Verificado_Via',
      'Itens',
    ].join(';');

    const rows = data.orders.map((o) => {
      const itemsStr = (o.items || []).map((i) => `${i.quantity || 1}x ${i.name || 'Item'}`).join(' | ');
      return [
        o.businessDate || '',
        o.createdAt || '',
        o.paidAt || '',
        `#${o.ticketNumber || o.id}`,
        o.customerName || '',
        o.customerPhone || '',
        String(o.pixStatus || '').toUpperCase(),
        o.rawStatus || '',
        o.pixMode || 'SICREDI',
        Number(o.pixAmount || 0).toFixed(2).replace('.', ','),
        String(o.modalidadeAlteracao ?? 0),
        o.txid || '',
        o.endToEndId || '',
        o.verifiedVia || (o.pixStatus === 'confirmado' ? 'CAIXA' : 'AGUARDANDO'),
        itemsStr,
      ].map(csvEscape).join(';');
    });

    const csvContent = '\uFEFF' + [header, ...rows].join('\r\n') + '\r\n';
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="conciliacao-pix-sicredi-${periodLabel}.csv"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(csvContent);
  }));

  app.get('/api/admin/sicredi-pix/export.pdf', route(async (req, res) => {
    const PDFDocument = require('pdfkit');
    const data = await queryPixMonitorData(req.query || {}, { defaultToday: true });
    const periodLabel = data.dateFilter.from
      ? (data.dateFilter.from === data.dateFilter.to ? data.dateFilter.from : `${data.dateFilter.from}_a_${data.dateFilter.to}`)
      : 'completo';
    const formatBrDate = (iso) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : 'Todas as datas');
    const periodDisplay = data.dateFilter.from
      ? (data.dateFilter.from === data.dateFilter.to
        ? formatBrDate(data.dateFilter.from)
        : `${formatBrDate(data.dateFilter.from)} a ${formatBrDate(data.dateFilter.to)}`)
      : 'Todas as datas registradas';

    const buffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        bufferPages: true,
        info: {
          Title: `Conciliação Bancária PIX Sicredi - ${periodDisplay}`,
          Author: 'Conflora Horta e Viveiro',
        },
      });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const width = doc.page.width - 80;
      const clean = (v) => String(v || '').replace(/[\x00-\x1f]/g, ' ').slice(0, 400);
      const line = (text, { bold = false, size = 10, color = '#1e293b' } = {}) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
        const h = doc.heightOfString(clean(text), { width });
        if (doc.y + h > doc.page.height - 65) doc.addPage();
        doc.fillColor(color).text(clean(text), 40, doc.y, { width });
        doc.moveDown(0.4);
      };

      line('CONFLORA HORTA E VIVEIRO — CONCILIAÇÃO BANCÁRIA PIX (SICREDI)', { bold: true, size: 12, color: '#0f766e' });
      line('Relatório de Transações PIX', { bold: true, size: 22, color: '#0f172a' });
      line(`Período filtrado: ${periodDisplay}`, { bold: true, size: 11, color: '#334155' });
      line(`Emitido em: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} por ${clean(req.user?.name || req.user?.email || 'Administrador')}`, { size: 9, color: '#64748b' });

      doc.moveDown(0.5);
      line('1. Resumo de Conciliação (Pendentes vs. Confirmados)', { bold: true, size: 13, color: '#0f766e' });
      const pvc = data.summary.pendentesVsConfirmados;
      line(`• Confirmados (Conciliados): ${data.summary.confirmado} pedido(s) — ${money(data.summary.totalConfirmadoValor)} (${pvc.confirmadoPercent}% dos ativos)`, { bold: true, size: 11, color: '#15803d' });
      line(`• Pendentes (Aguardando Webhook): ${data.summary.pendente} pedido(s) — ${money(data.summary.totalPendenteValor)} (${pvc.pendentePercent}% dos ativos)`, { bold: true, size: 11, color: '#a16207' });
      line(`• Expirados (TTL vencido / Reserva liberada): ${data.summary.expirado} pedido(s) — ${money(data.summary.totalExpiradoValor)}`, { size: 10, color: '#b91c1c' });
      line(`• Total de Transações Listadas: ${data.orders.length}`, { size: 10, color: '#334155' });

      doc.moveDown(0.5);
      line('2. Detalhamento das Transações PIX para Conciliação Bancária', { bold: true, size: 13, color: '#0f766e' });
      if (!data.orders.length) {
        line('Nenhuma transação PIX encontrada para os filtros selecionados.', { size: 10, color: '#64748b' });
      } else {
        for (const o of data.orders) {
          const statusColor = o.pixStatus === 'confirmado' ? '#15803d' : (o.pixStatus === 'expirado' ? '#b91c1c' : '#a16207');
          line(`Pedido #${o.ticketNumber || o.id} | ${o.customerName} | Status: ${String(o.pixStatus).toUpperCase()} | Valor: ${money(o.pixAmount)}`, { bold: true, size: 10, color: statusColor });
          line(`  Data/Hora Criação: ${o.createdAt ? new Date(o.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'} | Pago em: ${o.paidAt ? new Date(o.paidAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'}`, { size: 9, color: '#475569' });
          line(`  TXID Sicredi: ${o.txid || '—'} | EndToEndId Bacen: ${o.endToEndId || '—'} | Verificado via: ${o.verifiedVia || '—'}`, { size: 8.5, color: '#334155' });
          doc.moveDown(0.2);
        }
      }

      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(8).fillColor('#64748b');
        doc.text(`Conflora — Conciliação PIX Sicredi | Página ${i + 1} de ${range.count}`, 40, doc.page.height - 50, { width, lineBreak: false });
      }
      doc.end();
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="conciliacao-pix-sicredi-${periodLabel}.pdf"`,
      'Cache-Control': 'private, no-store',
    });
    res.send(buffer);
  }));

  app.post('/api/admin/sicredi-pix/simulate-order', route(async (req, res) => {
    const { SicrediPixClient } = require('../integrations/sicredi-pix.client');
    const unitPrice = Math.max(1, Number(req.body?.unitPrice) || 65);
    const quantity = Math.max(1, Math.floor(Number(req.body?.quantity) || 1));
    const productName = String(req.body?.productName || 'Palmeira Rabo de Raposa (Teste PIX Sicredi)').slice(0, 100);
    const customerName = String(req.body?.customerName || 'Cliente Teste Sicredi').slice(0, 100);
    const customerPhone = String(req.body?.customerPhone || '5564999112233');
    const simProductId = 'sim-admin-pix-prod';

    const productDoc = {
      id: simProductId,
      name: productName,
      descricao: productName,
      category: 'Palmeiras',
      categoria: 'Palmeiras',
      price: unitPrice,
      valor_num: unitPrice,
      stockQuantity: Math.max(100, quantity + 50),
      reservedQuantity: 0,
      unit: 'UN',
      status: 'ATIVO',
      isAvailable: true,
    };
    if (repository.inMemoryProducts instanceof Map) {
      repository.inMemoryProducts.set(simProductId, productDoc);
    }
    await store.transaction(async (tx) => {
      tx.set('products', simProductId, productDoc);
    });

    const sicrediCalls = [];
    const simPixKey = pix?.pixKey || process.env.SICREDI_PIX_KEY || process.env.PIX_KEY || process.env.STORE_PIX_KEY || '52998224725';
    const simClient = new SicrediPixClient({
      clientId: 'sim-client-id',
      clientSecret: 'sim-client-secret',
      certificate: 'CERT-SIM',
      privateKey: 'KEY-SIM',
      pixKey: simPixKey,
      request: async (url, options) => {
        const parsedBody = options.body && options.headers?.['Content-Type'] === 'application/json'
          ? JSON.parse(options.body)
          : options.body;
        sicrediCalls.push({ method: options.method, url, body: parsedBody });
        if (url.includes('/oauth/token')) {
          return { access_token: 'sim-oauth-token', expires_in: 3600 };
        }
        if (options.method === 'PUT' && url.includes('/cob/')) {
          const txid = decodeURIComponent(url.split('/cob/')[1]);
          return {
            txid,
            chave: simPixKey,
            status: 'ATIVA',
            calendario: parsedBody.calendario,
            valor: {
              original: parsedBody.valor.original,
              modalidadeAlteracao: parsedBody.valor.modalidadeAlteracao,
            },
            pixCopiaECola: `00020101021226850014br.gov.bcb.pix2563pix.sicredi.com.br/qr/v2/${txid}5204000053039865405${parsedBody.valor.original}5802BR5924Conflora6008Mineiros6304SIM0`,
          };
        }
        return {};
      },
    });

    const simWhatsapp = {
      sendTextMessage: async () => ({ messages: [{ id: 'wamid.sim.order.txt' }] }),
      sendImageBuffer: async () => ({ messages: [{ id: 'wamid.sim.order.img' }] }),
    };
    const simService = new PdvService({
      repository: store,
      pix: simClient,
      whatsapp: simWhatsapp,
      ownerPhone: ownerPhone || '5564999994321',
      taskQueueClient: { enqueuePixExpiration: async () => ({ simulated: true }) },
    });

    const previousMode = process.env.PIX_MODE;
    process.env.PIX_MODE = 'SICREDI';
    try {
      const created = await simService.create(
        {
          requestId: randomUUID(),
          customerName,
          customerPhone,
          orderType: 'PICKUP',
          paymentMethod: 'PIX',
          items: [{ productId: simProductId, quantity, price: 0.01 }],
        },
        req.user,
      );
      const cobCall = sicrediCalls.find((c) => c.method === 'PUT' && c.url.includes('/cob/'));
      res.status(201).json({
        success: true,
        order: formatPixMonitorOrder(created),
        cobRequest: {
          method: 'PUT',
          endpoint: `/api/v2/cob/${created.pixData?.txid}`,
          payload: cobCall?.body || null,
        },
      });
    } finally {
      if (previousMode === undefined) delete process.env.PIX_MODE;
      else process.env.PIX_MODE = previousMode;
    }
  }));

  app.post('/api/admin/sicredi-pix/simulate-webhook', route(async (req, res) => {
    const { SicrediPixClient } = require('../integrations/sicredi-pix.client');
    const action = String(req.body?.action || 'confirm').trim().toLowerCase();
    const requestedOrderId = String(req.body?.orderId || '').trim();
    const requestedTxid = String(req.body?.txid || '').trim();

    let targetOrder = null;
    if (requestedOrderId) {
      targetOrder = await store.read('orders', requestedOrderId);
    } else if (requestedTxid) {
      const matched = await store.list('orders', 'pixData.txid', requestedTxid);
      targetOrder = matched[0] || null;
    } else {
      const rawOrders = typeof repository.getAllOrders === 'function'
        ? await repository.getAllOrders(1000)
        : await store.list('orders');
      targetOrder = (rawOrders || [])
        .filter((o) => (o.paymentMethod === 'PIX' || o.pixData?.txid) && classifyPixStatus(o) === 'pendente')
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
    }

    if (!targetOrder) {
      throw new Error('Nenhum pedido PIX pendente encontrado para simular. Clique em "Gerar Pedido PIX de Teste" primeiro.');
    }

    const beforeSnapshot = formatPixMonitorOrder(targetOrder);

    if (action === 'expire') {
      const expiredIso = new Date(Date.now() - 5000).toISOString();
      await store.transaction(async (tx) => {
        const current = await tx.get('orders', targetOrder.id);
        if (current) {
          tx.set('orders', targetOrder.id, { ...current, pixExpiresAt: expiredIso });
        }
      });
      await service.expirePixOrder(targetOrder.id);
      const afterOrder = await store.read('orders', targetOrder.id);
      return res.json({
        success: true,
        action: 'expire',
        before: beforeSnapshot,
        after: formatPixMonitorOrder(afterOrder),
        webhookPayload: {
          evento: 'EXPIRACAO_TTL_AUTOMATICA',
          txid: targetOrder.pixData?.txid || '',
          orderId: targetOrder.id,
          pixExpiresAt: expiredIso,
          acaoFirebase: 'Status alterado para CANCELLED (expirado) e reserva de estoque liberada.',
        },
      });
    }

    let txid = String(targetOrder.pixData?.txid || '').trim();
    if (!/^[a-zA-Z0-9]{26,35}$/.test(txid)) {
      txid = String(targetOrder.id || randomUUID()).replace(/[^a-zA-Z0-9]/g, '').padEnd(32, '0').slice(0, 32).toUpperCase();
      await store.transaction(async (tx) => {
        const current = await tx.get('orders', targetOrder.id);
        if (current) {
          tx.set('orders', targetOrder.id, {
            ...current,
            paymentMethod: 'PIX',
            pixMode: 'SICREDI',
            pixData: { ...(current.pixData || {}), txid, provider: 'SICREDI' },
          });
        }
      });
      targetOrder = await store.read('orders', targetOrder.id);
    }

    const pixAmount = Number(partAmount(targetOrder, 'PIX') || targetOrder.total || 0);
    const suffix = randomUUID().replace(/-/g, '').toUpperCase().slice(0, 17);
    const endToEndId = `E01181521202610${suffix}`; // 1 + 14 + 17 = 32 chars
    const simPixKey = pix?.pixKey || process.env.SICREDI_PIX_KEY || process.env.PIX_KEY || process.env.STORE_PIX_KEY || '52998224725';
    const horario = new Date().toISOString();

    const webhookPayload = {
      pix: [
        {
          endToEndId,
          txid,
          chave: simPixKey,
          valor: pixAmount.toFixed(2),
          horario,
          infoPagador: 'Pagamento PIX confirmado via Simulador Sicredi (/admin)',
        },
      ],
    };

    const bankVerificationResponse = {
      endToEndId,
      txid,
      valor: pixAmount.toFixed(2),
      chave: simPixKey,
      horario,
      status: 'CONCLUIDA',
      devolucoes: [],
    };

    const simClient = new SicrediPixClient({
      clientId: 'sim-client-id',
      clientSecret: 'sim-client-secret',
      certificate: 'CERT-SIM',
      privateKey: 'KEY-SIM',
      pixKey: simPixKey,
      request: async (url, options) => {
        if (url.includes('/oauth/token')) {
          return { access_token: 'sim-oauth-token', expires_in: 3600 };
        }
        if (options.method === 'GET' && url.includes('/pix/')) {
          return bankVerificationResponse;
        }
        return {};
      },
    });

    const simWhatsapp = {
      sendTextMessage: async () => ({ messages: [{ id: 'wamid.sim.wh.txt' }] }),
      sendImageBuffer: async () => ({ messages: [{ id: 'wamid.sim.wh.img' }] }),
    };
    const simService = new PdvService({
      repository: store,
      pix: simClient,
      whatsapp: simWhatsapp,
      ownerPhone: ownerPhone || '5564999994321',
      taskQueueClient: { enqueuePixExpiration: async () => ({ simulated: true }) },
    });

    const eventId = `${txid}-${endToEndId}`;
    await store.transaction(async (tx) => {
      tx.set('pdv_pix_events', eventId, {
        id: eventId,
        txid,
        endToEndId,
        status: 'PENDING',
        receivedAt: horario,
        simulated: true,
      });
    });

    await simService.processPixEvent(txid, endToEndId);

    const afterOrder = await store.read('orders', targetOrder.id);
    const afterEvent = await store.read('pdv_pix_events', eventId);
    const eventsMap = new Map([[txid, afterEvent]]);

    res.json({
      success: true,
      action: 'confirm',
      webhookEndpoint: '/webhooks/sicredi-pix',
      webhookPayload,
      bankVerificationEndpoint: `/api/v2/pix/${endToEndId}`,
      bankVerification: bankVerificationResponse,
      before: beforeSnapshot,
      after: formatPixMonitorOrder(afterOrder, eventsMap),
      event: afterEvent,
    });
  }));
  app.post('/api/admin/pdv/retry-notifications', route(async (_req, res) => { await service.retryMessages(); res.json({ success: true }); }));
  app.get('/api/admin/pdv/pending-deliveries', route(async (_req, res) => res.json(await store.list('pdv_outbox', 'status', 'PENDING'))));
  // A scheduler can call this protected endpoint when Cloud Run scales to zero.
  app.post('/internal/pdv/retry-notifications', async (req, res) => {
    const workerSecret = process.env.PDV_WORKER_SECRET || process.env.TASK_SECRET;
    if (!secureEqual(req.headers.authorization, workerSecret ? `Bearer ${workerSecret}` : '')) { return res.sendStatus(401); }
    try { await service.retryMessages(); res.sendStatus(200); } catch { res.sendStatus(503); }
  });
  if (process.env.NODE_ENV !== 'test') {
    const timer = setInterval(() => {
      if (!store.isAvailable()) return;
      Promise.all([service.retryMessages(), service.expirePixOrders()]).catch((error) => {
        if (store.repository?._firestoreClientDisabled) return;
        Logger.error('Fila PDV pendente', error, { source: 'WORKER' });
      });
    }, 15000);
    timer.unref();
  }
  app.locals.pdv = { service, store };
  require('./whatsapp-admin.routes').installWhatsappAdminRoutes(app, { whatsapp, store });
  return { service, store };
}
module.exports = { installPdvRoutes, requireStaff, requireCashier, businessDate, reportRange, paymentTotals };
