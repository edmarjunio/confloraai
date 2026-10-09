const { normalizeText, parseCurrencyString, toSingular } = require('../shared/string.util');
const Logger = require('../shared/logger');
const { DEFAULT_CATALOG_ITEMS } = require('./default-catalog');

let googleApisModule = null;
function getGoogleApis() {
  if (!googleApisModule) {
    try {
      googleApisModule = require('googleapis');
    } catch {
      return null;
    }
  }
  return googleApisModule;
}

const IGNORED_CATEGORIES = new Set([
  'recebimento',
  'troco do dia',
  'administrativo',
  'servicos financeiro',
  'servicos',
]);

function buildDriveDirectImageUrl(fileId, rawUrl) {
  if (rawUrl && typeof rawUrl === 'string' && (rawUrl.startsWith('http') || rawUrl.startsWith('/api/images/'))) {
    return rawUrl.trim();
  }
  if (fileId && typeof fileId === 'string' && (fileId.startsWith('img_') || fileId.startsWith('photo_'))) {
    return `/api/images/${fileId.trim()}`;
  }
  if (fileId && typeof fileId === 'string' && fileId.trim().length > 10) {
    return `https://drive.google.com/uc?export=view&id=${fileId.trim()}`;
  }
  return null;
}

class CatalogRepository {
  /**
   * @param {Object} options
   * @param {string} options.spreadsheetId
   * @param {string} [options.sheetName='PRODUTOS']
   * @param {number} [options.cacheTtlSeconds=60]
   * @param {Array<Object>} [options.mockData=null]
   * @param {import('../database/firestore.repository').FirestoreRepository} [options.firestoreRepo=null]
   */
  constructor({
    spreadsheetId,
    sheetName = 'PRODUTOS',
    cacheTtlSeconds = 60,
    mockData = null,
    firestoreRepo = null,
  }) {
    this.spreadsheetId = spreadsheetId;
    this.sheetName = sheetName;
    this.cacheTtlMs = cacheTtlSeconds * 1000;
    this.items = [];
    this.productByNameMap = new Map();
    this.productByTagMap = new Map();
    this.productsByCategoryMap = new Map();
    this.categoriesSet = new Set();
    this.subcategoriesSet = new Set();
    this.lastCacheTime = 0;
    this.mockData = mockData;
    this.firestoreRepo = firestoreRepo;

    if (this.mockData) {
      this.loadItems(this.mockData);
    } else {
      this.loadItems(DEFAULT_CATALOG_ITEMS);
      this.lastCacheTime = 0;
    }
  }

