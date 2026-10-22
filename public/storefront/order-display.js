/* One safe, structured receipt and one set of labels for storefront and PDV. */
(() => {
  const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const payment = method => ({ PIX: 'PIX', PIX_MANUAL: 'PIX', CASH: 'Dinheiro', DINHEIRO: 'Dinheiro', CREDITO: 'Cartão de crédito', CARTAO_CREDITO: 'Cartão de crédito', CARD: 'Cartão de crédito', CARTAO: 'Cartão de crédito', DEBITO: 'Cartão de débito', CARTAO_DEBITO: 'Cartão de débito', FIADO: 'Fiado', MISTO: 'Pagamento dividido', SALDO_CLIENTE: 'Crédito do cliente' }[String(method || '').trim().toUpperCase()] || 'Pagamento a combinar');
  function status(order) {
    if (order.status === 'CANCELLED') return 'Cancelado';
    if (order.status === 'AWAITING_RECONCILIATION') return 'Saldo Pix: aguardando conferência do caixa';
    if (order.status === 'AWAITING_QUOTE') return 'Aguardando cotação';
    if (order.status === 'AWAITING_QUOTE_ACCEPTANCE') return 'Aguardando aceite da cotação';
    if (order.status === 'AWAITING_ARRIVAL') return 'Aguardando chegada';
    if (order.status === 'AWAITING_FULFILLMENT') return 'Disponível: escolha entrega ou retirada';
    if (order.procurement && order.deliveryStatus === 'PENDING_DELIVERY') return 'Aguardando entregador';
    if (order.creditApprovalStatus === 'PENDING') return 'Fiado: aguardando aprovação do Admin';
    if (order.deliveryStatus === 'DELIVERED') return 'Entregue';
    if (order.paymentStatus === 'ON_ACCOUNT') return 'Fiado aprovado';
    if (order.paidAt || order.paymentStatus === 'APPROVED') return 'Pagamento confirmado';
    if (['CREATING_PIX', 'AWAITING_PIX'].includes(order.status)) return 'Aguardando pagamento Pix';
    if (order.status === 'AWAITING_CONFIRMATION') return 'Aguardando confirmação';
    return 'Aguardando pagamento';
  }
  const node = (tag, text, className) => { const value = document.createElement(tag); if (text !== undefined) value.textContent = text; if (className) value.className = className; return value; };
  function renderText(text) {
    const section = node('div', undefined, 'receipt-readable-text');
    for (const line of String(text || '').split('\n')) {
      if (/^[━─\-_\s]{5,}$/.test(line)) { section.append(node('hr')); continue; }
      const paragraph = node('p');
      for (const part of line.split(/(\*[^*]+\*)/g)) paragraph.append(part.startsWith('*') && part.endsWith('*') ? node('strong', part.slice(1, -1)) : document.createTextNode(part));
      section.append(paragraph);
    }
    return section;
  }
  function renderReceipt(order = {}) {
    const section = node('section', undefined, 'cf-receipt order-receipt-text'); section.setAttribute('aria-label', 'Recibo da compra');
    const heading = node('header'); heading.append(node('small', 'CONFLORA HORTA E VIVEIRO'), node('h3', `Pedido #${order.ticketNumber || String(order.id || '').slice(-6).toUpperCase()}`), node('span', status(order), 'cf-receipt-status')); section.append(heading);
    const date = new Date(order.createdAt || '');
    if (Number.isFinite(date.getTime())) heading.append(node('p', new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date)));
    if (!order.items?.length) { section.append(renderText(order.receiptText || 'Recibo indisponível.')); return section; }
    const customer = node('div', undefined, 'cf-receipt-customer');
    customer.append(node('strong', order.customerName || order.customer?.name || 'Cliente balcão'));
    if (order.customerPhone || order.customer?.phone) customer.append(node('p', order.customerPhone || order.customer.phone));
    customer.append(node('p', order.orderType === 'DELIVERY' || order.fulfillment === 'delivery' ? `Entrega: ${order.deliveryAddress || order.address || 'Endereço informado'}` : 'Retirada'));
    if (order.deliveryLocation?.reference) customer.append(node('p', 'Referência: ' + order.deliveryLocation.reference)); section.append(customer);
    const items = node('div', undefined, 'cf-receipt-items');
    for (const item of order.items) {
      const quantity = Number(item.quantity || 0); const price = Number(item.price?.amountMinor !== undefined ? item.price.amountMinor / 100 : item.price ?? item.unitPrice ?? 0);
      const row = node('div', undefined, 'cf-receipt-item'); const copy = node('div');
      copy.append(node('strong', item.name || 'Produto'), node('small', `${quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}${item.unit === 'KG' ? ' kg' : ' ×'} · ${money(price)}${item.unit === 'KG' ? '/kg' : '/un.'}`));
      row.append(copy, node('strong', order.total === null ? 'A cotar' : money(item.subtotalMinor !== undefined ? item.subtotalMinor / 100 : item.subtotal ?? quantity * price))); items.append(row);
    }
    section.append(items);
    const total = Number(order.totalMinor !== undefined ? order.totalMinor / 100 : order.total || 0);
    const subtotal = Number(order.subtotal ?? order.items.reduce((sum, item) => sum + Number(item.price?.amountMinor !== undefined ? item.price.amountMinor / 100 : item.price || 0) * Number(item.quantity || 0), 0));
    const totals = node('div', undefined, 'cf-receipt-totals');
    const addTotal = (title, value, className) => { const row = node('div', undefined, className); row.append(node('span', title), node('strong', value === null ? 'A confirmar' : money(value))); totals.append(row); };
    addTotal('Subtotal', order.total === null ? null : subtotal);
    if (Number(order.discountAmount || order.discount)) addTotal('Desconto', -Number(order.discountAmount || order.discount));
    if (Number(order.freightValue)) addTotal('Entrega', order.freightValue);
    addTotal('Total', order.total === null ? null : total, 'cf-receipt-grand-total'); section.append(totals);
    if (order.procurement) {
      addTotal('Sinal recebido', (order.procurement.deposit?.amountMinor || 0) / 100);
      addTotal(order.completedAt ? 'Saldo recebido na conclusão' : 'Saldo a pagar', (Math.round(total * 100) - (order.procurement.deposit?.amountMinor || 0)) / 100);
    }
    const details = node('div', undefined, 'cf-receipt-details');
    details.append(node('p', payment(order.paymentMethod)));
    for (const part of order.paymentParts?.length > 1 ? order.paymentParts : []) details.append(node('p', `${payment(part.method)}: ${money(part.amount)}`));
    const cash = Number(order.cashReceived ?? order.cashTendered ?? 0);
    if (cash > 0) details.append(node('p', `Dinheiro informado: ${money(cash)} · Troco: ${money(order.changeGiven ?? order.changeDue ?? Math.max(0, cash - total))}`));
    if (order.notes) details.append(node('p', 'Observações: ' + order.notes));
    if (order.createdBy?.name || order.sellerName) details.append(node('small', 'Venda: ' + (order.createdBy?.name || order.sellerName)));
    if (order.receivedBy?.name) details.append(node('small', 'Recebimento: ' + order.receivedBy.name));
    if (order.paidAt && Number.isFinite(Date.parse(order.paidAt))) details.append(node('small', 'Pago em: ' + new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(order.paidAt))));
    if (order.collectedBy?.name) details.append(node('small', 'Recebido na entrega por: ' + order.collectedBy.name));
    if (order.deliveredBy?.name) details.append(node('small', 'Entregue por: ' + order.deliveredBy.name));
    section.append(details); return section;
  }
  const customerPaymentMethods = enabled => {
    const available = new Set((enabled || []).flatMap(method => {
      const code = String(method || '').trim().toUpperCase();
      if (code === 'CARD' || code === 'CARTAO') return ['CREDITO', 'DEBITO'];
      if (code === 'DINHEIRO') return ['CASH'];
      if (code === 'CARTAO_CREDITO') return ['CREDITO'];
      if (code === 'CARTAO_DEBITO') return ['DEBITO'];
      return [code];
    }));
    available.delete('FIADO');
    return ['PIX', 'CASH', 'CREDITO', 'DEBITO'].filter(method => available.has(method));
  };
  window.ConfloraOrderDisplay = { money, payment, customerPaymentMethods, status, renderReceipt, renderText };
})();
