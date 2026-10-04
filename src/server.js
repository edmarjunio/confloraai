const { createApp } = require("./http/app");
const {
  config,
  isProduction,
  validateBaseConfig,
  validateProductionConfig,
} = require("./config/env");
const logger = require("./shared/logger");

function validateEnvironment() {
  if (isProduction()) {
    validateProductionConfig();
  } else {
    validateBaseConfig();
  }
}

function startServer() {
  validateEnvironment();
  const app = createApp();

  app.listen(config.port, "0.0.0.0", () => {
    logger.info("Conflora AI iniciada", {
      port: config.port,
      environment: config.environment,
    });
  });
}

try {
  startServer();
} catch (error) {
  logger.error("Falha ao iniciar Conflora AI", {
    error: String(error?.message || error),
  });
  process.exitCode = 1;
}
