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
import { money } from "../i18n/runtime.mjs";
export function ReportsPanel() {
  const [date, setDate] = useState(
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
  );
  const resource = useResource(
    (signal) =>
      request(`/api/admin/executive-metrics?date=${date}`, { signal }),
    ["reports", date],
  );
  const action = useAction();
  const [closing, setClosing] = useState(false);
  const [result, setResult] = useState(null);
  const data = resource.data || {};
  return (
    <section>
      <div className="toolbar">
        <Field
          label={"common.date".tr}
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
        <button onClick={resource.refresh}>{"common.refresh".tr}</button>
        <button onClick={() => setClosing(true)}>{"reports.close".tr}</button>
      </div>
      <ResourceState resource={resource}>
        <div className="metrics">
          <article className="panel">
            <h2>{"reports.revenue".tr}</h2>
            <strong>{money(data.totalRevenue * 100)}</strong>
          </article>
          <article className="panel">
            <h2>{"reports.count".tr}</h2>
            <strong>{data.orderCount || 0}</strong>
          </article>
        </div>
        <table>
          <thead>
            <tr>
              <th>{"catalog.name".tr}</th>
              <th>{"catalog.quantity".tr}</th>
              <th>{"cart.total".tr}</th>
            </tr>
          </thead>
          <tbody>
            {(data.topProducts || []).map((product, index) => (
              <tr key={index}>
                <td>{product.name}</td>
                <td>{product.quantity}</td>
                <td>{money(product.revenue * 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResourceState>
      {result && (
        <p role="status">
          {"reports.closed".tr}
          {result.pdfUrl && (
            <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer">
              {"reports.download".tr}
            </a>
          )}
        </p>
      )}
      {closing && (
        <Modal title={"reports.close".tr} onClose={() => setClosing(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const notes = new FormData(event.currentTarget).get("notes");
              action.run(async () => {
                setResult(
                  await request("/api/admin/cashier/close-day", {
                    method: "POST",
                    body: { date, notes },
                  }),
                );
                setClosing(false);
                resource.refresh();
              });
            }}
            className="stack"
          >
            <p>{date}</p>
            <Field label={"common.notes".tr} name="notes" />
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
