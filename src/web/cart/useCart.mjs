import { useReducer } from 'react';
import { readStorage, writeStorage } from '../shared/storage.mjs';
export function cartReducer(state, action) {
  if (action.type === 'clear') return [];
  const map = new Map(state.map(item => [item.productId, item]));
  if (action.type === 'remove') map.delete(action.id);
  if (action.type === 'quantity') {
    if (!Number.isFinite(action.quantity) || action.quantity <= 0) return state;
    map.set(action.id, { productId: action.id, quantity: action.quantity });
  }
  return [...map.values()];
}
export function useCart(key) {
  const [items, dispatch] = useReducer((state, action) => { const next = cartReducer(state, action); writeStorage(key, next); return next; }, [], () => readStorage(key, []).filter(item => item && typeof item.productId === 'string' && Number.isFinite(item.quantity) && item.quantity > 0));
  const setQuantity = (id, quantity) => dispatch({ type: 'quantity', id, quantity });
  return { items, setQuantity, add(product) { const previous = items.find(item => item.productId === product.id)?.quantity || 0; setQuantity(product.id, Number((previous + (product.saleUnit?.increment || 1)).toFixed(3))); }, remove: id => dispatch({ type: 'remove', id }), clear: () => dispatch({ type: 'clear' }) };
}
