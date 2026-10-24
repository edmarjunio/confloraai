const { normalizeProductInformation } = require('./registered-product-content');
const { normalizeText } = require('../shared/string.util');
// Presentation adapter, not another legacy-field normalizer.
function getCashierProductDetails(product = {}) {
  const info = normalizeProductInformation(product);
  return [
    ...(info.description && normalizeText(info.description) !== normalizeText(product.name || product.descricao || '') ? [{ label: 'Descrição', value: info.description }] : []),
    ...info.attributes.map(({ label, value }) => ({ label, value })),
    ...info.specifications.map(({ label, value }) => ({ label, value })),
    ...info.sections.map(({ title, body }) => ({ label: title, value: body })),
  ];
}
function toCashierProduct(raw) {
  const product = require('./normalize-catalog-item').normalizeCatalogItem(raw);
  const view = require('./commercial-product').commercialProduct(product);
  return { id: product.id, sku: product.sku, name: view.name, status: product.status, price: view.price,
    stock: view.stockQuantity, inventory: product.inventory, unit: view.unit,
    saleUnit: { ...view.saleUnit, label: product.saleUnit?.label || (view.unit === 'UN' ? 'unidade' : view.unit) },
    category: product.category, subcategory: product.subcategory, canonicalName: product.canonicalName || view.name,
    variation: product.variation || product.variacao || '', imageUrl: product.imageUrl, images: product.images,
    imageFileId: product.imageFileId, imagePathCache: product.imageUrl, imageFallbackUrl: '/store-assets/placeholder.svg',
    imageIsIllustrative: false, actualPhotoPending: product.actualPhotoPending, media: product.media,
    productInfo: product.productInfo, descriptionAi: product.productInfo.description,
    tagsAi: product.tagsAi || '', details: getCashierProductDetails(product) };
}
module.exports = { getCashierProductDetails, toCashierProduct };
