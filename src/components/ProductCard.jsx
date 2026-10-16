import React, { useState } from 'react';
import { ShoppingBag, Check, Plus, Minus } from 'lucide-react';
import { useCartStore } from '../state/cartStore';
import { useUIStore } from '../state/uiStore';
import { useI18nStore } from '../state/i18nStore';
import '../i18n/translations';

/**
 * Generic Product Card
 * Reusable across any category (plants, groceries, retail, gifts).
 * All UI labels localized via 'key'.tr
 */
export function ProductCard({ product, primaryColor = '#2E9348' }) {
  const [qty, setQty] = useState(1);
  const [addedAnimation, setAddedAnimation] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const addToast = useUIStore((s) => s.addToast);
  // Subscribe to language change for instant re-render
  useI18nStore((s) => s.language);

  if (!product) {
    return null;
  }

  const priceFormatted = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(product.price?.amountMinor ? product.price.amountMinor / 100 : Number(product.price || 0));

  const isOutOfStock = product.stock?.tracked && (product.stock?.quantity ?? 0) <= 0;
  const isInactive = product.status === 'INATIVO';
  const isAvailable = product.isAvailable !== false && !isOutOfStock && !isInactive;

  const handleAddToCart = () => {
    if (!isAvailable) {
      return;
    }
    addItem(product, qty);
    setAddedAnimation(true);
    addToast(`${product.name} ${'catalog.added_to_cart'.tr}`, 'success');
    setTimeout(() => setAddedAnimation(false), 1200);
  };

  return (
    <cf-card className="cf-card--product" padding="none">
      <div className="product-card-media relative aspect-square bg-gray-50 overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 font-medium text-xs">
            {'catalog.unavailable'.tr}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.categoryName && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-sm text-gray-700 shadow-xs">
              {product.categoryName}
            </span>
          )}
          {isOutOfStock && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
              {'catalog.out_of_stock'.tr}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2" title={product.name}>
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-400 block font-medium">{'catalog.from'.tr}</span>
            <strong className="text-lg font-bold text-gray-900">{priceFormatted}</strong>
          </div>

          {isAvailable ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-2 py-1.5 text-gray-600 hover:bg-gray-200 transition-colors"
                  aria-label="Diminuir"
                >
                  <Minus size={13} />
                </button>
                <span className="px-2 font-semibold text-xs text-gray-800">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => q + 1)}
                  className="px-2 py-1.5 text-gray-600 hover:bg-gray-200 transition-colors"
                  aria-label="Aumentar"
                >
                  <Plus size={13} />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                style={{ '--cf-button-color': addedAnimation ? '#16a34a' : primaryColor }}
                className="cf-button p-2.5 active:scale-95"
                title={'catalog.add_to_cart'.tr}
              >
                {addedAnimation ? <Check size={18} /> : <ShoppingBag size={18} />}
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-400 italic font-medium">{'catalog.unavailable'.tr}</span>
          )}
        </div>
      </div>
    </cf-card>
  );
}
