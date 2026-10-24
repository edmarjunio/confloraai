function normalizeCatalogItem(rawItem) {
  const it = { ...rawItem, ...require('./registered-product-content').registeredProductContent(rawItem) };
  const view = require('./commercial-product').commercialProduct(it);
  const name = view.name;
  const category = it.category || it.categoria || it.CATEGORIA || 'Conflora';
  const subcategory = it.subcategory || it.subcategoria || it.SUBCATEGORIA || '';
  const unit = view.unit;
  const price = Number.isFinite(view.price) ? view.price : null;
  const stockQuantity = Number.isFinite(view.stockQuantity) ? view.stockQuantity : 0;
  const images = require('./actual-product-photo').actualProductImages(it);
  const imageUrl = images[0] || '';

  return {
    ...it,
    ...require('./actual-product-photo').actualProductPhotoFields(it),
    id: String(it.id || it.product_id || ''),
    sku: String(it.sku || it.codigo || it.id || it.product_id || ''),
    name,
    descricao: name,
    category,
    categoria: category,
    subcategory,
    subcategoria: subcategory,
    unit,
    unidade: unit,
    price,
    valor_num: price,
    valor: price === null ? '' : `R$ ${price.toFixed(2).replace('.', ',')}`,
    stockQuantity,
    estoque: stockQuantity,
    inventory: { physical: stockQuantity, reserved: view.reservedQuantity, available: Math.max(0, stockQuantity - view.reservedQuantity) },
    salesCount: it.salesCount || 0,
    status: require('./product-status').productStatus(it),
    images: images.length > 0 ? images : (imageUrl ? [imageUrl] : []),
    imageUrl,
    imageurl: imageUrl,
    imageURL: imageUrl,
    imagePathCache: imageUrl,
    descriptionAi: it.descriptionAi || it.descricao_ia || '',
    descricao_ia: it.descriptionAi || it.descricao_ia || '',
    tagsAi: it.tagsAi || it.tags_ia || '',
    tags_ia: it.tagsAi || it.tags_ia || '',
  };
}

module.exports = { normalizeCatalogItem };

