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
    const response = await window.ConfloraSession.apiFetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
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
    refresh();
    const stop = window.ConfloraSession.watchOrderUpdates(refresh);
    return () => { stop(); clearTimeout(pulseTimer.current); };
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
  const [checkedItems, setCheckedItems] = useState({});
  const [showSeparation, setShowSeparation] = useState(false);

  useEffect(() => {
    setShowSeparation(false);
  }, [selected?.id]);

  const notifyArrival = async (targetOrder) => {
    const o = targetOrder || selected;
    if (!o?.id || busy || o.arrivingNotifiedAt) return;
    try {
      await request(`/api/caixa/deliveries/${encodeURIComponent(o.id)}/notify-arriving`);
      setNotice('🛵 WhatsApp enviado: Entregador está chegando no seu endereço!');
      await refresh();
    } catch (err) {
      setError('Aviso WhatsApp: ' + err.message);
    }
  };

  // Watch position when order is OUT_FOR_DELIVERY to auto-notify within ~500m
  useEffect(() => {
    if (!selected || selected.deliveryStatus !== 'OUT_FOR_DELIVERY' || selected.arrivingNotifiedAt) return;
    const destLat = Number(selected.deliveryLocation?.lat);
    const destLng = Number(selected.deliveryLocation?.lng);
    if (!Number.isFinite(destLat) || !Number.isFinite(destLng)) return;
    if (!('geolocation' in navigator)) return;

    let notified = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (notified) return;
        const currentLat = position.coords.latitude;
        const currentLng = position.coords.longitude;
        const R = 6371;
        const dLat = (destLat - currentLat) * Math.PI / 180;
        const dLon = (destLng - currentLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(currentLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        if (distanceKm <= 0.5) {
          notified = true;
          notifyArrival(selected);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [selected?.id, selected?.deliveryStatus, selected?.arrivingNotifiedAt]);

  const handleAcceptOrder = async (order) => {
    await act(order, 'accept');
    setShowSeparation(true);
  };

  const details = selected && <div className="my-2 space-y-2.5">
    {/* Minimalist OUT_FOR_DELIVERY flow: Driver is on route/at client, only needs route & payment */}
    {selected.deliveryStatus === 'OUT_FOR_DELIVERY' && (
      <div className="space-y-3">
        <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-sky-800 bg-sky-200/80 px-2 py-0.5 rounded-full">
              🛵 Em Rota de Entrega
            </span>
            <span className="text-xs font-bold text-slate-500">
              {since(selected.departedAt || selected.acceptedAt)} em rota
            </span>
          </div>
          <p className="text-sm font-black text-slate-800 leading-snug mt-1">{selected.deliveryAddress}</p>
          {selected.deliveryLocation?.reference && (
            <p className="text-xs text-slate-600 mt-0.5 font-medium">Ref: {selected.deliveryLocation.reference}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {selected.customerPhone && (
              <a className="cf-button !rounded-xl !bg-white !border !border-emerald-300 !text-emerald-900 !px-3 !py-1.5 text-xs font-bold inline-flex items-center gap-1 shadow-2xs" href={'tel:+' + String(selected.customerPhone).replace(/\D/g, '')}>
                📞 Ligar ({selected.customerPhone})
              </a>
            )}
            <a className="cf-button !rounded-xl !bg-sky-600 hover:!bg-sky-700 !text-white !px-3 !py-1.5 text-xs font-bold inline-flex items-center gap-1 ml-auto shadow-2xs" href={navigation.google} target="_blank" rel="noopener noreferrer">
              🗺️ Google Maps
            </a>
            <a className="cf-button !rounded-xl !bg-indigo-600 hover:!bg-indigo-700 !text-white !px-3 !py-1.5 text-xs font-bold inline-flex items-center gap-1 shadow-2xs" href={navigation.waze} target="_blank" rel="noopener noreferrer">
              🚗 Waze
            </a>
          </div>
        </div>

        {/* Proximity alert status / button */}
        {selected.arrivingNotifiedAt ? (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-100/90 border border-emerald-300 text-xs font-black text-emerald-900">
            <span className="text-base">✅</span>
            <span>WhatsApp: Cliente avisado que o entregador está chegando!</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => notifyArrival(selected)}
            disabled={busy}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>📢</span>
            <span>Avisar no WhatsApp que estou chegando (~500m)</span>
          </button>
        )}

        {/* Optional distance entry */}
        {ownRoute && (
          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-600">
              Km reais deste percurso (opcional):
              <input
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                value={actualDistanceKm}
                onChange={event => setActualDistanceKm(event.target.value)}
                placeholder="Ex.: 3.2"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold"
              />
            </label>
          </div>
        )}

        {/* If already settled, direct completion button */}
        {ownRoute && settled(selected) && (
          <button
            type="button"
            className="w-full py-4 px-6 text-base font-black rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl ring-4 ring-emerald-500/30 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            disabled={busy}
            onClick={() => act(selected, 'complete')}
          >
            {busy ? 'Concluindo…' : '✅ Confirmar que a entrega foi realizada'}
          </button>
        )}
      </div>
    )}

    {/* PREPARING_DELIVERY flow: Separation & departure */}
    {selected.deliveryStatus === 'PREPARING_DELIVERY' && (
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-full">
              📦 Em Separação dos Itens
            </span>
            <span className="text-xs font-bold text-slate-500">
              Separando há {since(selected.acceptedAt)}
            </span>
          </div>
          <p className="text-sm font-black text-slate-800 leading-snug mt-1">{selected.deliveryAddress}</p>
          {selected.deliveryLocation?.reference && (
            <p className="text-xs text-slate-600 mt-0.5 font-medium">Ref: {selected.deliveryLocation.reference}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowSeparation(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-black shadow-md transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>📦</span>
          <span>Conferir e Separar Itens ({(selected.items || []).length} produtos)</span>
        </button>

        {ownPreparation && (
          <button
            type="button"
            className="w-full py-4 px-6 text-base font-black rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl ring-4 ring-emerald-500/30 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            disabled={busy}
            onClick={() => {
              act(selected, 'start');
              if (navigation?.google) window.open(navigation.google, '_blank');
            }}
          >
            {busy ? 'Registrando saída…' : '🛵 Saí da horta · Iniciar rota no Maps'}
          </button>
        )}

        {ownPreparation && (
          <button
            type="button"
            className="w-full py-2 rounded-xl border border-red-200 bg-white text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer transition"
            disabled={busy}
            onClick={() => act(selected, 'release')}
          >
            Devolver à fila de entregas
          </button>
        )}
      </div>
    )}

    {/* PENDING_DELIVERY / PENDING_DISPATCH flow */}
    {['PENDING_DELIVERY', 'PENDING_DISPATCH'].includes(selected.deliveryStatus) && (
      <div className="space-y-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full">
              ⏳ Aguardando Entregador
            </span>
            <span className="text-xs font-black text-emerald-800">
              {settled(selected) ? '✅ Pago' : `Cobrar: ${window.PdvComponents.money ? window.PdvComponents.money(selected.total) : 'R$ ' + Number(selected.total || 0).toFixed(2)}`}
            </span>
          </div>
          <p className="text-sm font-black text-slate-800 leading-snug mt-1">{selected.deliveryAddress}</p>
          {selected.deliveryLocation?.reference && (
            <p className="text-xs text-slate-600 mt-0.5 font-medium">Ref: {selected.deliveryLocation.reference}</p>
          )}
        </div>

        {!selected.assignedDriver?.id && selected.creditApprovalStatus !== 'PENDING' && (selected.paymentMethod !== 'PIX' || settled(selected)) && (
          <button
            type="button"
            className="w-full py-4 px-6 text-base font-black rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xl ring-4 ring-amber-400/30 transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            disabled={busy}
            onClick={() => handleAcceptOrder(selected)}
          >
            <span>🛵</span>
            <span>Assumir e separar este pedido</span>
          </button>
        )}

        {selected.deliveryStatus === 'PENDING_DISPATCH' && user.role !== 'ENTREGADOR' && (
          <button
            type="button"
            className="w-full py-3.5 px-4 text-sm font-black rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-md transition active:scale-98 cursor-pointer"
            disabled={busy || (selected.paymentMethod === 'PIX' && !settled(selected))}
            onClick={() => act(selected, 'dispatch')}
          >
            {selected.paymentMethod === 'PIX' && !settled(selected) ? 'Aguardando confirmação do Pix' : '📦 Pedido separado no balcão · Liberar entrega'}
          </button>
        )}
      </div>
    )}
  </div>;

  return <main className="min-h-screen bg-[#F4F6F5] font-sans text-slate-800">
    <PdvComponents.Topbar user={user} onCashier={onBack} /><header className="cf-page-toolbar"><div className="flex w-full flex-wrap items-center justify-between gap-3"><button type="button" className="cf-back-button" onClick={() => user.role === 'ENTREGADOR' ? window.ConfloraNavigation.back() : onBack()}>← Voltar</button><h1 className="text-xl font-black text-[#0F381E]">🛵 Entregas</h1><div className="flex flex-wrap items-center gap-3"><div className="text-right"><strong className="block text-sm">{user.name}</strong><span className="text-[10px] font-bold text-emerald-700">{user.role}</span></div><button type="button" className="cf-danger-button" onClick={async () => { await window.ConfloraSession.apiFetch('/api/auth/logout', { method: 'POST' }); window.location.reload(); }}>Sair</button></div></div></header>
    <div className="cf-work-body w-full max-w-none p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">Assuma o pedido, separe os produtos e toque em “Saí da horta”. Todos acompanham; somente o responsável ou Admin altera a entrega.</p><span role="status" className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">● Atualização automática</span></div>
      {notice && <p role="status" className="cf-order-card--attention mb-4 rounded-xl bg-amber-100 p-3 font-bold">{notice}</p>}
      {error && !selected && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {!data && <p>Carregando entregas…</p>}
      <div className="grid w-full grid-cols-1 gap-4 pb-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Quadro de entregas">
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
    {selected && <PdvComponents.OrderDetails
      key={`${selected.id}:${selected.status}:${selected.deliveryStatus}`}
      order={selected}
      deliveryMode
      extraContent={details}
      busy={busy}
      error={error}
      canReceive={ownRoute && !settled(selected) && !selected.pixData?.txid}
      canConfirmManualPix={ownRoute && !settled(selected) && ['AWAITING_PIX', 'CREATING_PIX'].includes(selected.status)}
      onClose={() => { setSelected(null); setError(''); }}
      onReceive={(order, paymentMethod, receivedAmount, paymentParts, verification) => act(order, 'receive', { paymentMethod, receivedAmount, paymentParts, ...verification })}
      onManualPix={(order, note, proofId) => act(order, 'receive', { paymentMethod: 'PIX_MANUAL', paymentParts: order.paymentParts, manualPix: true, proofSeen: true, note, proofId })}
      onStartDelivery={ownPreparation ? () => act(selected, 'start') : undefined}
      onAcceptDelivery={(!selected.assignedDriver?.id && ['PENDING_DELIVERY', 'PENDING_DISPATCH'].includes(selected.deliveryStatus)) ? () => handleAcceptOrder(selected) : undefined}
      onCompleteDelivery={(ownRoute && settled(selected)) ? () => act(selected, 'complete') : undefined}
      navigation={navigation}
      showSeparationModalInitial={showSeparation}
      onCloseSeparationModal={() => setShowSeparation(false)}
    />}
  </main>;
}
