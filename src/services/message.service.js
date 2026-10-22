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
    // 1. Marcar como lida e salvar mensagem
    if (messageId && this.whatsappClient) {
      this.whatsappClient.markAsRead(messageId).catch(() => {});
    }
    await this.firestoreRepo.appendMessage(phone, 'user', message, { requirePersistence: true, messageId });

    const { normalizeText } = require('../shared/string.util');
    const trimmed = String(message || '').trim().toLowerCase();

    // 2. Opção 2 — 100% Nativo no WhatsApp: Falar com atendente
    const isHumanRequest = interactiveId === 'btn_atendente' ||
      /\b(atendente|humano|pessoa|vendedor|falar com (um |uma )?(atendente|humano|pessoa|vendedor)|alguem ai|alguém aí)\b/i.test(trimmed);
    const isNegativeResponse = /^(n[aã]o|nao era|não era|nenhum|nenhuma|errado|outro|outra|nada disso|queria outr[oa])\b/i.test(trimmed);

    if (isHumanRequest || isNegativeResponse) {
      const reply = isHumanRequest
        ? 'Claro, estamos à disposição! Como posso te ajudar hoje? Pode me dizer qual produto você procura ou como podemos te ajudar?'
        : 'Entendido perfeitamente! Já avisei a nossa equipe da loja e um de nossos atendentes vai te responder por aqui em instantes. Um momento, por favor!';
      await this.firestoreRepo.appendMessage(phone, 'assistant', reply);
      if (this.whatsappClient) {
        await this.whatsappClient.sendTextMessage(phone, reply);

        const ownerPhone = process.env.OWNER_WHATSAPP_NUMBER || process.env.STORE_NOTIFICATION_PHONE;
        if (ownerPhone) {
          const formattedCustomerPhone = this.whatsappClient.formatRecipient(phone);
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
          await this.whatsappClient.sendTextMessage(ownerPhone, alertMessage).catch(err => {
            Logger.warn('Aviso: falha ao notificar telefone do dono', { error: err.message });
          });
        }
      }

      try {
        if (this.firestoreRepo?.firestore) {
          const { customerKeyFor } = require('../agent/agent-store');
          const customerKey = customerKeyFor('conflora', phone);
          await this.firestoreRepo.firestore.collection('agent_conversations').doc('conflora__' + customerKey).set({
            tenantId: 'conflora',
            customerKey,
            automation: 'paused',
            updatedAt: new Date().toISOString(),
            reason: isNegativeResponse ? 'customer_declined_bot' : 'human_requested'
          }, { merge: true });
        }
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
      if (this.whatsappClient) {
        await this.whatsappClient.sendInteractiveList(phone, {
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
        if (this.whatsappClient) {
          await this.whatsappClient.sendInteractiveList(phone, {
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
        return this.sendNativeProductsList(phone, categoryName, products, startTime);
      }
    }

    // 5. Opção 2 — 100% Nativo no WhatsApp: Seleção de Subcategoria -> Produtos
    const isSubcategorySelection = interactiveId.startsWith('sub_');
    if (isSubcategorySelection) {
      await this.catalogRepo.refreshCatalog().catch(() => {});
      const subcategoryName = interactiveId.replace('sub_', '');
      const products = this.catalogRepo.getProductsBySubcategory(subcategoryName);
      return this.sendNativeProductsList(phone, subcategoryName, products, startTime);
    }

    // 6. Opção 2 — 100% Nativo no WhatsApp: Adicionar Produto à Sacola
    const isAddProduct = interactiveId.startsWith('add_');
    if (isAddProduct) {
      await this.catalogRepo.refreshCatalog().catch(() => {});
      const productId = interactiveId.replace('add_', '');
      const product = this.catalogRepo.items.find((i) => String(i.id) === productId) ||
        this.catalogRepo.findProductByName(message);

      if (product) {
        const pendingOrder = (await this.firestoreRepo.getOrder(phone)) || { items: [] };
        const existingItems = Array.isArray(pendingOrder.items) ? [...pendingOrder.items] : [];
        const existingIdx = existingItems.findIndex((it) => it.id === product.id || it.name === product.name);
        if (existingIdx >= 0) {
          existingItems[existingIdx].quantity = (existingItems[existingIdx].quantity || 1) + 1;
        } else {
          existingItems.push({
            id: product.id,
            name: product.name,
            price: product.price || 0,
            quantity: 1,
          });
        }
        await this.firestoreRepo.saveOrder(phone, { items: existingItems }).catch(() => {});

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

        if (this.whatsappClient) {
          await this.whatsappClient.sendInteractiveButtons(phone, {
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

      await this.firestoreRepo.updateOrder(phone, { deliveryMethod }).catch(() => {});

      const bodyText = [
        `Você escolheu: *${deliveryMethod}*! 📦`,
        '',
        'Como prefere efetuar o pagamento do seu pedido?'
      ].join('\n');

      const buttons = [
        { id: 'pay_pix', title: '💠 PIX' },
        { id: 'pay_cartao', title: '💳 Cartão' },
      ];

      if (this.whatsappClient) {
        await this.whatsappClient.sendInteractiveButtons(phone, {
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

      const pendingOrder = await this.firestoreRepo.getOrder(phone);
      const total = pendingOrder?.items?.reduce((acc, it) => acc + (it.price || 0) * (it.quantity || 1), 0) || 0;

      let reply;
      if (isPix) {
        const pixKey = process.env.PIX_KEY || '64999990000';
        reply = [
          '🎉 *Pedido realizado com sucesso!*',
          '',
          `💳 *Forma de Pagamento:* PIX`,
          `💰 *Total a pagar:* ${formatCurrency(total)}`,
          '',
          `🔑 *Chave PIX:* \`${pixKey}\``,
          '',
          'Por favor, envie o comprovante por aqui assim que efetuar o pagamento. Já estamos separando seu pedido com muito carinho! 🌿'
        ].join('\n');
      } else {
        reply = [
          '🎉 *Pedido realizado com sucesso!*',
          '',
          `💳 *Forma de Pagamento:* Cartão (Débito/Crédito)`,
          `💰 *Total:* ${formatCurrency(total)}`,
          '',
          'A maquininha de cartão será levada na entrega ou disponibilizada na retirada.',
          'Nossa equipe entrará em contato em instantes para confirmar os detalhes! 🌿'
        ].join('\n');
      }

      await this.firestoreRepo.updateOrder(phone, { paymentMethod, status: 'CONFIRMADO' }).catch(() => {});
      if (this.whatsappClient) {
        await this.whatsappClient.sendTextMessage(phone, reply);
      }
      await this.firestoreRepo.appendMessage(phone, 'assistant', reply);
      return {
        reply,
        intent: 'NATIVE_ORDER_COMPLETED',
        imagesSent: 0,
        latencyMs: Math.round(performance.now() - startTime),
      };
    }

    // 9. Se for saudação isolada (ex: "Bom dia", "Oi", "Boa tarde"), dispara o modelo de boas-vindas com os botões diretos
    const isGreetingOnly = /^(oi|ola|opa|bom dia|boa tarde|boa noite|e ai|eai|tudo bem|tudo bom|como vai|salve|fala|oie|oii|oiii)(\s+(tudo bem|tudo bom|amigo|amiga|equipe|conflora|pessoal))?[!?.]*$/i.test(normalizeText(trimmed));
    if (isGreetingOnly) {
      Logger.info('Saudação isolada recebida. Disparando modelo de boas-vindas com botões da loja...', { phone, message });
      let resolvedName = customerName?.trim?.() || '';
      if (!resolvedName && this.firestoreRepo?.getCustomerProfile) {
        const profile = await this.firestoreRepo.getCustomerProfile(phone).catch(() => null);
        resolvedName = profile?.name || profile?.customerName || '';
      }
      if (this.whatsappClient) {
        await this.whatsappClient.sendWelcomeTemplate(phone, resolvedName).catch((err) => {
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

  async sendNativeProductsList(phone, title, products, startTime) {
    if (!products || products.length === 0) {
      const reply = `Não encontrei produtos cadastrados no momento para *${title}*. Gostaria de escolher outra categoria?`;
      if (this.whatsappClient) await this.whatsappClient.sendTextMessage(phone, reply);
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
    if (this.whatsappClient) {
      await this.whatsappClient.sendInteractiveList(phone, {
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

