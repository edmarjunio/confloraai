const { TextEncoder } = require('node:util');
const { URL } = require('node:url');
const { safeUser } = require('../security/web-session');
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
      errors.push(prefix + 'images contém uma URL inválida.');
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
          ': sem URL pública de imagem; não será gerada foto automaticamente.'
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

  async getAllProducts() {
    if (this.firestore) {
      try {
        const snapshot = await this.firestore
          .collection('products')
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
        Logger.warn('Erro ao buscar produtos no Firestore', {
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

    const dataWithTs = { ...product, updatedAt: new Date().toISOString() };
    if (product.name !== undefined) {Object.assign(dataWithTs, { canonicalName: product.name, descricao: product.name, 'DESCRIÇÃO': product.name });}
    if (product.price !== undefined) {Object.assign(dataWithTs, { valor_num: product.price, VALOR: product.price });}
    if (product.category !== undefined) {Object.assign(dataWithTs, { categoria: product.category, CATEGORIA: product.category });}
    if (product.subcategory !== undefined) {Object.assign(dataWithTs, { subcategoria: product.subcategory, SUBCATEGORIA: product.subcategory });}

    if (this.firestore) {
      try {
        await this.firestore
          .collection('products')
          .doc(String(product.id))
          .set(dataWithTs, { merge: true });
      } catch (err) {
        Logger.warn('Erro ao salvar produto no Firestore', {
          error: err.message,
        });
        throw err;
      }
    }

    this.inMemoryProducts.set(String(product.id), { ...this.inMemoryProducts.get(String(product.id)), ...dataWithTs });
  }

  async deleteProduct(productId) {
    if (!productId) {
      return false;
    }

    if (this.firestore) {
      try {
        await this.firestore
          .collection('products')
          .doc(String(productId))
          .delete();
      } catch (err) {
        Logger.warn('Erro ao excluir produto no Firestore', {
          error: err.message,
        });
        throw err;
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
      customerName: customerName || 'Venda Balcão / Caixa',
      customerPhone: customerPhone || 'Presencial',
      orderType: 'PICKUP',
      deliveryAddress: 'Venda Presencial no Balcão Conflora',
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
      customerPhone || 'Balcão'
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
          for (const item of chunk) {batch.set(this.firestore.collection('products').doc(item.id), item);}
          await batch.commit();
        }
        for (const item of chunk) {this.inMemoryProducts.set(item.id, item);}
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
            batch.set(
              this.firestore
                .collection('products')
                .doc(item.id),
              item,
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
                  .collection('products')
                  .doc(String(item.productId));

                const snap = await transaction.get(docRef);

                if (snap.exists) {
                  currentData = snap.data();
                }
              }

              if (!currentData) {
                const querySnap = await this.firestore
                  .collection('products')
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
          `Baixa atômica de estoque concluída no Firestore para ${deductedList.length} itens.`
        );

        return {
          success: true,
          deducted: deductedList,
        };
      } catch (err) {
        Logger.warn(
          'Erro ao realizar baixa atômica no Firestore; aplicando em memória',
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
          'Erro ao buscar stock_movements no Firestore',
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
          'Erro ao salvar pedido direto no Firestore',
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
          'Erro ao buscar pedidos no Firestore',
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
          'Erro ao atualizar status do pedido no Firestore',
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
      !['ADMIN', 'CAIXA', 'CLIENTE'].includes(role)
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
      !['ADMIN', 'CAIXA', 'CLIENTE'].includes(normalizedRole)
    ) {
      return {
        success: false,
        error:
          'Perfil inválido. Escolha ADMIN, CAIXA ou CLIENTE.',
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

    if (!['ADMIN', 'CAIXA'].includes(user.role) || !pin ||
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
          'Erro ao buscar notificações no Firestore',
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