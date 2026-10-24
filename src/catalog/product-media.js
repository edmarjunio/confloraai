const { createHash } = require('node:crypto');
const config = require('../config/env');
const { normalizeText } = require('../shared/string.util');
const PLACEHOLDER = '/store-assets/placeholder.svg';
const mediaIdentity = product => createHash('sha256').update(JSON.stringify([product.id, product.name || product.descricao,
  product.variation || product.variacao, product.species || product.especie].map(value => normalizeText(String(value || ''))))).digest('hex');
function safeHttps(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || url.hash ||
      !url.hostname.includes('.') || /(?:^|\.)(?:localhost|local|internal|test)$/.test(url.hostname) || /^\[|^[\d.]+$/.test(url.hostname)) return '';
    return url.href;
  } catch { return ''; }
}
function storageObjectPath(value, productId) {
  try {
    const url = new URL(value); const bucket = config.firebase.storageBucket;
    let objectPath = '';
    const firebasePrefix = `/v0/b/${bucket}/o/`;
    if (url.protocol === 'https:' && url.hostname === 'firebasestorage.googleapis.com' && url.pathname.startsWith(firebasePrefix)) objectPath = decodeURIComponent(url.pathname.slice(firebasePrefix.length));
    if (url.protocol === 'https:' && url.hostname === 'storage.googleapis.com' && url.pathname.startsWith(`/${bucket}/`)) objectPath = decodeURIComponent(url.pathname.slice(bucket.length + 2));
    const safeId = String(productId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    return safeId && objectPath.startsWith(`products/${safeId}/`) && /^products\/[a-zA-Z0-9_-]+\/[^/]+$/.test(objectPath) && !objectPath.includes('..') ? objectPath : '';
  } catch { return ''; }
}
function validProof(proof, product) {
  return proof?.confirmedBy && proof.confirmedAt && proof.productId === product.id && proof.productMatchConfirmed === true &&
    (!proof.productIdentity || proof.productIdentity === mediaIdentity(product));
}
function normalizeProductMedia(product = {}) {
  const entries = [], seen = new Set();
  const add = entry => { if (!seen.has(entry.url)) { seen.add(entry.url); entries.push(entry); } };
  for (const entry of product.productMedia?.version === 1 && Array.isArray(product.productMedia.entries) ? product.productMedia.entries.slice(0, 30) : []) {
    const url = safeHttps(entry.url), proof = entry.provenance;
    if (!url || !validProof(proof, product) || !['OWN_PHOTO', 'LICENSED_EXTERNAL'].includes(proof.kind)) continue;
    const objectPath = storageObjectPath(url, product.id);
    if (entry.source === 'FIREBASE_STORAGE' && objectPath && entry.storagePath === objectPath) {
      add({ url, source: 'FIREBASE_STORAGE', storagePath: objectPath, manual: proof.kind === 'OWN_PHOTO', provenance: proof });
    } else if (entry.source === 'EXTERNAL' &&
      ['CC0', 'PUBLIC_DOMAIN', 'CC_BY', 'PERMISSION', 'OWN_PHOTO'].includes(proof.license?.code) && safeHttps(proof.license.url) &&
      (proof.license.code !== 'CC_BY' || String(proof.license.attribution || '').trim())) {
      add({ url, source: 'EXTERNAL', storagePath: '', manual: proof.kind === 'OWN_PHOTO', provenance: proof });
    }
  }
  // Read-only compatibility: a known manual Storage photograph keeps its order
  // and is not reclassified merely because a migration once copied bytes.
  const legacy = product.imageProvenance;
  if (product.productMedia?.version !== 1 && legacy?.kind === 'CONFLORA_ACTUAL_PRODUCT' && legacy.confirmedBy && legacy.confirmedAt && product.imageIsIllustrative !== true && Array.isArray(legacy.storagePaths)) {
    for (const value of [product.imageUrl, ...(Array.isArray(product.images) ? product.images : [])]) {
      const url = safeHttps(typeof value === 'string' ? value : value?.url), storagePath = storageObjectPath(url, product.id);
      if (storagePath && legacy.storagePaths.includes(storagePath)) add({ url, source: 'FIREBASE_STORAGE', storagePath, manual: true,
        provenance: { kind: 'OWN_PHOTO', confirmedBy: legacy.confirmedBy, confirmedAt: legacy.confirmedAt, productId: product.id, productMatchConfirmed: true } });
    }
  }
  entries.sort((a, b) => Number(b.manual) - Number(a.manual));
  const primaryUrl = entries[0]?.url || '';
  return { version: 1, primaryUrl, entries, placeholderUrl: PLACEHOLDER, pending: !primaryUrl };
}
function publicProductMedia(product) {
  const media = normalizeProductMedia(product);
  return { version: 1, primaryUrl: media.primaryUrl, placeholderUrl: PLACEHOLDER, pending: media.pending,
    gallery: media.entries.map(entry => ({ url: entry.url, source: entry.source, attribution: entry.provenance.license?.attribution || '', licenseUrl: entry.provenance.license?.url || '' })) };
}
function reviewExternalMedia(input, product, actor) {
  if (!actor?.id || actor.role !== 'ADMIN') throw Object.assign(new Error('Revisão de mídia exige ADMIN.'), { status: 403 });
  if (!Array.isArray(input) || input.length > 20) throw Object.assign(new Error('Lista de mídia inválida.'), { status: 400 });
  return input.map(entry => {
    if (entry.rightsConfirmed !== true || entry.productMatchConfirmed !== true) throw Object.assign(new Error('Confirme licença e correspondência com o produto/variedade.'), { status: 400 });
    const result = { url: entry.url, source: 'EXTERNAL', storagePath: '', provenance: { kind: 'LICENSED_EXTERNAL', productId: product.id,
      productIdentity: mediaIdentity(product), productMatchConfirmed: true, confirmedBy: actor.id, confirmedAt: new Date().toISOString(),
      license: { code: entry.licenseCode, url: entry.licenseUrl, attribution: String(entry.attribution || '').trim().slice(0, 1000) } } };
    if (!normalizeProductMedia({ ...product, imageProvenance: null, productMedia: { version: 1, entries: [result] } }).entries.length) throw Object.assign(new Error('URL HTTPS ou licença de mídia inválida.'), { status: 400 });
    return result;
  });
}
module.exports = { normalizeProductMedia, publicProductMedia, reviewExternalMedia, storageObjectPath, mediaIdentity, PLACEHOLDER };
