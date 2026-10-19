/**
 * Mapeamento de Fotos Reais em Alta Definição (HD) para produtos da Conflora.
 * Quando o item não tiver imagem personalizada no banco de dados, o sistema
 * busca automaticamente uma foto temática real de altíssima qualidade.
 */

const FALLBACK_HD_IMAGES = {
  // Hortifrúti, Frutas, Legumes e Raízes
  batatinha: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
  batata: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
  cebola: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80',
  'cebola roxa': 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80',
  abacate: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=800&auto=format&fit=crop&q=80',
  tomate: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
  cenoura: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800&auto=format&fit=crop&q=80',
  beterraba: 'https://images.unsplash.com/photo-1593105544559-ecb03bf76f82?w=800&auto=format&fit=crop&q=80',
  mandioca: 'https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=800&auto=format&fit=crop&q=80',
  inhame: 'https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=800&auto=format&fit=crop&q=80',
  abobora: 'https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=800&auto=format&fit=crop&q=80',
  abobrinha: 'https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?w=800&auto=format&fit=crop&q=80',
  pepino: 'https://images.unsplash.com/photo-1449300079323-02e209d9d3a6?w=800&auto=format&fit=crop&q=80',
  chuchu: 'https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?w=800&auto=format&fit=crop&q=80',
  quiabo: 'https://images.unsplash.com/photo-1425543103986-22abb7d7e8d2?w=800&auto=format&fit=crop&q=80',
  jiló: 'https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?w=800&auto=format&fit=crop&q=80',
  jilo: 'https://images.unsplash.com/photo-1596097635121-14b63b7a0c19?w=800&auto=format&fit=crop&q=80',
  berinjela: 'https://images.unsplash.com/photo-1615484477778-ca3b77940c25?w=800&auto=format&fit=crop&q=80',
  pimentao: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=800&auto=format&fit=crop&q=80',
  repolho: 'https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=800&auto=format&fit=crop&q=80',
  brocolis: 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=800&auto=format&fit=crop&q=80',
  'couve flor': 'https://images.unsplash.com/photo-1568584711075-3d021a7c3ca3?w=800&auto=format&fit=crop&q=80',
  alho: 'https://images.unsplash.com/photo-1540148426945-6cf22a6b2383?w=800&auto=format&fit=crop&q=80',
  milho: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=800&auto=format&fit=crop&q=80',
  vagem: 'https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0?w=800&auto=format&fit=crop&q=80',
  banana: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=800&auto=format&fit=crop&q=80',
  manga: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&auto=format&fit=crop&q=80',
  maca: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&auto=format&fit=crop&q=80',
  melancia: 'https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=800&auto=format&fit=crop&q=80',
  melao: 'https://images.unsplash.com/photo-1571575173700-afb9492e6a50?w=800&auto=format&fit=crop&q=80',
  mamao: 'https://images.unsplash.com/photo-1517282009859-f000ec3b26fe?w=800&auto=format&fit=crop&q=80',
  uva: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800&auto=format&fit=crop&q=80',
  morango: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&auto=format&fit=crop&q=80',
  pera: 'https://images.unsplash.com/photo-1514756331096-242fdeb70d4a?w=800&auto=format&fit=crop&q=80',
  kiwi: 'https://images.unsplash.com/photo-1585059895524-72359e06133a?w=800&auto=format&fit=crop&q=80',
  maracuja: 'https://images.unsplash.com/photo-1604495772376-9657f0035eb5?w=800&auto=format&fit=crop&q=80',
  coco: 'https://images.unsplash.com/photo-1546548970-71785318a17b?w=800&auto=format&fit=crop&q=80',
  limao: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=800&auto=format&fit=crop&q=80',
  laranja: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=800&auto=format&fit=crop&q=80',
  mexerica: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=800&auto=format&fit=crop&q=80',
  ponkan: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=800&auto=format&fit=crop&q=80',
  tangerina: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=800&auto=format&fit=crop&q=80',
  abacaxi: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=800&auto=format&fit=crop&q=80',
  mel: 'https://images.unsplash.com/photo-1587049352847-4a222e784d38?w=800&auto=format&fit=crop&q=80',
  ovo: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800&auto=format&fit=crop&q=80',
  ovos: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=800&auto=format&fit=crop&q=80',

  // Folhosas, Horta e Temperos
  alface: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=800&auto=format&fit=crop&q=80',
  rucula: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800&auto=format&fit=crop&q=80',
  agriao: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800&auto=format&fit=crop&q=80',
  espinafre: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800&auto=format&fit=crop&q=80',
  chicoria: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=800&auto=format&fit=crop&q=80',
  almeirao: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=800&auto=format&fit=crop&q=80',
  acelga: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=800&auto=format&fit=crop&q=80',
  cebolinha: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=800&auto=format&fit=crop&q=80',
  coentro: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=800&auto=format&fit=crop&q=80',
  salsa: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=800&auto=format&fit=crop&q=80',
  salsinha: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=800&auto=format&fit=crop&q=80',
  'cheiro verde': 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=800&auto=format&fit=crop&q=80',
  manjericao: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=800&auto=format&fit=crop&q=80',
  alecrim: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=800&auto=format&fit=crop&q=80',
  hortela: 'https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?w=800&auto=format&fit=crop&q=80',
  arruda: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=800&auto=format&fit=crop&q=80',
  boldo: 'https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?w=800&auto=format&fit=crop&q=80',
  babosa: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=800&auto=format&fit=crop&q=80',
  couve: 'https://images.unsplash.com/photo-1524179091875-bf99a9a6fa57?w=800&auto=format&fit=crop&q=80',
  pimenta: 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=800&auto=format&fit=crop&q=80',

  // Palmeiras e Viveiro
  'rabo de raposa': 'https://images.unsplash.com/photo-1596726596162-421712a433a0?w=800&auto=format&fit=crop&q=80',
  bismarckia: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop&q=80',
  'palmeira azul': 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop&q=80',
  areca: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&auto=format&fit=crop&q=80',
  fenix: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&auto=format&fit=crop&q=80',
  imperial: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=800&auto=format&fit=crop&q=80',
  raphis: 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=800&auto=format&fit=crop&q=80',
  rafis: 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=800&auto=format&fit=crop&q=80',
  cica: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&auto=format&fit=crop&q=80',
  palmeira: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=800&auto=format&fit=crop&q=80',

  // Frutíferas
  jabuticaba: 'https://images.unsplash.com/photo-1557800636-894a64c1696f?w=800&auto=format&fit=crop&q=80',
  amora: 'https://images.unsplash.com/photo-1568644396922-5c3bfae12521?w=800&auto=format&fit=crop&q=80',
  goiaba: 'https://images.unsplash.com/photo-1536511135899-7023c0383b48?w=800&auto=format&fit=crop&q=80',
  pitanga: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=800&auto=format&fit=crop&q=80',
  acerola: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=800&auto=format&fit=crop&q=80',
  caju: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=800&auto=format&fit=crop&q=80',
  romã: 'https://images.unsplash.com/photo-1541344999736-83eca272f6fc?w=800&auto=format&fit=crop&q=80',
  roma: 'https://images.unsplash.com/photo-1541344999736-83eca272f6fc?w=800&auto=format&fit=crop&q=80',
  figo: 'https://images.unsplash.com/photo-1601379760883-1bb497c558f0?w=800&auto=format&fit=crop&q=80',

  // Flores, Orquídeas, Folhagens & Ornamentais
  orquidea: 'https://images.unsplash.com/photo-1566938064504-a379175168b3?w=800&auto=format&fit=crop&q=80',
  phalaenopsis: 'https://images.unsplash.com/photo-1566938064504-a379175168b3?w=800&auto=format&fit=crop&q=80',
  denphal: 'https://images.unsplash.com/photo-1566938064504-a379175168b3?w=800&auto=format&fit=crop&q=80',
  cattleya: 'https://images.unsplash.com/photo-1566938064504-a379175168b3?w=800&auto=format&fit=crop&q=80',
  bouganville: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&auto=format&fit=crop&q=80',
  primavera: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&auto=format&fit=crop&q=80',
  'tres marias': 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&auto=format&fit=crop&q=80',
  'rosa do deserto': 'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=800&auto=format&fit=crop&q=80',
  rosa: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
  roseira: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
  hibisco: 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?w=800&auto=format&fit=crop&q=80',
  ixora: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&auto=format&fit=crop&q=80',
  azaleia: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&auto=format&fit=crop&q=80',
  begonia: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&auto=format&fit=crop&q=80',
  anturio: 'https://images.unsplash.com/photo-1597072689227-8882273e8f6a?w=800&auto=format&fit=crop&q=80',
  lirio: 'https://images.unsplash.com/photo-1597072689227-8882273e8f6a?w=800&auto=format&fit=crop&q=80',
  girassol: 'https://images.unsplash.com/photo-1597848212624-a19eb35e2651?w=800&auto=format&fit=crop&q=80',
  lavanda: 'https://images.unsplash.com/photo-1499002238440-d264edd596ec?w=800&auto=format&fit=crop&q=80',
  costela: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&auto=format&fit=crop&q=80',
  monstera: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&auto=format&fit=crop&q=80',
  zamioculca: 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=800&auto=format&fit=crop&q=80',
  jiboia: 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=800&auto=format&fit=crop&q=80',
  filodendro: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&auto=format&fit=crop&q=80',
  maranta: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&auto=format&fit=crop&q=80',
  calathea: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&auto=format&fit=crop&q=80',
  aglaonema: 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=800&auto=format&fit=crop&q=80',
  dracena: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=800&auto=format&fit=crop&q=80',
  croton: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=800&auto=format&fit=crop&q=80',
  ficus: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=800&auto=format&fit=crop&q=80',
  espada: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=800&auto=format&fit=crop&q=80',
  lança: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=800&auto=format&fit=crop&q=80',
  lanca: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=800&auto=format&fit=crop&q=80',
  cacto: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800&auto=format&fit=crop&q=80',
  suculenta: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800&auto=format&fit=crop&q=80',
  echeveria: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800&auto=format&fit=crop&q=80',
  jade: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800&auto=format&fit=crop&q=80',
  samambaia: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&auto=format&fit=crop&q=80',
  avenca: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&auto=format&fit=crop&q=80',
  asplenio: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&auto=format&fit=crop&q=80',
  chifre: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&auto=format&fit=crop&q=80',
  bonsai: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=800&auto=format&fit=crop&q=80',
  ipê: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&auto=format&fit=crop&q=80',
  ipe: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=800&auto=format&fit=crop&q=80',
   tuia: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=800&auto=format&fit=crop&q=80',
  pinheiro: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=800&auto=format&fit=crop&q=80',
  buxinho: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80',

  // Agromadeiras, Gramas, Vasos & Insumos
  eucalipto: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80',
  poste: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80',
  mourao: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80',
  madeira: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80',
  grama: 'https://images.unsplash.com/photo-1533460004989-acf295ce70eb?w=800&auto=format&fit=crop&q=80',
  substrato: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
  adubo: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
  fertilizante: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
  humus: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
  esterco: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
  terra: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
  casca: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
  argila: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
  pedra: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&auto=format&fit=crop&q=80',
  vaso: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&auto=format&fit=crop&q=80',
  cachepo: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&auto=format&fit=crop&q=80',
  bacia: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&auto=format&fit=crop&q=80',
  jardineira: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&auto=format&fit=crop&q=80',
  cuia: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&auto=format&fit=crop&q=80',
  prato: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&auto=format&fit=crop&q=80',
  suporte: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&auto=format&fit=crop&q=80',

  // Pets & Animais
  cabra: 'https://images.unsplash.com/photo-1524024973431-2ad916746881?w=800&auto=format&fit=crop&q=80',
  caprino: 'https://images.unsplash.com/photo-1524024973431-2ad916746881?w=800&auto=format&fit=crop&q=80',
  coelho: 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800&auto=format&fit=crop&q=80',
  porquinho: 'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop&q=80',
  hamster: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=800&auto=format&fit=crop&q=80',
  chinchila: 'https://images.unsplash.com/photo-1425082661705-1834bfd09dca?w=800&auto=format&fit=crop&q=80',
  jabuti: 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&auto=format&fit=crop&q=80',
  tartaruga: 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&auto=format&fit=crop&q=80',
  calopsita: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&auto=format&fit=crop&q=80',
  periquito: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&auto=format&fit=crop&q=80',
  agapornis: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&auto=format&fit=crop&q=80',
  canario: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&auto=format&fit=crop&q=80',
  mandarim: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&auto=format&fit=crop&q=80',
  manon: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?w=800&auto=format&fit=crop&q=80',
  ring: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&auto=format&fit=crop&q=80',
  rosela: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&auto=format&fit=crop&q=80',
  papagaio: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&auto=format&fit=crop&q=80',
  galinha: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop&q=80',
  galo: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop&q=80',
  frango: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop&q=80',
  franga: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop&q=80',
  pintinho: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop&q=80',
  codorna: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop&q=80',
  pato: 'https://images.unsplash.com/photo-1459682687441-7761439a709d?w=800&auto=format&fit=crop&q=80',
  marreco: 'https://images.unsplash.com/photo-1459682687441-7761439a709d?w=800&auto=format&fit=crop&q=80',
  ganso: 'https://images.unsplash.com/photo-1459682687441-7761439a709d?w=800&auto=format&fit=crop&q=80',
  angola: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop&q=80',
  pavao: 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?w=800&auto=format&fit=crop&q=80',
  faisao: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop&q=80',
  peru: 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop&q=80',
  gaiola: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&auto=format&fit=crop&q=80',
  viveiro: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80',
  racao: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&auto=format&fit=crop&q=80',
  alpiste: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&auto=format&fit=crop&q=80',
  painco: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=800&auto=format&fit=crop&q=80',

  // Subcategorias / Categorias Gerais
  'aves ornamentais': 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&auto=format&fit=crop&q=80',
  'aves de quintal': 'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=800&auto=format&fit=crop&q=80',
  'pequenos mamiferos': 'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=800&auto=format&fit=crop&q=80',
  repteis: 'https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=800&auto=format&fit=crop&q=80',
  'cactos e suculentas': 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800&auto=format&fit=crop&q=80',
  folhagens: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&auto=format&fit=crop&q=80',
  flores: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=800&auto=format&fit=crop&q=80',
  frutiferas: 'https://images.unsplash.com/photo-1557800636-894a64c1696f?w=800&auto=format&fit=crop&q=80',
  citricos: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=800&auto=format&fit=crop&q=80',
  hortifrutti: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
  horta: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=800&auto=format&fit=crop&q=80',
  pets: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=800&auto=format&fit=crop&q=80',
};

