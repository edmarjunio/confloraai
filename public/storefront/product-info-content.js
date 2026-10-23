// Product details are displayed only when registered in Firestore.
const firstText = (...values) => values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
export function buildProductInfoContent(product) {
  const care = firstText(product.careInstructions, product.care, product.cuidados_basicos, product.cuidadosBasicos);
  const facts = [
    ['light_requirements', 'sun', 'yellow', firstText(product.illumination, product.light, product.iluminacao, product.lighting)],
    ['watering', 'drop', 'blue', firstText(product.watering, product.wateringInstructions, product.rega, product.irrigacao)],
    ['placement_environment', 'mapPin', 'green', firstText(product.environment, product.ambiente_ideal, product.ambienteIdeal, product.habitat)],
    ['storage', 'box', 'green', firstText(product.storageTips, product.storage, product.dicas_armazenamento)],
    ['product_feeding', 'leaf', 'green', firstText(product.feeding, product.alimentacao, product.dieta)],
    ['product_durability', 'clock', 'blue', firstText(product.durability, product.durabilidade, product.validade)],
  ].filter(([, , , value]) => value).map(([label, icon, tone, value]) => ({ label: window.tr(label), icon, tone, value }));
  return {
    summary: firstText(product.description, product.descriptionAi, product.descricao_ia),
    facts,
    pairTitle: 'product_details'.tr,
    likesTitle: 'what_helps'.tr,
    likes: firstText(product.preferences, product.o_que_gosta, product.oQueGosta, product.gosta_de),
    avoidTitle: 'what_to_avoid'.tr,
    avoid: firstText(product.dislikes, product.o_que_evitar, product.oQueEvitar, product.nao_gosta),
    tipsTitle: 'care_precautions'.tr,
    tips: care.split(/(?<=[.!?])\s+|\n+/).map(value => value.trim()).filter(Boolean),
  };
}
