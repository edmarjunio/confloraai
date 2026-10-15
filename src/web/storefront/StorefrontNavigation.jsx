import { LayoutGrid, SlidersHorizontal, Sparkles, Heart } from "lucide-react";
import { money } from "../i18n/runtime.mjs";
export function StorefrontNavigation({
  count,
  total,
  favorites,
  assistant,
  onCatalog,
  onCategories,
  onFavorites,
  onAssistant,
  onCart,
}) {
  return (
    <>
      <button
        id="mobileCart"
        className="mobile-cart"
        onClick={onCart}
        aria-haspopup="dialog"
      >
        <span>
          {"store.viewCart".tr}
          {" · "}
          {count} {"store.items".tr}
        </span>
        <strong>{money(total)}</strong>
      </button>
      <nav
        id="mobileBottomBar"
        className="mobile-bottom-bar"
        aria-label={"nav.home".tr}
      >
        <button
          className={`mobile-bar-item${favorites ? "" : " active"}`}
          aria-pressed={!favorites}
          onClick={onCatalog}
        >
          <LayoutGrid className="bar-icon" aria-hidden="true" />
          <span>{"nav.catalog".tr}</span>
        </button>
        <button className="mobile-bar-item" onClick={onCategories}>
          <SlidersHorizontal className="bar-icon" aria-hidden="true" />
          <span>{"catalog.categories".tr}</span>
        </button>
        <button
          className="mobile-bar-item"
          onClick={onAssistant}
          disabled={!assistant}
        >
          <Sparkles className="bar-icon" aria-hidden="true" />
          <span>{"store.help".tr}</span>
        </button>
        <button
          className={`mobile-bar-item${favorites ? " active" : ""}`}
          aria-pressed={favorites}
          onClick={onFavorites}
        >
          <Heart className="bar-icon" aria-hidden="true" />
          <span>{"store.saved".tr}</span>
        </button>
      </nav>
      {assistant && (
        <button
          id="aiFab"
          className="ai-fab"
          onClick={onAssistant}
          aria-haspopup="dialog"
        >
          <Sparkles className="icon" aria-hidden="true" />
          <span className="sr-only">{"assistant.title".tr}</span>
          <span className="fab-caption">{"store.chat".tr}</span>
        </button>
      )}
    </>
  );
}
