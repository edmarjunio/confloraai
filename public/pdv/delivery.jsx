/* Delivery queue shares identity, cards, dialogs and payment controls with PDV. */
function PdvDelivery({ user, onBack }) {
  const { useState, useEffect, useRef } = React;
  const [data, setData] = useState(null);
  const [mobileStage, setMobileStage] = useState('available');
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
    const result = await response.json(); if (!response.ok) throw new Error(result.error || 'could_not_update_delivery'.tr); return result;
  };
  const refresh = async () => {
    if (loading.current) { requested.current = true; return; }
    loading.current = true;
    try {
      const next = await request('/api/caixa/deliveries');
      if (latest.current) {
        const previous = new Set(latest.current.available.map((order) => order.id));
        const incoming = next.available.filter(order => !previous.has(order.id)).map(order => order.id);
        if (incoming.length) { setNotice('new_delivery_waiting_to_be_packed'.tr); setPulsedOrderIds(new Set(incoming)); clearTimeout(pulseTimer.current); pulseTimer.current = setTimeout(() => setPulsedOrderIds(new Set()), 10000); }
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
  const [serviceRating, setServiceRating] = useState(5);
  const [deliveryRating, setDeliveryRating] = useState(5);
  const [feedbackHighlights, setFeedbackHighlights] = useState([]);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [editingFeedback, setEditingFeedback] = useState(false);

  const act = async (order, action, payload = {}) => {
    if (busy) return;
    setBusy(true); setError('');
    let routeUnavailable = false;
    try {
      if (action === 'start') {
        let timer;
        try { payload.route = await Promise.race([window.ConfloraDeliveryMaps.estimateRoute(order.deliveryLocation, order.deliveryAddress), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('route_time_limit'.tr)), 6000); })]); }
        catch { routeUnavailable = true; }
        finally { clearTimeout(timer); }
      }
      if (['complete', 'receive'].includes(action) && actualDistanceKm !== '') payload.actualDistanceKm = Number(actualDistanceKm);
      const result = await request('/api/caixa/deliveries/' + encodeURIComponent(order.id) + '/' + action, payload);
      if (result.order?.deliveryStatus === 'PREPARING_DELIVERY') setMobileStage('separating');
      if (result.order?.deliveryStatus === 'OUT_FOR_DELIVERY') setMobileStage('inRoute');
      if (result.order?.deliveryStatus === 'DELIVERED') setMobileStage('completed');
      if (['complete', 'receive'].includes(action) && result.order?.deliveryStatus === 'DELIVERED') {
        setNotice('delivery_completed_please_rate_the_service_and_delivery_of_this_order_below'.tr);
        setEditingFeedback(true);
      } else {
        setNotice(routeUnavailable ? 'departure_recorded_without_map_distance_you_can_enter_the_km_traveled_upon_completion'.tr : '');
      }
      setSelected(result.order || null); selectedRef.current = result.order || null;
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const submitDeliveryFeedback = async (order) => {
    if (!order?.id || busy) return;
    setBusy(true); setError('');
    try {
      const result = await request('/api/caixa/deliveries/' + encodeURIComponent(order.id) + '/feedback', {
        serviceRating,
        deliveryRating,
        highlights: feedbackHighlights,
        comment: feedbackComment.trim(),
      });
      setSelected(result.order || order);
      selectedRef.current = result.order || order;
      setEditingFeedback(false);
      setNotice('post_delivery_review_successfully_registered'.tr);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const settled = (order) => Boolean(order.completedAt && ['APPROVED', 'ON_ACCOUNT'].includes(order.paymentStatus));
  const ownRoute = selected?.deliveryStatus === 'OUT_FOR_DELIVERY' && (user.role === 'ADMIN' || selected.assignedDriver?.id === user.id);
  const ownPreparation = selected?.deliveryStatus === 'PREPARING_DELIVERY' && (user.role === 'ADMIN' || selected.assignedDriver?.id === user.id);
  const number = value => Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  const duration = seconds => seconds == null || !Number.isFinite(seconds) ? 'no_record'.tr : seconds < 60 ? 'less_than_1_min'.tr : seconds < 3600 ? `${Math.floor(seconds / 60)} min` : `${Math.floor(seconds / 3600)} h ${Math.floor(seconds % 3600 / 60)} min`;
  const since = timestamp => { const seconds = (Date.now() - Date.parse(timestamp)) / 1000; return Number.isFinite(seconds) && seconds >= 0 ? duration(seconds) : 'no_record'.tr; };
  const decorate = orders => (orders || []).map(order => ({ ...order, deliveryOverview: [
    ...(!order.assignedDriver && !order.deliveredBy ? ['waiting_for_responsible_person'.tr] : []),
    ...(order.deliveryStatus === 'PREPARING_DELIVERY' ? [`${'packing_for'.tr} ${since(order.acceptedAt)}`] : []),
    ...(order.deliveryStatus === 'OUT_FOR_DELIVERY' ? [`${order.departedAt ? 'left_the_nursery'.tr : 'on_route_old_estimated_time'.tr} ${since(order.departedAt || order.acceptedAt)}`] : []),
    ...(order.deliveryStatus === 'DELIVERED' ? [`${'time_on_route'.tr} ${duration(order.deliveryMetrics?.durationSeconds ?? (Date.parse(order.deliveredAt) - Date.parse(order.departedAt || order.acceptedAt)) / 1000)}`] : []),
    ...(order.deliveryMetrics?.distanceKm ? [`${order.deliveryMetrics.distanceSource === 'DECLARED_ACTUAL' ? 'Km percorridos informados' : 'estimated_route_km'.tr}: ${number(order.deliveryMetrics.distanceKm)} km`] : order.deliveryRoute?.distanceMeters ? [`Rota estimada: ${number(order.deliveryRoute.distanceMeters / 1000)} km`] : []),
    ...(order.feedback?.submittedAt ? [`${'post_delivery_review_864a77'.tr} ${order.feedback.overallRating}/5 (Atendimento ${order.feedback.serviceRating}/5 · Entrega ${order.feedback.deliveryRating}/5)`] : []),
  ] }));
  const navigation = selected ? window.ConfloraDeliveryMaps.navigation(selected.deliveryLocation, selected.deliveryAddress) : null;
  const [checkedItems, setCheckedItems] = useState({});
  const [showSeparation, setShowSeparation] = useState(false);

  useEffect(() => {
    setShowSeparation(false);
    setServiceRating(selected?.feedback?.serviceRating || 5);
    setDeliveryRating(selected?.feedback?.deliveryRating || 5);
    setFeedbackHighlights(Array.isArray(selected?.feedback?.highlights) ? selected.feedback.highlights : []);
    setFeedbackComment(selected?.feedback?.comment || '');
    setEditingFeedback(false);
  }, [selected?.id]);

  const notifyArrival = async (targetOrder) => {
    const o = targetOrder || selected;
    if (!o?.id || busy || o.arrivingNotifiedAt) return;
    try {
      await request(`/api/caixa/deliveries/${encodeURIComponent(o.id)}/notify-arriving`);
      setNotice('whatsapp_sent_delivery_person_is_arriving_at_your_address'.tr);
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
            <span className="text-[11px] font-black uppercase tracking-wider text-sky-800 bg-sky-200/80 px-2 py-0.5 rounded-full"> {'on_delivery_route'.tr} </span>
            <span className="text-xs font-bold text-slate-500">
              {since(selected.departedAt || selected.acceptedAt)} {'on_route_a6e39b'.tr} </span>
          </div>
          <p className="text-sm font-black text-slate-800 leading-snug mt-1">{selected.deliveryAddress}</p>
          {selected.deliveryLocation?.reference && (
            <p className="text-xs text-slate-600 mt-0.5 font-medium"> {'ref'.tr} {selected.deliveryLocation.reference}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {selected.customerPhone && (
              <a className="cf-button !rounded-xl !bg-white !border !border-emerald-300 !text-emerald-900 !px-3 !py-1.5 text-xs font-bold inline-flex items-center gap-1 shadow-2xs" href={'tel:+' + String(selected.customerPhone).replace(/\D/g, '')}> {'call'.tr} {selected.customerPhone})
              </a>
            )}
            <a className="cf-button !rounded-xl !bg-sky-600 hover:!bg-sky-700 !text-white !px-3 !py-1.5 text-xs font-bold inline-flex items-center gap-1 ml-auto shadow-2xs" href={navigation.google} target="_blank" rel="noopener noreferrer"> {'google_maps'.tr} </a>
            <a className="cf-button !rounded-xl !bg-indigo-600 hover:!bg-indigo-700 !text-white !px-3 !py-1.5 text-xs font-bold inline-flex items-center gap-1 shadow-2xs" href={navigation.waze} target="_blank" rel="noopener noreferrer"> {'waze'.tr} </a>
          </div>
        </div>

        {/* Proximity alert status / button */}
        {selected.arrivingNotifiedAt ? (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-100/90 border border-emerald-300 text-xs font-black text-emerald-900">
            <span className="text-base">✅</span>
            <span>{'whatsapp_customer_notified_that_the_delivery_person_is_arriving'.tr}</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => notifyArrival(selected)}
            disabled={busy}
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>📢</span>
            <span>{'notify_on_whatsapp_that_i_am_arriving_500m'.tr}</span>
          </button>
        )}

        {/* Optional distance entry */}
        {ownRoute && (
          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
            <label className="block text-[11px] font-bold text-slate-600"> {'actual_km_for_this_route_optional'.tr} <input
                type="number"
                min="0.01"
                max="10000"
                step="0.01"
                value={actualDistanceKm}
                onChange={event => setActualDistanceKm(event.target.value)}
                placeholder={'ex_3_2'.tr}
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
            {busy ? 'concluding'.tr : 'confirm_that_delivery_was_made'.tr}
          </button>
        )}
      </div>
    )}

    {/* PREPARING_DELIVERY flow: Separation & departure */}
    {selected.deliveryStatus === 'PREPARING_DELIVERY' && (
      <div className="space-y-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-full"> {'picking_items'.tr} </span>
            <span className="text-xs font-bold text-slate-500"> {'packing_for'.tr} {since(selected.acceptedAt)}
            </span>
          </div>
          <p className="text-sm font-black text-slate-800 leading-snug mt-1">{selected.deliveryAddress}</p>
          {selected.deliveryLocation?.reference && (
            <p className="text-xs text-slate-600 mt-0.5 font-medium"> {'ref'.tr} {selected.deliveryLocation.reference}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowSeparation(true)}
          className="w-full py-3.5 px-4 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-black shadow-md transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>📦</span>
          <span> {'check_and_separate_items'.tr} {(selected.items || []).length} {'products'.tr}</span>
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
            {busy ? 'recording_departure'.tr : 'left_the_nursery_start_route_in_maps'.tr}
          </button>
        )}

        {ownPreparation && (
          <button
            type="button"
            className="w-full py-2 rounded-xl border border-red-200 bg-white text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer transition"
            disabled={busy}
            onClick={() => act(selected, 'release')}
          > {'return_to_delivery_queue'.tr} </button>
        )}
      </div>
    )}

    {/* PENDING_DELIVERY / PENDING_DISPATCH flow */}
    {['PENDING_DELIVERY', 'PENDING_DISPATCH'].includes(selected.deliveryStatus) && (
      <div className="space-y-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-full"> {'waiting_for_driver_61c0de'.tr} </span>
            <span className="text-xs font-black text-emerald-800">
              {settled(selected) ? 'paid'.tr : `Cobrar: ${window.PdvComponents.money ? window.PdvComponents.money(selected.total) : 'R$ ' + Number(selected.total || 0).toFixed(2)}`}
            </span>
          </div>
          <p className="text-sm font-black text-slate-800 leading-snug mt-1">{selected.deliveryAddress}</p>
          {selected.deliveryLocation?.reference && (
            <p className="text-xs text-slate-600 mt-0.5 font-medium"> {'ref'.tr} {selected.deliveryLocation.reference}</p>
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
            <span>{'take_and_pack_this_order'.tr}</span>
          </button>
        )}

        {selected.deliveryStatus === 'PENDING_DISPATCH' && user.role !== 'ENTREGADOR' && (
          <button
            type="button"
            className="w-full py-3.5 px-4 text-sm font-black rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white shadow-md transition active:scale-98 cursor-pointer"
            disabled={busy || (selected.paymentMethod === 'PIX' && !settled(selected))}
            onClick={() => act(selected, 'dispatch')}
          >
            {selected.paymentMethod === 'PIX' && !settled(selected) ? 'waiting_for_pix_confirmation'.tr : 'order_packed_at_counter_release_delivery'.tr}
          </button>
        )}
      </div>
    )}

    {/* DELIVERED flow: Post-purchase feedback for Conflora service and delivery */}
    {selected.deliveryStatus === 'DELIVERED' && (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3" aria-label={'post_delivery_review'.tr}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <span className="text-xs font-bold text-emerald-800">{'order_delivered_post_purchase_review'.tr}</span>
            <h3 className="text-sm font-black text-slate-900 mt-0.5">{'experience_with_conflora_service_and_delivery'.tr}</h3>
          </div>
          {selected.feedback?.submittedAt && !editingFeedback && (
            <button
              type="button"
              onClick={() => setEditingFeedback(true)}
              className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-50 cursor-pointer"
            > {'edit_review'.tr} </button>
          )}
        </div>

        {selected.feedback?.submittedAt && !editingFeedback ? (
          <div className="rounded-xl border border-emerald-200 bg-white p-3 space-y-1.5 text-xs">
            <p className="font-bold text-amber-700"> {'conflora_support'.tr} {'★'.repeat(selected.feedback.serviceRating)}{'☆'.repeat(5 - selected.feedback.serviceRating)} ({selected.feedback.serviceRating}/5)
              {' · '} {'delivery_cdbdf1'.tr} {'★'.repeat(selected.feedback.deliveryRating)}{'☆'.repeat(5 - selected.feedback.deliveryRating)} ({selected.feedback.deliveryRating}/5)
            </p>
            {selected.feedback.highlights?.length > 0 && (
              <p className="text-slate-600">{selected.feedback.highlights.join(' · ')}</p>
            )}
            {selected.feedback.comment && (
              <p className="italic text-slate-800">“{selected.feedback.comment}”</p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-white p-3.5 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                <span>{'conflora_service_and_seedling_quality'.tr}</span>
                <span className="text-emerald-700">{serviceRating}/5 estrelas</span>
              </div>
              <div className="flex gap-1.5" role="group" aria-label={'rating_for_conflora_service'.tr}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`Atendimento: ${star} ${star === 1 ? 'star'.tr : 'stars'.tr}`}
                    aria-pressed={serviceRating === star}
                    onClick={() => setServiceRating(star)}
                    className={`min-w-[42px] min-h-[42px] rounded-xl border text-lg font-bold transition cursor-pointer ${star <= serviceRating ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
                  >
                    {star <= serviceRating ? '★' : '☆'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-1.5">
                <span>{'delivery_and_transport_experience'.tr}</span>
                <span className="text-emerald-700">{deliveryRating}/5 estrelas</span>
              </div>
              <div className="flex gap-1.5" role="group" aria-label={'rating_for_delivery'.tr}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    aria-label={`${'delivery_cdbdf1'.tr} ${star} ${star === 1 ? 'star'.tr : 'stars'.tr}`}
                    aria-pressed={deliveryRating === star}
                    onClick={() => setDeliveryRating(star)}
                    className={`min-w-[42px] min-h-[42px] rounded-xl border text-lg font-bold transition cursor-pointer ${star <= deliveryRating ? 'border-amber-400 bg-amber-50 text-amber-600' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
                  >
                    {star <= deliveryRating ? '★' : '☆'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-bold text-slate-700 mb-1.5">{'order_highlights_optional'.tr}</span>
              <div className="flex flex-wrap gap-1.5">
                {['flawless_well_protected_plants'.tr, 'on_time_delivery'.tr, 'careful_transport'.tr, 'attentive_customer_care'.tr, 'complete_and_checked_order'.tr].map(tag => {
                  const active = feedbackHighlights.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFeedbackHighlights(prev => prev.includes(tag) ? prev.filter(item => item !== tag) : [...prev, tag])}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${active ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block text-xs font-bold text-slate-700"> {'comment_about_service_and_delivery_optional'.tr} <textarea
                rows={2}
                maxLength={500}
                value={feedbackComment}
                onChange={event => setFeedbackComment(event.target.value)}
                placeholder={'how_the_plants_arrived_or_customer_notes'.tr}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-normal text-slate-800"
              />
            </label>

            <div className="flex justify-end gap-2 pt-1">
              {selected.feedback?.submittedAt && (
                <button
                  type="button"
                  onClick={() => setEditingFeedback(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 cursor-pointer"
                > {'product_entry_cancel'.tr} </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => submitDeliveryFeedback(selected)}
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition cursor-pointer"
              >
                {busy ? 'saving'.tr : selected.feedback?.submittedAt ? 'update_review'.tr : 'save_post_delivery_review'.tr}
              </button>
            </div>
          </div>
        )}
      </section>
    )}
  </div>;

  return <main className="cf-delivery-page min-h-screen bg-[#F4F6F5] font-sans text-slate-800">
    <PdvComponents.Topbar user={user} onCashier={onBack} /><header className="cf-page-toolbar"><div className="cf-delivery-heading flex w-full flex-wrap items-center justify-between gap-3"><a className="cf-back-button" href="/">Início</a>{user.role !== 'ENTREGADOR' && <button type="button" className="cf-back-button" onClick={onBack}>Caixa</button>}<h1 className="text-xl font-black text-[#0F381E]"> {'deliveries_506da8'.tr} </h1><div className="flex flex-wrap items-center gap-3"><div className="text-right"><strong className="block text-sm">{user.name}</strong><span className="text-[10px] font-bold text-emerald-700">{user.role}</span></div><button type="button" className="cf-danger-button" onClick={async () => { await window.ConfloraSession.apiFetch('/api/auth/logout', { method: 'POST' }); window.location.reload(); }}>{'team_logout'.tr}</button></div></div></header>
    <div className="cf-work-body w-full max-w-none p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">{'take_the_order_pack_the_products_and_tap_left_the_nursery_everyone_follows_only_the_p'.tr}</p><span role="status" className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800">{'automatic_update'.tr}</span></div>
      {notice && <p role="status" className="cf-order-card--attention mb-4 rounded-xl bg-amber-100 p-3 font-bold">{notice}</p>}
      {error && !selected && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      {!data && <p>{'loading_deliveries'.tr}</p>}
      <nav className="cf-delivery-stage-tabs" aria-label="Etapas das entregas">{[['available','Disponíveis'],['separating','Separar'],['inRoute','Em rota'],['completed','Concluídas']].map(([key,label]) => <button type="button" key={key} aria-pressed={mobileStage === key} onClick={() => setMobileStage(key)}>{label} <span>{(data?.[key] || []).length}</span></button>)}</nav>
      <div data-mobile-stage={mobileStage} className="cf-delivery-board grid w-full grid-cols-1 gap-4 pb-3 md:grid-cols-2 xl:grid-cols-4" aria-label={'delivery_board'.tr}>
        <PdvComponents.CashierColumn title={'waiting_for_driver_a1232a'.tr} hint="Pedidos disponíveis para assumir" orders={decorate(data?.available)} tone="amber" selectedOrderId={selected?.id} pulsedOrderIds={pulsedOrderIds} onDetails={order => { setSelected(order); setError(''); }} canMove={false} />
        <PdvComponents.CashierColumn title={'orders_being_packed'.tr} hint="Produtos sendo separados pelo responsável" orders={decorate(data?.separating)} tone="blue" selectedOrderId={selected?.id} pulsedOrderIds={new Set()} onDetails={order => { setSelected(order); setError(''); }} canMove={false} />
        <PdvComponents.CashierColumn title={'on_route'.tr} hint="Saída da horta registrada · tempo atualizado" orders={decorate(data?.inRoute)} tone="blue" selectedOrderId={selected?.id} pulsedOrderIds={new Set()} onDetails={order => { setSelected(order); setError(''); }} canMove={false} />
        <PdvComponents.CashierColumn title={'completed_delivered_orders'.tr} hint="Últimas 100 entregas de toda a equipe" orders={decorate(data?.completed)} tone="green" selectedOrderId={selected?.id} pulsedOrderIds={new Set()} onDetails={order => { setSelected(order); setError(''); }} canMove={false} />
      </div>
      <details className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4">
        <summary className="cursor-pointer font-bold text-emerald-900">{'delivery_personnel_performance'.tr}</summary>
        <p className="my-3 text-xs text-slate-500">{'accumulated_metrics_since_this_update_time_from_departure_to_customer_completion_one_'.tr}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{(data?.performance || []).map(row => <section key={row.driver.id} className="rounded-xl border border-slate-200 p-4 text-sm"><h3 className="font-bold">{row.driver.name}</h3><p>{row.deliveries} {'delivery_ies_average'.tr} {row.averageMinutes === null ? 'no_recorded_time'.tr : `${number(row.averageMinutes)} ${'min_delivery'.tr}`}</p><p className="mt-2 text-xs"> {'reported_km'.tr} {number(row.actualKm)} {'km'.tr} {row.actualMinutesPerKm === null ? 'no_sample'.tr : `${number(row.actualMinutesPerKm)} min/km (${row.actualSamples} ${'delivery_ies'.tr}`}</p><p className="mt-1 text-xs"> {'estimated_route'.tr} {number(row.estimatedKm)} {'km'.tr} {row.estimatedMinutesPerKm === null ? 'no_sample'.tr : `${number(row.estimatedMinutesPerKm)} min/km (${row.estimatedSamples} ${'delivery_ies'.tr}`}</p></section>)}</div>
        {!data?.performance?.length && <p className="mt-3 text-sm text-slate-500">{'averages_will_appear_after_completing_deliveries'.tr}</p>}
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
      onReviewed={async (reviewedOrder) => { setSelected(reviewedOrder || selected); await refresh(); }}
      onStartDelivery={ownPreparation ? () => act(selected, 'start') : undefined}
      onAcceptDelivery={(!selected.assignedDriver?.id && ['PENDING_DELIVERY', 'PENDING_DISPATCH'].includes(selected.deliveryStatus)) ? () => handleAcceptOrder(selected) : undefined}
      onCompleteDelivery={(ownRoute && settled(selected)) ? () => act(selected, 'complete') : undefined}
      navigation={navigation}
      showSeparationModalInitial={showSeparation}
      onCloseSeparationModal={() => setShowSeparation(false)}
    />}
  </main>;
}
