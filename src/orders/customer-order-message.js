const amountFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const quantityFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const labels = { PIX: 'Pix', DEBITO: 'Cartão', CREDITO: 'Cartão', CARTAO: 'Cartão', CARD: 'Cartão', DINHEIRO: 'Dinheiro', CASH: 'Dinheiro', FIADO: 'Fiado', SALDO_CLIENTE: 'Saldo do cliente' };
const instructions = {
  Pix: '⏳ Aguardamos a confirmação do pagamento via Pix para finalizar seu pedido.',
  Cartão: '💳 Estamos levando a maquininha para receber seu pagamento.',
  Dinheiro: '💵 Estamos organizando o troco para levar até você.',
};

/** Initial customer-facing confirmation. Financial audit belongs to the persisted receipt. */
function formatCustomerOrderMessage(order) {
  const number = order.ticketNumber || String(order.id || '').slice(-6).toUpperCase();
  const methods = order.paymentParts?.length ? order.paymentParts.map((part) => part.method) : [order.paymentMethod || 'PIX'];
  const paymentLabels = [...new Set(methods.map((method) => labels[String(method).toUpperCase()] || String(method)))];
  const items = (order.items || []).map((item) => {
    const quantity = Number(item.quantity ?? 1);
    const unit = String(item.unit || item.saleUnit?.code || 'UN').toUpperCase();
    const subtotal = item.subtotalMinor !== null && item.subtotalMinor !== undefined ? Number(item.subtotalMinor) / 100 : Number(item.subtotal ?? Number(item.price ?? item.unitPrice ?? 0) * quantity);
    return `${quantityFormat.format(quantity)}${unit === 'KG' ? ' kg' : 'x'} ${item.name || 'Produto'} — ${amountFormat.format(subtotal).replace(/\u00a0/g, ' ')}`;
  });
  return [
    '🌿 *CONFLORA | HORTA E VIVEIRO*', '',
    `*Pedido #${number}*`, '',
    `👤 *Cliente:* ${order.customerName || order.customer?.name || 'Cliente Balcão'}`, '',
    '*🛒 Seu pedido:*', ...items, '',
    `💰 *Total: ${amountFormat.format(Number(order.total || 0)).replace(/\u00a0/g, ' ')}*`, '',
    `💳 *Pagamento: ${paymentLabels.join(' + ')}*`,
    ...paymentLabels.map((label) => instructions[label]).filter(Boolean), '',
    'Obrigado pela preferência', '🌱 *Equipe Conflora*',
  ].join('\n');
}

module.exports = { formatCustomerOrderMessage };
