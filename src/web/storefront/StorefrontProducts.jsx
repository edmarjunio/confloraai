import { StorefrontCard } from "./StorefrontCard.jsx";
export function StorefrontProducts({ state, config, onAdd, categoryRef }) {
  return (
    <section id="catalogView">
      <div className="section-title">
        <h1 id="catalogTitle">
          {state.savedOnly ? "store.savedTitle".tr : "store.explore".tr}
        </h1>
        <div className="catalog-tools">
          <span id="resultCount">
            {"store.results".tr({ count: state.visible.length })}
          </span>
          <label className="catalog-sort">
            {"store.sort".tr}
            <select
              aria-label={"catalog.sort".tr}
              value={state.sort}
              onChange={(event) => state.setSort(event.target.value)}
            >
              <option value="az">{"store.az".tr}</option>
              <option value="za">{"store.za".tr}</option>
              <option value="price-asc">{"catalog.low".tr}</option>
              <option value="price-desc">{"store.high".tr}</option>
            </select>
          </label>
        </div>
      </div>
      <div
        ref={categoryRef}
        className="catalog-category-filter"
        role="group"
        aria-label={"catalog.categories".tr}
      >
        {[["", "common.all".tr], ...state.categories].map(([id, name]) => (
          <button
            key={id}
            className={`category-chip${state.category === id ? " is-active" : ""}`}
            aria-pressed={state.category === id}
            onClick={() => {
              state.setCategory(id);
              state.setLimit(24);
            }}
          >
            {name}
          </button>
        ))}
      </div>
      <div id="products" className="products">
        {state.visible.slice(0, state.limit).map((product) => (
          <StorefrontCard
            key={product.id}
            product={product}
            categories={config.categories || []}
            saved={state.saved.includes(product.id)}
            onFavorite={state.toggleFavorite}
            onAdd={onAdd}
          />
        ))}
      </div>
      {!state.visible.length && <p className="empty">{"common.empty".tr}</p>}
      {state.visible.length > state.limit && (
        <button
          className="quiet"
          onClick={() => state.setLimit(state.limit + 24)}
        >
          {"catalog.more".tr}
        </button>
      )}
    </section>
  );
}
