const { customerKeyFor } = require('../agent/agent-store');
const { createHash } = require('node:crypto');

function installWhatsappAdminRoutes(app, { whatsapp, store }) {
  app.use('/api/admin/whatsapp', (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    if (!req.user || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(req.user.role)) return res.sendStatus(403);
    const phone = req.path.match(/^\/conversations\/([^/]+)/)?.[1];
    if (phone && !/^\d{10,15}$/.test(phone)) return res.status(400).json({ error: 'Telefone inválido.' });
    next();
  });
  app.post('/api/admin/whatsapp/verify', async (_req, res) => {
    if (process.env.NODE_ENV === 'test') return res.status(409).json({ error: 'Conexões reais desativadas nos testes.' });
    try {
      const response = await fetch(whatsapp.baseUrl + '?fields=display_phone_number,verified_name', { headers: { Authorization: `Bearer ${whatsapp.token}` }, signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      whatsapp.lastConnectionCheck = { status: response.ok ? 'VERIFIED' : 'ERROR', checkedAt: new Date().toISOString() };
      res.status(response.ok ? 200 : 502).json({ ...whatsapp.lastConnectionCheck, sender: data.display_phone_number || '', error: data.error?.message });
    } catch { res.status(502).json({ error: 'Não foi possível verificar o remetente.' }); }
  });

  app.get('/api/admin/whatsapp/settings', (_req, res) => res.json({ configured: Boolean(whatsapp?.token && process.env.WHATSAPP_PHONE_NUMBER_ID), storePhone: process.env.STORE_NOTIFICATION_PHONE || '', ownerPhone: process.env.OWNER_WHATSAPP_NUMBER || '' }));
  app.get('/api/admin/whatsapp/notification-settings', async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    try { res.json(await require('../orders/operational-notifications').settings(store)); }
    catch { res.status(503).json({ error: 'Não foi possível consultar os destinatários.' }); }
  });
  app.put('/api/admin/whatsapp/notification-settings', async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    const notifications = require('../orders/operational-notifications');
    let data;
    try { data = notifications.validate(req.body); }
    catch (error) { return res.status(400).json({ error: error.message }); }
    try {
      const result = await store.transaction(async tx => {
        const current = await tx.get('store_settings', notifications.SETTINGS_ID) || notifications.defaults();
        if (req.body.version !== current.version) throw Object.assign(new Error('Configuração alterada por outro administrador. Recarregue.'), { status: 409 });
        const saved = { ...data, version: current.version + 1, updatedBy: req.user.id, updatedAt: new Date().toISOString() };
        tx.set('store_settings', notifications.SETTINGS_ID, saved);
        return saved;
      });
      res.json(result);
    } catch (error) { res.status(error.status || 503).json({ error: error.status === 409 ? error.message : 'Não foi possível salvar os destinatários.' }); }
  });

  // Listar conversas paginadas do WhatsApp com filtros (até 25 registros por página)
  app.get('/api/admin/whatsapp/conversations', async (req, res) => {
    if (!req.user || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Perfil sem autorização.' });
    }
    try {
      const filter = String(req.query.filter || 'all_open');
      const limit = Math.min(25, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
      const cursor = String(req.query.cursor || '');

      const { items: conversations, nextCursor } = await store.page('agent_conversations', 'tenantId', 'conflora', { limit, cursor });

      // Filtragem no backend
      const filtered = conversations.filter(c => {
        if (filter === 'needs_vendor') return c.automation === 'paused';
        if (filter === 'awaiting_pix') return c.paymentStatus === 'AWAITING_PIX';
        if (filter === 'completed') return c.status === 'COMPLETED';
        if (filter === 'closed_no_sale') return c.status === 'CLOSED_NO_SALE';
        return c.status !== 'CLOSED' && c.status !== 'CLOSED_NO_SALE';
      });

      const page = filtered;

      res.json({
        success: true,
        conversations: page,
        nextCursor,
        totalInPage: page.length,
        isTotalExact: false,
      });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // Histórico paginado de mensagens da conversa
  app.get('/api/admin/whatsapp/conversations/:phone/messages', async (req, res) => {
    if (!req.user || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Perfil sem autorização.' });
    }
    try {
      const rawPhone = String(req.params.phone || '').replace(/\D/g, '');
      const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
      const page = await store.page('incoming_messages', 'payload.phone', rawPhone, { limit, cursor: String(req.query.cursor || '') });
      const manual = await store.page('whatsapp_delivery', 'phone', rawPhone, { limit, cursor: String(req.query.manualCursor || '') });
      const messages = [...page.items, ...manual.items].sort((a, b) => (a.createdAt || a.sentAt || '').localeCompare(b.createdAt || b.sentAt || ''));
      res.json({ success: true, messages, nextCursor: page.nextCursor, manualCursor: manual.nextCursor });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // Assumir atendimento (human takeover)
  app.post('/api/admin/whatsapp/conversations/:phone/takeover', async (req, res) => {
    if (!req.user || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Perfil sem autorização.' });
    }
    try {
      const rawPhone = String(req.params.phone || '').replace(/\D/g, '');
      const customerKey = customerKeyFor('conflora', rawPhone);
      const expectedVersion = req.body?.expectedVersion !== undefined ? Number(req.body.expectedVersion) : null;

      let result = { ok: false };
      await store.transaction(async tx => {
        const id = `conflora__${customerKey}`;
        const current = await tx.get('agent_conversations', id) || { tenantId: 'conflora', customerKey, automation: 'active', version: 0 };
        const currentVersion = Number(current.version || 0);

        if (expectedVersion !== null && expectedVersion !== undefined && expectedVersion !== currentVersion) {
          result = { ok: false, code: 'CONCURRENCY_CONFLICT', message: 'Atendimento já alterado por outro operador.' };
          return;
        }

        if (current.automation === 'paused' && current.assignedTo && current.assignedTo.id !== req.user.id) {
          result = { ok: false, code: 'ALREADY_ASSIGNED', message: `Atendimento sob responsabilidade de ${current.assignedTo.name || current.assignedTo.id}.` };
          return;
        }

        const now = new Date().toISOString();
        const newVersion = currentVersion + 1;
        const updated = {
          ...current,
          tenantId: 'conflora',
          customerKey,
          customerPhone: rawPhone,
          automation: 'paused',
          pausedAt: current.pausedAt || now,
          reason: 'human_takeover',
          assignedTo: { id: req.user.id, name: req.user.name || req.user.id, role: req.user.role, assignedAt: now },
          version: newVersion,
          updatedAt: now,
        };

        tx.set('agent_conversations', id, updated);
        result = { ok: true, conversation: updated, version: newVersion };
      });

      if (!result.ok) {
        return res.status(409).json(result);
      }
      res.json(result);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // Devolver atendimento ao agente automatizado
  app.post('/api/admin/whatsapp/conversations/:phone/release', async (req, res) => {
    if (!req.user || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Perfil sem autorização.' });
    }
    try {
      const rawPhone = String(req.params.phone || '').replace(/\D/g, '');
      const { resumeAgentRequestedConversation } = require('../services/conversation-automation');
      const updated = await resumeAgentRequestedConversation(store.repository, rawPhone, req.user);
      res.json({ success: true, conversation: updated });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // Encerrar atendimento sem venda ou concluído
  app.post('/api/admin/whatsapp/conversations/:phone/close', async (req, res) => {
    if (!req.user || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Perfil sem autorização.' });
    }
    try {
      const rawPhone = String(req.params.phone || '').replace(/\D/g, '');
      const customerKey = customerKeyFor('conflora', rawPhone);
      const status = req.body?.status === 'CLOSED_NO_SALE' ? 'CLOSED_NO_SALE' : 'CLOSED';
      await store.transaction(async tx => {
        const id = `conflora__${customerKey}`;
        const current = await tx.get('agent_conversations', id) || { tenantId: 'conflora', customerKey };
        if (current.assignedTo && current.assignedTo.id !== req.user.id && req.user.role !== 'ADMIN') throw Object.assign(new Error('Atendimento atribuído a outro operador.'), { status: 409 });
        tx.set('agent_conversations', id, { ...current, customerPhone: rawPhone, status, automation: 'paused', reason: 'human_closed',
          version: Number(current.version || 0) + 1, pausedAt: new Date().toISOString(), closedAt: new Date().toISOString(), closedBy: req.user.id });
      });
      res.json({ success: true, status });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  // Enviar mensagem manual do operador via WhatsApp Cloud API
  app.post('/api/admin/whatsapp/conversations/:phone/send', async (req, res) => {
    if (!req.user || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Perfil sem autorização.' });
    }
    try {
      const rawPhone = String(req.params.phone || '').replace(/\D/g, '');
      const text = String(req.body?.text || '').trim();
      if (!text || text.length > 4096) return res.status(400).json({ error: 'Informe uma mensagem com até 4096 caracteres.' });
      if (!whatsapp?.sendTextMessage) return res.status(503).json({ error: 'WhatsApp oficial não configurado.' });

      // Pause before transport; sending without client-side composition protection still claims ownership.
      await store.transaction(async tx => {
        const id = `conflora__${customerKeyFor('conflora', rawPhone)}`;
        const current = await tx.get('agent_conversations', id) || { tenantId: 'conflora', customerKey: customerKeyFor('conflora', rawPhone) };
        if (current.assignedTo && current.assignedTo.id !== req.user.id) throw Object.assign(new Error('Atendimento atribuído a outro operador.'), { status: 409 });
        tx.set('agent_conversations', id, { ...current, customerPhone: rawPhone, automation: 'paused', reason: 'human_takeover',
          assignedTo: { id: req.user.id, name: req.user.name || req.user.id, role: req.user.role }, version: Number(current.version || 0) + 1, updatedAt: new Date().toISOString() });
      });
      const requestId = String(req.body?.requestId || '');
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) return res.status(400).json({ error: 'Identificador único do envio obrigatório.' });
      const deliveryId = createHash('sha256').update(`manual_${rawPhone}_${requestId}`).digest('hex');
      const claim = await store.transaction(async tx => {
        const previous = await tx.get('whatsapp_delivery', deliveryId);
        if (previous) return previous;
        tx.set('whatsapp_delivery', deliveryId, { id: deliveryId, phone: rawPhone, text, status: 'SENDING', createdAt: new Date().toISOString(), sentBy: { id: req.user.id, name: req.user.name || req.user.id } });
        return null;
      });
      if (claim?.text !== undefined && (claim.text !== text || claim.sentBy.id !== req.user.id)) return res.sendStatus(409);
      if (claim) return res.status(claim.status === 'SENT' ? 200 : 409).json({ success: claim.status === 'SENT', messageId: claim.providerMessageId, status: claim.status });
      let result;
      try {
        const ownership = await store.read('agent_conversations', `conflora__${customerKeyFor('conflora', rawPhone)}`);
        if (ownership?.automation !== 'paused' || ownership?.assignedTo?.id !== req.user.id) throw Object.assign(new Error('A posse do atendimento mudou antes do envio.'), { status: 409, definitelyNotSent: true });
        result = await whatsapp.sendTextMessage(rawPhone, text);
      }
      catch (error) {
        await store.transaction(async tx => {
          const current = await tx.get('whatsapp_delivery', deliveryId);
          tx.set('whatsapp_delivery', deliveryId, { ...current, status: 'NEEDS_RECONCILIATION', lastError: error.definitelyNotSent ? 'NOT_SUBMITTED' : 'UNKNOWN_PROVIDER_OUTCOME' });
        });
        throw error;
      }
      const msgId = result?.messages?.[0]?.id;
      if (!msgId || result.mock) throw new Error('A Meta não confirmou o envio; conciliação necessária.');

      // Gravar outbox / histórico de envios
      await store.transaction(async tx => {
        const id = deliveryId;
        tx.set('whatsapp_delivery', id, {
          id,
          phone: rawPhone,
          providerMessageId: msgId,
          text,
          status: 'SENT',
          sentBy: { id: req.user.id, name: req.user.name || req.user.id },
          sentAt: new Date().toISOString(),
        });
      });

      res.json({ success: true, messageId: msgId });
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message });
    }
  });

  app.post('/api/admin/whatsapp/conversations/:phone/reset-test-context', async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    const phone = req.params.phone;
    if (!process.env.WHATSAPP_TEST_PHONE || phone !== process.env.WHATSAPP_TEST_PHONE || req.body?.confirm !== 'RESET_CONVERSATION_CONTEXT') return res.sendStatus(409);
    try {
      const result = await require('../services/conversation-automation').resetConversationContext(store.repository, phone, req.user);
      res.json(result);
    } catch { res.sendStatus(503); }
  });

  app.post('/api/admin/whatsapp/catalog/authorize-sync', async (req, res) => {
    if (req.user.role !== 'ADMIN' || req.body?.authorizeInitialSync !== true || !/^\d+$/.test(req.body?.catalogId || '') || req.body.catalogId !== process.env.WHATSAPP_META_CATALOG_ID) return res.sendStatus(403);
    await store.transaction(async tx => {
      const current = await tx.get('store_settings', 'whatsapp_commerce') || {};
      tx.set('store_settings', 'whatsapp_commerce', { ...current, catalogId: req.body.catalogId, enabled: true,
        initialSyncAuthorizedAt: current.initialSyncAuthorizedAt || new Date().toISOString(), authorizedBy: req.user.id });
    });
    res.json({ authorized: true, queued: 0 });
  });
  app.post('/api/admin/whatsapp/catalog/products/:id/review', async (req, res) => {
    if (req.user.role !== 'ADMIN' || typeof req.body?.approved !== 'boolean' || !/^[a-zA-Z0-9_-]{1,180}$/.test(req.params.id)) return res.sendStatus(403);
    try {
      const product = await store.repository.getProductById(req.params.id);
      if (!product) return res.sendStatus(404);
      const { restrictedProduct, MetaCatalogSyncService, policyIdentity, internalProduct } = require('../services/meta-catalog-sync.service');
      if (req.body.approved && (internalProduct(product) || require('../shared/string.util').normalizeText(product.category || '') === 'pets')) return res.status(409).json({ error: 'Item interno ou categoria não habilitada para publicação.' });
      if (req.body.approved && (req.body.category !== 'PERMITTED_PLANT_OR_GARDEN_PRODUCT' || !String(req.body.policyVersion || '').trim() || String(req.body.policyVersion).length > 120 || restrictedProduct(product))) return res.status(409).json({ error: 'Revise a política e a elegibilidade real da categoria antes de aprovar.' });
      await store.repository.saveProduct({ id: product.id, metaCommerceReview: { approved: req.body.approved, reviewedBy: req.user.id,
        reviewedAt: new Date().toISOString(), productIdentity: policyIdentity(product), policyVersion: String(req.body.policyVersion || '').trim().slice(0, 120), category: req.body.approved ? req.body.category : 'NOT_APPROVED' } });
      await new MetaCatalogSyncService(store.repository).queue(product.id, req.user);
      res.json({ reviewed: true, approved: req.body.approved, publicationPending: true });
    } catch { res.sendStatus(503); }
  });
  app.post('/api/admin/whatsapp/catalog/sync', async (req, res) => {
    if (req.user.role !== 'ADMIN' || !Array.isArray(req.body?.productIds) || !req.body.productIds.length || req.body.productIds.length > 50) return res.sendStatus(403);
    try {
      const sync = new (require('../services/meta-catalog-sync.service').MetaCatalogSyncService)(store.repository);
      const ids = [];
      for (const id of new Set(req.body.productIds)) ids.push(await sync.queue(id, req.user));
      res.json({ queued: ids });
    } catch { res.sendStatus(400); }
  });
  app.post('/api/admin/whatsapp/catalog/pause-sync', async (req, res) => {
    if (req.user.role !== 'ADMIN' || req.body?.pause !== true) return res.sendStatus(403);
    await store.transaction(async tx => {
      const current = await tx.get('store_settings', 'whatsapp_commerce') || {};
      tx.set('store_settings', 'whatsapp_commerce', { ...current, enabled: false, pausedBy: req.user.id, pausedAt: new Date().toISOString() });
    });
    res.json({ paused: true });
  });
  app.get('/api/admin/whatsapp/operations', async (req, res) => {
    if (req.user.role !== 'ADMIN') return res.sendStatus(403);
    const collection = req.query.source === 'inbox' ? 'incoming_messages' : 'pdv_outbox';
    const status = ['NEEDS_RECONCILIATION', 'BLOCKED_CONFIGURATION', 'RETRYABLE', 'SKIPPED'].includes(req.query.status) ? req.query.status : 'NEEDS_RECONCILIATION';
    try {
      res.json(await store.page(collection, 'status', status, { limit: 25, cursor: String(req.query.cursor || '') }));
    } catch { res.sendStatus(503); }
  });
  app.post('/api/admin/whatsapp/operations/:id/resolve', async (req, res) => {
    if (req.user.role !== 'ADMIN' || req.body?.resolvedByTeam !== true || !/^[a-zA-Z0-9_-]{1,180}$/.test(req.params.id) || String(req.body.note || '').trim().length < 8) return res.sendStatus(403);
    const collection = req.body.source === 'inbox' ? 'incoming_messages' : 'pdv_outbox';
    try {
      await store.transaction(async tx => {
        const current = await tx.get(collection, req.params.id);
        if (!current || current.leaseUntil > Date.now() || !['NEEDS_RECONCILIATION', 'BLOCKED_CONFIGURATION', 'RETRYABLE', 'SKIPPED'].includes(current.status)) throw new Error('Operação não conciliável.');
        tx.set(collection, req.params.id, { ...current, status: collection === 'incoming_messages' ? 'COMPLETED' : 'SKIPPED',
          completedAt: new Date().toISOString(), resolvedBy: req.user.id, resolutionNote: String(req.body.note).trim().slice(0, 500), leaseUntil: 0, expiresAt: null });
      });
      res.json({ resolved: true, resent: false });
    } catch { res.sendStatus(409); }
  });
}
module.exports = { installWhatsappAdminRoutes };
