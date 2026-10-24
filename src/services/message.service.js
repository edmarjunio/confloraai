const Logger = require('../shared/logger');

function isAmbiguousMessage(text) {
  const norm = String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  if (!norm || norm.length < 3) return false;

  const patterns = [
    /\bpensando em comprar\b/,
    /\bnao sei ainda\b/,
    /\bnao sei o que\b/,
    /\bnao sei direito\b/,
    /\bqueria ver um negocio\b/,
    /\bver um negocio\b/,
    /\bver umas coisas\b/,
    /\bso olhadinha\b/,
    /\bso olhando\b/,
    /\bso dando uma olhada\b/,
    /\bduvida sobre o que\b/,
    /\bindecis[oa]\b/,
  ];
  return patterns.some(pattern => pattern.test(norm));
}

class MessageService {
  /**
   * @param {Object} dependencies
   * @param {import('../ai/agent.service').AgentService} dependencies.agentService
   * @param {import('../catalog/catalog.repository').CatalogRepository} dependencies.catalogRepo
   * @param {import('../database/firestore.repository').FirestoreRepository} dependencies.firestoreRepo
   * @param {import('../orders/order.service').OrderService} dependencies.orderService
   * @param {import('../integrations/whatsapp.client').WhatsAppClient} dependencies.whatsappClient
   */
  constructor({
    agentService,
    catalogRepo,
    firestoreRepo,
    orderService,
    whatsappClient,
  }) {
    this.agentService = agentService;
    this.catalogRepo = catalogRepo;
    this.firestoreRepo = firestoreRepo;
    this.orderService = orderService;
    this.whatsappClient = whatsappClient;
  }

  /**
   * Pipeline durável de atendimento: template, catálogo Meta e serviços comerciais oficiais.
   *
   * @param {Object} input
   * @param {string} input.phone
   * @param {string} input.message
   * @param {string} [input.customerName='']
   * @param {string} [input.messageId='']
   * @returns {Promise<{ reply: string, intent: string, imagesSent?: number, latencyMs: number }>}
   */
  async handleCustomerMessage({
    ...payload
  }) {
    if (!payload.messageId) return this.processCustomerMessage(payload);
    const { IncomingMessageService } = require('./incoming-message.service');
    this.incoming ||= new IncomingMessageService(this.firestoreRepo);
    const claim = await this.incoming.claim(payload.messageId);
    if (claim.completed) return { reply: '', intent: 'DUPLICATE', latencyMs: 0 };
    try {
      const result = await this.processCustomerMessage({ ...claim.payload, verifyOnly: payload.verifyOnly });
      await this.incoming.finish(claim);
      return result;
    } catch (error) {
      if (error.automationBlocked) { await this.incoming.finish(claim); return { reply: '', intent: 'STALE_AUTOMATION_BLOCKED', latencyMs: 0 }; }
      await this.incoming.finish(claim, error);
      throw error;
    }
  }

