const { randomUUID } = require('node:crypto');
const { createSicrediSandboxDatabase } = require('./sicredi-sandbox.database');
const { SicrediPixClient } = require('./sicredi-pix.client');
const { FirestoreRepository } = require('../database/firestore.repository');
const { PdvRepository } = require('../orders/pdv.repository');
const { PdvService } = require('../orders/pdv.service');

/** Exercises real charge/verification/settlement code against disposable, isolated transports. */
async function simulateSicrediPayment({ unitPrice = 45, quantity = 2 } = {}) {
  if (!Number.isFinite(unitPrice) || unitPrice <= 0 || unitPrice > 10000 || Math.abs(Math.round(unitPrice * 100) - unitPrice * 100) > 0.000001 ||
      !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw Object.assign(new Error('Informe preço positivo e quantidade de 1 a 100.'), { status: 400 });
  const product = { id: 'simulation-product', name: 'SIMULAÇÃO SICREDI', price: unitPrice, quantity, unit: 'UN',
    stockQuantity: quantity + 8, reservedQuantity: 0, status: 'ATIVO' };
  const database = createSicrediSandboxDatabase({ 'products/simulation-product': product, 'store_settings/inventory': { stockControlEnabled: true } });
  const repository = new FirestoreRepository({ firestoreInstance: database });
  const store = new PdvRepository(repository);
  const calls = [];
  let charge;
  const pix = new SicrediPixClient({ baseUrl: 'https://simulation.invalid/api/v2', authUrl: 'https://simulation.invalid/oauth/token',
    clientId: 'SIMULATION', clientSecret: 'SIMULATION', certificate: 'SIMULATION', privateKey: 'SIMULATION', pixKey: 'SIMULATION',
    request: async (url, options) => {
      const body = options.headers?.['Content-Type'] === 'application/json' ? JSON.parse(options.body || '{}') : null;
      calls.push({ method: options.method, path: new URL(url).pathname });
      if (url.endsWith('/oauth/token')) return { access_token: 'SIMULATION', expires_in: 3600 };
      if (options.method === 'PUT' && url.includes('/cob/')) {
        charge = { ...body, txid: url.split('/cob/')[1], status: 'ATIVA', pixCopiaECola: 'SIMULACAO SICREDI - SEM VALOR FINANCEIRO' };
        return charge;
      }
      if (options.method === 'GET' && url.includes('/pix/')) return { endToEndId: url.split('/pix/')[1], txid: charge.txid,
        valor: charge.valor.original, chave: 'SIMULATION', devolucoes: [] };
      throw new Error('Operação fora do transporte isolado.');
    } });
  const service = new PdvService({ repository: store, pix });
  service.deliver = async () => ({ skipped: true, reason: 'ISOLATED_SIMULATION' });
  const id = randomUUID();
  const amount = Math.round(unitPrice * quantity * 100) / 100;
  const order = await repository.createDirectOrder({ id, source: 'WEB_CATALOG', orderType: 'PICKUP',
    items: [{ productId: product.id, name: product.name, price: unitPrice, quantity, unit: 'UN' }],
    subtotal: amount, total: amount, status: 'CREATING_PIX', paymentStatus: 'PENDING', paymentMethod: 'PIX', pixMode: 'SICREDI',
    pixData: { txid: pix.generateTxId(), provider: 'SICREDI' }, pixProvider: 'SICREDI' }, { reserveInventory: true });
  const pending = await service.preparePix(order);
  const reserved = await repository.getProductById(product.id);
  const endToEndId = 'E' + '9'.repeat(31);
  await store.transaction(tx => tx.set('pdv_pix_events', `${pending.pixData.txid}-${endToEndId}`,
    { txid: pending.pixData.txid, endToEndId, status: 'PENDING' }));
  await service.processPixEvent(pending.pixData.txid, endToEndId);
  const paid = await repository.getOrderById(id);
  const settled = await repository.getProductById(product.id);
  await service.processPixEvent(pending.pixData.txid, endToEndId);
  const repeated = await repository.getProductById(product.id);
  return { success: paid.paymentStatus === 'APPROVED' && repeated.stockQuantity === settled.stockQuantity, isolatedSandbox: true,
    message: 'Simulação isolada. Nenhum pagamento ou registro real foi criado.', steps: {
      step1_qrCodeGeneration: { lockedAmount: amount, modalidadeAlteracao: charge.valor.modalidadeAlteracao,
        hasQrCodeBase64: Boolean(pending.pixData.qrCodeBase64), statusBeforeWebhook: pending.status, stockBeforeWebhook: reserved },
      step2_webhookReception: { bankCheckPerformed: calls.some(call => call.path.includes('/pix/')), eventStatus: (await store.read('pdv_pix_events', `${pending.pixData.txid}-${endToEndId}`))?.status },
      step3_firebaseUpdate: { statusAfterWebhook: paid.status, paymentStatusAfterWebhook: paid.paymentStatus, verifiedVia: paid.verifiedVia,
        stockAfterWebhook: settled, duplicateIsIdempotent: repeated.stockQuantity === settled.stockQuantity },
    } };
}

module.exports = { simulateSicrediPayment };
