import { request } from "../api/http.mjs";
import { useAction, useResource } from "../shared/hooks.mjs";
import { ErrorNotice, ResourceState } from "../shared/ui.jsx";
export function NotificationsPanel() {
  const resource = useResource(
    (signal) => request("/api/admin/notifications", { signal }),
    ["notifications"],
  );
  const action = useAction();
  return (
    <section>
      <button onClick={resource.refresh}>{"common.refresh".tr}</button>
      <ErrorNotice error={action.error} />
      <ResourceState resource={resource}>
        {(resource.data?.notifications || resource.data || []).map((item) => (
          <article className="panel" key={item.id}>
            <h3>{item.title}</h3>
            <p>{item.message}</p>
            {!item.read && (
              <button
                onClick={() =>
                  action.run(async () => {
                    await request(`/api/admin/notifications/${item.id}/read`, {
                      method: "POST",
                    });
                    resource.refresh();
                  })
                }
              >
                {"admin.read".tr}
              </button>
            )}
          </article>
        ))}
      </ResourceState>
    </section>
  );
}
