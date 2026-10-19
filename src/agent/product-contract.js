'use strict';
const { productStatus } = require('../catalog/product-status');
const { priceToCents, numberToMilli, SALE_UNITS, COMMERCIAL_RULES_VERSION } = require('./units');
const { normalizeName, toIso, safeDisplayText } = require('./util');

/**
 * Mapeamento (campos reais do Firestore, coleção `products`) -> contrato do atendimento.
 * Nenhum campo é presumido: todos aparecem em src/database/firestore.repository.js (saveProduct)
 * ou src/catalog/normalize-catalog-item.js. Ver docs/AGENTE-META.md.
 */
const FIELD_MAP = Object.freeze({
  name: ['name', 'descricao', 'DESCRIÇÃO', 'canonicalName'],
  price: ['price', 'valor_num', 'VALOR'],
  unit: ['saleUnit.code', 'unit', 'unidade'],
  status: ['status', 'STATUS'],
  stock: ['stockQuantity', 'estoque'],
  reserved: ['reservedQuantity'],
  presentation: ['variation', 'variacao'],
  category: ['category', 'categoria', 'CATEGORIA'],
  subcategory: ['subcategory', 'subcategoria', 'SUBCATEGORIA'],
});

/** Campos de promoção NÃO existem no sistema. Se surgirem, não há regra de vigência: bloquear em vez de ignorar. */
const PROMOTION_FIELDS = Object.freeze([
  'promocao', 'promotion', 'promoPrice', 'promotionalPrice', 'precoPromocional', 'preco_promocional',
  'salePrice', 'oldPrice', 'compareAtPrice', 'desconto', 'discount',
]);

const BLOCKING = new Set([
  'product_inactive', 'status_invalid', 'status_conflict', 'name_missing', 'name_conflict',
  'price_missing', 'price_invalid', 'price_conflict', 'promo_unverified', 'unit_missing',
  'unit_invalid', 'unit_conflict', 'saleunit_invalid', 'presentation_conflict',
]);

function pick(data, path) {
  return path.split('.').reduce((acc, key) => (acc && typeof acc === 'object' ? acc[key] : undefined), data);
}

function presentValues(data, paths, type) {
  return paths
    .map((path) => ({ path, value: pick(data, path) }))
    .filter(({ value }) => (type === 'string' ? typeof value === 'string' && value.trim() !== '' : typeof value === 'number'));
}

function firstText(data, paths) {
  return presentValues(data, paths, 'string')[0]?.value.trim() ?? '';
}

function hasPromotion(data) {
  return PROMOTION_FIELDS.some((key) => {
    const value = data[key];
    return value !== undefined && value !== null && value !== '' && value !== 0 && value !== false;
  });
}

function evaluateSaleUnit(data, unitCode) {
  const raw = data.saleUnit;
  const defaults = SALE_UNITS[unitCode];
  const minimum = raw && typeof raw === 'object' && raw.minimum !== undefined ? raw.minimum : defaults.defaultMin;
  const increment = raw && typeof raw === 'object' && raw.increment !== undefined ? raw.increment : defaults.defaultIncrement;
  const minMilli = numberToMilli(minimum);
  const incMilli = numberToMilli(increment);
  if (!minMilli || !incMilli || minMilli <= 0 || incMilli <= 0 || (unitCode === 'UN' && (minMilli % 1000 || incMilli % 1000))) return null;
  return { minMilli, incMilli };
}

function evaluateStock(data, unitCode, ctx) {
  const stockValues = presentValues(data, FIELD_MAP.stock, 'number');
  const base = { known: false, qtyMilli: null, reservedMilli: 0, availableMilli: null, verified: false, issues: [] };
  if (stockValues.length === 0) return base;
  if (new Set(stockValues.map((v) => v.value)).size > 1) return { ...base, issues: ['stock_conflict'] };
  const stockMilli = numberToMilli(stockValues[0].value);
  const reservedRaw = data.reservedQuantity === undefined || data.reservedQuantity === null ? 0 : data.reservedQuantity;
  const reservedMilli = numberToMilli(reservedRaw);
  const integerOnly = unitCode === 'UN';
  if (stockMilli === null || stockMilli < 0 || reservedMilli === null || reservedMilli < 0
    || (integerOnly && (stockMilli % 1000 || reservedMilli % 1000))) {
    return { ...base, issues: ['stock_invalid'] };
  }
  const availableMilli = stockMilli - reservedMilli;
  // Disponibilidade só é afirmável se: a política ligada, o controle de estoque do sistema ativo
  // (store_settings/inventory.stockControlEnabled === true) e o registro íntegro.
  const verified = ctx.assertAvailability === true && ctx.stockControlEnabled === true;
  return { known: true, qtyMilli: stockMilli, reservedMilli, availableMilli, verified, issues: [] };
}

