// Product details are displayed only when registered in Firestore.
const firstText = (...values) => values.find(value => typeof value === 'string' && value.trim())?.trim() || '';
export function buildProductInfoContent(product) {
  if (product.productInfo?.version === 1) {
    const info = product.productInfo;
    const attributes = new Map(info.attributes.map(attribute => [attribute.key, attribute]));
    const value = key => attributes.get(key)?.value || '';
    const presentation = { light: ['light_requirements', 'sun', 'yellow'], watering: ['watering', 'drop', 'blue'],
      environment: ['placement_environment', 'mapPin', 'green'], storageTips: ['storage', 'box', 'green'],
      feeding: ['product_feeding', 'leaf', 'green'], durability: ['product_durability', 'clock', 'blue'] };
    return { summary: info.description,
      facts: info.attributes.filter(attribute => !['care', 'preferences', 'dislikes'].includes(attribute.key)).map(attribute => {
        const display = presentation[attribute.key];
        return { label: display ? window.tr(display[0]) : attribute.label, icon: display?.[1] || 'leaf', tone: display?.[2] || 'green', value: attribute.value };
      }), pairTitle: 'product_details'.tr, likesTitle: 'what_helps'.tr, likes: value('preferences'),
      avoidTitle: 'what_to_avoid'.tr, avoid: value('dislikes'), tipsTitle: 'care_precautions'.tr,
      tips: value('care').split(/(?<=[.!?])\s+|\n+/).map(text => text.trim()).filter(Boolean) };
  }
  // Compatibility for tenant APIs and cached legacy projections. Main-store
  // documents always receive productInfo from the backend normalization.
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
