/* One safe, structured receipt and one set of labels for storefront and PDV. */
(() => {
  const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const payment = method => ({ PIX: "PIX", PIX_MANUAL: "PIX", CASH: 'cart_cash_option'.tr, DINHEIRO: 'cart_cash_option'.tr, CREDITO: 'cart_card_option'.tr, CARTAO_CREDITO: 'cart_card_option'.tr, CARD: 'cart_card_option'.tr, CARTAO: 'cart_card_option'.tr, DEBITO: 'cart_debit_option'.tr, CARTAO_DEBITO: 'cart_debit_option'.tr, FIADO: 'cart_fiado_option'.tr, MISTO: 'split_payment'.tr, SALDO_CLIENTE: 'customer_credit'.tr }[String(method || '').trim().toUpperCase()] || 'payment_to_be_arranged'.tr);
  function status(order) {
    if (order.status === 'CANCELLED') return 'Cancelado';
    if (order.status === 'AWAITING_RECONCILIATION') return 'pix_balance_awaiting_cashier_review'.tr;
    if (order.status === 'AWAITING_QUOTE') return 'awaiting_quote'.tr;
    if (order.status === 'AWAITING_QUOTE_ACCEPTANCE') return 'awaiting_quote_acceptance'.tr;
    if (order.status === 'AWAITING_ARRIVAL') return 'Aguardando chegada';
    if (order.status === 'AWAITING_FULFILLMENT') return 'available_choose_delivery_or_pickup'.tr;
    if (order.procurement && order.deliveryStatus === 'PENDING_DELIVERY') return 'Aguardando entregador';
    if (order.creditApprovalStatus === 'PENDING') return 'store_credit_waiting_for_admin_approval'.tr;
    if (order.deliveryStatus === 'DELIVERED') return 'Entregue';
    if (order.paymentStatus === 'ON_ACCOUNT') return 'Fiado aprovado';
    if (order.paidAt || order.paymentStatus === 'APPROVED') return 'payment_confirmed'.tr;
    if (['CREATING_PIX', 'AWAITING_PIX'].includes(order.status)) return 'awaiting_pix_payment'.tr;
    if (order.status === 'AWAITING_CONFIRMATION') return 'awaiting_confirmation'.tr;
    return 'awaiting_payment_d39611'.tr;
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
    const section = node('section', undefined, 'cf-receipt order-receipt-text'); section.setAttribute('aria-label', 'purchase_receipt'.tr);
    const heading = node('header'); heading.append(node('small', 'CONFLORA HORTA E VIVEIRO'), node('h3', `${'order_033893'.tr}${order.ticketNumber || String(order.id || '').slice(-6).toUpperCase()}`), node('span', status(order), 'cf-receipt-status')); section.append(heading);
    const date = new Date(order.createdAt || '');
    if (Number.isFinite(date.getTime())) heading.append(node('p', new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date)));
    if (!order.items?.length) { section.append(renderText(order.receiptText || 'receipt_unavailable'.tr)); return section; }
    const customer = node('div', undefined, 'cf-receipt-customer');
    customer.append(node('strong', order.customerName || order.customer?.name || 'walk_in_customer'.tr));
    if (order.customerPhone || order.customer?.phone) customer.append(node('p', order.customerPhone || order.customer.phone));
    customer.append(node('p', order.orderType === 'DELIVERY' || order.fulfillment === 'delivery' ? `${'delivery_cdbdf1'.tr} ${order.deliveryAddress || order.address || 'address_provided'.tr}` : 'cart_pickup_option'.tr));
    if (order.deliveryLocation?.reference) customer.append(node('p', 'Referência: ' + order.deliveryLocation.reference)); section.append(customer);
    const items = node('div', undefined, 'cf-receipt-items');
    for (const item of order.items) {
      const quantity = Number(item.quantity || 0); const price = Number(item.price?.amountMinor !== undefined ? item.price.amountMinor / 100 : item.price ?? item.unitPrice ?? 0);
      const row = node('div', undefined, 'cf-receipt-item'); const copy = node('div');
      copy.append(node('strong', item.name || 'product'.tr), node('small', `${quantity.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}${item.unit === 'KG' ? 'kg'.tr : ' ×'} · ${money(price)}${item.unit === 'KG' ? '/kg' : '/un.'}`));
      row.append(copy, node('strong', order.total === null ? 'A cotar' : money(item.subtotalMinor !== undefined ? item.subtotalMinor / 100 : item.subtotal ?? quantity * price))); items.append(row);
    }
    section.append(items);
    const total = Number(order.totalMinor !== undefined ? order.totalMinor / 100 : order.total || 0);
    const subtotal = Number(order.subtotal ?? order.items.reduce((sum, item) => sum + Number(item.price?.amountMinor !== undefined ? item.price.amountMinor / 100 : item.price || 0) * Number(item.quantity || 0), 0));
    const totals = node('div', undefined, 'cf-receipt-totals');
    const addTotal = (title, value, className) => { const row = node('div', undefined, className); row.append(node('span', title), node('strong', value === null ? 'to_be_confirmed'.tr : money(value))); totals.append(row); };
    addTotal('Subtotal', order.total === null ? null : subtotal);
    if (Number(order.discountAmount || order.discount)) addTotal('cart_discount'.tr, -Number(order.discountAmount || order.discount));
    if (Number(order.freightValue)) addTotal('cart_delivery_option'.tr, order.freightValue);
    addTotal('total'.tr, order.total === null ? null : total, 'cf_receipt_grand_total'.tr); section.append(totals);
    if (order.procurement) {
      addTotal('Sinal recebido', (order.procurement.deposit?.amountMinor || 0) / 100);
      addTotal(order.completedAt ? 'balance_received_upon_completion'.tr : 'Saldo a pagar', (Math.round(total * 100) - (order.procurement.deposit?.amountMinor || 0)) / 100);
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
    return ["PIX", 'CASH', 'CREDITO', 'DEBITO'].filter(method => available.has(method));
  };
  window.ConfloraOrderDisplay = { money, payment, customerPaymentMethods, status, renderReceipt, renderText };
})();
