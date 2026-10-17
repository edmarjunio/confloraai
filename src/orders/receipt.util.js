const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function money(value) {
  return currency.format(Number(value) || 0);
}

function formatOrderReceipt(order) {
  const orderNumber = order.ticketNumber || String(order.id || "").slice(-6).toUpperCase();
  const dateStr = order.createdAt 
    ? new Date(order.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : new Date().toLocaleString('pt-BR');

  const customerName = order.customerName || order.customer?.name || "Cliente Balcão";
  const customerPhone = order.customerPhone || order.customer?.phone || "";

  const items = (order.items || []).map((item) => {
    const quantity = Number(item.quantity) || 1;
    const unitPrice = Number(item.price) || Number(item.unitPrice) || 0;
    const unit = item.unit || "UN";
    const formattedQuantity = quantity.toLocaleString('pt-BR', { maximumFractionDigits: unit === 'KG' ? 3 : 0 });
    const subtotal = Number(item.subtotalMinor) / 100 ||
      Number(item.subtotal) ||
      unitPrice * quantity;
    return `▫️ *${formattedQuantity}${unit === 'KG' ? ' kg' : 'x'}* ${item.name || "Produto"}\n   ${money(unitPrice)} ${unit === 'KG' ? '/ kg' : 'un.'} = *${money(subtotal)}*`;
  });

  const subtotal = Number(order.subtotal) || (order.items || []).reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
  const discountAmount = Number(order.discountAmount || 0);
  const discountPercent = Number(order.discountPercent || 0);
  const freightValue = Number(order.freightValue || 0);
  const total = Number(order.total) || Math.max(0, subtotal - discountAmount + freightValue);

  const rawPaymentMethod = String(order.paymentMethod || "PIX").toUpperCase();
  let paymentLabel = rawPaymentMethod;
  if (rawPaymentMethod === 'PIX') paymentLabel = order.pixData?.provider === 'SICREDI' ? 'PIX (Conta Sicredi)' : 'PIX';
  else if (rawPaymentMethod === 'DEBITO') paymentLabel = 'Cartão de Débito';
  else if (rawPaymentMethod === 'CREDITO') paymentLabel = 'Cartão de Crédito';
  else if (rawPaymentMethod === 'CARTAO') paymentLabel = 'Cartão';
  else if (rawPaymentMethod === 'DINHEIRO') paymentLabel = 'Dinheiro';
  else if (rawPaymentMethod === 'FIADO') paymentLabel = 'Fiado (Conta de Cliente)';

  const sellerName = order.createdBy?.name || order.sellerName || order.operatorName || "Equipe Conflora";
  const cashierName = order.receivedBy?.name || order.cashierName || '';

  const auditLines = [];
  if (!cashierName) {
    auditLines.push(`👤 *Pedido feito por:* ${sellerName}`);
    auditLines.push(`⏳ *Recebimento:* ${rawPaymentMethod === 'PIX' && order.pixData ? 'Aguardando confirmação do Sicredi' : 'Aguardando pagamento'}`);
  } else if (sellerName === cashierName || rawPaymentMethod === 'PIX') {
    auditLines.push(`👤 *Pedido feito por:* ${sellerName}`);
    const pixConfirmation = order.verifiedVia === 'MANUAL_CAIXA_PIX'
      ? ' (Pix conferido manualmente)'
      : order.verifiedVia === 'SICREDI_PIX_WEBHOOK' ? ' (Sicredi Pix Automático)' : '';
    auditLines.push(`✅ *Recebido por:* ${cashierName}${rawPaymentMethod === 'PIX' ? pixConfirmation : ''}`);
  } else {
    auditLines.push(`👤 *Pedido feito por:* ${sellerName} (Venda creditada para ele)`);
    auditLines.push(`🏦 *Recebido por:* ${cashierName} (Operador de Caixa que recebeu)`);
  }

  const lines = [
    `🌿 *CONFLORA HORTA E VIVEIRO* 🌿`,
    `🧾 *Pedido #${orderNumber} — Comprovante*`,
    `📅 ${dateStr}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Cliente:* ${customerName}`,
    customerPhone ? `📱 *WhatsApp:* ${customerPhone}` : null,
    order.orderType === 'DELIVERY'
      ? `🛵 *Entrega:* ${order.deliveryAddress || 'Endereço informado'}`
      : `🏬 *Retirada:* Balcão / Viveiro Conflora`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🛒 *ITENS DO PEDIDO:*`,
    ...items,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💵 *Subtotal:* ${money(subtotal)}`,
    discountAmount > 0 ? `🏷️ *Desconto (${discountPercent}%):* - ${money(discountAmount)}` : null,
    freightValue > 0 ? `🛵 *Taxa de Entrega:* + ${money(freightValue)}` : null,
    `💰 *TOTAL FINAL:* ${money(total)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💳 *Forma de Pagamento:* ${paymentLabel}`,
    ...(order.paymentParts?.length > 1 ? order.paymentParts.map((part) => `• ${part.method}: ${money(part.amount)}${part.receivedBy?.name ? ' · Recebido por: ' + part.receivedBy.name : ''}${part.method === 'FIADO' ? ' (a prazo)' : ''}`) : []),
    `📌 *Situação:* ${order.paymentStatus === 'ON_ACCOUNT' ? 'Fiado registrado — saldo a pagar' : order.paidAt ? 'Pago e finalizado' : 'Aguardando recebimento'}`,
    order.paymentCheckoutUrl && !order.paidAt ? `Pagamento: ${order.paymentCheckoutUrl}` : null,
    order.cashReceived ? `💵 *Valor recebido:* ${money(order.cashReceived)} · *Troco:* ${money(order.changeGiven)}` : null,
  ];

  const copiaECola = order.pixCopiaECola || order.pixData?.copiaECola || order.pixCode;
  if (rawPaymentMethod === 'PIX' && copiaECola && !order.completedAt && !order.paidAt) {
    lines.push(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `💠 *PAGAMENTO VIA PIX SICREDI*`,
      `Titular: Conflora Horta e Viveiro`,
      `Instituição: Banco Cooperativo Sicredi S.A.`,
      `Valor exato: *${money(order.pixData?.amount || total)}* (Sem alteração de valor)`,
      ``,
      `🔑 *PIX COPIA E COLA:*`,
      `${copiaECola}`,
      ``,
      `⚡ *Aviso:* Pedido é marcado como pago e baixado no estoque automaticamente assim que o Sicredi acusar o recebimento!`
    );
  }

  lines.push(
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ...auditLines,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Obrigado pela preferência! Conflora Horta e Viveiro 🌱`
  );

  return lines.filter(Boolean).join('\n');
}

module.exports = { formatOrderReceipt, money };
