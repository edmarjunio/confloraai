const { PdvRepository } = require('../orders/pdv.repository');
const { payableTotal, procurementOrder } = require('../orders/procurement-payment');
const { requireManualProof } = require('../orders/payment-proof');
const { commercialLine } = require('../catalog/commercial-product');
const { prepareStockReservation, applyStockReservation } = require('../orders/stock-reservation');
const { normalizeText, formatCurrency } = require('../shared/string.util');

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const yes = text => /^(?:sim(?: pode (?:confirmar|registrar))?|confirmo|confirmar|pode confirmar|pode registrar|pode sim|isso|correto|certo|ok|fechado|pode ser)[.!\s]*$/.test(normalizeText(text));
const no = text => /^(?:nao|nao quero|cancela|cancelar|outro|outro endereco|quero mudar|mudar endereco)[.!\s]*$/.test(normalizeText(text));
const activeQuestions = new Set(['QUOTE_CONFIRMATION', 'FULFILLMENT_CHOICE', 'ADDRESS_REQUIRED', 'ADDRESS_CONFIRMATION']);
const money = minor => formatCurrency(minor / 100);
const dateLabel = date => date.split('-').reverse().join('/');
const staffActor = actor => {
  if (!actor?.id || !['ADMIN', 'CAIXA'].includes(actor.role)) throw fail('Somente caixa ou administrador pode confirmar a encomenda.', 403);
  return { id: actor.id, name: actor.name || actor.email || actor.id, role: actor.role };
};
const validateId = id => { if (!/^request-[a-f0-9]{32}$/.test(id)) throw fail('Comanda inválida.'); };
const expectedVersion = (request, input) => {
  if (!request || request.kind !== 'ORDER_REQUEST' || request.tenantId !== 'conflora') throw fail('Encomenda não encontrada.', 404);
  if (!Number.isSafeInteger(input.version) || request.version !== input.version || request.status !== 'open') throw fail('A encomenda mudou. Atualize a comanda.', 409);
};

class ProcurementWorkflowService {
  constructor(repository, { notify = null, pdv = null, now = () => new Date() } = {}) {
    this.repository = repository; this.store = new PdvRepository(repository);
    this.notify = notify; this.pdv = pdv; this.now = now;
  }

  bind(session, request, stage, extra = {}) {
    const previous = session.procurementConversation;
    if (previous && previous.requestId !== request.id && activeQuestions.has(previous.stage)) throw fail('O cliente ainda precisa responder à outra encomenda. Conclua essa confirmação primeiro.', 409);
    return { ...session, procurementConversation: { requestId: request.id, quoteVersion: request.quoteVersion || 0, stage, ...extra } };
  }

  event(request, event, text) {
    return { id: `${request.id}-${event}-${request.version}`, requestId: request.id, kind: 'order-request-event', event,
      text, recipient: request.customerPhone, status: 'PENDING', attempts: 0, createdAt: this.now().toISOString() };
  }

  async flush(jobs) { if (this.notify) await Promise.allSettled(jobs.map(job => this.notify(job.id))); }

