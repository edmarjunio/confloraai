import { pt } from './pt.js';
import { en } from './en.js';
import { es } from './es.js';
import { fr } from './fr.js';

export const TRANSLATIONS = {
  pt,
  en,
  es,
  fr,
};

export const SUPPORTED_LANGUAGES = [
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

let activeLanguage = 'pt';
const listeners = new Set();

// Load stored language preference or browser preference
try {
  const saved = localStorage.getItem('conflora_lang');
  if (saved && ['pt', 'en', 'es', 'fr'].includes(saved)) {
    activeLanguage = saved;
  } else if (typeof navigator !== 'undefined' && navigator.language) {
    const lang = navigator.language.slice(0, 2).toLowerCase();
    if (['pt', 'en', 'es', 'fr'].includes(lang)) {
      activeLanguage = lang;
    }
  }
} catch {
  // Ignore storage errors
}

/**
 * Normaliza texto para busca insensível a maiúsculas e acentos
 */
function normalizeKey(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Base de vocabulário inteligente para categorias botânicas, itens de viveiro e hortifruti
 */
const CATEGORY_MAP = {
  en: {
    'horta': 'Garden & Veggies',
    'horta e temperos': 'Garden & Herbs',
    'horta & temperos': 'Garden & Herbs',
    'hortalicas': 'Vegetables',
    'hortifrutti': 'Fresh Produce',
    'hortifruti': 'Fresh Produce',
    'frutifera': 'Fruit Plants',
    'frutiferas': 'Fruit Plants',
    'frutiferas para vasos': 'Potted Fruit Plants',
    'plantas / mudas': 'Plants & Seedlings',
    'plantas e mudas': 'Plants & Seedlings',
    'plantas': 'Plants',
    'mudas': 'Seedlings',
    'plantas de sombra': 'Shade Plants',
    'plantas de sol': 'Full Sun Plants',
    'plantas de meia sombra': 'Half Shade Plants',
    'plantas pendentes': 'Hanging Plants',
    'trepadeiras e pendentes': 'Climbers & Vines',
    'trepadeiras': 'Climbers & Vines',
    'folhosas': 'Leafy Greens',
    'flores': 'Flowers',
    'arvores': 'Trees',
    'arvores nativas': 'Native Trees',
    'palmeiras': 'Palm Trees',
    'cactos & suculentas': 'Cacti & Succulents',
    'cactos e suculentas': 'Cacti & Succulents',
    'cactos': 'Cacti',
    'suculentas': 'Succulents',
    'ervas & temperos': 'Herbs & Seasonings',
    'ervas e temperos': 'Herbs & Seasonings',
    'temperos e ervas': 'Herbs & Seasonings',
    'ervas': 'Herbs',
    'temperos': 'Seasonings & Herbs',
    'adubos & fertilizantes': 'Fertilizers & Soil',
    'adubos e fertilizantes': 'Fertilizers & Soil',
    'adubos & substratos': 'Fertilizers & Substrates',
    'adubos e substratos': 'Fertilizers & Substrates',
    'adubos': 'Fertilizers',
    'fertilizantes': 'Fertilizers',
    'substratos': 'Substrates',
    'terras e substratos': 'Soil & Substrates',
    'terra & substrato': 'Soil & Substrates',
    'terra vegetal': 'Topsoil / Potting Soil',
    'vasos': 'Pots & Planters',
    'vaso': 'Pot',
    'vasos e cachepos': 'Pots & Cachepots',
    'vasos de barro': 'Clay Pots',
    'vasos plasticos': 'Plastic Pots',
    'cachepos': 'Plant Baskets & Cachepots',
    'cachepots': 'Plant Baskets & Cachepots',
    'ferramentas': 'Gardening Tools',
    'jardinagem': 'Gardening',
    'acessorios': 'Accessories',
    'decoracao': 'Decor & Ornaments',
    'sementes': 'Seeds',
    'pragas e doencas': 'Pest & Disease Control',
    'inseticidas': 'Insecticides & Defense',
    'pets': 'Pet Supplies',
    'pet': 'Pet Supplies',
    'pequenos mamiferos': 'Small Animals',
    'insumos': 'Supplies',
    'construcao': 'Building Materials',
    'madeira': 'Wood & Sawdust',
    'outros': 'Other',
    'outro': 'Other',
    'geral': 'General',
    'orquideas': 'Orchids',
    'bonsai': 'Bonsai',
    'grama & forracoes': 'Grass & Ground Cover',
    'grama': 'Lawn & Grass',
    'humus de minhoca': 'Earthworm Castings',
    'casca de pinus': 'Pine Bark',
    'argila expandida': 'Expanded Clay',
    'perlita': 'Perlite',
    'farinha de osso': 'Bone Meal Fertilizer',
    'torta de mamona': 'Castor Meal Fertilizer',
    'calcario': 'Agricultural Lime',
    'todas': 'All',
    'todos': 'All',
    'curtidos': 'Favorites',
    'subcategorias:': 'Subcategories:',
    'subcategorias': 'Subcategories',
    'produto': 'Product',
    'produtos': 'Products',
  },
};

/**
 * Tradução dinâmica e inteligente de categorias ou termos
 */
function translateDynamicTerm(rawText, lang) {
  if (!rawText || typeof rawText !== 'string') return rawText;
  if (lang === 'pt') return rawText;

  const dict = TRANSLATIONS[lang] || {};
  if (dict[rawText]) return dict[rawText];

  // Identifica prefixo com emoji, ex.: "✨ Todas", "🏷️ Subcategorias:", "❤️ Curtidos", "🌿 Todas"
  const emojiMatch = rawText.match(/^([\p{Emoji}\u200d\uFE0F\s]+)(.+)$/u);
  if (emojiMatch) {
    const prefix = emojiMatch[1];
    const rest = emojiMatch[2].trim();
    if (dict[rest]) {
      return `${prefix}${dict[rest]}`;
    }
    const normRest = normalizeKey(rest);
    if (CATEGORY_MAP[lang] && CATEGORY_MAP[lang][normRest]) {
      return `${prefix}${CATEGORY_MAP[lang][normRest]}`;
    }
  }

  // Busca normalizada no dicionário de categorias
  const norm = normalizeKey(rawText);
  if (CATEGORY_MAP[lang] && CATEGORY_MAP[lang][norm]) {
    return CATEGORY_MAP[lang][norm];
  }

  // Traduções combinadas inteligentes
  if (lang === 'en') {
    if (norm.startsWith('muda de ') || norm.startsWith('mudas de ')) {
      const species = rawText.replace(/^mudas?\s+de\s+/i, '');
      return `${species} Seedling`;
    }
    if (norm.startsWith('planta ') || norm.startsWith('plantas ')) {
      const species = rawText.replace(/^plantas?\s+/i, '');
      return `${species} Plant`;
    }
    if (norm.startsWith('vaso ') || norm.startsWith('vasos ')) {
      const material = rawText.replace(/^vasos?\s+/i, '');
      return `${material} Pot`;
    }
  }

  return rawText;
}

/**
 * Get current active language code ('pt' | 'en' | 'es' | 'fr')
 */
export function getLanguage() {
  return activeLanguage;
}

/**
 * Change current language and notify all components
 */
export function setLanguage(lang) {
  if (['pt', 'en', 'es', 'fr'].includes(lang)) {
    activeLanguage = lang;
    try {
      localStorage.setItem('conflora_lang', lang);
      document.documentElement.lang = lang === 'pt' ? 'pt-BR' : lang;
    } catch {
      // Ignore storage errors
    }
    applyHtmlTranslations();

    // Notifica via CustomEvent no window
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('conflora-lang-change', { detail: { lang } }));
    }

    listeners.forEach((listener) => {
      try {
        listener(lang);
      } catch (e) {
        console.error('Translation listener error:', e);
      }
    });
  }
}

