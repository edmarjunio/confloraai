const fs = require('node:fs/promises');
const path = require('node:path');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { ImageMigrationService } = require('../src/catalog/image-migration.service');

async function main() {
  const isApply = process.argv.includes('--apply');
  const isDryRun = !isApply || process.argv.includes('--dry-run');

  console.log('==================================================');
  console.log(`🖼️ CONFLORA AI — AUDITORIA E MIGRAÇÃO DE IMAGENS`);
  console.log(`Modo: ${isDryRun ? 'DRY-RUN (Apenas Análise / Sem Modificação)' : 'APPLY (Escrita em Produção)'}`);
  console.log('==================================================\n');

  const repository = new FirestoreRepository();
  const migrationService = new ImageMigrationService({ firestoreRepo: repository });

  if (process.env.NODE_ENV === 'test') throw new Error('Use o serviço injetado nos testes isolados; este comando exige Firestore real.');
  const products = await repository.getAllProducts();

  console.log(`📊 Produtos carregados para auditoria: ${products.length}`);

  const auditResult = await migrationService.auditCatalog(products);

  console.log('\n📈 Estatísticas do Inventário de Imagens:');
  console.log('--------------------------------------------------');
  console.log(`Total de Produtos:              ${auditResult.stats.totalProducts}`);
  console.log(`Validadas no Storage:           ${auditResult.stats.STORAGE_VALIDATED}`);
  console.log(`Locais Aprovadas:               ${auditResult.stats.LOCAL_APPROVED}`);
  console.log(`Externas Aprovadas:             ${auditResult.stats.EXTERNAL_APPROVED}`);
  console.log(`Pendente de Revisão de Licença: ${auditResult.stats.LICENSE_REVIEW_REQUIRED}`);
  console.log(`Pendente de Revisão de Espécie: ${auditResult.stats.SPECIES_REVIEW_REQUIRED}`);
  console.log(`Imagens Ausentes:               ${auditResult.stats.IMAGE_MISSING}`);
  console.log(`Imagens Duplicadas:             ${auditResult.stats.DUPLICATE}`);
  console.log(`Fotos Manuais Protegidas:       ${auditResult.stats.manualPhotosProtected}`);
  console.log('--------------------------------------------------\n');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.resolve(__dirname, '../.private/reports');
  await fs.mkdir(outputDir, { recursive: true });

  const reportPath = path.join(outputDir, `image-audit-${timestamp}.json`);
  await fs.writeFile(reportPath, JSON.stringify(auditResult, null, 2));
  console.log(`📄 Relatório detalhado salvo em: ${reportPath}`);

  if (isDryRun) {
    console.log('\n✅ Execução de auditoria concluída (DRY-RUN). Nenhuma alteração foi realizada.');
    console.log('Para aplicar a migração real, execute o script com o parâmetro --apply acompanhado da devida autorização.\n');
    return;
  }

  console.log('\n🚀 Iniciando processamento de migração real em lote...');
  const batchResult = await migrationService.processMigrationBatch(products, { dryRun: false, maxItems: 50 });
  console.log(`✅ Lote processado: ${batchResult.length} itens.`);
}

main().catch((err) => {
  console.error('❌ Erro na execução da auditoria/migração:', err.message);
  process.exitCode = 1;
});
