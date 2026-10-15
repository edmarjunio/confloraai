/* Shared PDV components loaded before the sales screen. */
window.PdvComponents = (() => {
  const { useState, useEffect } = React;
  const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const button = 'px-4 py-2 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-50';
  const field = 'w-full p-3 border rounded-xl my-2';
  async function api(path, body) {
    const response = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    const data = await response.json();
    if (!response.ok) { throw new Error(data.error || 'Não foi possível concluir a operação.'); }
    return data;
  }
  function Panel({ title, onClose, children }) {
    return <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-3xl p-6 w-full max-w-xl max-h-[90vh] overflow-auto"><div className="flex justify-between gap-4 mb-4"><h2 className="font-bold text-xl">{title}</h2><button onClick={onClose} aria-label="Fechar">✕</button></div>{children}</section></div>;
  }
  function Login({ onLogin }) {
    const [users, setUsers] = useState([]); const [userId, setUserId] = useState(''); const [pin, setPin] = useState(''); const [error, setError] = useState('');
    useEffect(() => { api('/api/admin/auth/users').then(setUsers).catch((err) => setError(err.message)); }, []);
    const submit = async (event) => {
      event.preventDefault();
      try { const result = await api('/api/admin/auth/login', { userId, pin }); onLogin(result.user); } catch (err) { setError(err.message); }
    };
    return <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6"><form onSubmit={submit} className="bg-white p-8 rounded-3xl shadow max-w-sm w-full"><h1 className="font-bold text-2xl">Conflora · PDV</h1><p className="my-2">Entre com sua conta de colaborador.</p><label>Usuário<select required className={field} value={userId} onChange={(e) => setUserId(e.target.value)}><option value="">Selecione</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><label>PIN<input required type="password" className={field} value={pin} onChange={(e) => setPin(e.target.value)} /></label>{error && <p role="alert" className="text-red-700 mb-3">{error}</p>}<button className={button}>Entrar</button></form></main>;
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
      <p className="my-2 font-semibold">{current.status === 'AWAITING_PIX' ? 'Aguardando pagamento Pix' : current.status === 'AWAITING_CASHIER' ? 'Encaminhe esta comanda ao caixa' : current.paymentStatus === 'ON_ACCOUNT' ? 'Saldo lançado na conta do cliente' : 'Pagamento confirmado'}</p>
      <ul className="divide-y">{current.items.map((item, index) => <li className="py-2 flex justify-between gap-3" key={index}><span>{item.quantity} {item.unit} · {item.name}</span><span>{money(item.subtotalMinor / 100)}</span></li>)}</ul>
      <p className="mt-3">Subtotal: {money(current.subtotal)}</p><p>Desconto: {money(current.discountAmount)}</p><p>Frete: {money(current.freightValue)}</p><p className="text-xl font-bold my-3">Total: {money(current.total)}</p>
      <p>Pedido feito por: <strong>{current.createdBy.name}</strong></p><p>Recebido por: <strong>{current.receivedBy?.name || 'Aguardando recebimento'}</strong></p>
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
  function CashierQueue({ user, onClose }) {
    const [data, setData] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
    const refresh = () => api('/api/caixa/orders').then(setData).catch((err) => setError(err.message));
    useEffect(() => { refresh(); }, []);
    const receive = async (order) => {
      if (!window.confirm(`Confirmar ${money(order.total)} em ${order.paymentMethod} na comanda #${order.ticketNumber}?`)) { return; }
      const receivedAmount = order.paymentMethod === 'DINHEIRO' ? window.prompt('Valor recebido em dinheiro (R$):', order.total.toFixed(2)) : null;
      if (order.paymentMethod === 'DINHEIRO' && receivedAmount === null) return;
      setBusy(true);
      try { await api('/api/caixa/orders/' + order.id + '/confirm', { receivedAmount: receivedAmount === null ? null : Number(receivedAmount.replace(',', '.')) }); await refresh(); } catch (err) { setError(err.message); } finally { setBusy(false); }
    };
    return <Panel title="Comandas e meus números" onClose={onClose}>{error && <p role="alert" className="text-red-700">{error}</p>}{data && <><div className="bg-emerald-50 rounded-xl p-3 mb-4"><p>Minhas vendas: {money(data.metrics.sales)}</p><p>Recebido por mim: {money(data.metrics.receipts)}</p><p>Dívidas recebidas por mim: {money(data.metrics.debtReceipts)}</p></div><h3 className="font-bold">Aguardando caixa</h3>{!data.pendingCashier.length && <p>Nenhuma comanda pendente.</p>}{data.pendingCashier.map((order) => <article className="border rounded-xl p-3 my-2" key={order.id}><strong>#{order.ticketNumber} · {order.customerName}</strong><p>{order.items.map((item) => `${item.quantity} × ${item.name}`).join(', ')}</p><p>{money(order.total)} · {order.paymentMethod}</p><p>Pedido feito por: {order.createdBy.name}</p>{user.role !== 'VENDEDOR' && <button className={button + ' mt-2'} disabled={busy} onClick={() => receive(order)}>Receber no meu caixa</button>}</article>)}<h3 className="font-bold mt-4">Pix pendentes</h3>{data.pendingPix.map((order) => <p key={order.id}>#{order.ticketNumber} · {order.customerName} · {money(order.total)}</p>)}</>}</Panel>;
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
    return <Panel title="Receber dívida de fiado" onClose={onClose}>{error && <p role="alert" className="text-red-700">{error}</p>}{result ? <div><p>Recebimento registrado: {money(result.amount)}</p><p>Saldo restante: {money(result.newBalance)}</p><p>Recebido por: {result.receivedBy.name}</p></div> : <><label>Buscar cliente<input className={field} value={query} onChange={(e) => setQuery(e.target.value)} /></label><div className="max-h-36 overflow-auto">{customers.map((row) => <button className="block w-full text-left border-b p-2" key={row.id} onClick={() => select(row)}>{row.name} · {row.phone || 'Sem telefone'}</button>)}</div>{customer && <><p className="mt-3 font-bold">{customer.name} · Dívida: {money(balance)}</p><label>Valor a receber<input className={field} type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label><select className={field} value={method} onChange={(e) => setMethod(e.target.value)}><option value="DINHEIRO">Dinheiro</option><option value="DEBITO">Cartão de débito</option><option value="CREDITO">Cartão de crédito</option></select><button className={button} disabled={busy || Number(amount) <= 0 || Number(amount) > balance} onClick={submit}>{busy ? 'Registrando…' : 'Confirmar recebimento'}</button></>}</>}</Panel>;
  }
  return { Login, Receipt, CashierQueue, DebtSettlement, DiscountApproval };
})();
