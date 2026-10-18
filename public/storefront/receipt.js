import { element } from "./ui.js";

function manualPayment(order) {
  const status = element('p', { role: 'status', text: order.paymentReviewStatus === 'AWAITING_REVIEW' ? 'Comprovante enviado — aguardando conferência da loja.' : order.paymentReviewStatus === 'REJECTED' ? `Comprovante recusado: ${order.paymentReviewNote || 'Envie um novo comprovante.'}` : 'Pagamento ainda não confirmado.' });
  const key = element('input', { value: order.manualPix.key, readonly: '', 'aria-label': 'Chave Pix da loja' });
  const panel = element('section', { class: 'order-receipt-pix', 'aria-label': 'Pix manual' }, [
    element('h4', { text: 'Pagar com Pix' }),
    element('p', { text: `Beneficiário: ${order.manualPix.recipientName}` }),
    element('p', { text: 'Copie a chave e pague pelo aplicativo do seu banco. Confira o beneficiário. Depois, envie o comprovante aqui. A loja verificará o recebimento antes de confirmar.' }),
    key,
    element('button', { type: 'button', text: 'Copiar chave Pix', onclick: async () => {
      try { await navigator.clipboard.writeText(key.value); status.textContent = 'Chave Pix copiada.'; }
      catch { key.focus(); key.select(); status.textContent = 'Selecione e copie a chave acima.'; }
    } }), status,
  ]);
  const file = element('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,application/pdf', 'aria-label': 'Comprovante do pagamento Pix' });
  const upload = element('button', { type: 'button', text: 'Enviar comprovante', onclick: async () => {
    const selected = file.files?.[0];
    if (!selected || selected.size > 3 * 1024 * 1024) { status.textContent = 'Selecione JPG, PNG, WebP ou PDF de até 3 MB.'; return; }
    upload.disabled = true; status.textContent = 'Enviando comprovante…';
    try {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(selected); });
      const response = await window.ConfloraSession.apiFetch(`/api/storefront/orders/${encodeURIComponent(order.id)}/payment-proof`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Order-Token': order.accessToken || '' }, body: JSON.stringify({ dataUrl, fileName: selected.name }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível enviar.');
      status.textContent = 'Comprovante enviado — aguardando conferência da loja. O pagamento ainda não foi confirmado.';
    } catch (error) { status.textContent = error.message || 'Falha no envio. Tente novamente.'; }
    finally { upload.disabled = false; }
  } });
  panel.append(file, upload);
  if (order.accessToken) {
    const url = new URL('/', location.origin); url.hash = new URLSearchParams({ pedido: order.id, acesso: order.accessToken }).toString();
    panel.append(element('a', { href: url.href, text: 'Acompanhar este pedido ou enviar o comprovante depois' }));
  }
  return panel;
}

async function openTrackedOrder() {
  const params = new URLSearchParams(location.hash.slice(1)); const id = params.get('pedido'); const token = params.get('acesso');
  if (!id || !token) return;
  const dialog = element('dialog', { 'aria-label': 'Acompanhar pedido' }); document.body.append(dialog);
  dialog.append(element('button', { text: 'Fechar', onclick: () => dialog.close() })); dialog.showModal();
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  try {
    const response = await window.ConfloraSession.apiFetch(`/api/storefront/orders/${encodeURIComponent(id)}/payment`, { headers: { 'X-Order-Token': token } });
    const result = await response.json(); if (!response.ok) throw new Error(result.error);
    dialog.append(renderOrderReceipt(result.order));
  } catch (error) { dialog.append(element('p', { role: 'alert', text: error.message || 'Não foi possível abrir o pedido.' })); }
}
window.addEventListener('hashchange', openTrackedOrder);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', openTrackedOrder, { once: true });
else openTrackedOrder();

/** Shared receipt renderer used by checkout and purchase history. */
export function renderOrderReceipt(order) {
  const pixCode = String(order?.pixData?.pixCopiaECola || order?.pixCopiaECola || "").trim();
  const isAwaitingPix = order?.paymentMethod === "PIX" && !order?.paidAt && Boolean(pixCode);
  const pixPanel = isAwaitingPix ? element("section", { class: "order-receipt-pix", "aria-label": "Pagamento Pix" }, [
    element("h4", { text: "Pix com valor fixo" }),
    order.pixData?.qrCodeBase64 ? element("img", { src: order.pixData.qrCodeBase64, alt: `QR Code Pix do pedido ${order.ticketNumber || order.id}`, class: "order-receipt-qr" }) : null,
    element("p", { class: "order-receipt-pix-total", text: `Pague exatamente ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(order.total || 0))}` }),
    element("label", { class: "order-receipt-copy-label", text: "Pix copia e cola" }),
    element("textarea", { class: "order-receipt-copy-code", readonly: "", rows: "3", "aria-label": "Pix copia e cola", text: pixCode }),
    element("button", { type: "button", class: "order-receipt-copy-button", text: "Copiar Pix copia e cola", onclick: async (event) => {
      try { await navigator.clipboard.writeText(pixCode); event.currentTarget.textContent = "Código copiado"; }
      catch { event.currentTarget.textContent = "Selecione e copie o código"; }
    } }),
    order.pixExpiresAt ? element("p", { class: "order-receipt-expiry", text: `Válido até ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(order.pixExpiresAt))}` }) : null,
  ].filter(Boolean)) : null;
  const receipt = element("section", {
    class: "order-receipt-view",
    "aria-label": "Recibo da compra",
  }, [
    element("h3", { class: "order-receipt-title", text: "Recibo da compra" }),
    ...(order.pixMode === 'MANUAL' && order.manualPix && !order.completedAt && order.status !== 'CANCELLED' ? [manualPayment(order)] : pixPanel ? [pixPanel] : []),
    window.ConfloraOrderDisplay.renderReceipt(order),
  ]);
  return receipt;
}
