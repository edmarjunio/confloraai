const fs = require('node:fs');
const path = require('node:path');

// Safely load environment variables from .env file
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch {
  // Silent fallback
}

const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  gcp: {
    projectId: process.env.GCP_PROJECT_ID || 'conflora-ai',
    region: process.env.GCP_REGION || 'southamerica-east1',
  },

  gemini: {
    location: process.env.GEMINI_LOCATION || 'global',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    apiKey: process.env.GEMINI_API_KEY || '',
  },

  sheets: {
    spreadsheetId: process.env.SPREADSHEET_ID || '1p9gVQkuZkVagi4gyP4Tp8fdItHm6W-wkT2osxTstQVU',
    sheetName: process.env.SHEET_NAME || 'PRODUTOS',
    cacheSeconds: parseInt(process.env.SHEETS_CACHE_SECONDS || '60', 10),
  },

  tasks: {
    queue: process.env.CLOUD_TASKS_QUEUE || 'conflora-jobs',
    serviceUrl: process.env.SERVICE_URL || '',
    followupSeconds: parseInt(process.env.FOLLOWUP_SECONDS || '3600', 10),
    taskSecret: process.env.TASK_SECRET || '',
  },

  whatsapp: {
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION || 'v21.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    token: process.env.WHATSAPP_TOKEN || '',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    metaAppSecret: process.env.META_APP_SECRET || '',
    ownerNumber: process.env.OWNER_WHATSAPP_NUMBER || '',
    templates: {
      orderNotification: process.env.OWNER_ORDER_TEMPLATE || 'nova_venda_conflora',
      receiptImage: process.env.OWNER_RECEIPT_IMAGE_TEMPLATE || 'comprovante_pix_imagem',
      receiptDocument: process.env.OWNER_RECEIPT_DOCUMENT_TEMPLATE || 'comprovante_pix_documento',
      language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR',
    },
  },

  pix: {
    key: process.env.PIX_KEY || 'conflora@exemplo.com.br',
    holder: process.env.PIX_TITULAR || 'Conflora Horta e Viveiro',
  },

  adminSecret: process.env.ADMIN_SECRET || '',
});

module.exports = config;
