const { fail } = require("./ledger");
function normalize(v) {
  return String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}
function businessDay(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type).value)
    .join("-");
}
function paymentKey(method) {
  const m = normalize(method);
  if (m.includes("PIX")) {
    return "PIX";
  }
  if (m.includes("DINHEIRO")) {
    return "DINHEIRO";
  }
  if (m.includes("DEBIT")) {
    return "DEBITO";
  }
  if (m.includes("CREDIT")) {
    return "CREDITO";
  }
  return "OUTROS";
}
function cents(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) {
    fail("Valor financeiro inválido no relatório");
  }
  return Math.round(n * 100);
}
function dailyMetrics({
  date,
  orders = [],
  receipts = [],
  historicalReceipts = [],
  cashMovements = [],
}) {
  const day = date || businessDay();
  const isDay = (r) =>
    (r.businessDate || (r.createdAt ? businessDay(r.createdAt) : "")) === day;
  const sales = orders.filter((o) => isDay(o) && o.status !== "CANCELLED");
  const summary = {
    date: day,
    salesCount: sales.length,
    salesTotalCents: 0,
    receivedSalesCents: 0,
    debtReceiptsCents: 0,
    creditSalesCents: 0,
    cashSalesCents: 0,
    cashDebtReceiptsCents: 0,
    openingCents: 0,
    outflowsCents: 0,
    byPayment: { PIX: 0, DINHEIRO: 0, CREDITO: 0, DEBITO: 0, OUTROS: 0 },
    byOperator: {},
    refundPendingCents: 0,
  };
  const addPayment = (method, amount) => {
    summary.byPayment[paymentKey(method)] += amount;
  };
  for (const order of sales) {
    const total = cents(order.total);
    summary.salesTotalCents += total;
    const received =
      order.initialPaidAmount !== undefined
        ? cents(order.initialPaidAmount)
        : order.historical
          ? normalize(order.paymentStatus) === "RECEBIDO"
            ? total
            : 0
          : cents(order.paidAmount);
    summary.receivedSalesCents += received;
    addPayment(order.paymentMethod, received);
    if (paymentKey(order.paymentMethod) === "DINHEIRO") {
      summary.cashSalesCents += received;
    }
    if (
      order.creditCustomerId ||
      (normalize(order.paymentStatus) === "A RECEBER" && order.historical)
    ) {
      summary.creditSalesCents += total;
    }
    const name = order.actorName || "Não informado";
    summary.byOperator[name] = (summary.byOperator[name] || 0) + total;
  }
  for (const receipt of [...receipts, ...historicalReceipts].filter(isDay)) {
    const amount = cents(receipt.amount ?? receipt.total);
    summary.debtReceiptsCents += amount;
    addPayment(receipt.paymentMethod, amount);
    if (paymentKey(receipt.paymentMethod) === "DINHEIRO") {
      summary.cashDebtReceiptsCents += amount;
    }
  }
  const movements = cashMovements.filter(isDay);
  const openings = movements
    .filter(
      (m) =>
        m.type === "OPENING" || normalize(m.raw?.CATEGORIA).includes("TROCO"),
    )
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  summary.openingCents = openings.length
    ? cents(openings.at(-1).amount ?? openings.at(-1).total)
    : 0;
  for (const movement of movements) {
    if (["WITHDRAWAL", "EXPENSE", "REFUND"].includes(movement.type)) {
      summary.outflowsCents += cents(movement.amount);
    }
  }
  for (const order of orders.filter(
    (o) => isDay(o) && o.status === "CANCELLED" && o.refundRequired,
  )) {
    const immediate = cents(order.initialPaidAmount || 0);
    summary.receivedSalesCents += immediate;
    addPayment(order.paymentMethod, immediate);
    if (paymentKey(order.paymentMethod) === "DINHEIRO") {
      summary.cashSalesCents += immediate;
    }
    summary.refundPendingCents += cents(order.paidAmount || 0);
  }
  summary.notebookCents =
    summary.receivedSalesCents + summary.debtReceiptsCents;
  summary.cashBalanceCents =
    summary.openingCents +
    summary.cashSalesCents +
    summary.cashDebtReceiptsCents -
    summary.outflowsCents;
  summary.averageTicket = summary.salesCount
    ? summary.salesTotalCents / 100 / summary.salesCount
    : 0;
  return summary;
}
async function loadDailyReport(db, date) {
  const day = date || businessDay();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    Number.isNaN(Date.parse(day + "T12:00:00Z"))
  ) {
    fail("Data inválida");
  }
  const collections = [
    "orders",
    "receipts",
    "historical_receipts",
    "cash_movements",
  ];
  const snaps = await Promise.all(
    collections.map((name) =>
      db.collection(name).where("businessDate", "==", day).get(),
    ),
  );
  return dailyMetrics({
    date: day,
    orders: snaps[0].docs.map((d) => d.data()),
    receipts: snaps[1].docs.map((d) => d.data()),
    historicalReceipts: snaps[2].docs.map((d) => d.data()),
    cashMovements: snaps[3].docs.map((d) => d.data()),
  });
}
module.exports = { businessDay, paymentKey, dailyMetrics, loadDailyReport };
