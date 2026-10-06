const { INTENTS } = require('../router/message.router');
const Logger = require('../shared/logger');
const { formatCurrency } = require('../shared/string.util');

class MessageService {
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

  async handleCustomerMessage({ phone, message, customerName = '', messageId = '' }) {
    const startTime = performance.now();

    if (messageId) {
      const isDuplicate = await this.firestoreRepo.isDuplicateMessage(messageId);
      if (isDuplicate) {
        Logger.info(`Mensagem duplicada ignorada: ${messageId}`);
        return { reply: '', intent: 'DUPLICATE', latencyMs: 0 };
      }
      await this.firestoreRepo.markMessageProcessed(messageId);
    }

    if (messageId && this.whatsappClient) {
      this.whatsappClient.markAsRead(messageId).catch(() => {});
    }

    if (!this.catalogRepo.isCacheValid()) {
      await this.catalogRepo.refreshCatalog().catch((err) => {
        Logger.warn('Aviso: usando cache existente do catálogo', { error: err.message });
      });
    }

    await this.firestoreRepo.appendMessage(phone, 'user', message);

    const routingResult = this.router.route(message);
    const history = await this.firestoreRepo.getSessionHistory(phone, 8);

    let reply = '';
    let imagesSentCount = 0;

    // Detectar domínio (PLANTAS, PETS, etc.)
    const domain = routingResult.matchedProduct?.domain
      || (routingResult.suggestedProducts?.[0]?.domain)
      || (message.toLowerCase().includes('porquinho') || message.toLowerCase().includes('hamster') ? 'PETS' : 'PLANTAS');

    // CENÁRIO A: Pedido de Fotos do Google Drive
    if (routingResult.intent === INTENTS.REQUEST_PHOTOS) {
      const targetProducts = [];

      if (routingResult.matchedProduct) {
        targetProducts.push(routingResult.matchedProduct);
      } else if (routingResult.suggestedProducts.length > 0) {
        targetProducts.push(...routingResult.suggestedProducts.slice(0, 3));
      } else {
        for (let i = history.length - 1; i >= 0; i--) {
          const match = this.catalogRepo.findProductByName(history[i].text);
          if (match) {
            targetProducts.push(match);
            break;
          }
        }
      }

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

    // CENÁRIO B: Confirmação de Pedido / Fechamento
    if (!reply && routingResult.intent === INTENTS.ORDER_CONFIRMATION) {
      const confirmationResult = await this.orderService.confirmOrder(phone);
      if (confirmationResult) {
        reply = confirmationResult.paymentInstructions;

        if (this.learningService && confirmationResult.order.items) {
          this.learningService.learnFromCompletedSale({
            purchasedItems: confirmationResult.order.items,
            conversationHistory: history,
          }).catch(() => {});
        }
      }
    }

    // CENÁRIO C: Geração Humanizada via Gemini AI
    if (!reply) {
      reply = await this.agentService.generateResponse({
        userMessage: message,
        history,
        mode: routingResult.intent,
        targetProduct: routingResult.matchedProduct || null,
        suggestedProducts: routingResult.suggestedProducts || [],
        domain,
        customerName,
      });
    }

    await this.firestoreRepo.appendMessage(phone, 'assistant', reply);

    if (phone && this.whatsappClient && reply) {
      await this.whatsappClient.sendTextMessage(phone, reply);
    }

    const latencyMs = Math.round((performance.now() - startTime) * 100) / 100;
    Logger.info(`Mensagem processada para ${phone} em ${latencyMs}ms [intent: ${routingResult.intent}, domain: ${domain}]`);

    return {
      reply,
      intent: routingResult.intent,
      domain,
      imagesSent: imagesSentCount,
      latencyMs,
    };
  }
}

module.exports = {
  MessageService,
};
