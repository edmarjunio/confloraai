const test = require('node:test');
const assert = require('node:assert/strict');
const { FirestoreRepository } = require('./helpers/repository-fixture');
const {
  getBusinessDate,
  getBusinessDateRange,
  summarizeDailyExecutiveMetrics,
} = require('../src/reports/daily-executive-metrics');
const { formatDailyExecutiveReport, normalizeWhatsAppNumber } = require('../src/reports/daily-executive-report');

const reportDate = '2026-10-15';

test('pagamento combinado separa dinheiro, cartão e fiado nos relatórios sem duplicar a venda', () => {
  const orders = [{ id: 'mixed-sale', createdAt: reportDate + 'T12:00:00-03:00', completedAt: reportDate + 'T12:00:00-03:00', status: 'CONFIRMED', paymentStatus: 'ON_ACCOUNT', paymentMethod: 'MISTO', total: 20, cashReceived: 10, changeGiven: 5, createdBy: { id: 'seller', name: 'Vendedor' }, receivedBy: { id: 'cashier', name: 'Caixa' }, items: [{ productId: 'plant', name: 'Muda', quantity: 2, price: 10 }], paymentParts: [{ method: 'DINHEIRO', amount: 5 }, { method: 'CREDITO', amount: 10 }, { method: 'FIADO', amount: 5 }] }];
  const daily = summarizeDailyExecutiveMetrics({ date: reportDate, orders });
  assert.equal(daily.orderCount, 1);
  assert.equal(daily.totalRevenue, 20);
  assert.equal(daily.totalReceivedSales, 15);
  assert.equal(daily.onAccountSales, 5);
  assert.equal(daily.byPayment.DINHEIRO.total, 5);
  assert.equal(daily.byPayment.CREDITO.total, 10);
  assert.equal(daily.byCollaborator.find((row) => row.id === 'cashier').receivedTotal, 15);
  const { summarizeExecutivePeriod } = require('../src/reports/period-executive-metrics');
  const { current } = summarizeExecutivePeriod({ from: reportDate, to: reportDate, orders });
  assert.equal(current.sales, 20);
  assert.equal(current.receivedSales, 15);
  assert.equal(current.onAccountSales, 5);
});

test('métricas diárias usam o fuso de Mineiros e separam venda, recebimento e fiado', () => {
  const metrics = summarizeDailyExecutiveMetrics({
    date: reportDate,
    users: [
      { id: 'admin-1', name: 'Júnior', role: 'ADMIN', active: true },
      { id: 'cashier-1', name: 'Rose', role: 'CAIXA', active: true },
      { id: 'customer-1', name: 'Cliente', role: 'CLIENTE', active: true },
    ],
    orders: [
      {
        id: 'credit-sale', createdAt: '2026-10-15T09:00:00-03:00', status: 'CONFIRMED',
        paymentStatus: 'APPROVED', paymentMethod: 'CREDITO', total: 120,
        createdBy: { id: 'admin-1', name: 'Júnior', role: 'ADMIN' },
        receivedBy: { id: 'cashier-1', name: 'Rose', role: 'CAIXA' },
        items: [{ productId: 'produto-a', name: 'Muda A', quantity: 4, price: 10 }, { productId: 'produto-b', name: 'Muda B', quantity: 2, price: 30 }],
      },
      {
        id: 'pix-sale', createdAt: '2026-10-15T10:00:00-03:00', status: 'CONFIRMED',
        paymentStatus: 'APPROVED', paymentMethod: 'PIX', total: 100,
        createdBy: { id: 'seller-1', name: 'Edmar', role: 'VENDEDOR' },
        receivedBy: { id: 'seller-1', name: 'Edmar', role: 'VENDEDOR' },
        items: [{ productId: 'produto-a', name: 'Muda A', quantity: 1, price: 10 }],
      },
      {
        id: 'cash-sale', createdAt: '2026-10-15T11:00:00-03:00', status: 'CONFIRMED',
        paymentStatus: 'APPROVED', paymentMethod: 'DINHEIRO', total: 50, cashReceived: 60, changeGiven: 10,
        createdBy: { id: 'admin-1', name: 'Júnior', role: 'ADMIN' },
        receivedBy: { id: 'cashier-1', name: 'Rose', role: 'CAIXA' },
        items: [{ productId: 'produto-a', name: 'Muda A', quantity: 1, price: 10 }],
      },
      {
        id: 'account-sale', createdAt: '2026-10-15T12:00:00-03:00', status: 'CONFIRMED',
        paymentStatus: 'ON_ACCOUNT', paymentMethod: 'FIADO', total: 80,
        createdBy: { id: 'seller-1', name: 'Edmar', role: 'VENDEDOR' },
        receivedBy: { id: 'cashier-1', name: 'Rose', role: 'CAIXA' },
        items: [{ productId: 'produto-c', name: 'Muda C', quantity: 1, price: 80 }],
      },
      { id: 'waiting', createdAt: '2026-10-15T12:30:00-03:00', status: 'AWAITING_CASHIER', total: 999 },
      { id: 'tomorrow', createdAt: '2026-10-16T03:30:00Z', status: 'CONFIRMED', total: 999 },
    ],
    settlements: [{
      id: 'debt-payment', createdAt: '2026-10-15T13:00:00-03:00', type: 'QUITACAO_FIADO', amount: 30,
      receivedBy: { id: 'cashier-1', name: 'Rose', role: 'CAIXA' },
    }],
  });

  assert.equal(metrics.orderCount, 4);
  assert.equal(metrics.totalRevenue, 350);
  assert.equal(metrics.ticketMedio, 87.5);
  assert.equal(metrics.debtReceived, 30);
  assert.equal(metrics.onAccountSales, 80);
  assert.equal(metrics.totalReceivedSales, 270);
  assert.equal(metrics.cashSales, 50);
  assert.equal(metrics.cashTendered, 60);
  assert.equal(metrics.changeGiven, 10);
  assert.equal(metrics.ledgerVolume, 110);
  assert.equal(metrics.byPayment.CREDITO.total, 120);
  assert.equal(metrics.byPayment.PIX.total, 100);
  assert.equal(metrics.byPayment.FIADO.total, 80);
  assert.equal(metrics.topProductsByQuantity[0].name, 'Muda A');
  assert.equal(metrics.topProductsByQuantity[0].quantity, 6);
  assert.equal(metrics.topProductsByQuantity[0].revenue, 60);
  assert.equal(metrics.topProductsByValue[0].name, 'Muda C');
  const rose = metrics.byCollaborator.find((person) => person.id === 'cashier-1');
  assert.equal(rose.receivedCount, 3);
  assert.equal(rose.receivedTotal, 200);
  assert.ok(metrics.byCollaborator.some((person) => person.name === 'Júnior' && person.role === 'ADMIN'));
  assert.ok(!metrics.byCollaborator.some((person) => person.role === 'CLIENTE'));
});

