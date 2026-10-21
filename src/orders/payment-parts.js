const METHODS = new Set(['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'FIADO', 'SALDO_CLIENTE']);

function normalizePaymentParts(parts, method, total) {
  if (total === undefined && typeof method === 'number') {
    total = method;
    method = parts?.[0]?.method || 'DINHEIRO';
  }
  const entries = parts === undefined ? [{ method, amount: total }] : parts;
  if (!Array.isArray(entries) || !entries.length || entries.length > 6) throw new Error('Informe de uma a seis formas de pagamento.');
  const totalMinor = Math.round(Number(total || 0) * 100);
  const seen = new Set();
  const normalized = entries.map((part) => {
    const paymentMethod = String(part.method || '').toUpperCase();
    const amount = Number(part.amount);
    const minor = Math.round(amount * 100);
    if (!METHODS.has(paymentMethod) || seen.has(paymentMethod) || !Number.isSafeInteger(minor) || minor <= 0 || Math.abs(amount * 100 - minor) > 0.00001) {
      throw new Error('Forma ou valor de pagamento inválido. Use cada forma uma vez e valores em centavos.');
    }
    if (minor > totalMinor) {
      const formattedTotal = Number(total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      throw new Error(`Valor acima do saldo da venda. O máximo permitido é ${formattedTotal}.`);
    }
    seen.add(paymentMethod);
    return { method: paymentMethod, amount: minor / 100 };
  });
  if (normalized.reduce((sum, part) => sum + Math.round(part.amount * 100), 0) !== totalMinor) {
    throw new Error('A soma dos pagamentos precisa ser igual ao total da venda.');
  }
  return normalized;
}

function partAmount(order, method) {
  return (order.paymentParts || [{ method: order.paymentMethod, amount: order.total }]).filter((part) => part.method === method).reduce((sum, part) => sum + part.amount, 0);
}

module.exports = { normalizePaymentParts, partAmount };
