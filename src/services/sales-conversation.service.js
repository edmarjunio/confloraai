const { randomUUID, createHash } = require('node:crypto');
const { PdvRepository } = require('../orders/pdv.repository');
const { commercialProduct, commercialLine } = require('../catalog/commercial-product');
const { normalizeText, toSingular, formatCurrency } = require('../shared/string.util');
const { OrderIntakeService } = require('./order-intake.service');

const unavailable = () => Object.assign(new Error('O pedido mudou. Confira os itens antes de confirmar.'), { status: 409 });
const summary = items => items.map(item => `${item.quantity ?? '?'} ${item.requestedName}`).join(', ');
const total = items => items.reduce((sum, item) => sum + Math.round(item.priceMinor * item.quantity), 0);

/** Short sales funnel. AI extracts language; Firestore decides identity, stock, prices and payment. */
class SalesConversationService {
  constructor({ repository, agent, orders, intake = new OrderIntakeService(repository) }) {
    this.repository = repository;
    this.agent = agent;
    this.orders = orders;
    this.intake = intake;
    this.store = new PdvRepository(repository);
  }

  async save(phone, previous, patch) {
    return this.store.transaction(async tx => {
      const session = await tx.get('sessions', phone) || {};
      if (session.salesConversation?.version !== previous?.version) throw unavailable();
      const next = { ...(previous || { id: randomUUID(), stage: 'DISCOVERY', items: [] }), ...patch,
        version: Number(previous?.version || 0) + 1, updatedAt: new Date().toISOString() };
      tx.set('sessions', phone, { ...session, salesConversation: next });
      return next;
    });
  }

  response(reply, buttons = []) { return { reply, buttons, intent: 'SALES_AGENT' }; }
  choice(state, name, title) { return { id: `sales_${name}:${state.version}`, title }; }

