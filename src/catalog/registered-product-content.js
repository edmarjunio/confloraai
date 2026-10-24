const { normalizeText } = require('../shared/string.util');
// Legacy aliases are resolved only here. Normalization never writes a source document.
const informationFields = [
  ['scientificName', 'Nome científico', ['scientificName', 'nomeCientifico', 'nome_cientifico']],
  ['species', 'Espécie', ['species', 'especie']],
  ['variety', 'Variedade', ['variety', 'variedade', 'cultivar']],
  ['breed', 'Raça', ['breed', 'raca', 'raça']],
  ['sex', 'Sexo', ['sex', 'sexo']],
  ['characteristics', 'Características', ['characteristics', 'caracteristicas', 'características']],
  ['care', 'Cuidados', ['careInstructions', 'care', 'cuidados_basicos', 'cuidadosBasicos', 'cuidados', 'careTips', 'dicas_cuidado', 'dicasCuidado']],
  ['light', 'Iluminação', ['illumination', 'light', 'iluminacao', 'iluminação', 'lighting', 'lightingTips', 'dicas_iluminacao', 'dicasIluminacao', 'luminosidade']],
  ['watering', 'Rega', ['watering', 'wateringInstructions', 'rega', 'irrigacao', 'frequencia_rega']],
  ['environment', 'Onde deixar / moradia', ['environment', 'housing', 'ambiente_ideal', 'ambienteIdeal', 'ambiente', 'habitat', 'habitat_ideal', 'habitatIdeal', 'moradia', 'abrigo', 'onde_deixar']],
  ['handling', 'Manejo', ['handling', 'manejo', 'comportamento', 'dicas_manejo', 'dicasManejo']],
  ['feeding', 'Alimentação', ['feeding', 'alimentacao', 'alimentação', 'food', 'dieta', 'comida']],
  ['prohibitedFoods', 'Alimentos não oferecer', ['prohibitedFoods', 'alimentos_proibidos', 'alimentosProibidos', 'o_que_nao_oferecer', 'oQueNaoOferecer']],
  ['storageTips', 'Armazenamento e conservação', ['storageTips', 'storage', 'dicas_armazenamento', 'dicasArmazenamento']],
  ['durability', 'Durabilidade', ['durability', 'durabilidade', 'validade']],
  ['preferences', 'O que gosta', ['preferences', 'o_que_gosta', 'oQueGosta', 'gosta_de', 'gostaDe']],
  ['dislikes', 'O que evitar', ['dislikes', 'o_que_evitar', 'oQueEvitar', 'nao_gosta', 'naoGosta']],
  ['usage', 'Uso', ['usage', 'uso', 'modo_de_uso', 'modoDeUso']],
  ['suitability', 'Indicação', ['suitability', 'indicacao', 'indicação', 'especie_indicada']],
  ['matureSize', 'Porte adulto', ['matureSize', 'porte_adulto', 'porteAdulto', 'tamanho_adulto', 'tamanhoAdulto']],
  ['precautions', 'Precauções', ['precautions', 'precaucoes', 'precauções', 'cuidados_de_uso']],
  ['selectionTips', 'Escolha', ['selectionTips', 'dica_escolha', 'dicaEscolha']],
];
const descriptionAliases = ['description', 'descriptionAi', 'descricao_ia', 'descricaoProduto'];
const specificationAliases = ['specifications', 'especificacoes', 'especificações', 'specs', 'detalhes'];
const detailFields = [...new Set([...descriptionAliases.slice(1), ...informationFields.flatMap(([, , aliases]) => aliases)])];
const text = value => typeof value === 'string' ? value.trim().slice(0, 10000) : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
const scalar = value => Array.isArray(value) ? value.slice(0, 30).map(text).filter(Boolean).join(', ') : text(value);
function confirmedFields(product) {
  const proof = product.contentProvenance;
  if (proof?.kind === 'STAFF_CONFIRMED' && proof.confirmedBy && proof.confirmedAt && Array.isArray(proof.fields)) return new Set(proof.fields);
  // Imported/generated text is not promoted to staff-confirmed content.
  return ['MANUAL', 'WEBSITE_DIRECT'].includes(product.source) ? new Set([...detailFields, ...descriptionAliases, ...specificationAliases, 'contentSections']) : new Set();
}
function normalizeSpecifications(value) {
  if (typeof value === 'string') return value.trim() ? [{ key: 'additional', label: 'Especificações', value: text(value) }] : [];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).slice(0, 60).flatMap(([key, entry]) => {
    const structured = entry && typeof entry === 'object' && !Array.isArray(entry);
    const label = structured ? text(entry.label || entry.name || key) : text(key);
    const content = scalar(structured ? entry.value : entry);
    return label && content ? [{ key, label, value: content }] : [];
  });
}
function normalizeProductInformation(product = {}) {
  const fields = confirmedFields(product);
  const select = aliases => aliases.filter(alias => fields.has(alias)).map(alias => scalar(product[alias])).find(Boolean) || '';
  const description = text(product.publicDescription) || select(descriptionAliases) || text(product.name || product.descricao);
  const attributes = informationFields.flatMap(([key, label, aliases]) => {
    const value = select(aliases);
    return value ? [{ key, label, value }] : [];
  });
  const specifications = [], seen = new Set();
  for (const alias of specificationAliases.filter(alias => fields.has(alias))) for (const row of normalizeSpecifications(product[alias])) {
    const key = normalizeText(row.label);
    if (!seen.has(key)) { seen.add(key); specifications.push(row); }
  }
  const sections = fields.has('contentSections') && Array.isArray(product.contentSections) ? product.contentSections.slice(0, 30)
    .filter(section => text(section?.title) && text(section?.body))
    .map((section, index) => ({ id: text(section.id) || 'section-' + index, title: text(section.title), body: text(section.body) })) : [];
  return { version: 1, description, attributes, specifications, sections, reviewPending: fields.size === 0 };
}
function registeredProductContent(product = {}) {
  const info = normalizeProductInformation(product);
  const result = Object.fromEntries([...detailFields, ...specificationAliases].map(key => [key, '']));
  result.description = info.description;
  result.contentReviewPending = info.reviewPending;
  const fields = confirmedFields(product);
  for (const alias of descriptionAliases.slice(1)) if (fields.has(alias)) result[alias] = info.description;
  for (const [key, , aliases] of informationFields) {
    const value = info.attributes.find(attribute => attribute.key === key)?.value || '';
    for (const alias of aliases) result[alias] = value;
    result[key] = value;
  }
  result.specifications = Object.fromEntries(info.specifications.map(row => [row.key, { label: row.label, value: row.value }]));
  result.especificacoes = result.specifications;
  result.contentSections = info.sections;
  result.productInfo = info;
  return result;
}
module.exports = { registeredProductContent, normalizeProductInformation, normalizeSpecifications, detailFields, informationFields };
