const { getBusinessDate, isValidReportDate } = require('./daily-executive-metrics');
const { summarizeProductSales } = require('./product-sales-metrics');

const COMPLETED_STATUSES = new Set(['CONFIRMED', 'PAID_CONFIRMED', 'DELIVERED', 'COMPLETED']);
const PAYMENT_METHODS = ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'CARTAO', 'FIADO', 'SALDO_CLIENTE', 'OUTROS'];
const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const cents = (value) => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : 0;
const reais = (value) => Math.round(value) / 100;

function dayNumber(value) {
  return Math.floor(Date.parse(`${value}T00:00:00.000Z`) / 86400000);
}

function getPreviousPeriod({ from, to, comparisonMode = 'previous' }) {
  if (!isValidReportDate(from) || !isValidReportDate(to) || from > to) {
    throw new Error('Período inválido. Selecione datas válidas.');
  }
  const days = dayNumber(to) - dayNumber(from) + 1;
  if (days > 366) { throw new Error('O período máximo do painel é de 366 dias.'); }
  const shift = (value, months) => {
    const [year, month, day] = value.split('-').map(Number);
    const end = new Date(Date.UTC(year, month + months, 0));
    return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), Math.min(day, end.getUTCDate()))).toISOString().slice(0, 10);
  };
  const months = comparisonMode === 'year' ? -12 : comparisonMode === 'month' ? -1 : 0;
  const previousTo = months ? shift(to, months) : new Date((dayNumber(from) - 1) * 86400000).toISOString().slice(0, 10);
  const previousFrom = months ? shift(from, months) : new Date((dayNumber(from) - days) * 86400000).toISOString().slice(0, 10);
  return { from, to, days, previousFrom, previousTo, comparisonMode };
}