  async classify(items) {
    const [products, inventory] = await Promise.all([this.repository.getAllProducts(), this.repository.getInventorySettings()]);
    return items.map(item => {
      const requestedName = String(item.name || item.requestedName || '').trim();
      const quantity = item.quantity === null || item.quantity === undefined ? null : Number(item.quantity);
      if (!requestedName || requestedName.length > 120 || quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000)) {
        throw new Error('Me diga o produto e uma quantidade válida.');
      }
      const query = toSingular(requestedName);
      const exact = products.filter(row => toSingular(commercialProduct(row).name) === query ||
        (row.searchAliases || []).some(alias => toSingular(alias) === query));
      const words = query.split(' ').filter(word => !['de', 'da', 'do'].includes(word));
      const candidates = exact.length ? exact : products.filter(row => words.every(word => toSingular(commercialProduct(row).name).split(' ').includes(word)));
      if (candidates.length > 1) return { requestedName, quantity, fulfillment: 'CHOICE', choices: candidates.map(row => commercialProduct(row).name).slice(0, 3) };
      const product = candidates[0] ? commercialProduct(candidates[0]) : null;
      const identified = product?.active && Number.isSafeInteger(product.priceMinor) && product.priceMinor >= 0;
      const available = identified && (inventory.stockControlEnabled === false || Number.isFinite(product.stockQuantity) &&
        Number.isFinite(product.reservedQuantity) && product.stockQuantity - product.reservedQuantity >= (quantity ?? product.saleUnit.minimum));
      if (available && quantity !== null) commercialLine(candidates[0], quantity);
      return { requestedName, quantity, productId: identified ? product.id : null, unit: product?.unit || 'UN',
        priceMinor: identified ? product.priceMinor : null, fulfillment: available ? 'IMMEDIATE' : 'PROCUREMENT',
        legalReview: identified ? 'CATALOG_PRODUCT' : 'PENDING' };
    });
  }

  async present(phone, state) {
    const choices = state.items.find(item => item.fulfillment === 'CHOICE');
    if (choices) return this.response(`Qual ${choices.requestedName}: ${choices.choices.join(' ou ')}?`);
    const missingQuantity = state.items.filter(item => item.quantity === null);
    if (missingQuantity.length) return this.response(`Qual a quantidade de ${missingQuantity.map(item => item.requestedName).join(' e ')}?`);
    const procurement = state.items.filter(item => item.fulfillment === 'PROCUREMENT');
    if (procurement.length) {
      state = await this.save(phone, state, { stage: 'PROCUREMENT_CONFIRMATION' });
      return this.response(`${summary(procurement)}: não temos no momento. Podemos tentar conseguir em alguns dias. Quer encomendar?`, [
        this.choice(state, 'yes', 'Quero encomendar'), this.choice(state, 'no', 'Agora não'),
      ]);
    }
    if (!state.items.length) return this.response('Me diga os produtos e as quantidades.');
    state = await this.save(phone, state, { stage: 'SALE_CONFIRMATION' });
    return this.response(`${summary(state.items)}. Total: ${formatCurrency(total(state.items) / 100)}. Posso fechar?`, [
      this.choice(state, 'yes', 'Pode fechar'), this.choice(state, 'no', 'Alterar pedido'),
    ]);
  }

  async registerProcurement(phone, state, customerName) {
    const missing = state.items.filter(item => item.fulfillment === 'PROCUREMENT');
    const fingerprint = missing.map(item => [normalizeText(item.requestedName), item.quantity]);
    const id = 'request-' + createHash('sha256').update(state.id + ':procurement:' + JSON.stringify(fingerprint)).digest('hex').slice(0, 32);
    const session = await this.store.read('sessions', phone) || {};
    const previous = session.orderIntake;
    const draft = previous?.id === id ? previous : await this.intake.changeDraft(phone, previous, {
      id, status: 'AWAITING_CONFIRMATION', items: missing, createdAt: new Date().toISOString(),
    });
    return this.intake.register(phone, draft, { messageId: state.id, customerName });
  }

  async startCart(phone, fulfillment) {
    const draft = await this.repository.getOrder(phone);
    if (!draft?.items?.length || draft.status !== 'AWAITING_CONFIRMATION') return this.response('Sua sacola está vazia. Escolha os produtos primeiro.');
    const session = await this.store.read('sessions', phone) || {};
    const state = await this.save(phone, session.salesConversation, { id: randomUUID(), stage: 'DISCOVERY',
      items: await this.classify(draft.items.map(item => ({ requestedName: item.name, quantity: item.quantity }))),
      fulfillment, paymentMethod: null, address: '', confirmedDeliveryFeeMinor: null, deliveryFeeMinor: null });
    return this.present(phone, state);
  }

  async handle({ phone, message = '', interactiveId = '', customerName = '' }) {
    const session = await this.store.read('sessions', phone) || {};
    let state = session.salesConversation;
    let input;
    if (interactiveId) {
      const match = /^sales_(yes|no|pickup|delivery|pix|cash|credit|debit):(\d+)$/.exec(interactiveId);
      if (!match || !state || Number(match[2]) !== state.version) return this.response('Essa opção mudou. Confira o pedido atual.');
      const selected = match[1];
      input = { action: selected === 'yes' ? 'confirm' : selected === 'no' ? 'decline' : 'update', items: [],
        fulfillment: { pickup: 'PICKUP', delivery: 'DELIVERY' }[selected],
        paymentMethod: { pix: 'PIX', cash: 'DINHEIRO', credit: 'CREDITO', debit: 'DEBITO' }[selected] };
    } else {
      input = await this.agent.extractSalesIntent({ message, conversation: state ? {
        stage: state.stage, items: state.items.map(item => ({ name: item.requestedName, quantity: item.quantity })),
      } : { stage: 'DISCOVERY', items: [] } });
    }
    if (input.action === 'cancel') {
      if (state?.stage === 'ORDER_CREATED' && state.orderId) await this.repository.cancelOrder(state.orderId, 'Cancelamento solicitado pelo cliente no WhatsApp.');
      await this.save(phone, state, { id: randomUUID(), stage: 'DISCOVERY', items: [], fulfillment: null, paymentMethod: null, address: '',
        confirmedDeliveryFeeMinor: null, deliveryFeeMinor: null });
      return this.response('Certo. Me diga o que deseja comprar.');
    }
    if (state?.stage === 'ORDER_CREATED' && !input.items?.length) return this.response('Pedido registrado. Você pode acompanhar pelo recibo enviado.');
    const details = {};
    if (['PICKUP', 'DELIVERY'].includes(input.fulfillment)) details.fulfillment = input.fulfillment;
    if (['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'].includes(input.paymentMethod)) details.paymentMethod = input.paymentMethod;
    if (typeof input.address === 'string' && input.address.trim().length >= 8 && input.address.length <= 500) details.address = input.address.trim();
    if (input.items?.length) {
      const newOrder = state?.stage === 'ORDER_CREATED';
      const merged = new Map((newOrder ? [] : state?.items || []).map(item => [normalizeText(item.requestedName), item]));
      for (const item of input.items) merged.set(normalizeText(item.name), { requestedName: item.name, quantity: item.quantity });
      state = await this.save(phone, state, { ...(newOrder ? { id: randomUUID(), orderId: null, fulfillment: null, paymentMethod: null, address: '', confirmedDeliveryFeeMinor: null, deliveryFeeMinor: null } : {}),
        ...details, stage: 'DISCOVERY', items: await this.classify([...merged.values()]) });
      return this.present(phone, state);
    }
    if (!state?.items?.length) return this.response('Me diga os produtos e as quantidades.');
    if (state.stage === 'PROCUREMENT_CONFIRMATION' && ['confirm', 'decline'].includes(input.action)) {
      const fresh = await this.classify(state.items);
      if (fresh.some((item, index) => item.fulfillment !== state.items[index].fulfillment)) {
        state = await this.save(phone, state, { items: fresh });
        return this.present(phone, state);
      }
      if (input.action === 'confirm') await this.registerProcurement(phone, state, customerName);
      const items = fresh.filter(item => item.fulfillment === 'IMMEDIATE');
      state = await this.save(phone, state, { items, stage: 'DISCOVERY' });
      if (!items.length) return this.response(input.action === 'confirm' ? 'Encomenda registrada. Avisaremos quando houver previsão e valor.' : 'Certo. Precisa de mais algum produto?');
      const next = await this.present(phone, state);
      if (input.action === 'confirm') next.reply = 'Encomenda registrada. ' + next.reply;
      return next;
    }
    if (state.stage === 'SALE_CONFIRMATION') {
      if (input.action === 'decline') {
        await this.save(phone, state, { stage: 'DISCOVERY' });
        return this.response('O que você quer alterar?');
      }
      if (input.action !== 'confirm') return this.response('Posso fechar os itens acima?');
      const fresh = await this.classify(state.items);
      if (fresh.some((item, index) => item.fulfillment !== 'IMMEDIATE' || item.priceMinor !== state.items[index].priceMinor)) {
        state = await this.save(phone, state, { items: fresh });
        return this.present(phone, state);
      }
      state = await this.save(phone, state, { ...details, stage: 'FULFILLMENT' });
    } else if (Object.keys(details).length) state = await this.save(phone, state, details);
    if (['FULFILLMENT', 'ADDRESS', 'DELIVERY_CONFIRMATION', 'PAYMENT'].includes(state.stage)) {
      const delivery = await this.orders.getDeliveryOptions();
      if (!state.fulfillment) return this.response(delivery.enabled ? 'Entrega ou retirada?' : 'Pode retirar na loja?', [
        this.choice(state, 'pickup', 'Retirada'), ...(delivery.enabled ? [this.choice(state, 'delivery', 'Entrega')] : [])]);
      if (state.fulfillment === 'DELIVERY' && !delivery.enabled) {
        state = await this.save(phone, state, { fulfillment: null, stage: 'FULFILLMENT' });
        return this.response('A entrega está indisponível. Pode retirar na loja?', [this.choice(state, 'pickup', 'Retirada')]);
      }
      if (state.fulfillment === 'DELIVERY' && !state.address) {
        state = await this.save(phone, state, { stage: 'ADDRESS' });
        return this.response('Qual o endereço completo, com número e bairro?');
      }
      if (state.fulfillment === 'DELIVERY' && state.confirmedDeliveryFeeMinor !== delivery.feeMinor) {
        if (state.stage === 'DELIVERY_CONFIRMATION' && input.action === 'confirm' && state.deliveryFeeMinor === delivery.feeMinor) {
          state = await this.save(phone, state, { confirmedDeliveryFeeMinor: delivery.feeMinor, stage: 'PAYMENT' });
        } else {
          state = await this.save(phone, state, { stage: 'DELIVERY_CONFIRMATION', deliveryFeeMinor: delivery.feeMinor });
          return this.response(`Entrega: ${formatCurrency(delivery.feeMinor / 100)}. Total: ${formatCurrency((total(state.items) + delivery.feeMinor) / 100)}. Pode confirmar?`, [
            this.choice(state, 'yes', 'Confirmar entrega'), this.choice(state, 'pickup', 'Prefiro retirar')]);
        }
      }
      if (!state.paymentMethod) {
        state = await this.save(phone, state, { stage: 'PAYMENT' });
        return this.response('Como prefere pagar?', [this.choice(state, 'pix', 'Pix'), this.choice(state, 'cash', 'Dinheiro'), this.choice(state, 'credit', 'Cartão')]);
      }
      const fresh = await this.classify(state.items);
      if (fresh.some((item, index) => item.fulfillment !== 'IMMEDIATE' || item.priceMinor !== state.items[index].priceMinor)) {
        state = await this.save(phone, state, { items: fresh, stage: 'DISCOVERY' });
        return this.present(phone, state);
      }
      const products = new Map((await this.repository.getProductsByIds(fresh.map(item => item.productId))).map(product => [product.id, product]));
      await this.orders.createPendingOrder(phone, fresh.map(item => ({ product: products.get(item.productId), quantity: item.quantity })), null, state.id);
      await this.orders.updateOrderDetails(phone, { orderType: state.fulfillment, deliveryAddress: state.address || '', paymentMethod: state.paymentMethod,
        confirmedDeliveryFeeMinor: state.fulfillment === 'DELIVERY' ? state.confirmedDeliveryFeeMinor : 0 });
      const result = await this.orders.confirmOrder(phone, customerName);
      if (!result?.order?.id || result.order.status === 'AWAITING_CONFIRMATION') throw new Error('Não foi possível concluir o pedido. Confira os dados.');
      await this.save(phone, state, { stage: 'ORDER_CREATED', orderId: result.order.id });
      return { ...this.response(result.reply), orderId: result.order.id };
    }
    return this.present(phone, state);
  }
}

module.exports = { SalesConversationService };
