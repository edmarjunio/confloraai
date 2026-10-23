const { createHash, randomUUID } = require('node:crypto');
const { runTransaction } = require('../database/transactions');
const { PdvRepository } = require('../orders/pdv.repository');
const { commercialProduct, commercialLine } = require('../catalog/commercial-product');
const { normalizeText, toSingular, formatCurrency } = require('../shared/string.util');
const { customerKeyFor } = require('../agent/agent-store');
const { ORDER_OFFER, ARRIVAL_PENDING, PRICE_PENDING } = require('./customer-service-policy');

const conflict = () => Object.assign(new Error('A solicitação mudou. Confira os itens antes de confirmar.'), { status: 409 });
const confirmation = text => /^(?:sim|confirmo|confirmar|pode confirmar|pode registrar|registre|registra|pode sim|isso|correto|certo|ok|fechado|pode ser)[.!\s]*$/i.test(text);
const digits = value => String(value || '').replace(/\D/g, '');
const restricted = text => /\b(?:rinha|briga de galos|droga ilicita|sem licenca|trafico de animais|arma ilegal)\b/.test(normalizeText(text));
const names = items => items.map(item => `${item.quantity ?? '?'} ${item.requestedName}`).join(' e ');

/** Parse explicit requests; do not interpret every greeting, address or payment as a product. */
function parseRequest(message) {
  let value = String(message || '').trim();
  const normalized = normalizeText(value);
  const query = /^(?:(?:voces?|vcs)\s+)?(?:tem|teria|vendem|vende|trabalham com|conseguem|pode encomendar|podem encomendar|encomenda de|encomendar|quanto custa|qual o preco de|qual o valor de)\b/.test(normalized);
  const buying = /^(?:quero|vou querer|gostaria de|preciso de|me manda|manda|separa|encomende|adiciona|adicionar|muda|mudar|tira|tirar|altera|alterar)\s|^\d+[,.]?\d*\s/.test(normalized);
  if (!query && !buying) return null;
  value = value.replace(/^(?:(?:vocês?|voces?|vcs)\s+)?(?:tem|têm|teria|vendem|vende|trabalham com|conseguem|pode encomendar|podem encomendar|encomenda de|encomendar|quanto custa|qual o preço de|qual o preco de|qual o valor de|quero|vou querer|gostaria de|preciso de|me manda|manda pra mim|manda|separa|encomende|adiciona|adicionar|muda para|muda|mudar para|mudar|tira|tirar|altera para|altera|alterar)\s+/i, '')
    .replace(/[?!;.]+$/g, '').trim();
  if (!value || /^(?:entrega|retirada|pagar|pix|confirmar|comprar|falar|saber|ver|conhecer|opcoes|ajuda|o pedido|minha sacola)\b/.test(normalizeText(value))) return null;
  if (/\bplantas?\b.*\b(?:para|pra|que|dentro|cerca)\b/.test(normalizeText(value))) return null;
  const parts = value.split(/[,;\n](?!\d)|\s+e\s+/i).map(part => part.trim()).filter(Boolean);
  if (!parts.length || parts.length > 20) throw Object.assign(new Error('Envie até 20 itens por solicitação.'), { status: 400 });
  const items = parts.map(part => {
    const match = /^(\d+(?:[.,]\d+)?)\s*(?:x\s*)?(?:(kg|quilos?)\s+(?:de\s+)?)?(.+)$/i.exec(part);
    const quantity = match ? Number(match[1].replace(',', '.')) : null;
    const originalName = (match ? match[3] : part).replace(/^(?:um|uma|o|a|os|as)\s+/i, '').trim();
    const priceChoice = /^(.*?)\s+de\s+(?:R\$\s*)?(\d+(?:[.,]\d+)?)(?:\s+reais)?$/i.exec(originalName);
    const requestedName = priceChoice ? priceChoice[1].trim() : originalName;
    const targetPrice = priceChoice ? Number(priceChoice[2].replace(',', '.')) : null;
    if (!requestedName || requestedName.length > 120 || (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000 || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.00001))) {
      throw Object.assign(new Error('Informe o produto e uma quantidade válida.'), { status: 400 });
    }
    return { requestedName, quantity, targetPrice, unit: match?.[2] ? 'KG' : null };
  });
  return { query, items };
}

/** Procurement comandas start without a price, payment or stock mutation. */
class OrderIntakeService {
  constructor(repository, { notify = null, catalog = null, env = process.env, now = () => new Date() } = {}) {
    this.repository = repository;
    this.store = new PdvRepository(repository);
    this.notify = notify;
    this.catalog = catalog;
    this.env = env;
    this.now = now;
    this.procurement = new (require('./procurement-workflow.service').ProcurementWorkflowService)(repository, { notify, now });
  }

