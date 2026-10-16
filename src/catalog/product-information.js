const { normalizeText } = require('../shared/string.util');

function firstText(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

function productKind(product) {
  const category = normalizeText(`${product.category || product.categoria || ''}`);
  const subcategory = normalizeText(`${product.subcategory || product.subcategoria || ''}`);
  const name = normalizeText(`${product.name || product.descricao || ''}`);
  const searchable = `${name} ${subcategory}`;
  const explicitType = normalizeText(`${product.productType || product.kind || product.tipo || ''}`);
  const livingAnimal = /animal vivo|mini cabra|cabra|bode|galinha|galo|pintinho|coelho|jabuti|tartaruga|codorna|passaro|ave|pato|marreco|hamster|porquinho|cachorro|cao|gato/.test(name)
    || /^(animal|vivo)$/.test(explicitType);
  const animalMerchandise = /racao|petisco|snack|coleira|brinquedo|acessorio|areia higienica|comedouro|bebedouro|cama pet|gaiola|casinha|casa para|aquario|terrario|alimento para|suplemento/.test(name);
  if ((category.includes('pet') || /animal|galinha|coelho|jabuti|hamster|codorna|passaro/.test(searchable)) && livingAnimal && !animalMerchandise) return 'animal';
  if (/madeira|madeiras|rural|mourao|eucalipto|tabua|deck|peroba/.test(searchable)) return 'wood';

  const isSeedlingOrPlantingProduct = /muda|mudas|semente|sementes|plantio|para plantar|para plantio|planta para/.test(searchable);
  if (category.includes('planta') || category.includes('muda') || category.includes('frutifera') || isSeedlingOrPlantingProduct) return 'plant';
  if (/planta|muda|flor|viveiro|palmeira|frutifera|jardinagem|ornamental|grama/.test(searchable)) return 'plant';
  if (category.includes('pet') || /racao|acessorio pet/.test(searchable)) return 'animal-product';
  if (/hortifrutti|hortifruti/.test(category)
    || /fruta|legume|verdura|hortalica|tempero|folhosa|alface|agriao|rucula|couve|espinafre|acelga|repolho|coentro|salsa|salsinha|cebolinha|hortela|manjericao|alecrim|oregano|tomilho|banana|manga|tomate|cebola|alho|abacate|abacaxi|cenoura|beterraba|rabanete|pepino|abobora|chuchu|quiabo|vagem|ervilha|feijao|milho|batata|mandioca|pimenta/.test(searchable)) return 'food';
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

  const normalizedDescription = normalizeText(description);
  const needsUsefulDescription = !description
    || normalizedDescription === normalizeText(name)
    || normalizedDescription.includes('faz parte da categoria')
    || normalizedDescription.includes('orientacoes abaixo ajudam na escolha');
  if (needsUsefulDescription) {
    details.descriptionAi = kind === 'plant'
      ? `${name} é indicado para cultivo. Planeje o local, a luz e a drenagem antes do plantio; a necessidade exata varia conforme a espécie e o estágio da muda.`
      : kind === 'animal'
        ? `Antes de levar ${name} para casa, prepare o abrigo e confirme espaço, manejo e alimentação apropriados para a espécie e a idade.`
        : kind === 'food'
          ? `${name} é um produto para consumo. A escolha e a conservação dependem do frescor e das características deste alimento.`
          : kind === 'animal-product'
            ? `${name} deve ser utilizado somente na espécie e na finalidade indicadas na embalagem.`
            : `${name} está disponível na Conflora Horta e Viveiro. Confira as orientações de uso e conservação antes da compra.`;
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
    details.preferences = 'Gosta de luz e rega compatíveis com a espécie, substrato drenado e espaço suficiente para as raízes se desenvolverem.';
    details.dislikes = 'Evite encharcar o substrato, manter água acumulada no pratinho ou mudar a muda de sol e sombra de forma brusca.';
    details.especificacoes = [category, subcategory, firstText(product.variation, product.variacao)].filter(Boolean).join(' · ');
  } else if (kind === 'animal') {
    details.cuidados_basicos = 'Antes da compra, confirme espécie, idade, origem e necessidades com a equipe. Mantenha água limpa, recinto seguro e higiene regular; procure um médico-veterinário para orientação de saúde e manejo.';
    details.ambiente_ideal = 'Prepare um abrigo seco e ventilado, protegido de chuva, calor excessivo, frio e predadores, com área de descanso e espaço para o animal se movimentar. Use materiais seguros e fáceis de higienizar; confirme o tamanho e a estrutura adequados para a espécie.';
    details.manejo = 'Aproxime-se com calma e dê tempo para o animal se adaptar. Confirme com a equipe a forma segura de pegar, transportar e interagir com esta espécie.';
    details.alimentacao = 'Ofereça dieta própria para a espécie e para a fase de vida. Petiscos também devem ser próprios para o animal e dados com moderação; confirme alimentos e quantidades com a equipe ou um médico-veterinário.';
    details.alimentos_proibidos = 'Não ofereça restos de comida, plantas, medicamentos ou petiscos sem confirmar que são seguros para a espécie. Alimentos tóxicos variam entre animais.';
    details.preferences = 'Precisa de água limpa, ambiente tranquilo, abrigo adequado e alimentação correta para sua espécie e fase de vida.';
    details.dislikes = 'Evite manejo brusco, recinto inseguro, falta de sombra ou abrigo e mudanças repentinas de alimentação.';
    details.especificacoes = [category, subcategory, firstText(product.variation, product.variacao)].filter(Boolean).join(' · ');
  } else if (kind === 'animal-product') {
    details.cuidados_basicos = 'Confira no rótulo a espécie, idade e porte indicados. Siga a quantidade e o modo de uso do fabricante e consulte um médico-veterinário antes de mudar a dieta ou rotina do animal.';
    details.ambiente_ideal = 'Guarde em local limpo, seco e seguro, seguindo as orientações da embalagem. Mantenha fora do alcance de crianças e animais para os quais o produto não é indicado.';
    details.alimentacao = 'Use somente conforme a indicação do rótulo. Não ofereça a espécies ou faixas etárias diferentes sem orientação veterinária.';
    details.especificacoes = [category, subcategory, firstText(product.variation, product.variacao, product.unit, product.unidade)].filter(Boolean).join(' · ');
  } else if (kind === 'food') {
    details.cuidados_basicos = 'Lave os alimentos em água potável antes do consumo e descarte partes danificadas. Como frescor e conservação variam por produto, siga as orientações de armazenamento da embalagem ou da equipe.';
    details.ambiente_ideal = 'Produto destinado ao consumo. Mantenha em local limpo e adequado ao tipo de alimento; refrigere quando indicado e evite exposição prolongada ao calor.';
    details.dicas_armazenamento = 'Separe folhas, frutas e raízes conforme a necessidade de refrigeração. Mantenha os alimentos secos quando indicado e use recipientes limpos; observe a aparência e o prazo de consumo.';
    details.preferences = 'Para conservar o frescor, mantenha o alimento limpo e armazene conforme o tipo: folhas secas e refrigeradas quando indicado; raízes e frutas nas condições recomendadas.';
    details.dislikes = 'Evite calor excessivo, umidade sem ventilação e guardar alimentos danificados junto dos que ainda estão bons.';
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
    preferences: ['preferences', 'o_que_gosta', 'oQueGosta', 'gosta_de', 'gostaDe'],
    dislikes: ['dislikes', 'o_que_evitar', 'oQueEvitar', 'nao_gosta', 'naoGosta'],
    cuidados_basicos: ['cuidados_basicos', 'cuidadosBasicos', 'cuidados', 'careTips'],
    iluminacao: ['iluminacao', 'iluminação', 'lighting', 'dicas_iluminacao'],
    ambiente_ideal: ['ambiente_ideal', 'ambienteIdeal', 'ambiente', 'habitat', 'habitat_ideal'],
    alimentacao: ['alimentacao', 'alimentação', 'food', 'dieta', 'comida'],
    manejo: ['manejo', 'handling', 'comportamento', 'dicas_manejo', 'dicasManejo'],
    alimentos_proibidos: ['alimentos_proibidos', 'alimentosProibidos', 'prohibitedFoods', 'o_que_nao_oferecer', 'oQueNaoOferecer'],
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
