import { getLanguage } from './index.js';

// Translate known common names only; registered names and cultivar names stay intact.
const names = {
  alface: ['Lettuce', 'Lechuga', 'Laitue'],
  'alface crespa': ['Curly lettuce', 'Lechuga rizada', 'Laitue frisée'],
  'alface americana': ['Iceberg lettuce', 'Lechuga iceberg', 'Laitue iceberg'],
  tomate: ['Tomato', 'Tomate', 'Tomate'],
  cenoura: ['Carrot', 'Zanahoria', 'Carotte'],
  cebola: ['Onion', 'Cebolla', 'Oignon'],
  alho: ['Garlic', 'Ajo', 'Ail'],
  batata: ['Potato', 'Patata', 'Pomme de terre'],
  abacate: ['Avocado', 'Aguacate', 'Avocat'],
  abacaxi: ['Pineapple', 'Piña', 'Ananas'],
  morango: ['Strawberry', 'Fresa', 'Fraise'],
  couve: ['Collard greens', 'Col rizada', 'Chou vert'],
  rucula: ['Arugula', 'Rúcula', 'Roquette'],
  cebolinha: ['Chives', 'Cebollino', 'Ciboulette'],
  coentro: ['Coriander', 'Cilantro', 'Coriandre'],
  manjericao: ['Basil', 'Albahaca', 'Basilic'],
  hortela: ['Mint', 'Menta', 'Menthe'],
  alecrim: ['Rosemary', 'Romero', 'Romarin'],
  lavanda: ['Lavender', 'Lavanda', 'Lavande'],
  samambaia: ['Fern', 'Helecho', 'Fougère'],
  orquidea: ['Orchid', 'Orquídea', 'Orchidée'],
  girassol: ['Sunflower', 'Girasol', 'Tournesol'],
  'terra vegetal': ['Topsoil', 'Tierra vegetal', 'Terre végétale'],
};
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function translateProductName(product) {
  const original = String(product?.name || product?.canonicalName || '');
  const language = getLanguage();
  if (language === 'pt') return original;
  const registered = product?.nameTranslations?.[language];
  if (typeof registered === 'string' && registered.trim() && registered.length <= 180) return registered.trim();
  const index = ['en', 'es', 'fr'].indexOf(language);
  const match = names[normalize(original)];
  if (match) return match[index];
  const seedling = /^mudas? de (.+)$/i.exec(original);
  if (seedling) {
    const known = names[normalize(seedling[1])];
    if (known) return ['Seedling of ', 'Plantón de ', 'Jeune plant de '][index] + known[index];
  }
  return original;
}
