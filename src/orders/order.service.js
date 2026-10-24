const { randomUUID, createHash } = require('node:crypto');
const { commercialLine } = require('../catalog/commercial-product');
const { pixMode, manualPixSettings } = require('./pix-mode');
const { formatOrderReceipt } = require('./receipt.util');
const { formatCurrency, normalizeText } = require('../shared/string.util');

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
      if (Number.isSafeInteger(fields.confirmedDeliveryFeeMinor)) changes.confirmedDeliveryFeeMinor = fields.confirmedDeliveryFeeMinor;
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
  formatCustomerReceipt(order) {
    if (!order?.items?.length) return '';
    const items = order.items.map(item => item.quantity + ' ' + item.name).join(' e ');
    const total = formatCurrency(order.total);
    const details = [order.deliveryAddress, order.paymentMethod].filter(Boolean).join('; ');
    return items + '. Total: ' + total + '.' + (details ? ' ' + details + '.' : '') + ' Posso confirmar?';
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
    const delivery = await this.getDeliveryOptions();
    if (orderType === 'DELIVERY' && !delivery.enabled) throw new Error('Entrega indisponível. Escolha retirada.');
    const deliveryFeeMinor = orderType === 'DELIVERY' ? delivery.feeMinor : 0;
    if (deliveryFeeMinor !== Number(draft.confirmedDeliveryFeeMinor || 0)) throw Object.assign(new Error('A taxa de entrega mudou. Confirme o novo total.'), { status: 409 });
    const subtotal = items.reduce((sum, item) => sum + item.subtotalMinor, 0) / 100;
    const total = subtotal + deliveryFeeMinor / 100;
    if (total <= 0) throw new Error('Pedido sem valor comercial válido.');
    const manualPix = paymentMethod === 'PIX' && pixMode() === 'MANUAL' ? manualPixSettings() : null;
    const automatic = paymentMethod === 'PIX' && !manualPix;
    if (automatic && !this.commerce?.pix?.isOfficialApiConfigured) throw Object.assign(new Error('Pix Sicredi indisponível. Aguarde atendimento da loja.'), { status: 503 });
    const id = draft.commercialOrderId;
    const order = await this.firestoreRepo.createDirectOrder({
      id, orderId: id, ticketNumber: id.replaceAll('-', '').slice(0, 10).toUpperCase(), source: 'WHATSAPP_BOT',
      customerPhone: phone, phone, customerName: customerName || 'Cliente WhatsApp',
      items, subtotal, deliveryFee: deliveryFeeMinor / 100, total, discount: 0, paymentMethod, paymentParts: [{ method: paymentMethod, amount: total }],
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

  async getDeliveryOptions() {
    const saved = await require('../storefront/existing-store').readStoreSettings(this.firestoreRepo);
    const delivery = saved?.config?.checkout?.delivery;
    return { enabled: delivery?.enabled === true && Number.isSafeInteger(delivery.feeMinor) && delivery.feeMinor >= 0,
      feeMinor: delivery?.feeMinor ?? 0 };
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
    return { order, reply: formatOrderReceipt(order) + (!order.completedAt && !order.paidAt
      ? '\n\nPedido registrado. O pagamento permanece pendente até a confirmação financeira da loja.' : '') };
  }

}

module.exports = { ORDER_STATUS, OrderService };
