const PDFDocument = require('pdfkit');

const money = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const labels = { PIX: 'Pix', DINHEIRO: 'Dinheiro', DEBITO: 'Cartão de débito', CREDITO: 'Cartão de crédito', SALDO_CLIENTE: 'Crédito do cliente', FIADO: 'Fiado' };
const clean = value => String(value || '').replace(/[\x00-\x1f]/g, ' ').slice(0, 400);

/** An authenticated, in-memory snapshot. Never writes financial PDFs publicly. */
function createCashierSnapshotPdf(snapshot, user, issuedAt = new Date()) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true, info: { Title: 'Relatório do caixa - Conflora', Author: 'Conflora Horta e Viveiro' } });
    const buffers = [];
    doc.on('data', chunk => buffers.push(chunk)); doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    const width = doc.page.width - 84;
    const line = (text, { bold = false, size = 10, color = '#20392d' } = {}) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size);
      const height = doc.heightOfString(clean(text), { width });
      if (doc.y + height > doc.page.height - 70) doc.addPage();
      doc.fillColor(color).text(clean(text), 42, doc.y, { width }); doc.moveDown(0.5);
    };
    const section = text => { doc.moveDown(0.7); line(text, { bold: true, size: 13, color: '#087c3a' }); };
    line('CONFLORA HORTA E VIVEIRO', { bold: true, size: 12, color: '#087c3a' });
    line('Relatório do caixa', { bold: true, size: 25 });
    line(user.role === 'ADMIN' ? 'Caixa geral da loja' : 'Caixa de ' + clean(user.name), { bold: true, size: 13 });
    line('Período: ' + snapshot.range.from.split('-').reverse().join('/') + ' a ' + snapshot.range.to.split('-').reverse().join('/'));
    line('Emitido em ' + issuedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' (Brasília) por ' + clean(user.name), { size: 9, color: '#607366' });
    line('Parcial até a emissão. Este relatório não encerra o caixa.', { size: 9, color: '#607366' });
    section('Resumo dos recebimentos');
    for (const [label, value] of [
      ['Recebido em vendas', snapshot.closing.salesReceived],
      ['Recebimentos de clientes (fiados e créditos antecipados)', snapshot.closing.debtReceived],
      ['TOTAL RECEBIDO', snapshot.closing.totalReceived],
      ['Crédito do cliente utilizado (não é novo recebimento)', snapshot.closing.customerCreditUsed],
      ['Fiado aprovado no período (não recebido)', snapshot.closing.confirmedDebt],
    ]) line(label + ': ' + money(value), { bold: label === 'TOTAL RECEBIDO', size: label === 'TOTAL RECEBIDO' ? 16 : 10 });
    line('Vendas recebidas: ' + snapshot.closing.orderCount + ' | Recebimentos de clientes: ' + snapshot.closing.debtSettlementCount);
    section('Por forma de pagamento');
    for (const [method, totals] of Object.entries(snapshot.closing.byPayment)) {
      line((labels[method] || method) + ': vendas ' + money(totals.sales) + ' | clientes ' + money(totals.debt) + ' | total ' + money(totals.total));
    }
    section('Vendas e recebimentos registrados');
    if (!snapshot.cashierOrders.length) line('Nenhuma venda recebida neste período.');
    for (const order of snapshot.cashierOrders) {
      const parts = order.paymentParts || [{ method: order.paymentMethod, amount: order.total }];
      line('#' + (order.ticketNumber || order.id) + ' - ' + (order.customerName || 'Cliente Balcão'), { bold: true });
      line('Venda: ' + (order.createdBy?.name || 'Catálogo online') + ' | Recebimento: ' + (order.receivedBy?.name || 'Confirmação automática'), { size: 9 });
      line(parts.map(part => (labels[part.method] || part.method) + ' ' + money(part.amount)).join(' | '), { size: 9 });
      for (const item of order.items || []) line('  ' + item.quantity + ' x ' + clean(item.name), { size: 9, color: '#607366' });
    }
    section('Recebimentos de clientes');
    if (!snapshot.cashierSettlements.length) line('Nenhum recebimento de cliente neste período.');
    for (const row of snapshot.cashierSettlements) {
      line((row.customerName || row.customerId || 'Cliente') + ' - ' + money(row.amount), { bold: true });
      line((row.entryType === 'ENCOMENDA_SINAL' ? 'Sinal de encomenda' : row.entryType === 'CREDITO_CLIENTE' ? 'Crédito antecipado' : 'Quitação de fiado') + ' | ' + (row.paymentParts || [{ method: row.paymentMethod, amount: row.amount }]).map(part => (labels[part.method] || part.method) + ' ' + money(part.amount)).join(' | '), { size: 9 });
    }
    const range = doc.bufferedPageRange();
    for (let index = 0; index < range.count; index++) {
      doc.switchToPage(index); doc.font('Helvetica').fontSize(8).fillColor('#607366');
      doc.text('Conflora - Relatório reservado | Página ' + (index + 1) + ' de ' + range.count, 42, doc.page.height - 58, { width, lineBreak: false });
    }
    doc.end();
  });
}
module.exports = { createCashierSnapshotPdf };
