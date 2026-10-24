/** Safe filenames for uploaded product photos. */
function slugify(text) {
  if (!text || typeof text !== 'string') {
    return 'produto';
  }
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'produto';
}

/**
 * Gera o nome padrão do arquivo de imagem do produto no Firestore
 * Padrão: {slug-do-nome}_{id}.jpg
 * Ex: "palmeira-rabo-de-raposa-muda-media_prod-01.jpg"
 */
function generateStandardPhotoName(productName, productId, extension = 'jpg') {
  const cleanSlug = slugify(productName);
  const cleanId = String(productId || 'id')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 32);
  const ext = (extension || 'jpg').replace(/^\./, '').toLowerCase();
  return `${cleanSlug}_${cleanId}.${ext}`;
}

/**
 * Gera as tags padronizadas no mesmo padrão oficial da Conflora
 * Retorna tanto string separada por vírgulas quanto array
 */
function generateStandardTags(product = {}) {
  const name = String(product.name || product.descricao || product.canonicalName || '').trim();
  const category = String(product.category || product.categoria || '').trim();
  const subcategory = String(product.subcategory || product.subcategoria || '').trim();
  const variation = String(product.variation || product.variacao || '').trim();

  const tagsSet = new Set();

  // 1. Tag básica com o nome do produto em minúsculas
  if (name) {
    tagsSet.add(name.toLowerCase());
  }

  // 2. Categoria e Subcategoria limpas
  if (category) {
    tagsSet.add(category.toLowerCase());
  }
  if (subcategory) {
    tagsSet.add(subcategory.toLowerCase());
  }
  if (variation) {
    tagsSet.add(variation.toLowerCase());
  }

  // Se o usuário já tiver tags salvas anteriormente, preserva-as
  const existingTags = product.tagsAi || product.tags_ia || product.tags || '';
  if (typeof existingTags === 'string' && existingTags.trim()) {
    existingTags
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
      .forEach((t) => tagsSet.add(t));
  } else if (Array.isArray(existingTags)) {
    existingTags
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean)
      .forEach((t) => tagsSet.add(t));
  }

  const tagsList = Array.from(tagsSet).filter(Boolean);
  const tagsString = tagsList.join(', ');

  return {
    tagsList,
    tagsString,
  };
}

/**
 * Gera descrição comercial botânica padrão caso não exista
 */
function generateStandardDescription(product = {}) {
  if (product.descriptionAi && typeof product.descriptionAi === 'string' && product.descriptionAi.trim()) {
    return product.descriptionAi.trim();
  }
  if (product.descricao_ia && typeof product.descricao_ia === 'string' && product.descricao_ia.trim()) {
    return product.descricao_ia.trim();
  }

  return typeof product.description === 'string' ? product.description.trim() : '';
}

/**
 * Monta o documento completo da foto para gravação no Firestore
 */
function buildFirestorePhotoDocument(product, {
  base64Data,
  contentType = 'image/jpeg',
  source = 'WEBSITE_DIRECT',
  index = 0,
} = {}) {
  const id = String(product.id || `prod-${Date.now()}`);
  const imageDocId = index > 0 ? `img_${id}_${index}` : `img_${id}`;
  const productName = product.name || product.descricao || 'Produto Conflora';
  const nameSuffix = index > 0 ? `_${index}` : '';
  const fileName = generateStandardPhotoName(productName, id + nameSuffix, contentType.includes('png') ? 'png' : 'jpg');
  const { tagsList, tagsString } = generateStandardTags(product);
  const description = generateStandardDescription(product);
  const now = new Date().toISOString();

  if (!base64Data) throw new Error('Envie uma foto real do produto.');
  const finalBase64 = base64Data;
  const finalContentType = contentType;
  const dataUrl = `data:${finalContentType};base64,${finalBase64}`;

  return {
    id: imageDocId,
    productId: id,
    index,
    fileName,
    name: fileName,
    title: productName,
    tags: tagsList,
    tagsAi: tagsString,
    tags_ia: tagsString,
    descriptionAi: description,
    descricao_ia: description,
    contentType: finalContentType,
    data: finalBase64,
    dataUrl,
    sizeBytes: Buffer.byteLength(finalBase64, 'base64'),
    source,
  storageLocation: 'firebase-storage',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Monta o documento completo da foto otimizando e comprimindo previamente no servidor
 */
async function buildOptimizedFirestorePhotoDocument(product, options = {}) {
  let base64Data = options.base64Data;
  let contentType = options.contentType || 'image/jpeg';
  let compressionStats = null;

  const { compressImageBase64 } = require('./image-compressor');

  if (!options.preserveOriginal && base64Data && typeof base64Data === 'string' && !base64Data.includes('<svg') && !base64Data.startsWith('PHN2Zy')) {
    const comp = await compressImageBase64(base64Data, {
      contentType,
      maxWidth: options.maxWidth,
      maxHeight: options.maxHeight,
      quality: options.quality,
      format: options.format,
      preserveZoomQuality: options.preserveZoomQuality !== false,
    });
    if (comp.wasCompressed) {
      base64Data = comp.base64;
      contentType = comp.contentType;
      compressionStats = {
        originalSizeBytes: comp.originalSizeBytes,
        compressedSizeBytes: comp.compressedSizeBytes,
        savingsPercent: comp.savingsPercent,
        width: comp.width,
        height: comp.height,
      };
    }
  }

  const doc = buildFirestorePhotoDocument(product, {
    ...options,
    base64Data,
    contentType,
    index: options.index || 0,
  });

  if (compressionStats) {
    doc.compression = compressionStats;
    doc.width = compressionStats.width;
    doc.height = compressionStats.height;
  }

  return doc;
}

/**
 * Monta e otimiza uma lista de documentos de fotos para um produto
 */
async function buildMultipleOptimizedFirestorePhotoDocuments(product, photos = [], options = {}) {
  if (!Array.isArray(photos)) {
    return [];
  }
  const results = [];
  for (let i = 0; i < photos.length; i++) {
    const item = photos[i];
    const photoBase64 = typeof item === 'string' ? item : item.photoBase64 || item.base64 || item.data;
    const itemContentType = typeof item === 'object' ? item.contentType : undefined;
    const doc = await buildOptimizedFirestorePhotoDocument(product, {
      ...options,
      base64Data: photoBase64,
      contentType: itemContentType || options.contentType,
      index: i,
    });
    results.push(doc);
  }
  return results;
}

const {
  PRESETS: IMAGE_PRESETS,
  compressImageBuffer,
  compressImageBase64,
  compressProductPhoto,
  getImageMetadata,
} = require('./image-compressor');

module.exports = {
  slugify,
  generateStandardPhotoName,
  generateStandardTags,
  generateStandardDescription,
  buildFirestorePhotoDocument,
  buildOptimizedFirestorePhotoDocument,
  buildMultipleOptimizedFirestorePhotoDocuments,
  IMAGE_PRESETS,
  compressImageBuffer,
  compressImageBase64,
  compressProductPhoto,
  getImageMetadata,
};
