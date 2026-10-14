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

  // 3. Aplicação Express
  const app = createApp({ messageService, taskQueueClient });
  // Servidores persistentes. Em Cloud Run usar também o endpoint autenticado via Scheduler.
  let pixTimer;
  let stopping = false;
  const reconcilePix = async () => {
    try { await app.locals.sicredi.processJobs(); }
    catch (error) { Logger.warn('Conciliação Sicredi será repetida.', { error: error.message }); }
    if (!stopping) { pixTimer = setTimeout(reconcilePix, 30000); pixTimer.unref(); }
  };
  if (app.locals.sicredi.client.isOfficialApiConfigured && process.env.SICREDI_BACKGROUND_WORKER !== 'false') {
    pixTimer = setTimeout(reconcilePix, 1000);
    pixTimer.unref();
  }

  const host = process.env.HOST || '0.0.0.0';
  const targetPort = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  const server = app.listen(targetPort, host, () => {
    Logger.info(`Conflora AI rodando com sucesso na porta principal ${targetPort} (${host})`);
  });

  let secondaryServer = null;
  if (targetPort !== 3000) {
    try {
      secondaryServer = app.listen(3000, host, () => {
        Logger.info(`Conflora AI dev server também escutando na porta 3000 (${host})`);
      });
    } catch (err) {
      Logger.warn(`Não foi possível escutar na porta 3000: ${err.message}`);
    }
  }

  // Graceful shutdown
  const shutdown = () => {
    stopping = true;
    clearTimeout(pixTimer);
    Logger.info('Encerrando servidor com segurança...');
    server.close(() => {
      if (secondaryServer) {
        try { secondaryServer.close(); } catch {}
      }
      Logger.info('Servidor finalizado.');
      process.exit(0);
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
