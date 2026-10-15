const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function money(value) {
  return currency.format(Number(value) || 0);
}

function formatOrderReceipt(order) {
  const orderNumber = order.ticketNumber || String(order.id || "").slice(-8);
  const items = (order.items || []).map((item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.price) || Number(item.unitPrice) || 0;
    const subtotal = Number(item.subtotalMinor) / 100 ||
      Number(item.subtotal) ||
      unitPrice * quantity;
    return `${quantity} × ${item.name || "Produto"} — ${money(subtotal)}`;
  });
  const lines = [
    `Pedido #${orderNumber}`,
    `Cliente: ${order.customerName || order.customer?.name || "Cliente"}`,
    "",
    "Itens:",
    ...items,
    "",
    `Total: ${money(order.total)}`,
    `Pagamento: ${order.paymentMethod || "PIX"}`,
    order.paymentCheckoutUrl
      ? `Pagar com PIX no Mercado Pago: ${order.paymentCheckoutUrl}`
      : "",
    order.paymentStatus === "APPROVED"
      ? "Pagamento confirmado."
      : order.paymentMethod === "PIX"
        ? "Depois de pagar, envie o comprovante pelo WhatsApp; o pedido só será confirmado quando o Mercado Pago aprovar."
        : "",
  ];
  return lines.filter((line) => line !== "").join("\n");
}

module.exports = { formatOrderReceipt };
