import { useCallback, useEffect, useRef, useState } from 'react';
import { errorKey } from '../api/http.mjs';
export function useResource(loader, dependencies = []) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState(current => ({ ...current, loading: true, error: '' }));
    Promise.resolve(loader(controller.signal)).then(data => {
      if (!controller.signal.aborted) setState({ data, loading: false, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState(current => ({ ...current, loading: false, error: errorKey(error) }));
    });
    return () => controller.abort();
  }, [...dependencies, revision]);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  return { ...state, refresh };
}
export function useAction() {
  const lock = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async action => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { return await action(); }
    catch (cause) { if (mounted.current) setError(errorKey(cause)); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  };
  return { busy, error, run, setError };
}
