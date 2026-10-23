const { money } = require('./receipt.util');
const businessDate = (value = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(value));
const conflict = message => Object.assign(new Error(message), { status: 409 });
const round = value => Math.round(value * 100) / 100;
const fields = { DINHEIRO: 'cash', PIX: 'pix', CREDITO: 'credit', DEBITO: 'debit' };
function amount(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0 || !Number.isSafeInteger(Math.round(Number(value) * 100))) throw new Error('Informe um valor monetário válido, maior ou igual a zero.');
  return round(Number(value));
}
async function activeSession(tx, user, sessionId) {
  if (!['ADMIN', 'CAIXA'].includes(user?.role)) return null;
  const pointer = await tx.get('cashier_active', user.id);
  const session = sessionId ? await tx.get('cashier_sessions', sessionId) : pointer?.sessionId ? await tx.get('cashier_sessions', pointer.sessionId) : null;
  if (!session && user.role === 'ADMIN') return null;
  if (!session || session.status !== 'OPEN' || session.userId !== user.id) throw conflict('Abra seu caixa e informe o troco do dia antes de receber valores.');
  return session;
}
// Read during the read phase of the money transaction; apply only after all reads.
function recordReceipt(tx, session, parts) {
  if (!session) return;
  const receipts = { ...session.receipts };
  for (const part of parts) if (fields[part.method]) receipts[fields[part.method]] = round(receipts[fields[part.method]] + part.amount);
  tx.set('cashier_sessions', session.id, { ...session, receipts });
}
function expected(session) {
  const receipts = session?.receipts || { cash: 0, pix: 0, debit: 0, credit: 0 };
  const openingFloat = session?.openingFloat || 0;
  const receiptsTotal = round(Object.values(receipts).reduce((sum, n) => sum + n, 0));
  return { ...receipts, openingFloat, cashReceipts: receipts.cash, cash: round(openingFloat + receipts.cash), receiptsTotal, total: round(receiptsTotal + openingFloat) };
}
async function open(store, user, input) {
  const openingFloat = amount(input.openingFloat);
  if (!/^[a-f0-9-]{36}$/i.test(input.requestId || '')) throw new Error('Identificador da abertura inválido.');
  const id = input.requestId;
  return store.transaction(async tx => {
    const previous = await tx.get('cashier_sessions', id);
    if (previous) {
      if (previous.userId !== user.id || previous.openingFloat !== openingFloat) throw conflict('Identificador de abertura já utilizado.');
      return previous;
    }
    const pointer = await tx.get('cashier_active', user.id);
    if (pointer?.sessionId) throw conflict('Feche o caixa anterior antes de abrir outro.');
    const date = businessDate();
    const day = await tx.get('cashier_days', date) || { id: date, sessions: {}, revision: 0 };
    const session = { id, userId: user.id, userName: user.name || user.email, userRole: user.role, date, openedAt: new Date().toISOString(), status: 'OPEN', openingFloat, receipts: { cash: 0, pix: 0, debit: 0, credit: 0 }, pendingOrders: [] };
    tx.set('cashier_sessions', id, session);
    tx.set('cashier_active', user.id, { sessionId: id });
    tx.set('cashier_days', date, { ...day, revision: day.revision + 1, sessions: { ...day.sessions, [id]: { id, userId: user.id, name: session.userName, role: user.role, closed: false } } });
    return session;
  });
}
async function status(store, user) {
  const pointer = await store.read('cashier_active', user.id);
  const mySession = pointer?.sessionId ? await store.read('cashier_sessions', pointer.sessionId) : null;
  const date = mySession?.date || businessDate();
  const day = await store.read('cashier_days', date);
  const activeOperators = Object.values(day?.sessions || {}).map(({ id, userId, name, role, closed, closedAt }) => ({ id, userId, name, role, closed, closedAt: closedAt || null }));
  const mine = activeOperators.filter(s => s.userId === user.id && s.closed).sort((a, b) => a.closedAt.localeCompare(b.closedAt)).at(-1);
  const myClosing = !mySession && mine ? await store.read('cashier_closings', mine.id) : null;
  return { date, mySession, myClosing, myExpected: expected(mySession || myClosing), activeOperators, allClosed: activeOperators.length > 0 && activeOperators.every(s => s.closed) };
}
async function close(store, user, input) {
  if (!/^[a-f0-9-]{36}$/i.test(input.sessionId || '')) throw conflict('Atualize a página e selecione o caixa aberto.');
  const counted = Object.fromEntries(Object.values(fields).map(key => [key, amount(input.counted?.[key])]));
  counted.total = round(Object.values(counted).reduce((sum, n) => sum + n, 0));
  return store.transaction(async tx => {
    const session = await activeSession(tx, user, input.sessionId);
    if (!session) throw conflict('Abra seu caixa antes de fechar.');
    if (input.date && input.date !== session.date) throw conflict('A data não corresponde à abertura deste caixa.');
    const day = await tx.get('cashier_days', session.date);
    for (const id of session.pendingOrders || []) {
      const order = await tx.get('orders', id);
      if (order && !order.completedAt && order.status !== 'CANCELLED') throw conflict('Conclua ou cancele as cobranças Pix pendentes deste caixa antes de fechar.');
      if (order?.status === 'CANCELLED' && order.paymentParts?.some(p => p.status === 'RECEIVED_AT_CASHIER')) throw conflict('Existe pagamento misto cancelado com valores recebidos. Concilie esse recebimento antes de fechar.');
    }
    const proof = input.proofId ? await tx.get('payment_proofs', input.proofId) : null;
    if (input.proofId && (!proof || proof.uploadedBy !== user.id || proof.targetType !== 'CLOSING' || proof.targetId !== session.id)) throw new Error('Comprovante inválido para este caixa.');
    if ((session.receipts.credit > 0 || session.receipts.debit > 0) && !proof) throw new Error('Anexe o comprovante de fechamento da maquininha.');
    const totals = expected(session);
    const differences = Object.fromEntries([...Object.values(fields), 'total'].map(key => [key, round(counted[key] - totals[key])]));
    const notes = String(input.notes || '').trim().slice(0, 500);
    if (Object.values(differences).some(n => n !== 0) && !notes) throw new Error('Explique a diferença encontrada na conferência.');
    const closing = { ...session, status: 'CLOSED', closedAt: new Date().toISOString(), expected: totals, counted, differences, notes, proofId: input.proofId || null };
    const sessions = { ...day.sessions, [session.id]: { ...day.sessions[session.id], closed: true, closedAt: closing.closedAt, openingFloat: session.openingFloat, expected: totals, counted, differences } };
    const allClosed = Object.values(sessions).every(s => s.closed);
    const revision = day.revision + 1;
    const jobId = allClosed ? `closing-summary-${session.date}-${revision}` : null;
    tx.set('cashier_sessions', session.id, closing);
    tx.set('cashier_closings', session.id, closing);
    tx.set('cashier_active', user.id, { sessionId: null });
    tx.set('cashier_days', session.date, { ...day, sessions, revision });
    if (jobId) {
      const rows = Object.values(sessions);
      const sum = fn => round(rows.reduce((n, row) => n + fn(row), 0));
      const text = `📊 *CONFLORA — FECHAMENTO GERAL DE TODOS OS CAIXAS*\nData: ${session.date} · revisão ${revision}\nTodos os caixas abertos nesta data estão fechados.\n\n${rows.map(row => `👤 ${row.name} · Caixa ${row.id.slice(0, 8)}\nTroco do dia: ${money(row.openingFloat)}\nRecebimentos em dinheiro: ${money(row.expected.cashReceipts)}\nTotal em dinheiro esperado (troco + recebimentos): ${money(row.expected.cash)}\nDinheiro contado: ${money(row.counted.cash)}\nDiferença em dinheiro: ${money(row.differences.cash)}`).join('\n\n')}\n\nTroco total das aberturas: ${money(sum(r => r.openingFloat))}\nRecebimentos em dinheiro: ${money(sum(r => r.expected.cashReceipts))}\nTotal em dinheiro esperado: ${money(sum(r => r.expected.cash))}\nTotal Conferido em Caixa — dinheiro: ${money(sum(r => r.counted.cash))}\nPix: ${money(sum(r => r.counted.pix))}\nDébito: ${money(sum(r => r.counted.debit))}\nCrédito: ${money(sum(r => r.counted.credit))}\nDiferença geral: ${money(sum(r => r.differences.total))}\nTroco é fundo de caixa, não faturamento. Se houver nova abertura, será enviado um resumo atualizado após o fechamento.`;
      tx.set('pdv_outbox', jobId, { id: jobId, kind: 'closing', recipient: process.env.JUNIOR_WHATSAPP_NUMBER || process.env.OWNER_WHATSAPP_NUMBER || '', text, status: 'PENDING', attempts: 0, createdAt: closing.closedAt });
    }
    return { success: true, closing, allClosed, jobId, whatsappQueued: Boolean(jobId) };
  });
}
module.exports = { open, close, status, activeSession, recordReceipt, expected, businessDate };
