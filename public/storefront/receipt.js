import { element } from "./ui.js";

/** Shared receipt renderer used by checkout and purchase history. */
export function renderOrderReceipt(order) {
  const receiptText = String(order?.receiptText || "").trim();
  const receipt = element("section", {
    class: "order-receipt-view",
    "aria-label": "Recibo da compra",
  }, [
    element("h3", { class: "order-receipt-title", text: "Recibo da compra" }),
    element("pre", {
      class: "order-receipt-text",
      text: receiptText || "O recibo desta compra não está disponível.",
    }),
  ]);
  return receipt;
}
