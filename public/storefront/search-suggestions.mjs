import { normalize } from './guided-search.mjs';

export function buildSearchSuggestions(products, query, categories = [], synonyms = []) {
  const term = normalize(query).slice(0, 100);
  if (term.length < 2 || /@/.test(query)) return [];
  const entries = new Map();
  const add = (label, kind, aliases = []) => {
    if (typeof label !== 'string' || !label.trim()) return;
    const key = normalize(label);
    const terms = term.split(' ');
    const identity = normalize([label, ...aliases].join(' '));
    if (!terms.every(word => identity.includes(word))) return;
    const score = key === term ? 0 : key.startsWith(term) ? 1 : key.includes(term) ? 2 : 3;
    const entry = { label: label.trim(), kind, score };
    if (!entries.has(key) || entries.get(key).score > score) entries.set(key, entry);
  };
  for (const product of products) {
    if (product.status === 'INATIVO' || product.isAvailable === false) continue;
    const aliases = [...(product.searchAliases || []), ...(product.tags || [])];
    const identity = normalize([product.name, ...aliases].join(' '));
    const related = synonyms.filter(group => Array.isArray(group) && group.some(alias => identity.includes(normalize(alias)))).flat();
    add(product.name, 'Produto', [...aliases, ...related]);
    add(product.categoryName || product.category, 'Categoria');
    add(product.subcategoryName || product.subcategory, 'Subcategoria');
    for (const id of product.categories || []) add(categories.find(category => category.id === id && category.isActive !== false)?.name, 'Categoria');
  }
  return [...entries.values()].sort((a, b) => a.score - b.score || (a.kind === 'Produto' ? 0 : 1) - (b.kind === 'Produto' ? 0 : 1) || a.label.localeCompare(b.label, 'pt-BR')).slice(0, 8);
}
