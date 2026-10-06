const { normalizeText, parseCurrencyString } = require('../shared/string.util');
const Logger = require('../shared/logger');

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

function resolveDomain(category, subcategory, productName) {
  const c = (category || '').toLowerCase();
  const s = (subcategory || '').toLowerCase();
  const n = (productName || '').toLowerCase();

  if (c.includes('pet') || s.includes('aves') || s.includes('mamifero') || s.includes('repteis') || s.includes('caes') || s.includes('gaiola') || s.includes('racao')) {
    return 'PETS';
  }
  if (c.includes('hortifrutti') || s.includes('frutas') || s.includes('legumes') || s.includes('verduras') || s.includes('ovos')) {
    return 'HORTIFRUTTI';
  }
  if (s.includes('adubo') || s.includes('fertilizante') || s.includes('jardinagem') || s.includes('vaso')) {
    return 'INSUMOS';
  }
  return 'PLANTAS';
}

function buildDriveDirectImageUrl(fileId, rawUrl) {
  if (fileId && typeof fileId === 'string' && fileId.trim().length > 10) {
    return 'https://drive.google.com/uc?export=view&id=' + fileId.trim();
  }
  if (rawUrl && typeof rawUrl === 'string' && rawUrl.startsWith('http')) {
    return rawUrl.trim();
  }
  return null;
}

class CatalogRepository {
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
    this.lastCacheTime = 0;
    this.mockData = mockData;
    this.firestoreRepo = firestoreRepo;

    if (this.mockData) {
      this.loadItems(this.mockData);
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

    const googleapis = getGoogleApis();
    if (!googleapis) {
      Logger.warn('Modulo googleapis nao encontrado; usando dados existentes em memoria.');
      return;
    }

    try {
      const auth = new googleapis.google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      const sheets = googleapis.google.sheets({ version: 'v4', auth });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: this.sheetName + '!A1:O1500',
      });

      const rows = response.data.values || [];
      if (rows.length < 2) {
        Logger.warn('Tabela de produtos vazia ou sem cabecalhos.');
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
          id: row[idIdx] || 'item-' + i,
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
      Logger.info('Catalogo atualizado com sucesso. ' + this.items.length + ' itens comerciais ativos indexados.');
    } catch (error) {
      Logger.error('Falha ao atualizar catalogo via Google Sheets', error);
      if (this.items.length === 0) {
        throw error;
      }
    }
  }

  loadItems(rawItems) {
    if (!Array.isArray(rawItems)) {
      return;
    }

    this.items = rawItems.filter((item) => item.status?.toUpperCase() === 'ATIVO');
    this.productByNameMap.clear();
    this.productByTagMap.clear();
    this.productsByCategoryMap.clear();

    for (const item of this.items) {
      const normalizedName = normalizeText(item.name);
      const normalizedSubcat = normalizeText(item.subcategory || '');
      const normalizedCat = normalizeText(item.category || '');
      const domain = resolveDomain(item.category, item.subcategory, item.name);

      if (!this.productByNameMap.has(normalizedName)) {
        this.productByNameMap.set(normalizedName, {
          canonicalName: item.name,
          category: item.category,
          subcategory: item.subcategory,
          domain,
          descriptionAi: item.descriptionAi || '',
          tags: new Set(),
          prices: [],
          images: [],
          items: [],
        });
      }

      const productGroup = this.productByNameMap.get(normalizedName);
      productGroup.items.push(item);

      if (typeof item.price === 'number' && !productGroup.prices.includes(item.price)) {
        productGroup.prices.push(item.price);
        productGroup.prices.sort((a, b) => a - b);
      }

      if (item.descriptionAi && !productGroup.descriptionAi) {
        productGroup.descriptionAi = item.descriptionAi;
      }

      const directUrl = buildDriveDirectImageUrl(item.imageFileId, item.imageUrl);
      if (directUrl && !productGroup.images.includes(directUrl)) {
        productGroup.images.push(directUrl);
      }

      if (item.tagsAi) {
        const rawTags = item.tagsAi.split(",").map((t) => normalizeText(t)).filter((t) => t.length > 1);
        for (const tag of rawTags) {
          productGroup.tags.add(tag);
          this.productByTagMap.set(tag, productGroup);
        }
      }

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
    }

    this.lastCacheTime = Date.now();
  }

  findProductByName(query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) {
      return null;
    }

    if (this.productByNameMap.has(normalizedQuery)) {
      return this.productByNameMap.get(normalizedQuery);
    }

    if (this.productByTagMap.has(normalizedQuery)) {
      return this.productByTagMap.get(normalizedQuery);
    }

    for (const [key, group] of this.productByNameMap.entries()) {
      if (normalizedQuery.includes(key) || key.includes(normalizedQuery)) {
        return group;
      }
    }

    for (const [tagKey, group] of this.productByTagMap.entries()) {
      if (normalizedQuery.includes(tagKey) || tagKey.includes(normalizedQuery)) {
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
      Logger.info('Tag aprendida indexada em memoria: [' + normalizedTag + '] -> ' + group.canonicalName);
    }
  }

  findProductsByCategory(categoryQuery) {
    const normalized = normalizeText(categoryQuery);
    if (!normalized || normalized.length < 3) {
      return [];
    }

    const singular = normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
    const matchedProducts = new Map();

    for (const [catKey, items] of this.productsByCategoryMap.entries()) {
      if (catKey === normalized || catKey === singular || catKey.startsWith(singular)) {
        for (const item of items) {
          const groupKey = normalizeText(item.name);
          if (!matchedProducts.has(groupKey)) {
            matchedProducts.set(groupKey, this.productByNameMap.get(groupKey));
          }
        }
      }
    }

    for (const [nameKey, group] of this.productByNameMap.entries()) {
      if (nameKey.includes(singular)) {
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
  resolveDomain,
};
