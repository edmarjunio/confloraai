import { StorefrontCard } from "../storefront/StorefrontCard.jsx";
export function ProductCard({ product, onAdd }) {
  return <StorefrontCard product={product} onAdd={onAdd} />;
}