const DEFAULT_NURSERY_FALLBACK = 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80';

/**
 * Retorna uma foto de alta definição correspondente caso o produto não possua imagem.
 */
function resolveHdProductImage(name = '', category = '', subcategory = '') {
  const normName = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normSub = String(subcategory || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normCat = String(category || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Prioriza correspondência no nome do produto
  for (const [key, url] of Object.entries(FALLBACK_HD_IMAGES)) {
    const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (normName.includes(normKey)) {
      return url;
    }
  }

  // 2. Correspondência na subcategoria ou categoria
  const combinedMeta = `${normSub} ${normCat}`;
  for (const [key, url] of Object.entries(FALLBACK_HD_IMAGES)) {
    const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (combinedMeta.includes(normKey)) {
      return url;
    }
  }

  return DEFAULT_NURSERY_FALLBACK;
}

/**
 * Detecta se o item é comercializado por KG
 */
function isKgProduct(name = '', unit = '') {
  const norm = `${name} ${unit}`.toUpperCase();
  return (
    norm.includes(' KG') ||
    norm.endsWith('KG') ||
    norm.includes('/KG') ||
    norm.includes('QUILO') ||
    norm.includes('KILO') ||
    unit.toUpperCase() === 'KG'
  );
}

module.exports = {
  resolveHdProductImage,
  isKgProduct,
  FALLBACK_HD_IMAGES,
};
