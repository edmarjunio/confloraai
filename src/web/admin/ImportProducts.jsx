import { useState } from "react";
import { request } from "../api/http.mjs";
import { useAction } from "../shared/hooks.mjs";
import { ErrorNotice, Field, SubmitButton } from "../shared/ui.jsx";
export function ImportProducts({ onSaved }) {
  const [file, setFile] = useState(null);
  const [audit, setAudit] = useState(null);
  const action = useAction();
  async function inspect(event) {
    event.preventDefault();
    await action.run(async () =>
      setAudit(
        await request("/api/admin/import-xlsx", {
          method: "POST",
          body: file,
          headers: { "Content-Type": "application/octet-stream" },
        }),
      ),
    );
  }
  return (
    <section>
      <form onSubmit={inspect} className="stack">
        <Field
          label={"admin.import".tr}
          type="file"
          accept=".xlsx"
          required
          onChange={(event) => {
            setFile(event.target.files[0]);
            setAudit(null);
          }}
        />
        <SubmitButton busy={action.busy}>{"common.view".tr}</SubmitButton>
      </form>
      {audit && (
        <div>
          <p>
            {"admin.products".tr}
            {": "}
            {audit.count}
          </p>
          <button
            disabled={action.busy || !!audit.errors?.length}
            onClick={() =>
              action.run(async () => {
                await request("/api/admin/import-xlsx?commit=true", {
                  method: "POST",
                  body: file,
                  headers: { "Content-Type": "application/octet-stream" },
                });
                onSaved();
              })
            }
          >
            {"common.confirm".tr}
          </button>
        </div>
      )}
      <ErrorNotice error={action.error} />
    </section>
  );
}
