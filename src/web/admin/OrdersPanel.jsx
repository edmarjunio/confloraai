import { useState } from 'react';
import { request } from '../api/http.mjs';
import { loadOrders, orderMinor, tenant, storePath } from '../api/store.mjs';
import { useAction, useResource } from '../shared/hooks.mjs';
import { ErrorNotice, Field, Modal, ResourceState } from '../shared/ui.jsx';
import { money, dateTime } from '../i18n/runtime.mjs';
import { StatusBadge } from '../shared/StatusBadge.jsx';
import { PixPayment } from '../pdv/PixPayment.jsx';
export function OrdersPanel() {
  const resource = useResource(signal => loadOrders(true, signal), []);
  const action = useAction();
  const [selected, setSelected] = useState(null);
  const [pix, setPix] = useState(null);
  async function update(order, status, reason = '') {
    await action.run(async () => {
      await request(tenant ? storePath(`/admin/orders/${order.id}`) : status === 'CANCELLED' ? `/api/caixa/orders/${order.id}/cancel` : `/api/admin/orders/${order.id}/action`, { method: tenant ? 'PATCH' : 'POST', body: { status, reason } });
      setSelected(null); resource.refresh();
    });
  }
  return <section><button onClick={resource.refresh}>{'common.refresh'.tr}</button><ErrorNotice error={action.error} /><ResourceState resource={resource}>{(resource.data || []).map(order => <article className="order-row" key={order.id}><div><strong>{order.ticketNumber || order.id}</strong><p>{order.customerName || order.customer?.name}</p><small>{dateTime(order.createdAt)}</small></div><StatusBadge status={order.status} /><strong>{money(orderMinor(order))}</strong>
    <div className="toolbar"><button onClick={() => setSelected(order)}>{'common.view'.tr}</button>{order.paymentProvider === 'SICREDI' && <button onClick={() => setPix(order)}>{'pix.resume'.tr}</button>}</div>
  </article>)}</ResourceState>
    {pix && <PixPayment initialOrder={pix} onNewSale={() => { setPix(null); resource.refresh(); }} />}
    {selected && <Modal title={'orders.number'.tr} onClose={() => setSelected(null)}><p>{selected.ticketNumber || selected.id}</p>{(selected.items || []).map((item, index) => <p key={index}>{item.quantity}{' × '}{item.name}</p>)}<StatusBadge status={selected.status} /><strong>{money(orderMinor(selected))}</strong><div className="stack">
      {['PAGO','CONFIRMED','PAID_CONFIRMED'].includes(selected.status) && <button disabled={action.busy} onClick={() => update(selected, 'DELIVERED')}>{'orders.deliver'.tr}</button>}
      {!tenant && selected.paymentMethod !== 'PIX' && !['PAGO','CONFIRMED','PAID_CONFIRMED','DELIVERED','CANCELLED'].includes(selected.status) && <button onClick={() => update(selected, 'CONFIRMED')}>{'common.confirm'.tr}</button>}
      {!tenant && <button disabled={action.busy} onClick={() => action.run(() => request(`/api/caixa/orders/${selected.id}/send-whatsapp`, { method: 'POST', body: {} }))}>{'orders.receipt'.tr}</button>}
      {!['PAGO','CONFIRMED','PAID_CONFIRMED','DELIVERED','CANCELLED'].includes(selected.status) && <form onSubmit={event => { event.preventDefault(); update(selected, 'CANCELLED', new FormData(event.currentTarget).get('reason')); }}><Field label={'orders.reason'.tr} name="reason" required /><button disabled={action.busy}>{'common.cancel'.tr}</button></form>}
      <ErrorNotice error={action.error} />
    </div></Modal>}
  </section>;
}
