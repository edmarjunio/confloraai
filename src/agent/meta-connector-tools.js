'use strict';

/**
 * Definições oficiais de ferramentas para o conector Meta Business Agent.
 * Em conformidade com a especificação BizAIOmniChannelConnectorToolRequest
 * da Meta Business Agent Platform (X-API-Version: 2.0.0).
 */

function buildConnectorTools({ baseUrl = 'https://conflora.com.br/api/meta-agent' } = {}) {
  return [
    {
      name: 'consultar_produto',
      description: 'Consulta produto específico por código/ID ou nome na Conflora Horta e Viveiro. Retorna valor unitário oficial, apresentação e disponibilidade. Use quando o cliente perguntar preço ou disponibilidade de um item.',
      user_auth_required: false,
      request_definition: {
        method: 'POST',
        path: '/consultar_produto',
        headers: {
          'Content-Type': {
            type: 'string',
            description: 'Tipo de conteúdo da requisição',
            required: true,
            binding: { kind: 'default', value: 'application/json' },
          },
        },
        body: {
          content_type: 'application/json',
          params: {
            customer_phone: {
              type: 'string',
              description: 'Telefone do cliente no WhatsApp no formato internacional',
              binding: { kind: 'macro', macro: 'WHATSAPP_PHONE_NUMBER' },
            },
            message_id: {
              type: 'string',
              description: 'Identificador único da mensagem no WhatsApp',
              binding: { kind: 'macro', macro: 'WHATSAPP_MESSAGE_ID' },
            },
            conversation_id: {
              type: 'string',
              description: 'Identificador da conversa no WhatsApp',
              binding: { kind: 'macro', macro: 'WHATSAPP_CONVERSATION_ID' },
            },
            query: {
              type: 'string',
              description: 'Nome do produto solicitado pelo cliente (ex: "alface crespa", "cebolinha")',
            },
            product_id: {
              type: 'string',
              description: 'ID exato do produto se já conhecido',
            },
            intent: {
              type: 'string',
              description: 'Intenção da consulta: "preco" ou "disponibilidade"',
            },
            queries_json: {
              type: 'string',
              description: 'Array JSON de strings para consulta múltipla de produtos na mesma mensagem (ex: ["alface", "tomate"])',
            },
          },
        },
      },
    },

    {
      name: 'buscar_produtos',
      description: 'Busca opções de produtos ou lista itens de uma categoria solicitada pelo cliente na Conflora. Use quando o cliente pedir opções, tipos ou lista de produtos (ex: "quais mudas vocês tem?").',
      user_auth_required: false,
      request_definition: {
        method: 'POST',
        path: '/buscar_produtos',
        headers: {
          'Content-Type': {
            type: 'string',
            description: 'Tipo de conteúdo da requisição',
            required: true,
            binding: { kind: 'default', value: 'application/json' },
          },
        },
        body: {
          content_type: 'application/json',
          params: {
            customer_phone: {
              type: 'string',
              description: 'Telefone do cliente no WhatsApp',
              binding: { kind: 'macro', macro: 'WHATSAPP_PHONE_NUMBER' },
            },
            message_id: {
              type: 'string',
              description: 'ID da mensagem',
              binding: { kind: 'macro', macro: 'WHATSAPP_MESSAGE_ID' },
            },
            query: {
              type: 'string',
              description: 'Termo de busca comercial',
            },
            category: {
              type: 'string',
              description: 'Nome da categoria ou subcategoria (ex: "hortaliças", "mudas")',
            },
            limit: {
              type: 'integer',
              description: 'Número máximo de opções para exibir (entre 1 e 10)',
            },
          },
        },
      },
    },

    {
      name: 'consultar_carrinho',
      description: 'Consulta os itens atualmente adicionados ao carrinho de compras persistente do cliente no WhatsApp e o subtotal calculado pelo sistema.',
      user_auth_required: false,
      request_definition: {
        method: 'POST',
        path: '/consultar_carrinho',
        headers: {
          'Content-Type': {
            type: 'string',
            description: 'Tipo de conteúdo da requisição',
            required: true,
            binding: { kind: 'default', value: 'application/json' },
          },
        },
        body: {
          content_type: 'application/json',
          params: {
            customer_phone: {
              type: 'string',
              description: 'Telefone do cliente no WhatsApp',
              binding: { kind: 'macro', macro: 'WHATSAPP_PHONE_NUMBER' },
            },
            message_id: {
              type: 'string',
              description: 'ID da mensagem',
              binding: { kind: 'macro', macro: 'WHATSAPP_MESSAGE_ID' },
            },
          },
        },
      },
    },

    {
      name: 'adicionar_item',
      description: 'Adiciona um ou mais produtos ao carrinho do cliente após consulta e confirmação explícita de compra. Calcule subtotal e quantidade com precisão.',
      user_auth_required: false,
      request_definition: {
        method: 'POST',
        path: '/adicionar_item',
        headers: {
          'Content-Type': {
            type: 'string',
            description: 'Tipo de conteúdo da requisição',
            required: true,
            binding: { kind: 'default', value: 'application/json' },
          },
        },
        body: {
          content_type: 'application/json',
          params: {
            customer_phone: {
              type: 'string',
              description: 'Telefone do cliente no WhatsApp',
              binding: { kind: 'macro', macro: 'WHATSAPP_PHONE_NUMBER' },
            },
            message_id: {
              type: 'string',
              description: 'ID da mensagem para idempotência',
              binding: { kind: 'macro', macro: 'WHATSAPP_MESSAGE_ID' },
            },
            query: {
              type: 'string',
              description: 'Nome do produto para item único',
            },
            product_id: {
              type: 'string',
              description: 'ID do produto no catálogo',
            },
            quantity: {
              type: 'string',
              description: 'Quantidade solicitada (ex: 1, 2, "0.5")',
            },
            items_json: {
              type: 'string',
              description: 'Array JSON de itens quando o cliente pedir vários produtos de uma vez (ex: [{"query":"alface","quantity":2}])',
            },
          },
        },
      },
    },

    {
      name: 'alterar_quantidade',
      description: 'Altera a quantidade total de um item específico que já está no carrinho do cliente.',
      user_auth_required: false,
      request_definition: {
        method: 'POST',
        path: '/alterar_quantidade',
        headers: {
          'Content-Type': {
            type: 'string',
            description: 'Tipo de conteúdo da requisição',
            required: true,
            binding: { kind: 'default', value: 'application/json' },
          },
        },
        body: {
          content_type: 'application/json',
          params: {
            customer_phone: {
              type: 'string',
              description: 'Telefone do cliente no WhatsApp',
              binding: { kind: 'macro', macro: 'WHATSAPP_PHONE_NUMBER' },
            },
            message_id: {
              type: 'string',
              description: 'ID da mensagem',
              binding: { kind: 'macro', macro: 'WHATSAPP_MESSAGE_ID' },
            },
            product_id: {
              type: 'string',
              description: 'ID do produto no carrinho',
            },
            query: {
              type: 'string',
              description: 'Nome do produto a alterar',
            },
            quantity: {
              type: 'string',
              description: 'Nova quantidade total do item',
            },
          },
        },
      },
    },

    {
      name: 'remover_item',
      description: 'Remove completamente um item do carrinho de compras do cliente.',
      user_auth_required: false,
      request_definition: {
        method: 'POST',
        path: '/remover_item',
        headers: {
          'Content-Type': {
            type: 'string',
            description: 'Tipo de conteúdo da requisição',
            required: true,
            binding: { kind: 'default', value: 'application/json' },
          },
        },
        body: {
          content_type: 'application/json',
          params: {
            customer_phone: {
              type: 'string',
              description: 'Telefone do cliente no WhatsApp',
              binding: { kind: 'macro', macro: 'WHATSAPP_PHONE_NUMBER' },
            },
            message_id: {
              type: 'string',
              description: 'ID da mensagem',
              binding: { kind: 'macro', macro: 'WHATSAPP_MESSAGE_ID' },
            },
            product_id: {
              type: 'string',
              description: 'ID do produto a remover',
            },
            query: {
              type: 'string',
              description: 'Nome do produto a remover',
            },
          },
        },
      },
    },

    {
      name: 'preparar_finalizacao',
      description: 'Revalida todos os preços e disponibilidade dos itens do carrinho diretamente no banco antes de fechar a compra. Solicita confirmação caso algum preço tenha sido atualizado.',
      user_auth_required: false,
      request_definition: {
        method: 'POST',
        path: '/preparar_finalizacao',
        headers: {
          'Content-Type': {
            type: 'string',
            description: 'Tipo de conteúdo da requisição',
            required: true,
            binding: { kind: 'default', value: 'application/json' },
          },
        },
        body: {
          content_type: 'application/json',
          params: {
            customer_phone: {
              type: 'string',
              description: 'Telefone do cliente no WhatsApp',
              binding: { kind: 'macro', macro: 'WHATSAPP_PHONE_NUMBER' },
            },
            message_id: {
              type: 'string',
              description: 'ID da mensagem',
              binding: { kind: 'macro', macro: 'WHATSAPP_MESSAGE_ID' },
            },
            price_change_token: {
              type: 'string',
              description: 'Token de confirmação de alteração de preço, quando solicitado pelo resumo prévio',
            },
          },
        },
      },
    },

    {
      name: 'encaminhar_atendente',
      description: 'Encaminha a conversa silenciosamente para a equipe humana da Conflora. Deve ser chamada imediatamente quando o cliente solicitar falar com atendente, quando houver dúvida comercial ou impossibilidade de resposta segura.',
      user_auth_required: false,
      request_definition: {
        method: 'POST',
        path: '/encaminhar_atendente',
        headers: {
          'Content-Type': {
            type: 'string',
            description: 'Tipo de conteúdo da requisição',
            required: true,
            binding: { kind: 'default', value: 'application/json' },
          },
        },
        body: {
          content_type: 'application/json',
          params: {
            customer_phone: {
              type: 'string',
              description: 'Telefone do cliente no WhatsApp',
              binding: { kind: 'macro', macro: 'WHATSAPP_PHONE_NUMBER' },
            },
            message_id: {
              type: 'string',
              description: 'ID da mensagem',
              binding: { kind: 'macro', macro: 'WHATSAPP_MESSAGE_ID' },
            },
            reason: {
              type: 'string',
              description: 'Motivo do encaminhamento (ex: "cliente pediu atendente humano", "produto não encontrado")',
            },
          },
        },
      },
    },
  ];
}

module.exports = { buildConnectorTools };
