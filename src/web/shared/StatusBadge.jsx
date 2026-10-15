import { translate } from "../i18n/runtime.mjs";
const labels = {
  PAGO: "status.paid",
  CONFIRMED: "status.paid",
  PAID_CONFIRMED: "status.paid",
  APPROVED: "status.approved",
  REJECTED: "status.rejected",
  CANCELLED: "status.cancelled",
  DELIVERED: "status.delivered",
  ATIVO: "status.active",
  INATIVO: "status.inactive",
};
export function StatusBadge({ status }) {
  return (
    <span className={`badge status-${String(status).toLowerCase()}`}>
      {translate(labels[status] || "status.pending")}
    </span>
  );
}
