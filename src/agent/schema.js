'use strict';

const STATUSES = Object.freeze(['found', 'not_found', 'ambiguous', 'unavailable', 'invalid_input', 'handoff', 'error']);
const OPERATIONS = Object.freeze([
  'buscar_produtos', 'consultar_produto', 'consultar_carrinho', 'adicionar_item', 'alterar_quantidade',
  'remover_item', 'preparar_finalizacao', 'encaminhar_atendente', 'atender_mensagem',
]);
const MUTATING = new Set(['adicionar_item', 'alterar_quantidade', 'remover_item', 'preparar_finalizacao', 'encaminhar_atendente']);

const MAX_TEXT = 120;
const MAX_BATCH = 20;

class InputError extends Error {
  constructor(code, field) {
    super(code);
    this.code = code;
    this.field = field;
  }
}

function text(raw, field, { required = false, max = MAX_TEXT } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    if (required) throw new InputError('required', field);
    return undefined;
  }
  if (typeof raw !== 'string') throw new InputError('must_be_string', field);
  const value = raw.trim();
  if (!value && required) throw new InputError('required', field);
  if (value.length > max) throw new InputError('too_long', field);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new InputError('control_characters', field);
  return value || undefined;
}

function phone(raw) {
  const value = text(raw, 'customer_phone', { required: true, max: 30 });
  const digits = value.replace(/[\s()+-]/g, '');
  if (!/^\d{10,15}$/.test(digits)) throw new InputError('invalid_phone', 'customer_phone');
  return digits;
}

function quantityValue(raw, field = 'quantity') {
  if (typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '')) return raw;
  throw new InputError('required', field);
}

function itemRef(raw, prefix = '') {
  const query = text(raw.query, `${prefix}query`);
  const productId = text(raw.product_id, `${prefix}product_id`, { max: 200 });
  if (productId?.includes('/')) throw new InputError('invalid_product_id', `${prefix}product_id`);
  if (!query && !productId) throw new InputError('query_or_product_id_required', `${prefix}query`);
  if (query && productId) throw new InputError('query_and_product_id_are_exclusive', `${prefix}query`);
  return productId ? { productId } : { query };
}

function parseJsonArray(raw, field, max) {
  if (raw === undefined || raw === null || raw === '') return undefined;
  let value = raw;
  if (typeof raw === 'string') {
    if (raw.length > 8000) throw new InputError('too_long', field);
    try { value = JSON.parse(raw); } catch { throw new InputError('invalid_json', field); }
  }
  if (!Array.isArray(value) || value.length === 0 || value.length > max) throw new InputError('invalid_array', field);
  return value;
}

/**
 * Valida a entrada de uma operação. Argumentos gerados pelo modelo NÃO são dados confiáveis:
 * só os campos conhecidos são copiados e todos são checados.
 */
function parseInput(operation, raw) {
  if (!OPERATIONS.includes(operation)) throw new InputError('unknown_operation', 'operation');
  const body = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const common = {
    customerPhone: phone(body.customer_phone),
    messageId: text(body.message_id, 'message_id', { max: 200 }),
    conversationId: text(body.conversation_id, 'conversation_id', { max: 200 }),
  };
  if (MUTATING.has(operation) && !common.messageId) throw new InputError('required', 'message_id');

  switch (operation) {
    case 'atender_mensagem':
      return { ...common, message: text(body.message, 'message', { required: true, max: 2000 }) };
    case 'consultar_produto': {
      const batch = parseJsonArray(body.queries_json, 'queries_json', 10);
      const intent = text(body.intent, 'intent') ?? 'preco';
      if (!['preco', 'disponibilidade', 'foto'].includes(intent)) throw new InputError('invalid_intent', 'intent');
      if (batch) {
        if (body.query || body.product_id) throw new InputError('query_and_queries_json_are_exclusive', 'queries_json');
        const refs = batch.map((q, i) => {
          if (typeof q !== 'string') throw new InputError('must_be_string', `queries_json[${i}]`);
          return itemRef({ query: q }, `queries_json[${i}].`);
        });
        return { ...common, intent, criteriaQuery: text(body.criteria_query, 'criteria_query'), refs };
      }
      return { ...common, intent, criteriaQuery: text(body.criteria_query, 'criteria_query'), refs: [itemRef(body)] };
    }
    case 'buscar_produtos': {
      const query = text(body.query, 'query');
      const category = text(body.category, 'category', { max: 80 });
      if (!query && !category) throw new InputError('query_or_category_required', 'query');
      let limit = 3;
      if (body.limit !== undefined && body.limit !== null && body.limit !== '') {
        limit = Number(body.limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new InputError('invalid_limit', 'limit');
      }
      return { ...common, query, category, limit };
    }
    case 'consultar_carrinho':
      return common;
    case 'adicionar_item': {
      const batch = parseJsonArray(body.items_json, 'items_json', MAX_BATCH);
      if (batch) {
        if (body.query || body.product_id || body.quantity !== undefined) throw new InputError('single_and_batch_are_exclusive', 'items_json');
        const items = batch.map((entry, i) => {
          if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new InputError('invalid_item', `items_json[${i}]`);
          return { ...itemRef(entry, `items_json[${i}].`), quantity: quantityValue(entry.quantity, `items_json[${i}].quantity`) };
        });
        return { ...common, items };
      }
      return { ...common, items: [{ ...itemRef(body), quantity: quantityValue(body.quantity) }] };
    }
    case 'alterar_quantidade':
      return { ...common, ref: itemRef(body), quantity: quantityValue(body.quantity) };
    case 'remover_item':
      return { ...common, ref: itemRef(body) };
    case 'preparar_finalizacao':
      return { ...common, priceChangeToken: text(body.price_change_token, 'price_change_token', { max: 64 }) };
    case 'encaminhar_atendente':
      return { ...common, note: text(body.reason, 'reason', { max: 200 }) };
    default:
      throw new InputError('unknown_operation', 'operation');
  }
}

/** Valida o envelope de saída (contrato interno). Lança se o contrato for violado. */
function assertEnvelope(envelope) {
  const problems = [];
  if (!envelope || typeof envelope !== 'object') problems.push('not_object');
  else {
    if (typeof envelope.request_id !== 'string' || !envelope.request_id) problems.push('request_id');
    if (!STATUSES.includes(envelope.status)) problems.push('status');
    for (const key of ['data', 'validation', 'provenance', 'next_action']) {
      if (!envelope[key] || typeof envelope[key] !== 'object') problems.push(key);
    }
    if (envelope.validation && !Array.isArray(envelope.validation.checks)) problems.push('validation.checks');
    if (envelope.status === 'found' && typeof envelope.data?.customer_message !== 'string') problems.push('data.customer_message');
    if (envelope.status !== 'found' && envelope.data?.customer_message) problems.push('customer_message_on_non_found');
    const send = envelope.next_action?.send_customer_message;
    if (typeof send !== 'boolean') problems.push('next_action.send_customer_message');
    if (envelope.status !== 'found' && send === true) problems.push('send_on_non_found');
  }
  if (problems.length) {
    const error = new Error(`Contrato de saída violado: ${problems.join(', ')}`);
    error.code = 'OUTPUT_CONTRACT';
    throw error;
  }
  return envelope;
}

module.exports = { STATUSES, OPERATIONS, MUTATING, InputError, parseInput, assertEnvelope };
