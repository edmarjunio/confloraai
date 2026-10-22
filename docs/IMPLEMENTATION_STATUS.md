# Refatoração incremental — Conflora AI

Base auditada: `fecc9ed68a9dbca1bab7f4b893aa1ad6b3f1cc66` (main local e GitHub em 22/10/2026).
Branch de revisão: `refactor/conflora-scalable-architecture`. Sem deploy, merge ou escrita em produção.

**Atualização concorrente observada:** em 22/10/2026 às 13:48 (São Paulo), a main local e remota passou a `60645520f2825c6d4049fb6074dbad64acc9280e` (`cache like youtube`), incorporando grande parte dos arquivos durante esta execução. Esta tarefa não criou esse commit nem fez merge na main. O trabalho foi preservado; a branch de revisão acompanha essa base. Ajustes finais e relatórios restantes ficam no diretório local e no patch de entrega: o envio desses arquivos foi bloqueado pela revisão automática, mesmo após verificar titularidade da conta e do repositório público. Nenhum PR complementar foi criado. Não foi verificado se algum processo externo publicou o commit concorrente.

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

## Alterações executadas

- Transações e criação comercial extraídas, mantendo a fachada antiga e o modelo single-tenant.
- PDV, web e confirmação WhatsApp compartilham validação transacional de produto/preço e reserva. Estoque físico só baixa no recebimento existente.
- Pedidos e intenções de recibo/equipe são gravados juntos. Avisos por administrador/pedido usam identidade estável e preservam notificação já lida.
- Rascunhos saem de novas escritas em `orders/{phone}` e passam a `sessions.orderDraft`. A versão do rascunho e sua transição para `ORDER_CREATED` são verificadas/gravadas na mesma transação do pedido, evitando perder adições simultâneas.
- Confirmação WhatsApp utiliza ID próprio, snapshot oficial e pagamento pendente. Foram removidos o desconto de estoque separado e a cópia histórica com erro suprimido. Preferências do cliente são preservadas na transação, incluindo os campos financeiros já existentes.
- Agente verificado conectado à outbox; consultas ambíguas encaminhadas ao humano. Pausa vale antes dos atalhos e em todos os ambientes.
- Envios nativos possuem marcador durável antes da submissão; resultado incerto exige reconciliação. Inbox não dá retry automático de erro marcado como incerto.
- Worker Tasks autentica e lê a mensagem original persistida, incluindo botão interativo; a fila transporta somente a referência.
- Callbacks Meta agora possuem implementação real, transacional, idempotente e com recuperação quando chegam antes do acknowledgment.
- Caixa consulta intervalo e trabalhos ativos, compartilhando apenas leituras simultâneas. Consulta de expiração Pix usa `in`; checkout legado consulta produtos por ID. Configuração comercial indisponível não cai para cópia local.
- Ajustes de lint em código/testes existentes e importação ausente de `openDialog` nos filtros da vitrine; aparência mantida. Nenhum script destrutivo foi executado.

## Resultado por fase

| Fase | Estado verificável |
| --- | --- |
| Auditoria | Inventário estático atualizado, principais produtores/consumidores revisados e documentação de domínios. Configuração efetiva remota pendente. |
| Contratos/repositórios | Produto comercial, transações, criação, rascunhos, callbacks e leitura do caixa extraídos. Repositório legado preservado; decomposição de todos os demais métodos não concluída. |
| Canais | PDV, checkout principal e confirmação WhatsApp integrados ao núcleo. Piloto Meta permanece isolado; não há promoção automática desse carrinho. |
| Estoque/financeiro | Reserva, preço e edição de carrinho protegidos; financeiro existente preservado e testado localmente. Auditoria total dos caminhos administrativos de edição e devolução bancária completa permanecem pendentes. |
| WhatsApp/IA | Ligação ao agente verificado, pause/handoff, inbox/outbox e idempotência fortalecidos. Conversa de compra guiada completa e templates reais exigem homologação. |
| Entregas/relatórios | Compatibilidade de origem WhatsApp e consultas do caixa implementadas; métricas/transições existentes preservadas. HTTP real pendente. |
| Performance/FinOps | Consultas e reuso de snapshots implementados; simulação 100/500/1.000 executada. Sem medição real de Firestore/custo. |
| Segurança | Falha fechada nos novos caminhos, autenticação de worker e estado humano reforçados. IAM/regras/Storage remotos pendentes. |
| Testes | Build/lint aprovados, 118 regressões finais aprovadas. Suíte ampla teve 52 bloqueios HTTP locais e 1 teste sem emulador. |
| Deploy | Documentação de validação, compatibilidade, backup e rollback pronta. Nenhum deploy ou merge realizado. |

## Arquivos e contratos

Principais arquivos novos: `src/catalog/commercial-product.js`, `src/database/transactions.js`, `src/database/repositories/{conversation-orders,whatsapp-delivery,cashier-snapshot}.js`, `src/orders/commercial-order.js`, `src/http/incoming-task.js`, `src/services/{conversation-automation,durable-conversation-transport}.js` e testes `commercial-*.test.js`.

Adaptadores modificados: fachada Firestore, `pdv.repository/service`, `order.service`, reserva/recibo, rotas HTTP/PDV, vitrine, normalização de catálogo, `message.service`, inbox, fila e agente. Mudanças auxiliares de lint estão no diff do PR. Documentação de arquitetura, dados, estoque, pagamento, WhatsApp, agente, entrega, cache, segurança, FinOps, migração, implantação e testes foi acrescentada com referências à documentação existente.

Coleções mantidas: todas as existentes. Coleções novas: nenhuma. Campos novos relevantes: `sessions.orderDraft.version/commercialOrderId/officialOrderId`, marcadores nativos e tipos de intenção na outbox. Campos históricos de produto, estoque, pagamento e dívida não foram renomeados. `daily_metrics` não foi criada por ausência de consumidor/benefício medido.

## Pendências e limite de conclusão

Esta entrega é uma refatoração incremental implementada e revisável, **não uma declaração de conclusão de todos os critérios de produção**. Credenciais Firebase expiradas, conexões HTTP locais bloqueadas, ausência de emulador, homologação Sicredi/Meta/GA4, validação efetiva de regras/IAM/Storage e região de deploy continuam pendentes. Callbacks de todos os chunks históricos do WhatsApp ainda não têm índice completo de IDs; os IDs mais recentes de texto/documento são tratados.

Não houve alteração de credenciais, exclusão, carga ou escrita em produção, ativação de TTL, migração multi-tenant, deploy ou merge. Ver [TEST_REPORT.md](TEST_REPORT.md), [MIGRATION_PLAN.md](MIGRATION_PLAN.md) e [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) antes de solicitar autorização para publicar.

## Entrega remota bloqueada

A revisão automática recusou `github_create_tree` por não considerar comprovada, em conteúdo confiável da conversa, a autorização específica para exportar código ao GitHub. Foi confirmado que a conta conectada é `edmarjunio` e possui administração/escrita sobre o repositório público homônimo, mas a revisão manteve a recusa. Não foram tentados uploads por outro canal. O usuário deve autorizar diretamente o envio dos ajustes ao repositório e a abertura do PR antes de nova tentativa.

O patch complementar usa como base `60645520f2825c6d4049fb6074dbad64acc9280e`. Ele corrige a mensagem repetida de pedido já pago, acrescenta a asserção de regressão e finaliza a documentação/evidências. A maior parte da implementação descrita acima já consta do commit concorrente na main; o patch não deve ser confundido com uma cópia completa daquela refatoração.
