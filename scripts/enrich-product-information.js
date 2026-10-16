const { FirestoreRepository } = require('../src/database/firestore.repository');
const config = require('../src/config/env');
const { getMissingProductInformation } = require('../src/catalog/product-information');

async function main() {
  const applyChanges = process.argv.includes('--apply');
  const repository = new FirestoreRepository();
  const firestore = repository.firestore;
  if (!firestore || repository.isInMemory) {
    throw new Error('Firestore real indisponível; nenhum produto foi alterado.');
  }

  const projectId = config.firebase?.projectId || config.gcp?.projectId || 'confloraai';
  if (projectId === 'confloraai-dev' && process.env.ALLOW_DEV_PRODUCT_INFO !== 'true') {
    throw new Error('O projeto é confloraai-dev. Defina ALLOW_DEV_PRODUCT_INFO=true para autorizar esta carga no ambiente dev.');
  }

  const snapshot = await firestore.collection('products').get();
  const updates = snapshot.docs
    .map((document) => ({ document, fields: getMissingProductInformation({ ...document.data(), id: document.id }) }))
    .filter(({ fields }) => Object.keys(fields).length > 0);

  console.log(`Projeto: ${projectId}`);
  console.log(`Produtos lidos: ${snapshot.size}`);
  console.log(`Produtos que receberiam informações: ${updates.length}`);
  console.log(`Modo: ${applyChanges ? 'GRAVAR somente campos vazios' : 'prévia; sem gravação'}`);
  if (!updates.length || !applyChanges) return;

  let written = 0;
  for (let offset = 0; offset < updates.length; offset += 400) {
    const batch = firestore.batch();
    const group = updates.slice(offset, offset + 400);
    for (const { document, fields } of group) {
      batch.set(document.ref, { ...fields, updatedAt: new Date().toISOString() }, { merge: true });
    }
    await batch.commit();
    written += group.length;
  }

  console.log(`Produtos atualizados: ${written}`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Falha ao enriquecer produtos: ${error.message}`);
    process.exitCode = 1;
  });
}
