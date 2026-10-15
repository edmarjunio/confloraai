import { useState } from "react";
import { request } from "../api/http.mjs";
import { useAction, useResource } from "../shared/hooks.mjs";
import {
  ErrorNotice,
  Field,
  Modal,
  ResourceState,
  SubmitButton,
} from "../shared/ui.jsx";
import { StatusBadge } from "../shared/StatusBadge.jsx";
import { money } from "../i18n/runtime.mjs";
export function ApprovalsPanel({ alterations = false }) {
  const path = alterations
    ? "/api/admin/alterations"
    : "/api/admin/discount-approvals";
  const resource = useResource(
    (signal) => request(path, { signal }),
    ["approvals", path],
  );
  const action = useAction();
  const [selected, setSelected] = useState(null);
  async function review(item, decision, rejectionReason = "") {
    await action.run(async () => {
      await request(`${path}/${item.id}/review`, {
        method: "POST",
        body: { action: decision, rejectionReason },
      });
      setSelected(null);
      resource.refresh();
    });
  }
  return (
    <section>
      <ErrorNotice error={action.error} />
      <ResourceState resource={resource}>
        {(resource.data || []).map((item) => (
          <article className="panel" key={item.id}>
            <h3>{item.customerName || item.requestedByName}</h3>
            <p>{item.reason}</p>
            <StatusBadge status={item.status} />
            <p>{money((item.total || item.proposedOrder?.total || 0) * 100)}</p>
            {(item.items || item.proposedOrder?.items || []).map(
              (product, index) => (
                <p key={index}>
                  {product.quantity}
                  {" × "}
                  {product.name}
                </p>
              ),
            )}
            {item.status === "PENDING" && (
              <div className="toolbar">
                <button
                  disabled={action.busy}
                  onClick={() => review(item, "APPROVED")}
                >
                  {"admin.approve".tr}
                </button>
                <button onClick={() => setSelected(item)}>
                  {"admin.reject".tr}
                </button>
              </div>
            )}
          </article>
        ))}
      </ResourceState>
      {selected && (
        <Modal title={"admin.reject".tr} onClose={() => setSelected(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              review(
                selected,
                "REJECTED",
                new FormData(event.currentTarget).get("reason"),
              );
            }}
          >
            <Field label={"orders.reason".tr} name="reason" required />
            <ErrorNotice error={action.error} />
            <SubmitButton busy={action.busy}>
              {"common.confirm".tr}
            </SubmitButton>
          </form>
        </Modal>
      )}
    </section>
  );
}
