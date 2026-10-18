/* Delivery queue shares identity, cards, dialogs and payment controls with PDV. */
function PdvDelivery({ user, onBack }) {
  const { useState, useEffect, useRef } = React;
  const [data, setData] = useState(null);
  const [pulsedOrderIds, setPulsedOrderIds] = useState(new Set());
  const pulseTimer = useRef(null);
  const [selected, setSelected] = useState(null);
  const [showRoute, setShowRoute] = useState(false);
  const [actualDistanceKm, setActualDistanceKm] = useState('');
  const [, setClock] = useState(0);
  useEffect(() => { const timer = setInterval(() => setClock(value => value + 1), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => { setShowRoute(false); setActualDistanceKm(''); }, [selected?.id]);
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
        const current = [...next.preparing, ...next.available, ...(next.separating || []), ...next.inRoute, ...next.completed].find((order) => order.id === selectedRef.current.id);
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
    let routeUnavailable = false;
    try {
      if (action === 'start') {
        let timer;
        try { payload.route = await Promise.race([window.ConfloraDeliveryMaps.estimateRoute(order.deliveryLocation, order.deliveryAddress), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Tempo limite da rota')), 6000); })]); }
        catch { routeUnavailable = true; }
        finally { clearTimeout(timer); }
      }
      if (['complete', 'receive'].includes(action) && actualDistanceKm !== '') payload.actualDistanceKm = Number(actualDistanceKm);
      const result = await request('/api/caixa/deliveries/' + encodeURIComponent(order.id) + '/' + action, payload);
      setNotice(routeUnavailable ? 'Saída registrada sem distância do mapa. Você pode informar os km percorridos ao concluir.' : '');
      setSelected(result.order || null); selectedRef.current = result.order || null;
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const settled = (order) => Boolean(order.completedAt && ['APPROVED', 'ON_ACCOUNT'].includes(order.paymentStatus));
  const ownRoute = selected?.deliveryStatus === 'OUT_FOR_DELIVERY' && (user.role === 'ADMIN' || selected.assignedDriver?.id === user.id);
  const ownPreparation = selected?.deliveryStatus === 'PREPARING_DELIVERY' && (user.role === 'ADMIN' || selected.assignedDriver?.id === user.id);
  const number = value => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const duration = seconds => seconds == null || !Number.isFinite(seconds) ? 'Sem registro' : seconds < 60 ? 'menos de 1 min' : seconds < 3600 ? `${Math.floor(seconds / 60)} min` : `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min`;
  const since = timestamp => { const seconds = (Date.now() - Date.parse(timestamp)) / 1000; return Number.isFinite(seconds) && seconds >= 0 ? duration(seconds) : 'Sem registro'; };
  const decorate = orders => (orders || []).map(order => ({ ...order, deliveryOverview: [
    ...(!order.assignedDriver && !order.deliveredBy ? ['Aguardando responsável'] : []),
    ...(order.deliveryStatus === 'PREPARING_DELIVERY' ? [`Separando há ${since(order.acceptedAt)}`] : []),
    ...(order.deliveryStatus === 'OUT_FOR_DELIVERY' ? [`${order.departedAt ? 'Saiu da horta há' : 'Em rota · horário antigo estimado há'} ${since(order.departedAt || order.acceptedAt)}`] : []),
    ...(order.deliveryStatus === 'DELIVERED' ? [`Tempo em rota: ${duration(order.deliveryMetrics?.durationSeconds ?? (Date.parse(order.deliveredAt) - Date.parse(order.departedAt || order.acceptedAt)) / 1000)}`] : []),
    ...(order.deliveryMetrics?.distanceKm ? [`${order.deliveryMetrics.distanceSource === 'DECLARED_ACTUAL' ? 'Km percorridos informados' : 'Km da rota estimada'}: ${number(order.deliveryMetrics.distanceKm)} km`] : order.deliveryRoute?.distanceMeters ? [`Rota estimada: ${number(order.deliveryRoute.distanceMeters / 1000)} km`] : []),
  ] }));
  const navigation = selected ? window.ConfloraDeliveryMaps.navigation(selected.deliveryLocation, selected.deliveryAddress) : null;
  const details = selected && <div className="my-3 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
    <p className="text-xs font-bold">{selected.paymentStatus === 'ON_ACCOUNT' ? 'Fiado aprovado pelo Admin' : settled(selected) ? (selected.deliveryStatus === 'DELIVERED' ? '✓ Pagamento registrado' : '✓ Pagamento já registrado — apenas confirme a entrega') : 'Pagamento a receber na entrega'}</p>
    <p className="text-xs font-bold">{selected.deliveryStatus === 'DELIVERED' ? '✓ Entrega concluída' : selected.deliveryStatus === 'OUT_FOR_DELIVERY' ? '🛵 Em rota' : selected.deliveryStatus === 'PREPARING_DELIVERY' ? 'Separando os produtos' : 'Aguardando entregador'}</p>
    <p className="text-sm">{selected.deliveryAddress}</p>
    {selected.deliveryLocation?.reference && <p className="text-xs">Referência: {selected.deliveryLocation.reference}</p>}
    {selected.customerPhone && <a className="inline-flex text-sm font-bold text-emerald-800 underline" href={'tel:+' + String(selected.customerPhone).replace(/\D/g, '')}>Ligar para o cliente</a>}
    <div className="flex flex-wrap gap-2"><a className={actionClass} href={navigation.google} target="_blank" rel="noopener noreferrer">Abrir no Google Maps</a><a className={actionClass} href={navigation.waze} target="_blank" rel="noopener noreferrer">Abrir no Waze</a></div>
    {selected.deliveryStatus === 'PENDING_DISPATCH' && user.role !== 'ENTREGADOR' && <button type="button" className={actionClass} disabled={busy || (selected.paymentMethod === 'PIX' && !settled(selected))} onClick={() => act(selected, 'dispatch')}>{selected.paymentMethod === 'PIX' && !settled(selected) ? 'Aguardando confirmação do Pix' : 'Pedido separado · liberar entrega'}</button>}
    {!selected.assignedDriver?.id && ['PENDING_DELIVERY', 'PENDING_DISPATCH'].includes(selected.deliveryStatus) && selected.creditApprovalStatus !== 'PENDING' && (selected.paymentMethod !== 'PIX' || settled(selected)) && <button type="button" className={actionClass} disabled={busy} onClick={() => act(selected, 'accept')}>Assumir e separar pedido</button>}
    {ownPreparation && <button type="button" className={actionClass + ' !w-full !py-4'} disabled={busy} onClick={() => act(selected, 'start')}>{busy ? 'Registrando saída…' : 'Saí da horta · iniciar entrega'}</button>}
    {ownRoute && <label className="block text-xs font-bold">Quilômetros percorridos (opcional)<input type="number" min="0.01" max="10000" step="0.01" value={actualDistanceKm} onChange={event => setActualDistanceKm(event.target.value)} placeholder="Km reais deste percurso até o cliente" className="mt-2 w-full rounded-xl border border-emerald-200 bg-white p-3" /><span className="mt-1 block font-normal text-slate-600">Sem preenchimento, a média usa a distância estimada do mapa, quando disponível.</span></label>}
    {ownRoute && settled(selected) && <button type="button" className={actionClass} disabled={busy} onClick={() => act(selected, 'complete')}>Confirmar entrega</button>}
    {(ownRoute || ownPreparation) && <button type="button" className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700" disabled={busy} onClick={() => act(selected, 'release')}>Devolver à fila de entregas</button>}
    {selected.assignedDriver?.id && !ownRoute && !ownPreparation && selected.deliveryStatus !== 'DELIVERED' && <p className="text-xs font-bold text-slate-600">Entrega de {selected.assignedDriver.name}. Somente o responsável ou Admin pode alterar.</p>}
    {selected.deliveryHistory?.length > 0 && <details className="rounded-xl border border-emerald-200 bg-white p-3 text-xs"><summary className="cursor-pointer font-bold">Histórico das etapas</summary><ol className="mt-2 space-y-2">{selected.deliveryHistory.map(event => <li key={event.id}>{new Date(event.createdAt).toLocaleString('pt-BR')} · {event.label} · {event.actor?.name}</li>)}</ol></details>}
    <button type="button" className="rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800" aria-expanded={showRoute} onClick={() => setShowRoute(value => !value)}>{showRoute ? 'Ocultar mapa da rota' : 'Ver mapa da rota'}</button>
    {showRoute && <delivery-route-map key={selected.id} destination={JSON.stringify(selected.deliveryLocation || null)} address={selected.deliveryAddress || ''} />}
  </div>;
  return <main className="min-h-screen bg-[#F4F6F5] font-sans text-slate-800">
    <PdvComponents.Topbar user={user} onCashier={onBack} /><header className="cf-page-toolbar"><div className="flex w-full flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-black text-[#0F381E]">🛵 Entregas</h1><div className="flex flex-wrap items-center gap-3"><div className="text-right"><strong className="block text-sm">{user.name}</strong><span className="text-[10px] font-bold text-emerald-700">{user.role}</span></div>{user.role !== 'ENTREGADOR' && <button type="button" className={actionClass} onClick={onBack}>Voltar ao caixa</button>}{user.role === 'ENTREGADOR' && <a href="/" className={actionClass}>Página inicial</a>}<button type="button" className="rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white" onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }); window.location.reload(); }}>Sair</button></div></div></header>
    <div className="cf-work-body mx-auto max-w-[1600px] p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Assuma o pedido, separe os produtos e toque em “Saí da horta”. Todos acompanham; somente o responsável ou Admin altera a entrega.</p><span role="status" className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">● Atualização automática</span></div>
      {notice && <p role="status" className="cf-order-card--attention mb-4 rounded-xl bg-amber-100 p-3 font-bold">{notice}</p>}
      {error && !selected && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {!data && <p>Carregando entregas…</p>}
      <div className="flex snap-x gap-4 overflow-x-auto pb-3 md:grid md:grid-cols-2 xl:grid-cols-4" aria-label="Quadro de entregas">
        <PdvComponents.CashierColumn title="AGUARDANDO ENTREGADOR" hint="Pedidos disponíveis para assumir" orders={decorate(data?.available)} tone="amber" selectedOrderId={selected?.id} pulsedOrderIds={pulsedOrderIds} onDetails={order => { setSelected(order); setError(''); }} canMove={false} />
        <PdvComponents.CashierColumn title="PEDIDOS EM SEPARAÇÃO" hint="Produtos sendo separados pelo responsável" orders={decorate(data?.separating)} tone="blue" selectedOrderId={selected?.id} pulsedOrderIds={new Set()} onDetails={order => { setSelected(order); setError(''); }} canMove={false} />
        <PdvComponents.CashierColumn title="EM ROTA" hint="Saída da horta registrada · tempo atualizado" orders={decorate(data?.inRoute)} tone="blue" selectedOrderId={selected?.id} pulsedOrderIds={new Set()} onDetails={order => { setSelected(order); setError(''); }} canMove={false} />
        <PdvComponents.CashierColumn title="PEDIDOS FINALIZADOS/ENTREGUE" hint="Últimas 100 entregas de toda a equipe" orders={decorate(data?.completed)} tone="green" selectedOrderId={selected?.id} pulsedOrderIds={new Set()} onDetails={order => { setSelected(order); setError(''); }} canMove={false} />
      </div>
      <details className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4">
        <summary className="cursor-pointer font-bold text-emerald-900">Desempenho dos entregadores</summary>
        <p className="my-3 text-xs text-slate-500">Métricas acumuladas desde esta atualização. Tempo da saída até a conclusão no cliente; distância de ida. Km informados e estimados são calculados separadamente. Não há rastreamento GPS contínuo.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(data?.performance || []).map(row => <section key={row.driver.id} className="rounded-xl border border-slate-200 p-4 text-sm"><h3 className="font-bold">{row.driver.name}</h3><p>{row.deliveries} entrega(s) · Média: {row.averageMinutes === null ? 'Sem horário registrado' : `${number(row.averageMinutes)} min/entrega`}</p><p className="mt-2 text-xs">Km informados: {number(row.actualKm)} km · {row.actualMinutesPerKm === null ? 'Sem amostra' : `${number(row.actualMinutesPerKm)} min/km (${row.actualSamples} entrega(s))`}</p><p className="mt-1 text-xs">Rota estimada: {number(row.estimatedKm)} km · {row.estimatedMinutesPerKm === null ? 'Sem amostra' : `${number(row.estimatedMinutesPerKm)} min/km (${row.estimatedSamples} entrega(s))`}</p></section>)}</div>
        {!data?.performance?.length && <p className="mt-3 text-sm text-slate-500">As médias aparecerão após concluir as entregas.</p>}
      </details>
    </div>
    {selected && <PdvComponents.OrderDetails key={`${selected.id}:${selected.status}:${selected.deliveryStatus}`} order={selected} deliveryMode extraContent={details} busy={busy} error={error} canReceive={ownRoute && !settled(selected) && !selected.pixData?.txid} canConfirmManualPix={ownRoute && !settled(selected) && ['AWAITING_PIX', 'CREATING_PIX'].includes(selected.status)} onClose={() => { setSelected(null); setError(''); }} onReceive={(order, paymentMethod, receivedAmount, paymentParts, verification) => act(order, 'receive', { paymentMethod, receivedAmount, paymentParts, ...verification })} onManualPix={(order, note, proofId) => act(order, 'receive', { paymentMethod: 'PIX_MANUAL', paymentParts: order.paymentParts, manualPix: true, proofSeen: true, note, proofId })} />}
  </main>;
}
