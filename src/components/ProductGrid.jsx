import React, { useMemo } from 'react';
import { ProductCard } from './ProductCard';
import { useUIStore } from '../state/uiStore';
import { useTenantStore } from '../state/tenantStore';
import { useI18nStore } from '../state/i18nStore';
import '../i18n/translations';

/**
 * Generic Product Grid Component
 * Modular and easily customizable with category filters, live search, and sorting.
 * All UI labels translated with 'name'.tr
 */
export function ProductGrid({ products = [], categories = [] }) {
  const activeCategory = useUIStore((s) => s.activeCategory);
  const setActiveCategory = useUIStore((s) => s.setActiveCategory);
  const searchQuery = useUIStore((s) => s.searchQuery);
  const sortOrder = useUIStore((s) => s.sortOrder);
  const setSortOrder = useUIStore((s) => s.setSortOrder);
  const branding = useTenantStore((s) => s.branding);
  // Subscribe to reactive language changes
  useI18nStore((s) => s.language);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category filter
    if (activeCategory && activeCategory !== 'TODAS') {
      result = result.filter((p) => {
        const cat = p.categoryName || p.category || '';
        return cat.toLowerCase() === activeCategory.toLowerCase();
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((p) => {
        const nameMatch = (p.name || '').toLowerCase().includes(q);
        const descMatch = (p.description || '').toLowerCase().includes(q);
        const aliasesMatch = Array.isArray(p.searchAliases) && p.searchAliases.some((a) => String(a).toLowerCase().includes(q));
        return nameMatch || descMatch || aliasesMatch;
      });
    }

    // Sort order
    result.sort((a, b) => {
      const priceA = a.price?.amountMinor ? a.price.amountMinor / 100 : Number(a.price || 0);
      const priceB = b.price?.amountMinor ? b.price.amountMinor / 100 : Number(b.price || 0);

      switch (sortOrder) {
        case 'price-asc':
          return priceA - priceB;
        case 'price-desc':
          return priceB - priceA;
        case 'za':
          return (b.name || '').localeCompare(a.name || '');
        case 'az':
        default:
          return (a.name || '').localeCompare(b.name || '');
      }
    });

    return result;
  }, [products, activeCategory, searchQuery, sortOrder]);

  // Derived category list if not provided explicitly
  const categoryList = useMemo(() => {
    if (categories && categories.length > 0) {
      return categories.map((c) => (typeof c === 'string' ? c : c.name));
    }
    const set = new Set();
    products.forEach((p) => {
      const cat = p.categoryName || p.category;
      if (cat) {
        set.add(cat);
      }
    });
    return Array.from(set);
  }, [categories, products]);

  return (
    <section className="product-grid-section flex flex-col gap-6 w-full">
      {/* Category Pills Filter */}
      {categoryList.length > 0 && (
        <div className="category-tabs flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveCategory('TODAS')}
            style={{
              backgroundColor: activeCategory === 'TODAS' ? (branding?.colors?.primary || '#2E9348') : '#FFFFFF',
              color: activeCategory === 'TODAS' ? '#FFFFFF' : '#374151',
              borderColor: activeCategory === 'TODAS' ? (branding?.colors?.primary || '#2E9348') : '#E5E7EB',
            }}
            className="px-4 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition-all shadow-xs cursor-pointer"
          >
            {'catalog.all_categories'.tr}
          </button>

          {categoryList.map((cat) => {
            const isSelected = activeCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                style={{
                  backgroundColor: isSelected ? (branding?.colors?.primary || '#2E9348') : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#374151',
                  borderColor: isSelected ? (branding?.colors?.primary || '#2E9348') : '#E5E7EB',
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition-all shadow-xs cursor-pointer"
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid Toolbar */}
      <div className="grid-toolbar flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-100">
        <span>
          {'catalog.showing'.tr} <strong className="text-gray-900 font-bold">{filteredProducts.length}</strong> {'catalog.products'.tr}
        </span>

        <label className="flex items-center gap-2 font-medium">
          {'catalog.sort_by'.tr}:
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="border border-gray-200 rounded-md px-2.5 py-1 bg-white text-gray-700 outline-none text-xs"
          >
            <option value="az">{'catalog.sort_az'.tr}</option>
            <option value="za">{'catalog.sort_za'.tr}</option>
            <option value="price-asc">{'catalog.sort_price_asc'.tr}</option>
            <option value="price-desc">{'catalog.sort_price_desc'.tr}</option>
          </select>
        </label>
      </div>

      {/* Product Cards Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              primaryColor={branding?.colors?.primary || '#2E9348'}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state text-center py-16 px-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-base font-semibold text-gray-700">{'catalog.empty_title'.tr}</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            {'catalog.empty_desc'.tr}
          </p>
          {(activeCategory !== 'TODAS' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setActiveCategory('TODAS');
                useUIStore.getState().setSearchQuery('');
              }}
              style={{ color: branding?.colors?.primary || '#2E9348' }}
              className="mt-4 text-xs font-semibold hover:underline"
            >
              {'catalog.clear_filters'.tr}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
