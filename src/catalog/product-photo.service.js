const { normalizeText } = require('../shared/string.util');

/**
 * Conflora Standard Botanical & Agricultural Keyword Dictionary
 * Mapeamento enriquecido para manter o mesmo padrão de tags e nomes da Conflora
 */
const BOTANICAL_TAG_DICTIONARY = {
  'rabo de raposa': ['wodyetia bifurcata', 'palmeira australiana', 'paisagismo', 'sol pleno'],
  'palmeira azul': ['bismarckia nobilis', 'palmeira bismarckia', 'palmeira de bismarck', 'ornamental azul'],
  'bismarckia': ['bismarckia nobilis', 'palmeira azul', 'paisagismo nobre'],
  'areca': ['dypsis lutescens', 'areca bambu', 'cerca viva', 'meia sombra'],
  'bouganville': ['tres marias', 'três marias', 'flor de papel', 'primavera', 'bougainvillea', 'trepadeira'],
  'primavera': ['bougainvillea', 'tres marias', 'flor de papel', 'trepadeira florida'],
  'alface': ['horta fresca', 'salada', 'folhosas', 'sem agrotoxico', 'hidroponica'],
  'rucula': ['salada', 'horta fresca', 'folhosa picante', 'sem agrotoxico'],
  'cebolinha': ['cheiro verde', 'tempero fresco', 'horta caseira', 'aromaticas'],
  'coentro': ['cheiro verde', 'tempero nordestino', 'horta fresca'],
  'hortela': ['cha medicinal', 'tempero', 'aromatica'],
  'manjericao': ['erva fina', 'tempero italiano', 'pesto', 'aromatica'],
  'couve': ['couve manteiga', 'folhosa verde', 'suco verde', 'horta'],
  'mini cabra': ['caprino pet', 'bode anao', 'animal docil', 'sitio e chacara'],
  'jabuticaba': ['plinia cauliflora', 'frutifera nativa', 'muda enxertada', 'produzindo'],
  'laranja': ['citricos', 'fruta doce', 'muda enxertada', 'pomar'],
  'limao': ['citrico', 'limao taiti', 'tempero', 'pomar'],
  'amora': ['frutas vermelhas', 'muda enxertada', 'pomar'],
  'abacate': ['fruta', 'hortifruti', 'cremoso'],
  'abacaxi': ['fruta tropical', 'hortifruti', 'doce'],
  'banana': ['fruta', 'potassio', 'hortifruti'],
  'cenoura': ['legume', 'hortifruti', 'rico em vitamina a'],
  'batata': ['tuberculo', 'hortifruti', 'raiz'],
  'cebola': ['tempero', 'condimento', 'hortifruti'],
  'tomate': ['legume', 'salada', 'hortifruti'],
  'eucalipto': ['agromadeira', 'madeira tratada', 'poste', 'mourao', 'cerca rural'],
  'mourao': ['agromadeira', 'poste de cerca', 'madeira roliça', 'rural'],
  'grama': ['gramado', 'jardim', 'paisagismo', 'tapete de grama'],
  'adubo': ['fertilizante organico', 'substrato', 'nutrientes', 'terra vegetal'],
  'terra': ['terra vegetal', 'substrato fertil', 'adubo'],
  'rosa do deserto': ['adenium obesum', 'suculenta com flor', 'cacto ornamental'],
  'costela': ['monstera deliciosa', 'costela de adao', 'folhagem interna'],
  'zamioculca': ['planta de sombra', 'planta resistente', 'decoracao interna'],
  'samambaia': ['planta pendente', 'meia sombra', 'avenca'],
  'orquidea': ['flor nobre', 'phalaenopsis', 'epifita'],
};

