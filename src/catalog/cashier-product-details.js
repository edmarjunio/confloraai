
const { normalizeText } = require('../shared/string.util');

function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getCashierProductDetails(product = {}) {
  const defaults = {};
  const savedDescription = firstText(product.descriptionAi, product.descricao_ia, product.description, product.descricaoProduto);
  const normalizedDescription = normalizeText(savedDescription);
  const isGenericDescription = !savedDescription
    || normalizedDescription === normalizeText(product.name || product.descricao || '')
    || normalizedDescription.includes('faz parte da categoria')
    || normalizedDescription.includes('orientacoes abaixo ajudam na escolha');
  const fields = [
    ['Descrição', isGenericDescription ? '' : savedDescription],
    ['Especificações', firstText(product.specifications, product.especificacoes, product.especificações, product.specs, product.detalhes, defaults.especificacoes)],
    ['Cuidados', firstText(product.cuidados_basicos, product.cuidadosBasicos, product.cuidados, product.careTips, product.dicas_cuidado, product.dicasCuidado, defaults.cuidados_basicos)],
    ['O que gosta', firstText(product.preferences, product.o_que_gosta, product.oQueGosta, product.gosta_de, product.gostaDe, defaults.preferences)],
    ['Iluminação', firstText(product.iluminacao, product.iluminação, product.lighting, product.lightingTips, product.dicas_iluminacao, product.dicasIluminacao, defaults.iluminacao)],
    ['Onde deixar / moradia', firstText(product.ambiente_ideal, product.ambienteIdeal, product.ambiente, product.habitat, product.habitat_ideal, product.habitatIdeal, product.moradia, product.abrigo, defaults.ambiente_ideal)],
    ['Manejo', firstText(product.manejo, product.handling, product.comportamento, product.dicas_manejo, product.dicasManejo, defaults.manejo)],
    ['O que evitar', firstText(product.dislikes, product.o_que_evitar, product.oQueEvitar, product.nao_gosta, product.naoGosta, defaults.dislikes)],
    ['Alimentação', firstText(product.alimentacao, product.alimentação, product.food, product.dieta, product.comida, defaults.alimentacao)],
    ['Alimentos não oferecer', firstText(product.alimentos_proibidos, product.alimentosProibidos, product.prohibitedFoods, product.o_que_nao_oferecer, product.oQueNaoOferecer, defaults.alimentos_proibidos)],
    ['Armazenamento e conservação', firstText(product.dicas_armazenamento, product.dicasArmazenamento, product.storageTips, defaults.dicas_armazenamento)],
    ['Durabilidade', firstText(product.durabilidade, product.durability)],
  ];

  const result = fields
    .filter(([, value]) => value)
    .map(([label, value]) => ({ label, value }));
  const care = result.find((field) => field.label === 'Cuidados')?.value || '';
  if (!result.some((field) => field.label === 'O que evitar')) {
    const avoid = care.match(/[^.!?]*(?:evite|evitar|nunca|não deixe|nao deixe)[^.!?]*[.!?]?/i)?.[0]?.trim();
    if (avoid) result.push({ label: 'O que evitar', value: avoid });
  }
  return result;
}

module.exports = { getCashierProductDetails };
