const { timingSafeEqual, randomUUID } = require('node:crypto');
const { PdvRepository } = require('../orders/pdv.repository');
const { PdvService, actor, requestId, normalizePhone, CASH_METHODS } = require('../orders/pdv.service');
const { formatOrderReceipt } = require('../orders/receipt.util');
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

function installPdvRoutes(app, { repository, pix, whatsapp, ownerPhone }) {
  const store = new PdvRepository(repository);
  const service = new PdvService({ repository: store, pix, whatsapp, ownerPhone });
  const route = (handler) => async (req, res) => {
    try { await handler(req, res); }
    catch (error) { Logger.warn('Operação PDV não concluída', { error: error.message }); res.status(400).json({ error: error.message }); }
  };
  app.use('/api/caixa', requireStaff);

  app.post('/api/caixa/customers', route(async (req, res) => {
    const name = String(req.body.name || '').trim().slice(0, 100);
    if (!name) { throw new Error('Informe o nome do cliente.'); }
    const phone = normalizePhone(req.body.phone);
    const id = phone || randomUUID();
    const customer = await store.transaction(async (tx) => {
      const previous = await tx.get('customers', id);
      const saved = { ...previous, id, name, phone, phoneDigits: phone, cpfCnpj: String(req.body.cpfCnpj || '').slice(0, 30), address: String(req.body.address || '').slice(0, 250), notes: String(req.body.notes || '').slice(0, 250), updatedAt: new Date().toISOString() };
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
    const orders = await store.list('orders', 'source', 'PDV');
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const completedToday = orders.filter((order) => order.completedAt && new Date(order.completedAt).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === today);
    const ownSales = completedToday.filter((order) => order.createdBy.id === req.user.id);
    const ownReceipts = completedToday.filter((order) => order.receivedBy?.id === req.user.id && order.paymentStatus === 'APPROVED');
    const settlements = await store.list('debt_settlements', 'receivedBy.id', req.user.id);
    const debtReceipts = settlements.filter((row) => new Date(row.createdAt).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === today);
    const byPayment = { PIX: 0, DINHEIRO: 0, DEBITO: 0, CREDITO: 0 };
    for (const row of ownReceipts) { byPayment[row.paymentMethod] = (byPayment[row.paymentMethod] || 0) + row.total; }
    res.json({
      pendingCashier: req.user.role === 'VENDEDOR' ? orders.filter((order) => order.createdBy.id === req.user.id && order.status === 'AWAITING_CASHIER') : orders.filter((order) => order.status === 'AWAITING_CASHIER'),
      pendingPix: orders.filter((order) => ['CREATING_PIX', 'AWAITING_PIX'].includes(order.status) && (req.user.role === 'ADMIN' || order.createdBy.id === req.user.id)),
      completedToday: req.user.role === 'ADMIN' ? completedToday : completedToday.filter((order) => order.createdBy.id === req.user.id || order.receivedBy?.id === req.user.id),
      metrics: { sales: ownSales.reduce((sum, row) => sum + row.total, 0), receipts: ownReceipts.reduce((sum, row) => sum + row.total, 0), debtReceipts: debtReceipts.reduce((sum, row) => sum + row.amount, 0), totalRevenue: ownReceipts.reduce((sum, row) => sum + row.total, 0), byPayment, orderCount: ownSales.length },
    });
  }));
  const findOrder = async (req) => {
    const order = await store.read('orders', req.params.id);
    if (!order || order.source !== 'PDV' || (req.user.role === 'VENDEDOR' && order.createdBy.id !== req.user.id)) { throw new Error('Comanda não encontrada para este usuário.'); }
    return order;
  };
  app.get('/api/caixa/orders/:id', route(async (req, res) => res.json(await findOrder(req))));
  app.post('/api/caixa/orders/:id/confirm', requireCashier, route(async (req, res) => {
    const existing = await findOrder(req);
    if (existing.paymentMethod === 'PIX') { return res.status(409).json({ error: 'Pix é confirmado exclusivamente pelo webhook do Sicredi.' }); }
    const order = await store.receive(existing.id, actor(req.user), null, req.body.receivedAmount === null || req.body.receivedAmount === undefined ? null : Number(req.body.receivedAmount));
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
  app.get('/api/caixa/customers/:key/debts', requireCashier, route(async (req, res) => {
    const customer = await store.read('customers', req.params.key);
    if (!customer) { throw new Error('Cliente não cadastrado.'); }
    const debts = await store.list('customer_debts', 'customerKey', req.params.key);
    const payments = await store.list('debt_settlements', 'customerKey', req.params.key);
    res.json({ success: true, balance: Number(customer.debtBalance || 0), transactions: [...debts, ...payments] });
  }));
  app.post('/api/caixa/debts/settle', requireCashier, route(async (req, res) => {
    const amount = Number(req.body.amount);
    const paymentMethod = String(req.body.paymentMethod || '').toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0 || !CASH_METHODS.has(paymentMethod) || paymentMethod === 'FIADO') { throw new Error('Use dinheiro, débito ou crédito para quitar a dívida no caixa.'); }
    const customerKey = String(req.body.customerKey || '');
    if (!customerKey || customerKey.includes('/')) { throw new Error('Selecione o cliente cadastrado.'); }
    const result = await store.settle({ id: requestId(req.body.requestId), customerKey, amount: Math.round(amount * 100) / 100, paymentMethod, notes: String(req.body.notes || '').slice(0, 500), receivedBy: actor(req.user) });
    await service.deliver(result.id);
    res.json({ success: true, ...result });
  }));

  app.post(['/webhooks/sicredi-pix', '/webhooks/sicredi-pix/pix', '/api/webhooks/sicredi-pix', '/api/webhooks/sicredi-pix/pix'], async (req, res) => {
    // Gateway must validate the Sicredi client certificate and replace this header.
    const gatewayVerified = secureEqual(req.headers['x-sicredi-gateway-secret'], process.env.SICREDI_WEBHOOK_GATEWAY_SECRET);
    const certificate = req.socket.getPeerCertificate?.();
    const directlyVerified = req.socket.authorized && secureEqual(certificate?.fingerprint256, process.env.SICREDI_WEBHOOK_CERT_FINGERPRINT);
    if (!gatewayVerified && !directlyVerified) { return res.sendStatus(401); }
    if (!Array.isArray(req.body?.pix) || req.body.pix.length > 100) { return res.sendStatus(400); }
    try {
      for (const entry of req.body.pix) {
        const txid = String(entry.txid || '');
        if (!/^[a-zA-Z0-9]{26,35}$/.test(txid)) { return res.sendStatus(400); }
        await store.transaction(async (tx) => {
          const previous = await tx.get('pdv_pix_events', txid);
          if (!previous) { tx.set('pdv_pix_events', txid, { id: txid, status: 'PENDING', receivedAt: new Date().toISOString() }); }
        });
        await service.processPixEvent(txid);
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
    const timer = setInterval(() => service.retryMessages().catch((error) => Logger.warn('Fila WhatsApp pendente', { error: error.message })), 30000);
    timer.unref();
  }
  app.locals.pdv = { service, store };
  return { service, store };
}
module.exports = { installPdvRoutes, requireStaff, requireCashier };
