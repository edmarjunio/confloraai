const { normalizeProductMedia, publicProductMedia } = require('./product-media');
// Historical API names retained for existing consumers and isolated tests.
// Authorization, origin and ordering are all decided by product-media.
function actualProductImages(product = {}) { return normalizeProductMedia(product).entries.map(entry => entry.url); }
function actualPhotoProvenance(user, storagePaths) {
  if (!user?.id || !['ADMIN', 'CAIXA'].includes(user.role)) throw Object.assign(new Error('Permissão necessária para registrar foto real do produto.'), { status: 403 });
  if (!Array.isArray(storagePaths) || !storagePaths.length || storagePaths.some(value => !/^products\/[a-zA-Z0-9_-]+\/[^/]+$/.test(value))) throw new Error('Caminhos de fotos reais inválidos.');
  return { kind: 'CONFLORA_ACTUAL_PRODUCT', confirmedBy: user.id, confirmedAt: new Date().toISOString(), storagePaths: [...new Set(storagePaths)] };
}
function actualProductPhotoFields(product) {
  const entries = normalizeProductMedia(product).entries;
  const images = entries.map(entry => entry.url), paths = entries.map(entry => entry.storagePath);
  const url = images[0] || '';
  const aliases = Object.fromEntries(['image', 'downloadURL', 'downloadUrl', 'foto', 'foto_url', 'imagem', 'imagemUrl', 'imagem_url',
    'urlImagem', 'url_imagem', 'photoURL', 'thumbnail', 'thumb', 'capa'].map(key => [key, url]));
  return { ...aliases, fotos: images, imagens: images, imageCandidates: images, fullPath: paths[0] || '',
    images, imageUrl: url, imageurl: url, imageURL: url, image_url: url, imagePathCache: url,
    imagePaths: paths, imagePath: paths[0] || '', storagePath: paths[0] || '', photoUrl: url, fotoUrl: url,
    imageFileId: images.length ? product.imageFileId || '' : '', image_file_id: images.length ? product.imageFileId || '' : '',
    imageIsIllustrative: false, actualPhotoPending: images.length === 0, media: publicProductMedia(product) };
}
module.exports = { actualProductImages, actualPhotoProvenance, actualProductPhotoFields };
