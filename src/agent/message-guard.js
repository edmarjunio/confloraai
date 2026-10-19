'use strict';

/**
 * Validação final do texto que seria enviado ao cliente. Roda sobre o texto JÁ renderizado e o compara
 * com os fatos autorizados (valores em centavos retornados pelo backend). Também serve para validar texto
 * livre quando a plataforma permitir esse controle (a Meta Business Agent Platform não documenta esse gancho).
 */
const FORBIDDEN_TEXT = [
  /\bnão encontrei\b/i, /\baguarde\b/i, /\bvou verificar\b/i, /\bestou consultando\b/i, /\bvou chamar\b/i,
  /\.{3}|…/,
];
const INTERNAL_MARKERS = [
  /\{\{|\}\}|\$\{/, /\bundefined\b|\bnull\b|\bNaN\b|\[object /i,
  /\b(valor_num|stockQuantity|estoque|reservedQuantity|saleUnit|tagsAi|productId|STATUS|DESCRIÇÃO)\b/,
  /^\s*[{[]/, /\bat .*\.js:\d+/i, /[A-Za-z]:\\/,
];
const MONEY = /R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}/g;

function centsFromMoney(text) {
  const digits = text.replace(/[^\d,]/g, '').replace(',', '');
  return Number(digits);
}

/**
 * @param {string} message
 * @param {{allowedCents:number[]}} facts valores monetários autorizados (preço unitário e subtotais)
 * @returns {{ok:boolean, failures:string[]}}
 */
function verifyCustomerMessage(message, facts = { allowedCents: [] }) {
  const failures = [];
  if (typeof message !== 'string' || message.trim() === '') failures.push('empty_message');
  else {
    if (FORBIDDEN_TEXT.some((re) => re.test(message))) failures.push('forbidden_phrase');
    if (INTERNAL_MARKERS.some((re) => re.test(message))) failures.push('internal_or_placeholder_content');
    const allowed = new Set(facts.allowedCents ?? []);
    for (const found of message.match(MONEY) ?? []) {
      if (!allowed.has(centsFromMoney(found))) failures.push(`unauthorized_amount:${found}`);
    }
    if (message.length > 3500) failures.push('message_too_long');
  }
  return { ok: failures.length === 0, failures };
}

module.exports = { verifyCustomerMessage, FORBIDDEN_TEXT };
