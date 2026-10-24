const { activeSession } = require('./cashier-sessions');
const { runTransaction } = require('../database/transactions');
const { commercialLine } = require('../catalog/commercial-product');
const { prepareStockReservation, applyStockReservation } = require('./stock-reservation');
const { createHash } = require('node:crypto');
const { normalizeText } = require('../shared/string.util');

const COMMERCIAL_SOURCES = new Set(['PDV', 'WEB_CATALOG', 'WHATSAPP_BOT']);
const conflict = message => Object.assign(new Error(message), { status: 409 });

/** Shared creation boundary. Channel adapters own policy; this owns identity, snapshots and reservation. */
async function createCommercialOrder(repo, order, { reserveInventory = true, receipt = true, conversationDraft = null } = {}) {
  if (!order.id || String(order.id).includes('/')) throw new Error('Identificador do pedido inválido.');
  if (order.source === 'WHATSAPP_BOT' && !/^\d{10,15}$/.test(String(order.customerPhone || ''))) throw new Error('Cliente WhatsApp inválido.');
  if (!order.requestHash && !order.idempotencyFingerprint) {
    order = { ...order, idempotencyFingerprint: createHash('sha256').update(JSON.stringify({
      source: order.source, items: order.items, total: order.total, customerPhone: order.customerPhone,
      paymentMethod: order.paymentMethod, customerId: order.customerId,
    })).digest('hex') };
  }
  return runTransaction(repo, async tx => {
    await require('../services/automation-send-guard').assertTransactionAutomation(tx);
    const previous = await tx.get('orders', order.id);
    if (previous) {
      const key = order.requestHash ? 'requestHash' : 'idempotencyFingerprint';
      if (!order[key] || previous[key] !== order[key] || previous.source !== order.source ||
          (order.createdBy?.id && order.createdBy.id !== previous.createdBy?.id)) {
        throw conflict('Identificador já utilizado por outra venda.');
      }
      return previous;
    }
    const session = conversationDraft ? await tx.get('sessions', conversationDraft.phone) : null;
    if (conversationDraft && (conversationDraft.phone !== order.customerPhone ||
        session?.orderDraft?.commercialOrderId !== order.id || session.orderDraft.version !== conversationDraft.version ||
        session.orderDraft.status !== 'AWAITING_CONFIRMATION')) throw conflict('A sacola mudou. Revise os itens antes de confirmar.');
    if (!Array.isArray(order.items) || !order.items.length || order.items.length > 150) throw new Error('Itens do pedido inválidos.');
    const records = new Map();
    for (const item of order.items) {
      const id = String(item.productId || item.id || '');
      if (!id || id.includes('/')) throw new Error('Produto sem identificador válido.');
      if (!records.has(id)) {
        const product = await tx.get('products', id);
        if (!product) throw new Error(`Produto não encontrado: ${id}.`);
        records.set(id, product);
      }
      const current = commercialLine({ ...records.get(id), id }, item.quantity);
      if (current.price !== Number(item.price) || current.unit !== (item.unit || current.unit) || current.name !== item.name) {
        throw conflict('O produto ou preço mudou. Confira o pedido antes de confirmar novamente.');
      }
    }
    const customerProfile = order.source === 'WHATSAPP_BOT' ? await tx.get('customers', order.customerPhone) : null;
    const { customerKeyFor, scopedId } = require('../agent/agent-store');
    const conversationId = order.source === 'WHATSAPP_BOT' ? scopedId('conflora', customerKeyFor('conflora', order.customerPhone)) : null;
    const conversation = conversationId ? await tx.get('agent_conversations', conversationId) : null;
    if (conversation?.automation === 'paused' || conversation?.assignedTo) throw require('../services/automation-send-guard').blocked();
    const reservation = reserveInventory ? await prepareStockReservation(tx, order.items, records) : null;
    const cashier = order.source === 'PDV' ? await activeSession(tx, order.createdBy) : null;
    const bindPix = cashier && order.pixData?.txid;
    const saved = { ...order, ...(conversationId ? { conversationId } : {}), ...(bindPix ? { cashierSessionId: cashier.id } : {}), ...(reservation ? { inventoryReserved: !reservation.trackingDisabled, reservedItems: reservation.reservedItems } : {}) };
    if (bindPix) tx.set('cashier_sessions', cashier.id, { ...cashier, pendingOrders: [...cashier.pendingOrders, order.id] });
    // All reads precede all writes, including the notification intent.
    if (reservation) applyStockReservation(tx, reservation, order.updatedAt || order.createdAt || new Date().toISOString());
    tx.set('orders', saved.id, saved);
    if (conversationDraft) tx.set('sessions', conversationDraft.phone, { ...session, orderDraft: {
      ...session.orderDraft, status: 'ORDER_CREATED', officialOrderId: saved.id,
      version: session.orderDraft.version + 1, updatedAt: order.updatedAt,
    } });
    if (order.source === 'WHATSAPP_BOT') {
      tx.set('agent_conversations', conversationId, { ...(conversation || { tenantId: 'conflora', customerKey: customerKeyFor('conflora', order.customerPhone), automation: 'active' }),
        customerPhone: order.customerPhone, orderId: saved.id, updatedAt: order.updatedAt || new Date().toISOString() });
      const preferredItems = { ...(customerProfile?.preferredItems || {}) };
      for (const item of order.items) preferredItems[normalizeText(item.name)] = item.price;
      tx.set('customers', order.customerPhone, { ...customerProfile, id: order.customerPhone, phone: order.customerPhone,
        name: order.customerName || customerProfile?.name || '', deliveryAddress: order.deliveryAddress || customerProfile?.deliveryAddress || '',
        paymentMethod: order.paymentMethod, preferredItems, lastOrderAt: order.createdAt || new Date().toISOString() });
    }
    if (receipt) {
      const id = `${saved.id}-receipt`;
      tx.set('pdv_outbox', id, { id, orderId: saved.id, kind: 'receipt', status: 'PENDING', attempts: 0 });
    }
    const ownerId = `${saved.id}-owner-new`;
    tx.set('pdv_outbox', ownerId, { id: ownerId, orderId: saved.id, kind: 'owner-new', status: 'PENDING', attempts: 0 });
    const adminId = `${saved.id}-admin-new`;
    tx.set('pdv_outbox', adminId, { id: adminId, orderId: saved.id, kind: 'admin-new', status: 'PENDING', attempts: 0 });
    return saved;
  });
}

module.exports = { createCommercialOrder, COMMERCIAL_SOURCES };
