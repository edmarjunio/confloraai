const config = require('../config/env');
const { formatCurrency, normalizeText } = require('../shared/string.util');
const Logger = require('../shared/logger');

const ORDER_STATUS = Object.freeze({
  DISCOVERY: 'DISCOVERY',
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
  CONFIRMED_AWAITING_PAYMENT: 'CONFIRMED_AWAITING_PAYMENT',
  CONFIRMED_AWAITING_DELIVERY: 'CONFIRMED_AWAITING_DELIVERY',
  PAID_CONFIRMED: 'PAID_CONFIRMED',
  CANCELLED: 'CANCELLED',
});

class OrderService {
  /**
   * @param {Object} dependencies
   * @param {import('../database/firestore.repository').FirestoreRepository} dependencies.firestoreRepo
   * @param {import('../catalog/catalog.repository').CatalogRepository} dependencies.catalogRepo
   * @param {import('../integrations/whatsapp.client').WhatsAppClient} [dependencies.whatsappClient]
   */
  constructor({ firestoreRepo, catalogRepo, whatsappClient = null }) {
    if (!firestoreRepo || !catalogRepo) {
      throw new Error('OrderService requires firestoreRepo and catalogRepo');
    }
    this.firestoreRepo = firestoreRepo;
    this.catalogRepo = catalogRepo;
    this.whatsappClient = whatsappClient;
  }

  /**
   * Cria um pedido pendente a partir dos itens validados.
   * @param {string} phone
   * @param {Array<{ product: Object, quantity: number, targetPrice?: number }>} items
   * @param {Object} [customerProfile]
   * @returns {Promise<Object>}
   */
  async createPendingOrder(phone, items, customerProfile = null) {
    const validatedItems = [];
    let total = 0;

    for (const item of items) {
      const prod = item.product;
      const price = item.targetPrice || prod.prices[0];
      const qty = Math.max(1, item.quantity || 1);
      const subtotal = price * qty;
      total += subtotal;

      validatedItems.push({
        name: prod.canonicalName,
        price,
        quantity: qty,
        subtotal,
      });
    }

    const order = {
      phone,
      items: validatedItems,
      total,
      deliveryAddress: customerProfile?.deliveryAddress || '',
      paymentMethod: customerProfile?.paymentMethod || '',
      status: ORDER_STATUS.AWAITING_CONFIRMATION,
      createdAt: new Date().toISOString(),
    };

    await this.firestoreRepo.saveOrder(phone, order);
    return order;
  }

  /**
   * Atualiza endereço ou forma de pagamento no pedido pendente.
   * @param {string} phone
   * @param {Object} fields
   * @returns {Promise<Object|null>}
   */
  async updateOrderDetails(phone, fields) {
    const order = await this.firestoreRepo.getOrder(phone);
    if (!order || order.status !== ORDER_STATUS.AWAITING_CONFIRMATION) {
      return null;
    }

    if (fields.deliveryAddress) {
      order.deliveryAddress = fields.deliveryAddress;
    }
    if (fields.paymentMethod) {
      order.paymentMethod = fields.paymentMethod;
    }

    await this.firestoreRepo.saveOrder(phone, order);
    return order;
  }

  /**
   * Pergunta qual tamanho o cliente quer quando há múltiplos preços e sem histórico.
   * @param {Object} product
   * @param {number} quantity
   * @returns {string}
   */
  formatSizeConfirmationPrompt(product, quantity) {
    const pricesText = product.prices.map((p) => formatCurrency(p)).join(', ');
    const qtyText = quantity > 1 ? `para as ${quantity} unidades` : '';
    return (
      `Temos a *${product.canonicalName}* em diferentes tamanhos/valores: ${pricesText}.\n\n` +
      `Qual tamanho você prefere ${qtyText}?`
    ).trim();
  }

  /**
   * Formata o recibo do pedido para o WhatsApp.
   * @param {Object} order
   * @param {Object} [options]
   * @param {boolean} [options.isVipProposal=false]
   * @param {boolean} [options.isUpdated=false]
   * @returns {string}
   */
  formatCustomerReceipt(order, { isVipProposal = false, isUpdated = false } = {}) {
    if (!order || !order.items || order.items.length === 0) {
      return '';
    }

    const itemsText = order.items
      .map((item) => `• ${item.quantity}x ${item.name} (${formatCurrency(item.price)} un) = ${formatCurrency(item.subtotal)}`)
      .join('\n');

    // Exemplo 2: Cliente com Histórico ("O de sempre")
    if (isVipProposal && order.deliveryAddress && order.paymentMethod) {
      return (
        `Claro! Vai ser o de sempre?\n\n` +
        `${itemsText}\n\n` +
        `💰 *Valor total:* ${formatCurrency(order.total)}\n\n` +
        `📍 *Entregar em:* ${order.deliveryAddress}?\n\n` +
        `💳 No *${order.paymentMethod}* né?`
      );
    }

    // Exemplo 3: Reconfirmação após alteração de dados
    if (isUpdated) {
      const addressLine = order.deliveryAddress
        ? `📍 *Entregar em:* ${order.deliveryAddress}\n\n`
        : `📍 *Endereço para entrega:*\n\n`;

      const paymentLine = order.paymentMethod
        ? `💳 *Forma de pagamento:* ${order.paymentMethod}\n\n`
        : `💳 *Forma de pagamento:*\n\n`;

      return (
        `Perfeito! Já atualizei o seu pedido:\n\n` +
        `📋 *Resumo do Pedido:*\n\n` +
        `${itemsText}\n\n` +
        `💰 *Valor total:* ${formatCurrency(order.total)}\n\n` +
        `${addressLine}` +
        `${paymentLine}` +
        `Poderia me confirmar para finalizarmos?`
      );
    }

    // Exemplo 1: Pedido Novo / Múltiplo sem histórico completo
    return (
      `Certo! Já anotei o seu pedido:\n\n` +
      `📋 *Resumo do Pedido:*\n\n` +
      `${itemsText}\n\n` +
      `💰 *Valor total:* ${formatCurrency(order.total)}\n\n` +
      `📍 Poderia me confirmar o pedido e mandar o endereço pra gente entregar?\n\n` +
      `💳 Qual seria a forma de pagamento?`
    );
  }

