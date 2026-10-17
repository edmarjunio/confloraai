/* Shared PDV components loaded before the sales screen. */
window.PdvComponents = (() => {
  const { useState, useEffect, useRef } = React;
  const { OrderCardSurface } = window.PdvStyled;
  const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const button = 'cf-button';
  const field = 'w-full p-3 border rounded-xl my-2';
  function LocationPicker({ value, address, onChange }) {
    const ref = useRef(null); const onChangeRef = useRef(onChange); onChangeRef.current = onChange;
    useEffect(() => { const node = ref.current; const listener = (event) => onChangeRef.current(event.detail); node.addEventListener('locationchange', listener); return () => node.removeEventListener('locationchange', listener); }, []);
    useEffect(() => { ref.current?.setAttribute('address', address || ''); }, [address]);
    return <delivery-location-picker ref={ref} value={JSON.stringify(value || null)} address={address || ''} />;
  }
  function PaymentMethodButtons({ value, onChange, labels, disabledMethods = [], suffix = '' }) {
    return <div role="group" aria-label="Formas de pagamento" className="my-2 grid grid-cols-2 gap-2">{Object.entries(labels).map(([method, label]) => <button type="button" key={method} aria-pressed={value === method} disabled={disabledMethods.includes(method)} className={button + ' !rounded-xl !px-3 !py-3 text-xs disabled:opacity-40'} style={{ background: value === method ? '#109e46' : '#fff', color: value === method ? '#fff' : '#174b32', border: '1px solid ' + (value === method ? '#109e46' : '#cbded2'), boxShadow: value === method ? '0 3px 10px #109e462b' : 'none' }} onClick={() => onChange(method)}>{label}{suffix}</button>)}</div>;
  }
  function PixProofUpload({ targetType, targetId, onChange }) {
    const [fileName, setFileName] = useState(''); const [error, setError] = useState(''); const [uploading, setUploading] = useState(false);
    const upload = async (file) => {
      onChange(''); setFileName(''); setError('');
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) { setError('O comprovante deve ter até 3 MB.'); return; }
      setUploading(true);
      try {
        const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Não foi possível ler o comprovante.')); reader.readAsDataURL(file); });
        const proof = await api('/api/caixa/payment-proofs', { targetType, targetId, dataUrl, fileName: file.name });
        setFileName(proof.fileName); onChange(proof.id);
      } catch (err) { setError(err.message); }
      finally { setUploading(false); }
    };
    return <div className="my-3 rounded-xl border border-sky-200 bg-white p-3"><label className="block text-xs font-bold">Foto ou PDF do comprovante Pix (obrigatório)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-2 block w-full text-xs" onChange={(event) => upload(event.target.files[0])} disabled={uploading} /></label><p className="mt-2 text-xs text-slate-500">{uploading ? 'Enviando comprovante…' : fileName ? '✓ Comprovante anexado: ' + fileName : 'JPG, PNG, WebP ou PDF • até 3 MB'}</p>{error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</div>;
  }
  function CustomerSearch({ onClose, onSelect }) {
    const [query, setQuery] = useState(''); const [rows, setRows] = useState([]); const [loading, setLoading] = useState(false); const [error, setError] = useState('');
    useEffect(() => {
      const controller = new AbortController();
      setRows([]); setError(''); setLoading(query.trim().length >= 4);
      if (query.trim().length < 4) return () => controller.abort();
      const timer = setTimeout(async () => {
        setLoading(true);
        try { const response = await fetch('/api/caixa/customers?q=' + encodeURIComponent(query.trim()), { signal: controller.signal }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Não foi possível buscar clientes.'); setRows(result); }
        catch (err) { if (err.name !== 'AbortError') setError(err.message); }
        finally { if (!controller.signal.aborted) setLoading(false); }
      }, 300);
      return () => { clearTimeout(timer); controller.abort(); };
    }, [query]);
    return <Panel title="Buscar cliente" layer={70} onClose={onClose}><label className="text-sm font-bold">Nome do cliente<input autoFocus className={field} placeholder="Digite pelo menos 4 letras do nome" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="mt-3 space-y-2">{loading && <p role="status">Buscando clientes…</p>}{error && <p role="alert" className="text-red-700">{error}</p>}{!loading && query.trim().length >= 4 && !rows.length && !error && <p>Nenhum cliente encontrado.</p>}{rows.map((customer) => <button key={customer.id} type="button" className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left transition hover:shadow-md" onClick={() => onSelect(customer)}><strong className="block">{customer.name}</strong><span className="mt-1 block text-xs text-slate-600">{customer.phone || 'Sem telefone'}{customer.address ? ' · ' + customer.address : ''}</span></button>)}</div></Panel>;
  }
  function PaymentPartsEditor({ parts, onChange, total, customerId, allowedMethods }) {
    const labels = Object.fromEntries(Object.entries({ PIX: 'Pix', DINHEIRO: 'Dinheiro', DEBITO: 'Débito', CREDITO: 'Crédito', FIADO: 'Fiado' }).filter(([method]) => !allowedMethods || allowedMethods.includes(method)));
    const update = (index, values) => onChange(parts.map((part, current) => current === index ? { ...part, ...values } : part));
    const sum = parts.reduce((value, part) => value + Math.round(Number(part.amount || 0) * 100), 0);
    const remaining = (Math.round(total * 100) - sum) / 100;
    return <section className="my-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><strong className="text-xs">Dividir pagamento</strong>{parts.map((part, index) => <div key={index} className="rounded-xl border border-emerald-100 bg-white p-2"><PaymentMethodButtons value={part.method} onChange={(method) => update(index, { method })} labels={labels} disabledMethods={Object.keys(labels).filter((value) => (value === 'FIADO' && !customerId) || parts.some((entry, current) => current !== index && entry.method === value))} suffix={` · parcela ${index + 1}`} /><input aria-label={`Valor da parcela ${index + 1}`} type="number" min="0.01" step="0.01" value={part.amount} onChange={(event) => update(index, { amount: event.target.value })} className="w-24 rounded-lg border p-2 text-xs" /><button type="button" aria-label={`Remover parcela ${index + 1}`} onClick={() => onChange(parts.filter((_, current) => current !== index))}>✕</button></div>)}<p className="text-xs font-bold">{remaining >= 0 ? 'Falta distribuir: ' : 'Excedente: '}{money(Math.abs(remaining))}</p>{parts.length < Object.keys(labels).length && <button type="button" className="text-xs underline" onClick={() => onChange([...parts, { method: Object.keys(labels).find((method) => !parts.some((part) => part.method === method)), amount: Math.max(0, remaining).toFixed(2) }])}>Adicionar forma de pagamento</button>}</section>;
  }
  function SiteBrand() {
    return <a href="/" aria-label="Ir para a página inicial" className="conflora-site-brand flex min-w-0 items-center gap-3 text-inherit no-underline">
      <img src="/store-assets/brands/conflora-logo.png" alt="Conflora Horta e Viveiro" className="h-10 w-auto max-w-[160px] shrink-0 object-contain" />
    </a>;
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
    return <main className="min-h-screen bg-[#F4F6F5] font-sans text-slate-800"><header className="conflora-site-header"><div className="mx-auto w-full max-w-[1600px]"><SiteBrand /></div></header><p className="p-8 text-center text-sm text-slate-500">Carregando sessão…</p></main>;
  }
  async function api(path, body) {
    const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const data = await response.json();
    if (!response.ok) { throw new Error(data.error || 'Não foi possível concluir a operação.'); }
    return data;
  }
  function Panel({ title, onClose, children, layer = 50 }) {
    return <div style={{ zIndex: layer }} className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-auto"><div className="flex justify-between gap-4 mb-4"><h2 className="font-bold text-xl">{title}</h2><button onClick={onClose} aria-label="Fechar">✕</button></div>{children}</section></div>;
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
      <section role="dialog" aria-modal="true" aria-label={`Escolher peso de ${product.name}`} className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl sm:p-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">Venda por peso</p><h2 className="mt-1 text-lg font-black leading-tight text-[#0F381E]">{product.name}</h2></div>
          <button type="button" onClick={onCancel} aria-label="Fechar" className="rounded-full border border-slate-200 px-2.5 py-1 text-slate-500 hover:bg-slate-50">✕</button>
        </header>
        <p className="mb-3 text-sm text-slate-600">Preço: <strong className="text-emerald-800">{money(unitPrice)} / kg</strong></p>
        <label className="block text-xs font-bold text-slate-700">Quantos quilos?<span className="mt-1 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-2 focus-within:ring-2 focus-within:ring-emerald-500"><input autoFocus type="text" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value.replace(/[^\d.,]/g, '').replace(/(.*[.,].*)[.,]/g, '$1'))} className="w-full bg-transparent px-2 py-2 text-center text-2xl font-black text-[#0F381E] outline-none" aria-label={`Peso em quilos de ${product.name}`} /><span className="pr-2 font-extrabold text-emerald-800">KG</span></span></label>
        <div className="mt-3 grid grid-cols-3 gap-2">{[0.1, 0.5, 1].map((value) => { const steps = Math.max(0, Math.ceil((value - minimum) / increment - 0.0000001)); const preset = Number((minimum + steps * increment).toFixed(3)); return <button type="button" key={value} onClick={() => setQuantity(String(preset))} className="rounded-xl border border-slate-200 px-2 py-2 text-xs font-bold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50">{preset.toLocaleString('pt-BR')} kg</button>; })}</div>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 p-3"><span className="text-sm font-semibold text-slate-600">Subtotal</span><strong className="text-lg font-black text-emerald-800">{money(valid ? unitPrice * parsedQuantity : 0)}</strong></div>
        <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50">Cancelar</button><button type="button" disabled={!valid} onClick={() => valid && onConfirm(Number(parsedQuantity.toFixed(3)))} className={button + ' py-3 disabled:cursor-not-allowed disabled:opacity-50'}>Adicionar ao carrinho</button></div>
      </section>
    </div>;
  }
  function ProductInformation({ product, onClose }) {
    const details = Array.isArray(product.details) ? product.details : [];
    const variants = Array.isArray(product.variants) ? product.variants : [product];
    const imageUrl = product.image || product.imageUrl || '/store-assets/placeholder.svg';

    return <div className="cf-product-information-overlay fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={`Informações de ${product.name}`} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl sm:p-6">
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
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">{product.categoryName || product.category || 'Produto'}</p>
              <h2 title={product.name} className="text-lg font-black leading-tight text-[#0F381E]">{product.name}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar informações" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">✕</button>
        </header>
        <div className="space-y-3">
          <section className="rounded-2xl border border-emerald-100 bg-[#F4F6F5] p-3.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-emerald-800">Variações e valores</h3>
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
          {!details.length && <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">Ainda não há informações adicionais cadastradas para este produto.</p>}
        </div>
        <button type="button" onClick={onClose} className={button + ' mt-5 w-full py-3'}>Fechar</button>
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
    return <main className="min-h-screen bg-[#F4F6F5] font-sans text-slate-800"><header className="conflora-site-header"><div className="mx-auto w-full max-w-[1600px]"><SiteBrand /></div></header><div className="flex min-h-[calc(100vh-66px)] items-center justify-center p-6"><form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-8 shadow"><h1 className="text-2xl font-bold text-[#0F381E]">Frente de caixa</h1><p className="my-2">Entre com sua conta de colaborador.</p><label>Usuário<select required className={field} value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Selecione</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>PIN<input required type="password" className={field} value={pin} onChange={(e) => setPin(e.target.value)} /></label>{error && <p role="alert" className="mb-3 text-red-700">{error}</p>}<button className={button}>Entrar</button></form></div></main>;
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
    return <Panel title={pending ? 'Pedido registrado' : current.paymentStatus === 'ON_ACCOUNT' ? 'Fiado registrado' : 'Venda finalizada'} onClose={onNewOrder}>
      <div className="space-y-4">
        <ReceiptView order={current} />
        {isPixPending && <section className="rounded-2xl border border-emerald-100 bg-white p-4 text-center">
          <h3 className="text-sm font-extrabold text-slate-800">Pague o valor exato pelo Pix</h3>
          <p className="mt-2 font-bold">{money(current.pixData.amount || current.total)}</p>
          <div className="mx-auto my-3 flex w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-2" style={{ maxWidth: 220, aspectRatio: '1 / 1' }}>
            <img className="block" style={{ width: '100%', height: '100%', maxWidth: 200, maxHeight: 200, objectFit: 'contain' }} src={current.pixData.qrCodeBase64} alt="QR Code Pix Sicredi" />
          </div>
          <label className="block text-left text-xs font-bold text-slate-600">Pix Copia e Cola
            <textarea readOnly className={field + ' min-h-20 resize-y break-all'} value={current.pixData.pixCopiaECola} />
          </label>
          <button className={button + ' w-full'} onClick={() => navigator.clipboard.writeText(current.pixData.pixCopiaECola).then(() => setCopyStatus('Copiado!')).catch(() => setCopyStatus('Selecione e copie o código acima.'))}>Copiar Pix</button>
          <p role="status" className="mt-2 text-sm text-emerald-800">{copyStatus}</p>
          <p className="mt-2 text-xs text-slate-500">O valor é fixo. A venda será confirmada automaticamente após a validação do pagamento pelo Sicredi.</p>
        </section>}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>Pedido feito por <strong className="text-slate-700">{staffLabel(current.createdBy)}</strong></span>
          <span>{!current.customerPhone ? 'Sem WhatsApp informado' : receiptSent ? 'Recibo enviado ao WhatsApp' : 'Recibo na fila de envio ao WhatsApp'}</span>
        </div>
        <button onClick={onNewOrder} className={button + ' w-full'}>{pending ? 'Voltar ao caixa' : 'Nova venda'}</button>
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
    return <Panel title="Aprovação de desconto" onClose={onClose}><p>{current.status === 'REJECTED' ? 'Recusado: ' + current.rejectionReason : 'Aguardando o administrador aprovar o desconto de ' + current.discountPercent + '%.'}</p></Panel>;
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
  const paymentLabel = (method) => ({ PIX: 'Pix', DINHEIRO: 'Dinheiro', DEBITO: 'Débito', CREDITO: 'Crédito', FIADO: 'Fiado', SALDO_CLIENTE: 'Saldo do cliente', CARTAO: 'Cartão', CARD: 'Cartão', CASH: 'Dinheiro' }[method] || method || '—');
  const orderItemLabel = (item) => {
    const quantity = Number(item?.quantity || 0).toLocaleString('pt-BR', { maximumFractionDigits: item?.unit === 'KG' ? 3 : 0 });
    return item?.unit === 'KG' ? `${quantity} kg ${item?.name || 'Produto'}` : `${quantity} × ${item?.name || 'Produto'}`;
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
    if (order.creditApprovalStatus === 'PENDING') return 'Fiado: aguardando aprovação do Admin';
    if (order.status === 'CANCELLED') return 'Cancelado';
    if (order.paymentStatus === 'ON_ACCOUNT') return 'Fiado registrado';
    if (order.paymentStatus === 'APPROVED' && (order.paidAt || order.completedAt)) return 'Pago / finalizado';
    if (['AWAITING_CASHIER', 'AWAITING_PAYMENT', 'PENDING', 'CREATING_PIX', 'AWAITING_PIX'].includes(order.status)) return 'Esperando pagamento';
    if (order.status === 'AWAITING_CONFIRMATION') return 'Esperando confirmação';
    if (order.completedAt) return 'Confirmado';
    return 'Em andamento';
  }
  function OrderDetails({ order, onClose, canReceive = false, canConfirmManualPix = false, busy = false, error = '', onReceive, onManualPix, canAdvance = false, onAdvance, deliveryMode = false, extraContent, canApproveCredit = false }) {
    const initialMethod = ['CARTAO', 'CARD', 'MISTO'].includes(order.paymentMethod) ? '' : order.paymentMethod === 'CASH' ? 'DINHEIRO' : order.paymentMethod || 'DINHEIRO';
    const [paymentMethod, setPaymentMethod] = useState(initialMethod);
    const [cashAmount, setCashAmount] = useState(Number(order.total || 0).toFixed(2));
    const [copied, setCopied] = useState(false);
    const [manualPixNote, setManualPixNote] = useState('');
    const [manualProofSeen, setManualProofSeen] = useState(false);
    const [proofId, setProofId] = useState('');
    useEffect(() => {
      setPaymentMethod(initialMethod);
      setCashAmount(Number(order.total || 0).toFixed(2));
      setCopied(false);
      setManualPixNote('');
      setManualProofSeen(false);
    }, [order.id, order.status, order.paymentMethod]);
    const [splitPayment, setSplitPayment] = useState(order.paymentParts?.length > 1);
    const [paymentParts, setPaymentParts] = useState(order.paymentParts?.length > 1 ? order.paymentParts : [{ method: 'DINHEIRO', amount: '' }, { method: 'CREDITO', amount: '' }]);
    const [directPix, setDirectPix] = useState(false);
    const hasPixPart = splitPayment ? paymentParts.some((part) => part.method === 'PIX') : paymentMethod === 'PIX';
    const needsManualProof = directPix && hasPixPart;
    const pixCopyPaste = order.pixData?.pixCopiaECola || order.pixCopiaECola || '';
    const pixAmount = order.paymentMethod !== 'PIX' ? Number(order.total || 0) : (order.paymentParts || [{ method: order.paymentMethod, amount: order.total }])
      .filter((part) => part.method === 'PIX').reduce((sum, part) => sum + Number(part.amount || 0), 0);
    const copyPixCode = async () => {
      try { await navigator.clipboard.writeText(pixCopyPaste); setCopied(true); }
      catch { setCopied(false); }
    };
    return <Panel title={`Comanda #${order.ticketNumber || String(order.id).slice(-6).toUpperCase()}`} onClose={onClose}>
      <div className="space-y-2 text-sm">
        <p className="font-bold text-lg">{order.customerName || 'Cliente Balcão'}</p>
        <p className="text-slate-600">{orderStatusLabel(order)} · {paymentLabel(order.paymentMethod)}</p>
        <ReceiptView order={order} />
        {extraContent}
        {order.requiresRefund && <p role="alert" className="rounded-lg bg-amber-50 p-3 font-bold text-amber-900">Recebimento parcial de {money(order.refundDue)} pendente de conciliação ou estorno pela loja.</p>}
        {order.manualPixProofId && <a className="mt-3 inline-flex font-bold text-emerald-800 underline" href={'/api/caixa/payment-proofs/' + order.manualPixProofId} onClick={(event) => { event.preventDefault(); window.ConfloraSession.openPrivateFile('/api/caixa/payment-proofs/' + order.manualPixProofId).catch(error => alert(error.message)); }}>Ver comprovante Pix anexado</a>}
        {canApproveCredit && !(order.paymentParts?.length > 1) && <button type="button" disabled={busy} className="cf-button !w-full !bg-amber-500 !text-slate-950 !py-4 !font-black" onClick={() => onReceive(order, 'FIADO', null, order.paymentParts)}>Aprovar fiado e liberar pedido</button>}
        {(canConfirmManualPix || order.paymentMethod === 'PIX' && ['CREATING_PIX', 'AWAITING_PIX'].includes(order.status)) && <section className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <h3 className="font-black text-sky-950">Pix aguardando confirmação</h3>
          <p className="mt-1 text-xs text-sky-900">A venda será finalizada pela confirmação do Sicredi ou pela conferência manual do Pix por um colaborador autorizado, com comprovante.</p>
          {order.pixData?.qrCodeBase64 && <img src={order.pixData.qrCodeBase64} alt={`QR Code Pix da comanda ${order.ticketNumber}`} className="mx-auto mt-3 block max-h-48 w-48 rounded-lg bg-white object-contain p-2" />}
          {pixCopyPaste && <><label className="mt-3 block text-xs font-bold text-sky-950">Pix copia e cola<textarea readOnly value={pixCopyPaste} className="mt-1 w-full rounded-xl border border-sky-200 bg-white p-2 text-xs" rows={3} /></label><button type="button" className={button + ' mt-2 w-full'} onClick={copyPixCode}>{copied ? 'Código copiado' : 'Copiar Pix copia e cola'}</button></>}
          {order.pixData?.txid && !order.pixData?.qrCodeBase64 && !pixCopyPaste && <p className="mt-2 text-xs text-sky-900">A cobrança está sendo preparada. Atualize em alguns instantes.</p>}
          {canConfirmManualPix && <div className="mt-4 space-y-2 border-t border-sky-200 pt-3">
            <p className="text-xs font-bold text-sky-950">O Sicredi ainda não confirmou?</p>
            <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={manualProofSeen} onChange={(event) => setManualProofSeen(event.target.checked)} /><span>Conferi no comprovante o valor exato de {money(pixAmount)} e a conta recebedora da Conflora.</span></label>
            <label className="block text-xs font-bold text-slate-700">Observação do comprovante<textarea className={field} rows={2} value={manualPixNote} onChange={(event) => setManualPixNote(event.target.value)} placeholder="Ex.: comprovante apresentado no caixa" /></label>
            <PixProofUpload targetType="ORDER" targetId={order.id} onChange={setProofId} />
            <button type="button" className={button + ' w-full'} disabled={busy || !proofId || !manualProofSeen || manualPixNote.trim().length < 8} onClick={() => onManualPix(order, manualPixNote, proofId)}>Confirmar Pix manualmente e finalizar</button>
          </div>}
        </section>}
        {canAdvance && <button type="button" className={button + ' mt-4 w-full'} disabled={busy} onClick={() => onAdvance(order)}>Confirmar comanda e aguardar pagamento</button>}
        {canReceive && <section className="mt-4 space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
          <h3 className="font-black text-emerald-950">{deliveryMode ? 'Receber na entrega' : 'Receber no caixa'}</h3>
          <PaymentMethodButtons value={paymentMethod} onChange={setPaymentMethod} labels={{ DINHEIRO: '💵 Dinheiro', DEBITO: '💳 Débito', CREDITO: '💳 Crédito', PIX: 'Pix · QR Code / Copia e Cola', ...(!deliveryMode ? { FIADO: 'Fiado · aprovação do Admin' } : {}) }} disabledMethods={order.customerId ? [] : ['FIADO', 'SALDO_CLIENTE']} />
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={splitPayment} onChange={(event) => setSplitPayment(event.target.checked)} />Usar mais de uma forma de pagamento</label>
          {splitPayment && <PaymentPartsEditor parts={paymentParts} onChange={setPaymentParts} total={Number(order.total)} customerId={order.customerId} allowedMethods={deliveryMode ? ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO'] : ['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO', 'FIADO']} />}
          {hasPixPart && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={directPix} onChange={(event) => setDirectPix(event.target.checked)} />Pix já recebido: confirmar manualmente</label>}
          {needsManualProof && <div className="space-y-2"><PixProofUpload targetType="ORDER" targetId={order.id} onChange={setProofId} /><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={manualProofSeen} onChange={(event) => setManualProofSeen(event.target.checked)} />Conferi o valor do Pix e a conta recebedora da Conflora.</label><label className="block text-xs">Observação do comprovante<textarea className={field} value={manualPixNote} onChange={(event) => setManualPixNote(event.target.value)} /></label></div>}
          {paymentMethod === 'DINHEIRO' && !splitPayment && <label className="block text-xs font-bold text-slate-700">Valor recebido em dinheiro (R$)<input className={field} type="number" min={Number(order.total || 0)} step="0.01" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} /></label>}
          {paymentMethod === 'DINHEIRO' && !splitPayment && Number(cashAmount) >= Number(order.total || 0) && <p className="text-right text-xs font-bold text-emerald-900">Troco: {money(Number(cashAmount) - Number(order.total || 0))}</p>}
          {!order.customerId && ['FIADO', 'SALDO_CLIENTE'].includes(paymentMethod) && <p className="text-xs text-amber-900">Selecione um cliente cadastrado antes de receber em fiado ou usar saldo.</p>}

          <button type="button" className={button + ' w-full'} disabled={busy || (!splitPayment && !paymentMethod) || (needsManualProof && (!proofId || !manualProofSeen || manualPixNote.trim().length < 8)) || (!splitPayment && paymentMethod === 'DINHEIRO' && Number(cashAmount) < Number(order.total || 0)) || (!splitPayment && ['FIADO', 'SALDO_CLIENTE'].includes(paymentMethod) && !order.customerId)} onClick={() => onReceive(order, splitPayment ? 'MISTO' : needsManualProof ? 'PIX_MANUAL' : paymentMethod, !splitPayment && paymentMethod === 'DINHEIRO' ? cashAmount : null, splitPayment ? paymentParts.map((part) => ({ ...part, amount: Number(part.amount) })) : undefined, { manualPix: needsManualProof, proofSeen: manualProofSeen, note: manualPixNote, proofId })}>
            {busy ? 'Processando…' : hasPixPart && !needsManualProof ? 'Gerar QR Code Pix' : 'Confirmar pagamento e finalizar'}
          </button>
        </section>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-xs text-red-800">{error}</p>}
      </div>
    </Panel>;
  }
  function OrderCard({ order, tone, selected, attention, onDetails, stage, canMove, onDragStart, onDragEnd }) {
    const items = (order.items || []).slice(0, 2);
    const extraItems = Math.max(0, (order.items || []).length - items.length);
    const deliveryDriver = order.assignedDriver || order.deliveredBy;
    return <OrderCardSurface padding="sm" draggable={canMove && ['confirmation', 'payment'].includes(stage) ? 'true' : undefined} onDragStart={(event) => { event.dataTransfer.setData('application/x-conflora-order', JSON.stringify({ id: order.id, from: stage })); event.dataTransfer.effectAllowed = 'move'; onDragStart?.(stage); }} onDragEnd={onDragEnd} className={`cf-order-card cf-order-card--${tone || 'amber'} ${selected ? 'cf-order-card--selected' : ''} ${attention ? 'cf-order-card--attention' : ''}`}>
      <button type="button" className="w-full cursor-pointer text-left" onClick={() => onDetails(order)} aria-label={`Abrir recibo e detalhes da comanda ${order.ticketNumber}`}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Comanda #{order.ticketNumber || String(order.id).slice(-6).toUpperCase()}</span>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900">{paymentLabel(order.paymentMethod)}</span>
        </div>
        <p className="mt-2 text-[11px] font-bold text-emerald-800">{order.deliveryStatus === 'OUT_FOR_DELIVERY' ? 'Em rota · ' : ''}{window.ConfloraOrderDisplay.status(order)}</p>
        {deliveryDriver && <span data-delivery-driver className="mt-2 inline-flex max-w-full items-start gap-1.5 rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-[11px] font-bold leading-5 text-emerald-900" title={`Entregador responsável: ${deliveryDriver.name || 'Entregador'}`} aria-label={`Entregador responsável: ${deliveryDriver.name || 'Entregador'}`}><span aria-hidden="true">🛵</span><span className="min-w-0 break-words">Entregador: {deliveryDriver.name || 'Entregador'}</span></span>}
        {order.deliveryOverview && <div className="mt-2 space-y-1 rounded-lg bg-white/60 p-2 text-[11px] font-semibold text-slate-700">{order.deliveryOverview.map(line => <p key={line}>{line}</p>)}</div>}
        <p className="mt-1 font-bold text-slate-800">{order.customerName || 'Cliente Balcão'}</p>
        <p title={(order.items || []).map((item) => item.name).join(' · ')} className="mt-1 text-xs leading-5 text-slate-600">{items.map(orderItemLabel).join(' · ')}{extraItems ? ` · +${extraItems} item(ns)` : ''}</p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <span className="text-[11px] text-slate-500">{dateTime(order.createdAt)}</span>
          <strong className="text-base text-[#0F381E]">{money(order.total)}</strong>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Pedido feito por: <strong>{staffLabel(order.createdBy)}</strong></p>
        <span className="mt-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-[10px] font-extrabold text-emerald-900">Ver recibo e detalhes →</span>
      </button>
    </OrderCardSurface>;
  }
  function MetricCard({ label, value, description, tone = 'default' }) {
    return <cf-card padding="sm" class="cf-metric-card" tone={tone === 'debt' ? 'warning' : undefined}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-[#0F381E]">{value}</p>
      {description && <p className="mt-1 text-[10px] text-slate-500">{description}</p>}
    </cf-card>;
  }
  function CashierColumn({ title, hint, orders, tone, selectedOrderId, pulsedOrderIds, onDetails, stage, canMove, dragFrom, onMove, onDragStart, onDragEnd }) {
    const themes = {
      amber: 'border-amber-300 bg-amber-50 text-amber-950',
      blue: 'border-sky-300 bg-sky-50 text-sky-950',
      green: 'border-emerald-300 bg-emerald-50 text-emerald-950',
      red: 'border-red-300 bg-red-50 text-red-950',
    };
    const acceptsDrop = canMove && ((dragFrom === 'confirmation' && stage === 'payment') || (dragFrom === 'payment' && stage === 'paid'));
    return <section onDragOver={(event) => { if (acceptsDrop) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDrop={(event) => { event.preventDefault(); if (!acceptsDrop) return; try { const payload = JSON.parse(event.dataTransfer.getData('application/x-conflora-order')); onMove(payload.id, payload.from, stage); } catch { /* Ignore unrelated drag payloads. */ } onDragEnd(); }} className={`min-w-[84vw] snap-start rounded-2xl border border-slate-200 bg-slate-100 p-3 md:min-w-0 ${acceptsDrop ? 'cf-order-column--drop' : ''}`} aria-label={title}>
      <header className={`mb-3 rounded-xl border px-3 py-2 ${themes[tone]}`}>
        <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-black tracking-wide">{title}</h3><span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-extrabold">{orders.length}</span></div>
        <p className="mt-1 text-[10px] opacity-75">{hint}</p>
      </header>
      <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
        {orders.map((order) => <OrderCard key={order.id} order={order} tone={tone} stage={stage} canMove={canMove} onDragStart={onDragStart} onDragEnd={onDragEnd} attention={pulsedOrderIds.has(order.id)} selected={selectedOrderId === order.id && order.status === 'AWAITING_CONFIRMATION'} onDetails={onDetails} />)}
        {!orders.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-4 text-center text-xs text-slate-500">Nenhuma comanda nesta etapa.</p>}
      </div>
    </section>;
  }
  function CashierQueue({ user, view, onBack, onDebt }) {
    const today = dateInSaoPaulo();
    const [dateFrom, setDateFrom] = useState(view === 'history' || view === 'report' ? '2000-01-01' : today);
    const [dateTo, setDateTo] = useState(today);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [dragFrom, setDragFrom] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [pulsedOrderIds, setPulsedOrderIds] = useState(() => new Set());
    const [newOrderNotice, setNewOrderNotice] = useState('');
    const dataRef = useRef(null);

    const refresh = async (silent = false) => {
      if (!silent) setRefreshing(true);
      setError('');
      try {
        const query = new URLSearchParams({ from: dateFrom, to: dateTo });
        const nextData = await api('/api/caixa/orders?' + query.toString());
        const previous = dataRef.current;
        if (silent && previous) {
          const previousIds = new Set([...(previous.pendingConfirmation || []), ...(previous.pendingPayment || [])].map((order) => order.id));
          const incoming = [...(nextData.pendingConfirmation || []), ...(nextData.pendingPayment || [])].filter((order) => !previousIds.has(order.id));
          if (incoming.length) {
            const ids = new Set(incoming.map((order) => order.id));
            setPulsedOrderIds((current) => new Set([...current, ...ids]));
            setNewOrderNotice(incoming.length === 1 ? `Nova comanda aguardando ${incoming[0].status === 'AWAITING_CONFIRMATION' ? 'confirmação' : 'pagamento'}: #${incoming[0].ticketNumber}` : `${incoming.length} novas comandas aguardando atendimento`);
            setTimeout(() => setPulsedOrderIds((current) => new Set([...current].filter((id) => !ids.has(id)))), 9000);
            setTimeout(() => setNewOrderNotice(''), 9000);
          }
        }
        dataRef.current = nextData;
        setData(nextData);
        setSelectedOrder((current) => {
          if (!current) return current;
          const available = [nextData.pendingConfirmation, nextData.pendingPayment, nextData.confirmed, nextData.paid, nextData.history].flat();
          return available.find((order) => order.id === current.id) || current;
        });
      } catch (err) { setError(err.message); }
      finally { if (!silent) setRefreshing(false); }
    };
    useEffect(() => {
      refresh();
      const timer = setInterval(() => refresh(true), 15000);
      const stream = !window.ConfloraSession ? null : window.ConfloraSession.openEventStream('/api/caixa/orders/stream');
      stream?.addEventListener('orders-changed', () => refresh(true));
      stream?.addEventListener('stream-fallback', () => refresh(true));
      const onVisible = () => { if (document.visibilityState === 'visible') refresh(true); };
      document.addEventListener('visibilitychange', onVisible);
      return () => { clearInterval(timer); stream?.close(); document.removeEventListener('visibilitychange', onVisible); };
    }, [dateFrom, dateTo]);

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
          receivedAmount: receivedAmount === null || receivedAmount === undefined || receivedAmount === '' ? null : Number(String(receivedAmount).replace(',', '.')),
        });
        setSelectedOrder(response.order || order);
        await refresh(true);
      } catch (err) { setError(err.message); }
      finally { setBusy(false); }
    };

    const moveOrder = async (id, from, to) => {
      if (busy || user.role === 'VENDEDOR') return;
      setBusy(true); setError('');
      try {
        const response = await api('/api/caixa/orders/' + encodeURIComponent(id) + '/move', { from, to });
        setSelectedOrder(response.order); await refresh(true);
      } catch (err) { setError(err.message); }
      finally { setBusy(false); setDragFrom(null); }
    };

    const columns = data ? [
      { title: 'ESPERANDO CONFIRMAÇÃO', hint: 'Pedidos que exigem confirmação prévia da loja', orders: data.pendingConfirmation, tone: 'amber', stage: 'confirmation' },
      { title: 'ESPERANDO PAGAMENTO', hint: 'Receba no caixa ou aguarde a confirmação do Pix', orders: data.pendingPayment, tone: 'blue', stage: 'payment' },
      { title: 'PAGOS / FINALIZADOS', hint: 'Pagamentos recebidos e pedidos concluídos', orders: data.paid, tone: 'green', stage: 'paid' },
      { title: 'FIADOS', hint: 'Vendas registradas para pagamento posterior', orders: data.confirmed, tone: 'red', stage: 'debt' },
    ] : [];
    const title = view === 'orders' ? 'Comandas' : view === 'history' ? 'Histórico de vendas' : 'Relatório';
    const reportOrders = data ? data.history.filter((order) => user.role === 'ADMIN'
      || (user.role === 'VENDEDOR' ? order.createdBy?.id === user.id : order.receivedBy?.id === user.id)) : [];
    const reportPaidOrders = reportOrders.filter((order) => (order.paymentStatus === 'APPROVED' || order.paymentStatus === 'ON_ACCOUNT') && (order.paidAt || order.completedAt));
    const methodAmount = (order, method) => (order.paymentParts || [{ method: order.paymentMethod, amount: order.total }]).filter((part) => part.method === method).reduce((sum, part) => sum + Number(part.amount || 0), 0);
    const cashAmount = (order) => ['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'].reduce((sum, method) => sum + methodAmount(order, method), 0);
    const reportCashOrders = reportPaidOrders.filter((order) => cashAmount(order) > 0);
    const reportCreditUsedTotal = reportPaidOrders.reduce((sum, order) => sum + methodAmount(order, 'SALDO_CLIENTE'), 0);
    const reportSalesTotal = reportCashOrders.reduce((sum, order) => sum + cashAmount(order), 0);
    const reportDebtSettlements = (data?.debtHistory || []).filter((item) => (item.entryType || item.type) === 'QUITACAO_FIADO');
    const reportAdvanceCredits = (data?.debtHistory || []).filter((item) => (item.entryType || item.type) === 'CREDITO_CLIENTE');
    const reportDebtTotal = reportDebtSettlements.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const reportAdvanceTotal = reportAdvanceCredits.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const reportPaymentTotals = Object.fromEntries(['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO', 'SALDO_CLIENTE'].map((method) => [method,
      reportPaidOrders.reduce((sum, order) => sum + methodAmount(order, method), 0),
    ]));
    const topProducts = (rows, metric) => {
      const products = new Map();
      rows.forEach((order) => (order.items || []).forEach((item) => {
        const key = String(item.productId || item.name || 'produto');
        const current = products.get(key) || { name: item.name || 'Produto', quantity: 0, total: 0 };
        current.quantity += Number(item.quantity || 0);
        current.total += Number(item.subtotalMinor || 0) / 100 || Number(item.price || 0) * Number(item.quantity || 0);
        products.set(key, current);
      }));
      return [...products.values()].sort((a, b) => b[metric] - a[metric]).slice(0, 5);
    };
    const mostByQuantity = data ? topProducts(reportOrders, 'quantity') : [];
    const mostByValue = data ? topProducts(reportOrders, 'total') : [];

    return <div className="min-h-screen bg-[#F4F6F5] font-sans text-slate-800">
      <header className="conflora-site-header !flex-col !items-stretch border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col items-start gap-2"><SiteBrand /><button type="button" onClick={onBack} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E7B914] bg-[#F4C430] px-4 py-2 text-xs font-extrabold text-[#0F381E] shadow-sm transition hover:bg-[#E7B914] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7B914] focus-visible:ring-offset-2">← Voltar ao caixa</button></div>
          <div className="flex items-center gap-2"><h1 className="mr-2 text-lg font-black text-[#0F381E]">{title}</h1>{view === 'report' && user.role !== 'VENDEDOR' && <button className={button} onClick={onDebt}>Receber pagamento</button>}<button className={button} disabled={refreshing} onClick={() => refresh()} aria-label="Atualizar">{refreshing ? 'Atualizando…' : '↻ Atualizar'}</button></div>
        </div>
        </header>

      <div className="shrink-0 border-b border-slate-200 bg-white/80 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-end gap-2">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {[{ days: 0, label: 'Hoje' }, { days: 7, label: '7 dias' }, { days: 30, label: '30 dias' }].map((option) => {
                const isActive = dateTo === today && dateFrom === (option.days === 0 ? today : dateOffset(today, -(option.days - 1)));
                return <button key={option.days} aria-pressed={isActive} className={`rounded-full border px-4 py-2 text-xs font-extrabold transition ${isActive ? 'border-emerald-700 bg-emerald-700 text-white shadow-md' : 'border-slate-200 bg-white text-slate-700 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50 hover:shadow-sm'}`} onClick={() => setPeriod(option.days)}>{option.label}</button>;
              })}
            </div>
            <div className="flex items-end gap-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">De<input aria-label="Data inicial" className="mt-1 block w-[124px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700" type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} /></label>
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Até<input aria-label="Data final" className="mt-1 block w-[124px] rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700" type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} /></label>
            </div>
            <span className="ml-auto text-xs text-slate-500">{dateFrom === dateTo ? dateFrom : `${dateFrom} a ${dateTo}`}</span>
          </div>
        </div>

      <main className="mx-auto min-h-[calc(100vh-130px)] w-full max-w-[1600px] overflow-y-auto p-3 sm:p-5">
          {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {!data && !error && <p className="rounded-xl bg-white p-6 text-center text-sm text-slate-500">Carregando comandas…</p>}
          {data && <>
            {view === 'orders' && <>
              <div className="mb-3 grid grid-cols-1 gap-2 sm:mb-4 sm:grid-cols-3">
                <MetricCard label="Vendas atribuídas a mim" value={money(data.metrics.sales)} description={`${data.metrics.orderCount} comanda(s)`} />
                <MetricCard label="Recebido por mim" value={money(data.metrics.receipts)} description="Vendas pagas no período" />
                <MetricCard label="Fiados quitados por mim" value={money(data.metrics.debtReceipts)} description="Recebimentos no período" />
              </div>
              <p className="mb-2 text-[11px] font-medium text-slate-500">Deslize para o lado no celular para ver as etapas do quadro.</p>
              {newOrderNotice && <div role="status" className="mb-3 rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm font-extrabold text-amber-950 shadow-sm" aria-live="polite">🔔 {newOrderNotice}</div>}
              <div className="flex snap-x gap-3 overflow-x-auto pb-3 md:grid md:grid-cols-2 xl:grid-cols-4 md:overflow-visible">
                {columns.map((column) => <CashierColumn key={column.title} {...column} canMove={['ADMIN', 'CAIXA'].includes(user.role) && !busy} dragFrom={dragFrom} onMove={moveOrder} onDragStart={setDragFrom} onDragEnd={() => setDragFrom(null)} pulsedOrderIds={pulsedOrderIds} selectedOrderId={selectedOrder?.id} onDetails={setSelectedOrder} />)}
              </div>
            </>}

            {view === 'history' && <>
              <div className="mb-3 flex items-center justify-between"><h3 className="font-black text-[#0F381E]">Histórico de vendas</h3><span className="text-xs text-slate-500">{data.history.length} registro(s)</span></div>
              <div className="space-y-2 md:hidden">
                {data.history.map((order) => <button key={order.id} onClick={() => setSelectedOrder(order)} className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm"><span className="flex justify-between gap-2"><strong>#{order.ticketNumber} · {order.customerName || 'Cliente Balcão'}</strong><strong>{money(order.total)}</strong></span><span className="mt-1 block text-xs text-slate-500">{orderStatusLabel(order)} · {paymentLabel(order.paymentMethod)}</span><span className="mt-1 block text-[11px] text-slate-500">{dateTime(order.paidAt || order.completedAt || order.createdAt)} · Pedido: {staffLabel(order.createdBy)}</span></button>)}
              </div>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
                <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="p-3">Data</th><th className="p-3">Comanda / cliente</th><th className="p-3">Status</th><th className="p-3">Pagamento</th><th className="p-3">Pedido por</th><th className="p-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{data.history.map((order) => <tr key={order.id} className="hover:bg-emerald-50/50"><td className="p-3 text-xs text-slate-500">{dateTime(order.paidAt || order.completedAt || order.createdAt)}</td><td className="p-3"><button className="font-bold text-[#0F381E] hover:underline" onClick={() => setSelectedOrder(order)}>#{order.ticketNumber} · {order.customerName || 'Cliente Balcão'}</button></td><td className="p-3">{orderStatusLabel(order)}</td><td className="p-3">{paymentLabel(order.paymentMethod)}</td><td className="p-3">{staffLabel(order.createdBy)}</td><td className="p-3 text-right font-bold">{money(order.total)}</td></tr>)}</tbody></table>
              </div>
              {!data.history.length && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Nenhuma venda encontrada neste período.</p>}
            </>}

            {view === 'report' && <>
              <h3 className="mb-3 font-black text-[#0F381E]">Relatório · {dateFrom === dateTo ? dateFrom : `${dateFrom} a ${dateTo}`}</h3>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <MetricCard label="Recebido em vendas" value={money(reportSalesTotal)} description={`${reportCashOrders.length} venda(s) com recebimento no período`} />
                <MetricCard label="Saldo de cliente utilizado" value={money(reportCreditUsedTotal)} description="Crédito pago antecipadamente" />
                <MetricCard label="Quitações de fiado" value={money(reportDebtTotal)} description={`${reportDebtSettlements.length} recebimento(s)`} />
                <MetricCard label="Crédito antecipado" value={money(reportAdvanceTotal)} description={`${reportAdvanceCredits.length} recebimento(s)`} />
                <MetricCard label="Total recebido" value={money(reportSalesTotal + reportDebtTotal + reportAdvanceTotal)} description="Vendas + quitações + créditos recebidos" />
                <MetricCard label="Fiado lançado" value={money(data.closing.confirmedDebt)} description="Não incluído no total recebido" tone="debt" />
                <MetricCard label="Quantidade de vendas" value={String(reportOrders.length)} />
                <MetricCard label="Ticket médio" value={money(reportOrders.length ? reportOrders.reduce((sum, order) => sum + Number(order.total || 0), 0) / reportOrders.length : 0)} />
                {['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO', 'SALDO_CLIENTE'].map((method) => <MetricCard key={method} label={paymentLabel(method)} value={money(reportPaymentTotals[method])} />)}
              </div>
              <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <h4 className="border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-700">Conferência por forma de pagamento</h4>
                <div className="divide-y divide-slate-100">{['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO', 'SALDO_CLIENTE'].map((method) => <div key={method} className="grid grid-cols-2 items-center gap-2 px-4 py-3 text-xs sm:grid-cols-[1fr_auto_auto_auto] sm:gap-3"><strong>{paymentLabel(method)}</strong><span className="text-right font-bold text-[#0F381E] sm:order-last">{money(reportPaymentTotals[method])}</span><span className="text-slate-500">Vendas confirmadas</span><span className="text-right text-slate-500 sm:text-left">Recebimentos de clientes {money(data.closing.byPayment[method]?.debt || 0)}</span></div>)}</div>
              </section>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {[{ title: '5 mais vendidos em quantidade', rows: mostByQuantity }, { title: '5 maiores vendas em valor', rows: mostByValue }].map((group) => <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="mb-3 font-bold text-[#0F381E]">{group.title}</h4>{group.rows.length ? <ol className="space-y-2">{group.rows.map((product, index) => <li key={product.name} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm"><span title={product.name}>{index + 1}. {product.name} <small className="text-slate-500">({product.quantity} un.)</small></span><strong>{money(product.total)}</strong></li>)}</ol> : <p className="text-sm text-slate-500">Sem itens vendidos no período.</p>}</section>)}
              </div>
              <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-950">{user.role === 'ADMIN' ? 'Visão consolidada de todos os colaboradores.' : `Dados vinculados a ${staffLabel({ name: user.name, email: user.email })}.`}</p>
            </>}
          </>}
      </main>
      {selectedOrder && <OrderDetails key={`${selectedOrder.id}:${selectedOrder.status}:${selectedOrder.paymentMethod}`} order={selectedOrder} canApproveCredit={user.role === 'ADMIN' && selectedOrder.creditApprovalStatus === 'PENDING'} canAdvance={user.role !== 'VENDEDOR' && selectedOrder.status === 'AWAITING_CONFIRMATION' && selectedOrder.creditApprovalStatus !== 'PENDING'} onAdvance={(order) => moveOrder(order.id, 'confirmation', 'payment')} canReceive={(user.role === 'ADMIN' && selectedOrder.creditApprovalStatus === 'PENDING' && selectedOrder.paymentParts?.length > 1 || user.role !== 'VENDEDOR' && ['AWAITING_CASHIER', 'AWAITING_PAYMENT', 'PENDING'].includes(selectedOrder.status)) && !selectedOrder.pixData?.txid} canConfirmManualPix={(user.role !== 'VENDEDOR' || selectedOrder.createdBy?.id === user.id && (!selectedOrder.pixData?.txid || (selectedOrder.paymentParts || [{ method: selectedOrder.paymentMethod }]).every(part => part.method === 'PIX'))) && (selectedOrder.paymentMethod === 'PIX' && ['CREATING_PIX', 'AWAITING_PIX'].includes(selectedOrder.status) || user.role === 'VENDEDOR' && ['AWAITING_CASHIER', 'AWAITING_PAYMENT', 'PENDING'].includes(selectedOrder.status))} busy={busy} error={error} onReceive={receive} onManualPix={async (order, note, proofId) => {
        setBusy(true); setError('');
        try {
          const response = await api('/api/caixa/orders/' + order.id + '/confirm-manual-pix', { proofSeen: true, note, proofId });
          setSelectedOrder(response.order || order); await refresh(true);
        } catch (err) { setError(err.message); }
        finally { setBusy(false); }
      }} onClose={() => setSelectedOrder(null)} />}
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
    return <Panel title="Receber pagamento do cliente" onClose={onClose}>{error && <p role="alert" className="text-red-700">{error}</p>}{result ? <div><p>Recebimento registrado: {money(result.amount)}</p><p>Saldo devedor: {money(result.newBalance)}</p><p>Crédito disponível: {money(result.newCreditBalance)}</p>{result.newBalance > 0 && <button className={button + ' mt-4'} onClick={() => { setBalance(result.newBalance); setCreditBalance(result.newCreditBalance || 0); setAmount(Number(result.newBalance).toFixed(2)); setId(crypto.randomUUID()); setResult(null); setSplitPayment(false); setProofSeen(false); setNote(''); setProofId(''); }}>Receber valor restante</button>}</div> : <><label>Buscar cliente cadastrado<input className={field} value={query} onChange={(e) => setQuery(e.target.value)} /></label><div className="max-h-36 overflow-auto">{customers.map((row) => <button className="block w-full border-b p-2 text-left" key={row.id} onClick={() => select(row)}>{row.name} · {row.phone || 'Sem telefone'}</button>)}</div>{customer && <><p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm font-bold">{customer.name}<span className="mt-1 block text-xs font-medium text-amber-800">Saldo devedor: {money(balance)}</span><span className="block text-xs font-medium text-emerald-800">Crédito disponível: {money(creditBalance)}</span></p><label>Tipo de lançamento<select className={field} value={entryType} onChange={(event) => setEntryType(event.target.value)}><option value="QUITACAO_FIADO">Receber pagamento de dívida</option><option value="CREDITO_CLIENTE">Adicionar crédito antecipado</option></select></label><label>Valor recebido<input className={field} type="number" min="0.01" max={isCreditEntry ? undefined : balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label><PaymentMethodButtons value={method} onChange={setMethod} labels={{ DINHEIRO: 'Dinheiro', DEBITO: 'Cartão de débito', CREDITO: 'Cartão de crédito', PIX: 'Pix já recebido' }} /><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={splitPayment} onChange={(event) => setSplitPayment(event.target.checked)} />Usar mais de uma forma de pagamento</label>{splitPayment && <PaymentPartsEditor parts={parts} onChange={setParts} total={Number(amount || 0)} allowedMethods={['DINHEIRO', 'DEBITO', 'CREDITO', 'PIX']} />}{hasPix && <div className="my-3 space-y-2"><PixProofUpload key={id} targetType="DEBT" targetId={id} onChange={setProofId} /><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={proofSeen} onChange={(event) => setProofSeen(event.target.checked)} />Conferi o Pix recebido na conta da Conflora.</label><label className="block text-xs">Observação do comprovante<textarea className={field} value={note} onChange={(event) => setNote(event.target.value)} /></label></div>}{!isCreditEntry && <p className="my-3 text-sm font-bold">Saldo após recebimento: {money(Math.max(0, balance - Number(amount || 0)))}</p>}<button className={button} disabled={busy || (hasPix && (!proofId || !proofSeen || note.trim().length < 8)) || amountInvalid || (!isCreditEntry && balance <= 0)} onClick={submit}>{busy ? 'Registrando…' : isCreditEntry ? 'Registrar crédito recebido' : 'Confirmar recebimento'}</button></>}</>}</Panel>;
  }
  return { SiteBrand, Loading, Login, Receipt, CashierQueue, DebtSettlement, DiscountApproval, ProductInformation, WeightPrompt, handleProductImageError, PaymentPartsEditor, PaymentMethodButtons, CustomerSearch, LocationPicker, OrderDetails, CashierColumn };
})();
