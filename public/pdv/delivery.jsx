/* Delivery queue shares identity, cards, dialogs and payment controls with PDV. */
function PdvDelivery({ user, onBack }) {
  const { useState, useEffect, useRef } = React;
  const [data, setData] = useState(null);
  const [pulsedOrderIds, setPulsedOrderIds] = useState(new Set());
  const pulseTimer = useRef(null);
  const [selected, setSelected] = useState(null);
  const [showRoute, setShowRoute] = useState(false);
  useEffect(() => setShowRoute(false), [selected?.id]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const loading = useRef(false); const requested = useRef(false); const latest = useRef(null); const selectedRef = useRef(null); selectedRef.current = selected;
  const actionClass = 'cf-button !rounded-full !px-4 !py-2 text-xs';
  const request = async (url, body) => {
    const response = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível atualizar a entrega.'); return result;
  };
  const refresh = async () => {
    if (loading.current) { requested.current = true; return; }
    loading.current = true;
    try {
      const next = await request('/api/caixa/deliveries');
      if (latest.current) {
        const previous = new Set(latest.current.available.map((order) => order.id));
        const incoming = next.available.filter(order => !previous.has(order.id)).map(order => order.id);
        if (incoming.length) { setNotice('Nova entrega aguardando separação.'); setPulsedOrderIds(new Set(incoming)); clearTimeout(pulseTimer.current); pulseTimer.current = setTimeout(() => setPulsedOrderIds(new Set()), 10000); }
      }
      latest.current = next; setData(next);
      if (selectedRef.current) {
        const current = [...next.preparing, ...next.available, ...next.inRoute, ...next.completed].find((order) => order.id === selectedRef.current.id);
        setSelected(current || null);
      }
    } catch (err) { setError(err.message); }
    finally { loading.current = false; if (requested.current) { requested.current = false; refresh(); } }
  };
  useEffect(() => {
    refresh(); const timer = setInterval(refresh, 20000);
    const stream = window.ConfloraSession.openEventStream('/api/caixa/orders/stream');
    stream.addEventListener('orders-changed', refresh); stream.addEventListener('stream-fallback', refresh);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); clearTimeout(pulseTimer.current); stream.close(); document.removeEventListener('visibilitychange', visible); };
  }, []);
  const act = async (order, action, payload = {}) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await request('/api/caixa/deliveries/' + encodeURIComponent(order.id) + '/' + action, payload);
      setSelected(result.order || null); selectedRef.current = result.order || null;
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const settled = (order) => Boolean(order.completedAt && ['APPROVED', 'ON_ACCOUNT'].includes(order.paymentStatus));
  const ownRoute = selected?.deliveryStatus === 'OUT_FOR_DELIVERY' && (user.role === 'ADMIN' || selected.assignedDriver?.id === user.id);
  const waiting = [...(data?.available || []), ...(data?.inRoute || [])];
  const completed = data?.completed || [];
  const navigation = selected ? window.ConfloraDeliveryMaps.navigation(selected.deliveryLocation, selected.deliveryAddress) : null;
  const details = selected && <div className="my-3 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
    <p className="text-xs font-bold">{selected.paymentStatus === 'ON_ACCOUNT' ? 'Fiado aprovado pelo Admin' : settled(selected) ? (selected.deliveryStatus === 'DELIVERED' ? '✓ Pagamento registrado' : '✓ Pagamento já registrado — apenas confirme a entrega') : 'Pagamento a receber na entrega'}</p>
    <p className="text-xs font-bold">{selected.deliveryStatus === 'DELIVERED' ? '✓ Entrega concluída' : selected.deliveryStatus === 'OUT_FOR_DELIVERY' ? '🛵 Em rota' : 'Pedido aguardando saída'}</p>
    <p className="text-sm">{selected.deliveryAddress}</p>
    {selected.deliveryLocation?.reference && <p className="text-xs">Referência: {selected.deliveryLocation.reference}</p>}
    {selected.customerPhone && <a className="inline-flex text-sm font-bold text-emerald-800 underline" href={'tel:+' + String(selected.customerPhone).replace(/\D/g, '')}>Ligar para o cliente</a>}
    <div className="flex flex-wrap gap-2"><a className={actionClass} href={navigation.google} target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a><a className={actionClass} href={navigation.waze} target="_blank" rel="noopener noreferrer">Abrir no Waze</a></div>
    {selected.deliveryStatus === 'PENDING_DISPATCH' && user.role !== 'ENTREGADOR' && <button type="button" className={actionClass} disabled={busy || (selected.paymentMethod === 'PIX' && !settled(selected))} onClick={() => act(selected, 'dispatch')}>{selected.paymentMethod === 'PIX' && !settled(selected) ? 'Aguardando confirmação do Pix' : 'Pedido separado · liberar entrega'}</button>}
    {!selected.assignedDriver?.id && ['PENDING_DELIVERY', 'PENDING_DISPATCH'].includes(selected.deliveryStatus) && selected.creditApprovalStatus !== 'PENDING' && (selected.paymentMethod !== 'PIX' || settled(selected)) && <button type="button" className={actionClass} disabled={busy} onClick={() => act(selected, 'accept')}>Separar produtos e assumir entrega</button>}
    {ownRoute && settled(selected) && <button type="button" className={actionClass} disabled={busy} onClick={() => act(selected, 'complete')}>Confirmar entrega</button>}
    {ownRoute && <button type="button" className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700" disabled={busy} onClick={() => act(selected, 'release')}>Devolver à fila de entregas</button>}
    <button type="button" className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800" aria-expanded={showRoute} onClick={() => setShowRoute(value => !value)}>{showRoute ? 'Ocultar mapa da rota' : 'Ver mapa da rota'}</button>
    {showRoute && <delivery-route-map key={selected.id} destination={JSON.stringify(selected.deliveryLocation || null)} address={selected.deliveryAddress || ''} />}
  </div>;
  return <main className="min-h-screen bg-[#F4F6F5] font-sans text-slate-800">
    <header className="conflora-site-header"><div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3"><PdvComponents.SiteBrand /><h1 className="text-xl font-black text-[#0F381E]">🛵 Entregas</h1><div className="flex flex-wrap items-center gap-3"><div className="text-right"><strong className="block text-sm">{user.name}</strong><span className="text-[10px] font-bold text-emerald-700">{user.role}</span></div>{user.role !== 'ENTREGADOR' && <button type="button" className={actionClass} onClick={onBack}>Voltar ao caixa</button>}<button type="button" className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.reload(); }}>Sair</button></div></div></header>
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Abra o pedido, separe os produtos e assuma a entrega. Receba na porta ou confirme a entrega de um pedido já pago.</p><span role="status" className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">● Atualização automática</span></div>
      {notice && <p role="status" className="cf-order-card--attention mb-4 rounded-xl bg-amber-100 p-3 font-bold">{notice}</p>}
      {error && !selected && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {!data && <p>Carregando entregas…</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Quadro de entregas">
        <PdvComponents.CashierColumn title="AGUARDANDO" hint="Pedidos prontos para separar e suas entregas em rota" orders={waiting} tone="amber" selectedOrderId={selected?.id} pulsedOrderIds={pulsedOrderIds} onDetails={(order) => { setSelected(order); setError(''); }} canMove={false} />
        <PdvComponents.CashierColumn title="ENTREGUE" hint="Entregas concluídas por você" orders={completed} tone="green" selectedOrderId={selected?.id} pulsedOrderIds={new Set()} onDetails={(order) => { setSelected(order); setError(''); }} canMove={false} />
      </div>
    </div>
    {selected && <PdvComponents.OrderDetails key={`${selected.id}:${selected.status}:${selected.deliveryStatus}`} order={selected} deliveryMode extraContent={details} busy={busy} error={error} canReceive={ownRoute && !settled(selected) && !selected.pixData?.txid} canConfirmManualPix={ownRoute && !settled(selected) && ['AWAITING_PIX', 'CREATING_PIX'].includes(selected.status)} onClose={() => { setSelected(null); setError(''); }} onReceive={(order, paymentMethod, receivedAmount, paymentParts, verification) => act(order, 'receive', { paymentMethod, receivedAmount, paymentParts, ...verification })} onManualPix={(order, note, proofId) => act(order, 'receive', { paymentMethod: 'PIX_MANUAL', paymentParts: order.paymentParts, manualPix: true, proofSeen: true, note, proofId })} />}
  </main>;
}
