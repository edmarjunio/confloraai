import { useEffect } from "react";
import { useStore } from "zustand";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, errorKey } from "../api/http.mjs";
import { useAction } from "../shared/hooks.mjs";
import { getSaleStore } from "../state/sale-store.mjs";
import { useScopedKey } from "../state/query-scope.mjs";

export function useSale(operatorId) {
  const store = getSaleStore(operatorId);
  const draft = useStore(store, (state) => state.draft);
  const { begin, patch, reset } = store.getState();
  const client = useQueryClient();
  const action = useAction();
  const orderKey = useScopedKey("sale-order", [draft.orderId]);
  const attemptKey = useScopedKey("sale-attempt", [draft.requestId]);
  const approvalKey = useScopedKey("sale-approval", [draft.approvalId]);
  const order = useQuery({
    queryKey: orderKey,
    queryFn: ({ signal }) =>
      request(`/api/caixa/orders/${encodeURIComponent(draft.orderId)}`, {
        signal,
      }),
    enabled: Boolean(draft.orderId),
  });
  const attempt = useQuery({
    queryKey: attemptKey,
    queryFn: ({ signal }) =>
      request(`/api/caixa/pix-attempt/${encodeURIComponent(draft.requestId)}`, {
        signal,
      }),
    enabled: Boolean(
      draft.requestId &&
      !draft.orderId &&
      !draft.approvalId &&
      !draft.rejected &&
      !action.busy,
    ),
    retry: false,
  });
  const approval = useQuery({
    queryKey: approvalKey,
    queryFn: ({ signal }) =>
      request(
        `/api/caixa/discount-approvals/${encodeURIComponent(draft.approvalId)}`,
        { signal },
      ),
    enabled: Boolean(draft.approvalId),
    retry: false,
    refetchInterval: (query) =>
      ["APPROVED", "REJECTED"].includes(query.state.data?.status)
        ? false
        : 5000,
  });
  useEffect(() => {
    if (attempt.data?.order) {
      patch({ orderId: attempt.data.order.id });
    }
  }, [attempt.data, patch]);
  useEffect(() => {
    if (approval.data?.status === "APPROVED" && approval.data.order) {
      patch({ orderId: approval.data.order.id, approvalId: "" });
    }
    if (approval.data?.status === "REJECTED") {
      patch({ approvalId: "", rejected: true, requestId: "" });
    }
  }, [approval.data, patch]);
  async function submit(payload) {
    await action.run(async () => {
      const requestId = begin(payload);
      const result = await request("/api/caixa/orders", {
        method: "POST",
        headers: { "Idempotency-Key": requestId },
        body: payload,
      });
      if (result.order) {
        client.setQueryData(
          [...orderKey.slice(0, -1), result.order.id],
          result.order,
        );
      }
      patch({
        orderId: result.order?.id || "",
        approvalId: result.approval?.id || "",
      });
    });
  }
  const failure =
    order.error ||
    approval.error ||
    (attempt.error?.status !== 404 ? attempt.error : null);
  return {
    ...draft,
    ...action,
    order: order.data,
    submit,
    reset,
    busy:
      action.busy ||
      Boolean(draft.orderId && !order.data) ||
      attempt.isFetching,
    error: action.error || (failure ? errorKey(failure) : ""),
    update: (value) => client.setQueryData(orderKey, value),
  };
}
