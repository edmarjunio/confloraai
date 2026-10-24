const { createHash } = require('node:crypto');
const { money } = require('./receipt.util');
const { isDelivery, isDeliverySettled } = require('./delivery-policy');
const { normalizeWhatsAppNumber } = require('../reports/daily-executive-report');

const SETTINGS_ID = 'whatsapp_notifications';
const SLOTS = ['horta', 'edmar', 'junior', 'telvia', 'rose'];
const clean = value => String(value || '').replace(/[\r\n*`_]/g, ' ').trim();
function defaults() {
  const phones = [process.env.OWNER_WHATSAPP_NUMBER, process.env.STORE_NOTIFICATION_PHONE, process.env.JUNIOR_WHATSAPP_NUMBER];
  return { version: 0, recipients: SLOTS.map((id, index) => ({ id, phone: normalizeWhatsAppNumber(phones[index]), operational: true, closing: id === 'junior', enabled: true })) };
}
async function settings(store) { return await store.read('store_settings', SETTINGS_ID) || defaults(); }
function validate(input) {
  if (!Array.isArray(input?.recipients) || input.recipients.length !== SLOTS.length) throw new Error('Informe os cinco destinatários.');
  return { recipients: SLOTS.map(id => {
    const rows = input.recipients.filter(row => row.id === id);
    if (rows.length !== 1) throw new Error('Destinatário inválido ou duplicado.');
    const row = rows[0];
    const phone = normalizeWhatsAppNumber(row.phone);
    if (String(row.phone || '').trim() && !phone) throw new Error('Informe telefone brasileiro com DDD válido.');
    return { id, phone, enabled: row.enabled === true, operational: row.operational === true, closing: row.closing === true };
  }) };
}
function targets(config, event) {
  return [...new Set(config.recipients.filter(row => row.enabled && row[event === 'closing' ? 'closing' : 'operational']).map(row => normalizeWhatsAppNumber(row.phone)).filter(Boolean))];
}
function current(event, order) {
  if (!order || order.status === 'CANCELLED' || order.status === 'REJECTED') return false;
  if (event === 'approval') return order.status === 'PENDING';
  if (event === 'confirmation') return !order.completedAt && (order.status === 'AWAITING_CONFIRMATION' || order.creditApprovalStatus === 'PENDING');
  if (event === 'confirmed') return Boolean(order.completedAt);
  if (event === 'delivery-pending') return isDelivery(order) && !order.assignedDriver?.id && ['PENDING_DELIVERY', 'PENDING_DISPATCH'].includes(order.deliveryStatus) && order.creditApprovalStatus !== 'PENDING' && (order.paymentMethod !== 'PIX' || isDeliverySettled(order));
  if (event === 'delivered') return isDelivery(order) && order.deliveryStatus === 'DELIVERED' && isDeliverySettled(order);
  return false;
}
function events(kind, order) {
  if (kind === 'owner-approval') return current('approval', order) ? ['approval'] : [];
  return ['confirmation', 'confirmed', 'delivery-pending', 'delivered'].filter(event => current(event, order));
}
function format(event, order) {
  const number = clean(order.ticketNumber || order.id).slice(0, 36);
  const headings = { approval: 'APROVAR DESCONTO', confirmation: 'CONFIRMAR VENDA', confirmed: 'VENDA CONFIRMADA · RECIBO', 'delivery-pending': 'ENTREGA SEM ENTREGADOR', delivered: 'ENTREGA FINALIZADA' };
  const lines = [`*CONFLORA · ${headings[event]}*`, `#${number} · ${clean(order.customerName || 'Cliente Balcão')}`];
  if (event === 'approval') lines.push(`Motivo: desconto acima de 5% solicita aprovação.`);
  if (event === 'confirmation') lines.push(`Motivo: ${order.creditApprovalStatus === 'PENDING' ? 'fiado aguarda aprovação' : 'venda aguarda conferência da equipe'}.`);
  if (['approval', 'confirmation', 'confirmed'].includes(event)) {
    lines.push(...(order.items || []).map(item => `${Number(item.quantity)} ${clean(item.unit || 'un.')} · ${clean(item.name)} · ${money(item.subtotalMinor !== undefined ? item.subtotalMinor / 100 : item.subtotal ?? Number(item.price) * Number(item.quantity))}`));
    const subtotal = order.subtotal ?? (order.items || []).reduce((sum, item) => sum + (item.subtotalMinor !== undefined ? Number(item.subtotalMinor) / 100 : Number(item.subtotal ?? Number(item.price) * Number(item.quantity))), 0);
    lines.push(`Produtos: ${money(subtotal)}`);
    if (Number(order.discountAmount)) lines.push(`Desconto: ${order.discountPercent}% · −${money(order.discountAmount)}`);
    if (Number(order.freightValue)) lines.push(`Entrega: ${money(order.freightValue)}`);
    lines.push(`*Total: ${money(order.total)}*`, `Vendedor: ${clean(order.createdBy?.name || order.operatorName || 'Catálogo')}`);
  } else lines.push(`*Total: ${money(order.total)}*`, `Entregador: ${clean(order.deliveredBy?.name || 'a definir')}`);
  if (event === 'confirmed' || event === 'delivered') lines.push(`Pagamento: ${clean(order.paymentMethod)} · ${order.paymentStatus === 'ON_ACCOUNT' ? 'FIADO · a receber' : 'recebido'}`);
  if (event === 'confirmed' && order.paymentStatus !== 'ON_ACCOUNT') lines.push(`Recebido por: ${clean(order.receivedBy?.name || (order.verifiedVia === 'SICREDI_PIX_WEBHOOK' ? 'Sicredi · confirmação automática' : 'Equipe'))}`);
  if (event === 'delivered') lines.push(`Entregue: ${new Date(order.deliveredAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  const action = { approval: 'Ação: aprove ou recuse em Admin → Descontos.', confirmation: 'Ação: confira em Comandas → Confirmação.', 'delivery-pending': 'Ação: atribua um responsável em Entregas.', confirmed: 'Sem ação pendente.', delivered: order.paymentStatus === 'ON_ACCOUNT' ? 'Entrega concluída; fiado permanece a receber.' : 'Entregue e recebido. Sem ação pendente.' };
  lines.push(action[event]);
  return lines.join('\n');
}
// Same durable outbox and provider checkpoints as every other PDV send.
async function expand(store, job, order) {
  const config = await settings(store);
  const selected = job.kind === 'closing' ? ['closing'] : events(job.kind, order);
  const children = selected.flatMap(event => targets(config, event).map(recipient => {
    const identity = event === 'closing' ? job.id : order.id;
    const id = `staff-${createHash('sha256').update(`${identity}:${event}:${recipient}`).digest('hex')}`;
    return { id, kind: 'staff-notification', event, recipient, ...(job.orderId ? { orderId: job.orderId } : {}), ...(job.approvalId ? { approvalId: job.approvalId } : {}), ...(event === 'closing' ? { text: job.text, closingDate: job.closingDate, closingRevision: job.closingRevision } : {}), status: 'PENDING', attempts: 0 };
  }));
  await store.transaction(async tx => {
    const previous = await Promise.all(children.map(child => tx.get('pdv_outbox', child.id)));
    children.forEach((child, index) => { if (!previous[index]) tx.set('pdv_outbox', child.id, child); });
  });
  return children.map(child => child.id);
}
module.exports = { SETTINGS_ID, SLOTS, defaults, settings, validate, targets, current, events, format, expand };