  /**
   * Confirma o pedido e envia notificação ao dono do viveiro no WhatsApp.
   * @param {string} phone
   * @param {string} [customerName='']
   * @returns {Promise<{ order: Object, reply: string }|null>}
   */
  async confirmOrder(phone, customerName = '') {
    const order = await this.firestoreRepo.getOrder(phone);
    if (!order || order.status !== ORDER_STATUS.AWAITING_CONFIRMATION) {
      return null;
    }

    const isPix = !order.paymentMethod || /pix/i.test(order.paymentMethod);
    order.status = isPix ? ORDER_STATUS.CONFIRMED_AWAITING_PAYMENT : ORDER_STATUS.CONFIRMED_AWAITING_DELIVERY;
    order.confirmedAt = new Date().toISOString();

    // Realiza a baixa de estoque atômica no Firestore
    const stockDeduction = await this.firestoreRepo.deductStock(order.items, phone).catch((err) => {
      Logger.warn('Aviso: falha na baixa de estoque no Firestore', { error: err.message });
      return null;
    });
    if (stockDeduction && stockDeduction.deducted && stockDeduction.deducted.length > 0) {
      order.stockDeducted = true;
      order.deductedItems = stockDeduction.deducted;
    }

    await this.firestoreRepo.saveOrder(phone, order);

    // Salvar preferências no perfil do cliente para compras futuras ("O de sempre")
    const existingProfile = await this.firestoreRepo.getCustomerProfile(phone);
    const preferredItems = existingProfile?.preferredItems || {};
    for (const item of order.items) {
      preferredItems[normalizeText(item.name)] = item.price;
    }

    await this.firestoreRepo.saveCustomerProfile(phone, {
      name: customerName || existingProfile?.name || '',
      deliveryAddress: order.deliveryAddress || existingProfile?.deliveryAddress || '',
      paymentMethod: order.paymentMethod || existingProfile?.paymentMethod || 'PIX',
      preferredItems,
      lastOrderAt: order.confirmedAt,
    });

    // Enviar notificação para o WhatsApp do Dono (Edmar)
    await this.notifyOwner(order, customerName).catch((err) => {
      Logger.warn('Aviso: falha ao notificar WhatsApp do dono', { error: err.message });
    });

    // Mensagem de retorno para o cliente
    const addrText = order.deliveryAddress ? `📍 *Entrega:* ${order.deliveryAddress}\n` : '';
    const payText = order.paymentMethod ? `💳 *Pagamento:* ${order.paymentMethod}\n` : '💳 *Pagamento:* PIX\n';

    if (isPix) {
      return {
        order,
        reply: (
          `✅ *Pedido Confirmado com Sucesso!*\n\n` +
          `💰 *Valor Total:* ${formatCurrency(order.total)}\n` +
          `${addrText}` +
          `${payText}\n` +
          `🔑 *Chave PIX:* \`${config.pix.key}\`\n` +
          `👤 *Titular:* ${config.pix.holder}\n\n` +
          `Assim que realizar o pagamento, por favor envie o comprovante aqui para agilizarmos a entrega! 🌱`
        ),
      };
    }

    return {
      order,
      reply: (
        `✅ *Pedido Confirmado com Sucesso!*\n\n` +
        `💰 *Valor Total:* ${formatCurrency(order.total)}\n` +
        `${addrText}` +
        `${payText}\n` +
        `Já estamos separando seus produtos para entrega! Se precisar de algo mais, estou à disposição 🌱.`
      ),
    };
  }

  /**
   * Envia o recibo fechado diretamente para o WhatsApp do proprietário.
   * @param {Object} order
   * @param {string} customerName
   */
  async notifyOwner(order, customerName = '') {
    const ownerNumber = config.whatsapp.ownerNumber;
    if (!ownerNumber || !this.whatsappClient) {
      return;
    }

    const itemsText = order.items
      .map((item) => `• ${item.quantity}x ${item.name} (${formatCurrency(item.price)} un) = ${formatCurrency(item.subtotal)}`)
      .join('\n');

    const notificationText = (
      `🔔 *NOVO PEDIDO FECHADO - CONFLORA* 🔔\n\n` +
      `👤 *Cliente:* ${customerName || order.phone}\n` +
      `📱 *WhatsApp:* ${order.phone}\n\n` +
      `📋 *Itens do Pedido:*\n` +
      `${itemsText}\n\n` +
      `💰 *Valor Total:* ${formatCurrency(order.total)}\n` +
      `📍 *Endereço de Entrega:* ${order.deliveryAddress || 'A combinar / Retirada'}\n` +
      `💳 *Forma de Pagamento:* ${order.paymentMethod || 'PIX'}`
    );

    await this.whatsappClient.sendTextMessage(ownerNumber, notificationText);
    Logger.info(`Notificação de novo pedido enviada com sucesso para o proprietário: ${ownerNumber}`);
  }
}

module.exports = {
  ORDER_STATUS,
  OrderService,
};
