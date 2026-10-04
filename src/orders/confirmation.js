const { normalizeText } = require("../shared/text");

const UNCERTAIN_TERMS = [
  "acho",
  "talvez",
  "vou pensar",
  "depois",
  "nao sei",
  "pode ser que",
  "se der",
];

const EXACT_CONFIRMATIONS = new Set([
  "sim",
  "confirmo",
  "confirmado",
  "fechado",
  "esta certo",
  "ta certo",
  "tudo certo",
  "correto",
  "pode fechar",
  "pode finalizar",
  "pode formalizar",
  "pode seguir",
  "pode confirmar",
  "pode fazer",
  "pode concluir",
]);

const CONFIRMATION_PHRASES = [
  "pode fechar",
  "pode finalizar",
  "pode formalizar",
  "pode confirmar",
  "confirmo o pedido",
  "pedido confirmado",
  "pode seguir com o pedido",
  "pode concluir o pedido",
];

function isExplicitConfirmation(message) {
  const text = normalizeText(message);
  if (!text) {
    return false;
  }
  if (UNCERTAIN_TERMS.some((term) => text.includes(term))) {
    return false;
  }
  if (EXACT_CONFIRMATIONS.has(text)) {
    return true;
  }
  return CONFIRMATION_PHRASES.some((term) => text.includes(term));
}

module.exports = { isExplicitConfirmation };
