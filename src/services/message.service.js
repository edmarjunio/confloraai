const { INTENTS } = require('../router/message.router');
const Logger = require('../shared/logger');
const { formatCurrency } = require('../shared/string.util');
const { recognizeGreeting } = require('../shared/greeting');

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
    interactiveId = '',
    customerName = '',
    messageId = '',
    verifyOnly = false,
  }) {
    const { evaluateDailyReset } = require('./conversation-automation');
    await evaluateDailyReset(this.firestoreRepo, phone).catch(err => {
      Logger.warn('Erro ao avaliar reset diário', { error: err.message, phone });
    });
    const startTime = performance.now();
    const whatsapp = require('./durable-conversation-transport').durableConversationTransport(this.firestoreRepo, this.whatsappClient, { phone, messageId });
    // 1. Marcar como lida e salvar mensagem
    if (messageId && whatsapp) {
      whatsapp.markAsRead?.(messageId)?.catch(() => {});
    }
    await this.firestoreRepo.appendMessage(phone, 'user', message, { requirePersistence: true, messageId });

    const { conversationAutomation, setConversationChannel } = require('./conversation-automation');
    let conversation = await conversationAutomation(this.firestoreRepo, phone);
    const trimmed = String(message || '').trim().toLowerCase();

    if (conversation.automation === 'paused' && conversation.reason === 'human_requested') {
      const { resumeAgentRequestedConversation } = require('./conversation-automation');
      conversation = await resumeAgentRequestedConversation(this.firestoreRepo, phone);
      conversation = await setConversationChannel(this.firestoreRepo, phone, 'agent');
    }
    if (conversation.automation === 'paused') return { reply: '', intent: 'HUMAN_HANDOFF_ACTIVE', imagesSent: 0, latencyMs: 0 };
    if (verifyOnly) return { reply: '', intent: 'AUTOMATION_DISABLED', imagesSent: 0, latencyMs: 0 };
    const whatsappConfig = require('../config/env').whatsapp;
    if (!whatsappConfig.assistantEnabled) return { reply: '', intent: 'AUTOMATION_DISABLED', imagesSent: 0, latencyMs: 0 };
    if (whatsappConfig.agentOwner !== 'cloud_api') return { reply: '', intent: 'AUTOMATION_DISABLED', imagesSent: 0, latencyMs: 0 };

    if (/^(?:menu|quero ver as op[cç][oõ]es)[!,.?\s]*$/i.test(String(message || '').trim())) return this.sendMainMenu(phone, whatsapp, startTime);

    if (!interactiveId && isAmbiguousMessage(message)) {
      await conversationAutomation(this.firestoreRepo, phone, { pauseReason: 'ambiguous_customer_needs_human', messageId });
      Logger.info(`Indecisive/ambiguous message from ${phone}. Pausing automation for human team. [NEEDS_HUMAN_ATTENTION]`);
      return { reply: '', intent: 'AMBIGUOUS_NEEDS_HUMAN', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
    }

    const initialChoice = ['catalogo_virtual', 'montar_sacola', 'btn_sacola', 'btn_atendente'].includes(interactiveId);
    if (!conversation.channel || (conversation.channel === 'menu' && !initialChoice)) {
      return this.sendMainMenu(phone, whatsapp, startTime);
    }

    const isAgentSelection = interactiveId === 'btn_atendente';
    const isCartSelection = ['montar_sacola', 'btn_sacola'].includes(interactiveId) ||
      /^(cat_|sub_|add_|order_|pay_)/.test(interactiveId);
    if (isAgentSelection) conversation = await setConversationChannel(this.firestoreRepo, phone, 'agent');
    if (isCartSelection) conversation = await setConversationChannel(this.firestoreRepo, phone, 'cart');

    if (interactiveId === 'catalogo_virtual' || /^(1|cat[aá]logo|cat[aá]logo virtual)$/i.test(trimmed)) {
      await setConversationChannel(this.firestoreRepo, phone, 'menu');
      const catalogUrl = process.env.WHATSAPP_CATALOG_URL || whatsappConfig.catalogUrl || 'https://conflora.com.br';
      const reply = `🌿 *Catálogo Virtual Conflora*\n\nAcesse nosso site para visualizar todos os nossos produtos:\n${catalogUrl}`;
      if (whatsapp) await whatsapp.sendTextMessage(phone, reply);
      await this.firestoreRepo.appendMessage(phone, 'assistant', reply);
      return { reply, intent: 'VIRTUAL_CATALOG_LINK', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
    }

    if (isAgentSelection) {
      const reply = 'Certo! Pode me dizer quais produtos você procura ou como posso te ajudar?';
      if (whatsapp) await whatsapp.sendTextMessage(phone, reply);
      await this.firestoreRepo.appendMessage(phone, 'assistant', reply);
      return { reply, intent: 'AGENT_ASSISTANCE', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
    }

    const isReceiptPayload = String(message || '') === '[COMPROVANTE_ENVIADO]';
    const isActiveAgent = conversation.channel === 'agent';
    const isActiveCart = conversation.channel === 'cart';
    const greeting = recognizeGreeting(message);
    if (!interactiveId && greeting && (isActiveAgent || isActiveCart)) {
      const reply = `${greeting} ${isActiveCart ? 'Como posso ajudar com sua sacola?' : 'Qual produto você procura?'}`;
      if (whatsapp) await whatsapp.sendTextMessage(phone, reply);
      await this.firestoreRepo.appendMessage(phone, 'assistant', reply);
      return { reply, intent: 'GREETING_SENT', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
    }
    const wantsMenu = greeting || /^(?:menu|quero ver as op[cç][oõ]es)[!,.?\s]*$/i.test(String(message || '').trim());
    if (!interactiveId && !isReceiptPayload && !isActiveAgent && !isActiveCart && wantsMenu) {
      return this.sendMainMenu(phone, whatsapp, startTime);
    }

    const cartCheckout = isActiveCart && ['order_entrega', 'order_retirada'].includes(interactiveId);
    const salesInput = isActiveAgent || isActiveCart && (cartCheckout || interactiveId.startsWith('sales_') || !interactiveId);
    if (salesInput && typeof this.agentService?.extractSalesIntent === 'function') {
      this.salesConversation ||= new (require('./sales-conversation.service').SalesConversationService)({
        repository: this.firestoreRepo, agent: this.agentService, orders: this.orderService,
        intake: this.orderIntake,
      });
      const result = cartCheckout ? await this.salesConversation.startCart(phone, interactiveId === 'order_entrega' ? 'DELIVERY' : 'PICKUP')
        : await this.salesConversation.handle({ phone, message, interactiveId, customerName });
      await this.firestoreRepo.appendMessage(phone, 'assistant', result.reply, { requirePersistence: true, messageId });
      if (whatsapp && result.buttons?.length) await whatsapp.sendInteractiveButtons(phone, { bodyText: result.reply, buttons: result.buttons });
      else if (whatsapp && result.reply) await whatsapp.sendTextMessage(phone, result.reply);
      return { ...result, imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
    }

    if (!interactiveId && this.firestoreRepo.getAllProducts && this.firestoreRepo.getInventorySettings) {
      this.orderIntake ||= new (require('./order-intake.service').OrderIntakeService)(this.firestoreRepo, {
        catalog: this.catalogRepo,
        notify: id => this.orderService?.commerce?.pdv?.deliver(id),
      });
      const intake = await this.orderIntake.handle({ phone, message, messageId, customerName });
      if (intake) {
        await this.firestoreRepo.appendMessage(phone, 'assistant', intake.reply, { requirePersistence: true, messageId });
        if (whatsapp) await whatsapp.sendTextMessage(phone, intake.reply);
        return { ...intake, imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
      }
    }

    // 2. Opção 2 — 100% Nativo no WhatsApp: Falar com atendente / Negativa
    const isNegativeResponse = /^(n[aã]o|nao era|não era|nenhum|nenhuma|errado|outro|outra|nada disso|queria outr[oa])\b/i.test(trimmed);

    if (isNegativeResponse && !isActiveAgent) {
      await conversationAutomation(this.firestoreRepo, phone, { pauseReason: 'customer_declined_bot', messageId });
      const reply = 'Vou encaminhar seu atendimento à equipe.';
      await this.firestoreRepo.appendMessage(phone, 'assistant', reply);
      if (whatsapp) {
        await whatsapp.sendTextMessage(phone, reply);

        const ownerPhone = process.env.OWNER_WHATSAPP_NUMBER || process.env.STORE_NOTIFICATION_PHONE;
        if (ownerPhone) {
          const formattedCustomerPhone = whatsapp.formatRecipient(phone);
          const reasonText = isNegativeResponse
            ? 'Cliente informou que NÃO era o produto/informação desejada'
            : 'Cliente solicitou falar com atendente';
          const alertMessage = [
            '🚨 *CONFLORA — ATENDIMENTO SOLICITADO*',
            `👤 *Cliente:* ${customerName || 'Cliente'}`,
            `📱 *WhatsApp:* ${phone}`,
            `💬 *Motivo:* ${reasonText}`,
            `📝 *Mensagem:* "${message}"`,
            '',
            `👉 *Clique para responder agora:* https://wa.me/${formattedCustomerPhone}`
          ].join('\n');
          await whatsapp.sendTextMessage(ownerPhone, alertMessage).catch(err => {
            Logger.warn('Aviso: falha ao notificar telefone do dono', { error: err.message });
          });
        }
      }


      return {
        reply,
        intent: 'HUMAN_HANDOFF',
        imagesSent: 0,
        latencyMs: Math.round(performance.now() - startTime)
      };
    }

    // 3. Opção 2 — 100% Nativo no WhatsApp: Comprar agora / Montar Sacola
    const isMontarSacola = interactiveId === 'montar_sacola' ||
      interactiveId === 'btn_sacola' ||
      /\b(montar sacola|fazer pedido|comprar agora|comprar|fazer compras|abrir sacola)\b/i.test(trimmed);

    if (isMontarSacola) {
      await this.catalogRepo.refreshCatalog();
      const catalogId = process.env.META_CATALOG_ID || process.env.WHATSAPP_CATALOG_ID || '';
      if (whatsapp && catalogId) {
        try {
          const bodyText = '🛍️ *Comprar agora na Conflora*\n\nAcesse nosso catálogo comercial no WhatsApp para escolher seus produtos e montar sua sacola:';
          await whatsapp.sendCatalogMessage(phone, { bodyText, catalogId });
          await this.firestoreRepo.appendMessage(phone, 'assistant', bodyText);
          return { reply: bodyText, intent: 'NATIVE_META_CATALOG_SENT', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
        } catch (catErr) {
          Logger.warn('Catálogo nativo Meta não enviado, utilizando lista interativa:', { error: catErr.message });
        }
      }

      const categories = this.catalogRepo.getCategories();
      if (!categories.length) {
        const reply = 'O catálogo está vazio no momento. Me diga qual produto você procura.';
        if (whatsapp) await whatsapp.sendTextMessage(phone, reply);
        await this.firestoreRepo.appendMessage(phone, 'assistant', reply, { requirePersistence: true, messageId });
        return { reply, intent: 'NATIVE_PRODUCTS_EMPTY', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
      }
      const sections = [
        {
          title: 'Categorias Conflora',
          rows: categories.slice(0, 10).map((cat) => ({
            id: 'cat_' + cat,
            title: String(cat).slice(0, 24),
            description: `Ver produtos de ${cat}`.slice(0, 72),
          })),
        },
      ];

      const bodyText = '🛍️ *Comprar agora*\n\nEscolha uma das categorias abaixo para ver os produtos disponíveis na Conflora:';
      if (whatsapp) {
        await whatsapp.sendInteractiveList(phone, {
          headerText: '🌿 Conflora Horta e Viveiro',
          bodyText,
          footerText: 'Toque para abrir a lista',
          buttonText: 'Ver Categorias',
          sections,
        });
      }
      await this.firestoreRepo.appendMessage(phone, 'assistant', bodyText);
      return {
        reply: bodyText,
        intent: 'NATIVE_CATALOG_CATEGORIES',
        imagesSent: 0,
        latencyMs: Math.round(performance.now() - startTime),
      };
    }

    // 4. Opção 2 — 100% Nativo no WhatsApp: Seleção de Categoria -> Subcategorias
    const isCategorySelection = interactiveId.startsWith('cat_');
    if (isCategorySelection) {
      await this.catalogRepo.refreshCatalog();
      const categoryName = interactiveId.replace('cat_', '');
      const subcategories = this.catalogRepo.getSubcategories(categoryName);

      if (subcategories.length > 0) {
        const sections = [
          {
            title: `Subcategorias de ${categoryName}`.slice(0, 24),
            rows: subcategories.slice(0, 10).map((sub) => ({
              id: 'sub_' + sub,
              title: String(sub).slice(0, 24),
              description: 'Ver opções desta seção'.slice(0, 72),
            })),
          },
        ];

        const bodyText = `📁 *${categoryName}*\n\nSelecione o tipo que você procura:`;
        if (whatsapp) {
          await whatsapp.sendInteractiveList(phone, {
            headerText: `🌿 ${categoryName}`.slice(0, 60),
            bodyText,
            footerText: 'Toque para abrir as opções',
            buttonText: 'Ver Subcategorias',
            sections,
          });
        }
        await this.firestoreRepo.appendMessage(phone, 'assistant', bodyText);
        return {
          reply: bodyText,
          intent: 'NATIVE_CATALOG_SUBCATEGORIES',
          imagesSent: 0,
          latencyMs: Math.round(performance.now() - startTime),
        };
      } else {
        const products = this.catalogRepo.getProductsBySubcategory(categoryName);
        return this.sendNativeProductsList(phone, categoryName, products, startTime, whatsapp);
      }
    }

    // 5. Opção 2 — 100% Nativo no WhatsApp: Seleção de Subcategoria -> Produtos
    const isSubcategorySelection = interactiveId.startsWith('sub_');
    if (isSubcategorySelection) {
      await this.catalogRepo.refreshCatalog();
      const subcategoryName = interactiveId.replace('sub_', '');
      const products = this.catalogRepo.getProductsBySubcategory(subcategoryName);
      return this.sendNativeProductsList(phone, subcategoryName, products, startTime, whatsapp);
    }

    // 6. Opção 2 — 100% Nativo no WhatsApp: Adicionar Produto à Sacola
    const isAddProduct = interactiveId.startsWith('add_');
    if (isAddProduct) {
      await this.catalogRepo.refreshCatalog();
      const productId = interactiveId.replace('add_', '');
      const product = this.catalogRepo.items.find((i) => String(i.id) === productId) ||
        null;

      if (product) {
        const pendingOrder = await this.orderService.addProductToDraft(phone, product.id, messageId);
        const existingItems = pendingOrder.items;
        const total = existingItems.reduce((acc, it) => acc + (it.price || 0) * (it.quantity || 1), 0);
        const itemsList = existingItems.map((it) => `• ${it.quantity}x ${it.name} — ${formatCurrency(it.price * it.quantity)}`).join('\n');
        const bodyText = [
          `✅ *${product.name}* adicionado à sua sacola!`,
          '',
          '🛍️ *Sua Sacola:*',
          itemsList,
          '',
          `*Total:* ${formatCurrency(total)}`,
          '',
          'Escolha como deseja receber ou continue adicionando produtos:'
        ].join('\n');

        const buttons = [
          { id: 'montar_sacola', title: '➕ Mais Produtos' },
          { id: 'order_entrega', title: '🛵 Entrega' },
          { id: 'order_retirada', title: '🏪 Retirada' },
        ];

        if (whatsapp) {
          await whatsapp.sendInteractiveButtons(phone, {
            bodyText,
            buttons,
          });
        }
        await this.firestoreRepo.appendMessage(phone, 'assistant', bodyText);
        return {
          reply: bodyText,
          intent: 'NATIVE_CART_UPDATED',
          imagesSent: 0,
          latencyMs: Math.round(performance.now() - startTime),
        };
      }
    }

    // 7. Opção 2 — 100% Nativo no WhatsApp: Escolha de Entrega ou Retirada
    if (interactiveId === 'order_entrega' || interactiveId === 'order_retirada' ||
        /^(entrega|retirada|quero entrega|quero retirar)$/i.test(trimmed)) {
      const isDelivery = interactiveId === 'order_entrega' || /entrega/i.test(trimmed);
      const deliveryMethod = isDelivery ? 'Entrega a Domicílio' : 'Retirada na Loja';

      await this.orderService.updateOrderDetails(phone, { orderType: isDelivery ? 'DELIVERY' : 'PICKUP' });

      const bodyText = [
        `Você escolheu: *${deliveryMethod}*! 📦`,
        '',
        'Como prefere efetuar o pagamento do seu pedido?'
      ].join('\n');

      const buttons = [
        { id: 'pay_pix', title: '💠 PIX' },
        { id: 'pay_cartao', title: '💳 Cartão' },
      ];

      if (whatsapp) {
        await whatsapp.sendInteractiveButtons(phone, {
          bodyText,
          buttons,
        });
      }
      await this.firestoreRepo.appendMessage(phone, 'assistant', bodyText);
      return {
        reply: bodyText,
        intent: 'NATIVE_ORDER_DELIVERY_SET',
        imagesSent: 0,
        latencyMs: Math.round(performance.now() - startTime),
      };
    }

    // 8. Opção 2 — 100% Nativo no WhatsApp: Escolha de Pagamento (PIX / Cartão)
    if (interactiveId === 'pay_pix' || interactiveId === 'pay_cartao' ||
        /^(pix|cartao|cartão)$/i.test(trimmed)) {
      const isPix = interactiveId === 'pay_pix' || /pix/i.test(trimmed);
      const paymentMethod = isPix ? 'PIX' : 'Cartão';

      await this.orderService.updateOrderDetails(phone, { paymentMethod });
      const confirmation = await this.orderService.confirmOrder(phone, customerName);
      const reply = confirmation?.reply || 'Sua sacola está vazia. Escolha um produto antes de finalizar.';

      if (whatsapp) {
        await whatsapp.sendTextMessage(phone, reply);
      }
      await this.firestoreRepo.appendMessage(phone, 'assistant', reply);
      return {
        reply,
        intent: 'NATIVE_ORDER_COMPLETED',
        imagesSent: 0,
        latencyMs: Math.round(performance.now() - startTime),
      };
    }

    // 1. Prevenção de duplicidade (Idempotência da Meta)
    // The public entry point owns the durable claim and marks completion only on success.

    // 3. Garantir catálogo atualizado em memória
    if (!verifyOnly) {
      await this.catalogRepo.refreshCatalog();
    }


    // 5. Contexto do cliente (Perfil salvo e Pedido Pendente)
    const customerProfile = await this.firestoreRepo.getCustomerProfile(phone);
    const pendingOrder = await this.firestoreRepo.getOrder(phone);

    // Comprovantes enviados por conversa não confirmam pagamentos.
    const pendingPixSale = await this.firestoreRepo.findPendingPixOrderByPhone(phone);
    if (pendingPixSale?.pixMode === 'MANUAL' && /comprovante|pago|pix|transfer[eê]ncia|\[COMPROVANTE_ENVIADO\]/i.test(message)) {
      const reply = 'Envie o comprovante na página do pedido. O caixa confere o Pix antes de confirmar.';
      if (whatsapp) await whatsapp.sendTextMessage(phone, reply);
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
      const order = await this.orderService.createPendingOrder(phone, routingResult.orderItems, customerProfile, messageId);
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
        if (prod.images && prod.images.length > 0 && whatsapp) {
          const priceText = prod.prices.map((p) => formatCurrency(p)).join(' e ');
          const caption = (
            `🌿 *${prod.canonicalName}*\n` +
            `💰 *Opções de valores:* ${priceText}`
          );

          for (const imgUrl of prod.images.slice(0, 2)) {
            await whatsapp.sendImageMessage(phone, imgUrl, caption).catch((err) => {
              Logger.warn('Falha ao enviar imagem do WhatsApp', { error: err.message });
            });
            imagesSentCount++;
          }
        }
      }

      if (imagesSentCount > 0) {
        reply = 'Enviei as fotos. Qual você prefere?';
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

    // Revalidar status da conversa antes de enviar resposta para garantir prioridade do atendimento humano
    const recheckedConv = await conversationAutomation(this.firestoreRepo, phone);
    if (recheckedConv.automation === 'paused') {
      Logger.info(`Staff takeover/handoff active for ${phone}. Suppressing automated bot reply.`);
      return { reply: '', intent: 'HUMAN_HANDOFF_ACTIVE', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
    }

    // 7. Salvar resposta no histórico
    await this.firestoreRepo.appendMessage(phone, 'assistant', reply);

    // 8. Envio via WhatsApp Cloud API
    if (phone && whatsapp && reply) {
      await whatsapp.sendTextMessage(phone, reply);
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

  async sendMainMenu(phone, whatsapp, startTime) {
    await require('./conversation-automation').setConversationChannel(this.firestoreRepo, phone, 'menu');
    const reply = '🌿 *Conflora Horta e Viveiro*\n\nOlá! Como podemos ajudar?';
    if (whatsapp) {
      await whatsapp.sendInteractiveButtons(phone, {
        headerText: '🌿 Conflora Horta e Viveiro',
        bodyText: 'Olá! Como podemos ajudar?',
        buttons: [
          { id: 'catalogo_virtual', title: 'Catálogo virtual' },
          { id: 'montar_sacola', title: 'Comprar agora' },
          { id: 'btn_atendente', title: 'Falar com atendente' },
        ],
      });
    }
    await this.firestoreRepo.appendMessage(phone, 'assistant', reply, { requirePersistence: true });
    return { reply, intent: 'MAIN_MENU_SENT', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
  }

  async sendNativeProductsList(phone, title, products, startTime, whatsapp = this.whatsappClient) {
    if (!products || products.length === 0) {
      const reply = 'Podemos encomendar! Qual produto você procura?';
      if (whatsapp) await whatsapp.sendTextMessage(phone, reply);
      return { reply, intent: 'NATIVE_PRODUCTS_EMPTY', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
    }

    const sections = [
      {
        title: `Produtos: ${title}`.slice(0, 24),
        rows: products.slice(0, 10).map((p) => ({
          id: 'add_' + p.id,
          title: String(p.name).slice(0, 24),
          description: `${formatCurrency(p.price || 0)} · Toque p/ adicionar`.slice(0, 72),
        })),
      },
    ];

    const bodyText = `🌿 *${title}*\n\nToque no botão abaixo e escolha o item para adicionar à sua sacola:`;
    if (whatsapp) {
      await whatsapp.sendInteractiveList(phone, {
        headerText: `Conflora · ${title}`.slice(0, 60),
        bodyText,
        footerText: 'Toque para escolher o produto',
        buttonText: 'Ver Produtos',
        sections,
      });
    }
    await this.firestoreRepo.appendMessage(phone, 'assistant', bodyText);
    return {
      reply: bodyText,
      intent: 'NATIVE_PRODUCTS_LIST',
      imagesSent: 0,
      latencyMs: Math.round(performance.now() - startTime),
    };
  }
}

module.exports = {
  MessageService,
};

