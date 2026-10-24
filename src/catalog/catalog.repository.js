const { normalizeText, toSingular } = require('../shared/string.util');
const Logger = require('../shared/logger');
const { normalizeCatalogItem } = require('./normalize-catalog-item');
// Entries reaching the index have already passed the shared media contract.
const isStoredProductImage = value => typeof value === 'string' && /^https:\/\//i.test(value);

const STOP_WORDS = new Set([
  'voce', 'voces', 'tem', 'teria', 'teriam', 'temos', 'para', 'pra', 'com', 'sem',
  'vcs', 'por', 'favor', 'gentileza', 'acaso', 'saber', 'vender', 'vende', 'vendem',
  'trabalha', 'trabalham', 'quanto', 'custa', 'qual', 'quais', 'preco', 'precos',
  'valor', 'valores', 'manda', 'mandar', 'enviar', 'foto', 'fotos', 'imagem', 'imagens',
  'aqui', 'loja', 'estoque', 'disponivel', 'gostaria', 'quero', 'queria', 'bom', 'dia',
  'boa', 'tarde', 'noite', 'ola', 'opa', 'mais', 'menos', 'algo', 'tipo', 'desses',
  'dessa', 'desse', 'sobre', 'ai', 'dar', 've', 'mim'
]);

function getWordStem(w) {
  if (w.endsWith('ada') || w.endsWith('ado') || w.endsWith('ados') || w.endsWith('adas')) return w.slice(0, -3);
  if (w.endsWith('eiro') || w.endsWith('eira')) return w.slice(0, -4);
  return toSingular(w);
}

function wordMatchToken(haystack, token) {
  const words = haystack.split(/\s+/);
  const stem = getWordStem(token);
  for (const w of words) {
    if (w === token || toSingular(w) === token || (stem.length >= 4 && w.startsWith(stem))) return true;
  }
  return false;
}

class CatalogRepository {
  constructor({ firestoreRepo = null, now = Date.now } = {}) {
    this.items = [];
    this.rawItems = [];
    this.now = now;
    this.expiresAt = 0;
    this.cacheGeneration = 0;
    this.refreshPromise = null;
    this.productByNameMap = new Map();
    this.productByTagMap = new Map();
    this.productsByCategoryMap = new Map();
    this.categoriesSet = new Set();
    this.subcategoriesSet = new Set();
    this.firestoreRepo = firestoreRepo;
  }

  isCacheValid() {
    return this.expiresAt > this.now();
  }

  invalidateCache() {
    this.expiresAt = 0;
    this.cacheGeneration += 1;
  }

  async refreshCatalog() {
    if (this.isCacheValid()) return;
    if (this.refreshPromise) {
      await this.refreshPromise;
      return;
    }
    const generation = this.cacheGeneration;
    this.refreshPromise = (async () => {
      if (!this.firestoreRepo) throw new Error('Repositório Firestore não configurado.');
      const products = await this.firestoreRepo.getAllProducts();
      // Never publish a snapshot superseded by an edit during the read.
      if (generation === this.cacheGeneration) this.loadItems(Array.isArray(products) ? products : []);
    })();
    try { await this.refreshPromise; } finally { this.refreshPromise = null; }
    if (generation !== this.cacheGeneration) await this.refreshCatalog();
  }

