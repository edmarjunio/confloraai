require('../i18n/default');
// Conflora — Frente de Caixa & Balcão (PDV Oficial Com Flora)
// Exatamente igual ao projeto Figma para telas de Celular e Computador

const fs = require('node:fs');
const path = require('node:path');

function renderCaixaHtml() {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../public/pdv/dist/manifest.json'), 'utf8'));
  const html = fs.readFileSync(path.join(__dirname, 'views-caixa.html'), 'utf-8')
      .replace('__PDV_SCRIPT__', manifest.script).replace('__PDV_STYLES__', manifest.styles);
  return html.replace('__PIX_MODE__', JSON.stringify(require('../orders/pix-mode').pixMode()));
}

module.exports = {
  renderCaixaHtml,
};
