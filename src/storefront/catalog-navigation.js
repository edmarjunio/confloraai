const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function navigationPath(item, config) {
  const category = String(item.category || item.categoria || "Geral");
  const subcategory = String(item.subcategory || item.subcategoria || "").trim();
  if (config.excludedCategories.some(name => normalize(name) === normalize(category))) {
    return [];
  }
  const name = normalize(item.name || item.descricao);
  const rule = config.rules.find(candidate =>
    normalize(candidate.category) === normalize(category) &&
    normalize(candidate.subcategory) === normalize(subcategory) &&
    (!candidate.nameTerms || candidate.nameTerms.some(term => name.includes(normalize(term)))));
  if (rule) {
    return [...rule.path];
  }
  return [config.categoryLabels[category] || category, config.subcategoryLabels[subcategory] || subcategory].filter(Boolean);
}

module.exports = { navigationPath };
