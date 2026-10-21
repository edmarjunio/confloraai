'use strict';

const Logger = require('../shared/logger');
const { safeEqualText } = require('../agent/util');

/**
 * Cria o roteador Express para os endpoints de Tools do conector Meta Business Agent
 * e para a gestão da fila de atendimento humano.
 *
 * @param {Object} deps
 * @param {import('./agent-service').ConfloraAgentService} deps.agentService
 * @param {import('./agent-store').HandoffStore} deps.handoffStore
 * @param {string} [deps.apiKey] Chave de autenticação configurada no conector Meta (Header X-Conflora-Agent-Key)
 * @param {string} [deps.tenantId='conflora']
 * @returns {import('express').Router}
 */
function createMetaAgentRoutes({
  agentService,
  handoffStore,
  apiKey = process.env.META_AGENT_API_KEY || '',
  tenantId = 'conflora',
  connectorEnabled = process.env.WHATSAPP_AGENT_OWNER === 'meta_connector' && process.env.META_AGENT_CONNECTOR_VERIFIED === 'true',
}) {
  const express = require('express');
  const router = express.Router();

  // Middleware de Autenticação Segura para Chamadas do Conector Meta
  const authenticateConnector = (req, res, next) => {
    const authHeader = req.headers['x-conflora-agent-key'] || req.headers.authorization;
    let token = '';

    if (typeof authHeader === 'string') {
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      } else {
        token = authHeader.trim();
      }
    }

    const unsafeKey = ['conflora-agent-secret-key', 'conflora-agent-secret-key-prod'].includes(apiKey)
      || (process.env.NODE_ENV === 'production' && apiKey.length < 32);
    if (!token || !apiKey || unsafeKey || !safeEqualText(token, apiKey)) {
      Logger.warn('Tentativa de acesso ao Meta Connector com chave inválida ou ausente');
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Chave de autenticação do conector inválida.',
      });
    }

    next();
  };

  // 1. Endpoints de Tools do Conector Meta (Base: /api/meta-agent/*)
  const operations = [
    'consultar_produto',
    'buscar_produtos',
    'consultar_carrinho',
    'adicionar_item',
    'alterar_quantidade',
    'remover_item',
    'preparar_finalizacao',
    'encaminhar_atendente',
  ];

  for (const op of operations) {
    router.post([`/${op}`, `/tools/${op}`], authenticateConnector, async (req, res) => {
      if (!connectorEnabled) return res.status(409).json({
        status: 'error', data: {}, validation: { checks: [] }, provenance: { reason: 'connector_not_authorized_owner' },
        next_action: { send_customer_message: false, handoff_to_human: false },
      });
      if (['adicionar_item', 'alterar_quantidade', 'remover_item', 'preparar_finalizacao'].includes(op)
        && process.env.META_AGENT_PILOT_CART_ENABLED !== 'true') return res.status(409).json({
        status: 'error', data: {}, next_action: { send_customer_message: false, handoff_to_human: true },
      });
      try {
        const envelope = await agentService.execute(op, req.body);
        // Retorna sempre 200 com o envelope estruturado do contrato
        return res.status(200).json(envelope);
      } catch (err) {
        Logger.error(`Erro inesperado na execução da operação ${op}:`, err);
        return res.status(500).json({
          request_id: req.body?.message_id || 'unknown',
          status: 'error',
          error: { code: 'server_error', message: 'Erro interno no processamento da ferramenta.' },
          data: {}, validation: { checks: [] }, provenance: {},
          next_action: { send_customer_message: false, handoff_to_human: true },
        });
      }
    });
  }

  // 1.1 Especificações das Ferramentas para o Conector Meta
  const { buildConnectorTools } = require('../agent/meta-connector-tools');
  router.get('/tools-spec', authenticateConnector, (_req, res) => {
    return res.json({ provider_homologated: false, tools: buildConnectorTools() });
  });

  // 2. Fila de Atendimento Humano (Rotas para o Painel Administrativo)
  router.get('/admin/handoffs', async (req, res) => {
    // Apenas operadores autenticados do admin podem consultar
    if (!req.user || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso restrito à equipe Conflora.' });
    }

    try {
      const list = await handoffStore.listOpen(tenantId);
      return res.json({ success: true, handoffs: list });
    } catch (err) {
      Logger.error('Falha ao listar fila de handoffs:', err);
      return res.status(500).json({ error: 'Erro ao carregar fila de atendimento humano.' });
    }
  });

  router.post('/admin/handoffs/:id/resume', async (req, res) => {
    if (!req.user || !['ADMIN', 'CAIXA'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Apenas Administradores e Caixas podem retomar atendimentos.' });
    }

    const { id } = req.params;
    try {
      const outcome = await handoffStore.resume(tenantId, id, {
        id: req.user.id || 'unknown',
        role: req.user.role,
      });

      if (!outcome.ok) {
        return res.status(400).json({ error: outcome.code });
      }

      return res.json({
        success: true,
        message: 'Atendimento retomado com sucesso. A automação voltou a ficar ativa para o cliente.',
        handoff: outcome.handoff,
      });
    } catch (err) {
      Logger.error(`Falha ao retomar atendimento ${id}:`, err);
      return res.status(500).json({ error: 'Erro ao processar retomada de atendimento.' });
    }
  });

  return router;
}

module.exports = { createMetaAgentRoutes };
