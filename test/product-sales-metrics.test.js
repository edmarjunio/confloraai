const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizeExecutivePeriod, getPreviousPeriod } = require('../src/reports/period-executive-metrics');
const { summarizeProductSales } = require('../src/reports/product-sales-metrics');

test('rankings distinguem quantidade, valor, produtos sem vendas e líderes de cada mês', () => {
  const catalog = [{ id: 'orange', name: 'Laranja', saleUnit: 'KG' }, { id: 'flower', name: 'Flores' }, { id: 'zero', name: 'Sem venda' }, { id: 'inactive', name: 'Inativo', active: false }];
  const orders = [
    { createdAt: '2026-01-15T12:00:00-03:00', status: 'CONFIRMED', paymentStatus: 'APPROVED', total: 50, items: [{ productId: 'orange', name: 'Laranja', quantity: 10, price: 5 }] },
    { createdAt: '2026-02-15T12:00:00-03:00', status: 'CONFIRMED', paymentStatus: 'APPROVED', total: 100, freightValue: 10, discountAmount: 10, items: [{ productId: 'flower', name: 'Flores', quantity: 5, price: 20 }] },
    { createdAt: '2026-01-15T12:00:00-03:00', status: 'AWAITING_PAYMENT', paymentStatus: 'PENDING', total: 1000, items: [{ productId: 'zero', name: 'Sem venda', quantity: 100, price: 10 }] },
  ];
  const result = summarizeExecutivePeriod({ from: '2026-01-01', to: '2026-12-31', orders, catalog, comparisonMode: 'year' });
  const { rankings, monthly } = result.current;
  assert.equal(rankings.mostByQuantity[0].name, 'Laranja');
  assert.equal(rankings.mostByQuantity[0].unit, 'kg');
  assert.equal(rankings.mostByRevenue[0].name, 'Flores');
  assert.equal(rankings.mostByRevenue[0].revenue, 90);
  assert.equal(rankings.leastByQuantity[0].name, 'Sem venda');
  assert.equal(rankings.leastByRevenue[0].name, 'Sem venda');
  assert.equal(rankings.unsoldCount, 1);
  assert.equal(monthly[0].rankings.mostByQuantity[0].name, 'Laranja');
  assert.equal(monthly[1].rankings.mostByRevenue[0].name, 'Flores');
  assert.equal(result.current.sales, 150);
  assert.equal(result.range.previousFrom, '2025-01-01');
  assert.equal(result.range.previousTo, '2025-12-31');
});

test('comparação mensal respeita fevereiro, anos bissextos e a mesma data do ano anterior', () => {
  assert.equal(getPreviousPeriod({ from: '2024-03-01', to: '2024-03-31', comparisonMode: 'month' }).previousTo, '2024-02-29');
  assert.equal(getPreviousPeriod({ from: '2024-01-01', to: '2024-02-29', comparisonMode: 'year' }).previousTo, '2023-02-28');
  assert.equal(getPreviousPeriod({ from: '2026-10-01', to: '2026-10-18', comparisonMode: 'month' }).previousFrom, '2026-09-01');
  assert.equal(getPreviousPeriod({ from: '2026-10-01', to: '2026-10-18', comparisonMode: 'month' }).previousTo, '2026-09-18');
});

test('rateio de desconto preserva os centavos sem gerar valores negativos', () => {
  const items = Array.from({ length: 8 }, (_, index) => ({ productId: String(index), name: String(index), quantity: 1, price: 0.01 }));
  const result = summarizeProductSales({ orders: [{ createdAt: '2026-01-01T12:00:00Z', items, total: 0.05, discountAmount: 0.03 }] });
  assert.equal(result.rankings.mostByRevenue.reduce((sum, item) => sum + Math.round(item.revenue * 100), 0), 5);
  assert.ok(result.rankings.leastByRevenue.every(item => item.revenue >= 0));
});
