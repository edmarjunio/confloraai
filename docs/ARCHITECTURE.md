# Arquitetura Conflora AI

Revisão de código em 22/10/2026. Monólito modular Node.js/Express em Cloud Run, com Firestore como autoridade comercial. Não há novos microsserviços ou serviços pagos nesta refatoração.

| Entrada | Adaptador | Núcleo compartilhado |
| --- | --- | --- |
| PDV | `PdvService.create` → `PdvRepository.create` | `orders/commercial-order.js` |
| Loja principal | `normalizeExistingCheckout` / rota legada `/api/orders` → `createDirectOrder` com reserva | Mesmo núcleo |
| WhatsApp | `OrderService` / carrinho nativo → confirmação → `createDirectOrder` com reserva | Mesmo núcleo |
| Caixa, Sicredi e entregador autorizado | `PdvRepository.receive` | Recebimento, estoque, fiado/crédito e eventos na mesma transação |

`database/transactions.js` fornece a fronteira comum de persistência. Memória é permitida exclusivamente para execução isolada explicitamente configurada; cliente Firestore indisponível nunca autoriza fallback financeiro. O SDK servidor existente foi preservado; edição e configuração do banco remoto não puderam ser verificadas por credenciais expiradas.

`database/firestore.repository.js` permanece como fachada de compatibilidade. Foram extraídos criação comercial, rascunhos, callbacks WhatsApp, leituras do caixa e execução transacional. Os demais domínios existentes permanecem no código original quando não havia evidência de benefício em substituí-los nesta rodada.

O SaaS em `stores/{tenantId}/...` usa `StoreRepository` e seus próprios contratos. Não foi misturado com a operação principal nem migrado. `functions/src/index.ts` contém apenas scaffold de opções globais, sem funções comerciais exportadas. A configuração raiz não publica esse scaffold.

Fontes, fluxos e limites: [schema](FIRESTORE_SCHEMA.md), [pedidos](ORDER_LIFECYCLE.md), [pagamentos](PAYMENT_FLOW.md), [WhatsApp](WHATSAPP_ARCHITECTURE.md), [status](IMPLEMENTATION_STATUS.md).