/**
 * Valida um documento de produto. Não confia no Firestore: cada campo é checado.
 * @param {{id:string,data:object,readTime?:any,updateTime?:any}} raw
 * @param {{assertAvailability?:boolean, stockControlEnabled?:boolean|null}} ctx
 */
function evaluateProduct(raw, ctx = {}) {
  const issues = [];
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : {};
  const fieldsUsed = [];
  const source = {
    collection: 'products',
    doc_id: raw?.id ?? null,
    read_at: toIso(raw?.readTime),
    update_time: toIso(raw?.updateTime),
    updated_at_field: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  };

  // Status
  const statuses = presentValues(data, FIELD_MAP.status, 'string').map((v) => v.value.trim().toUpperCase());
  let rawStatusVal = statuses.length ? productStatus(data) : 'ATIVO';
  if (rawStatusVal === 'ACTIVE') rawStatusVal = 'ATIVO';
  if (rawStatusVal === 'INACTIVE') rawStatusVal = 'INATIVO';
  const status = rawStatusVal;
  if (new Set(statuses).size > 1) issues.push({ code: 'status_conflict' });
  else if (!['ATIVO', 'INATIVO'].includes(status)) issues.push({ code: 'status_invalid' });
  else if (status === 'INATIVO') issues.push({ code: 'product_inactive' });
  fieldsUsed.push('status');

  // Nome
  const names = presentValues(data, FIELD_MAP.name, 'string');
  if (!names.length) issues.push({ code: 'name_missing' });
  else if (new Set(names.map((n) => normalizeName(n.value))).size > 1) issues.push({ code: 'name_conflict' });
  const name = names.length ? safeDisplayText(names[0].value) : '';
  fieldsUsed.push('name');

  // Preço
  const prices = presentValues(data, FIELD_MAP.price, 'number');
  let priceCents = null;
  if (!prices.length) issues.push({ code: 'price_missing' });
  else {
    const cents = prices.map((p) => priceToCents(p.value));
    if (cents.some((c) => c === null)) issues.push({ code: 'price_invalid' });
    else if (new Set(cents).size > 1) issues.push({ code: 'price_conflict' });
    else priceCents = cents[0];
  }
  if (hasPromotion(data)) issues.push({ code: 'promo_unverified' });
  fieldsUsed.push('price');

  // Unidade (nunca inferida pelo nome nem assumida como "unidade")
  const units = presentValues(data, FIELD_MAP.unit, 'string').map((u) => u.value.trim().toUpperCase());
  let unit = null;
  if (!units.length) issues.push({ code: 'unit_missing' });
  else if (new Set(units).size > 1) issues.push({ code: 'unit_conflict' });
  else if (!SALE_UNITS[units[0]]) issues.push({ code: 'unit_invalid' });
  else unit = units[0];
  fieldsUsed.push('unit');

  let saleUnit = null;
  if (unit) {
    saleUnit = evaluateSaleUnit(data, unit);
    if (!saleUnit) issues.push({ code: 'saleunit_invalid' });
  }

  // Apresentação (opcional; omitida se ausente)
  const presentations = presentValues(data, FIELD_MAP.presentation, 'string').map((p) => safeDisplayText(p.value));
  let presentation = null;
  if (new Set(presentations.map(normalizeName)).size > 1) issues.push({ code: 'presentation_conflict' });
  else if (presentations.length) { presentation = presentations[0]; fieldsUsed.push('presentation'); }

  const stock = unit ? evaluateStock(data, unit, ctx) : { known: false, verified: false, issues: [] };
  if (stock.known || stock.issues.length) fieldsUsed.push('stock');
  for (const code of stock.issues) issues.push({ code, nonBlocking: true });

  const blocking = issues.filter((i) => BLOCKING.has(i.code));
  const ok = blocking.length === 0 && Boolean(name) && priceCents !== null && unit !== null && saleUnit !== null;

  return {
    ok,
    issues,
    blockingCodes: blocking.map((i) => i.code),
    rulesVersion: COMMERCIAL_RULES_VERSION,
    fieldsUsed: [...new Set(fieldsUsed)],
    source,
    product: ok ? {
      id: String(raw.id),
      name,
      presentation,
      category: firstText(data, FIELD_MAP.category) || null,
      subcategory: firstText(data, FIELD_MAP.subcategory) || null,
      priceCents,
      unit,
      saleUnit,
      stock,
    } : null,
  };
}

module.exports = { evaluateProduct, FIELD_MAP, PROMOTION_FIELDS, pick, firstText };
