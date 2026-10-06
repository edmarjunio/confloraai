/**
 * Simple structured logger without exposing sensitive secrets.
 */
class Logger {
  static info(message, metadata = {}) {
    console.log(JSON.stringify({ level: 'INFO', timestamp: new Date().toISOString(), message, ...metadata }));
  }

  static warn(message, metadata = {}) {
    console.warn(JSON.stringify({ level: 'WARN', timestamp: new Date().toISOString(), message, ...metadata }));
  }

  static error(message, error = null, metadata = {}) {
    console.error(
      JSON.stringify({
        level: 'ERROR',
        timestamp: new Date().toISOString(),
        message,
        error: error ? { message: error.message, stack: error.stack } : undefined,
        ...metadata,
      })
    );
  }

  static debug(message, metadata = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({ level: 'DEBUG', timestamp: new Date().toISOString(), message, ...metadata }));
    }
  }
}

module.exports = Logger;
