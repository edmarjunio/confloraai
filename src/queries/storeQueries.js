import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Generic TanStack Query Hooks for Storefront Data Operations
 * Handles caching, automatic background revalidation, error recovery, and mutations.
 */

export const CATALOG_QUERY_KEY = ['catalog'];

/**
 * Fetch catalog products and tenant configuration
 */
export function useCatalogQuery(tenantSlug = 'conflora') {
  return useQuery({
    queryKey: [...CATALOG_QUERY_KEY, tenantSlug],
    queryFn: async () => {
      const endpoint = tenantSlug && tenantSlug !== 'conflora'
        ? `/api/shop/${encodeURIComponent(tenantSlug)}/catalog`
        : '/api/storefront/catalog';

      const res = await fetch(endpoint, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        throw new Error(`Erro ao carregar catálogo: HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        config: data.config || {},
        products: Array.isArray(data.products) ? data.products : [],
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes fresh cache
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch a single product by ID
 */
export function useProductQuery(productId) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      if (!productId) {
        return null;
      }
      const res = await fetch(`/api/products/${encodeURIComponent(productId)}`);
      if (!res.ok) {
        throw new Error(`Produto não encontrado: ${productId}`);
      }
      return res.json();
    },
    enabled: Boolean(productId),
  });
}

/**
 * Submit checkout order mutation
 */
export function useSubmitOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderPayload) => {
      const res = await fetch('/api/storefront/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Erro no checkout: HTTP ${res.status}`);
      }

      return res.json();
    },
    onSuccess: () => {
      // Invalidate catalog cache so stock quantities refresh
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}

/**
 * Quick stock adjustment mutation (for Cashier / POS / Stock managers)
 */
export function useQuickStockMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, quantityAdded }) => {
      const res = await fetch('/api/stock/quick-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          quantityAdded: Number(quantityAdded),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao atualizar estoque');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATALOG_QUERY_KEY });
    },
  });
}

/**
 * AI Shopping Assistant recommendation mutation
 */
export function useAssistantMutation() {
  return useMutation({
    mutationFn: async ({ message, history = [], tenantSlug = 'conflora' }) => {
      const res = await fetch('/api/storefront/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          tenantSlug,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Assistente temporariamente indisponível');
      }

      return res.json();
    },
  });
}
