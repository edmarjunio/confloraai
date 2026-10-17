const fs = require('node:fs');
const path = require('node:path');
const { validateDevEnvironment } = require('./dev-environment');

// Safely load environment variables from .env file
try {
  const envPath = path.resolve(process.cwd(), process.env.CONFLORA_ENV_FILE ||
    (process.env.APP_ENV === 'dev' ? '.env.dev' : '.env'));
  const hasExplicitEnvMode = Boolean(process.env.CONFLORA_ENV_FILE || process.env.APP_ENV === 'dev');
  const shouldLoadLocalEnv = !process.env.K_SERVICE && (process.env.NODE_ENV !== 'test' || hasExplicitEnvMode);
  if (shouldLoadLocalEnv && fs.existsSync(envPath)) {
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

let serviceAccountKeyPath = null;
let serviceAccountProjectId = null;
try {
  const possibleSaPath = path.resolve(process.cwd(), 'firebase-service-account.json');
  if (fs.existsSync(possibleSaPath)) {
    serviceAccountKeyPath = possibleSaPath;
    const saData = JSON.parse(fs.readFileSync(possibleSaPath, 'utf-8'));
    if (saData.project_id) {
      serviceAccountProjectId = saData.project_id;
    }
  }
} catch {
  // Silent fallback
}

const config = Object.freeze({
  appEnvironment: process.env.APP_ENV || 'production',
  env: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') === 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  gcp: {
    projectId: process.env.GCP_PROJECT_ID || serviceAccountProjectId || 'confloraai',
    region: process.env.GCP_REGION || 'southamerica-east1',
    keyFilename: serviceAccountKeyPath,
  },

  gemini: {
    location: process.env.GEMINI_LOCATION || 'global',
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    apiKey: process.env.GEMINI_API_KEY || '',
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
    assistantEnabled: process.env.WHATSAPP_AI_ENABLED === 'true',
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || '',
    metaAppSecret: process.env.META_APP_SECRET || '',
    ownerNumber: process.env.OWNER_WHATSAPP_NUMBER || '',
    templates: {
      orderNotification: process.env.OWNER_ORDER_TEMPLATE || 'nova_venda_conflora',
      receiptImage: process.env.OWNER_RECEIPT_IMAGE_TEMPLATE || 'comprovante_pix_imagem',
      receiptDocument: process.env.OWNER_RECEIPT_DOCUMENT_TEMPLATE || 'comprovante_pix_documento',
      customerOrder: process.env.WHATSAPP_CUSTOMER_ORDER_TEMPLATE || '',
      language: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR',
    },
  },

  mercadoPago: {
    accessToken: (process.env.MERCADO_PAGO_ACCESS_TOKEN || '').trim(),
    webhookSecret: (process.env.MERCADO_PAGO_WEBHOOK_SECRET || '').trim(),
    expectedLiveMode: process.env.MERCADO_PAGO_EXPECT_LIVE_MODE === 'true' ? true :
      process.env.MERCADO_PAGO_EXPECT_LIVE_MODE === 'false' ? false : null,
  },

  sicredi: {
    baseUrl: process.env.SICREDI_PIX_BASE_URL || 'https://api-pix.sicredi.com.br/api/v2',
    authUrl: process.env.SICREDI_OAUTH_URL || 'https://api-pix.sicredi.com.br/oauth/token',
    clientId: (process.env.SICREDI_CLIENT_ID || '').trim(),
    clientSecret: (process.env.SICREDI_CLIENT_SECRET || '').trim(),
    certificate: process.env.SICREDI_CERT_PEM || '',
    privateKey: process.env.SICREDI_KEY_PEM || '',
    pixKey: (process.env.SICREDI_PIX_KEY || '').trim(),
    beneficiario: process.env.SICREDI_BENEFICIARIO || process.env.PIX_TITULAR || 'Conflora Horta e Viveiro',
    cidade: process.env.SICREDI_CIDADE || 'Mineiros',
    webhookSecret: (process.env.SICREDI_WEBHOOK_SECRET || '').trim(),
  },

  pix: {
    key: process.env.SICREDI_PIX_KEY || process.env.PIX_KEY || '64999351616',
    holder: process.env.SICREDI_BENEFICIARIO || process.env.PIX_TITULAR || 'Conflora Horta e Viveiro',
  },

  adminSecret: process.env.ADMIN_SECRET || '',
  maps: {
    apiKey: process.env.NODE_ENV === 'test' ? '' : String(process.env.GOOGLE_MAPS_API_KEY || '').trim(),
    storeLat: parseFloat(process.env.STORE_LAT || '-17.5694'),
    storeLng: parseFloat(process.env.STORE_LNG || '-52.5511'),
    storeName: process.env.STORE_NAME || 'Conflora Horta e Viveiro',
    storeAddress: process.env.STORE_ADDRESS || 'Mineiros - GO',
  },
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID || serviceAccountProjectId || 'confloraai',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT_ID || serviceAccountProjectId || 'confloraai'}.firebasestorage.app`,
    appId: process.env.FIREBASE_APP_ID || '',
  },
});

const credentialProjects = serviceAccountProjectId ? [serviceAccountProjectId] : [];
if (config.appEnvironment === 'dev') {
  if (serviceAccountKeyPath && !serviceAccountProjectId) {
    throw new Error('Credencial local sem projeto válido no ambiente dev.');
  }
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credential = JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
    if (!credential.project_id) {throw new Error('Credencial explícita do dev exige project_id.');}
    credentialProjects.push(credential.project_id);
  }
}
validateDevEnvironment(config, credentialProjects);

module.exports = config;

