import { useRef } from "react";
import { loadCatalog, tenant, basePath } from "../api/store.mjs";
import { useResource } from "../shared/hooks.mjs";
import { ResourceState } from "../shared/ui.jsx";
import { useCart } from "../cart/useCart.mjs";
import { cartTotal } from "../cart/CartLines.jsx";
import { ProductDetails } from "./ProductDetails.jsx";
import { StorefrontNavigation } from "../storefront/StorefrontNavigation.jsx";
import { StorefrontProducts } from "../storefront/StorefrontProducts.jsx";
import { StorefrontFrame } from "../storefront/StorefrontFrame.jsx";
import { useStorefrontProducts } from "../storefront/useStorefrontProducts.mjs";

function Storefront({ products, config }) {
  const cart = useCart(`catalog-cart:${tenant}`);
  const state = useStorefrontProducts(products, config);
  const categoryRef = useRef(null);
  const productId = location.pathname.match(/\/products\/([^/]+)/)?.[1];
  function catalog() {
    if (productId) {
      location.href = basePath || "/";
    } else {
      state.setSavedOnly(false);
    }
  }
  return (
    <StorefrontFrame
      config={config}
      products={products}
      query={state.query}
      onSearch={state.setQuery}
      navigation={({ cart, count, onCart, onAssistant }) => (
        <StorefrontNavigation
          count={count}
          total={cartTotal(cart.items, products)}
          favorites={state.savedOnly}
          assistant={config.assistant.enabled}
          onCatalog={catalog}
          onCategories={() => {
            if (productId) {
              catalog();
            } else {
              categoryRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }
          }}
          onFavorites={() => {
            if (productId) {
              catalog();
            } else {
              state.setSavedOnly((value) => !value);
            }
          }}
          onAssistant={onAssistant}
          onCart={onCart}
        />
      )}
    >
      {productId ? (
        <ProductDetails
          product={products.find(
            (product) => product.id === decodeURIComponent(productId),
          )}
          onAdd={cart.add}
        />
      ) : (
        <StorefrontProducts
          state={state}
          config={config}
          categoryRef={categoryRef}
          onAdd={cart.add}
        />
      )}
    </StorefrontFrame>
  );
}

export default function CatalogPage() {
  const resource = useResource(loadCatalog, ["catalog"]);
  return (
    <ResourceState resource={resource}>
      {resource.data && (
        <Storefront
          config={resource.data.config}
          products={resource.data.products || []}
        />
      )}
    </ResourceState>
  );
}
