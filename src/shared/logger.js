function sanitizeContext(context = {}) {
  const clone = { ...context };
  for (const key of Object.keys(clone)) {
    if (/token|secret|authorization|senha|password/i.test(key)) {
      clone[key] = "[REDACTED]";
    }
  }
  return clone;
}

function write(level, message, context = {}) {
  const payload = {
    severity: level.toUpperCase(),
    message,
    timestamp: new Date().toISOString(),
    ...sanitizeContext(context),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    return console.error(line);
  }
  if (level === "warn") {
    return console.warn(line);
  }
  return console.log(line);
}

module.exports = {
  info: (message, context) => write("info", message, context),
  warn: (message, context) => write("warn", message, context),
  error: (message, context) => write("error", message, context),
};
