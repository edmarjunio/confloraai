import { useState } from 'react';
import { CustomerFields, PaymentFields } from '../cart/CheckoutFields.jsx';
import { CartLines, cartTotal } from '../cart/CartLines.jsx';
import { ErrorNotice, Field, SubmitButton } from '../shared/ui.jsx';
import { money } from '../i18n/runtime.mjs';
export function SaleForm({ cart, products, sale }) {
  const [adjustments, setAdjustments] = useState({ discount: 0, freight: 0 });
  const subtotal = cartTotal(cart.items, products);
  const total = subtotal - Math.round(subtotal * adjustments.discount / 100) + Math.round(adjustments.freight * 100);
  async function submit(event) {
    event.preventDefault();
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    await sale.submit({ items: cart.items, customerName: fields.name, customerPhone: fields.phone,
      paymentMethod: { PIX: 'PIX', CARD: 'CARTAO', CASH: 'DINHEIRO' }[fields.paymentMethod],
      orderType: fields.fulfillment === 'delivery' ? 'DELIVERY' : 'PICKUP', deliveryAddress: fields.address || '',
      freightValue: Number(fields.freightValue || 0), discountPercent: Number(fields.discountPercent || 0), notes: fields.notes || '',
    });
  }
  return <aside className="panel"><h2>{'nav.cart'.tr}</h2><CartLines cart={cart} products={products} />
    <form onSubmit={submit} className="stack" onChange={event => {
      const values = new FormData(event.currentTarget);
      setAdjustments({ discount: Number(values.get('discountPercent') || 0), freight: values.get('fulfillment') === 'delivery' ? Number(values.get('freightValue') || 0) : 0 });
    }}><fieldset disabled={sale.busy || !!sale.approvalId}><CustomerFields pdv /><PaymentFields pdv /><Field label={'common.notes'.tr} name="notes" />
      <strong className="amount">{money(total)}</strong><ErrorNotice error={sale.error} />
      {sale.approvalId ? <p role="status">{'admin.awaiting'.tr}</p> : !!cart.items.length && <SubmitButton busy={sale.busy}>{'checkout.submit'.tr}</SubmitButton>}
      {sale.rejected && <p role="alert">{'status.rejected'.tr}</p>}
    </fieldset></form>
  </aside>;
}
