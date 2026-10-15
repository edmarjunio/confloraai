import { createStore } from './zustand.js';
import { getLanguage, setLanguage as setI18nLanguage, onLanguageChange } from '../i18n/index.js';

const CART_STORAGE_KEY = 'conflora_cart_items_v2';
const CUSTOMER_STORAGE_KEY = 'conflora_customer_info_v2';

// Safe localStorage loader
function loadStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Safe localStorage saver
function saveStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore
  }
}

/**
 * 1. Cart Store - Zustand
 * Manages cart items, customer info, delivery vs pickup, payment methods,
 * notes, totals, and persistence.
 */
export const cartStore = createStore((set, get) => ({
  items: loadStorage(CART_STORAGE_KEY, []),
  fulfillment: 'pickup', // 'pickup' | 'delivery'
  paymentMethod: 'PIX', // 'PIX' | 'CARD' | 'CASH'
  deliveryAddress: '',
  serviceArea: 'Mineiros - GO',
  cashTendered: '',
  orderNotes: '',
  coupon: null,
  customer: loadStorage(CUSTOMER_STORAGE_KEY, {
    name: '',
    phone: '',
  }),

  // Actions
  addItem: (product, quantity = 1) => {
    if (!product || !product.id) {
      return;
    }
    const current = get().items;
    const existingIndex = current.findIndex((i) => String(i.id) === String(product.id));

    let nextItems;
    if (existingIndex >= 0) {
      nextItems = [...current];
      const newQty = nextItems[existingIndex].quantity + Number(quantity);
      nextItems[existingIndex] = {
        ...nextItems[existingIndex],
        quantity: Math.max(1, newQty),
      };
    } else {
      const priceMinor = product.price?.amountMinor !== undefined
        ? product.price.amountMinor
        : Math.round(Number(product.price || 0) * 100);

      nextItems = [
        ...current,
        {
          id: String(product.id),
          name: product.name || 'Produto',
          priceMinor,
          price: priceMinor / 100,
          unit: product.saleUnit?.code || product.unit || 'UN',
          imageUrl: product.imageUrl || '',
          category: product.categoryName || product.category || '',
          quantity: Math.max(1, Number(quantity)),
        },
      ];
    }

    set({ items: nextItems });
    saveStorage(CART_STORAGE_KEY, nextItems);
  },

  removeItem: (productId) => {
    const nextItems = get().items.filter((i) => String(i.id) !== String(productId));
    set({ items: nextItems });
    saveStorage(CART_STORAGE_KEY, nextItems);
  },

  updateQuantity: (productId, quantity) => {
    const qty = Number(quantity);
    if (qty <= 0) {
      get().removeItem(productId);
      return;
    }
    const nextItems = get().items.map((i) =>
      String(i.id) === String(productId) ? { ...i, quantity: qty } : i
    );
    set({ items: nextItems });
    saveStorage(CART_STORAGE_KEY, nextItems);
  },

  clearCart: () => {
    set({
      items: [],
      cashTendered: '',
      coupon: null,
      orderNotes: '',
    });
    saveStorage(CART_STORAGE_KEY, []);
  },

  setFulfillment: (fulfillment) => set({ fulfillment }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setDeliveryAddress: (deliveryAddress) => set({ deliveryAddress }),
  setServiceArea: (serviceArea) => set({ serviceArea }),
  setCashTendered: (cashTendered) => set({ cashTendered }),
  setOrderNotes: (orderNotes) => set({ orderNotes }),
  setCoupon: (coupon) => set({ coupon }),

  setCustomer: (info) => {
    const updated = { ...get().customer, ...info };
    set({ customer: updated });
    saveStorage(CUSTOMER_STORAGE_KEY, updated);
  },

  // Computed total getters
  getSubtotalMinor: () => {
    return get().items.reduce((sum, item) => sum + (item.priceMinor * item.quantity), 0);
  },

  getTotalItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));

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
