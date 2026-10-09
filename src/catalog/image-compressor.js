const Logger = require('../shared/logger');

let sharpInstance = null;
try {
  sharpInstance = require('sharp');
} catch (err) {
  Logger.warn('sharp não disponível no ambiente atual, fallback para armazenamento original de imagens', {
    error: err.message,
  });
}

/**
 * Presets de compressão e redimensionamento para fotos de produtos Conflora
 */
const PRESETS = {
  CATALOG: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 80,
    format: 'jpeg',
    mozjpeg: true,
  },
  ZOOM_HD: {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 88,
    format: 'jpeg',
    mozjpeg: true,
  },
  FULL_HD: {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 86,
    format: 'jpeg',
    mozjpeg: true,
  },
  THUMBNAIL: {
    maxWidth: 320,
    maxHeight: 320,
    quality: 75,
    format: 'jpeg',
    mozjpeg: true,
  },
  HD: {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 85,
    format: 'jpeg',
    mozjpeg: true,
  },
  WEBP: {
    maxWidth: 800,
    maxHeight: 800,
    quality: 80,
    format: 'webp',
  },
};

/**
 * Remove cabeçalho Data URL de uma string base64 se houver
 */
function stripDataUrlPrefix(data) {
  if (typeof data !== 'string') {
    return '';
  }
  return data.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
}

/**
 * Extrai o MIME type de uma string Data URL se disponível
 */
function extractMimeType(data, fallback = 'image/jpeg') {
  if (typeof data !== 'string') {
    return fallback;
  }
  const match = data.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
  return match ? match[1] : fallback;
}

/**
 * Obtém metadados de uma imagem (largura, altura, formato)
 */
async function getImageMetadata(input) {
  if (!sharpInstance || !input) {
    return null;
  }
  try {
    let buf;
    if (Buffer.isBuffer(input)) {
      buf = input;
    } else if (typeof input === 'string') {
      buf = Buffer.from(stripDataUrlPrefix(input), 'base64');
    } else {
      return null;
    }
    const meta = await sharpInstance(buf).metadata();
    return {
      width: meta.width,
      height: meta.height,
      format: meta.format,
      sizeBytes: buf.length,
      channels: meta.channels,
      space: meta.space,
      hasAlpha: meta.hasAlpha,
    };
  } catch {
    return null;
  }
}

/**
 * Comprime e redimensiona um Buffer de imagem no lado do servidor
 *
 * @param {Buffer} inputBuffer - Buffer original da imagem
 * @param {Object} [options] - Parâmetros de otimização
 * @param {number} [options.maxWidth=800] - Largura máxima em pixels
 * @param {number} [options.maxHeight=800] - Altura máxima em pixels
 * @param {number} [options.quality=80] - Qualidade de compressão (1-100)
 * @param {'jpeg'|'webp'|'png'} [options.format='jpeg'] - Formato de saída
 * @param {number} [options.minSizeBytesToCompress=1024] - Tamanho mínimo para disparar compressão
 * @returns {Promise<Object>} Resultado da compressão com estatísticas
 */
