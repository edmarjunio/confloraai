const crypto = require('node:crypto');
const path = require('node:path');
const config = require('../config/env');

const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

function getStorageBucket() {
  const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
  const { getStorage } = require('firebase-admin/storage');
  const appName = 'conflora-product-images';
  const app = getApps().find((entry) => entry.name === appName) || initializeApp({
    projectId: config.firebase.projectId,
    storageBucket: config.firebase.storageBucket,
    credential: config.gcp.keyFilename ? cert(config.gcp.keyFilename) : applicationDefault(),
  }, appName);

  return getStorage(app).bucket(config.firebase.storageBucket);
}

function normalizeFileName(fileName, contentType) {
  const extension = IMAGE_EXTENSIONS[contentType] || 'jpg';
  const baseName = path.basename(String(fileName || 'product'))
    .replace(/\.[^.]*$/, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';

  return `${baseName}.${extension}`;
}

async function uploadProductImage({ productId, fileName, buffer, contentType }) {
  if (!productId || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Produto e conteúdo válido são obrigatórios para salvar a imagem.');
  }

  const safeProductId = String(productId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const timestamp = Date.now();
  const imagePath = `products/${safeProductId}/${timestamp}-${crypto.randomUUID()}-${normalizeFileName(fileName, contentType)}`;
  const bucket = getStorageBucket();
  const downloadToken = crypto.randomUUID();
  const file = bucket.file(imagePath);

  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType: contentType || 'image/jpeg',
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  return {
    imagePath,
    imageUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(imagePath)}?alt=media&token=${downloadToken}`,
  };
}

async function deleteProductImage(imagePath) {
  if (!imagePath) {
    return false;
  }
  if (typeof imagePath !== 'string' || !/^products\/[a-zA-Z0-9_-]+\/[^/]+$/.test(imagePath)) {
    throw new Error('Caminho de imagem de produto inválido.');
  }

  try {
    await getStorageBucket().file(imagePath).delete();
    return true;
  } catch (error) {
    if (
      error.code === 404 ||
      error.code === '404' ||
      error.code === 'NotFound' ||
      error.name === 'NotFound' ||
      error.code === 'storage/object-not-found' ||
      error.statusCode === 404
    ) {
      return false;
    }
    throw error;
  }
}

module.exports = { uploadProductImage, deleteProductImage };
