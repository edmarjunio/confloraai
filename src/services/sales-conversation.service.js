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
  constructor({ repository, agent, orders, catalog = null, intake = new OrderIntakeService(repository) }) {
    this.repository = repository;
    this.agent = agent;
    this.orders = orders;
    this.intake = intake;
    this.catalog = catalog;
    this.store = new PdvRepository(repository);
  }

  async save(phone, previous, patch) {
    return this.store.transaction(async tx => {
      await require('./automation-send-guard').assertTransactionAutomation(tx);
      const session = await tx.get('sessions', phone) || {};
      const { customerKeyFor, scopedId } = require('../agent/agent-store');
      const conversation = await tx.get('agent_conversations', scopedId('conflora', customerKeyFor('conflora', phone)));
      if (conversation?.automation === 'paused' || conversation?.assignedTo) throw require('./automation-send-guard').blocked();
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
    let products;
    if (this.catalog) {
      await this.catalog.refreshCatalog();
      const queries = items.map(item => toSingular(item.name || item.requestedName || ''));
      const ids = (this.catalog.rawItems || []).filter(raw => queries.some(query =>
        raw.id === items.find(item => item.productId === raw.id)?.productId || query.split(' ').filter(word => !['de', 'da', 'do'].includes(word))
          .every(word => toSingular(commercialProduct(raw).name + ' ' + (raw.searchAliases || []).join(' ')).split(' ').includes(word))))
        .map(raw => raw.id);
      if (ids.length > 150) throw Object.assign(new Error('Especifique melhor o produto.'), { status: 400 });
      products = ids.length ? await this.repository.getProductsByIds(ids) : [];
    } else products = await this.repository.getAllProducts();
    const inventory = await this.repository.getInventorySettings();
    return items.map(item => {
      const requestedName = String(item.name || item.requestedName || '').trim();
      if (require('./meta-catalog-sync.service').restrictedCategory(requestedName) || /\b(rinha|trafico|sem licenca)\b/.test(normalizeText(requestedName))) return { requestedName, quantity: item.quantity ?? null, fulfillment: 'POLICY_REVIEW' };
      const quantity = item.quantity === null || item.quantity === undefined ? null : Number(item.quantity);
      if (!requestedName || requestedName.length > 120 || quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000)) {
        throw new Error('Me diga o produto e uma quantidade válida.');
      }
      const query = toSingular(requestedName);
      const exact = products.filter(row => toSingular(commercialProduct(row).name) === query ||
        (row.searchAliases || []).some(alias => toSingular(alias) === query));
      const words = query.split(' ').filter(word => !['de', 'da', 'do'].includes(word));
      const candidates = (item.productId ? products.filter(row => row.id === item.productId) : exact.length ? exact : products.filter(row => words.every(word => toSingular(commercialProduct(row).name).split(' ').includes(word))))
        .filter(row => item.productId || item.targetPrice === null || item.targetPrice === undefined || commercialProduct(row).price === item.targetPrice);
      if (candidates.length > 1) return { requestedName, quantity, fulfillment: 'CHOICE', choices: candidates.map(row => commercialProduct(row).name),
        choiceProducts: candidates.slice(0, 10).map(row => ({ id: row.id, name: commercialProduct(row).name, priceMinor: commercialProduct(row).priceMinor })) };
      const product = candidates[0] ? commercialProduct(candidates[0]) : null;
      const identified = product?.active && Number.isSafeInteger(product.priceMinor) && product.priceMinor >= 0;
      const available = identified && (inventory.stockControlEnabled === false || Number.isFinite(product.stockQuantity) &&
        Number.isFinite(product.reservedQuantity) && product.stockQuantity - product.reservedQuantity >= (quantity ?? product.saleUnit.minimum));
      if (available && quantity !== null) commercialLine(candidates[0], quantity);
      return { requestedName, quantity, productId: identified ? product.id : null, targetPrice: item.targetPrice ?? null, unit: product?.unit || 'UN',
        priceMinor: identified ? product.priceMinor : null, fulfillment: available ? 'IMMEDIATE' : 'PROCUREMENT',
        legalReview: identified ? 'CATALOG_PRODUCT' : 'PENDING' };
    });
  }

  async present(phone, state) {
    if (state.items.some(item => item.fulfillment === 'POLICY_REVIEW')) {
      await require('./conversation-automation').conversationAutomation(this.repository, phone, { pauseReason: 'commerce_policy_review_required', messageId: state.id });
      return { reply: '', intent: 'COMMERCE_POLICY_REVIEW' };
    }
    const choices = state.items.find(item => item.fulfillment === 'CHOICE');
    if (choices) return this.response(`Qual ${choices.requestedName}: ${(choices.choiceProducts || []).map(item => `${item.name} de ${formatCurrency(item.priceMinor / 100)}`).join(' ou ')}?`,
      (choices.choiceProducts || []).slice(0, 3).map(item => ({ id: `sales_variant:${item.id}:${state.version}`, title: `${item.name} ${formatCurrency(item.priceMinor / 100)}`.slice(0, 20) })));
    const missingQuantity = state.items.filter(item => item.quantity === null);
    if (missingQuantity.length) return this.response(`Qual a quantidade de ${missingQuantity.map(item => item.requestedName).join(' e ')}?`);
    const procurement = state.items.filter(item => item.fulfillment === 'PROCUREMENT');
    if (procurement.length) {
      state = await this.save(phone, state, { stage: 'PROCUREMENT_CONFIRMATION' });
      return this.response(`${summary(procurement)}. Podemos buscar por encomenda 🌱 Quer que a gente procure esse produto para você? Costuma chegar em até uma semana, sujeito à confirmação do fornecedor. Isso autoriza somente a procura, sem compra ou cobrança.${state.items.some(item => item.fulfillment === 'IMMEDIATE') ? ` Disponíveis: ${summary(state.items.filter(item => item.fulfillment === 'IMMEDIATE'))}.` : ''}`, [
        this.choice(state, 'yes', 'Quero encomendar'), this.choice(state, 'no', 'Agora não'),
      ]);
    }
    if (!state.items.length) return this.response('Me diga os produtos e as quantidades.');
    state = await this.save(phone, state, { stage: 'FULFILLMENT' });
    return this.advance(phone, state, {});
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

  async receiveMetaCart({ phone, commerceOrder, messageId }) {
    const session = await this.store.read('sessions', phone) || {};
    const previous = session.salesConversation;
    if (previous?.metaMessageId === messageId) return previous.stage === 'ORDER_CREATED' ? { ...this.response('Esse carrinho já foi registrado. O pagamento segue o estado oficial da comanda.'), orderId: previous.orderId } : this.present(phone, previous);
    if (previous?.items?.length && previous.stage !== 'ORDER_CREATED') {
      await require('./conversation-automation').conversationAutomation(this.repository, phone, { pauseReason: 'cart_conflicts_with_pending_context', messageId });
      return { reply: '', intent: 'CART_REQUIRES_HUMAN_REVIEW' };
    }
    const normalized = require('../integrations/whatsapp-inbound').normalizeOrder({ catalog_id: commerceOrder.catalogId,
      product_items: commerceOrder.items.map(item => ({ product_retailer_id: item.productId, quantity: item.quantity, currency: 'BRL' })) });
    const products = await this.repository.getProductsByIds(normalized.items.map(item => item.productId));
    if (products.length !== normalized.items.length) throw Object.assign(new Error('Produto do carrinho não encontrado no catálogo oficial.'), { requiresReconciliation: true });
    for (const product of products) if (!require('./meta-catalog-sync.service').eligibleForMeta(product)) throw Object.assign(new Error('Produto sem revisão comercial Meta.'), { requiresReconciliation: true });
    const items = await this.classify(normalized.items.map(item => ({ ...item, requestedName: commercialProduct(products.find(raw => raw.id === item.productId)).name })));
    const state = await this.save(phone, previous, { id: 'meta-' + createHash('sha256').update(phone + ':' + messageId).digest('hex').slice(0, 32),
      metaMessageId: messageId, stage: 'DISCOVERY', items, fulfillment: null, paymentMethod: null, address: '', confirmedDeliveryFeeMinor: null, deliveryFeeMinor: null });
    return this.present(phone, state);
  }

  async handle({ phone, message = '', interactiveId = '', customerName = '', messageId = '' }) {
    const session = await this.store.read('sessions', phone) || {};
    let state = session.salesConversation;
    if (messageId && state?.lastAppliedMessageId === messageId) return state.stage === 'ORDER_CREATED' ? { ...this.response('Pedido já registrado; pagamento conforme a comanda oficial.'), orderId: state.orderId } : this.present(phone, state);
    let input;
    if (interactiveId) {
      const variant = /^sales_variant:([a-zA-Z0-9_-]{1,180}):(\d+)$/.exec(interactiveId);
      if (variant && state && Number(variant[2]) === state.version) {
        const index = state.items.findIndex(item => item.fulfillment === 'CHOICE' && item.choiceProducts?.some(product => product.id === variant[1]));
        if (index >= 0) {
          const items = [...state.items];
          const selected = items[index].choiceProducts.find(product => product.id === variant[1]);
          items[index] = { requestedName: selected.name, productId: selected.id, quantity: items[index].quantity };
          state = await this.save(phone, state, { items: await this.classify(items), lastAppliedMessageId: messageId });
          return this.present(phone, state);
        }
      }
      const match = /^sales_(yes|no|pickup|delivery|pix|cash|credit|debit):(\d+)$/.exec(interactiveId);
      if (!match || !state || Number(match[2]) !== state.version) return this.response('Essa opção mudou. Confira o pedido atual.');
      const selected = match[1];
      input = { action: selected === 'yes' ? 'confirm' : selected === 'no' ? 'decline' : 'update', items: [],
        fulfillment: { pickup: 'PICKUP', delivery: 'DELIVERY' }[selected],
        paymentMethod: { pix: 'PIX', cash: 'DINHEIRO', credit: 'CREDITO', debit: 'DEBITO' }[selected] };
    } else {
      input = require('./sales-parser').parseSalesMessage(message, state);
      if (!input && typeof this.agent?.extractSalesIntent === 'function') {
        input = await this.agent.extractSalesIntent({ message, conversation: state ? {
        stage: state.stage, items: state.items.map(item => ({ name: item.requestedName, quantity: item.quantity })),
        } : { stage: 'DISCOVERY', items: [] } }).catch(() => null);
        // AI extracts language but never supplies consent/cancellation authority.
        if (input && ['confirm', 'decline', 'cancel'].includes(input.action)) {
          if (input.items?.length) input.action = 'update';
          else if (state?.stage === 'ORDER_CREATED') return { ...this.response('Pedido já registrado; pagamento conforme a comanda oficial.'), orderId: state.orderId };
          else if (state?.items?.length) return this.present(phone, state);
          else input = null;
        }
      }
      if (!input || !input.items?.length && !['confirm', 'decline', 'cancel'].includes(input.action) && !input.fulfillment && !input.paymentMethod && !input.address) {
        await require('./conversation-automation').conversationAutomation(this.repository, phone, { pauseReason: 'ambiguous_customer_needs_human', messageId });
        return { reply: '', intent: 'AMBIGUOUS_NEEDS_HUMAN' };
      }
    }
    if (input.action === 'cancel') {
      if (state?.stage === 'ORDER_CREATED' && state.orderId) return this.response('Para cancelar a comanda registrada, solicite a conferência da equipe.');
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
      if (input.items.length > 30) throw Object.assign(new Error('Envie até 30 itens por pedido.'), { status: 400 });
      const newOrder = state?.stage === 'ORDER_CREATED';
      const merged = new Map((newOrder ? [] : state?.items || []).map((item, index) => [`${normalizeText(item.requestedName)}:${item.productId || item.targetPrice || index}`, item]));
      for (const item of input.items) {
        item.quantity = item.quantity === undefined || item.quantity === null ? null : Number(item.quantity);
        if (item.quantity !== null && (!Number.isFinite(item.quantity) || item.quantity <= 0 || item.quantity > 10000)) throw Object.assign(new Error('Informe uma quantidade positiva válida.'), { status: 400 });
        const unresolved = [...merged.entries()].filter(([, row]) => row.fulfillment === 'CHOICE');
        if (unresolved.length === 1 && unresolved[0][1].choices.some(choice => toSingular(choice) === toSingular(item.name))) {
          const [oldKey, oldItem] = unresolved[0];
          merged.delete(oldKey);
          if (item.quantity === null) item.quantity = oldItem.quantity;
        }
        const matches = [...merged.entries()].filter(([, row]) => toSingular(row.requestedName) === toSingular(item.name) &&
          (item.targetPrice === null || item.targetPrice === undefined || row.targetPrice === item.targetPrice || row.priceMinor === Math.round(item.targetPrice * 100)));
        if (matches.length > 1) return this.response(`Qual opção de ${item.name} deseja alterar: ${matches.map(([, row]) => formatCurrency(row.priceMinor / 100)).join(' ou ')}? Informe o produto e o valor da opção.`);
        const key = matches[0]?.[0] || `${normalizeText(item.name)}:price:${item.targetPrice ?? 'unspecified'}`;
        const previous = merged.get(key);
        if (['add', 'remove'].includes(item.operation) && !Number.isFinite(item.quantity)) return this.response(`Qual a quantidade de ${item.name}?`);
        if (item.operation === 'remove' && !previous) return this.response(`${item.name} não está no resumo atual. Qual item deseja retirar?`);
        const quantity = item.operation === 'add' ? Number(previous?.quantity || 0) + item.quantity : item.operation === 'remove' ? Number(previous.quantity) - item.quantity : item.quantity;
        if (quantity !== null && quantity <= 0) merged.delete(key);
        else merged.set(key, { requestedName: item.name, quantity, ...(previous?.productId && (item.targetPrice === null || item.targetPrice === undefined || previous.priceMinor === Math.round(item.targetPrice * 100)) ? { productId: previous.productId } : {}), targetPrice: item.targetPrice ?? previous?.targetPrice ?? null });
      }
      state = await this.save(phone, state, { ...(newOrder ? { id: randomUUID(), orderId: null, fulfillment: null, paymentMethod: null, address: '', confirmedDeliveryFeeMinor: null, deliveryFeeMinor: null } : {}),
        ...details, lastAppliedMessageId: messageId, stage: 'DISCOVERY', items: await this.classify([...merged.values()]) });
      return this.present(phone, state);
    }
    if (!state?.items?.length) {
      if (Object.keys(details).length) await this.save(phone, state, details);
      return this.response('Me diga os produtos e as quantidades.');
    }
    if (state.stage === 'PROCUREMENT_CONFIRMATION' && ['confirm', 'decline'].includes(input.action)) {
      const fresh = await this.classify(state.items);
      if (fresh.some((item, index) => item.fulfillment !== state.items[index].fulfillment)) {
        state = await this.save(phone, state, { items: fresh });
        return this.present(phone, state);
      }
      if (input.action === 'confirm') await this.registerProcurement(phone, state, customerName);
      const items = fresh.filter(item => item.fulfillment === 'IMMEDIATE');
      state = await this.save(phone, state, { items, stage: 'DISCOVERY' });
      if (!items.length) return this.response(input.action === 'confirm' ? 'Solicitação de procura registrada, sem compra ou cobrança. A equipe enviará cotação e condições para seu aceite.' : 'Certo. Precisa de mais algum produto?');
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
    return this.advance(phone, state, input, customerName);
  }

  async advance(phone, state, input, customerName = '') {
    if (state.stage === 'FINAL_CONFIRMATION' && input.action === 'decline') {
      await this.save(phone, state, { stage: 'DISCOVERY' });
      return this.response('Qual item ou dado deseja alterar?');
    }
    if (['FULFILLMENT', 'ADDRESS', 'DELIVERY_CONFIRMATION', 'PAYMENT', 'FINAL_CONFIRMATION'].includes(state.stage)) {
      const delivery = await this.orders.getDeliveryOptions();
      if (!state.fulfillment) return this.response(`${state.items.map(item => `${item.quantity} ${item.requestedName}: ${formatCurrency(item.priceMinor * item.quantity / 100)}`).join('; ')}. Total: ${formatCurrency(total(state.items) / 100)}. ${delivery.enabled ? 'Entrega ou retirada?' : 'Pode retirar na loja?'}`, [
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
      if (state.stage !== 'FINAL_CONFIRMATION' || input.action !== 'confirm') {
        state = await this.save(phone, state, { stage: 'FINAL_CONFIRMATION' });
        return this.response(`${summary(state.items)}. ${state.fulfillment === 'DELIVERY' ? `Entrega em ${state.address}. Taxa: ${formatCurrency(state.confirmedDeliveryFeeMinor / 100)}.` : 'Retirada na loja.'} Pagamento: ${state.paymentMethod}, pendente. Total: ${formatCurrency((total(state.items) + (state.fulfillment === 'DELIVERY' ? state.confirmedDeliveryFeeMinor : 0)) / 100)}. Confirma a criação da comanda?`, [this.choice(state, 'yes', 'Confirmar pedido'), this.choice(state, 'no', 'Alterar pedido')]);
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
