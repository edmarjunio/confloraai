const config = require('./config/env');
const Logger = require('./shared/logger');
const { createApp } = require('./http/app');
const { CatalogRepository } = require('./catalog/catalog.repository');
const { MessageRouter } = require('./router/message.router');
const { DirectPriceService } = require('./services/direct-price.service');
const { AgentService } = require('./ai/agent.service');
const { FirestoreRepository } = require('./database/firestore.repository');
const { OrderService } = require('./orders/order.service');
const { WhatsAppClient } = require('./integrations/whatsapp.client');
const { TaskQueueClient } = require('./integrations/task-queue.client');
const { LearningService } = require('./services/learning.service');
const { MessageService } = require('./services/message.service');

async function bootstrap() {
  Logger.info(`Iniciando Conflora AI v2.1 em modo [${config.env}]...`);

  // 1. Repositórios de dados
  const firestoreRepo = new FirestoreRepository();
  const catalogRepo = new CatalogRepository({
    firestoreRepo,
  });

  // Carrega catálogo em background
  catalogRepo.refreshCatalog().catch((err) => {
    Logger.warn('Aviso: o catálogo será carregado sob demanda na primeira mensagem', { error: err.message });
  });

  // 2. Serviços e Integrações
  const router = new MessageRouter(catalogRepo);
  const directPriceService = new DirectPriceService();
  const agentService = new AgentService();
  const orderService = new OrderService({ firestoreRepo, catalogRepo });
  const whatsappClient = new WhatsAppClient();
  const taskQueueClient = new TaskQueueClient();
  const learningService = new LearningService({ firestoreRepo, catalogRepo });

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
    router,
    directPriceService,
    agentService,
    catalogRepo,
    firestoreRepo,
    orderService,
    whatsappClient,
    learningService,
  });
  if (metaAgentService) {
    messageService.metaAgentService = metaAgentService;
  }

  // 3. Aplicação Express e Integração PIX Sicredi
  const { SicrediPixClient } = require('./integrations/sicredi-pix.client');
  const { pixMode } = require('./orders/pix-mode');
  const sicrediClient = new SicrediPixClient();
  const app = createApp({ messageService, taskQueueClient, sicrediClient });

  const host = '0.0.0.0';
  const primaryPort = Number(process.env.PORT) || 3000;

  const server = app.listen(primaryPort, host, () => {
    Logger.info(`Conflora AI rodando com sucesso na porta principal ${primaryPort} (${host})`);
    console.log(`\n==================================================`);
    console.log(`🚀 Conflora AI online com sucesso!`);
    console.log(`👉 Catálogo / Loja : http://localhost:${primaryPort}`);
    console.log(`👉 Painel Caixa PDV: http://localhost:${primaryPort}/pdv`);
    console.log(`==================================================\n`);

    const resolvedWebhookUrl = sicrediClient.resolveWebhookUrl();
    if (pixMode() === 'SICREDI' && sicrediClient.isOfficialApiConfigured && resolvedWebhookUrl.startsWith('https://')) {
      sicrediClient.registerWebhook(resolvedWebhookUrl)
        .then(() => Logger.info('Webhook PIX Sicredi sincronizado com sucesso.', { webhookUrl: resolvedWebhookUrl }))
        .catch((err) => Logger.warn('Não foi possível sincronizar automaticamente o Webhook PIX Sicredi na inicialização', { error: err.message }));
    }
  });

  server.on('error', error => { Logger.error('Erro no servidor HTTP', error); process.exitCode = 1; });
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
