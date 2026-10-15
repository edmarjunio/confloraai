import { useDeferredValue, useMemo, useState } from "react";
import { searchProducts } from "../../../public/storefront/guided-search.mjs";
import { readStorage, writeStorage } from "../shared/storage.mjs";
import { tenant } from "../api/store.mjs";
import { getLocale } from "../i18n/runtime.mjs";

export function useStorefrontProducts(products, config) {
  const [query, setQuery] = useState(
    () => new globalThis.URLSearchParams(location.search).get("q") || "",
  );
  const deferred = useDeferredValue(query);
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("az");
  const [limit, setLimit] = useState(24);
  const [savedOnly, setSavedOnly] = useState(false);
  const key = `store:${tenant || "conflora"}:favorites`;
  const [saved, setSaved] = useState(() => {
    const value = readStorage(key, []);
    return Array.isArray(value) ? value : [];
  });
  const categories = useMemo(() => {
    const result = new Map();
    for (const product of products) {
      for (const id of product.categories || []) {
        const configured = config.categories?.find((item) => item.id === id);
        if (configured && configured.isActive !== false) {
          result.set(id, configured.name);
        }
      }
      if (!product.categories?.length && product.categoryName) {
        result.set(product.categoryName, product.categoryName);
      }
    }
    return [...result].sort((a, b) => a[1].localeCompare(b[1], getLocale()));
  }, [products, config.categories]);
  const visible = useMemo(() => {
    const available = products.filter(
      (product) =>
        product.isAvailable !== false &&
        product.status !== "INATIVO" &&
        (!savedOnly || saved.includes(product.id)) &&
        (!category ||
          product.categories?.includes(category) ||
          product.categoryName === category),
    );
    const matches = deferred.trim()
      ? searchProducts(
          available,
          deferred,
          config.assistant?.synonyms || [],
        ).map((result) => result.product)
      : [...available];
    return matches.sort((a, b) => {
      if (sort.startsWith("price")) {
        return (
          (a.price.amountMinor - b.price.amountMinor) *
          (sort === "price-desc" ? -1 : 1)
        );
      }
      return (
        a.name.localeCompare(b.name, getLocale()) * (sort === "za" ? -1 : 1)
      );
    });
  }, [
    products,
    category,
    savedOnly,
    saved,
    deferred,
    sort,
    config.assistant?.synonyms,
  ]);
  function toggleFavorite(id) {
    const next = saved.includes(id)
      ? saved.filter((value) => value !== id)
      : [...saved, id];
    writeStorage(key, next);
    setSaved(next);
  }
  return {
    query,
    setQuery,
    category,
    setCategory,
    sort,
    setSort,
    limit,
    setLimit,
    savedOnly,
    setSavedOnly,
    saved,
    toggleFavorite,
    categories,
    visible,
  };
}
