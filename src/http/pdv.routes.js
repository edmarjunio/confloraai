const { timingSafeEqual, randomUUID } = require('node:crypto');
const { PdvRepository } = require('../orders/pdv.repository');
const { PdvService, actor, requestId, normalizePhone } = require('../orders/pdv.service');
const { formatOrderReceipt } = require('../orders/receipt.util');
const { isPixOrderExpired } = require('../orders/pix-expiration');
const Logger = require('../shared/logger');
const { setInterval } = require('node:timers');

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
    const row = totals[order.paymentMethod];
    if (!row) { continue; }
    row.sales += Number(order.total || 0);
    row.count += 1;
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

function installPdvRoutes(app, { repository, pix, whatsapp, taskQueueClient = null, ownerPhone }) {
  const store = new PdvRepository(repository);
  const service = new PdvService({ repository: store, pix, whatsapp, taskQueueClient, ownerPhone });
  const route = (handler) => async (req, res) => {
    try { await handler(req, res); }
    catch (error) { Logger.warn('Operação PDV não concluída', { error: error.message }); res.status(400).json({ error: error.message }); }
  };
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
  app.get('/api/caixa/discount-approvals/:id', route(async (req, res) => {
    const approval = await store.read('discount_approvals', req.params.id);
    if (!approval || (req.user.role !== 'ADMIN' && approval.requestedBy !== req.user.id)) { return res.sendStatus(404); }
    res.json(approval);
  }));
  app.get('/api/caixa/orders', route(async (req, res) => {
    const [pdvOrders, onlineOrders] = await Promise.all([
      store.list('orders', 'source', 'PDV'),
      store.list('orders', 'source', 'WEB_CATALOG'),
    ]);
    const orders = [...new Map([...pdvOrders, ...onlineOrders].map((order) => [order.id, order])).values()];
    const range = reportRange(req.query);
    const isAdmin = req.user.role === 'ADMIN';
    const canViewPersonalOrder = (order) => isAdmin || order.createdBy?.id === req.user.id || order.receivedBy?.id === req.user.id;
    const canViewOpenOrder = (order) => canViewPersonalOrder(order) || (req.user.role === 'CAIXA' && !order.completedAt && order.status !== 'CANCELLED');
    const openOrders = orders.filter((order) => !order.completedAt && order.status !== 'CANCELLED' &&
      canViewOpenOrder(order));
    const pendingConfirmation = openOrders.filter((order) => order.paymentMethod !== 'PIX'
      && ['AWAITING_CASHIER', 'PENDING'].includes(order.status));
    const pendingPayment = openOrders.filter((order) => order.paymentMethod === 'PIX'
      && ['CREATING_PIX', 'AWAITING_PIX', 'PENDING'].includes(order.status));
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
    const myReceipts = paid.filter((order) => order.receivedBy?.id === req.user.id);
    const myDebtReceipts = debtHistory.filter((row) => row.receivedBy?.id === req.user.id);
    const closingOrders = isAdmin ? paid : paid.filter((order) => order.receivedBy?.id === req.user.id);
    const closingSettlements = isAdmin ? debtHistory : myDebtReceipts;
    const byPayment = paymentTotals(closingOrders, closingSettlements);
    const sum = (rows, field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
    const cashReceivedOrders = closingOrders.filter((order) => order.paymentMethod !== 'SALDO_CLIENTE');
    const creditUsedOrders = closingOrders.filter((order) => order.paymentMethod === 'SALDO_CLIENTE');
    const closing = {
      orderCount: closingOrders.length,
      debtSettlementCount: closingSettlements.length,
      salesReceived: sum(cashReceivedOrders, 'total'),
      customerCreditUsed: sum(creditUsedOrders, 'total'),
      debtReceived: sum(closingSettlements, 'amount'),
      totalReceived: sum(cashReceivedOrders, 'total') + sum(closingSettlements, 'amount'),
      confirmedDebt: sum(isAdmin ? confirmed : confirmed.filter((order) => order.createdBy?.id === req.user.id || order.receivedBy?.id === req.user.id), 'total'),
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
        receipts: sum(myReceipts, 'total'),
        debtReceipts: sum(myDebtReceipts, 'amount'),
        orderCount: mySales.length,
      },
      closing,
    });
  }));
  app.get('/api/caixa/orders/stream', (req, res) => {
    res.status(200);
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    let closed = false;
    let isInitialSnapshot = true;
    let fallbackTimer = null;
    let heartbeat = null;
    let unsubscribe = null;
    const writeEvent = (name, payload = {}) => {
      if (!closed) res.write(`event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    const startFallback = () => {
      if (fallbackTimer || closed) return;
      fallbackTimer = setInterval(() => writeEvent('orders-changed', { source: 'fallback' }), 2500);
    };
    writeEvent('connected', { realtime: Boolean(repository.firestore && !repository._firestoreClientDisabled) });
    heartbeat = setInterval(() => { if (!closed) res.write(': heartbeat\n\n'); }, 20000);
    unsubscribe = store.watchPendingOrderChanges((changes) => {
      if (isInitialSnapshot) { isInitialSnapshot = false; return; }
      if (changes.length) writeEvent('orders-changed', { source: 'firestore' });
    }, (error) => {
      Logger.warn('Listener de comandas indisponível; usando atualização de contingência.', { error: error.message });
      unsubscribe?.();
      unsubscribe = null;
      startFallback();
    });
    if (!unsubscribe) startFallback();
    req.on('close', () => {
      closed = true;
      unsubscribe?.();
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (heartbeat) clearInterval(heartbeat);
    });
  });
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
    const paymentMethod = String(req.body.paymentMethod || existing.paymentMethod || '').toUpperCase();
    if (existing.source === 'WEB_CATALOG') {
      if (existing.completedAt) return res.json({ success: true, order: existing, alreadyConfirmed: true });
      if (existing.status === 'CANCELLED') throw new Error('Pedido cancelado não pode ser recebido.');
      if (existing.paymentMethod === 'PIX') {
        if (req.body.manualPix !== true) throw new Error('Pix online é confirmado pelo Sicredi. Se o cliente mostrar o comprovante, use a confirmação manual auditada.');
        const proofNote = String(req.body.proofNote || '').trim().slice(0, 500);
        if (proofNote.length < 5) throw new Error('Descreva a conferência do comprovante Pix antes de confirmar.');
        const order = await repository.confirmOrderPayment(existing.id, {
          verifiedVia: 'CAIXA_PIX_MANUAL',
          paymentTransactionId: `MANUAL-${randomUUID()}`,
          paymentAmount: existing.total,
          pixTxid: existing.pixData?.txid || '',
          receivedBy: actor(req.user),
          manualProofNote: proofNote,
        });
        await store.transaction(async (tx) => {
          for (const kind of ['customer-paid', 'owner-paid']) {
            const id = `${order.id}-${kind}`;
            tx.set('pdv_outbox', id, { id, kind, orderId: order.id, status: 'PENDING', attempts: 0 });
          }
        });
        await service.deliver(`${order.id}-customer-paid`);
        await service.deliver(`${order.id}-owner-paid`);
        return res.json({ success: true, order, receiptText: formatOrderReceipt(order), manualPix: true });
      }
      const allowed = ['DINHEIRO', 'CARTAO', 'CARD', 'DEBITO', 'CREDITO'];
      if (!allowed.includes(paymentMethod)) throw new Error('Forma de recebimento não permitida para pedido online.');
      const receivedAmount = req.body.receivedAmount === null || req.body.receivedAmount === undefined || req.body.receivedAmount === ''
        ? null : Number(req.body.receivedAmount);
      const order = await repository.confirmOrderPayment(existing.id, {
        verifiedVia: 'CAIXA_MANUAL',
        paymentMethod,
        receivedBy: actor(req.user),
        receivedAmount,
      });
      await store.transaction(async (tx) => {
        const id = `${order.id}-final-receipt`;
        tx.set('pdv_outbox', id, { id, kind: 'receipt', orderId: order.id, status: 'PENDING', attempts: 0 });
      });
      await service.deliver(`${order.id}-final-receipt`);
      return res.json({ success: true, order, receiptText: formatOrderReceipt(order) });
    }
    if (paymentMethod === 'PIX') {
      if (req.body.manualPix === true) {
        const proofNote = String(req.body.proofNote || '').trim().slice(0, 500);
        if (proofNote.length < 5) throw new Error('Descreva a conferência do comprovante Pix antes de confirmar.');
        const order = await store.receive(existing.id, actor(req.user), {
          verifiedVia: 'CAIXA_PIX_MANUAL', txid: existing.pixData?.txid,
          amountMinor: Math.round(existing.total * 100), proofNote,
        }, null, null, { sendFinalReceipt: true });
        await service.deliver(`${order.id}-final-receipt`);
        return res.json({ success: true, order, receiptText: formatOrderReceipt(order), manualPix: true });
      }
      const order = await service.requestPixAtCashier(existing.id, req.user);
      return res.status(202).json({ success: true, awaitingPayment: true, order, receiptText: formatOrderReceipt(order) });
    }
    const receivedAmount = req.body.receivedAmount === null || req.body.receivedAmount === undefined || req.body.receivedAmount === ''
      ? null : Number(req.body.receivedAmount);
    const order = await store.receive(existing.id, actor(req.user), null, receivedAmount, paymentMethod, { sendFinalReceipt: true });
    await service.deliver(`${order.id}-final-receipt`);
    const delivery = await store.read('pdv_outbox', `${order.id}-final-receipt`);
    res.json({ success: true, order, receiptText: formatOrderReceipt(order), receiptDelivery: { sent: delivery?.status === 'SENT' && Boolean(order.customerPhone), reason: delivery?.lastError || (order.customerPhone ? '' : 'Sem WhatsApp informado.') } });
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
  app.post('/api/caixa/orders/:id/cancel', requireCashier, route(async (req, res) => {
    const order = await findOrder(req);
    res.json(await store.cancelOrder(req.params.id, String(req.body.reason || ''), actor(req.user)));
  }));
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
    try { await service.retryMessages(); await service.expirePixOrders(); res.sendStatus(200); } catch { res.sendStatus(503); }
  });
  app.post('/internal/pdv/expire-pix', async (req, res) => {
    if (!secureEqual(req.headers.authorization, process.env.PDV_WORKER_SECRET ? `Bearer ${process.env.PDV_WORKER_SECRET}` : '')) { return res.sendStatus(401); }
    try { await service.expirePixOrders(); res.sendStatus(200); } catch { res.sendStatus(503); }
  });
  app.post('/tasks/expire-pix', async (req, res) => {
    const taskSecret = process.env.TASK_SECRET || '';
    if (!secureEqual(req.headers['x-conflora-task-secret'], taskSecret)) return res.sendStatus(401);
    const orderId = String(req.body?.orderId || '');
    if (!orderId || orderId.includes('/')) return res.sendStatus(400);
    try {
      const order = await store.read('orders', orderId);
      if (!order || order.status === 'CANCELLED' || order.completedAt || order.paymentTransactionId) return res.sendStatus(200);
      if (order.paymentMethod !== 'PIX') return res.sendStatus(200);
      if (!isPixOrderExpired(order)) return res.sendStatus(503);
      await service.expirePixOrder(orderId);
      return res.sendStatus(200);
    } catch (error) {
      Logger.warn('Falha ao expirar pedido Pix agendado.', { orderId, error: error.message });
      return res.sendStatus(503);
    }
  });
  if (process.env.NODE_ENV !== 'test') {
    const timer = setInterval(() => Promise.all([service.retryMessages(), service.expirePixOrders()]).catch((error) => Logger.warn('Fila PDV pendente', { error: error.message })), 15000);
    timer.unref();
  }
  app.locals.pdv = { service, store };
  return { service, store };
}
module.exports = { installPdvRoutes, requireStaff, requireCashier, businessDate, reportRange, paymentTotals };
