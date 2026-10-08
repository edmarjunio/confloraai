const { t } = require('../i18n');
const config = require('../config/env');
const Logger = require('../shared/logger');

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
        t("interface.message.6b842d0e27f7"),
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
      errors.push(prefix + t("interface.text.dd894729f222"));
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
          t("interface.text.3d046470796d")
      );
    }

    if (ids.has(id)) {
      errors.push(prefix + 'Product ID duplicado: ' + id + '.');
    }

    ids.add(id);

    if (!name) {
      errors.push(prefix + t("interface.text.19e504849110"));
    }

    if (!category) {
      errors.push(prefix + t("interface.text.99ab4c2107a3"));
    }

    if (!Number.isFinite(price) || price <= 0) {
      errors.push(prefix + t("interface.text.bbb173d1d692"));
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
      [[t("interface.message.babbbe39d957"), 'address'], 'address'],
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
      t("interface.message.77b86589aa02"),
    ]);

    if (stock !== undefined) {
      const quantity = parseImportNumber(stock);

      if (!Number.isFinite(quantity) || quantity < 0) {
        errors.push(
          prefix + t("interface.text.59f4fe1d056f")
        );
      } else {
        Object.assign(product, {
          stockQuantity: quantity,
          estoque: quantity,
        });
      }
    }

    const imageValue = readImportField(record, ['ImageURL']);
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
      errors.push(prefix + t("interface.text.3ca8475aa7d3"));
    }

    if (isImportImageUrl(imageValue)) {
      images.unshift(imageValue.trim());
    }

    // ImageURL do AppSheet pode ser só um caminho.
    // Não o transforma em URL pública.
    if (images.length > 0) {
      product.images = [...new Set(images)];
      product.imageUrl = product.images[0];
    } else {
      // Um caminho relativo/array vazio não deve substituir
      // uma imagem válida existente.
      delete product.imageUrl;
      delete product.imageurl;
      delete product.images;

      warnings.push(
        prefix +
          name +
          t("interface.text.f7018c4deeb4")
      );
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
  } = {}) {
    this.firestore = firestoreInstance;
    this.isInMemory =
      isInMemory || process.env.NODE_ENV === 'test';

    this.inMemoryMessages = new Set();
    this.inMemorySessions = new Map();
    this.inMemoryOrders = new Map();
    this.inMemoryCustomers = new Map();
    this.inMemoryProducts = new Map();
    this.inMemoryStockMovements = [];
    this.inMemoryUsers = new Map();
    this.inMemoryOrderAlterations = new Map();
    this.inMemoryNotifications = [];

    const defaultUsers = [
      {
        id: 'usr-edmar',
        name: 'Edmar Júnio (Izibola)',
        email: t("interface.message.ef748fa607f2"),
        role: 'ADMIN',
        pin: '1234',
        active: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr-caixa1',
        name: 'Atendente do Caixa',
        email: t("interface.message.e60c1293832f"),
        role: 'CAIXA',
        pin: '0000',
        active: true,
        createdAt: new Date().toISOString(),
      },
    ];

    for (const u of defaultUsers) {
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
          const clientConfig = {
            projectId: config.gcp.projectId,
          };

          if (config.gcp.keyFilename) {
            clientConfig.keyFilename = config.gcp.keyFilename;
          }

          this.firestore = new mod.Firestore(clientConfig);

          Logger.info(
            `Firestore conectado ao projeto: ${config.gcp.projectId}`
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

  // --- Produtos e Estoque (AppSheet & WhatsApp) ---

  async getProductCollectionPath() {
    if (!this.firestore) { return 'products'; }
    const state = await require('../import/product-catalog').catalogState(this.firestore);
    return state.collectionPath;
  }
  async getAllProducts() {
    if (this.firestore) {
      try {
        const snapshot = await this.firestore
          .collection(await this.getProductCollectionPath())
          .get();

        // ID do documento é a identidade.
        // Nomes repetidos representam produtos distintos.
        const products = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));

        this.inMemoryProducts.clear();

        for (const product of products) {
          this.inMemoryProducts.set(product.id, product);
        }

        return products;
      } catch (err) {
        Logger.warn(t("interface.message.aceb9c0cefb9"), {
          error: err.message,
        });

        throw err;
      }
    }

    return Array.from(this.inMemoryProducts.values());
  }

  async saveProduct(product) {
    if (!product || !product.id) {
      return;
    }

    const dataWithTs = {
      ...product,
      updatedAt: new Date().toISOString(),
    };

    if (this.firestore) {
      try {
        await this.firestore
          .collection(await this.getProductCollectionPath())
          .doc(String(product.id))
          .set(dataWithTs, { merge: true });
      } catch (err) {
        Logger.warn(t("interface.message.83c1a480eae0"), {
          error: err.message,
        });
      }
    }

    this.inMemoryProducts.set(String(product.id), dataWithTs);
  }

  async deleteProduct(productId) {
    if (!productId) {
      return false;
    }

    if (this.firestore) {
      try {
        await this.firestore
          .collection(await this.getProductCollectionPath())
          .doc(String(productId))
          .delete();
      } catch (err) {
        Logger.warn(t("interface.message.f8c0743c2b37"), {
          error: err.message,
        });
      }
    }

    this.inMemoryProducts.delete(String(productId));

    return true;
  }

  async createManualOrder({
    customerName,
    customerPhone,
    items,
    paymentMethod,
    notes = '',
  }) {
    const total = (items || []).reduce(
      (sum, item) =>
        sum +
        Number(item.price || 0) *
          Number(item.quantity || 1),
      0
    );

    const orderData = {
      customerName: customerName || t("interface.message.ab04009d0837"),
      customerPhone: customerPhone || 'Presencial',
      orderType: 'PICKUP',
      deliveryAddress: t("interface.message.b653ac70e067"),
      paymentMethod: paymentMethod || 'DINHEIRO',
      items: items || [],
      total,
      notes,
      source: 'CAIXA_MANUAL',
      status: 'CONFIRMED',
    };

    const order = await this.createDirectOrder(orderData);

    await this.deductStock(
      items,
      customerPhone || t("interface.message.8f051f37a16e")
    );

    return order;
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
        message: t("interface.message.0cf48fa56719"),
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
      message: t("interface.message.d74fb7bd1678"),
    };
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
        t("interface.message.a3d76f699c84")
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
          t("interface.text.97b72ac92175") + id
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
            batch.set(
              this.firestore
                .collection(await this.getProductCollectionPath())
                .doc(item.id),
              item,
              { merge: true }
            );
          }

          await batch.commit();
        } catch (err) {
          Logger.warn(
            t("interface.message.208af56b464b"),
            {
              error: err.message,
              committedCount,
            }
          );

          const failure = new Error(
            t("interface.text.97691d620d2a") +
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
        const previous =
          this.inMemoryProducts.get(item.id) || {};

        this.inMemoryProducts.set(item.id, {
          ...previous,
          ...item,
        });
      }

      committedCount += chunk.length;
    }

    if (this.firestore) {
      Logger.info(
        `${committedCount}${t("interface.message.caa8aa8ac923")}`
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
  async deductStock(orderItems, customerPhone = '') {
    if (
      !Array.isArray(orderItems) ||
      orderItems.length === 0
    ) {
      return {
        success: true,
        deducted: [],
      };
    }

    const deductedList = [];

    if (this.firestore) {
      try {
        const now = new Date().toISOString();

        await this.firestore.runTransaction(
          async (transaction) => {
            for (const item of orderItems) {
              const qty = item.quantity || 1;

              // Busca produto por ID ou por nome.
              let docRef = null;
              let currentData = null;

              if (item.productId) {
                docRef = this.firestore
                  .collection(await this.getProductCollectionPath())
                  .doc(String(item.productId));

                const snap = await transaction.get(docRef);

                if (snap.exists) {
                  currentData = snap.data();
                }
              }

              if (!currentData) {
                const querySnap = await this.firestore
                  .collection(await this.getProductCollectionPath())
                  .where('name', '==', item.name)
                  .limit(1)
                  .get();

                if (!querySnap.empty) {
                  const docSnap = querySnap.docs[0];

                  docRef = docSnap.ref;
                  currentData = docSnap.data();
                }
              }

              if (docRef && currentData) {
                const currentStock =
                  typeof currentData.stockQuantity === 'number'
                    ? currentData.stockQuantity
                    : typeof currentData.estoque === 'number'
                      ? currentData.estoque
                      : 0;

                const newStock = Math.max(
                  0,
                  currentStock - qty
                );

                transaction.update(docRef, {
                  stockQuantity: newStock,
                  estoque: newStock,
                  updatedAt: now,
                });

                // Log de movimentação de estoque.
                const movementRef = this.firestore
                  .collection('stock_movements')
                  .doc();

                transaction.set(movementRef, {
                  productId: docRef.id,
                  productName: currentData.name || item.name,
                  quantityDeducted: qty,
                  previousStock: currentStock,
                  newStock,
                  type: 'SALE_WHATSAPP',
                  customerPhone,
                  createdAt: now,
                });

                deductedList.push({
                  productId: docRef.id,
                  productName: currentData.name || item.name,
                  qty,
                  newStock,
                });
              }
            }
          }
        );

        Logger.info(
          `${t("interface.message.18acdfa9cbe8")}${deductedList.length} itens.`
        );

        return {
          success: true,
          deducted: deductedList,
        };
      } catch (err) {
        Logger.warn(
          t("interface.message.bf97e5073674"),
          { error: err.message }
        );
      }
    }

    // Fallback em memória.
    for (const item of orderItems) {
      for (
        const [id, prod] of this.inMemoryProducts.entries()
      ) {
        if (
          prod.name === item.name ||
          prod.canonicalName === item.name
        ) {
          const cur =
            prod.stockQuantity ?? prod.estoque ?? 0;

          const updated = Math.max(
            0,
            cur - (item.quantity || 1)
          );

          prod.stockQuantity = updated;
          prod.estoque = updated;

          this.inMemoryProducts.set(id, prod);

          deductedList.push({
            productId: id,
            productName: prod.name,
            qty: item.quantity,
            newStock: updated,
          });

          break;
        }
      }
    }

    return {
      success: true,
      deducted: deductedList,
    };
  }

  async getStockMovements(limit = 20) {
    if (this.firestore) {
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
        Logger.warn(
          t("interface.message.ac59a73926a5"),
          { error: err.message }
        );
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
          .collection(await this.getProductCollectionPath())
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
          t("interface.message.aef920bb8f66"),
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
      error: t("interface.message.9f5a2fd4316b"),
    };
  }

  async createDirectOrder(orderData) {
    const now = new Date().toISOString();

    const dataWithTs = {
      ...orderData,
      status: orderData.status || 'PENDING',
      createdAt: now,
      updatedAt: now,
    };

    if (this.firestore) {
      try {
        const ref = await this.firestore
          .collection('orders')
          .add(dataWithTs);

        return {
          id: ref.id,
          ...dataWithTs,
        };
      } catch (err) {
        Logger.warn(
          t("interface.message.6d3873a88841"),
          { error: err.message }
        );
      }
    }

    const localId = `order-${Date.now()}`;

    const orderObj = {
      id: localId,
      ...dataWithTs,
    };

    this.inMemoryOrders.set(localId, orderObj);

    return orderObj;
  }

  async getAllOrders(limit = 50) {
    if (this.firestore) {
      try {
        const snap = await this.firestore
          .collection('orders')
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .get();

        if (!snap.empty) {
          return snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));
        }
      } catch (err) {
        Logger.warn(
          t("interface.message.539bd8378739"),
          { error: err.message }
        );
      }
    }

    return Array.from(
      this.inMemoryOrders.values()
    ).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }

  async updateOrderStatus(orderId, status) {
    const now = new Date().toISOString();

    if (this.firestore) {
      try {
        await this.firestore
          .collection('orders')
          .doc(String(orderId))
          .update({
            status,
            updatedAt: now,
          });

        return {
          success: true,
          orderId,
          status,
        };
      } catch (err) {
        Logger.warn(
          t("interface.message.09782b38904b"),
          { error: err.message }
        );
      }
    }

    const ord = this.inMemoryOrders.get(
      String(orderId)
    );

    if (ord) {
      ord.status = status;
      ord.updatedAt = now;

      return {
        success: true,
        orderId,
        status,
      };
    }

    return {
      success: false,
    };
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
          t("interface.message.a568616f81d5"),
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
          t("interface.message.1100abb0857f"),
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
          t("interface.message.3af88edb4a09"),
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
          t("interface.message.d3c30966ac31"),
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
          .collection('pending_orders')
          .doc(phone)
          .set(dataWithTs, { merge: true });

        return;
      } catch (err) {
        Logger.warn(
          t("interface.message.bcd0d9977c29"),
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
          .collection('pending_orders')
          .doc(phone)
          .get();

        return doc.exists ? doc.data() : null;
      } catch (err) {
        Logger.warn(
          t("interface.message.edc1b4506ef5"),
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
          t("interface.message.7cc880c2a254"),
          { error: err.message }
        );
      }
    }

    return this.inMemoryCustomers.get(phone) || null;
  }

  async saveCustomerProfile(phone, profileData) {
    if (!phone) {
      return;
    }

    const dataWithTs = {
      ...profileData,
      phone,
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
          t("interface.message.55a46aeeb01b"),
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

  // --- Colaboradores e Controle de Acesso (RBAC) ---

  async getAllUsers() {
    if (this.firestore) {
      try {
        const snap = await this.firestore
          .collection('users')
          .get();

        if (!snap.empty) {
          const list = snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }));

          for (const u of list) {
            this.inMemoryUsers.set(u.id, u);
          }

          return list;
        }
      } catch (err) {
        Logger.warn(
          t("interface.message.406f0bb521a3"),
          { error: err.message }
        );
      }
    }

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
      !['ADMIN', 'CAIXA', 'CLIENTE'].includes(role)
    ) {
      role = 'CLIENTE';
    }

    if (email === 'edmarjuniob@gmail.com') {
      role = 'ADMIN';
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
          t("interface.message.f5fefdbe6288"),
          { error: err.message }
        );
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
        error: t("interface.message.3660cbe95340"),
      };
    }

    if (!password || password.length < 4) {
      return {
        success: false,
        error: t("interface.message.df2e6afb065a"),
      };
    }

    const normalizedEmail = email
      .toLowerCase()
      .trim();

    const users = await this.getAllUsers();

    const existing = users.find(
      (u) =>
        u.email &&
        u.email.toLowerCase().trim() === normalizedEmail
    );

    if (existing) {
      // Se já existia e não tinha senha definida, vincula a senha.
      if (!existing.password) {
        existing.password = password;

        if (phone) {existing.phone = phone;}
        if (address) {existing.address = address;}

        existing.updatedAt = new Date().toISOString();

        await this.saveUser(existing);

        const {
          password: _p,
          ...safeUser
        } = existing;

        return {
          success: true,
          user: safeUser,
        };
      }

      return {
        success: false,
        error:
          t("interface.message.2786eadea14b"),
      };
    }

    const isSuperAdmin =
      normalizedEmail === 'edmarjuniob@gmail.com';

    const role =
      isSuperAdmin ? 'ADMIN' : 'CLIENTE';

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

    const {
      password: _p,
      ...safeUser
    } = newUser;

    return {
      success: true,
      user: safeUser,
    };
  }

  async loginUser(email, password) {
    if (!email || !password) {
      return {
        success: false,
        error: t("interface.message.4e158e19126a"),
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
          t("interface.message.6d62651fde6e"),
      };
    }

    if (user.active === false) {
      return {
        success: false,
        error: t("interface.message.9776f063ac9c"),
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
        error: t("interface.message.87b42da84d33"),
      };
    }

    const {
      password: _p,
      pin: _pin,
      ...safeUser
    } = user;

    return {
      success: true,
      user: safeUser,
    };
  }

  async updateUserRole(userId, newRole) {
    const normalizedRole = (newRole || 'CLIENTE')
      .toUpperCase();

    if (
      !['ADMIN', 'CAIXA', 'CLIENTE'].includes(normalizedRole)
    ) {
      return {
        success: false,
        error:
          t("interface.message.422ab444d7d7"),
      };
    }

    const users = await this.getAllUsers();

    const user = users.find(
      (u) => String(u.id) === String(userId)
    );

    if (!user) {
      return {
        success: false,
        error: t("interface.message.db7545469a0b"),
      };
    }

    user.role = normalizedRole;
    user.updatedAt = new Date().toISOString();

    await this.saveUser(user);

    const {
      password: _p,
      ...safeUser
    } = user;

    return {
      success: true,
      user: safeUser,
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
          t("interface.message.ba02d46b397a"),
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
        error: t("interface.message.160c07d98620"),
      };
    }

    if (!user.active) {
      return {
        success: false,
        error: t("interface.message.b8b7a568ff0b"),
      };
    }

    const hasCredential = Boolean(user.pin || user.password);
    const matchesPin = Boolean(user.pin) && String(user.pin) === String(pin);
    const matchesPassword = Boolean(user.password) && String(user.password) === String(pin);
    if (!hasCredential || (!matchesPin && !matchesPassword)) {
      return {
        success: false,
        error: t("interface.message.0a1c1dc8667a"),
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
              name: item.name || t("interface.message.c09621194df1"),
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
        `${t("interface.message.5e0f2d30e929")}${String(orderId).slice(-6)}${t("interface.message.b2fa641b01d2")}${requestedByName || 'Caixa'} @@`,
    });

    if (
      (originalOrder.paymentMethod || '') !==
      (proposedOrder.paymentMethod || '')
    ) {
      diffLines.push({
        type: 'del',
        text:
          `${t("interface.message.96cc83caae49")}${originalOrder.paymentMethod || t("interface.message.01af1ecb8056")}`,
      });

      diffLines.push({
        type: 'add',
        text:
          `${t("interface.message.15a482045530")}${proposedOrder.paymentMethod}`,
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
          `${t("interface.message.019c2d651027")}${originalOrder.customerName || t("interface.message.01af1ecb8056")}`,
      });

      diffLines.push({
        type: 'add',
        text:
          `${t("interface.message.18b4c4a99822")}${proposedOrder.customerName}`,
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
            `${t("interface.message.9e0ccfe58b6e")}${it.quantity}x ${it.name}`,
        });

        diffLines.push({
          type: 'add',
          text:
            `${t("interface.message.6c09979c512b")}${match.quantity}x ${it.name}`,
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
        reason || t("interface.message.387cd58c8af9"),
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
          t("interface.message.8f5d09f7042b"),
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
          t("interface.message.c9e9ec3a06da"),
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
          t("interface.message.cbe7f79f2371"),
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
        error: t("interface.message.1d513b038293"),
      };
    }

    if (action === 'APPROVED') {
      reqObj.status = 'APPROVED';
      reqObj.reviewedAt = now;
      reqObj.reviewedBy = reviewedBy || t("interface.message.492128a33b96");

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
            t("interface.message.2f5addb9e2dd"),
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
          `${t("interface.message.53dcc240faaf")}${String(reqObj.orderId).slice(-6)})`,
        message:
          `${t("interface.message.61ba7b272021")}${Number(reqObj.proposedOrder.total || 0).toFixed(2).replace('.', ',')}${t("interface.fragment.c6b2b02da0c5")}`,
      });

      return {
        success: true,
        status: 'APPROVED',
        order: updatedOrderData,
      };
    } else {
      reqObj.status = 'REJECTED';
      reqObj.rejectionReason =
        rejectionReason || t("interface.message.0b8a2cd5c982");
      reqObj.reviewedAt = now;
      reqObj.reviewedBy =
        reviewedBy || t("interface.message.492128a33b96");

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
            t("interface.message.8c6c88672425"),
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
          `${t("interface.message.3d4221292080")}${String(reqObj.orderId).slice(-6)})`,
        message:
          `${t("interface.message.d829717d4a81")}${reqObj.rejectionReason}"`,
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
          t("interface.message.4be378985d76"),
          { error: err.message }
        );
      }
    }

    this.inMemoryNotifications.unshift(notif);

    return notif;
  }

  async getUserNotifications(userId) {
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
                userId === 'usr-edmar'
            );
          }

          return list;
        }
      } catch (err) {
        Logger.warn(
          t("interface.message.15e40a4313bb"),
          { error: err.message }
        );
      }
    }

    if (userId && userId !== 'usr-edmar') {
      return this.inMemoryNotifications.filter(
        (n) =>
          !n.toUserId ||
          n.toUserId === userId
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
          t("interface.message.b8232294f688"),
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