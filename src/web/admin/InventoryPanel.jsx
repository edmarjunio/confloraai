import { request } from '../api/http.mjs';
import { useAction, useResource } from '../shared/hooks.mjs';
import { ErrorNotice, ResourceState } from '../shared/ui.jsx';
export function InventoryPanel() {
  const resource = useResource(signal => request('/api/admin/inventory-settings', { signal }), []);
  const action = useAction();
  return <ResourceState resource={resource}><label><input type="checkbox" checked={resource.data?.stockControlEnabled || false} disabled={action.busy} onChange={event => { const stockControlEnabled = event.target.checked; action.run(async () => { await request('/api/admin/inventory-settings', { method: 'POST', body: { stockControlEnabled } }); resource.refresh(); }); }} />{'admin.inventory'.tr}</label><ErrorNotice error={action.error} /></ResourceState>;
}
