import { useState } from "react";
import { loadCatalog, basePath } from "../api/store.mjs";
import { useResource } from "../shared/hooks.mjs";
import { StorefrontFrame } from "../storefront/StorefrontFrame.jsx";

export function Shell({ children }) {
  const resource = useResource(loadCatalog, ["catalog"]);
  const [query, setQuery] = useState("");
  function search(value) {
    location.href = (basePath || "/") + "?q=" + encodeURIComponent(value);
  }
  return (
    <StorefrontFrame
      internal
      config={
        resource.data?.config || {
          identity: { name: "app.title".tr },
          branding: { logoUrl: "/store-assets/brands/conflora-logo.png" },
        }
      }
      products={resource.data?.products || []}
      cartEnabled={Boolean(resource.data)}
      query={query}
      onSearch={setQuery}
      onSubmit={search}
    >
      {children}
    </StorefrontFrame>
  );
}
