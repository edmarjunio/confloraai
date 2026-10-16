const MAX_WHATSAPP_MESSAGE_LENGTH = 3400;

const currency = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
}).format(Number(value || 0));

function safeText(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

function formatDate(date) {
  const [year, month, day] = String(date || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(date || '');
}

function section(title, lines) {
  return [`*${title}*`, ...lines];
}

function formatDailyExecutiveReport(metrics) {
  const byPayment = metrics.byPayment || {};
  const paymentNames = {
    PIX: 'Pix', DINHEIRO: 'Dinheiro', DEBITO: 'Cartão de débito',
    CREDITO: 'Cartão de crédito', CARTAO: 'Cartão (não especificado)',
    FIADO: 'Fiado', OUTROS: 'Outros',
  };
  const paymentTotal = (payment) => Number(payment?.total || 0);
  const paymentLines = Object.entries(paymentNames)
    .filter(([key]) => Number(byPayment[key]?.count || 0) > 0 || paymentTotal(byPayment[key]) > 0)
    .map(([key, label]) => {
      const payment = byPayment[key] || {};
      const percent = metrics.totalRevenue > 0 ? Math.round((paymentTotal(payment) / metrics.totalRevenue) * 100) : 0;
      return `• ${label}: ${currency(payment.total)} · ${payment.count || 0} venda(s) · ${percent}%`;
    });

  const productLines = (products) => products?.length
    ? products.map((product, index) => `${index + 1}. ${safeText(product.name)} — ${product.quantity} un. · ${currency(product.revenue)}`)
    : ['• Nenhum item vendido.'];

  const collaboratorLines = (metrics.byCollaborator || []).map((person) =>
    `• ${safeText(person.name)} (${safeText(person.role)}): ${person.count || 0} venda(s) · ${currency(person.total)} (${person.percentage || 0}%) | recebeu ${person.receivedCount || 0} · ${currency(person.receivedTotal)}`
  );

  const sections = [
    [
      `🌿 *CONFLORA · RESUMO DIÁRIO*`,
      `📅 ${formatDate(metrics.date)}`,
      '',
      `🧾 Vendas: *${metrics.orderCount || 0}* · Ticket médio: *${currency(metrics.ticketMedio)}*`,
      `💵 Total recebido em vendas: *${currency(metrics.totalReceivedSales)}*`,
      `📒 Caderno (fiados + recebimentos): *${currency(metrics.ledgerVolume)}*`,
      `🪴 Vendas registradas: *${currency(metrics.totalRevenue)}*`,
      '',
    ],
    section('CAIXA E RECEBIMENTOS', [
      `• Recebimento de dívidas: ${currency(metrics.debtReceived)}`,
      `• Vendas a receber (fiado): ${currency(metrics.onAccountSales)}`,
      `• Troco + vendas em dinheiro: ${currency(metrics.cashTendered)}`,
      `• Troco do dia: ${currency(metrics.changeGiven)}`,
      `• Vendas em dinheiro: ${currency(metrics.cashSales)}`,
      ...paymentLines,
    ]),
    section('5 MAIS VENDIDOS · QUANTIDADE', productLines(metrics.topProductsByQuantity)),
    section('5 MAIS VENDIDOS · VALOR', productLines(metrics.topProductsByValue)),
    section('VENDAS E RECEBIMENTOS · EQUIPE', collaboratorLines.length ? collaboratorLines : ['• Sem colaboradores cadastrados.']),
  ];

  const messages = [];
  let current = '';
  for (const lines of sections) {
    const text = lines.join('\n');
    const candidate = current ? `${current}\n\n${text}` : text;
    if (candidate.length <= MAX_WHATSAPP_MESSAGE_LENGTH) {
      current = candidate;
      continue;
    }
    if (current) { messages.push(current); }
    current = text;
    if (current.length > MAX_WHATSAPP_MESSAGE_LENGTH) {
      const header = lines[0];
      const rows = lines.slice(1);
      let block = header;
      for (const row of rows) {
        if ((block + '\n' + row).length > MAX_WHATSAPP_MESSAGE_LENGTH) {
          messages.push(block);
          block = `${header} (continuação)`;
        }
        block += `\n${row}`;
      }
      current = block;
    }
  }
  if (current) { messages.push(current); }
  return messages;
}

function normalizeWhatsAppNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const normalized = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return /^55\d{10,11}$/.test(normalized) ? normalized : '';
}

module.exports = { formatDailyExecutiveReport, normalizeWhatsAppNumber };
