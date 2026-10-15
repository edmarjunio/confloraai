import { createStore } from "zustand/vanilla";
import { readStorage, writeStorage } from "../shared/storage.mjs";
function normalizeDraft(value) {
  const draft = value && typeof value === "object" ? value : {};
  return {
    requestId: typeof draft.requestId === "string" ? draft.requestId : "",
    payload: draft.payload || null,
    orderId: draft.orderId || draft.order?.id || "",
    approvalId: draft.approvalId || "",
    rejected: draft.rejected === true,
  };
}
export function createSaleStore(operatorId) {
  const key = `pdv-attempt:${operatorId}`;
  const store = createStore((set, get) => ({
    draft: normalizeDraft(readStorage(key, {})),
    patch: (changes) =>
      set((state) => ({ draft: { ...state.draft, ...changes } })),
    begin(payload) {
      const requestId = get().draft.requestId || crypto.randomUUID();
      get().patch({ requestId, payload, rejected: false });
      return requestId;
    },
    reset: () => set({ draft: normalizeDraft({}) }),
  }));
  // Persist intent only. Bank status stays in Query's memory cache.
  store.subscribe((state) => writeStorage(key, state.draft));
  writeStorage(key, store.getState().draft);
  return store;
}
const stores = new Map();
export function getSaleStore(operatorId) {
  if (!stores.has(operatorId)) {
    stores.set(operatorId, createSaleStore(operatorId));
  }
  return stores.get(operatorId);
}
