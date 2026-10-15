import { createStore } from "zustand/vanilla";
import { readStorage, writeStorage } from "../shared/storage.mjs";
export function cartReducer(state, action) {
  if (action.type === "clear") {
    return [];
  }
  const items = new Map(state.map((item) => [item.productId, item]));
  if (action.type === "remove") {
    items.delete(action.id);
  }
  if (action.type === "quantity") {
    if (!Number.isFinite(action.quantity) || action.quantity <= 0) {
      return state;
    }
    items.set(action.id, { productId: action.id, quantity: action.quantity });
  }
  return [...items.values()];
}
export function createCartStore(key) {
  const stored = readStorage(key, []);
  const items = Array.isArray(stored)
    ? stored.filter(
        (item) =>
          item &&
          typeof item.productId === "string" &&
          Number.isFinite(item.quantity) &&
          item.quantity > 0,
      )
    : [];
  const store = createStore((set, get) => ({
    items,
    setQuantity: (id, quantity) =>
      set((state) => ({
        items: cartReducer(state.items, { type: "quantity", id, quantity }),
      })),
    remove: (id) =>
      set((state) => ({
        items: cartReducer(state.items, { type: "remove", id }),
      })),
    clear: () => set({ items: [] }),
    add(product) {
      const current =
        get().items.find((item) => item.productId === product.id)?.quantity ||
        0;
      const quantity = Number(
        (
          current +
          (current
            ? product.saleUnit?.increment || 1
            : product.saleUnit?.minimum || 1)
        ).toFixed(3),
      );
      if (
        product.isAvailable === false ||
        (product.stock?.tracked && quantity > product.stock.quantity)
      ) {
        return;
      }
      get().setQuantity(product.id, quantity);
    },
  }));
  // Preserve the existing storage format for carts created before migration.
  store.subscribe((state) => writeStorage(key, state.items));
  return store;
}
const stores = new Map();
export function getCartStore(key) {
  if (!stores.has(key)) {
    stores.set(key, createCartStore(key));
  }
  return stores.get(key);
}