/**
 * Normaliza um texto para slug sem caracteres especiais
 * Exemplo: "Palmeira Rabo de Raposa (Muda Média)" -> "palmeira-rabo-de-raposa-muda-media"
 */
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

  // 3. Enriquecimento botânico/agrícola baseado no dicionário Conflora
  const normalizedFullName = normalizeText(`${name} ${category} ${subcategory}`);
  for (const [key, extraTags] of Object.entries(BOTANICAL_TAG_DICTIONARY)) {
    const normKey = normalizeText(key);
    if (normalizedFullName.includes(normKey)) {
      extraTags.forEach((t) => tagsSet.add(t.toLowerCase()));
    }
  }

  // 4. Se o usuário já tiver tags salvas anteriormente, preserva-as
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

  const name = product.name || product.descricao || 'Produto Conflora';
  const cat = product.category || product.categoria || 'Viveiro e Horta';
  const sub = product.subcategory || product.subcategoria || '';
  const subText = sub ? ` (${sub})` : '';

  return `${name} selecionado(a) com padrão de qualidade Conflora Horta & Viveiro${subText}. Categoria: ${cat}.`;
}

/**
 * Detecta se uma string representa um caminho ou link do Google Drive / AppSheet
 */
function isGoogleDrivePath(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const str = value.trim();

  // Links do Google Drive
  if (str.includes('drive.google.com') || str.includes('docs.google.com')) {
    return true;
  }

  // IDs explícitos de arquivos Drive
  if (str.startsWith('drive-file-') || str.startsWith('drive:')) {
    return true;
  }

  // Pastas típicas do AppSheet integradas com o Drive
  if (
    /^(?:Produtos_Images|Images|Files|appsheet\/data|Imagens|Fotos|conflora_drive)\//i.test(str)
  ) {
    return true;
  }

  // Nomes de arquivo de imagem soltos vindos de planilhas locais/Drive (ex: "311428b7.jpg")
  if (/^[a-zA-Z0-9_\-./\\]+\.(?:jpe?g|png|webp|gif|bmp)$/i.test(str) && !str.startsWith('http://') && !str.startsWith('https://')) {
    return true;
  }

  return false;
}

/**
 * Extrai o ID do arquivo do Google Drive a partir de uma URL ou string
 */
function extractDriveFileId(value) {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const str = value.trim();

  const idMatch =
    str.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
    str.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
    str.match(/^drive-file-([a-zA-Z0-9_-]+)/);

  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  return null;
}

/**
 * Imagem fallback SVG codificada em base64 com identidade visual oficial da Conflora
 */
function createConfloraSvgFallback(name = 'Conflora', category = 'Viveiro') {
  const safeName = String(name).replace(/[<>&"]/g, '');
  const safeCat = String(category).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#14532d"/>
        <stop offset="100%" stop-color="#15803d"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="300" cy="240" r="120" fill="#22c55e" opacity="0.25"/>
    <text x="300" y="270" font-family="-apple-system, sans-serif" font-size="90" text-anchor="middle" fill="#dcfce7">🌱</text>
    <text x="300" y="400" font-family="-apple-system, sans-serif" font-size="28" font-weight="bold" text-anchor="middle" fill="#ffffff">${safeName.slice(0, 30)}</text>
    <text x="300" y="440" font-family="-apple-system, sans-serif" font-size="18" text-anchor="middle" fill="#bbf7d0">${safeCat} • Conflora Horta &amp; Viveiro</text>
  </svg>`;
  return Buffer.from(svg).toString('base64');
}

/**
 * Monta o documento completo da foto para gravação no Firestore
 */
function buildFirestorePhotoDocument(product, {
  base64Data,
  contentType = 'image/jpeg',
  originalPath = null,
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

  const finalBase64 = base64Data || createConfloraSvgFallback(productName, product.category || product.categoria);
  const finalContentType = base64Data ? contentType : 'image/svg+xml';
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
    sizeBytes: Buffer.byteLength(finalBase64, 'utf8'),
    source,
    originalDrivePath: originalPath || null,
    storageLocation: 'firestore:product_images',
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

  if (base64Data && typeof base64Data === 'string' && !base64Data.includes('<svg') && !base64Data.startsWith('PHN2Zy')) {
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
  BOTANICAL_TAG_DICTIONARY,
  slugify,
  generateStandardPhotoName,
  generateStandardTags,
  generateStandardDescription,
  isGoogleDrivePath,
  extractDriveFileId,
  createConfloraSvgFallback,
  buildFirestorePhotoDocument,
  buildOptimizedFirestorePhotoDocument,
  buildMultipleOptimizedFirestorePhotoDocuments,
  IMAGE_PRESETS,
  compressImageBuffer,
  compressImageBase64,
  compressProductPhoto,
  getImageMetadata,
};
