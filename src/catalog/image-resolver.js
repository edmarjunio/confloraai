/**
 * Mapeamento de Fotos Reais em Alta Definição (HD) para produtos da Conflora.
 * Quando o item não tiver imagem personalizada no banco de dados, o sistema
 * busca automaticamente uma foto temática real de altíssima qualidade.
 */

const FALLBACK_HD_IMAGES = {
  // Hortifrúti, Legumes e Raízes
  batatinha: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
  batata: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800&auto=format&fit=crop&q=80',
  cebola: 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80',
  'cebola roxa': 'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&auto=format&fit=crop&q=80',
  abacate: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=800&auto=format&fit=crop&q=80',
  tomate: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
  cenoura: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800&auto=format&fit=crop&q=80',
  mandioca: 'https://images.unsplash.com/photo-1589927986089-35812388d1f4?w=800&auto=format&fit=crop&q=80',
  abobora: 'https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=800&auto=format&fit=crop&q=80',
  banana: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=800&auto=format&fit=crop&q=80',
  manga: 'https://images.unsplash.com/photo-1553279768-865429fa0078?w=800&auto=format&fit=crop&q=80',
  maca: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&auto=format&fit=crop&q=80',
  melancia: 'https://images.unsplash.com/photo-1587049352851-8d4e89133924?w=800&auto=format&fit=crop&q=80',
  limao: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=800&auto=format&fit=crop&q=80',
  laranja: 'https://images.unsplash.com/photo-1547514701-42782101795e?w=800&auto=format&fit=crop&q=80',
  abacaxi: 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=800&auto=format&fit=crop&q=80',

  // Folhosas, Horta e Temperos
  alface: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=800&auto=format&fit=crop&q=80',
  rucula: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800&auto=format&fit=crop&q=80',
  cebolinha: 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=800&auto=format&fit=crop&q=80',
  coentro: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=800&auto=format&fit=crop&q=80',
  salsa: 'https://images.unsplash.com/photo-1509358271058-acd22cc93898?w=800&auto=format&fit=crop&q=80',
  manjericao: 'https://images.unsplash.com/photo-1608686207856-001b95cf60ca?w=800&auto=format&fit=crop&q=80',
  alecrim: 'https://images.unsplash.com/photo-1515543237350-b3eea1ec8082?w=800&auto=format&fit=crop&q=80',
  hortela: 'https://images.unsplash.com/photo-1628556270448-4d4e4148e1b1?w=800&auto=format&fit=crop&q=80',
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

  // Frutíferas
  jabuticaba: 'https://images.unsplash.com/photo-1557800636-894a64c1696f?w=800&auto=format&fit=crop&q=80',
  amora: 'https://images.unsplash.com/photo-1568644396922-5c3bfae12521?w=800&auto=format&fit=crop&q=80',
  goiaba: 'https://images.unsplash.com/photo-1536511135899-7023c0383b48?w=800&auto=format&fit=crop&q=80',
  pitanga: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=800&auto=format&fit=crop&q=80',
  acerola: 'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=800&auto=format&fit=crop&q=80',
  caju: 'https://images.unsplash.com/photo-1590502593747-42a996133562?w=800&auto=format&fit=crop&q=80',

  // Flores & Ornamentais
  bouganville: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&auto=format&fit=crop&q=80',
  primavera: 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&auto=format&fit=crop&q=80',
  'tres marias': 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800&auto=format&fit=crop&q=80',
  'rosa do deserto': 'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=800&auto=format&fit=crop&q=80',
  costela: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&auto=format&fit=crop&q=80',
  monstera: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800&auto=format&fit=crop&q=80',
  zamioculca: 'https://images.unsplash.com/photo-1598880940371-c756e015fea1?w=800&auto=format&fit=crop&q=80',
  espada: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=800&auto=format&fit=crop&q=80',
  samambaia: 'https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=800&auto=format&fit=crop&q=80',

  // Agromadeiras, Gramas & Insumos
  eucalipto: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80',
  poste: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80',
  mourao: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80',
  madeira: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=800&auto=format&fit=crop&q=80',
  grama: 'https://images.unsplash.com/photo-1533460004989-acf295ce70eb?w=800&auto=format&fit=crop&q=80',
  substrato: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80',
  adubo: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80',
  terra: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80',

  // Animais
  cabra: 'https://images.unsplash.com/photo-1524024973431-2ad916746881?w=800&auto=format&fit=crop&q=80',
  caprino: 'https://images.unsplash.com/photo-1524024973431-2ad916746881?w=800&auto=format&fit=crop&q=80',
};

const DEFAULT_NURSERY_FALLBACK = 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80';

/**
 * Retorna uma foto de alta definição correspondente caso o produto não possua imagem.
 */
function resolveHdProductImage(name = '', category = '', subcategory = '') {
  const text = `${name} ${category} ${subcategory}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const [key, url] of Object.entries(FALLBACK_HD_IMAGES)) {
    const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (text.includes(normKey)) {
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
