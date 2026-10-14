const config = require('../src/config/env');

async function main() {
  if (config.appEnvironment !== 'dev' || config.gcp.projectId !== 'confloraai-dev' ||
      config.firebase.projectId !== 'confloraai-dev' || process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Execute somente com .env.dev e Firestore do confloraai-dev.');
  }
  const { Firestore } = require('@google-cloud/firestore');
  const db = new Firestore({ projectId: 'confloraai-dev', ...(config.gcp.keyFilename ? { keyFilename: config.gcp.keyFilename } : {}) });
  try {
    const product = db.collection('products').doc('dev-pix-1-real');
    const inventory = db.collection('store_settings').doc('inventory');
    await db.runTransaction(async (tx) => {
      const productSnapshot = await tx.get(product);
      const settingsSnapshot = await tx.get(inventory);
      if (!productSnapshot.exists) {
        tx.create(product, { id: product.id, name: 'TESTE DEV - Pix R$ 1,00', price: 1,
          stockQuantity: 10, status: 'ATIVO', category: 'TESTES', unit: 'UN',
          images: [], createdAt: new Date().toISOString() });
      }
      if (!settingsSnapshot.exists) {tx.create(inventory, { stockControlEnabled: true });}
    });
    console.log('Produto dev-pix-1-real pronto. Dados existentes e saldos não foram sobrescritos.');
  } finally { await db.terminate(); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
