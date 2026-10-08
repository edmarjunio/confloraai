const { t } = require('../i18n');
const config = require('../config/env');
const Logger = require('../shared/logger');
const { DEFAULT_CATALOG_ITEMS } = require('../catalog/default-catalog');

class SystemStatusService {
  constructor({ catalogRepo, firestoreRepo, whatsappClient }) {
    this.catalogRepo = catalogRepo;
    this.firestoreRepo = firestoreRepo;
    this.whatsappClient = whatsappClient;
    this.webhookStats = {
      lastReceivedAt: null,
      totalReceived: 0,
      lastSender: null,
    };
  }

  recordWebhookHit(senderPhone = '') {
    this.webhookStats.lastReceivedAt = new Date().toISOString();
    this.webhookStats.totalReceived += 1;
    this.webhookStats.lastSender = senderPhone;
  }

  async getSystemStatus() {
    const t0 = Date.now();

    // 1. Google Sheets status
    const sheetsStatus = await this.checkGoogleSheetsStatus();

    // 2. WhatsApp Webhook status
    const whatsappStatus = this.checkWhatsAppStatus();

    // 3. Firestore Database status
    const firestoreStatus = await this.checkFirestoreStatus();

    // 4. Default Catalog (Planilha Oficial LISTA DE PRODUTOS)
    const defaultCatalogStatus = {
      status: 'ONLINE',
      badge: 'Planilha Oficial Carregada',
      color: '#10b981',
      title: t("interface.message.ec570d76ace5"),
      totalItems: DEFAULT_CATALOG_ITEMS.length,
      categoriesCount: new Set(DEFAULT_CATALOG_ITEMS.map((i) => i.category || i.categoria)).size,
      autoFallback: t("interface.message.402e4e065e16"),
      lastVerified: new Date().toISOString(),
    };

    return {
      timestamp: new Date().toISOString(),
      overallStatus: (sheetsStatus.status.includes('ERROR') || whatsappStatus.status.includes('ERROR')) ? 'WARNING' : 'HEALTHY',
      diagnosticsDurationMs: Date.now() - t0,
      googleSheets: sheetsStatus,
      whatsapp: whatsappStatus,
      firestore: firestoreStatus,
      defaultCatalog: defaultCatalogStatus,
    };
  }

  async checkGoogleSheetsStatus() {
    const sheetId = config.sheets && config.sheets.spreadsheetId;
    const hasSheetId = Boolean(sheetId);
    const start = Date.now();

    if (!hasSheetId) {
      return {
        status: 'FALLBACK_OFFICIAL',
        badge: t("interface.message.1510672d2ee2"),
        color: '#10b981',
        spreadsheetId: t("interface.message.f57c8e75a070"),
        sheetName: 'PRODUTOS',
        itemsActive: this.catalogRepo ? this.catalogRepo.items.length : DEFAULT_CATALOG_ITEMS.length,
        source: 'Planilha Oficial Conflora (111 itens comerciais)',
        latencyMs: 1,
        message: t("interface.message.08b1a603fed8"),
        lastSync: new Date().toISOString(),
      };
    }

    try {
      if (this.catalogRepo && typeof this.catalogRepo.refreshCatalog === 'function') {
        await this.catalogRepo.refreshCatalog();
        const latency = Date.now() - start;
        return {
          status: 'ONLINE',
          badge: 'Conectado em Tempo Real',
          color: '#10b981',
          spreadsheetId: sheetId,
          sheetName: this.catalogRepo.sheetName || 'PRODUTOS',
          itemsActive: this.catalogRepo.items.length,
          source: 'Google Sheets API v4',
          latencyMs: latency,
          message: `${t("interface.message.2e1570b26355")}${this.catalogRepo.items.length}${t("interface.message.d3feb1f70ece")}`,
          lastSync: new Date().toISOString(),
        };
      }
    } catch (err) {
      return {
        status: 'FALLBACK_ERROR',
        badge: t("interface.message.aa80e258c4fd"),
        color: '#f59e0b',
        spreadsheetId: sheetId,
        sheetName: 'PRODUTOS',
        itemsActive: this.catalogRepo ? this.catalogRepo.items.length : DEFAULT_CATALOG_ITEMS.length,
        source: t("interface.message.956773fbc951"),
        latencyMs: Date.now() - start,
        error: err.message,
        message: `${t("interface.message.6c8497ea7074")}${err.message}${t("interface.message.8ce793a96b4c")}`,
        lastSync: new Date().toISOString(),
      };
    }

    return {
      status: 'FALLBACK_OFFICIAL',
      badge: t("interface.message.1510672d2ee2"),
      color: '#10b981',
      spreadsheetId: sheetId || 'N/A',
      sheetName: 'PRODUTOS',
      itemsActive: DEFAULT_CATALOG_ITEMS.length,
      source: 'Planilha Oficial Conflora',
      latencyMs: 1,
      message: 'Planilha oficial Conflora carregada.',
      lastSync: new Date().toISOString(),
    };
  }

  checkWhatsAppStatus() {
    const phoneId = config.whatsapp && config.whatsapp.phoneNumberId;
    const token = config.whatsapp && config.whatsapp.token;
    const verifyToken = config.whatsapp && config.whatsapp.verifyToken;

    const hasPhoneId = Boolean(phoneId);
    const hasToken = Boolean(token);
    const hasVerifyToken = Boolean(verifyToken);

    const isFullyConfigured = hasPhoneId && hasToken && hasVerifyToken;

    return {
      status: isFullyConfigured ? 'ONLINE' : 'LISTENING_LOCAL',
      badge: isFullyConfigured ? 'Webhook & Cloud API Prontos' : 'Webhook Ativo (Simulador / Testes)',
      color: isFullyConfigured ? '#10b981' : '#3b82f6',
      webhookRoute: '/webhook',
      phoneNumberId: phoneId
        ? `${phoneId.slice(0, 4)}...${phoneId.slice(-4)}`
        : 'Emulador Local (5564999351616)',
      hasAccessToken: hasToken,
      hasVerifyToken: hasVerifyToken,
      lastReceivedAt: this.webhookStats.lastReceivedAt || 'Nenhuma mensagem recente',
      totalReceivedCount: this.webhookStats.totalReceived,
      message: isFullyConfigured
        ? t("interface.message.a8f40d503cbd")
        : t("interface.message.e8ddc70c2dcb"),
    };
  }

  async checkFirestoreStatus() {
    const start = Date.now();
    let isConnected = false;
    const projectId = (config.gcp && config.gcp.projectId) || 'confloraai';

    if (this.firestoreRepo && this.firestoreRepo.firestore) {
      try {
        await this.firestoreRepo.firestore.collection('products').limit(2).get();
        isConnected = true;
      } catch (err) {
        Logger.warn(t("interface.message.238ff61935d2"), { error: err.message });
      }
    }

    return {
      status: isConnected ? 'ONLINE' : 'FALLBACK_MEMORY',
      badge: isConnected ? 'Firestore Conectado' : t("interface.message.fc1e827eaa86"),
      color: isConnected ? '#10b981' : '#3b82f6',
      projectId,
      latencyMs: Date.now() - start,
      message: isConnected
        ? `${t("interface.message.ca335cc846d0")}${projectId}].`
        : t("interface.message.f4b6db3df364"),
    };
  }
}

module.exports = {
  SystemStatusService,
};
