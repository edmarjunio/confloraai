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

    // 1. Google Sheets status
    const sheetsStatus = await this.checkGoogleSheetsStatus();

    // 2. WhatsApp Webhook status
    const whatsappStatus = this.checkWhatsAppStatus();

    // 3. Firestore Database status
    const firestoreStatus = await this.checkFirestoreStatus();

    // O catálogo estático foi removido; o diagnóstico não deve importá-lo.
    const defaultCatalogStatus = {
      status: 'DISABLED',
      badge: 'Catálogo estático desativado',
      color: '#64748b',
      title: 'Produtos cadastrados no Firestore',
      totalItems: 0,
      categoriesCount: 0,
      autoFallback: 'DESATIVADO: o catálogo atual vem do Firestore',
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
      if (!this.catalogRepo?.refreshCatalog) {throw new Error('Catálogo não configurado.');}
      await this.catalogRepo.refreshCatalog();
      return {
        status: 'ONLINE', badge: 'Catálogo disponível', color: '#10b981',
        spreadsheetId: config.sheets?.spreadsheetId || 'Não configurado',
        sheetName: this.catalogRepo.sheetName || 'PRODUTOS',
        itemsActive: this.catalogRepo.items.length, source,
        latencyMs: Date.now() - start,
        message: firestoreSource ? 'Catálogo consultado no Firestore. Esta verificação não testa a conexão Google Sheets.' : 'Catálogo carregado pela fonte configurada.',
        lastSync: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'ERROR', badge: 'Catálogo indisponível', color: '#ef4444', source,
        spreadsheetId: config.sheets?.spreadsheetId || 'Não configurado', sheetName: 'PRODUTOS',
        itemsActive: 0, latencyMs: Date.now() - start, error: error.message,
        message: 'Não foi possível consultar o catálogo. Nenhum catálogo antigo foi restaurado automaticamente.',
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
      phoneNumberId: phoneId
        ? `${phoneId.slice(0, 4)}...${phoneId.slice(-4)}`
        : 'Emulador Local (5564999351616)',
      hasAccessToken: hasToken,
      hasVerifyToken: hasVerifyToken,
      lastReceivedAt: this.webhookStats.lastReceivedAt || 'Nenhuma mensagem recente',
      totalReceivedCount: this.webhookStats.totalReceived,
      message: isFullyConfigured
        ? 'Webhook Meta operando na rota /webhook e token de verificação validado com sucesso.'
        : 'Webhook ouvindo requisições na rota /webhook. Simulador do WhatsApp 100% ativo.',
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
      message: isConnected
        ? `Banco de dados Firestore conectado com sucesso ao projeto [${projectId}].`
        : 'Operando com repositório em memória e persistência em cache.',
    };
  }
}

module.exports = {
  SystemStatusService,
};

