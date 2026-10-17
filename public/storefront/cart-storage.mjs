/** Recover persisted cart rows without trusting browser storage contents. */
export function normalizeStoredCart(stored) {
  if (!Array.isArray(stored)) return [];

  const quantities = new Map();
  for (const item of stored) {
    if (
      !item ||
      typeof item.productId !== "string" ||
      !item.productId.trim() ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0
    ) continue;

    const quantity = (quantities.get(item.productId) || 0) + item.quantity;
    if (!Number.isFinite(quantity)) continue;
    quantities.set(item.productId, quantity);
  }

  return Array.from(quantities, ([productId, quantity]) => ({ productId, quantity }));
}
