const { TextEncoder } = require('node:util');
const { URL } = require('node:url');
const { safeUser } = require('../security/web-session');
const config = require('../config/env');
const Logger = require('../shared/logger');
const { productStatus } = require('../catalog/product-status');
const productImageStorageService = require('../catalog/product-image-storage');
const {
  getBusinessDate,
  getBusinessDateRange,
  summarizeDailyExecutiveMetrics,
} = require('../reports/daily-executive-metrics');
const {
  PAID_ORDER_STATUSES,
  validateOrderConfirmation,
  validateStockQuantity,
  remainingStock,
} = require('../orders/order-integrity');
const {
  generateStandardTags,
  generateStandardDescription,
  isGoogleDrivePath,
  buildFirestorePhotoDocument,
} = require('../catalog/product-photo.service');

function getProductImageEntries(product) {
  if (!product) {
    return [];
  }

  const urls = Array.isArray(product.images) && product.images.length > 0
    ? product.images.filter((url) => typeof url === 'string' && url)
    : (product.imageUrl ? [product.imageUrl] : []);
  const paths = Array.isArray(product.imagePaths) ? product.imagePaths : [];

  return urls.map((url, index) => ({
    url,
    path: paths[index] || (index === 0 ? product.imagePath : '') || '',
  }));
}

function getUpdatedProductImageEntries(product, previousProduct) {
  const previousPathsByUrl = new Map(
    getProductImageEntries(previousProduct)
      .filter((image) => image.path)
      .map((image) => [image.url, image.path]),
  );
  const requestedPaths = Array.isArray(product.imagePaths) ? product.imagePaths : [];

  return getProductImageEntries(product).map((image, index) => ({
    ...image,
    path:
      requestedPaths[index] ||
      (index === 0 ? product.imagePath : '') ||
      previousPathsByUrl.get(image.url) ||
      '',
  }));
}

// As colunas originais são preservadas;
// os aliases mantêm compatibilidade com o app.
function normalizeImportKey(key) {
  return String(key)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function readImportField(record, aliases) {
  const keys = Object.keys(record);

  for (const alias of aliases) {
    const key = keys.find(
      (k) => normalizeImportKey(k) === normalizeImportKey(alias)
    );

    if (key === undefined) {continue;}

    const value = record[key];

    if (
      value !== null &&
      value !== undefined &&
      !(typeof value === 'string' && !value.trim())
    ) {
      return value;
    }
  }

  return undefined;
}

function importText(value) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}

function parseImportNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return NaN;
  }

  let text = value
    .trim()
    .replace(/^R\$\s*/i, '')
    .replace(/[\s\u00a0]/g, '');

  // A própria planilha mistura R$ 8.99 e R$ 1,000.00.
  // Também aceita R$ 1.000,00.
  if (
    text.includes(',') &&
    text.includes('.') &&
    text.lastIndexOf('.') > text.lastIndexOf(',')
  ) {
    if (!/^-?\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(text)) {
      return NaN;
    }

    text = text.replace(/,/g, '');
  } else if (text.includes(',')) {
    if (!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(text)) {
      return NaN;
    }

    text = text.replace(/\./g, '').replace(',', '.');
  } else if (!/^-?\d+(?:\.\d{1,2})?$/.test(text)) {
    return NaN;
  }

  const result = Number(text);

  return Number.isFinite(result) ? result : NaN;
}

function isImportDocumentId(id) {
  return (
    Boolean(id) &&
    id !== '.' &&
    id !== '..' &&
    !id.includes('/') &&
    !/^__.*__$/.test(id) &&
    new TextEncoder().encode(id).length <= 1500
  );
}

