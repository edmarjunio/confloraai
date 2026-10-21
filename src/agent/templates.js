'use strict';
const { formatBRL, formatQuantity, unitLabel } = require('./units');
const { safeDisplayText } = require('./util');

const ASK_MORE = 'Você precisa de mais algum produto?';

function title(product) {
  return product.presentation ? `${product.name} (${product.presentation})` : product.name;
}

function priceText(product) {
  return `${formatBRL(product.priceCents)} / ${unitLabel(product.unit)}`;
}

/** Bloco de preço. `availability` só é passada quando a disponibilidade foi verificada. */
function priceBlock(product, { availability } = {}) {
  const lines = [`🌿 *${product.name}*`];
  if (product.presentation) lines.push(product.presentation);
  lines.push(`💰 *${priceText(product)}*`);
  if (availability) lines.push(availability);
  return lines.join('\n');
}

function priceCards(entries) {
  return entries.map(({ product, availability }) => priceBlock(product, { availability })).join('\n\n');
}

function productList({ items, heading }) {
  const body = items.map((item, index) => `${index + 1}. *${title(item)}* — ${priceText(item)}`);
  return [safeDisplayText(heading, 60) || 'Opções cadastradas', ...body].join('\n');
}

function lineBlock(line) {
  return [
    `${formatQuantity(line.quantityMilli, line.unit)} × ${title(line)}`,
    `• Preço: ${priceText(line)}`,
    `• Subtotal: *${formatBRL(line.subtotalCents)}*`,
  ].join('\n');
}

function added(lines) {
  return `✅ *Adicionado ao carrinho*\n${lines.map(lineBlock).join('\n\n')}\n\n${ASK_MORE}`;
}

function quantityChanged(line) {
  return `✅ *Quantidade atualizada*\n${lineBlock(line)}\n\n${ASK_MORE}`;
}

function removed(line) {
  return `✅ *Item removido do carrinho*\n${title(line)}\n\n${ASK_MORE}`;
}

function cartSummary(lines, subtotalCents) {
  if (lines.length === 0) return '🛒 *Seu carrinho*\n\nSeu carrinho está vazio.';
  const body = lines.map((line, index) => (
    `${index + 1}. ${title(line)}\n   ${formatQuantity(line.quantityMilli, line.unit)} × ${priceText(line)} = ${formatBRL(line.subtotalCents)}`
  ));
  return `🛒 *Seu carrinho*\n\n${body.join('\n\n')}\n\n*Subtotal dos produtos: ${formatBRL(subtotalCents)}*`;
}

function priceChanges(changes) {
  const body = changes.map((c) => `• ${title(c)}: de ${formatBRL(c.oldPriceCents)} para ${formatBRL(c.newPriceCents)} / ${unitLabel(c.unit)}`);
  return `⚠️ *Os valores mudaram desde a sua consulta*\n${body.join('\n')}\n\nPosso seguir com os novos valores?`;
}

function checkoutSummary(lines, subtotalCents) {
  return `${cartSummary(lines, subtotalCents)}\n\nValores conferidos agora no cadastro.`;
}

module.exports = { priceBlock, priceCards, productList, added, quantityChanged, removed, cartSummary, priceChanges, checkoutSummary, ASK_MORE };
