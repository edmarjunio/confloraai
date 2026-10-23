const { enrichWithValidatedProfile } = require('./validated-catalog-profiles');

function normalizeCatalogItem(rawItem) {
  const it = enrichWithValidatedProfile(rawItem);
  const view = require('./commercial-product').commercialProduct(it);
  const name = view.name;
  const category = it.category || it.categoria || it.CATEGORIA || 'Conflora';
  const subcategory = it.subcategory || it.subcategoria || it.SUBCATEGORIA || '';
  const unit = view.unit;
  const price = Number.isFinite(view.price) ? view.price : 0;
  const stockQuantity = Number.isFinite(view.stockQuantity) ? view.stockQuantity : 0;
  const imageCandidates = [
    ...(Array.isArray(it.images) ? it.images : []),
    it.imageUrl,
    it.imageurl,
    it.imagePathCache,
  ];
  const images = [...new Set(imageCandidates.filter(isStoredProductImage))];
  const imageUrl = images[0] || '';

  return {
    ...it,
    id: String(it.id || it.product_id || ''),
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
    valor: `R$ ${price.toFixed(2).replace('.', ',')}`,
    stockQuantity,
    estoque: stockQuantity,
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

function isStoredProductImage(value) {
  return typeof value === 'string' && (
    /^https:\/\/(?:firebasestorage|storage)\.googleapis\.com\//i.test(value.trim()) ||
    /^https:\/\/(?:inaturalist-open-data\.s3\.amazonaws\.com|static\.inaturalist\.org)\//i.test(value.trim()) ||
    /^\/store-assets\/products\//i.test(value.trim()) ||
    /^\/api\/images\//i.test(value.trim())
  );
}

module.exports = { normalizeCatalogItem };