  async quote(id, input, actor) {
    validateId(id); const operator = staffActor(actor);
    if (input.confirmed !== true || !Array.isArray(input.items) || !input.items.length || input.items.length > 20) throw fail('Confirme os valores e as datas dos itens.');
    const result = await this.store.transaction(async tx => {
      const request = await tx.get('agent_handoffs', id);
      expectedVersion(request, input);
      if (!['AWAITING_QUOTE', 'FORECAST_CONFIRMED', 'AWAITING_CUSTOMER'].includes(request.requestStatus) || request.acceptedAt) throw fail('A cotação já foi aceita ou encerrada.', 409);
      if (input.items.length !== request.items.length || input.commercializationAllowed !== true) throw fail('Confira todos os itens e a comercialização permitida.');
      const order = await tx.get('orders', id) || procurementOrder(request);
      if (order.status === 'CANCELLED' || order.completedAt || order.procurement?.deposit) throw fail('Comanda encerrada ou com sinal já recebido.', 409);
      const session = await tx.get('sessions', request.customerPhone) || {};
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(this.now());
      const items = [];
      for (let index = 0; index < request.items.length; index++) {
        const item = request.items[index], proposed = input.items[index];
        const price = proposed?.unitPriceMinor, date = String(proposed?.arrivalDate || '');
        if (!Number.isSafeInteger(price) || price <= 0 || price > 100000000 || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            Number.isNaN(Date.parse(date + 'T12:00:00Z')) || new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) !== date || date < today) throw fail('Informe valor em centavos e data de chegada válida para cada item.');
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw fail('Confirme a quantidade de todos os itens.');
        const productId = proposed.productId || item.productId || null;
        if (productId && (!/^[\w-]{1,128}$/.test(productId) || !await tx.get('products', productId))) throw fail('Produto vinculado não encontrado.');
        const subtotalMinor = Math.round(price * item.quantity);
        if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor <= 0) throw fail('Subtotal inválido.');
        items.push({ ...item, productId, priceMinor: price, unitPriceMinor: price, subtotalMinor, arrivalDate: date });
      }
      const totalMinor = items.reduce((sum, item) => sum + item.subtotalMinor, 0);
      if (!Number.isSafeInteger(totalMinor) || totalMinor < 2 || totalMinor > 100000000) throw fail('Total da encomenda inválido.');
      const now = this.now().toISOString();
      const updated = { ...request, items, total: totalMinor / 100, totalMinor, depositRequiredMinor: Math.ceil(totalMinor / 2),
        requestStatus: 'AWAITING_CUSTOMER', quoteVersion: (request.quoteVersion || 0) + 1, version: request.version + 1,
        quotedBy: operator, quotedAt: now, commercializationAllowed: true, updatedAt: now };
      const lines = items.map(item => `${item.quantity} ${item.requestedName}: ${money(item.subtotalMinor)}; chega ${dateLabel(item.arrivalDate)}.`);
      const text = `Encontramos sua encomenda!\n${lines.join('\n')}\nTotal: ${money(totalMinor)}. Sinal de 50%: ${money(updated.depositRequiredMinor)} agora; restante de ${money(totalMinor - updated.depositRequiredMinor)} na retirada ou entrega. Podemos confirmar?`;
      const job = { ...this.event(updated, 'quote', text), quoteVersion: updated.quoteVersion };
      const nextSession = this.bind(session, updated, 'QUOTE_CONFIRMATION');
      tx.set('agent_handoffs', id, updated);
      tx.set('orders', id, { ...order, items: this.saleItems(items), total: updated.total, subtotal: updated.total, status: 'AWAITING_QUOTE_ACCEPTANCE',
        procurement: { ...order.procurement, stage: 'AWAITING_CUSTOMER', quoteVersion: updated.quoteVersion, depositRequiredMinor: updated.depositRequiredMinor }, updatedAt: now });
      tx.set('sessions', request.customerPhone, nextSession);
      tx.set('pdv_outbox', job.id, job);
      return { request: updated, jobs: [job] };
    });
    await this.flush(result.jobs); return result.request;
  }

  saleItems(items) {
    return items.map(item => ({ ...item, name: item.requestedName, unit: item.unit || 'UN',
      price: item.unitPriceMinor / 100, subtotal: item.subtotalMinor / 100 }));
  }

  async receiveDeposit(id, input, actor) {
    validateId(id); const operator = staffActor(actor);
    const method = String(input.paymentMethod || '').toUpperCase();
    if (!['DINHEIRO', 'DEBITO', 'CREDITO', 'PIX'].includes(method) || input.received !== true) throw fail('Confirme o recebimento efetivo do sinal e a forma de pagamento.');
    const result = await this.store.transaction(async tx => {
      const request = await tx.get('agent_handoffs', id);
      const order = await tx.get('orders', id);
      if (order?.procurement?.deposit) {
        if (order.procurement.deposit.amountMinor !== input.amountMinor || order.procurement.deposit.method !== method) throw fail('Sinal já registrado com outros dados.', 409);
        return { request, order, jobs: [] };
      }
      expectedVersion(request, input);
      if (!request.acceptedAt || request.requestStatus !== 'AWAITING_ARRIVAL' || order?.status !== 'AWAITING_ARRIVAL') throw fail('Aguarde o aceite da cotação pelo cliente.');
      if (input.amountMinor !== request.depositRequiredMinor) throw fail('O sinal deve corresponder exatamente aos 50% informados na cotação.');
      const verification = { manualPixProofId: input.proofId };
      if (method === 'PIX' && (input.proofSeen !== true || String(input.note || '').trim().length < 8)) throw fail('Confira o crédito na conta, anexe o comprovante e registre uma observação.');
      const proof = method === 'PIX' ? await requireManualProof(tx, verification, operator, 'ORDER', id) : null;
      const now = this.now().toISOString();
      const deposit = { amountMinor: input.amountMinor, method, receivedBy: operator, receivedAt: now,
        verifiedVia: method === 'PIX' ? 'MANUAL_CAIXA_PIX' : 'CAIXA', ...(proof ? { proof, note: String(input.note).trim().slice(0, 500) } : {}) };
      const updated = { ...request, deposit, version: request.version + 1, updatedAt: now };
      const saved = { ...order, procurement: { ...order.procurement, deposit }, paymentStatus: 'PARTIAL', amountDue: (request.totalMinor - deposit.amountMinor) / 100, updatedAt: now };
      const settlementId = `${id}-deposit`;
      const job = this.event(updated, 'deposit', `Sinal de ${money(deposit.amountMinor)} confirmado! Restante: ${money(request.totalMinor - deposit.amountMinor)} na retirada ou entrega. Avisaremos quando chegar.`);
      tx.set('agent_handoffs', id, updated); tx.set('orders', id, saved);
      tx.set('debt_settlements', settlementId, { id: settlementId, orderId: id, customerKey: order.customerId || request.customerPhone,
        customerName: request.customerName, customerPhone: request.customerPhone, amount: deposit.amountMinor / 100,
        paymentMethod: method, paymentParts: [{ method, amount: deposit.amountMinor / 100 }], receivedBy: operator,
        entryType: 'ENCOMENDA_SINAL', type: 'ENCOMENDA_SINAL', createdAt: now, settledAt: now,
        ...(proof ? { manualPixProof: proof, verifiedVia: deposit.verifiedVia, manualPixNote: deposit.note } : {}) });
      tx.set('pdv_outbox', job.id, job);
      return { request: updated, order: saved, jobs: [job] };
    });
    await this.flush(result.jobs); return { request: result.request, order: result.order };
  }

  async arrive(id, input, actor) {
    validateId(id); const operator = staffActor(actor);
    if (input.confirmed !== true) throw fail('Confirme que todos os itens chegaram e foram conferidos.');
    const result = await this.store.transaction(async tx => {
      const request = await tx.get('agent_handoffs', id);
      const order = await tx.get('orders', id);
      if (order?.procurement?.arrivedAt) return { request, order, jobs: [] };
      expectedVersion(request, input);
      if (!request.acceptedAt || !order?.procurement?.deposit?.receivedAt || order.status !== 'AWAITING_ARRIVAL') throw fail('Confirme o aceite do cliente e o recebimento do sinal antes da chegada.');
      const session = await tx.get('sessions', request.customerPhone) || {};
      const items = [];
      const records = new Map();
      for (let index = 0; index < request.items.length; index++) {
        const item = request.items[index];
        const productId = String(input.items?.[index]?.productId || item.productId || '');
        if (!/^[\w-]{1,128}$/.test(productId)) throw fail('Vincule cada item ao produto cadastrado e registre a entrada no estoque.');
        const product = records.get(productId) || await tx.get('products', productId);
        if (!product) throw fail('Produto de chegada não encontrado no catálogo.');
        commercialLine({ ...product, id: productId }, item.quantity);
        records.set(productId, product); items.push({ ...item, productId });
      }
      const reservation = await prepareStockReservation(tx, items, records);
      const now = this.now().toISOString();
      const updated = { ...request, items, requestStatus: 'READY', arrivedAt: now, arrivedBy: operator, version: request.version + 1, updatedAt: now };
      const nextSession = this.bind(session, updated, 'FULFILLMENT_CHOICE');
      const saved = { ...order, items: this.saleItems(items), procurement: { ...order.procurement, stage: 'READY', arrivedAt: now, arrivedBy: operator },
        status: 'AWAITING_FULFILLMENT', inventoryReserved: !reservation.trackingDisabled, reservedItems: reservation.reservedItems, updatedAt: now };
      const job = this.event(updated, 'arrival', 'Sua encomenda já está disponível na loja! Prefere entrega ou retirada?');
      applyStockReservation(tx, reservation, now);
      tx.set('agent_handoffs', id, updated); tx.set('orders', id, saved);
      tx.set('sessions', request.customerPhone, nextSession); tx.set('pdv_outbox', job.id, job);
      return { request: updated, order: saved, jobs: [job] };
    });
    await this.flush(result.jobs); return { request: result.request, order: result.order };
  }

  async customerProfile(phone) {
    const direct = await this.store.read('customers', phone);
    if (direct) return { ...direct, id: phone };
    const matches = new Map();
    for (const field of ['phoneDigits', 'phone']) {
      const db = this.repository.firestore;
      const rows = db && !this.repository._firestoreClientDisabled
        ? (await db.collection('customers').where(field, '==', phone).limit(2).get()).docs.map(doc => ({ ...doc.data(), id: doc.id }))
        : [...(this.repository.inMemoryCustomers?.values() || [])].filter(row => row[field] === phone).slice(0, 2);
      for (const row of rows) matches.set(row.id, row);
    }
    return matches.size === 1 ? [...matches.values()][0] : null;
  }

  async reply({ phone, message, session: knownSession }) {
    const text = String(message || '').trim(), normalized = normalizeText(text);
    const snapshot = knownSession || await this.store.read('sessions', phone);
    const conversation = snapshot?.procurementConversation;
    if (!conversation || conversation.stage === 'CLOSED') return null;
    if (snapshot.orderIntake?.status === 'AWAITING_CONFIRMATION' && snapshot.orderIntake.id !== conversation.requestId && !activeQuestions.has(conversation.stage)) return null;
    const request = await this.store.read('agent_handoffs', conversation.requestId);
    const order = await this.store.read('orders', conversation.requestId);
    if (!request || !order || request.customerPhone !== phone || order.status === 'CANCELLED' || order.completedAt) return null;
    const affirmative = yes(text), negative = no(text);
    const delivery = /^(?:entrega|entregar|quero (?:a )?entrega|prefiro (?:a )?entrega|pode entregar|entrega por favor)[.!\s]*$/.test(normalized);
    const pickup = /^(?:retirada|retirar|quero retirar|prefiro retirar|vou (?:ai |a loja )?(?:buscar|retirar)|busco na loja)[.!\s]*$/.test(normalized);
    if (activeQuestions.has(conversation.stage) && /^(?:quero|vou querer|preciso de|gostaria de)\s+\d/.test(normalized)) {
      return { reply: conversation.stage === 'QUOTE_CONFIRMATION' ? 'Antes, confirma a cotação enviada ou prefere cancelar?' : 'Antes, vamos confirmar a entrega ou retirada da encomenda que já chegou?', intent: 'PROCUREMENT_CURRENT_CONFIRMATION_REQUIRED' };
    }
    const arrivalQuestion = /\b(?:quando chega|previsao|prazo|quando vai chegar)\b/.test(normalized);
    if (arrivalQuestion && request.items.every(item => item.arrivalDate)) return { reply: request.items.map(item => `${item.requestedName}: ${dateLabel(item.arrivalDate)}.`).join(' '), intent: 'PROCUREMENT_ARRIVAL_DATE' };
    if (/^(?:quanto|qual o valor|qual o preco|e o valor|e o preco|preco|valor)\b/.test(normalized) && request.totalMinor) return { reply: `Total: ${money(request.totalMinor)}. Sinal: ${money(request.depositRequiredMinor)}; restante: ${money(request.totalMinor - request.depositRequiredMinor)}.`, intent: 'PROCUREMENT_PRICE' };
    if (conversation.stage === 'WAITING_ARRIVAL') {
      if (affirmative || /^(?:paguei|ja paguei|fiz o pix|enviei o pix)[.!\s]*$/.test(normalized)) return { reply: order.procurement.deposit ? 'Sinal confirmado! Avisaremos quando sua encomenda chegar.' : `Sinal de ${money(request.depositRequiredMinor)} aguardando conferência da loja.`, intent: 'PROCUREMENT_WAITING_ARRIVAL' };
      return null;
    }
    if (conversation.stage === 'PICKUP_CONFIRMED' || conversation.stage === 'DELIVERY_CONFIRMED') {
      if (affirmative || pickup || delivery) return { reply: conversation.stage === 'PICKUP_CONFIRMED' ? 'Combinado, estamos te esperando aqui!' : 'Seu endereço já está confirmado. Aguardando entregador.', intent: 'PROCUREMENT_FULFILLMENT_CONFIRMED' };
      return null;
    }
    if (conversation.stage === 'QUOTE_CONFIRMATION' && !affirmative && !negative) return null;
    if (conversation.stage === 'FULFILLMENT_CHOICE' && !delivery && !pickup) {
      if (affirmative) return { reply: 'Prefere entrega ou retirada?', intent: 'PROCUREMENT_CHOOSE_FULFILLMENT' };
      return null;
    }
    let profile = null;
    if (delivery) profile = await this.customerProfile(phone);
    const result = await this.store.transaction(async tx => {
      const session = await tx.get('sessions', phone) || {};
      const current = await tx.get('agent_handoffs', request.id);
      const sale = await tx.get('orders', request.id);
      const context = session.procurementConversation;
      if (current?.version !== request.version || context?.stage !== conversation.stage || context?.requestId !== request.id || context.quoteVersion !== current.quoteVersion || !sale || sale.status === 'CANCELLED' || sale.completedAt) throw fail('A encomenda mudou. Confira a mensagem mais recente.', 409);
      const storedCustomer = profile ? await tx.get('customers', profile.id) : null;
      const customer = storedCustomer && (profile.id === phone || String(storedCustomer.phoneDigits || storedCustomer.phone || '').replace(/\D/g, '') === phone) ? storedCustomer : null;
      const now = this.now().toISOString();
      let nextStage = context.stage, reply, updated = { ...current, version: current.version + 1, updatedAt: now }, saved = { ...sale, updatedAt: now };
      if (context.stage === 'QUOTE_CONFIRMATION') {
        if (affirmative) {
          nextStage = 'WAITING_ARRIVAL';
          updated = { ...updated, acceptedAt: now, acceptedQuoteVersion: current.quoteVersion, requestStatus: 'AWAITING_ARRIVAL' };
          saved = { ...saved, status: 'AWAITING_ARRIVAL', procurement: { ...sale.procurement, stage: 'AWAITING_ARRIVAL', acceptedAt: now }, amountDue: sale.total };
          reply = `Pedido confirmado! Sinal: ${money(current.depositRequiredMinor)} agora; restante de ${money(current.totalMinor - current.depositRequiredMinor)} na retirada ou entrega. Avisaremos quando chegar.`;
        } else {
          nextStage = 'CLOSED'; updated = { ...updated, requestStatus: 'DECLINED', status: 'closed' };
          saved.status = 'CANCELLED'; reply = 'Tudo bem. Encomenda não confirmada.';
        }
      } else if (context.stage === 'FULFILLMENT_CHOICE' && pickup) {
        nextStage = 'PICKUP_CONFIRMED'; updated.requestStatus = 'READY_PICKUP';
        saved = { ...saved, status: 'AWAITING_CASHIER', orderType: 'PICKUP', procurement: { ...sale.procurement, stage: 'READY_PICKUP', fulfillmentConfirmedAt: now }, amountDue: payableTotal(sale) };
        reply = 'Combinado, estamos te esperando aqui!';
      } else if (context.stage === 'FULFILLMENT_CHOICE' && delivery) {
        const address = String(customer?.address || customer?.deliveryAddress || '').trim();
        nextStage = address.length >= 8 ? 'ADDRESS_CONFIRMATION' : 'ADDRESS_REQUIRED';
        saved.procurement = { ...sale.procurement, pendingAddress: address.length >= 8 ? address : '', pendingCustomerId: customer ? profile.id : '',
          pendingLocation: address.length >= 8 ? customer?.deliveryLocation || null : null };
        reply = address.length >= 8 ? `Entregamos em ${address}? Confirma ou prefere outro endereço?` : 'Qual o endereço completo para entrega (rua, número, bairro e cidade)?';
      } else if (context.stage === 'ADDRESS_CONFIRMATION' && affirmative) {
        const address = sale.procurement.pendingAddress;
        if (!address || address.length < 8) throw fail('Informe e confirme o endereço completo.');
        nextStage = 'DELIVERY_CONFIRMED'; updated.requestStatus = 'AWAITING_DRIVER';
        saved = { ...saved, status: 'AWAITING_CASHIER', orderType: 'DELIVERY', deliveryStatus: 'PENDING_DELIVERY',
          deliveryAddress: address, deliveryLocation: sale.procurement.pendingLocation || null,
          customerId: sale.procurement.pendingCustomerId || sale.customerId || '',
          procurement: { ...sale.procurement, stage: 'AWAITING_DRIVER', fulfillmentConfirmedAt: now, addressConfirmedAt: now }, amountDue: payableTotal(sale) };
        reply = 'Endereço confirmado! Em breve o entregador chega no seu endereço.';
      } else if (negative) {
        nextStage = 'ADDRESS_REQUIRED'; reply = 'Qual o novo endereço completo (rua, número, bairro e cidade)?';
      } else if (['ADDRESS_REQUIRED', 'ADDRESS_CONFIRMATION'].includes(context.stage)) {
        const address = text.replace(/^(?:outro endereco|novo endereco|entregue em|entrega em)\s*:?\s*/i, '').trim();
        if (address.length < 8 || address.length > 250 || !/\d/.test(address) || address.split(/\s+/).length < 3) return { reply: 'Envie rua, número, bairro e cidade para eu confirmar.', intent: 'PROCUREMENT_ADDRESS_REQUIRED' };
        nextStage = 'ADDRESS_CONFIRMATION'; saved.procurement = { ...sale.procurement, pendingAddress: address, pendingLocation: null };
        reply = `Confirma a entrega em ${address}?`;
      } else return null;
      tx.set('agent_handoffs', current.id, updated); tx.set('orders', sale.id, saved);
      tx.set('sessions', phone, this.bind(session, updated, nextStage));
      return { reply, intent: 'PROCUREMENT_' + nextStage, order: saved, requestId: current.id };
    });
    if (result?.order?.deliveryStatus === 'PENDING_DELIVERY' && this.pdv) await this.pdv.queueOperationalNotifications(result.order);
    return result;
  }
}

module.exports = { ProcurementWorkflowService, yes, dateLabel };
