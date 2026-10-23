import { element } from "./ui.js";

function manualPayment(order) {
  const status = element('p', { role: 'status', text: order.paymentReviewStatus === 'AWAITING_REVIEW' ? 'receipt_sent_awaiting_store_verification'.tr : order.paymentReviewStatus === 'REJECTED' ? `Comprovante recusado: ${order.paymentReviewNote || 'send_a_new_receipt'.tr}` : 'payment_not_yet_confirmed_321f6a'.tr });
  const key = element('input', { value: order.manualPix.key, readonly: '', 'aria-label': 'store_pix_key'.tr });
  const panel = element('section', { class: 'order-receipt-pix', 'aria-label': 'Pix manual' }, [
    element('h4', { text: 'pay_with_pix'.tr }),
    element('p', { text: `${'beneficiary'.tr} ${order.manualPix.recipientName}` }),
    element('p', { text: 'copy_the_key_and_pay_through_your_banking_app_check_the_beneficiary_then_send_the_rec'.tr }),
    key,
    element('button', { type: 'button', text: 'copy_pix_key'.tr, onclick: async () => {
      try { await navigator.clipboard.writeText(key.value); status.textContent = 'pix_key_copied'.tr; }
      catch { key.focus(); key.select(); status.textContent = 'select_and_copy_the_key_above'.tr; }
    } }), status,
  ]);
  const file = element('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,application/pdf', 'aria-label': 'pix_payment_receipt'.tr });
  const upload = element('button', { type: 'button', text: 'send_receipt'.tr, onclick: async () => {
    const selected = file.files?.[0];
    if (!selected || selected.size > 3 * 1024 * 1024) { status.textContent = 'select_jpg_png_webp_or_pdf_up_to_3_mb'.tr; return; }
    upload.disabled = true; status.textContent = 'sending_receipt'.tr;
    try {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(selected); });
      const response = await window.ConfloraSession.apiFetch(`/api/storefront/orders/${encodeURIComponent(order.id)}/payment-proof`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Order-Token': order.accessToken || '' }, body: JSON.stringify({ dataUrl, fileName: selected.name }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'could_not_send'.tr);
      status.textContent = 'receipt_sent_awaiting_store_verification_payment_has_not_been_confirmed_yet'.tr;
    } catch (error) { status.textContent = error.message || 'send_failed_please_try_again'.tr; }
    finally { upload.disabled = false; }
  } });
  panel.append(file, upload);
  if (order.accessToken) {
    const url = new URL('/', location.origin); url.hash = new URLSearchParams({ pedido: order.id, acesso: order.accessToken }).toString();
    panel.append(element('a', { href: url.href, text: 'track_this_order_or_send_the_receipt_later'.tr }));
  }
  return panel;
}

async function openTrackedOrder() {
  const params = new URLSearchParams(location.hash.slice(1)); const id = params.get('order_ca0127'.tr); const token = params.get('acesso');
  if (!id || !token) return;
  const dialog = element('dialog', { 'aria-label': 'track_order'.tr }); document.body.append(dialog);
  dialog.append(element('button', { text: 'common_close'.tr, onclick: () => dialog.close() })); dialog.showModal();
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  try {
    const response = await window.ConfloraSession.apiFetch(`/api/storefront/orders/${encodeURIComponent(id)}/payment`, { headers: { 'X-Order-Token': token } });
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    dialog.append(renderOrderReceipt(result.order));
  } catch (error) { dialog.append(element('p', { role: 'alert', text: error.message || 'could_not_open_the_order'.tr })); }
}
window.addEventListener('hashchange', openTrackedOrder);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openTrackedOrder, { once: true });
else openTrackedOrder();

/** Shared receipt renderer used by checkout and purchase history. */
export function renderOrderReceipt(order) {
  const pixCode = String(order?.pixData?.pixCopiaECola || order?.pixCopiaECola || "").trim();
  const isAwaitingPix = order?.paymentMethod === "PIX" && !order?.paidAt && Boolean(pixCode);
  const pixPanel = isAwaitingPix ? element("section", { class: "order-receipt-pix", "aria-label": 'pix_payment'.tr }, [
    element("h4", { text: 'pix_with_fixed_amount'.tr }),
    order.pixData?.qrCodeBase64 ? element("img", { src: order.pixData.qrCodeBase64, alt: `${'order_pix_qr_code_6f5258'.tr} ${order.ticketNumber || order.id}`, class: "order-receipt-qr" }) : null,
    element("p", { class: 'order_receipt_pix_total'.tr, text: `Pague exatamente ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(order.total || 0))}` }),
    element("label", { class: "order-receipt-copy-label", text: 'pix_copy_and_paste_59c71c'.tr }),
    element("textarea", { class: "order-receipt-copy-code", readonly: "", rows: "3", "aria-label": "Pix copia e cola", text: pixCode }),
    element("button", { type: "button", class: "order-receipt-copy-button", text: 'copy_pix_copy_and_paste'.tr, onclick: async (event) => {
      try { await navigator.clipboard.writeText(pixCode); event.currentTarget.textContent = 'code_copied'.tr; }
      catch { event.currentTarget.textContent = 'select_and_copy_the_code'.tr; }
    } }),
    order.pixExpiresAt ? element("p", { class: "order-receipt-expiry", text: `${'valid_until'.tr} ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(order.pixExpiresAt))}` }) : null,
  ].filter(Boolean)) : null;
  const receipt = element("section", {
    class: "order-receipt-view",
    "aria-label": 'purchase_receipt'.tr,
  }, [
    element("h3", { class: "order-receipt-title", text: 'purchase_receipt'.tr }),
    ...(order.pixMode === 'MANUAL' && order.manualPix && !order.completedAt && order.status !== 'CANCELLED' ? [manualPayment(order)] : pixPanel ? [pixPanel] : []),
    window.ConfloraOrderDisplay.renderReceipt(order),
  ]);
  return receipt;
}
