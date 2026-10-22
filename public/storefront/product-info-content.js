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
  const nameText = normalize([product.name, product.canonicalName].join(" "));
  const subcategoryText = normalize([product.subcategoryName, product.subcategory, product.subcategoria].join(" "));
  const productText = normalize([
    nameText,
    subcategoryText,
  ].join(" "));

  const explicitType = normalize([product.productType, product.kind, product.tipo].join(" "));
  const liveAnimal = /animal vivo|mini cabra|cabra|bode|galinha|galo|pintinho|coelho|jabuti|tartaruga|codorna|passaro|ave|pato|marreco|hamster|porquinho|cachorro|cao|gato/.test(nameText)
    || /^(animal|vivo)$/.test(explicitType);
  const petMerchandise = /racao|petisco|snack|coleira|brinquedo|acessorio|areia higienica|comedouro|bebedouro|cama pet|gaiola|casinha|casa para|aquario|terrario|alimento para|suplemento/.test(nameText);
  if ((categoryText.includes("pet") || /animal|racao|acessorio pet/.test(productText)) && liveAnimal && !petMerchandise) return "animal";
  if (categoryText.includes("pet") || /racao|acessorio pet/.test(productText)) return "pets";

  if (categoryText.includes("frutifera") || categoryText.includes("frutifero")) return "fruiting-plant";
  const plantingProduct = /muda|mudas|semente|sementes|plantio|para plantar|para plantio|planta para/.test(`${nameText} ${subcategoryText}`);
  if (categoryText.includes("planta") || categoryText.includes("muda") || plantingProduct) return "plant";
  if (/planta|muda|flor|palmeira|frutifera|grama|semente/.test(productText)) return "plant";
  if (categoryText.includes("hortifrutti") || categoryText.includes("hortifruti")) return "food";
  if (/fruta|legume|verdura|hortalica|alface|agriao|rucula|couve|espinafre|acelga|repolho|coentro|salsa|salsinha|cebolinha|hortela|manjericao|alecrim|oregano|tomilho|banana|manga|tomate|cebola|alho|abacate|abacaxi|cenoura|beterraba|rabanete|pepino|abobora|chuchu|quiabo|vagem|ervilha|feijao|milho|batata|mandioca|pimenta/.test(productText)) return "food";
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
        { label: "Iluminação".tr, icon: "sun", tone: "yellow", value: make("light", fruiting
          ? "A maioria das frutíferas prefere local ensolarado; confirme a necessidade desta variedade."
          : "A necessidade de sol varia por espécie. Confira a identificação e aclimate aos poucos." ) },
        { label: "Rega".tr, icon: "drop", tone: "blue", value: make("watering", "Confira a umidade do solo antes de regar e evite encharcar as raízes.") },
        { label: "Onde deixar".tr, icon: "mapPin", tone: "green", value: make("environment", fruiting
          ? "Jardim ou vaso compatível com o porte adulto, em local iluminado e com boa drenagem."
          : "Escolha um local ventilado e compatível com a luz e o porte que a planta terá." ) },
        { label: "Porte e espaço".tr, icon: "leaf", tone: "green", value: make("matureSize", "Confirme o porte adulto para escolher o vaso ou canteiro adequado.") },
      ],
      pairTitle: "O ambiente ideal".tr,
      likesTitle: "O que favorece".tr,
      likes: make("likes", "Luz adequada à espécie, solo drenado e uma rotina de cuidados constante."),
      avoidTitle: "O que evitar".tr,
      avoid: make("avoid", "Solo encharcado e mudanças bruscas de ambiente sem aclimatação."),
      tipsTitle: "Cuidados simples que ajudam".tr,
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
        { label: "Como escolher".tr, icon: "leaf", tone: "green", value: make("selection", "Observe aparência, firmeza e maturação de acordo com o uso que você prefere.") },
        { label: "Conservação".tr, icon: "box", tone: "blue", value: make("storage", "Siga a recomendação para esta variedade; alguns alimentos pedem refrigeração e outros, local seco.") },
        { label: "Como aproveitar".tr, icon: "sparkle", tone: "yellow", value: make("usage", "Higienize conforme o tipo de alimento e aproveite em preparos frescos ou receitas.") },
        { label: "Validade".tr, icon: "clock", tone: "orange", value: make("durability", "Confira as condições do produto e consuma enquanto estiver próprio para uso.") },
      ],
      pairTitle: "Dica para aproveitar melhor".tr,
      likesTitle: "Para preservar o frescor".tr,
      likes: make("likes", "Armazenamento adequado ao tipo de alimento e consumo no ponto de sua preferência."),
      avoidTitle: "O que evitar".tr,
      avoid: make("avoid", "Calor e umidade excessivos, além de guardar sem observar a recomendação da variedade."),
      tipsTitle: "Boas práticas".tr,
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
        { label: "Indicação".tr, icon: "heart", tone: "green", value: make("suitability", "Confira no rótulo a espécie, idade e porte para os quais o produto é indicado.") },
        { label: "Uso ou alimentação".tr, icon: "leaf", tone: "yellow", value: make("feeding", "Siga as instruções do fabricante e não altere a rotina alimentar sem orientação adequada.") },
        { label: "Armazenamento".tr, icon: "box", tone: "blue", value: make("storage", "Mantenha a embalagem fechada, em local seco e conforme as instruções do rótulo.") },
        { label: "Bem-estar".tr, icon: "shield", tone: "orange", value: make("environment", "Use somente para a finalidade e para a espécie indicadas pelo fabricante.") },
      ],
      pairTitle: "Escolha com segurança".tr,
      likesTitle: "O que ajuda".tr,
      likes: make("likes", "Respeitar a indicação, o modo de uso e as recomendações da embalagem."),
      avoidTitle: "O que evitar".tr,
      avoid: make("avoid", "Oferecer a uma espécie, idade ou porte diferente do indicado."),
      tipsTitle: "Antes de usar".tr,
      tips: careTips.length ? careTips : [
        "Confira a indicação e o modo de uso no rótulo.",
        "Armazene conforme a embalagem e mantenha fora do alcance de crianças.",
        "Em caso de dúvida sobre saúde ou alimentação, consulte um médico-veterinário.",
      ],
    };
  }

  if (kind === "animal") {
    return {
      summary: values.description || `Conheça as necessidades de ${name} antes de levar para casa. Espaço, abrigo, alimentação e manejo variam conforme a espécie e a idade.`,
      facts: [
        { label: "Moradia".tr, icon: "mapPin", tone: "green", value: make("housing", "Prepare um abrigo seco e ventilado, protegido de chuva, sol intenso e predadores, com área de descanso e espaço para se movimentar. Prefira materiais seguros e fáceis de limpar; confirme o tamanho adequado para a espécie.") },
        { label: "Manejo".tr, icon: "heart", tone: "blue", value: make("handling", "Aproxime-se com calma e deixe o animal se acostumar ao ambiente. Confirme com a equipe a forma segura de pegar e manejar esta espécie.") },
        { label: "Alimentação e petiscos".tr, icon: "leaf", tone: "yellow", value: make("feeding", "Ofereça dieta própria para a espécie e a fase de vida. Use apenas petiscos próprios para o animal, com moderação, e confirme alimentos e quantidades com a equipe ou um veterinário.") },
        { label: "O que não oferecer".tr, icon: "shield", tone: "orange", value: make("prohibitedFood", "Não ofereça restos, plantas, medicamentos ou alimentos sem confirmar que são seguros para esta espécie.") },
      ],
      pairTitle: "Bem-estar e segurança".tr,
      likesTitle: "O que ajuda".tr,
      likes: make("likes", "Rotina tranquila, água limpa, abrigo adequado e alimentação específica para a espécie."),
      avoidTitle: "O que evitar".tr,
      avoid: make("avoid", "Mudanças bruscas de dieta, recinto apertado ou inseguro e contato sem adaptação."),
      tipsTitle: "Antes de levar para casa".tr,
      tips: careTips.length ? careTips : [
        "Confirme espécie, idade, sexo e necessidades de espaço com a equipe.",
        "Prepare o abrigo e os itens essenciais antes da chegada do animal.",
        "Para dúvidas de saúde, alimentação ou comportamento, procure um médico-veterinário.",
      ],
    };
  }

  return {
    summary: values.description || `${name}: consulte a descrição e as orientações da embalagem para escolher e usar este item da melhor forma.`,
    facts: [
      { label: "Indicação".tr, icon: "sparkle", tone: "green", value: make("usage", "Confira a finalidade e a compatibilidade deste produto antes de usar.") },
      { label: "Conservação".tr, icon: "box", tone: "blue", value: make("storage", "Guarde em local limpo e seco, seguindo as instruções do fabricante.") },
      { label: "Cuidados".tr, icon: "shield", tone: "orange", value: make("precautions", "Observe as orientações de uso e manuseio informadas na embalagem.") },
      { label: "Informações".tr, icon: "info", tone: "yellow", value: make("durability", "Nossa equipe pode ajudar a confirmar detalhes e compatibilidade.") },
    ],
    pairTitle: "Dica de compra".tr,
    likesTitle: "Pode combinar com".tr,
    likes: make("likes", "Consulte a equipe para encontrar itens complementares para sua necessidade."),
    avoidTitle: "Antes de escolher".tr,
    avoid: make("avoid", "Verifique medidas, indicação e compatibilidade com o uso pretendido."),
    tipsTitle: "Para aproveitar melhor".tr,
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
    housing: firstText(product.housing, product.moradia, product.abrigo, product.habitat_ideal, product.habitatIdeal, product.ambiente_ideal),
    handling: firstText(product.handling, product.manejo, product.comportamento, product.dicas_manejo, product.dicasManejo),
    prohibitedFood: firstText(product.prohibitedFoods, product.alimentos_proibidos, product.alimentosProibidos, product.o_que_nao_oferecer, product.oQueNaoOferecer),
    durability: firstText(product.durability, product.durabilidade, product.validade),
    usage: firstText(product.usage, product.uso, product.modo_de_uso, product.modoDeUso),
    selection: firstText(product.selectionTips, product.dica_escolha, product.dicaEscolha),
    suitability: firstText(product.suitability, product.indicacao, product.indicação, product.especie_indicada),
    likes: firstText(product.preferences, product.o_que_gosta, product.oQueGosta, product.gosta_de, product.gostaDe),
    avoid: firstText(product.dislikes, product.o_que_evitar, product.oQueEvitar, product.nao_gosta, product.naoGosta),
  };

  return categoryContent(kind, values, product);
}
