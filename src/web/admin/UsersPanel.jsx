import { useState } from 'react';
import { request } from '../api/http.mjs';
import { useAction, useResource } from '../shared/hooks.mjs';
import { ErrorNotice, Field, Modal, ResourceState, Select, SubmitButton } from '../shared/ui.jsx';
export function UsersPanel() {
  const resource = useResource(signal => request('/api/admin/auth/users', { signal }), []);
  const action = useAction();
  const [selected, setSelected] = useState(null);
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.pin) delete values.pin;
    await action.run(async () => { await request('/api/admin/users', { method: 'POST', body: { ...selected, ...values, active: values.active === 'true' } }); setSelected(null); resource.refresh(); });
  }
  return <section><button onClick={() => setSelected({})}>{'common.add'.tr}</button><ResourceState resource={resource}>{(resource.data || []).map(user => <article className="order-row" key={user.id}><strong>{user.name}</strong><span>{user.email}</span><button onClick={() => setSelected(user)}>{'common.edit'.tr}</button></article>)}</ResourceState>
    {selected && <Modal title={'admin.users'.tr} onClose={() => setSelected(null)}><form onSubmit={submit} className="stack"><Field label={'catalog.name'.tr} name="name" defaultValue={selected.name || ''} required /><Field label={'auth.email'.tr} type="email" name="email" defaultValue={selected.email || ''} /><Field label={'checkout.phone'.tr} name="phone" defaultValue={selected.phone || ''} /><Field label={'auth.pin'.tr} name="pin" type="password" autoComplete="new-password" />
      <Select label={'admin.role'.tr} name="role" defaultValue={selected.role || 'CLIENTE'}><option value="ADMIN">{'admin.permission'.tr}</option><option value="CAIXA">{'admin.cashier'.tr}</option><option value="CLIENTE">{'admin.customer'.tr}</option></Select>
      <Select label={'orders.status'.tr} name="active" defaultValue={String(selected.active !== false)}><option value="true">{'status.active'.tr}</option><option value="false">{'status.inactive'.tr}</option></Select><ErrorNotice error={action.error} /><SubmitButton busy={action.busy}>{'common.save'.tr}</SubmitButton>
    </form></Modal>}
  </section>;
}
