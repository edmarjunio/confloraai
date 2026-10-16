function normalizeCatalogItem(it) {
  const name = it.name || it.descricao || '';
  const category = it.category || it.categoria || 'Conflora';
  const subcategory = it.subcategory || it.subcategoria || '';
  const savedUnit = it.saleUnit?.code || it.unit || it.unidade || '';
  const isKg = savedUnit.toUpperCase() === 'KG' || /\bkg\b/i.test(name);
  const unit = (savedUnit || (isKg ? 'KG' : 'UN')).toUpperCase();
  const price = typeof it.price === 'number'
    ? it.price
    : typeof it.valor_num === 'number'
    ? it.valor_num
    : parseFloat(String(it.valor || it.price || 0).replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
  const stockQuantity = typeof it.stockQuantity === 'number'
    ? it.stockQuantity
    : typeof it.estoque === 'number'
    ? it.estoque
    : 0;
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
    status: (it.status || 'ATIVO').toUpperCase(),
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
    /^\/api\/images\//i.test(value.trim())
  );
}

module.exports = { normalizeCatalogItem };