/**
 * Subscribe to language changes
 */
export function onLanguageChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Core translation function
 * Supports interpolation like {count}, {name}, etc.
 */
export function tr(key, params = {}) {
  if (key === undefined || key === null) return '';
  const strKey = String(key);
  const lang = activeLanguage;
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.pt;

  let text = dict ? dict[strKey] : undefined;

  // Se não encontrou no dicionário direto e não é português, tenta termo botânico / categoria / emoji
  if (text === undefined && lang !== 'pt') {
    const dynamic = translateDynamicTerm(strKey, lang);
    if (dynamic !== strKey) {
      text = dynamic;
    }
  }

  // Fallback to Portuguese (principal) se a chave for identificador com ponto
  if (text === undefined && TRANSLATIONS.pt) {
    text = TRANSLATIONS.pt[strKey];
  }

  // If still missing, return the key itself
  if (text === undefined) {
    text = strKey;
  }

  // Interpolate parameters {param}
  if (params && typeof params === 'object') {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return text;
}

/**
 * Configure String.prototype.tr so any string can be translated via:
 * 'catalog.title'.tr ou 'Horta'.tr
 */
export function setupStringTranslation() {
  if (typeof String !== 'undefined') {
    try {
      Object.defineProperty(String.prototype, 'tr', {
        get() {
          return tr(this.valueOf());
        },
        configurable: true,
        enumerable: false,
      });
    } catch {
      // In case property is already defined
    }
  }

  if (typeof window !== 'undefined') {
    window.tr = tr;
    window.getLanguage = getLanguage;
    window.setLanguage = setLanguage;
    window.onLanguageChange = onLanguageChange;
  }
}

// Auto-init String.prototype.tr
setupStringTranslation();

/**
 * Scans the DOM and applies translations to all elements with:
 * data-i18n -> textContent
 * data-i18n-placeholder -> placeholder
 * data-i18n-title -> title
 * data-i18n-aria -> aria-label
 */
export function applyHtmlTranslations(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return;
  }

  // Text content
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = tr(key);
    }
  });

  // Placeholder
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = tr(key);
    }
  });

  // Title
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.title = tr(key);
    }
  });

  // Aria-label
  root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    if (key) {
      el.setAttribute('aria-label', tr(key));
    }
  });
}
