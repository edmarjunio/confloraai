# Fontes oficiais e compatibilidade

Contrato de produto atualizado em 24/10/2026: `products.productMedia` v1 mantém referências e comprovação da imagem, com origem `FIREBASE_STORAGE` ou `EXTERNAL`. Bytes próprios ficam no Storage; referências externas autorizadas não são apresentadas como uploads. `contentProvenance` registra campos confirmados pela equipe. `media`, `productInfo` e `inventory` são projeções de API, não novas coleções nem outra fonte comercial. Aliases legados são derivados pela normalização compartilhada. [Auditoria e plano de migração](audit/RELATORIO-2026-10-24.md).

O inventário de referências está em [firestore-collection-map.json](firestore-collection-map.json). É estático: chamadas dinâmicas, falsos positivos de métodos `get/set` e subcoleções exigem a revisão contextual abaixo. Não é um dump do banco remoto.

| Coleções/caminhos | Escrita e leitura principais | Contrato |
| --- | --- | --- |
| `products`, `product_images`, `product_imports` | `FirestoreRepository`, catálogo/importação, PDV, vitrine, agente | IDs estáveis. Preços e saldo atuais oficiais; importação existente não sobrescreve códigos cadastrados. Imagens mantêm referências Storage. |
| `stock_movements` | ajustes, recebimento, estorno legado | Histórico; não é fonte alternativa de saldo. |
| `orders` | núcleo comercial e APIs legadas | Pedidos oficiais, snapshots de itens, origem, reserva e estado financeiro. Não usar telefone para vendas novas. |
| `sessions/{phone}.orderDraft` | repositório `conversation-orders` | Rascunho com `draft`, `commercialOrderId`, itens, estado e operações recentes. Não é receita nem pedido pago. |
| `sessions/{phone}/messages` | histórico WhatsApp | Preservado ao editar o pai. Retenção opcional já existente, desligada por padrão. |
| `customers`, `customer_debts`, `debt_settlements`, `customer_debt_pix` | perfis, recebimento, crédito e quitações | Histórico financeiro e saldos transacionais. Perfis WhatsApp preservam campos financeiros existentes. |
| `users`, `user_emails`, `web_sessions` | autenticação/cadastro/sessões | PIN/senha protegidos; sessão guarda referência ao usuário, expiração lógica e hash de token. |
| `discount_approvals`, `order_alterations`, `cashier_closings` | administração e caixa | Aprovações e auditoria preservadas. |
| `pdv_outbox`, `incoming_messages` | criação, webhooks e workers | Intenções, leases, tentativas, resultados incertos e marcadores de conclusão permanentes. |
| `pdv_pix_events`, `pdv_pix_late_payments`, `payment_proofs` | Sicredi, comprovantes e conciliação | Evidência financeira; sem TTL automático. |
| `whatsapp_delivery_events` | callback Meta assinado e reconciliação | Hash de mensagem/estado, pendência ou conclusão, expiração temporal técnica. Estado consolidado permanece na outbox. |
| `agent_conversations`, `agent_handoffs`, `agent_pilot_carts` | agente e atendimento humano | Escopo por tenant/hash de cliente. Carrinho piloto continua separado de vendas. |
| `agent_synonyms`, `learned_tags` | indexação/curadoria e aprendizado | Evidência de catálogo, sem autoridade financeira. |
| `delivery_events`, `delivery_driver_metrics` | despacho/entrega e recebimento | Histórico e métricas idempotentes na transação existente. |
| `notifications` | avisos por usuário | Avisos de venda passam a ter ID determinístico por usuário/pedido; replay preserva leitura anterior. |
| `store_settings/inventory`, `store_settings/storefront` | administração, checkout e transações | Configuração atual. Checkout não utiliza fallback local após falha de leitura. |
| `storefront_events`, `request_limits`, `application_errors` | analytics legado, proteção e diagnóstico | Política conservadora existente, descrita no plano de retenção. |
| `stores/{tenantId}/...` | `StoreRepository` / SaaS | Modelo independente; sem migração automática para coleções principais. |

Campos comerciais normalizados por `catalog/commercial-product.js`: `id`, `name/descricao/DESCRIÇÃO`, `price/valor_num/VALOR/valor`, `unit/unidade/saleUnit`, `stockQuantity/estoque`, `reservedQuantity`, `status/STATUS`. Campos editáveis prevalecem; não se renomeiam nem regravam documentos históricos. Centavos inteiros e milésimos de quantidade nos cálculos novos. Campos botânicos, fotos, tags e descrições continuam no registro original e nos contratos específicos do agente/vitrine.

Nenhuma coleção nova foi necessária. Houve adição de um campo de rascunho ao pai `sessions` e novos tipos de trabalho nas filas existentes. Não houve varredura, exclusão ou migração remota.
