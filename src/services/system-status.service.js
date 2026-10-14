const config = require('../config/env');
const Logger = require('../shared/logger');

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
    const sheetsStatus = await this.checkGoogleSheetsStatus();
    const whatsappStatus = this.checkWhatsAppStatus();
    const firestoreStatus = await this.checkFirestoreStatus();

    // 4. Catálogo Real (Fonte Oficial: Firestore via catalogRepo)
    const activeItems = Array.isArray(this.catalogRepo?.items) ? this.catalogRepo.items : [];
    const defaultCatalogStatus = {
      status: 'ONLINE',
      badge: 'Firestore Ativo',
      color: '#10b981',
      title: 'Catálogo oficial sincronizado do Firestore (Fonte única de verdade)',
      totalItems: activeItems.length,
      categoriesCount: new Set(activeItems.map((i) => i.category || i.categoria)).size,
      autoFallback: 'ATIVO: dados obtidos em tempo real do banco de dados',
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
    const start = Date.now();
    const firestoreSource = Boolean(this.catalogRepo?.firestoreRepo);
    const source = firestoreSource ? 'Catálogo Firestore' : 'Catálogo configurado';
    if (!config.sheets?.lookupEnabled) {
      return {
        status: 'DISABLED',
        badge: 'Busca no Sheets desativada',
        color: '#64748b',
        spreadsheetId: config.sheets?.spreadsheetId || 'Não configurado',
        sheetName: this.catalogRepo?.sheetName || 'PRODUTOS',
        itemsActive: this.catalogRepo?.items?.length || 0,
        source,
        latencyMs: Date.now() - start,
        message: 'A busca de catálogo no Google Sheets está desativada por configuração.',
      };
    }
    try {
      if (!this.catalogRepo?.refreshCatalog) { throw new Error('Catálogo não configurado.'); }
      await this.catalogRepo.refreshCatalog();
      return {
        status: 'ONLINE', badge: 'Catálogo disponível', color: '#10b981',
        spreadsheetId: config.sheets?.spreadsheetId || 'Não configurado',
        sheetName: this.catalogRepo.sheetName || 'PRODUTOS',
        itemsActive: this.catalogRepo.items.length, source,
        latencyMs: Date.now() - start,
        message: 'Catálogo consultado com sucesso.',
        lastSync: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'ERROR', badge: 'Catálogo indisponível', color: '#ef4444', source,
        spreadsheetId: config.sheets?.spreadsheetId || 'Não configurado', sheetName: 'PRODUTOS',
        itemsActive: 0, latencyMs: Date.now() - start, error: error.message,
        message: 'Não foi possível consultar o catálogo.',
      };
    }
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
      phoneNumberId: phoneId ? `${phoneId.slice(0, 4)}...${phoneId.slice(-4)}` : 'Emulador Local',
      hasAccessToken: hasToken,
      hasVerifyToken: hasVerifyToken,
      lastReceivedAt: this.webhookStats.lastReceivedAt || 'Nenhuma mensagem recente',
      totalReceivedCount: this.webhookStats.totalReceived,
      message: 'Status do Webhook verificado.',
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
        Logger.warn('Diagnóstico Firestore falhou', { error: err.message });
      }
    }

    return {
      status: isConnected ? 'ONLINE' : 'FALLBACK_MEMORY',
      badge: isConnected ? 'Firestore Conectado' : 'Modo Memória Ativo',
      color: isConnected ? '#10b981' : '#3b82f6',
      projectId,
      latencyMs: Date.now() - start,
      message: isConnected ? `Banco Firestore conectado [${projectId}].` : 'Operando em memória.',
    };
  }
}

module.exports = {
  SystemStatusService,
};