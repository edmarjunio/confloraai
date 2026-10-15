import { Heart, ShoppingCart } from "lucide-react";
import { basePath } from "../api/store.mjs";
import { money } from "../i18n/runtime.mjs";
import { ProductHighlights } from "./ProductHighlights.jsx";
export function StorefrontCard({
  product,
  categories = [],
  saved,
  onFavorite,
  onAdd,
}) {
  const available =
    product.isAvailable !== false &&
    (!product.stock?.tracked ||
      product.stock.quantity >= (product.saleUnit?.minimum || 1));
  const category =
    product.categories
      ?.map((id) => categories.find((item) => item.id === id)?.name)
      .filter(Boolean)
      .join(" · ") || product.categoryName;
  const href = `${basePath}/products/${encodeURIComponent(product.id)}`;
  return (
    <article className="product-card">
      <ProductHighlights product={product} />
      {onFavorite && (
        <button
          className="favorite"
          aria-label={"store.favorite".tr}
          aria-pressed={saved}
          onClick={() => onFavorite(product.id)}
        >
          <Heart className="icon" aria-hidden="true" />
        </button>
      )}
      <a className="product-photo" href={href}>
        <img
          loading="lazy"
          decoding="async"
          src={product.imageUrl || "/store-assets/placeholder.svg"}
          alt={product.name}
          onError={(event) => {
            if (
              !event.currentTarget.src.endsWith("/store-assets/placeholder.svg")
            ) {
              event.currentTarget.src = "/store-assets/placeholder.svg";
            }
          }}
        />
      </a>
      <div className="product-content">
        <a className="product-name" href={href}>
          {product.name}
        </a>
        <small className="muted">{category}</small>
        <strong>
          {money(product.price.amountMinor)}
          {product.saleUnit?.code && product.saleUnit.code !== "UN"
            ? ` / ${product.saleUnit.label || product.saleUnit.code}`
            : ""}
        </strong>
        <button
          className="primary"
          disabled={!available}
          onClick={() => onAdd(product)}
        >
          <ShoppingCart className="icon" aria-hidden="true" />
          {available ? "common.add".tr : "catalog.unavailable".tr}
        </button>
      </div>
    </article>
  );
}