test('faixa de consulta e relatório usam o dia local e incluem os indicadores e os dois rankings', () => {
  assert.equal(getBusinessDate('2026-10-15T02:59:59.999Z'), '2026-10-14');
  assert.deepEqual(getBusinessDateRange(reportDate), {
    start: '2026-10-15T03:00:00.000Z',
    end: '2026-10-16T03:00:00.000Z',
  });

  const report = formatDailyExecutiveReport({
    date: reportDate,
    orderCount: 3,
    totalRevenue: 250,
    ticketMedio: 83.33,
    totalReceivedSales: 170,
    ledgerVolume: 110,
    debtReceived: 30,
    onAccountSales: 80,
    cashTendered: 60,
    changeGiven: 10,
    cashSales: 50,
    byPayment: { PIX: { count: 1, total: 100 }, DINHEIRO: { count: 1, total: 50 } },
    byCollaborator: [{ name: 'Rose', role: 'CAIXA', count: 1, total: 80, receivedCount: 2, receivedTotal: 150 }],
    topProductsByQuantity: [{ name: 'Muda A', quantity: 6, revenue: 60 }],
    topProductsByValue: [{ name: 'Muda C', quantity: 1, revenue: 80 }],
  }).join('\n');
  assert.match(report, /15\/10\/2026/);
  assert.match(report, /Recebimento de dívidas/);
  assert.match(report, /5 MAIS VENDIDOS · QUANTIDADE/);
  assert.match(report, /5 MAIS VENDIDOS · VALOR/);
  assert.match(report, /Rose \(CAIXA\)/);
});

test('repositório monta o resumo diário a partir das vendas e das quitações armazenadas', async () => {
  const repository = new FirestoreRepository({ isInMemory: true });
  repository.inMemoryOrders.set('order-today', {
    id: 'order-today', createdAt: '2026-10-15T12:00:00-03:00', status: 'CONFIRMED',
    paymentStatus: 'APPROVED', paymentMethod: 'DEBITO', total: 25,
    createdBy: { id: 'usr-caixa1', name: 'Atendente do Caixa', role: 'CAIXA' },
    receivedBy: { id: 'usr-caixa1', name: 'Atendente do Caixa', role: 'CAIXA' },
    items: [{ productId: 'muda', name: 'Muda', quantity: 2, price: 12.5 }],
  });
  repository.inMemoryDebtSettlements = [{
    id: 'settlement-today', type: 'QUITACAO_FIADO', createdAt: '2026-10-15T13:00:00-03:00', amount: 40,
    receivedBy: { id: 'usr-caixa1', name: 'Atendente do Caixa', role: 'CAIXA' },
  }];

  const metrics = await repository.getDailyExecutiveMetrics({ date: reportDate });
  assert.equal(metrics.orderCount, 1);
  assert.equal(metrics.byPayment.DEBITO.total, 25);
  assert.equal(metrics.debtReceived, 40);
  assert.equal(metrics.topProductsByValue[0].revenue, 25);
  assert.equal(metrics.byCollaborator.find((person) => person.id === 'usr-caixa1').receivedTotal, 65);
});

test('normalização do destinatário exige número brasileiro válido', () => {
  assert.equal(normalizeWhatsAppNumber('(64) 99935-1616'), '5564999351616');
  assert.equal(normalizeWhatsAppNumber('5564999351616'), '5564999351616');
  assert.equal(normalizeWhatsAppNumber('12345'), '');
});

test('relatório grande é segmentado em mensagens dentro do limite do WhatsApp', () => {
  const metrics = {
    date: reportDate, orderCount: 0, totalRevenue: 0, ticketMedio: 0,
    byCollaborator: Array.from({ length: 100 }, (_, index) => ({
      name: `Colaborador ${index} ${'Nome '.repeat(8)}`,
      role: 'VENDEDOR', count: 0, total: 0, receivedCount: 0, receivedTotal: 0,
    })),
  };
  const messages = formatDailyExecutiveReport(metrics);
  assert.ok(messages.length > 1);
  assert.ok(messages.every((message) => message.length <= 3400));
});
