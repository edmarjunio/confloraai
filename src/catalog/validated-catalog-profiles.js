const fs = require('node:fs');
const path = require('node:path');

function normalizeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

let cachedCatalog = null;
let cachedById = null;
let cachedByName = null;

function ensureLoaded() {
  if (cachedCatalog) return;
  const catalogPath = path.resolve(__dirname, '../../config/stores/conflora-validated-catalog.json');
  try {
    const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    cachedCatalog = Array.isArray(raw) ? raw : [];
  } catch {
    cachedCatalog = [];
  }
  cachedById = new Map();
  cachedByName = new Map();
  for (const item of cachedCatalog) {
    if (item && item.id) {
      cachedById.set(String(item.id).trim(), item);
    }
    const norm = normalizeKey(item?.name || item?.canonicalName || item?.descricao || '');
    if (norm && !cachedByName.has(norm)) {
      cachedByName.set(norm, item);
    }
  }
}

function getValidatedCatalogSnapshot() {
  ensureLoaded();
  return cachedCatalog.map((item) => ({ ...item }));
}

function getValidatedProfileById(id) {
  if (!id) return null;
  ensureLoaded();
  return cachedById.get(String(id).trim()) || null;
}

function getValidatedProfileByName(name) {
  const norm = normalizeKey(name);
  if (!norm) return null;
  ensureLoaded();
  return cachedByName.get(norm) || null;
}

/**
 * Enriches a Firestore/catalog product record with validated Conflora photos,
 * descriptions, care instructions, and technical specifications when the product
 * belongs to the Conflora catalog (`prd-...`) or when fields are missing.
 */
function enrichWithValidatedProfile(item) {
  if (!item || typeof item !== 'object') return item;
  const id = String(item.id || '').trim();
  const isConfloraSku = /^prd-[a-f0-9]{32}$/i.test(id);
  const profile = isConfloraSku ? (getValidatedProfileById(id) || getValidatedProfileByName(item.name || item.descricao)) : null;
  if (!profile) return item;

  const hasCustomImage =
    typeof item.imageUrl === 'string' &&
    item.imageUrl.trim() &&
    !item.imageUrl.includes('placeholder.svg') &&
    /^https:\/\/(?:firebasestorage|storage)\.googleapis\.com\//i.test(item.imageUrl.trim());

  const resolvedImageUrl = hasCustomImage ? item.imageUrl.trim() : (profile.imageUrl || item.imageUrl || '');
  const resolvedImages = hasCustomImage && Array.isArray(item.images) && item.images.length > 0
    ? item.images
    : (Array.isArray(profile.images) && profile.images.length > 0 ? profile.images : (resolvedImageUrl ? [resolvedImageUrl] : []));

  return {
    ...profile,
    ...item,
    productType: item.productType || profile.productType || '',
    imageUrl: resolvedImageUrl,
    imagePathCache: resolvedImageUrl,
    images: resolvedImages,
    description: item.description && item.description.length > 30 ? item.description : (profile.description || item.description || ''),
    descriptionAi: item.descriptionAi && item.descriptionAi.length > 30 ? item.descriptionAi : (profile.descriptionAi || profile.description || ''),
    descricao_ia: item.descricao_ia && item.descricao_ia.length > 30 ? item.descricao_ia : (profile.descricao_ia || profile.description || ''),
    cuidados_basicos: item.cuidados_basicos || profile.cuidados_basicos || '',
    careInstructions: item.careInstructions || profile.careInstructions || profile.cuidados_basicos || '',
    ambiente_ideal: item.ambiente_ideal || profile.ambiente_ideal || '',
    housing: item.housing || profile.housing || '',
    iluminacao: item.iluminacao || profile.iluminacao || '',
    illumination: item.illumination || profile.illumination || profile.iluminacao || '',
    rega: item.rega || profile.rega || '',
    watering: item.watering || profile.watering || profile.rega || '',
    alimentacao: item.alimentacao || profile.alimentacao || '',
    feeding: item.feeding || profile.feeding || profile.alimentacao || '',
    manejo: item.manejo || profile.manejo || '',
    handling: item.handling || profile.handling || profile.manejo || '',
    alimentos_proibidos: item.alimentos_proibidos || profile.alimentos_proibidos || '',
    prohibitedFoods: item.prohibitedFoods || profile.prohibitedFoods || profile.alimentos_proibidos || '',
    preferences: item.preferences || profile.preferences || '',
    dislikes: item.dislikes || profile.dislikes || '',
    dicas_armazenamento: item.dicas_armazenamento || profile.dicas_armazenamento || '',
    storageTips: item.storageTips || profile.storageTips || profile.dicas_armazenamento || '',
    durabilidade: item.durabilidade || profile.durabilidade || '',
    durability: item.durability || profile.durability || profile.durabilidade || '',
    usage: item.usage || profile.usage || '',
    suitability: item.suitability || profile.suitability || '',
    matureSize: item.matureSize || profile.matureSize || '',
    precautions: item.precautions || profile.precautions || '',
    selectionTips: item.selectionTips || profile.selectionTips || '',
    botanical: item.botanical || profile.botanical || undefined,
    especificacoes: (item.especificacoes && Object.keys(item.especificacoes).length > 0) ? item.especificacoes : (profile.especificacoes || {}),
    specifications: (item.specifications && Object.keys(item.specifications).length > 0) ? item.specifications : (profile.specifications || {}),
    tags: (Array.isArray(item.tags) && item.tags.length > 0) ? item.tags : (profile.tags || []),
    tagsAi: item.tagsAi || profile.tagsAi || '',
    tags_ia: item.tags_ia || profile.tags_ia || '',
  };
}

module.exports = {
  normalizeKey,
  getValidatedCatalogSnapshot,
  getValidatedProfileById,
  getValidatedProfileByName,
  enrichWithValidatedProfile,
};
