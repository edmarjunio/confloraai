const { timingSafeEqual, randomUUID } = require('node:crypto');
const { PdvRepository } = require('../orders/pdv.repository');
const { PdvService, actor, requestId, normalizePhone } = require('../orders/pdv.service');
const { formatOrderReceipt } = require('../orders/receipt.util');
const Logger = require('../shared/logger');
const { setInterval, clearInterval } = require('node:timers');
const { normalizePaymentParts, partAmount } = require('../orders/payment-parts');

function secureEqual(left, right) {
  const a = Buffer.from(left || ''); const b = Buffer.from(right || '');
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
function requireStaff(req, res, next) {
  if (!req.user) { return res.status(401).json({ error: 'Entre na sua conta para acessar o PDV.' }); }
  if (!['ADMIN', 'CAIXA', 'VENDEDOR'].includes(req.user.role)) { return res.status(403).json({ error: 'Perfil sem acesso ao PDV.' }); }
  next();
}
function requireCashier(req, res, next) {
  if (!['ADMIN', 'CAIXA'].includes(req.user?.role)) { return res.status(403).json({ error: 'Somente o caixa pode receber valores.' }); }
  next();
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
    const row = totals[settlement.paymentMethod];
    if (!row) { continue; }
    row.debt += Number(settlement.amount || 0);
    row.debtCount += 1;
  }
  for (const row of Object.values(totals)) { row.total = row.sales + row.debt; }
  return totals;
}

