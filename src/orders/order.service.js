const { t } = require('../i18n');
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
        productId: prod.id || prod.productId || '',
        name: prod.canonicalName,
        price,
        quantity: qty,
        subtotal,
      });
    }

    const order = {
      phone,
      operationId: require('node:crypto').randomUUID(),
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
    const qtyText = quantity > 1 ? `${t("interface.message.c214516fb797")}${quantity}${t("interface.fragment.9117a82d4311")}` : '';
    return (
      `${t("interface.fragment.53ea84bc1bff")}${product.canonicalName}${t("interface.message.bcf65a476c85")}${pricesText}.\n\n` +
      `${t("interface.message.bb35e71d47fa")}${qtyText}?`
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
        `${t("interface.message.b76a25558e78")}${formatCurrency(order.total)}\n\n` +
        `📍 *Entregar em:* ${order.deliveryAddress}?\n\n` +
        `💳 No *${order.paymentMethod}${t("interface.message.c780ced61f29")}`
      );
    }

    // Exemplo 3: Reconfirmação após alteração de dados
    if (isUpdated) {
      const addressLine = order.deliveryAddress
        ? `📍 *Entregar em:* ${order.deliveryAddress}\n\n`
        : `${t("interface.message.b36ef3eadd24")}`;

      const paymentLine = order.paymentMethod
        ? `${t("interface.message.5425f561028e")}${order.paymentMethod}\n\n`
        : `${t("interface.message.88de79f84402")}`;

      return (
        `${t("interface.message.e062680f20a1")}` +
        `${t("interface.message.4d99f921071d")}` +
        `${itemsText}\n\n` +
        `${t("interface.message.b76a25558e78")}${formatCurrency(order.total)}\n\n` +
        `${addressLine}` +
        `${paymentLine}` +
        `${t("interface.message.928cc451a976")}`
      );
    }

    // Exemplo 1: Pedido Novo / Múltiplo sem histórico completo
    return (
      `${t("interface.message.562b18b49b53")}` +
      `${t("interface.message.4d99f921071d")}` +
      `${itemsText}\n\n` +
      `${t("interface.message.b76a25558e78")}${formatCurrency(order.total)}\n\n` +
      `${t("interface.message.eccc34e86b35")}` +
      `${t("interface.message.5ab77bb1fcbb")}`
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

    if (this.firestoreRepo.firestore) {
      const products = await this.firestoreRepo.getAllProducts();
      const items = order.items.map(item => {
        let product = products.find(p => p.id === item.productId);
        if (!product) {
          const matches = products.filter(p => normalizeText(p.name || p.descricao) === normalizeText(item.name) && Number(p.price ?? p.valor_num) === Number(item.price));
          if (matches.length !== 1) {throw new Error(t("interface.message.1ebd81cd2671"));}
          product = matches[0];
        }
        return { productId: product.id, quantity: item.quantity };
      });
      const finalized = await new (require('../operations/ledger').Ledger)(this.firestoreRepo).sale({
        requestId: order.operationId, items, customerName, customerPhone: phone,
        deliveryAddress: order.deliveryAddress, paymentMethod: order.paymentMethod,
        source: 'WHATSAPP', onAccount: true, confirmNegative: true,
      }, { id: 'whatsapp-agent', name: 'WhatsApp', role: 'SYSTEM' });
      order.total = finalized.total;
      order.items = finalized.items;
      order.stockDeducted = true;
      order.saleId = finalized.id;
    } else if (this.firestoreRepo.isInMemory) {
      await this.firestoreRepo.deductStock(order.items, phone);
    } else {
      throw new Error(t("interface.message.eff25405613b"));
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
      Logger.warn(t("interface.message.f00c071071a8"), { error: err.message });
    });

    // Mensagem de retorno para o cliente
    const addrText = order.deliveryAddress ? `${t("interface.message.58423bf61e66")}${order.deliveryAddress}\n` : '';
    const payText = order.paymentMethod ? `${t("interface.message.dff91eaf1b56")}${order.paymentMethod}\n` : t("interface.message.24482352d295");

    if (isPix) {
      return {
        order,
        reply: (
          `${t("interface.message.e4f0544436a8")}` +
          `${t("interface.message.8c30d93e16a0")}${formatCurrency(order.total)}\n` +
          `${addrText}` +
          `${payText}\n` +
          `🔑 *Chave PIX:* \`${config.pix.key}\`\n` +
          `👤 *Titular:* ${config.pix.holder}\n\n` +
          `${t("interface.message.65b54db8ffae")}`
        ),
      };
    }

    return {
      order,
      reply: (
        `${t("interface.message.e4f0544436a8")}` +
        `${t("interface.message.8c30d93e16a0")}${formatCurrency(order.total)}\n` +
        `${addrText}` +
        `${payText}\n` +
        `${t("interface.message.1011e653288d")}`
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
      `${t("interface.message.7f518ed03eef")}` +
      `${t("interface.message.f15899694c23")}${customerName || order.phone}\n` +
      `📱 *WhatsApp:* ${order.phone}\n\n` +
      `${t("interface.message.0714b0395754")}` +
      `${itemsText}\n\n` +
      `${t("interface.message.8c30d93e16a0")}${formatCurrency(order.total)}\n` +
      `${t("interface.message.b661b3297b30")}${order.deliveryAddress || t("interface.message.e0155073a931")}\n` +
      `${t("interface.message.13d5d6d3562d")}${order.paymentMethod || 'PIX'}`
    );

    await this.whatsappClient.sendTextMessage(ownerNumber, notificationText);
    Logger.info(`${t("interface.message.3b9a127d536c")}${ownerNumber}`);
  }
}

module.exports = {
  ORDER_STATUS,
  OrderService,
};
