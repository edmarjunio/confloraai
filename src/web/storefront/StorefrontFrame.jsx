import { useState } from "react";
import { tenant } from "../api/store.mjs";
import { useCart } from "../cart/useCart.mjs";
import { Checkout } from "../cart/Checkout.jsx";
import { Assistant } from "../catalog/Assistant.jsx";
import { Modal } from "../shared/ui.jsx";
import { StorefrontHeader } from "./StorefrontHeader.jsx";
import { TeamMenu } from "./TeamMenu.jsx";

export function StorefrontFrame({
  config,
  products,
  query,
  onSearch,
  onSubmit,
  children,
  navigation,
  internal = false,
  cartEnabled = true,
}) {
  const cart = useCart(`catalog-cart:${tenant}`);
  const [modal, setModal] = useState("");
  const count = cart.items.reduce((sum, item) => sum + item.quantity, 0);
  const colors = config.branding?.colors || {};
  return (
    <div
      className={`storefront-layout${internal ? " internal-layout" : ""}`}
      style={{
        "--primary-color": colors.primary,
        "--accent-color": colors.accent,
        "--text-color": colors.text,
        "--bg-color": colors.background,
      }}
    >
      <a className="skip" href="#main">
        {"nav.skip".tr}
      </a>
      <StorefrontHeader
        cartEnabled={cartEnabled}
        config={config}
        query={query}
        onSearch={onSearch}
        onSubmit={onSubmit}
        count={count}
        onCart={() => setModal("cart")}
        onTeam={() => setModal("team")}
      />
      <main id="main" className="main">
        {children}
      </main>
      {navigation?.({
        cart,
        count,
        onCart: () => setModal("cart"),
        onAssistant: () => setModal("assistant"),
      })}
      <footer className="site-footer">
        <a href="/privacy">{"legal.privacy".tr}</a>
        <a href="/terms">{"legal.terms".tr}</a>
        <a href="/data-deletion">{"legal.deletion".tr}</a>
      </footer>
      {modal === "team" && <TeamMenu onClose={() => setModal("")} />}
      {modal === "cart" && (
        <Modal
          className="drawer cart-drawer"
          title={"store.yourCart".tr}
          onClose={() => setModal("")}
        >
          <Checkout cart={cart} products={products} config={config} />
        </Modal>
      )}
      {modal === "assistant" && (
        <Modal
          className="drawer chat-drawer"
          title={config.assistant?.displayName || "assistant.title".tr}
          onClose={() => setModal("")}
        >
          <Assistant products={products} config={config} onAdd={cart.add} />
        </Modal>
      )}
    </div>
  );
}
