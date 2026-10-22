# Refatoração incremental — Conflora AI

Base auditada: `fecc9ed68a9dbca1bab7f4b893aa1ad6b3f1cc66` (main local e GitHub em 22/10/2026).
Branch de revisão: `refactor/conflora-scalable-architecture`. Sem deploy, merge ou escrita em produção.

## Diagnóstico inicial e plano

1. **Auditoria:** preservar `products`, `orders`, `customers`, filas, eventos financeiros e o módulo SaaS isolado em `stores/{tenantId}`. O inventário estático existente é complementado por revisão dos produtores e consumidores descritos em `FIRESTORE_SCHEMA.md`.
2. **Contratos:** extrair transações e criação comercial compartilhadas; centralizar identidade, preço, unidade e quantidades sem regravar documentos históricos.
3. **Canais:** encaminhar PDV, web e confirmação WhatsApp ao mesmo núcleo transacional; separar rascunhos de conversa dos pedidos oficiais.
4. **Integridade:** revalidar os produtos na transação de reserva, impedir replay com dados divergentes e reservar uma única vez. Preservar financeiro, fiado, crédito, troco e Sicredi.
5. **WhatsApp:** verificar pausa antes dos atalhos, persistir handoff antes da resposta, eliminar chave Pix inventada e confirmação paralela de estoque.
6. **FinOps e segurança:** corrigir a consulta de expiração Pix com múltiplos estados, impedir fallback de configuração comercial em checkout; preservar caches públicos e retenção conservadora existentes.
7. **Validação:** regressões locais, concorrência simulada, 100/500/1.000 operações, build, lint e tentativa e2e; distinguir simulação de emulador e serviços reais.
8. **Entrega:** documentar contratos, compatibilidade, publicação e rollback; preparar commits e PR sem publicar a aplicação.

## Achados anteriores às alterações

| Situação | Evidência e implicação |
| --- | --- |
| Implementado | PDV possui validação por IDs, transações de recebimento, reservas, Pix verificado, fiado/crédito e outbox com lease/checkpoint. Preservar. |
| Implementado | Web usa os produtos oficiais, mas repete a implementação de reserva e verifica preços antes da transação. Há janela de alteração de preço entre validação e reserva. |
| Necessita refatoração | `OrderService.confirmOrder` baixa estoque antes de salvar pedido e cria uma cópia histórica separada, com erros suprimidos. |
| Legado | `saveOrder/getOrder` usam `orders/{phone}` para carrinho. Misturam rascunhos e vendas oficiais. |
| Bloqueador no código | Atalhos nativos de WhatsApp executam antes da verificação de atendimento humano; pedido humano envia antes de persistir pausa. |
| Bloqueador no código | `scanPage` usa igualdade com um array de estados na consulta de expiração; o Firestore não interpreta isso como `in`. |
| Parcial | Agente verificado consulta catálogo e encaminha ao humano; carrinho piloto prepara resumo, sem pedido financeiro. Não promover piloto automaticamente. |
| Pendente externo | Firebase CLI recusou leitura das instâncias por credenciais expiradas. Edição, regras/índices remotos, IAM, Sicredi, Meta, GA4 e Storage reais não foram homologados. |
| Preservado | Cache público, listeners compartilhados, GA4 por flags e tombstones permanentes já documentados em `FIRESTORE-FINOPS.md`. |

Os resultados finais, arquivos alterados e pendências serão registrados após a execução dos testes. Nenhum serviço novo pago ou migração multi-tenant é necessário.