function installPdvRoutes(app, { repository, pix, whatsapp, ownerPhone, taskQueueClient }) {
  const store = new PdvRepository(repository);
  const service = new PdvService({ repository: store, pix, whatsapp, ownerPhone, taskQueueClient });
  const { CustomerDebtPixService } = require('../orders/customer-debt-pix.service');
  const debtPix = new CustomerDebtPixService({ store, pix, pdv: service });
  service.debtPix = debtPix;
  const route = (handler) => async (req, res) => {
    try { await handler(req, res); }
    catch (error) { Logger.warn('Operação PDV não concluída', { error: error.message }); res.status(400).json({ error: error.message }); }
  };
  const requireCustomer = (req, res, next) => req.user ? next() : res.status(401).json({ error: 'Entre na sua conta.' });
  app.post('/api/customer/debt-pix', requireCustomer, route(async (req, res) => res.json({ success: true, charge: await debtPix.create(req.body, req.user) })));
  app.get('/api/customer/debt-pix/:id', requireCustomer, route(async (req, res) => res.json({ success: true, charge: await debtPix.read(req.params.id, req.user) })));
  app.use('/api/caixa', requireStaff);

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
    const id = phone || randomUUID();
    if (email) {
      const matches = await repository.findCustomerProfilesByEmail(email);
      if (matches.some((profile) => String(profile.id) !== id)) { throw new Error('Este e-mail já está vinculado a outro cadastro de cliente.'); }
    }
    const customer = await store.transaction(async (tx) => {
      const previous = await tx.get('customers', id);
      const nameSearch = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const saved = { ...previous, id, name, nameSearch, phone, phoneDigits: phone, email, cpfCnpj: String(req.body.cpfCnpj || '').slice(0, 30), address: String(req.body.address || '').slice(0, 250), notes: String(req.body.notes || '').slice(0, 250), updatedAt: new Date().toISOString() };
      tx.set('customers', id, saved);
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
      const visibleOrders = orders.filter((order) => order.source === 'PDV' || order.source === 'WEB_CATALOG');
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
  app.get('/api/caixa/orders', route(async (req, res) => {
    const orders = (await repository.getAllOrders(10000)).filter((order) => ['PDV', 'WEB_CATALOG'].includes(order.source));
    const range = reportRange(req.query);
    const isAdmin = req.user.role === 'ADMIN';
    const canViewPersonalOrder = (order) => isAdmin || order.createdBy?.id === req.user.id || order.receivedBy?.id === req.user.id;
    const canViewOpenOrder = (order) => canViewPersonalOrder(order) || (req.user.role === 'CAIXA' && !order.completedAt && order.status !== 'CANCELLED');
    const openOrders = orders.filter((order) => !order.completedAt && order.status !== 'CANCELLED' &&
      canViewOpenOrder(order));
    const pendingConfirmation = openOrders.filter((order) => order.status === 'AWAITING_CASHIER' || (order.status === 'PENDING' && order.paymentMethod !== 'PIX'));
    const pendingPayment = openOrders.filter((order) => ['CREATING_PIX', 'AWAITING_PIX'].includes(order.status) || (order.status === 'PENDING' && order.paymentMethod === 'PIX'));
    const history = orders.filter((order) => canViewPersonalOrder(order) && isWithinRange(order.paidAt || order.completedAt || order.createdAt, range));
    const completed = history.filter((order) => order.completedAt && order.status !== 'CANCELLED');
    const confirmed = completed.filter((order) => order.paymentStatus === 'ON_ACCOUNT');
    const paid = completed.filter((order) => order.paymentStatus === 'APPROVED' && (order.paidAt || order.completedAt));
    const settlementGroups = await Promise.all([
      store.list('debt_settlements', 'type', 'QUITACAO_FIADO'),
      store.list('debt_settlements', 'type', 'CREDITO_CLIENTE'),
    ]);
    const allSettlements = [...new Map(settlementGroups.flat().map((row) => [row.id, row])).values()];
    const debtHistory = allSettlements.filter((row) => ['QUITACAO_FIADO', 'CREDITO_CLIENTE'].includes(row.entryType || row.type || 'QUITACAO_FIADO') && (isAdmin || row.receivedBy?.id === req.user.id) && isWithinRange(row.createdAt, range));
    const mySales = completed.filter((order) => order.createdBy?.id === req.user.id);
    const myReceipts = completed.filter((order) => order.receivedBy?.id === req.user.id);
    const myDebtReceipts = debtHistory.filter((row) => row.receivedBy?.id === req.user.id);
    const receivedOrders = completed.filter((order) => order.paymentStatus === 'APPROVED' || order.paymentParts?.some((part) => ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO'].includes(part.method)));
    const closingOrders = isAdmin ? receivedOrders : receivedOrders.filter((order) => order.receivedBy?.id === req.user.id);
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
      confirmedDebt: (isAdmin ? confirmed : confirmed.filter((order) => order.createdBy?.id === req.user.id || order.receivedBy?.id === req.user.id)).reduce((sum, order) => sum + partAmount(order, 'FIADO'), 0),
      byPayment,
    };
    res.json({
      range,
      pendingConfirmation,
      pendingPayment,
      confirmed,
      paid,
      history: history.sort((a, b) => String(b.paidAt || b.completedAt || b.createdAt).localeCompare(String(a.paidAt || a.completedAt || a.createdAt))),
      debtHistory: debtHistory.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))),
      metrics: {
        sales: sum(mySales, 'total'),
        receipts: receivedTotal(myReceipts),
        debtReceipts: sum(myDebtReceipts, 'amount'),
        orderCount: mySales.length,
      },
      closing,
    });
  }));
  const findOrder = async (req) => {
    const order = await store.read('orders', req.params.id);
    const canViewOrder = order && (
      req.user.role === 'ADMIN' || order.createdBy?.id === req.user.id || order.receivedBy?.id === req.user.id ||
      (req.user.role === 'CAIXA' && !order.completedAt && order.status !== 'CANCELLED')
    );
    if (!order || !['PDV', 'WEB_CATALOG'].includes(order.source) || !canViewOrder) { throw new Error('Comanda não encontrada para este usuário.'); }
    return order;
  };
  app.get('/api/caixa/orders/:id', route(async (req, res) => res.json(await findOrder(req))));
  app.post('/api/caixa/orders/:id/confirm', requireCashier, route(async (req, res) => {
    const existing = await findOrder(req);
    const parts = normalizePaymentParts(req.body.paymentParts, req.body.paymentMethod || existing.paymentMethod, existing.total);
    if (existing.source !== 'PDV' && parts.length > 1) throw new Error('Divida o pagamento pelo PDV para preservar as parcelas da comanda.');
    const paymentMethod = parts.some((part) => part.method === 'PIX') ? 'PIX' : parts.length > 1 ? 'MISTO' : parts[0].method;
    if (paymentMethod === 'PIX') {
      if (existing.source === 'WEB_CATALOG' && ['CREATING_PIX', 'AWAITING_PIX'].includes(existing.status)) {
        throw new Error('A cobrança Pix já foi emitida. Confirme pelo Sicredi ou use a confirmação manual após conferir o comprovante.');
      }
      const order = await service.requestPixAtCashier(existing.id, req.user, parts);
      return res.status(202).json({ success: true, awaitingPayment: true, order, receiptText: formatOrderReceipt(order) });
    }
    const receivedAmount = req.body.receivedAmount === null || req.body.receivedAmount === undefined || req.body.receivedAmount === ''
      ? null : Number(req.body.receivedAmount);
    const order = existing.source === 'PDV'
      ? await store.receive(existing.id, actor(req.user), null, receivedAmount, paymentMethod, { sendFinalReceipt: true, requestedParts: parts })
      : await repository.confirmOrderPayment(existing.id, {
        verifiedVia: 'CAIXA_MANUAL', receivedBy: actor(req.user), paymentMethod,
        receivedAmount: paymentMethod === 'DINHEIRO' ? (receivedAmount ?? Number(existing.total || 0)) : receivedAmount,
        changeGiven: receivedAmount === null ? 0 : Math.max(0, receivedAmount - Number(existing.total || 0)),
      });
    if (existing.source === 'WEB_CATALOG') {
      await store.transaction(async (tx) => {
        const jobId = `${existing.id}-final-receipt`;
        tx.set('pdv_outbox', jobId, { id: jobId, orderId: existing.id, kind: 'customer-paid', status: 'PENDING', attempts: 0 });
      });
    }
    await service.deliver(`${order.id}-final-receipt`);
    const delivery = await store.read('pdv_outbox', `${order.id}-final-receipt`);
    res.json({ success: true, order, receiptText: formatOrderReceipt(order), receiptDelivery: { sent: delivery?.status === 'SENT' && Boolean(order.customerPhone), reason: delivery?.lastError || (order.customerPhone ? '' : 'Sem WhatsApp informado.') } });
  }));
  app.post('/api/caixa/orders/:id/confirm-manual-pix', requireCashier, route(async (req, res) => {
    const existing = await findOrder(req);
    if (existing.paymentMethod !== 'PIX' || !['CREATING_PIX', 'AWAITING_PIX'].includes(existing.status)) { throw new Error('Este pedido não está aguardando confirmação Pix.'); }
    if (Number.isFinite(Date.parse(existing.pixExpiresAt || '')) && Date.parse(existing.pixExpiresAt) <= Date.now()) {
      await service.expirePixOrder(existing.id);
      throw new Error('Esta cobrança Pix venceu e o estoque está sendo liberado. Confira o histórico do pedido.');
    }
    if (req.body?.proofSeen !== true) { throw new Error('Confirme que conferiu o comprovante Pix antes de finalizar.'); }
    const note = String(req.body?.note || '').trim();
    if (note.length < 8) { throw new Error('Registre uma observação sobre o comprovante (mínimo 8 caracteres).'); }
    const receiver = actor(req.user);
    const verification = {
      verifiedVia: 'MANUAL_CAIXA_PIX',
      txid: existing.pixData?.txid,
      amountMinor: Math.round(Number(existing.total) * 100),
      endToEndId: String(req.body?.endToEndId || '').trim().slice(0, 80),
      manualPixProofSeen: true,
      manualPixNote: note,
    };
    const order = existing.source === 'PDV'
      ? await store.receive(existing.id, receiver, verification)
      : await repository.confirmOrderPayment(existing.id, {
        verifiedVia: 'MANUAL_CAIXA_PIX',
        paymentTransactionId: verification.endToEndId || `MANUAL-${existing.id}`,
        paymentAmount: Number(existing.total), pixTxid: verification.txid,
        receivedBy: receiver, manualPixProofSeen: true, manualPixNote: note,
      });
    for (const kind of ['customer-paid', 'owner-paid']) {
      await store.transaction(async (tx) => {
        const id = `${order.id}-${kind}`;
        tx.set('pdv_outbox', id, { id, kind, orderId: order.id, status: 'PENDING', attempts: 0 });
      });
      await service.deliver(`${order.id}-${kind}`);
    }
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
    if (order.paymentMethod === 'PIX') { return res.status(409).json({ error: 'Cobranças Pix exigem cancelamento e conciliação no Sicredi.' }); }
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
      if (order.paymentMethod !== 'PIX') return res.sendStatus(200);
      if (Date.parse(order.pixExpiresAt || '') > Date.now()) return res.sendStatus(503);
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
    if (!Number.isFinite(amount) || amount <= 0 || !['DINHEIRO', 'DEBITO', 'CREDITO'].includes(paymentMethod)) { throw new Error('Use dinheiro, débito ou crédito para receber o pagamento no caixa.'); }
    const customerKey = String(req.body.customerKey || '');
    if (!customerKey || customerKey.includes('/')) { throw new Error('Selecione o cliente cadastrado.'); }
    const entryType = String(req.body.entryType || 'QUITACAO_FIADO').toUpperCase();
    if (!['QUITACAO_FIADO', 'CREDITO_CLIENTE'].includes(entryType)) { throw new Error('Tipo de recebimento inválido.'); }
    const result = await store.settle({ id: requestId(req.body.requestId), customerKey, amount: Math.round(amount * 100) / 100, paymentMethod, notes: String(req.body.notes || '').slice(0, 500), receivedBy: actor(req.user), entryType });
    await service.deliver(result.id);
    res.json({ success: true, ...result });
  }));

  app.post(['/webhooks/sicredi-pix', '/webhooks/sicredi-pix/pix', '/api/webhooks/sicredi-pix', '/api/webhooks/sicredi-pix/pix', '/webhooks/sicredi-pix/:secret', '/webhooks/sicredi-pix/:secret/pix'], async (req, res) => {
    // Gateway must validate the Sicredi client certificate and replace this header.
    const gatewayVerified = secureEqual(req.headers['x-sicredi-gateway-secret'], process.env.SICREDI_WEBHOOK_GATEWAY_SECRET);
    const certificate = req.socket.getPeerCertificate?.();
    const directlyVerified = req.socket.authorized && secureEqual(certificate?.fingerprint256, process.env.SICREDI_WEBHOOK_CERT_FINGERPRINT);
    const webhookSecret = process.env.SICREDI_WEBHOOK_SECRET || '';
    const secretRouteVerified = webhookSecret.length >= 32 && secureEqual(req.params.secret, webhookSecret);
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
  app.post('/api/admin/pdv/retry-notifications', route(async (_req, res) => { await service.retryMessages(); res.json({ success: true }); }));
  app.get('/api/admin/pdv/pending-deliveries', route(async (_req, res) => res.json(await store.list('pdv_outbox', 'status', 'PENDING'))));
  // A scheduler can call this protected endpoint when Cloud Run scales to zero.
  app.post('/internal/pdv/retry-notifications', async (req, res) => {
    if (!secureEqual(req.headers.authorization, process.env.PDV_WORKER_SECRET ? `Bearer ${process.env.PDV_WORKER_SECRET}` : '')) { return res.sendStatus(401); }
    try { await service.retryMessages(); res.sendStatus(200); } catch { res.sendStatus(503); }
  });
  if (process.env.NODE_ENV !== 'test') {
    const timer = setInterval(() => Promise.all([service.retryMessages(), service.expirePixOrders()]).catch((error) => Logger.warn('Fila PDV pendente', { error: error.message })), 15000);
    timer.unref();
  }
  app.locals.pdv = { service, store };
  return { service, store };
}
module.exports = { installPdvRoutes, requireStaff, requireCashier, businessDate, reportRange, paymentTotals };
