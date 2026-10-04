require("dotenv").config();

const { onlyDigits } = require("../shared/text");

function string(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function number(name, fallback) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const config = Object.freeze({
  environment: string("NODE_ENV", "development"),
  port: number("PORT", 8080),
  projectId: string("GCP_PROJECT_ID", "conflora-ai"),
  region: string("GCP_REGION", "southamerica-east1"),

  gemini: Object.freeze({
    location: string("GEMINI_LOCATION", "global"),
    model: string("GEMINI_MODEL", "gemini-3.7-flash"),
  }),

  sheets: Object.freeze({
    spreadsheetId: string("SPREADSHEET_ID"),
    sheetName: string("SHEET_NAME", "PRODUTOS"),
    cacheSeconds: number("SHEETS_CACHE_SECONDS", 60),
  }),

  tasks: Object.freeze({
    queue: string("CLOUD_TASKS_QUEUE", "conflora-jobs"),
    serviceUrl: string("SERVICE_URL").replace(/\/$/, ""),
    secret: string("TASK_SECRET"),
    followupSeconds: number("FOLLOWUP_SECONDS", 3600),
  }),

  whatsapp: Object.freeze({
    graphVersion: string("WHATSAPP_GRAPH_VERSION"),
    phoneNumberId: string("WHATSAPP_PHONE_NUMBER_ID"),
    token: string("WHATSAPP_TOKEN"),
    verifyToken: string("WHATSAPP_VERIFY_TOKEN"),
    appSecret: string("META_APP_SECRET"),
    ownerNumber: onlyDigits(string("OWNER_WHATSAPP_NUMBER")),
    orderTemplate: string("OWNER_ORDER_TEMPLATE", "nova_venda_conflora"),
    receiptImageTemplate: string(
      "OWNER_RECEIPT_IMAGE_TEMPLATE",
      "comprovante_pix_imagem",
    ),
    receiptDocumentTemplate: string(
      "OWNER_RECEIPT_DOCUMENT_TEMPLATE",
      "comprovante_pix_documento",
    ),
    templateLanguage: string("WHATSAPP_TEMPLATE_LANGUAGE", "pt_BR"),
  }),

  pix: Object.freeze({
    key: string("PIX_KEY"),
    holder: string("PIX_TITULAR"),
  }),

  adminSecret: string("ADMIN_SECRET"),
});

function isProduction() {
  return config.environment === "production";
}

function assertRequired(entries) {
  const missing = entries.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    throw new Error(`Variáveis obrigatórias ausentes: ${missing.join(", ")}`);
  }
}

function validateBaseConfig() {
  assertRequired([
    ["GCP_PROJECT_ID", config.projectId],
    ["SPREADSHEET_ID", config.sheets.spreadsheetId],
  ]);
}

function validateProductionConfig() {
  validateBaseConfig();
  assertRequired([
    ["SERVICE_URL", config.tasks.serviceUrl],
    ["TASK_SECRET", config.tasks.secret],
    ["WHATSAPP_GRAPH_VERSION", config.whatsapp.graphVersion],
    ["WHATSAPP_PHONE_NUMBER_ID", config.whatsapp.phoneNumberId],
    ["WHATSAPP_TOKEN", config.whatsapp.token],
    ["WHATSAPP_VERIFY_TOKEN", config.whatsapp.verifyToken],
    ["META_APP_SECRET", config.whatsapp.appSecret],
    ["OWNER_WHATSAPP_NUMBER", config.whatsapp.ownerNumber],
    ["PIX_KEY", config.pix.key],
    ["PIX_TITULAR", config.pix.holder],
    ["ADMIN_SECRET", config.adminSecret],
  ]);
}

module.exports = {
  config,
  isProduction,
  validateBaseConfig,
  validateProductionConfig,
};