  async processCustomerMessage({
    phone,
    message,
    interactiveId = '',
    customerName = '',
    messageId = '',
    verifyOnly = false,
    commerceOrder = null,
    conversationVersion,
  }) {
    const { evaluateDailyReset } = require('./conversation-automation');
    await evaluateDailyReset(this.firestoreRepo, phone).catch(err => {
      Logger.warn('Erro ao avaliar reset diário', { error: err.message, phone });
    });
    const startTime = performance.now();
    let whatsapp;
    // 1. Marcar como lida e salvar mensagem

    await this.firestoreRepo.appendMessage(phone, 'user', message, { requirePersistence: true, messageId });

    const { conversationAutomation, setConversationChannel } = require('./conversation-automation');
    let conversation = await conversationAutomation(this.firestoreRepo, phone);

    if (conversation.automation === 'paused') return { reply: '', intent: 'HUMAN_HANDOFF_ACTIVE', imagesSent: 0, latencyMs: 0 };
    if (conversationVersion !== undefined && conversationVersion !== Number(conversation.version || 0)) return { reply: '', intent: 'STALE_AUTOMATION_BLOCKED', latencyMs: 0 };
    if (verifyOnly) return { reply: '', intent: 'AUTOMATION_DISABLED', imagesSent: 0, latencyMs: 0 };
    const whatsappConfig = require('../config/env').whatsapp;
    if (!whatsappConfig.assistantEnabled) return { reply: '', intent: 'AUTOMATION_DISABLED', imagesSent: 0, latencyMs: 0 };
    if (whatsappConfig.agentOwner !== 'cloud_api') return { reply: '', intent: 'AUTOMATION_DISABLED', imagesSent: 0, latencyMs: 0 };

    whatsapp = require('./durable-conversation-transport').durableConversationTransport(this.firestoreRepo, this.whatsappClient, { phone, messageId, version: Number(conversation.version || 0) });
    const work = operation => require('./automation-send-guard').withAutomation(this.firestoreRepo, phone, Number(conversation.version || 0), operation);
    if (messageId) whatsapp?.markAsRead?.(messageId)?.catch(() => {});
    const command = require('../shared/string.util').normalizeText(message);
    if (/^(reiniciar|recomecar conversa)$/.test(command)) {
      const reset = await require('./conversation-automation').resetConversationContext(this.firestoreRepo, phone);
      whatsapp = require('./durable-conversation-transport').durableConversationTransport(this.firestoreRepo, this.whatsappClient, { phone, messageId, version: reset.conversation.version });
      return this.sendMainMenu(phone, whatsapp, startTime, customerName);
    }
    if (command === 'menu') return this.sendMainMenu(phone, whatsapp, startTime, customerName);
    if (!interactiveId && isAmbiguousMessage(message)) {
      await conversationAutomation(this.firestoreRepo, phone, { pauseReason: 'ambiguous_customer_needs_human', messageId });
      return { reply: '', intent: 'AMBIGUOUS_NEEDS_HUMAN', latencyMs: 0 };
    }
    if (!interactiveId && /\b(falar com humano|atendimento humano|pessoa de verdade|transferir para humano)\b/.test(command)) {
      await conversationAutomation(this.firestoreRepo, phone, { pauseReason: 'human_requested', messageId });
      return { reply: '', intent: 'HUMAN_HANDOFF_ACTIVE', latencyMs: 0 };
    }
    this.orderIntake ||= new (require('./order-intake.service').OrderIntakeService)(this.firestoreRepo, { catalog: this.catalogRepo, notify: id => this.orderService?.commerce?.pdv?.deliver(id) });
    this.salesConversation ||= new (require('./sales-conversation.service').SalesConversationService)({ repository: this.firestoreRepo, agent: this.agentService, orders: this.orderService, catalog: this.catalogRepo, intake: this.orderIntake });
    if (commerceOrder) {
      await setConversationChannel(this.firestoreRepo, phone, 'agent');
      const result = await work(() => this.salesConversation.receiveMetaCart({ phone, commerceOrder, messageId }));
      return this.sendSalesResult(phone, whatsapp, result, messageId, startTime);
    }
    if (interactiveId === 'catalogo_virtual') return this.sendMainMenu(phone, whatsapp, startTime, customerName);
    if (['montar_sacola', 'btn_sacola'].includes(interactiveId) || /^(montar minha sacola|montar sacola|comprar agora|comprar|fazer pedido)$/.test(command) || /^(cat_|sub_|add_)/.test(interactiveId)) {
      await setConversationChannel(this.firestoreRepo, phone, 'agent');
      if (process.env.WHATSAPP_META_CATALOG_ENABLED === 'true' && process.env.WHATSAPP_META_CATALOG_ID) {
        try {
          await whatsapp.sendCatalogMessage(phone);
          return { reply: '', intent: 'META_CATALOG_SENT', latencyMs: Math.round(performance.now() - startTime) };
        } catch (error) {
          if (error.automationBlocked || !error.definitelyNotSent) throw error;
          Logger.error('Catálogo Meta recusado; compra por texto e conferência operacional necessárias.', error, { source: 'WHATSAPP' });
        }
      }
      const reply = 'O catálogo do WhatsApp está indisponível ou aguarda habilitação pela equipe. Por enquanto, escreva os produtos e quantidades para comprar por aqui.';
      await whatsapp.sendTextMessage(phone, reply);
      return { reply, intent: 'META_CATALOG_PENDING_TEXT_SALES', latencyMs: 0 };
    }
    if (interactiveId === 'btn_atendente') {
      await setConversationChannel(this.firestoreRepo, phone, 'agent');
      const reply = 'Olá! 🌱 Sou o assistente virtual da Conflora. O que você procura?';
      await whatsapp.sendTextMessage(phone, reply);
      await this.firestoreRepo.appendMessage(phone, 'assistant', reply, { requirePersistence: true });
      return { reply, intent: 'AGENT_ASSISTANCE', latencyMs: 0 };
    }
    const session = await this.salesConversation.store.read('sessions', phone) || {};
    const procurement = await work(() => this.orderIntake.procurement.reply({ phone, message, messageId, session }));
    if (procurement) return this.sendSalesResult(phone, whatsapp, procurement, messageId, startTime);
    const objective = require('./sales-parser').parseSalesMessage(message, session.salesConversation);
    if (objective?.items?.some(item => require('./meta-catalog-sync.service').restrictedCategory(item.name))) {
      await conversationAutomation(this.firestoreRepo, phone, { pauseReason: 'commerce_policy_review_required', messageId });
      return { reply: '', intent: 'COMMERCE_POLICY_REVIEW', latencyMs: 0 };
    }
    if (this.metaAgentService && !interactiveId && (objective?.query || /\b(foto|fotos|imagem|imagens)\b/.test(command))) {
      const envelope = await work(() => this.metaAgentService.execute('atender_mensagem', { customer_phone: phone, message_id: messageId || require('node:crypto').randomUUID(), message }));
      if (!envelope.next_action.send_customer_message) return { reply: '', intent: 'HUMAN_HANDOFF_ACTIVE', latencyMs: 0 };
      if (envelope.data.kind !== 'ORDER_INTAKE') {
        const id = 'catalog-' + require('node:crypto').createHash('sha256').update(messageId || require('node:crypto').randomUUID()).digest('hex');
        await require('../database/transactions').runTransaction(this.firestoreRepo, async tx => {
          const existing = await tx.get('pdv_outbox', id);
          if (existing) return;
          tx.set('pdv_outbox', id, { id, kind: 'conversation-catalog', recipient: phone, conversationVersion: Number(conversation.version || 0),
            productIds: envelope.data.products.map(product => product.id), photoRequested: Boolean(envelope.data.photo_requested), criteriaQuery: message,
            status: 'PENDING', attempts: 0, createdAt: new Date().toISOString() });
        });
        return { reply: '', intent: 'VERIFIED_CATALOG_QUEUED', latencyMs: 0 };
      }
    }
    if (!interactiveId && require('../shared/greeting').recognizeGreeting(message)) {
      if (!conversation.channel || conversation.channel === 'menu') return this.sendMainMenu(phone, whatsapp, startTime, customerName);
      const reply = `${require('../shared/greeting').recognizeGreeting(message)} Qual produto você procura?`;
      return this.sendSalesResult(phone, whatsapp, { reply, intent: 'GREETING_SENT' }, messageId, startTime);
    }
    if ((!conversation.channel || conversation.channel === 'menu') && !objective && !interactiveId && !session.salesConversation?.items?.length) {
      await conversationAutomation(this.firestoreRepo, phone, { pauseReason: 'ambiguous_customer_needs_human', messageId });
      return { reply: '', intent: 'AMBIGUOUS_NEEDS_HUMAN', latencyMs: 0 };
    }
    conversation = await setConversationChannel(this.firestoreRepo, phone, 'agent');
    if (String(message || '') === '[COMPROVANTE_ENVIADO]') {
      const reply = 'Envie o comprovante na página do pedido. O caixa confere o Pix antes de confirmar.';
      return this.sendSalesResult(phone, whatsapp, { reply, intent: 'MANUAL_PIX_AWAITING_REVIEW' }, messageId, startTime);
    }
    // Old checkout callbacks never authorize a sale. Existing persisted orders stay intact.
    if (/^(order_|pay_)/.test(interactiveId)) {
      return this.sendSalesResult(phone, whatsapp, { reply: 'Essa opção pertence ao atendimento anterior. Escreva os produtos e quantidades para conferir o pedido atual.', intent: 'LEGACY_CALLBACK_EXPIRED' }, messageId, startTime);
    }
    const result = await work(() => this.salesConversation.handle({ phone, message, interactiveId, customerName, messageId }));
    return this.sendSalesResult(phone, whatsapp, result, messageId, startTime);
  }

