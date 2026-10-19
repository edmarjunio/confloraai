const { createHash, randomUUID } = require('node:crypto');
const { createWebSessions, safeUser } = require('../security/web-session');
const { rankProductSales } = require('../catalog/product-sales');
const { resolveHdProductImage } = require('../catalog/image-resolver');
const { getCashierProductDetails } = require('../catalog/cashier-product-details');
const { normalizeDeliveryLocation } = require('../orders/pdv.service');
let expressModule = null;
function getExpress() {
  if (!expressModule) {
    try {
      expressModule = require('express');
    } catch {
      return null;
    }
  }
  return expressModule;
}

async function acquireRequestLock(locks, key) {
  const previous = locks.get(key) || Promise.resolve();
  let unlock;
  const current = new Promise((resolve) => {
    unlock = resolve;
  });
  locks.set(key, current);
  await previous.catch(() => {});
  return () => {
    unlock();
    if (locks.get(key) === current) locks.delete(key);
  };
}

function withoutIdempotencyFingerprint(order) {
  const safeOrder = { ...order };
  delete safeOrder.idempotencyFingerprint;
  return safeOrder;
}

function getProductImageCandidates(product = {}) {
  const images = [
    ...(Array.isArray(product.images) ? product.images : []),
    ...(Array.isArray(product.imagePaths) ? product.imagePaths : []),
    product.imageUrl,
    product.imageurl,
    product.imageURL,
    product.image_url,
    product.imagePathCache,
    product.imagePath,
    product.storagePath,
    product.photoUrl,
    product.fotoUrl,
  ]
    .map((image) => (typeof image === 'string' ? image : image?.url || image?.imageUrl || image?.src || image?.downloadURL || image?.storagePath || image?.fullPath || image?.path || ''))
    .filter(Boolean);
  const registeredImages = [...new Set([
    ...images,
  ].filter(isRenderableProductImageUrl))];
  const imageFileId = String(product.imageFileId || product.image_file_id || '').trim();
  const storageImageProxy = imageFileId
    ? `/api/images/${encodeURIComponent(imageFileId)}`
    : '';
  if (registeredImages.length) {
    return [...new Set([...registeredImages, storageImageProxy].filter(Boolean))];
  }
  if (storageImageProxy) {
    return [storageImageProxy];
  }

  const illustrativeImage = resolveHdProductImage(
    product.name || product.descricao || '',
    product.category || product.categoria || '',
    product.subcategory || product.subcategoria || '',
  );
  return illustrativeImage ? [illustrativeImage] : [];
}

function isRenderableProductImageUrl(value) {
  if (typeof value !== 'string') return false;
  const source = value.trim();
  return Boolean(source) && (
    /^https:\/\/(?:firebasestorage|storage)\.googleapis\.com\//i.test(value.trim()) ||
    /^https:\/\/images\.unsplash\.com\//i.test(source) ||
    /^\/api\/images\//i.test(value.trim()) ||
    /^\/store-assets\//i.test(value.trim()) ||
    /^gs:\/\/[a-z0-9._-]+\/products\/[a-z0-9_-]+\/[a-z0-9._-]+$/i.test(source) ||
    /^products\/[a-z0-9_-]+\/[a-z0-9._-]+$/i.test(source)
  );
}

