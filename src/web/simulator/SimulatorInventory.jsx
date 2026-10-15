import { useState } from "react";
import { money, dateTime } from "../i18n/runtime.mjs";
import { EmptyState } from "../shared/ui.jsx";

export function SimulatorInventory({ data, onRefresh }) {
  const [tab, setTab] = useState("stock");
  const products = data?.products || [];
  const movements = data?.movements || [];
  return (
    <>
      <nav className="tabs" aria-label={"simulator.inventory".tr}>
        <button aria-pressed={tab === "stock"} onClick={() => setTab("stock")}>
          {"simulator.inventory".tr}
        </button>
        <button
          aria-pressed={tab === "movements"}
          onClick={() => setTab("movements")}
        >
          {"simulator.movements".tr}
        </button>
      </nav>
      <button onClick={onRefresh}>{"common.refresh".tr}</button>
      <div className="simulator-inventory">
        {tab === "stock" ? (
          products.length ? (
            products.map((product, index) => (
              <article className="order-row" key={product.id || index}>
                <strong>{product.descricao || product.name}</strong>
                <span>
                  {money(Number(product.valor_num || product.price || 0) * 100)}
                </span>
                <span className="badge">
                  {"simulator.stock".tr({
                    count: product.stockQuantity ?? product.estoque ?? 0,
                  })}
                </span>
              </article>
            ))
          ) : (
            <EmptyState />
          )
        ) : movements.length ? (
          movements.map((movement, index) => (
            <article className="order-row" key={movement.id || index}>
              <strong>{movement.productName}</strong>
              <span>
                {movement.previousStock} → {movement.newStock}
              </span>
              <small>
                {dateTime(movement.createdAt)} · {movement.customerPhone}
              </small>
            </article>
          ))
        ) : (
          <EmptyState />
        )}
      </div>
    </>
  );
}
