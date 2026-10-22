const { createHash } = require('node:crypto');
const { formatDailyExecutiveReport } = require('../reports/daily-executive-report');
const methods = ['DINHEIRO', 'PIX', 'CREDITO', 'DEBITO'];
const closingId = (date, userId) => date + '-' + createHash('sha256').update(String(userId)).digest('hex').slice(0, 24);
class CashierClosingService {
  constructor({ store, repository, snapshot, proofStorage }) { Object.assign(this, { store, repository, snapshot, proofStorage }); }
  async overview(user, date) {
    const users = await this.repository.getAllUsers();
    const general = await this.snapshot({ ...user, role: 'ADMIN' }, { from: date, to: date });
    const receiverIds = new Set([...general.cashierOrders.map(o => require('./delivery-policy').financialReceiver(o)?.id), ...general.cashierSettlements.map(o => o.receivedBy?.id)].filter(Boolean));
    const participants = users.filter(u => (u.active !== false && u.role === 'CAIXA') || receiverIds.has(u.id));
    if (!participants.length) participants.push(user);
    const cashiers = await Promise.all(participants.map(async u => {
      const expected = Object.fromEntries(methods.map(m => [m, 0]));
      const receipts = [...general.cashierOrders.filter(o => require('./delivery-policy').financialReceiver(o)?.id === u.id), ...general.cashierSettlements.filter(o => o.receivedBy?.id === u.id)];
      for (const receipt of receipts) for (const part of receipt.paymentParts || [{method:receipt.paymentMethod,amount:receipt.total ?? receipt.amount}]) {
        if (methods.includes(part.method)) expected[part.method] += Number(part.amount || 0);
      }
      for (const method of methods) expected[method] = Math.round(expected[method] * 100) / 100;
      const pendingReceipts = ['pendingPayment','pendingConfirmation','awaitingDriver','outForDelivery','history'].flatMap(key => general[key] || []).some(o => !o.completedAt && o.status !== 'CANCELLED' && (o.paymentParts || []).some(part => part.status === 'RECEIVED_AT_CASHIER' && part.receivedBy?.id === u.id));
      const closing = await this.store.read('cashier_daily_closings', closingId(date, u.id));
      return { id: u.id, name: u.name || u.email, expected, closing, pendingReceipts };
    }));
    return { date, cashiers: user.role === 'ADMIN' ? cashiers : cashiers.filter(c => c.id === user.id), allCashierIds: cashiers.map(c => c.id) };
  }
  async close(user, { date, cashierId = user.id, counted, expected, proofDataUrl }) {
    if (user.role !== 'ADMIN' && cashierId !== user.id) throw new Error('Você só pode fechar seu próprio caixa.');
    if (!counted || methods.some(m => typeof counted[m] !== 'number' || !Number.isFinite(counted[m]) || counted[m] < 0)) throw new Error('Informe os quatro valores conferidos, incluindo zero.');
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(proofDataUrl || '')) throw new Error('Anexe a foto do relatório diário da maquininha.');
    const revision = await this.store.read('cashier_day_revisions', date);
    const overview = await this.overview({ ...user, role: 'ADMIN' }, date);
    const cashier = overview.cashiers.find(c => c.id === cashierId);
    if (!cashier) throw new Error('Caixa não encontrado.');
    if (cashier.pendingReceipts) throw new Error('Finalize ou concilie os pagamentos parciais pendentes antes de fechar este caixa.');
    if (expected && methods.some(m => Math.round(Number(expected[m])*100) !== Math.round(cashier.expected[m]*100))) throw new Error('Os valores mudaram. Reabra o fechamento e confira novamente.');
    if (cashier.closing) return { closing: cashier.closing, alreadyClosed: true };
    const proof = await this.proofStorage.save(proofDataUrl);
    const metrics = await this.repository.getDailyExecutiveMetrics({ date });
    const id = closingId(date, cashierId);
    return this.store.transaction(async tx => {
      const currentRevision = await tx.get('cashier_day_revisions', date);
      if ((currentRevision?.version || 0) !== (revision?.version || 0)) throw new Error('Houve novos recebimentos. Atualize e confira os valores novamente.');
      const ids = overview.allCashierIds.map(uid => closingId(date, uid));
      const previous = await Promise.all(ids.map(cid => tx.get('cashier_daily_closings', cid)));
      const saved = previous[ids.indexOf(id)];
      if (saved) return { closing: saved, alreadyClosed: true };
      const jobId = 'cashier-day-' + date + '-owner';
      const job = await tx.get('pdv_outbox', jobId);
      const closing = { id, date, cashierId, cashierName: cashier.name, closedBy: user.id, closedAt: new Date().toISOString(), expected: cashier.expected, counted, differences: Object.fromEntries(methods.map(m => [m, Math.round((counted[m] - cashier.expected[m])*100)/100])), proof, status: 'CLOSED' };
      tx.set('cashier_daily_closings', id, closing);
      const allClosed = previous.every((value, index) => Boolean(value) || ids[index] === id);
      const conference = previous.map((value,index) => ids[index] === id ? closing : value).filter(Boolean).map(c => c.cashierName + ': conferido R$ ' + methods.reduce((sum,m) => sum+c.counted[m],0).toFixed(2) + ' · diferença R$ ' + methods.reduce((sum,m) => sum+c.differences[m],0).toFixed(2)).join('\n');
      if (allClosed && !job) tx.set('pdv_outbox', jobId, { id: jobId, kind: 'closing', status: 'PENDING', attempts: 0, text: formatDailyExecutiveReport(metrics).join('\n\n') + '\n\nCONFERÊNCIA DOS CAIXAS\n' + conference });
      return { closing, allClosed, whatsappQueued: allClosed, jobId: allClosed ? jobId : null };
    });
  }
}
module.exports = { CashierClosingService, closingId };
