import { useState } from "react";
import { request } from "../api/http.mjs";
import { tenant, storePath } from "../api/store.mjs";
import { useAction, useResource } from "../shared/hooks.mjs";
import { ErrorNotice, Field, Modal, ResourceState } from "../shared/ui.jsx";
import { money } from "../i18n/runtime.mjs";
import { ProductForm } from "./ProductForm.jsx";
import { ImportProducts } from "./ImportProducts.jsx";
export function ProductsPanel() {
  const resource = useResource(
    (signal) =>
      request(tenant ? storePath("/admin/products") : "/api/products", {
        signal,
      }).then((value) => (Array.isArray(value) ? value : value.products || [])),
    ["products"],
  );
  const action = useAction();
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("");
  const [query, setQuery] = useState("");
  function saved() {
    setMode("");
    setSelected(null);
    resource.refresh();
  }
  return (
    <section>
      <div className="toolbar">
        <Field
          label={"common.search".tr}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          onClick={() => {
            setSelected({});
            setMode("edit");
          }}
        >
          {"common.add".tr}
        </button>
        {!tenant && (
          <button onClick={() => setMode("import")}>{"admin.import".tr}</button>
        )}
      </div>
      <ErrorNotice error={action.error} />
      <ResourceState resource={resource}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{"catalog.name".tr}</th>
                <th>{"catalog.price".tr}</th>
                <th>{"catalog.stock".tr}</th>
                <th>{"common.actions".tr}</th>
              </tr>
            </thead>
            <tbody>
              {(resource.data || [])
                .filter((product) =>
                  product.name
                    ?.toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
                )
                .map((product) => (
                  <tr key={product.id}>
                    <td>{product.name}</td>
                    <td>
                      {money(
                        typeof product.price === "object"
                          ? product.price.amountMinor
                          : product.price * 100,
                      )}
                    </td>
                    <td>{product.stock?.quantity ?? product.stockQuantity}</td>
                    <td>
                      <button
                        onClick={() => {
                          setSelected(product);
                          setMode("edit");
                        }}
                      >
                        {"common.edit".tr}
                      </button>
                      <button
                        onClick={() => {
                          setSelected(product);
                          setMode("delete");
                        }}
                      >
                        {"common.delete".tr}
                      </button>
                      {!tenant && (
                        <button
                          onClick={() => {
                            setSelected(product);
                            setMode("stock");
                          }}
                        >
                          {"admin.quickStock".tr}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </ResourceState>
      {mode === "edit" && (
        <Modal title={"admin.products".tr} onClose={saved}>
          <ProductForm product={selected} onSaved={saved} />
        </Modal>
      )}
      {mode === "import" && (
        <Modal title={"admin.import".tr} onClose={saved}>
          <ImportProducts onSaved={saved} />
        </Modal>
      )}
      {mode === "delete" && (
        <Modal title={"common.delete".tr} onClose={saved}>
          <p>{selected.name}</p>
          <button
            disabled={action.busy}
            onClick={() =>
              action.run(async () => {
                await request(
                  tenant
                    ? storePath(`/admin/products/${selected.id}`)
                    : `/api/admin/products/${selected.id}`,
                  { method: "DELETE" },
                );
                saved();
              })
            }
          >
            {"common.confirm".tr}
          </button>
        </Modal>
      )}
      {mode === "stock" && (
        <Modal title={"admin.quickStock".tr} onClose={saved}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const quantityAdded = Number(
                new FormData(event.currentTarget).get("quantity"),
              );
              action.run(async () => {
                await request("/api/admin/stock/quick-entry", {
                  method: "POST",
                  body: { productId: selected.id, quantityAdded },
                });
                saved();
              });
            }}
          >
            <Field
              label={"catalog.quantity".tr}
              type="number"
              name="quantity"
              min="0.001"
              step="0.001"
              required
            />
            <button disabled={action.busy}>{"common.save".tr}</button>
          </form>
        </Modal>
      )}
    </section>
  );
}
