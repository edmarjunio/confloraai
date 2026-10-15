import { loadCatalog } from "../api/store.mjs";
import { useResource } from "../shared/hooks.mjs";
import { ResourceState, Modal } from "../shared/ui.jsx";
import { useCart } from "../cart/useCart.mjs";
import { ProductGrid } from "../catalog/ProductGrid.jsx";
import { useSession } from "../auth/SessionProvider.jsx";
import { RequireRole } from "../auth/LoginForm.jsx";
import { useSale } from "./useSale.mjs";
import { SaleForm } from "./SaleForm.jsx";
import { PixPayment } from "./PixPayment.jsx";
import { money } from "../i18n/runtime.mjs";
function Cashier() {
  const { user } = useSession();
  const resource = useResource(loadCatalog, ["catalog"]);
  const cart = useCart(`pdv-cart:${user.id}`);
  const sale = useSale(user.id);
  function newSale() {
    cart.clear();
    sale.reset();
    resource.refresh();
  }
  return (
    <>
      <h1>{"nav.pdv".tr}</h1>
      <ResourceState resource={resource}>
        <div className="pdv-layout">
          <ProductGrid
            products={resource.data?.products || []}
            config={resource.data?.config}
            onAdd={cart.add}
          />
          <SaleForm
            cart={cart}
            products={resource.data?.products || []}
            sale={sale}
          />
        </div>
      </ResourceState>
      {sale.order?.paymentProvider === "SICREDI" && (
        <PixPayment
          key={sale.order.id}
          initialOrder={sale.order}
          onUpdate={sale.update}
          onNewSale={newSale}
        />
      )}
      {sale.order && sale.order.paymentProvider !== "SICREDI" && (
        <Modal title={"checkout.created".tr}>
          <p>{sale.order.ticketNumber}</p>
          <strong>{money(sale.order.total * 100)}</strong>
          {sale.order.paymentCheckoutUrl && (
            <a href={sale.order.paymentCheckoutUrl}>{"checkout.payLink".tr}</a>
          )}
          <button onClick={newSale}>{"checkout.new".tr}</button>
        </Modal>
      )}
    </>
  );
}
export default function PdvPage() {
  const { user } = useSession();
  return (
    <RequireRole>
      <Cashier key={user?.id} />
    </RequireRole>
  );
}
