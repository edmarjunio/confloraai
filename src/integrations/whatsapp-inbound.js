const { normalizeText } = require('../shared/string.util');
function normalizeAction(message) {
  const raw = message.button?.payload || message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || '';
  const aliases = { 'montar minha sacola': 'montar_sacola', 'comprar agora': 'montar_sacola', 'falar com atendente': 'btn_atendente', 'catalogo virtual': 'catalogo_virtual' };
  return aliases[normalizeText(raw)] || raw || aliases[normalizeText(message.button?.text || '')] || '';
}
function normalizeOrder(order) {
  if (!order || typeof order.catalog_id !== 'string' || order.catalog_id !== process.env.WHATSAPP_META_CATALOG_ID || !Array.isArray(order.product_items) || !order.product_items.length || order.product_items.length > 30) throw Object.assign(new Error('Carrinho Meta inválido ou catálogo não autorizado.'), { status: 400 });
  const seen = new Set();
  const items = order.product_items.map(item => {
    const id = item.product_retailer_id;
    const quantity = Number(item.quantity);
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,180}$/.test(id) || seen.has(id) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10000 || item.currency !== 'BRL') throw Object.assign(new Error('Item do carrinho Meta inválido.'), { status: 400 });
    seen.add(id);
    return { productId: id, quantity };
  });
  // item_price and order.text are untrusted and deliberately not used as authority.
  return { catalogId: order.catalog_id, items };
}
module.exports = { normalizeAction, normalizeOrder };
