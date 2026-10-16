const PRODUCT_TEXT_LIMIT = 165;

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function firstText(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function compact(value, limit = PRODUCT_TEXT_LIMIT) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const boundary = text.lastIndexOf(" ", limit - 1);
  return `${text.slice(0, boundary > limit * 0.65 ? boundary : limit).trim()}…`;
}

function sentences(value) {
  return String(value || "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => compact(part, 190))
    .filter(Boolean);
}

function classifyProduct(product, category) {
  const categoryText = normalize(category);
  const productText = normalize([
    product.name,
    product.subcategoryName,
    product.subcategory,
    product.subcategoria,
  ].join(" "));

  if (categoryText.includes("pet") || /animal|racao|acessorio pet/.test(productText)) return "pets";
  if (categoryText.includes("hortifrutti") || categoryText.includes("hortifruti")) return "food";
  if (categoryText.includes("frutifera") || categoryText.includes("frutifero")) return "fruiting-plant";
  if (categoryText.includes("horta")) return "garden";
  if (categoryText.includes("planta") || categoryText.includes("muda")) return "plant";
  if (/planta|muda|flor|palmeira|frutifera|grama|semente/.test(productText)) return "plant";
  if (/fruta|legume|verdura|hortalica|alface|banana|manga|tomate|cebola|abacate|abacaxi/.test(productText)) return "food";
  return "general";
}

function categoryContent(kind, values, product) {
  const name = firstText(product.name, "este produto");
  const make = (key, fallback) => compact(values[key] || fallback);
  const careTips = values.care ? sentences(values.care).slice(0, 3) : [];

  if (kind === "plant" || kind === "fruiting-plant" || kind === "garden") {
    const fruiting = kind === "fruiting-plant";
    const gardening = kind === "garden";
    return {
      summary: values.description || (fruiting
        ? `${name} pode compor um pomar ou jardim produtivo. O melhor resultado depende da variedade, do clima e do espaço disponível.`
        : gardening
          ? `Uma boa escolha para sua horta. Observe a identificação da variedade e ajuste o cultivo à luz e ao espaço disponíveis.`
          : `${name} ganha destaque quando recebe luz, espaço e cuidados compatíveis com a espécie.`),
      facts: [
        { label: "Iluminação", icon: "sun", tone: "yellow", value: make("light", fruiting
          ? "A maioria das frutíferas prefere local ensolarado; confirme a necessidade desta variedade."
          : "A necessidade de sol varia por espécie. Confira a identificação e aclimate aos poucos." ) },
        { label: "Rega", icon: "drop", tone: "blue", value: make("watering", "Confira a umidade do solo antes de regar e evite encharcar as raízes.") },
        { label: "Onde deixar", icon: "mapPin", tone: "green", value: make("environment", fruiting
          ? "Jardim ou vaso compatível com o porte adulto, em local iluminado e com boa drenagem."
          : "Escolha um local ventilado e compatível com a luz e o porte que a planta terá." ) },
        { label: "Porte e espaço", icon: "leaf", tone: "green", value: make("matureSize", "Confirme o porte adulto para escolher o vaso ou canteiro adequado.") },
      ],
      pairTitle: "O ambiente ideal",
      likesTitle: "O que favorece",
      likes: make("likes", "Luz adequada à espécie, solo drenado e uma rotina de cuidados constante."),
      avoidTitle: "O que evitar",
      avoid: make("avoid", "Solo encharcado e mudanças bruscas de ambiente sem aclimatação."),
      tipsTitle: "Cuidados simples que ajudam",
      tips: careTips.length ? careTips : [
        "Toque a terra antes de regar e ajuste a frequência conforme o clima.",
        "Use vaso ou canteiro com drenagem e espaço compatível com o crescimento.",
        fruiting ? "Consulte a equipe sobre variedade, época de plantio e porte adulto." : "Observe folhas e crescimento para ajustar luz e rega.",
      ],
    };
  }

  if (kind === "food") {
    return {
      summary: values.description || `${name} é uma opção fresca para suas receitas. A conservação ideal depende do tipo e do ponto de maturação.`,
      facts: [
        { label: "Como escolher", icon: "leaf", tone: "green", value: make("selection", "Observe aparência, firmeza e maturação de acordo com o uso que você prefere.") },
        { label: "Conservação", icon: "box", tone: "blue", value: make("storage", "Siga a recomendação para esta variedade; alguns alimentos pedem refrigeração e outros, local seco.") },
        { label: "Como aproveitar", icon: "sparkle", tone: "yellow", value: make("usage", "Higienize conforme o tipo de alimento e aproveite em preparos frescos ou receitas.") },
        { label: "Validade", icon: "clock", tone: "orange", value: make("durability", "Confira as condições do produto e consuma enquanto estiver próprio para uso.") },
      ],
      pairTitle: "Dica para aproveitar melhor",
      likesTitle: "Para preservar o frescor",
      likes: make("likes", "Armazenamento adequado ao tipo de alimento e consumo no ponto de sua preferência."),
      avoidTitle: "O que evitar",
      avoid: make("avoid", "Calor e umidade excessivos, além de guardar sem observar a recomendação da variedade."),
      tipsTitle: "Boas práticas",
      tips: careTips.length ? careTips : [
        "Higienize antes do consumo, seguindo o cuidado adequado ao alimento.",
        "Guarde conforme a recomendação para esta variedade e seu estágio de maturação.",
        "Use primeiro os itens mais maduros ou delicados.",
      ],
    };
  }

  if (kind === "pets") {
    return {
      summary: values.description || `${name} pode fazer parte da rotina do seu pet. Confira a indicação de espécie, porte e idade na embalagem ou com a equipe.`,
      facts: [
        { label: "Indicação", icon: "heart", tone: "green", value: make("suitability", "Confira no rótulo a espécie, idade e porte para os quais o produto é indicado.") },
        { label: "Uso ou alimentação", icon: "leaf", tone: "yellow", value: make("feeding", "Siga as instruções do fabricante e não altere a rotina alimentar sem orientação adequada.") },
        { label: "Armazenamento", icon: "box", tone: "blue", value: make("storage", "Mantenha a embalagem fechada, em local seco e conforme as instruções do rótulo.") },
        { label: "Bem-estar", icon: "shield", tone: "orange", value: make("environment", "Use somente para a finalidade e para a espécie indicadas pelo fabricante.") },
      ],
      pairTitle: "Escolha com segurança",
      likesTitle: "O que ajuda",
      likes: make("likes", "Respeitar a indicação, o modo de uso e as recomendações da embalagem."),
      avoidTitle: "O que evitar",
      avoid: make("avoid", "Oferecer a uma espécie, idade ou porte diferente do indicado."),
      tipsTitle: "Antes de usar",
      tips: careTips.length ? careTips : [
        "Confira a indicação e o modo de uso no rótulo.",
        "Armazene conforme a embalagem e mantenha fora do alcance de crianças.",
        "Em caso de dúvida sobre saúde ou alimentação, consulte um médico-veterinário.",
      ],
    };
  }

  return {
    summary: values.description || `${name}: consulte a descrição e as orientações da embalagem para escolher e usar este item da melhor forma.`,
    facts: [
      { label: "Indicação", icon: "sparkle", tone: "green", value: make("usage", "Confira a finalidade e a compatibilidade deste produto antes de usar.") },
      { label: "Conservação", icon: "box", tone: "blue", value: make("storage", "Guarde em local limpo e seco, seguindo as instruções do fabricante.") },
        { label: "Cuidados", icon: "shield", tone: "orange", value: make("precautions", "Observe as orientações de uso e manuseio informadas na embalagem.") },
      { label: "Informações", icon: "info", tone: "yellow", value: make("durability", "Nossa equipe pode ajudar a confirmar detalhes e compatibilidade.") },
    ],
    pairTitle: "Dica de compra",
    likesTitle: "Pode combinar com",
    likes: make("likes", "Consulte a equipe para encontrar itens complementares para sua necessidade."),
    avoidTitle: "Antes de escolher",
    avoid: make("avoid", "Verifique medidas, indicação e compatibilidade com o uso pretendido."),
    tipsTitle: "Para aproveitar melhor",
    tips: careTips.length ? careTips : [
      "Leia as instruções de uso e conservação do fabricante.",
      "Confira medidas, conteúdo e compatibilidade antes de comprar.",
      "Se precisar de ajuda, fale com nossa equipe pelo WhatsApp.",
    ],
  };
}

export function buildProductInfoContent(product, category) {
  const kind = classifyProduct(product, category);
  const description = firstText(product.description, product.descriptionAi, product.descricao_ia);
  const genericDescription = normalize(description) === normalize(product.name)
    || normalize(description).includes("faz parte da categoria")
    || normalize(description).includes("orientacoes abaixo ajudam na escolha");
  const care = firstText(product.careInstructions, product.care, product.cuidados_basicos, product.cuidadosBasicos);
  const values = {
    description: !genericDescription ? compact(description, 260) : "",
    light: firstText(product.illumination, product.light, product.iluminacao, product.lighting, product.dicas_iluminacao),
    watering: firstText(product.watering, product.wateringInstructions, product.rega, product.irrigacao, product.frequencia_rega),
    environment: firstText(product.environment, product.ambiente_ideal, product.ambienteIdeal, product.habitat),
    care,
    matureSize: firstText(product.matureSize, product.porte_adulto, product.porteAdulto, product.tamanho_adulto, product.tamanhoAdulto),
    precautions: firstText(product.precautions, product.precaucoes, product.precauções, product.cuidados_de_uso),
    storage: firstText(product.storageTips, product.storage, product.dicas_armazenamento, product.dicasArmazenamento),
    feeding: firstText(product.feeding, product.alimentacao, product.alimentação, product.dieta),
    durability: firstText(product.durability, product.durabilidade, product.validade),
    usage: firstText(product.usage, product.uso, product.modo_de_uso, product.modoDeUso),
    selection: firstText(product.selectionTips, product.dica_escolha, product.dicaEscolha),
    suitability: firstText(product.suitability, product.indicacao, product.indicação, product.especie_indicada),
    likes: firstText(product.preferences, product.o_que_gosta, product.oQueGosta, product.gosta_de, product.gostaDe),
    avoid: firstText(product.dislikes, product.o_que_evitar, product.oQueEvitar, product.nao_gosta, product.naoGosta),
  };

  return categoryContent(kind, values, product);
}
