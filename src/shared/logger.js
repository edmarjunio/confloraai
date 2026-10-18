/**
 * Simple structured logger without exposing sensitive secrets.
 */
function redact(value, depth = 0) {
  if (depth > 6) return '[TRUNCATED]';
  if (value instanceof Error) return redact({ message: value.message, stack: value.stack }, depth + 1);
  if (Array.isArray(value)) return value.slice(0, 25).map(item => redact(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, item]) => [key, /password|pin(hash)?$|token|secret|authorization|certificate|privatekey|cpf|pixkey|customer(phone|email|name|address)|dataurl|^body$|^headers$/i.test(key) ? '[REDACTED]' : redact(item, depth + 1)]));
  if (typeof value === 'string') return value
    .replace(/(access_token|token|password)=([^&\s]+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\bEAA[a-zA-Z0-9]{30,}\b/g, '[REDACTED]')
    .replace(/data:[^;\s]+;base64,[a-zA-Z0-9+/=]+/g, '[FILE_REDACTED]')
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[EMAIL]')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[DOCUMENT]')
    .replace(/(?:\+?55\s*)?\(?\d{2}\)?[ -]+\d{4,5}[ -]\d{4}\b/g, '[PHONE]')
    .replace(/\b\d{10,14}\b/g, '[PHONE_OR_DOCUMENT]').slice(0, 6000);
  if (typeof value === 'bigint') return value.toString();
  return value;
}
class Logger {
  static setErrorSink(sink) { this.errorSink = sink; }
  static info(message, metadata = {}) {
    console.log(JSON.stringify(redact({ level: 'INFO', timestamp: new Date().toISOString(), message, ...metadata })));
  }

  static warn(message, metadata = {}) {
    console.warn(JSON.stringify(redact({ level: 'WARN', timestamp: new Date().toISOString(), message, ...metadata })));
  }

  static error(message, error = null, metadata = {}) {
    const details = error instanceof Error ? { error: { message: error.message, stack: error.stack } } : error && typeof error === 'object' ? error : {};
    const record = redact({
        level: 'ERROR',
        timestamp: new Date().toISOString(),
        message,
        ...details,
        ...metadata,
      });
    console.error(JSON.stringify(record));
    if (this.errorSink) {
      try { Promise.resolve(this.errorSink(record)).catch(() => {}); } catch { /* Logging must never fail a sale. */ }
    }
  }

  static debug(message, metadata = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify(redact({ level: 'DEBUG', timestamp: new Date().toISOString(), message, ...metadata })));
    }
  }
}

module.exports = Logger;
module.exports.redact = redact;
