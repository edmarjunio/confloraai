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
  const dict = TRANSLATIONS[activeLanguage] || TRANSLATIONS.pt;
  let text = dict[key];

  // Fallback to Portuguese (principal)
  if (text === undefined && TRANSLATIONS.pt) {
    text = TRANSLATIONS.pt[key];
  }

  // If still missing, return the key
  if (text === undefined) {
    return key;
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
 * 'catalog.title'.tr
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
