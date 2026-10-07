const path = require('node:path');
const { Firestore } = require('@google-cloud/firestore');

// Extracted from the Conflora official 133-page PDF catalog
const FULL_CATALOG = [
  // --- HORTIFRUTTI ---
  { name: 'ABACATE KG', category: 'Hortifrutti', subcategory: 'Frutas', price: 8.99, stock: 40, images: ['https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600'] },
  { name: 'ABACAXI', category: 'Hortifrutti', subcategory: 'Frutas', price: 8.99, stock: 35, images: ['https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=600'] },
  { name: 'ABOBRINHA KG', category: 'Hortifrutti', subcategory: 'Legumes e raízes', price: 10.99, stock: 50, images: ['https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=600'] },
  { name: 'ALHO KG', category: 'Hortifrutti', subcategory: 'Temperos e condimentos', price: 34.99, stock: 25, images: ['https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=600'] },
  { name: 'ALHO PORÓ', category: 'Hortifrutti', subcategory: 'Temperos e condimentos', price: 10.00, stock: 30, images: ['https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=600'] },
  { name: 'BANANA DA TERRA KG', category: 'Hortifrutti', subcategory: 'Frutas', price: 8.99, stock: 45, images: ['https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600'] },
  { name: 'BANANA MAÇÃ KG', category: 'Hortifrutti', subcategory: 'Frutas', price: 9.99, stock: 40, images: ['https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600'] },
  { name: 'BANANA NANICA KG', category: 'Hortifrutti', subcategory: 'Frutas', price: 4.99, stock: 60, images: ['https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600'] },
  { name: 'BANANA PRATA KG', category: 'Hortifrutti', subcategory: 'Frutas', price: 5.99, stock: 50, images: ['https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600'] },
  { name: 'BATATA DOCE KG', category: 'Hortifrutti', subcategory: 'Legumes e raízes', price: 9.99, stock: 70, images: ['https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=600'] },
  { name: 'BATATINHA KG', category: 'Hortifrutti', subcategory: 'Legumes e raízes', price: 10.99, stock: 80, images: ['https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=600'] },
  { name: 'BETERRABA KG', category: 'Hortifrutti', subcategory: 'Legumes e raízes', price: 10.99, stock: 50, images: ['https://images.unsplash.com/photo-1528750997573-59b89d56f4f7?w=600'] },
  { name: 'BRÓCOLIS', category: 'Hortifrutti', subcategory: 'Verduras', price: 10.00, stock: 30, images: ['https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600'] },
  { name: 'BRÓCOLIS KG', category: 'Hortifrutti', subcategory: 'Verduras', price: 14.00, stock: 25, images: ['https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=600'] },
  { name: 'CABOTIÁ KG', category: 'Hortifrutti', subcategory: 'Legumes e raízes', price: 7.99, stock: 40, images: ['https://images.unsplash.com/photo-1570586437263-ab629fccc818?w=600'] },
  { name: 'CARTELA DE OVOS 12 OVOS', category: 'Hortifrutti', subcategory: 'Ovos', price: 12.00, stock: 40, images: ['https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600'] },
  { name: 'CARTELA DE OVOS 30 OVOS', category: 'Hortifrutti', subcategory: 'Ovos', price: 35.00, stock: 30, images: ['https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=600'] },
  { name: 'CEBOLA KG', category: 'Hortifrutti', subcategory: 'Temperos e condimentos', price: 7.99, stock: 65, images: ['https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=600'] },
  { name: 'CEBOLA ROXA KG', category: 'Hortifrutti', subcategory: 'Temperos e condimentos', price: 7.99, stock: 50, images: ['https://images.unsplash.com/photo-1620574387735-3624d75b2def?w=600'] },
  { name: 'CENOURA KG', category: 'Hortifrutti', subcategory: 'Legumes e raízes', price: 13.99, stock: 60, images: ['https://images.unsplash.com/photo-1598170845058-32b9d6a5c317?w=600'] },
  { name: 'CHUCHU KG', category: 'Hortifrutti', subcategory: 'Legumes e raízes', price: 8.99, stock: 45, images: ['https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=600'] },
  { name: 'CÔCO SECO KG', category: 'Hortifrutti', subcategory: 'Frutas', price: 11.90, stock: 35, images: ['https://images.unsplash.com/photo-1544476915-ed1370594142?w=600'] },
  { name: 'JILÓ KG', category: 'Hortifrutti', subcategory: 'Legumes e raízes', price: 11.99, stock: 30, images: ['https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=600'] },
  { name: 'LARANJA KG', category: 'Hortifrutti', subcategory: 'Frutas', price: 9.99, stock: 80, images: ['https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=600'] },
  { name: 'LIMÃO', category: 'Hortifrutti', subcategory: 'Frutas', price: 7.99, stock: 90, images: ['https://images.unsplash.com/photo-1533082879395-659e83d327d0?w=600'] },
  { name: 'MAÇÃ KG', category: 'Hortifrutti', subcategory: 'Frutas', price: 7.99, stock: 60, images: ['https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=600'] },
  { name: 'MARACUJÁ KG', category: 'Hortifrutti', subcategory: 'Frutas', price: 14.99, stock: 40, images: ['https://images.unsplash.com/photo-1589533610925-1cffc309ebaa?w=600'] },
  { name: 'MELANCIA KG', category: 'Hortifrutti', subcategory: 'Frutas', price: 3.99, stock: 75, images: ['https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=600'] },
  { name: 'POTE DE MEL (P)', category: 'Hortifrutti', subcategory: 'Mel e derivados', price: 39.00, stock: 20, images: ['https://images.unsplash.com/photo-1587049352847-4a222e784d38?w=600'] },
  { name: 'POTE DE MEL (M)', category: 'Hortifrutti', subcategory: 'Mel e derivados', price: 69.00, stock: 15, images: ['https://images.unsplash.com/photo-1587049352847-4a222e784d38?w=600'] },
  { name: 'POTE DE MEL (G)', category: 'Hortifrutti', subcategory: 'Mel e derivados', price: 98.00, stock: 10, images: ['https://images.unsplash.com/photo-1587049352847-4a222e784d38?w=600'] },
  { name: 'QUIABO KG', category: 'Hortifrutti', subcategory: 'Legumes e raízes', price: 9.99, stock: 40, images: ['https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=600'] },
  { name: 'REPOLHO KG', category: 'Hortifrutti', subcategory: 'Verduras', price: 3.99, stock: 50, images: ['https://images.unsplash.com/photo-1594282486552-05b4d80fbb9f?w=600'] },
  { name: 'TOMATE SALADETE KG', category: 'Hortifrutti', subcategory: 'Legumes e raízes', price: 10.99, stock: 70, images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600'] },
  { name: 'VAGEM', category: 'Hortifrutti', subcategory: 'Legumes e raízes', price: 23.99, stock: 25, images: ['https://images.unsplash.com/photo-1590165482129-1b8b27698780?w=600'] },

  // --- HORTA ---
  { name: 'ALFACE CABEÇA / AMERICANA', category: 'Horta', subcategory: 'Folhosas', price: 8.00, stock: 60, images: ['https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?w=600'] },
  { name: 'ALFACE CRESPA', category: 'Horta', subcategory: 'Folhosas', price: 8.00, stock: 70, images: ['https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600'] },
  { name: 'ALFACE ROXA', category: 'Horta', subcategory: 'Folhosas', price: 8.00, stock: 40, images: ['https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=600'] },
  { name: 'ALMEIRÃO', category: 'Horta', subcategory: 'Folhosas', price: 8.00, stock: 35, images: ['https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600'] },
  { name: 'CEBOLINHA', category: 'Horta', subcategory: 'Temperos e ervas', price: 8.00, stock: 80, images: ['https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600'] },
  { name: 'CHEIRO VERDE', category: 'Horta', subcategory: 'Temperos e ervas', price: 8.00, stock: 65, images: ['https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600'] },
  { name: 'COENTRO', category: 'Horta', subcategory: 'Temperos e ervas', price: 8.00, stock: 55, images: ['https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600'] },
  { name: 'COUVE', category: 'Horta', subcategory: 'Folhosas', price: 8.00, stock: 70, images: ['https://images.unsplash.com/photo-1524179091875-bf99a9a6fa57?w=600'] },
  { name: 'ESPINAFRE', category: 'Horta', subcategory: 'Folhosas', price: 5.00, stock: 30, images: ['https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=600'] },
  { name: 'HORTELÃ', category: 'Horta', subcategory: 'Temperos e ervas', price: 8.00, stock: 45, images: ['https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600'] },
  { name: 'MANJERICÃO', category: 'Horta', subcategory: 'Temperos e ervas', price: 8.00, stock: 40, images: ['https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600'] },
  { name: 'RÚCULA', category: 'Horta', subcategory: 'Folhosas', price: 8.00, stock: 65, images: ['https://images.unsplash.com/photo-1582287104312-32a76fef7a7d?w=600'] },
  { name: 'SALSA', category: 'Horta', subcategory: 'Temperos e ervas', price: 8.00, stock: 50, images: ['https://images.unsplash.com/photo-1615485500704-8e990f9900f7?w=600'] },
  { name: 'COCO VERDE GELADO', category: 'Horta', subcategory: 'Outros de horta', price: 5.00, stock: 60, images: ['https://images.unsplash.com/photo-1544476915-ed1370594142?w=600'] },

  // --- PLANTAS / MUDAS ---
  { name: 'PALMEIRA RABO DE RAPOSA (MÉDIA)', category: 'Plantas / Mudas', subcategory: 'Palmeiras', price: 79.00, stock: 25, images: ['https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=600', 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600'] },
  { name: 'PALMEIRA RABO DE RAPOSA (GRANDE 2M)', category: 'Plantas / Mudas', subcategory: 'Palmeiras', price: 195.00, stock: 12, images: ['https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600'] },
  { name: 'PALMEIRA AZUL (BISMARCKIA)', category: 'Plantas / Mudas', subcategory: 'Palmeiras', price: 190.00, stock: 10, images: ['https://images.unsplash.com/photo-1545241047-6083a3684587?w=600'] },
  { name: 'ARECA BAMBU', category: 'Plantas / Mudas', subcategory: 'Palmeiras', price: 79.00, stock: 30, images: ['https://images.unsplash.com/photo-1599685315640-9ceab2f58944?w=600'] },
  { name: 'PALMEIRA CARPENTÁRIA', category: 'Plantas / Mudas', subcategory: 'Palmeiras', price: 190.00, stock: 8, images: ['https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=600'] },
  { name: 'PALMEIRA CYKA', category: 'Plantas / Mudas', subcategory: 'Palmeiras', price: 100.00, stock: 15, images: ['https://images.unsplash.com/photo-1545241047-6083a3684587?w=600'] },
  { name: 'PALMEIRINHA TOUCEIRA', category: 'Plantas / Mudas', subcategory: 'Palmeiras', price: 40.00, stock: 20, images: ['https://images.unsplash.com/photo-1599685315640-9ceab2f58944?w=600'] },
  { name: 'RAFIA', category: 'Plantas / Mudas', subcategory: 'Palmeiras', price: 89.00, stock: 18, images: ['https://images.unsplash.com/photo-1599685315640-9ceab2f58944?w=600'] },
  { name: 'BOUGANVILLE / PRIMAVERA', category: 'Plantas / Mudas', subcategory: 'Trepadeiras e pendentes', price: 59.00, stock: 25, images: ['https://images.unsplash.com/photo-1557429287-b2e26467fc2b?w=600', 'https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=600'] },
  { name: 'JIBOIA VERDE', category: 'Plantas / Mudas', subcategory: 'Trepadeiras e pendentes', price: 26.00, stock: 35, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'JIBOIA LIMÃO', category: 'Plantas / Mudas', subcategory: 'Trepadeiras e pendentes', price: 25.00, stock: 20, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'JIBOIA EXCLUSIVA', category: 'Plantas / Mudas', subcategory: 'Trepadeiras e pendentes', price: 190.00, stock: 5, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'DINHEIRO EM PENCA', category: 'Plantas / Mudas', subcategory: 'Trepadeiras e pendentes', price: 49.00, stock: 18, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'DÓLAR', category: 'Plantas / Mudas', subcategory: 'Trepadeiras e pendentes', price: 37.00, stock: 15, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'HERA ESTRELA', category: 'Plantas / Mudas', subcategory: 'Trepadeiras e pendentes', price: 37.00, stock: 22, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'ALOCASIA AMAZÔNICA', category: 'Plantas / Mudas', subcategory: 'Folhagens', price: 40.00, stock: 20, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'COSTELA DE ADÃO', category: 'Plantas / Mudas', subcategory: 'Folhagens', price: 79.00, stock: 15, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'CRÓTON COLORIDO', category: 'Plantas / Mudas', subcategory: 'Folhagens', price: 98.00, stock: 12, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'ESPADA DE SÃO JORGE', category: 'Plantas / Mudas', subcategory: 'Folhagens', price: 25.00, stock: 40, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'ZAMIOCULCA', category: 'Plantas / Mudas', subcategory: 'Folhagens', price: 30.00, stock: 35, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'PACOVÁ', category: 'Plantas / Mudas', subcategory: 'Folhagens', price: 49.90, stock: 14, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'FÍCUS LIRATA', category: 'Plantas / Mudas', subcategory: 'Árvores e arbustos ornamentais', price: 95.00, stock: 10, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'FICUS GINSENG BONSAI', category: 'Plantas / Mudas', subcategory: 'Árvores e arbustos ornamentais', price: 60.00, stock: 8, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'PODOCARPO', category: 'Plantas / Mudas', subcategory: 'Árvores e arbustos ornamentais', price: 69.00, stock: 25, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'MANACÁ DA SERRA', category: 'Plantas / Mudas', subcategory: 'Árvores e arbustos ornamentais', price: 79.00, stock: 15, images: ['https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=600'] },
  { name: 'ROSA DO DESERTO DOBRADA', category: 'Plantas / Mudas', subcategory: 'Cactos e suculentas', price: 100.00, stock: 12, images: ['https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600'] },
  { name: 'ROSA DO DESERTO SIMPLES', category: 'Plantas / Mudas', subcategory: 'Cactos e suculentas', price: 55.00, stock: 20, images: ['https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600'] },
  { name: 'SUCULENTAS DIVERSAS', category: 'Plantas / Mudas', subcategory: 'Cactos e suculentas', price: 10.00, stock: 80, images: ['https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600'] },
  { name: 'ORQUÍDEA PHALAENOPSIS', category: 'Plantas / Mudas', subcategory: 'Orquídeas e bromélias', price: 55.00, stock: 22, images: ['https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=600'] },
  { name: 'ORQUÍDEA VANDA', category: 'Plantas / Mudas', subcategory: 'Orquídeas e bromélias', price: 100.00, stock: 10, images: ['https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=600'] },
  { name: 'LÍRIO DA PAZ', category: 'Plantas / Mudas', subcategory: 'Flores e floríferas', price: 25.00, stock: 30, images: ['https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=600'] },
  { name: 'ANTÚRIO VERMELHO', category: 'Plantas / Mudas', subcategory: 'Flores e floríferas', price: 39.90, stock: 25, images: ['https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?w=600'] },
  { name: 'SAMAMBAIA AMERICANA', category: 'Plantas / Mudas', subcategory: 'Samambaias e avencas', price: 49.00, stock: 20, images: ['https://images.unsplash.com/photo-1599685315640-9ceab2f58944?w=600'] },
  { name: 'SAMAMBAIA RENDA PORTUGUESA', category: 'Plantas / Mudas', subcategory: 'Samambaias e avencas', price: 120.00, stock: 8, images: ['https://images.unsplash.com/photo-1599685315640-9ceab2f58944?w=600'] },

  // --- FRUTÍFERAS ---
  { name: 'JABUTICABA HÍBRIDA (PRODUZINDO 2M)', category: 'Frutífera', subcategory: 'Goiabas e jabuticabas', price: 350.00, stock: 6, images: ['https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600'] },
  { name: 'JABUTICABA SABARÁ (2 METROS)', category: 'Frutífera', subcategory: 'Goiabas e jabuticabas', price: 190.00, stock: 8, images: ['https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600'] },
  { name: 'LARANJA BAHIA (ENXERTADA)', category: 'Frutífera', subcategory: 'Cítricos', price: 49.00, stock: 20, images: ['https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=600'] },
  { name: 'LIMÃO CAVIAR (RARO)', category: 'Frutífera', subcategory: 'Cítricos', price: 79.00, stock: 10, images: ['https://images.unsplash.com/photo-1533082879395-659e83d327d0?w=600'] },
  { name: 'LIMÃO TAITI ENXERTADO', category: 'Frutífera', subcategory: 'Cítricos', price: 49.00, stock: 25, images: ['https://images.unsplash.com/photo-1533082879395-659e83d327d0?w=600'] },
  { name: 'MEXERICA PONKAN', category: 'Frutífera', subcategory: 'Cítricos', price: 49.00, stock: 22, images: ['https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?w=600'] },
  { name: 'MANGA PALMER ENXERTADA', category: 'Frutífera', subcategory: 'Mangas', price: 149.00, stock: 12, images: ['https://images.unsplash.com/photo-1553279768-865429fa0078?w=600'] },
  { name: 'MANGA TOMMY', category: 'Frutífera', subcategory: 'Mangas', price: 95.00, stock: 15, images: ['https://images.unsplash.com/photo-1553279768-865429fa0078?w=600'] },
  { name: 'AMORA GIGANTE PORTUGUESA', category: 'Frutífera', subcategory: 'Outras frutíferas', price: 49.00, stock: 18, images: ['https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=600'] },
  { name: 'CÔCO DA BAHIA ANÃO', category: 'Frutífera', subcategory: 'Outras frutíferas', price: 120.00, stock: 15, images: ['https://images.unsplash.com/photo-1544476915-ed1370594142?w=600'] },
  { name: 'PEQUI DO CERRADO', category: 'Frutífera', subcategory: 'Frutas nativas / Cerrado', price: 79.00, stock: 14, images: ['https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=600'] },

  // --- PETS & ANIMAIS ---
  { name: 'MINI CABRA MACHO (LINHAGEM PURA)', category: 'Pets', subcategory: 'Pequenos mamíferos', price: 2900.00, stock: 3, images: ['https://images.unsplash.com/photo-1524024973431-2ad916746881?w=600', 'https://images.unsplash.com/photo-1535083783855-76ae62b2914e?w=600'] },
  { name: 'MINI CABRA FÊMEA (DÓCIL)', category: 'Pets', subcategory: 'Pequenos mamíferos', price: 3900.00, stock: 4, images: ['https://images.unsplash.com/photo-1535083783855-76ae62b2914e?w=600'] },
  { name: 'COELHO MINI COR PADRÃO', category: 'Pets', subcategory: 'Pequenos mamíferos', price: 250.00, stock: 8, images: ['https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?w=600'] },
  { name: 'HAMSTER SÍRIO BRANCO/PRETO', category: 'Pets', subcategory: 'Pequenos mamíferos', price: 39.00, stock: 15, images: ['https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=600'] },
  { name: 'CALOPSITA ADULTA MANSA', category: 'Pets', subcategory: 'Aves ornamentais', price: 190.00, stock: 10, images: ['https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600'] },
  { name: 'CALOPSITA FILHOTE', category: 'Pets', subcategory: 'Aves ornamentais', price: 250.00, stock: 6, images: ['https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600'] },
  { name: 'CANÁRIO BELGA CANTADOR', category: 'Pets', subcategory: 'Aves ornamentais', price: 150.00, stock: 12, images: ['https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600'] },
  { name: 'GALINHA BRAHMA ADULTO', category: 'Pets', subcategory: 'Aves de quintal', price: 290.00, stock: 6, images: ['https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600'] },
  { name: 'GALINHA SEDOSA DO JAPÃO BRANCA', category: 'Pets', subcategory: 'Aves de quintal', price: 290.00, stock: 5, images: ['https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600'] },
  { name: 'ÍNDIO GIGANTE ADULTO', category: 'Pets', subcategory: 'Aves de quintal', price: 390.00, stock: 4, images: ['https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?w=600'] },
  { name: 'JABUTI FILHOTE REGISTRADO', category: 'Pets', subcategory: 'Répteis', price: 190.00, stock: 5, images: ['https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=600'] },

  // --- INSUMOS, ADUBOS E JARDINAGEM ---
  { name: 'FORTH JARDIM (ADUBO COMPLETO)', category: 'Insumos / Outros', subcategory: 'Adubos e fertilizantes', price: 25.00, stock: 40, images: ['https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600'] },
  { name: 'FORTH FLORES', category: 'Insumos / Outros', subcategory: 'Adubos e fertilizantes', price: 27.90, stock: 35, images: ['https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600'] },
  { name: 'SUBSTRATO CAROLINA SACO', category: 'Insumos / Outros', subcategory: 'Jardinagem e cultivo', price: 190.00, stock: 20, images: ['https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600'] },
  { name: 'HUMUS DE MINHOCA SACO 20KG', category: 'Insumos / Outros', subcategory: 'Jardinagem e cultivo', price: 60.00, stock: 30, images: ['https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600'] },
  { name: 'TERRA VEGETAL SACO 20KG', category: 'Insumos / Outros', subcategory: 'Jardinagem e cultivo', price: 60.00, stock: 50, images: ['https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600'] },
  { name: 'VASO DECORATIVO CERÂMICA', category: 'Insumos / Outros', subcategory: 'Vasos e decoração', price: 27.00, stock: 25, images: ['https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600'] },
];

async function seed() {
  console.log('Populando Firestore com o catálogo completo oficial da Conflora...');
  const keyPath = path.resolve(process.cwd(), 'firebase-service-account.json');
  const firestore = new Firestore({
    projectId: 'confloraai',
    keyFilename: keyPath,
  });

  const batch = firestore.batch();
  const now = new Date().toISOString();

  let idx = 1;
  for (const item of FULL_CATALOG) {
    const id = `item-${String(idx).padStart(3, '0')}`;
    const docRef = firestore.collection('products').doc(id);
    batch.set(docRef, {
      id,
      product_id: id,
      name: item.name,
      canonicalName: item.name,
      descricao: item.name,
      category: item.category,
      categoria: item.category,
      subcategory: item.subcategory,
      subcategoria: item.subcategory,
      price: item.price,
      valor_num: item.price,
      valor: `R$ ${item.price.toFixed(2).replace('.', ',')}`,
      stockQuantity: item.stock,
      estoque: item.stock,
      status: 'ATIVO',
      images: item.images,
      imageurl: item.images[0] || '',
      salesCount: Math.floor(Math.random() * 20) + 1,
      created_at: now,
      updated_at: now,
    }, { merge: true });
    idx++;
  }

  await batch.commit();
  console.log(`✓ SUCESSO! ${FULL_CATALOG.length} produtos carregados no Firestore (confloraai).`);
  process.exit(0);
}

if (require.main === module) {
  seed().catch(err => {
    console.error('Erro:', err);
    process.exit(1);
  });
}