  async classify(items) {
    let products;
    if (this.catalog) {
      await this.catalog.refreshCatalog();
      const words = items.map(item => toSingular(item.requestedName).split(' ').filter(word => !['de', 'da', 'do', 'das', 'dos'].includes(word)));
      const candidates = (this.catalog.rawItems || this.catalog.items || []).filter(raw => words.some(query => query.every(word =>
        toSingular(commercialProduct(raw).name).split(' ').includes(word))));
      const ids = candidates.map(raw => String(raw.id)).filter(Boolean).slice(0, 150);
      products = ids.length ? await this.repository.getProductsByIds(ids) : [];
    } else products = await this.repository.getAllProducts();
    const inventory = await this.repository.getInventorySettings();
    return items.map(item => {
      const query = toSingular(item.requestedName);
      const words = query.split(' ').filter(word => !['de', 'da', 'do', 'das', 'dos'].includes(word));
      const exact = products.filter(raw => toSingular(commercialProduct(raw).name) === query ||
        (Array.isArray(raw.searchAliases) ? raw.searchAliases : []).some(alias => toSingular(alias) === query));
      const candidates = (exact.length ? exact : products.filter(raw => words.every(word => toSingular(commercialProduct(raw).name).split(' ').includes(word))))
        .filter(raw => item.targetPrice === null || item.targetPrice === undefined || commercialProduct(raw).price === item.targetPrice);
      const raw = candidates.length === 1 ? candidates[0] : null;
      if (!raw) return { ...item, productId: null, fulfillment: 'PROCUREMENT', priceMinor: null, legalReview: 'PENDING' };
      const product = commercialProduct(raw);
      let valid = product.active && Number.isFinite(product.price) && Number.isSafeInteger(product.priceMinor) && product.priceMinor >= 0;
      if (item.quantity !== null) {
        try { commercialLine(raw, item.quantity); } catch { valid = false; }
      }
      const available = inventory.stockControlEnabled === true && Number.isFinite(product.stockQuantity) && Number.isFinite(product.reservedQuantity) &&
        product.stockQuantity - product.reservedQuantity >= (item.quantity ?? product.saleUnit.minimum);
      return { ...item, unit: item.unit || product.unit, productId: product.id,
        fulfillment: valid && available ? 'IMMEDIATE' : 'PROCUREMENT', priceMinor: valid ? product.priceMinor : null,
        legalReview: valid ? 'CATALOG_PRODUCT' : 'PENDING' };
    });
  }

