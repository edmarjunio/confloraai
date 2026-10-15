import { useState } from "react";
import { loadOrders, orderMinor } from "../api/store.mjs";
import { useResource } from "../shared/hooks.mjs";
import { ResourceState, EmptyState, Modal } from "../shared/ui.jsx";
import { money, dateTime } from "../i18n/runtime.mjs";
import { StatusBadge } from "../shared/StatusBadge.jsx";
import { useSession } from "./SessionProvider.jsx";
import { LoginForm } from "./LoginForm.jsx";
export default function AccountPage() {
  const { user } = useSession();
  const resource = useResource(
    (signal) => (user ? loadOrders(false, signal) : Promise.resolve([])),
    ["customer-orders", user?.id],
  );
  const [selected, setSelected] = useState(null);
  if (!user) {
    return (
      <section className="panel narrow">
        <LoginForm />
      </section>
    );
  }
  return (
    <section className="panel">
      <h1>{"auth.orders".tr}</h1>
      <ResourceState resource={resource}>
        {!resource.data?.length ? (
          <EmptyState />
        ) : (
          resource.data.map((order) => (
            <article className="order-row" key={order.id}>
              <button onClick={() => setSelected(order)}>
                {order.ticketNumber || order.id}
              </button>
              <span>{dateTime(order.createdAt)}</span>
              <StatusBadge status={order.status} />
              <strong>{money(orderMinor(order))}</strong>
            </article>
          ))
        )}
      </ResourceState>
      {selected && (
        <Modal title={"orders.number".tr} onClose={() => setSelected(null)}>
          <p>{selected.ticketNumber || selected.id}</p>
          {selected.items.map((item, index) => (
            <p key={index}>
              {item.quantity}
              {" × "}
              {item.name}
            </p>
          ))}
          <strong>{money(orderMinor(selected))}</strong>
          {selected.paymentCheckoutUrl && (
            <a href={selected.paymentCheckoutUrl}>{"checkout.payLink".tr}</a>
          )}
        </Modal>
      )}
    </section>
  );
}
