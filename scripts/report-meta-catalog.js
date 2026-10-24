const fs = require('node:fs/promises');
const path = require('node:path');
const { FirestoreRepository } = require('../src/database/firestore.repository');
const { MetaCatalogSyncService, eligibleForMeta, internalProduct, restrictedProduct } = require('../src/services/meta-catalog-sync.service');
const { commercialProduct } = require('../src/catalog/commercial-product');
const { normalizeText } = require('../src/shared/string.util');

const quote = value => '"' + String(value ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"';
function missingReason(product, job) {
  if (product.metaCommerceReview?.reasonCode === 'META_REJECTED_REQUIRES_REVIEW') return ['REJEITADO_PELA_META_AGUARDANDO_REVISAO', 'Rejeição comercial confirmada pela API. Reenvio automático suspenso; corrigir dados reais e usar a revisão oficial antes de autorizar nova publicação.'];
  if (internalProduct(product)) return ['ITEM_INTERNO', 'Troco/recebimento excluído da publicação por solicitação; registro mantido no Firestore.'];
  if (!commercialProduct(product).active) return ['PRODUTO_INATIVO', 'Produto inativo no backend; não publicar como disponível.'];
  if (normalizeText(product.category || '') === 'pets') return ['CATEGORIA_PETS_NAO_HABILITADA', 'Bloqueio local conservador. Exige revisão da espécie, finalidade e políticas comerciais; não é recusa individual da Meta.'];
  if (restrictedProduct(product)) return ['FILTRO_COMERCIAL', 'Nome/categoria acionou filtro conservador; revisar classificação e elegibilidade. Não foi submetido para aprovação da Meta.'];
  if (!require('../src/catalog/product-media').normalizeProductMedia(product).entries.length) return ['MIDIA_PENDENTE_DE_REVISAO', 'Sem fotografia com origem, licença e correspondência confirmadas. Localização no Storage ou domínio externo não comprova autorização.'];
  if (!eligibleForMeta(product) && /^(ovo|ovos)\b/.test(normalizeText(product.name))) return ['FINALIDADE_DOS_OVOS_A_CONFIRMAR', 'Confirmar se são ovos para consumo ou reprodução e revisar elegibilidade da apresentação antes de publicar.'];
  if (!eligibleForMeta(product) && /\b(forth|fertilizante|osmocote|n p k|farinha de osso)\b/.test(normalizeText(product.name))) return ['COMPOSICAO_DO_INSUMO_A_REVISAR', 'Composição, classificação de risco e apresentação comercial ainda não revisadas para publicação na Meta.'];
  if (!eligibleForMeta(product) && /orquidea|suculenta|cactus|xaxim|cyka|samambaia arvore|samabaia arvore|bromelia|chifre de veado|rabo de macaco|musgo|licuala|\bipe\b/.test(normalizeText(product.name))) return ['ESPECIE_E_ORIGEM_A_CONFIRMAR', 'Confirmar identificação e origem de cultivo para verificar restrições aplicáveis; não significa que todos os exemplares desse grupo sejam proibidos.'];
  if (!eligibleForMeta(product)) return ['REVISAO_COMERCIAL_PENDENTE', 'Revisão local ausente ou identidade alterada. Grupos botânicos/especificação, origem ou alegações exigem confirmação antes de publicar.'];
  return ['SINCRONIZACAO_PENDENTE', `Registro não encontrado na consulta Meta. Outbox: ${job?.status || 'SEM_JOB'}; diagnóstico: ${job?.lastError || 'sem erro registrado'}.`];
}

async function main() {
  const repository = new FirestoreRepository();
  const sync = new MetaCatalogSyncService(repository);
  const catalogId = process.env.WHATSAPP_META_CATALOG_ID;
  if (!/^\d+$/.test(catalogId || '')) throw new Error('Configure o catálogo antes de gerar o relatório.');
  // Full reads are intentional for this operator-requested reconciliation report.
  const products = await repository.getAllProducts();
  const jobs = new Map((await repository.firestore.collection('pdv_outbox').where('kind', '==', 'meta-product-sync').get()).docs.map(doc => [doc.data().productId, doc.data()]));
  const remote = new Map();
  let after = '';
  let page = 0;
  do {
    const result = await sync.request(`${catalogId}/products?fields=id,name,retailer_id,review_status,image_fetch_status,visibility,availability,capability_to_review_status&limit=100${after ? '&after=' + encodeURIComponent(after) : ''}`);
    if (!Array.isArray(result.data)) throw new Error('Resposta Meta inválida; não gerar relatório parcial.');
    for (const item of result.data) {
      if (remote.has(item.retailer_id) && remote.get(item.retailer_id).id !== item.id) throw new Error('IDs duplicados na Meta; reconciliar antes de relatar.');
      remote.set(item.retailer_id, item);
    }
    after = result.paging?.next ? result.paging.cursors?.after : '';
    if (result.paging?.next && !after) throw new Error('Paginação Meta sem cursor.');
    if (++page > 50) throw new Error('Relatório excedeu o limite de segurança de páginas.');
  } while (after);
  const missing = products.filter(product => !remote.has(product.id)).map(product => {
    const [reason, detail] = missingReason(product, jobs.get(product.id));
    return { id: product.id, name: product.name, category: product.category, reason, detail, outboxStatus: jobs.get(product.id)?.status || '' };
  });
  const linked = products.filter(product => remote.has(product.id)).map(product => ({ id: product.id, name: product.name, category: product.category,
    metaId: remote.get(product.id).id, reviewStatus: remote.get(product.id).review_status || 'NAO_INFORMADO_PELA_META',
    whatsappReviewStatus: remote.get(product.id).capability_to_review_status?.find(status => status.key === 'WHATSAPP')?.value || 'NAO_INFORMADO_PELA_META',
    visibility: remote.get(product.id).visibility || 'NAO_INFORMADO_PELA_META',
    availability: remote.get(product.id).availability || 'NAO_INFORMADO_PELA_META', localPublicationAuthorized: eligibleForMeta(product),
    localBlockReason: eligibleForMeta(product) ? '' : missingReason(product, jobs.get(product.id))[0],
    imageStatus: remote.get(product.id).image_fetch_status || 'NAO_INFORMADO_PELA_META', outboxStatus: jobs.get(product.id)?.status || '' }));
  for (const item of linked.filter(item => item.whatsappReviewStatus === 'REJECTED')) {
    const diagnostic = await sync.request(`${item.metaId}?fields=id,errors,channels_to_integrity_status`);
    item.rejectionCodes = (diagnostic.errors || []).map(error => error.error_type).join('; ');
    item.rejectionReason = diagnostic.channels_to_integrity_status?.data?.map(entry => entry.rejection_information?.message).filter(Boolean).join('; ') ||
      (diagnostic.errors || []).map(error => error.description).filter(Boolean).join('; ') || 'Meta não detalhou a causa.';
  }
  const report = { at: new Date().toISOString(), catalogId, sourceCount: products.length, linkedCount: linked.length, unlinkedCount: missing.length,
    remoteCount: remote.size, reasons: missing.reduce((counts, item) => ({ ...counts, [item.reason]: (counts[item.reason] || 0) + 1 }), {}),
    definition: 'Vinculado = registro retornado pela API no catálogo; não comprova aprovação ou visibilidade no cliente WhatsApp.', linked, missing };
  const prefixArg = process.argv.indexOf('--output-prefix');
  const prefix = path.resolve(prefixArg >= 0 ? process.argv[prefixArg + 1] : 'docs/WHATSAPP_CATALOG_RESULT-2026-10-23');
  await fs.writeFile(prefix + '.json', JSON.stringify(report, null, 2));
  const fields = ['id', 'name', 'category', 'reason', 'detail', 'outboxStatus'];
  await fs.writeFile(prefix + '-NAO-VINCULADOS.csv', '\uFEFF' + [fields, ...missing.map(item => fields.map(field => item[field]))].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n');
  const unavailable = products.filter(product => !eligibleForMeta(product)).map(product => {
    const [reason, detail] = missingReason(product, jobs.get(product.id));
    return { id: product.id, name: product.name, category: product.category, reason, detail, outboxStatus: jobs.get(product.id)?.status || '' };
  });
  await fs.writeFile(prefix + '-INDISPONIVEIS.csv', '\uFEFF' + [fields, ...unavailable.map(item => fields.map(field => item[field]))].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n');
  const providerFields = ['id', 'name', 'category', 'metaId', 'whatsappReviewStatus', 'availability', 'localPublicationAuthorized', 'rejectionCodes', 'rejectionReason'];
  for (const [suffix, rows] of [['REJEITADOS', linked.filter(item => item.whatsappReviewStatus === 'REJECTED')],
    ['AGUARDANDO-META', linked.filter(item => !['APPROVED', 'REJECTED'].includes(item.whatsappReviewStatus))]]) {
    await fs.writeFile(prefix + '-' + suffix + '.csv', '\uFEFF' + [providerFields, ...rows.map(item => providerFields.map(field => item[field]))].map(row => row.map(quote).join(',')).join('\r\n') + '\r\n');
  }
  console.log(JSON.stringify({ at: report.at, source: products.length, linked: linked.length, missing: missing.length, reasons: report.reasons }));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { missingReason };
