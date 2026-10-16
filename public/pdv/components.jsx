/* Shared PDV components loaded before the sales screen. */
window.PdvComponents = (() => {
  const { useState, useEffect } = React;
  const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const button = 'cf-button';
  const field = 'w-full p-3 border rounded-xl my-2';
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
  function Panel({ title, onClose, children }) {
    return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-auto"><div className="flex justify-between gap-4 mb-4"><h2 className="font-bold text-xl">{title}</h2><button onClick={onClose} aria-label="Fechar">✕</button></div>{children}</section></div>;
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
    return <Panel title={pending ? 'Pedido registrado' : current.paymentStatus === 'ON_ACCOUNT' ? 'Fiado registrado' : 'Venda finalizada'} onClose={onNewOrder}>
      <p>Comanda #{current.ticketNumber} · {current.customerName}</p>
      <p className="my-2 font-semibold">{current.status === 'AWAITING_PIX' ? 'Aguardando pagamento Pix' : current.status === 'AWAITING_CASHIER' ? 'Comanda enviada para a fila do caixa' : current.paymentStatus === 'ON_ACCOUNT' ? 'Saldo lançado na conta do cliente' : 'Pagamento confirmado'}</p>
      <ul className="divide-y">{current.items.map((item, index) => <li className="py-2 flex justify-between gap-3" key={index}><span title={item.name}>{item.quantity} {item.unit} · {item.name}</span><span>{money(item.subtotalMinor / 100)}</span></li>)}</ul>
      <p className="mt-3">Subtotal: {money(current.subtotal)}</p><p>Desconto: {money(current.discountAmount)}</p><p>Entrega: {money(current.freightValue)}</p><p className="text-xl font-bold my-3">Total: {money(current.total)}</p>
      <p>Pedido feito por: <strong>{staffLabel(current.createdBy)}</strong></p>
      {current.status === 'AWAITING_PIX' && current.pixData && <div className="my-4 text-center"><img className="mx-auto w-56" src={current.pixData.qrCodeBase64} alt="QR Code Pix Sicredi" /><label>Pix copia e cola<textarea readOnly className={field} value={current.pixData.pixCopiaECola} /></label><button className={button} onClick={() => navigator.clipboard.writeText(current.pixData.pixCopiaECola).then(() => setCopyStatus('Copiado!')).catch(() => setCopyStatus('Selecione e copie o código acima.'))}>Copiar Pix</button><p role="status">{copyStatus}</p><p className="mt-2 text-sm">Valor fixo. A confirmação aparecerá automaticamente após o aviso do Sicredi.</p></div>}
      <p className="my-4 text-sm">{!current.customerPhone ? 'Sem WhatsApp informado.' : order.receiptDelivery?.sent ? 'Recibo enviado ao WhatsApp.' : 'Recibo na fila de envio ao WhatsApp.'}</p><button onClick={onNewOrder} className={button}>Nova venda</button>
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
  const paymentLabel = (method) => ({ PIX: 'Pix', DINHEIRO: 'Dinheiro', DEBITO: 'Débito', CREDITO: 'Crédito', FIADO: 'Fiado' }[method] || method || '—');
  const staffLabel = (staff) => {
    const name = staff?.name || staff?.email || '—';
    return staff?.email && staff.email !== name ? `${name} · ${staff.email}` : name;
  };
  function orderStatusLabel(order) {
    if (order.status === 'CANCELLED') return 'Cancelado';
    if (order.paymentStatus === 'ON_ACCOUNT') return 'Fiado registrado';
    if (order.paymentStatus === 'APPROVED' && (order.paidAt || order.completedAt)) return 'Pago / finalizado';
    if (['CREATING_PIX', 'AWAITING_PIX'].includes(order.status)) return 'Esperando pagamento';
    if (order.status === 'AWAITING_CASHIER') return 'Esperando confirmação';
    if (order.completedAt) return 'Confirmado';
    return 'Em andamento';
  }
  function OrderDetails({ order, onClose }) {
    return <Panel title={`Comanda #${order.ticketNumber}`} onClose={onClose}>
      <div className="space-y-2 text-sm">
        <p className="font-bold text-lg">{order.customerName || 'Cliente Balcão'}</p>
        <p className="text-slate-600">{orderStatusLabel(order)} · {paymentLabel(order.paymentMethod)}</p>
        <cf-list>{(order.items || []).map((item, index) => <cf-list-item className="flex justify-between gap-3" key={`${item.productId}-${index}`}><span title={item.name}>{item.quantity} × {item.name}</span><strong>{money(item.subtotalMinor ? item.subtotalMinor / 100 : item.price * item.quantity)}</strong></cf-list-item>)}</cf-list>
        <p>Subtotal: {money(order.subtotal)}</p>
        {Number(order.discountAmount) > 0 && <p>Desconto: −{money(order.discountAmount)}</p>}
        {Number(order.freightValue) > 0 && <p>Entrega: {money(order.freightValue)}</p>}
        <p className="text-lg font-black text-emerald-900">Total: {money(order.total)}</p>
        <p>Pedido feito por: <strong>{staffLabel(order.createdBy)}</strong></p>
        {order.receivedBy && <p>Recebido por: <strong>{staffLabel(order.receivedBy)}</strong></p>}
        <p>Status da comanda: <strong>{orderStatusLabel(order)}</strong></p>
        <p>Registrado em: {dateTime(order.createdAt)}</p>
        {order.paidAt && <p>Pago em: {dateTime(order.paidAt)}</p>}
        {order.deliveryAddress && <p>Entrega: {order.deliveryAddress}</p>}
        {order.notes && <p>Observação: {order.notes}</p>}
      </div>
    </Panel>;
  }
  function OrderCard({ order, canReceive, busy, onReceive, onDetails }) {
    const items = (order.items || []).slice(0, 2);
    const extraItems = Math.max(0, (order.items || []).length - items.length);
    return <cf-card padding="sm" className="cf-order-card">
      <button className="w-full text-left" onClick={() => onDetails(order)} aria-label={`Detalhes da comanda ${order.ticketNumber}`}>
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Comanda #{order.ticketNumber}</span>
          <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-900">{paymentLabel(order.paymentMethod)}</span>
        </div>
        <p className="mt-1 font-bold text-slate-800">{order.customerName || 'Cliente Balcão'}</p>
        <p title={(order.items || []).map((item) => item.name).join(' · ')} className="mt-1 text-xs leading-5 text-slate-600">{items.map((item) => `${item.quantity} × ${item.name}`).join(' · ')}{extraItems ? ` · +${extraItems} item(ns)` : ''}</p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <span className="text-[11px] text-slate-500">{dateTime(order.createdAt)}</span>
          <strong className="text-base text-[#0F381E]">{money(order.total)}</strong>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Pedido feito por: <strong>{staffLabel(order.createdBy)}</strong></p>
      </button>
      {canReceive && <button className={button + ' mt-3 w-full'} disabled={busy} onClick={() => onReceive(order)}>{busy ? 'Registrando…' : 'Receber no caixa'}</button>}
    </cf-card>;
  }
  function MetricCard({ label, value, description, tone = 'default' }) {
    return <cf-card padding="sm" className="cf-metric-card" tone={tone === 'debt' ? 'warning' : undefined}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-[#0F381E]">{value}</p>
      {description && <p className="mt-1 text-[10px] text-slate-500">{description}</p>}
    </cf-card>;
  }
  function CashierColumn({ title, hint, orders, tone, user, busy, onReceive, onDetails }) {
    const themes = {
      amber: 'border-amber-300 bg-amber-50 text-amber-950',
      blue: 'border-sky-300 bg-sky-50 text-sky-950',
      violet: 'border-violet-300 bg-violet-50 text-violet-950',
      green: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    };
    return <section className="min-w-[84vw] snap-start rounded-2xl border border-slate-200 bg-slate-100 p-3 md:min-w-0" aria-label={title}>
      <header className={`mb-3 rounded-xl border px-3 py-2 ${themes[tone]}`}>
        <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-black tracking-wide">{title}</h3><span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-extrabold">{orders.length}</span></div>
        <p className="mt-1 text-[10px] opacity-75">{hint}</p>
      </header>
      <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
        {orders.map((order) => <OrderCard key={order.id} order={order} canReceive={user.role !== 'VENDEDOR' && order.status === 'AWAITING_CASHIER'} busy={busy} onReceive={onReceive} onDetails={onDetails} />)}
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
    const [refreshing, setRefreshing] = useState(false);

    const refresh = async (silent = false) => {
      if (!silent) setRefreshing(true);
      setError('');
      try {
        const query = new URLSearchParams({ from: dateFrom, to: dateTo });
        setData(await api('/api/caixa/orders?' + query.toString()));
      } catch (err) { setError(err.message); }
      finally { if (!silent) setRefreshing(false); }
    };
    useEffect(() => {
      refresh();
      const timer = setInterval(() => refresh(true), 20000);
      return () => clearInterval(timer);
    }, [dateFrom, dateTo]);

    const setPeriod = (days) => {
      setDateTo(today);
      setDateFrom(days === 0 ? today : dateOffset(today, -(days - 1)));
    };
    const receive = async (order) => {
      if (!window.confirm(`Confirmar ${money(order.total)} em ${paymentLabel(order.paymentMethod)} na comanda #${order.ticketNumber}?`)) return;
      const receivedAmount = order.paymentMethod === 'DINHEIRO' ? window.prompt('Valor recebido em dinheiro (R$):', Number(order.total).toFixed(2)) : null;
      if (order.paymentMethod === 'DINHEIRO' && receivedAmount === null) return;
      setBusy(true);
      try {
        await api('/api/caixa/orders/' + order.id + '/confirm', { receivedAmount: receivedAmount === null ? null : Number(receivedAmount.replace(',', '.')) });
        await refresh(true);
      } catch (err) { setError(err.message); }
      finally { setBusy(false); }
    };

    const columns = data ? [
      { title: 'ESPERANDO CONFIRMAÇÃO', hint: 'Comandas aguardando recebimento no caixa', orders: data.pendingConfirmation, tone: 'amber' },
      { title: 'ESPERANDO PAGAMENTO', hint: 'Pix aguardando confirmação do Sicredi', orders: data.pendingPayment, tone: 'blue' },
      { title: 'CONFIRMADOS', hint: 'Fiados registrados, aguardando quitação', orders: data.confirmed, tone: 'violet' },
      { title: 'PAGOS / FINALIZADOS', hint: 'Pagamentos recebidos e pedidos concluídos', orders: data.paid, tone: 'green' },
    ] : [];
    const title = view === 'orders' ? 'Comandas' : view === 'history' ? 'Histórico de vendas' : 'Relatório';
    const reportOrders = data ? data.history.filter((order) => user.role === 'ADMIN'
      || (user.role === 'VENDEDOR' ? order.createdBy?.id === user.id : order.receivedBy?.id === user.id)) : [];
    const reportPaidOrders = reportOrders.filter((order) => order.paymentStatus === 'APPROVED' && (order.paidAt || order.completedAt));
    const reportSalesTotal = reportPaidOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const reportDebtTotal = (data?.debtHistory || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const reportPaymentTotals = Object.fromEntries(['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'].map((method) => [method,
      reportPaidOrders.filter((order) => order.paymentMethod === method).reduce((sum, order) => sum + Number(order.total || 0), 0),
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
          <div className="flex items-center gap-2"><h1 className="mr-2 text-lg font-black text-[#0F381E]">{title}</h1>{view === 'report' && user.role !== 'VENDEDOR' && <button className={button} onClick={onDebt}>Receber dívida</button>}<button className={button} disabled={refreshing} onClick={() => refresh()} aria-label="Atualizar">{refreshing ? 'Atualizando…' : '↻ Atualizar'}</button></div>
        </div>
        </header>

      <div className="shrink-0 border-b border-slate-200 bg-white/80 px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-end gap-2">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
              {[{ days: 0, label: 'Hoje' }, { days: 7, label: '7 dias' }, { days: 30, label: '30 dias' }].map((option) => <button key={option.days} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white" onClick={() => setPeriod(option.days)}>{option.label}</button>)}
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
              <div className="flex snap-x gap-3 overflow-x-auto pb-3 md:grid md:grid-cols-2 xl:grid-cols-4 md:overflow-visible">
                {columns.map((column) => <CashierColumn key={column.title} {...column} user={user} busy={busy} onReceive={receive} onDetails={setSelectedOrder} />)}
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
                <MetricCard label="Recebido em vendas" value={money(reportSalesTotal)} description={`${reportPaidOrders.length} venda(s) pagas`} />
                <MetricCard label="Quitações de fiado" value={money(reportDebtTotal)} description={`${data.debtHistory.length} recebimento(s)`} />
                <MetricCard label="Total recebido" value={money(reportSalesTotal + reportDebtTotal)} description="Vendas pagas + dívidas quitadas" />
                <MetricCard label="Fiado lançado" value={money(data.closing.confirmedDebt)} description="Não incluído no total recebido" tone="debt" />
                <MetricCard label="Quantidade de vendas" value={String(reportOrders.length)} />
                <MetricCard label="Ticket médio" value={money(reportOrders.length ? reportOrders.reduce((sum, order) => sum + Number(order.total || 0), 0) / reportOrders.length : 0)} />
                {['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'].map((method) => <MetricCard key={method} label={paymentLabel(method)} value={money(reportPaymentTotals[method])} />)}
              </div>
              <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <h4 className="border-b border-slate-200 bg-slate-100 px-4 py-3 font-bold text-slate-700">Conferência por forma de pagamento</h4>
                <div className="divide-y divide-slate-100">{['PIX', 'DINHEIRO', 'CREDITO', 'DEBITO'].map((method) => <div key={method} className="grid grid-cols-2 items-center gap-2 px-4 py-3 text-xs sm:grid-cols-[1fr_auto_auto_auto] sm:gap-3"><strong>{paymentLabel(method)}</strong><span className="text-right font-bold text-[#0F381E] sm:order-last">{money(reportPaymentTotals[method])}</span><span className="text-slate-500">Vendas confirmadas</span><span className="text-right text-slate-500 sm:text-left">Fiado quitado {money(data.closing.byPayment[method]?.debt || 0)}</span></div>)}</div>
              </section>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {[{ title: '5 mais vendidos em quantidade', rows: mostByQuantity }, { title: '5 maiores vendas em valor', rows: mostByValue }].map((group) => <section key={group.title} className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="mb-3 font-bold text-[#0F381E]">{group.title}</h4>{group.rows.length ? <ol className="space-y-2">{group.rows.map((product, index) => <li key={product.name} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 text-sm"><span title={product.name}>{index + 1}. {product.name} <small className="text-slate-500">({product.quantity} un.)</small></span><strong>{money(product.total)}</strong></li>)}</ol> : <p className="text-sm text-slate-500">Sem itens vendidos no período.</p>}</section>)}
              </div>
              <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-950">{user.role === 'ADMIN' ? 'Visão consolidada de todos os colaboradores.' : `Dados vinculados a ${staffLabel({ name: user.name, email: user.email })}.`}</p>
            </>}
          </>}
      </main>
      {selectedOrder && <OrderDetails order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>;
  }
  function DebtSettlement({ onClose }) {
    const [query, setQuery] = useState(''); const [customers, setCustomers] = useState([]); const [customer, setCustomer] = useState(null);
    const [balance, setBalance] = useState(0); const [amount, setAmount] = useState(''); const [method, setMethod] = useState('DINHEIRO'); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [result, setResult] = useState(null); const [id] = useState(() => crypto.randomUUID());
    useEffect(() => { let active = true; const timer = setTimeout(() => api('/api/caixa/customers?q=' + encodeURIComponent(query)).then((rows) => { if (active) setCustomers(rows); }).catch((err) => { if (active) setError(err.message); }), 250); return () => { active = false; clearTimeout(timer); }; }, [query]);
    const select = async (row) => { try { const debt = await api('/api/caixa/customers/' + encodeURIComponent(row.id) + '/debts'); setCustomer(row); setBalance(debt.balance); } catch (err) { setError(err.message); } };
    const submit = async () => {
      setBusy(true); setError('');
      try { setResult(await api('/api/caixa/debts/settle', { requestId: id, customerKey: customer.id, amount: Number(amount), paymentMethod: method })); } catch (err) { setError(err.message); } finally { setBusy(false); }
    };
    return <Panel title="Receber dívida de fiado" onClose={onClose}>{error && <p role="alert" className="text-red-700">{error}</p>}{result ? <div><p>Recebimento registrado: {money(result.amount)}</p><p>Saldo restante: {money(result.newBalance)}</p></div> : <><label>Buscar cliente<input className={field} value={query} onChange={(e) => setQuery(e.target.value)} /></label><div className="max-h-36 overflow-auto">{customers.map((row) => <button className="block w-full text-left border-b p-2" key={row.id} onClick={() => select(row)}>{row.name} · {row.phone || 'Sem telefone'}</button>)}</div>{customer && <><p className="mt-3 font-bold">{customer.name} · Dívida: {money(balance)}</p><label>Valor a receber<input className={field} type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label><select className={field} value={method} onChange={(e) => setMethod(e.target.value)}><option value="DINHEIRO">Dinheiro</option><option value="DEBITO">Cartão de débito</option><option value="CREDITO">Cartão de crédito</option></select><button className={button} disabled={busy || Number(amount) <= 0 || Number(amount) > balance} onClick={submit}>{busy ? 'Registrando…' : 'Confirmar recebimento'}</button></>}</>}</Panel>;
  }
  return { SiteBrand, Loading, Login, Receipt, CashierQueue, DebtSettlement, DiscountApproval, ProductInformation, handleProductImageError };
})();
