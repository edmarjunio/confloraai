export const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const stopWords = new Set(
  "a o as os de da do das dos um uma para por em no na eu quero queria preciso tem voce voces qual quais preco valor custa quanto sobre saber produto produtos como cuidar cuidados me mostre mostrar ajuda ajude ajudar escolher escolha indicar indica indicacao recomendar recomenda recomendacao gostaria preciso planta plantas coisa alguma algo uma um que seja nao muito mais menos voce voces favor por favor comprar quero encontre encontrar tenho tenha preciso precisa precise de para".split(
    " ",
  ),
);
const words = (value) =>
  normalize(value)
    .split(" ")
    .filter((word) => word && !stopWords.has(word));

function distance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + Number(a[i - 1] !== b[j - 1]),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + 1);
      }
    }
  }
  return matrix[a.length][b.length];
}
function wordScore(query, candidate) {
  if (query === candidate) {
    return 5;
  }
  if (/\d/.test(query) || /\d/.test(candidate)) {
    return 0;
  }
  if (query.length >= 4 && candidate.startsWith(query)) {
    return 4;
  }
  const limit = query.length >= 7 ? 2 : query.length >= 4 ? 1 : 0;
  if (!limit || Math.abs(query.length - candidate.length) > limit) {
    return 0;
  }
  return distance(query, candidate) <= limit ? 1 : 0;
}
export function productPaths(product, categories = []) {
  if (product.status === "INATIVO" || product.isAvailable === false) {
    return [];
  }
  const active = (categories || []).filter(
    (category) =>
      product.categories?.includes(category.id) && category.isActive !== false,
  );
  if (active.length) {
    if (Array.isArray(product.navigationPath) && product.navigationPath.length) {
      return [[active[0].name, ...product.navigationPath.slice(1)]];
    }
    return (product.categories || [])
      .map((id) => {
        const category = categories.find(
          (item) => item.id === id && item.isActive !== false,
        );
        return category
          ? [category.name, product.subcategoryName].filter(Boolean)
          : [];
      })
      .filter((path) => path.length);
  }
  const cat = product.categoryName || product.category;
  if (cat) {
    return [[cat, product.subcategoryName || product.subcategory].filter(Boolean)];
  }
  return [];
}
export function scopedProducts(products, categories, path) {
  return products.filter(
    (product) =>
      product.isAvailable &&
      product.status !== "INATIVO" &&
      productPaths(product, categories).some((parts) =>
        path.every((part, index) => part === parts[index]),
      ),
  );
}
export function nextChoices(products, categories, path) {
  const counts = new Map();
  for (const product of scopedProducts(products, categories, path)) {
    const names = new Set(
      productPaths(product, categories)
        .filter((parts) => path.every((part, index) => part === parts[index]))
        .map((parts) => parts[path.length])
        .filter(Boolean),
    );
    for (const name of names) {
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}
export function searchProducts(products, query, synonyms = []) {
  const cleanedQuery = normalize(query).replace(/(?:nao (?:precisa|precise|precisam) (?:de )?(?:muito )?sol|pouco sol|sem sol direto)/g, 'sombra').replace(/(?:para |na |em )?(?:sala|apartamento|dentro de casa)/g, 'interior');
  const terms = words(cleanedQuery).slice(0, 12);
  if (!terms.length) {
    return [];
  }
  return products
    .filter((product) => product.isAvailable && product.status !== "INATIVO")
    .map((product) => {
      const identity = [
        product.name,
        ...(product.searchAliases || []),
        ...(product.tags || []), product.categoryName, product.subcategoryName,
        product.description, ...Object.values(product.searchAttributes || {}),
        ...Object.values(product.specifications || {}).map(value => typeof value === 'string' ? value : value?.value || ''),
      ].join(" ");
      const expanded = synonyms
        .filter((group) =>
          group.some((alias) =>
            ` ${normalize(identity)} `.includes(` ${normalize(alias)} `),
          ),
        )
        .flat();
      const candidates = [...new Set(words([identity, ...expanded].join(" ")))];
      const scores = terms.map((term) =>
        Math.max(
          term === 'sombra' && /luz indireta|iluminacao indireta/.test(normalize(identity)) ? 4 : 0,
          term === 'interior' && /intern[oa]|apartamento|\bsala\b/.test(normalize(identity)) ? 4 : 0,
          0,
          ...candidates.map((candidate) => wordScore(term, candidate)),
        ),
      );
      return {
        product,
        score: scores.every((score) => score > 0)
          ? scores.reduce((sum, score) => sum + score, 0)
          : 0,
        approximate: scores.some((score) => score < 4),
      };
    })
    .filter((result) => result.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.product.name.localeCompare(b.product.name, "pt-BR"),
    );
}
