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
    interactiveId = '',
    customerName = '',
    messageId = '',
    verifyOnly = false,
  }) {
    const startTime = performance.now();
    const whatsapp = require('./durable-conversation-transport').durableConversationTransport(this.firestoreRepo, this.whatsappClient, { phone, messageId });
    // 1. Marcar como lida e salvar mensagem
    if (messageId && whatsapp) {
      whatsapp.markAsRead?.(messageId)?.catch(() => {});
    }
    await this.firestoreRepo.appendMessage(phone, 'user', message, { requirePersistence: true, messageId });

    const { conversationAutomation } = require('./conversation-automation');
    let conversation = await conversationAutomation(this.firestoreRepo, phone);
    const { normalizeText } = require('../shared/string.util');
    const trimmed = String(message || '').trim().toLowerCase();
    const normalizedMessage = normalizeText(trimmed);
    const isGreetingOnly = /^(oi|ola|opa|bom dia|boa tarde|boa noite|e ai|eai|tudo bem|tudo bom|como vai|salve|fala|oie|oii|oiii)(\s+(tudo bem|tudo bom|amigo|amiga|equipe|conflora|pessoal))?[!?.]*$/i.test(normalizedMessage);
    const isAgentRequest = interactiveId === 'btn_atendente' ||
      /\b(atendente|humano|pessoa|vendedor|falar com (um |uma )?(atendente|humano|pessoa|vendedor)|alguem ai|alguem a[ií])\b/i.test(normalizedMessage);

    if (conversation.automation === 'paused' && conversation.reason === 'human_requested') {
      const { resumeAgentRequestedConversation } = require('./conversation-automation');
      conversation = await resumeAgentRequestedConversation(this.firestoreRepo, phone);
    }
    if (conversation.automation === 'paused') return { reply: '', intent: 'HUMAN_HANDOFF_ACTIVE', imagesSent: 0, latencyMs: 0 };
    if (verifyOnly) return { reply: '', intent: 'AUTOMATION_DISABLED', imagesSent: 0, latencyMs: 0 };
    const whatsappConfig = require('../config/env').whatsapp;
    if (whatsappConfig.agentOwner !== 'cloud_api') return { reply: '', intent: 'AUTOMATION_DISABLED', imagesSent: 0, latencyMs: 0 };
    if (isAgentRequest) {
      const reply = 'Claro! Sou o atendente virtual da Conflora e posso ajudar com produtos, preços e pedidos. O que você procura?';
      if (whatsapp) await whatsapp.sendTextMessage(phone, reply);
      await this.firestoreRepo.appendMessage(phone, 'assistant', reply);
      return { reply, intent: 'AGENT_ASSISTANCE', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
    }
    const nativeCommerce = /^(add_|cat_|sub_|pay_|order_)/.test(interactiveId) || ['montar_sacola', 'btn_sacola'].includes(interactiveId) ||
      /^(montar sacola|fazer pedido|comprar|fazer compras|abrir sacola|entrega|retirada|quero entrega|quero retirar|pix|cartao|cartão)$/i.test(String(message || '').trim());
    const activeDraft = this.metaAgentService && !nativeCommerce ? await this.firestoreRepo.getOrder(phone) : null;
    const draftIntent = activeDraft?.status === 'AWAITING_CONFIRMATION' ? this.router?.route(message, { pendingOrder: activeDraft })?.intent : null;
    const draftAction = [INTENTS.ORDER_CONFIRMATION, INTENTS.UPDATE_ORDER_DETAILS, INTENTS.PLACE_ORDER, INTENTS.ASK_SIZE_CONFIRMATION].includes(draftIntent);
    if (this.metaAgentService && !nativeCommerce && !draftAction && !isGreetingOnly) {
      const envelope = await this.metaAgentService.execute('atender_mensagem', { customer_phone: phone, message_id: messageId || require('node:crypto').randomUUID(), message });
      if (!envelope.next_action.send_customer_message) return { reply: '', intent: 'HUMAN_HANDOFF', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
      const { runTransaction } = require('../database/transactions');
      const id = 'catalog-' + require('node:crypto').createHash('sha256').update(messageId || require('node:crypto').randomUUID()).digest('hex');
      await runTransaction(this.firestoreRepo, async tx => {
        if (await tx.get('pdv_outbox', id)) return;
        tx.set('pdv_outbox', id, { id, kind: 'conversation-catalog', recipient: phone,
          productIds: envelope.data.products.map(product => product.id), photoRequested: Boolean(envelope.data.photo_requested),
          criteriaQuery: message, status: 'PENDING', attempts: 0, createdAt: new Date().toISOString() });
      });
      return { reply: '', intent: 'VERIFIED_CATALOG_QUEUED', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
    }

    // 2. Opção 2 — 100% Nativo no WhatsApp: Falar com atendente
    const isNegativeResponse = /^(n[aã]o|nao era|não era|nenhum|nenhuma|errado|outro|outra|nada disso|queria outr[oa])\b/i.test(trimmed);

    if (isNegativeResponse) {
      await conversationAutomation(this.firestoreRepo, phone, { pauseReason: 'customer_declined_bot', messageId });
      const reply = 'Entendido perfeitamente! Já avisei a nossa equipe da loja e um de nossos atendentes vai te responder por aqui em instantes. Um momento, por favor!';
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

    // 3. Opção 2 — 100% Nativo no WhatsApp: Montar Sacola
    const isMontarSacola = interactiveId === 'montar_sacola' ||
      interactiveId === 'btn_sacola' ||
      /\b(montar sacola|fazer pedido|comprar|fazer compras|abrir sacola)\b/i.test(trimmed);

    if (isMontarSacola) {
      await this.catalogRepo.refreshCatalog().catch(() => {});
      const categories = this.catalogRepo.getCategories();
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

      const bodyText = '🛍️ *Montar sua Sacola*\n\nEscolha uma das categorias abaixo para ver os produtos disponíveis na Conflora:';
      if (whatsapp) {
        await whatsapp.sendInteractiveList(phone, {
          headerText: '🌿 Conflora Garden',
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
      await this.catalogRepo.refreshCatalog().catch(() => {});
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
      await this.catalogRepo.refreshCatalog().catch(() => {});
      const subcategoryName = interactiveId.replace('sub_', '');
      const products = this.catalogRepo.getProductsBySubcategory(subcategoryName);
      return this.sendNativeProductsList(phone, subcategoryName, products, startTime, whatsapp);
    }

    // 6. Opção 2 — 100% Nativo no WhatsApp: Adicionar Produto à Sacola
    const isAddProduct = interactiveId.startsWith('add_');
    if (isAddProduct) {
      await this.catalogRepo.refreshCatalog().catch(() => {});
      const productId = interactiveId.replace('add_', '');
      const product = this.catalogRepo.items.find((i) => String(i.id) === productId) ||
        this.catalogRepo.findProductByName(message);

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

    // 9. Saudação isolada envia o template aprovado com fallback para texto em falha definitiva.
    if (isGreetingOnly) {
      Logger.info('Saudação isolada recebida. Disparando modelo de boas-vindas com botões da loja...', { phone, message });
      let resolvedName = customerName?.trim?.() || '';
      if (!resolvedName && this.firestoreRepo?.getCustomerProfile) {
        const profile = await this.firestoreRepo.getCustomerProfile(phone).catch(() => null);
        resolvedName = profile?.name || profile?.customerName || '';
      }
      if (whatsapp) {
        try {
          await whatsapp.sendWelcomeTemplate(phone, resolvedName);
        } catch (error) {
          Logger.warn('Falha ao enviar o template de boas-vindas', { error: error.message });
          if (!error.definitelyNotSent) throw error;
          const fallbackReply = 'Olá! Sou o atendente virtual da Conflora. Posso ajudar com produtos, preços e pedidos. O que você procura?';
          await whatsapp.sendTextMessage(phone, fallbackReply);
          await this.firestoreRepo.appendMessage(phone, 'assistant', fallbackReply);
          return { reply: fallbackReply, intent: 'WELCOME_TEXT_FALLBACK', imagesSent: 0, latencyMs: Math.round(performance.now() - startTime) };
        }
      }
      return {
        reply: 'Modelo de boas-vindas enviado',
        intent: 'WELCOME_TEMPLATE_SENT',
        imagesSent: 0,
        latencyMs: Math.round(performance.now() - startTime)
      };
    }

    if (verifyOnly || !require('../config/env').whatsapp.assistantEnabled) {
      return { reply: '', intent: 'AUTOMATION_DISABLED', imagesSent: 0, latencyMs: 0 };
    }

    // 1. Prevenção de duplicidade (Idempotência da Meta)
    // The public entry point owns the durable claim and marks completion only on success.

    // 3. Garantir catálogo atualizado em memória
    if (!verifyOnly) {
      await this.catalogRepo.refreshCatalog().catch((err) => {
        Logger.warn('Aviso: usando cache existente do catálogo', { error: err.message });
      });
    }


    // 5. Contexto do cliente (Perfil salvo e Pedido Pendente)
    const customerProfile = await this.firestoreRepo.getCustomerProfile(phone);
    const pendingOrder = await this.firestoreRepo.getOrder(phone);

    // Comprovantes enviados por conversa não confirmam pagamentos.
    const pendingPixSale = await this.firestoreRepo.findPendingPixOrderByPhone(phone);
    if (pendingPixSale?.pixMode === 'MANUAL' && /comprovante|pago|pix|transfer[eê]ncia|\[COMPROVANTE_ENVIADO\]/i.test(message)) {
      const reply = 'Para confirmar seu Pix, envie o comprovante na página do seu pedido no site. O caixa ou administrador confere o recebimento na conta bancária antes de aprovar. Esta mensagem não confirma o pagamento.';
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

  async sendNativeProductsList(phone, title, products, startTime, whatsapp = this.whatsappClient) {
    if (!products || products.length === 0) {
      const reply = `Não encontrei produtos cadastrados no momento para *${title}*. Gostaria de escolher outra categoria?`;
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

