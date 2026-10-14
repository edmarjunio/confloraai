import { createContext, useContext, useState } from 'react';
import { accountPath, tenant } from '../api/store.mjs';
import { request } from '../api/http.mjs';
import { useResource } from '../shared/hooks.mjs';
const SessionContext = createContext(null);
export function SessionProvider({ children }) {
  const session = useResource(signal => request(tenant ? accountPath('/me') : '/api/auth/me', { signal }).catch(error => { if (error.status === 401) return { user: null }; throw error; }), []);
  const [override, setOverride] = useState(undefined);
  const user = override === undefined ? session.data?.user : override;
  async function logout() { await request(accountPath('/auth/logout'), { method: 'POST' }); setOverride(null); }
  return <SessionContext.Provider value={{ user, setUser: setOverride, loading: session.loading, error: session.error, logout }}>{children}</SessionContext.Provider>;
}
export const useSession = () => useContext(SessionContext);
