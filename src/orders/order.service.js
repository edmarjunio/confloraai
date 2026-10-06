const config = require('../config/env');
const { formatCurrency } = require('../shared/string.util');

const ORDER_STATUS = Object.freeze({
  DISCOVERY: 'DISCOVERY',
  AWAITING_CONFIRMATION: 'AWAITING_CONFIRMATION',
  CONFIRMED_AWAITING_PAYMENT: 'CONFIRMED_AWAITING_PAYMENT',
  PAID_CONFIRMED: 'PAID_CONFIRMED',
  CANCELLED: 'CANCELLED',
});

class OrderService {
  /**
   * @param {Object} dependencies
   * @param {import('../database/firestore.repository').FirestoreRepository} dependencies.firestoreRepo
   * @param {import('../catalog/catalog.repository').CatalogRepository} dependencies.catalogRepo
   */
  constructor({ firestoreRepo, catalogRepo }) {
    if (!firestoreRepo || !catalogRepo) {
      throw new Error('OrderService requires firestoreRepo and catalogRepo');
    }
    this.firestoreRepo = firestoreRepo;
    this.catalogRepo = catalogRepo;
  }

  /**
   * Validates items against catalog and creates an order awaiting confirmation.
   * @param {string} phone
   * @param {Array<{ productName: string, quantity: number, targetPrice?: number }>} requestedItems
   * @returns {Promise<Object>}
   */
  async createPendingOrder(phone, requestedItems) {
    const validatedItems = [];
    let total = 0;

    for (const req of requestedItems) {
      const productGroup = this.catalogRepo.findProductByName(req.productName);
      if (!productGroup || productGroup.prices.length === 0) {
        continue;
      }

      // If user selected a specific price variation or default to lowest
      const matchedPrice = req.targetPrice && productGroup.prices.includes(req.targetPrice)
        ? req.targetPrice
        : productGroup.prices[0];

      const qty = Math.max(1, req.quantity || 1);
      const subtotal = matchedPrice * qty;
      total += subtotal;

      validatedItems.push({
        name: productGroup.canonicalName,
        price: matchedPrice,
        quantity: qty,
        subtotal,
      });
    }

    const order = {
      phone,
      items: validatedItems,
      total,
      status: ORDER_STATUS.AWAITING_CONFIRMATION,
      createdAt: new Date().toISOString(),
    };

    await this.firestoreRepo.saveOrder(phone, order);
    return order;
  }

  /**
   * Confirms the order and returns PIX instructions.
   * @param {string} phone
   * @returns {Promise<{ order: Object, paymentInstructions: string }>}
   */
  async confirmOrder(phone) {
    const order = await this.firestoreRepo.getOrder(phone);
    if (!order || order.status !== ORDER_STATUS.AWAITING_CONFIRMATION) {
      return null;
    }

    order.status = ORDER_STATUS.CONFIRMED_AWAITING_PAYMENT;
    order.confirmedAt = new Date().toISOString();
    await this.firestoreRepo.saveOrder(phone, order);

    const paymentInstructions = (
      `✅ *Pedido Confirmado com Sucesso!*\n\n` +
      `💰 *Total:* ${formatCurrency(order.total)}\n` +
      `🔑 *Chave PIX:* \`${config.pix.key}\`\n` +
      `👤 *Titular:* ${config.pix.holder}\n\n` +
      `Por favor, assim que realizar a transferência, envie a foto ou PDF do comprovante aqui para separarmos suas plantas 🌱!`
    );

    return { order, paymentInstructions };
  }

  /**
   * Formats the order summary for WhatsApp.
   * @param {Object} order
   * @returns {string}
   */
  formatOrderSummary(order) {
    if (!order || !order.items || order.items.length === 0) {
      return '';
    }

    const itemsText = order.items
      .map((item) => `• ${item.quantity}x ${item.name} (${formatCurrency(item.price)}) = ${formatCurrency(item.subtotal)}`)
      .join('\n');

    return (
      `📋 *Resumo do seu Pedido:*\n\n` +
      `${itemsText}\n\n` +
      `*Total Geral:* ${formatCurrency(order.total)}\n\n` +
      `Podemos confirmar o pedido? Basta responder *"Sim"* ou *"Confirmo"*!`
    );
  }
}

module.exports = {
  ORDER_STATUS,
  OrderService,
};
