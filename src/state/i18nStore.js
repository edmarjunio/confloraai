import { create } from 'zustand';
import { setLanguage as setGlobalLanguage, getLanguage, tr } from '../i18n/translations';

/**
 * Zustand i18n Store
 * Reactive store for active language and translations.
 */
export const useI18nStore = create((set, get) => ({
  language: getLanguage(),

  setLanguage: (lang) => {
    setGlobalLanguage(lang);
    set({ language: lang });
  },

  t: (key) => tr(key, get().language),
}));
