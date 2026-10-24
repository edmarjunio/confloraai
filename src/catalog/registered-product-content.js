const detailFields = ['descriptionAi', 'descricao_ia', 'careInstructions', 'care', 'cuidados_basicos', 'cuidadosBasicos',
  'ambiente_ideal', 'ambienteIdeal', 'environment', 'housing', 'iluminacao', 'illumination', 'lighting', 'rega', 'watering',
  'alimentacao', 'feeding', 'manejo', 'handling', 'alimentos_proibidos', 'prohibitedFoods', 'preferences', 'dislikes',
  'dicas_armazenamento', 'storageTips', 'durabilidade', 'durability', 'usage', 'suitability', 'matureSize', 'precautions', 'selectionTips',
  'descricaoProduto', 'especificações', 'specs', 'detalhes', 'cuidados', 'careTips', 'dicas_cuidado', 'dicasCuidado',
  'o_que_gosta', 'oQueGosta', 'gosta_de', 'gostaDe', 'iluminação', 'lightingTips', 'dicas_iluminacao', 'dicasIluminacao',
  'ambiente', 'habitat', 'habitat_ideal', 'habitatIdeal', 'moradia', 'abrigo', 'comportamento', 'dicas_manejo', 'dicasManejo',
  'o_que_evitar', 'oQueEvitar', 'nao_gosta', 'naoGosta', 'alimentação', 'food', 'dieta', 'comida', 'alimentosProibidos',
  'o_que_nao_oferecer', 'oQueNaoOferecer', 'dicasArmazenamento', 'storage', 'wateringInstructions', 'irrigacao', 'frequencia_rega',
  'validade', 'uso', 'modo_de_uso', 'modoDeUso', 'dica_escolha', 'dicaEscolha', 'indicacao', 'indicação', 'especie_indicada',
  'porte_adulto', 'porteAdulto', 'tamanho_adulto', 'tamanhoAdulto', 'precaucoes', 'precauções', 'cuidados_de_uso',
  'light', 'luminosidade', 'onde_deixar'];

function registeredProductContent(product = {}) {
  const reviewed = product.contentProvenance?.kind === 'STAFF_CONFIRMED' && product.contentProvenance.confirmedBy && product.contentProvenance.confirmedAt;
  const fields = new Set(reviewed ? product.contentProvenance.fields || [] : []);
  const description = String(product.publicDescription || (fields.has('description') ? product.description : '') || (fields.has('descriptionAi') ? product.descriptionAi : '') || product.name || product.descricao || '').trim();
  const result = { description, contentReviewPending: !reviewed };
  for (const field of detailFields) if (!fields.has(field)) result[field] = '';
  if (!fields.has('specifications')) result.specifications = {};
  if (!fields.has('especificacoes')) result.especificacoes = {};
  if (!fields.has('contentSections')) result.contentSections = [];
  return result;
}

module.exports = { registeredProductContent, detailFields };
