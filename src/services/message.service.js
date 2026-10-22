const { INTENTS } = require('../router/message.router');
const Logger = require('../shared/logger');
const { formatCurrency } = require('../shared/string.util');

class MessageService {
  /**
   * @param {Object} dependencies
   * @param {import('../router/message.router').MessageRouter} dependencies.router
   * @param {import('./direct-price.service').DirectPriceService} dependencies.directPriceService
   * @param {import('../ai/agent.service').AgentService} dependencies.agentService
   * @param {import('../catalog/catalog.repository').CatalogRepository} dependencies.catalogRepo
   * @param {import('../database/firestore.repository').FirestoreRepository} dependencies.firestoreRepo
   * @param {import('../orders/order.service').OrderService} dependencies.orderService
   * @param {import('../integrations/whatsapp.client').WhatsAppClient} dependencies.whatsappClient
   * @param {import('./learning.service').LearningService} [dependencies.learningService]
   */
  constructor({
    router,
    directPriceService,
    agentService,
    catalogRepo,
    firestoreRepo,
    orderService,
    whatsappClient,
    learningService = null,
  }) {
    this.router = router;
    this.directPriceService = directPriceService;
    this.agentService = agentService;
    this.catalogRepo = catalogRepo;
    this.firestoreRepo = firestoreRepo;
    this.orderService = orderService;
    this.whatsappClient = whatsappClient;
    this.learningService = learningService;
  }

