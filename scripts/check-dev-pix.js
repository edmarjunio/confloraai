// Somente leitura. Não cria cobrança, não confirma pedido e não envia mensagens.
const config = require('../src/config/env');
const { MercadoPagoClient, isApprovedPixPayment } = require('../src/integrations/mercado-pago.client');

async function main() {
  if (config.appEnvironment !== 'dev' || config.firebase.projectId !== 'confloraai-dev' ||
      config.mercadoPago.expectedLiveMode !== true || process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Diagnóstico exige .env.dev, confloraai-dev e MERCADO_PAGO_EXPECT_LIVE_MODE=true.');
  }
  const client = new MercadoPagoClient({ accessToken: config.mercadoPago.accessToken,
    webhookSecret: config.mercadoPago.webhookSecret });
  if (!client.checkoutConfigured) throw new Error('Preencha os dois segredos Mercado Pago no ambiente dev.');
  const response = await fetch(new URL('/health', config.tasks.serviceUrl), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Dev indisponível: HTTP ${response.status}.`);
  const health = await response.json();
  if (health.environment !== 'dev' || health.projectId !== 'confloraai-dev' || health.expectedLiveMode !== true) {
    throw new Error('A URL consultada não corresponde ao dev com Pix real.');
  }
  console.log('OK: URL publicada pertence ao dev e exige Pix real.');
  const [orderId, paymentId] = process.argv.slice(2);
  if (!orderId || !/^\d+$/.test(paymentId || '')) {
    throw new Error('Informe ID_DO_PEDIDO ID_DO_PAGAMENTO para verificar API e Firestore. Nenhum pagamento foi consultado.');
  }
  const { Firestore } = require('@google-cloud/firestore');
  const db = new Firestore({ projectId: 'confloraai-dev', ...(config.gcp.keyFilename ? { keyFilename: config.gcp.keyFilename } : {}) });
  try {
    const snapshot = await db.collection('orders').doc(orderId).get();
    if (!snapshot.exists) throw new Error('Pedido não encontrado no Firestore dev.');
    const order = { ...snapshot.data(), id: snapshot.id };
    const payment = await client.getPayment(paymentId);
    if (!isApprovedPixPayment(payment, order, { expectedLiveMode: true })) {
      throw new Error('API não confirmou Pix real aprovado com valor e referência correspondentes.');
    }
    if (!['CONFIRMED', 'DELIVERED', 'PAID_CONFIRMED'].includes(order.status) || order.paymentStatus !== 'APPROVED' ||
        order.paymentTransactionId !== String(payment.id) || order.stockDeducted !== true) {
      throw new Error('Pix aprovado na API, mas confirmação/baixa ainda não foi concluída no Firestore dev.');
    }
    console.log('OK: Pix real aprovado pela API e registrado com confirmação/baixa no Firestore dev.');
    console.log('A baixa única deve ser conferida pelo saldo e movimento após reenvio do webhook.');
  } finally { await db.terminate(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
