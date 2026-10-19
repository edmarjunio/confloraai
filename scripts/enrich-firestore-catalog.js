#!/usr/bin/env node
const { Firestore } = require('@google-cloud/firestore');
const { resolveHdProductImage } = require('../src/catalog/image-resolver');
const { getProductCareDetails } = require('../src/catalog/product-care');
const { buildProductInformation } = require('../src/catalog/product-information');

async function enrichCatalog() {
  const projectId = process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'confloraai';
  const firestore = new Firestore({ projectId, ignoreUndefinedProperties: true });
  console.log(`Buscando catálogo no Firestore [${projectId}] para enriquecimento botânico e de cuidados...`);

  const snapshot = await firestore.collection('products').get();
  console.log(`Encontrados ${snapshot.size} produtos.`);

  let updatedCount = 0;
  const docs = snapshot.docs;
  const batchSize = 300;

  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const batch = firestore.batch();

    for (const doc of chunk) {
      const data = doc.data();
      const name = data.name || data.descricao || data.canonicalName || '';
      const category = data.category || data.categoria || '';
      const subcategory = data.subcategory || data.subcategoria || '';

      const care = getProductCareDetails({ name, category, subcategory });
      const info = buildProductInformation({ name, category, subcategory });
      const hdPhoto = data.imageUrl || resolveHdProductImage(name, category, subcategory);

      const updates = {
        cuidados_basicos: care.cuidados_basicos || info.cuidados_basicos || 'Mantenha em local bem iluminado e regue conforme a necessidade da espécie.',
        ambiente_ideal: care.ambiente_ideal || 'Ambiente arejado com luminosidade adequada.',
        dicas_armazenamento: care.dicas_armazenamento || 'Conservar em local fresco, protegido de intempéries diretas.',
        durabilidade: care.durabilidade || 'Produto perene e de excelente qualidade Conflora.',
        iluminacao: info.iluminacao || '',
        imageUrl: hdPhoto,
        imagePathCache: hdPhoto,
      };

      if (!data.descriptionAi || data.descriptionAi.length < 20) {
        updates.descriptionAi = info.descriptionAi || `${name} está disponível na Conflora Horta e Viveiro.`;
        updates.descricao_ia = updates.descriptionAi;
      }

      batch.update(doc.ref, updates);
      updatedCount++;
    }

    await batch.commit();
    console.log(`  Lote de ${chunk.length} produtos atualizado com sucesso (${updatedCount}/${docs.length}).`);
  }

  console.log(`Sucesso: Todos os ${updatedCount} produtos foram enriquecidos com fotos HD, dicas de cuidado, ambiente ideal e descrições detalhadas!`);
}

enrichCatalog().catch(err => {
  console.error('Erro ao enriquecer catálogo:', err);
  process.exit(1);
});
