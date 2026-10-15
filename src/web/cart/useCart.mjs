import { useStore } from "zustand";
import { getCartStore } from "../state/cart-store.mjs";
export { cartReducer } from "../state/cart-store.mjs";
export function useCart(key) {
  const store = getCartStore(key);
  const items = useStore(store, (state) => state.items);
  const { add, setQuantity, remove, clear } = store.getState();
  return { items, add, setQuantity, remove, clear };
}
