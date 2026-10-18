const { createHmac, timingSafeEqual, randomUUID } = require('node:crypto');
const { partAmount } = require('./payment-parts');
const { actor } = require('./pdv.service');

function orderAccessToken(order) {
  const secret = process.env.ORDER_ACCESS_SECRET || process.env.TASK_SECRET || (process.env.NODE_ENV === 'test' ? 'isolated-test-order-access' : '');
  if (!secret) throw Object.assign(new Error('Configure ORDER_ACCESS_SECRET para acompanhar pedidos com segurança.'), { status: 503 });
  return createHmac('sha256', secret).update(`${order.id}:${order.createdAt}:${order.customerPhone}`).digest('hex');
}
function canAccessOrder(req, order) {
  if (!order || order.source !== 'WEB_CATALOG') return false;
  if (req.user && (order.customerId === req.user.id || order.customerEmail && order.customerEmail === req.user.email)) return true;
  const supplied = String(req.get('X-Order-Token') || '');
  const expected = orderAccessToken(order);
  return /^[a-f0-9]{64}$/.test(supplied) && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}
function installManualPixRoutes(app, { store, proofStorage, service }) {
  const handle = fn => async (req, res) => {
    try { await fn(req, res); } catch (error) { res.status(error.status || 400).json({ error: error.message }); }
  };
  const customerOrder = async req => {
    const order = await store.read('orders', String(req.params.id));
    if (!canAccessOrder(req, order)) throw Object.assign(new Error('Pedido não encontrado ou acesso inválido.'), { status: 404 });
    return order;
  };
  app.get('/api/storefront/orders/:id/payment', handle(async (req, res) => {
    const order = await customerOrder(req);
    res.set('Cache-Control', 'private, no-store').json({ order: { ...order, accessToken: orderAccessToken(order) } });
  }));
  app.post('/api/storefront/orders/:id/payment-proof', handle(async (req, res) => {
    const order = await customerOrder(req);
    if (order.pixMode !== 'MANUAL' || order.completedAt || order.status === 'CANCELLED') throw new Error('Este pedido não aceita comprovantes.');
    const file = await proofStorage.save(req.body?.dataUrl);
    const proof = { ...file, fileName: String(req.body.fileName || 'comprovante').replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 100), targetType: 'ORDER', targetId: order.id, uploadedBy: `customer-order:${order.id}`, uploadedByCustomer: true, createdAt: new Date().toISOString() };
    const updated = await store.transaction(async tx => {
      const current = await tx.get('orders', order.id);
      if (current.completedAt || current.status === 'CANCELLED') throw new Error('O pedido já foi encerrado.');
      const history = [...(current.paymentProofHistory || []), proof.id];
      if (history.length > 30) throw new Error('Limite de reenvios atingido. Entre em contato com a loja.');
      const next = { ...current, paymentReviewStatus: 'AWAITING_REVIEW', paymentProofId: proof.id, paymentProofHistory: history, updatedAt: proof.createdAt };
      tx.set('payment_proofs', proof.id, proof); tx.set('orders', order.id, next);
      const jobId = `${order.id}-proof-${proof.id}`;
      tx.set('pdv_outbox', jobId, { id: jobId, orderId: order.id, kind: 'proof-review', status: 'PENDING', attempts: 0 });
      return next;
    });
    res.status(201).json({ success: true, reviewStatus: updated.paymentReviewStatus, proofId: proof.id });
  }));
  app.get('/api/caixa/manual-pix', handle(async (req, res) => {
    if (!['ADMIN', 'CAIXA'].includes(req.user?.role)) return res.sendStatus(403);
    const orders = await store.list('orders', 'pixMode', 'MANUAL');
    res.json({ orders: orders.filter(order => !order.completedAt && order.status !== 'CANCELLED').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))) });
  }));
  app.post('/api/caixa/orders/:id/review-proof', handle(async (req, res) => {
    if (!['ADMIN', 'CAIXA'].includes(req.user?.role)) return res.sendStatus(403);
    const order = await store.read('orders', req.params.id);
    if (!order || order.pixMode !== 'MANUAL' || !order.paymentProofId) throw new Error('Comprovante não encontrado.');
    if (req.body.proofId !== order.paymentProofId) throw Object.assign(new Error('O comprovante mudou. Atualize a comanda.'), { status: 409 });
    const note = String(req.body.note || '').trim().slice(0, 500);
    if (note.length < 8) throw new Error('Informe o motivo ou observação (mínimo 8 caracteres).');
    if (req.body.decision === 'APPROVE') {
      if (req.body.bankReceived !== true) throw new Error('Confira o recebimento na conta bancária antes de aprovar.');
      const verification = { verifiedVia: 'MANUAL_CAIXA_PIX', amountMinor: Math.round(partAmount(order, 'PIX') * 100), manualPixProofSeen: true, manualPixProofId: order.paymentProofId, manualPixNote: note, endToEndId: String(req.body.transactionId || '').slice(0, 80) };
      const saved = await store.receive(order.id, actor(req.user), verification);
      await service.queueOperationalNotifications(saved);
      for (const id of await store.ensurePaymentNotifications(order.id)) await service.deliver(id);
      return res.json({ success: true, order: saved });
    }
    if (req.body.decision !== 'REJECT') throw new Error('Decisão inválida.');
    const updated = await store.transaction(async tx => {
      const current = await tx.get('orders', order.id);
      const proof = await tx.get('payment_proofs', order.paymentProofId);
      if (current.completedAt || current.status === 'CANCELLED' || current.paymentProofId !== order.paymentProofId) throw new Error('O pedido mudou. Atualize a comanda.');
      const now = new Date().toISOString();
      const review = { id: randomUUID(), decision: 'REJECT', proofId: proof.id, note, actor: actor(req.user), createdAt: now };
      tx.set('payment_proofs', proof.id, { ...proof, rejectedAt: now, rejectionReason: note });
      const next = { ...current, paymentReviewStatus: 'REJECTED', paymentReviewNote: note, paymentReviews: [...(current.paymentReviews || []), review] };
      tx.set('orders', order.id, next);
      tx.set('pdv_outbox', review.id, { id: review.id, orderId: order.id, kind: 'proof-rejected', status: 'PENDING', attempts: 0 });
      return next;
    });
    res.json({ success: true, order: updated });
  }));
}
module.exports = { installManualPixRoutes, orderAccessToken, canAccessOrder };
