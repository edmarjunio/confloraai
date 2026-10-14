import { money } from '../i18n/runtime.mjs';
import { basePath } from '../api/store.mjs';
export function ProductCard({ product, onAdd }) {
  const available = product.isAvailable !== false && (!product.stock?.tracked || product.stock.quantity >= (product.saleUnit?.minimum || 1));
  return <article className="product-card">
    <a href={`${basePath}/products/${encodeURIComponent(product.id)}`}><img loading="lazy" src={product.imageUrl || '/store-assets/placeholder.svg'} alt={product.name} onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/store-assets/placeholder.svg'; }} /><h3>{product.name}</h3></a>
    <small>{product.categoryName}</small><strong>{money(product.price?.amountMinor, product.price?.currency)}</strong>
    <button className="primary" disabled={!available} onClick={() => onAdd(product)}>{available ? 'common.add'.tr : 'catalog.unavailable'.tr}</button>
  </article>;
}
