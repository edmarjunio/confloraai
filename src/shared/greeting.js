const { normalizeText } = require('./string.util');

const GREETING_REPLIES = new Map([
  ['oi', 'Olá!'],
  ['ola', 'Olá!'],
  ['opa', 'Olá!'],
  ['bom dia', 'Bom dia!'],
  ['boa tarde', 'Boa tarde!'],
  ['boa noite', 'Boa noite!'],
]);

/** Recognize standalone informal greetings without changing product queries. */
function recognizeGreeting(message) {
  const normalized = normalizeText(message)
    .replace(/([a-z])\1+/g, '$1')
    .replace(/ tudo bem$/, '');
  return GREETING_REPLIES.get(normalized) || null;
}

module.exports = { recognizeGreeting };
