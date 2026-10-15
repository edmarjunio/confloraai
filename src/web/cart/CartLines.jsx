import { money } from "../i18n/runtime.mjs";
import { Field } from "../shared/ui.jsx";
export function CartLines({ cart, products }) {
  const byId = new Map(products.map((product) => [product.id, product]));
  if (!cart.items.length) {
    return <p className="empty">{"cart.empty".tr}</p>;
  }
  return (
    <div className="cart-lines">
      {cart.items.map((item) => {
        const product = byId.get(item.productId);
        return (
          <article key={item.productId} className="cart-line">
            <div>
              <strong>{product?.name || "catalog.unavailable".tr}</strong>
              <p>{money((product?.price?.amountMinor || 0) * item.quantity)}</p>
            </div>
            <Field
              label={"catalog.quantity".tr}
              type="number"
              min={product?.saleUnit?.minimum || 1}
              step={product?.saleUnit?.increment || 1}
              max={product?.stock?.tracked ? product.stock.quantity : undefined}
              value={item.quantity}
              onChange={(event) =>
                cart.setQuantity(item.productId, Number(event.target.value))
              }
            />
            <button onClick={() => cart.remove(item.productId)}>
              {"common.remove".tr}
            </button>
          </article>
        );
      })}
    </div>
  );
}
export function cartTotal(items, products) {
  const prices = new Map(
    products.map((product) => [product.id, product.price?.amountMinor || 0]),
  );
  return items.reduce(
    (sum, item) =>
      sum + Math.round((prices.get(item.productId) || 0) * item.quantity),
    0,
  );
}
