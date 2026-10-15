import { createContext, useContext } from "react";
import { tenant } from "../api/store.mjs";
export const QueryScopeContext = createContext("anonymous");
export function useScopedKey(kind, identifiers) {
  const scope = useContext(QueryScopeContext);
  return [kind, tenant || "main", scope, ...identifiers];
}
