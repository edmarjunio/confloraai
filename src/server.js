const config = require('./config/env');
const Logger = require('./shared/logger');
const { createApp } = require('./http/app');
const { CatalogRepository } = require('./catalog/catalog.repository');
const { AgentService } = require('./ai/agent.service');
const { FirestoreRepository } = require('./database/firestore.repository');
const { OrderService } = require('./orders/order.service');
const { WhatsAppClient } = require('./integrations/whatsapp.client');
const { TaskQueueClient } = require('./integrations/task-queue.client');
const { MessageService } = require('./services/message.service');

async function bootstrap() {
  Logger.info(`Iniciando Conflora AI v2.1 em modo [${config.env}]...`);
  Logger.info('Configuração de entrada WhatsApp carregada.', { envFile: config.envSource.path, envFileLoaded: config.envSource.loaded,
    envSourceReason: config.envSource.reason, envSourceError: config.envSource.error, inheritedWhatsAppKeys: config.envSource.inheritedWhatsAppKeys,
    assistantEnabled: config.whatsapp.assistantEnabled, agentOwner: config.whatsapp.agentOwner, graphVersion: config.whatsapp.graphVersion,
    account: require('./integrations/whatsapp-diagnostics').idDiagnostic(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID),
    sender: require('./integrations/whatsapp-diagnostics').idDiagnostic(config.whatsapp.phoneNumberId) });

  // 1. Repositórios de dados
  const firestoreRepo = new FirestoreRepository();
  const stopCatalogWatch = require('./services/meta-catalog-watch').watchMetaCatalog(firestoreRepo);
  const catalogRepo = new CatalogRepository({
    firestoreRepo,
  });

  // Carrega catálogo em background
  catalogRepo.refreshCatalog().catch((err) => {
    Logger.warn('Aviso: o catálogo será carregado sob demanda na primeira mensagem', { error: err.message });
  });

  // 2. Serviços e Integrações
  const agentService = new AgentService();
  const orderService = new OrderService({ firestoreRepo, catalogRepo });
  const whatsappClient = new WhatsAppClient();
  const taskQueueClient = new TaskQueueClient();

  // 2.1 Meta Business Agent Platform Service
  let metaAgentService = null;
  if (firestoreRepo.firestore) {
    const { FirestoreProductSource } = require('./agent/product-source');
    const { ProductIndex } = require('./agent/product-search');
    const { CartStore, HandoffStore } = require('./agent/agent-store');
    const { ConfloraAgentService } = require('./agent/agent-service');

    const productSource = new FirestoreProductSource(firestoreRepo.firestore);
    const productIndex = new ProductIndex({ source: productSource });
    const cartStore = new CartStore(firestoreRepo.firestore);
    const handoffStore = new HandoffStore(firestoreRepo.firestore);

    metaAgentService = new ConfloraAgentService({
      productSource,
      productIndex,
      cartStore,
      handoffStore,
      tenantId: 'conflora',
      assertAvailability: false,
    });
  }

  const messageService = new MessageService({
    agentService,
    catalogRepo,
    firestoreRepo,
    orderService,
    whatsappClient,
  });
  if (metaAgentService) {
    messageService.metaAgentService = metaAgentService;
  }

  // 3. Aplicação Express
  const app = createApp({ messageService, taskQueueClient });

  const host = '0.0.0.0';
  const primaryPort = Number(process.env.PORT) || 3000;

  const server = app.listen(primaryPort, host, (error) => {
    // Express 5 also invokes this callback for bind errors.
    if (error) return;
    Logger.info(`Conflora AI rodando com sucesso na porta principal ${primaryPort} (${host})`);
    console.log(`\n==================================================`);
    console.log(`🚀 Conflora AI online com sucesso!`);
    console.log(`👉 Catálogo / Loja : http://localhost:${primaryPort}`);
    console.log(`👉 Painel Caixa PDV: http://localhost:${primaryPort}/pdv`);
    console.log(`==================================================\n`);
  });
  server.once('close', stopCatalogWatch);

  server.on('error', error => {
    stopCatalogWatch();
    Logger.error('Erro no servidor HTTP; processo encerrado sem iniciar outro worker.', error, { port: primaryPort, processId: process.pid });
    process.exit(1);
  });
  process.on('unhandledRejection', error => {
    Logger.error('Falha assíncrona não tratada; reiniciando processo', error instanceof Error ? error : new Error(String(error)));
    server.close(() => app.locals.errorHistory.queue.finally(() => process.exit(1)));
    setTimeout(() => process.exit(1), 10000).unref();
  });
  process.on('uncaughtExceptionMonitor', error => Logger.error('Falha inesperada no processo', error));

  // Graceful shutdown
  const shutdown = () => {
    Logger.info('Encerrando servidor com segurança...');
    setTimeout(() => process.exit(0), 10000).unref();
    server.close(() => {
      app.locals.errorHistory.queue.finally(() => {
        Logger.info('Servidor finalizado.');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

if (require.main === module) {
  bootstrap().catch((err) => {
    Logger.error('Erro fatal ao inicializar servidor ', err);
    process.exit(1);
  });
}

module.exports = {
  bootstrap,
};
