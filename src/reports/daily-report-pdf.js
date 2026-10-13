const fs = require('node:fs');
const path = require('node:path');
const PDFDocument = require('pdfkit');

/**
 * Formata valor monetário BRL
 */
function formatBrl(val) {
  return 'R$ ' + Number(val || 0).toFixed(2).replace('.', ',');
}

/**
 * Gera um documento PDF executivo de fechamento de caixa diário.
 * Salva o arquivo em public/reports/ e retorna o caminho e a URL relativa.
 *
 * @param {Object} metrics - Métricas gerenciais calculadas do dia
 * @param {Object} [meta] - Metadados do fechamento (data, operador, observações)
 * @returns {Promise<{ filePath: string, publicUrl: string, buffer: Buffer }>}
 */
async function generateDailyReportPdf(metrics, meta = {}) {
  const dateStr = meta.date || new Date().toISOString().slice(0, 10);
  const [year, month, day] = dateStr.split('-');
  const formattedDate = `${day}/${month}/${year}`;
  const closedBy = meta.closedBy || 'Administrador / Caixa';
  const closedAt = meta.closedAt || new Date().toLocaleTimeString('pt-BR');

  const reportsDir = path.resolve(process.cwd(), 'public/reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const fileName = `fechamento-caixa-${dateStr}.pdf`;
  const filePath = path.join(reportsDir, fileName);
  const publicUrl = `/reports/${fileName}`;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        info: {
          Title: `Fechamento de Caixa - ${formattedDate}`,
          Author: 'Conflora Horta e Viveiro & Agromadeiras',
          Subject: 'Relatório Executivo Diário',
        },
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        try {
          fs.writeFileSync(filePath, pdfData);
          resolve({ filePath, publicUrl, buffer: pdfData });
        } catch (err) {
          reject(err);
        }
      });

      // --- CABEÇALHO EXECUTIVO ---
      doc.rect(40, 40, 515, 65).fill('#15803d');
      doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
        .text('CONFLORA HORTA E VIVEIRO & AGROMADEIRAS', 55, 52, { align: 'left' });
      doc.fontSize(10).font('Helvetica')
        .text('Relatório Executivo Gerencial · Fechamento do Caixa', 55, 75);
      doc.fontSize(9).font('Helvetica-Bold')
        .text(`DATA: ${formattedDate}  |  HORÁRIO: ${closedAt}`, 55, 88);

      let currentY = 120;

      // --- CARDS PRINCIPAIS (VALORES DO DIA) ---
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold')
        .text('VALORES DO DIA · CONSOLIDADO', 40, currentY);
      currentY += 20;

      const cardWidth = 120;
      const cardHeight = 55;
      const cards = [
        { label: 'FATURAMENTO TOTAL', val: formatBrl(metrics.totalRevenue), bg: '#ecfdf5', color: '#166534' },
        { label: 'TOTAL DE VENDAS', val: `${metrics.orderCount || 0} pedidos`, bg: '#eff6ff', color: '#1e40af' },
        { label: 'TICKET MÉDIO', val: formatBrl(metrics.ticketMedio), bg: '#fef3c7', color: '#92400e' },
        { label: 'RESPONSÁVEL', val: String(closedBy).slice(0, 16), bg: '#f1f5f9', color: '#334155' },
      ];

      cards.forEach((c, idx) => {
        const x = 40 + idx * 131;
        doc.roundedRect(x, currentY, cardWidth, cardHeight, 6).fill(c.bg);
        doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold')
          .text(c.label, x + 8, currentY + 10);
        doc.fillColor(c.color).fontSize(12).font('Helvetica-Bold')
          .text(c.val, x + 8, currentY + 28);
      });

      currentY += cardHeight + 25;

      // --- FORMAS DE PAGAMENTO ---
      doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold')
        .text('FATURAMENTO POR FORMA DE PAGAMENTO', 40, currentY);
      currentY += 16;

      const pPix = metrics.byPayment?.PIX || { total: 0, count: 0 };
      const pCartao = metrics.byPayment?.CARTAO || { total: 0, count: 0 };
      const pDinheiro = metrics.byPayment?.DINHEIRO || { total: 0, count: 0 };

      const payments = [
        { method: '📱 PIX Instantâneo', count: pPix.count || 0, val: formatBrl(pPix.total || 0), pct: metrics.totalRevenue > 0 ? Math.round(((pPix.total || 0) / metrics.totalRevenue) * 100) : 0 },
        { method: '💳 Cartão (Débito/Crédito)', count: pCartao.count || 0, val: formatBrl(pCartao.total || 0), pct: metrics.totalRevenue > 0 ? Math.round(((pCartao.total || 0) / metrics.totalRevenue) * 100) : 0 },
        { method: '💵 Dinheiro em Espécie', count: pDinheiro.count || 0, val: formatBrl(pDinheiro.total || 0), pct: metrics.totalRevenue > 0 ? Math.round(((pDinheiro.total || 0) / metrics.totalRevenue) * 100) : 0 },
      ];

      // Tabela de Pagamentos
      doc.rect(40, currentY, 515, 20).fill('#f8fafc');
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold')
        .text('FORMA DE PAGAMENTO', 50, currentY + 6)
        .text('QTD PEDIDOS', 260, currentY + 6)
        .text('TOTAL FATURADO', 370, currentY + 6)
        .text('PARTICIPAÇÃO', 470, currentY + 6);
      currentY += 22;

      payments.forEach((p) => {
        doc.rect(40, currentY, 515, 20).stroke('#e2e8f0');
        doc.fillColor('#0f172a').fontSize(9).font('Helvetica')
          .text(p.method, 50, currentY + 5)
          .text(`${p.count}`, 260, currentY + 5)
          .text(p.val, 370, currentY + 5)
          .text(`${p.pct}%`, 470, currentY + 5);
        currentY += 20;
      });

      currentY += 20;

      // --- DESEMPENHO POR COLABORADOR ---
      doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold')
        .text('VOLUME DE VENDAS E RECEITA POR COLABORADOR', 40, currentY);
      currentY += 16;

      doc.rect(40, currentY, 515, 20).fill('#f8fafc');
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold')
        .text('COLABORADOR / VENDEDOR', 50, currentY + 6)
        .text('ATENDIMENTOS', 260, currentY + 6)
        .text('TOTAL VENDIDO', 370, currentY + 6)
        .text('% DO DIA', 470, currentY + 6);
      currentY += 22;

      const collabs = (metrics.byCollaborator || []).slice(0, 8);
      if (collabs.length === 0) {
        doc.fillColor('#64748b').fontSize(9).font('Helvetica')
          .text('Nenhuma venda atribuída no período.', 50, currentY + 5);
        currentY += 20;
      } else {
        collabs.forEach((c) => {
          doc.rect(40, currentY, 515, 20).stroke('#e2e8f0');
          doc.fillColor('#0f172a').fontSize(9).font('Helvetica')
            .text(`👤 ${c.name}`, 50, currentY + 5)
            .text(`${c.count}`, 260, currentY + 5)
            .text(formatBrl(c.total), 370, currentY + 5)
            .text(`${c.percentage || 0}%`, 470, currentY + 5);
          currentY += 20;
        });
      }

      currentY += 20;

      // --- RANKING DOS PRODUTOS MAIS VENDIDOS ---
      doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold')
        .text('RANKING DOS PRODUTOS MAIS VENDIDOS NO DIA', 40, currentY);
      currentY += 16;

      doc.rect(40, currentY, 515, 20).fill('#f8fafc');
      doc.fillColor('#475569').fontSize(8.5).font('Helvetica-Bold')
        .text('PRODUTO / ITEM', 50, currentY + 6)
        .text('CATEGORIA', 260, currentY + 6)
        .text('QTD VENDIDA', 380, currentY + 6)
        .text('TOTAL (R$)', 470, currentY + 6);
      currentY += 22;

      const topProds = (metrics.topProducts || []).slice(0, 10);
      if (topProds.length === 0) {
        doc.fillColor('#64748b').fontSize(9).font('Helvetica')
          .text('Nenhum produto registrado no período.', 50, currentY + 5);
        currentY += 20;
      } else {
        topProds.forEach((item, i) => {
          doc.rect(40, currentY, 515, 18).stroke('#f1f5f9');
          doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica')
            .text(`${i + 1}º ${item.name.slice(0, 30)}`, 50, currentY + 4)
            .text((item.category || 'Geral').slice(0, 18), 260, currentY + 4)
            .text(`${item.quantity}`, 380, currentY + 4)
            .text(formatBrl(item.revenue), 470, currentY + 4);
          currentY += 18;
        });
      }

      // --- RODAPÉ OFICIAL ---
      doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
        .text(`Relatório gerado automaticamente pelo Sistema Conflora AI em ${new Date().toLocaleString('pt-BR')}. Autenticado para a diretoria.`, 40, 780, { align: 'center', width: 515 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateDailyReportPdf,
  formatBrl,
};
