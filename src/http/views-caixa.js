// Conflora — Frente de Caixa & Balcão (PDV Oficial Com Flora)
// Exatamente igual ao projeto Figma para telas de Celular e Computador

const fs = require('node:fs');
const path = require('node:path');

let cachedHtml = null;

function renderCaixaHtml() {
  if (!cachedHtml || process.env.NODE_ENV === 'development') {
    cachedHtml = fs.readFileSync(path.join(__dirname, 'views-caixa.html'), 'utf-8');
  }
  return cachedHtml;
}

module.exports = {
  renderCaixaHtml,
};