  async refreshCatalog() {
    if (this.mockData) {
      this.loadItems(this.mockData);
      return;
    }

    if (this.isCacheValid()) {
      return;
    }

    // 1. Tentar ler primeiro do Cloud Firestore
    if (this.firestoreRepo && typeof this.firestoreRepo.getAllProducts === 'function') {
      try {
        const firestoreProducts = await this.firestoreRepo.getAllProducts();
        if (firestoreProducts && firestoreProducts.length > 0) {
          this.loadItems(firestoreProducts);
          return;
        }
      } catch (err) {
        Logger.warn('Aviso: erro ao carregar produtos do Firestore no catálogo; continuando com fallback', { error: err.message });
      }
    }

    const googleapis = getGoogleApis();
    if (!googleapis) {
      Logger.warn('Módulo googleapis não encontrado; usando dados existentes em memória.');
      return;
    }

    try {
      const auth = new googleapis.google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      const sheets = googleapis.google.sheets({ version: 'v4', auth });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:O1500`,
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        Logger.warn('Tabela de produtos vazia ou sem cabeçalhos.');
        return;
      }

      const headers = rows[0].map((h) => normalizeText(h));
      const idIdx = headers.indexOf('product id');
      const descIdx = headers.indexOf('descricao');
      const statusIdx = headers.indexOf('status');
      const valorIdx = headers.indexOf('valor');
      const valorNumIdx = headers.indexOf('valor num');
      const catIdx = headers.indexOf('categoria');
      const subCatIdx = headers.indexOf('subcategoria');
      const varIdx = headers.indexOf('variacao');
      const imgUrlIdx = headers.indexOf('imageurl');
      const imgFileIdIdx = headers.indexOf('imagefileid');
      const descAiIdx = headers.indexOf('descricao ia');
      const tagsAiIdx = headers.indexOf('tags ia');

      const parsedItems = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const status = (row[statusIdx] || 'ATIVO').trim().toUpperCase();
        if (status !== 'ATIVO') {
          continue;
        }

        const name = (row[descIdx] || '').trim();
        if (!name) {
          continue;
        }

        const rawCat = row[catIdx] || '';
        const rawSubCat = subCatIdx >= 0 ? row[subCatIdx] || '' : '';
        const normalizedCat = normalizeText(rawCat);

        if (IGNORED_CATEGORIES.has(normalizedCat)) {
          continue;
        }

        const price = valorNumIdx >= 0 && row[valorNumIdx]
          ? parseCurrencyString(row[valorNumIdx])
          : parseCurrencyString(row[valorIdx]);

        parsedItems.push({
          id: row[idIdx] || `item-${i}`,
          name,
          category: rawCat,
          subcategory: rawSubCat,
          variation: varIdx >= 0 ? row[varIdx] || '' : '',
          price,
          status: 'ATIVO',
          imageFileId: imgFileIdIdx >= 0 ? row[imgFileIdIdx] || '' : '',
          imageUrl: imgUrlIdx >= 0 ? row[imgUrlIdx] || '' : '',
          descriptionAi: descAiIdx >= 0 ? (row[descAiIdx] || '').trim() : '',
          tagsAi: tagsAiIdx >= 0 ? (row[tagsAiIdx] || '').trim() : '',
        });
      }

      this.loadItems(parsedItems);
      Logger.info(`Catálogo atualizado em tempo real. ${this.items.length} itens comerciais ativos indexados.`);
    } catch (error) {
      Logger.warn('Google Sheets indisponível no ambiente atual; catálogo em contingência ativo', {
        details: error.message,
      });
      if (this.items.length === 0) {
        Logger.info('Carregando catálogo padrão de contingência Conflora...');
        this.loadItems(DEFAULT_CATALOG_ITEMS);
      }
    }
  }

  loadItems(rawItems) {
    if (!Array.isArray(rawItems)) {
      return;
    }

    const { normalizeCatalogItem } = require('./default-catalog');
    this.items = rawItems
      .filter((item) => (item.status || 'ATIVO').toUpperCase() === 'ATIVO')
      .map((item) => normalizeCatalogItem(item));

    this.productByNameMap.clear();
    this.productByTagMap.clear();
    this.productsByCategoryMap.clear();
    this.categoriesSet.clear();
    this.subcategoriesSet.clear();

    for (const item of this.items) {
      const normalizedName = normalizeText(item.name);
      const normalizedSubcat = normalizeText(item.subcategory || '');
      const normalizedCat = normalizeText(item.category || '');

      if (normalizedCat) {
        this.categoriesSet.add(normalizedCat);
      }
      if (normalizedSubcat) {
        this.subcategoriesSet.add(normalizedSubcat);
      }

      if (!this.productByNameMap.has(normalizedName)) {
        this.productByNameMap.set(normalizedName, {
          canonicalName: item.name,
          category: item.category,
          subcategory: item.subcategory,
          descriptionAi: item.descriptionAi || '',
          tags: new Set(),
          prices: [],
          images: [],
          items: [],
          variations: [],
        });
      }

      const productGroup = this.productByNameMap.get(normalizedName);
      productGroup.items.push(item);

      // Preços sem duplicidade ordenados
      if (typeof item.price === 'number' && !productGroup.prices.includes(item.price)) {
        productGroup.prices.push(item.price);
        productGroup.prices.sort((a, b) => a - b);
      }

      // Descrição IA
      if (item.descriptionAi && !productGroup.descriptionAi) {
        productGroup.descriptionAi = item.descriptionAi;
      }

      // Imagens do Drive, URL ou Firestore
      const directUrl = buildDriveDirectImageUrl(item.imageFileId, item.imageUrl);
      if (directUrl && !productGroup.images.includes(directUrl)) {
        productGroup.images.push(directUrl);
      }
      if (Array.isArray(item.images)) {
        for (const img of item.images) {
          if (img && typeof img === 'string' && !productGroup.images.includes(img.trim())) {
            productGroup.images.push(img.trim());
          }
        }
      }

      // Indexação de TAGS_IA da planilha
      if (item.tagsAi) {
        const rawTags = item.tagsAi.split(/[,;\n]/).map((t) => normalizeText(t)).filter((t) => t.length > 1);
        for (const tag of rawTags) {
          productGroup.tags.add(tag);
          this.productByTagMap.set(tag, productGroup);
        }
      }

      // Indexação por subcategoria e categoria
      if (normalizedSubcat) {
        if (!this.productsByCategoryMap.has(normalizedSubcat)) {
          this.productsByCategoryMap.set(normalizedSubcat, []);
        }
        this.productsByCategoryMap.get(normalizedSubcat).push(item);
      }

      if (normalizedCat && normalizedCat !== normalizedSubcat) {
        if (!this.productsByCategoryMap.has(normalizedCat)) {
          this.productsByCategoryMap.set(normalizedCat, []);
        }
        this.productsByCategoryMap.get(normalizedCat).push(item);
      }

      // Agrupamento de produtos-base com variações (ex: MINI CABRA MACHO + MINI CABRA FÊMEA -> MINI CABRA)
      const baseNorm = normalizedName
        .replace(/\b(macho|femea|casal|adulto|adulta|filhote|franga|frango|grande|medio|pequeno)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (baseNorm && baseNorm !== normalizedName && baseNorm.length >= 3) {
        if (!this.productByNameMap.has(baseNorm)) {
          const baseTitle = baseNorm
            .split(' ')
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(' ');

          this.productByNameMap.set(baseNorm, {
            canonicalName: baseTitle,
            category: item.category,
            subcategory: item.subcategory,
            descriptionAi: item.descriptionAi || '',
            tags: new Set(),
            prices: [],
            images: [],
            items: [],
            variations: [],
          });
        }

        const baseGroup = this.productByNameMap.get(baseNorm);
        baseGroup.items.push(item);
        if (typeof item.price === 'number' && !baseGroup.prices.includes(item.price)) {
          baseGroup.prices.push(item.price);
          baseGroup.prices.sort((a, b) => a - b);
        }

        if (directUrl && !baseGroup.images.includes(directUrl)) {
          baseGroup.images.push(directUrl);
        }

        const varMatch = item.name.match(/\b(Macho|Fêmea|Femea|Casal|Adulto|Adulta|Filhote)\b/i);
        const varName = varMatch ? varMatch[1].toUpperCase() : item.name;
        if (!baseGroup.variations.some((v) => v.name === varName)) {
          baseGroup.variations.push({ name: varName, price: item.price });
        }
      }
    }

    this.lastCacheTime = Date.now();
  }

  isCategoryOrSubcategory(text) {
    const norm = normalizeText(text);
    const sing = toSingular(text);
    if (!norm || norm.length < 3) {
      return false;
    }

    for (const cat of this.categoriesSet) {
      const catSing = toSingular(cat);
      if (cat === norm || catSing === sing || norm === catSing || sing === cat) {
        return true;
      }
    }

    for (const sub of this.subcategoriesSet) {
      const subSing = toSingular(sub);
      if (sub === norm || subSing === sing || norm === subSing || sing === sub) {
        return true;
      }
    }

    return false;
  }

  findProductByName(query) {
    const normalizedQuery = normalizeText(query);
    const singularQuery = toSingular(query);
    if (!normalizedQuery) {
      return null;
    }

    if (this.productByNameMap.has(normalizedQuery)) {
      return this.productByNameMap.get(normalizedQuery);
    }
    if (singularQuery && this.productByNameMap.has(singularQuery)) {
      return this.productByNameMap.get(singularQuery);
    }

    if (this.productByTagMap.has(normalizedQuery)) {
      return this.productByTagMap.get(normalizedQuery);
    }
    if (singularQuery && this.productByTagMap.has(singularQuery)) {
      return this.productByTagMap.get(singularQuery);
    }

    for (const [key, group] of this.productByNameMap.entries()) {
      if (key === normalizedQuery || key === singularQuery || key.startsWith(normalizedQuery) || key.startsWith(singularQuery)) {
        return group;
      }
    }

    for (const [key, group] of this.productByNameMap.entries()) {
      if (normalizedQuery.includes(key) || (singularQuery && singularQuery.includes(key)) || key.includes(normalizedQuery)) {
        return group;
      }
    }

    for (const [tagKey, group] of this.productByTagMap.entries()) {
      if (normalizedQuery.includes(tagKey) || (singularQuery && singularQuery.includes(tagKey))) {
        return group;
      }
    }

    return null;
  }

  registerLearnedTag(productName, newTag) {
    const normalizedProd = normalizeText(productName);
    const normalizedTag = normalizeText(newTag);
    if (!normalizedTag || !normalizedProd || normalizedTag.length < 3) {
      return;
    }

    const group = this.productByNameMap.get(normalizedProd);
    if (group) {
      group.tags.add(normalizedTag);
      this.productByTagMap.set(normalizedTag, group);
      Logger.info(`Tag aprendida indexada em memória: [${normalizedTag}] -> ${group.canonicalName}`);
    }
  }

  findProductsByCategory(categoryQuery) {
    const normalized = normalizeText(categoryQuery);
    const singular = toSingular(categoryQuery);
    if (!normalized || normalized.length < 3) {
      return [];
    }

    const matchedProducts = new Map();

    for (const [catKey, items] of this.productsByCategoryMap.entries()) {
      const catSing = toSingular(catKey);
      if (catKey === normalized || catKey === singular || catSing === singular || catKey.includes(singular)) {
        for (const item of items) {
          const groupKey = normalizeText(item.name);
          if (!matchedProducts.has(groupKey)) {
            const grp = this.productByNameMap.get(groupKey);
            if (grp) {
              matchedProducts.set(groupKey, grp);
            }
          }
        }
      }
    }

    for (const [nameKey, group] of this.productByNameMap.entries()) {
      if (nameKey.includes(singular) || nameKey.includes(normalized)) {
        if (!matchedProducts.has(nameKey)) {
          matchedProducts.set(nameKey, group);
        }
      }
    }

    return Array.from(matchedProducts.values());
  }

  isCacheValid() {
    return this.items.length > 0 && Date.now() - this.lastCacheTime < this.cacheTtlMs;
  }
}

module.exports = {
  CatalogRepository,
};
