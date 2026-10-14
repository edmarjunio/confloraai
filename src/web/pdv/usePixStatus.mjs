import { useCallback, useEffect, useRef, useState } from 'react';
import { request } from '../api/http.mjs';
/** One request at a time; abort on unmount, back off after failures. */
export function usePixStatus(initialOrder, onUpdate) {
  const [order, setOrder] = useState(initialOrder);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const inFlight = useRef(null);
  const mounted = useRef(true);
  const update = useRef(onUpdate);
  update.current = onUpdate;
  const check = useCallback(async () => {
    if (!initialOrder?.id || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setChecking(true);
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const result = await request(`/api/caixa/orders/${encodeURIComponent(initialOrder.id)}/pix`, { signal: controller.signal });
      if (!mounted.current) return;
      setOrder(result.order); setError(''); update.current?.(result.order);
    } catch { if (mounted.current) setError('pix.offline'); }
    finally { clearTimeout(timeout); inFlight.current = null; if (mounted.current) setChecking(false); }
  }, [initialOrder?.id]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; inFlight.current?.abort(); };
  }, []);
  useEffect(() => {
    if (order?.paymentStatus === 'PAGO') return;
    const timer = setTimeout(check, error ? 15000 : 5000);
    return () => clearTimeout(timer);
  }, [order, error, check, checking]);
  useEffect(() => { check(); }, [check]);
  return { order, error, checking, check };
}
