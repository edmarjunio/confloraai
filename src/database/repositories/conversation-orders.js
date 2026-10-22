const { runTransaction } = require('../transactions');

function legacyDraft(order) {
  // Historical sales addressed by phone remain untouched and are never reopened as carts.
  return order && !order.source && !order.completedAt && !order.paidAt && !order.stockDeducted &&
    !['CONFIRMED', 'CONFIRMADO', 'PAID_CONFIRMED', 'DELIVERED', 'CANCELLED'].includes(order.status);
}

async function mutateConversationOrder(repo, phone, apply) {
  if (!/^\d{10,15}$/.test(String(phone || ''))) throw new Error('Telefone da conversa inválido.');
  return runTransaction(repo, async tx => {
    const session = await tx.get('sessions', phone) || {};
    let current = session.orderDraft;
    if (!current) {
      const old = await tx.get('orders', phone);
      current = legacyDraft(old) ? old : null;
    }
    const next = apply(structuredClone(current));
    if (!next) return current;
    const saved = { ...next, phone, draft: true, version: Number(current?.version || 0) + 1, updatedAt: new Date().toISOString() };
    tx.set('sessions', phone, { ...session, orderDraft: saved });
    return saved;
  });
}

async function getConversationOrder(repo, phone) {
  if (!phone) return null;
  return mutateConversationOrder(repo, phone, () => null);
}

module.exports = { mutateConversationOrder, getConversationOrder };
