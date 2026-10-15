import { useState } from "react";
import { usePixStatus } from "./usePixStatus.mjs";
import { Modal, ErrorNotice } from "../shared/ui.jsx";
import { money, dateTime } from "../i18n/runtime.mjs";
export function PixPayment({ initialOrder, onUpdate, onNewSale }) {
  const { order, error, checking, check } = usePixStatus(
    initialOrder,
    onUpdate,
  );
  const [copied, setCopied] = useState(false);
  const paid = order?.paymentStatus === "PAGO";
  return (
    <Modal title={paid ? "pix.approved".tr : "pix.title".tr}>
      <section className="pix-panel">
        <p>
          {"orders.number".tr}
          {" #"}
          {order?.ticketNumber || order?.id}
        </p>
        <strong className="amount">
          {money(Number(order?.total || 0) * 100)}
        </strong>
        {paid ? (
          <>
            <p>{dateTime(order.paidAt)}</p>
            <label>
              {"pix.evidence".tr}
              <output className="break-all">
                {order.paymentTransactionId}
              </output>
            </label>
            <button className="primary" onClick={onNewSale}>
              {"checkout.new".tr}
            </button>
          </>
        ) : (
          <>
            {order?.pix?.qrCodeBase64 && (
              <img
                className="pix-qr"
                src={order.pix.qrCodeBase64}
                alt={"pix.qr".tr}
              />
            )}
            <p role="status">{"pix.waiting".tr}</p>
            {Date.parse(order?.pix?.expiresAt) < Date.now() && (
              <p>{"pix.expired".tr}</p>
            )}
            <label>
              {"pix.code".tr}
              <textarea readOnly value={order?.pix?.pixCopiaECola || ""} />
            </label>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(order.pix.pixCopiaECola);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "pix.copied".tr : "pix.copy".tr}
            </button>
            <button className="primary" disabled={checking} onClick={check}>
              {checking ? "app.loading".tr : "pix.check".tr}
            </button>
            <ErrorNotice error={error} />
          </>
        )}
      </section>
    </Modal>
  );
}
