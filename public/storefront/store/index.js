import { createStore } from './zustand.js';
import { getLanguage, setLanguage as setI18nLanguage, onLanguageChange } from '../i18n/index.js';

/**
 * 2. UI Store - Zustand
 * Controls active category filters, live search, sort options,
 * drawer visibility, modals, and toasts.
 */
export const uiStore = createStore((set) => ({
  activeCategory: '',
  searchQuery: '',
  sortOrder: 'az', // 'az' | 'za' | 'price-asc' | 'price-desc'
  isCartOpen: false,
  isAssistantOpen: false,
  isTeamDrawerOpen: false,
  isProductEntryOpen: false,
  editingProduct: null,
  toasts: [],

  setActiveCategory: (cat) => set({ activeCategory: cat }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortOrder: (order) => set({ sortOrder: order }),

  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),

  openAssistant: () => set({ isAssistantOpen: true }),
  closeAssistant: () => set({ isAssistantOpen: false }),

  openTeamDrawer: () => set({ isTeamDrawerOpen: true }),
  closeTeamDrawer: () => set({ isTeamDrawerOpen: false }),

  openProductEntry: (product = null) => set({ isProductEntryOpen: true, editingProduct: product }),
  closeProductEntry: () => set({ isProductEntryOpen: false, editingProduct: null }),

  addToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

/**
 * 3. App Store - Zustand
 * Holds store configuration, authenticated user/staff member,
 * and language selection.
 */
export const appStore = createStore((set) => ({
  config: null,
  user: null,
  language: getLanguage(),

  setConfig: (config) => set({ config }),
  setUser: (user) => set({ user }),
  setLanguage: (lang) => {
    setI18nLanguage(lang);
    set({ language: lang });
  },
}));

// Synchronize language changes
onLanguageChange((lang) => {
  appStore.setState({ language: lang });
});