function isImportImageUrl(value) {
  if (typeof value !== 'string') {return false;}
  if (isGoogleDrivePath(value)) {return false;}

  try {
    const url = new URL(value);

    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function auditProductRecords(records) {
  const errors = [];
  const warnings = [];
  const products = [];
  const ids = new Set();

  if (!Array.isArray(records) || records.length === 0) {
    return {
      products,
      errors: [
        'Nenhum registro para importar. Envie uma lista JSON [ ... ].',
      ],
      warnings,
    };
  }

  records.forEach((record, index) => {
    const line = record && record._line ? record._line : index + 2;
    const prefix = 'Linha ' + line + ': ';

    if (
      !record ||
      typeof record !== 'object' ||
      Array.isArray(record)
    ) {
      errors.push(prefix + 'O produto deve ser um objeto.');
      return;
    }

    const id = importText(
      readImportField(record, ['Product ID', 'id', 'product_id'])
    );

    const name = importText(
      readImportField(record, ['DESCRIÇÃO', 'name'])
    );

    const category = importText(
      readImportField(record, ['CATEGORIA', 'category'])
    );

    const price = parseImportNumber(
      readImportField(record, ['VALOR_NUM', 'price', 'VALOR'])
    );

    const status = importText(
      readImportField(record, ['STATUS']) ?? 'ATIVO'
    ).toUpperCase();

    if (!isImportDocumentId(id)) {
      errors.push(
        prefix +
          'Product ID é obrigatório e deve ser um ID válido do Firestore.'
      );
    }

    if (ids.has(id)) {
      errors.push(prefix + 'Product ID duplicado: ' + id + '.');
    }

    ids.add(id);

    if (!name) {
      errors.push(prefix + 'DESCRIÇÃO é obrigatória.');
    }

    if (!category) {
      errors.push(prefix + 'CATEGORIA é obrigatória.');
    }

    if (!Number.isFinite(price) || price <= 0) {
      errors.push(prefix + 'VALOR deve ser um número maior que zero.');
    }

    if (!['ATIVO', 'INATIVO'].includes(status)) {
      errors.push(prefix + 'STATUS deve ser ATIVO ou INATIVO.');
    }

    const product = {};

    // Células vazias de uma exportação enxuta não apagam
    // fotos/estoque já cadastrados.
    for (const [key, value] of Object.entries(record)) {
      if (
        key !== '_line' &&
        value !== null &&
        value !== undefined &&
        value !== ''
      ) {
        product[key] = value;
      }
    }

    Object.assign(product, {
      id,
      name,
      canonicalName: name,
      descricao: name,
      category,
      categoria: category,
      price,
      valor_num: price,
      status,
    });

    const optionalFields = [
      [['SUBCATEGORIA', 'subcategory'], 'subcategory'],
      [['ENDEREÇO', 'address'], 'address'],
      [['VARIACAO', 'variation'], 'variation'],
      [['ImageFileId'], 'imageFileId'],
      [['ImagePathCache'], 'imagePathCache'],
      [['DESCRICAO_IA', 'descriptionAi'], 'descriptionAi'],
      [['TAGS_IA', 'tagsAi'], 'tagsAi'],
    ];

    for (const [aliases, field] of optionalFields) {
      const value = readImportField(record, aliases);

      if (value !== undefined) {
        product[field] = value;
      }
    }

    if (product.subcategory !== undefined) {
      product.subcategoria = product.subcategory;
    }

    const stock = readImportField(record, [
      'stockQuantity',
      'ESTOQUE',
    ]);

    if (stock !== undefined) {
      const quantity = parseImportNumber(stock);

      if (!Number.isFinite(quantity) || quantity < 0) {
        errors.push(
          prefix + 'Estoque deve ser um número maior ou igual a zero.'
        );
      } else {
        Object.assign(product, {
          stockQuantity: quantity,
          estoque: quantity,
        });
      }
    }

    const imageValue = readImportField(record, ['ImageURL', 'CAMINHO_FOTO', 'FOTO', 'IMAGEM', 'FOTOS', 'DRIVE_PATH']);
    const imageList = readImportField(record, ['images']);

    if (
      imageList !== undefined &&
      !Array.isArray(imageList)
    ) {
      errors.push(prefix + 'images deve ser uma lista de URLs.');
    }

    const images = Array.isArray(imageList)
      ? imageList.filter(isImportImageUrl)
      : [];

    if (
      Array.isArray(imageList) &&
      images.length !== imageList.length
    ) {
      errors.push(prefix + 'images contém uma URL inválida.');
    }

    if (isImportImageUrl(imageValue)) {
      images.unshift(imageValue.trim());
    }

    // Identifica se a linha possui caminho/identificador do Google Drive
    const driveCandidate = [
      imageValue,
      readImportField(record, ['ImageFileId']),
      readImportField(record, ['ImagePathCache']),
      readImportField(record, ['CAMINHO_FOTO', 'FOTO', 'IMAGEM', 'FOTOS', 'DRIVE_PATH']),
    ].find((v) => typeof v === 'string' && isGoogleDrivePath(v));

    if (images.length > 0) {
      product.images = [...new Set(images)];
      product.imageUrl = product.images[0];
    } else if (driveCandidate) {
      // Caminho do Google Drive transferido para gravação no Firestore com padrão de nomes e tags
      product.originalDrivePath = driveCandidate;
      product.driveImagePath = driveCandidate;
      const photoDoc = buildFirestorePhotoDocument(product, {
        originalPath: driveCandidate,
        source: 'SPREADSHEET_IMPORT',
      });
      product.photoDoc = photoDoc;
      product.imageFileId = photoDoc.id;
      product.imagePathCache = `/api/images/${photoDoc.id}`;
      product.imageUrl = `/api/images/${photoDoc.id}`;
      product.images = [product.imageUrl];
    } else {
      // Um caminho relativo/array vazio não deve substituir
      // uma imagem válida existente.
      delete product.imageUrl;
      delete product.imageurl;
      delete product.images;

      warnings.push(
        prefix +
          name +
          ': sem URL pública de imagem; não será gerada foto automaticamente.'
      );
    }

    // Padrão de tags e descrição oficial da Conflora
    const { tagsString } = generateStandardTags(product);
    if (!product.tagsAi && !product.tags_ia) {
      product.tagsAi = tagsString;
      product.tags_ia = tagsString;
    }
    if (!product.descriptionAi && !product.descricao_ia) {
      const desc = generateStandardDescription(product);
      product.descriptionAi = desc;
      product.descricao_ia = desc;
    }

    products.push(product);
  });

  return {
    products,
    errors,
    warnings,
  };
}

let firestoreModule = null;

function getFirestoreModule() {
  if (!firestoreModule) {
    try {
      firestoreModule = require('@google-cloud/firestore');
    } catch {
      return null;
    }
  }

  return firestoreModule;
}
class FirestoreRepository {
  constructor({
    firestoreInstance = null,
    isInMemory = false,
    productImageStorage = productImageStorageService,
  } = {}) {
    this.firestore = firestoreInstance;
    this.productImageStorage = productImageStorage;
    this.isInMemory =
      isInMemory || process.env.NODE_ENV === 'test';

    this.inMemoryMessages = new Set();
    this.inMemorySessions = new Map();
    this.inMemoryOrders = new Map();
    this.inMemoryCustomers = new Map();
    this.inMemoryProducts = new Map();
    this.inMemoryProductImages = new Map();
    this.inMemoryStockMovements = [];
    this.inMemoryUsers = new Map();
    this.inMemoryOrderAlterations = new Map();
    this.inMemoryDiscountApprovals = new Map();
    this.inMemoryNotifications = [];
    this._firestoreClientDisabled = false;

    const defaultUsers = [
      {
        id: 'usr-edmar',
        name: 'Edmar Júnio (Izibola)',
        email: 'edmarjuniob@gmail.com',
        role: 'ADMIN',
        pin: '1234',
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-caixa1',
        name: 'Atendente do Caixa',
        email: 'caixa1@conflora.com.br',
        role: 'CAIXA',
        pin: '0000',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];

    for (const u of this.isInMemory ? defaultUsers : []) {
      this.inMemoryUsers.set(u.id, u);
    }

    if (
      !this.firestore &&
      !isInMemory &&
      process.env.NODE_ENV !== 'test'
    ) {
      const mod = getFirestoreModule();

      if (mod && mod.Firestore) {
        try {
          const targetProjectId =
            config.firebase?.projectId ||
            config.gcp?.projectId ||
            'confloraai';

          const clientConfig = {
            projectId: targetProjectId,
          };

          if (config.gcp.keyFilename) {
            clientConfig.keyFilename = config.gcp.keyFilename;
          }

          this.firestore = new mod.Firestore(clientConfig);

          Logger.info(
            `Firestore conectado ao projeto: ${targetProjectId}`
          );
        } catch (err) {
          Logger.warn(
            'Firestore initialization failed; running with in-memory store',
            { error: err.message }
          );
        }
      }
    }
  }

  // --- Funções REST do Firebase (Leitura confiável mesmo sem ADC IAM) ---

  decodeFirestoreValue(val) {
    if (!val || typeof val !== 'object') {
      return val;
    }
    if ('stringValue' in val) {
      return val.stringValue;
    }
    if ('integerValue' in val) {
      return parseInt(val.integerValue, 10);
    }
    if ('doubleValue' in val) {
      return parseFloat(val.doubleValue);
    }
    if ('booleanValue' in val) {
      return val.booleanValue;
    }
    if ('timestampValue' in val) {
      return val.timestampValue;
    }
    if ('nullValue' in val) {
      return null;
    }
    if ('mapValue' in val) {
      const res = {};
      const fields = val.mapValue.fields || {};
      for (const [k, v] of Object.entries(fields)) {
        res[k] = this.decodeFirestoreValue(v);
      }
      return res;
    }
    if ('arrayValue' in val) {
      const values = val.arrayValue.values || [];
      return values.map((v) => this.decodeFirestoreValue(v));
    }
    return val;
  }

  decodeFirestoreDoc(doc) {
    if (!doc) {
      return null;
    }
    const id = doc.name ? doc.name.split('/').pop() : undefined;
    const result = { id };
    if (doc.fields) {
      for (const [k, v] of Object.entries(doc.fields)) {
        result[k] = this.decodeFirestoreValue(v);
      }
    }
    if (!result.id && id) {
      result.id = id;
    }
    return result;
  }

  async fetchAllProductsViaRest() {
    const apiKey = config.firebase?.apiKey;
    const projectId =
      config.firebase?.projectId ||
      config.gcp?.projectId ||
      'confloraai';

    if (!apiKey) {
      return [];
    }

    const products = [];
    let pageToken = '';
    do {
      const pageParam = pageToken
        ? `&pageToken=${encodeURIComponent(pageToken)}`
        : '';
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/products?pageSize=300${pageParam}&key=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Firestore REST HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (Array.isArray(data.documents)) {
        for (const doc of data.documents) {
          const decoded = this.decodeFirestoreDoc(doc);
          if (decoded && decoded.id) {
            products.push(decoded);
          }
        }
      }
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    return products;
  }

  async fetchDocViaRest(collection, docId) {
    const apiKey = config.firebase?.apiKey;
    const projectId =
      config.firebase?.projectId ||
      config.gcp?.projectId ||
      'confloraai';

    if (!apiKey || !docId) {
      return null;
    }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return this.decodeFirestoreDoc(data);
  }

  async fetchCollectionViaRest(collection) {
    const apiKey = config.firebase?.apiKey;
    const projectId =
      config.firebase?.projectId ||
      config.gcp?.projectId ||
      'confloraai';

    if (!apiKey) {
      return [];
    }
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?pageSize=300&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      return [];
    }
    const data = await res.json();
    if (Array.isArray(data.documents)) {
      return data.documents
        .map((d) => this.decodeFirestoreDoc(d))
        .filter(Boolean);
    }
    return [];
  }

  // --- Produtos e Estoque (AppSheet & WhatsApp) ---

  async getAllProducts() {
    if (this.isInMemory) {return Array.from(this.inMemoryProducts.values());}
    if (!this.firestore) {throw new Error('Firestore indisponível.');}
    try {
      const snapshot = await this.firestore.collection('products').get();
      return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    } catch (err) {
      if (err && (err.code === 7 || (err.message && (err.message.includes('PERMISSION_DENIED') || err.message.includes('insufficient permissions'))))) {
        Logger.info('Firestore sem permissões ativas no GCP (PERMISSION_DENIED); usando catálogo local em memória.');
        if (this.inMemoryProducts.size === 0) {
          const { DEFAULT_CATALOG_ITEMS } = require('../catalog/default-catalog');
          for (const item of DEFAULT_CATALOG_ITEMS) {
            this.inMemoryProducts.set(String(item.id), item);
          }
        }
        return Array.from(this.inMemoryProducts.values());
      }
      throw err;
    }
  }

  async getProductById(productId) {
    if (!productId) {return null;}
    const id = String(productId).trim();
    if (this.isInMemory) {return this.inMemoryProducts.get(id) || null;}
    if (!this.firestore) {throw new Error('Firestore indisponível.');}
    try {
      const snapshot = await this.firestore.collection('products').doc(id).get();
      return snapshot.exists ? { ...snapshot.data(), id: snapshot.id } : null;
    } catch (err) {
      if (err && (err.code === 7 || (err.message && (err.message.includes('PERMISSION_DENIED') || err.message.includes('insufficient permissions'))))) {
        if (this.inMemoryProducts.size === 0) {
          const { DEFAULT_CATALOG_ITEMS } = require('../catalog/default-catalog');
          for (const item of DEFAULT_CATALOG_ITEMS) {
            this.inMemoryProducts.set(String(item.id), item);
          }
        }
        return this.inMemoryProducts.get(id) || null;
      }
      throw err;
    }
  }

  async saveProductPhoto(photoDoc) {
    if (!photoDoc || !photoDoc.id) {
      return null;
    }

    if (this.isInMemory) {
      this.inMemoryProductImages.set(photoDoc.id, photoDoc);
      if (photoDoc.productId) {
        this.inMemoryProductImages.set(String(photoDoc.productId), photoDoc);
      }
      return photoDoc;
    }

    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        await this.firestore
          .collection('product_images')
          .doc(photoDoc.id)
          .set(photoDoc, { merge: true });
      } catch (err) {
        if (
          err.code === 7 ||
          err.message?.includes('PERMISSION_DENIED')
        ) {
          this._firestoreClientDisabled = true;
        } else {
          Logger.warn('Erro ao salvar foto no Firestore', {
            error: err.message,
          });
        }
      }
    }

    this.inMemoryProductImages.set(photoDoc.id, photoDoc);
    if (photoDoc.productId) {
      this.inMemoryProductImages.set(String(photoDoc.productId), photoDoc);
    }
    return photoDoc;
  }

  async getProductPhoto(idOrProductId) {
    if (!idOrProductId) {
      return null;
    }
    const cleanId = String(idOrProductId).trim();

    if (this.isInMemory) {
      return this.inMemoryProductImages.get(cleanId) || null;
    }

    if (this.inMemoryProductImages.has(cleanId)) {
      return this.inMemoryProductImages.get(cleanId);
    }

    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        const directDoc = await this.firestore
          .collection('product_images')
          .doc(cleanId)
          .get();
        if (directDoc.exists) {
          const photo = directDoc.data();
          this.inMemoryProductImages.set(cleanId, photo);
          return photo;
        }

        const querySnap = await this.firestore
          .collection('product_images')
          .where('productId', '==', cleanId)
          .limit(1)
          .get();
        if (!querySnap.empty) {
          const photo = querySnap.docs[0].data();
          this.inMemoryProductImages.set(cleanId, photo);
          return photo;
        }
      } catch (err) {
        if (
          err.code === 7 ||
          err.message?.includes('PERMISSION_DENIED')
        ) {
          this._firestoreClientDisabled = true;
        }
      }
    }

    if (config.firebase?.apiKey) {
      try {
        const photo = await this.fetchDocViaRest('product_images', cleanId);
        if (photo) {
          this.inMemoryProductImages.set(cleanId, photo);
          return photo;
        }
      } catch {}
    }

    return this.inMemoryProductImages.get(cleanId) || null;
  }

  async getProductPhotos(idOrProductId) {
    if (!idOrProductId) {
      return [];
    }
    const cleanId = String(idOrProductId).trim();
    const allPhotos = await this.getAllProductPhotos();
    const matches = allPhotos.filter(
      (p) => String(p.productId) === cleanId || p.id === cleanId || (p.id && p.id.startsWith(`img_${cleanId}`))
    );
    matches.sort((a, b) => (a.index || 0) - (b.index || 0));
    return matches;
  }

  async getAllProductPhotos() {
    if (this.isInMemory) {
      return Array.from(new Set(this.inMemoryProductImages.values()));
    }

    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        const snap = await this.firestore
          .collection('product_images')
          .get();
        const photos = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        for (const p of photos) {
          this.inMemoryProductImages.set(p.id, p);
          if (p.productId) {
            this.inMemoryProductImages.set(String(p.productId), p);
          }
        }
        return photos;
      } catch (err) {
        if (
          err.code === 7 ||
          err.message?.includes('PERMISSION_DENIED')
        ) {
          this._firestoreClientDisabled = true;
        }
      }
    }

    if (config.firebase?.apiKey) {
      try {
        const restPhotos = await this.fetchCollectionViaRest('product_images');
        if (restPhotos && restPhotos.length > 0) {
          for (const p of restPhotos) {
            this.inMemoryProductImages.set(p.id, p);
            if (p.productId) {
              this.inMemoryProductImages.set(String(p.productId), p);
            }
          }
          return restPhotos;
        }
      } catch {}
    }

    return Array.from(new Set(this.inMemoryProductImages.values()));
  }

  async transferAllDrivePhotosToFirestore() {
    const products = await this.getAllProducts();
    let transferred = 0;
    const details = [];

    for (const prod of products) {
      const driveCandidate = [
        prod.originalDrivePath,
        prod.driveImagePath,
        prod.imageFileId,
        prod.imagePathCache,
        prod.imageUrl,
        ...(Array.isArray(prod.images) ? prod.images : []),
      ].find((v) => typeof v === 'string' && isGoogleDrivePath(v));

      const needsTransfer = Boolean(driveCandidate) || (
        !prod.imageUrl ||
        prod.imageUrl.includes('drive.google.com') ||
        prod.imageUrl.startsWith('Produtos_Images/') ||
        prod.imageUrl.startsWith('Images/')
      );

      if (needsTransfer) {
        const photoDoc = buildFirestorePhotoDocument(prod, {
          originalPath: driveCandidate || prod.imageUrl || null,
          source: 'GOOGLE_DRIVE_MIGRATION',
        });

        const storedImage = await this.uploadProductImage(photoDoc);
        await this.saveProductPhoto(photoDoc);

        const updated = {
          ...prod,
          imageUrl: storedImage.imageUrl,
          imagePath: storedImage.imagePath,
          imagePaths: [storedImage.imagePath],
          images: [storedImage.imageUrl],
          imageFileId: photoDoc.id,
          imagePathCache: storedImage.imageUrl,
          tagsAi: photoDoc.tagsAi,
          tags_ia: photoDoc.tagsAi,
          descriptionAi: photoDoc.descriptionAi,
          descricao_ia: photoDoc.descriptionAi,
          updatedAt: new Date().toISOString(),
        };

        await this.saveProduct(updated);
        const savedProduct = await this.getProductById(prod.id);
        transferred++;
        details.push({
          productId: prod.id,
          name: prod.name || prod.descricao,
          fileName: photoDoc.fileName,
          tags: photoDoc.tagsAi,
          url: savedProduct?.imageUrl || '',
        });
      }
    }

    return { success: true, count: transferred, details };
  }

  async uploadProductImage(photoDoc) {
    if (this.isInMemory && this.productImageStorage === productImageStorageService) {
      return { imagePath: '', imageUrl: `/api/images/${photoDoc.id}` };
    }
    return this.productImageStorage.uploadProductImage({
      productId: photoDoc.productId,
      fileName: photoDoc.fileName,
      buffer: Buffer.from(photoDoc.data, 'base64'),
      contentType: photoDoc.contentType || 'image/jpeg',
    });
  }

  async saveProduct(product) {
    if (!product || !product.id) {
      return;
    }

    const previousProduct = await this.getProductById(product.id);
    const dataWithTs = { ...product, updatedAt: new Date().toISOString() };
    if (product.status !== undefined || product.STATUS !== undefined) {
      const status = productStatus(product);
      if (!['ATIVO', 'INATIVO'].includes(status)) {
        throw new Error('STATUS deve ser ATIVO ou INATIVO.');
      }
      Object.assign(dataWithTs, { status, STATUS: status });
    }
    if (product.name !== undefined) {Object.assign(dataWithTs, { canonicalName: product.name, descricao: product.name, 'DESCRIÇÃO': product.name });}
    if (product.price !== undefined) {Object.assign(dataWithTs, { valor_num: product.price, VALOR: product.price });}
    if (product.category !== undefined) {Object.assign(dataWithTs, { categoria: product.category, CATEGORIA: product.category });}
    if (product.subcategory !== undefined) {Object.assign(dataWithTs, { subcategoria: product.subcategory, SUBCATEGORIA: product.subcategory });}

    // Salva foto(s) enviada(s) diretamente pro Firestore com padrão oficial de nomes, tags e compressão preservando qualidade de zoom
    const rawPhotosList = Array.isArray(product.photosBase64) && product.photosBase64.length > 0
      ? product.photosBase64
      : (Array.isArray(product.photos) && product.photos.length > 0 ? product.photos : null);

    if (rawPhotosList && rawPhotosList.length > 0) {
      const { compressProductPhoto } = require('../catalog/image-compressor');
      const savedUrls = [];
      const savedPaths = [];
      let firstPhotoDoc = null;

      for (let idx = 0; idx < rawPhotosList.length; idx++) {
        const pItem = rawPhotosList[idx];
        const rawBase = typeof pItem === 'string' ? pItem : (pItem.base64 || pItem.photoBase64 || pItem.data || '');
        const cType = (typeof pItem === 'object' && pItem.contentType) ? pItem.contentType : (product.photoContentType || 'image/jpeg');
        let pDoc = (typeof pItem === 'object' && pItem.id && pItem.data) ? pItem : buildFirestorePhotoDocument(dataWithTs, {
          base64Data: String(rawBase).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, ''),
          contentType: cType,
          source: 'WEBSITE_DIRECT',
          index: idx,
        });

        try {
          pDoc = await compressProductPhoto(pDoc, { preserveZoomQuality: true });
        } catch {
          // Fallback silencioso
        }

        await this.saveProductPhoto(pDoc);
        const storedImage = await this.uploadProductImage(pDoc);
        savedUrls.push(storedImage.imageUrl);
        savedPaths.push(storedImage.imagePath);
        if (idx === 0) {
          firstPhotoDoc = pDoc;
        }
      }

      const existingImages = getProductImageEntries(product)
        .filter((image) => !savedUrls.includes(image.url));
      const existingImgs = existingImages.map((image) => image.url);
      dataWithTs.images = [...savedUrls, ...existingImgs];
      dataWithTs.imagePaths = [...savedPaths, ...existingImages.map((image) => image.path)];
      dataWithTs.imageUrl = savedUrls[0] || existingImgs[0] || '';
      dataWithTs.imagePath = dataWithTs.imagePaths[0] || '';
      if (firstPhotoDoc) {
        dataWithTs.imageFileId = firstPhotoDoc.id;
        dataWithTs.imagePathCache = dataWithTs.imageUrl;
        dataWithTs.tagsAi = firstPhotoDoc.tagsAi;
        dataWithTs.tags_ia = firstPhotoDoc.tagsAi;
        dataWithTs.descriptionAi = firstPhotoDoc.descriptionAi;
        dataWithTs.descricao_ia = firstPhotoDoc.descriptionAi;
      }

      delete dataWithTs.photosBase64;
      delete dataWithTs.photos;
      delete dataWithTs.photoBase64;
      delete dataWithTs.photoData;
      delete dataWithTs.photoDoc;
    } else if (product.photoBase64 || product.photoData || product.photoDoc) {
      let photoDoc = product.photoDoc || buildFirestorePhotoDocument(dataWithTs, {
        base64Data: String(product.photoBase64 || product.photoData || '').replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, ''),
        contentType: product.photoContentType || 'image/jpeg',
        source: 'WEBSITE_DIRECT',
      });

      try {
        const { compressProductPhoto } = require('../catalog/image-compressor');
        photoDoc = await compressProductPhoto(photoDoc, { preserveZoomQuality: true });
      } catch {
        // Fallback silencioso
      }

      await this.saveProductPhoto(photoDoc);
      const storedImage = await this.uploadProductImage(photoDoc);

      const existingImages = getProductImageEntries(product)
        .filter((image) => (
          image.url !== storedImage.imageUrl &&
          image.url !== `/api/images/${photoDoc.id}`
        ));
      const existingImgs = existingImages.map((image) => image.url);
      dataWithTs.imageUrl = storedImage.imageUrl;
      dataWithTs.imagePath = storedImage.imagePath;
      dataWithTs.images = [storedImage.imageUrl, ...existingImgs];
      dataWithTs.imagePaths = [storedImage.imagePath, ...existingImages.map((image) => image.path)];
      dataWithTs.imageFileId = photoDoc.id;
      dataWithTs.imagePathCache = storedImage.imageUrl;
      dataWithTs.tagsAi = photoDoc.tagsAi;
      dataWithTs.tags_ia = photoDoc.tagsAi;
      dataWithTs.descriptionAi = photoDoc.descriptionAi;
      dataWithTs.descricao_ia = photoDoc.descriptionAi;

      delete dataWithTs.photoBase64;
      delete dataWithTs.photoData;
      delete dataWithTs.photoDoc;
    } else {
      // Garante que o padrão de tags e descrição sempre acompanhe o produto
      const { tagsString } = generateStandardTags(dataWithTs);
      if (!dataWithTs.tagsAi && !dataWithTs.tags_ia) {
        dataWithTs.tagsAi = tagsString;
        dataWithTs.tags_ia = tagsString;
      }
      if (!dataWithTs.descriptionAi && !dataWithTs.descricao_ia) {
        const desc = generateStandardDescription(dataWithTs);
        dataWithTs.descriptionAi = desc;
        dataWithTs.descricao_ia = desc;
      }
    }

    const updatesImageReferences =
      ['imageUrl', 'imagePath', 'images', 'imagePaths'].some((key) =>
        Object.prototype.hasOwnProperty.call(product, key),
      ) ||
      Boolean(rawPhotosList || product.photoBase64 || product.photoData || product.photoDoc);
    const previousImagePaths = getProductImageEntries(previousProduct)
      .map((image) => image.path)
      .filter(Boolean);
    let nextImagePaths = previousImagePaths;

    if (updatesImageReferences) {
      const imageEntries = getUpdatedProductImageEntries(dataWithTs, previousProduct);
      dataWithTs.images = imageEntries.map((image) => image.url);
      dataWithTs.imagePaths = imageEntries.map((image) => image.path);
      dataWithTs.imageUrl = imageEntries[0]?.url || '';
      dataWithTs.imagePath = imageEntries[0]?.path || '';
      dataWithTs.imagePathCache = dataWithTs.imageUrl;
      if (!dataWithTs.imageUrl) {
        dataWithTs.imageFileId = '';
      }
      nextImagePaths = imageEntries.map((image) => image.path).filter(Boolean);
    }

    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        await this.firestore
          .collection('products')
          .doc(String(product.id))
          .set(dataWithTs, { merge: true });
      } catch (err) {
        if (
          err.code === 7 ||
          err.message?.includes('PERMISSION_DENIED')
        ) {
          this._firestoreClientDisabled = true;
        } else {
          Logger.warn('Erro ao salvar produto no Firestore', {
            error: err.message,
          });
        }
      }
    }

    this.inMemoryProducts.set(String(product.id), { ...this.inMemoryProducts.get(String(product.id)), ...dataWithTs });
    const nextImagePathSet = new Set(nextImagePaths);
    for (const imagePath of new Set(previousImagePaths)) {
      if (!nextImagePathSet.has(imagePath)) {
        await this.productImageStorage.deleteProductImage(imagePath);
      }
    }
  }

  async deleteProduct(productId) {
    if (!productId) {
      return false;
    }

    const product = await this.getProductById(productId);
    const imagePaths = getProductImageEntries(product)
      .map((image) => image.path)
      .filter(Boolean);
    for (const imagePath of new Set(imagePaths)) {
      await this.productImageStorage.deleteProductImage(imagePath);
    }

    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        await this.firestore
          .collection('products')
          .doc(String(productId))
          .delete();
        await this.firestore
          .collection('product_images')
          .doc(`img_${productId}`)
          .delete()
          .catch(() => {});
      } catch (err) {
        if (
          err.code === 7 ||
          err.message?.includes('PERMISSION_DENIED')
        ) {
          this._firestoreClientDisabled = true;
        } else {
          Logger.warn('Erro ao excluir produto no Firestore', {
            error: err.message,
          });
        }
      }
    }

    this.inMemoryProducts.delete(String(productId));
    this.inMemoryProductImages.delete(`img_${productId}`);
    this.inMemoryProductImages.delete(String(productId));

    return true;
  }

  async createManualOrder({
    customerName,
    customerPhone,
    items,
    paymentMethod,
    notes = '',
    status = 'CONFIRMED',
    operatorName = '',
    operatorId = '',
    ticketNumber = '',
    pixCode = '',
    orderId = '',
    mercadoPagoPreferenceId = '',
    paymentCheckoutUrl = '',
    requirePersistence = false,
    discountAmount = 0,
    discountPercent = 0,
    orderType = 'PICKUP',
    deliveryAddress = '',
    freightValue = 0,
  }) {
    const subtotal = (items || []).reduce(
      (sum, item) =>
        sum +
        Number(item.price || 0) *
          Number(item.quantity || 1),
      0
    );
    const normalizedDiscount = Math.min(subtotal, Math.max(0, Number(discountAmount) || 0));
    const normalizedFreight = Math.max(0, Number(freightValue) || 0);
    const total = Number((subtotal - normalizedDiscount + normalizedFreight).toFixed(2));

    const shortTicket = ticketNumber || String(Math.floor(100 + Math.random() * 900));

    const isDelivery = String(orderType).toUpperCase() === 'DELIVERY';
    const orderData = {
      customerName: customerName || (isDelivery ? 'Cliente Entrega' : 'Venda Balcão / Caixa'),
      customerPhone: customerPhone || (isDelivery ? '' : 'Presencial'),
      orderType: isDelivery ? 'DELIVERY' : 'PICKUP',
      deliveryAddress: deliveryAddress || (isDelivery ? 'Entrega a Domicílio' : 'Venda Presencial no Balcão Conflora'),
      freightValue: normalizedFreight,
      paymentMethod: (paymentMethod || 'DINHEIRO').toUpperCase(),
      items: items || [],
      subtotal: Number(subtotal.toFixed(2)),
      discountAmount: Number(normalizedDiscount.toFixed(2)),
      discountPercent: Number(discountPercent) || 0,
      total,
      notes,
      operatorName: operatorName || 'Colaborador',
      operatorId: operatorId || '',
      ticketNumber: shortTicket,
      pixCode: pixCode || '',
      mercadoPagoPreferenceId,
      paymentCheckoutUrl,
      source: 'CAIXA_MANUAL',
      status: status || 'CONFIRMED',
    };
    if (orderId) {
      orderData.id = String(orderId);
    }

    const shouldConfirm = PAID_ORDER_STATUSES.has(orderData.status);
    if (shouldConfirm) {orderData.status = 'PENDING';}
    const order = await this.createDirectOrder(orderData, { requirePersistence });
    return shouldConfirm ? this.confirmOrderPayment(order.id) : order;
  }

  async getOrderById(orderId) {
    const idStr = String(orderId);
    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        const snap = await this.firestore.collection('orders').doc(idStr).get();
        if (snap.exists) {
          const docData = { id: snap.id, ...snap.data() };
          this.inMemoryOrders.set(idStr, docData);
          return docData;
        }
      } catch (err) {
        if (
          err.code === 7 ||
          err.code === 'permission-denied' ||
          err.message?.includes('PERMISSION_DENIED') ||
          err.message?.includes('Missing or insufficient')
        ) {
          this._firestoreClientDisabled = true;
        } else {
          Logger.warn('Erro ao buscar pedido por ID no Firestore', { error: err.message });
        }
      }
    }
    if (config.firebase?.apiKey) {
      try {
        const restDoc = await this.fetchDocViaRest('orders', idStr);
        if (restDoc) {
          this.inMemoryOrders.set(idStr, restDoc);
          return restDoc;
        }
      } catch {}
    }
    return this.inMemoryOrders.get(idStr) || null;
  }

  async findPendingPixOrderByPhone(phone) {
    const cleanTarget = String(phone || '').replace(/\D/g, '');
    if (!cleanTarget) {return null;}

    const allOrders = await this.getAllOrders(100);
    const pendingPix = allOrders.filter(
      (o) =>
        ['AWAITING_PIX', 'AGUARDANDO_PIX', 'PENDING'].includes(o.status) &&
        String(o.paymentMethod || '').toUpperCase() === 'PIX' &&
        Boolean(o.mercadoPagoPreferenceId),
    );

    const match = pendingPix.find((o) => {
      const oPhone = String(o.customerPhone || o.phone || '').replace(/\D/g, '');
      if (!oPhone) {return false;}
      if (oPhone === cleanTarget) {return true;}
      const oNo55 = oPhone.startsWith('55') && oPhone.length >= 12 ? oPhone.slice(2) : oPhone;
      const tNo55 = cleanTarget.startsWith('55') && cleanTarget.length >= 12 ? cleanTarget.slice(2) : cleanTarget;
      if (oNo55 === tNo55) {return true;}
      if (oNo55.length === 11 && tNo55.length === 10) {
        return oNo55.slice(0, 2) === tNo55.slice(0, 2) && oNo55.slice(3) === tNo55.slice(2);
      }
      if (tNo55.length === 11 && oNo55.length === 10) {
        return tNo55.slice(0, 2) === oNo55.slice(0, 2) && tNo55.slice(3) === oNo55.slice(2);
      }
      return false;
    });

    return match || null;
  }

  async confirmOrderPayment(orderId, {
    verifiedVia = 'CAIXA_MANUAL',
    receivedAmount = null,
    changeGiven = 0,
    paymentTransactionId = '',
    paymentAmount = null,
  } = {}) {
    const order = await this.getOrderById(orderId);
    if (!order) {
      throw new Error('Pedido não encontrado.');
    }
    if (order.source === 'PDV') {
      throw new Error('Comandas do PDV devem ser recebidas pelo fluxo autenticado do caixa ou webhook Sicredi.');
    }

    const now = new Date().toISOString();
    const updateData = {
      status: 'CONFIRMED',
      paidAt: now,
      verifiedVia,
      updatedAt: now,
    };
    if (verifiedVia === 'MERCADO_PAGO_WEBHOOK') {
      updateData.paymentStatus = 'APPROVED';
      updateData.paymentProvider = 'MERCADO_PAGO';
      updateData.paymentTransactionId = String(paymentTransactionId);
      updateData.paymentVerifiedAmount = paymentAmount;
    }
    if (verifiedVia.includes('PIX') || order.paymentMethod === 'PIX') {
      updateData.pixVerified = true;
    }
    if (typeof receivedAmount === 'number') {
      updateData.cashReceived = receivedAmount;
      updateData.changeGiven = changeGiven;
    }

    if (
      verifiedVia === 'MERCADO_PAGO_WEBHOOK' &&
      process.env.NODE_ENV === 'production' &&
      (!this.firestore || this._firestoreClientDisabled)
    ) {
      throw new Error('Firestore indisponível; pagamento não foi confirmado no pedido.');
    }

    // Estoque e pagamento mudam juntos na transação do pedido. Se a baixa
    // falhar, a venda continua pendente; retries concorrentes não repetem a
    // baixa nem disparam uma segunda confirmação.
    const confirmation = await this.deductStock(
      order.items,
      order.customerPhone || 'Caixa',
      order.id || orderId,
      updateData,
    );
    if (confirmation.alreadyConfirmed) {
      return {
        ...order,
        ...(confirmation.orderData || {}),
        alreadyConfirmed: true,
      };
    }

    const local = this.inMemoryOrders.get(String(orderId));
    if (local) {
      Object.assign(local, updateData);
    }
    Object.assign(order, updateData);

    return order;
  }

  async cancelOrder(orderId, reason = '') {
    return this.transitionOrder(orderId, 'CANCELLED', { cancelReason: reason || 'Cancelado no caixa' });
  }

  async transitionOrder(orderId, status, extra = {}) {
    const id = String(orderId);
    const updates = { ...extra, status, updatedAt: new Date().toISOString() };
    const validate = (order) => {
      if (!order) {throw new Error('Pedido não encontrado.');}
      if (order.status === status) {return;}
      if (status === 'CANCELLED') {
        if (PAID_ORDER_STATUSES.has(order.status) || order.stockDeducted || order.paymentTransactionId) {
          throw new Error('Pedido com baixa ou pagamento exige conciliação/estorno antes de cancelar.');
        }
      } else if (status === 'DELIVERED') {
        if (!PAID_ORDER_STATUSES.has(order.status)) {throw new Error('Confirme o pagamento antes da entrega.');}
      } else {
        throw new Error('Transição de status não permitida.');
      }
    };
    if (this.firestore && !this._firestoreClientDisabled) {
      await this.firestore.runTransaction(async (transaction) => {
        const ref = this.firestore.collection('orders').doc(id);
        const snapshot = await transaction.get(ref);
        validate(snapshot.exists ? snapshot.data() : null);
        transaction.update(ref, updates);
      });
    } else {
      if (!this.isInMemory || this.firestore) {throw new Error('Firestore indisponível para alterar pedido.');}
      validate(this.inMemoryOrders.get(id));
    }
    const local = this.inMemoryOrders.get(id);
    if (local) {Object.assign(local, updates);}
    return { success: true, orderId: id, status };
  }

  async getCashierOrders({ operatorName = '', role = '', userId = '' } = {}) {
    const allOrders = await this.getAllOrders(200);
    const todayStr = new Date().toISOString().slice(0, 10);

    const cleanOp = String(operatorName || '').trim();
    const isCashierRole = String(role || '').toUpperCase() === 'CAIXA';

    const pendingCashier = [];
    const pendingPix = [];
    const completedToday = [];

    let totalRevenue = 0;
    const byPayment = { PIX: 0, CARTAO: 0, DINHEIRO: 0 };

    for (const ord of allOrders) {
      const ordDate = (ord.createdAt || '').slice(0, 10);
      const isToday = ordDate === todayStr;

      const ordOpName = String(ord.operatorName || '').trim().toLowerCase();
      const ordOpId = String(ord.operatorId || '').trim();
      const matchesName = cleanOp && ordOpName === cleanOp.toLowerCase();
      const matchesId = userId && ordOpId === String(userId);
      const isMyOrder = Boolean(matchesName || matchesId);

      // Se o usuário logado tiver cargo de CAIXA, isola estritamente as vendas dele
      if (isCashierRole && !isMyOrder) {
        continue;
      }

      if (ord.status === 'AWAITING_CASHIER') {
        pendingCashier.push(ord);
      } else if (ord.status === 'AWAITING_PIX') {
        pendingPix.push(ord);
      } else if ((ord.status === 'CONFIRMED' || ord.status === 'PAID_CONFIRMED' || ord.status === 'DELIVERED') && isToday) {
        completedToday.push(ord);
        const val = Number(ord.total || 0);
        totalRevenue += val;
        const pay = (ord.paymentMethod || 'DINHEIRO').toUpperCase();
        if (byPayment[pay] !== undefined) {
          byPayment[pay] += val;
        } else {
          byPayment[pay] = (byPayment[pay] || 0) + val;
        }
      }
    }

    return {
      pendingCashier,
      pendingPix,
      completedToday,
      metrics: {
        totalRevenue,
        orderCount: completedToday.length,
        byPayment,
      },
      operatorScope: isCashierRole ? cleanOp : 'ALL',
      isCashierOnly: isCashierRole,
    };
  }

  async getExecutiveOrdersForDate(date) {
    const range = getBusinessDateRange(date);
    if (this.firestore && !this._firestoreClientDisabled && !FirestoreRepository._globalClientDisabled) {
      try {
        const snapshot = await this.firestore.collection('orders')
          .where('createdAt', '>=', range.start)
          .where('createdAt', '<', range.end)
          .orderBy('createdAt', 'asc')
          .get();
        return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      } catch (error) {
        const errorText = String(error?.message || error?.details || error || '');
        if (error?.code === 7 || error?.code === '7' || error?.code === 'permission-denied' || errorText.includes('PERMISSION_DENIED')) {
          this._firestoreClientDisabled = true;
          FirestoreRepository._globalClientDisabled = true;
        }
        Logger.warn('Falha ao consultar vendas do fechamento por data', { error: errorText });
      }
    }
    const orders = await this.getAllOrders(10000);
    return orders.filter((order) => order.createdAt && getBusinessDate(order.createdAt) === date);
  }

  async getExecutiveDebtSettlementsForDate(date) {
    const range = getBusinessDateRange(date);
    if (this.firestore && !this._firestoreClientDisabled && !FirestoreRepository._globalClientDisabled) {
      try {
        const snapshot = await this.firestore.collection('debt_settlements')
          .where('createdAt', '>=', range.start)
          .where('createdAt', '<', range.end)
          .orderBy('createdAt', 'asc')
          .get();
        return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
      } catch (error) {
        const errorText = String(error?.message || error?.details || error || '');
        if (error?.code === 7 || error?.code === '7' || error?.code === 'permission-denied' || errorText.includes('PERMISSION_DENIED')) {
          this._firestoreClientDisabled = true;
          FirestoreRepository._globalClientDisabled = true;
        }
        Logger.warn('Falha ao consultar recebimentos de dívidas do fechamento', { error: errorText });
      }
    }
    return (this.inMemoryDebtSettlements || []).filter((settlement) =>
      settlement.createdAt && getBusinessDate(settlement.createdAt) === date
    );
  }

  async getDailyExecutiveMetrics({ date = getBusinessDate(new Date()) } = {}) {
    const targetDate = String(date || '').trim();
    getBusinessDateRange(targetDate);
    const [orders, settlements, users] = await Promise.all([
      this.getExecutiveOrdersForDate(targetDate),
      this.getExecutiveDebtSettlementsForDate(targetDate),
      this.getAllUsers(),
    ]);
    return summarizeDailyExecutiveMetrics({ date: targetDate, orders, settlements, users });
  }

  /**
   * Finaliza o caixa do dia, gera o PDF executivo e envia resumo + PDF pro WhatsApp do patrão.
   */
  async closeCashierDay({ date = new Date().toISOString().slice(0, 10), closedBy = 'Administrador', notes = '', notifyOwnerWhatsapp = true, whatsappClient = null } = {}) {
    const metrics = await this.getDailyExecutiveMetrics({ date });
    const paymentTotals = metrics.byPayment || {};
    const cardPayment = ['CARTAO', 'DEBITO', 'CREDITO'].reduce((summary, method) => ({
      count: summary.count + Number(paymentTotals[method]?.count || 0),
      total: summary.total + Number(paymentTotals[method]?.total || 0),
    }), { count: 0, total: 0 });
    const reportMetrics = {
      ...metrics,
      byPayment: { ...paymentTotals, CARTAO: cardPayment },
      topProducts: metrics.topProductsByQuantity || metrics.topProducts || [],
    };
    const now = new Date().toISOString();
    const closingId = `closing_${date}_${Date.now()}`;

    const closingRecord = {
      id: closingId,
      date,
      closedAt: now,
      closedBy,
      notes,
      metrics,
      status: 'CLOSED',
    };

    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        await this.firestore.collection('cashier_closings').doc(closingId).set(closingRecord);
      } catch (err) {
        Logger.warn('Aviso: falha ao salvar fechamento no Firestore', { error: err.message });
      }
    }
    this.inMemoryCashierClosings = this.inMemoryCashierClosings || new Map();
    this.inMemoryCashierClosings.set(closingId, closingRecord);

    // Gera PDF oficial
    const { generateDailyReportPdf } = require('../reports/daily-report-pdf');
    let pdfResult = null;
    try {
      pdfResult = await generateDailyReportPdf(reportMetrics, {
        date,
        closedBy,
        closedAt: new Date().toLocaleTimeString('pt-BR'),
      });
    } catch (pdfErr) {
      Logger.error('Erro ao gerar PDF de fechamento de caixa', pdfErr);
    }

    let whatsappSent = false;
    let whatsappError = null;

    if (notifyOwnerWhatsapp && whatsappClient) {
      const ownerPhone = process.env.OWNER_WHATSAPP_NUMBER || config.whatsapp?.ownerNumber;
      if (ownerPhone) {
        const cleanPhone = String(ownerPhone).replace(/\D/g, '');
        const topProdTxt = reportMetrics.topProducts.slice(0, 3)
          .map((p, i) => `${i + 1}º ${p.name} (${p.quantity} un - R$ ${p.revenue.toFixed(2).replace('.', ',')})`)
          .join('\n');

        const summaryText = (
          `🏁 *FECHAMENTO DE CAIXA CONFLORA · ${date.split('-').reverse().join('/')}*\n\n` +
          `Olá, Patrão! O caixa do dia foi encerrado com sucesso por *${closedBy}*.\n\n` +
          `📊 *VALORES DO DIA:*\n` +
          `💰 *Faturamento Total:* R$ ${metrics.totalRevenue.toFixed(2).replace('.', ',')}\n` +
          `🛒 *Total de Vendas:* ${metrics.orderCount} pedidos\n` +
          `🎯 *Ticket Médio:* R$ ${metrics.ticketMedio.toFixed(2).replace('.', ',')}\n\n` +
          `💳 *SEGMENTAÇÃO DE PAGAMENTOS:*\n` +
          `• PIX: R$ ${(reportMetrics.byPayment?.PIX?.total || 0).toFixed(2).replace('.', ',')} (${reportMetrics.byPayment?.PIX?.count || 0}x)\n` +
          `• Cartão: R$ ${(reportMetrics.byPayment?.CARTAO?.total || 0).toFixed(2).replace('.', ',')} (${reportMetrics.byPayment?.CARTAO?.count || 0}x)\n` +
          `• Dinheiro: R$ ${(reportMetrics.byPayment?.DINHEIRO?.total || 0).toFixed(2).replace('.', ',')} (${reportMetrics.byPayment?.DINHEIRO?.count || 0}x)\n\n` +
          `🏆 *PRODUTOS MAIS VENDIDOS:*\n${topProdTxt || 'Consulte o relatório'}\n\n` +
          (pdfResult?.publicUrl ? `📄 *Relatório Executivo PDF Completo:* \`${process.env.SERVICE_URL || ''}${pdfResult.publicUrl}\`` : '')
        );

        try {
          await whatsappClient.sendTextMessage(cleanPhone, summaryText);
          whatsappSent = true;
        } catch (waErr) {
          whatsappError = waErr.message;
          Logger.warn('Aviso: falha ao enviar resumo de fechamento no WhatsApp do patrão', { error: waErr.message });
        }
      }
    }

    return {
      success: true,
      closingId,
      date,
      metrics,
      pdfUrl: pdfResult ? pdfResult.publicUrl : null,
      whatsappSent,
      whatsappError,
    };
  }

  async importSpreadsheetData({
    type = 'products',
    records = [],
  }) {
    const now = new Date().toISOString();

    if (!Array.isArray(records) || records.length === 0) {
      return {
        success: false,
        count: 0,
        message: 'Nenhum registro para importar',
      };
    }

    if (type === 'products') {
      const audit = auditProductRecords(records);

      if (audit.errors.length > 0) {
        return {
          success: false,
          count: 0,
          type,
          errors: audit.errors,
          warnings: audit.warnings,
          message: audit.errors.join('\n'),
        };
      }

      try {
        const result = await this.batchUpsertProducts(
          audit.products
        );

        return {
          success: true,
          count: result.count,
          type,
          storage: result.storage,
          warnings: audit.warnings,
        };
      } catch (err) {
        return {
          success: false,
          count: err.committedCount || 0,
          type,
          partial: Boolean(err.committedCount),
          failedBatchStart: err.failedBatchStart ?? null,
          failedBatchCount: err.failedBatchCount ?? 0,
          message: err.message,
        };
      }
    }

    if (type === 'orders') {
      for (const ord of records) {
        await this.createDirectOrder(ord);
      }

      return {
        success: true,
        count: records.length,
        type: 'orders',
      };
    }

    if (type === 'movements') {
      for (const m of records) {
        if (this.firestore) {
          await this.firestore
            .collection('stock_movements')
            .add({
              ...m,
              createdAt: now,
            })
            .catch(() => {});
        }

        this.inMemoryStockMovements.push({
          ...m,
          createdAt: now,
        });
      }

      return {
        success: true,
        count: records.length,
        type: 'movements',
      };
    }

    return {
      success: false,
      message: 'Tipo de dados desconhecido',
    };
  }

  async replaceProducts(records) {
    const audit = auditProductRecords(records);
    if (audit.errors.length) {return { success: false, count: 0, errors: audit.errors, message: audit.errors.join('\n') };}
    if (!this.firestore && !this.isInMemory) {throw new Error('Firestore indisponível.');}
    const previous = await this.getAllProducts();
    const ids = new Set(audit.products.map(p => p.id));
    const obsolete = previous.filter(p => !ids.has(p.id));
    const prepared = audit.products.map(p => ({ ...p, stockQuantity: p.stockQuantity ?? 0, updatedAt: new Date().toISOString() }));
    let count = 0;
    let removed = 0;
    try {
      // Grava todos os novos dados antes de remover IDs ausentes na planilha.
      for (let offset = 0; offset < prepared.length; offset += 200) {
        const chunk = prepared.slice(offset, offset + 200);
        if (this.firestore) {
          const batch = this.firestore.batch();
          for (const item of chunk) {
            if (item.photoDoc) {
              batch.set(this.firestore.collection('product_images').doc(item.photoDoc.id), item.photoDoc, { merge: true });
            }
            const copy = { ...item };
            delete copy.photoDoc;
            batch.set(this.firestore.collection('products').doc(item.id), copy);
          }
          await batch.commit();
        }
        for (const item of chunk) {
          if (item.photoDoc) {
            this.inMemoryProductImages.set(item.photoDoc.id, item.photoDoc);
            this.inMemoryProductImages.set(item.id, item.photoDoc);
          }
          const copy = { ...item };
          delete copy.photoDoc;
          this.inMemoryProducts.set(item.id, copy);
        }
        count += chunk.length;
      }
      for (let offset = 0; offset < obsolete.length; offset += 200) {
        const chunk = obsolete.slice(offset, offset + 200);
        if (this.firestore) {
          const batch = this.firestore.batch();
          for (const item of chunk) {batch.delete(this.firestore.collection('products').doc(item.id));}
          await batch.commit();
        }
        for (const item of chunk) {this.inMemoryProducts.delete(item.id);}
        removed += chunk.length;
      }
      return { success: true, count, removed, mode: 'replace', storage: this.firestore ? 'firestore' : 'memory' };
    } catch (error) {
      return { success: false, count, removed, partial: true, message: 'A substituição não foi concluída. Confira o catálogo e reenvie a mesma planilha para concluir. ' + error.message };
    }
  }

  async batchUpsertProducts(products) {
    if (!Array.isArray(products) || products.length === 0) {
      return {
        count: 0,
        storage: this.firestore ? 'firestore' : 'memory',
      };
    }

    if (!this.firestore && !this.isInMemory) {
      throw new Error(
        'Firestore indisponível. Nenhum produto foi gravado.'
      );
    }

    // Verifica todos os IDs antes de gravar o primeiro lote.
    const ids = new Set();

    const prepared = products.map((item) => {
      const id = importText(
        item &&
          (item.id ??
            item.product_id ??
            item['Product ID'])
      );

      if (!isImportDocumentId(id) || ids.has(id)) {
        throw new Error(
          'ID inválido ou duplicado no lote: ' + id
        );
      }

      ids.add(id);

      return {
        ...item,
        id,
        updatedAt: new Date().toISOString(),
      };
    });

    const batchSize = 200;
    let committedCount = 0;

    for (
      let offset = 0;
      offset < prepared.length;
      offset += batchSize
    ) {
      const chunk = prepared.slice(
        offset,
        offset + batchSize
      );

      if (this.firestore) {
        try {
          const batch = this.firestore.batch();

          for (const item of chunk) {
            if (item.photoDoc) {
              batch.set(
                this.firestore
                  .collection('product_images')
                  .doc(item.photoDoc.id),
                item.photoDoc,
                { merge: true }
              );
            }
            const copy = { ...item };
            delete copy.photoDoc;
            batch.set(
              this.firestore
                .collection('products')
                .doc(item.id),
              copy,
              { merge: true }
            );
          }

          await batch.commit();
        } catch (err) {
          Logger.warn(
            'Erro na importação de produtos no Firestore',
            {
              error: err.message,
              committedCount,
            }
          );

          const failure = new Error(
            'Falha ao gravar produtos no Firestore: ' +
              err.message
          );

          failure.committedCount = committedCount;
          failure.failedBatchStart = offset;

          // Em falha de rede, o estado do lote que falhou
          // pode ser desconhecido.
          failure.failedBatchCount = chunk.length;

          throw failure;
        }
      }

      for (const item of chunk) {
        if (item.photoDoc) {
          this.inMemoryProductImages.set(item.photoDoc.id, item.photoDoc);
          this.inMemoryProductImages.set(item.id, item.photoDoc);
        }
        const copy = { ...item };
        delete copy.photoDoc;
        const previous =
          this.inMemoryProducts.get(item.id) || {};

        this.inMemoryProducts.set(item.id, {
          ...previous,
          ...copy,
        });
      }

      committedCount += chunk.length;
    }

    if (this.firestore) {
      Logger.info(
        `${committedCount} produtos sincronizados no Firestore.`
      );
    }

    return {
      count: committedCount,
      storage: this.firestore ? 'firestore' : 'memory',
    };
  }

  /**
   * Baixa atômica de estoque via transação no Firestore.
   * Garante consistência e registra movimentação
   * para o Looker Studio / AppSheet.
   */
  async getInventorySettings() {
    let stored = null;
    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        const snap = await this.firestore.collection('store_settings').doc('inventory').get();
        stored = snap.data();
      } catch (err) {
        if (/PERMISSION_DENIED/i.test(err.message) || err.code === 7) {
          Logger.warn('Aviso: Permissão negada para store_settings no Firestore, usando fallback local.');
        } else {
          Logger.warn('Erro ao buscar store_settings no Firestore', err);
        }
        stored = this.inMemoryInventorySettings;
      }
    } else {
      stored = this.inMemoryInventorySettings;
    }
    return {
      stockControlEnabled: stored?.stockControlEnabled ?? process.env.STORE_STOCK_CONTROL_ENABLED !== 'false',
    };
  }

  async saveInventorySettings(settings) {
    if (typeof settings?.stockControlEnabled !== 'boolean') {
      throw new Error('Informe se o controle de estoque está habilitado.');
    }
    const value = { stockControlEnabled: settings.stockControlEnabled };
    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        await this.firestore.collection('store_settings').doc('inventory').set(value, { merge: true });
      } catch (err) {
        Logger.warn('Erro ao salvar store_settings no Firestore, salvando em memória', err);
        this.inMemoryInventorySettings = value;
      }
    } else {
      this.inMemoryInventorySettings = value;
    }
    return value;
  }

  async deductStock(orderItems, customerPhone = '', orderId = '', orderUpdates = null) {
    const stockControlEnabled = (await this.getInventorySettings()).stockControlEnabled;
    let items = Array.isArray(orderItems) ? orderItems : [];
    const id = orderId ? String(orderId) : '';
    const now = new Date().toISOString();

    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        const result = await this.firestore.runTransaction(async (transaction) => {
          let orderRef = null;
          if (id) {
            orderRef = this.firestore.collection('orders').doc(id);
            const orderSnapshot = await transaction.get(orderRef);
            if (!orderSnapshot.exists) {
              throw new Error('Pedido não encontrado para registrar a baixa de estoque.');
            }
            const orderData = orderSnapshot.data() || {};
            validateOrderConfirmation(orderData, orderUpdates);
            items = Array.isArray(orderData.items) ? orderData.items : [];
            if (
              orderUpdates &&
              PAID_ORDER_STATUSES.has(orderData.status)
            ) {
              return {
                success: true,
                deducted: [],
                alreadyConfirmed: true,
                orderData,
              };
            }
            if (orderData.stockDeducted) {
              if (!orderUpdates) {
                return { success: true, deducted: [], alreadyDeducted: true };
              }
              transaction.update(orderRef, orderUpdates);
              return { success: true, deducted: [], newlyConfirmed: true };
            }
          }

          const markOrderHandled = () => {
            if (orderRef) {
              transaction.update(orderRef, {
                stockDeducted: true,
                stockDeductedAt: now,
                ...(orderUpdates || {}),
              });
            }
          };

          if (!stockControlEnabled || items.length === 0) {
            markOrderHandled();
            return {
              success: true,
              deducted: [],
              ...(orderUpdates ? { newlyConfirmed: true } : {}),
              ...(!stockControlEnabled ? { trackingDisabled: true } : {}),
            };
          }

          const resolvedItems = new Map();
          for (const item of items) {
            const quantity = validateStockQuantity(item);
            let docRef = item.productId
              ? this.firestore.collection('products').doc(String(item.productId))
              : null;
            let productData = null;

            if (docRef) {
              const productSnapshot = await transaction.get(docRef);
              if (productSnapshot.exists) {
                productData = productSnapshot.data();
              }
            }
            if (!item.productId && !productData && item.name) {
              const querySnapshot = await transaction.get(
                this.firestore.collection('products')
                  .where('name', '==', item.name)
                  .limit(1),
              );
              if (!querySnapshot.empty) {
                const productSnapshot = querySnapshot.docs[0];
                docRef = productSnapshot.ref;
                productData = productSnapshot.data();
              }
            }
            if (docRef && productData) {
              const existing = resolvedItems.get(docRef.id);
              if (existing) {
                existing.quantity += quantity;
              } else {
                resolvedItems.set(docRef.id, { docRef, productData, item, quantity });
              }
            } else {
              throw new Error(`Produto não encontrado para baixa: ${item.productId || item.name}.`);
            }
          }

          const deducted = [];
          for (const entry of resolvedItems.values()) {
            const currentStock =
              typeof entry.productData.stockQuantity === 'number'
                ? entry.productData.stockQuantity
                : typeof entry.productData.estoque === 'number'
                  ? entry.productData.estoque
                  : 0;
            const newStock = remainingStock(entry.productData, entry.quantity);
            transaction.update(entry.docRef, {
              stockQuantity: newStock,
              estoque: newStock,
              updatedAt: now,
            });

            const movementRef = this.firestore.collection('stock_movements').doc();
            transaction.set(movementRef, {
              productId: entry.docRef.id,
              productName: entry.productData.name || entry.item.name,
              quantityDeducted: entry.quantity,
              previousStock: currentStock,
              newStock,
              type: 'SALE_WHATSAPP',
              orderId: id,
              customerPhone,
              createdAt: now,
            });
            deducted.push({
              productId: entry.docRef.id,
              productName: entry.productData.name || entry.item.name,
              qty: entry.quantity,
              newStock,
            });
          }

          markOrderHandled();
          return {
            success: true,
            deducted,
            ...(orderUpdates ? { newlyConfirmed: true } : {}),
          };
        });

        const localOrder = id ? this.inMemoryOrders.get(id) : null;
        if (localOrder) {
          if (result.orderData) {
            Object.assign(localOrder, result.orderData);
          } else {
            localOrder.stockDeducted = true;
            localOrder.stockDeductedAt = localOrder.stockDeductedAt || now;
            if (orderUpdates && result.newlyConfirmed) {
              Object.assign(localOrder, orderUpdates);
            }
          }
        }
        for (const item of result.deducted) {
          const product = this.inMemoryProducts.get(String(item.productId));
          if (product) {
            product.stockQuantity = item.newStock;
            product.estoque = item.newStock;
            this.inMemoryProducts.set(String(item.productId), product);
          }
        }
        Logger.info(
          `Baixa atômica de estoque concluída no Firestore para ${result.deducted.length} itens.`
        );
        return result;
      } catch (err) {
        if (id) {
          throw new Error('Não foi possível persistir a baixa de estoque do pedido.', {
            cause: err,
          });
        }
        Logger.warn(
          'Erro ao realizar baixa atômica no Firestore; aplicando em memória',
          { error: err.message }
        );
      }
    } else if (id && (this.firestore || !this.isInMemory)) {
      throw new Error('Firestore indisponível para registrar a baixa de estoque do pedido.');
    }

    if (id) {
      const order = this.inMemoryOrders.get(id);
      if (!order) {
        throw new Error('Pedido não encontrado para registrar a baixa de estoque.');
      }
      validateOrderConfirmation(order, orderUpdates);
      items = Array.isArray(order.items) ? order.items : [];
      if (
        orderUpdates &&
        PAID_ORDER_STATUSES.has(order.status)
      ) {
        return {
          success: true,
          deducted: [],
          alreadyConfirmed: true,
          orderData: { ...order },
        };
      }
      if (order.stockDeducted) {
        if (!orderUpdates) {
          return { success: true, deducted: [], alreadyDeducted: true };
        }
        Object.assign(order, orderUpdates);
        return { success: true, deducted: [], newlyConfirmed: true };
      }
      if (!stockControlEnabled || items.length === 0) {
        order.stockDeducted = true;
        order.stockDeductedAt = now;
        if (orderUpdates) {Object.assign(order, orderUpdates);}
        return {
          success: true,
          deducted: [],
          ...(orderUpdates ? { newlyConfirmed: true } : {}),
          ...(!stockControlEnabled ? { trackingDisabled: true } : {}),
        };
      }
    } else if (!stockControlEnabled) {
      return { success: true, deducted: [], trackingDisabled: true };
    }

    // Valida todo o lote antes de alterar qualquer produto no modo local.
    const resolvedItems = new Map();
    for (const item of items) {
      const quantity = validateStockQuantity(item);
      let found = false;
      for (const [productId, product] of this.inMemoryProducts.entries()) {
        const matches = item.productId
          ? String(productId) === String(item.productId)
          : product.name === item.name || product.canonicalName === item.name;
        if (!matches) {continue;}
        found = true;
        const previous = resolvedItems.get(productId);
        resolvedItems.set(productId, { product, quantity: (previous?.quantity || 0) + quantity });
        break;
      }
      if (!found) {throw new Error(`Produto não encontrado para baixa: ${item.productId || item.name}.`);}
    }
    for (const { product, quantity } of resolvedItems.values()) {remainingStock(product, quantity);}
    const deducted = [];
    for (const [productId, { product, quantity }] of resolvedItems) {
        const previousStock = Number(product.stockQuantity ?? product.estoque ?? 0);
        const newStock = remainingStock(product, quantity);
        product.stockQuantity = newStock;
        product.estoque = newStock;
        this.inMemoryProducts.set(productId, product);
        deducted.push({
          productId,
          productName: product.name,
          qty: quantity,
          newStock,
        });
        this.inMemoryStockMovements.push({ productId, orderId: id, quantityDeducted: quantity,
          previousStock, newStock, type: 'SALE_WHATSAPP', customerPhone, createdAt: now });
    }

    if (id) {
      const order = this.inMemoryOrders.get(id);
      order.stockDeducted = true;
      order.stockDeductedAt = now;
      if (orderUpdates) {Object.assign(order, orderUpdates);}
    }
    return {
      success: true,
      deducted,
      ...(orderUpdates ? { newlyConfirmed: true } : {}),
    };
  }

  async getStockMovements(limit = 20) {
    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        const snap = await this.firestore
          .collection('stock_movements')
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .get();

        return snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      } catch (err) {
        if (
          err.code === 7 ||
          err.code === 'permission-denied' ||
          err.message?.includes('PERMISSION_DENIED') ||
          err.message?.includes('Missing or insufficient')
        ) {
          this._firestoreClientDisabled = true;
        } else {
          Logger.warn(
            'Erro ao buscar stock_movements no Firestore',
            { error: err.message }
          );
        }
      }
    }

    return this.inMemoryStockMovements.slice(-limit);
  }

  async quickAddStock(productId, quantityAdded) {
    const qty = parseInt(quantityAdded, 10) || 1;
    const now = new Date().toISOString();

    if (this.firestore) {
      try {
        const docRef = this.firestore
          .collection('products')
          .doc(String(productId));

        const snap = await docRef.get();

        if (snap.exists) {
          const data = snap.data();

          const currentStock =
            typeof data.stockQuantity === 'number'
              ? data.stockQuantity
              : data.estoque || 0;

          const newStock = currentStock + qty;

          await docRef.update({
            stockQuantity: newStock,
            estoque: newStock,
            updatedAt: now,
          });

          await this.firestore
            .collection('stock_movements')
            .add({
              productId: String(productId),
              productName: data.name || data.descricao,
              quantityAdded: qty,
              previousStock: currentStock,
              newStock,
              type: 'ENTRY_STOCK_QUICK',
              createdAt: now,
            });

          return {
            success: true,
            productId,
            newStock,
            previousStock: currentStock,
          };
        }
      } catch (err) {
        Logger.warn(
          'Erro ao dar entrada rápida no Firestore',
          { error: err.message }
        );
      }
    }

    const prod = this.inMemoryProducts.get(
      String(productId)
    );

    if (prod) {
      const prev =
        prod.stockQuantity ?? prod.estoque ?? 0;

      const next = prev + qty;

      prod.stockQuantity = next;
      prod.estoque = next;

      return {
        success: true,
        productId,
        newStock: next,
        previousStock: prev,
      };
    }

    return {
      success: false,
      error: 'Produto não encontrado',
    };
  }

  async createDirectOrder(orderData, { requirePersistence = false } = {}) {
    const now = new Date().toISOString();

    const dataWithTs = {
      ...orderData,
      status: orderData.status || 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    if (requirePersistence && (!this.firestore || this._firestoreClientDisabled)) {
      throw new Error('Não é possível iniciar o PIX sem persistência disponível para o pedido.');
    }

    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        const collection = this.firestore.collection('orders');
        const ref = dataWithTs.id
          ? collection.doc(String(dataWithTs.id))
          : collection.doc();
        const { ...documentData } = dataWithTs;
        await ref.set(documentData);

        const saved = {
          id: ref.id,
          ...documentData,
        };
        this.inMemoryOrders.set(ref.id, saved);
        return saved;
      } catch (err) {
        if (
          err.code === 7 ||
          err.code === 'permission-denied' ||
          err.message?.includes('PERMISSION_DENIED') ||
          err.message?.includes('Missing or insufficient')
        ) {
          this._firestoreClientDisabled = true;
        } else {
          Logger.warn(
            'Erro ao salvar pedido direto no Firestore',
            { error: err.message }
          );
        }
        if (requirePersistence) {
          throw new Error('Não foi possível salvar o pedido PIX com segurança.');
        }
      }
    }

    if (requirePersistence) {
      throw new Error('Não foi possível salvar o pedido PIX com segurança.');
    }

    const localId = dataWithTs.id
      ? String(dataWithTs.id)
      : `order-${Date.now()}`;

    const orderObj = {
      ...dataWithTs,
      id: localId,
    };

    this.inMemoryOrders.set(localId, orderObj);

    return orderObj;
  }

  async getSalesOrders() {
    if (!this.firestore || this._firestoreClientDisabled) {
      return Array.from(this.inMemoryOrders.values());
    }
    if (this.salesOrdersCache && Date.now() < this.salesOrdersCache.expiresAt) {
      return this.salesOrdersCache.orders;
    }
    try {
      const snapshot = await this.firestore.collection('orders').select('status', 'items').get();
      const orders = snapshot.docs.map((doc) => doc.data());
      this.salesOrdersCache = { orders, expiresAt: Date.now() + 60000 };
      return orders;
    } catch (err) {
      if (
        err.code === 7 ||
        err.code === 'permission-denied' ||
        err.message?.includes('PERMISSION_DENIED') ||
        err.message?.includes('Missing or insufficient')
      ) {
        this._firestoreClientDisabled = true;
      } else {
        Logger.warn('Erro ao buscar pedidos para ranking no Firestore', {
          error: err.message,
        });
      }
      return Array.from(this.inMemoryOrders.values());
    }
  }

  async getAllOrders(limit = 50) {
    if (this.firestore && !this._firestoreClientDisabled && !FirestoreRepository._globalClientDisabled) {
      try {
        const snap = await this.firestore
          .collection('orders')
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .get();

        if (!snap.empty) {
          const orders = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
          for (const order of orders) {
            this.inMemoryOrders.set(order.id, order);
          }
          return orders;
        }
      } catch (err) {
        const errText = String(err?.message || err?.details || err || '');
        if (
          err?.code === 7 ||
          err?.code === '7' ||
          err?.code === 'permission-denied' ||
          errText.includes('PERMISSION_DENIED') ||
          errText.includes('Missing or insufficient') ||
          errText.includes('7 PERMISSION_DENIED')
        ) {
          this._firestoreClientDisabled = true;
          FirestoreRepository._globalClientDisabled = true;
        } else {
          Logger.warn(
            'Erro ao buscar pedidos no Firestore',
            { error: err?.message || errText }
          );
        }
      }
    }

    if (config.firebase?.apiKey) {
      try {
        const restOrders = await this.fetchCollectionViaRest('orders');
        if (restOrders && restOrders.length > 0) {
          for (const o of restOrders) {
            this.inMemoryOrders.set(o.id, o);
          }
          return restOrders.slice(0, limit);
        }
      } catch {}
    }

    return Array.from(
      this.inMemoryOrders.values()
    ).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }

  async updateOrderStatus(orderId, status) {
    const normalizedStatus = String(status).toUpperCase();
    if (['CONFIRMED', 'PAID_CONFIRMED'].includes(normalizedStatus)) {
      const order = await this.confirmOrderPayment(orderId);
      return { success: true, orderId, status: order.status };
    }
    if (normalizedStatus === 'CANCELLED') {return this.cancelOrder(orderId);}
    return this.transitionOrder(orderId, normalizedStatus);
  }

  async isDuplicateMessage(messageId) {
    if (!messageId) {
      return false;
    }

    if (this.firestore) {
      try {
        const doc = await this.firestore
          .collection('processed_messages')
          .doc(messageId)
          .get();

        return doc.exists;
      } catch (err) {
        Logger.warn(
          'Erro ao verificar mensagem no Firestore; usando fallback',
          { error: err.message }
        );
      }
    }

    return this.inMemoryMessages.has(messageId);
  }

  async markMessageProcessed(messageId) {
    if (!messageId) {
      return;
    }

    if (this.firestore) {
      try {
        await this.firestore
          .collection('processed_messages')
          .doc(messageId)
          .set({
            processedAt: new Date().toISOString(),
          });

        return;
      } catch (err) {
        Logger.warn(
          'Erro ao registrar mensagem no Firestore; usando fallback',
          { error: err.message }
        );
      }
    }

    this.inMemoryMessages.add(messageId);
  }

  async getSessionHistory(phone, limit = 10) {
    if (!phone) {
      return [];
    }

    if (this.firestore) {
      try {
        const snapshot = await this.firestore
          .collection('sessions')
          .doc(phone)
          .collection('messages')
          .orderBy('timestamp', 'asc')
          .limitToLast(limit)
          .get();

        return snapshot.docs.map((doc) => doc.data());
      } catch (err) {
        Logger.warn(
          'Erro ao buscar histórico no Firestore; usando fallback',
          { error: err.message }
        );
      }
    }

    const session =
      this.inMemorySessions.get(phone) || [];

    return session.slice(-limit);
  }

  async appendMessage(phone, role, text) {
    if (!phone || !text) {
      return;
    }

    const messageData = {
      role,
      text,
      timestamp: new Date().toISOString(),
    };

    if (this.firestore) {
      try {
        await this.firestore
          .collection('sessions')
          .doc(phone)
          .collection('messages')
          .add(messageData);

        return;
      } catch (err) {
        Logger.warn(
          'Erro ao salvar mensagem no Firestore; usando fallback',
          { error: err.message }
        );
      }
    }

    if (!this.inMemorySessions.has(phone)) {
      this.inMemorySessions.set(phone, []);
    }

    this.inMemorySessions
      .get(phone)
      .push(messageData);
  }

  async saveOrder(phone, orderData) {
    const dataWithTs = {
      ...orderData,
      phone,
      updatedAt: new Date().toISOString(),
    };

    if (this.firestore) {
      try {
        await this.firestore
          .collection('orders')
          .doc(phone)
          .set(dataWithTs, { merge: true });

        return;
      } catch (err) {
        Logger.warn(
          'Erro ao salvar pedido no Firestore; usando fallback',
          { error: err.message }
        );
      }
    }

    this.inMemoryOrders.set(phone, dataWithTs);
  }

  async getOrder(phone) {
    if (!phone) {
      return null;
    }

    if (this.firestore) {
      try {
        const doc = await this.firestore
          .collection('orders')
          .doc(phone)
          .get();

        return doc.exists ? doc.data() : null;
      } catch (err) {
        Logger.warn(
          'Erro ao buscar pedido no Firestore; usando fallback',
          { error: err.message }
        );
      }
    }

    return this.inMemoryOrders.get(phone) || null;
  }

  async getCustomerProfile(phone) {
    if (!phone) {
      return null;
    }

    if (this.firestore) {
      try {
        const doc = await this.firestore
          .collection('customers')
          .doc(phone)
          .get();

        return doc.exists ? doc.data() : null;
      } catch (err) {
        Logger.warn(
          'Erro ao buscar perfil do cliente no Firestore; usando fallback',
          { error: err.message }
        );
      }
    }

    return this.inMemoryCustomers.get(phone) || null;
  }

  async searchCustomers(query, limit = 8) {
    const term = String(query || '').trim();

    const normalizedTerm = term.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const phoneTerm = term.replace(/\D/g, '');
    const customers = new Map();
    const addCustomer = (profile, phone = '') => {
      if (!profile) {return;}
      const customerPhone = String(profile.phone || phone).replace(/\D/g, '');
      const key = customerPhone || String(profile.id || profile.name || Math.random());
      customers.set(key, {
        id: profile.id || key,
        name: String(profile.name || profile.customerName || 'Cliente'),
        phone: customerPhone,
        cpfCnpj: profile.cpfCnpj || '',
        address: profile.address || profile.deliveryAddress || '',
        deliveryAddress: profile.deliveryAddress || profile.address || '',
        notes: profile.notes || '',
        debtBalance: Number(profile.debtBalance || 0),
      });
    };

    if (term.length === 0) {
      for (const [phone, profile] of this.inMemoryCustomers) {
        addCustomer(profile, phone);
        if (customers.size >= limit) {break;}
      }
      return Array.from(customers.values());
    }

    if (phoneTerm.length >= 4) {
      addCustomer(await this.getCustomerProfile(phoneTerm), phoneTerm);
    }

    if (this.firestore) {
      try {
        const snapshot = await this.firestore
          .collection('customers')
          .where('nameSearch', '>=', normalizedTerm)
          .where('nameSearch', '<=', `${normalizedTerm}\uf8ff`)
          .limit(Math.min(20, Math.max(1, limit)))
          .get();
        snapshot.docs.forEach((doc) => addCustomer(doc.data(), doc.id));
      } catch (err) {
        Logger.warn('Erro ao buscar clientes por nome', { error: err.message });
      }
    }

    for (const [phone, profile] of this.inMemoryCustomers) {
      const profileName = String(profile.name || profile.customerName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      const normalizedPhone = String(profile.phone || phone).replace(/\D/g, '');
      if (profileName.includes(normalizedTerm) || (phoneTerm.length >= 3 && normalizedPhone.includes(phoneTerm))) {
        addCustomer(profile, phone);
      }
    }

    return Array.from(customers.values()).slice(0, Math.min(20, Math.max(1, limit)));
  }

  async saveCustomerProfile(phone, profileData) {
    if (!phone) {
      return;
    }

    const dataWithTs = {
      ...profileData,
      phone: String(phone).replace(/\D/g, ''),
      nameSearch: String(profileData.name || profileData.customerName || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase(),
      updatedAt: new Date().toISOString(),
    };

    if (this.firestore) {
      try {
        await this.firestore
          .collection('customers')
          .doc(phone)
          .set(dataWithTs, { merge: true });

        return;
      } catch (err) {
        Logger.warn(
          'Erro ao salvar perfil do cliente no Firestore; usando fallback',
          { error: err.message }
        );
      }
    }

    const existing =
      this.inMemoryCustomers.get(phone) || {};

    this.inMemoryCustomers.set(phone, {
      ...existing,
      ...dataWithTs,
    });
  }

  // --- Gestão de Fiado & Quitação de Dívidas ---
  async recordCustomerDebt({ customerKey, customerName, customerPhone, orderId, ticketNumber, amount, operatorName, sellerName, notes }) {
    const val = Number(amount || 0);
    const now = new Date().toISOString();
    const debtId = `debt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const debtEntry = {
      id: debtId,
      customerKey: String(customerKey || customerPhone || 'cliente'),
      customerName: customerName || 'Cliente',
      customerPhone: customerPhone || '',
      orderId: orderId || '',
      ticketNumber: ticketNumber || '',
      amount: val,
      type: 'DEBITO_FIADO',
      operatorName: operatorName || 'Caixa',
      sellerName: sellerName || operatorName || 'Vendedor',
      notes: notes || 'Compra fiada no balcão',
      createdAt: now,
    };

    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        await this.firestore.collection('customer_debts').doc(debtId).set(debtEntry);
        const custRef = this.firestore.collection('customers').doc(String(customerKey || customerPhone));
        const custSnap = await custRef.get();
        const currentBalance = custSnap.exists ? Number(custSnap.data().debtBalance || 0) : 0;
        await custRef.set({ debtBalance: currentBalance + val, updatedAt: now }, { merge: true });
      } catch (err) {
        Logger.warn('Erro ao salvar lançamento de dívida no Firestore', { error: err.message });
      }
    }

    this.inMemoryCustomerDebts = this.inMemoryCustomerDebts || [];
    this.inMemoryCustomerDebts.push(debtEntry);

    const cust = this.inMemoryCustomers.get(customerKey) || this.inMemoryCustomers.get(customerPhone) || {};
    const currentBalance = Number(cust.debtBalance || 0);
    const updatedCust = { ...cust, debtBalance: currentBalance + val, updatedAt: now };
    if (customerKey) this.inMemoryCustomers.set(customerKey, updatedCust);
    if (customerPhone) this.inMemoryCustomers.set(customerPhone, updatedCust);

    return debtEntry;
  }

  async settleCustomerDebt({ customerKey, customerName, customerPhone, amount, paymentMethod = 'DINHEIRO', operatorName, notes }) {
    const val = Number(amount || 0);
    const now = new Date().toISOString();
    const settlementId = `settle-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const settlementEntry = {
      id: settlementId,
      customerKey: String(customerKey || customerPhone || 'cliente'),
      customerName: customerName || 'Cliente',
      customerPhone: customerPhone || '',
      amount: val,
      paymentMethod: paymentMethod.toUpperCase(),
      type: 'QUITACAO_FIADO',
      operatorName: operatorName || 'Caixa',
      notes: notes || 'Recebimento de dívida fiado no caixa',
      createdAt: now,
    };

    let newBalance = 0;
    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        await this.firestore.collection('debt_settlements').doc(settlementId).set(settlementEntry);
        const custRef = this.firestore.collection('customers').doc(String(customerKey || customerPhone));
        const custSnap = await custRef.get();
        const currentBalance = custSnap.exists ? Number(custSnap.data().debtBalance || 0) : 0;
        newBalance = Math.max(0, currentBalance - val);
        await custRef.set({ debtBalance: newBalance, updatedAt: now }, { merge: true });
      } catch (err) {
        Logger.warn('Erro ao salvar quitação de dívida no Firestore', { error: err.message });
      }
    }

    this.inMemoryDebtSettlements = this.inMemoryDebtSettlements || [];
    this.inMemoryDebtSettlements.push(settlementEntry);

    const cust = this.inMemoryCustomers.get(customerKey) || this.inMemoryCustomers.get(customerPhone) || {};
    const currentBalance = Number(cust.debtBalance || 0);
    newBalance = Math.max(0, currentBalance - val);
    const updatedCust = { ...cust, debtBalance: newBalance, updatedAt: now };
    if (customerKey) this.inMemoryCustomers.set(customerKey, updatedCust);
    if (customerPhone) this.inMemoryCustomers.set(customerPhone, updatedCust);

    return {
      success: true,
      settlementId,
      amount: val,
      newBalance,
      settlement: settlementEntry,
    };
  }

  async getCustomerDebts(customerKey) {
    const key = String(customerKey || '').trim();
    let balance = 0;
    let transactions = [];

    if (this.firestore && !this._firestoreClientDisabled) {
      try {
        const custDoc = await this.firestore.collection('customers').doc(key).get();
        if (custDoc.exists) {
          balance = Number(custDoc.data().debtBalance || 0);
        }
        const debtsSnap = await this.firestore.collection('customer_debts').where('customerKey', '==', key).get();
        const debts = debtsSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        const settlesSnap = await this.firestore.collection('debt_settlements').where('customerKey', '==', key).get();
        const settles = settlesSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        transactions = [...debts, ...settles].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return { customerKey: key, balance, transactions };
      } catch (err) {
        Logger.warn('Erro ao buscar dívidas do cliente no Firestore', { error: err.message });
      }
    }

    const cust = this.inMemoryCustomers.get(key);
    balance = Number(cust?.debtBalance || 0);
    const debts = (this.inMemoryCustomerDebts || []).filter(d => d.customerKey === key);
    const settles = (this.inMemoryDebtSettlements || []).filter(s => s.customerKey === key);
    transactions = [...debts, ...settles].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return { customerKey: key, balance, transactions };
  }

  // --- Colaboradores e Controle de Acesso (RBAC) ---

  async getAllUsers() {
    if (this.firestore) {
      const snap = await this.firestore.collection('users').get();
      return snap.docs.map(d => ({ ...d.data(), id: d.id }));
    }
    if (!this.isInMemory) {throw new Error('Cadastro de usuários indisponível.');}
    return Array.from(this.inMemoryUsers.values());
  }

  async saveUser(userData) {
    const id =
      userData.id || `usr-${Date.now()}`;

    const email = (userData.email || '')
      .toLowerCase()
      .trim();

    let role = (userData.role || 'CLIENTE')
      .toUpperCase();

    if (
      !['ADMIN', 'CAIXA', 'VENDEDOR', 'CLIENTE'].includes(role)
    ) {
      role = 'CLIENTE';
    }


    const dataWithTs = {
      ...userData,
      id: String(id),
      email,
      role,
      active: userData.active !== false,
      updatedAt: new Date().toISOString(),
    };

    if (this.firestore) {
      try {
        await this.firestore
          .collection('users')
          .doc(String(id))
          .set(dataWithTs, { merge: true });
      } catch (err) {
        Logger.warn(
          'Erro ao salvar usuário no Firestore',
          { error: err.message }
        );
        throw err;
      }
    }

    this.inMemoryUsers.set(
      String(id),
      dataWithTs
    );

    return dataWithTs;
  }

  async registerUser({
    name,
    email,
    password,
    phone,
    address,
  }) {
    if (!email || !email.includes('@')) {
      return {
        success: false,
        error: 'E-mail inválido.',
      };
    }

    if (!password || password.length < 4) {
      return {
        success: false,
        error: 'A senha deve conter pelo menos 4 caracteres.',
      };
    }

    const normalizedEmail = email
      .toLowerCase()
      .trim();

    if (normalizedEmail === 'edmarjuniob@gmail.com') {
      return { success: false, error: 'Use o Google para acessar a conta do administrador.' };
    }

    const users = await this.getAllUsers();

    const existing = users.find(
      (u) =>
        u.email &&
        u.email.toLowerCase().trim() === normalizedEmail
    );

    if (existing) {
      return {
        success: false,
        error:
          'Este e-mail já possui cadastro. Faça login com sua senha ou com o Google.',
      };
    }

    const role = 'CLIENTE';

    const newUser = {
      id: `usr-${Date.now()}`,
      name: name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      password,
      phone: phone || '',
      address: address || '',
      role,
      active: true,
      authProvider: 'PASSWORD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveUser(newUser);

    const userWithoutSecrets = safeUser(newUser);

    return {
      success: true,
      user: userWithoutSecrets,
    };
  }

  async loginUser(email, password) {
    if (!email || !password) {
      return {
        success: false,
        error: 'Informe e-mail e senha.',
      };
    }

    const normalizedEmail = email
      .toLowerCase()
      .trim();

    const users = await this.getAllUsers();

    const user = users.find(
      (u) =>
        u.email &&
        u.email.toLowerCase().trim() === normalizedEmail
    );

    if (!user) {
      return {
        success: false,
        error:
          'Usuário não encontrado com este e-mail. Crie sua conta primeiro!',
      };
    }

    if (user.active === false) {
      return {
        success: false,
        error: 'Usuário inativo. Entre em contato com a Conflora.',
      };
    }

    // Permite login via password OU pin do colaborador.
    const isPasswordMatch =
      user.password &&
      String(user.password) === String(password);

    const isPinMatch =
      user.pin &&
      String(user.pin) === String(password);

    if (!isPasswordMatch && !isPinMatch) {
      return {
        success: false,
        error: 'Senha incorreta.',
      };
    }

    const userWithoutSecrets = safeUser(user);

    return {
      success: true,
      user: userWithoutSecrets,
    };
  }

  async updateUserRole(userId, newRole) {
    const normalizedRole = (newRole || 'CLIENTE')
      .toUpperCase();

    if (
      !['ADMIN', 'CAIXA', 'VENDEDOR', 'CLIENTE'].includes(normalizedRole)
    ) {
      return {
        success: false,
        error:
          'Perfil inválido. Escolha ADMIN, CAIXA, VENDEDOR ou CLIENTE.',
      };
    }

    const users = await this.getAllUsers();

    const user = users.find(
      (u) => String(u.id) === String(userId)
    );

    if (!user) {
      return {
        success: false,
        error: 'Usuário não encontrado.',
      };
    }

    user.role = normalizedRole;
    user.updatedAt = new Date().toISOString();

    await this.saveUser(user);

    const userWithoutSecrets = safeUser(user);

    return {
      success: true,
      user: userWithoutSecrets,
    };
  }

  async deleteUser(userId) {
    if (!userId || userId === 'usr-edmar') {
      return false;
    }

    if (this.firestore) {
      try {
        await this.firestore
          .collection('users')
          .doc(String(userId))
          .delete();
      } catch (err) {
        Logger.warn(
          'Erro ao excluir usuário no Firestore',
          { error: err.message }
        );
      }
    }

    this.inMemoryUsers.delete(String(userId));

    return true;
  }

  async authenticateUser(userId, pin) {
    const users = await this.getAllUsers();

    const user = users.find(
      (u) =>
        String(u.id) === String(userId) ||
        u.email === userId
    );

    if (!user) {
      return {
        success: false,
        error: 'Usuário não encontrado',
      };
    }

    if (!user.active) {
      return {
        success: false,
        error: 'Usuário inativo',
      };
    }

    if (!['ADMIN', 'CAIXA', 'VENDEDOR'].includes(user.role) || !pin ||
      !((user.pin && String(user.pin) === String(pin)) ||
        (user.password && String(user.password) === String(pin)))) {
      return {
        success: false,
        error: 'PIN de segurança incorreto',
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getCustomerPurchases(
    customerId = '',
    customerEmail = '',
    customerPhone = ''
  ) {
    const allOrders = await this.getAllOrders(200);

    const normEmail = (customerEmail || '')
      .toLowerCase()
      .trim();

    const normPhone = (customerPhone || '')
      .replace(/\D/g, '');

    const cleanId = String(customerId || '').trim();

    const matchedOrders = allOrders.filter((ord) => {
      if (
        cleanId &&
        ord.customerId &&
        String(ord.customerId) === cleanId
      ) {
        return true;
      }

      if (
        normEmail &&
        ord.customerEmail &&
        ord.customerEmail.toLowerCase().trim() === normEmail
      ) {
        return true;
      }

      if (normPhone && ord.customerPhone) {
        const ordPhone = ord.customerPhone
          .replace(/\D/g, '');

        if (
          ordPhone &&
          (
            ordPhone.includes(normPhone) ||
            normPhone.includes(ordPhone)
          )
        ) {
          return true;
        }
      }

      return false;
    });

    matchedOrders.sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );

    // Agrega produtos mais comprados.
    const productsMap = new Map();
    let totalSpent = 0;

    for (const ord of matchedOrders) {
      const orderTotal = Number(ord.total || 0);

      totalSpent += orderTotal;

      if (Array.isArray(ord.items)) {
        for (const item of ord.items) {
          const key = String(
            item.productId || item.name || 'item'
          );

          const qty = Number(item.quantity || 1);
          const price = Number(item.price || 0);

          if (!productsMap.has(key)) {
            productsMap.set(key, {
              productId: item.productId || key,
              name: item.name || 'Produto Conflora',
              unit: item.unit || 'UN',
              price,
              totalQuantityBought: 0,
              purchaseCount: 0,
              totalSpentOnItem: 0,
            });
          }

          const prodData = productsMap.get(key);

          prodData.totalQuantityBought += qty;
          prodData.purchaseCount += 1;
          prodData.totalSpentOnItem += qty * price;
        }
      }
    }

    const mostPurchasedProducts = Array.from(
      productsMap.values()
    )
      .sort(
        (a, b) =>
          b.totalQuantityBought - a.totalQuantityBought
      )
      .slice(0, 10);

    const loyaltyPoints = Math.floor(totalSpent / 10);

    return {
      orders: matchedOrders,
      mostPurchasedProducts,
      totalSpent,
      totalOrders: matchedOrders.length,
      loyaltyPoints,
    };
  }

  // --- Solicitações de Alteração de Vendas (Estilo Git Diff) ---

  async createOrderAlterationRequest({
    orderId,
    originalOrder,
    proposedOrder,
    requestedBy,
    requestedByName,
    reason,
  }) {
    const now = new Date().toISOString();
    const requestId = `alt-${Date.now()}`;

    // Construção visual do diff estilo Git.
    const diffLines = [];

    diffLines.push({
      type: 'info',
      text:
        `@@ Pedido #${String(orderId).slice(-6)} - Alteração Solicitada por ${requestedByName || 'Caixa'} @@`,
    });

    if (
      (originalOrder.paymentMethod || '') !==
      (proposedOrder.paymentMethod || '')
    ) {
      diffLines.push({
        type: 'del',
        text:
          `- Forma de Pagamento: ${originalOrder.paymentMethod || 'Não informado'}`,
      });

      diffLines.push({
        type: 'add',
        text:
          `+ Forma de Pagamento: ${proposedOrder.paymentMethod}`,
      });
    }

    if (
      Number(originalOrder.total || 0) !==
      Number(proposedOrder.total || 0)
    ) {
      diffLines.push({
        type: 'del',
        text:
          `- Total Anterior: R$ ${Number(originalOrder.total || 0).toFixed(2).replace('.', ',')}`,
      });

      diffLines.push({
        type: 'add',
        text:
          `+ Novo Total: R$ ${Number(proposedOrder.total || 0).toFixed(2).replace('.', ',')}`,
      });
    }

    if (
      (originalOrder.customerName || '') !==
      (proposedOrder.customerName || '')
    ) {
      diffLines.push({
        type: 'del',
        text:
          `- Cliente: ${originalOrder.customerName || 'Não informado'}`,
      });

      diffLines.push({
        type: 'add',
        text:
          `+ Cliente: ${proposedOrder.customerName}`,
      });
    }

    // Compara itens da venda.
    const origItems = originalOrder.items || [];
    const propItems = proposedOrder.items || [];

    origItems.forEach((it) => {
      const match = propItems.find(
        (p) =>
          String(p.productId || p.id) ===
            String(it.productId || it.id) ||
          p.name === it.name
      );

      if (!match) {
        diffLines.push({
          type: 'del',
          text:
            `- Item Removido: ${it.quantity}x ${it.name} (R$ ${Number(it.price || 0).toFixed(2)})`,
        });
      } else if (match.quantity !== it.quantity) {
        diffLines.push({
          type: 'del',
          text:
            `- Quantidade Anterior: ${it.quantity}x ${it.name}`,
        });

        diffLines.push({
          type: 'add',
          text:
            `+ Nova Quantidade: ${match.quantity}x ${it.name}`,
        });
      }
    });

    propItems.forEach((it) => {
      const match = origItems.find(
        (p) =>
          String(p.productId || p.id) ===
            String(it.productId || it.id) ||
          p.name === it.name
      );

      if (!match) {
        diffLines.push({
          type: 'add',
          text:
            `+ Item Adicionado: ${it.quantity}x ${it.name} (R$ ${Number(it.price || 0).toFixed(2)})`,
        });
      }
    });

    const requestObj = {
      id: requestId,
      orderId,
      originalOrder,
      proposedOrder,
      requestedBy: requestedBy || 'usr-caixa1',
      requestedByName:
        requestedByName || 'Atendente do Caixa',
      reason:
        reason || 'Correção de lançamento de venda',
      diffLines,
      status: 'PENDING',
      createdAt: now,
    };

    if (this.firestore) {
      try {
        await this.firestore
          .collection('order_alterations')
          .doc(requestId)
          .set(requestObj);

        await this.firestore
          .collection('orders')
          .doc(String(orderId))
          .set(
            { hasPendingAlteration: true },
            { merge: true }
          );
      } catch (err) {
        Logger.warn(
          'Erro ao salvar solicitação de alteração no Firestore',
          { error: err.message }
        );
      }
    }

    this.inMemoryOrderAlterations.set(
      requestId,
      requestObj
    );

    return requestObj;
  }

  async getAllOrderAlterations() {
    if (this.firestore) {
      try {
        const snap = await this.firestore
          .collection('order_alterations')
          .orderBy('createdAt', 'desc')
          .get();

        if (!snap.empty) {
          return snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
        }
      } catch (err) {
        Logger.warn(
          'Erro ao buscar alterações no Firestore',
          { error: err.message }
        );
      }
    }

    return Array.from(
      this.inMemoryOrderAlterations.values()
    ).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }

  async reviewOrderAlteration({
    requestId,
    action,
    reviewedBy,
    rejectionReason,
  }) {
    const now = new Date().toISOString();
    let reqObj = null;

    if (this.firestore) {
      try {
        const doc = await this.firestore
          .collection('order_alterations')
          .doc(requestId)
          .get();

        if (doc.exists) {
          reqObj = {
            id: doc.id,
            ...doc.data(),
          };
        }
      } catch (err) {
        Logger.warn(
          'Erro ao buscar pedido de alteração no Firestore',
          { error: err.message }
        );
      }
    }

    if (!reqObj) {
      reqObj = this.inMemoryOrderAlterations.get(
        requestId
      );
    }

    if (!reqObj) {
      return {
        success: false,
        error: 'Solicitação não encontrada',
      };
    }

    if (action === 'APPROVED') {
      reqObj.status = 'APPROVED';
      reqObj.reviewedAt = now;
      reqObj.reviewedBy = reviewedBy || 'Edmar Júnio';

      const updatedOrderData = {
        ...reqObj.proposedOrder,
        id: reqObj.orderId,
        hasPendingAlteration: false,
        updatedAt: now,
        lastAlterationApprovedAt: now,
      };

      if (this.firestore) {
        try {
          await this.firestore
            .collection('orders')
            .doc(String(reqObj.orderId))
            .set(
              updatedOrderData,
              { merge: true }
            );

          await this.firestore
            .collection('order_alterations')
            .doc(requestId)
            .update({
              status: 'APPROVED',
              reviewedAt: now,
              reviewedBy: reqObj.reviewedBy,
            });
        } catch (err) {
          Logger.warn(
            'Erro ao aplicar alteração aprovada no Firestore',
            { error: err.message }
          );
        }
      }

      this.inMemoryOrders.set(
        String(reqObj.orderId),
        updatedOrderData
      );

      // Notificação para o Atendente.
      await this.createNotification({
        toUserId: reqObj.requestedBy,
        toUserName: reqObj.requestedByName,
        type: 'APPROVED',
        orderId: reqObj.orderId,
        title:
          `✅ Alteração Aprovada (Pedido #${String(reqObj.orderId).slice(-6)})`,
        message:
          `Sua solicitação de alteração no valor de R$ ${Number(reqObj.proposedOrder.total || 0).toFixed(2).replace('.', ',')} foi aceita e consolidada pelo Administrador.`,
      });

      return {
        success: true,
        status: 'APPROVED',
        order: updatedOrderData,
      };
    } else {
      reqObj.status = 'REJECTED';
      reqObj.rejectionReason =
        rejectionReason || 'Não autorizado pelo Administrador.';
      reqObj.reviewedAt = now;
      reqObj.reviewedBy =
        reviewedBy || 'Edmar Júnio';

      if (this.firestore) {
        try {
          await this.firestore
            .collection('order_alterations')
            .doc(requestId)
            .update({
              status: 'REJECTED',
              rejectionReason: reqObj.rejectionReason,
              reviewedAt: now,
              reviewedBy: reqObj.reviewedBy,
            });

          await this.firestore
            .collection('orders')
            .doc(String(reqObj.orderId))
            .set(
              { hasPendingAlteration: false },
              { merge: true }
            );
        } catch (err) {
          Logger.warn(
            'Erro ao registrar recusa no Firestore',
            { error: err.message }
          );
        }
      }

      // Notificação com o motivo do cancelamento.
      await this.createNotification({
        toUserId: reqObj.requestedBy,
        toUserName: reqObj.requestedByName,
        type: 'REJECTED',
        orderId: reqObj.orderId,
        title:
          `❌ Alteração Recusada (Pedido #${String(reqObj.orderId).slice(-6)})`,
        message:
          `Sua solicitação de alteração foi cancelada pelo Administrador. Motivo informado: "${reqObj.rejectionReason}"`,
        reason: reqObj.rejectionReason,
      });

      return {
        success: true,
        status: 'REJECTED',
        reason: reqObj.rejectionReason,
      };
    }
  }

  // --- Notificações ---

  async createDiscountApproval(approvalData) {
    const id = `discount-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const approval = {
      id,
      ...approvalData,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    if (this.firestore) {
      await this.firestore.collection('discount_approvals').doc(id).set(approval);
    }
    this.inMemoryDiscountApprovals.set(id, approval);

    let admins = [];
    try {
      admins = (await this.getAllUsers()).filter((user) => user.active !== false && user.role === 'ADMIN');
    } catch (err) {
      Logger.warn('Erro ao listar administradores para aprovação de desconto', { error: err.message });
    }
    if (!admins.length) {
      admins = [{ id: 'usr-edmar', name: 'Edmar Júnio (Admin)' }];
    }
    for (const admin of admins) {
      await this.createNotification({
        toUserId: admin.id,
        toUserName: admin.name,
        targetRole: 'ADMIN',
        type: 'DISCOUNT_APPROVAL_PENDING',
        approvalId: id,
        title: 'Aprovação de desconto pendente',
        message: `${approval.operatorName || 'Operador'} solicitou ${approval.discountPercent}% de desconto em uma venda de ${Number(approval.total).toFixed(2).replace('.', ',')} para ${approval.customerName || 'Cliente'}.`,
        orderTotal: approval.total,
      });
    }
    return approval;
  }

  async getDiscountApproval(approvalId) {
    if (this.firestore) {
      try {
        const doc = await this.firestore.collection('discount_approvals').doc(String(approvalId)).get();
        if (doc.exists) {
          const approval = { id: doc.id, ...doc.data() };
          this.inMemoryDiscountApprovals.set(approval.id, approval);
          return approval;
        }
      } catch (err) {
        Logger.warn('Erro ao buscar aprovação de desconto', { error: err.message });
      }
    }
    return this.inMemoryDiscountApprovals.get(String(approvalId)) || null;
  }

  async getPendingDiscountApprovals() {
    if (this.firestore) {
      try {
        const snapshot = await this.firestore.collection('discount_approvals').where('status', '==', 'PENDING').get();
        const approvals = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        approvals.forEach((approval) => this.inMemoryDiscountApprovals.set(approval.id, approval));
        return approvals.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      } catch (err) {
        Logger.warn('Erro ao listar aprovações de desconto', { error: err.message });
      }
    }
    return Array.from(this.inMemoryDiscountApprovals.values())
      .filter((approval) => approval.status === 'PENDING')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async updateDiscountApproval(approvalId, updates) {
    const approval = await this.getDiscountApproval(approvalId);
    if (!approval) {return null;}
    const updated = { ...approval, ...updates, updatedAt: new Date().toISOString() };
    if (this.firestore) {
      await this.firestore.collection('discount_approvals').doc(String(approvalId)).set(updated, { merge: true });
    }
    this.inMemoryDiscountApprovals.set(String(approvalId), updated);
    return updated;
  }

  /**
   * Envia notificação de venda finalizada para todos os usuários com papel ADMIN.
   * @param {Object} order Dados do pedido / venda finalizada
   * @param {Object} [options] Informações adicionais de contexto (canal, notas)
   * @returns {Promise<Array<Object>>} Lista de notificações criadas para os administradores
   */
  async notifyAllAdminUsersOfSale(order, options = {}) {
    if (!order) {
      return [];
    }

    let adminUsers = [];
    try {
      const allUsers = await this.getAllUsers();
      adminUsers = allUsers.filter((u) => u.active !== false && u.role === 'ADMIN');
    } catch (err) {
      Logger.warn('Erro ao listar usuários para notificação de ADMIN', { error: err.message });
    }

    if (adminUsers.length === 0) {
      adminUsers = [{ id: 'usr-edmar', name: 'Edmar Júnio (Admin)', role: 'ADMIN' }];
    }

    const orderId = order.id || `ord-${Date.now()}`;
    const shortId = String(orderId).slice(-6);
    const totalFormatted = Number(order.total || 0).toFixed(2).replace('.', ',');
    const customer = order.customerName || 'Cliente';
    const payment = order.paymentMethod || 'PIX';
    const itemsCount = Array.isArray(order.items) ? order.items.length : 0;
    const sourceLabel = order.source === 'CAIXA_MANUAL' ? 'Caixa / Balcão' : (order.source === 'WEB_CATALOG' ? 'Catálogo Digital' : 'WhatsApp');

    const createdNotifications = [];

    for (const admin of adminUsers) {
      const notif = await this.createNotification({
        toUserId: admin.id,
        toUserName: admin.name,
        targetRole: 'ADMIN',
        type: 'SALE_COMPLETED',
        orderId,
        title: `🎉 Nova Venda Finalizada! (Pedido #${shortId})`,
        message: `Venda de R$ ${totalFormatted} finalizada para ${customer} via ${payment} (${sourceLabel}). ${itemsCount} item(ns).`,
        orderTotal: Number(order.total || 0),
        paymentMethod: payment,
        itemsCount,
        customerName: customer,
        source: order.source || options.source || 'CATALOG',
      });
      createdNotifications.push(notif);
    }

    return createdNotifications;
  }

  async createNotification(notifData) {
    const now = new Date().toISOString();

    const notif = {
      id:
        `notif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...notifData,
      read: false,
      createdAt: now,
    };

    if (this.firestore) {
      try {
        await this.firestore
          .collection('notifications')
          .add(notif);
      } catch (err) {
        Logger.warn(
          'Erro ao salvar notificação no Firestore',
          { error: err.message }
        );
      }
    }

    this.inMemoryNotifications.unshift(notif);

    return notif;
  }

  async getUserNotifications(userId) {
    let isAdmin = false;
    if (userId) {
      try {
        const users = await this.getAllUsers();
        const user = users.find((u) => u.id === userId);
        if (user && user.role === 'ADMIN') {
          isAdmin = true;
        }
      } catch {
        isAdmin = false;
      }
    }

    if (this.firestore) {
      try {
        const snap = await this.firestore
          .collection('notifications')
          .orderBy('createdAt', 'desc')
          .limit(30)
          .get();

        if (!snap.empty) {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          if (userId) {
            return list.filter(
              (n) =>
                !n.toUserId ||
                n.toUserId === userId ||
                (isAdmin && n.targetRole === 'ADMIN') ||
                userId === 'usr-edmar'
            );
          }

          return list;
        }
      } catch (err) {
        Logger.warn(
          'Erro ao buscar notificações no Firestore',
          { error: err.message }
        );
      }
    }

    if (userId && userId !== 'usr-edmar' && !isAdmin) {
      return this.inMemoryNotifications.filter(
        (n) =>
          !n.toUserId ||
          n.toUserId === userId ||
          (isAdmin && n.targetRole === 'ADMIN')
      );
    }

    return this.inMemoryNotifications;
  }

  async markNotificationRead(notifId) {
    if (this.firestore) {
      try {
        await this.firestore
          .collection('notifications')
          .doc(String(notifId))
          .update({
            read: true,
          });
      } catch (err) {
        Logger.warn(
          'Erro ao marcar notificação como lida no Firestore',
          { error: err.message }
        );
      }
    }

    const n = this.inMemoryNotifications.find(
      (x) => x.id === notifId
    );

    if (n) {
      n.read = true;
    }

    return true;
  }

  // --- Métricas do Dia e Analytics ---

  async getDailySalesMetrics() {
    const allOrders = await this.getAllOrders(200);
    const todayStr = new Date()
      .toISOString()
      .slice(0, 10);

    const todayOrders = allOrders.filter((o) => {
      const orderDate = (o.createdAt || '')
        .slice(0, 10);

      return orderDate === todayStr;
    });

    let totalRevenue = 0;

    const byPayment = {
      PIX: 0,
      CARTAO: 0,
      DINHEIRO: 0,
    };

    const byStatus = {
      PENDING: 0,
      CONFIRMED: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };

    for (const ord of todayOrders) {
      const val = Number(ord.total || 0);

      totalRevenue += val;

      const pay = (ord.paymentMethod || 'DINHEIRO')
        .toUpperCase();

      if (pay.includes('PIX')) {
        byPayment.PIX += val;
      } else if (
        pay.includes('CART') ||
        pay.includes('DEBITO') ||
        pay.includes('CREDITO')
      ) {
        byPayment.CARTAO += val;
      } else {
        byPayment.DINHEIRO += val;
      }

      const st = ord.status || 'PENDING';

      byStatus[st] = (byStatus[st] || 0) + 1;
    }

    const ticketMedio =
      todayOrders.length > 0
        ? totalRevenue / todayOrders.length
        : 0;

    return {
      date: todayStr,
      todayOrdersCount: todayOrders.length,
      totalRevenue,
      ticketMedio,
      byPayment,
      byStatus,
      todayOrders,
    };
  }
}

module.exports = {
  FirestoreRepository,
  auditProductRecords,
};
