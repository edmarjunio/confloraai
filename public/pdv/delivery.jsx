/* Delivery queue shares identity, cards, dialogs and payment controls with PDV. */
function PdvDelivery({ user, onBack }) {
  const { useState, useEffect, useRef } = React;
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(user.role === 'ENTREGADOR' ? 'available' : 'preparing');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const loading = useRef(false); const requested = useRef(false); const latest = useRef(null); const selectedRef = useRef(null); selectedRef.current = selected;
  const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
        if (next.available.some((order) => !previous.has(order.id))) setNotice('🔔 Nova entrega disponível!');
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
    const stream = new EventSource('/api/caixa/orders/stream');
    stream.addEventListener('orders-changed', refresh); stream.addEventListener('stream-fallback', refresh);
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { clearInterval(timer); stream.close(); document.removeEventListener('visibilitychange', visible); };
  }, []);
  const act = async (order, action, payload = {}) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await request('/api/caixa/deliveries/' + encodeURIComponent(order.id) + '/' + action, payload);
      if (action === 'accept') setTab('inRoute');
      if (result.order?.deliveryStatus === 'DELIVERED') setTab('completed');
      setSelected(result.order || null); selectedRef.current = result.order || null;
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const settled = (order) => Boolean(order.completedAt && ['APPROVED', 'ON_ACCOUNT'].includes(order.paymentStatus));
  const ownRoute = selected?.deliveryStatus === 'OUT_FOR_DELIVERY' && (user.role === 'ADMIN' || selected.assignedDriver?.id === user.id);
  const tabs = [
    ...(user.role === 'ENTREGADOR' ? [] : [{ id: 'preparing', label: 'Preparando' }]),
    { id: 'available', label: 'Disponíveis' }, { id: 'inRoute', label: user.role === 'ENTREGADOR' ? 'Minhas entregas' : 'Em rota' }, { id: 'completed', label: 'Concluídas' },
  ];
  const navigation = selected ? window.ConfloraDeliveryMaps.navigation(selected.deliveryLocation, selected.deliveryAddress) : null;
  const details = selected && <div className="my-3 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
    <p className="text-xs font-bold">{selected.paymentStatus === 'ON_ACCOUNT' ? 'Fiado autorizado pelo caixa' : settled(selected) ? (selected.deliveryStatus === 'DELIVERED' ? '✓ Pagamento registrado' : '✓ Pagamento já registrado — apenas confirme a entrega') : 'Pagamento a receber na entrega'}</p>
    <p className="text-xs font-bold">{selected.deliveryStatus === 'DELIVERED' ? '✓ Entrega concluída' : selected.deliveryStatus === 'OUT_FOR_DELIVERY' ? '🛵 Em rota' : 'Pedido aguardando saída'}</p>
    <p className="text-sm">{selected.deliveryAddress}</p>
    {selected.deliveryLocation?.reference && <p className="text-xs">Referência: {selected.deliveryLocation.reference}</p>}
    {selected.customerPhone && <a className="inline-flex text-sm font-bold text-emerald-800 underline" href={'tel:+' + String(selected.customerPhone).replace(/\D/g, '')}>Ligar para o cliente</a>}
    <div className="flex flex-wrap gap-2"><a className={actionClass} href={navigation.google} target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a><a className={actionClass} href={navigation.waze} target="_blank" rel="noopener noreferrer">Abrir no Waze</a></div>
    <delivery-route-map key={selected.id} destination={JSON.stringify(selected.deliveryLocation || null)} address={selected.deliveryAddress || ''} />
    {selected.deliveryStatus === 'PENDING_DISPATCH' && user.role !== 'ENTREGADOR' && <button type="button" className={actionClass} disabled={busy || (selected.paymentMethod === 'PIX' && !settled(selected))} onClick={() => act(selected, 'dispatch')}>{selected.paymentMethod === 'PIX' && !settled(selected) ? 'Aguardando confirmação do Pix' : 'Pedido separado · liberar entrega'}</button>}
    {selected.deliveryStatus === 'PENDING_DELIVERY' && <button type="button" className={actionClass} disabled={busy} onClick={() => act(selected, 'accept')}>Aceitar e sair para entrega</button>}
    {ownRoute && settled(selected) && <button type="button" className={actionClass} disabled={busy} onClick={() => act(selected, 'complete')}>Confirmar entrega ao cliente</button>}
    {ownRoute && <button type="button" className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700" disabled={busy} onClick={() => act(selected, 'release')}>Devolver à fila de entregas</button>}
  </div>;
  return <main className="min-h-screen bg-[#F4F6F5] font-sans text-slate-800">
    <header className="conflora-site-header"><div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3"><PdvComponents.SiteBrand /><h1 className="text-xl font-black text-[#0F381E]">🛵 Entregas</h1><div className="flex flex-wrap items-center gap-3"><div className="text-right"><strong className="block text-sm">{user.name}</strong><span className="text-[10px] font-bold text-emerald-700">{user.role}</span></div>{user.role !== 'ENTREGADOR' && <button type="button" className={actionClass} onClick={onBack}>Voltar ao caixa</button>}<button type="button" className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.reload(); }}>Sair</button></div></div></header>
    <div className="mx-auto max-w-[1600px] p-4 sm:p-6"><nav aria-label="Etapas de entrega" className="mb-5 flex flex-wrap gap-2">{tabs.map((item) => <button key={item.id} type="button" aria-pressed={tab === item.id} onClick={() => { setTab(item.id); setNotice(''); }} className={actionClass} style={{ background: tab === item.id ? '#109e46' : 'white', color: tab === item.id ? 'white' : '#174b32', border: '1px solid #cde5d6' }}>{item.label} ({data?.[item.id]?.length || 0})</button>)}<button type="button" className={actionClass} onClick={refresh}>↻ Atualizar</button></nav>
      <p className="mb-4 text-sm text-slate-600">{user.role === 'ENTREGADOR' ? 'Aceite um pedido, siga a rota e registre a entrega. Valores pendentes são recebidos na casa do cliente.' : 'Separe os produtos e libere o pedido para o entregador. Pix pendente só é liberado após confirmação.'}</p>
      {notice && <p role="status" className="cf-order-card--attention mb-4 rounded-xl bg-amber-100 p-3 font-bold">{notice}</p>}
      {error && !selected && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {!data && <p>Carregando entregas…</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(data?.[tab] || []).map((order) => <button type="button" key={order.id} className={'rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ' + (tab === 'completed' ? 'border-emerald-200 bg-emerald-50' : tab === 'inRoute' ? 'border-sky-200 bg-sky-50' : 'border-amber-200 bg-amber-50')} onClick={() => { setSelected(order); setError(''); }}><span className="text-xs font-bold text-slate-500">Pedido #{order.ticketNumber || order.id.slice(-6)}</span><strong className="mt-2 block">{order.customerName}</strong><span className="mt-1 block text-sm">{order.deliveryAddress}</span><span className="mt-3 flex justify-between gap-2 text-sm"><strong>{money(order.total)}</strong><span>{order.paymentStatus === 'ON_ACCOUNT' ? 'Fiado autorizado' : settled(order) ? '✓ Pago' : 'Cobrar na entrega'}</span></span>{order.assignedDriver && <span className="mt-2 block text-xs">Entregador: {order.assignedDriver.name}</span>}<span className="mt-3 block text-xs font-bold text-emerald-800">Abrir pedido →</span></button>)}</div>
      {data && !data[tab]?.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Nenhuma entrega nesta etapa.</p>}
    </div>
    {selected && <PdvComponents.OrderDetails key={`${selected.id}:${selected.status}:${selected.deliveryStatus}`} order={selected} deliveryMode extraContent={details} busy={busy} error={error} canReceive={ownRoute && !settled(selected) && !selected.pixData?.txid} canConfirmManualPix={ownRoute && !settled(selected) && ['AWAITING_PIX', 'CREATING_PIX'].includes(selected.status)} onClose={() => { setSelected(null); setError(''); }} onReceive={(order, paymentMethod, receivedAmount, paymentParts, verification) => act(order, 'receive', { paymentMethod, receivedAmount, paymentParts, ...verification })} onManualPix={(order, note, proofId) => act(order, 'receive', { paymentMethod: 'PIX_MANUAL', paymentParts: order.paymentParts, manualPix: true, proofSeen: true, note, proofId })} />}
  </main>;
}
