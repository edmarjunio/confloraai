import { Search, ShoppingCart, Menu } from "lucide-react";
import { basePath } from "../api/store.mjs";
export function StorefrontHeader({
  config,
  query,
  onSearch,
  count,
  onCart,
  onTeam,
  onSubmit = onSearch,
  cartEnabled = true,
}) {
  const logo = config.branding?.logoUrl;
  return (
    <header className="header">
      <a
        id="brand"
        className={`brand${logo ? " has-logo" : ""}`}
        href={basePath || "/"}
      >
        {logo && <img id="logo" src={logo} alt={config.identity.name} />}
        <span>
          <strong id="storeName">{config.identity.name}</strong>
          <small id="subtitle">{config.identity.subtitle}</small>
        </span>
      </a>
      <form
        className="search"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(query);
        }}
      >
        <Search className="icon" aria-hidden="true" />
        <input
          id="search"
          type="search"
          aria-label={"common.search".tr}
          placeholder={"store.search".tr}
          value={query}
          onChange={(event) => onSearch(event.target.value)}
        />
        <button className="search-btn" type="submit">
          {"common.search".tr}
        </button>
      </form>
      <div className="header-actions">
        <span id="region">{config.identity.city}</span>
        <button
          id="cartButton"
          disabled={!cartEnabled}
          type="button"
          onClick={onCart}
          aria-haspopup="dialog"
          aria-label={"nav.cart".tr}
        >
          <ShoppingCart className="icon" aria-hidden="true" />
          <span id="cartCount">{count}</span>
        </button>
        <button
          className="team-hamburger-btn"
          type="button"
          onClick={onTeam}
          aria-haspopup="dialog"
          aria-label={"nav.team".tr}
        >
          <Menu className="icon" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
