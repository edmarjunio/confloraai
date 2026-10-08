const { t } = require('../i18n');
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
   * Pipeline principal de atendimento com IA e suporte a fotos do Google Drive.
   *
   * @param {Object} input
   * @param {string} input.phone
   * @param {string} input.message
   * @param {string} [input.customerName='']
   * @param {string} [input.messageId='']
   * @returns {Promise<{ reply: string, intent: string, imagesSent?: number, latencyMs: number }>}
   */
  async handleCustomerMessage({ phone, message, customerName = '', messageId = '' }) {
    const startTime = performance.now();

    // 1. Prevenção de duplicidade (Idempotência da Meta)
    if (messageId) {
      const isDuplicate = await this.firestoreRepo.isDuplicateMessage(messageId);
      if (isDuplicate) {
        Logger.info(`Mensagem duplicada ignorada: ${messageId}`);
        return { reply: '', intent: 'DUPLICATE', latencyMs: 0 };
      }
      await this.firestoreRepo.markMessageProcessed(messageId);
    }

    // 2. Marcar mensagem como lida no WhatsApp (apenas para IDs válidos da Meta)
    if (messageId && this.whatsappClient) {
      this.whatsappClient.markAsRead(messageId).catch(() => {});
    }

    // 3. Garantir catálogo atualizado em memória
    if (!this.catalogRepo.isCacheValid()) {
      await this.catalogRepo.refreshCatalog().catch((err) => {
        Logger.warn(t("interface.message.7e4c9092a8bc"), { error: err.message });
      });
    }

    // 4. Salvar mensagem do cliente no histórico da conversa
    await this.firestoreRepo.appendMessage(phone, 'user', message);

    // 5. Contexto do cliente (Perfil salvo e Pedido Pendente)
    const customerProfile = await this.firestoreRepo.getCustomerProfile(phone);
    const pendingOrder = await this.firestoreRepo.getOrder(phone);

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

    // CENÁRIO 5: Pedido de Fotos do Google Drive
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
            `${t("interface.message.5af3959ce0bb")}${priceText}`
          );

          for (const imgUrl of prod.images.slice(0, 2)) {
            await this.whatsappClient.sendImageMessage(phone, imgUrl, caption).catch((err) => {
              Logger.warn(t("interface.message.1294e59da7fd"), { error: err.message });
            });
            imagesSentCount++;
          }
        }
      }

      if (imagesSentCount > 0) {
        reply = `${t("interface.message.0e8c3f4901eb")}`;
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
    Logger.info(`${t("interface.message.889cabaadaa4")}${phone} em ${latencyMs}ms [intent: ${routingResult.intent}, imagesSent: ${imagesSentCount}]`);

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
