import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { errorKey } from "../api/http.mjs";
import { useScopedKey } from "../state/query-scope.mjs";
import { invalidateResources } from "../state/query-client.mjs";

/** Named keys describe the resource and every input that changes its response. */
export function useResource(loader, identifiers, options = {}) {
  const queryKey = useScopedKey("resource", identifiers);
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => loader(signal),
    ...options,
  });
  return {
    data: query.data,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? errorKey(query.error) : "",
    refresh: () => query.refetch({ cancelRefetch: false }),
  };
}
/** Keep forms local; share mutation lifecycle and resource invalidation. */
export function useAction() {
  const client = useQueryClient();
  const lock = useRef(false);
  const [manualError, setError] = useState("");
  const mutation = useMutation({
    mutationFn: (action) => action(),
    onSuccess: () => invalidateResources(client),
  });
  async function run(action) {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setError("");
    try {
      return await mutation.mutateAsync(action);
    } catch {
      return undefined;
    } finally {
      lock.current = false;
    }
  }
  return {
    busy: mutation.isPending,
    error: manualError || (mutation.error ? errorKey(mutation.error) : ""),
    run,
    setError,
  };
}
