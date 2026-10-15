import { create } from 'zustand';

/**
 * Generic Cart Store (White-label & Multi-tenant)
 * Compatible with any retail or SaaS e-commerce catalog.
 */
export const useCartStore = create((set, get) => ({
  items: [],
  fulfillment: 'pickup', // 'pickup' | 'delivery'
  paymentMethod: 'PIX', // 'PIX' | 'CARD' | 'CASH'
  deliveryAddress: '',
  serviceArea: '',
  cashTendered: 0,
  customer: {
    name: '',
    phone: '',
  },

  addItem: (product, quantity = 1) => {
    if (!product || !product.id) {
      return;
    }
    const current = get().items;
    const existingIndex = current.findIndex((i) => String(i.id) === String(product.id));

    if (existingIndex >= 0) {
      const nextItems = [...current];
      const newQty = nextItems[existingIndex].quantity + quantity;
      nextItems[existingIndex] = {
        ...nextItems[existingIndex],
        quantity: Math.max(1, newQty),
      };
      set({ items: nextItems });
    } else {
      set({
        items: [
          ...current,
          {
            id: String(product.id),
            name: product.name || 'Produto',
            price: Number(product.price?.amountMinor ? product.price.amountMinor / 100 : product.price || 0),
            unit: product.saleUnit?.code || 'UN',
            imageUrl: product.imageUrl || '',
            category: product.categoryName || product.category || '',
            quantity: Math.max(1, quantity),
          },
        ],
      });
    }
  },

  removeItem: (productId) => {
    set({
      items: get().items.filter((i) => String(i.id) !== String(productId)),
    });
  },

  updateQuantity: (productId, quantity) => {
    const qty = Number(quantity);
    if (qty <= 0) {
      get().removeItem(productId);
      return;
    }
    set({
      items: get().items.map((i) => (String(i.id) === String(productId) ? { ...i, quantity: qty } : i)),
    });
  },

  clearCart: () => {
    set({
      items: [],
      cashTendered: 0,
      deliveryAddress: '',
    });
  },

  setFulfillment: (fulfillment) => set({ fulfillment }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setDeliveryAddress: (deliveryAddress) => set({ deliveryAddress }),
  setServiceArea: (serviceArea) => set({ serviceArea }),
  setCashTendered: (cashTendered) => set({ cashTendered }),
  setCustomer: (customer) => set({ customer: { ...get().customer, ...customer } }),

  // Computed totals
  getSubtotal: () => {
    return get().items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
