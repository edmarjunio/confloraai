const path = require('node:path');
const fs = require('node:fs/promises');
const Logger = require('../shared/logger');
const { buildOptimizedFirestorePhotoDocument } = require('./product-photo.service');
const { uploadProductImage } = require('./product-image-storage');

class ImageMigrationService {
  constructor({ firestoreRepo = null, storage = null } = {}) {
    this.firestoreRepo = firestoreRepo;
    this.storage = storage || { uploadProductImage };
  }

  /**
   * Classifica o status de uma imagem do catálogo
   */
  classifyImageStatus(product, imageUrl) {
    if (!imageUrl || imageUrl.includes('placeholder.svg')) {
      return 'IMAGE_MISSING';
    }

    const url = String(imageUrl).trim();

    if (/^https:\/\/(?:firebasestorage|storage)\.googleapis\.com\//i.test(url) || /^gs:\/\//i.test(url)) {
      return 'STORAGE_VALIDATED';
    }

    if (/^\/store-assets\/products\//i.test(url) || /^\/api\/images\//i.test(url)) {
      return 'LOCAL_APPROVED';
    }

    if (/^https:\/\/(?:inaturalist-open-data\.s3\.amazonaws\.com|static\.inaturalist\.org)\//i.test(url) ||
        /^https:\/\/images\.unsplash\.com\//i.test(url)) {
      return 'EXTERNAL_APPROVED';
    }

    if (/^https?:\/\//i.test(url)) {
      return 'LICENSE_REVIEW_REQUIRED';
    }

    return 'BROKEN_REFERENCE';
  }

  /**
   * Verifica se a imagem do produto foi enviada/editada manualmente
   */
  isManualPhoto(product) {
    if (!product) return false;
    return (
      product.source === 'WEBSITE_DIRECT' ||
      product.source === 'MANUAL' ||
      Boolean(product.imageFileId) ||
      Boolean(product.manualPhoto)
    );
  }

  /**
   * Executa auditoria completa do catálogo de produtos
   */
  async auditCatalog(products = [], _validatedCatalogJson = []) {
    const report = [];
    const stats = {
      totalProducts: products.length,
      STORAGE_VALIDATED: 0,
      LOCAL_APPROVED: 0,
      EXTERNAL_APPROVED: 0,
      LICENSE_REVIEW_REQUIRED: 0,
      SPECIES_REVIEW_REQUIRED: 0,
      IMAGE_MISSING: 0,
      DUPLICATE: 0,
      BROKEN_REFERENCE: 0,
      manualPhotosProtected: 0,
    };

    const imageUrlCounts = new Map();

    // Contagem de duplicações de imagem entre produtos
    for (const prod of products) {
      const img = prod.imageUrl || prod.imageurl || '';
      if (img && !img.includes('placeholder.svg')) {
        imageUrlCounts.set(img, (imageUrlCounts.get(img) || 0) + 1);
      }
    }

    for (const prod of products) {
      const id = String(prod.id);
      const name = prod.name || prod.descricao || 'Produto sem nome';
      const category = prod.category || prod.categoria || 'Geral';
      const primaryUrl = prod.imageUrl || prod.imageurl || prod.imagePathCache || '';
      const isManual = this.isManualPhoto(prod);

      if (isManual) {
        stats.manualPhotosProtected++;
      }

      let status = this.classifyImageStatus(prod, primaryUrl);

      if (status !== 'IMAGE_MISSING' && (imageUrlCounts.get(primaryUrl) || 0) > 3) {
        status = 'DUPLICATE';
        stats.DUPLICATE++;
      } else {
        stats[status] = (stats[status] || 0) + 1;
      }

      report.push({
        sku: id,
        productName: name,
        category,
        currentImageUrl: primaryUrl || 'N/A',
        status,
        isManualProtected: isManual,
        proposedStoragePath: `products/${id.replace(/[^a-zA-Z0-9_-]/g, '_')}/main.jpg`,
      });
    }

    return {
      stats,
      inventoryReport: report,
    };
  }

  /**
   * Processa migração de lote de produtos (suporta dry-run)
   */
  async processMigrationBatch(products = [], { dryRun = true, maxItems = 100 } = {}) {
    const itemsToProcess = products.slice(0, maxItems);
    const results = [];

    for (const prod of itemsToProcess) {
      const id = String(prod.id);
      const name = prod.name || prod.descricao || 'Produto';
      const primaryUrl = prod.imageUrl || prod.imageurl || '';
      const isManual = this.isManualPhoto(prod);

      // REGRA ABSOLUTA: Foto manual protegida nunca é sobrescrita por IA
      if (isManual) {
        results.push({
          sku: id,
          productName: name,
          action: 'SKIPPED_MANUAL_PROTECTED',
          currentUrl: primaryUrl,
          success: true,
        });
        continue;
      }

      const status = this.classifyImageStatus(prod, primaryUrl);

      if (status === 'STORAGE_VALIDATED') {
        results.push({
          sku: id,
          productName: name,
          action: 'ALREADY_VALIDATED_IN_STORAGE',
          currentUrl: primaryUrl,
          success: true,
        });
        continue;
      }

      if (dryRun) {
        results.push({
          sku: id,
          productName: name,
          action: 'DRY_RUN_WOULD_MIGRATE',
          currentUrl: primaryUrl,
          proposedStoragePath: `products/${id.replace(/[^a-zA-Z0-9_-]/g, '_')}/migrated.jpg`,
          success: true,
        });
        continue;
      }

      // Execução real somente se não for dryRun
      try {
        if (status === 'LOCAL_APPROVED' && primaryUrl.startsWith('/store-assets/')) {
          const localPath = path.resolve(__dirname, '../../public', primaryUrl.replace(/^\//, ''));
          const buffer = await fs.readFile(localPath);
          const photoDoc = await buildOptimizedFirestorePhotoDocument(prod, {
            base64Data: buffer.toString('base64'),
            contentType: 'image/jpeg',
            source: 'MIGRATED_LOCAL',
          });

          const uploadResult = await this.storage.uploadProductImage({
            productId: id,
            fileName: photoDoc.fileName,
            buffer,
            contentType: 'image/jpeg',
          });

          const updatedUrl = uploadResult.imageUrl;
          if (this.firestoreRepo?.saveProduct) {
            await this.firestoreRepo.saveProduct({
              ...prod,
              imageUrl: updatedUrl,
              imagePath: uploadResult.imagePath,
              imagePathCache: updatedUrl,
              updatedAt: new Date().toISOString(),
            });
          }

          results.push({
            sku: id,
            productName: name,
            action: 'MIGRATED_TO_STORAGE',
            newUrl: updatedUrl,
            success: true,
          });
        } else {
          results.push({
            sku: id,
            productName: name,
            action: 'REQUIRES_EXTERNAL_DOWNLOAD_APPROVAL',
            currentUrl: primaryUrl,
            success: false,
          });
        }
      } catch (err) {
        Logger.error(`Falha na migração da imagem do SKU ${id}`, err);
        results.push({
          sku: id,
          productName: name,
          action: 'ERROR',
          error: err.message,
          success: false,
        });
      }
    }

    return results;
  }
}

module.exports = { ImageMigrationService };
