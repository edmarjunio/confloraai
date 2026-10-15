import { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accountPath, tenant } from "../api/store.mjs";
import { request, errorKey } from "../api/http.mjs";
import { clearPrivateQueries } from "../state/query-client.mjs";
import { QueryScopeContext } from "../state/query-scope.mjs";
const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const client = useQueryClient();
  const queryKey = ["session", tenant || "main"];
  const session = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      request(tenant ? accountPath("/me") : "/api/auth/me", { signal }).catch(
        (error) => {
          if (error.status === 401) {
            return { user: null };
          }
          throw error;
        },
      ),
    retry: false,
  });
  async function setUser(user) {
    await client.cancelQueries({ queryKey });
    await clearPrivateQueries(client);
    client.setQueryData(queryKey, { user });
  }
  async function logout() {
    await request(accountPath("/auth/logout"), { method: "POST" });
    await setUser(null);
  }
  const user = session.data?.user;
  const scope = user ? `${user.id}:${user.role}` : "anonymous";
  return (
    <SessionContext.Provider
      value={{
        user,
        setUser,
        logout,
        loading: session.isPending,
        error: session.error ? errorKey(session.error) : "",
      }}
    >
      <QueryScopeContext.Provider value={scope}>
        {children}
      </QueryScopeContext.Provider>
    </SessionContext.Provider>
  );
}
export const useSession = () => useContext(SessionContext);
