const fs = require('node:fs');
const path = require('node:path');
const { normalizeKey, LOCAL_BREED_PHOTOS, TAXON_MAPPING } = require('./catalog-breed-taxon-map');
const { resolveHdProductImage } = require('../src/catalog/image-resolver');

const botSrc = fs.readFileSync(path.join(__dirname, 'resolve-botanical-inat-photos.js'), 'utf8');
const botMatch = botSrc.match(/const BOTANICAL_TAXA = (\{[\s\S]*?\n\});/);
const BOTANICAL_TAXA = eval('(' + botMatch[1] + ')');

// Specific verified photos & technical profiles for supplies, fertile eggs, cages, rations, fertilizers, and decor
const SUPPLY_PROFILES = {
  // Gaiolas
  'gaiola para hamster': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Alojamento completo com malha estreita segura, bandeja higiênica lavável e ventilação',
    usage: 'Forre a bandeja com 4 a 6 cm de maravalha seca ou substrato de papel celulose, instale bebedouro tipo bilha, comedouro pesado e roda de exercício fechada.',
    suitability: 'Hamster Sírio, Hamster Russo Anão, Topolino e pequenos roedores',
    precautions: 'Posicione em local interno arejado, protegido de sol direto, correntes de vento e acesso de cães ou gatos. Higienize a bandeja semanalmente.',
  },
  'gaiola para passarinho media': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Gaiola de arame galvanizado/epóxi porte médio com poleiros, comedouros e bandeja removível',
    usage: 'Disponha poleiros em alturas alternadas longe da vertical dos comedouros para permitir voo horizontal entre os pontos de apoio.',
    suitability: 'Canário Belga, Mandarim, Manon, Rolinha-diamante e aves canoras de pequeno porte',
    precautions: 'Mantenha suspensa em parede ou suporte firme em área coberta, iluminada pela manhã e protegida de vento frio e sereno.',
  },
  'gaiola para passarinho pequena': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Gaiola compacta de fácil transporte e higienização com bandeja plástica removível',
    usage: 'Ideal para transporte seguro, quarentena ou alojamento individual de aves de pequeno porte.',
    suitability: 'Canário, Manon, Mandarim e aves exóticas de pequeno porte',
    precautions: 'Lave a bandeja e grade de fundo diariamente e mantenha água fresca sempre limpa.',
  },
  'gaiola perequito grande': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Viveiro/gaiola espaçosa de malha reforçada para psitacídeos com bandeja coletora e portas seguras',
    usage: 'Equipe com poleiros naturais de diferentes diâmetros, brinquedos de madeira atóxica, osso de siba e comedouros de fácil acesso.',
    suitability: 'Calopsitas, Agapornis, Periquitos Australianos, Bourke Rosa e Red Rumped',
    precautions: 'Trave sempre as portinholas (psitacídeos abrem fechos simples com o bico) e posicione em local claro sem correntes de vento.',
  },
  'gaiola perequito media': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Gaiola porte médio com arame resistente a bicos curvos, poleiros e bandeja higiênica',
    usage: 'Excelente para casal de periquitos australianos, agapornis ou calopsita mansa que interage fora da gaiola.',
    suitability: 'Periquito Australiano, Agapornis, Bourke Rosa e Calopsita',
    precautions: 'Higienize poleiros e grade de piso regularmente e mantenha longe de vapores de cozinha.',
  },

  // Rações e alimentos para pets
  'mistura para canario': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Blend selecionado de sementes limpas (alpiste, colza, níger, nabão e linhaça) para aves canoras',
    usage: 'Ofereça em comedouro limpo diariamente, soprando as cascas vazias pela manhã e complementando com farinhada e água fresca.',
    suitability: 'Canário Belga, Pintassilgo, Manon, Mandarim e exóticos granívoros',
    precautions: 'Armazene em pote hermético ao abrigo de umidade, calor e luz solar.',
  },
  'racao de hamster': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Mix nutritivo balanceado com grãos, extrusados, sementes e fibras para desgaste dentário de roedores',
    usage: 'Forneça de 1 a 2 colheres de sopa por dia no comedouro de cerâmica e verifique esconderijos onde o hamster estoca comida.',
    suitability: 'Hamster Sírio, Hamster Russo Anão, Gerbil (Esquilo-da-Mongólia) e pequenos roedores',
    precautions: 'Conserve a embalagem bem vedada em local seco e fresco.',
  },
  'racao passarinhos': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Mistura selecionada de painço, alpiste e sementes energéticas para pássaros ornamentais',
    usage: 'Reponha diariamente em comedouros limpos e secos acompanhados de água filtrada fresca.',
    suitability: 'Mandarim, Manon, Periquito, Rolinha, Canário e aves ornamentais',
    precautions: 'Mantenha o saco fechado em local seco para preservar o frescor dos grãos.',
  },
  'racao para periquitos': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Mistura balanceada de painço nacional, painço milhete, alpiste e aveia descascada para psitacídeos',
    usage: 'Sirva diariamente em comedouro limpo, removendo as cascas leves da superfície para que a ave alcance os grãos.',
    suitability: 'Periquito Australiano, Agapornis, Calopsita e Bourke Rosa',
    precautions: 'Armazene em recipiente fechado livre de umidade e insetos.',
  },
  'racao girassol': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Semente de girassol selecionada rica em energia e ácidos graxos essenciais para aves e roedores',
    usage: 'Utilize como complemento energético na dieta de psitacídeos (calopsitas, rosellas, agapornis), aves de quintal e hamsters.',
    suitability: 'Calopsitas, Roselas, Papagaios, Galinhas Ornamentais e Roedores',
    precautions: 'Ofereça com moderação dentro de uma dieta balanceada devido ao alto teor energético.',
  },
  'racao frango forte': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Ração balanceada proteica enriquecida com vitaminas e minerais para desenvolvimento vigoroso de aves',
    usage: 'Forneça à vontade em comedouros cobertos para frangotes, aves caipiras, Índio Gigante, Brahma e aves ornamentais em crescimento.',
    suitability: 'Frangos caipiras, Índio Gigante, Brahma, Galinha Balão, Codornas e aves de quintal',
    precautions: 'Conserve sobre estrados em local seco e ventilado, longe do chão úmido.',
  },
  'saco de maravalha': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Flocos de madeira de pinus secos, peneirados e super absorventes para forração higiênica de gaiolas e viveiros',
    usage: 'Espalhe camada de 4 a 8 cm no fundo de gaiolas de porquinhos-da-índia, coelhos, hamsters, pintinhos e ninhos de aves.',
    suitability: 'Porquinho-da-Índia, Coelho, Hamster, Gerbil, Ouriço, Pintinhos e Aves',
    precautions: 'Remova os pontos úmidos diariamente e faça a troca total semanalmente.',
  },
  'cocho de bamblona 1 x 0 60': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Cocho/canteiro estruturado em lona de alta resistência (1,00m x 0,60m) para cultivo de horta ou manejo',
    usage: 'Excelente para montar horta suspensa de folhosas e temperos, minhocário ou cocho de alimentação em chácaras.',
    suitability: 'Cultivo de hortaliças, temperos, mudas ou manejo rural',
    precautions: 'Instale sobre base nivelada e garanta furos de drenagem caso utilizado como canteiro de plantas.',
  },
  'cocho de bamblona 2 x 0 60': {
    productType: 'merchandise',
    imageUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80',
    subtitle: 'Cocho/canteiro longo em bamblona reforçada (2,00m x 0,60m) de alta durabilidade',
    usage: 'Ideal para canteiro elevado de horta produtiva, criação de codornas/pintinhos ou cocho coletivo para pequenos animais.',
    suitability: 'Hortas suspensas, viveiros e propriedades rurais',
    precautions: 'Apoie em cavaletes ou estrutura firme distribuindo o peso uniformemente.',
  },
};