  async sendSalesResult(phone, whatsapp, result, messageId, startTime) {
    if (result.reply) {
      if (!result.buttons?.length || result.reply.length > 1000) {
        const characters = Array.from(result.reply);
        for (let offset = 0; offset < characters.length; offset += 3500) await whatsapp.sendTextMessage(phone, characters.slice(offset, offset + 3500).join(''));
      }
      if (result.buttons?.length) await whatsapp.sendInteractiveButtons(phone, { bodyText: result.reply.length > 1000 ? `Confira o resumo completo enviado acima.\n${result.reply.slice(-900)}` : result.reply, buttons: result.buttons });
      await this.firestoreRepo.appendMessage(phone, 'assistant', result.reply, { requirePersistence: true, messageId });
    }
    return { ...result, latencyMs: Math.round(performance.now() - startTime) };
  }

  async sendMainMenu(phone, whatsapp, startTime, customerName = '') {
    await require('./conversation-automation').setConversationChannel(this.firestoreRepo, phone, 'menu');
    try { await whatsapp.sendWelcomeTemplate(phone, customerName); }
    catch (error) {
      Logger.error('Falha no template de boas-vindas; reconciliação operacional necessária.', error, { source: 'WHATSAPP', diagnosticCode: error.diagnosticCode || 'WELCOME_TRANSPORT_FAILURE' });
      error.requiresReconciliation = true;
      throw error;
    }
    const reply = '[Template Conflora de boas-vindas]';
    await this.firestoreRepo.appendMessage(phone, 'assistant', reply, { requirePersistence: true });
    return { reply, intent: 'MAIN_MENU_SENT', latencyMs: Math.round(performance.now() - startTime) };
  }
}
module.exports = { MessageService };