  loadItems(rawItems) {
    if (!Array.isArray(rawItems)) {
      return;
    }


    this.rawItems = rawItems;
    this.expiresAt = this.now() + 15000;
    this.items = rawItems
      .filter(item => require('./commercial-product').commercialProduct(item).active)
      .filter(require('./commercial-product').hasValidCommercialPrice)
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
          cuidados_basicos: item.cuidados_basicos || item.cuidadosBasicos || '',
          ambiente_ideal: item.ambiente_ideal || item.ambienteIdeal || '',
          dicas_armazenamento: item.dicas_armazenamento || item.dicasArmazenamento || '',
          durabilidade: item.durabilidade || '',
          tags: new Set(),
          prices: [],
          images: [],
          items: [],
          variations: [],
        });
      }

      const productGroup = this.productByNameMap.get(normalizedName);
      if (item.cuidados_basicos && !productGroup.cuidados_basicos) {productGroup.cuidados_basicos = item.cuidados_basicos;}
      if (item.ambiente_ideal && !productGroup.ambiente_ideal) {productGroup.ambiente_ideal = item.ambiente_ideal;}
      if (item.dicas_armazenamento && !productGroup.dicas_armazenamento) {productGroup.dicas_armazenamento = item.dicas_armazenamento;}
      if (item.durabilidade && !productGroup.durabilidade) {productGroup.durabilidade = item.durabilidade;}
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

      // Referências de imagem no Firebase Storage ou compatibilidade de URL legada.
      const directUrl = [item.imageUrl, item.imageurl, item.imagePathCache]
        .find(isStoredProductImage);
      if (directUrl && !productGroup.images.includes(directUrl)) {
        productGroup.images.push(directUrl);
      }
      if (Array.isArray(item.images)) {
        for (const img of item.images) {
          if (isStoredProductImage(img) && !productGroup.images.includes(img.trim())) {
            productGroup.images.push(img.trim());
          }
        }
      }

      // Indexação de tags cadastradas no Firestore para busca do catálogo e do agente.
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

    const searchResults = this.searchProducts(query, { limit: 1 });
    if (searchResults.length > 0) {
      return searchResults[0];
    }

    return null;
  }

  searchProducts(queryText, { limit = 8 } = {}) {
    const norm = normalizeText(queryText);
    const words = norm.split(/\s+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
    if (words.length === 0) return [];

    const scored = [];
    const seen = new Set();

    for (const [key, group] of this.productByNameMap.entries()) {
      if (seen.has(group.canonicalName)) continue;
      const pName = normalizeText(group.canonicalName || key);
      const pCat = normalizeText(group.category || '');
      const pSub = normalizeText(group.subcategory || '');
      const pTags = Array.from(group.tags || []).map((t) => normalizeText(t)).join(' ');
      const pDesc = normalizeText(group.descriptionAi || '');

      let score = 0;
      let matchedWords = 0;

      for (const w of words) {
        if (wordMatchToken(pName, w)) {
          score += 35;
          matchedWords++;
        } else if (wordMatchToken(pTags, w) || wordMatchToken(pDesc, w)) {
          score += 20;
          matchedWords++;
        } else if (wordMatchToken(pCat, w) || wordMatchToken(pSub, w)) {
          score += 15;
          matchedWords++;
        }
      }

      if (matchedWords === words.length && words.length > 1) {
        score += 30;
      }

      if (pName.includes(words.join(' '))) {
        score += 40;
      }

      if (score >= 20) {
        seen.add(group.canonicalName);
        scored.push({ product: group, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.product);
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

  getCategories() {
    const cats = new Set();
    for (const item of this.items) {
      if (item.category) cats.add(item.category.trim());
    }
    if (cats.size === 0) {
      return ['Plantas', 'Pets', 'Horta', 'Vasos & Insumos'];
    }
    return Array.from(cats);
  }

  getSubcategories(categoryName) {
    const norm = normalizeText(categoryName);
    const subcats = new Set();
    for (const item of this.items) {
      if (normalizeText(item.category || '') === norm && item.subcategory) {
        subcats.add(item.subcategory.trim());
      }
    }
    return Array.from(subcats);
  }

  getProductsBySubcategory(subcategoryName) {
    const norm = normalizeText(subcategoryName);
    const prods = [];
    const seen = new Set();
    for (const item of this.items) {
      if (normalizeText(item.subcategory || '') === norm || normalizeText(item.category || '') === norm) {
        const key = item.id || item.name;
        if (!seen.has(key)) {
          seen.add(key);
          prods.push(item);
        }
      }
    }
    return prods;
  }
}

module.exports = {
  CatalogRepository,
};
