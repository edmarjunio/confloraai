const { normalizeText } = require('../shared/string.util');

function firstText(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function productKind(product) {
  const category = normalizeText(`${product.category || product.categoria || ''} ${product.subcategory || product.subcategoria || ''}`);
  const name = normalizeText(`${product.name || product.descricao || ''} ${category}`);
  if (/pet|animal|aves|galinha|coelho|jabuti|hamster|codorna|passaro|cachorro|gato|porquinho/.test(name)) return 'animal';
  if (/madeira|madeiras|rural|mourao|eucalipto|tabua|deck|peroba/.test(name)) return 'wood';
  if (/hortifruti|horta|fruta|legume|verdura|hortalica|tempero|folhosa/.test(name)) return 'food';
  if (/planta|muda|flor|viveiro|palmeira|frutifera|jardinagem|ornamental|grama/.test(name)) return 'plant';
  return 'general';
}

function buildProductInformation(product = {}) {
  const name = firstText(product.name, product.canonicalName, product.descricao, 'Produto Conflora');
  const category = firstText(product.category, product.categoria, 'Produtos Conflora');
  const subcategory = firstText(product.subcategory, product.subcategoria);
  const fullName = normalizeText(`${name} ${category} ${subcategory}`);
  const kind = productKind(product);
  const description = firstText(product.descriptionAi, product.descricao_ia, product.description, product.descricaoProduto);
  const details = {};

  if (!description || normalizeText(description) === normalizeText(name)) {
    details.descriptionAi = `${name} faz parte da categoria ${category}${subcategory ? `, na linha ${subcategory}` : ''}, disponível na Conflora Horta e Viveiro. As orientações abaixo ajudam na escolha do local e dos cuidados; confirme a variedade e as condições específicas com nossa equipe.`;
  }

  if (kind === 'plant') {
    details.cuidados_basicos = 'Confira a umidade do solo antes de regar e evite encharcamento. Use recipiente ou canteiro com boa drenagem, retire folhas secas e observe a planta após o plantio. A frequência de rega e adubação varia conforme espécie, tamanho e estação.';
    details.iluminacao = /sombra|aglaonema|zamioculca|maranta|samambaia|jiboia|anturio|calathea|philodendron|avenca/.test(fullName)
      ? 'Prefere luz indireta ou meia-sombra. Evite sol forte direto, especialmente nas horas mais quentes; aclimate gradualmente se mudar de ambiente.'
      : /frutifera|frutifero|citricos|jabuticaba|manga|abacate|goiaba|acerola|laranja|limao|rosa do deserto|bougainville|primavera|grama/.test(fullName)
        ? 'Em geral, cultive em local ensolarado. A necessidade exata de sol depende da espécie e da fase da muda; aclimate gradualmente ao sol direto.'
        : 'A necessidade de sol varia por espécie. Comece em local bem iluminado e confirme na etiqueta ou com a equipe se a planta prefere sol direto, meia-sombra ou luz indireta.';
    details.ambiente_ideal = /sombra|aglaonema|zamioculca|maranta|samambaia|jiboia|anturio|calathea|philodendron|avenca/.test(fullName)
      ? 'Ambiente ventilado, protegido de vento forte e com luz indireta. Vasos com furos de drenagem ajudam a evitar água acumulada.'
      : 'Jardim, canteiro ou vaso compatível com o porte adulto, em local ventilado e com drenagem. Verifique a necessidade de sol da variedade antes do plantio definitivo.';
    details.especificacoes = [category, subcategory, firstText(product.variation, product.variacao)].filter(Boolean).join(' · ');
  } else if (kind === 'animal') {
    details.cuidados_basicos = 'Antes da compra, confirme espécie, idade, origem e necessidades com a equipe. Mantenha água limpa, recinto seguro e higiene regular; procure um médico-veterinário para orientação de saúde e manejo.';
    details.ambiente_ideal = 'Local seguro, ventilado, protegido de chuva, calor excessivo, frio e predadores, com espaço e abrigo adequados à espécie e ao porte. As instalações devem permitir comportamento natural e limpeza fácil.';
    details.alimentacao = 'A dieta deve ser própria para a espécie e fase de vida. Confirme com a equipe ou um médico-veterinário quais alimentos e quantidades são adequados; não substitua a dieta por restos ou alimentos não identificados.';
    details.especificacoes = [category, subcategory, firstText(product.variation, product.variacao)].filter(Boolean).join(' · ');
  } else if (kind === 'food') {
    details.cuidados_basicos = 'Lave os alimentos em água potável antes do consumo e descarte partes danificadas. Como frescor e conservação variam por produto, siga as orientações de armazenamento da embalagem ou da equipe.';
    details.ambiente_ideal = 'Produto destinado ao consumo. Mantenha em local limpo e adequado ao tipo de alimento; refrigere quando indicado e evite exposição prolongada ao calor.';
    details.dicas_armazenamento = 'Separe folhas, frutas e raízes conforme a necessidade de refrigeração. Mantenha os alimentos secos quando indicado e use recipientes limpos; observe a aparência e o prazo de consumo.';
    details.especificacoes = [category, subcategory, firstText(product.variation, product.variacao, product.unit, product.unidade)].filter(Boolean).join(' · ');
  } else if (kind === 'wood') {
    details.cuidados_basicos = 'Mantenha a peça limpa e seca. Evite contato prolongado com água e confira o tratamento aplicado antes de usar em áreas externas ou em contato com solo.';
    details.ambiente_ideal = 'O uso interno, externo, estrutural ou em contato com o solo depende da espécie da madeira, dimensões e tratamento. Confirme a indicação e a carga suportada com a equipe antes da instalação.';
    details.dicas_armazenamento = 'Armazene em superfície nivelada, coberta e ventilada, afastada do solo e de umidade. Evite apoiar peso de forma irregular para reduzir empenamento.';
    details.especificacoes = [category, subcategory, firstText(product.variation, product.variacao, product.unit, product.unidade)].filter(Boolean).join(' · ');
  } else {
    details.cuidados_basicos = 'Consulte a embalagem e as recomendações do fabricante antes do uso. Mantenha o produto limpo e utilize-o somente para a finalidade indicada.';
    details.ambiente_ideal = 'Armazene ou utilize em local compatível com a finalidade do produto, protegido de umidade, calor excessivo e intempéries quando aplicável.';
    details.especificacoes = [category, subcategory, firstText(product.variation, product.variacao, product.unit, product.unidade)].filter(Boolean).join(' · ');
  }

  return details;
}

function getMissingProductInformation(product = {}) {
  const generated = buildProductInformation(product);
  const missing = {};
  const aliases = {
    descriptionAi: ['descriptionAi', 'descricao_ia', 'DESCRICAO_IA'],
    cuidados_basicos: ['cuidados_basicos', 'cuidadosBasicos', 'cuidados', 'careTips'],
    iluminacao: ['iluminacao', 'iluminação', 'lighting', 'dicas_iluminacao'],
    ambiente_ideal: ['ambiente_ideal', 'ambienteIdeal', 'ambiente', 'habitat', 'habitat_ideal'],
    alimentacao: ['alimentacao', 'alimentação', 'food', 'dieta', 'comida'],
    especificacoes: ['especificacoes', 'especificações', 'specifications', 'specs', 'detalhes'],
    dicas_armazenamento: ['dicas_armazenamento', 'dicasArmazenamento', 'storageTips'],
  };

  for (const [field, keys] of Object.entries(aliases)) {
    if (!generated[field]) continue;
    if (!keys.some((key) => typeof product[key] === 'string' && product[key].trim())) {
      missing[field] = generated[field];
    }
  }

  return missing;
}

module.exports = { buildProductInformation, getMissingProductInformation };
