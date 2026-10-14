import { useEffect, useRef, useState } from 'react';
import { request } from '../api/http.mjs';
import { readStorage, writeStorage } from '../shared/storage.mjs';
import { useAction } from '../shared/hooks.mjs';
export function useSale(operatorId) {
  const key = `pdv-attempt:${operatorId}`;
  const [state, setState] = useState(() => readStorage(key, {}));
  const action = useAction();
  const requestId = useRef(state.requestId || crypto.randomUUID());
  function persist(next) { writeStorage(key, next); setState(next); }
  async function submit(payload) {
    await action.run(async () => {
      persist({ ...state, requestId: requestId.current, payload });
      const result = await request('/api/caixa/orders', { method: 'POST', headers: { 'Idempotency-Key': requestId.current }, body: payload });
      persist({ requestId: requestId.current, order: result.order || null, approvalId: result.approval?.id || '' });
    });
  }
  useEffect(() => {
    if (!state.requestId || state.order || state.approvalId) return;
    const controller = new AbortController();
    request(`/api/caixa/pix-attempt/${encodeURIComponent(state.requestId)}`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) persist({ ...state, order: result.order }); })
      .catch(error => { if (!controller.signal.aborted && error.status !== 404) action.setError('error.unavailable'); });
    return () => controller.abort();
  }, [state.requestId, state.order?.id, state.approvalId]);
  useEffect(() => {
    if (!state.approvalId) return;
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const result = await request(`/api/caixa/discount-approvals/${encodeURIComponent(state.approvalId)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (result.status === 'APPROVED') { persist({ ...state, order: result.order, approvalId: '' }); return; }
        if (result.status === 'REJECTED') { persist({ ...state, approvalId: '', rejected: true }); return; }
      } catch { if (!controller.signal.aborted) action.setError('error.unavailable'); }
      if (!controller.signal.aborted) timer = setTimeout(poll, 5000);
    }
    poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [state.approvalId]);
  return { ...state, ...action, submit, update: order => persist({ ...state, order }), reset() { requestId.current = crypto.randomUUID(); persist({}); } };
}
