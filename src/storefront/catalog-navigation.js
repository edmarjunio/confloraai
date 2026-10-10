const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function navigationPath(item, config) {
  if (!config) {
    return [String(item.category || item.categoria || "Geral")];
  }
  const category = String(item.category || item.categoria || "Geral");
  const subcategory = String(item.subcategory || item.subcategoria || "").trim();
  const excluded = config.excludedCategories || [];
  if (excluded.some((name) => normalize(name) === normalize(category))) {
    return [];
  }
  const name = normalize(item.name || item.descricao);
  const rules = config.rules || [];
  const rule = rules.find(
    (candidate) =>
      normalize(candidate.category) === normalize(category) &&
      (!candidate.subcategory ||
        normalize(candidate.subcategory) === normalize(subcategory)) &&
      (!candidate.nameTerms ||
        candidate.nameTerms.some((term) => name.includes(normalize(term)))),
  );
  if (rule) {
    return [...rule.path];
  }
  const categoryLabel =
    (config.categoryLabels && config.categoryLabels[category]) || category;
  const subcategoryLabel =
    (config.subcategoryLabels && config.subcategoryLabels[subcategory]) ||
    subcategory;
  return [categoryLabel, subcategoryLabel].filter(Boolean);
}

module.exports = { navigationPath, normalize };