  async handle({ phone, message, messageId = '', customerName = '', force = false }) {
    phone = digits(phone);
    if (!/^\d{10,15}$/.test(phone)) return null;
    const text = String(message || '').trim();
    if (!text || text.length > 800) return null;
    const normalized = normalizeText(text);
    const session = await this.store.read('sessions', phone) || {};
    const draft = session.orderIntake;
    if (restricted(text)) return { reply: 'Esse pedido precisa de avaliação da equipe antes de qualquer confirmação.', intent: 'ORDER_REQUIRES_REVIEW' };
    const procurementReply = await this.procurement.reply({ phone, message: text, messageId, session });
    if (procurementReply) return procurementReply;
    if (draft && /\b(?:quando chega|previsao|prazo|quando vai chegar)\b/.test(normalized)) {
      const request = draft.status === 'REGISTERED' ? await this.store.read('agent_handoffs', draft.id) : null;
      return { reply: request?.arrivalForecast ? `Previsão confirmada pela equipe: ${request.arrivalForecast}.` : ARRIVAL_PENDING, intent: 'ORDER_ARRIVAL' };
    }
    if (draft && /^(?:quanto|qual o valor|qual o preco|e o valor|e o preco|preco|valor)\b/.test(normalized)) return { reply: PRICE_PENDING, intent: 'ORDER_QUOTE' };
    if (draft?.status === 'AWAITING_CONFIRMATION' && /^(?:nao|cancela|cancelar|deixa pra la)[.!\s]*$/.test(normalized)) {
      await this.changeDraft(phone, draft, { ...draft, status: 'CANCELLED' });
      return { reply: 'Tudo bem.', intent: 'ORDER_INTAKE_CANCELLED' };
    }
    if (draft && confirmation(text)) {
      if (draft.status === 'REGISTERED') return { reply: 'Seu pedido já está registrado.', intent: 'ORDER_INTAKE_REGISTERED', requestId: draft.id };
      if (draft.status === 'AWAITING_CONFIRMATION') {
        if (draft.items.some(item => item.quantity === null)) {
          await this.changeDraft(phone, draft, { ...draft, registrationAccepted: true });
          return { reply: `Quantas unidades de ${draft.items.filter(item => item.quantity === null).map(item => item.requestedName).join(' e ')}?`, intent: 'ORDER_QUANTITY_REQUIRED' };
        }
        return this.register(phone, draft, { messageId, customerName });
      }
    }
    if (draft?.status === 'AWAITING_CONFIRMATION' && draft.items.filter(item => item.quantity === null).length === 1 && /^\d+(?:[.,]\d+)?$/.test(text)) {
      const quantity = Number(text.replace(',', '.'));
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) throw new Error('Informe uma quantidade válida.');
      const items = await this.classify(draft.items.map(item => item.quantity === null ? { ...item, quantity } : item));
      const next = await this.changeDraft(phone, draft, { ...draft, items });
      if (next.registrationAccepted) return this.register(phone, next, { messageId, customerName });
      return { reply: `${names(next.items)}, certo? Posso registrar?`, intent: 'ORDER_INTAKE_CONFIRM' };
    }
    const request = parseRequest(text);
    if (!request) return null;
    if (request.query && request.items.length === 1 && this.catalog?.isCategoryOrSubcategory?.(request.items[0].requestedName)) return null;
    if (draft?.status !== 'AWAITING_CONFIRMATION' && this.catalog?.findProductByName &&
        request.items.every(item => this.catalog.findProductByName(item.requestedName)) &&
        request.items.some(item => this.catalog.findProductByName(item.requestedName)?.items?.length > 1)) return null;
    let items = await this.classify(request.items);
    if (draft?.status === 'AWAITING_CONFIRMATION' && !request.query) {
      const combined = new Map(draft.items.map(item => [toSingular(item.requestedName), item]));
      for (const item of items) combined.set(toSingular(item.requestedName), item);
      items = [...combined.values()];
      if (items.length > 20) throw Object.assign(new Error('Envie até 20 itens por solicitação.'), { status: 400 });
    }
    // Normal, fully identified sales continue through their established checkout.
    if (!force && draft?.status !== 'AWAITING_CONFIRMATION' && items.every(item => item.fulfillment === 'IMMEDIATE')) {
      if (request.query) return { reply: items.map(item => `${item.requestedName}: ${formatCurrency(item.priceMinor / 100)}`).join('; ') + '.', intent: 'VERIFIED_PRODUCT_PRICE' };
      return null;
    }
    const id = 'request-' + createHash('sha256').update(phone + ':' + (messageId || randomUUID())).digest('hex').slice(0, 32);
    const next = await this.changeDraft(phone, draft, { id, status: 'AWAITING_CONFIRMATION', items, createdAt: this.now().toISOString() });
    const immediate = next.items.filter(item => item.fulfillment === 'IMMEDIATE');
    const procurement = next.items.filter(item => item.fulfillment === 'PROCUREMENT');
    const reply = request.query && items.every(item => item.quantity === null) ? ORDER_OFFER
      : immediate.length && procurement.length
        ? `${names(immediate)} para hoje; ${names(procurement)} por encomenda. Posso registrar os dois?`
        : `${names(next.items)}, certo? Podemos encomendar. Posso registrar?`;
    return { reply, intent: 'ORDER_INTAKE_CONFIRM' };
  }

  async changeDraft(phone, previous, next) {
    return runTransaction(this.repository, async tx => {
      const session = await tx.get('sessions', phone) || {};
      if (session.orderIntake?.id !== previous?.id || session.orderIntake?.version !== previous?.version) throw conflict();
      const saved = { ...next, version: Number(previous?.version || 0) + 1, updatedAt: this.now().toISOString() };
      tx.set('sessions', phone, { ...session, orderIntake: saved });
      return saved;
    });
  }

  notificationJobs(request) {
    const targets = ['admin', 'store'];
    if (request.items.some(item => item.fulfillment === 'PROCUREMENT')) {
      const storePhone = digits(this.env.STORE_NOTIFICATION_PHONE || this.env.OWNER_WHATSAPP_NUMBER);
      const juniorPhone = digits(this.env.JUNIOR_WHATSAPP_NUMBER || this.env.OWNER_WHATSAPP_NUMBER);
      if (storePhone && storePhone === juniorPhone) targets[1] = 'store-and-junior';
      else targets.push('junior');
    }
    return targets.map(target => ({ id: `${request.id}-${target}`, requestId: request.id, target,
      kind: 'order-request-notice', status: 'PENDING', attempts: 0, createdAt: request.createdAt }));
  }

  async register(phone, draft, { messageId, customerName }) {
    // Revalidate before classifying ready-to-sell items; intake itself never reserves stock.
    const items = await this.classify(draft.items);
    const profile = await this.procurement.customerProfile(phone);
    const result = await runTransaction(this.repository, async tx => {
      const session = await tx.get('sessions', phone) || {};
      const previous = await tx.get('agent_handoffs', draft.id);
      if (previous) {
        if (previous.customerPhone !== phone || previous.kind !== 'ORDER_REQUEST') throw conflict();
        return { request: previous, jobs: this.notificationJobs(previous) };
      }
      if (session.orderIntake?.id !== draft.id || session.orderIntake.version !== draft.version || session.orderIntake.status !== 'AWAITING_CONFIRMATION') throw conflict();
      const currentCustomer = profile ? await tx.get('customers', profile.id) : null;
      const boundCustomer = currentCustomer && (profile.id === phone || digits(currentCustomer.phoneDigits || currentCustomer.phone) === phone) ? { ...currentCustomer, id: profile.id } : null;
      const createdAt = this.now().toISOString();
      const request = { id: draft.id, kind: 'ORDER_REQUEST', tenantId: 'conflora', customerKey: customerKeyFor('conflora', phone),
        customerPhone: phone, customerId: boundCustomer?.id || '', customerEmail: boundCustomer?.email || '', customerName: String(customerName || boundCustomer?.name || '').slice(0, 100), reason: 'customer_order_request',
        status: 'open', requestStatus: 'AWAITING_QUOTE', items, total: null, arrivalForecast: null, version: 1,
        confirmedMessageId: messageId || '', createdAt, updatedAt: createdAt, cartPreserved: true };
      const jobs = this.notificationJobs(request);
      tx.set('agent_handoffs', request.id, request);
      tx.set('orders', request.id, require('../orders/procurement-payment').procurementOrder(request));
      tx.set('sessions', phone, { ...session, orderIntake: { ...draft, items, status: 'REGISTERED', version: draft.version + 1 } });
      for (const job of jobs) tx.set('pdv_outbox', job.id, job);
      return { request, jobs };
    });
    await this.flush(result.jobs);
    return { reply: 'Pedido registrado! Aviso quando a equipe confirmar os detalhes.', intent: 'ORDER_INTAKE_REGISTERED', requestId: result.request.id };
  }

  async updateForecast(id, input, actor) {
    if (!['ADMIN', 'CAIXA'].includes(actor?.role)) throw Object.assign(new Error('Sem permissão.'), { status: 403 });
    if (!/^request-[a-f0-9]{32}$/.test(id)) throw Object.assign(new Error('Solicitação inválida.'), { status: 400 });
    const forecast = String(input.forecast || '').trim();
    if (input.confirmed !== true || !forecast || forecast.length > 120 || /[\r\n]/.test(forecast) || !Number.isSafeInteger(input.version)) throw Object.assign(new Error('Informe a previsão confirmada e a versão da comanda.'), { status: 400 });
    const result = await runTransaction(this.repository, async tx => {
      const request = await tx.get('agent_handoffs', id);
      if (!request || request.kind !== 'ORDER_REQUEST' || request.tenantId !== 'conflora') throw Object.assign(new Error('Solicitação não encontrada.'), { status: 404 });
      if (request.quoteVersion || request.acceptedAt) throw Object.assign(new Error('Use a cotação da encomenda para atualizar valores e datas antes do aceite.'), { status: 409 });
      if (request.version === input.version + 1 && request.arrivalForecast === forecast) return { request, jobs: [] };
      if (request.version !== input.version || request.status !== 'open') throw conflict();
      if (request.items.some(item => item.legalReview === 'PENDING') && input.commercializationAllowed !== true) throw Object.assign(new Error('Confirme a comercialização permitida antes de informar a previsão.'), { status: 400 });
      const updated = { ...request, arrivalForecast: forecast, requestStatus: 'FORECAST_CONFIRMED', version: request.version + 1,
        forecastConfirmedBy: { id: actor.id, role: actor.role }, commercializationAllowed: true, updatedAt: this.now().toISOString() };
      const job = { id: `${id}-forecast-${updated.version}`, requestId: id, kind: 'order-request-forecast', recipient: request.customerPhone,
        forecast, status: 'PENDING', attempts: 0, createdAt: updated.updatedAt };
      tx.set('agent_handoffs', id, updated);
      tx.set('pdv_outbox', job.id, job);
      return { request: updated, jobs: [job] };
    });
    await this.flush(result.jobs);
    return result.request;
  }

  async flush(jobs) {
    if (this.notify) await Promise.allSettled(jobs.map(job => this.notify(job.id)));
  }
}

module.exports = { OrderIntakeService, parseRequest, confirmation, names };
