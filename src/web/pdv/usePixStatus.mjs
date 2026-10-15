import { useEffect, useEffectEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../api/http.mjs";
import { useScopedKey } from "../state/query-scope.mjs";
import { invalidateResources } from "../state/query-client.mjs";

export function paymentQueryOptions(queryKey, orderId) {
  return {
    queryKey,
    queryFn: async ({ signal }) =>
      (
        await request(`/api/caixa/orders/${encodeURIComponent(orderId)}/pix`, {
          signal,
        })
      ).order,
    enabled: Boolean(orderId),
    staleTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.data?.paymentStatus === "PAGO"
        ? false
        : query.state.error
          ? 15000
          : 5000,
  };
}

export function usePixStatus(initialOrder, onUpdate) {
  const client = useQueryClient();
  const queryKey = useScopedKey("payment", [initialOrder?.id]);
  const query = useQuery(paymentQueryOptions(queryKey, initialOrder?.id));
  const notify = useEffectEvent((order) => onUpdate?.(order));
  useEffect(() => {
    if (query.data) {
      notify(query.data);
    }
  }, [query.data]);
  const paid = query.data?.paymentStatus === "PAGO";
  useEffect(() => {
    if (paid) {
      void invalidateResources(client);
    }
  }, [paid, client]);
  return {
    // A persisted snapshot never becomes proof of payment.
    order: query.data || {
      ...initialOrder,
      paymentStatus: "AGUARDANDO_PAGAMENTO",
    },
    error: query.error ? "pix.offline" : "",
    checking: query.isFetching,
    check: () => query.refetch({ cancelRefetch: false }),
  };
}
