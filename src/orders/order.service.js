const config = require('../config/env');
const { randomUUID, createHash } = require('node:crypto');
const { commercialLine } = require('../catalog/commercial-product');
const { pixMode, manualPixSettings } = require('./pix-mode');
const { formatOrderReceipt } = require('./receipt.util');
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
  async createPendingOrder(phone, items, customerProfile = null, messageId = '') {
    const refs = items.map(item => {
      const product = item.product;
      const candidates = product?.id ? [product] : (product?.items || []).filter(candidate =>
        item.targetPrice === undefined || Number(candidate.price ?? candidate.valor_num) === Number(item.targetPrice));
      if (candidates.length !== 1 || !candidates[0].id) throw Object.assign(new Error('Selecione uma opção cadastrada e inequívoca do produto.'), { status: 409 });
      return { productId: String(candidates[0].id), quantity: item.quantity ?? 1 };
    });
    const products = new Map((await this.firestoreRepo.getProductsByIds(refs.map(item => item.productId))).map(product => [String(product.id), product]));
    const lines = refs.map(item => {
      const product = products.get(item.productId);
      if (!product) throw new Error('Produto não encontrado no catálogo oficial.');
      const line = commercialLine(product, item.quantity);
      return { ...line, subtotal: line.subtotalMinor / 100 };
    });
    const stableId = messageId ? createHash('sha256').update('whatsapp-order:' + phone + ':' + messageId).digest('hex').slice(0, 32) : randomUUID();
    return this.firestoreRepo.mutateConversationOrder(phone, current => {
      if (messageId && current?.sourceMessageId === messageId) return null;
      return { commercialOrderId: stableId, sourceMessageId: messageId, phone, items: lines,
        total: lines.reduce((sum, line) => sum + line.subtotalMinor, 0) / 100,
        deliveryAddress: customerProfile?.deliveryAddress || '', paymentMethod: customerProfile?.paymentMethod || '',
        status: ORDER_STATUS.AWAITING_CONFIRMATION, createdAt: new Date().toISOString() };
    });
  }

  /**
   * Atualiza endereço ou forma de pagamento no pedido pendente.
   * @param {string} phone
   * @param {Object} fields
   * @returns {Promise<Object|null>}
   */
  async updateOrderDetails(phone, fields) {
    const result = await this.firestoreRepo.mutateConversationOrder(phone, current => {
      if (current?.status !== ORDER_STATUS.AWAITING_CONFIRMATION) return null;
      const changes = {};
      for (const field of ['deliveryAddress', 'paymentMethod', 'orderType']) if (fields[field]) changes[field] = fields[field];
      return { ...current, ...changes };
    });
    return result?.status === ORDER_STATUS.AWAITING_CONFIRMATION ? result : null;
  }

  async addProductToDraft(phone, productId, messageId = '') {
    const [product] = await this.firestoreRepo.getProductsByIds([productId]);
    if (!product) throw new Error('Produto não encontrado.');
    const { commercialProduct } = require('../catalog/commercial-product');
    const quantity = commercialProduct(product).saleUnit.minimum;
    const line = commercialLine(product, quantity);
    const id = randomUUID();
    return this.firestoreRepo.mutateConversationOrder(phone, current => {
      const draft = current?.status === 'AWAITING_CONFIRMATION' ? current : {
        commercialOrderId: id, items: [], status: 'AWAITING_CONFIRMATION', createdAt: new Date().toISOString(), ops: [],
      };
      if (messageId && draft.ops?.includes(messageId)) return null;
      const items = [...draft.items];
      const index = items.findIndex(item => String(item.productId || item.id) === String(productId));
      if (index < 0) items.push({ ...line, subtotal: line.subtotalMinor / 100 });
      else {
        const next = commercialLine(product, Number((Number(items[index].quantity) + quantity).toFixed(3)));
        items[index] = { ...next, subtotal: next.subtotalMinor / 100 };
      }
      return { ...draft, items, total: items.reduce((sum, item) => sum + Math.round(item.price * item.quantity * 100), 0) / 100,
        ops: [...(draft.ops || []), ...(messageId ? [messageId] : [])].slice(-30) };
    });
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
    let draft = await this.firestoreRepo.getOrder(phone);
    if (!draft?.items?.length) return null;
    if (!draft.commercialOrderId) {
      draft = await this.firestoreRepo.mutateConversationOrder(phone, current => ({ ...current, commercialOrderId: current.commercialOrderId || randomUUID() }));
    }
    const previous = await this.firestoreRepo.getOrderById(draft.commercialOrderId);
    if (previous) {
      if (previous.source !== 'WHATSAPP_BOT' || previous.customerPhone !== phone) throw new Error('Pedido incompatível com esta conversa.');
      return this.prepareCommercialOrder(previous);
    }
    if (draft.status !== ORDER_STATUS.AWAITING_CONFIRMATION) return null;
    const orderType = draft.orderType || (draft.deliveryAddress ? 'DELIVERY' : 'PICKUP');
    if (orderType === 'DELIVERY' && String(draft.deliveryAddress || '').trim().length < 8) {
      return { order: draft, reply: 'Informe o endereço completo para entrega: rua, número, bairro e cidade. Depois confirme o pedido.' };
    }
    const rawMethod = normalizeText(draft.paymentMethod || 'PIX').toUpperCase();
    const paymentMethod = /PIX/.test(rawMethod) ? 'PIX' : /DEBITO/.test(rawMethod) ? 'DEBITO'
      : /CREDITO|CARTAO/.test(rawMethod) ? 'CREDITO' : /DINHEIRO/.test(rawMethod) ? 'DINHEIRO' : '';
    if (!paymentMethod) throw new Error('Escolha Pix, dinheiro, débito ou crédito.');
    const current = new Map((await this.firestoreRepo.getProductsByIds(draft.items.map(item => item.productId || item.id))).map(product => [String(product.id), product]));
    const items = draft.items.map(item => {
      const product = current.get(String(item.productId || item.id));
      if (!product) throw new Error('Produto não encontrado no catálogo oficial.');
      const line = commercialLine(product, item.quantity);
      if (line.price !== Number(item.price)) throw Object.assign(new Error('O preço mudou. Revise sua sacola antes de confirmar.'), { status: 409 });
      return { ...line, subtotal: line.subtotalMinor / 100 };
    });
    const total = items.reduce((sum, item) => sum + item.subtotalMinor, 0) / 100;
    if (total <= 0) throw new Error('Pedido sem valor comercial válido.');
    const manualPix = paymentMethod === 'PIX' && pixMode() === 'MANUAL' ? manualPixSettings() : null;
    const automatic = paymentMethod === 'PIX' && !manualPix;
    if (automatic && !this.commerce?.pix?.isOfficialApiConfigured) throw Object.assign(new Error('Pix Sicredi indisponível. Aguarde atendimento da loja.'), { status: 503 });
    const id = draft.commercialOrderId;
    const order = await this.firestoreRepo.createDirectOrder({
      id, orderId: id, ticketNumber: id.replaceAll('-', '').slice(0, 10).toUpperCase(), source: 'WHATSAPP_BOT',
      customerPhone: phone, phone, customerName: customerName || 'Cliente WhatsApp',
      items, subtotal: total, total, discount: 0, paymentMethod, paymentParts: [{ method: paymentMethod, amount: total }],
      paymentStatus: 'PENDING', status: automatic ? 'CREATING_PIX' : 'AWAITING_PAYMENT',
      orderType, deliveryAddress: draft.deliveryAddress || '',
      ...(orderType === 'DELIVERY' ? { deliveryStatus: paymentMethod === 'PIX' ? 'PENDING_DISPATCH' : 'PENDING_DELIVERY' } : {}),
      createdBy: { id: 'WHATSAPP', name: 'Atendimento WhatsApp', role: 'SYSTEM' },
      ...(paymentMethod === 'PIX' ? { pixMode: manualPix ? 'MANUAL' : 'SICREDI' } : {}),
      ...(manualPix ? { manualPix, paymentReviewStatus: 'AWAITING_PAYMENT' } : {}),
      ...(automatic ? { pixData: { txid: id.replaceAll('-', '').toUpperCase(), provider: 'SICREDI' }, pixProvider: 'SICREDI' } : {}),
    }, { reserveInventory: true, conversationDraft: { phone, version: draft.version } });
    return this.prepareCommercialOrder(order);
  }

  async prepareCommercialOrder(order) {
    if (order.status === 'CANCELLED') throw new Error('Pedido cancelado. Inicie uma nova sacola.');
    if (order.pixMode === 'SICREDI' && !order.completedAt) {
      if (!this.commerce) throw new Error('Núcleo comercial indisponível para preparar o Pix.');
      await this.commerce.pdv.schedulePixExpiration(order);
      order = await this.commerce.pdv.preparePix(order);
    }
    if (this.commerce) await this.commerce.pdv.queueOperationalNotifications(order);
    // Receipt intent was committed atomically with the order; the worker handles delivery.
    return { order, reply: formatOrderReceipt(order) + '\n\nPedido registrado. O pagamento permanece pendente até a confirmação financeira da loja.' };
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
