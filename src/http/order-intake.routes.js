function installOrderIntakeRoutes(app, intake) {
  const cashier = (req, res, next) => ['ADMIN', 'CAIXA'].includes(req.user?.role) ? next() : res.sendStatus(403);
  const handle = work => async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { await work(req, res); }
    catch (error) { res.status(error.status || 503).json({ error: error.status ? error.message : 'Não foi possível registrar. Tente novamente.' }); }
  };
  app.get('/api/caixa/encomendas', cashier, handle(async (_req, res) => {
    const requests = await intake.store.scanPage('agent_handoffs', 'kind', 'ORDER_REQUEST', 100);
    res.set('Cache-Control', 'private, no-store').json({ requests });
  }));
  app.post('/api/caixa/encomendas/:id/previsao', cashier, handle(async (req, res) => {
    res.json({ request: await intake.updateForecast(req.params.id, req.body || {}, req.user) });
  }));
  app.post('/api/caixa/encomendas/:id/cotacao', cashier, handle(async (req, res) => {
    res.json({ request: await intake.procurement.quote(req.params.id, req.body || {}, req.user) });
  }));
  app.post('/api/caixa/encomendas/:id/sinal', cashier, handle(async (req, res) => {
    res.json(await intake.procurement.receiveDeposit(req.params.id, req.body || {}, req.user));
  }));
  app.post('/api/caixa/encomendas/:id/chegada', cashier, handle(async (req, res) => {
    res.json(await intake.procurement.arrive(req.params.id, req.body || {}, req.user));
  }));
}

module.exports = { installOrderIntakeRoutes };