function getCashierProductImageCandidates(product = {}) {
  return [...new Set(
    getProductImageCandidates(product)
      .map((image) => String(image || '').trim())
      .filter((image) => isRenderableProductImageUrl(image) || /^https:\/\/images\.unsplash\.com\//i.test(image)),
  )];
}

const config = require('../config/env');
const { verifyFirebaseToken } = require('../security/firebase-auth');
const Logger = require('../shared/logger');
const { SignatureValidator } = require('../security/signature.validator');
const { SystemStatusService } = require('../services/system-status.service');
const { renderAdminHtml, renderCaixaHtml, renderAdminGerencialHtml } = require('./views');
const { SicrediPixClient } = require('../integrations/sicredi-pix.client');
const { formatOrderReceipt } = require('../orders/receipt.util');
const { getBusinessDate, isValidReportDate } = require('../reports/daily-executive-metrics');
const { formatDailyExecutiveReport, normalizeWhatsAppNumber } = require('../reports/daily-executive-report');


function renderPrivacyPolicyHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Política de Privacidade | Conflora Horta e Viveiro</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 800px; margin: 0 auto; padding: 24px 16px; background-color: #f7fafc; }
    .card { background: white; padding: 36px 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    h1 { color: #22543d; font-size: 28px; margin-bottom: 8px; }
    h2 { color: #276749; font-size: 20px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    p, li { font-size: 15px; color: #4a5568; }
    ul { padding-left: 20px; }
    .contact-box { background: #edf2f7; border-left: 4px solid #38a169; padding: 14px 18px; border-radius: 4px; margin-top: 20px; }
    footer { text-align: center; margin-top: 32px; font-size: 13px; color: #a0aec0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Política de Privacidade</h1>
    <p><strong>Conflora Horta e Viveiro & Agromadeiras</strong> — Mineiros, Goiás</p>
    <p><em>Última atualização: Outubro de 2026</em></p>

    <p>Esta Política de Privacidade descreve como a Conflora coleta, utiliza e protege os dados pessoais fornecidos por usuários que interagem com nosso canal oficial de atendimento automatizado e vendas no WhatsApp, em total conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong> e as políticas da <strong>Meta Platforms</strong>.</p>

    <h2>1. Dados Coletados</h2>
    <p>Ao interagir com nosso atendimento via WhatsApp, podemos coletar exclusivamente:</p>
    <ul>
      <li><strong>Identificação básica:</strong> Nome de exibição do perfil no WhatsApp e número de telefone celular.</li>
      <li><strong>Mensagens de atendimento:</strong> Histórico das mensagens trocadas, dúvidas sobre plantas, pedidos de orçamento e itens solicitados do catálogo.</li>
      <li><strong>Comprovantes de pagamento:</strong> Imagens ou documentos de comprovante PIX enviados voluntariamente para confirmação de compras.</li>
    </ul>

    <h2>2. Finalidade do Tratamento dos Dados</h2>
    <p>Os dados coletados são utilizados estritamente para:</p>
    <ul>
      <li>Prestar atendimento ao cliente, responder dúvidas sobre espécies de plantas, portes e valores.</li>
      <li>Montar orçamentos e emitir resumos de pedidos comerciais.</li>
      <li>Confirmar pagamentos PIX e organizar a separação de plantas para retirada ou entrega.</li>
      <li>Garantir a segurança, prevenção contra fraudes e melhoria contínua do atendimento.</li>
    </ul>

    <h2>3. Compartilhamento Seguro de Dados</h2>
    <p>A Conflora <strong>não comercializa, não aluga e não compartilha</strong> dados pessoais com terceiros para fins publicitários. Os dados transitam unicamente por provedores de infraestrutura tecnológica essenciais para o funcionamento do serviço:</p>
    <ul>
      <li><strong>Meta Platforms (WhatsApp Cloud API):</strong> Infraestrutura oficial de envio e recebimento de mensagens.</li>
      <li><strong>Google Cloud Platform:</strong> Hospedagem segura de servidores e banco de dados para armazenamento do histórico de atendimento.</li>
    </ul>

    <h2>4. Retenção e Segurança dos Dados</h2>
    <p>Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados contra acessos não autorizados ou destruição acidental. O histórico de mensagens é mantido apenas pelo tempo necessário para cumprimento das finalidades comerciais ou exigências legais.</p>

    <h2>5. Seus Direitos (LGPD) e Exclusão de Dados</h2>
    <p>Você tem o direito de solicitar a confirmação de tratamento, acesso, correção ou a <strong>exclusão total de seus dados pessoais</strong> a qualquer momento.</p>
    <p>Para solicitar a exclusão definitiva de seus dados do nosso sistema, consulte nossa página de <a href="/exclusao-de-dados" style="color: #276749; font-weight: bold;">Instruções de Exclusão de Dados</a> ou envie uma mensagem diretamente para nosso canal de contato.</p>

    <div class="contact-box">
      <strong>Canal do Encarregado de Dados (DPO / Contato):</strong><br>
      E-mail: <a href="mailto:edmarjuniob@gmail.com">edmarjuniob@gmail.com</a><br>
      Localização: Mineiros - GO, Brasil
    </div>
  </div>
  <footer>
    &copy; 2026 Conflora Horta e Viveiro. Todos os direitos reservados.
  </footer>
</body>
</html>`;
}

function renderDataDeletionHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Instruções de Exclusão de Dados | Conflora AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 800px; margin: 0 auto; padding: 24px 16px; background-color: #f7fafc; }
    .card { background: white; padding: 36px 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    h1 { color: #22543d; font-size: 26px; margin-bottom: 8px; }
    h2 { color: #276749; font-size: 19px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    p, li { font-size: 15px; color: #4a5568; }
    .step-box { background: #f0fff4; border-left: 4px solid #38a169; padding: 14px 18px; border-radius: 4px; margin: 16px 0; }
    footer { text-align: center; margin-top: 32px; font-size: 13px; color: #a0aec0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Instruções de Exclusão de Dados do Usuário</h1>
    <p><strong>Conflora Horta e Viveiro</strong> — Atendimento WhatsApp</p>
    <p>Em conformidade com as diretrizes da <strong>Meta Platforms</strong> e o Artigo 18 da <strong>LGPD</strong>, você tem o direito de solicitar a remoção completa de todas as suas informações e histórico de conversas do nosso sistema a qualquer momento.</p>

    <h2>Como solicitar a exclusão de seus dados:</h2>

    <div class="step-box">
      <strong>Opção 1: Via E-mail Oficial</strong><br>
      Envie um e-mail para <a href="mailto:edmarjuniob@gmail.com"><strong>edmarjuniob@gmail.com</strong></a> com:<br>
      • <strong>Assunto:</strong> Solicitação de Exclusão de Dados (LGPD)<br>
      • <strong>Corpo do e-mail:</strong> Informe o número de telefone (com DDD) utilizado no WhatsApp da Conflora.
    </div>

    <div class="step-box">
      <strong>Opção 2: Diretamente pelo WhatsApp</strong><br>
      Envie a mensagem <code>"Excluir meus dados"</code> ou <code>"Apagar histórico"</code> para o nosso número de atendimento comercial no WhatsApp.
    </div>

    <h2>Prazo e Procedimento:</h2>
    <p>Após o recebimento da solicitação, nossa equipe processará a exclusão em até <strong>48 horas úteis</strong>. Todas as sessões, mensagens e informações vinculadas ao seu número de telefone serão permanentemente apagadas ou anonimizadas do nosso banco de dados no Firestore.</p>

    <p><a href="/politica-de-privacidade" style="color: #276749;">← Voltar para a Política de Privacidade</a></p>
  </div>
  <footer>
    &copy; 2026 Conflora Horta e Viveiro. Todos os direitos reservados.
  </footer>
</body>
</html>`;
}

function renderTermsOfServiceHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termos de Serviço | Conflora AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 800px; margin: 0 auto; padding: 24px 16px; background-color: #f7fafc; }
    .card { background: white; padding: 36px 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    h1 { color: #22543d; font-size: 26px; margin-bottom: 8px; }
    h2 { color: #276749; font-size: 19px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    p, li { font-size: 15px; color: #4a5568; }
    footer { text-align: center; margin-top: 32px; font-size: 13px; color: #a0aec0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Termos de Serviço</h1>
    <p><strong>Conflora Horta e Viveiro</strong> — Atendimento WhatsApp</p>

    <h2>1. O Serviço</h2>
    <p>O canal de atendimento via WhatsApp da Conflora é uma ferramenta voltada para disponibilizar catálogo de plantas, tirar dúvidas sobre espécies e portes, orçar pedidos e fornecer suporte a clientes na cidade de Mineiros - GO e região.</p>

    <h2>2. Disponibilidade e Preços</h2>
    <p>Os valores e disponibilidades de mudas, plantas ornamentais, hortaliças e insumos são baseados no estoque físico e catálogo oficial da Conflora. Os pedidos tornam-se vinculantes após a confirmação mútua e validação do pagamento.</p>

    <h2>3. Contato</h2>
    <p>Dúvidas sobre estes termos podem ser enviadas para <a href="mailto:edmarjuniob@gmail.com">edmarjuniob@gmail.com</a>.</p>
  </div>
  <footer>
    &copy; 2026 Conflora Horta e Viveiro. Todos os direitos reservados.
  </footer>
</body>
</html>`;
}

function whatsappCustomerPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits && !digits.startsWith('55') && digits.length <= 11
    ? `55${digits}`
    : digits;
}

async function sendCustomerOrderReceipt(whatsappClient, phone, receiptText) {
  const targetPhone = whatsappCustomerPhone(phone);
  if (!/^\d{12,15}$/.test(targetPhone)) {
    return { sent: false, reason: 'Telefone do cliente inválido ou não informado.' };
  }
  const template = config.whatsapp.templates.customerOrder;
  if (!template) {
    return { sent: false, reason: 'Configure um modelo aprovado de recibo para WhatsApp.' };
  }
  try {
    const result = await whatsappClient.sendTemplate(
      targetPhone,
      template,
      config.whatsapp.templates.language,
      [
        {
          type: 'body',
          parameters: [{ type: 'text', text: receiptText }],
        },
      ],
    );
    if (result?.mock || result?.success === false) {
      return { sent: false, reason: 'WhatsApp sem credenciais válidas ou envio não confirmado.' };
    }
    return { sent: true };
  } catch (error) {
    Logger.error('Falha ao enviar recibo de pedido pelo WhatsApp', error);
    return { sent: false, reason: 'Não foi possível enviar o recibo pelo WhatsApp.' };
  }
}

async function prepareSicrediCheckoutOrder({ app, sicrediClient, taskQueueClient, order }) {
  if (order.paymentMethod !== 'PIX' || order.pixMode === 'MANUAL') {
    const id = `${order.id}-receipt`;
    await app.locals.pdv.store.transaction(async (tx) => {
      if (await tx.get('pdv_outbox', id)) return;
      tx.set('pdv_outbox', id, { id, orderId: order.id, kind: 'receipt', status: 'PENDING', attempts: 0 });
    });
    await app.locals.pdv.service.deliver(id);
    const job = await app.locals.pdv.store.read('pdv_outbox', id);
    return { order, receiptDelivery: { sent: job?.status === 'SENT' && !job.skipped, reason: job?.lastError || '' } };
  }
  if (order.pixProvider !== 'SICREDI' || !order.pixData?.txid) {
    return { order, receiptDelivery: { sent: false, reason: 'Pedido Pix anterior à integração Sicredi; não gere uma nova cobrança.' } };
  }
  if (order.status === 'CANCELLED' || order.completedAt || order.paidAt) {
    return { order, receiptDelivery: order.receiptDelivery || { sent: false, reason: 'Pedido já encerrado; nenhuma cobrança adicional foi emitida.' } };
  }
  if (Date.parse(order.pixExpiresAt || '') <= Date.now()) {
    await app.locals.pdv.service.expirePixOrder(order.id);
    throw new Error('Esta cobrança Pix venceu. Inicie um novo pedido.');
  }
  const ttlSeconds = Number(order.pixTtlSeconds || order.pixData?.expiresInSeconds) || 3600;
  if (process.env.NODE_ENV === 'production' && typeof taskQueueClient?.enqueuePixExpiration !== 'function') {
    await app.locals.pdv.store.cancelOrder(order.id, 'Cloud Tasks não está disponível para expirar a reserva Pix.').catch(() => {});
    throw new Error('Cloud Tasks não está disponível para expirar a reserva Pix.');
  }
  try {
    await taskQueueClient?.enqueuePixExpiration?.(order.id, ttlSeconds);
  } catch (error) {
    await app.locals.pdv.store.cancelOrder(order.id, 'Não foi possível agendar a expiração da reserva Pix.').catch(() => {});
    throw error;
  }
  let preparedOrder = order;
  if (!preparedOrder.pixData?.pixCopiaECola) {
    const charge = await sicrediClient.createCharge({
      amount: preparedOrder.total,
      txid: preparedOrder.pixData?.txid,
      ticketNumber: preparedOrder.ticketNumber || preparedOrder.id,
      expiresInSeconds: ttlSeconds,
    });
    preparedOrder = await app.locals.pdv.store.attachCharge(preparedOrder.id, charge);
  }
  const messageId = `${preparedOrder.id}-receipt`;
  await app.locals.pdv.service.deliver(messageId);
  const delivery = await app.locals.pdv.store.read('pdv_outbox', messageId);
  return {
    order: preparedOrder,
    receiptDelivery: { sent: delivery?.status === 'SENT', reason: delivery?.lastError || '' },
  };
}

function createApp({
  messageService,
  taskQueueClient,
  verifyGoogleToken = verifyFirebaseToken,
  storeRepository,
  storeAssistant,
  sicrediClient,
}) {
  const express = getExpress();
  if (!express) { throw new Error('Express module not available'); }
  const sicrediPixClient = sicrediClient || new SicrediPixClient();
  messageService.sicrediPixClient = sicrediPixClient;
  const app = express();
  const errorHistory = new (require('../services/error-history.service').ErrorHistoryService)({ firestore: messageService.firestoreRepo.firestore, inMemory: process.env.NODE_ENV === 'test' });
  app.locals.errorHistory = errorHistory;
  require('./error-history.routes').installErrorCapture(app, errorHistory);
  app.locals.storefrontCheckoutLocks = new Map();
  const incoming = new (require('../services/incoming-message.service').IncomingMessageService)(messageService.firestoreRepo);
  app.locals.incomingMessages = incoming;
  if (config.appEnvironment === 'dev') {
    app.use((_req, res, next) => {
      res.setHeader('X-Conflora-Environment', 'dev');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      next();
    });
  }
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  });
  const signatureValidator = new SignatureValidator(config.whatsapp.metaAppSecret);
  const systemStatusService = new SystemStatusService({
    firestoreRepo: messageService ? messageService.firestoreRepo : null,
    whatsappClient: messageService ? messageService.whatsappClient : null,
  });

  // Preserve raw body buffer for signature validation
  app.use('/api/client-errors', express.json({ limit: '8kb' }));
  app.use(
    express.json({
      limit: '5mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  const { installStorefront } = require('../storefront/routes');
  const { StoreAssistant } = require('../storefront/assistant');
  installStorefront(app, {
    express,
    firestore: messageService.firestoreRepo.firestore,
    repository: storeRepository,
    assistant: storeAssistant || new StoreAssistant({ client: messageService.agentService?.getAiClient?.(), model: config.gemini.model }),
  });

  const sessions = createWebSessions(messageService.firestoreRepo);
  app.use('/api', sessions.resolve);
  app.use('/api/customer', (req, res, next) => req.user?.role === 'ENTREGADOR' ? res.status(403).json({ error: 'Seu acesso é exclusivo às entregas.' }) : next());

  // Meta Business Agent Platform - Tools HTTP Connector & Fila Humana
  if (messageService && messageService.metaAgentService) {
    const { createMetaAgentRoutes } = require('./meta-agent.routes');
    const metaAgentRouter = createMetaAgentRoutes({
      agentService: messageService.metaAgentService,
      handoffStore: messageService.metaAgentService.handoffStore,
    });
    app.use('/api/meta-agent', metaAgentRouter);
  }

  app.use('/api/admin', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.path.endsWith('/preview') && /\/(?:products|import-products|stock)(?:\/|$)/.test(req.path)) {
      res.once('finish', () => {
        // A failed import may already have committed earlier batches.
        if (req.user?.role === 'ADMIN') messageService.catalogRepo?.invalidateCache?.();
      });
    }
    next();
  });
  require('../security/request-protection').installRequestProtection(app, messageService.firestoreRepo);
  const { installExistingStore, normalizeExistingCheckout } = require('../storefront/existing-store');
  installExistingStore(app, {
    catalog: messageService.catalogRepo,
    repository: messageService.firestoreRepo,
    assistant: storeAssistant || new StoreAssistant({ client: messageService.agentService?.getAiClient?.(), model: config.gemini.model }),
  });
  app.get('/api/maps-config', (_req, res) => {
    res.json({
      apiKey: config.maps?.apiKey || '',
      mapId: process.env.GOOGLE_MAPS_MAP_ID || '',
      originConfigured: Number.isFinite(Number(process.env.STORE_LAT)) && Number.isFinite(Number(process.env.STORE_LNG)) && Boolean(process.env.STORE_LAT && process.env.STORE_LNG),
      storeLocation: {
        lat: config.maps?.storeLat ?? -17.5694,
        lng: config.maps?.storeLng ?? -52.5511,
        name: config.maps?.storeName || 'Conflora Horta e Viveiro',
        address: config.maps?.storeAddress || 'Mineiros - GO',
      },
    });
  });
  app.get('/api/auth/me', async (req, res, next) => {
    try { if (req.user && req.get('X-Conflora-Tab-Session') === 'bootstrap') await sessions.issue(req, res, req.user); } catch (error) { return next(error); }
    res.status(req.user ? 200 : 401).json({ user: req.user || null });
  });
  app.post('/api/auth/logout', async (req, res) => {
    await sessions.logout(req, res);
    res.json({ success: true });
  });
  app.post('/api/auth/switch-profile', async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Sessão não autenticada.' });
      }
      const result = await sessions.setActiveRole(req, req.body?.role);
      if (!result.success) {
        return res.status(403).json(result);
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  app.patch('/api/auth/profile', async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Entre na sua conta.' });
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').replace(/\D/g, '');
    const address = String(body.address || '').trim();
    if (name.length < 2 || name.length > 120 || (phone && !/^\d{10,13}$/.test(phone)) || address.length > 500) return res.status(400).json({ error: 'Confira nome, WhatsApp com DDD e endereço.' });
    try {
      const profile = await messageService.firestoreRepo.updateOwnUserProfile(req.user.id, { name, phone, address });
      const user = { ...req.user, name: profile.name, phone: profile.phone, address: profile.address };
      await sessions.issue(req, res, user);
      res.json({ user });
    } catch (error) { next(error); }
  });
  app.use('/api/admin', (req, res, next) => {
    if (req.path === '/auth/login' || (req.path === '/auth/users' && req.method === 'GET')) {return next();}
    if (!req.user) {return res.status(401).json({ error: 'Entre na sua conta.' });}
    const cashierRoute = /^(?:\/orders(?:\/manual)?|\/daily-metrics|\/stock\/quick-entry|\/alterations|\/notifications(?:\/[^/]+\/read)?)$/.test(req.path);
    if (req.user.role !== 'ADMIN' && !(['CAIXA', 'VENDEDOR'].includes(req.user.role) && cashierRoute)) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil.' });
    }
    next();
  });
  require('./error-history.routes').installErrorHistoryRoutes(app, errorHistory);
  require('./product-import.routes').installProductImportRoutes(app, { repository: messageService.firestoreRepo, catalog: messageService.catalogRepo });
  // Home / Cardápio Digital Conflora
  app.get(['/', '/products/:productId', '/configuracoes'], (req, res) => {
    if (process.env.STOREFRONT_STORE_SLUG) {
      const detail = req.path === '/configuracoes' ? '/admin' : req.params.productId ? '/products/' + encodeURIComponent(req.params.productId) : '';
      return res.redirect('/shop/' + encodeURIComponent(process.env.STOREFRONT_STORE_SLUG) + detail);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(require('node:path').resolve(__dirname, '../../public/storefront/index.html'));
  });
  app.get('/catalogo-classico', (_req, res) => res.redirect(308, '/'));

  // Painel de Administração, Frente de Caixa & Estoque
  app.get('/admin', async (_req, res, next) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      const { readStoreSettings, existingConfig } = require('../storefront/existing-store');
      res.status(200).send(renderAdminHtml(existingConfig([], await readStoreSettings(messageService.firestoreRepo))));
    } catch (error) { next(error); }
  });

  // Painel Admin Gerencial (Substituição de Alta Performance do Looker Studio)
  app.get('/admin-gerencial', async (_req, res, next) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      res.status(200).send(renderAdminGerencialHtml());
    } catch (error) { next(error); }
  });

  // Servir relatórios em PDF gerados
  app.get('/reports/:name', sessions.resolve, async (req, res) => {
    if (req.user?.role !== 'ADMIN') return res.sendStatus(403);
    try {
      const storage = new (require('../reports/private-report-storage').PrivateReportStorage)(messageService.firestoreRepo);
      const buffer = await storage.read(req.params.name);
      if (!buffer) return res.sendStatus(404);
      res.set('Cache-Control', 'private, no-store').type('application/pdf').send(buffer);
    } catch { res.sendStatus(404); }
  });

  // Tela Dedicada do Caixa & Frente de Loja (Mobile & Desktop)
  app.get(['/caixa', '/pdv'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).send(renderCaixaHtml());
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok', uptime: process.uptime(),
      environment: config.appEnvironment,
      projectId: config.gcp.projectId,
      paymentProvider: require('../orders/pix-mode').pixMode(),
      revision: process.env.K_REVISION || process.env.APP_REVISION || 'local',
    });
  });

  // Meta Verification: Política de Privacidade
  app.get(['/politica-de-privacidade', '/privacy'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderPrivacyPolicyHtml());
  });

  // Meta Verification: Exclusão de Dados do Usuário
  app.get(['/exclusao-de-dados', '/data-deletion'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderDataDeletionHtml());
  });

  // Meta Verification: Termos de Serviço
  app.get(['/termos-de-servico', '/terms'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderTermsOfServiceHtml());
  });

  // Meta Webhook Verification (GET)
  app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      Logger.info('Meta Webhook verificado com sucesso.');
      return res.status(200).send(challenge);
    }

    Logger.warn('Tentativa de verificação do Webhook com token inválido.');
    return res.sendStatus(403);
  });

  // Meta Webhook Event Receiver (POST)
  app.post('/webhook', async (req, res) => {
    const signature = req.headers['x-hub-signature-256'];

    if (!signatureValidator.validate(req.rawBody, signature)) {
      Logger.warn('Assinatura do webhook inválida.');
      return res.sendStatus(401);
    }

    const body = req.body;
    if (body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) {
      return res.sendStatus(200);
    }

    try {
    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        const value = change.value;
        for (const status of Array.isArray(value?.statuses) ? value.statuses : []) {
          if (!status.id || !['sent', 'delivered', 'read', 'failed'].includes(status.status)) continue;
          const jobs = await app.locals.pdv.store.list('pdv_outbox', 'providerMessageId', status.id);
          const eventId = createHash('sha256').update(status.id + ':' + status.status).digest('hex');
          await app.locals.pdv.store.transaction(async tx => {
            tx.set('whatsapp_delivery_events', eventId, { id: eventId, messageId: status.id, status: status.status.toUpperCase(), timestamp: String(status.timestamp || ''), expiresAt: new Date(Date.now() + 30 * 86400000) });
          });
          const ranks = { ACCEPTED: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 4 };
          for (const job of jobs) await app.locals.pdv.store.transaction(async tx => {
            const current = await tx.get('pdv_outbox', job.id);
            if ((ranks[current.deliveryStatus] ?? 0) <= ranks[status.status.toUpperCase()]) tx.set('pdv_outbox', job.id, { ...current, deliveryStatus: status.status.toUpperCase() });
          });
        }
        if (!value || !Array.isArray(value.messages)) {
          continue;
        }

        for (const msg of value.messages) {
          const phone = msg.from;
          const messageId = msg.id;
          const isMedia = Boolean(msg.image || msg.document);
          const mediaCaption = msg.image?.caption || msg.document?.caption || '';
          const text = msg.text?.body || mediaCaption || (isMedia ? '[COMPROVANTE_ENVIADO]' : '');
          const customerName = value.contacts?.[0]?.profile?.name || '';

          if (!text && !isMedia) {
            continue;
          }

          systemStatusService.recordWebhookHit(phone);

          const taskPayload = { phone, message: text, customerName, messageId };

          await incoming.accept(taskPayload);
          if (config.whatsapp.assistantEnabled && taskQueueClient) {
            await taskQueueClient.enqueueProcessMessage(taskPayload).catch(error => Logger.warn('Mensagem persistida; fila será retomada pelo trabalhador.', { messageId, error: error.message }));
          }
          // The durable inbox is authoritative even when Cloud Tasks is unavailable.
          if (process.env.NODE_ENV !== 'production') setImmediate(() => messageService.handleCustomerMessage({ ...taskPayload, ...(!config.whatsapp.assistantEnabled ? { verifyOnly: true } : {}) }).catch(() => {}));
        }
      }
    }
    res.sendStatus(200);
    } catch (error) { Logger.error('Não foi possível persistir o webhook.', error); res.sendStatus(503); }
  });

  const retryIncoming = () => incoming.retry(payload => messageService.handleCustomerMessage({ ...payload, verifyOnly: !config.whatsapp.assistantEnabled }));
  app.post('/internal/messages/retry', async (req, res) => {
    if (!config.tasks.taskSecret || req.get('X-Conflora-Task-Secret') !== config.tasks.taskSecret) return res.sendStatus(401);
    try { await retryIncoming(); res.sendStatus(200); } catch { res.sendStatus(503); }
  });
  if (process.env.NODE_ENV !== 'test') {
    const timer = require('node:timers').setInterval(() => retryIncoming().catch(error => Logger.error('Entrada de mensagens pendente', error, { source: 'WORKER' })), 15000);
    timer.unref();
  }

  // Cloud Tasks Processing Endpoint
  app.post('/tasks/processar-mensagem', async (req, res) => {
    if (!config.whatsapp.assistantEnabled) {
      return res.status(410).json({ error: 'Atendimento automático desativado.' });
    }
    const secret = req.headers['x-conflora-task-secret'];
    if (!config.tasks.taskSecret || secret !== config.tasks.taskSecret) {
      return res.sendStatus(401);
    }

    const { phone, message, customerName, messageId } = req.body;
    if (!phone || !message) {
      return res.status(400).send('Dados inválidos');
    }

    try {
      const result = await messageService.handleCustomerMessage({
        phone,
        message,
        customerName,
        messageId,
      });
      res.status(200).json(result);
    } catch (error) {
      Logger.error('Erro ao processar mensagem via Cloud Tasks', error);
      res.status(500).send('Erro interno');
    }
  });

  // Live Inventory & Stock Movements API (somente Firestore)
  const handleInventoryRequest = async (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      let products = await messageService.firestoreRepo.getAllProducts();
      if (typeof messageService.firestoreRepo.getSalesOrders === 'function') {
        try {
          const orders = await messageService.firestoreRepo.getSalesOrders();
          products = rankProductSales(products, orders);
        } catch (error) {
          Logger.warn('Ranking de vendas temporariamente indisponível', { error: error.message });
        }
      }
      products = products.map((product) => {
        const imageCandidates = getProductImageCandidates(product);
        return {
          ...product,
          images: imageCandidates,
          imageUrl: imageCandidates[0] || '',
          imageurl: imageCandidates[0] || '',
          imageIsIllustrative: /^https:\/\/images\.unsplash\.com\//i.test(imageCandidates[0] || ''),
          imageFallbackUrl: '/store-assets/placeholder.svg',
        };
      });
      let movements = [];
      try {
        movements = await messageService.firestoreRepo.getStockMovements(15);
      } catch {
        movements = [];
      }
      res.status(200).json({ products, movements: movements || [] });
    } catch {
      res.status(503).json({ error: 'Catálogo indisponível. Tente novamente.' });
    }
  };

  app.get('/api/inventory', handleInventoryRequest);
  app.get('/api/products', handleInventoryRequest);
  app.get('/api/catalog', handleInventoryRequest);

  // Consultoria Botânica com Agente Conflora AI
  app.post('/api/ai/botanical-consultant', async (req, res) => {
    try {
      const { query, history } = req.body || {};
      const { BotanicalConsultantService } = require('../ai/botanical-consultant');
      if (messageService.catalogRepo) await messageService.catalogRepo.refreshCatalog();
      const catalogProducts = messageService.catalogRepo?.rawItems || await messageService.firestoreRepo.getAllProducts();
      const result = await BotanicalConsultantService.consult({
        query: query || '',
        history: history || [],
        catalogProducts: catalogProducts || [],
        agentService: messageService?.agentService || null,
      });
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro na consultoria botânica Conflora AI', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Mantém compatibilidade de URL redirecionando IDs de imagem para o Firebase Storage.
  app.get('/api/images/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const photo = await messageService.firestoreRepo.getProductPhoto(id);
      if (messageService.firestoreRepo.isInMemory && photo?.data) {
        const contentType = /^image\/(?:jpeg|png|webp|gif|avif)$/i.test(photo.contentType || '')
          ? photo.contentType
          : 'image/jpeg';
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Type', contentType);
        return res.status(200).send(Buffer.from(photo.data, 'base64'));
      }
      if (photo?.imageUrl && photo.imageUrl !== `/api/images/${id}`) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.redirect(302, photo.imageUrl);
      }
      const cleanProdId = String(photo?.productId || id.replace(/^img_/, ''));
      const prod = await messageService.firestoreRepo.getProductById(cleanProdId);
      if (prod && isRenderableProductImageUrl(prod.imageUrl) && prod.imageUrl.startsWith('https://')) {
        return res.redirect(prod.imageUrl);
      }
      return res.redirect(302, '/store-assets/placeholder.svg');
    } catch (err) {
      Logger.error('Erro ao servir imagem do Firestore', err);
      res.status(500).send('Erro ao carregar imagem');
    }
  });

  // Client Web Orders API
  app.post(['/api/orders', '/api/storefront/orders'], async (req, res) => {
    const isStorefrontOrder = req.path === '/api/storefront/orders';
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
    if (isStorefrontOrder && !/^[a-zA-Z0-9_-]{1,128}$/.test(idempotencyKey)) {
      return res.status(400).json({ error: 'Chave de envio do pedido inválida. Atualize a página e tente novamente.' });
    }
    const releaseRequestLock = idempotencyKey
      ? await acquireRequestLock(app.locals.storefrontCheckoutLocks, idempotencyKey)
      : () => {};
    try {
      await normalizeExistingCheckout(req, messageService.firestoreRepo);
      const {
        customerName,
        customerPhone,
        orderType,
        deliveryAddress,
        deliveryLocation,
        paymentMethod,
        items,
        coupon,
        discount,
        subtotal,
        cashTendered,
        changeDue,
      } = req.body;

      if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Dados do pedido incompletos.' });
      }

      let orderItems = items;
      let calculatedSubtotal;
      let appliedDiscount;
      let resolvedCoupon = coupon || '';
      if (req.path === '/api/orders') {
        if (items.length > 100) {
          return res.status(400).json({ error: 'O pedido excede o limite de itens.' });
        }
        const products = await messageService.firestoreRepo.getAllProducts();
        const productsById = new Map(products.map((product) => [String(product.id), product]));
        orderItems = [];
        for (const item of items) {
          const product = productsById.get(String(item.productId));
          const quantity = Number(item.quantity);
          if (
            !product ||
            product.status === 'INATIVO' ||
            product.isAvailable === false ||
            !Number.isFinite(quantity) ||
            quantity <= 0
          ) {
            return res.status(400).json({ error: 'Produto ou quantidade inválida no pedido.' });
          }
          orderItems.push({
            productId: String(product.id),
            name: product.name || product.descricao || 'Produto',
            price: Number(product.price || product.valor_num || 0),
            quantity,
            unit: item.unit || product.unit || product.unidade || 'UN',
          });
        }
        calculatedSubtotal = Number(
          orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2),
        );
        const legacyCoupons = {
          CONFLORA10: { type: 'PERCENT', value: 10 },
          CONFLORA15: { type: 'PERCENT', value: 15 },
          VERDE5: { type: 'FIXED', value: 5 },
          BEMVINDO: { type: 'PERCENT', value: 10 },
          PRIMEIRACOMPRA: { type: 'PERCENT', value: 10 },
          CERRADO20: { type: 'PERCENT', value: 20 },
        };
        resolvedCoupon = String(coupon || '').trim().toUpperCase();
        const couponRule = legacyCoupons[resolvedCoupon];
        if (resolvedCoupon && !couponRule) {
          return res.status(400).json({ error: 'Cupom inválido.' });
        }
        appliedDiscount = couponRule
          ? Number(
              (
                couponRule.type === 'PERCENT'
                  ? calculatedSubtotal * couponRule.value / 100
                  : Math.min(calculatedSubtotal, couponRule.value)
              ).toFixed(2),
            )
          : 0;
      } else {
        calculatedSubtotal = Number(subtotal) || items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
        appliedDiscount = Math.max(0, Number(discount) || 0);
      }
      const finalTotal = Math.max(0, calculatedSubtotal - appliedDiscount);
      const resolvedPaymentMethod = String(paymentMethod || 'PIX').toUpperCase();
      if (orderType === 'DELIVERY' && (!String(customerName || '').trim() || !/^\d{10,13}$/.test(String(customerPhone || '').replace(/\D/g, '')) || String(deliveryAddress || '').trim().length < 8)) return res.status(400).json({ error: 'Entrega exige nome, WhatsApp com DDD e endereço completo (rua, número, bairro e cidade).' });
      const normalizedLocation = normalizeDeliveryLocation(deliveryLocation);
      const checkoutFingerprint = idempotencyKey
        ? createHash('sha256').update(JSON.stringify({
          customerName: String(customerName).trim(),
          customerPhone: String(customerPhone).replace(/\D/g, ''),
          orderType,
          deliveryAddress,
          paymentMethod: resolvedPaymentMethod,
          items: orderItems.map((item) => ({
            productId: String(item.productId || item.id),
            quantity: Number(item.quantity),
            price: Number(item.price),
          })),
          total: finalTotal,
          deliveryLocation: normalizedLocation,
          cashTendered: Number(cashTendered) || 0,
        })).digest('hex')
        : '';
      const orderId = idempotencyKey || randomUUID();
      if (idempotencyKey) {
        const existingOrder = await messageService.firestoreRepo.getOrderById(orderId);
        if (existingOrder) {
          if (existingOrder.idempotencyFingerprint !== checkoutFingerprint) {
            return res.status(409).json({ error: 'Este pedido já foi enviado com dados diferentes. Confira a sacola e tente novamente.' });
          }
          const prepared = await prepareSicrediCheckoutOrder({ app, sicrediClient: sicrediPixClient, taskQueueClient, order: existingOrder });
          const replayOrder = prepared.order;
          const receiptText = replayOrder.receiptText || formatOrderReceipt(replayOrder);
          const receiptDelivery = prepared.receiptDelivery.sent ? prepared.receiptDelivery : replayOrder.receiptDelivery || prepared.receiptDelivery;
          return res.status(200).json({
            success: true,
            order: { ...withoutIdempotencyFingerprint(replayOrder), ...(replayOrder.pixMode === 'MANUAL' ? { accessToken: require('../orders/manual-pix.routes').orderAccessToken(replayOrder) } : {}), receiptText, receiptDelivery },
            receiptDelivery,
          });
        }
      }
      let pixData = null;
      const manualPix = resolvedPaymentMethod === 'PIX' ? require('../orders/pix-mode').manualPixSettings() : null;
      if (manualPix) require('../orders/manual-pix.routes').orderAccessToken({ id: orderId });
      if (resolvedPaymentMethod === 'PIX' && !manualPix) {
        if (!sicrediPixClient.isOfficialApiConfigured) {
          return res.status(503).json({ error: 'Pagamento Pix indisponível. Configure as credenciais, certificado e chave Pix do Sicredi.' });
        }
        const ttlSeconds = Math.min(86400, Math.max(300, Number(process.env.PIX_PAYMENT_TTL_SECONDS) || 3600));
        pixData = { txid: sicrediPixClient.generateTxId(), provider: 'SICREDI', expiresInSeconds: ttlSeconds };
      }

      let financialCustomerId = req.user?.id || '';
      if (resolvedPaymentMethod === 'FIADO') {
        if (!req.user?.email) return res.status(401).json({ error: 'Entre na sua conta para solicitar uma compra fiada.' });
        const profiles = await messageService.firestoreRepo.findCustomerProfilesByEmail(req.user.email);
        if (profiles.length > 1) return res.status(409).json({ error: 'A loja precisa conferir os cadastros vinculados ao seu e-mail antes de liberar fiado.' });
        financialCustomerId = profiles[0]?.id || 'account-' + createHash('sha256').update(req.user.id).digest('hex').slice(0, 24);
        if (!profiles.length) await app.locals.pdv.store.transaction(async tx => {
          if (await tx.get('customers', financialCustomerId)) return;
          const name = req.user.name || customerName;
          tx.set('customers', financialCustomerId, { id: financialCustomerId, name, nameSearch: name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), email: req.user.email.toLowerCase(), phone: customerPhone, address: deliveryAddress, debtBalance: 0, creditBalance: 0, updatedAt: new Date().toISOString() });
        });
      }
      let order = await messageService.firestoreRepo.createDirectOrder({
        id: orderId,
        customerId: financialCustomerId,
        customerEmail: req.user?.email || '',
        customerName,
        customerPhone,
        orderType: orderType || 'DELIVERY',
        deliveryAddress: deliveryAddress || 'Retirada no Viveiro Conflora',
        ...(normalizedLocation ? { deliveryLocation: normalizedLocation } : {}),
        ...((orderType || 'DELIVERY') === 'DELIVERY' ? { deliveryStatus: ['PIX', 'FIADO'].includes(resolvedPaymentMethod) ? 'PENDING_DISPATCH' : 'PENDING_DELIVERY' } : {}),
        paymentMethod: resolvedPaymentMethod,
        items: orderItems,
        subtotal: calculatedSubtotal,
        coupon: resolvedCoupon,
        discount: appliedDiscount,
        total: finalTotal,
        cashTendered: Number(cashTendered) || 0,
        changeDue: Number(changeDue) || 0,
        ...(idempotencyKey ? { idempotencyFingerprint: checkoutFingerprint } : {}),
        status: resolvedPaymentMethod === 'PIX' && !manualPix ? 'CREATING_PIX' : resolvedPaymentMethod === 'FIADO' ? 'AWAITING_CONFIRMATION' : 'AWAITING_PAYMENT',
        ...(resolvedPaymentMethod === 'FIADO' ? { creditApprovalStatus: 'PENDING' } : {}),
        source: 'WEB_CATALOG',
        paymentStatus: 'PENDING',
        ...(resolvedPaymentMethod === 'PIX' ? { pixMode: manualPix ? 'MANUAL' : 'SICREDI' } : {}),
        ...(manualPix ? { manualPix, paymentReviewStatus: 'AWAITING_PAYMENT' } : {}),
        ...(pixData ? { pixData, pixProvider: 'SICREDI', paymentProvider: 'SICREDI' } : {}),
      }, { requirePersistence: resolvedPaymentMethod === 'PIX' && !(manualPix && messageService.firestoreRepo.isInMemory && !messageService.firestoreRepo.firestore), reserveInventory: true });

      let receiptDelivery = { sent: false, reason: 'Envio não solicitado.' };
      if (order.source === 'WEB_CATALOG') {
        const prepared = await prepareSicrediCheckoutOrder({ app, sicrediClient: sicrediPixClient, taskQueueClient, order });
        order = prepared.order;
        receiptDelivery = prepared.receiptDelivery;
      }

      // A confirmação efetiva a baixa de estoque junto com o pagamento.
      const receiptText = formatOrderReceipt(order);
      order.receiptText = receiptText;
      await messageService.firestoreRepo.saveOrderReceipt(order.id, receiptText).catch((error) => {
        Logger.warn('Pedido registrado; a cópia persistente do recibo ficou indisponível.', { orderId: order.id, error: error.message });
      });
      // Notificação para todos os usuários ADMIN sobre a venda finalizada
      await messageService.firestoreRepo.notifyAllAdminUsersOfSale(order, { source: 'WEB_CATALOG' }).catch((err) => {
        Logger.warn('Aviso: falha ao notificar administradores sobre nova venda web', { error: err.message });
      });

      await app.locals.pdv.service.queueOperationalNotifications(order);

      res.status(200).json({
        success: true,
        order: {
          ...withoutIdempotencyFingerprint(order),
          ...(order.pixMode === 'MANUAL' ? { accessToken: require('../orders/manual-pix.routes').orderAccessToken(order) } : {}),
          receiptText,
          receiptDelivery,
        },
        receiptDelivery,
      });
    } catch (err) {
      Logger.error('Erro ao registrar pedido web', err);
      res.status(err.status || 500).json({ error: err.message });
    } finally {
      releaseRequestLock();
    }
  });

  // Client: Histórico de Compras e Produtos Mais Comprados
  app.get('/api/customer/orders', async (req, res) => {
    try {
      if (!req.user) {return res.status(401).json({ error: 'Entre na sua conta.' });}
      const limit = Math.max(1, Math.min(30, Number.parseInt(req.query.limit, 10) || 12));
      const profiles = req.user.email ? await messageService.firestoreRepo.findCustomerProfilesByEmail(req.user.email) : [];
      if (profiles.length > 1) { return res.status(409).json({ success: false, error: 'Há mais de um cadastro vinculado a este e-mail. Peça à equipe para corrigir o vínculo.' }); }
      const data = await messageService.firestoreRepo.getCustomerOrderHistoryPage({
        customerId: req.user.id,
        customerIds: profiles.map((profile) => profile.id),
        customerEmail: req.user.email,
        cursor: String(req.query.cursor || '').slice(0, 180),
        limit,
      });
      const orders = (Array.isArray(data.orders) ? data.orders : []).map((order) => {
        return {
          ...withoutIdempotencyFingerprint(order),
          receiptText: order.receiptText || formatOrderReceipt(order),
        };
      });
      res.status(200).json({ success: true, ...data, orders });
    } catch (err) {
      Logger.error('Erro ao buscar pedidos do cliente', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/customer/profile', async (req, res) => {
    if (!req.user) return res.status(401).json({ error: 'Entre na sua conta.' });
    try {
      const profiles = req.user.email ? await messageService.firestoreRepo.findCustomerProfilesByEmail(req.user.email) : [];
      if (profiles.length > 1) return res.status(409).json({ error: 'Confira o vínculo do cadastro com a loja.' });
      const profile = profiles[0];
      res.json({ name: profile?.name || req.user.name || '', phone: profile?.phone || req.user.phone || '', address: profile?.address || profile?.deliveryAddress || '', email: req.user.email || '' });
    } catch { res.status(503).json({ error: 'Não foi possível consultar seu cadastro.' }); }
  });

  app.get('/api/customer/ledger', async (req, res) => {
    if (!req.user) { return res.status(401).json({ success: false, error: 'Entre na sua conta para consultar seu saldo.' }); }
    const email = String(req.user.email || '').trim().toLowerCase();
    if (!email) { return res.status(400).json({ success: false, error: 'Sua conta não possui e-mail para vincular ao cadastro do cliente.' }); }
    try {
      const profiles = await messageService.firestoreRepo.findCustomerProfilesByEmail(email);
      if (profiles.length > 1) { return res.status(409).json({ success: false, error: 'Há mais de um cadastro vinculado a este e-mail. Peça à equipe para corrigir o vínculo.' }); }
      if (!profiles.length) { return res.status(404).json({ success: false, linked: false, error: 'Seu cadastro ainda não está vinculado a este e-mail. Peça ao caixa para atualizar seu cadastro.' }); }
      const profile = profiles[0];
      const ledger = await messageService.firestoreRepo.getCustomerDebts(profile.id);
      const transactions = await Promise.all((ledger.transactions || []).map(async (entry) => {
        const isDebtPurchase = entry.type === 'DEBITO_FIADO';
        const order = isDebtPurchase && entry.orderId
          ? await messageService.firestoreRepo.getOrderById(entry.orderId)
          : null;
        const safeOrder = order && String(order.customerId || '') === String(profile.id)
          ? {
            ticketNumber: order.ticketNumber || '',
            items: (Array.isArray(order.items) ? order.items : []).map((item) => ({
              name: String(item.name || 'Produto'), quantity: Number(item.quantity || 0),
              unit: String(item.unit || 'UN'), subtotal: Number(item.subtotalMinor || 0) / 100,
            })),
            receiptText: order.receiptText || formatOrderReceipt(order),
          }
          : null;
        return {
          id: String(entry.id || ''), orderId: String(entry.orderId || ''),
          customerName: String(entry.customerName || profile.name || ''),
          amount: Number(entry.amount || 0), paymentMethod: String(entry.paymentMethod || ''),
          entryType: String(entry.entryType || entry.type || ''), type: String(entry.type || ''),
          createdAt: entry.createdAt || '', newBalance: Number(entry.newBalance || 0),
          newCreditBalance: Number(entry.newCreditBalance || 0),
          receivedBy: String(entry.receivedBy?.name || entry.operatorName || ''),
          ticketNumber: safeOrder?.ticketNumber || '', items: safeOrder?.items || [],
          receiptText: safeOrder?.receiptText || '',
        };
      }));
      return res.status(200).json({
        success: true,
        customerName: profile.name || req.user.name || 'Cliente',
        balance: Number(ledger.balance || 0),
        creditBalance: Number(profile.creditBalance || 0),
        supportPhone: String(config.whatsapp.ownerNumber || '').replace(/\D/g, ''),
        transactions,
      });
    } catch (error) {
      Logger.error('Erro ao consultar saldo do cliente', error);
      return res.status(503).json({ success: false, error: 'Não foi possível carregar seu saldo neste momento.' });
    }
  });

  app.get('/api/customer/favorites', async (req, res) => {
    try {
      if (!req.user) {return res.status(401).json({ error: 'Entre na sua conta.' });}
      const favoriteProductIds = await messageService.firestoreRepo.getUserFavorites(req.user.id);
      res.json({ favoriteProductIds });
    } catch (err) {
      Logger.error('Erro ao buscar favoritos do cliente', err);
      res.status(500).json({ error: 'Não foi possível carregar seus produtos curtidos.' });
    }
  });

  app.put('/api/customer/favorites', async (req, res) => {
    try {
      if (!req.user) {return res.status(401).json({ error: 'Entre na sua conta.' });}
      const ids = req.body?.favoriteProductIds;
      if (!Array.isArray(ids) || ids.length > 2000) {
        return res.status(400).json({ error: 'Lista de produtos curtidos inválida.' });
      }
      const validIds = ids.map((id) => String(id || '').trim()).filter((id) => /^[a-zA-Z0-9_-]{1,160}$/.test(id));
      const favoriteProductIds = await messageService.firestoreRepo.setUserFavorites(req.user.id, validIds);
      res.json({ success: true, favoriteProductIds });
    } catch (err) {
      Logger.error('Erro ao salvar favoritos do cliente', err);
      res.status(500).json({ error: 'Não foi possível salvar seus produtos curtidos.' });
    }
  });

  // Eventos anônimos e sem dados pessoais para leitura de tráfego e conversão do catálogo.
  app.post('/api/analytics/events', async (req, res) => {
    const acceptedEvents = new Set(['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'purchase', 'search', 'category_filter']);
    const body = req.body || {};
    const eventName = String(body.eventName || '').trim();
    const visitorId = String(body.visitorId || '').trim();
    if (!acceptedEvents.has(eventName) || !/^[a-zA-Z0-9_-]{8,80}$/.test(visitorId)) {
      return res.status(400).json({ success: false, error: 'Evento de catálogo inválido.' });
    }
    const shortText = (value, max) => String(value || '').trim().slice(0, max);
    const numericValue = Number(body.value);
    try {
      await messageService.firestoreRepo.recordStorefrontEvent({
        eventName,
        visitorId,
        productId: shortText(body.productId, 160),
        productName: shortText(body.productName, 120),
        category: shortText(body.category, 80),
        orderId: shortText(body.orderId, 100),
        items: Array.isArray(body.items) ? body.items.slice(0, 100).map((item) => ({
          productId: shortText(item?.productId, 160),
          productName: shortText(item?.productName, 120),
          category: shortText(item?.category, 80),
          value: Number.isFinite(Number(item?.value)) ? Math.max(0, Math.min(Number(item.value), 1000000)) : 0,
          quantity: Number.isFinite(Number(item?.quantity)) ? Math.max(0, Math.min(Number(item.quantity), 10000)) : 0,
        })) : [],
        value: Number.isFinite(numericValue) && numericValue >= 0 ? Math.min(numericValue, 1000000) : 0,
        searchLength: Math.max(0, Math.min(100, Number.parseInt(body.searchLength, 10) || 0)),
        resultCount: Math.max(0, Math.min(100000, Number.parseInt(body.resultCount, 10) || 0)),
        utmSource: shortText(body.utmSource, 100),
        utmMedium: shortText(body.utmMedium, 100),
        utmCampaign: shortText(body.utmCampaign, 120),
      });
      res.status(202).json({ success: true });
    } catch (error) {
      Logger.error('Falha ao armazenar evento do catálogo', error);
      res.status(503).json({ success: false, error: 'Não foi possível registrar o evento.' });
    }
  });

  app.get('/api/admin/analytics/events', async (_req, res) => {
    try {
      const summary = await messageService.firestoreRepo.getStorefrontAnalyticsSummary({ days: _req.query.days });
      res.status(200).json(summary);
    } catch (error) {
      Logger.error('Erro ao consultar eventos do catálogo', error);
      res.status(500).json({ error: 'Não foi possível consultar os eventos do catálogo.' });
    }
  });

  // Admin: Get all orders (Web & WhatsApp)
  app.get('/api/admin/orders', async (req, res) => {
    try {
      let orders = await messageService.firestoreRepo.getAllOrders(50);
      if (req.user?.role !== 'ADMIN') {
        const operatorName = String(req.user?.name || '').trim().toLowerCase();
        orders = orders.filter((order) =>
          String(order.operatorId || '') === String(req.user?.id || '') ||
          (!order.operatorId && operatorName && String(order.operatorName || '').trim().toLowerCase() === operatorName),
        );
      }
      res.status(200).json(orders);
    } catch (err) {
      Logger.error('Erro ao buscar pedidos no admin', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Update order status (CONFIRMED, DELIVERED, CANCELLED)
  app.post('/api/admin/orders/:id/action', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const order = await messageService.firestoreRepo.getOrderById(id);
      if (!order) {
        return res.status(404).json({ error: 'Pedido não encontrado.' });
      }
      if (
        String(order.paymentMethod || '').toUpperCase() === 'PIX' &&
        ['CONFIRMED', 'DELIVERED', 'PAID_CONFIRMED'].includes(String(status).toUpperCase()) &&
        !order.paymentTransactionId
      ) {
        return res.status(409).json({
          error: 'O PIX só pode ser confirmado após confirmação do Sicredi ou conferência manual autorizada.',
        });
      }
      const result = await messageService.firestoreRepo.updateOrderStatus(id, status);
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro ao atualizar status do pedido', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Nova Venda Manual no Balcão / Caixa
  app.post('/api/admin/orders/manual', async (req, res) => {
    try {
      const { customerName, customerPhone, items, paymentMethod, notes } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Nenhum produto adicionado à venda.' });
      }
      const products = await messageService.firestoreRepo.getAllProducts();
      const productsById = new Map(products.map((product) => [String(product.id), product]));
      const normalizedItems = [];
      for (const item of items) {
        const product = productsById.get(String(item.productId));
        const quantity = Number(item.quantity);
        if (
          !product ||
          product.status === 'INATIVO' ||
          product.isAvailable === false ||
          !Number.isFinite(quantity) ||
          quantity <= 0
        ) {
          return res.status(400).json({ error: 'Produto ou quantidade inválida na venda.' });
        }
        normalizedItems.push({
          productId: String(product.id),
          name: product.name || product.descricao || 'Produto',
          price: Number(product.price || product.valor_num || 0),
          quantity,
          unit: product.unit || product.unidade || 'UN',
        });
      }
      const resolvedPaymentMethod = String(paymentMethod || 'DINHEIRO').toUpperCase();
      if (resolvedPaymentMethod === 'PIX' && require('../orders/pix-mode').pixMode() === 'MANUAL') {
        const order = await app.locals.pdv.service.create({ requestId: randomUUID(), items: normalizedItems, paymentMethod: 'PIX', orderType: 'PICKUP', customerName, customerPhone, notes }, req.user);
        return res.json({ success: true, order, receiptText: formatOrderReceipt(order) });
      }
      const orderId = randomUUID();
      const order = await messageService.firestoreRepo.createManualOrder({
        customerName,
        customerPhone,
        items: normalizedItems,
        paymentMethod: resolvedPaymentMethod,
        operatorName: req.user?.name || '',
        operatorId: req.user?.id || '',
        notes,
        orderId,
        status: resolvedPaymentMethod === 'PIX' ? 'AWAITING_PIX' : 'CONFIRMED',
        requirePersistence: resolvedPaymentMethod === 'PIX',
      });
      const receiptText = formatOrderReceipt(order);
      order.receiptText = receiptText;
      await messageService.firestoreRepo.saveOrderReceipt(order.id, receiptText).catch((error) => {
        Logger.warn('Venda registrada; a cópia persistente do recibo ficou indisponível.', { orderId: order.id, error: error.message });
      });
      let receiptDelivery = { sent: false, reason: 'Envio não solicitado.' };
      if (resolvedPaymentMethod === 'PIX') {
        receiptDelivery = await sendCustomerOrderReceipt(
          messageService.whatsappClient,
          customerPhone,
          receiptText,
        );
        if (!receiptDelivery.sent) {
          Logger.warn('Venda manual PIX criada; não foi possível enviar o recibo ao cliente.', {
            orderId: order.id,
            reason: receiptDelivery.reason,
          });
        }
      }

      // Notificação para todos os usuários ADMIN sobre a venda manual no balcão
      await messageService.firestoreRepo.notifyAllAdminUsersOfSale(order, { source: 'CAIXA_MANUAL' }).catch((err) => {
        Logger.warn('Aviso: falha ao notificar administradores sobre venda manual no caixa', { error: err.message });
      });

      res.status(200).json({
        success: true,
        order: { ...order, receiptText, receiptDelivery },
        receiptDelivery,
      });
    } catch (err) {
      Logger.error('Erro ao lançar pedido manual no caixa', err);
      res.status(500).json({ error: err.message });
    }
  });

  const { installPdvRoutes } = require('./pdv.routes');
  installPdvRoutes(app, {
    repository: messageService.firestoreRepo, pix: sicrediPixClient,
    whatsapp: messageService.whatsappClient,
    taskQueueClient,
    ownerPhone: process.env.OWNER_WHATSAPP_NUMBER || config.whatsapp?.ownerNumber || '',
  });
  app.use('/pdv-assets/dist', express.static(require('node:path').resolve(__dirname, '../../public/pdv/dist')));

  // --- API DO CAIXA & PDV RÁPIDO (CELULAR & BALCÃO) ---
  app.get('/api/caixa/products', async (_req, res) => {
    try {
      const products = await messageService.firestoreRepo.getAllProducts();
      const active = products
        .filter((p) => String(p.status || p.STATUS || '').trim().toUpperCase() === 'ATIVO')
        .map((p) => {
          const imageCandidates = getCashierProductImageCandidates(p);
          const imageUrl = imageCandidates[0] || '';
          const name = p.name || p.descricao || 'Produto';
          const savedUnit = String(p.saleUnit?.code || p.unit || p.unidade || '').trim().toUpperCase();
          const unit = savedUnit || (/(^|[^A-Z])KG([^A-Z]|$)/i.test(name) ? 'KG' : 'UN');

          return {
            id: p.id,
            status: String(p.status || p.STATUS || '').trim().toUpperCase(),
            name,
            price: Number(p.price || p.valor_num || 0),
            stock: Number(p.stockQuantity ?? p.estoque ?? 0),
            unit,
            saleUnit: {
              code: unit,
              label: p.saleUnit?.label || (unit === 'UN' ? 'unidade' : unit),
              minimum: Number(p.saleUnit?.minimum) || (unit === 'KG' ? 0.1 : 1),
              increment: Number(p.saleUnit?.increment) || (unit === 'KG' ? 0.1 : 1),
            },
            category: p.category || p.categoria || '',
            subcategory: p.subcategory || p.subcategoria || '',
            canonicalName: p.canonicalName || p.canonical_name || '',
            variation: p.variation || p.variacao || '',
            imageUrl,
            images: imageCandidates,
            imageFileId: p.imageFileId || p.image_file_id || '',
            imageIsIllustrative: /^https:\/\/images\.unsplash\.com\//i.test(imageUrl),
            imagePathCache: p.imagePathCache || '',
            imageFallbackUrl: '/store-assets/placeholder.svg',
            descriptionAi: p.descriptionAi || p.descricao_ia || '',
            tagsAi: p.tagsAi || p.tags_ia || '',
            details: getCashierProductDetails(p),
          };
        });
      res.status(200).json(active);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/caixa/customers', async (req, res) => {
    try {
      const customers = await messageService.firestoreRepo.searchCustomers(req.query.q, 10);
      res.status(200).json(customers);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/caixa/customers', async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim().slice(0, 100);
      const rawPhone = String(req.body?.phone || '').trim();
      const phoneDigits = rawPhone.replace(/\D/g, '');
      const cpfCnpj = String(req.body?.cpfCnpj || '').trim().slice(0, 30);
      const address = String(req.body?.address || req.body?.deliveryAddress || '').trim().slice(0, 250);
      const notes = String(req.body?.notes || '').trim().slice(0, 250);

      if (!name) {
        return res.status(400).json({ error: 'Informe pelo menos o nome do cliente.' });
      }

      const customerKey = phoneDigits.length >= 8 ? phoneDigits : `cli-${Date.now()}`;
      const customerData = {
        name,
        phone: rawPhone,
        phoneDigits,
        cpfCnpj,
        address,
        deliveryAddress: address,
        notes,
        createdAt: new Date().toISOString(),
      };

      await messageService.firestoreRepo.saveCustomerProfile(customerKey, customerData);
      res.status(201).json({ success: true, customer: { id: customerKey, ...customerData } });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/inventory-settings', async (_req, res, next) => {
    try {
      res.json(await messageService.firestoreRepo.getInventorySettings());
    } catch (error) { next(error); }
  });
  app.put('/api/admin/inventory-settings', async (req, res, next) => {
    if (typeof req.body?.stockControlEnabled !== 'boolean') {
      return res.status(400).json({ error: 'Informe uma opção válida de controle de estoque.' });
    }
    try {
      res.json(await messageService.firestoreRepo.saveInventorySettings(req.body));
    } catch (error) { next(error); }
  });

  app.get('/api/admin/stock/movements', async (req, res, next) => {
    try {
      const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 20));
      const movements = await messageService.firestoreRepo.getStockMovements(limit);
      res.json({ movements });
    } catch (error) { next(error); }
  });

  // Admin: Entrada Rápida de Estoque
  app.post('/api/admin/stock/quick-entry', async (req, res) => {
    try {
      const { productId, quantityAdded } = req.body;
      const result = await messageService.firestoreRepo.quickAddStock(productId, quantityAdded);
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro na entrada rápida de estoque', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/stock/adjustments', async (req, res) => {
    const { productId, operation, quantity, reason } = req.body || {};
    const requestId = String(req.body?.requestId || '').trim();
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId)) {
      return res.status(400).json({ error: 'Identificador de ajuste inválido. Atualize a tela e tente novamente.' });
    }
    try {
      const movement = await messageService.firestoreRepo.adjustStock({
        productId,
        operation,
        quantity,
        reason,
        requestId,
        expectedStock: req.body.expectedStock,
        actor: { id: req.user.id, name: req.user.name },
      });
      if (movement.operation === 'EXIT' && !movement.duplicate) {
        await messageService.firestoreRepo.notifyAllAdminUsersOfStockAdjustment(movement).catch((error) => {
          Logger.warn('Baixa registrada, mas não foi possível notificar os administradores.', { error: error.message });
        });
      }
      res.status(200).json(movement);
    } catch (error) {
      const status = /não encontrado/i.test(error.message) ? 404 : /insuficiente|estoque mudou|reservadas/i.test(error.message) ? 409 : 400;
      res.status(status).json({ error: error.message || 'Não foi possível ajustar o estoque.' });
    }
  });

  // Admin: Salvar / Atualizar Produto (com suporte a foto direta no Firestore e padrão de nomes/tags)
  app.post('/api/admin/products', async (req, res) => {
    try {
      const product = req.body;
      await messageService.firestoreRepo.saveProduct(product);
      if (messageService.catalogRepo) {
        messageService.catalogRepo.invalidateCache?.();
      }
      res.status(200).json({ success: true, product });
    } catch (err) {
      Logger.error('Erro ao salvar produto no admin', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Otimizar fotos, enviar ao Storage e salvar os metadados no Firestore
  app.post('/api/admin/products/:id/photo', express.raw({ type: 'application/octet-stream', limit: '20mb' }), async (req, res) => {
    try {
      const { id } = req.params;
      const rawPhoto = Buffer.isBuffer(req.body) ? req.body : null;
      const body = rawPhoto ? {} : (req.body || {});
      const prod = (await messageService.firestoreRepo.getProductById(id)) || { id, name: req.headers['x-product-name'] || 'Produto' };

      const { photoBase64, photosBase64, photos, contentType, maxWidth, maxHeight, quality, format, append } = body;
      const incomingList = rawPhoto
        ? [{ base64: rawPhoto.toString('base64'), contentType: req.headers['x-photo-content-type'] || 'image/jpeg' }]
        : Array.isArray(photosBase64) && photosBase64.length > 0
        ? photosBase64
        : (Array.isArray(photos) && photos.length > 0 ? photos : (photoBase64 ? [photoBase64] : null));
      const shouldAppend = rawPhoto ? req.headers['x-photo-append'] === 'true' : append;

      if (!incomingList || incomingList.length === 0) {
        return res.status(400).json({ error: 'Envie os dados da foto em base64.' });
      }

      const { buildOptimizedFirestorePhotoDocument } = require('../catalog/product-photo.service');
      const savedPhotos = [];
      const existingImages = shouldAppend
        ? (Array.isArray(prod.images) ? [...prod.images] : (prod.imageUrl ? [prod.imageUrl] : []))
        : [];
      const existingImagePaths = shouldAppend
        ? existingImages.map((_, index) => (
          Array.isArray(prod.imagePaths)
            ? prod.imagePaths[index] || ''
            : (index === 0 ? prod.imagePath || '' : '')
        ))
        : [];
      const startIndex = existingImages.length;

      for (let i = 0; i < incomingList.length; i++) {
        const item = incomingList[i];
        const rawBase = typeof item === 'string' ? item : (item.photoBase64 || item.base64 || item.data || '');
        const cType = (typeof item === 'object' && item.contentType) ? item.contentType : (contentType || 'image/jpeg');
        const cleanBase64 = String(rawBase).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

        const photoDoc = await buildOptimizedFirestorePhotoDocument(prod, {
          base64Data: cleanBase64,
          contentType: cType,
          source: 'WEBSITE_DIRECT',
          index: startIndex + i,
          maxWidth: maxWidth ? parseInt(maxWidth, 10) : undefined,
          maxHeight: maxHeight ? parseInt(maxHeight, 10) : undefined,
          quality: quality ? parseInt(quality, 10) : undefined,
          format,
          preserveZoomQuality: true,
          preserveOriginal: true,
        });

        const storedImage = await messageService.firestoreRepo.uploadProductImage(photoDoc);
        const storedPhoto = { ...photoDoc, ...storedImage };
        await messageService.firestoreRepo.saveProductPhoto(storedPhoto);
        savedPhotos.push(storedPhoto);
      }

      const imageEntries = new Map();
      existingImages.forEach((url, index) => {
        imageEntries.set(url, { url, path: existingImagePaths[index] || '' });
      });
      savedPhotos.forEach((photo) => {
        imageEntries.set(photo.imageUrl, { url: photo.imageUrl, path: photo.imagePath });
      });
      const allImages = Array.from(imageEntries.values());
      const primaryPhoto = savedPhotos[0];

      const updatedProduct = {
        ...prod,
        imageUrl: allImages[0]?.url || primaryPhoto.imageUrl,
        imagePath: allImages[0]?.path || primaryPhoto.imagePath,
        imagePaths: allImages.map((image) => image.path),
        images: allImages.map((image) => image.url),
        imageFileId: primaryPhoto.id,
        imagePathCache: allImages[0]?.url || primaryPhoto.imageUrl,
        tagsAi: primaryPhoto.tagsAi,
        tags_ia: primaryPhoto.tagsAi,
        descriptionAi: primaryPhoto.descriptionAi,
        descricao_ia: primaryPhoto.descriptionAi,
        updatedAt: new Date().toISOString(),
      };

      await messageService.firestoreRepo.saveProduct(updatedProduct);

      if (messageService.catalogRepo) {
        messageService.catalogRepo.invalidateCache?.();
      }

      res.status(200).json({
        success: true,
        photo: {
          id: primaryPhoto.id,
          fileName: primaryPhoto.fileName,
          tags: primaryPhoto.tagsAi,
          url: updatedProduct.imageUrl,
          imagePath: updatedProduct.imagePath,
          compression: primaryPhoto.compression || null,
        },
        photos: savedPhotos.map((p) => ({
          id: p.id,
          fileName: p.fileName,
          tags: p.tagsAi,
          url: p.imageUrl,
          imagePath: p.imagePath,
          compression: p.compression || null,
        })),
        product: updatedProduct,
      });
    } catch (err) {
      Logger.error('Erro no upload de foto para o Firebase Storage', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Upload múltiplo direto via /api/admin/products/:id/photos
  app.post('/api/admin/products/:id/photos', async (req, res) => {
    req.url = `/api/admin/products/${req.params.id}/photo`;
    return app.handle(req, res);
  });

  // Público: Consulta fotos detalhadas de um produto
  app.get('/api/products/:id/photos', async (req, res) => {
    try {
      const { id } = req.params;
      const photos = await messageService.firestoreRepo.getProductPhotos(id);
      const metadata = photos.map((photo) => {
        const safePhoto = { ...photo };
        delete safePhoto.data;
        delete safePhoto.dataUrl;
        return safePhoto;
      });
      res.status(200).json({ success: true, count: metadata.length, photos: metadata });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Utilitário de Compressão e Redimensionamento de Imagem no Servidor
  app.post('/api/admin/images/compress', async (req, res) => {
    try {
      const { imageBase64, maxWidth, maxHeight, quality, format } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'Envie imageBase64 para compressão.' });
      }

      const { compressImageBase64 } = require('../catalog/image-compressor');
      const result = await compressImageBase64(imageBase64, {
        maxWidth: maxWidth ? parseInt(maxWidth, 10) : undefined,
        maxHeight: maxHeight ? parseInt(maxHeight, 10) : undefined,
        quality: quality ? parseInt(quality, 10) : undefined,
        format,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      Logger.error('Erro na compressão de imagem no servidor', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Excluir Produto
  app.delete('/api/admin/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await messageService.firestoreRepo.deleteProduct(id);
      res.status(200).json({ success: true });
    } catch (err) {
      Logger.error('Erro ao excluir produto no admin', err);
      res.status(500).json({ error: err.message });
    }
  });

  // System Diagnostics & Connection Status API (Exclusivo Admin)
  app.get('/api/admin/system-status', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try {
      const status = await systemStatusService.getSystemStatus();
      res.status(200).json(status);
    } catch (err) {
      Logger.error('Erro ao coletar status do sistema', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Auth: Google Sign-In (Clientes opcionais e Admin com acesso liberado)
  app.post('/api/auth/google', async (req, res) => {
    try {
      const { idToken } = req.body || {};
      if (typeof idToken !== 'string' || !idToken.trim()) {
        return res.status(401).json({ success: false, error: 'Token Firebase obrigatório.' });
      }
      let identity;
      try {
        identity = await verifyGoogleToken(idToken);
      } catch {
        return res.status(401).json({ success: false, error: 'Sessão Google inválida ou expirada. Entre novamente.' });
      }
      if (!identity.email || identity.email_verified !== true || identity.firebase?.sign_in_provider !== 'google.com') {
        return res.status(401).json({ success: false, error: 'Use uma conta Google com e-mail verificado.' });
      }
      const { email, name, picture, uid } = identity;

      const normalizedEmail = email.toLowerCase().trim();
      const users = await messageService.firestoreRepo.getAllUsers();
      const existingUser = users.find((u) => u.email && u.email.toLowerCase().trim() === normalizedEmail);

      if (existingUser?.active === false) {return res.status(403).json({ error: 'Usuário inativo.' });}

      // Edmar Júnio ou qualquer usuário previamente cadastrado com perfil ADMIN
      const isSuperAdmin = normalizedEmail === 'edmarjuniob@gmail.com' || (existingUser && existingUser.role === 'ADMIN');
      const role = isSuperAdmin ? 'ADMIN' : (existingUser ? existingUser.role : 'CLIENTE');

      const user = {
        id: existingUser ? existingUser.id : `usr-g-${uid}`,
        name: name || (existingUser ? existingUser.name : normalizedEmail.split('@')[0]),
        email: normalizedEmail,
        picture: picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || normalizedEmail)}&background=15803d&color=fff`,
        role,
        authProvider: 'GOOGLE',
        firebaseUid: uid,
      };

      // Sempre persiste o usuário para que o admin possa gerenciá-lo na lista de usuários
      await messageService.firestoreRepo.saveUser({ ...existingUser, ...user });

      await sessions.issue(req, res, user);
      res.status(200).json({ success: true, user: safeUser(user) });
    } catch (err) {
      Logger.error('Erro na autenticação Google', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Auth: Cadastro de Cliente com Email e Senha (perfil padrão: CLIENTE)
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password, phone, address } = req.body;
      const result = await messageService.firestoreRepo.registerUser({ name, email, password, phone, address });
      if (!result.success) {
        return res.status(400).json(result);
      }
      await sessions.issue(req, res, result.user);
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro no cadastro de usuário', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Auth: Login do Cliente com Email e Senha
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await messageService.firestoreRepo.loginUser(email, password);
      if (!result.success) {
        return res.status(401).json(result);
      }
      await sessions.issue(req, res, result.user);
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro no login de usuário', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: Alterar Perfil de qualquer Usuário (CLIENTE, CAIXA, ADMIN)
  app.post('/api/admin/users/:id/role', async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const result = await messageService.firestoreRepo.updateUserRole(id, role);
      if (result.user) {result.user = safeUser(result.user);}
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro ao atualizar perfil do usuário', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Auth: Login do Colaborador (Admin ou Caixa)
  app.post('/api/admin/auth/login', async (req, res) => {
    try {
      const { userId, pin } = req.body;
      const result = await messageService.firestoreRepo.authenticateUser(userId, pin);
      if (!result.success) {
        return res.status(401).json(result);
      }
      await sessions.issue(req, res, result.user);
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro no login admin', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Auth: Listar Colaboradores para Autenticação e Gestão
  app.get('/api/admin/auth/users', async (req, res) => {
    try {
      const users = await messageService.firestoreRepo.getAllUsers();
      res.status(200).json(req.user?.role === 'ADMIN' ? users.map(safeUser) : users.filter(u => u.active !== false && ['ADMIN', 'CAIXA', 'VENDEDOR', 'ENTREGADOR'].includes(u.role)).map(u => ({ id: u.id, name: u.name, role: u.role })));
    } catch (err) {
      Logger.error('Erro ao listar usuários', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Criar ou Editar Colaborador
  app.post('/api/admin/users', async (req, res) => {
    try {
      const userData = req.body;
      const saved = await messageService.firestoreRepo.saveUser(userData);
      res.status(200).json({ success: true, user: safeUser(saved) });
    } catch (err) {
      Logger.error('Erro ao salvar colaborador', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Excluir Colaborador
  app.delete('/api/admin/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await messageService.firestoreRepo.deleteUser(id);
      res.status(200).json({ success: deleted });
    } catch (err) {
      Logger.error('Erro ao excluir colaborador', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Alterações de Venda: Listar Solicitações
  app.get('/api/admin/alterations', async (_req, res) => {
    try {
      const alterations = await messageService.firestoreRepo.getAllOrderAlterations();
      res.status(200).json(alterations);
    } catch (err) {
      Logger.error('Erro ao buscar alterações', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Alterações de Venda: Criar Solicitação pelo Atendente do Caixa
  app.post('/api/admin/alterations', async (req, res) => {
    try {
      const { orderId, originalOrder, proposedOrder, reason } = req.body;
      if (!orderId || !proposedOrder) {
        return res.status(400).json({ error: 'Dados da solicitação incompletos.' });
      }
      const requestObj = await messageService.firestoreRepo.createOrderAlterationRequest({
        orderId,
        originalOrder,
        proposedOrder,
        requestedBy: req.user.id,
        requestedByName: req.user.name,
        reason,
      });
      res.status(200).json({ success: true, request: requestObj });
    } catch (err) {
      Logger.error('Erro ao criar solicitação de alteração', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Alterações de Venda: Administrador Aceita ou Recusa com Motivo
  app.post('/api/admin/alterations/:id/review', async (req, res) => {
    try {
      const { id } = req.params;
      const { action, rejectionReason } = req.body;
      const result = await messageService.firestoreRepo.reviewOrderAlteration({
        requestId: id,
        action,
        reviewedBy: req.user.id,
        rejectionReason,
      });
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro ao revisar alteração', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/discount-approvals', async (_req, res) => {
    try {
      const approvals = await messageService.firestoreRepo.getPendingDiscountApprovals();
      res.status(200).json(approvals);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/discount-approvals/:id/review', async (req, res) => {
    try {
      const { action, rejectionReason = '' } = req.body || {};
      if (!['APPROVED', 'REJECTED'].includes(action)) {
        return res.status(400).json({ error: 'Ação de auditoria inválida.' });
      }
      if (action === 'REJECTED' && !String(rejectionReason).trim()) {
        return res.status(400).json({ error: 'Informe o motivo da recusa.' });
      }

      const repo = messageService.firestoreRepo;
      const approval = await repo.getDiscountApproval(req.params.id);
      if (!approval) {return res.status(404).json({ error: 'Solicitação não encontrada.' });}
      if (approval.status !== 'PENDING') {return res.status(409).json({ error: 'Esta solicitação já foi revisada.' });}

      if (action === 'REJECTED') {
        const reason = String(rejectionReason).trim().slice(0, 500);
        const reviewed = await repo.updateDiscountApproval(req.params.id, {
          status: 'REJECTED',
          rejectionReason: reason,
          reviewedAt: new Date().toISOString(),
          reviewedBy: req.user.id,
        });
        if (approval.requestedBy) {
          await repo.createNotification({
            toUserId: approval.requestedBy,
            type: 'DISCOUNT_APPROVAL_REJECTED',
            approvalId: approval.id,
            title: 'Desconto recusado pelo administrador',
            message: `A solicitação de ${approval.discountPercent}% foi recusada. Motivo: ${reason}`,
            reason,
          });
        }
        return res.status(200).json({ success: true, approval: reviewed });
      }

      if (approval.source === 'PDV') {
        const order = await app.locals.pdv.service.create(approval.input, approval.createdBy, { approvedDiscount: true });
        const reviewed = await repo.updateDiscountApproval(req.params.id, {
          status: 'APPROVED', reviewedAt: new Date().toISOString(), reviewedBy: req.user.id, order,
        });
        return res.json({ success: true, approval: reviewed, order });
      }

      const isPix = approval.paymentMethod === 'PIX';
      if (isPix) {
        return res.status(409).json({ error: 'Esta solicitação usa o fluxo antigo. Refaça a venda no Caixa para registrar Pix manual com conferência e comprovante.' });
      }
      const ticketNumber = String(Math.floor(100 + Math.random() * 900));
      const orderId = randomUUID();
      const order = await repo.createManualOrder({
        ...approval,
        items: approval.items,
        status: 'AWAITING_CASHIER',
        ticketNumber,
        pixCode: '',
        orderId,
        discountAmount: approval.discountAmount,
        discountPercent: approval.discountPercent,
        requirePersistence: false,
      });
      const receiptText = formatOrderReceipt(order);
      order.receiptText = receiptText;
      await messageService.firestoreRepo.saveOrderReceipt(order.id, receiptText).catch((error) => {
        Logger.warn('Venda registrada; a cópia persistente do recibo ficou indisponível.', { orderId: order.id, error: error.message });
      });
      let receiptDelivery = { sent: false, reason: 'Envio não solicitado.' };
      const orderWithReceipt = { ...order, receiptText };
      if (isPix) {
        receiptDelivery = await sendCustomerOrderReceipt(
          messageService.whatsappClient,
          approval.customerPhone,
          receiptText,
        );
        if (!receiptDelivery.sent) {
          Logger.warn('Desconto aprovado; não foi possível enviar o recibo PIX ao cliente.', {
            orderId: order.id,
            reason: receiptDelivery.reason,
          });
        }
      }
      orderWithReceipt.receiptDelivery = receiptDelivery;
      const reviewed = await repo.updateDiscountApproval(req.params.id, {
        status: 'APPROVED',
        reviewedAt: new Date().toISOString(),
        reviewedBy: req.user.id,
        order: orderWithReceipt,
      });
      if (approval.requestedBy) {
        await repo.createNotification({
          toUserId: approval.requestedBy,
          type: 'DISCOUNT_APPROVAL_ACCEPTED',
          approvalId: approval.id,
          orderId: order.id,
          title: 'Desconto aprovado pelo administrador',
          message: `Pedido #${order.ticketNumber} aprovado. Total: R$ ${Number(order.total).toFixed(2).replace('.', ',')}.`,
        });
      }
      res.status(200).json({ success: true, approval: reviewed, order: orderWithReceipt });
    } catch (err) {
      Logger.error('Erro ao revisar aprovação de desconto', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Notificações: Buscar para o usuário (Caixa ou Admin)
  app.get('/api/admin/notifications', async (req, res) => {
    try {
      const userId = req.user.id;
      const notifs = await messageService.firestoreRepo.getUserNotifications(userId);
      res.status(200).json(notifs);
    } catch (err) {
      Logger.error('Erro ao buscar notificações', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Notificações: Marcar como lida
  app.post('/api/admin/notifications/:id/read', async (req, res) => {
    try {
      const { id } = req.params;
      await messageService.firestoreRepo.markNotificationRead(id);
      res.status(200).json({ success: true });
    } catch (err) {
      Logger.error('Erro ao atualizar notificação', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Métricas do Dia e Resumo do Caixa
  app.get('/api/admin/daily-metrics', async (req, res) => {
    try {
      const isAdmin = req.user?.role === 'ADMIN';
      const selectedOperator = isAdmin ? String(req.query.operator || '') : '';
      const metrics = await messageService.firestoreRepo.getDailySalesMetrics({
        operatorId: isAdmin ? (selectedOperator.startsWith('name:') ? '' : selectedOperator) : req.user?.id,
        operatorName: isAdmin
          ? (selectedOperator.startsWith('name:') ? selectedOperator.slice(5) : String(req.query.operatorName || ''))
          : req.user?.name,
      });
      res.status(200).json(metrics);
    } catch (err) {
      Logger.error('Erro ao buscar métricas diárias', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Métricas Executivas Diárias (Substituição de Alta Performance do Looker Studio)
  app.get('/api/admin/executive-metrics', async (req, res) => {
    try {
      const date = req.query.date || getBusinessDate(new Date());
      const metrics = await messageService.firestoreRepo.getDailyExecutiveMetrics({ date });
      res.status(200).json(metrics);
    } catch (err) {
      Logger.error('Erro ao buscar métricas executivas diárias', err);
      const statusCode = String(err.message || '').startsWith('Data inválida') ? 400 : 500;
      res.status(statusCode).json({ error: err.message });
    }
  });

  app.get('/api/admin/executive-period-metrics', async (req, res) => {
    try {
      const metrics = await messageService.firestoreRepo.getExecutivePeriodMetrics({
        from: String(req.query.from || ''),
        to: String(req.query.to || ''),
        comparisonMode: ['month', 'year'].includes(req.query.comparisonMode) ? req.query.comparisonMode : 'previous',
      });
      res.status(200).json(metrics);
    } catch (err) {
      Logger.error('Erro ao buscar métricas executivas por período', err);
      const statusCode = /período máximo|período inválido|datas válidas/i.test(String(err.message || '')) ? 400 : 503;
      res.status(statusCode).json({ error: err.message || 'Não foi possível consultar o período.' });
    }
  });

  // Envio manual do relatório diário para o WhatsApp do Júnior. O endpoint é protegido como ação ADMIN.
  app.post('/api/admin/executive-metrics/send-whatsapp', async (req, res) => {
    if (req.user?.role !== 'ADMIN') { return res.status(403).json({ error: 'Somente ADMIN pode enviar o relatório.' }); }
    const ownerPhone = normalizeWhatsAppNumber(process.env.OWNER_WHATSAPP_NUMBER || config.whatsapp?.ownerNumber);
    if (!ownerPhone) { return res.status(503).json({ error: 'Configure o WhatsApp do Júnior em OWNER_WHATSAPP_NUMBER.' }); }
    if (!messageService.whatsappClient?.sendTextMessage) { return res.status(503).json({ error: 'Integração oficial do WhatsApp indisponível.' }); }

    try {
      const date = String(req.body?.date || getBusinessDate(new Date()));
      if (!isValidReportDate(date)) { return res.status(400).json({ error: 'Data inválida. Selecione uma data válida.' }); }
      const metrics = await messageService.firestoreRepo.getDailyExecutiveMetrics({ date });
      const messages = formatDailyExecutiveReport(metrics);
      let messagesSent = 0;
      for (const text of messages) {
        const result = await messageService.whatsappClient.sendTextMessage(ownerPhone, text);
        if (result?.mock || !result?.messages?.length) {
          throw new Error('O WhatsApp não confirmou o envio da mensagem.');
        }
        messagesSent++;
      }
      return res.status(200).json({ success: true, messagesSent, date });
    } catch (error) {
      Logger.error('Falha ao enviar relatório diário ao WhatsApp do Júnior', error);
      return res.status(502).json({ error: error.message || 'Não foi possível enviar o relatório.' });
    }
  });

  // Fechamento de Caixa Diário com PDF e Notificação no WhatsApp do Patrão
  app.post('/api/admin/cashier/close-day', async (req, res) => {
    try {
      const { date } = req.body || {};
      const closingDate = date || getBusinessDate(new Date());
      if (!isValidReportDate(closingDate)) { return res.status(400).json({ error: 'Data inválida. Selecione uma data válida.' }); }
      const result = await messageService.firestoreRepo.closeCashierDay({
        date: closingDate,
        requestId: req.body.requestId,
        closedBy: req.user?.name || req.user?.email || 'Administrador',
        notifyOwnerWhatsapp: false,
        whatsappClient: messageService.whatsappClient,
      });
      const jobId = result.closingId + '-owner';
      await app.locals.pdv.store.transaction(async tx => {
        if (await tx.get('pdv_outbox', jobId)) return;
        tx.set('pdv_outbox', jobId, { id: jobId, kind: 'closing', status: 'PENDING', attempts: 0, reportFileName: result.reportFileName, text: formatDailyExecutiveReport(result.metrics).join('\n\n') });
      });
      result.whatsappQueued = true;
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro no fechamento do caixa diário', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.use((error, req, res, _next) => {
    if (res.headersSent) return _next(error);
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : Number(error.status) || 500;
    if (status >= 500) Logger.error('Falha na requisição', error, { requestId: req.requestId });
    else Logger.warn('Requisição inválida', { requestId: req.requestId, status });
    res.locals.errorCaptured = true;
    res.status(status >= 400 && status <= 599 ? status : 500).json({ error: status === 400 ? 'Dados inválidos. Confira o formulário.' : status === 413 ? 'Arquivo ou formulário muito grande.' : 'Não foi possível concluir a operação. Tente novamente.', requestId: req.requestId });
  });
  return app;
}

module.exports = {
  createApp,
  getProductImageCandidates,
  getCashierProductImageCandidates,
  renderAdminHtml,
  renderPrivacyPolicyHtml,
  renderDataDeletionHtml,
  renderTermsOfServiceHtml,
};

