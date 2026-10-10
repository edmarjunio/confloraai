// Guided Search & Navigation Engine for Conflora Storefront
// Provides typo-tolerant matching, synonym expansion, and multi-step category navigation.

export function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function levenshteinDistance(a, b) {
  if (a === b) { return 0; }
  if (!a.length) { return b.length; }
  if (!b.length) { return a.length; }

  const row = [];
  for (let i = 0; i <= b.length; i++) {
    row[i] = i;
  }

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

export function isFuzzyMatch(token, target) {
  const t = normalize(token);
  const tgt = normalize(target);
  if (!t || !tgt) { return false; }
  if (t === tgt) { return true; }
  if (tgt.includes(t) || t.includes(tgt)) { return true; }

  const len = Math.min(t.length, tgt.length);
  const maxDistance = len >= 7 ? 2 : len >= 4 ? 1 : 0;
  if (maxDistance === 0) { return false; }

  // Compare entire word
  if (levenshteinDistance(t, tgt) <= maxDistance) { return true; }

  // Compare against individual words in target
  const words = tgt.split(/[\s\-_/]+/);
  for (const word of words) {
    if (word.length >= 3) {
      if (word.includes(t) || t.includes(word)) { return true; }
      const wDist = word.length >= 7 ? 2 : word.length >= 4 ? 1 : 0;
      if (wDist > 0 && levenshteinDistance(t, word) <= wDist) { return true; }
    }
  }

  return false;
}

export function expandSynonyms(rawTokens, synonymsMap = {}) {
  const normalizedTokens = rawTokens.map(normalize).filter(Boolean);
  const expanded = new Set(normalizedTokens);

  for (const token of normalizedTokens) {
    for (const [key, list] of Object.entries(synonymsMap)) {
      const normKey = normalize(key);
      const normList = Array.isArray(list) ? list.map(normalize) : [];
      const allTerms = [normKey, ...normList];

      const matches = allTerms.some((term) => isFuzzyMatch(token, term));
      if (matches) {
        allTerms.forEach((term) => expanded.add(term));
      }
    }
  }

  return Array.from(expanded);
}

export function buildNavigationTree(products, config = {}) {
  const tree = {
    name: "root",
    children: new Map(),
  };

  const excluded = new Set(
    (config.excludedCategories || []).map(normalize),
  );

  for (const product of products) {
    if (!product.isAvailable) { continue; }
    const path = Array.isArray(product.navigationPath) && product.navigationPath.length
      ? product.navigationPath
      : [product.categoryName, product.subcategoryName].filter(Boolean);

    if (!path.length) { continue; }
    if (excluded.has(normalize(path[0]))) { continue; }

    let current = tree;
    for (let depth = 0; depth < path.length; depth++) {
      const seg = path[depth].trim();
      if (!seg) { continue; }
      if (!current.children.has(seg)) {
        current.children.set(seg, {
          name: seg,
          depth,
          fullPath: path.slice(0, depth + 1),
          children: new Map(),
          products: [],
        });
      }
      current = current.children.get(seg);
      current.products.push(product);
    }
  }

  return tree;
}

export function searchProducts(products, query, { synonyms = {}, limit = 40 } = {}) {
  const rawQuery = String(query || "").trim();
  if (!rawQuery) {
    return products.slice(0, limit);
  }

  const queryTokens = normalize(rawQuery).split(/[\s,;]+/).filter(Boolean);
  const expandedTokens = expandSynonyms(queryTokens, synonyms);
  const rawNormalized = normalize(rawQuery);

  const scored = [];

  for (const product of products) {
    if (!product.isAvailable) { continue; }

    let score = 0;
    const nameNorm = normalize(product.name);
    const navNorm = (product.navigationPath || []).map(normalize).join(" ");
    const catNorm = normalize(product.categoryName || "");
    const subNorm = normalize(product.subcategoryName || "");
    const tagsNorm = (product.tags || []).map(normalize).join(" ");
    const aliasesNorm = (product.searchAliases || []).map(normalize).join(" ");
    const descNorm = normalize(product.description || "");

    // Exact full query match in title
    if (nameNorm === rawNormalized) {
      score += 200;
    } else if (nameNorm.includes(rawNormalized)) {
      score += 100;
    }

    // Check each token
    for (const token of expandedTokens) {
      if (token.length < 2) { continue; }

      if (nameNorm.includes(token)) {
        score += 30;
      } else if (isFuzzyMatch(token, nameNorm)) {
        score += 20;
      }

      if (navNorm.includes(token) || isFuzzyMatch(token, navNorm)) {
        score += 15;
      }

      if (aliasesNorm.includes(token) || tagsNorm.includes(token)) {
        score += 12;
      }

      if (catNorm.includes(token) || subNorm.includes(token)) {
        score += 10;
      }

      if (descNorm.includes(token)) {
        score += 4;
      }
    }

    if (score > 0) {
      scored.push({
        product,
        score,
        sales: product.salesCount || 0,
      });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) { return b.score - a.score; }
    if (b.sales !== a.sales) { return b.sales - a.sales; }
    return a.product.name.localeCompare(b.product.name, "pt-BR");
  });

  return scored.slice(0, limit).map((s) => s.product);
}

export function findCategoryNode(tree, path) {
  let current = tree;
  for (const seg of path) {
    const normSeg = normalize(seg);
    let found = null;
    for (const [key, child] of current.children.entries()) {
      if (normalize(key) === normSeg) {
        found = child;
        break;
      }
    }
    if (!found) { return null; }
    current = found;
  }
  return current;
}
