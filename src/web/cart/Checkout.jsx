import { useRef, useState } from 'react';
import { request } from '../api/http.mjs';
import { storePath, tenant, orderMinor } from '../api/store.mjs';
import { money } from '../i18n/runtime.mjs';
import { useAction } from '../shared/hooks.mjs';
import { SubmitButton, ErrorNotice } from '../shared/ui.jsx';
import { CartLines, cartTotal } from './CartLines.jsx';
import { CustomerFields, PaymentFields } from './CheckoutFields.jsx';
import { StatusBadge } from '../shared/StatusBadge.jsx';
import { readStorage, writeStorage } from '../shared/storage.mjs';
export function Checkout({ cart, products, config }) {
  const action = useAction();
  const [order, setOrder] = useState(null);
  const key = `checkout-attempt:${tenant}`;
  const attempt = useRef(readStorage(key) || crypto.randomUUID());
  const [delivery, setDelivery] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await action.run(async () => {
      writeStorage(key, attempt.current);
      const result = await request(storePath('/orders'), { method: 'POST', headers: { 'Idempotency-Key': attempt.current }, body: {
        customer: { name: values.name, phone: values.phone }, items: cart.items,
        address: values.address || '', serviceArea: values.serviceArea || '', fulfillment: values.fulfillment,
        paymentMethod: values.paymentMethod, cashTenderedMinor: Math.round(Number(values.cash || 0) * 100),
      } });
      setOrder(result.order || result); cart.clear(); writeStorage(key, null);
    });
  }
  if (order) return <section className="stack"><h2>{'checkout.created'.tr}</h2><p>{order.ticketNumber || order.id}</p><StatusBadge status={order.status} /><strong>{money(orderMinor(order))}</strong>{order.paymentCheckoutUrl && <a href={order.paymentCheckoutUrl} target="_blank" rel="noopener noreferrer">{'checkout.payLink'.tr}</a>}</section>;
  return <section><CartLines cart={cart} products={products} /><strong>{money(cartTotal(cart.items, products) + (delivery ? config.checkout.delivery.feeMinor : 0))}</strong>
    {!!cart.items.length && <form className="stack" onSubmit={submit} onChange={event => { if (event.target.name === 'fulfillment') setDelivery(event.target.value === 'delivery'); }}>
      <CustomerFields checkout={config.checkout} /><PaymentFields payments={config.checkout.enabledPayments} /><ErrorNotice error={action.error} />
      <SubmitButton busy={action.busy}>{'cart.checkout'.tr}</SubmitButton>
    </form>}
  </section>;
}
