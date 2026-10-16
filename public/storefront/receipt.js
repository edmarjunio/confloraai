import { element } from "./ui.js";

/** Shared receipt renderer used by checkout and purchase history. */
export function renderOrderReceipt(order) {
  const receiptText = String(order?.receiptText || "").trim();
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
    ...(pixPanel ? [pixPanel] : []),
    element("pre", {
      class: "order-receipt-text",
      text: receiptText || "O recibo desta compra não está disponível.",
    }),
  ]);
  return receipt;
}
