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
    ['Iluminação', firstText(product.iluminacao, product.iluminação, product.lighting, product.lightingTips, product.dicas_iluminacao, product.dicasIluminacao)],
    ['Ambiente ideal', firstText(product.ambiente_ideal, product.ambienteIdeal, product.ambiente, product.habitat, product.habitat_ideal, product.habitatIdeal)],
    ['Alimentação', firstText(product.alimentacao, product.alimentação, product.food, product.dieta, product.comida)],
    ['Armazenamento', firstText(product.dicas_armazenamento, product.dicasArmazenamento, product.storageTips)],
    ['Durabilidade', firstText(product.durabilidade, product.durability)],
  ];

  return fields
    .filter(([, value]) => value)
    .map(([label, value]) => ({ label, value }));
}

module.exports = { getCashierProductDetails };
