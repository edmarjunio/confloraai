const STAFF_ROLES = new Set(['ADMIN', 'CAIXA', 'VENDEDOR']);
const COMPLETED_STATUSES = new Set(['CONFIRMED', 'PAID_CONFIRMED', 'DELIVERED', 'COMPLETED']);
const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

const currencyToMinor = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
};
const minorToCurrency = (value) => Math.round(value) / 100;

function isValidReportDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) { return false; }
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getBusinessDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) { return ''; }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getBusinessDateRange(date) {
  if (!isValidReportDate(date)) { throw new Error('Data inválida. Use o formato AAAA-MM-DD.'); }
  // Mineiros permanece em UTC-03:00 para os períodos operacionais atuais.
  const start = new Date(`${date}T00:00:00.000-03:00`);
  const nextDay = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: nextDay.toISOString() };
}

function normalizePaymentMethod(order) {
  const rawMethod = String(order.paymentMethod || '').toUpperCase();
  if (rawMethod.includes('PIX')) { return 'PIX'; }
  if (rawMethod.includes('SALDO_CLIENTE')) { return 'SALDO_CLIENTE'; }
  if (rawMethod.includes('FIADO') || order.paymentStatus === 'ON_ACCOUNT') { return 'FIADO'; }
  if (rawMethod.includes('DEBIT')) { return 'DEBITO'; }
  if (rawMethod.includes('CREDIT')) { return 'CREDITO'; }
  if (rawMethod.includes('DÉBIT') || rawMethod.includes('DEBITO')) { return 'DEBITO'; }
  if (rawMethod.includes('CRÉDIT') || rawMethod.includes('CREDITO')) { return 'CREDITO'; }
  if (rawMethod.includes('CART') || rawMethod.includes('CARD')) { return 'CARTAO'; }
  if (rawMethod.includes('DINHEIRO') || rawMethod.includes('CASH')) { return 'DINHEIRO'; }
  return 'OUTROS';
}

function collaboratorKey(actor, fallbackId, fallbackName) {
  const id = String(actor?.id || fallbackId || '').trim();
  const name = String(actor?.name || fallbackName || '').trim();
  return id || name || 'sem-identificacao';
}

function createCollaborator(actor, fallbackId, fallbackName, fallbackRole) {
  const name = String(actor?.name || fallbackName || 'Equipe Conflora').trim();
  const key = collaboratorKey(actor, fallbackId, name);
  return {
    id: key,
    name,
    role: String(actor?.role || fallbackRole || 'COLABORADOR').toUpperCase(),
    salesCount: 0,
    salesTotalMinor: 0,
    receivedCount: 0,
    receivedTotalMinor: 0,
  };
}

