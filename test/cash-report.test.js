const { test } = require("node:test");
const assert = require("node:assert/strict");
const { dailyMetrics, businessDay } = require("../src/operations/cash-report");
const day = "2026-10-08";
function sale(total, paymentMethod) {
  return {
    total,
    paymentMethod,
    initialPaidAmount: total,
    businessDate: day,
    status: "CONFIRMED",
    actorName: "Rose",
  };
}
test("12 report indicators reconcile with Looker PDF reference without duplicate debt receipts", () => {
  const orders = [
    sale(100.03, "DINHEIRO"),
    sale(130.5, "Cartão de débito"),
    sale(43.37, "Cartão de crédito"),
    sale(143.99, "PIX"),
    ...Array.from({ length: 9 }, () => sale(1, "PIX")),
  ];
  const d = dailyMetrics({
    date: day,
    orders,
    receipts: [{ amount: 440, paymentMethod: "PIX", businessDate: day }],
    cashMovements: [{ type: "OPENING", amount: 352.2, businessDate: day }],
  });
  assert.equal(d.salesCount, 13);
  assert.equal(d.receivedSalesCents, 42689);
  assert.equal(d.debtReceiptsCents, 44000);
  assert.equal(d.notebookCents, 86689);
  assert.equal(d.cashBalanceCents, 45223);
  assert.equal(d.byPayment.PIX, 59299);
  assert.equal(d.byPayment.CREDITO, 4337);
  assert.equal(d.byPayment.DEBITO, 13050);
  assert.equal(d.cashSalesCents, 10003);
  assert.equal(d.averageTicket.toFixed(2), "32.84");
  assert.equal(d.byOperator.Rose, 42689);
  assert.equal(
    Object.values(d.byPayment).reduce((a, b) => a + b, 0),
    d.notebookCents,
  );
});
test("cash includes debt receipts in money, subtracts actual withdrawals, excludes credit sales from money received", () => {
  const d = dailyMetrics({
    date: day,
    orders: [
      {
        ...sale(900, "A RECEBER"),
        initialPaidAmount: 0,
        creditCustomerId: "edmar",
      },
      { ...sale(100, "PIX"), businessDate: "2026-10-07" },
    ],
    receipts: [{ amount: 400, paymentMethod: "DINHEIRO", businessDate: day }],
    cashMovements: [
      { type: "OPENING", amount: 50, businessDate: day },
      { type: "WITHDRAWAL", amount: 100, businessDate: day },
    ],
  });
  assert.equal(d.creditSalesCents, 90000);
  assert.equal(d.receivedSalesCents, 0);
  assert.equal(d.notebookCents, 40000);
  assert.equal(d.cashBalanceCents, 35000);
  assert.equal(d.salesCount, 1);
  assert.equal(d.averageTicket, 900);
});
test("business day follows Sao Paulo and imported date remains authoritative", () => {
  assert.equal(businessDay("2026-10-09T02:59:00Z"), "2026-10-08");
  assert.equal(businessDay("2026-10-09T03:00:00Z"), "2026-10-09");
  const d = dailyMetrics({
    date: day,
    orders: [
      {
        ...sale(10, "DINHEIRO"),
        createdAt: "2026-10-08T00:00:00Z",
        historical: true,
      },
    ],
  });
  assert.equal(d.salesCount, 1);
});