function summarizePeriod({ from, to, orders = [], settlements = [], catalog = [] }) {
  const validOrders = orders.filter((order) => {
    const businessDate = getBusinessDate(order?.createdAt);
    return businessDate >= from && businessDate <= to &&
      COMPLETED_STATUSES.has(String(order.status || '').toUpperCase()) &&
      String(order.paymentStatus || '').toUpperCase() !== 'PENDING';
  });
  const validSettlements = settlements.filter((entry) => {
    const businessDate = getBusinessDate(entry?.createdAt);
    const type = entry.entryType || entry.type || 'QUITACAO_FIADO';
    return businessDate >= from && businessDate <= to && ['QUITACAO_FIADO', 'CREDITO_CLIENTE'].includes(type);
  });

  let salesMinor = 0;
  let receivedSalesMinor = 0;
  let onAccountMinor = 0;
  let receivedDebtMinor = 0;
  let advanceCreditMinor = 0;
  const byPayment = new Map(PAYMENT_METHODS.map((method) => [method, { salesMinor: 0, receivedMinor: 0, orderCount: 0, receiptCount: 0 }]));
  const weekdays = WEEKDAYS.map((name, index) => ({ index, name, salesMinor: 0, orderCount: 0, sampleDays: 0 }));
  const daily = new Map();

  for (const order of validOrders) {
    const date = getBusinessDate(order.createdAt);
    const amountMinor = cents(order.total);
    const methodName = String(order.paymentMethod || 'OUTROS').toUpperCase();
    const method = byPayment.get(methodName) ? methodName : 'OUTROS';
    const isOnAccount = method === 'FIADO' || String(order.paymentStatus || '').toUpperCase() === 'ON_ACCOUNT';
    const paymentStatus = String(order.paymentStatus || '').toUpperCase();
    const isPaid = !isOnAccount && (!paymentStatus || ['APPROVED', 'PAID', 'PAID_CONFIRMED'].includes(paymentStatus));

    salesMinor += amountMinor;
    if (order.paymentParts?.length > 1) {
      for (const part of order.paymentParts) {
        const amount = cents(part.amount);
        const row = byPayment.get(part.method) || byPayment.get('OUTROS');
        row.salesMinor += amount; row.orderCount++;
        if (part.method === 'FIADO') onAccountMinor += amount;
      }
      // Receipts are allocated below by their effective date.
    } else {
    if (isOnAccount) { onAccountMinor += amountMinor; }
    // Received cash is allocated below by payment date.
    const payment = byPayment.get(method);
    payment.salesMinor += isOnAccount || isPaid ? amountMinor : 0;
    payment.orderCount += isOnAccount || isPaid ? 1 : 0;

    }

    const dateSummary = daily.get(date) || { date, salesMinor: 0, receivedMinor: 0, orderCount: 0 };
    dateSummary.salesMinor += amountMinor;
    // Sale date and receipt date are independent facts.
    dateSummary.orderCount++;
    daily.set(date, dateSummary);

    const weekdayIndex = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    weekdays[weekdayIndex].salesMinor += amountMinor;
    weekdays[weekdayIndex].orderCount++;


  }

  for (const fact of require('./payment-facts').paymentFacts(orders)) {
    if (fact.date < from || fact.date > to) continue;
    receivedSalesMinor += fact.amountMinor;
    const day = daily.get(fact.date) || { date: fact.date, salesMinor: 0, receivedMinor: 0, orderCount: 0 };
    day.receivedMinor += fact.amountMinor; daily.set(fact.date, day);
    const payment = byPayment.get(fact.method) || byPayment.get('OUTROS');
    payment.receivedMinor += fact.amountMinor; payment.receiptCount++;
  }

  for (const settlement of validSettlements) {
    const amountMinor = cents(settlement.amount);
    const type = settlement.entryType || settlement.type || 'QUITACAO_FIADO';
    if (type === 'CREDITO_CLIENTE') { advanceCreditMinor += amountMinor; }
    else { receivedDebtMinor += amountMinor; }
    for (const part of settlement.paymentParts || [{ method: settlement.paymentMethod, amount: settlement.amount }]) {
      const methodName = String(part.method || 'OUTROS').toUpperCase();
      const payment = byPayment.get(byPayment.has(methodName) ? methodName : 'OUTROS');
      payment.receivedMinor += cents(part.amount);
      payment.receiptCount++;
    }
  }

  const totalRevenue = reais(salesMinor);
  const orderCount = validOrders.length;
  const productInsights = summarizeProductSales({ orders: validOrders, catalog });
  const days = [];
  for (let day = dayNumber(from); day <= dayNumber(to); day++) {
    const date = new Date(day * 86400000).toISOString().slice(0, 10);
    const item = daily.get(date) || { date, salesMinor: 0, receivedMinor: 0, orderCount: 0 };
    days.push({ date, sales: reais(item.salesMinor), received: reais(item.receivedMinor), orderCount: item.orderCount });
    const weekdayIndex = new Date(`${date}T12:00:00.000Z`).getUTCDay();
    weekdays[weekdayIndex].sampleDays++;
  }
  const byWeekday = weekdays.map((weekday) => ({
    ...weekday,
    sales: reais(weekday.salesMinor),
    averageSales: weekday.sampleDays ? reais(weekday.salesMinor / weekday.sampleDays) : 0,
  }));
  const strongestWeekday = byWeekday.slice().sort((left, right) => right.averageSales - left.averageSales || right.orderCount - left.orderCount)[0];
  return {
    from, to, days: days.length, sales: totalRevenue,
    receivedSales: reais(receivedSalesMinor), onAccountSales: reais(onAccountMinor),
    debtReceived: reais(receivedDebtMinor), advanceCreditReceived: reais(advanceCreditMinor),
    totalCashIn: reais(receivedSalesMinor + receivedDebtMinor + advanceCreditMinor),
    orderCount, averageTicket: orderCount ? reais(Math.round(salesMinor / orderCount)) : 0,
    byPayment: Object.fromEntries(PAYMENT_METHODS.map((method) => {
      const row = byPayment.get(method);
      return [method, { sales: reais(row.salesMinor), receipts: reais(row.receivedMinor), orderCount: row.orderCount, receiptCount: row.receiptCount }];
    })),
    byWeekday,
    strongestWeekday: strongestWeekday?.averageSales > 0 ? {
      name: strongestWeekday.name, sales: strongestWeekday.sales,
      averageSales: strongestWeekday.averageSales, orderCount: strongestWeekday.orderCount,
      sampleDays: strongestWeekday.sampleDays,
    } : null,
    topProducts: productInsights.rankings.mostByQuantity,
    ...productInsights,
    daily: days,
  };
}

function summarizeExecutivePeriod({ from, to, orders = [], settlements = [], catalog = [], comparisonMode }) {
  const range = getPreviousPeriod({ from, to, comparisonMode });
  const current = summarizePeriod({ from, to, orders, settlements, catalog });
  const previous = summarizePeriod({ from: range.previousFrom, to: range.previousTo, orders, settlements });
  const change = (now, before) => ({
    absolute: Math.round((now - before) * 100) / 100,
    percent: before ? Math.round(((now - before) / Math.abs(before)) * 1000) / 10 : null,
  });
  return {
    range,
    current,
    previous,
    comparison: {
      sales: change(current.sales, previous.sales),
      receivedSales: change(current.receivedSales, previous.receivedSales),
      totalCashIn: change(current.totalCashIn, previous.totalCashIn),
      onAccountSales: change(current.onAccountSales, previous.onAccountSales),
      advanceCreditReceived: change(current.advanceCreditReceived, previous.advanceCreditReceived),
      orderCount: change(current.orderCount, previous.orderCount),
      averageTicket: change(current.averageTicket, previous.averageTicket),
    },
  };
}

module.exports = { getPreviousPeriod, summarizeExecutivePeriod };
