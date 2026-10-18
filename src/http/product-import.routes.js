const { ProductImportService, CSV_TEMPLATE } = require('../catalog/product-import');
const Logger = require('../shared/logger');
function installProductImportRoutes(app, { repository, catalog }) {
  const service = new ProductImportService(repository);
  app.get('/api/admin/products/import/template', (_req, res) => res.type('text/csv').attachment('modelo-produtos-conflora.csv').send(CSV_TEMPLATE));
  app.post(['/api/admin/products/import/preview', '/api/admin/import-products/preview'], async (req, res) => {
    try {
      const plan = await service.preview(req.body?.products ?? req.body?.csv);
      res.json({ importId: plan.importId, total: plan.total, errors: plan.errors, rows: plan.products.slice(0, 20) });
    } catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'Não foi possível validar o arquivo. Tente novamente.' }); }
  });
  app.post(['/api/admin/products/import/commit', '/api/admin/import-products'], async (req, res) => {
    try {
      const result = await service.commit(req.body?.products ?? req.body?.csv, req.body?.importId, req.user);
      catalog?.invalidateCache?.();
      if (catalog) await catalog.refreshCatalog().catch(error => Logger.error('Catálogo importado; atualização do cache pendente', error));
      res.json(result);
    } catch (error) {
      if (!error.status) Logger.error('Importação interrompida; reenvio do mesmo arquivo retoma os lotes pendentes', error);
      res.status(error.status || 503).json({ error: error.status ? error.message : 'Importação interrompida. Parte dos lotes pode ter sido salva. Reenvie o mesmo arquivo para retomar sem duplicar.' });
    }
  });
}
module.exports = { installProductImportRoutes };