  /**
   * Pipeline principal de atendimento com IA e envio de fotos do Firebase Storage.
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
      const result = await this.processCustomerMessage(payload);
      await this.incoming.finish(claim);
      return result;
    } catch (error) {
      await this.incoming.finish(claim, error);
      throw error;
    }
  }

  async processCustomerMessage({
    phone,
    message,
    customerName = '',
    messageId = '',
    verifyOnly = false,
  }) {
    const startTime = performance.now();
    // 1. Marcar como lida e salvar mensagem
    if (messageId && this.whatsappClient) {
      this.whatsappClient.markAsRead(messageId).catch(() => {});
    }
    await this.firestoreRepo.appendMessage(phone, 'user', message, { requirePersistence: true, messageId });

    // 2. Se for saudação isolada (ex: "Bom dia", "Oi", "Boa tarde"), dispara o modelo de boas-vindas com os botões diretos
    const { normalizeText } = require('../shared/string.util');
    const trimmed = String(message || '').trim().toLowerCase();
    const isGreetingOnly = /^(oi|ola|opa|bom dia|boa tarde|boa noite|e ai|eai|tudo bem|tudo bom|como vai|salve|fala|oie|oii|oiii)(\s+(tudo bem|tudo bom|amigo|amiga|equipe|conflora|pessoal))?[!?.]*$/i.test(normalizeText(trimmed));
    if (isGreetingOnly) {
      Logger.info('Saudação isolada recebida. Disparando modelo de boas-vindas com botões da loja...', { phone, message });
      if (this.whatsappClient) {
        await this.whatsappClient.sendWelcomeTemplate(phone, customerName).catch((err) => {
          Logger.warn('Aviso: template de boas-vindas ainda não aprovado na Meta ou token pendente', { error: err.message });
        });
      }
      return {
        reply: 'Modelo de boas-vindas enviado',
        intent: 'WELCOME_TEMPLATE_SENT',
        imagesSent: 0,
        latencyMs: Math.round(performance.now() - startTime)
      };
    }

    // 3. Detecção de solicitação de atendimento humano ou resposta negativa ("NÃO era isso")
    const isHumanRequest = /\b(atendente|humano|pessoa|vendedor|falar com (um |uma )?(atendente|humano|pessoa|vendedor)|alguem ai|alguém aí)\b/i.test(trimmed);
    const isNegativeResponse = /^(n[aã]o|nao era|não era|nenhum|nenhuma|errado|outro|outra|nada disso|queria outr[oa])\b/i.test(trimmed);

    if (isHumanRequest || isNegativeResponse) {
      const reply = 'Entendido perfeitamente! Já avisei a nossa equipe da loja e um de nossos atendentes vai te responder por aqui em instantes. Um momento, por favor!';
      await this.firestoreRepo.appendMessage(phone, 'assistant', reply);
      if (this.whatsappClient) {
        await this.whatsappClient.sendTextMessage(phone, reply);

        const ownerPhone = process.env.OWNER_WHATSAPP_NUMBER || process.env.STORE_NOTIFICATION_PHONE;
        if (ownerPhone) {
          const formattedCustomerPhone = this.whatsappClient.formatRecipient(phone);
          const reasonText = isNegativeResponse
            ? 'Cliente informou que NÃO era o produto/informação desejada'
            : 'Cliente solicitou falar com atendente humano';
          const alertMessage = [
            '🚨 *CONFLORA — ATENDIMENTO HUMANO SOLICITADO*',
            `👤 *Cliente:* ${customerName || 'Cliente'}`,
            `📱 *WhatsApp:* ${phone}`,
            `💬 *Motivo:* ${reasonText}`,
            `📝 *Mensagem:* "${message}"`,
            '',
            `👉 *Clique para responder agora:* https://wa.me/${formattedCustomerPhone}`
          ].join('\n');
          await this.whatsappClient.sendTextMessage(ownerPhone, alertMessage).catch(err => {
            Logger.warn('Aviso: falha ao notificar telefone do dono', { error: err.message });
          });
        }
      }

      try {
        const { customerKeyFor } = require('../agent/agent-store');
        const customerKey = customerKeyFor('conflora', phone);
        await this.firestoreRepo.firestore.collection('agent_conversations').doc('conflora__' + customerKey).set({
          tenantId: 'conflora',
          customerKey,
          automation: 'paused',
          updatedAt: new Date().toISOString(),
          reason: isNegativeResponse ? 'customer_declined_bot' : 'human_requested'
        }, { merge: true });
      } catch (err) {
        Logger.warn('Aviso ao registrar pausa de automação', { error: err.message });
      }

      return {
        reply,
        intent: 'HUMAN_HANDOFF',
        imagesSent: 0,
        latencyMs: Math.round(performance.now() - startTime)
      };
    }

    // 3. Verificação de conversa já em atendimento humano
    try {
      const { customerKeyFor } = require('../agent/agent-store');
      const customerKey = customerKeyFor('conflora', phone);
      const convSnap = await this.firestoreRepo.firestore.collection('agent_conversations').doc('conflora__' + customerKey).get();
      if (convSnap.exists && convSnap.data()?.automation === 'paused' && process.env.NODE_ENV === 'production') {
        Logger.info('Conversa em atendimento humano. Automação silenciada.', { phone });
        return { reply: '', intent: 'HUMAN_HANDOFF_ACTIVE', imagesSent: 0, latencyMs: 0 };
      }
    } catch {}

    if (verifyOnly || !require('../config/env').whatsapp.assistantEnabled) {
      return { reply: '', intent: 'AUTOMATION_DISABLED', imagesSent: 0, latencyMs: 0 };
    }

    // 1. Prevenção de duplicidade (Idempotência da Meta)
    // The public entry point owns the durable claim and marks completion only on success.

    // 2. Marcar mensagem como lida no WhatsApp (apenas para IDs válidos da Meta)
    if (messageId && this.whatsappClient) {
      this.whatsappClient.markAsRead(messageId).catch(() => {});
    }

    // 3. Garantir catálogo atualizado em memória
    if (!verifyOnly) {
      await this.catalogRepo.refreshCatalog().catch((err) => {
        Logger.warn('Aviso: usando cache existente do catálogo', { error: err.message });
      });
    }

    // 4. Salvar mensagem do cliente no histórico da conversa
    await this.firestoreRepo.appendMessage(phone, 'user', message);

    // 5. Contexto do cliente (Perfil salvo e Pedido Pendente)
    const customerProfile = await this.firestoreRepo.getCustomerProfile(phone);
    const pendingOrder = await this.firestoreRepo.getOrder(phone);

    // Comprovantes enviados por conversa não confirmam pagamentos.
    const pendingPixSale = await this.firestoreRepo.findPendingPixOrderByPhone(phone);
    if (pendingPixSale?.pixMode === 'MANUAL' && /comprovante|pago|pix|transfer[eê]ncia|\[COMPROVANTE_ENVIADO\]/i.test(message)) {
      const reply = 'Para confirmar seu Pix, envie o comprovante na página do seu pedido no site. O caixa ou administrador confere o recebimento na conta bancária antes de aprovar. Esta mensagem não confirma o pagamento.';
      if (this.whatsappClient) await this.whatsappClient.sendTextMessage(phone, reply);
      return { reply, intent: 'MANUAL_PIX_AWAITING_REVIEW', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
    }
    if (verifyOnly) {
      return {
        reply: '',
        intent: 'ASSISTANT_DISABLED',
        imagesSent: 0,
        latencyMs: Math.round((performance.now() - startTime) * 100) / 100,
      };
    }

    // 6. Roteamento inteligente de intenção
    const routingResult = this.router.route(message, { pendingOrder, customerProfile });
    const history = await this.firestoreRepo.getSessionHistory(phone, 8);

    let reply = '';
    let imagesSentCount = 0;

    // CENÁRIO 1: Solicitação de Confirmação de Tamanho / Preço Múltiplo
    if (routingResult.intent === INTENTS.ASK_SIZE_CONFIRMATION && routingResult.ambiguousProduct) {
      const qty = routingResult.orderItems?.[0]?.quantity || 1;
      reply = this.orderService.formatSizeConfirmationPrompt(routingResult.ambiguousProduct, qty);
    }

    // CENÁRIO 2: Criação de Pedido Pendente com Recibo Estruturado
    if (!reply && routingResult.intent === INTENTS.PLACE_ORDER && routingResult.orderItems) {
      const order = await this.orderService.createPendingOrder(phone, routingResult.orderItems, customerProfile);
      const isVip = Boolean(customerProfile?.deliveryAddress && customerProfile?.paymentMethod);
      reply = this.orderService.formatCustomerReceipt(order, { isVipProposal: isVip });
    }

    // CENÁRIO 3: Alteração de Dados do Pedido Pendente (ex: "Hoje vai ser no débito")
    if (!reply && routingResult.intent === INTENTS.UPDATE_ORDER_DETAILS && routingResult.updatedFields) {
      const updatedOrder = await this.orderService.updateOrderDetails(phone, routingResult.updatedFields);
      if (updatedOrder) {
        reply = this.orderService.formatCustomerReceipt(updatedOrder, { isUpdated: true });
      }
    }

    // CENÁRIO 4: Confirmação e Fechamento de Pedido
    if (!reply && routingResult.intent === INTENTS.ORDER_CONFIRMATION) {
      const confirmationResult = await this.orderService.confirmOrder(phone, customerName);
      if (confirmationResult) {
        reply = confirmationResult.reply;

        // Dispara o aprendizado contínuo seguro com base na venda concluída
        if (this.learningService && confirmationResult.order.items) {
          this.learningService.learnFromCompletedSale({
            purchasedItems: confirmationResult.order.items,
            conversationHistory: history,
          }).catch(() => {});
        }
      }
    }

    // CENÁRIO 5: Pedido de fotos cadastradas no Firebase Storage
    if (!reply && routingResult.intent === INTENTS.REQUEST_PHOTOS) {
      const targetProducts = [];

      if (routingResult.matchedProduct) {
        targetProducts.push(routingResult.matchedProduct);
      } else if (routingResult.suggestedProducts.length > 0) {
        targetProducts.push(...routingResult.suggestedProducts.slice(0, 3));
      } else {
        // Se o cliente só disse "manda fotos", olha o histórico recente
        for (let i = history.length - 1; i >= 0; i--) {
          const match = this.catalogRepo.findProductByName(history[i].text);
          if (match) {
            targetProducts.push(match);
            break;
          }
        }
      }

      // Envia as imagens com a legenda identificando produto e valores
      for (const prod of targetProducts) {
        if (prod.images && prod.images.length > 0 && this.whatsappClient) {
          const priceText = prod.prices.map((p) => formatCurrency(p)).join(' e ');
          const caption = (
            `🌿 *${prod.canonicalName}*\n` +
            `💰 *Opções de valores:* ${priceText}`
          );

          for (const imgUrl of prod.images.slice(0, 2)) {
            await this.whatsappClient.sendImageMessage(phone, imgUrl, caption).catch((err) => {
              Logger.warn('Falha ao enviar imagem do WhatsApp', { error: err.message });
            });
            imagesSentCount++;
          }
        }
      }

      if (imagesSentCount > 0) {
        reply = `Enviei as fotos acima para você conferir! O que achou? Se quiser mais detalhes ou reservar alguma unidade, estou à disposição!`;
      }
    }

    // CENÁRIO 6: Consulta Direta de Preço / Vendas Consultivas via Gemini AI
    if (!reply) {
      reply = await this.agentService.generateResponse({
        userMessage: message,
        history,
        mode: routingResult.intent,
        targetProduct: routingResult.matchedProduct || null,
        suggestedProducts: routingResult.suggestedProducts || [],
        customerName,
      });
    }

    // 7. Salvar resposta no histórico
    await this.firestoreRepo.appendMessage(phone, 'assistant', reply);

    // 8. Envio via WhatsApp Cloud API
    if (phone && this.whatsappClient && reply) {
      await this.whatsappClient.sendTextMessage(phone, reply);
    }

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    Logger.info(`Mensagem processada para ${phone} em ${latencyMs}ms [intent: ${routingResult.intent}, imagesSent: ${imagesSentCount}]`);

    return {
      reply,
      intent: routingResult.intent,
      imagesSent: imagesSentCount,
      latencyMs,
    };
  }
}

module.exports = {
  MessageService,
};

