const config = require('../config/env');
const Logger = require('../shared/logger');

class SystemStatusService {
  constructor({ firestoreRepo, whatsappClient }) {
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
    const start = Date.now();
    const whatsapp = this.checkWhatsAppStatus();
    const firestore = await this.checkFirestoreStatus();
    return {
      timestamp: new Date().toISOString(),
      overallStatus: firestore.status !== 'ONLINE' || whatsapp.status !== 'VERIFIED' ? 'WARNING' : 'HEALTHY',
      diagnosticsDurationMs: Date.now() - start,
      whatsapp,
      firestore,
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
      status: this.whatsappClient?.lastConnectionCheck?.status || (isFullyConfigured ? 'CONFIGURED_UNVERIFIED' : 'NOT_CONFIGURED'),
      badge: isFullyConfigured ? 'Configurado · conexão ainda precisa ser verificada' : 'WhatsApp não configurado',
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
        ? 'Credenciais presentes. Isso não comprova validade do token nem entrega de mensagens.'
        : 'Preencha a configuração para habilitar envios reais.',
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
      status: isConnected ? 'ONLINE' : this.firestoreRepo?.isInMemory ? 'TEST_MEMORY' : 'ERROR',
      badge: isConnected ? 'Firestore Conectado' : this.firestoreRepo?.isInMemory ? 'Memória isolada de testes' : 'Firestore indisponível',
      color: isConnected ? '#10b981' : '#3b82f6',
      projectId,
      latencyMs: Date.now() - start,
      message: isConnected
        ? `Banco de dados Firestore conectado com sucesso ao projeto [${projectId}].`
        : this.firestoreRepo?.isInMemory ? 'Ambiente isolado de testes.' : 'Persistência indisponível. Operações não devem ser confirmadas.',
    };
  }
}

module.exports = {
  SystemStatusService,
};