async function compressImageBuffer(inputBuffer, options = {}) {
  const originalSize = inputBuffer ? inputBuffer.length : 0;
  const defaultFormat = options.format || 'jpeg';
  const defaultMime = defaultFormat === 'webp' ? 'image/webp' : defaultFormat === 'png' ? 'image/png' : 'image/jpeg';

  const defaultResult = {
    buffer: inputBuffer,
    base64: inputBuffer ? inputBuffer.toString('base64') : '',
    dataUrl: inputBuffer ? `data:${defaultMime};base64,${inputBuffer.toString('base64')}` : '',
    contentType: defaultMime,
    width: null,
    height: null,
    format: defaultFormat,
    originalSizeBytes: originalSize,
    compressedSizeBytes: originalSize,
    savingsRatio: 0,
    savingsPercent: 0,
    wasCompressed: false,
  };

  if (!sharpInstance || !inputBuffer || !Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    return defaultResult;
  }

  // Se for SVG, não rasteriza
  const isSvg =
    inputBuffer.slice(0, 100).toString('utf8').includes('<svg') ||
    inputBuffer.slice(0, 100).toString('utf8').includes('<?xml');
  if (isSvg) {
    return {
      ...defaultResult,
      contentType: 'image/svg+xml',
      format: 'svg',
    };
  }

  // Não comprime buffers minúsculos (ex: fixtures de teste 1x1 pixel ou ícones menores que 1KB)
  const minSizeBytes = options.minSizeBytesToCompress ?? 1024;
  if (originalSize < minSizeBytes) {
    return defaultResult;
  }

  const basePreset = options.preserveZoomQuality !== false ? PRESETS.ZOOM_HD : PRESETS.CATALOG;
  const maxWidth = options.maxWidth || basePreset.maxWidth;
  const maxHeight = options.maxHeight || basePreset.maxHeight;
  const quality = options.quality || basePreset.quality;
  const targetFormat = (options.format || 'jpeg').toLowerCase();

  try {
    let pipeline = sharpInstance(inputBuffer, { failOnError: false })
      .rotate() // Auto-orienta com base nos metadados EXIF da câmera
      .resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });

    let mimeType = 'image/jpeg';
    if (targetFormat === 'webp') {
      pipeline = pipeline.webp({ quality, effort: 4 });
      mimeType = 'image/webp';
    } else if (targetFormat === 'png') {
      pipeline = pipeline.png({ compressionLevel: 8, palette: true });
      mimeType = 'image/png';
    } else {
      pipeline = pipeline.jpeg({
        quality,
        mozjpeg: true,
        chromaSubsampling: '4:2:0',
      });
      mimeType = 'image/jpeg';
    }

    let { data: outputBuffer, info } = await pipeline.toBuffer({ resolveWithObject: true });

    // Salvaguarda Firestore: limite estrito de 1MB por documento.
    // Se a foto binária comprimida passar de 600KB (~800KB em Base64),
    // reduz suavemente mantendo máxima nitidez para zoom sem estourar o limite.
    const MAX_FIRESTORE_SAFE_BYTES = 600000;
    if (outputBuffer.length > MAX_FIRESTORE_SAFE_BYTES) {
      try {
        const safeWidth = Math.min(maxWidth, 1400);
        const safeHeight = Math.min(maxHeight, 1400);
        const safeQuality = Math.max(76, quality - 8);
        const pass2 = await sharpInstance(inputBuffer, { failOnError: false })
          .rotate()
          .resize(safeWidth, safeHeight, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: safeQuality, mozjpeg: true, chromaSubsampling: '4:2:0' })
          .toBuffer({ resolveWithObject: true });
        if (pass2.data.length < outputBuffer.length) {
          outputBuffer = pass2.data;
          info = pass2.info;
        }
      } catch {}
    }

    // Se o buffer comprimido acabou ficando maior que o original, mantém o original
    if (outputBuffer.length >= originalSize) {
      return {
        ...defaultResult,
        width: info.width || null,
        height: info.height || null,
        format: info.format || targetFormat,
      };
    }

    const compressedSize = outputBuffer.length;
    const savingsRatio = Math.max(0, 1 - compressedSize / originalSize);
    const savingsPercent = Math.round(savingsRatio * 100);
    const base64 = outputBuffer.toString('base64');

    return {
      buffer: outputBuffer,
      base64,
      dataUrl: `data:${mimeType};base64,${base64}`,
      contentType: mimeType,
      width: info.width,
      height: info.height,
      format: info.format || targetFormat,
      originalSizeBytes: originalSize,
      compressedSizeBytes: compressedSize,
      savingsRatio,
      savingsPercent,
      wasCompressed: true,
    };
  } catch (err) {
    Logger.warn('Falha na compressão da imagem via sharp, mantendo buffer original', {
      error: err.message,
    });
    return defaultResult;
  }
}

/**
 * Comprime e otimiza uma imagem em formato Base64 ou Data URL
 *
 * @param {string} base64String - String base64 ou data:image/...;base64,...
 * @param {Object} [options] - Parâmetros de otimização
 * @returns {Promise<Object>} Resultado com string base64 otimizada e metadados
 */
async function compressImageBase64(base64String, options = {}) {
  if (!base64String || typeof base64String !== 'string') {
    return {
      base64: '',
      dataUrl: '',
      contentType: options.contentType || 'image/jpeg',
      originalSizeBytes: 0,
      compressedSizeBytes: 0,
      savingsPercent: 0,
      wasCompressed: false,
    };
  }

  const cleanBase64 = stripDataUrlPrefix(base64String);
  const detectedMime = extractMimeType(base64String, options.contentType || 'image/jpeg');
  const buffer = Buffer.from(cleanBase64, 'base64');
  const targetFormat = options.format || (detectedMime.includes('webp') ? 'webp' : 'jpeg');

  const result = await compressImageBuffer(buffer, {
    format: targetFormat,
    ...options,
  });

  return result;
}

/**
 * Otimiza um documento de foto de produto do Firestore
 * Se o documento contiver foto em base64, comprime-o e anexa os metadados
 *
 * @param {Object} photoDoc - Documento montado por buildFirestorePhotoDocument
 * @param {Object} [options] - Opções de compressão
 * @returns {Promise<Object>} Documento atualizado e comprimido
 */
async function compressProductPhoto(photoDoc, options = {}) {
  if (!photoDoc || !photoDoc.data || typeof photoDoc.data !== 'string') {
    return photoDoc;
  }

  // Não comprime SVGs
  if (photoDoc.contentType === 'image/svg+xml' || photoDoc.data.includes('PHN2Zy')) {
    return photoDoc;
  }

  const compressed = await compressImageBase64(photoDoc.data, {
    ...options,
    contentType: photoDoc.contentType || 'image/jpeg',
  });

  if (!compressed.wasCompressed) {
    return photoDoc;
  }

  return {
    ...photoDoc,
    data: compressed.base64,
    dataUrl: compressed.dataUrl,
    contentType: compressed.contentType,
    sizeBytes: compressed.compressedSizeBytes,
    width: compressed.width,
    height: compressed.height,
    compression: {
      originalSizeBytes: compressed.originalSizeBytes,
      compressedSizeBytes: compressed.compressedSizeBytes,
      savingsPercent: compressed.savingsPercent,
      width: compressed.width,
      height: compressed.height,
      optimizedAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  PRESETS,
  stripDataUrlPrefix,
  extractMimeType,
  getImageMetadata,
  compressImageBuffer,
  compressImageBase64,
  compressProductPhoto,
};
