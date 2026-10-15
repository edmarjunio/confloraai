import { create } from 'zustand';

/**
 * Generic UI State Store
 * Controls drawer visibility, modals, toasts, active filters, and search query.
 */
export const useUIStore = create((set) => ({
  isCartDrawerOpen: false,
  isAssistantOpen: false,
  isProductEntryOpen: false,
  isTeamMenuOpen: false,
  activeCategory: 'TODAS',
  searchQuery: '',
  sortOrder: 'az', // 'az' | 'za' | 'price-asc' | 'price-desc'
  toasts: [],

  openCart: () => set({ isCartDrawerOpen: true }),
  closeCart: () => set({ isCartDrawerOpen: false }),
  toggleCart: () => set((s) => ({ isCartDrawerOpen: !s.isCartDrawerOpen })),

  openAssistant: () => set({ isAssistantOpen: true }),
  closeAssistant: () => set({ isAssistantOpen: false }),
  toggleAssistant: () => set((s) => ({ isAssistantOpen: !s.isAssistantOpen })),

  openProductEntry: () => set({ isProductEntryOpen: true }),
  closeProductEntry: () => set({ isProductEntryOpen: false }),

  openTeamMenu: () => set({ isTeamMenuOpen: true }),
  closeTeamMenu: () => set({ isTeamMenuOpen: false }),

  setActiveCategory: (category) => set({ activeCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setSortOrder: (order) => set({ sortOrder: order }),

  addToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      toasts: [...s.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      set((s) => ({
        toasts: s.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  removeToast: (id) => set((s) => ({
    toasts: s.toasts.filter((t) => t.id !== id),
  })),
}));
