import { QueryClient } from "@tanstack/react-query";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        retry: (count, error) =>
          count < 1 && (!error.status || error.status >= 500),
      },
      // Financial writes must never replay automatically after reconnecting.
      mutations: { retry: false, networkMode: "always" },
    },
  });
}
export const invalidateResources = (client) =>
  client.invalidateQueries(
    {
      predicate: (query) => query.queryKey[0] === "resource",
    },
    { cancelRefetch: false },
  );
export async function clearPrivateQueries(client) {
  const filters = { predicate: (query) => query.queryKey[0] !== "session" };
  await client.cancelQueries(filters);
  client.removeQueries(filters);
}