function summarizeDailyExecutiveMetrics({ date, orders = [], settlements = [], users = [] }) {
  if (!isValidReportDate(date)) { throw new Error('Data inválida. Use o formato AAAA-MM-DD.'); }

  const dailyOrders = orders.filter((order) =>
    order?.createdAt && getBusinessDate(order.createdAt) === date &&
    COMPLETED_STATUSES.has(String(order.status || '').toUpperCase()) &&
    String(order.paymentStatus || '').toUpperCase() !== 'PENDING'
  );
  const dailySettlements = settlements.filter((settlement) =>
    settlement?.createdAt && getBusinessDate(settlement.createdAt) === date &&
    ['QUITACAO_FIADO', 'CREDITO_CLIENTE'].includes(settlement.entryType || settlement.type || 'QUITACAO_FIADO')
  );

  let totalRevenueMinor = 0;
  let totalReceivedSalesMinor = 0;
  let onAccountSalesMinor = 0;
  let cashSalesMinor = 0;
  let cashTenderedMinor = 0;
  let changeMinor = 0;
  let debtReceivedMinor = 0;
  let advanceCreditMinor = 0;
  const byPayment = new Map();
  const collaborators = new Map();
  const products = new Map();

  const getCollaborator = (actor, fallbackId, fallbackName, fallbackRole) => {
    const item = createCollaborator(actor, fallbackId, fallbackName, fallbackRole);
    if (!collaborators.has(item.id)) { collaborators.set(item.id, item); }
    const existing = collaborators.get(item.id);
    if (existing.name === 'Equipe Conflora' && item.name !== 'Equipe Conflora') { existing.name = item.name; }
    return existing;
  };

  for (const user of users) {
    if (user?.active === false || !STAFF_ROLES.has(String(user?.role || '').toUpperCase())) { continue; }
    getCollaborator(user, user.id, user.name || user.email, user.role);
  }

  for (const order of dailyOrders) {
    const orderMinor = currencyToMinor(order.total);
    const paymentMethod = normalizePaymentMethod(order);
    const isOnAccount = paymentMethod === 'FIADO';
    const paymentStatus = String(order.paymentStatus || '').toUpperCase();
    const isPaid = !isOnAccount && (!paymentStatus || ['APPROVED', 'PAID', 'PAID_CONFIRMED'].includes(paymentStatus));

    totalRevenueMinor += orderMinor;
    if (isOnAccount) { onAccountSalesMinor += orderMinor; }
    if (isPaid && paymentMethod !== 'SALDO_CLIENTE') { totalReceivedSalesMinor += orderMinor; }

    const payment = byPayment.get(paymentMethod) || { method: paymentMethod, count: 0, totalMinor: 0 };
    if (isOnAccount || isPaid) { payment.count++; }
    payment.totalMinor += isOnAccount || isPaid ? orderMinor : 0;
    byPayment.set(paymentMethod, payment);

    if (paymentMethod === 'DINHEIRO' && isPaid) {
      cashSalesMinor += orderMinor;
      cashTenderedMinor += currencyToMinor(order.cashReceived ?? order.cashTendered ?? order.total);
      changeMinor += currencyToMinor(order.changeGiven);
    }

    const creator = order.createdBy || {
      id: order.operatorId,
      name: order.sellerName || order.operatorName,
      email: order.sellerEmail || order.operatorEmail,
    };
    const seller = getCollaborator(creator, order.operatorId, order.sellerName || order.operatorName, creator.role);
    seller.salesCount++;
    seller.salesTotalMinor += orderMinor;

    const receiver = order.receivedBy || (paymentMethod === 'PIX' ? creator : null);
    if (receiver && isPaid && paymentMethod !== 'SALDO_CLIENTE') {
      const cashier = getCollaborator(receiver, receiver.id, receiver.name || order.cashierName, receiver.role);
      cashier.receivedCount++;
      cashier.receivedTotalMinor += orderMinor;
    }

    for (const item of Array.isArray(order.items) ? order.items : []) {
      const productId = String(item.productId || item.id || item.name || '').trim();
      if (!productId) { continue; }
      const quantity = Number(item.quantity || 1);
      if (!Number.isFinite(quantity) || quantity <= 0) { continue; }
      const subtotal = Number(item.subtotal);
      const unitPrice = Number(item.price ?? item.unitPrice ?? (Number.isFinite(subtotal) ? subtotal / quantity : 0));
      const product = products.get(productId) || {
        id: productId,
        name: String(item.name || 'Produto'),
        category: String(item.category || 'Geral'),
        quantity: 0,
        revenueMinor: 0,
      };
      product.quantity += quantity;
      product.revenueMinor += currencyToMinor(Number.isFinite(unitPrice) ? unitPrice * quantity : 0);
      products.set(productId, product);
    }
  }

  for (const settlement of dailySettlements) {
    const amountMinor = currencyToMinor(settlement.amount);
    if ((settlement.entryType || settlement.type) === 'CREDITO_CLIENTE') { advanceCreditMinor += amountMinor; }
    else { debtReceivedMinor += amountMinor; }
    const actor = settlement.receivedBy || { id: settlement.receivedById, name: settlement.operatorName };
    if (actor.id || actor.name) {
      const receiver = getCollaborator(actor, actor.id, actor.name || settlement.operatorName, actor.role);
      receiver.receivedCount++;
      receiver.receivedTotalMinor += amountMinor;
    }
  }

  const productRows = Array.from(products.values()).map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    quantity: product.quantity,
    revenue: minorToCurrency(product.revenueMinor),
  }));
  const topProductsByQuantity = productRows.slice().sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 5);
  const topProductsByValue = productRows.slice().sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity).slice(0, 5);
  const totalRevenue = minorToCurrency(totalRevenueMinor);
  const byCollaborator = Array.from(collaborators.values())
    .map((person) => ({
      id: person.id,
      name: person.name,
      role: person.role,
      count: person.salesCount,
      total: minorToCurrency(person.salesTotalMinor),
      percentage: totalRevenueMinor ? Math.round((person.salesTotalMinor / totalRevenueMinor) * 100) : 0,
      receivedCount: person.receivedCount,
      receivedTotal: minorToCurrency(person.receivedTotalMinor),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));

  const paymentOrder = ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'CARTAO', 'FIADO', 'SALDO_CLIENTE', 'OUTROS'];
  const payments = Object.fromEntries(paymentOrder.map((method) => {
    const row = byPayment.get(method) || { count: 0, totalMinor: 0 };
    return [method, { count: row.count, total: minorToCurrency(row.totalMinor) }];
  }));
  const ticketMedio = dailyOrders.length ? totalRevenueMinor / 100 / dailyOrders.length : 0;

  return {
    date,
    totalRevenue,
    orderCount: dailyOrders.length,
    ticketMedio: Math.round(ticketMedio * 100) / 100,
    debtReceived: minorToCurrency(debtReceivedMinor),
    advanceCreditReceived: minorToCurrency(advanceCreditMinor),
    onAccountSales: minorToCurrency(onAccountSalesMinor),
    cashSales: minorToCurrency(cashSalesMinor),
    cashTendered: minorToCurrency(cashTenderedMinor),
    changeGiven: minorToCurrency(changeMinor),
    totalReceivedSales: minorToCurrency(totalReceivedSalesMinor),
    ledgerVolume: minorToCurrency(onAccountSalesMinor + debtReceivedMinor + advanceCreditMinor),
    byPayment: payments,
    byCollaborator,
    topProductsByQuantity,
    topProductsByValue,
    // Compatibilidade com o PDF existente enquanto outros consumidores migram.
    topProducts: topProductsByQuantity,
    hourlyDistribution: [],
  };
}

module.exports = {
  BUSINESS_TIME_ZONE,
  getBusinessDate,
  getBusinessDateRange,
  isValidReportDate,
  summarizeDailyExecutiveMetrics,
};
