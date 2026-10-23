const messages = require('../../src/i18n/messages.json');
const translations = Object.fromEntries(Object.entries(messages).map(([key, value]) => [key, value.pt]));
const script = `Object.defineProperty(String.prototype, 'tr', { configurable: true, get() {
  const translations = ${JSON.stringify(translations)};
  return translations[this.valueOf()] ?? this.valueOf();
} });\n`;
module.exports = { script };
