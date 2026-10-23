const messages = require('./messages.json');

/** Server-rendered pages start in Portuguese; the browser applies the saved language. */
function translateDefault(key) { return messages[key]?.pt ?? String(key); }
if (!Object.getOwnPropertyDescriptor(String.prototype, 'tr')) {
  Object.defineProperty(String.prototype, 'tr', { configurable: true, enumerable: false,
    get() { return translateDefault(this.valueOf()); } });
}
module.exports = { translateDefault };
