import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfloraLayout } from './ConfloraLayout';
import { ProductGrid } from './ProductGrid';
import { useCatalogQuery } from '../queries/storeQueries';
import { useCartStore } from '../state/cartStore';
import { useTenantStore } from '../state/tenantStore';
import { useUIStore } from '../state/uiStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

function StorefrontContent({ tenantSlug = 'conflora' }) {
  const { data, isLoading, isError, error, refetch } = useCatalogQuery(tenantSlug);
  const setTenantConfig = useTenantStore((s) => s.setTenantConfig);
  const cartItems = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearCart = useCartStore((s) => s.clearCart);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const setSearchQuery = useUIStore((s) => s.setSearchQuery);
  const activeCategory = useUIStore((s) => s.activeCategory);
  const setActiveCategory = useUIStore((s) => s.setActiveCategory);

  // Sync tenant configuration when catalog data loads
  useEffect(() => {
    if (data?.config) {
      setTenantConfig(data.config);
    }
  }, [data, setTenantConfig]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Carregando catálogo...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6 bg-red-50 rounded-2xl m-4 border border-red-200">
        <h2 className="text-lg font-bold text-red-800">Falha ao carregar catálogo</h2>
        <p className="text-xs text-red-600 max-w-md">{error?.message || 'Erro inesperado'}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="px-5 py-2.5 bg-green-700 text-white rounded-lg text-xs font-semibold hover:bg-green-800 transition-colors shadow-xs"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const products = data?.products || [];
  const categories = data?.config?.categories || [];

  return (
    <ConfloraLayout
      cartItems={cartItems}
      onUpdateCartQuantity={updateQuantity}
      onClearCart={clearCart}
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      activeCategory={activeCategory}
      onSelectCategory={setActiveCategory}
    >
      <ProductGrid products={products} categories={categories} />
    </ConfloraLayout>
  );
}

/**
 * GenericStorefront: Entrypoint component with TanStack Query provider
 * Can be mounted in any React app or page.
 */
export function GenericStorefront({ tenantSlug = 'conflora' }) {
  return (
    <QueryClientProvider client={queryClient}>
      <StorefrontContent tenantSlug={tenantSlug} />
    </QueryClientProvider>
  );
}
