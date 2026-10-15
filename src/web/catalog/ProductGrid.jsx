import { useDeferredValue, useMemo, useState } from "react";
import {
  searchProducts,
  nextChoices,
  scopedProducts,
} from "../../../public/storefront/guided-search.mjs";
import { Field, Select, EmptyState } from "../shared/ui.jsx";
import { ProductCard } from "./ProductCard.jsx";
export function ProductGrid({ products, config, onAdd }) {
  const [query, setQuery] = useState("");
  const [path, setPath] = useState([]);
  const [sort, setSort] = useState("best");
  const [limit, setLimit] = useState(48);
  const deferredQuery = useDeferredValue(query);
  const categories = useMemo(
    () => config?.categories || [],
    [config?.categories],
  );
  const choices = nextChoices(products, categories, path);
  const visible = useMemo(() => {
    const scoped = path.length
      ? scopedProducts(products, categories, path)
      : products.filter((product) => product.isAvailable !== false);
    const results = deferredQuery.trim()
      ? searchProducts(
          scoped,
          deferredQuery,
          config?.assistant?.synonyms || [],
        ).map((result) => result.product)
      : scoped;
    return [...results].sort((a, b) =>
      sort === "price"
        ? a.price.amountMinor - b.price.amountMinor
        : sort === "name"
          ? a.name.localeCompare(b.name)
          : (b.salesCount || 0) - (a.salesCount || 0),
    );
  }, [products, categories, path, deferredQuery, sort, config]);
  return (
    <section>
      <div className="toolbar">
        <Field
          label={"common.search".tr}
          type="search"
          placeholder={"catalog.search".tr}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(48);
          }}
        />
        <Select
          label={"catalog.sort".tr}
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="best">{"catalog.best".tr}</option>
          <option value="price">{"catalog.low".tr}</option>
          <option value="name">{"catalog.name".tr}</option>
        </Select>
      </div>
      <nav className="chips" aria-label={"catalog.categories".tr}>
        <button aria-pressed={!path.length} onClick={() => setPath([])}>
          {"common.all".tr}
        </button>
        {path.length > 0 && (
          <button onClick={() => setPath(path.slice(0, -1))}>
            {"common.back".tr}
          </button>
        )}
        {choices.map((choice) => (
          <button
            key={choice.label || choice.name || choice}
            onClick={() => {
              setPath([...path, choice.label || choice.name || choice]);
              setLimit(48);
            }}
          >
            {choice.label || choice.name || choice}
          </button>
        ))}
      </nav>
      <div className="product-grid">
        {visible.slice(0, limit).map((product) => (
          <ProductCard key={product.id} product={product} onAdd={onAdd} />
        ))}
      </div>
      {!visible.length && <EmptyState />}
      {visible.length > limit && (
        <button onClick={() => setLimit((value) => value + 48)}>
          {"catalog.more".tr}
        </button>
      )}
    </section>
  );
}
