/* Shared PDV components loaded before the sales screen. */
window.PdvComponents = (() => {
  const { useState, useEffect, useRef } = React;
  const OrderCardSurface = window.PdvStyled?.OrderCardSurface || 'cf-card';
  const orderCardColors = Object.freeze({
    amber: { backgroundColor: '#ffec99', borderColor: '#e0aa00' },
    blue: { backgroundColor: '#bdddff', borderColor: '#4594df' },
    green: { backgroundColor: '#b8ebcf', borderColor: '#29a66a' },
    red: { backgroundColor: '#ffc9d0', borderColor: '#e65b70' },
  });
  const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  function Button3D({
    children,
    variant = 'primary',
    size = 'md',
    shape = 'pill',
    block = false,
    disabled = false,
    type = 'button',
    className = '',
    icon = null,
    onClick = null,
    style = undefined,
    title = undefined,
    ...rest
  }) {
    const fullClass = [
      'cf-btn-3d',
      `cf-btn-3d--${variant}`,
      `cf-btn-3d--${size}`,
      shape === 'rounded' ? 'cf-btn-3d--rounded' : 'cf-btn-3d--pill',
      block ? 'cf-btn-3d--block' : '',
      className
    ].filter(Boolean).join(' ');

    return (
      <button
        type={type}
        disabled={disabled}
        className={fullClass}
        onClick={onClick}
        style={style}
        title={title}
        {...rest}
      >
        {icon && <span className="cf-btn-3d__icon" aria-hidden="true">{icon}</span>}
        <span className="cf-btn-3d__text">{children}</span>
      </button>
    );
  }
  window.Button3D = Button3D;
  const button = 'cf-btn-3d cf-btn-3d--primary';
  const field = 'w-full p-3 border rounded-xl my-2';
  function LocationPicker({ value, address, onChange }) {
    const ref = useRef(null); const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
    useEffect(() => { const node = ref.current; const listener = (event) => onChangeRef.current(event.detail); node.addEventListener('locationchange', listener); return () => node.removeEventListener('locationchange', listener); }, []);
    useEffect(() => { ref.current?.setAttribute('address', address || ''); }, [address]);
    return <delivery-location-picker ref={ref} value={JSON.stringify(value || null)} address={address || ''} />;
  }
  function PaymentMethodButtons({ value, onChange, labels, disabledMethods = [], suffix = '' }) {
    return <div role="group" aria-label={'payment_methods_9da084'.tr} className="my-2 grid grid-cols-2 gap-2">{Object.entries(labels).map(([method, label]) => <button type="button" key={method} aria-pressed={value === method} disabled={disabledMethods.includes(method)} className={'cf-btn-3d cf-btn-3d--sm !py-2.5 !px-3 text-xs flex items-center justify-center ' + (value === method ? 'cf-btn-3d--primary' : 'cf-btn-3d--secondary')} onClick={() => onChange(method)}>{label}{suffix}</button>)}</div>;
  }
  function PixProofUpload({ targetType, targetId, onChange, label, hint }) {
    const [fileName, setFileName] = useState(''); const [error, setError] = useState(''); const [uploading, setUploading] = useState(false);
    const upload = async (file) => {
      onChange(''); setFileName(''); setError('');
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { setError('the_receipt_must_be_up_to_3_mb'.tr); return; }
      setUploading(true);
      try {
        const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('could_not_read_the_receipt'.tr)); reader.readAsDataURL(file); });
        const proof = await api('/api/caixa/payment-proofs', { targetType, targetId, dataUrl, fileName: file.name });
        setFileName(proof.fileName); onChange(proof.id);
      } catch (err) { setError(err.message); }
      finally { setUploading(false); }
    };
    return <div className="my-3 rounded-xl border border-sky-200 bg-white p-3"><label className="block text-xs font-bold">{label || 'pix_receipt_photo_or_pdf_required'.tr}<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-2 block w-full text-xs" onChange={(event) => upload(event.target.files[0])} disabled={uploading} /></label><p className="mt-2 text-xs text-slate-500">{uploading ? 'sending_receipt'.tr : fileName ? 'receipt_attached'.tr + " " + fileName : (hint || 'jpg_png_webp_or_pdf_up_to_3_mb'.tr)}</p>{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</div>;
  }
  function CustomerSearch({ onClose, onSelect }) {
    const [query, setQuery] = useState(''); const [rows, setRows] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
    useEffect(() => {
      const controller = new AbortController();
      setRows([]); setError(''); setLoading(query.trim().length >= 4);
      if (query.trim().length < 4) return () => controller.abort();
      const timer = setTimeout(async () => {
        setLoading(true);
        try { const response = await window.ConfloraSession.apiFetch('/api/caixa/customers?q=' + encodeURIComponent(query.trim()), { signal: controller.signal }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'could_not_fetch_customers'.tr); setRows(result); }
        catch (err) { if (err.name !== 'AbortError') setError(err.message); }
        finally { if (!controller.signal.aborted) setLoading(false); }
      }, 300);
      return () => { clearTimeout(timer); controller.abort(); };
    }, [query]);
    return <Panel title={'search_customer_73638f'.tr} layer={70} onClose={onClose}><label className="text-sm font-bold">{'customer_name_8be599'.tr}<input autoFocus className={field} placeholder={'type_at_least_4_letters_of_the_name'.tr} value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="mt-3 space-y-2">{loading && <p role="status">{'searching_customers'.tr}</p>}{error && <p role="alert" className="text-red-700">{error}</p>}{!loading && query.trim().length >= 4 && !rows.length && !error && <p>{'no_customers_found'.tr}</p>}{rows.map((customer) => <button key={customer.id} type="button" className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:shadow-md" onClick={() => onSelect(customer)}><strong className="block">{customer.name}</strong><span className="mt-1 block text-xs text-slate-600">{customer.phone || 'no_phone'.tr}{customer.address ? ' · ' + customer.address : ''}</span></button>)}</div></Panel>;
  }
  function PaymentPartsEditor({ parts, onChange, total, customerId, allowedMethods }) {
    const methodOptions = [
      { id: 'PIX', label: window.ConfloraOrderDisplay.payment("PIX") },
      { id: 'DINHEIRO', label: window.ConfloraOrderDisplay.payment('DINHEIRO') },
      { id: 'CREDITO', label: window.ConfloraOrderDisplay.payment('CREDITO') },
      { id: 'DEBITO', label: window.ConfloraOrderDisplay.payment('DEBITO') },
      { id: 'FIADO', label: window.ConfloraOrderDisplay.payment('FIADO') },
    ].filter(item => !allowedMethods || allowedMethods.includes(item.id))
     .filter(item => item.id !== 'FIADO' || customerId);

    const totalCents = Math.round(Number(total || 0) * 100);
    const update = (index, values) => onChange(parts.map((part, current) => current === index ? { ...part, ...values } : part));
    const sum = parts.reduce((value, part) => value + Math.round(Number(part.amount || 0) * 100), 0);
    const remaining = (totalCents - sum) / 100;
    const isExceeded = (val) => Math.round(Number(val || 0) * 100) > totalCents;

    return <section className="my-3 space-y-2.5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/90 p-3.5">
      <div className="flex items-center justify-between">
        <strong className="text-xs font-black text-emerald-950 uppercase tracking-wide">{'payment_methods'.tr}</strong>
        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${remaining === 0 ? 'bg-emerald-200 text-emerald-900' : remaining > 0 ? 'bg-amber-200 text-amber-900' : 'bg-red-200 text-red-900'}`}>
          {remaining === 0 ? 'total_filled'.tr : remaining > 0 ? `Falta ${money(remaining)}` : `Excesso ${money(-remaining)}`}
        </span>
      </div>
      <div className="space-y-2">
        {parts.map((part, index) => {
          const exceeded = isExceeded(part.amount);
          return (
            <div key={index} className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-white p-2.5 shadow-xs">
                <span className="text-xs font-black text-emerald-800 bg-emerald-100 rounded px-1.5 py-0.5">#{index + 1}</span>
                <select
                  value={part.method}
                  onChange={(event) => update(index, { method: event.target.value })}
                  className="flex-1 min-w-[130px] rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-800"
                >
                  {methodOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold text-slate-400">R$</span>
                  <input
                    aria-label={`${'installment_amount'.tr} ${index + 1}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={part.amount}
                    onChange={(event) => update(index, { amount: event.target.value })}
                    className={`w-28 rounded-lg p-2 text-xs font-bold ${
                      exceeded ? 'border-2 border-red-500 bg-red-50 text-red-950 ring-2 ring-red-400/30' : 'border border-slate-300 text-emerald-950'
                    }`}
                    placeholder="0,00"
                  />
                </div>
                {parts.length > 1 && <button
                  type="button"
                  title={'remove_installment'.tr}
                  aria-label={`Remover parcela ${index + 1}`}
                  className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-600 flex items-center justify-center font-bold text-xs transition cursor-pointer"
                  onClick={() => onChange(parts.filter((_, current) => current !== index))}
                >✕</button>}
              </div>
              {exceeded && (
                <p className="text-[11px] font-bold text-red-700 pl-1" role="alert"> {'amount_exceeds_the_sale_balance_the_maximum_allowed_is'.tr} {money(total)}.
                </p>
              )}
            </div>
          );
        })}
      </div>
      <div className="pt-1 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-700">
          {remaining === 0 ? 'total_amount_successfully_distributed'.tr : remaining > 0 ? `⚠️ Falta distribuir: ${money(remaining)}` : `⚠️ Excedente: ${money(-remaining)}`}
        </p>
        {parts.length < methodOptions.length && remaining > 0 && <button
          type="button"
          className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
          onClick={() => {
            const unusedMethod = methodOptions.find(opt => !parts.some(p => p.method === opt.id))?.id || methodOptions[0].id;
            onChange([...parts, { method: unusedMethod, amount: Math.max(0, remaining).toFixed(2) }]);
          }}
        > {'add_method'.tr}{money(remaining)})
        </button>}
      </div>
    </section>;
  }
  function Topbar({ user, onSearch, searchValue, searchInputRef, onCashier, hideCashier }) {
    const ref = useRef(null);
    useEffect(() => {
      const node = ref.current;
      const search = event => onSearch?.(event.detail.query);
      const cashier = () => onCashier?.();
      node.addEventListener('cf-topbar-search', search);
      node.addEventListener('cf-topbar-cashier', cashier);
      if (searchInputRef) searchInputRef.current = node.querySelector('input');
      return () => { node.removeEventListener('cf-topbar-search', search); node.removeEventListener('cf-topbar-cashier', cashier); };
    }, [onSearch, searchInputRef, onCashier]);
    return <conflora-topbar hide-cashier={hideCashier ? '' : undefined} ref={ref} local-cashier={onCashier ? '' : undefined} managed user-name={user?.name || user?.email || ''} user-role={user?.role || ''} user-photo={user?.picture || ''} local-search={onSearch ? '' : undefined} search-value={searchValue || ''} search-placeholder={onSearch ? 'name_category_or_description_ex_shade_plants_garden_plants_flowers_etc'.tr : 'header_search_placeholder'.tr}></conflora-topbar>;
  }
  function handleProductImageError(event, product) {
    const imageElement = event.currentTarget;
    const imageCandidates = Array.isArray(product.imageCandidates) ? product.imageCandidates : [];
    const nextImageIndex = Number(imageElement.dataset.imageIndex || 0) + 1;
    const nextImage = imageCandidates[nextImageIndex];
    if (nextImage) {
      imageElement.dataset.imageIndex = String(nextImageIndex);
      imageElement.src = nextImage;
      return;
    }

    const imageFallbackUrl = product.imageFallbackUrl || '/store-assets/placeholder.svg';
    const absoluteFallbackUrl = new URL(imageFallbackUrl, window.location.origin).href;
    if (!imageElement.dataset.fallbackTried && imageElement.src !== absoluteFallbackUrl) {
      imageElement.dataset.fallbackTried = 'true';
      imageElement.src = imageFallbackUrl;
      return;
    }

    const placeholderUrl = new URL('/store-assets/placeholder.svg', window.location.origin).href;
    if (imageElement.src !== placeholderUrl) imageElement.src = '/store-assets/placeholder.svg';
  }
  function Loading() {
    return <main className="min-h-screen bg-[#F4F6F5] font-sans text-slate-800"><Topbar /><button type="button" className="cf-back-button m-4" onClick={() => window.ConfloraNavigation.back()}>{'back_59dc92'.tr}</button><p className="p-8 text-center text-sm text-slate-500">{'loading_session'.tr}</p></main>;
  }
  async function api(path, body, options = {}) {
    const response = await window.ConfloraSession.apiFetch(path, { ...options, ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) { throw new Error(data.error || 'could_not_complete_the_operation'.tr); }
    return data;
  }
  function Panel({ title, onClose, children, layer = 50 }) {
    return <div style={{ zIndex: layer }} className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-3xl p-4 w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col"><div className="flex shrink-0 justify-between gap-4 mb-4"><h2 className="font-bold text-xl">{title}</h2><button onClick={onClose} aria-label={'common_close'.tr}>✕</button></div><div className="min-h-0 overflow-y-auto px-2 pb-2" style={{ scrollbarGutter: 'stable' }}>{children}</div></section></div>;
  }
  function WeightPrompt({ product, onCancel, onConfirm }) {
    const minimum = Number(product.saleUnit?.minimum) || 0.1;
    const increment = Number(product.saleUnit?.increment) || 0.1;
    const firstWholeKilogramStep = Math.max(0, Math.ceil((1 - minimum) / increment - 0.0000001));
    const initialQuantity = Number((minimum + firstWholeKilogramStep * increment).toFixed(3));
    const [quantity, setQuantity] = useState(String(initialQuantity));
    const parsedQuantity = Number(String(quantity).replace(',', '.'));
    const valid = Number.isFinite(parsedQuantity)
      && parsedQuantity >= minimum
      && Math.abs(parsedQuantity / increment - Math.round(parsedQuantity / increment)) < 0.00001;
    const unitPrice = Number(product.price || 0);

    return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section role="dialog" aria-modal="true" aria-label={`${'choose_weight_of'.tr} ${product.name}`} className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">{'sale_by_weight'.tr}</p><h2 className="mt-1 text-lg font-black leading-tight text-[#0F381E]">{product.name}</h2></div>
          <button type="button" onClick={onCancel} aria-label={'common_close'.tr} className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-500 hover:bg-slate-50">✕</button>
        </header>
        <p className="mb-3 text-sm text-slate-600">{'price'.tr} <strong className="text-emerald-800">{money(unitPrice)} / kg</strong></p>
        <label className="block text-xs font-bold text-slate-700"> {'how_many_kilos'.tr} <span className="mt-1 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-2 focus-within:ring-2 focus-within:ring-emerald-500"><input autoFocus type="text" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/[^\d.,]/g, '').replace(/(.*[.,].*)[.,]/g, '$1'))} className="w-full bg-transparent px-2 py-2 text-center text-2xl font-black text-[#0F381E] outline-none" aria-label={`${'weight_in_kilos_of'.tr} ${product.name}`} /><span className="pr-2 font-extrabold text-emerald-800">{'kg_88ed32099f'.tr}</span></span></label>
        <div className="mt-3 grid grid-cols-3 gap-2">{[0.1, 0.5, 1].map((value) => { const steps = Math.max(0, Math.ceil((value - minimum) / increment - 0.0000001)); const preset = Number((minimum + steps * increment).toFixed(3)); return <button type="button" key={value} onClick={() => setQuantity(String(preset))} className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--sm !text-xs !py-1.5 font-bold">{preset.toLocaleString('pt-BR')} {'kg'.tr}</button>; })}</div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold text-slate-600"> {'subtotal_8c0f2c'.tr} </span><strong className="text-lg font-black text-emerald-800">{money(valid ? unitPrice * parsedQuantity : 0)}</strong></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--md">{'product_entry_cancel'.tr}</button><button type="button" disabled={!valid} onClick={() => valid && onConfirm(Number(parsedQuantity.toFixed(3)))} className={'cf-btn-3d cf-btn-3d--primary cf-btn-3d--md ' + (!valid ? 'opacity-50 cursor-not-allowed' : '')}>{'add_to_cart'.tr}</button></div>
      </section>
    </div>;
  }
  function ProductInformation({ product, onClose }) {
    const details = Array.isArray(product.details) ? product.details : [];
    const variants = Array.isArray(product.variants) ? product.variants : [product];
    const imageUrl = product.image || product.imageUrl || '/store-assets/placeholder.svg';

    return <div className="cf-product-information-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={`${'information_on'.tr} ${product.name}`} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <render-image
              src={imageUrl}
              image-candidates={JSON.stringify(product.imageCandidates || [])}
              fallback-src={product.imageFallbackUrl || '/store-assets/placeholder.svg'}
              alt=""
              className="h-16 w-16 shrink-0 rounded-2xl border border-slate-100 bg-slate-50 object-cover"
            />
            <div className="min-w-0">
              <render-category-tag category={product.categoryName || product.category || 'product'.tr} />
              <h2 title={product.name} className="text-lg font-black leading-tight text-[#0F381E]">{product.name}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={'close_details'.tr} className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">✕</button>
        </header>
        <div className="space-y-3">
          {product.detailsLoading && <p role="status">Carregando informações do produto…</p>}
          {product.detailsError && <p role="alert">{product.detailsError}</p>}
          {product.media?.gallery?.filter(image => image.attribution).map(image => <p key={image.url} className="text-xs text-slate-500">{image.attribution} <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer">Licença</a></p>)}
          <section className="rounded-2xl border border-emerald-100 bg-[#F4F6F5] p-3.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">{'variations_and_values'.tr}</h3>
            <ul className="mt-2 divide-y divide-slate-200">
              {variants.map((variant) => <li key={variant.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate font-semibold text-slate-700" title={variant.name}>{variant.variation || variant.name}</span>
                <strong className="shrink-0 text-emerald-800">{money(variant.price)}</strong>
              </li>)}
            </ul>
          </section>
          {details.map((detail) => <section key={detail.label} className="rounded-2xl border border-emerald-100 bg-[#F4F6F5] p-3.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">{detail.label}</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">{detail.value}</p>
          </section>)}
          {!details.length && !product.detailsLoading && !product.detailsError && <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">{'there_is_no_additional_information_registered_for_this_product_yet'.tr}</p>}
        </div>
        <button type="button" onClick={onClose} className={button + ' mt-5 w-full py-3'}>{'common_close'.tr}</button>
      </section>
    </div>;
  }
  function Login({ onLogin }) {
    const [users, setUsers] = useState([]); const [userId, setUserId] = useState(''); const [pin, setPin] = useState(''); const [error, setError] = useState('');
    useEffect(() => { api('/api/admin/auth/users').then(setUsers).catch((err) => setError(err.message)); }, []);
    const submit = async (event) => {
      event.preventDefault();
      try { const result = await api('/api/admin/auth/login', { userId, pin }); onLogin(result.user); } catch (err) { setError(err.message); }
    };
    return <main className="min-h-screen bg-[#F4F6F5] font-sans text-slate-800"><Topbar /><button type="button" className="cf-back-button m-4" onClick={() => window.ConfloraNavigation.back()}>{'back_59dc92'.tr}</button><div className="flex min-h-[calc(100vh-66px)] items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-8 shadow"><h1 className="text-2xl font-bold text-[#0F381E]">{'pos'.tr}</h1><p className="my-2">{'log_in_with_your_employee_account'.tr}</p><label>{'user'.tr}<select required className={field} value={userId} onChange={(e) => setUserId(e.target.value)}><option value=""> {'select'.tr} </option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>PIN<input required type="password" className={field} value={pin} onChange={(e) => setPin(e.target.value)} /></label>{error && <p role="alert" className="mb-3 text-red-700">{error}</p>}<button className={button}>{'header_login'.tr}</button></form></div></main>;
  }
  function Receipt({ order, onNewOrder }) {
    const [current, setCurrent] = useState(order); const [copyStatus, setCopyStatus] = useState('');
    useEffect(() => {
      if (current.status !== 'AWAITING_PIX') { return; }
      const timer = setInterval(() => api('/api/caixa/orders/' + order.id).then(setCurrent).catch(() => {}), 5000);
      return () => clearInterval(timer);
    }, [current.status, order.id]);
    const pending = !current.completedAt;
    const isPixPending = current.status === 'AWAITING_PIX' && Boolean(current.pixData);
    const receiptSent = current.receiptDelivery?.sent || order.receiptDelivery?.sent;
    return <Panel title={pending ? 'order_registered'.tr : current.paymentStatus === 'ON_ACCOUNT' ? 'store_credit_recorded'.tr : 'sale_finalized'.tr} onClose={onNewOrder}>
      <div className="space-y-4">
        <ReceiptView order={current} />
        {current.pixMode === 'MANUAL' && pending && <section className="rounded-xl bg-amber-50 p-4"><h3 className="font-bold">{'manual_pix_awaiting_payment'.tr}</h3><p>{'beneficiary'.tr} {current.manualPix?.recipientName}</p><label> {'pix_key'.tr} <input readOnly className={field} value={current.manualPix?.key || ''} /></label><button className={button} onClick={() => navigator.clipboard.writeText(current.manualPix.key).then(() => setCopyStatus('Chave copiada.')).catch(() => setCopyStatus('Selecione e copie a chave acima.'))}> {'copy_pix_key'.tr} </button><p role="status">{copyStatus}</p><p>{'after_payment_the_cashier_or_administrator_checks_the_receipt_and_attaches_the_proof_'.tr}</p></section>}
        {isPixPending && <section className="rounded-2xl border border-emerald-100 bg-white p-4 text-center">
          <h3 className="text-sm font-extrabold text-slate-800"> {'pay_the_exact_amount_via_pix'.tr} </h3>
          <p className="mt-2 font-bold">{money(current.pixData.amount || current.total)}</p>
          <div className="mx-auto my-3 flex w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2" style={{ maxWidth: 220, aspectRatio: '1 / 1' }}>
            <img className="block" style={{ width: '100%', height: '100%', maxWidth: 200, maxHeight: 200, objectFit: 'contain' }} src={current.pixData.qrCodeBase64} alt={'sicredi_pix_qr_code'.tr} />
          </div>
          <label className="block text-left text-xs font-bold text-slate-600"> {'pix_copy_and_paste'.tr} <textarea readOnly className={field + ' min-h-20 resize-y break-all'} value={current.pixData.pixCopiaECola} />
          </label>
          <button className={button + ' w-full'} onClick={() => navigator.clipboard.writeText(current.pixData.pixCopiaECola).then(() => setCopyStatus('Copiado!')).catch(() => setCopyStatus('select_and_copy_the_code_above'.tr))}> {'copy_pix'.tr} </button>
          <p role="status" className="mt-2 text-sm text-emerald-800">{copyStatus}</p>
          <p className="mt-2 text-xs text-slate-500">{'the_amount_is_fixed_the_sale_will_be_confirmed_automatically_after_payment_validation'.tr}</p>
        </section>}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{'order_placed_by'.tr} <strong className="text-slate-700">{staffLabel(current.createdBy)}</strong></span>
          <span>{!current.customerPhone ? 'no_whatsapp_provided'.tr : receiptSent ? 'receipt_sent_to_whatsapp'.tr : 'receipt_in_whatsapp_sending_queue'.tr}</span>
        </div>
        <button onClick={onNewOrder} className={button + ' w-full'}>{pending ? 'return_to_register'.tr : 'new_sale'.tr}</button>
      </div>
    </Panel>;
  }
  function DiscountApproval({ approval, onOrder, onClose }) {
    const [current, setCurrent] = useState(approval);
    useEffect(() => {
      const timer = setInterval(() => api('/api/caixa/discount-approvals/' + approval.id).then((value) => {
        setCurrent(value);
        if (value.order) onOrder(value.order);
      }).catch(() => {}), 5000);
      return () => clearInterval(timer);
    }, [approval.id]);
    return <Panel title={'discount_approval'.tr} onClose={onClose}><p>{current.status === 'REJECTED' ? 'declined'.tr + " " + current.rejectionReason : 'waiting_for_administrator_to_approve_the_discount_of'.tr + " " + current.discountPercent + '%.'}</p></Panel>;
  }
  const dateInSaoPaulo = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
  const dateOffset = (date, offset) => {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + offset);
    return value.toISOString().slice(0, 10);
  };
  const dateTime = (value) => value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value))
    : '—';
  const paymentLabel = method => window.ConfloraOrderDisplay.payment(method);
  const orderItemLabel = (item) => {
    const quantity = Number(item?.quantity || 0).toLocaleString('pt-BR', { maximumFractionDigits: item?.unit === 'KG' ? 3 : 0 });
    return item?.unit === 'KG' ? `${quantity} ${'kg'.tr} ${item?.name || 'product'.tr}` : `${quantity} × ${item?.name || 'product'.tr}`;
  };
  const staffLabel = (staff) => {
    const name = staff?.name || staff?.email || '—';
    return staff?.email && staff.email !== name ? `${name} · ${staff.email}` : name;
  };
  function ReceiptView({ order }) {
    const ref = React.useRef(null);
    useEffect(() => { ref.current.replaceChildren(window.ConfloraOrderDisplay.renderReceipt(order)); }, [order]);
    return <div ref={ref} />;
  }
  function orderStatusLabel(order) {
    if (order.procurement && !order.completedAt) return window.ConfloraOrderDisplay.status(order);
    if (order.creditApprovalStatus === 'PENDING') return 'store_credit_waiting_for_admin_approval'.tr;
    if (order.status === 'CANCELLED') return 'Cancelado';
    if (order.paymentStatus === 'ON_ACCOUNT') return 'Fiado registrado';
    if (order.paymentStatus === 'APPROVED' && (order.paidAt || order.completedAt)) return 'Pago / finalizado';
    if (['AWAITING_CASHIER', 'AWAITING_PAYMENT', 'PENDING', 'CREATING_PIX', 'AWAITING_PIX'].includes(order.status)) return 'waiting_for_payment_51288d'.tr;
    if (order.status === 'AWAITING_CONFIRMATION') return 'waiting_for_confirmation'.tr;
    if (order.completedAt) return 'Confirmado';
    return 'in_progress'.tr;
  }
  function ManualPixReview({ order, onReviewed }) {
    const [note, setNote] = useState(''); const [bankReceived, setBankReceived] = useState(false);
    const [busy, setBusy] = useState(false); const [error, setError] = useState('');
    async function review(decision) {
      setBusy(true); setError('');
      try {
        const response = await window.ConfloraSession.apiFetch('/api/caixa/orders/' + order.id + '/review-proof', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, proofId: order.paymentProofId, bankReceived, note }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error);
        if (onReviewed) { onReviewed(data.order); }
      } catch (failure) { setError(failure.message); } finally { setBusy(false); }
    }
    async function viewProof() {
      try { await window.ConfloraSession.openPrivateFile('/api/caixa/payment-proofs/' + order.paymentProofId); } catch (failure) { setError(failure.message); }
    }
    return <section className="my-3 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4"><h3 className="font-bold">{'manual_pix_awaiting_review'.tr}</h3><p>{'sending_the_receipt_does_not_confirm_receipt_of_payment'.tr}</p>{error && <p role="alert" className="text-red-700">{error}</p>}{order.paymentProofId ? <><button type="button" className={button} onClick={viewProof}>{'view_receipt_sent_by_customer'.tr}</button><label className="block"><input type="checkbox" checked={bankReceived} onChange={event => setBankReceived(event.target.checked)} /> {'i_checked_the_receipt_in_the_bank_account_and_the_pix_installment_amount'.tr}</label><label className="block">{'note_or_reason'.tr}<textarea className={field} value={note} onChange={event => setNote(event.target.value)} /></label><div className="flex gap-2"><button type="button" className={button} disabled={busy || !bankReceived || note.trim().length < 8} onClick={() => review('APPROVE')}>{'confirm_pix_receipt'.tr}</button><button type="button" className="cf-danger-button" disabled={busy || note.trim().length < 8} onClick={() => review('REJECT')}> {'decline_receipt'.tr} </button></div></> : <p>{'waiting_for_customer_to_send_receipt_pix_key'.tr} {order.manualPix?.key}</p>}</section>;
  }

  function SeparationModal({ order, isOpen, onClose, checkedItems = {}, onToggleItem, onCheckAll, onDepart, canDepart }) {
    if (!isOpen || !order) return null;
    const items = Array.isArray(order.items) ? order.items : [];
    const checkedCount = Object.values(checkedItems || {}).filter(Boolean).length;
    const allChecked = items.length > 0 && items.every((_, idx) => (checkedItems || {})[idx]);
    const progressPercent = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

    return <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={'product_check_a3157f'.tr} className="bg-white rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-emerald-100">
        <header className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">{'check_packing'.tr}</span>
              <span className="text-xs font-bold text-slate-500">#{order.ticketNumber || String(order.id).slice(-6)}</span>
            </div>
            <h2 className="text-base font-black text-slate-800 mt-1">{order.customerName || "Cliente Balcão"}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={'common_close'.tr} className="w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-sm font-bold cursor-pointer">✕</button>
        </header>

        <div className="px-4 py-3 bg-emerald-50/60 border-b border-emerald-100 shrink-0">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-black text-emerald-950">
              {allChecked ? 'all_items_picked'.tr : `${checkedCount} ${'of'.tr} ${items.length} itens conferidos`}
            </span>
            {!allChecked && (
              <button
                type="button"
                onClick={onCheckAll}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
              > {'mark_all_as_separated'.tr} </button>
            )}
          </div>
          <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-2.5 min-h-0 flex-1">
          <p className="text-[11px] font-semibold text-slate-500 mb-2">{'tap_each_product_as_you_pack_it'.tr}</p>
          {items.map((item, idx) => {
            const isChecked = Boolean((checkedItems || {})[idx]);
            const qty = Number(item.quantity || 0).toLocaleString('pt-BR', { maximumFractionDigits: item.unit === 'KG' ? 3 : 0 });
            return (
              <div
                key={idx}
                onClick={() => onToggleItem(idx)}
                className={`p-3 rounded-2xl border transition-all flex items-center gap-3 cursor-pointer select-none active:scale-[0.99] ${
                  isChecked
                    ? 'bg-emerald-50/90 border-emerald-400 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 transition-transform ${
                    isChecked
                      ? 'bg-emerald-600 text-white shadow-md scale-105'
                      : 'border-2 border-slate-300 text-transparent bg-slate-50'
                  }`}
                >
                  ✓
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 shrink-0">
                      {qty} {item.unit === 'KG' ? 'kg'.tr : 'un'}
                    </span>
                    <span className={`text-sm font-bold truncate ${isChecked ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                      {item.name}
                    </span>
                  </div>
                  {item.variation && <p className="text-[11px] text-slate-500 ml-1 mt-0.5">{item.variation}</p>}
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-extrabold text-slate-600 block">{money(item.total || item.price * item.quantity)}</span>
                  {isChecked && <span className="text-[10px] font-black text-emerald-700 uppercase"> {'ready'.tr} </span>}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="p-4 border-t border-slate-100 bg-slate-50/90 shrink-0">
          {allChecked && canDepart ? (
            <button
              type="button"
              onClick={onDepart}
              className="cf-btn-3d cf-btn-3d--primary cf-btn-3d--lg cf-btn-3d--block"
            >
              <span>{'mark_as_out_for_delivery_open_route'.tr}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--md cf-btn-3d--block"
            >
              {allChecked ? 'close_check'.tr : 'return_to_order'.tr}
            </button>
          )}
        </footer>
      </section>
    </div>;
  }

  function FinalizedOrderDetails({ order, onOpenSeparation }) {
    const startMs = Date.parse(order.createdAt);
    const endMs = Date.parse(order.completedAt || order.deliveredAt || order.paidAt || order.updatedAt);
    const totalSeconds = (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs)
      ? (endMs - startMs) / 1000
      : null;

    const formatDur = (sec) => {
      if (sec == null || !Number.isFinite(sec) || sec < 0) return 'time_not_recorded'.tr;
      if (sec < 60) return `${Math.round(sec)} seg`;
      const mins = Math.floor(sec / 60);
      const hrs = Math.floor(mins / 60);
      const remM = mins % 60;
      if (hrs === 0) return `${mins} min`;
      if (remM === 0) return `${hrs} h`;
      return `${hrs} h ${remM} min`;
    };

    const isSelfService = order.source === 'WEB_CATALOG' ||
      !order.createdBy ||
      ['ONLINE', 'SYSTEM', 'AUTOATENDIMENTO'].includes(order.createdBy.id) ||
      order.createdBy.role === 'SYSTEM' ||
      order.createdBy.name === 'Catálogo online' ||
      order.createdBy.name === 'Autoatendimento';

    const sellerTitle = isSelfService
      ? (order.source === 'WHATSAPP' || order.channel === 'WHATSAPP'
          ? '🤖 Autoatendimento (WhatsApp Conflora IA)'
          : '🌐 Autoatendimento (Loja Virtual Conflora)')
      : (order.createdBy?.name || order.sellerName || order.operatorName || 'Colaborador Conflora');

    const sellerSub = isSelfService
      ? 'order_placed_directly_by_customer_in_the_online_catalog_without_physical_salesperson'.tr
      : (order.createdBy?.email ? `${order.createdBy.role || 'Vendedor'} · ${order.createdBy.email}` : (order.createdBy?.role || 'Vendedor Conflora'));

    const isDelivery = Boolean(order.deliveryAddress || order.deliveryStatus || order.fulfillment === 'DELIVERY');
    const driverName = order.deliveredBy?.name || order.assignedDriver?.name || 'Equipe Conflora';

    const routeSeconds = order.deliveryMetrics?.durationSeconds ??
      (order.deliveredAt && (order.departedAt || order.acceptedAt)
        ? (Date.parse(order.deliveredAt) - Date.parse(order.departedAt || order.acceptedAt)) / 1000
        : null);

    const cleanPhone = String(order.customerPhone || '').replace(/\D/g, '');

    const printReceipt = () => {
      if (window.ConfloraOrderDisplay?.renderReceipt) {
        const receiptWindow = window.open('', '_blank', 'width=420,height=600');
        if (receiptWindow) {
          receiptWindow.document.write('<html><head><title>Comprovante Conflora</title><link rel="stylesheet" href="/store-assets/order-display.css"></head><body style="padding:16px;"></body></html>');
          receiptWindow.document.body.appendChild(window.ConfloraOrderDisplay.renderReceipt(order));
          receiptWindow.document.close();
          setTimeout(() => receiptWindow.print(), 300);
        }
      } else {
        window.print();
      }
    };

    const sendWhatsAppReceipt = () => {
      if (!cleanPhone) return;
      const itemsText = (order.items || []).map(item => `• ${item.quantity}x ${item.name} (${money(item.total || item.price * item.quantity)})`).join('%0A');
      const msg = `${'conflora_horta_e_viveiro_0a_0ahello'.tr}${order.customerName || 'customer'.tr}${'message_0ayour_purchase_has_been_successfully_completed_0a_0a_order_23'.tr}${order.ticketNumber || String(order.id).slice(-6).toUpperCase()}${'message_0a_total'.tr} ${money(order.total)}${'message_0a_payment'.tr} ${paymentLabel(order.paymentMethod)}${'message_0a_0a_order_items_0a'.tr}${itemsText}${'message_0a_0athank_you_for_your_business_we_are_at_your_disposal'.tr}`;
      window.open(`https://wa.me/55${cleanPhone}?text=${msg}`, '_blank');
    };

    return (
      <div className="space-y-3 pt-2">
        {/* 1. CARTÃO DE DESTAQUE: TEMPO DE ATENDIMENTO & STATUS */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-emerald-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">⏱️</span>
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-emerald-800 block">{'order_to_completion_time'.tr}</span>
                <strong className="text-base font-black text-emerald-950">
                  {totalSeconds ? formatDur(totalSeconds) : 'sale_completed'.tr}
                </strong>
              </div>
            </div>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-emerald-600 text-white shadow-2xs"> {'completed'.tr} </span>
          </div>
          <div className="mt-2.5 pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs text-slate-600">
            <span>{'order'.tr} <strong>{dateTime(order.createdAt)}</strong></span>
            <span> {'completed_086d1f'.tr} <strong>{dateTime(order.completedAt || order.deliveredAt || order.paidAt)}</strong></span>
          </div>
        </div>

        {/* 2. QUEM COMPROU, QUEM VENDEU & QUEM ENTREGOU (GRID) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* QUEM COMPROU */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1"> {'buyer'.tr} </span>
            <p className="font-black text-sm text-slate-900 leading-tight">
              {order.customerName || "Cliente Balcão"}
            </p>
            {cleanPhone && (
              <p className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
                <span>📱</span>
                <span>{order.customerPhone}</span>
              </p>
            )}
            {order.customerEmail && (
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                ✉️ {order.customerEmail}
              </p>
            )}
            {(order.customerDocument || order.customerCpfCnpj) && (
              <p className="text-[11px] text-slate-500 mt-0.5"> {'doc'.tr} {order.customerDocument || order.customerCpfCnpj}
              </p>
            )}
          </div>

          {/* QUEM VENDEU */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1"> {'seller'.tr} </span>
            <p className="font-black text-sm text-slate-900 leading-tight flex items-center gap-1.5">
              {isSelfService ? <span>🌐</span> : <span>👨‍🌾</span>}
              <span>{sellerTitle}</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1 leading-snug">
              {sellerSub}
            </p>
            {isSelfService && (
              <span className="inline-block mt-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-800"> {'self_checkout'.tr} </span>
            )}
          </div>

          {/* QUEM ENTREGOU / MODALIDADE */}
          <div className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs sm:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block mb-1">
                  {isDelivery ? 'deliverer'.tr : 'modality'.tr}
                </span>
                <p className="font-black text-sm text-slate-900 leading-tight flex items-center gap-1.5">
                  {isDelivery ? <span>🛵</span> : <span>🏬</span>}
                  <span>{isDelivery ? driverName : 'cart_pickup_option'.tr}</span>
                </p>
                {isDelivery && order.deliveryAddress && (
                  <p className="text-xs text-slate-700 mt-1 font-medium">
                    📍 {order.deliveryAddress}
                    {order.deliveryLocation?.reference && (
                      <span className="text-slate-500 block text-[11px]"> {'ref'.tr} {order.deliveryLocation.reference}</span>
                    )}
                  </p>
                )}
              </div>
              {isDelivery && routeSeconds && (
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">{'time_in_route'.tr}</span>
                  <span className="text-xs font-black text-sky-800 bg-sky-100 px-2 py-0.5 rounded-full">
                    {formatDur(routeSeconds)}
                  </span>
                </div>
              )}
            </div>
            {isDelivery && (order.deliveryMetrics?.distanceKm || order.deliveryRoute?.distanceMeters) && (
              <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-500 flex items-center gap-2">
                <span>{'distance_traveled_estimated'.tr}</span>
                <strong className="text-slate-700">
                  {order.deliveryMetrics?.distanceKm
                    ? `${Number(order.deliveryMetrics.distanceKm).toFixed(2)} km`
                    : `${(order.deliveryRoute.distanceMeters / 1000).toFixed(2)} km`}
                </strong>
              </div>
            )}
          </div>
        </div>

        {/* 3. PAGAMENTO DETALHADO & RECEBIMENTO */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block"> {'payment_and_settlement'.tr} </span>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">{'payment_method_e2d131'.tr}</span>
            <span className="font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
              {paymentLabel(order.paymentMethod)}
            </span>
          </div>

          {order.paymentParts && order.paymentParts.length > 1 && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">{'payment_split'.tr}</span>
              {order.paymentParts.map((part, idx) => (
                <div key={idx} className="flex justify-between text-xs font-medium text-slate-700">
                  <span>• {paymentLabel(part.method)}</span>
                  <strong className="text-slate-900">{money(part.amount)}</strong>
                </div>
              ))}
            </div>
          )}

          {order.cashReceivedAmount && Number(order.cashReceivedAmount) > Number(order.total) && (
            <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
              <span>{'received_in_cash'.tr} {money(order.cashReceivedAmount)}</span>
              <span className="font-bold text-emerald-800"> {'change_b78a44'.tr} {money(order.cashChange || 0)}</span>
            </div>
          )}

          {(order.financialReceiver?.name || order.receivedBy?.name) && (
            <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex items-center gap-1">
              <span>{'received_checked_by'.tr}</span>
              <strong className="text-slate-700">{order.financialReceiver?.name || order.receivedBy?.name}</strong>
            </div>
          )}
        </div>

        {/* 4. RESUMO DOS ITENS */}
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400"> {'sale_items'.tr}{(order.items || []).length})
            </span>
            {onOpenSeparation && (
              <button
                type="button"
                onClick={onOpenSeparation}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{'view_item_check'.tr}</span>
                <span>→</span>
              </button>
            )}
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {(order.items || []).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-b-0">
                <span className="font-medium text-slate-800 flex-1 pr-2 truncate">
                  <strong className="text-slate-900 mr-1.5">{item.quantity} {item.unit || 'un'}</strong>
                  {item.name}
                </span>
                <span className="font-bold text-slate-900 whitespace-nowrap">
                  {money(item.total || (item.price * item.quantity))}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
            <span className="text-slate-500"> {'subtotal_8cf83a'.tr} </span>
            <span className="font-bold text-slate-800">{money(order.subtotal || order.total)}</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex items-center justify-between text-xs text-emerald-700 font-bold">
              <span> {'discount'.tr} {order.discountPercent || 0}%):</span>
              <span>-{money(order.discountAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm font-black text-emerald-950 pt-1">
            <span>{'final_total_paid'.tr}</span>
            <span className="text-base text-emerald-800">{money(order.total)}</span>
          </div>
        </div>

        {/* 5. AÇÕES RÁPIDAS (IMPRIMIR RECIBO & WHATSAPP) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={printReceipt}
            className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--md"
          >
            <span>🖨️</span>
            <span> {'print_receipt'.tr} </span>
          </button>

          {cleanPhone ? (
            <button
              type="button"
              onClick={sendWhatsAppReceipt}
              className="cf-btn-3d cf-btn-3d--primary cf-btn-3d--md"
            >
              <span>💬</span>
              <span>{'send_via_whatsapp'.tr}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSeparation}
              className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--md"
            >
              <span>📦</span>
              <span>{'product_check'.tr}</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  function OrderDetails({
    order,
    onClose,
    canReceive = false,
    canConfirmManualPix = false,
    busy = false,
    error = '',
    onReceive,
    onManualPix,
    onReviewed,
    canAdvance = false,
    onAdvance,
    deliveryMode = false,
    extraContent,
    canApproveCredit = false,
    onStartDelivery,
    onAcceptDelivery,
    onCompleteDelivery,
    navigation,
    showSeparationModalInitial = false,
    onCloseSeparationModal
  }) {
    const total = order.procurement && !order.completedAt ? (Math.round(Number(order.total || 0) * 100) - Number(order.procurement.deposit?.amountMinor || 0)) / 100 : Number(order.total || 0);
    const totalCents = Math.round(total * 100);
    const initialMethod = ['CARTAO', 'CARD', 'MISTO'].includes(order.paymentMethod) ? 'CREDITO' : order.paymentMethod === 'CASH' ? 'DINHEIRO' : order.paymentMethod || 'DINHEIRO';

    const [parts, setParts] = useState(() => {
      if (Array.isArray(order.paymentParts) && order.paymentParts.length > 1) {
        return order.paymentParts.map(p => ({ method: p.method, amount: String(p.amount) }));
      }
      return [{ method: initialMethod, amount: total.toFixed(2) }];
    });

    // Calculadora de troco visual exclusiva para Dinheiro (100% independente do financeiro e temporária)
    const [cashReceivedVisual, setCashReceivedVisual] = useState('');

    const [copied, setCopied] = useState(false);
    const [manualPixNote, setManualPixNote] = useState('');
    const [manualProofSeen, setManualProofSeen] = useState(false);
    const [proofId, setProofId] = useState('');
    const [showSeparationModal, setShowSeparationModal] = useState(Boolean(showSeparationModalInitial));
    const [checkedItems, setCheckedItems] = useState({});

    useEffect(() => {
      if (showSeparationModalInitial) setShowSeparationModal(true);
    }, [showSeparationModalInitial]);

    const handleCloseSeparation = () => {
      setShowSeparationModal(false);
      onCloseSeparationModal?.();
    };

    const handleToggleItemCheck = (idx) => {
      setCheckedItems(prev => {
        const next = { ...prev, [idx]: !prev[idx] };
        const items = order.items || [];
        if (items.length > 0 && items.every((_, i) => next[i])) {
          setTimeout(() => {
            if (onStartDelivery) {
              if (confirm('all_items_have_been_successfully_picked_do_you_want_to_mark_as_out_for_delivery'.tr)) {
                onStartDelivery();
                if (navigation?.google) window.open(navigation.google, '_blank');
                handleCloseSeparation();
              }
            }
          }, 200);
        }
        return next;
      });
    };

    const handleCheckAll = () => {
      const items = order.items || [];
      const all = {};
      items.forEach((_, i) => { all[i] = true; });
      setCheckedItems(all);
      setTimeout(() => {
        if (onStartDelivery) {
          if (confirm('all_items_have_been_successfully_picked_do_you_want_to_mark_as_out_for_delivery'.tr)) {
            onStartDelivery();
            if (navigation?.google) window.open(navigation.google, '_blank');
            handleCloseSeparation();
          }
        }
      }, 200);
    };

    const handleDepartFromModal = () => {
      if (onStartDelivery) {
        onStartDelivery();
        if (navigation?.google) window.open(navigation.google, '_blank');
      }
      handleCloseSeparation();
    };

    useEffect(() => {
      if (Array.isArray(order.paymentParts) && order.paymentParts.length > 1) {
        setParts(order.paymentParts.map(p => ({ method: p.method, amount: String(p.amount) })));
      } else {
        setParts([{ method: initialMethod, amount: total.toFixed(2) }]);
      }
      setCashReceivedVisual('');
      setCopied(false);
      setManualPixNote('');
      setManualProofSeen(false);
    }, [order.id, order.status, order.paymentMethod, order.total]);

    const methodLabels = {
      PIX: "PIX",
      DINHEIRO: 'cart_cash_option'.tr,
      CREDITO: 'cart_card_option'.tr,
      DEBITO: 'cart_debit_option'.tr,
      ...(!deliveryMode ? { FIADO: 'cart_fiado_option'.tr } : {})
    };
    const availableMethods = Object.keys(methodLabels).filter(m => (m !== 'FIADO' || order.customerId));

    const sumCents = parts.reduce((sum, p) => sum + Math.round(Number(p.amount || 0) * 100), 0);
    const remainingCents = totalCents - sumCents;

    // Identifica se há parcela em Dinheiro
    const cashPart = parts.find(p => p.method === 'DINHEIRO');
    const hasCash = Boolean(cashPart);
    const cashSaleAmount = cashPart ? Number(cashPart.amount || 0) : 0;

    // Cálculo do troco visual (100% informativo)
    const parseMoneyInput = (str) => {
      if (!str) return 0;
      const cleaned = String(str).trim().replace(/^R\$\s*/i, '').replace(/\./g, '').replace(',', '.');
      const num = Number(cleaned);
      return Number.isFinite(num) && num > 0 ? num : 0;
    };
    const parsedVisualReceived = parseMoneyInput(cashReceivedVisual);
    const visualTroco = parsedVisualReceived >= cashSaleAmount ? Math.round((parsedVisualReceived - cashSaleAmount) * 100) / 100 : 0;
    const visualHasDeficit = Boolean(cashReceivedVisual.trim()) && parsedVisualReceived > 0 && parsedVisualReceived < cashSaleAmount;

    // Validação estrita: cada parcela <= totalCents, inclusive dinheiro. Sem exceções!
    const isPartExceeded = (amt) => Math.round(Number(amt || 0) * 100) > totalCents;
    const hasAnyExceeded = parts.some(p => isPartExceeded(p.amount));
    const allAmountsValid = parts.every(p => {
      const c = Math.round(Number(p.amount || 0) * 100);
      return c > 0 && c <= totalCents;
    });
    const uniqueMethods = new Set(parts.map(p => p.method)).size === parts.length;
    const isExactMatch = sumCents === totalCents && allAmountsValid && uniqueMethods;
    const canFinalize = isExactMatch;

    const [directPix, setDirectPix] = useState(order.pixMode === 'MANUAL');
    const hasPixPart = parts.some((p) => p.method === 'PIX');
    const needsManualProof = (directPix || window.CONFLORA_PIX_MODE === 'MANUAL') && hasPixPart;
    const pixCopyPaste = order.status === 'AWAITING_RECONCILIATION' ? '' : order.pixData?.pixCopiaECola || order.pixCopiaECola || '';
    const pixAmount = (order.paymentParts || parts).filter((p) => p.method === 'PIX').reduce((sum, p) => sum + Number(p.amount || 0), 0) || total;

    const copyPixCode = async () => {
      try { await navigator.clipboard.writeText(pixCopyPaste); setCopied(true); }
      catch { setCopied(false); }
    };

    const handlePart0Amount = (val) => {
      setParts(parts.map((p, idx) => idx === 0 ? { ...p, amount: val } : p));
    };

    const updatePart = (index, updates) => {
      setParts(parts.map((p, idx) => idx === index ? { ...p, ...updates } : p));
    };

    const removePart = (index) => {
      const filtered = parts.filter((_, idx) => idx !== index);
      if (filtered.length === 1) {
        filtered[0] = { ...filtered[0], amount: total.toFixed(2) };
      }
      setParts(filtered);
    };

    const addPart = () => {
      const unusedMethod = availableMethods.find(m => !parts.some(p => p.method === m)) || availableMethods[0];
      const autoAmount = remainingCents > 0 ? (remainingCents / 100).toFixed(2) : '0.00';
      setParts([...parts, { method: unusedMethod, amount: autoAmount }]);
    };

    const handleConfirmReceive = () => {
      if (!canFinalize) return;
      const isSplit = parts.length > 1;
      const finalMethod = isSplit ? 'MISTO' : needsManualProof ? 'PIX_MANUAL' : parts[0].method;
      const finalParts = isSplit ? parts.map(p => ({ method: p.method, amount: Math.round(Number(p.amount) * 100) / 100 })) : undefined;
      onReceive(order, finalMethod, null, finalParts, {
        manualPix: needsManualProof,
        proofSeen: manualProofSeen,
        note: manualPixNote,
        proofId,
      });
      setCashReceivedVisual('');
    };

    let fabAction = null;
    if (canReceive) {
      if (hasAnyExceeded) {
        fabAction = {
          label: `${'amount_exceeds_the_sale_balance'.tr}${money(total)})`,
          disabled: true,
          onClick: () => {}
        };
      } else if (!canFinalize && remainingCents > 0) {
        fabAction = {
          label: `⚠️ Falta preencher ${money(remainingCents / 100)}`,
          disabled: true,
          onClick: () => {}
        };
      } else if (!canFinalize && remainingCents < 0) {
        fabAction = {
          label: `${'adjust_the_excess_amount_of'.tr} ${money(-remainingCents / 100)}`,
          disabled: true,
          onClick: () => {}
        };
      } else if (needsManualProof && (!proofId || !manualProofSeen || manualPixNote.trim().length < 8)) {
        fabAction = {
          label: 'attach_and_confirm_the_pix_receipt'.tr,
          disabled: true,
          onClick: () => {}
        };
      } else if (deliveryMode) {
        fabAction = {
          label: 'confirm_receipt_and_complete_delivery'.tr,
          disabled: busy,
          onClick: handleConfirmReceive,
          tone: 'emerald'
        };
      } else {
        fabAction = {
          label: `${'confirm_payment_of'.tr} ${money(order.total)}`,
          disabled: busy,
          onClick: handleConfirmReceive,
          tone: 'emerald'
        };
      }
    } else if (canAdvance) {
      fabAction = {
        label: 'confirm_order_and_wait_for_payment'.tr,
        disabled: busy,
        onClick: () => onAdvance(order),
        tone: 'emerald'
      };
    } else if (canApproveCredit && !(order.paymentParts?.length > 1)) {
      fabAction = {
        label: 'approve_store_credit_and_release_order'.tr,
        disabled: busy,
        onClick: () => onReceive(order, 'FIADO', null, order.paymentParts),
        tone: 'amber'
      };
    } else if (deliveryMode) {
      if (onAcceptDelivery) {
        fabAction = {
          label: 'take_and_pick_this_order'.tr,
          disabled: busy,
          onClick: onAcceptDelivery,
          tone: 'amber'
        };
      } else if (onStartDelivery) {
        const items = order.items || [];
        const allChecked = items.length > 0 && items.every((_, i) => checkedItems[i]);
        if (allChecked) {
          fabAction = {
            label: 'left_the_nursery_start_route_in_maps'.tr,
            disabled: busy,
            onClick: handleDepartFromModal,
            tone: 'emerald'
          };
        } else {
          fabAction = {
            label: `📦 Separar Itens (${Object.values(checkedItems).filter(Boolean).length}/${items.length})`,
            disabled: busy,
            onClick: () => setShowSeparationModal(true),
            tone: 'sky'
          };
        }
      } else if (onCompleteDelivery) {
        fabAction = {
          label: 'confirm_that_delivery_was_made'.tr,
          disabled: busy,
          onClick: onCompleteDelivery,
          tone: 'emerald'
        };
      }
    }

    const isFinalized = Boolean(order.completedAt || order.deliveryStatus === 'DELIVERED' || order.status === 'COMPLETED' || (order.paymentStatus === 'APPROVED' && !canReceive && !canAdvance));

    return <Panel title={`Comanda #${order.ticketNumber || String(order.id).slice(-6).toUpperCase()}`} onClose={onClose}>{order.pixMode === 'MANUAL' && !order.completedAt && canReceive && <ManualPixReview order={order} onReviewed={onReviewed} />}
      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl">
          <div>
            <p className="font-black text-base text-slate-800 leading-tight">{order.customerName || "Cliente Balcão"}</p>
            <p className="text-xs text-slate-500 font-medium">{orderStatusLabel(order)} · {paymentLabel(order.paymentMethod)}</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">{"total_112398".tr}</span>
            <span className="text-base font-black text-emerald-800">{money(order.total)}</span>
          </div>
        </div>

        {/* Inline item preview + button to open dedicated Separation / Receipt Modal */}
        <div className="border border-slate-200 rounded-2xl bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <span>📦</span>
                <span>{'packing_detailed_receipt'.tr}</span>
              </span>
              <p className="text-[11px] text-slate-500 font-medium">
                {(order.items || []).length} {'item_s'.tr} {Object.values(checkedItems).filter(Boolean).length} {'checked'.tr} </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSeparationModal(true)}
              className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--sm"
            >
              <span>{'view_products'.tr}</span>
              <span>→</span>
            </button>
          </div>
          {Array.isArray(order.items) && order.items.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 space-y-1 max-h-28 overflow-y-auto">
              {order.items.slice(0, 4).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs text-slate-700">
                  <span className="truncate pr-2">
                    <strong className="text-emerald-800 mr-1">{item.quantity}x</strong>
                    {item.name}
                  </span>
                  <span className="font-bold text-slate-900 shrink-0">{money(item.total || item.price * item.quantity)}</span>
                </div>
              ))}
              {order.items.length > 4 && (
                <p className="text-[11px] font-bold text-emerald-700 pt-0.5">
                  +{order.items.length - 4} item(ns) na comanda…
                </p>
              )}
            </div>
          )}
        </div>

        <SeparationModal
          order={order}
          isOpen={showSeparationModal}
          onClose={handleCloseSeparation}
          checkedItems={checkedItems}
          onToggleItem={handleToggleItemCheck}
          onCheckAll={handleCheckAll}
          onDepart={handleDepartFromModal}
          canDepart={Boolean(onStartDelivery)}
        />

        {isFinalized && <FinalizedOrderDetails order={order} onOpenSeparation={() => setShowSeparationModal(true)} />}

        {extraContent}
        {order.requiresRefund && <p role="alert" className="rounded-lg bg-amber-50 p-3 font-bold text-amber-900">{'partial_receipt_of'.tr} {money(order.refundDue)} {'pending_reconciliation_or_refund_by_the_store'.tr}</p>}
        {order.manualPixProofId && <a className="mt-3 inline-flex font-bold text-emerald-800 underline" href={'/api/caixa/payment-proofs/' + order.manualPixProofId} onClick={(event) => { event.preventDefault(); window.ConfloraSession.openPrivateFile('/api/caixa/payment-proofs/' + order.manualPixProofId).catch(error => alert(error.message)); }}> {'view_attached_pix_receipt'.tr} </a>}
        {canApproveCredit && !(order.paymentParts?.length > 1) && <button type="button" disabled={busy} className="cf-button !w-full !bg-amber-500 !text-slate-950 !py-4 !font-black" onClick={() => onReceive(order, 'FIADO', null, order.paymentParts)}>{'approve_credit_and_release_order'.tr}</button>}
        {(canConfirmManualPix || order.paymentMethod === 'PIX' && ['CREATING_PIX', 'AWAITING_PIX'].includes(order.status)) && <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <h3 className="font-black text-sky-950">{'pix_awaiting_confirmation'.tr}</h3>
          <p className="mt-1 text-xs text-sky-900">{'the_sale_will_be_finalized_upon_confirmation_by_sicredi_or_manual_pix_review_by_an_au'.tr}</p>
          {order.pixData?.qrCodeBase64 && <img src={order.pixData.qrCodeBase64} alt={`${'order_pix_qr_code'.tr} ${order.ticketNumber}`} className="mx-auto mt-3 block max-h-48 w-48 rounded-lg bg-white object-contain p-2" />}
          {pixCopyPaste && <><label className="mt-3 block text-xs font-bold text-sky-950"> {'pix_copy_and_paste_59c71c'.tr} <textarea readOnly value={pixCopyPaste} className="mt-1 w-full rounded-xl border border-sky-200 bg-white p-2 text-xs" rows={3} /></label><button type="button" className={button + ' mt-2 w-full'} onClick={copyPixCode}>{copied ? 'code_copied'.tr : 'copy_pix_copy_and_paste'.tr}</button></>}
          {order.pixData?.txid && !order.pixData?.qrCodeBase64 && !pixCopyPaste && <p className="mt-2 text-xs text-sky-900">{'the_charge_is_being_prepared_please_refresh_in_a_moment'.tr}</p>}
          {canConfirmManualPix && <div className="mt-4 space-y-2 border-t border-sky-200 pt-3">
            <p className="text-xs font-bold text-sky-950">{'has_sicredi_not_confirmed_yet'.tr}</p>
            <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={manualProofSeen} onChange={(event) => setManualProofSeen(event.target.checked)} /><span>{'i_checked_the_exact_amount_of'.tr} {money(pixAmount)} {'and_conflora_s_receiving_account'.tr}</span></label>
            <label className="block text-xs font-bold text-slate-700">{'receipt_note'.tr}<textarea className={field} rows={2} value={manualPixNote} onChange={(event) => setManualPixNote(event.target.value)} placeholder={'ex_receipt_presented_at_checkout'.tr} /></label>
            <PixProofUpload targetType="ORDER" targetId={order.id} onChange={setProofId} />
            <button type="button" className={button + ' w-full'} disabled={busy || !proofId || !manualProofSeen || manualPixNote.trim().length < 8} onClick={() => onManualPix(order, manualPixNote, proofId)}>{'manually_confirm_pix_and_finalize'.tr}</button>
          </div>}
        </section>}
        {canAdvance && <button type="button" className={button + ' mt-4 w-full'} disabled={busy} onClick={() => onAdvance(order)}>{'confirm_order_and_await_payment'.tr}</button>}
        {canReceive && <section className="mt-4 rounded-2xl border-2 border-emerald-300 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-emerald-100 pb-2 mb-3">
            <div>
              <h3 aria-label={deliveryMode ? 'collect_on_delivery'.tr : 'receive_at_cashier'.tr} className="text-base font-black text-emerald-950 flex items-center gap-1.5">
                <span>{deliveryMode ? 'collect_on_delivery'.tr : 'order_receipt'.tr}</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium"> {'enter_the_method_and_confirm_the_exact_amount'.tr} </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">{'order_total'.tr}</span>
              <span className="text-lg font-black text-emerald-800">{money(order.total)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {parts.length > 1 ? 'message_1st_payment_method'.tr : 'payment_method_e2d131'.tr}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {availableMethods.map(m => (
                <button
                  type="button"
                  key={m}
                  className={`py-2.5 px-2 rounded-xl text-xs font-black transition border cursor-pointer ${
                    parts[0].method === m
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                  onClick={() => updatePart(0, { method: m })}
                >
                  {methodLabels[m]}
                </button>
              ))}
            </div>

            <div className="mt-2.5">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {parts.length > 1 ? `${'amount_in_1st_method'.tr}${methodLabels[parts[0].method]}):` : 'recorded_amount_r'.tr}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">R$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={`w-full pl-10 pr-3 py-2 text-base font-black rounded-xl bg-white focus:outline-none ${
                    isPartExceeded(parts[0].amount)
                      ? 'border-2 border-red-500 text-red-950 bg-red-50/50 ring-2 ring-red-400/30'
                      : 'border border-slate-300 text-emerald-950 focus:border-emerald-500'
                  }`}
                  value={parts[0].amount}
                  aria-label={parts.length > 1 ? 'installment_amount'.tr + ' 1' : 'payment_amount_for_method'.tr}
                  onChange={(e) => handlePart0Amount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              {isPartExceeded(parts[0].amount) && (
                <p className="mt-1 text-xs font-bold text-red-700" role="alert"> {'amount_exceeds_the_sale_balance_the_maximum_allowed_is'.tr} {money(total)}.
                </p>
              )}
              {parts.length === 1 && remainingCents > 0 && !isPartExceeded(parts[0].amount) && (
                <div className="mt-2 flex items-center justify-between rounded-xl bg-amber-50 p-2.5 border border-amber-200">
                  <span className="text-xs font-bold text-amber-900"> {'remaining_balance'.tr} <strong>{money(remainingCents / 100)}</strong>
                  </span>
                  <button
                    type="button"
                    className="text-xs font-black text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                    onClick={addPart}
                    aria-label={'add_payment_method_action'.tr}
                  > {'add_another_method'.tr}{money(remainingCents / 100)})
                  </button>
                </div>
              )}
            </div>
          </div>

          {parts.length > 1 && (
            <div className="mt-3 space-y-2.5 border-t border-emerald-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wide"> {'complementary_payment'.tr}{parts.length} {'split_methods'.tr} </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${remainingCents === 0 ? 'bg-emerald-100 text-emerald-800' : remainingCents > 0 ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'}`}>
                  {remainingCents === 0 ? 'exact_sum'.tr : remainingCents > 0 ? `Falta ${money(remainingCents / 100)}` : `Excesso ${money(-remainingCents / 100)}`}
                </span>
              </div>

              {parts.slice(1).map((part, idx) => {
                const partIndex = idx + 1;
                const exceeded = isPartExceeded(part.amount);
                return (
                  <div key={partIndex} className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-emerald-800 bg-emerald-200 rounded px-1.5 py-0.5">
                        #{partIndex + 1}
                      </span>
                      <select
                        value={part.method}
                        onChange={(e) => updatePart(partIndex, { method: e.target.value })}
                        className="flex-1 min-w-[130px] rounded-lg border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800"
                      >
                        {availableMethods.map(m => (
                          <option key={m} value={m}>{methodLabels[m]}</option>
                        ))}
                      </select>
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">R$</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={part.amount}
                          aria-label={'installment_amount'.tr + ' ' + (partIndex + 1)}
                          onChange={(e) => updatePart(partIndex, { amount: e.target.value })}
                          className={`w-full pl-8 pr-2 py-1.5 text-xs font-bold rounded-lg bg-white ${
                            exceeded ? 'border-2 border-red-500 text-red-950 bg-red-50 ring-2 ring-red-400/30' : 'border border-slate-300 text-emerald-950'
                          }`}
                          placeholder="0,00"
                        />
                      </div>
                      <button
                        type="button"
                        title={'remove_this_method'.tr}
                        className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs flex items-center justify-center cursor-pointer transition"
                        onClick={() => removePart(partIndex)}
                      >
                        ✕
                      </button>
                    </div>
                    {exceeded && (
                      <p className="text-[11px] font-bold text-red-700 pl-1"> {'amount_exceeds_the_sale_balance_the_maximum_allowed_is'.tr} {money(total)}.
                      </p>
                    )}
                  </div>
                );
              })}

              {remainingCents > 0 && (
                <button
                  type="button"
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer py-1"
                  onClick={addPart}
                > {'add_another_payment_method'.tr}{money(remainingCents / 100)})
                </button>
              )}
            </div>
          )}

          <div className="mt-3">
            {remainingCents > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between">
                <span>{'amount_still_needed_to_cover_the_total'.tr}</span>
                <span className="text-sm font-black text-amber-950">{money(remainingCents / 100)}</span>
              </div>
            )}
            {remainingCents < 0 && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-bold flex items-center justify-between">
                <span>{'the_entered_amount_exceeds_the_total'.tr}</span>
                <span className="text-sm font-black text-red-950">{'excess_of'.tr} {money(-remainingCents / 100)}</span>
              </div>
            )}
            {isExactMatch && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-1.5">
                <span>{'total_amount_of'.tr} {money(order.total)} {'successfully_distributed'.tr}</span>
              </div>
            )}
          </div>

          {/* CALCULADORA DE TROCO VISUAL: Exclusiva para DINHEIRO (100% independente do financeiro) */}
          {hasCash && (
            <div className="mt-3.5 p-3.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/80 shadow-xs">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-emerald-200">
                <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5 uppercase tracking-wide">
                  <span>🧮</span>
                  <span>{'change_calculator'.tr}</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-200/80 px-2 py-0.5 rounded-full"> {'visual_does_not_change_the_sale'.tr} </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1"> {'label_1_received'.tr} </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">R$</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      value={cashReceivedVisual}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d.,]/g, '').replace(/(.*[.,].*)[.,]/g, '$1');
                        setCashReceivedVisual(v);
                      }}
                      className="w-full pl-8 pr-2.5 py-1.5 text-sm font-black text-slate-900 border-2 border-emerald-300 rounded-xl bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-400/30"
                      aria-label={'amount_received_in_physical_cash'.tr}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">{'amount_handed_by_the_customer'.tr}</span>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1"> {'message_2_sale_amount'.tr} </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={money(cashSaleAmount)}
                      className="w-full px-2.5 py-1.5 text-sm font-black text-emerald-950 border border-slate-200 rounded-xl bg-slate-100 cursor-default select-none"
                      aria-label={'cash_installment_amount'.tr}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">{parts.length > 1 ? 'cash_installment'.tr : 'total_in_cash'.tr}</span>
                </div>
                <div>
                  <label className="block text-[11px] font-extrabold text-slate-700 uppercase mb-1"> {'label_3_change'.tr} </label>
                  <div className="relative">
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={money(visualTroco)}
                      className={`w-full px-2.5 py-1.5 text-sm font-black border rounded-xl cursor-default select-none ${
                        visualTroco > 0
                          ? 'border-emerald-500 bg-emerald-100 text-emerald-950'
                          : 'border-slate-200 bg-slate-100 text-slate-600'
                      }`}
                      aria-label={'calculated_change'.tr}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">
                    {visualHasDeficit ? 'amount_less_than_the_installment'.tr : visualTroco > 0 ? 'change_to_customer'.tr : 'no_change'.tr}
                  </span>
                </div>
              </div>
            </div>
          )}

          {needsManualProof && (
            <div className="mt-3 space-y-2 border-t border-emerald-200 pt-3">
              <PixProofUpload targetType="ORDER" targetId={order.id} onChange={setProofId} />
              <label className="flex items-start gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={manualProofSeen} onChange={(e) => setManualProofSeen(e.target.checked)} className="mt-0.5" />
                <span>{'i_have_verified_the_pix_receipt_in_conflora_s_bank_account'.tr}</span>
              </label>
              <textarea
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                aria-label={'receipt_note'.tr}
                rows={2}
                placeholder={'receipt_note_e_g_receipt_checked_at_the_time'.tr}
                value={manualPixNote}
                onChange={(e) => setManualPixNote(e.target.value)}
              />
            </div>
          )}

          <div className="sticky bottom-0 bg-white/95 backdrop-blur-md pt-3 pb-1 border-t border-slate-200 mt-4 z-20">
            <button
              type="button"
              disabled={busy || !canFinalize || (needsManualProof && (!proofId || !manualProofSeen || manualPixNote.trim().length < 8))}
              className={`cf-btn-3d cf-btn-3d--lg cf-btn-3d--block ${
                canFinalize
                  ? 'cf-btn-3d--primary'
                  : 'cf-btn-3d--secondary'
              }`}
              onClick={handleConfirmReceive}
              aria-label={'confirm_payment_and_finish'.tr}
            >
              {busy ? (
                'processing_aebd32'.tr
              ) : hasAnyExceeded ? (
                `${'amount_exceeds_the_sale_balance'.tr}${money(total)})`
              ) : !canFinalize && remainingCents > 0 ? (
                `⚠️ Falta preencher ${money(remainingCents / 100)} ${'to_finalize'.tr}`
              ) : !canFinalize && remainingCents < 0 ? (
                `${'adjust_the_excess_amount_of'.tr} ${money(-remainingCents / 100)}`
              ) : needsManualProof && (!proofId || !manualProofSeen || manualPixNote.trim().length < 8) ? (
                'attach_and_confirm_the_pix_receipt'.tr
              ) : deliveryMode ? (
                'confirm_receipt_and_complete_delivery'.tr
              ) : (
                `${'confirm_payment_of'.tr} ${money(order.total)}`
              )}
            </button>
          </div>
        </section>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}

        {/* Floating Action Button (FAB) pinned at the bottom for primary workflow actions */}
        {fabAction && !canReceive && (
          <div className="sticky bottom-0 left-0 right-0 -mx-4 -mb-4 mt-4 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 flex items-center justify-center shadow-lg">
            <button
              type="button"
              disabled={fabAction.disabled}
              onClick={fabAction.onClick}
              className={`cf-btn-3d cf-btn-3d--lg cf-btn-3d--block ${
                fabAction.disabled
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none'
                  : fabAction.tone === 'amber'
                  ? 'cf-btn-3d--warning'
                  : fabAction.tone === 'sky'
                  ? 'cf-btn-3d--sky'
                  : 'cf-btn-3d--primary'
              }`}
            >
              {fabAction.label}
            </button>
          </div>
        )}
      </div>
    </Panel>;
  }

  function OrderCard({ order, tone, selected, attention, onDetails, stage, canMove, onDragStart, onDragEnd }) {
    const items = (order.items || []).slice(0, 2);
    const extraItems = Math.max(0, (order.items || []).length - items.length);
    const deliveryDriver = order.assignedDriver || order.deliveredBy;
    return <OrderCardSurface data-order-card="true" padding="sm" style={orderCardColors[tone] || orderCardColors.amber} draggable={canMove && ['confirmation', 'payment'].includes(stage) ? 'true' : undefined} onDragStart={(event) => { event.dataTransfer.setData('application/x-conflora-order', JSON.stringify({ id: order.id, from: stage })); event.dataTransfer.effectAllowed = 'move'; onDragStart?.(stage); }} onDragEnd={onDragEnd} className={`cf-order-card cf-order-card--${tone || 'amber'} ${selected ? 'cf-order-card--selected' : ''} ${attention ? 'cf-order-card--attention' : ''}`}>
      <button type="button" style={{ transform: 'none', boxShadow: 'none' }} className="w-full cursor-pointer text-left" onClick={() => onDetails(order)} aria-label={`${'open_receipt_and_order_details'.tr} ${order.ticketNumber}`}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500"> {'tab'.tr} {order.ticketNumber || String(order.id).slice(-6).toUpperCase()}</span>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900">{paymentLabel(order.paymentMethod)}</span>
        </div>
        <p className="mt-2 text-[11px] font-bold text-emerald-800">{order.deliveryStatus === 'OUT_FOR_DELIVERY' ? 'on_the_way'.tr : ''}{window.ConfloraOrderDisplay.status(order)}</p>
        {deliveryDriver && <span data-delivery-driver className="mt-2 inline-flex max-w-full items-start gap-1.5 rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-[11px] font-bold leading-5 text-emerald-900" title={`${'responsible_delivery_person'.tr} ${deliveryDriver.name || 'courier'.tr}`} aria-label={`${'responsible_delivery_person'.tr} ${deliveryDriver.name || 'courier'.tr}`}><span aria-hidden="true">🛵</span><span className="min-w-0 break-words"> {'courier_f3547c'.tr} {deliveryDriver.name || 'courier'.tr}</span></span>}
        {order.deliveryOverview && <div className="mt-2 space-y-1 rounded-lg bg-white/60 p-2 text-[11px] font-semibold text-slate-700">{order.deliveryOverview.map(line => <p key={line}>{line}</p>)}</div>}
        <p className="mt-1 font-bold text-slate-800">{order.customerName || "Cliente Balcão"}</p>
        <p title={(order.items || []).map((item) => item.name).join(' · ')} className="mt-1 text-xs leading-5 text-slate-600">{items.map(orderItemLabel).join(' · ')}{extraItems ? ` · +${extraItems} item(ns)` : ''}</p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <span className="text-[11px] text-slate-500">{dateTime(order.createdAt)}</span>
          <strong className="text-base text-[#0F381E]">{money(order.total)}</strong>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">{'order_placed_by_ba852c'.tr} <strong>{staffLabel(order.createdBy)}</strong></p>
        <span className="mt-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-[10px] font-extrabold text-emerald-900"> {'view_receipt_and_details'.tr} </span>
      </button>
    </OrderCardSurface>;
  }
  function WhatsappCompactCard({ conversation, selected, onClick }) {
    const rawPhone = String(conversation.phone || conversation.customerPhone || '').replace(/\D/g, '');
    const formattedPhone = rawPhone.length === 11
      ? `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 7)}-${rawPhone.slice(7)}`
      : rawPhone.length === 13 && rawPhone.startsWith('55')
      ? `+55 (${rawPhone.slice(2, 4)}) ${rawPhone.slice(4, 9)}-${rawPhone.slice(9)}`
      : conversation.phone || conversation.customerPhone || 'Não informado';

    const unreadCount = Number(conversation.unreadCount || conversation.unread || 0);
    const lastMsgTime = conversation.updatedAt
      ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(conversation.updatedAt))
      : '';

    const isHuman = conversation.automation === 'paused';
    const isNeedsVendor = isHuman && conversation.reason === 'needs_vendor';
    const isAwaitingPix = conversation.paymentStatus === 'AWAITING_PIX';
    const isPaid = conversation.paymentStatus === 'PAID' || conversation.status === 'COMPLETED';

    return (
      <button
        type="button"
        onClick={() => onClick(conversation)}
        className={`w-full text-left rounded-2xl border p-3.5 transition shadow-2xs relative cursor-pointer ${
          selected
            ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20'
            : 'border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50/80'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm font-black text-slate-900">
              {conversation.customerName || conversation.name || 'Cliente WhatsApp'}
            </strong>
            <span className="block truncate text-xs font-semibold text-slate-500">
              📱 {formattedPhone}
            </span>
          </div>
          {lastMsgTime && (
            <span className="shrink-0 text-[10px] font-bold text-slate-400">
              {lastMsgTime}
            </span>
          )}
        </div>

        {conversation.lastMessage && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">
            "{conversation.lastMessage}"
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
            isNeedsVendor
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : isHuman
              ? 'bg-purple-100 text-purple-900 border border-purple-300'
              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
          }`}>
            {isNeedsVendor ? '⚠️ Precisa de vendedor' : isHuman ? '👤 Vendedor' : '🤖 Agente Conflora'}
          </span>

          {isAwaitingPix && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 border border-sky-300 px-2 py-0.5 text-[10px] font-extrabold text-sky-900">
              ⏳ Aguardando Pix
            </span>
          )}

          {isPaid && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-extrabold text-emerald-900">
              ✅ Pago
            </span>
          )}

          {unreadCount > 0 && (
            <span className="ml-auto shrink-0 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-black shadow-xs">
              {unreadCount}
            </span>
          )}
        </div>
      </button>
    );
  }

  function WhatsappChatDrawer({ conversation, onClose, onTakeover, onRelease, onCloseConversation, onOpenOrder }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const rawPhone = String(conversation?.phone || conversation?.customerPhone || '').replace(/\D/g, '');
    const compositionClaim = useRef(null);
    const manualRequest = useRef(null);
    const [compositionReady, setCompositionReady] = useState(false);
    const ensureCompositionClaim = () => {
      if (!compositionClaim.current) compositionClaim.current = api(`/api/admin/whatsapp/conversations/${rawPhone}/takeover`, {})
        .then(() => { setCompositionReady(true); })
        .catch(err => { compositionClaim.current = null; setCompositionReady(false); setError(err.message); throw err; });
      return compositionClaim.current;
    };

    useEffect(() => {
      if (!rawPhone) return;
      compositionClaim.current = null;
      manualRequest.current = null;
      setCompositionReady(false);
      setText('');
      let active = true;
      api(`/api/admin/whatsapp/conversations/${rawPhone}/messages`)
        .then(res => { if (active && res.messages) setMessages(res.messages); })
        .catch(err => { if (active) setError(err.message); });

      const handleKey = (event) => {
        if (event.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKey);
      return () => { active = false; window.removeEventListener('keydown', handleKey); };
    }, [rawPhone]);

    const handleSend = async () => {
      if (!text.trim() || sending) return;
      setSending(true);
      setError('');
      try {
        await ensureCompositionClaim();
        if (!manualRequest.current || manualRequest.current.text !== text.trim()) manualRequest.current = { text: text.trim(), requestId: crypto.randomUUID() };
        await api(`/api/admin/whatsapp/conversations/${rawPhone}/send`, manualRequest.current);
        manualRequest.current = null;
        setText('');
        const res = await api(`/api/admin/whatsapp/conversations/${rawPhone}/messages`);
        if (res.messages) setMessages(res.messages);
      } catch (err) {
        setError(err.message);
      } finally {
        setSending(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    const openWaMe = async () => {
      try {
        await onTakeover(conversation);
        window.open(`https://wa.me/${rawPhone}`, '_blank');
      } catch (err) {
        setError('Não foi possível pausar o agente antes de abrir no WhatsApp.');
      }
    };

    if (!conversation) return null;

    return (
      <div className="fixed inset-0 z-[90] flex justify-end bg-black/40 backdrop-blur-xs" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <aside className="w-full max-w-lg h-full bg-white flex flex-col shadow-2xl overflow-hidden border-l border-slate-200">
          <header className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <div>
              <h2 className="text-base font-black text-slate-900">{conversation.customerName || conversation.name || 'Cliente WhatsApp'}</h2>
              <p className="text-xs text-slate-500 font-semibold">📱 {rawPhone}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar painel" className="w-8 h-8 rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center justify-center font-bold">✕</button>
          </header>

          {/* Bar de Ações do Operador */}
          <div className="p-3 bg-emerald-50/60 border-b border-emerald-100 flex flex-wrap gap-2 shrink-0">
            {conversation.automation === 'paused' ? (
              <button type="button" onClick={() => { compositionClaim.current = null; setCompositionReady(false); onRelease(conversation); }} className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--sm">
                Retomar automação
              </button>
            ) : (
              <button type="button" onClick={() => onTakeover(conversation)} className="cf-btn-3d cf-btn-3d--primary cf-btn-3d--sm">
                👤 Assumir Atendimento
              </button>
            )}

            {conversation.orderId && (
              <button type="button" onClick={() => onOpenOrder(conversation.orderId)} className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--sm">
                📋 Abrir Comanda
              </button>
            )}

            <button type="button" onClick={openWaMe} className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--sm">
              💬 Abrir no WhatsApp
            </button>

            <button type="button" onClick={() => onCloseConversation(conversation)} className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--sm ml-auto text-red-700">
              ✖ Encerrar
            </button>
          </div>

          {/* Histórico Cronológico */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0 bg-[#F4F6F5]">
            {error && <p role="alert" className="p-3 rounded-xl bg-red-50 text-xs font-bold text-red-800 border border-red-200">{error}</p>}
            {messages.map((msg) => {
              const isUser = msg.payload?.from || msg.sentBy;
              const msgTime = msg.createdAt ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(msg.createdAt)) : '';
              return (
                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-xs font-medium ${isUser ? 'bg-emerald-700 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-2xs'}`}>
                    <p className="whitespace-pre-wrap">{msg.payload?.message || msg.text || '[Sem texto]'}</p>
                    {msgTime && <span className={`block text-[9px] mt-1 text-right font-bold ${isUser ? 'text-emerald-200' : 'text-slate-400'}`}>{msgTime}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input e Envio de Mensagem */}
          <footer className="p-3 border-t border-slate-200 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <textarea
                rows={1}
                value={text}
                readOnly={!compositionReady}
                onFocus={() => { ensureCompositionClaim().catch(() => {}); }}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem… (Enter envia, Shift+Enter quebra linha)"
                className="flex-1 p-2.5 border border-slate-300 rounded-xl text-xs focus:border-emerald-600 focus:outline-none resize-none"
              />
              <button
                type="button"
                disabled={sending || !text.trim()}
                onClick={handleSend}
                className="cf-btn-3d cf-btn-3d--primary cf-btn-3d--md"
              >
                {sending ? '...' : 'Enviar'}
              </button>
            </div>
          </footer>
        </aside>
      </div>
    );
  }

  function MetricCard({ label, value, description, tone = 'default' }) {
    return <cf-card padding="sm" class="cf-metric-card" tone={tone === 'debt' ? 'warning' : undefined}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-[#0F381E]">{value}</p>
      {description && <p className="mt-1 text-[10px] text-slate-500">{description}</p>}
    </cf-card>;
  }
  function AbrirCaixaModal({ onOpened, onClose }) {
    const [openingFloat, setOpeningFloat] = useState('');
    const [requestId] = useState(() => crypto.randomUUID());
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <form aria-label={'cashier_opening'.tr} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setError('');
        try { await api('/api/caixa/open-my-cashier', { requestId, openingFloat: Number(openingFloat) }); await onOpened(); }
        catch (err) { setError(err.message); } finally { setBusy(false); }
      }}>
        <h2 className="text-xl font-black text-emerald-950"> {'cashier_opening'.tr} </h2>
        <p className="my-3 text-sm text-slate-600"> {'cashier_opening_instructions'.tr} </p>
        <label className="block text-sm font-bold"> {'cashier_opening_float'.tr} <input autoFocus required type="number" min="0" step="0.01" value={openingFloat} onChange={e => setOpeningFloat(e.target.value)} className="my-2 w-full rounded-xl border p-3" />
        </label>
        {error && <p role="alert" className="my-2 text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="cf-btn-3d cf-btn-3d--primary w-full">{busy ? 'opening_in_progress'.tr : 'confirm_opening_cash'.tr}</button>
        {onClose && <button type="button" onClick={onClose} disabled={busy} className="mt-3 w-full text-sm">Cancelar</button>}
      </form>
    </div>;
  }
  function FecharCaixaModal({ status, onClose, onClosed, user }) {
    const [counted, setCounted] = useState({ cash: '', pix: '', credit: '', debit: '' });
    const [proofId, setProofId] = useState('');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    const expected = status?.myExpected || { cash: 0, pix: 0, credit: 0, debit: 0, total: 0 };
    const num = (v) => Number(String(v || '0').replace(',', '.')) || 0;
    const cashVal = num(counted.cash);
    const pixVal = num(counted.pix);
    const creditVal = num(counted.credit);
    const debitVal = num(counted.debit);
    const totalCounted = Math.round((cashVal + pixVal + creditVal + debitVal) * 100) / 100;

    const diffs = {
      cash: Math.round((cashVal - expected.cash) * 100) / 100,
      pix: Math.round((pixVal - expected.pix) * 100) / 100,
      credit: Math.round((creditVal - expected.credit) * 100) / 100,
      debit: Math.round((debitVal - expected.debit) * 100) / 100,
      total: Math.round((totalCounted - expected.total) * 100) / 100,
    };

    const diffBadge = (diff) => {
      if (diff === 0) return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800"> {'exact'.tr} </span>;
      if (diff > 0) return <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">+{money(diff)} {'over'.tr} </span>;
      return <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800">{money(diff)} {'short'.tr} </span>;
    };

    const handleConfirmFinal = async () => {
      setBusy(true);
      setError('');
      try {
        const response = await api('/api/caixa/close-my-cashier', {
          date: status.date,
          sessionId: status.mySession.id,
          counted: { cash: cashVal, pix: pixVal, credit: creditVal, debit: debitVal },
          proofId,
          notes,
        });
        onClosed(response);
      } catch (err) {
        setError(err.message);
        setShowConfirm(false);
      } finally {
        setBusy(false);
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
        <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
          <div className="flex items-start justify-between border-b border-slate-100 pb-3">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-emerald-800">{'register_closing_check'.tr}</span>
              <h3 className="text-lg font-black text-[#0F381E]">{'close_register'.tr} {user.name || user.email}</h3>
              <p className="text-xs text-slate-500"> {'date'.tr} {status.date} {'your_shift_records'.tr}</p>
            </div>
            <button onClick={onClose} disabled={busy} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">✕</button>
          </div>

          {error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-800 border border-rose-200">{error}</p>}

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p> {'current_session_float'.tr} <strong>{money(expected.openingFloat || 0)}</strong></p>
              <p> {'cash_receipts_label'.tr} <strong>{money(expected.cashReceipts || 0)}</strong></p>
              <p> {'cash_total_with_float'.tr} <strong>{money(expected.cash)}</strong></p>
              <p className="mt-1 text-xs"> {'count_all_drawer_cash'.tr} </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-black uppercase text-slate-700">{'enter_the_physically_counted_amounts'.tr}</h4>
                <button
                  type="button"
                  onClick={() => setCounted({
                    cash: Number(expected.cash || 0).toFixed(2),
                    pix: Number(expected.pix || 0).toFixed(2),
                    debit: Number(expected.debit || 0).toFixed(2),
                    credit: Number(expected.credit || 0).toFixed(2),
                  })}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-900 hover:bg-emerald-100 transition"
                >
                  ✓ Preencher conforme sistema
                </button>
              </div>
              <div className="mt-3 space-y-2.5">
                {[
                  { key: 'cash', label: 'cash_in_drawer'.tr, exp: expected.cash, hint: 'cash_and_coins'.tr },
                  { key: 'pix', label: 'pix_received_statement'.tr, exp: expected.pix, hint: 'sicredi_receipts'.tr },
                  { key: 'debit', label: 'debit_card_card_machine'.tr, exp: expected.debit, hint: 'pos_daily_report'.tr },
                  { key: 'credit', label: 'credit_card_card_machine'.tr, exp: expected.credit, hint: 'pos_daily_report'.tr },
                ].map((item) => (
                  <div key={item.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl bg-white p-2.5 border border-slate-200 shadow-sm">
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-slate-800">{item.label}</span>
                      <span className="text-[11px] text-slate-400"> {'system_total'.tr} <strong>{money(item.exp)}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        title="Usar valor do sistema"
                        onClick={() => setCounted({ ...counted, [item.key]: Number(item.exp || 0).toFixed(2) })}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-extrabold text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300 transition shrink-0"
                      >
                        = Sistema
                      </button>
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          aria-label={item.label}
                          value={counted[item.key]}
                          onChange={(e) => setCounted({ ...counted, [item.key]: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 py-1 pl-8 pr-2 text-right text-xs font-bold text-slate-800 focus:border-emerald-600 focus:outline-none"
                        />
                      </div>
                      <div className="min-w-[85px] text-right">
                        {diffBadge(diffs[item.key])}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TOTAL CONSOLIDADO */}
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/50 p-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                <span>{'system_calculated_total'.tr}</span>
                <span>{money(expected.total)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-base font-black text-[#0F381E]">
                <span>{'total_counted_in_cash_drawer'.tr}</span>
                <span>{money(totalCounted)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-emerald-200 pt-2 text-xs">
                <span className="font-bold text-slate-700">{'overall_difference'.tr}</span>
                {diffBadge(diffs.total)}
              </div>
            </div>

            {/* FOTO DO COMPROVANTE DA MAQUININHA */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <span className="block text-xs font-black text-slate-700">{'card_machine_report_photo'.tr}</span>
              <p className="text-[11px] text-slate-500 mb-2">{'take_a_photo_of_the_screen_or_printed_receipt_from_the_card_machine_closing'.tr}</p>
              <PixProofUpload
                targetType="CLOSING"
                targetId={status.mySession.id}
                label={'attach_photo_or_pdf_of_card_machine_report'.tr}
                hint="Tire foto da maquininha • até 3 MB"
                onChange={setProofId}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{'cash_register_notes_optional'.tr}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={'ex_0_50_difference_due_to_lack_of_change_coins_drawer_checked'.tr}
                rows={2}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* CONFIRM DIALOG OR BUTTON */}
          <div className="mt-5 border-t border-slate-100 pt-4">
            {!showConfirm ? (
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                > {'product_entry_cancel'.tr} </button>
                <button
                  type="button"
                  onClick={() => {
                    if (Object.values(counted).some(value => value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) { setError('Preencha todos os valores conferidos, incluindo zero quando não houver recebimentos.'); return; }
                    setError(''); setShowConfirm(true);
                  }}
                  disabled={busy}
                  className="cf-btn-3d cf-btn-3d--primary px-5 py-2.5 text-xs font-black"
                > {'review_close_register'.tr} </button>
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-red-500 bg-red-50 p-4">
                <p className="text-xs font-black text-red-900"> {'attention_this_operation_is_final_and_cannot_be_undone'.tr} </p>
                <p className="mt-1 text-[11px] text-red-700"> {'upon_confirming_your_daily_cash_register_will_be_closed_if_all_operators_for_the_day_'.tr} </p>
                <div className="mt-3 flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    disabled={busy}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  > {'go_back_and_review'.tr} </button>
                  <button
                    type="button"
                    onClick={handleConfirmFinal}
                    disabled={busy}
                    className="rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white shadow-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {busy ? 'closing_register'.tr : 'yes_close_permanently'.tr}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function CashierColumn({ title, hint, orders, tone, selectedOrderId, pulsedOrderIds, onDetails, stage, canMove, dragFrom, onMove, onDragStart, onDragEnd, isTargetGlow }) {
    const themes = {
      amber: 'border-amber-300 bg-amber-50 text-amber-950',
      blue: 'border-sky-300 bg-sky-50 text-sky-950',
      green: 'border-emerald-300 bg-emerald-50 text-emerald-950',
      red: 'border-red-300 bg-red-50 text-red-950',
    };
    const acceptsDrop = canMove && ((dragFrom === 'confirmation' && stage === 'payment') || (dragFrom === 'payment' && stage === 'paid'));
    return <section data-empty={orders.length === 0} data-column-stage={stage} data-column-title={title} onDragOver={(event) => { if (acceptsDrop) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDrop={(event) => { event.preventDefault(); if (!acceptsDrop) return; try { const payload = JSON.parse(event.dataTransfer.getData('application/x-conflora-order')); onMove(payload.id, payload.from, stage); } catch { /* Ignore unrelated drag payloads. */ } onDragEnd(); }} className={`w-[340px] min-w-[340px] shrink-0 snap-start flex flex-col rounded-2xl border border-slate-200 bg-slate-100 p-3 ${acceptsDrop ? 'cf-order-column--drop' : ''} ${isTargetGlow ? 'cf-order-column--target-glow' : ''}`} aria-label={title}>
      <header className={`mb-3 rounded-xl border px-3 py-2 ${themes[tone]}`}>
        <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-black tracking-wide">{title}</h3><span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-extrabold">{orders.length}</span></div>
        <p className="mt-1 text-[10px] opacity-75">{hint}</p>
      </header>
      <div className="cf-order-card-list space-y-2">
        {orders.map((order) => <OrderCard key={order.id} order={order} tone={tone} stage={stage} canMove={canMove} onDragStart={onDragStart} onDragEnd={onDragEnd} attention={pulsedOrderIds.has(order.id)} selected={selectedOrderId === order.id && order.status === 'AWAITING_CONFIRMATION'} onDetails={onDetails} />)}
        {!orders.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-center text-xs text-slate-500"> {'no_orders_in_this_stage'.tr} </p>}
      </div>
    </section>;
  }

  const SOUND_SETTINGS_STORAGE_KEY = 'conflora:pdv:sound-settings:v1';
  const DEFAULT_SOUND_SETTINGS = Object.freeze({
    muted: false,
    tone: 'chime',
    volume: 0.45,
  });

  function readSoundSettings() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SOUND_SETTINGS_STORAGE_KEY) : null;
      if (!raw) return { ...DEFAULT_SOUND_SETTINGS };
      const parsed = JSON.parse(raw);
      return {
        muted: Boolean(parsed.muted),
        tone: ['chime', 'soft', 'bell'].includes(parsed.tone) ? parsed.tone : 'chime',
        volume: Number.isFinite(Number(parsed.volume)) ? Math.min(1, Math.max(0.05, Number(parsed.volume))) : 0.45,
      };
    } catch {
      return { ...DEFAULT_SOUND_SETTINGS };
    }
  }

  function saveSoundSettings(next) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SOUND_SETTINGS_STORAGE_KEY, JSON.stringify(next));
      }
    } catch { /* Ignore storage quota errors */ }
  }

  let sharedAudioCtx = null;
  function playOrderAlertSound(settings = readSoundSettings(), isBatch = false) {
    if (!settings || settings.muted) return false;
    try {
      const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (!AudioCtx) return false;
      if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
        sharedAudioCtx = new AudioCtx();
      }
      if (sharedAudioCtx.state === 'suspended' && typeof sharedAudioCtx.resume === 'function') {
        sharedAudioCtx.resume().catch(() => {});
      }

      const now = sharedAudioCtx.currentTime;
      const gainLevel = Math.min(1, Math.max(0.05, Number(settings.volume || 0.45))) * 0.18;
      const profiles = {
        chime: isBatch ? [587.33, 783.99, 1046.5] : [659.25, 880],
        soft: isBatch ? [440, 554.37, 659.25] : [523.25, 659.25],
        bell: isBatch ? [783.99, 987.77, 1174.66] : [783.99, 1174.66],
      };
      const notes = profiles[settings.tone] || profiles.chime;

      notes.forEach((freq, idx) => {
        const osc = sharedAudioCtx.createOscillator();
        const gain = sharedAudioCtx.createGain();
        osc.type = settings.tone === 'bell' ? 'triangle' : 'sine';
        const startAt = now + idx * 0.11;
        const duration = 0.28;
        osc.frequency.setValueAtTime(freq, startAt);
        gain.gain.setValueAtTime(0.0001, startAt);
        gain.gain.exponentialRampToValueAtTime(gainLevel, startAt + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
        osc.connect(gain);
        gain.connect(sharedAudioCtx.destination);
        osc.start(startAt);
        osc.stop(startAt + duration + 0.02);
      });
      return true;
    } catch {
      return false;
    }
  }

  function OrderDateFilter({ from, to, today, onChange }) {
    const dialogRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState('day');
    const [draftFrom, setDraftFrom] = useState(from);
    const [draftTo, setDraftTo] = useState(to);
    const filtered = from !== today || to !== today;
    const validRange = Boolean(draftFrom && (mode === 'day' || draftTo && draftFrom <= draftTo));

    const openFilter = () => {
      setDraftFrom(from);
      setDraftTo(to);
      setMode(from === to ? 'day' : 'range');
      dialogRef.current.showModal();
      setOpen(true);
    };
    const apply = (start, end) => {
      onChange(start, end);
      dialogRef.current.close();
    };
    const closeOnBackdrop = (event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
        event.currentTarget.close();
      }
    };

    return <>
      <button type="button" className={`cf-btn-3d ${filtered ? 'cf-btn-3d--active' : 'cf-btn-3d--secondary'} cf-orders-fab`} aria-label={'orders_date_filter'.tr} title={`${'orders_date_filter'.tr}: ${from === to ? from : `${from} / ${to}`}`} aria-haspopup="dialog" aria-expanded={open} aria-controls="orders-date-filter" data-filter-active={filtered} onClick={openFilter}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="cf-orders-fab-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h18l-7 8v7l-4 2v-9L3 4z" /></svg>
        <span className="cf-orders-fab-tooltip">{'orders_date_filter'.tr}</span>
      </button>
      <dialog ref={dialogRef} id="orders-date-filter" className="cf-orders-date-dialog" aria-labelledby="orders-date-filter-title" onClose={() => setOpen(false)} onClick={closeOnBackdrop}>
        <header className="cf-orders-date-dialog-header">
          <h2 id="orders-date-filter-title">{'orders_date_filter_title'.tr}</h2>
          <button type="button" className="cf-orders-date-close" aria-label={'common_close'.tr} onClick={() => dialogRef.current.close()}>✕</button>
        </header>
        <div className="cf-orders-date-presets">
          {[{ days: 0, label: 'today'.tr }, { days: 7, label: 'label_7_days'.tr }, { days: 30, label: 'label_30_days'.tr }].map(option => {
            const start = option.days === 0 ? today : dateOffset(today, -(option.days - 1));
            return <button key={option.days} type="button" className={`cf-btn-3d cf-btn-3d--sm ${from === start && to === today ? 'cf-btn-3d--active' : 'cf-btn-3d--secondary'}`} aria-pressed={from === start && to === today} onClick={() => apply(start, today)}>{option.label}</button>;
          })}
        </div>
        <form onSubmit={event => { event.preventDefault(); if (validRange) apply(draftFrom, mode === 'day' ? draftFrom : draftTo); }}>
          <div className="cf-orders-date-modes">
            {[{ value: 'day', label: 'orders_date_single_day'.tr }, { value: 'range', label: 'orders_date_range'.tr }].map(option => <button key={option.value} type="button" aria-pressed={mode === option.value} className={`cf-btn-3d cf-btn-3d--sm ${mode === option.value ? 'cf-btn-3d--active' : 'cf-btn-3d--secondary'}`} onClick={() => setMode(option.value)}>{option.label}</button>)}
          </div>
          <div className="cf-orders-date-fields">
            <label>{mode === 'day' ? 'date'.tr : 'from'.tr}<input required aria-label={mode === 'day' ? 'date'.tr : 'start_date'.tr} className="cf-orders-date-input" type="date" value={draftFrom} onChange={event => setDraftFrom(event.target.value)} /></label>
            {mode === 'range' && <label>{'to'.tr}<input required aria-label={'end_date'.tr} className="cf-orders-date-input" type="date" value={draftTo} min={draftFrom} onChange={event => setDraftTo(event.target.value)} /></label>}
          </div>
          {mode === 'range' && draftFrom && draftTo && draftFrom > draftTo && <p role="alert" className="mt-3 text-xs text-red-700">{'select_a_valid_date_range'.tr}</p>}
          <button type="submit" disabled={!validRange} className="cf-btn-3d cf-btn-3d--primary cf-btn-3d--sm cf-orders-date-apply">{'orders_date_apply'.tr}</button>
        </form>
      </dialog>
    </>;
  }

  function OrderSoundAlert({ settings, onChange, floating = false }) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
      if (!open) return undefined;
      const onDocClick = (event) => {
        if (containerRef.current && !containerRef.current.contains(event.target)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    const update = (patch) => {
      const next = { ...settings, ...patch };
      saveSoundSettings(next);
      onChange(next);
    };

    return (
      <div ref={containerRef} className={floating ? 'cf-orders-alert-control' : 'relative inline-flex items-center gap-1'}>
        <button
          type="button"
          onClick={() => update({ muted: !settings.muted })}
          aria-pressed={!settings.muted}
          aria-label={settings.muted ? 'enable_sound_for_new_orders'.tr : 'mute_sound_for_new_orders'.tr}
          title={settings.muted ? 'notification_sound_muted_click_to_enable'.tr : 'notification_sound_active_click_to_mute'.tr}
          className={floating ? `cf-btn-3d cf-btn-3d--sm cf-orders-fab ${settings.muted ? 'cf-btn-3d--secondary' : 'cf-btn-3d--active'}` : `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-extrabold transition ${settings.muted ? 'border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200' : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="cf-orders-fab-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {settings.muted ? <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m17 9 5 6m0-6-5 6" /></> : <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7m3-10a9 9 0 0 1 0 13" /></>}
          </svg>
          <span className={floating ? 'cf-orders-fab-tooltip' : 'hidden sm:inline'}>{settings.muted ? 'muted'.tr : 'sound_alert'.tr}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((curr) => !curr)}
          aria-expanded={open}
          aria-label={'notification_sound_settings'.tr}
          title={'configure_order_sound_alert'.tr}
          className={floating ? 'cf-btn-3d cf-btn-3d--sm cf-btn-3d--secondary cf-orders-fab' : 'inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-slate-600 shadow-2xs transition hover:border-emerald-400 hover:text-emerald-900'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="cf-orders-fab-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1A1.7 1.7 0 0 0 4.2 12H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V2a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9z" /></svg>
          {floating && <span className="cf-orders-fab-tooltip">{'notification_sound_settings'.tr}</span>}
        </button>

        {open && (
          <div
            role="dialog"
            aria-label={'notification_sound_settings_be48e7'.tr}
            className={floating ? 'cf-orders-sound-popover absolute left-full top-0 z-50 ml-3 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl' : 'absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xl'}
          >
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
              <strong className="text-xs font-black uppercase tracking-wide text-[#0F381E]"> {'notification_sound'.tr} </strong>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-1.5 py-0.5 text-xs font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={'close_sound_settings'.tr}
              >
                ✕
              </button>
            </div>

            <label className="mb-3 flex cursor-pointer items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
              <span> {'mute_alerts_silent'.tr} </span>
              <input
                type="checkbox"
                checked={settings.muted}
                onChange={(e) => update({ muted: e.target.checked })}
                className="h-4 w-4 accent-emerald-700"
              />
            </label>

            <label className="mb-3 block text-xs font-bold text-slate-700"> {'alert_chime'.tr} <select
                value={settings.tone}
                disabled={settings.muted}
                onChange={(e) => {
                  const next = { ...settings, tone: e.target.value };
                  saveSoundSettings(next);
                  onChange(next);
                  playOrderAlertSound(next, false);
                }}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 disabled:opacity-50"
              >
                <option value="chime">{'soft_crystal_default'.tr}</option>
                <option value="soft"> {'discreet_chord'.tr} </option>
                <option value="bell">{'counter_bell'.tr}</option>
              </select>
            </label>

            <label className="mb-3 block text-xs font-bold text-slate-700">
              <span className="flex justify-between">
                <span> {'volume'.tr} </span>
                <span className="text-emerald-800">{Math.round((settings.volume || 0.45) * 100)}%</span>
              </span>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                disabled={settings.muted}
                value={settings.volume}
                onChange={(e) => update({ volume: Number(e.target.value) })}
                className="mt-1 block w-full accent-emerald-700 disabled:opacity-50"
              />
            </label>

            <button
              type="button"
              onClick={() => playOrderAlertSound({ ...settings, muted: false }, false)}
              className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-900 transition hover:bg-emerald-100"
            > {'test_sound_now'.tr} </button>
          </div>
        )}
      </div>
    );
  }

  function resolveOrderTargetColumn(order, explicitStage) {
    if (order?.procurement && ['AWAITING_QUOTE', 'AWAITING_QUOTE_ACCEPTANCE', 'AWAITING_ARRIVAL', 'AWAITING_FULFILLMENT', 'AWAITING_RECONCILIATION'].includes(order.status)) return { stage: 'procurement', title: 'ENCOMENDAS', tone: 'amber' };
    const isPaidStage = explicitStage === 'paid' || Boolean(
      order && (
        order.paidAt ||
        order.completedAt ||
        order.paymentStatus === 'APPROVED' ||
        order.status === 'PAID' ||
        order.status === 'COMPLETED'
      )
    );
    if (isPaidStage) {
      return { stage: 'paid', title: 'paid_completed'.tr, tone: 'green' };
    }
    return { stage: 'payment', title: 'waiting_for_payment_6fbef3'.tr, tone: 'blue' };
  }

  function QuickProductDialog({ onClose, onCreated, products = [], initialName = '', canAdd = false, onUseExisting }) {
    const [name, setName] = useState(initialName);
    const [category, setCategory] = useState('Geral');
    const [unit, setUnit] = useState('UN');
    const [price, setPrice] = useState('');
    const [stockQuantity, setStockQuantity] = useState('0');
    const savingRef = useRef(false);
    const requestId = useRef(crypto.randomUUID());
    const dialogRef = useRef(null);
    useEffect(() => {
      const previousFocus = document.activeElement;
      const oldOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const handleKey = (event) => {
        if (event.key === 'Escape' && !savingRef.current) { event.preventDefault(); onClose(); }
        if (event.key !== 'Tab') return;
        const elements = [...dialogRef.current.querySelectorAll('button:not(:disabled),input:not(:disabled),summary,select')].filter(node => node.getClientRects().length);
        const first = elements[0]; const last = elements[elements.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      };
      document.addEventListener('keydown', handleKey);
      return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', handleKey); previousFocus?.focus?.(); };
    }, []);
    const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const matches = name.trim().length < 2 ? [] : products.filter((product) => normalize(product.name).includes(normalize(name))).slice(0, 3);
    const categories = [...new Set(products.map((product) => product.category).filter(Boolean))].sort();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const priceValue = Number(String(price).replace(',', '.'));
    const stockValue = Number(String(stockQuantity).replace(',', '.'));
    const valid = name.trim().length >= 2
      && Number.isFinite(priceValue) && priceValue > 0
      && String(stockQuantity).trim() !== '' && Number.isFinite(stockValue) && stockValue >= 0
      && (unit === 'KG' || Number.isInteger(stockValue));

    const submit = async (event) => {
      event.preventDefault();
      if (!valid || savingRef.current) return;
      savingRef.current = true;
      const addAfterSave = event.nativeEvent.submitter?.value === 'add';
      setBusy(true);
      setError('');
      try {
        const result = await api('/api/caixa/products', {
          requestId: requestId.current,
          name: name.trim(),
          category: category.trim() || 'Geral',
          unit,
          price: priceValue,
          stockQuantity: stockValue,
        });
        if (!result?.product) throw new Error('O produto foi salvo, mas não retornou os dados para exibição.');
        onCreated(result.product, addAfterSave);
      } catch (submitError) {
        setError(submitError.message || 'Não foi possível cadastrar o produto. Tente novamente.');
      } finally {
        savingRef.current = false;
        setBusy(false);
      }
    };

    const fieldClass = 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';
    const quickCategories = categories.slice(0, 6);
    return <div className="cf-quick-product-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cf-quick-product-title" className="cf-quick-product-dialog" onSubmit={submit}>
        <header className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-emerald-700">Cadastro rápido</p><h2 id="cf-quick-product-title" className="mt-1 text-xl font-black text-[#0F381E]">Novo produto</h2><p className="mt-1 text-xs text-slate-500">Cadastre o essencial e já continue a venda.</p></div>
          <button type="button" className="cf-quick-product-close" aria-label="Fechar cadastro" onClick={onClose} disabled={busy}>×</button>
        </header>
        <label className="mt-4 block text-xs font-extrabold text-slate-700">Nome do produto <span className="text-red-600">*</span>
          <input autoFocus required minLength={2} maxLength={180} className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Alface crespa" />
        </label>
        {matches.length > 0 && <aside className="mt-2 rounded-xl bg-amber-50 p-3 text-xs"><p className="font-bold">Já existe um produto parecido.</p>{matches.map((product) => <div key={product.id} className="mt-2 flex items-center justify-between gap-2"><span>{product.name} · {money(product.price)}</span><button type="button" className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--sm" onClick={() => onUseExisting?.(product)}>{canAdd ? 'Adicionar à venda' : 'Ver produto'}</button></div>)}</aside>}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-extrabold text-slate-700">Categoria
              <input list="quick-product-categories" maxLength={80} className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Geral" />
              <datalist id="quick-product-categories">{categories.map((value) => <option key={value} value={value} />)}</datalist>
            </label>
            {quickCategories.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {quickCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition ${
                      category === cat
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-emerald-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
          <fieldset className="block text-xs font-extrabold text-slate-700"><legend>Vendido por</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2" role="group" aria-label="Unidade de venda">
              {[['UN', 'Unidade'], ['KG', 'Quilo']].map(([value, label]) => <button key={value} type="button" aria-pressed={unit === value} onClick={() => { setUnit(value); if (value === 'KG' && Number.isInteger(Number(stockQuantity))) setStockQuantity(Number(stockQuantity).toFixed(3)); if (value === 'UN' && !Number.isInteger(Number(stockQuantity))) setStockQuantity(''); }} className={`cf-quick-product-unit ${unit === value ? 'is-selected' : ''}`}>{label}</button>)}
            </div>
          </fieldset>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block text-xs font-extrabold text-slate-700">Preço por {unit === 'KG' ? 'kg' : 'unidade'} <span className="text-red-600">*</span>
            <span className="mt-1.5 flex items-center rounded-xl border border-slate-200 bg-white focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100"><span className="pl-3 text-sm font-bold text-slate-400">R$</span><input required type="text" inputMode="decimal" className="w-full rounded-xl bg-transparent px-2 py-2.5 text-sm text-slate-800 outline-none" value={price ? Number(price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''} onChange={(event) => { const digits = event.target.value.replace(/[^0-9]/g, ''); setPrice(digits ? (Number(digits) / 100).toFixed(2) : ''); }} placeholder="0,00" /></span>
          </label>
          <details className="text-xs text-slate-600"><summary className="cursor-pointer py-3 font-bold">Mais opções</summary><label className="block text-xs font-extrabold text-slate-700">Estoque inicial ({unit === 'KG' ? 'kg' : 'un.'}) <span className="text-red-600">*</span>
            <input required min="0" step={unit === 'KG' ? '0.001' : '1'} type="number" inputMode="decimal" className={fieldClass} value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} />
          </label><p className="mt-1">Informe somente a quantidade real disponível. O cadastro não movimenta vendas anteriores.</p></details>
        </div>
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">Imagem e outras informações podem ser completadas depois. O produto ficará disponível no catálogo assim que for salvo.</p>
        {canAdd && stockValue <= 0 && <p className="mt-2 text-xs text-amber-800">Para vender agora, informe o estoque real disponível em Mais opções.</p>}
        {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-800">{error}</p>}
        <footer className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="cf-btn-3d cf-btn-3d--secondary cf-btn-3d--md" onClick={onClose} disabled={busy}>Cancelar</button>
          <button type="submit" value="save" className={`cf-btn-3d cf-btn-3d--${canAdd ? 'secondary' : 'primary'} cf-btn-3d--md`} disabled={!valid || busy}>{busy ? 'Salvando…' : 'Salvar produto'}</button>
          {canAdd && <button type="submit" value="add" className="cf-btn-3d cf-btn-3d--primary cf-btn-3d--md" disabled={!valid || busy}>Salvar e adicionar</button>}
        </footer>
      </form>
    </div>;
  }

  function CashierQueue({ user, view, onBack, onDebt, initialOrderId, onInitialOrderOpened, onProductCreated, products = [], hasActiveSale = false }) {
    const today = dateInSaoPaulo();
    const [dateFrom, setDateFrom] = useState(today);
    const [dateTo, setDateTo] = useState(today);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [dragFrom, setDragFrom] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [pulsedOrderIds, setPulsedOrderIds] = useState(() => new Set());
    const [newOrderNotice, setNewOrderNotice] = useState('');
    const [floatingOrder, setFloatingOrder] = useState(null);
    const [floatingBatch, setFloatingBatch] = useState([]);
    const [digestExpanded, setDigestExpanded] = useState(false);
    const [soundSettings, setSoundSettings] = useState(() => readSoundSettings());
    const [floatingTarget, setFloatingTarget] = useState(() => ({ stage: 'payment', title: 'waiting_for_payment_6fbef3'.tr, tone: 'blue' }));
    const [isFlying, setIsFlying] = useState(false);
    const [flyingToStage, setFlyingToStage] = useState(null);
    const [closingStatus, setClosingStatus] = useState(null);
    const [showClosingModal, setShowClosingModal] = useState(false);
    const [showOpeningModal, setShowOpeningModal] = useState(false);
    const [showQuickProductDialog, setShowQuickProductDialog] = useState(false);
    const [quickProductNotice, setQuickProductNotice] = useState('');
    const [closingNotice, setClosingNotice] = useState('');
    const dataRef = useRef(null);
    const refreshRequestRef = useRef(null);
    const soundSettingsRef = useRef(soundSettings);
    soundSettingsRef.current = soundSettings;
    const lastBatchTimestampRef = useRef(0);
    const floatingCardRef = useRef(null);
    const flyTimerRef = useRef(null);
    const autoFlyTimerRef = useRef(null);

    const loadClosingStatus = async () => {
      if (!['ADMIN', "CAIXA"].includes(user.role)) return;
      try {
        const res = await api('/api/caixa/closing-status');
        setClosingStatus(res);
      } catch (err) { setClosingNotice(err.message); }
    };

    useEffect(() => {
      loadClosingStatus();
    }, [dateFrom, dateTo, view]);

    useEffect(() => () => {
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current);
      if (autoFlyTimerRef.current) clearTimeout(autoFlyTimerRef.current);
    }, []);

    useEffect(() => {
      if (!initialOrderId) return;
      let active = true;
      api('/api/caixa/orders/' + encodeURIComponent(initialOrderId)).then(order => { if (active) { setSelectedOrder(order); onInitialOrderOpened?.(); } }).catch(error => { if (active) setError(error.message); });
      return () => { active = false; };
    }, [initialOrderId, user.id]);

    const applySlideCoordinates = (target) => {
      const cardEl = floatingCardRef.current;
      const boardEl = document.querySelector('.cf-cashier-board');
      const columnEl = document.querySelector(`[data-column-stage="${target.stage}"]`) || document.querySelector(`[data-column-title="${target.title}"]`);
      const startLeft = 24;
      const startTop = Math.max(120, (typeof window !== 'undefined' ? window.innerHeight : 768) - 230);
      const startRect = cardEl ? cardEl.getBoundingClientRect() : { left: startLeft, top: startTop, width: 340, height: 190 };
      let deltaX = target.stage === 'paid' ? 680 : 340;
      let deltaY = -240;

      if (columnEl) {
        let scrollShiftX = 0;
        if (boardEl && typeof boardEl.getBoundingClientRect === 'function') {
          const boardRect = boardEl.getBoundingClientRect();
          const colRectBefore = columnEl.getBoundingClientRect();
          if (colRectBefore.right > boardRect.right || colRectBefore.left < boardRect.left) {
            const desiredLeft = Math.max(0, columnEl.offsetLeft - Math.max(16, (boardRect.width - colRectBefore.width) / 2));
            scrollShiftX = boardEl.scrollLeft - desiredLeft;
            if (typeof boardEl.scrollTo === 'function') {
              boardEl.scrollTo({ left: desiredLeft, behavior: 'smooth' });
            } else {
              boardEl.scrollLeft = desiredLeft;
            }
          }
        }
        const listEl = columnEl.querySelector('.cf-order-card-list') || columnEl;
        const destRect = listEl.getBoundingClientRect();
        deltaX = Math.round((destRect.left + scrollShiftX) - startRect.left);
        deltaY = Math.round(Math.max(76, destRect.top + 8) - startRect.top);
      }

      if (cardEl && cardEl.style) {
        cardEl.style.setProperty('--cf-fly-x', `${deltaX}px`);
        cardEl.style.setProperty('--cf-fly-y', `${deltaY}px`);
      }
    };

    const triggerFly = (orderOrOrders, options = {}) => {
      const ordersList = Array.isArray(orderOrOrders)
        ? orderOrOrders.filter(Boolean)
        : [orderOrOrders || floatingOrder].filter(Boolean);
      if (!ordersList.length) return;
      const primaryOrder = ordersList[0];
      if (autoFlyTimerRef.current) clearTimeout(autoFlyTimerRef.current);
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current);

      const paidCount = ordersList.filter((o) => resolveOrderTargetColumn(o).stage === 'paid').length;
      const dominantStage = options.targetStage || (paidCount > ordersList.length / 2 ? 'paid' : resolveOrderTargetColumn(primaryOrder).stage);
      const target = resolveOrderTargetColumn(primaryOrder, dominantStage);

      setFloatingOrder(primaryOrder);
      if (ordersList.length > 1) {
        setFloatingBatch(ordersList);
      }
      setFloatingTarget(target);
      setFlyingToStage(target.stage);

      const startSlide = () => {
        applySlideCoordinates(target);
        setIsFlying(true);
        const idsToPulse = ordersList.map((o) => o.id);
        setPulsedOrderIds((current) => new Set([...current, ...idsToPulse]));
        flyTimerRef.current = setTimeout(() => {
          setIsFlying(false);
          setFloatingOrder(null);
          setFloatingBatch([]);
          setDigestExpanded(false);
          setFlyingToStage(null);
          if (options.openDetailsAfter) {
            setSelectedOrder(primaryOrder);
          }
        }, 680);
      };

      if (options.delayMs && options.delayMs > 0) {
        setIsFlying(false);
        flyTimerRef.current = setTimeout(startSlide, options.delayMs);
      } else {
        requestAnimationFrame(startSlide);
      }
    };

    const enqueueOrderNotifications = (incomingOrders, options = {}) => {
      const list = (Array.isArray(incomingOrders) ? incomingOrders : [incomingOrders]).filter(Boolean);
      if (!list.length) return;
      if (autoFlyTimerRef.current) clearTimeout(autoFlyTimerRef.current);
      if (flyTimerRef.current) clearTimeout(flyTimerRef.current);

      const now = Date.now();
      const withinRapidWindow = (now - lastBatchTimestampRef.current) < 12000;
      lastBatchTimestampRef.current = now;

      setFloatingBatch((currentBatch) => {
        const shouldMerge = !isFlying && (currentBatch.length > 0 || Boolean(floatingOrder) || withinRapidWindow);
        const baseList = shouldMerge ? (currentBatch.length ? currentBatch : (floatingOrder ? [floatingOrder] : [])) : [];
        const mergedMap = new Map();
        [...baseList, ...list].forEach((item) => {
          if (item && item.id) mergedMap.set(item.id, item);
        });
        const nextBatch = [...mergedMap.values()];
        const primary = nextBatch[nextBatch.length - 1] || list[0];
        const paidCount = nextBatch.filter((o) => resolveOrderTargetColumn(o).stage === 'paid').length;
        const dominantStage = options.targetStage || (paidCount > nextBatch.length / 2 ? 'paid' : resolveOrderTargetColumn(primary).stage);
        const target = resolveOrderTargetColumn(primary, dominantStage);

        setFloatingOrder(primary);
        setFloatingTarget(target);
        setIsFlying(false);
        setFlyingToStage(null);

        if (options.playSound !== false && window.ConfloraNotifications.cashierAlertsEnabled(user)) {
          playOrderAlertSound(soundSettingsRef.current, nextBatch.length > 1);
        }

        const autoSlideMs = options.autoSlideMs ?? (nextBatch.length > 1 ? 7500 : 5500);
        if (autoSlideMs > 0) {
          autoFlyTimerRef.current = setTimeout(() => {
            triggerFly(nextBatch, { targetStage: target.stage, openDetailsAfter: false });
          }, autoSlideMs);
        }
        return nextBatch;
      });
    };

    const refresh = (silent = false) => {
      const active = refreshRequestRef.current;
      if (active) {
        // An event or confirmed mutation during a read requires one trailing read.
        active.again = true;
        return active.promise;
      }
      const request = { controller: new AbortController(), again: false, promise: null };
      refreshRequestRef.current = request;
      request.promise = (async () => {
        do {
          request.again = false;
          if (!silent) setRefreshing(true);
          setError('');
          try {
            const query = new URLSearchParams({ from: dateFrom, to: dateTo });
            const nextData = await api('/api/caixa/orders?' + query.toString(), undefined, { signal: request.controller.signal });
            if (refreshRequestRef.current !== request || request.controller.signal.aborted) return;
            const previous = dataRef.current;
            if (silent && previous) {
              const previousActiveIds = new Set([...(previous.pendingConfirmation || []), ...(previous.pendingPayment || []), ...(previous.awaitingDriver || []), ...(previous.outForDelivery || [])].map((order) => order.id));
              const previousPaymentIds = new Set((previous.pendingPayment || []).map((order) => order.id));
              const previousPaidIds = new Set((previous.paid || []).map((order) => order.id));

              const incoming = [...(nextData.pendingConfirmation || []), ...(nextData.pendingPayment || []), ...(nextData.awaitingDriver || []), ...(nextData.outForDelivery || [])].filter((order) => !previousActiveIds.has(order.id));
              const movedToPayment = (nextData.pendingPayment || []).filter((order) => !previousPaymentIds.has(order.id) && previousActiveIds.has(order.id));
              const movedToPaid = (nextData.paid || []).filter((order) => !previousPaidIds.has(order.id));

              if (incoming.length) {
                const ids = new Set(incoming.map((order) => order.id));
                setPulsedOrderIds((current) => new Set([...current, ...ids]));
                const firstIncoming = incoming[0];
                const target = resolveOrderTargetColumn(firstIncoming);
                setNewOrderNotice(incoming.length === 1 ? `Nova comanda #${firstIncoming.ticketNumber} → ${target.title}` : `${incoming.length} ${'new_orders_grouped_in_summary'.tr}`);
                enqueueOrderNotifications(incoming, { targetStage: target.stage, playSound: true });
                setTimeout(() => setPulsedOrderIds((current) => new Set([...current].filter((id) => !ids.has(id)))), 9000);
                setTimeout(() => setNewOrderNotice(''), 9000);
              } else if (movedToPaid.length) {
                triggerFly(movedToPaid, { targetStage: 'paid', delayMs: floatingOrder && movedToPaid.some((o) => o.id === floatingOrder.id) ? 0 : 220 });
              } else if (movedToPayment.length) {
                triggerFly(movedToPayment, { targetStage: 'payment', delayMs: floatingOrder && movedToPayment.some((o) => o.id === floatingOrder.id) ? 0 : 220 });
              }
            }
            dataRef.current = nextData;
            setData(nextData);
            setSelectedOrder((current) => {
              if (!current) return current;
              const available = [nextData.procurementOrders || [], nextData.pendingConfirmation, nextData.pendingPayment, nextData.confirmed, nextData.paid, nextData.awaitingDriver || [], nextData.outForDelivery || [], nextData.history].flat();
              return available.find((order) => order.id === current.id) || current;
            });
          } catch (err) {
            if (refreshRequestRef.current === request && !request.controller.signal.aborted) setError(err.message);
          }
        } while (request.again && refreshRequestRef.current === request && !request.controller.signal.aborted);
      })().finally(() => {
        if (refreshRequestRef.current === request) {
          refreshRequestRef.current = null;
          setRefreshing(false);
        }
      });
      return request.promise;
    };
    useEffect(() => {
      dataRef.current = null;
      setData(null);
      refresh();
      const stop = window.ConfloraSession.watchOrderUpdates(() => {
        refresh(true);
        loadClosingStatus();
      });
      return () => {
        stop();
        refreshRequestRef.current?.controller.abort();
        refreshRequestRef.current = null;
      };
    }, [dateFrom, dateTo, user.id, user.role]);

    const setPeriod = (days) => {
      setDateTo(today);
      setDateFrom(days === 0 ? today : dateOffset(today, -(days - 1)));
    };
    const receive = async (order, paymentMethod, receivedAmount, paymentParts, verification = {}) => {
      setError('');
      setBusy(true);
      try {
        const response = await api('/api/caixa/orders/' + order.id + '/confirm', {
          paymentMethod,
          paymentParts,
          ...verification,
          ...(receivedAmount !== null && receivedAmount !== undefined && receivedAmount !== '' ? { receivedAmount: Number(String(receivedAmount).replace(',', '.')) } : {})
        });
        const updatedOrder = response.order || order;
        setSelectedOrder(updatedOrder);
        await refresh(true);
        triggerFly(updatedOrder, { targetStage: 'paid', delayMs: floatingOrder?.id === updatedOrder.id ? 0 : 220 });
      } catch (err) { setError(err.message); }
      finally { setBusy(false); }
    };

    const moveOrder = async (id, from, to) => {
      if (busy || user.role === 'VENDEDOR') return;
      setBusy(true); setError('');
      try {
        const response = await api('/api/caixa/orders/' + encodeURIComponent(id) + '/move', { from, to });
        const movedOrder = response.order;
        setSelectedOrder(movedOrder);
        await refresh(true);
        if (movedOrder && (to === 'payment' || to === 'paid')) {
          triggerFly(movedOrder, { targetStage: to, delayMs: floatingOrder?.id === movedOrder.id ? 0 : 220 });
        }
      } catch (err) { setError(err.message); }
      finally { setBusy(false); setDragFrom(null); }
    };

    const [whatsappConversations, setWhatsappConversations] = useState([]);
    const [whatsappFilter, setWhatsappFilter] = useState('all_open');
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [mobileTab, setMobileTab] = useState('orders'); // 'orders' | 'whatsapp'
    const [queueStage, setQueueStage] = useState('pending');

    const fetchWhatsappConversations = async () => {
      try {
        const res = await api(`/api/admin/whatsapp/conversations?filter=${whatsappFilter}`);
        if (res.conversations) setWhatsappConversations(res.conversations);
      } catch {
        // Silencioso se indisponível
      }
    };

    useEffect(() => {
      if (view === 'orders') fetchWhatsappConversations();
    }, [view, whatsappFilter]);

    const handleTakeover = async (conv) => {
      const rawPhone = String(conv.phone || conv.customerPhone || '').replace(/\D/g, '');
      await api(`/api/admin/whatsapp/conversations/${rawPhone}/takeover`, { expectedVersion: conv.version });
      await fetchWhatsappConversations();
    };

    const handleRelease = async (conv) => {
      const rawPhone = String(conv.phone || conv.customerPhone || '').replace(/\D/g, '');
      await api(`/api/admin/whatsapp/conversations/${rawPhone}/release`, {});
      await fetchWhatsappConversations();
    };

    const handleCloseConv = async (conv) => {
      const rawPhone = String(conv.phone || conv.customerPhone || '').replace(/\D/g, '');
      await api(`/api/admin/whatsapp/conversations/${rawPhone}/close`, { status: 'CLOSED_NO_SALE' });
      setSelectedConversation(null);
      await fetchWhatsappConversations();
    };

    const deliveryOrderIds = new Set([...(data?.awaitingDriver || []), ...(data?.outForDelivery || [])].map(order => order.id));
    const columns = data ? [
      { title: 'ENCOMENDAS', hint: 'quote_deposit_and_arrival_at_store_administration'.tr, orders: data.procurementOrders || [], tone: 'amber', stage: 'procurement' },
      { title: 'waiting_for_confirmation_62b37c'.tr, hint: 'orders_requiring_prior_store_confirmation'.tr, orders: data.pendingConfirmation, tone: 'amber', stage: 'confirmation' },
      { title: 'waiting_for_payment_6fbef3'.tr, hint: 'receive_at_checkout_or_wait_for_pix_confirmation'.tr, orders: data.pendingPayment, tone: 'blue', stage: 'payment' },
      { title: 'waiting_for_driver'.tr, hint: 'orders_available_or_being_packed'.tr, orders: data.awaitingDriver || [], tone: 'amber', stage: 'delivery' },
      { title: 'out_for_delivery'.tr, hint: 'orders_on_the_way_with_the_delivery_person'.tr, orders: data.outForDelivery || [], tone: 'blue', stage: 'route' },
      { title: 'paid_completed'.tr, hint: 'payments_received_and_completed_orders'.tr, orders: data.paid.filter(order => !deliveryOrderIds.has(order.id)), tone: 'green', stage: 'paid' },
      { title: 'FIADOS', hint: 'sales_registered_for_later_payment'.tr, orders: data.confirmed.filter(order => !deliveryOrderIds.has(order.id)), tone: 'red', stage: 'debt' },
    ] : [];
    const displayedColumns = columns.filter(column => queueStage === 'all' || (queueStage === 'pending' ? column.stage !== 'paid' : column.stage === queueStage));
    const title = view === 'orders' ? 'Comandas' : view === 'history' ? 'sales_history'.tr : 'report'.tr;
    const cashierOrderIds = new Set(data?.cashierOrderIds || []);
    const reportOrders = data ? (user.role === 'CAIXA'
      ? data.history.filter(order => data.cashierOrderIds ? cashierOrderIds.has(order.id) : order.receivedBy?.id === user.id)
      : data.history.filter(order => user.role === 'ADMIN' || order.createdBy?.id === user.id)) : [];
    const reportPaidOrders = reportOrders.filter((order) => (order.paymentStatus === 'APPROVED' || order.paymentStatus === 'ON_ACCOUNT') && (order.paidAt || order.completedAt));
    const methodAmount = (order, method) => (order.paymentParts || [{ method: order.paymentMethod, amount: order.total }]).filter((part) => part.method === method).reduce((sum, part) => sum + Number(part.amount || 0), 0);
    const cashAmount = (order) => ["PIX", 'DINHEIRO', 'CREDITO', 'DEBITO'].reduce((sum, method) => sum + methodAmount(order, method), 0);
    const reportCashOrders = reportPaidOrders.filter((order) => cashAmount(order) > 0);
    const reportCreditUsedTotal = reportPaidOrders.reduce((sum, order) => sum + methodAmount(order, 'SALDO_CLIENTE'), 0);
    const reportSalesTotal = reportCashOrders.reduce((sum, order) => sum + cashAmount(order), 0);
    const reportDebtSettlements = (data?.debtHistory || []).filter((item) => (item.entryType || item.type) === 'QUITACAO_FIADO');
    const reportAdvanceCredits = (data?.debtHistory || []).filter((item) => ['CREDITO_CLIENTE', 'ENCOMENDA_SINAL'].includes(item.entryType || item.type));
    const reportDebtTotal = reportDebtSettlements.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const reportAdvanceTotal = reportAdvanceCredits.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const reportPaymentTotals = Object.fromEntries(["PIX", 'DINHEIRO', 'CREDITO', 'DEBITO', 'SALDO_CLIENTE'].map((method) => [method,
      reportPaidOrders.reduce((sum, order) => sum + methodAmount(order, method), 0),
    ]));
    const topProducts = (rows, metric) => {
      const products = new Map();
      rows.forEach((order) => (order.items || []).forEach((item) => {
        const key = String(item.productId || item.name || 'catalog_product_singular'.tr);
        const current = products.get(key) || { name: item.name || 'product'.tr, quantity: 0, total: 0 };
        current.quantity += Number(item.quantity || 0);
        current.total += Number(item.subtotalMinor || 0) / 100 || Number(item.price || 0) * Number(item.quantity || 0);
        products.set(key, current);
      }));
      return [...products.values()].sort((a, b) => b[metric] - a[metric]).slice(0, 5);
    };
    const mostByQuantity = data ? topProducts(reportOrders, 'quantity') : [];
    const mostByValue = data ? topProducts(reportOrders, 'total_112398'.tr) : [];

    return <div className={`cf-cashier-queue min-h-screen w-full bg-[#F4F6F5] font-sans text-slate-800 ${view === 'orders' ? 'cf-orders-page' : ''}`}>
      <div className="bg-white"><Topbar user={user} onCashier={onBack} />
        {view === 'orders' ? <>
          <div className="cf-orders-topbar flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
            <div className="flex items-center gap-2.5">
              <button type="button" onClick={onBack} className="cf-back-button">{'back_59dc92'.tr}</button>
              <h1 className="text-base sm:text-lg font-black text-[#0F381E] m-0">{title}</h1>
              {data && (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-900">
                  {columns.reduce((sum, col) => sum + col.orders.length, 0)} no quadro
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline-block text-xs font-semibold text-slate-500">
                {dateFrom === dateTo ? `Hoje (${dateFrom})` : `${dateFrom} a ${dateTo}`}
              </span>
              <button
                type="button"
                onClick={() => setShowQuickProductDialog(true)}
                className="cf-btn-3d cf-btn-3d--primary cf-btn-3d--sm"
              >
                + Cadastrar produto
              </button>
            </div>
          </div>
          <aside className="cf-orders-fab-rail" aria-label="Ações das comandas">
          <button type="button" className="cf-btn-3d cf-btn-3d--primary cf-orders-fab" aria-label={title} title={title} onClick={() => document.querySelector('.cf-cashier-board')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="cf-orders-fab-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" /></svg>
            <span className="cf-orders-fab-tooltip">{title}</span>
          </button>
          <button type="button" className="cf-btn-3d cf-btn-3d--primary cf-orders-fab" aria-label="Criar produto" title="Criar produto" onClick={() => setShowQuickProductDialog(true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="cf-orders-fab-icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4.4 7.8 7.6 4.4 7.6-4.4M12 12.2V21M12 3v9.2"/><path d="M17.5 4.8v4M15.5 6.8h4"/></svg>
            <span className="cf-orders-fab-tooltip">+ Novo produto</span>
          </button>
          <OrderDateFilter from={dateFrom} to={dateTo} today={today} onChange={(from, to) => { setDateFrom(from); setDateTo(to); }} />
          <OrderSoundAlert settings={soundSettings} onChange={setSoundSettings} floating />
          <button type="button" className="cf-btn-3d cf-btn-3d--secondary cf-orders-fab" disabled={refreshing} aria-label={refreshing ? 'updating'.tr : 'refresh'.tr} title={refreshing ? 'updating'.tr : 'refresh'.tr} onClick={() => refresh()}>
            <svg viewBox="0 0 24 24" aria-hidden="true" className={`cf-orders-fab-icon ${refreshing ? 'cf-orders-refreshing' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2" /></svg>
            <span className="cf-orders-fab-tooltip">{refreshing ? 'updating'.tr : 'refresh'.tr}</span>
          </button>
        </aside></> : <div className="cf-page-toolbar">
          <div className="flex flex-col items-start gap-2"><button type="button" onClick={onBack} className="cf-back-button">{'back_59dc92'.tr}</button></div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="mr-2 text-lg font-black text-[#0F381E]">{title}</h1><OrderSoundAlert settings={soundSettings} onChange={setSoundSettings} />{view === 'report' && user.role !== 'VENDEDOR' && <button className={button} onClick={onDebt}>{'receive_payment'.tr}</button>}<button className={button} disabled={refreshing} onClick={() => refresh()} aria-label={'refresh'.tr}>{refreshing ? 'updating'.tr : 'refresh_8557d8'.tr}</button></div>
        </div>}
      </div>

      {view !== 'orders' && <div className="shrink-0 border-b border-slate-200 bg-white/80 px-4 py-3 sm:px-6">
          <div className="flex w-full max-w-none flex-wrap items-end gap-2">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {[{ days: 0, label: 'today'.tr }, { days: 7, label: 'label_7_days'.tr }, { days: 30, label: 'label_30_days'.tr }].map((option) => {
                const isActive = dateTo === today && dateFrom === (option.days === 0 ? today : dateOffset(today, -(option.days - 1)));
                return <button key={option.days} aria-pressed={isActive} className={`cf-btn-3d cf-btn-3d--sm ${isActive ? 'cf-btn-3d--active' : 'cf-btn-3d--secondary'}`} onClick={() => setPeriod(option.days)}>{option.label}</button>;
              })}
            </div>
            <div className="flex items-end gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{'from'.tr}<input aria-label={'start_date'.tr} className="mt-1 block w-[124px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700" type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} /></label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{'to'.tr}<input aria-label={'end_date'.tr} className="mt-1 block w-[124px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700" type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} /></label>
            </div>
            <span className="ml-auto text-xs text-slate-500">{dateFrom === dateTo ? dateFrom : `${dateFrom} a ${dateTo}`}</span>
          </div>
        </div>}

      <main className={`min-h-[calc(100vh-130px)] w-full max-w-none p-3 sm:p-5 ${view === 'orders' ? 'cf-orders-main' : ''}`}>
          {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {!data && !error && <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500">{'loading_tickets'.tr}</p>}
          {data && <>
            {view === 'orders' && <>
              {/* Seletor de Aba Dedicada no Mobile */}
              <div className="flex md:hidden gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setMobileTab('orders')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition ${
                    mobileTab === 'orders' ? 'bg-emerald-800 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  Comandas ({columns.reduce((sum, col) => sum + col.orders.length, 0)})
                </button>
                <button
                  type="button"
                  onClick={() => setMobileTab('whatsapp')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                    mobileTab === 'whatsapp' ? 'bg-emerald-800 text-white shadow-xs' : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>WhatsApp ({whatsappConversations.length})</span>
                  {whatsappConversations.some(c => c.unreadCount > 0) && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              </div>

              {newOrderNotice && <div role="status" className="mb-3 rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-extrabold text-amber-950 shadow-sm" aria-live="polite">🔔 {newOrderNotice}</div>}

              <label className={`cf-orders-stage-filter ${mobileTab === 'whatsapp' ? 'cf-orders-stage-filter--whatsapp' : ''}`}>Exibir comandas
                <select value={queueStage} onChange={event => setQueueStage(event.target.value)} aria-label="Etapa das comandas">
                  <option value="pending">Operações pendentes</option><option value="all">Todas as etapas</option>
                  {columns.map(column => <option key={column.stage} value={column.stage}>{column.title} ({column.orders.length})</option>)}
                </select>
              </label>

              <div className="cf-cashier-board cf-orders-board flex w-full gap-4 overflow-x-auto pb-4 pt-1 snap-x select-none">
                {/* Coluna Desktop de WhatsApp */}
                <section className={`cf-orders-whatsapp w-[340px] min-w-[340px] shrink-0 snap-start flex flex-col rounded-2xl border border-slate-200 bg-slate-100 p-3 ${mobileTab === 'whatsapp' ? 'block md:block' : 'hidden md:block'}`}>
                  <header className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-950 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-black tracking-wide">WHATSAPP</h3>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-extrabold">{whatsappConversations.length}</span>
                    </div>
                    <select
                      value={whatsappFilter}
                      onChange={(e) => setWhatsappFilter(e.target.value)}
                      className="mt-2 w-full text-xs font-bold p-1.5 border border-emerald-200 rounded-lg bg-white text-slate-800"
                    >
                      <option value="all_open">Todos abertos</option>
                      <option value="needs_vendor">Precisa de vendedor</option>
                      <option value="awaiting_pix">Aguardando Pix</option>
                      <option value="completed">Concluídos</option>
                      <option value="closed_no_sale">Encerrados sem venda</option>
                    </select>
                  </header>
                  <div className="space-y-2 overflow-y-auto max-h-[70vh]">
                    {whatsappConversations.map((conv) => (
                      <WhatsappCompactCard
                        key={conv.id || conv.phone}
                        conversation={conv}
                        selected={selectedConversation?.id === conv.id}
                        onClick={setSelectedConversation}
                      />
                    ))}
                    {!whatsappConversations.length && (
                      <p className="p-4 text-center text-xs text-slate-500 rounded-xl border border-dashed border-slate-300 bg-white/70">
                        Nenhum atendimento nesta categoria.
                      </p>
                    )}
                  </div>
                </section>

                {/* Colunas de Comandas */}
                <div className={`cf-orders-stages flex gap-4 ${mobileTab === 'orders' ? 'block md:flex' : 'hidden md:flex'}`} data-pending-only={queueStage === 'pending'}>
                  {queueStage === 'pending' && displayedColumns.every(column => !column.orders.length) && <p className="cf-orders-empty-pending" role="status">Nenhuma operação pendente nesta consulta.</p>}
                  {displayedColumns.map((column) => <CashierColumn key={column.title} {...column} isTargetGlow={flyingToStage === column.stage} canMove={['ADMIN', "CAIXA"].includes(user.role) && !busy} dragFrom={dragFrom} onMove={moveOrder} onDragStart={setDragFrom} onDragEnd={() => setDragFrom(null)} pulsedOrderIds={pulsedOrderIds} selectedOrderId={selectedOrder?.id} onDetails={setSelectedOrder} />)}
                </div>
              </div>
            </>}

            {view === 'history' && <>
              <div className="mb-3 flex items-center justify-between"><h3 className="font-black text-[#0F381E]">{'sales_history'.tr}</h3><span className="text-xs text-slate-500">{data.history.length} {'record_s'.tr} </span></div>
              <div className="space-y-2 md:hidden">
                {data.history.map((order) => <button key={order.id} onClick={() => setSelectedOrder(order)} className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm"><span className="flex justify-between gap-2"><strong>#{order.ticketNumber} · {order.customerName || "Cliente Balcão"}</strong><strong>{money(order.total)}</strong></span><span className="mt-1 block text-xs text-slate-500">{orderStatusLabel(order)} · {paymentLabel(order.paymentMethod)}</span><span className="mt-1 block text-[11px] text-slate-500">{dateTime(order.paidAt || order.completedAt || order.createdAt)} {'order_34ea85'.tr} {staffLabel(order.createdBy)}</span></button>)}
              </div>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
                <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="p-3"> {'date_cec3a9'.tr} </th><th className="p-3">{'ticket_customer'.tr}</th><th className="p-3"> {'status'.tr} </th><th className="p-3">{'payment'.tr}</th><th className="p-3">{'order_by'.tr}</th><th className="p-3 text-right">{"total_112398".tr}</th></tr></thead><tbody className="divide-y divide-slate-100">{data.history.map((order) => <tr key={order.id} className="hover:bg-emerald-50/50"><td className="p-3 text-xs text-slate-500">{dateTime(order.paidAt || order.completedAt || order.createdAt)}</td><td className="p-3"><button className="font-bold text-[#0F381E] hover:underline" onClick={() => setSelectedOrder(order)}>#{order.ticketNumber} · {order.customerName || "Cliente Balcão"}</button></td><td className="p-3">{orderStatusLabel(order)}</td><td className="p-3">{paymentLabel(order.paymentMethod)}</td><td className="p-3">{staffLabel(order.createdBy)}</td><td className="p-3 text-right font-bold">{money(order.total)}</td></tr>)}</tbody></table>
              </div>
              {!data.history.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">{'no_sales_found_in_this_period'.tr}</p>}
            </>}

            {view === 'report' && <>
              {closingNotice && (
                <div role="status" className="mb-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-4 text-xs font-black text-emerald-950 shadow-md">
                  {closingNotice}
                </div>
              )}

              {/* HERO CARD DE FECHAMENTO DE CAIXA */}
              {['ADMIN', "CAIXA"].includes(user.role) && closingStatus && (
                <div className="mb-6 overflow-hidden rounded-3xl border-2 border-emerald-700/30 bg-gradient-to-br from-[#0F381E] via-[#14532D] to-[#0A2614] p-5 text-white shadow-xl sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-300">
                          {closingStatus.myClosing ? 'register_closed_7198f0'.tr : 'required_shift_action'.tr}
                        </span>
                        {closingStatus.allClosed && (
                          <span className="rounded-full bg-amber-400/20 px-3 py-1 text-[11px] font-black text-amber-300"> {'all_registers_for_the_day_closed'.tr} </span>
                        )}
                      </div>
                      <h2 className="mt-2 text-xl font-black text-white sm:text-2xl">
                        {closingStatus.myClosing
                          ? `${'register_of'.tr} ${user.name || 'team_operator'.tr} ${'successfully_closed'.tr}`
                          : `${'daily_register_closing'.tr} ${user.name || user.email}`}
                      </h2>
                      <p className="mt-1 max-w-xl text-xs text-emerald-100/80">
                        {closingStatus.myClosing
                          ? `${'closing_recorded_at'.tr} ${dateTime(closingStatus.myClosing.closedAt)}. Confira os valores registrados no fechamento.`
                          : 'check_the_cash_amounts_in_the_drawer_pix_and_card_machine_reports_the_consolidated_su'.tr}
                      </p>
                    </div>

                    <div className="shrink-0">
                      {!closingStatus.mySession ? (
                        <button type="button" onClick={() => setShowOpeningModal(true)} className="cf-btn-3d cf-btn-3d--primary px-6 py-3"> {'open_new_cashier_session'.tr} </button>
                      ) : (
                        <div>
                          <p className="mb-2 text-xs"> {'daily_opening_cash_label'.tr} {money(closingStatus.mySession.openingFloat)}</p>
                          <p className="mb-2 text-xs"> {'total_cash_label'.tr} {money(closingStatus.myExpected.cash)}</p>
                          <button type="button" onClick={async () => { await loadClosingStatus(); setShowClosingModal(true); }} className="cf-btn-3d cf-btn-3d--primary px-6 py-3"> {'close_own_cashier_session'.tr} </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* STATUS DOS DEMAIS OPERADORES DO DIA */}
                  {closingStatus.activeOperators && closingStatus.activeOperators.length > 0 && (
                    <div className="mt-5 border-t border-emerald-800/60 pt-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300"> {'register_status_today'.tr}{closingStatus.activeOperators.filter(o => o.closed).length}/{closingStatus.activeOperators.length} {'closed'.tr} </span>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {closingStatus.activeOperators.map((op) => (
                          <span
                            key={op.id}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                              op.closed
                                ? 'bg-emerald-950/80 border border-emerald-400/30 text-emerald-300'
                                : 'bg-amber-950/80 border border-amber-400/30 text-amber-300'
                            }`}
                          >
                            <span>{op.closed ? '✅' : '⏳'}</span>
                            <span>{op.name} ({op.role}): {op.closed ? 'closed_dee988'.tr : 'pending'.tr}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {['ADMIN', "CAIXA"].includes(user.role) && <cashier-report-actions scope-label={user.role === 'ADMIN' ? 'general_store_register_selected_period'.tr : 'only_your_register_selected_period'.tr} from={dateFrom} to={dateTo}></cashier-report-actions>}
              
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-black text-[#0F381E]">{'general_amount_check'.tr}</h3>
                  <p className="text-xs text-slate-500">{'period'.tr} {dateFrom === dateTo ? dateFrom : `${dateFrom} a ${dateTo}`}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
                  {user.role === 'ADMIN' ? 'store_overview'.tr : `${'register'.tr} ${user.name || 'team_operator'.tr}`}
                </span>
              </div>

              {/* CARDS PRINCIPAIS DE FORMAS DE PAGAMENTO */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <MetricCard label={'cash_1ae8c9'.tr} value={money(reportPaymentTotals['DINHEIRO'] || 0)} description="Vendas em espécie" />
                <MetricCard label={'pix'.tr} value={money(reportPaymentTotals["PIX"] || 0)} description="Sicredi / recebidos" />
                <MetricCard label={'credit_card'.tr} value={money(reportPaymentTotals['CREDITO'] || 0)} description="Relatório maquininha" />
                <MetricCard label={'debit_card'.tr} value={money(reportPaymentTotals['DEBITO'] || 0)} description="Relatório maquininha" />
                <MetricCard label={'on_credit_receivable'.tr} value={money(data.closing.confirmedDebt || 0)} description="Vendas a prazo" tone="debt" />
                <MetricCard label={'total_received'.tr} value={money(reportSalesTotal + reportDebtTotal + reportAdvanceTotal)} description={`${reportOrders.length} ${'recorded_sale_s'.tr}`} />
              </div>

              {/* TABELA DE CONFERÊNCIA POR FORMA DE PAGAMENTO */}
              <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-100 px-4 py-3">
                  <h4 className="text-sm font-bold text-slate-700">{'check_of_system_calculated_amounts'.tr}</h4>
                </div>
                <div className="divide-y divide-slate-100">
                  {[
                    { key: 'DINHEIRO', label: 'period_cash_receipts'.tr, hint: 'receipts_exclude_float'.tr },
                    { key: 'PIX', label: 'pix_received'.tr, hint: 'sicredi_statement_confirmations'.tr },
                    { key: 'CREDITO', label: 'credit_card_e617a2'.tr, hint: 'printed_card_machine_report'.tr },
                    { key: 'DEBITO', label: 'debit_card_9c7168'.tr, hint: 'printed_card_machine_report'.tr },
                    { key: 'FIADO', label: 'on_credit_receivable'.tr, hint: 'credit_sales_recorded_in_the_period'.tr, customVal: data.closing.confirmedDebt },
                  ].map((row) => (
                    <div key={row.key} className="grid grid-cols-2 items-center gap-3 px-4 py-3 sm:grid-cols-[1.5fr_1fr_auto]">
                      <div>
                        <strong className="block text-sm font-bold text-slate-800">{row.label}</strong>
                        <span className="text-xs text-slate-400">{row.hint}</span>
                      </div>
                      <div className="text-right sm:text-center">
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                          {money(row.customVal !== undefined ? row.customVal : (reportPaymentTotals[row.key] || 0))}
                        </span>
                      </div>
                      <div className="col-span-2 text-right sm:col-span-1">
                        <span className="text-xs font-semibold text-slate-500">
                          {row.key === 'FIADO' ? 'recorded_on_credit'.tr : 'confirmed_sales'.tr}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 items-center gap-3 bg-emerald-50/60 px-4 py-3.5 sm:grid-cols-[1.5fr_1fr_auto]">
                    <div>
                      <strong className="text-sm font-black text-[#0F381E]">{'total_calculated_overall'.tr}</strong>
                    </div>
                    <div className="text-right sm:text-center">
                      <span className="text-base font-black text-[#0F381E]">
                        {money(reportSalesTotal + reportDebtTotal + reportAdvanceTotal)}
                      </span>
                    </div>
                    <div className="col-span-2 text-right sm:col-span-1">
                      <span className="text-xs font-bold text-emerald-800">{'average_ticket'.tr} {money(reportOrders.length ? reportOrders.reduce((sum, order) => sum + Number(order.total || 0), 0) / reportOrders.length : 0)}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* PRODUTOS MAIS VENDIDOS */}
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {[{ title: 'top_5_best_selling_products'.tr, rows: mostByQuantity }, { title: 'top_5_sales_by_value'.tr, rows: mostByValue }].map((group) => (
                  <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h4 className="mb-3 font-bold text-[#0F381E]">{group.title}</h4>
                    {group.rows.length ? (
                      <ol className="space-y-2">
                        {group.rows.map((product, index) => (
                          <li key={product.name} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm">
                            <span title={product.name} className="truncate">{index + 1}. {product.name} <small className="text-slate-500">({product.quantity} {'units_63dfbb'.tr} </small></span>
                            <strong className="text-[#0F381E]">{money(product.total)}</strong>
                          </li>
                        ))}
                      </ol>
                    ) : <p className="text-sm text-slate-500">{'no_items_sold_in_the_period'.tr}</p>}
                  </section>
                ))}
              </div>

              <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-950">
                {user.role === 'ADMIN' ? 'consolidated_view_of_all_employees'.tr : `${'exclusive_cash_register_data_for'.tr} ${staffLabel({ name: user.name, email: user.email })}.`}
              </p>
            </>}
          </>}
      </main>
      {view === 'orders' && data && <details className="cf-orders-metrics-sheet" aria-label="Resumo de valores das comandas">
        <summary>Resumo do período</summary>
        <div className="cf-orders-metrics-grid">
          <MetricCard label={'sales_assigned_to_me'.tr} value={money(data.metrics.sales)} description={`${data.metrics.orderCount} comanda(s)`} />
          <MetricCard label={'received_by_me'.tr} value={money(data.metrics.receipts)} description="Vendas pagas no período" />
          <MetricCard label={'store_credits_settled_by_me'.tr} value={money(data.metrics.debtReceipts)} description="Recebimentos no período" />
        </div>
      </details>}
      {selectedConversation && (
        <WhatsappChatDrawer
          conversation={selectedConversation}
          onClose={() => setSelectedConversation(null)}
          onTakeover={handleTakeover}
          onRelease={handleRelease}
          onCloseConversation={handleCloseConv}
          onOpenOrder={(orderId) => {
            setSelectedConversation(null);
            api('/api/caixa/orders/' + encodeURIComponent(orderId))
              .then(setSelectedOrder)
              .catch(() => {});
          }}
        />
      )}

      {selectedOrder && <OrderDetails extraContent={selectedOrder.procurement ? <a className={button} href="/configuracoes"> {'manage_order'.tr} </a> : null} key={`${selectedOrder.id}:${selectedOrder.status}:${selectedOrder.paymentMethod}`} order={selectedOrder} canApproveCredit={user.role === 'ADMIN' && selectedOrder.creditApprovalStatus === 'PENDING'} canAdvance={user.role !== 'VENDEDOR' && selectedOrder.status === 'AWAITING_CONFIRMATION' && selectedOrder.creditApprovalStatus !== 'PENDING'} onAdvance={(order) => moveOrder(order.id, 'confirmation', 'payment')} canReceive={(user.role === 'ADMIN' && selectedOrder.creditApprovalStatus === 'PENDING' && selectedOrder.paymentParts?.length > 1 || user.role !== 'VENDEDOR' && ['AWAITING_CASHIER', 'AWAITING_PAYMENT', 'PENDING'].includes(selectedOrder.status)) && !selectedOrder.pixData?.txid} canConfirmManualPix={selectedOrder.pixMode !== 'MANUAL' && (user.role !== 'VENDEDOR' || selectedOrder.createdBy?.id === user.id && (!selectedOrder.pixData?.txid || (selectedOrder.paymentParts || [{ method: selectedOrder.paymentMethod }]).every(part => part.method === 'PIX'))) && (selectedOrder.paymentMethod === 'PIX' && ['CREATING_PIX', 'AWAITING_PIX', ...(selectedOrder.procurement ? ['AWAITING_RECONCILIATION'] : [])].includes(selectedOrder.status) || user.role === 'VENDEDOR' && ['AWAITING_CASHIER', 'AWAITING_PAYMENT', 'PENDING'].includes(selectedOrder.status))} busy={busy} error={error} onReceive={receive} onManualPix={async (order, note, proofId) => {
        setBusy(true); setError('');
        try {
          const response = await api('/api/caixa/orders/' + order.id + '/confirm-manual-pix', { proofSeen: true, note, proofId });
          const updatedOrder = response.order || order;
          setSelectedOrder(updatedOrder);
          await refresh(true);
          triggerFly(updatedOrder, { targetStage: 'paid', delayMs: floatingOrder?.id === updatedOrder.id ? 0 : 220 });
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
      }} onReviewed={async (reviewedOrder) => {
        setSelectedOrder(reviewedOrder || selectedOrder); await refresh(true);
      }} onClose={() => setSelectedOrder(null)} />}

      {/* NOTIFICAÇÃO FLUTUANTE DE PEDIDO OU RESUMO EM LOTE (DIGEST) NO CANTO INFERIOR ESQUERDO */}
      {floatingOrder && (() => {
        const activeBatch = floatingBatch.length > 1 ? floatingBatch : [floatingOrder];
        const isDigest = activeBatch.length > 1;
        const batchTotal = activeBatch.reduce((sum, item) => sum + Number(item.total || 0), 0);
        const paymentCount = activeBatch.filter((item) => resolveOrderTargetColumn(item).stage === 'payment').length;
        const paidCount = activeBatch.filter((item) => resolveOrderTargetColumn(item).stage === 'paid').length;
        const confirmableOrders = activeBatch.filter((item) => item.status === 'AWAITING_CONFIRMATION' && item.creditApprovalStatus !== 'PENDING');
        const visibleDigestOrders = digestExpanded ? activeBatch : activeBatch.slice(0, 3);

        return (
          <div
            ref={floatingCardRef}
            role="status"
            aria-live="polite"
            data-target-column={floatingTarget.title}
            data-target-stage={floatingTarget.stage}
            data-notification-mode={isDigest ? 'digest' : 'single'}
            className={`cf-order-notification fixed bottom-6 left-6 z-50 w-[348px] ${
              isFlying
                ? 'cf-order-notification--flying'
                : 'cf-order-notification--idle shadow-2xl'
            }`}
          >
            <div className="rounded-3xl border-2 border-emerald-500 bg-white p-3.5 shadow-2xl ring-4 ring-emerald-500/20 backdrop-blur-md">
              <div className="mb-2 flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-black text-emerald-800">
                    <span className="inline-block animate-bounce">{isDigest ? '📦' : '🔔'}</span>
                    {isDigest ? `${activeBatch.length} Novas Comandas (Resumo)` : `Comanda #${floatingOrder.ticketNumber}`}
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] font-extrabold uppercase tracking-wide text-slate-500">
                    {isDigest
                      ? `${'total_18e872'.tr} ${money(batchTotal)} · Destino: ${floatingTarget.title}`
                      : `Destino: ${floatingTarget.title}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => triggerFly(activeBatch, { targetStage: floatingTarget.stage, openDetailsAfter: false })}
                  className="rounded-lg p-1 text-sm font-black leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title={`${'swipe_to'.tr} ${floatingTarget.title}`}
                  aria-label={`${'swipe_to'.tr} ${floatingTarget.title}`}
                >
                  ✕
                </button>
              </div>

              {isDigest ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-extrabold">
                    {paymentCount > 0 && (
                      <span className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-0.5 text-sky-900">
                        {paymentCount} {'awaiting_payment'.tr} </span>
                    )}
                    {paidCount > 0 && (
                      <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-emerald-900">
                        {paidCount} {'paid_completed_f2b020'.tr} </span>
                    )}
                  </div>

                  <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                    {visibleDigestOrders.map((item) => {
                      const itemTarget = resolveOrderTargetColumn(item);
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs transition hover:border-emerald-300 hover:bg-emerald-50/40"
                        >
                          <button
                            type="button"
                            onClick={() => triggerFly(item, { targetStage: itemTarget.stage, openDetailsAfter: true })}
                            className="min-w-0 flex-1 text-left"
                          >
                            <strong className="block truncate font-black text-slate-900">
                              #{item.ticketNumber} · {item.customerName || "Cliente Balcão"}
                            </strong>
                            <span className="block truncate text-[10px] font-bold text-slate-500">
                              {money(item.total)} · {itemTarget.title}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => triggerFly(item, { targetStage: itemTarget.stage, openDetailsAfter: true })}
                            className="shrink-0 rounded-lg bg-white px-2 py-1 text-[10px] font-extrabold text-emerald-800 shadow-2xs hover:bg-emerald-100"
                          > {'open'.tr} </button>
                        </div>
                      );
                    })}
                  </div>

                  {activeBatch.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setDigestExpanded((curr) => !curr)}
                      className="w-full rounded-lg py-1 text-center text-[11px] font-extrabold text-emerald-800 hover:underline"
                    >
                      {digestExpanded ? 'show_less'.tr : `${'view_all'.tr} ${activeBatch.length} comandas (+${activeBatch.length - 3})`}
                    </button>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2 pt-1">
                    {user.role !== 'VENDEDOR' && confirmableOrders.length > 0 ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          setError('');
                          try {
                            for (const item of confirmableOrders) {
                              await api('/api/caixa/orders/' + encodeURIComponent(item.id) + '/move', { from: 'confirmation', to: 'payment' });
                            }
                            await refresh(true);
                            triggerFly(activeBatch, { targetStage: 'payment', openDetailsAfter: false });
                          } catch (err) {
                            setError(err.message);
                          } finally {
                            setBusy(false);
                          }
                        }}
                        className="w-full rounded-xl bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
                      > {'process_batch'.tr} {confirmableOrders.length}{'awaiting_payment_21acd7'.tr} </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerFly(activeBatch, { targetStage: floatingTarget.stage, openDetailsAfter: false })}
                        className="w-full rounded-xl bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-900 transition hover:bg-emerald-100"
                      > {'swipe_batch_to'.tr} {floatingTarget.title} →
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  <OrderCard
                    order={floatingOrder}
                    tone={floatingTarget.tone || (floatingOrder.status === 'AWAITING_CONFIRMATION' ? 'amber' : 'blue')}
                    attention={true}
                    onDetails={(o) => triggerFly(o, { targetStage: floatingTarget.stage, openDetailsAfter: true })}
                  />
                  <div className="mt-2.5 flex items-center justify-between gap-2 pt-1">
                    {user.role !== 'VENDEDOR' && floatingOrder.status === 'AWAITING_CONFIRMATION' && floatingOrder.creditApprovalStatus !== 'PENDING' ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => moveOrder(floatingOrder.id, 'confirmation', 'payment')}
                        className="w-full rounded-xl bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
                      > {'process_waiting_for_payment'.tr} </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerFly(floatingOrder, { targetStage: floatingTarget.stage, openDetailsAfter: true })}
                        className="w-full rounded-xl bg-emerald-50 px-3 py-2 text-xs font-extrabold text-emerald-900 transition hover:bg-emerald-100"
                      > {'go_to'.tr} {floatingTarget.title} →
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {showOpeningModal && (
        <AbrirCaixaModal onClose={showOpeningModal ? () => setShowOpeningModal(false) : undefined} onOpened={async () => { setShowOpeningModal(false); setClosingNotice(''); await loadClosingStatus(); refresh(true); }} />
      )}
      {showClosingModal && closingStatus?.mySession && (
        <FecharCaixaModal
          status={closingStatus}
          user={user}
          onClose={() => setShowClosingModal(false)}
          onClosed={(res) => {
            setShowClosingModal(false);
            setClosingStatus((curr) => ({ ...curr, mySession: null, myClosing: res.closing, allClosed: res.allClosed }));
            loadClosingStatus();
            setClosingNotice(res.allClosed ? (res.whatsappSent ? 'Todos os caixas fechados. Resumo enviado ao Junior.' : 'Todos os caixas fechados. Resumo registrado na fila de envio ao Junior; o envio ainda não foi confirmado.') : 'Caixa fechado. Aguardando os demais caixas.');
            refresh(true);
          }}
        />
      )}
      {quickProductNotice && <p role="status" className="cf-product-notice" onClick={() => setQuickProductNotice('')}>{quickProductNotice}</p>}
      {showQuickProductDialog && <QuickProductDialog products={products} canAdd={hasActiveSale && !selectedOrder} onUseExisting={(product) => { setShowQuickProductDialog(false); onProductCreated?.(product, hasActiveSale && !selectedOrder); }} onClose={() => setShowQuickProductDialog(false)} onCreated={(product, add) => { setShowQuickProductDialog(false); setQuickProductNotice(add ? 'Produto adicionado à venda!' : 'Produto cadastrado com sucesso!'); onProductCreated?.(product, add); }} />}
    </div>;
  }
  function DebtSettlement({ onClose }) {
    const [query, setQuery] = useState(''); const [customers, setCustomers] = useState([]); const [customer, setCustomer] = useState(null);
    const [balance, setBalance] = useState(0); const [creditBalance, setCreditBalance] = useState(0); const [entryType, setEntryType] = useState('QUITACAO_FIADO'); const [amount, setAmount] = useState(''); const [method, setMethod] = useState('DINHEIRO'); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState(null); const [id, setId] = useState(() => crypto.randomUUID());
    const [splitPayment, setSplitPayment] = useState(false); const [parts, setParts] = useState([{ method: 'DINHEIRO', amount: '' }, { method: 'CREDITO', amount: '' }]);
    const [proofSeen, setProofSeen] = useState(false); const [note, setNote] = useState(''); const [proofId, setProofId] = useState('');
    const hasPix = splitPayment ? parts.some((part) => part.method === 'PIX') : method === 'PIX';
    useEffect(() => { let active = true; const timer = setTimeout(() => api('/api/caixa/customers?q=' + encodeURIComponent(query)).then((rows) => { if (active) setCustomers(rows); }).catch((err) => { if (active) setError(err.message); }), 250); return () => { active = false; clearTimeout(timer); }; }, [query]);
    const select = async (row) => { try { const debt = await api('/api/caixa/customers/' + encodeURIComponent(row.id) + '/debts'); setCustomer(row); setBalance(debt.balance); setCreditBalance(debt.creditBalance || 0); } catch (err) { setError(err.message); } };
    const submit = async () => {
      setBusy(true); setError('');
      try { setResult(await api('/api/caixa/debts/settle', { requestId: id, customerKey: customer.id, amount: Number(amount), paymentMethod: method, paymentParts: splitPayment ? parts.map((part) => ({ ...part, amount: Number(part.amount) })) : undefined, proofSeen, note, proofId, entryType })); } catch (err) { setError(err.message); } finally { setBusy(false); }
    };
    const isCreditEntry = entryType === 'CREDITO_CLIENTE';
    const amountInvalid = !Number.isFinite(Number(amount)) || Number(amount) <= 0 || (!isCreditEntry && Number(amount) > balance);
    return <Panel title={'receive_customer_payment'.tr} onClose={onClose}>{error && <p role="alert" className="text-red-700">{error}</p>}{result ? <div><p> {'recorded_payment'.tr} {money(result.amount)}</p><p> {'remaining_balance_9a6698'.tr} {money(result.newBalance)}</p><p>{'available_credit'.tr} {money(result.newCreditBalance)}</p>{result.newBalance > 0 && <button className={button + ' mt-4'} onClick={() => { setBalance(result.newBalance); setCreditBalance(result.newCreditBalance || 0); setAmount(Number(result.newBalance).toFixed(2)); setId(crypto.randomUUID()); setResult(null); setSplitPayment(false); setProofSeen(false); setNote(''); setProofId(''); }}> {'receive_remaining_amount'.tr} </button>}</div> : <><label>{'search_registered_customer'.tr}<input className={field} value={query} onChange={(e) => setQuery(e.target.value)} /></label><div className="max-h-36 overflow-auto">{customers.map((row) => <button className="block w-full border-b p-2 text-left" key={row.id} onClick={() => select(row)}>{row.name} · {row.phone || 'no_phone'.tr}</button>)}</div>{customer && <><p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-bold">{customer.name}<span className="mt-1 block text-xs font-medium text-amber-800"> {'remaining_balance_9a6698'.tr} {money(balance)}</span><span className="block text-xs font-medium text-emerald-800">{'available_credit'.tr} {money(creditBalance)}</span></p><label>{'transaction_type'.tr}<select className={field} value={entryType} onChange={(event) => setEntryType(event.target.value)}><option value="QUITACAO_FIADO">{'receive_debt_payment'.tr}</option><option value="CREDITO_CLIENTE">{'add_advance_credit'.tr}</option></select></label><label> {'amount_received'.tr} <input className={field} type="number" min="0.01" max={isCreditEntry ? undefined : balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label><PaymentMethodButtons value={method} onChange={setMethod} labels={{ DINHEIRO: 'cart_cash_option'.tr, DEBITO: 'cart_debit_option'.tr, CREDITO: 'cart_card_option'.tr, PIX: 'pix_already_received'.tr }} /><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={splitPayment} onChange={(event) => setSplitPayment(event.target.checked)} />{'use_more_than_one_payment_method'.tr}</label>{splitPayment && <PaymentPartsEditor parts={parts} onChange={setParts} total={Number(amount || 0)} allowedMethods={['DINHEIRO', 'DEBITO', 'CREDITO', "PIX"]} />}{hasPix && <div className="my-3 space-y-2"><PixProofUpload key={id} targetType="DEBT" targetId={id} onChange={setProofId} /><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={proofSeen} onChange={(event) => setProofSeen(event.target.checked)} />{'i_checked_the_pix_received_in_conflora_s_account'.tr}</label><label className="block text-xs">{'receipt_note'.tr}<textarea className={field} value={note} onChange={(event) => setNote(event.target.value)} /></label></div>}{!isCreditEntry && <p className="my-3 text-sm font-bold">{'balance_after_receipt'.tr} {money(Math.max(0, balance - Number(amount || 0)))}</p>}<button className={button} disabled={busy || (hasPix && (!proofId || !proofSeen || note.trim().length < 8)) || amountInvalid || (!isCreditEntry && balance <= 0)} onClick={submit}>{busy ? 'recording'.tr : isCreditEntry ? 'register_received_credit'.tr : 'confirm_receipt'.tr}</button></>}</>}</Panel>;
  }
  return { QuickProductDialog, AbrirCaixaModal, Topbar, Loading, Login, Receipt, CashierQueue, DebtSettlement, DiscountApproval, ProductInformation, WeightPrompt, handleProductImageError, PaymentPartsEditor, PaymentMethodButtons, CustomerSearch, LocationPicker, OrderDetails, CashierColumn, SeparationModal, Button3D, OrderSoundAlert, playOrderAlertSound };
})();
