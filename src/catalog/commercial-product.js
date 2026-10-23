const { productStatus } = require('./product-status');

// Editable fields take precedence over import aliases. This is a view, never a migration.
function commercialProduct(raw) {
  const name = String(raw.name || raw.descricao || raw['DESCRIÇÃO'] || raw.canonicalName || '').trim();
  const savedUnit = String(raw.saleUnit?.code || raw.unit || raw.unidade || '').trim().toUpperCase();
  const unit = savedUnit || (/(^|[^A-Z])KG([^A-Z]|$)/i.test(name) ? 'KG' : 'UN');
  const rawPrice = raw.price ?? raw.valor_num ?? raw.VALOR ?? raw.valor;
  let price = rawPrice;
  if (typeof price === 'string') {
    let text = price.replace(/R\$|\s/g, '');
    if (text.includes(',') && text.includes('.')) {
      text = text.lastIndexOf('.') > text.lastIndexOf(',') ? text.replaceAll(',', '') : text.replaceAll('.', '').replace(',', '.');
    } else if (text.includes(',')) text = text.replace(',', '.');
    price = text === '' ? NaN : Number(text);
  } else if (typeof price !== 'number') price = NaN;
  return {
    id: String(raw.id || raw.productId || raw.product_id || ''), name, price,
    priceMinor: Math.round(price * 100), unit,
    saleUnit: { code: unit, minimum: Number(raw.saleUnit?.minimum ?? (unit === 'KG' ? 0.1 : 1)),
      increment: Number(raw.saleUnit?.increment ?? (unit === 'KG' ? 0.1 : 1)) },
    active: productStatus(raw) === 'ATIVO' && raw.isAvailable !== false,
    stockQuantity: Number(raw.stockQuantity ?? raw.estoque ?? 0),
    reservedQuantity: Number(raw.reservedQuantity ?? 0),
  };
}

function commercialLine(raw, quantity) {
  const product = commercialProduct(raw);
  const { minimum, increment } = product.saleUnit;
  const qty = Number(quantity);
  const steps = qty / increment;
  if (!product.id || product.id.includes('/') || !product.name || !product.active ||
      !['UN', 'KG'].includes(product.unit) || !Number.isSafeInteger(product.priceMinor) || product.priceMinor < 0 ||
      !Number.isFinite(product.price) || Math.abs(product.price * 100 - product.priceMinor) > 0.00001 ||
      !Number.isFinite(minimum) || minimum <= 0 || !Number.isFinite(increment) || increment <= 0 ||
      !Number.isFinite(qty) || qty < minimum || Math.abs(steps - Math.round(steps)) > 0.00001 ||
      !Number.isSafeInteger(Math.round(qty * 1000)) || Math.abs(qty * 1000 - Math.round(qty * 1000)) > 0.00001) {
    throw Object.assign(new Error('Produto ou quantidade inválida para a unidade de venda.'), { status: 400 });
  }
  const subtotalMinor = Math.round(product.priceMinor * Math.round(qty * 1000) / 1000);
  if (!Number.isSafeInteger(subtotalMinor)) throw new Error('Valor do item inválido.');
  return { productId: product.id, name: product.name, price: product.price, quantity: qty, unit: product.unit, subtotalMinor };
}

function hasValidCommercialPrice(raw) {
  const { name, price, priceMinor } = commercialProduct(raw);
  return Boolean(name) && Number.isFinite(price) && Number.isSafeInteger(priceMinor) && priceMinor >= 0 &&
    Math.abs(price * 100 - priceMinor) < 0.00001;
}

module.exports = { commercialProduct, commercialLine, hasValidCommercialPrice };
