export const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const stopWords = new Set("a o as os de da do das dos um uma para por em no na eu quero queria preciso tem voce voces qual quais preco valor custa quanto sobre saber produto produtos como cuidar cuidados me mostre mostrar".split(" "));
const words = (value) => normalize(value).split(" ").filter(word => word && !stopWords.has(word));

function distance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) { matrix[0][j] = j; }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }
  return matrix[a.length][b.length];
}
function wordScore(query, candidate) {
  if (query === candidate) { return 5; }
  if (/\d/.test(query) || /\d/.test(candidate)) { return 0; }
  if (query.length >= 4 && candidate.startsWith(query)) { return 4; }
  const limit = query.length >= 7 ? 2 : query.length >= 4 ? 1 : 0;
  if (!limit || Math.abs(query.length - candidate.length) > limit) { return 0; }
  return distance(query, candidate) <= limit ? 1 : 0;
}
export function productPaths(product, categories) {
  if (Array.isArray(product.navigationPath)) { return product.navigationPath.length ? [product.navigationPath] : []; }
  return (product.categories || []).map(id => {
    const category = categories.find(item => item.id === id && item.isActive !== false);
    return category ? [category.name, product.subcategoryName].filter(Boolean) : [];
  }).filter(path => path.length);
}
export function scopedProducts(products, categories, path) {
  return products.filter(product => product.isAvailable && productPaths(product, categories).some(parts => path.every((part, index) => part === parts[index])));
}
export function nextChoices(products, categories, path) {
  const counts = new Map();
  for (const product of scopedProducts(products, categories, path)) {
    const names = new Set(productPaths(product, categories).filter(parts => path.every((part, index) => part === parts[index])).map(parts => parts[path.length]).filter(Boolean));
    for (const name of names) { counts.set(name, (counts.get(name) || 0) + 1); }
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
export function searchProducts(products, query, synonyms = []) {
  const terms = words(query).slice(0, 12);
  if (!terms.length) { return []; }
  return products.filter(product => product.isAvailable).map(product => {
    const identity = [product.name, ...(product.searchAliases || []), ...(product.tags || [])].join(" ");
    const expanded = synonyms.filter(group => group.some(alias => ` ${normalize(identity)} `.includes(` ${normalize(alias)} `))).flat();
    const candidates = [...new Set(words([identity, ...expanded].join(" ")))];
    const scores = terms.map(term => Math.max(0, ...candidates.map(candidate => wordScore(term, candidate))));
    return { product, score: scores.every(score => score > 0) ? scores.reduce((sum, score) => sum + score, 0) : 0, approximate: scores.some(score => score < 4) };
  }).filter(result => result.score > 0).sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, "pt-BR"));
}