function buildBreedOrSpeciesProfile(item, inatCache) {
  const norm = normalizeKey(item.name);
  const category = String(item.category || 'Geral').trim();
  const subcategory = String(item.subcategory || '').trim();

  // 1. Check administrative / service items
  if (norm === 'troco do dia' || norm === 'recebimento' || norm === 'mao de obra' || norm === 'saldo devedor' || norm === 'taxa de entrega') {
    const img = 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80';
    return {
      productType: 'service',
      imageUrl: img,
      images: [img],
      description: `${item.name} — registro operacional e de atendimento da Conflora Horta e Viveiro em Mineiros - GO.`,
      descriptionAi: `${item.name} — item operacional da Conflora Horta e Viveiro.`,
      cuidados_basicos: 'Conferir valor, modalidade e observações do pedido antes de finalizar o lançamento no caixa.',
      ambiente_ideal: 'Uso interno operacional e financeiro da loja.',
      especificacoes: { Tipo: 'Serviço / Operacional', Categoria: category, Subcategoria: subcategory || 'Administrativo' },
      specifications: {
        tipo: { label: 'Tipo', value: 'Serviço / Operacional' },
        categoria: { label: 'Categoria', value: category },
      },
      tags: [norm, 'conflora', 'operacional'],
    };
  }

  // 2. Check fertile eggs & culinary eggs
  if (/^(ovo|ovos|cartela de ovos|cartela ovos)/.test(norm)) {
    const isFertile = subcategory.toLowerCase().includes('férteis') || /faisao|indio|pavao|peru|polonesa|sedosa|nagazaki|balao|brahma|ganso|pata/.test(norm);
    const isQuail = /codorna/.test(norm);
    const img = 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800&auto=format&fit=crop&q=80';
    const breedLabel = item.name.replace(/^(OVO DE |OVOS DE |CARTELA OVOS DE |CARTELA DE OVOS )/i, '').trim();
    if (isFertile) {
      const desc = `${item.name}: ovo fértil selecionado de matrizes saudáveis e galadas (${breedLabel}), coletado diariamente para incubação em chocadeira ou ave choca com alto índice de fertilidade.`;
      return {
        productType: 'merchandise',
        imageUrl: img,
        images: [img],
        description: desc,
        descriptionAi: desc,
        cuidados_basicos: 'Armazene com a ponta fina voltada para baixo em local fresco (15°C a 20°C) antes de iniciar a incubação; faça viragem diária e incube em até 7 dias após a coleta. Na chocadeira, mantenha 37,5°C a 37,8°C e umidade controlada.',
        ambiente_ideal: 'Local fresco, sombreado e sem trepidação antes da incubação; chocadeira calibrada ou ninho limpo e protegido.',
        dicas_armazenamento: 'Nunca coloque ovos férteis destinados à chocadeira na geladeira, pois o frio abaixo de 8°C inviabiliza o embrião.',
        durabilidade: 'Melhor taxa de eclosão quando incubado em até 7 dias após a postura (período de incubação de 17 a 28 dias conforme a espécie).',
        usage: 'Deixe os ovos descansarem por 12 horas em temperatura ambiente após o transporte antes de ligar a chocadeira.',
        suitability: `Incubação e reprodução de ${breedLabel}`,
        precautions: 'Não lave a casca com água ou detergente para não remover a cutícula protetora natural do ovo.',
        especificacoes: {
          Tipo: 'Ovo Fértil para Incubação',
          Linhagem: breedLabel,
          TemperaturaChocadeira: '37,5°C a 37,8°C',
          ArmazenamentoPreIncubacao: 'Ponta fina para baixo em local fresco (sem refrigerar)',
        },
        specifications: {
          tipo: { label: 'Tipo', value: 'Ovo Fértil para Incubação' },
          linhagem: { label: 'Raça / Espécie', value: breedLabel },
          temperatura: { label: 'Temperatura de Incubação', value: '37,5°C a 37,8°C' },
        },
        tags: [norm, 'ovo fertil', 'incubacao', 'chocadeira', normalizeKey(breedLabel)],
      };
    }
    const desc = `${item.name}: ovos frescos selecionados de casca íntegra e gema consistente, ricos em proteínas de alto valor biológico e vitaminas para receitas e refeições diárias.`;
    return {
      productType: 'produce',
      imageUrl: img,
      images: [img],
      description: desc,
      descriptionAi: desc,
      cuidados_basicos: 'Mantenha refrigerado na prateleira interna da geladeira (evite a porta devido à oscilação térmica) e lave apenas imediatamente antes do preparo.',
      ambiente_ideal: 'Geladeira nas prateleiras internas dentro da embalagem original.',
      dicas_armazenamento: 'Conserve com a ponta mais fina voltada para baixo para manter a gema centralizada e preservar o frescor por mais tempo.',
      durabilidade: isQuail ? 'Até 25 dias sob refrigeração adequada.' : 'Até 21 a 30 dias sob refrigeração constante.',
      especificacoes: {
        Tipo: isQuail ? 'Ovos de Codorna Frescos' : 'Ovos de Galinha Selecionados',
        Conservacao: 'Refrigeração nas prateleiras internas',
      },
      specifications: {
        tipo: { label: 'Tipo', value: isQuail ? 'Ovos de Codorna' : 'Ovos Frescos' },
        conservacao: { label: 'Conservação', value: 'Refrigerado na prateleira interna' },
      },
      tags: [norm, 'ovos', 'hortifrutti', 'proteina'],
    };
  }

  // 3. Check explicitly mapped supply profiles
  const supplyKey = Object.keys(SUPPLY_PROFILES).find(k => norm === k || norm.includes(k));
  if (supplyKey) {
    const sp = SUPPLY_PROFILES[supplyKey];
    const desc = `${item.name} — ${sp.subtitle}. Item selecionado pela Conflora para garantir praticidade, higiene e excelente desempenho.`;
    return {
      productType: sp.productType,
      imageUrl: sp.imageUrl,
      images: [sp.imageUrl],
      description: desc,
      descriptionAi: desc,
      cuidados_basicos: sp.usage,
      ambiente_ideal: sp.precautions,
      usage: sp.usage,
      suitability: sp.suitability,
      precautions: sp.precautions,
      dicas_armazenamento: sp.precautions,
      durabilidade: 'Alta durabilidade quando armazenado e higienizado conforme orientação.',
      especificacoes: {
        Categoria: category,
        Subcategoria: subcategory || 'Insumos e Acessórios',
        Indicacao: sp.suitability,
        ModoDeUso: sp.usage,
      },
      specifications: {
        indicacao: { label: 'Indicação', value: sp.suitability },
        uso: { label: 'Modo de uso', value: sp.usage },
      },
      tags: [norm, normalizeKey(category), normalizeKey(subcategory)],
    };
  }

  // 4. Check Living Animals (`Pets` category where not cage/ration/egg)
  const isLivingPet = category === 'Pets' && !/gaiola|racao|mistura|ovo/.test(norm);
  if (isLivingPet) {
    const localPhoto = LOCAL_BREED_PHOTOS[norm];
    const taxonEntry = TAXON_MAPPING[norm] || ['Gallus gallus domesticus', 0, item.name, 'Exemplar vivo selecionado e saudável'];
    const [q, idx, sciName, breedTrait] = taxonEntry;
    const inatPhotos = inatCache[q] || [];
    const inatPhoto = inatPhotos[idx % Math.max(1, inatPhotos.length)] || resolveHdProductImage(item.name, category, subcategory);
    const primaryUrl = localPhoto || inatPhoto;
    const images = [...new Set([primaryUrl, inatPhoto].filter(Boolean))];

    // Detailed species/breed-specific care
    let feeding = '';
    let housing = '';
    let handling = '';
    let prohibited = '';
    let matureSize = '';
    let preferences = '';
    let dislikes = '';

    if (norm.includes('porquinho da india')) {
      const isPeruvian = norm.includes('peruano');
      const isAbyssinian = norm.includes('abissinio');
      const isEnglish = norm.includes('ingles');
      feeding = 'Feno de capim (Tifton ou Coast-cross) disponível 24h por dia para desgaste dos dentes (80% da dieta), ração extrusada específica para porquinhos-da-índia enriquecida com Vitamina C e verduras verde-escuras frescas (catalonha, escarola, couve, pimentão sem sementes).';
      housing = 'Cercado amplo ou gaiola espaçosa de piso liso forrado com soft/fleece ou maravalha grossa sem pó, em ambiente interno fresco (18°C a 24°C), com tocas para descanso.';
      handling = isPeruvian
        ? 'Raça Peruano de pelagem longa e sedosa que cresce continuamente: exige escovação diária macia e aparo higiênico nas pontas posteriores para evitar nós e umidade. Segure sempre apoiando o tórax e os quartos traseiros.'
        : isAbyssinian
          ? 'Raça Abissínio famosa pelas rosetas simétricas em redemoinho na pelagem e temperamento extrovertido e curioso. Escove suavemente a favor de cada roseta 2 vezes por semana.'
          : isEnglish
            ? 'Raça Inglês (American Shorthair) de pelagem curta, lisa, densa e brilhante e temperamento extremamente calmo — ideal para famílias e iniciantes pela baixa necessidade de escovação.'
            : 'Animal dócil e vocal que vive melhor em duplas do mesmo sexo; segure sempre apoiando o peito e o quadril com as duas mãos.';
      prohibited = 'Nunca ofereça alface-iceberg, batata crua, cebola, alho, abacate, doces, pão, leite, sementes de girassol com casca ou ração de coelho/hamster.';
      matureSize = '20 a 25 cm (peso adulto entre 800 g e 1,2 kg; expectativa de vida de 5 a 8 anos)';
      preferences = 'Gosta de feno fresco à vontade, túneis e tocas, companhia da mesma espécie e folhas frescas ricas em vitamina C.';
      dislikes = 'Calor acima de 28°C, piso de grade aramada (causa pododermatite), solidão e barulhos bruscos.';
    } else if (norm.includes('coelho')) {
      const isMini = norm.includes('mini');
      feeding = 'Feno de capim Tifton à vontade 24h (essencial para o trânsito intestinal e desgaste contínuo dos dentes), ração extrusada específica para coelhos e folhas verdes escuras (rúcula, folha de cenoura, almeirão, couve).';
      housing = isMini
        ? 'Cercado interno espaçoso com tapete antiderrapante, bandeja higiênica no canto e abrigo ventilado longe do sol forte.'
        : 'Viveiro amplo, seco e sombreado com piso confortável (evitar grade de arame sem descanso) e abrigo contra chuva e vento.';
      handling = 'Nunca levante pelas orelhas; apoie sempre uma mão sob o tórax e a outra sustentando firmemente as patas traseiras e a coluna.';
      prohibited = 'Alface-americana/iceberg em excesso, batata, cebola, alho, pão, biscoitos, chocolate e sementes oleaginosas.';
      matureSize = isMini ? 'Porte Mini compacto (1,2 kg a 1,8 kg adulto)' : 'Porte Médio (2,8 kg a 4,5 kg adulto)';
      preferences = 'Feno fresco, brinquedos de roer de madeira atóxica, horários tranquilos no início da manhã e fim da tarde.';
      dislikes = 'Calor excessivo (acima de 28°C), umidade na pelagem e contenção sem apoio nas patas traseiras.';
    } else if (norm.includes('ourico')) {
      feeding = 'Ração super premium de gatos filhotes (alta proteína e gordura controlada) combinada com insetos alimentares (tenébrios/grilos), frutas seguras picadas (maçã sem semente, mamão) e água fresca.';
      housing = 'Terrário ou caixa organizadora ampla e ventilada (mínimo 80x50 cm) mantida aquecida entre 23°C e 27°C, com toca escura e roda de exercícios lisa (sem grade).';
      handling = 'Animal de hábito noturno; aproxime a mão devagar para que reconheça o seu cheiro pelo olfato antes de erguê-lo pelas laterais da barriga.';
      prohibited = 'Leite e derivados (são intolerantes à lactose), uvas, passas, abacate, alimentos cítricos, cebola e chocolate.';
      matureSize = '15 a 20 cm (350 g a 600 g adulto)';
      preferences = 'Ambiente quentinho (24°C a 26°C), toca de fleece macio, silêncio durante o dia e atividade à noite.';
      dislikes = 'Frio abaixo de 20°C (risco de tentativa de hibernação), movimentos súbitos por cima da cabeça e rodas de arame.';
    } else if (norm.includes('hamster') || norm.includes('gerbil')) {
      const isGerbil = norm.includes('gerbil');
      const isSyrian = norm.includes('sirio');
      feeding = 'Mix balanceado de sementes e extrusados para roedores, pequenos pedaços de vegetais firmes (brócolis, cenoura, pepino) 2 vezes por semana e água limpa em bebedouro bilha.';
      housing = isGerbil
        ? 'Terrário ou gaiola com base funda contendo 10 cm de maravalha + feno para escavação de túneis e banho de areia específico.'
        : 'Gaiola espaçosa com 5 a 8 cm de forração seca (maravalha peneirada ou papel), toca escura, brinquedos de madeira para roer e roda fechada.';
      handling = isSyrian
        ? 'O Hamster Sírio é estritamente territorial na vida adulta e deve viver sozinho (1 por gaiola). Manuseie no fim da tarde em local seguro.'
        : isGerbil
          ? 'O Gerbil é diurno/crepuscular, muito curioso, quase inodoro e adora viver em dupla do mesmo sexo; nunca segure pela ponta da cauda.'
          : 'Acostume o hamster à mão oferecendo petiscos na palma aberta, sem apertar e sempre próximo a uma superfície segura.';
      prohibited = 'Frutas cítricas (laranja/limão), cebola, alho, amêndoas amargas, doces, chocolate e alimentos temperados.';
      matureSize = isSyrian ? '13 a 18 cm (120 g a 160 g)' : '8 a 12 cm (45 g a 90 g)';
      preferences = 'Rodas fechadas silenciosas, rolos de papelão para roer, camada espessa de substrato para cavar.';
      dislikes = 'Gaiolas úmidas, correntes de ar frio e acordar abruptamente durante o dia.';
    } else if (norm.includes('mini cabra')) {
      feeding = 'Pastagem de capim de boa qualidade ou feno de Tifton à vontade, água limpa fresca, sal mineral específico para caprinos (sem cobre excessivo) e pequena porção de ração balanceada.';
      housing = 'Piquete cercado e ensolarado para pastejo e exercícios diários, com aprisco/abrigo coberto, seco, ventilado e elevado do solo para dormir e proteger da chuva.';
      handling = 'Ruminante extremamente dócil, inteligente e sociável; realize casqueamento preventivo periódico e mantenha vermifugação e vacinação em dia.';
      prohibited = 'Restos de comida humana, pães/massas em excesso (risco de timpanismo/acidose ruminal), plantas ornamentais tóxicas (espirradeira, comigo-ninguém-pode, azaleia).';
      matureSize = '45 a 55 cm de altura na cernelha (20 a 32 kg adulto)';
      preferences = 'Companhia de outros animais, troncos/plataformas para subir, escovação e pasto limpo e seco.';
      dislikes = 'Chuva direta, lama nos cascos e isolamento total.';
    } else if (norm.includes('jabuti')) {
      feeding = 'Dieta composta por 70% de folhas verde-escuras ricas em cálcio (couve, escarola, dente-de-leão, folha de amora, catalonha, ora-pro-nóbis), 20% legumes/flores (abóbora, cenoura ralada, flores de hibisco) e 10% frutas maduras (mamão, manga, goiaba) e proteína quinzenal.';
      housing = 'Jardim ou terrário externo espaçoso e seguro com área de sol da manhã (fundamental para síntese de Vitamina D3 e fixação de cálcio no casco), área sombreada, toca abrigada e prato raso com água limpa para beber e banhar-se.';
      handling = 'Manuseie com delicadeza apoiando o plastrão (parte inferior do casco); para filhotes, banhos mornos rasos (2 a 3 vezes por semana por 10 minutos) ajudam na hidratação e formação lisa da carapaça.';
      prohibited = 'Alface-iceberg, espinafre em excesso (ácido oxálico bloqueia cálcio), leite, pão, arroz cozido, ração de cão/gato em excesso.';
      matureSize = norm.includes('filhote') ? 'Filhote (6 a 10 cm atuais; atinge 30 a 40 cm na fase adulta)' : 'Adulto (30 a 45 cm; longevidade superior a 50 anos)';
      preferences = 'Sol direto do início da manhã, folhas de hibisco, mamão maduro e terra/grama natural (nunca piso cerâmico liso escorregadio).';
      dislikes = 'Piso liso escorregadio (prejudica as articulações), frio intenso sem abrigo e falta de luz solar natural.';
    } else if (norm.includes('cofap') || norm.includes('salsicha')) {
      feeding = 'Ração Super Premium para cães filhotes de pequeno porte dividida em 3 a 4 refeições diárias e água fresca sempre disponível.';
      housing = 'Ambiente interno acolhedor, com cama macia no nível do chão e rampas de acesso para evitar saltos de sofás e camas (proteção da coluna vertebral longa característica da raça Dachshund).';
      handling = 'Ao pegar no colo, apoie SEMPRE o peito com uma mão e o quadril/traseira com a outra para manter a coluna reta. Mantenha o protocolo vacinal (V8/V10 e antirrábica) e vermifugação em dia.';
      prohibited = 'Chocolate, cebola, alho, uva, uva-passa, abacate, xilitol, ossos cozidos de aves e alimentos gordurosos.';
      matureSize = 'Porte Pequeno / Standard (peso adulto entre 5 kg e 9 kg; altura de 20 a 25 cm)';
      preferences = 'Brinquedos de enriquecimento olfativo, passeios em piso plano após completar as vacinas e companhia da família.';
      dislikes = 'Escadas íngremes, saltos de lugares altos e sobrepeso.';
    } else if (subcategory.includes('Aves ornamentais')) {
      const isPsita = /calopsita|agaporne|periquito|bourke|red rumped|rosela/.test(norm);
      const isColumb = /rolinha|pomba|pombo/.test(norm);
      feeding = isPsita
        ? 'Ração extrusada específica para psitacídeos (base da dieta) complementada com mistura de sementes limpas (painço, alpiste, aveia), osso de siba (fonte de cálcio) e vegetais frescos (couve, brócolis, jiló, milho verde cozido sem sal).'
        : isColumb
          ? 'Mistura de grãos pequenos e sementes (painço, quirera fina de milho, sorgo, trigo mourisco, alpiste), grit mineral digestivo com cálcio e água limpa diária.'
          : 'Mistura selecionada de alpiste e painços, farinhada proteica na época de muda/reprodução, grit mineral/osso de siba e folhas verde-escuras higienizadas 2 vezes por semana.';
      housing = isPsita
        ? 'Viveiro ou gaiola ampla de malha horizontal resistente, poleiros de madeira natural em diâmetros variados e brinquedos de roer em local iluminado sem vento.'
        : 'Viveiro ou gaiola espaçosa em local claro, arejado, protegido de correntes de vento frio, chuva e predadores.';
      handling = `Exemplar de ${item.name} (${breedTrait}). Troque a água diariamente, higienize poleiros e bandeja regularmente e respeite o período de sono noturno (10 a 12 horas de escuro e silêncio).`;
      prohibited = 'Abacate (altamente tóxico para todas as aves), chocolate, sementes de maçã/pera, cebola, alho, café, sal, alimentos temperados e vapores de panelas antiaderentes superaquecidas.';
      matureSize = isPsita ? '18 a 32 cm conforme a espécie (longevidade de 10 a 20 anos)' : '11 a 28 cm conforme a espécie (longevidade de 6 a 14 anos)';
      preferences = 'Banho de sol matinal suave (com área de sombra no viveiro), banheira rasa com água fresca em dias quentes e poleiros naturais.';
      dislikes = 'Correntes de vento frio no peito, fumaça/odores químicos fortes e umidade no fundo da gaiola.';
    } else {
      // Aves de quintal (Brahma, Sedosa, Polonesa, Sebright, Mini Cochim, Nagasaki, Índio Gigante, Balão, Codornas, Patos, Marrecos, Gansos, Perus, Angola)
      const isChick = /pintinho|ate 1 mes|filhote/.test(norm);
      const isWaterfowl = /pato|pata|marreco|ganso/.test(norm);
      const isQuail = /codorna/.test(norm);
      feeding = isChick
        ? 'Ração inicial para pintinhos (20% a 22% de proteína bruta) sempre seca e limpa em comedouro tipo bandeja/tubular e água fresca limpa em bebedouro com borda rasa (adicione pedrinhas limpas na borda nos primeiros dias para evitar que o pintinho se molhe).'
        : isQuail
          ? 'Ração específica para codornas (postura 20-22% PB enriquecida com cálcio para fêmeas adultas ou crescimento 24% PB para jovens), água fresca constante e verduras picadas.'
          : isWaterfowl
            ? 'Ração balanceada para aves, milho/grãos, pastagem verde macia à vontade, hortaliças e água limpa constante com profundidade suficiente para submergir o bico e limpar as narinas.'
            : 'Ração balanceada de crescimento ou postura conforme a idade, grãos selecionados (milho triturado/sorgo), verduras frescas, pasto e fonte de cálcio (farinha de ostra/calcário calcítico para fêmeas em postura).';
      housing = isChick
        ? 'Pinteiro protegido de vento e umidade, forrado com maravalha seca e equipado com fonte de aquecimento controlada (lâmpada cerâmica ou campânula a 32°C na 1ª semana, reduzindo 2°C por semana até o empenamento).'
        : isWaterfowl
          ? 'Piquete gramado sombreado com abrigo seco para pernoite e tanque/bacia de água limpa para higiene da plumagem.'
          : 'Galinheiro/viveiro coberto, seco, bem ventilado sem vento encanado, com cama de maravalha seca (especialmente importante para raças de pés emplumados como Brahma e Mini Cochim e plumagem felpuda como Sedosa e Polonesa), poleiros arredondados e ninhos limpos.';
      handling = `${breedTrait}. Mantenha água fresca na sombra, calendário de vermifugação e vacinação preventiva em dia e manejo calmo.`;
      prohibited = 'Ração mofada ou úmida (risco de micotoxinas), abacate, batata crua verde, alimentos salgados ou condimentados e água parada suja.';
      matureSize = norm.includes('indio gigante')
        ? 'Porte Gigante (machos adultos de 95 a 115 cm de envergadura/estatura e 4,5 a 6,5 kg; fêmeas de 80 a 95 cm)'
        : norm.includes('brahma') || norm.includes('balao')
          ? 'Porte Grande / Gigante (3,5 kg a 5,5 kg na fase adulta)'
          : norm.includes('galize') || norm.includes('cochim') || norm.includes('nagazaki') || norm.includes('sebright')
            ? 'Porte Mini / Bantam Ornamental (500 g a 900 g na fase adulta)'
            : isQuail
              ? 'Porte Pequeno (120 g a 320 g conforme a espécie/linhagem)'
              : 'Porte Médio a Grande conforme padrão da raça';
      preferences = 'Cama seca e limpa, banho de areia/cinza para higiene natural das penas, sol da manhã e pasto verde.';
      dislikes = 'Lama nos pés (prejudica as penas dos tarsos em Brahma e Mini Cochim e o topete de Sedosa e Polonesa), umidade e superlotação.';
    }

    const fullDesc = `${item.name} (${sciName}) — ${breedTrait}. Exemplar vivo selecionado pela Conflora Horta e Viveiro com excelente padrão sanitário, vitalidade e acompanhamento de manejo.`;
    return {
      productType: 'animal',
      imageUrl: primaryUrl,
      images,
      description: fullDesc,
      descriptionAi: fullDesc,
      cuidados_basicos: handling,
      careInstructions: handling,
      ambiente_ideal: housing,
      housing,
      alimentacao: feeding,
      feeding,
      manejo: handling,
      handling,
      alimentos_proibidos: prohibited,
      prohibitedFoods: prohibited,
      preferences,
      dislikes,
      matureSize,
      especificacoes: {
        EspecieRaca: sciName,
        CaracteristicaRacial: breedTrait,
        Alimentacao: feeding,
        RecintoIdeal: housing,
        Manejo: handling,
        AlimentosProibidos: prohibited,
        PorteAdulto: matureSize,
      },
      specifications: {
        especie: { label: 'Espécie / Raça', value: sciName },
        caracteristica: { label: 'Padrão da Raça', value: breedTrait },
        alimentacao: { label: 'Alimentação', value: feeding },
        moradia: { label: 'Onde deixar / moradia', value: housing },
        manejo: { label: 'Cuidados e manejo', value: handling },
        proibidos: { label: 'Alimentos proibidos', value: prohibited },
        porte: { label: 'Porte / Fase', value: matureSize },
      },
      tags: [norm, normalizeKey(sciName), normalizeKey(subcategory), 'animal vivo', 'pets conflora'],
    };
  }

  // 5. Check Hortifrutti & Horta fresh produce (sold in KG or fresh bunches/coco/mel)
  const isFreshProduce =
    category === 'Hortifrutti' ||
    (category === 'Horta' && !norm.startsWith('muda de'));

  if (isFreshProduce) {
    const taxonEntry = BOTANICAL_TAXA[norm] || ['Lactuca sativa', 0, item.name, 'Produto fresco selecionado na horta e feira da Conflora'];
    const [q, idx, sciName, note] = taxonEntry;
    const inatPhotos = inatCache[q] || [];
    const primaryUrl = inatPhotos[idx % Math.max(1, inatPhotos.length)] || resolveHdProductImage(item.name, category, subcategory);

    const isHoney = norm.includes('mel');
    const isRootOrBulb = /alho|cebola|batata|abobora|cabotia/.test(norm);
    const isLeafy = /alface|rucula|agriao|espinafre|acelga|almeirao|couve|mostarda|cheiro verde|salsa|cebolinha|coentro|hortela|manjericao|boldo/.test(norm);

    const storage = isHoney
      ? 'Conserve o pote bem fechado em local seco, fresco e ao abrigo da luz solar direta (não precisa de geladeira; caso cristalize no frio, aqueça suavemente em banho-maria até 40°C).'
      : isRootOrBulb
        ? 'Armazene em cesto arejado, seco e escuro fora da geladeira. Após descascar ou cortar, guarde em pote hermético refrigerado.'
        : isLeafy
          ? 'Higienize as folhas em água corrente, seque bem em centrífuga ou papel-toalha e armazene em pote ou saco fechado forrado com papel-toalha seco na gaveta inferior da geladeira.'
          : 'Conserve em local fresco ou na gaveta de legumes da geladeira; higienize em água corrente antes do consumo.';

    const durability = isHoney
      ? 'Validade prolongada (acima de 12 meses fechado em local seco e fresco).'
      : isRootOrBulb
        ? 'De 15 a 30 dias em local seco, fresco e ventilado.'
        : isLeafy
          ? 'De 4 a 7 dias sob refrigeração em recipiente seco forrado com papel absorvente.'
          : 'De 7 a 12 dias sob refrigeração adequada.';

    const fullDesc = `${item.name} (${sciName}) — ${note}. Selecionado diariamente na Conflora Horta e Viveiro para garantir frescor, sabor e alto valor nutricional na sua mesa.`;
    return {
      productType: 'produce',
      imageUrl: primaryUrl,
      images: [primaryUrl],
      description: fullDesc,
      descriptionAi: fullDesc,
      cuidados_basicos: storage,
      careInstructions: storage,
      ambiente_ideal: isRootOrBulb || isHoney ? 'Local fresco, seco e arejado, protegido do sol.' : 'Refrigeração na gaveta de legumes/folhosas da geladeira.',
      dicas_armazenamento: storage,
      storageTips: storage,
      durabilidade: durability,
      durability,
      selectionTips: note,
      especificacoes: {
        Origem: sciName,
        Caracteristicas: note,
        Conservacao: storage,
        DurabilidadeMedia: durability,
        UnidadeVenda: item.unit || 'UN',
      },
      specifications: {
        especie: { label: 'Identificação', value: sciName },
        caracteristicas: { label: 'Qualidade e Seleção', value: note },
        conservacao: { label: 'Armazenamento', value: storage },
        durabilidade: { label: 'Durabilidade média', value: durability },
      },
      tags: [norm, normalizeKey(sciName), normalizeKey(category), normalizeKey(subcategory), 'fresco', 'hortifrutti'],
    };
  }

  // 6. Check Gardening Supplies, Substrates, Fertilizers, Pots, Stones (`Insumos e acessórios`, `Adubos e fertilizantes`, `Jardinagem e cultivo`, `Vasos e decoração`)
  const isSupplyOrDecor =
    subcategory === 'Insumos e acessórios' ||
    category === 'Outros' && !norm.includes('grama esmeralda');

  if (isSupplyOrDecor && !BOTANICAL_TAXA[norm]) {
    const primaryUrl = resolveHdProductImage(item.name, category, subcategory);
    const isFertilizer = subcategory.includes('Adubos') || /npk|forth|osmocote|farinha de osso|fertilizante|humus/.test(norm);
    const isSubstrate = /substrato|terra|casca|argila|fibra|xaxim|musgo/.test(norm);
    const isDecorOrPot = /vaso|cuia|floreira|fonte|barro|suporte|corrente|prateleira|bandeja|pazinha|delimitador|manta|pedra/.test(norm);

    const subtitle = isFertilizer
      ? 'Nutrição balanceada de alta eficiência para estimular enraizamento, folhagem vigorosa, floração e frutificação'
      : isSubstrate
        ? 'Insumo selecionado com estrutura física aerada, excelente drenagem e retenção equilibrada de umidade para as raízes'
        : 'Item de jardinagem, paisagismo e acabamento com alta resistência para vasos, canteiros e áreas externas ou internas';

    const usage = isFertilizer
      ? 'Aplique na borda do vaso ou projeção da copa (nunca encostado diretamente no caule) sobre o substrato úmido e regue em seguida conforme a dosagem recomendada para o porte da planta.'
      : isSubstrate
        ? 'Utilize puro ou na composição do preparo de vasos, canteiros e covas de plantio, garantindo camada de drenagem no fundo do recipiente.'
        : 'Posicione em base firme e nivelada; em vasos e floreiras, certifique-se de manter os furos inferiores de drenagem desobstruídos.';

    const fullDesc = `${item.name} — ${subtitle}. Produto validado no catálogo técnico da Conflora Horta e Viveiro.`;
    return {
      productType: 'merchandise',
      imageUrl: primaryUrl,
      images: [primaryUrl],
      description: fullDesc,
      descriptionAi: fullDesc,
      cuidados_basicos: usage,
      careInstructions: usage,
      ambiente_ideal: isFertilizer || isSubstrate
        ? 'Armazenar a embalagem fechada em local coberto, seco e ventilado, protegido de chuva e sol direto.'
        : 'Adequado para uso em ambientes internos, varandas e jardins externos.',
      usage,
      dicas_armazenamento: 'Conserve em local seco e protegido de intempéries quando fora de uso.',
      durabilidade: isDecorOrPot ? 'Alta durabilidade em uso contínuo.' : 'Indeterminada enquanto mantido seco na embalagem original.',
      suitability: isFertilizer ? 'Nutrição de plantas ornamentais, hortaliças e frutíferas' : 'Plantio, manutenção de vasos e paisagismo',
      precautions: isFertilizer ? 'Não exceda a dosagem recomendada e mantenha fora do alcance de crianças e animais domésticos.' : 'Manuseie com cuidado durante a montagem do vaso ou canteiro.',
      especificacoes: {
        Categoria: category,
        Subcategoria: subcategory,
        Finalidade: subtitle,
        ModoDeUso: usage,
      },
      specifications: {
        finalidade: { label: 'Finalidade', value: subtitle },
        uso: { label: 'Modo de uso', value: usage },
      },
      tags: [norm, normalizeKey(category), normalizeKey(subcategory), 'jardinagem', 'insumos'],
    };
  }

  // 7. Botanical Plants, Seedlings, Fruit Trees, Flowers, Foliage, Ferns, Palms, Orchids, Succulents
  const taxonEntry = BOTANICAL_TAXA[norm] || ['Monstera deliciosa', 0, item.name, 'Muda/planta selecionada e aclimatada no viveiro Conflora'];
  const [q, idx, sciName, cultivarNote] = taxonEntry;
  const inatPhotos = inatCache[q] || [];
  const primaryUrl = inatPhotos[idx % Math.max(1, inatPhotos.length)] || resolveHdProductImage(item.name, category, subcategory);

  // Determine specific botanical care by group
  const isSucculentOrCactus = subcategory.includes('Cactos') || /rosa do deserto|cact|suculenta|jade|sedum|rabo de macaco|flor de maio|babosa/.test(norm);
  const isShadeFoliageOrFern = subcategory.includes('Folhagens') || subcategory.includes('Samambaias') || subcategory.includes('Orquídeas') || /maranta|calathea|calateia|aglaonema|zamioculca|lirio da paz|anturio|violeta|begonia|jiboia|filodendro|monstera|costela|peperomia|peperonia|avenca|samambaia|asplenio|chifre de veado|rafia|licuala/.test(norm);
  const isFullSunCrotonOrPalm = /croton|palmeira azul|rabo de raposa|cyka|bismarckia|carpentaria/.test(norm);
  const isFruitTree = category === 'Frutífera' || subcategory.includes('Frutíferas') || subcategory.includes('Cerrado');
  const isVegetableOrHerb = subcategory.includes('Hortaliças') || subcategory.includes('Ervas') || category === 'Horta';

  let light = 'Sol pleno (4 a 6 horas diárias de luz solar direta)';
  let watering = 'Regas regulares mantendo o solo levemente úmido, sem encharcar.';
  let idealEnv = 'Jardins externos, quintais, pomares ou varandas ensolaradas.';
  let basicCare = 'Plante em substrato fértil e bem drenado e realize adubação periódica a cada 45 a 60 dias.';
  let preferences = 'Solo rico em matéria orgânica, boa drenagem e ventilação natural.';
  let dislikes = 'Encharcamento contínuo nas raízes e falta de drenagem no fundo do vaso.';
  let toxicity = 'Segura para cultivo ornamental padrão; evite ingestão de partes ornamentais por pets.';

  if (isSucculentOrCactus) {
    const isEpiphyte = /flor de maio|macarrao/.test(norm);
    light = isEpiphyte
      ? 'Meia-sombra ou luz solar filtrada suave da manhã (2 a 3 horas)'
      : 'Sol pleno intenso (mínimo de 4 a 6 horas de sol direto por dia para manter formato compacto e estimular floração)';
    watering = 'Rega espaçada: regue abundantemente apenas quando o substrato estiver completamente seco até o fundo do vaso (a cada 7 a 12 dias no verão e 15 a 20 dias no inverno).';
    idealEnv = isEpiphyte
      ? 'Varandas cobertas iluminadas, cestos pendentes ou sob copa de árvores.'
      : 'Locais ensolarados, parapeitos de janelas voltadas para o norte/leste, varandas abertas e jardins de pedras.';
    basicCare = 'Exige substrato mineral arenoso de drenagem rápida (Substrato para Cactos/Rosa do Deserto com casca de arroz carbonizada e areia grossa) e adubação rica em fósforo e potássio (Forth Rosa do Deserto / Cactos).';
    preferences = 'Sol abundante, calor, vasos com excelente drenagem (preferencialmente bacias ou vasos de barro) e baixa umidade nas raízes.';
    dislikes = 'Excesso de água, prato acumulando água sob o vaso, sombra escura (causa estiolamento) e geadas.';
    if (/rosa do deserto/.test(norm)) {
      toxicity = 'Seiva leitosa tóxica se ingerida por cães, gatos ou crianças — lave as mãos após podar.';
    }
  } else if (isShadeFoliageOrFern && !isFullSunCrotonOrPalm) {
    const isOrchid = subcategory.includes('Orquídeas') || /orquidea|phalaenopolis|vanda/.test(norm);
    const isFern = subcategory.includes('Samambaias') || /samambaia|samabaia|avenca|asplenio|chifre/.test(norm);
    const isZamioculcaOrEspada = /zamioculca|espada de sao jorge/.test(norm);

    light = isOrchid
      ? 'Claridade difusa abundante / meia-sombra (50% a 70% de sombreamento, sem sol forte do meio-dia nas folhas)'
      : 'Meia-sombra ou luz indireta brilhante (ambiente interno bem iluminado ou varanda protegida do sol forte)';
    watering = isZamioculcaOrEspada
      ? 'Rega moderada a espaçada: regue apenas quando o substrato estiver seco ao toque (a cada 7 a 12 dias), pois acumula água nos rizomas.'
      : isOrchid
        ? 'Regue as raízes quando estiverem esbranquiçadas/secas (2 a 3 vezes por semana em dias quentes), evitando acumular água no miolo das folhas.'
        : isFern
          ? 'Regas frequentes mantendo o substrato sempre levemente úmido e fresco (nunca esturricado), borrifando água nas frondes em dias secos.'
          : 'Regue de 2 a 3 vezes por semana mantendo o substrato levemente úmido ao toque, sem deixar água acumulada no pratinho.';
    idealEnv = isFern
      ? 'Varandas sombreadas, áreas gourmet protegidas do vento forte, pergolados ou salas claras com boa umidade do ar.'
      : 'Ambientes internos iluminados (salas, escritórios, halls), varandas cobertas e jardins de inverno.';
    basicCare = isOrchid
      ? 'Cultive em substrato próprio para orquídeas (casca de pinus tratada, carvão e musgo esfagno) ou cachepô suspenso no caso da Vanda, adubando quinzenalmente.'
      : 'Mantenha em substrato rico em matéria orgânica e poroso (Terra Vegetal + Carolina Soil + Húmus), limpe as folhas com pano úmido e adube a cada 30 a 45 dias.';
    preferences = 'Luz indireta generosa, umidade atmosférica agradável, temperaturas amenas (18°C a 29°C) e proteção contra vento encanado.';
    dislikes = 'Sol direto das 10h às 16h (queima as folhas), vento forte (resseca as bordas foliares) e ar-condicionado direto sobre a planta.';
    if (/comigo ninguem pode|alocasia|costela|monstera|jiboia|filodendro|anturio|lirio da paz|singonio|caladium|zamioculca/.test(norm)) {
      toxicity = 'Contém oxalato de cálcio (Araceae) — mantenha fora do alcance de cães, gatos e crianças pequenas que costumam mastigar folhas.';
    } else {
      toxicity = 'Planta segura para ambientes internos (Marantas, Calatheas, Peperômias, Palmeiras Areca/Ráfia, Orquídeas e Samambaias verdadeiras são Pet Friendly).';
    }
  } else if (isFruitTree) {
    light = 'Sol pleno direto (mínimo de 6 horas de sol por dia para florescimento abundante e frutos doces)';
    watering = /jabuticaba|abiu|cupuacu|mangustao|acai/.test(norm)
      ? 'Gosta de regas generosas e regulares, especialmente na época de florada e formação dos frutos, mantendo o solo fresco e úmido.'
      : 'Regas regulares nos primeiros meses após o plantio até o pleno enraizamento; após estabelecida, regar 2 a 3 vezes por semana em períodos de seca.';
    idealEnv = 'Pomares, quintais, chácaras ou vasos grandes (mínimo de 40 a 60 litros) posicionados a pleno sol.';
    basicCare = 'Prepare cova de 40x40x40 cm enriquecida com terra vegetal, húmus de minhoca/esterco curtido e adubo fosfatado; faça podas de formação e limpeza anual após a colheita.';
    preferences = 'Sol pleno o dia inteiro, cobertura morta (casca de pinus ou folhas secas) ao redor da base para conservar a umidade e adubação orgânica + NPK de frutificação.';
    dislikes = 'Sombra densa (reduz drasticamente a produção de frutos) e solos compactados ou alagados.';
  } else if (isVegetableOrHerb) {
    light = 'Sol pleno (4 a 6 horas de sol direto por dia, preferencialmente o sol da manhã)';
    watering = 'Regas diárias suaves (no início da manhã ou final da tarde), mantendo o substrato fresco e úmido sem encharcar as folhas.';
    idealEnv = 'Canteiros de horta, jardineiras, vasos na varanda ensolarada ou bancadas iluminadas.';
    basicCare = 'Transplante para substrato rico em húmus de minhoca e composto orgânico; colha sempre as folhas externas ou pontas para estimular novas brotações.';
    preferences = 'Substrato fértil e solto, colheitas frequentes de ponteira e adubação orgânica quinzenal.';
    dislikes = 'Falta de água em dias quentes (provoca murcha e pendoamento precoce nas folhosas) e sombra excessiva.';
  }

  const fullDesc = `${item.name} (${sciName}) — ${cultivarNote}. Exemplar selecionado, enraizado e aclimatado no viveiro da Conflora em Mineiros - GO.`;
  return {
    productType: 'plant',
    imageUrl: primaryUrl,
    images: [primaryUrl],
    description: fullDesc,
    descriptionAi: fullDesc,
    cuidados_basicos: `${basicCare} ${watering}`,
    careInstructions: `${basicCare} ${watering}`,
    ambiente_ideal: idealEnv,
    iluminacao: light,
    illumination: light,
    rega: watering,
    watering,
    preferences,
    dislikes,
    precautions: toxicity,
    botanical: {
      scientificName: sciName,
      commonNames: [item.name],
      light,
      watering,
      environment: idealEnv,
      petSafety: toxicity,
      careSummary: basicCare,
    },
    especificacoes: {
      NomeCientifico: sciName,
      Variedade: cultivarNote,
      Iluminacao: light,
      Rega: watering,
      AmbienteIdeal: idealEnv,
      SegurancaPets: toxicity,
    },
    specifications: {
      cientifico: { label: 'Nome Científico', value: sciName },
      variedade: { label: 'Características', value: cultivarNote },
      iluminacao: { label: 'Iluminação', value: light },
      rega: { label: 'Rega', value: watering },
      ambiente: { label: 'Ambiente ideal', value: idealEnv },
      pets: { label: 'Segurança para Pets', value: toxicity },
    },
    tags: [norm, normalizeKey(sciName), normalizeKey(category), normalizeKey(subcategory), 'conflora'],
  };
}

module.exports = { buildBreedOrSpeciesProfile, normalizeKey };
