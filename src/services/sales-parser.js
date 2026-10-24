const { normalizeText } = require('../shared/string.util');
const { parseRequest } = require('./order-intake.service');

/** Language only. Product identity and every commercial value belong to the backend. */
function parseSalesMessage(message, state) {
  const cleaned = String(message || '').replace(/^(?:ol[aá]|oi|bom dia|boa tarde|boa noite)[!,\s]+/i, '').trim();
  const text = normalizeText(cleaned);
  const details = {};
  if (/\b(retirada|retirar|buscar na loja)\b/.test(text)) details.fulfillment = 'PICKUP';
  else if (/\bentrega\b/.test(text)) details.fulfillment = 'DELIVERY';
  if (/\bpix\b/.test(text)) details.paymentMethod = 'PIX';
  else if (/\bdinheiro\b/.test(text)) details.paymentMethod = 'DINHEIRO';
  else if (/\bdebito\b/.test(text)) details.paymentMethod = 'DEBITO';
  else if (/\b(credito|cartao)\b/.test(text)) details.paymentMethod = 'CREDITO';
  if (/^(sim|confirmo|confirmar|pode fechar|pode confirmar|pode registrar|quero encomendar)[.!\s]*$/.test(text)) return { action: 'confirm', items: [], ...details };
  if (/^(nao|agora nao|alterar pedido)$/.test(text)) return { action: 'decline', items: [] };
  if (/^(cancelar|cancela)( pedido)?$/.test(text)) return { action: 'cancel', items: [] };
  if (state?.stage === 'ADDRESS') {
    if (Object.keys(details).length && !/\b(rua|avenida|av|bairro|travessa|estrada|rodovia)\b/.test(text)) return { action: 'update', items: [], ...details };
    return { action: 'update', items: [], address: String(message).trim() };
  }
  const missing = state?.items?.filter(item => item.quantity === null) || [];
  if (/^\d+$/.test(text) && missing.length === 1) return { action: 'update', items: [{ name: missing[0].requestedName, quantity: Number(text), operation: 'set' }], ...details };
  const choice = state?.items?.find(item => item.fulfillment === 'CHOICE' && item.choices.some(value => normalizeText(value) === text));
  if (choice) return { action: 'update', items: [{ name: String(message).trim(), quantity: choice.quantity, operation: 'set' }], ...details };
  const operation = /^(adiciona|adicionar|acrescenta|mais)\b/.test(text) ? 'add' : /^(tira|tirar|remove|remover)\b/.test(text) ? 'remove' : 'set';
  const productText = cleaned.replace(/^(?:mais|acrescenta|remove|remover)\s+/i, 'quero ')
    .replace(/\bmais\s+/i, '').replace(/\b(?:um|uma)\s+/i, '1 ')
    .replace(/\s+(?:e\s+)?(?:retirada|entrega|pix|dinheiro|d[eé]bito|cr[eé]dito|cart[aã]o)(?:\s+e\s+(?:pix|dinheiro|d[eé]bito|cr[eé]dito|cart[aã]o))?\s*$/i, '');
  const parsed = parseRequest(productText);
  if (parsed) return { action: 'update', query: parsed.query, items: parsed.items.map(item => ({ ...item, name: item.requestedName, operation })), ...details };
  if (Object.keys(details).length && /^(?:quero |prefiro )?(?:retirada|retirar|entrega|pix|dinheiro|debito|credito|cartao)(?: e (?:pix|dinheiro|debito|credito|cartao))?$/.test(text)) return { action: 'update', items: [], ...details };
  return null;
}
module.exports = { parseSalesMessage };
