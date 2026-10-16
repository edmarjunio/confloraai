function firstText(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getCashierProductDetails(product = {}) {
  const fields = [
    ['Descrição', firstText(product.descriptionAi, product.descricao_ia, product.description, product.descricaoProduto)],
    ['Especificações', firstText(product.specifications, product.especificacoes, product.especificações, product.specs, product.detalhes)],
    ['Cuidados', firstText(product.cuidados_basicos, product.cuidadosBasicos, product.cuidados, product.careTips, product.dicas_cuidado, product.dicasCuidado)],
    ['O que gosta', firstText(product.preferences, product.o_que_gosta, product.oQueGosta, product.gosta_de, product.gostaDe)],
    ['Iluminação', firstText(product.iluminacao, product.iluminação, product.lighting, product.lightingTips, product.dicas_iluminacao, product.dicasIluminacao)],
    ['Ambiente ideal', firstText(product.ambiente_ideal, product.ambienteIdeal, product.ambiente, product.habitat, product.habitat_ideal, product.habitatIdeal)],
    ['O que evitar', firstText(product.dislikes, product.o_que_evitar, product.oQueEvitar, product.nao_gosta, product.naoGosta)],
    ['Alimentação', firstText(product.alimentacao, product.alimentação, product.food, product.dieta, product.comida)],
    ['Armazenamento', firstText(product.dicas_armazenamento, product.dicasArmazenamento, product.storageTips)],
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
  if (!result.some((field) => field.label === 'O que gosta')) {
    const preferences = result
      .filter((field) => ['Iluminação', 'Ambiente ideal'].includes(field.label))
      .map((field) => field.value)
      .join(' ');
    if (preferences) result.push({ label: 'O que gosta', value: preferences });
  }
  return result;
}

module.exports = { getCashierProductDetails };
