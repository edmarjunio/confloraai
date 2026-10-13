/**
 * Módulo de Cuidados, Armazenamento e Cross-Sell Inteligente
 * Focado em Plantas & Mudas, Hortifrúti e Móveis Rústicos da Conflora.
 */

const { normalizeText } = require('../shared/string.util');

/**
 * Retorna cuidados básicos, ambiente ideal, dicas de armazenamento, durabilidade e ganchos de cross-sell
 * para um produto, enriquecendo os campos do Firestore.
 */
function getProductCareDetails(product = {}) {
  const name = String(product.name || product.canonicalName || product.descricao || '').trim();
  const cat = String(product.category || product.categoria || '').trim();
  const subcat = String(product.subcategory || product.subcategoria || '').trim();
  const desc = String(product.description || product.descricao || product.descriptionAi || '').trim();

  const fullText = normalizeText(`${name} ${cat} ${subcat} ${desc}`);

  // Se o produto já possui os campos preenchidos explicitamente no Firestore, utiliza-os com prioridade
  let cuidados_basicos = String(product.cuidados_basicos || product.cuidadosBasicos || '').trim();
  let ambiente_ideal = String(product.ambiente_ideal || product.ambienteIdeal || '').trim();
  let dicas_armazenamento = String(product.dicas_armazenamento || product.dicasArmazenamento || '').trim();
  let durabilidade = String(product.durabilidade || '').trim();
  let crossSellSugestao = '';

  // 1. PLANTAS, MUDAS, FLORES E JARDIM
  const isPlanta = /planta|muda|flor|arvore|palmeira|rosa do deserto|orquidea|samambaia|jiboia|zamioculca|suculenta|cacto|frutifer|jabuticaba|ipe|buxinho|costela|maranta|croton|anturio/i.test(fullText);
  // 2. HORTIFRÚTI (Frutas, legumes, hortaliças, temperos)
  const isHortifruti = /hortifruti|fruta|legume|verdura|hortalica|alface|tomate|banana|manga|laranja|cebola|alho|abacate|abacaxi|mandioca|pimenta|cenoura|beterraba|couve|cheiro verde|rucula/i.test(fullText);
  // 3. MÓVEIS RÚSTICOS E MADEIRAS MACIÇAS
  const isMovelRustico = /movel|rustico|madeira|peroba|mesa|banco|aparador|cristaleira|poltrona|banqueta|tabua|painel|dormente|deck/i.test(fullText);

  if (isPlanta) {
    if (!cuidados_basicos) {
      if (/rosa do deserto|cacto|suculenta/i.test(fullText)) {
        cuidados_basicos = 'Regas moderadas (1 a 2 vezes por semana no calor do cerrado; apenas quando o substrato secar por completo). Nunca deixe o prato com água acumulada.';
      } else if (/sombra|jiboia|zamioculca|samambaia|maranta|anturio/i.test(fullText)) {
        cuidados_basicos = 'Mantenha o substrato levemente úmido com regas 2 a 3 vezes por semana. Borrife água nas folhas em dias secos.';
      } else {
        cuidados_basicos = 'Regar nas primeiras horas da manhã ou fim da tarde. Adubar a cada 45 dias com adubo orgânico ou NPK para fortalecer raízes e folhagem.';
      }
    }

    if (!ambiente_ideal) {
      if (/rosa do deserto|sol|frutifer|palmeira|ipe/i.test(fullText)) {
        ambiente_ideal = 'Sol pleno direto (pelo menos 4 a 6 horas de sol por dia). Ideal para jardins abertos, calçadas ou vasos grandes com boa drenagem.';
      } else if (/sombra|zamioculca|jiboia|anturio|sala|interior/i.test(fullText)) {
        ambiente_ideal = 'Meia-sombra ou luz difusa abundante (perto de janelas, salas e varandas cobertas). Evitar sol forte das 10h às 16h.';
      } else {
        ambiente_ideal = 'Ambiente arejado com boa luminosidade natural e solo rico em matéria orgânica.';
      }
    }

    if (!dicas_armazenamento) {
      dicas_armazenamento = 'Se for plantar em vaso, utilize argila expandida no fundo e manta bidim para drenagem perfeita. Evite vento encanado excessivo nas mudas recém-chegadas.';
    }

    if (!durabilidade) {
      durabilidade = 'Planta perene de longa durabilidade (cultivo contínuo por muitos anos com adubação sazonal).';
    }

    crossSellSugestao = 'Para potencializar o desenvolvimento, recomendamos levar nosso Adubo Orgânico Conflora e Substrato Aerado com Húmus.';
  } else if (isHortifruti) {
    if (!cuidados_basicos) {
      cuidados_basicos = 'Higienizar em água corrente antes do consumo. Para folhas, secar bem antes de guardar para preservar a crocância e frescor.';
    }

    if (!ambiente_ideal) {
      if (/banana|abacaxi|manga|mamao|abacate/i.test(fullText)) {
        ambiente_ideal = 'Local fresco, arejado e protegido do sol direto. Após maduro, pode ser mantido sob refrigeração moderada.';
      } else {
        ambiente_ideal = 'Gaveta inferior da geladeira em pote fechado ou saco perfurado para manter a umidade ideal sem queimar as folhas.';
      }
    }

    if (!dicas_armazenamento) {
      dicas_armazenamento = 'Armazenar em temperatura entre 8°C e 12°C. Não misturar frutas climatéricas (como banana e maçã) com folhagens delicadas para evitar amadurecimento acelerado.';
    }

    if (!durabilidade) {
      if (/alho|cebola|mandioca|batata/i.test(fullText)) {
        durabilidade = 'De 15 a 30 dias em local seco e ventilado.';
      } else if (/folha|alface|rucula|couve/i.test(fullText)) {
        durabilidade = 'De 4 a 7 dias mantido devidamente seco e refrigerado.';
      } else {
        durabilidade = 'De 5 a 10 dias em refrigeração adequada.';
      }
    }

    crossSellSugestao = 'Dica: Que tal combinar com nossos temperos frescos e azeite artesanal para uma salada ou prato completo?';
  } else if (isMovelRustico) {
    if (!cuidados_basicos) {
      cuidados_basicos = 'Limpar apenas com flanela seca ou levemente umedecida em água. Hidratar a madeira a cada 60 dias com cera de carnaúba ou óleo mineral.';
    }

    if (!ambiente_ideal) {
      ambiente_ideal = 'Ambientes internos, varandas gourmets ou áreas cobertas. Se ficar em área externa aberta, aplicar impermeabilizante ou verniz com proteção UV.';
    }

    if (!dicas_armazenamento) {
      dicas_armazenamento = 'Evitar apoiar panelas ferventes ou líquidos corrosivos diretamente sobre o acabamento rústico. Utilize descanso de prato e tábua.';
    }

    if (!durabilidade) {
      durabilidade = 'Madeira nobre de demolição e maciça: dura décadas e atravessa gerações quando hidratada regularmente.';
    }

    crossSellSugestao = 'Temos a Cera Protetora de Carnaúba Conflora e tábuas de corte artesanais em madeira maciça que combinam perfeitamente.';
  } else {
    // Padrão Geral Conflora
    if (!cuidados_basicos) {
      cuidados_basicos = 'Conservar em local seco, limpo e arejado, longe de umidade excessiva.';
    }
    if (!ambiente_ideal) {
      ambiente_ideal = 'Ambiente protegido de intempéries diretas e sol forte contínuo.';
    }
    if (!dicas_armazenamento) {
      dicas_armazenamento = 'Manter em embalagem original ou recipiente vedado após o uso.';
    }
    if (!durabilidade) {
      durabilidade = 'Excelente durabilidade sob armazenamento correto conforme orientações da loja.';
    }
    crossSellSugestao = 'Consulte nossos itens complementares no catálogo para aproveitar o mesmo frete!';
  }

  return {
    cuidados_basicos,
    ambiente_ideal,
    dicas_armazenamento,
    durabilidade,
    crossSellSugestao,
  };
}

module.exports = {
  getProductCareDetails,
};
