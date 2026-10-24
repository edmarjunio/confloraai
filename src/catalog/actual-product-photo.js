const config = require('../config/env');

/** Staff-attested photographs of the store's product, not a stock/reference/generated image. */
function actualProductImages(product = {}) {
  if (!product || typeof product !== 'object') return [];
  const proof = product.imageProvenance;
  if (proof?.kind !== 'CONFLORA_ACTUAL_PRODUCT' || !proof.confirmedBy || !proof.confirmedAt || !Array.isArray(proof.storagePaths) || product.imageIsIllustrative === true) return [];
  const productId = String(product.id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!productId) return [];
  const candidates = [product.imageUrl, ...(Array.isArray(product.images) ? product.images : [])];
  return [...new Set(candidates.map(value => typeof value === 'string' ? value : value?.url).filter(value => {
    try {
      const url = new URL(value);
      const prefix = `/v0/b/${config.firebase.storageBucket}/o/`;
      if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' || url.username || url.password || url.port || !url.pathname.startsWith(prefix)) return false;
      const objectPath = decodeURIComponent(url.pathname.slice(prefix.length));
      return proof.storagePaths.includes(objectPath) && objectPath.startsWith(`products/${productId}/`) && /^products\/[a-zA-Z0-9_-]+\/[^/]+$/.test(objectPath) && !objectPath.includes('..');
    } catch { return false; }
  }))];
}

function actualPhotoProvenance(user, storagePaths) {
  if (!user?.id || !['ADMIN', 'CAIXA'].includes(user.role)) throw Object.assign(new Error('Permissão necessária para registrar foto real do produto.'), { status: 403 });
  if (!Array.isArray(storagePaths) || !storagePaths.length || storagePaths.some(value => !/^products\/[a-zA-Z0-9_-]+\/[^/]+$/.test(value))) throw new Error('Caminhos de fotos reais inválidos.');
  return { kind: 'CONFLORA_ACTUAL_PRODUCT', confirmedBy: user.id, confirmedAt: new Date().toISOString(), storagePaths: [...new Set(storagePaths)] };
}

function actualProductPhotoFields(product) {
  const images = actualProductImages(product);
  const paths = images.map(value => decodeURIComponent(new URL(value).pathname.split('/o/')[1]));
  const url = images[0] || '';
  const aliases = Object.fromEntries(['image', 'downloadURL', 'downloadUrl', 'foto', 'foto_url', 'imagem', 'imagemUrl', 'imagem_url',
    'urlImagem', 'url_imagem', 'photoURL', 'thumbnail', 'thumb', 'capa'].map(key => [key, url]));
  return { ...aliases, fotos: images, imagens: images, imageCandidates: images, fullPath: paths[0] || '',
    images, imageUrl: url, imageurl: url, imageURL: url, image_url: url, imagePathCache: url,
    imagePaths: paths, imagePath: paths[0] || '', storagePath: paths[0] || '', photoUrl: url, fotoUrl: url,
    imageFileId: images.length ? product.imageFileId || '' : '', image_file_id: images.length ? product.imageFileId || '' : '',
    imageIsIllustrative: false, actualPhotoPending: images.length === 0 };
}

module.exports = { actualProductImages, actualPhotoProvenance, actualProductPhotoFields };
