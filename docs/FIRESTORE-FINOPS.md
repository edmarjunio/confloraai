# Conflora AI — otimização incremental do Firestore

Implementação e validação local em 21/10/2026. Sem deploy, envio real de WhatsApp, carga em produção, exclusão ou migração de dados reais. Não foram adicionados serviços pagos.

## A. Auditoria e alterações

A revisão encontrou melhorias já existentes: checkout do PDV por IDs, cache de identificação do catálogo, GA4 Data API por ADC, migração de analytics por flags, intenção durável de compra paga, leases da outbox, compactação inicial e testes instrumentados. Esses componentes foram preservados. Os ganhos do PDV anterior não são apresentados como novos nesta rodada.

Foram implementadas as seguintes melhorias adicionais:

| Mudança | Arquivos principais | Garantia |
| --- | --- | --- |
| Checkout da vitrine busca somente IDs únicos solicitados | `src/storefront/existing-store.js` | Preço, estoque e política de estoque continuam sendo lidos do banco; falha não usa cache comercial |
| Reutilização das configurações dentro da resposta do catálogo | `src/storefront/existing-store.js` | Uma leitura de cada configuração por resposta, sem cache entre requisições |
| Ranking comercial com paginação de 500 documentos e carga compartilhada | `src/database/firestore.repository.js` | Preserva todos os pedidos do ranking e a projeção `status/items`; não interfere na autoridade dos preços |
| Um par de listeners por instância do PDV, compartilhado pelas abas | `src/orders/pdv.repository.js` | Autorização/filtro continuam por cliente SSE; listeners fecham ao sair o último cliente |
| Cache local somente de bloqueios comprovados pelo rate limiter compartilhado | `src/security/request-protection.js` | Nenhuma requisição é autorizada por cache local; bloqueio expira ao virar o minuto |
| Backoff e limite de tentativas da inbox | `src/services/incoming-message.service.js` | Falhas recorrentes vão para `NEEDS_RECONCILIATION`; trabalhos pendentes nunca recebem expiração automática |
| Marcador permanente de conclusão da inbox | `src/services/incoming-message.service.js`, `src/database/retention.js` | Compacta payload após retenção, mantendo o mesmo ID para impedir replay |
| Callbacks de status WhatsApp idempotentes e atômicos | `src/orders/pdv.repository.js`, `src/http/app.js` | Recibo repetido não grava novamente; status não retrocede |
| Polling da expiração Pix com cursor rotativo | `src/orders/pdv.repository.js` | Pedidos após os primeiros 500 também são avaliados; cancelamento e liberação de reservas continuam transacionais |
| Consultas simultâneas ao dashboard compartilham o trabalho em andamento | `src/services/storefront-analytics.service.js` | Não há cache financeiro após a conclusão; a próxima consulta relê os recebimentos |
| Remoção do rastreamento GA4 da página administrativa | `src/http/views-admin.js` | Navegação administrativa deixa de contaminar o tráfego do catálogo |
| Plano explícito de TTL e inspeção de tipos | `config/firestore-retention-plan.json`, `scripts/inspect-firestore-retention.js` | Não ativa políticas nem exclui documentos; escrita de manutenção restrita a emulador `demo-*` |
| Histórico WhatsApp com retenção opcional por mensagem | `src/database/firestore.repository.js`, `src/database/retention.js` | Desligado por padrão; nunca aplica TTL ao documento pai `sessions` |
| Inventário estático de referências | `scripts/audit-firestore-usage.js`, `docs/firestore-collection-map.json` | Ferramenta local, sem credenciais ou acesso ao banco; complementa a auditoria manual |

O diretório de trabalho recebeu commits externos enquanto a implementação estava em andamento; parte das alterações desta rodada já pode aparecer no HEAD, e parte no diff. Nenhum commit, reset, push ou deploy foi executado por esta tarefa. Revisar os arquivos finais e os commits do intervalo, preservando outras alterações do projeto.

### Coleções e dependências revisadas

| Coleção | Escrita/consumo e política |
| --- | --- |
| `web_sessions` | `createWebSessions` emite, resolve, altera perfil e exclui no logout. `expiresAt` é Date convertido a Timestamp. Expiração lógica rejeita token antes de qualquer remoção física. TTL preparado para ativação manual |
| `request_limits` | Rate limiter transacional compartilhado, IDs hash por minuto/IP/conta, `expiresAt` temporal. Bloqueios não gravam; repetições locais de um bloqueio confirmado também não releem |
| `store_settings` | `inventory` e `storefront`; mantidos. Leituras de estoque dentro das transações não são substituídas por cache. Configurações visuais são reutilizadas apenas na mesma resposta |
| `sessions/{phone}/messages` | Histórico WhatsApp. Não confundir com login. Pais não recebem TTL; campo `historyExpiresAt` é exclusivo das mensagens e depende de política explicitamente aprovada |
| `storefront_events` | Analytics legado com IDs de evento e fallback. Histórico preservado, sem TTL. Migração para GA4 só após flags e validação da Data API |
| `pdv_outbox` | Produtores financeiros/operacionais e trabalhador. Leases, checkpoints, backoff, posse do envio, `SENDING` e conciliação são preservados. Apenas `SENT` pode ser compactado; ID e referências de provedor ficam permanentes |
| `incoming_messages` | Webhook, inbox e processamento. `PENDING`/`PROCESSING`/`NEEDS_RECONCILIATION` sem TTL. `COMPLETED` possui `completedAt` e `compactAfter`, mas `expiresAt=null`; tombstone permanente |
| `processed_messages` | API legada de deduplicação; não é chamada pelo pipeline WhatsApp atual encontrado no código. Marcadores preservados, sem TTL novo |
| `pdv_pix_events` | Eventos bancários pendentes/DONE e retries. Preservados; não aplicar TTL genérico nem remover evidência de conciliação |
| `pdv_pix_late_payments` | Pagamentos tardios que exigem conciliação. Permanentes |
| `whatsapp_delivery_events` | Recibos técnicos deduplicados por hash da mensagem/status. TTL de 30 dias preparado; estado monotônico e IDs permanecem na outbox |
| `payment_proofs` | Metadados com referência privada no Storage; associação por pedido/quitação/operador e autorização por função. Sem TTL ou limpeza financeira automática |
| `delivery_events` | Histórico completo dos estados, gravado na mesma transação do pedido. Preservado |
| `orders.deliveryHistory` | Janela de histórico embutida, limitada a 50 eventos, consumida nas telas. Mantida: remover duplicação exigiria migrar todos os consumidores |
| `delivery_driver_metrics` | Consolidação por entregador atualizada atomicamente na conclusão; idempotência da conclusão preservada. Sem TTL |
| `orders` | Registro financeiro, reservas, preços oficiais, pagamentos divididos, Pix, entregas e relatórios. Nenhuma retenção destrutiva ou mudança nas regras financeiras |
| `products`, `stock_movements` | Cadastro oficial e trilha de estoque. Validação final e atualização permanecem no backend/transações |
| `customers`, `customer_debts`, `debt_settlements` | Cadastro, crédito e fiado; preservados integralmente |
| `users`, `user_emails`, `notifications`, `discount_approvals` | Identidade, autorização e operação. Sem remoção automática nesta entrega |
| `agent_handoffs`, `agent_conversations`, `agent_pilot_carts`, `agent_synonyms` | Encaminhamento humano, pausa, referências e componentes existentes do agente. Sem TTL genérico |
| `application_errors` | Política já declarada no arquivo de índices; não se presumiu que esteja ativa na nuvem |

O inventário JSON é uma busca estática de literais, não um analisador completo: chamadas multiline, nomes dinâmicos e coleções de lojas SaaS exigem o contexto manual acima. A API genérica de lojas SaaS foi preservada; não foi truncada para otimizar a loja principal.

## B. Medições e carga isolada

Resultados completos em `docs/firestore-finops-results.json`. Dois testes de carga cobrem 100, 500 e 1.000 vendas, lotes de 20 operações, catálogo concorrente, eventos de pesquisa/visualização, inbox WhatsApp, vendas, estoque concorrente e confirmações repetidas. São mocks instrumentados: transações serializadas verificam atomicidade do modelo, mas não simulam latência de rede, contenção/retries reais do Firestore ou cobrança de índices.

### Ganho incremental da normalização do checkout da vitrine

Premissas: catálogo com 1.000 produtos, três IDs únicos por pedido e 100% dos pedidos passando por essa etapa web. A coluna anterior reconstrói a varredura usando o caminho de compatibilidade; a atual usa a implementação por IDs. Inclui duas leituras de configuração por pedido. Não inclui as transações financeiras posteriores.

| Pedidos/dia | Leituras antes | Leituras depois | Leituras evitadas/dia | Exclusões e gravações nessa etapa |
| --- | ---: | ---: | ---: | --- |
| 100 | 100.200 | 500 | 99.700 | 0 antes e depois |
| 500 | 501.000 | 2.500 | 498.500 | 0 antes e depois |
| 1.000 | 1.002.000 | 5.000 | 997.000 | 0 antes e depois |

A redução de leituras desta etapa foi aproximadamente 99,5%. Tempos locais medidos: 8.139 → 28 ms para 100 pedidos; 39.572 → 148 ms para 500; 78.149 → 269 ms para 1.000. Esses tempos incluem execução JavaScript e transformação do catálogo no mock: não são previsão de latência de produção. `measuredQueryMs` mede apenas a execução local das consultas simuladas, sem duração de RPC `getAll` ou rede.

O teste de vendas completo existente também foi executado: no cenário otimizado de 1.000 vendas houve 18.020 leituras, 14.000 gravações, zero exclusões e 1.000 envios simulados; estoque e três movimentos por venda conferidos. O comparativo desse teste reconstrói uma varredura antiga do PDV e serve para regressão da otimização anterior, não para somar a economia web duas vezes.

### Outros resultados

- Catálogo: configurações `storefront` e `inventory` lidas uma vez por resposta. Resposta seguinte relê os dados, inclusive mudanças de preço.
- Cem atualizações simultâneas do cache de catálogo existente compartilharam uma carga de 1.000 documentos; preservado, não contabilizado como novo ganho.
- Vinte relatórios simultâneos compartilham as três consultas financeiras do período. Consulta posterior observa pagamento novo, sem snapshot financeiro vencido.
- Três clientes SSE compartilham dois listeners, em vez de seis; dez clientes na mesma instância passam de vinte para dois. O número de leituras faturadas depende dos snapshots, reconexões e distribuição de clientes entre instâncias.
- Cem tentativas abusivas após o primeiro bloqueio confirmado não causaram novas leituras ou gravações naquela instância. Outras instâncias continuam validando seus próprios bloqueios no banco compartilhado.
- Callback repetido do WhatsApp não grava novamente. A primeira atualização agora lê o recibo para garantir idempotência e pode custar uma leitura adicional; o ganho é de gravações repetidas e integridade, não uma redução universal de leituras.
- Inbox de 200 mensagens: JSON do payload/estado de 90.291 para 41.401 bytes após compactação; 2.000 mensagens: 904.891 para 414.001 bytes. Redução aproximada de 54% nesse fixture. Não é tamanho físico do Firestore: IDs, metadados e índices não estão incluídos. Compactação custa leitura/gravação e não foi automatizada em produção.

## C. Economia projetada

O volume real de vendas web, visitas e mensagens ainda precisa ser medido. O cenário ilustrativo usa cinco visitas e seis eventos por visita para cada venda, e duas mensagens WhatsApp por venda. A supressão das gravações analíticas exige GA4 funcional e validado; não é economia ativa garantida.

| Vendas/dia | Eventos de navegação/dia | Gravações analíticas evitáveis/dia | Leituras web evitáveis em 30 dias | Gravações analíticas evitáveis em 30 dias |
| --- | ---: | ---: | ---: | ---: |
| 100 | 3.000 | 3.000 | 2.991.000 | 90.000 |
| 500 | 15.000 | 15.000 | 14.955.000 | 450.000 |
| 1.000 | 30.000 | 30.000 | 29.910.000 | 900.000 |

Para converter em moeda, usar **R** = tarifa efetiva por 100 mil leituras e **W** = tarifa efetiva por 100 mil gravações. Economia bruta mensal estimada: **29,91R + 0,9W**, **149,55R + 4,5W**, **299,1R + 9W**, respectivamente. As leituras web são proporcionais à participação real das vendas web; não atribuir a redução de normalização web às vendas exclusivamente de balcão.

Não foi possível confirmar edição, localização, tarifas regionais, cotas já consumidas ou faturamento. Portanto, não há valor em R$ ou US$ apresentado como economia real. Cotas gratuitas, cobrança de entradas de índice, Storage, rede, exclusões TTL e quota da Data API precisam entrar no orçamento final. TTL tem cobrança própria; não presumir limpeza gratuita. Polling de recuperação de filas continua existindo para preservar confiabilidade e também consome leituras, inclusive consultas vazias.

## D. Segurança e testes

Os testes novos exercitam checkout fresco, configurações por requisição, compactação sem perda de deduplicação, escopo da retenção, backoff, rate limiting, callbacks, listeners e relatórios concorrentes. Também há teste que impede escrita de manutenção fora de emulador local `demo-*` antes de qualquer acesso ao banco.

Os testes existentes cobrem criação/confirmação de vendas, reserva/baixa de estoque, Pix e idempotência, pagamentos divididos, fiado/crédito, comprovantes privados e permissões, entregas, autenticação, logout, expiração lógica e concorrência. Os testes de contratos HTTP e navegador ainda dependem das limitações de rede deste executor; os resultados finais estão no registro de validação ao fim do relatório.

`payment_proofs` permanece sem PDF/base64 no Firestore: o código decodifica o upload em memória, salva no bucket privado e persiste metadados. Nenhuma regra de Storage foi aberta e nenhum comprovante financeiro foi apagado. Histórico de entregas e métricas foram mantidos porque existem consumidores de ambas as representações.

## E. GA4: ativação controlada e pendências

1. Identificar a propriedade GA4 numérica correta, o stream/Measurement ID do catálogo e o fuso da propriedade. Compatibilizar o fuso com os relatórios da loja.
2. Identificar a service account usada pelo backend Cloud Run. Na administração da propriedade GA4, conceder acesso de leitura a essa identidade. Uma permissão IAM do projeto Google Cloud, isoladamente, não concede acesso à propriedade GA4.
3. Habilitar a Analytics Data API no projeto apropriado, se necessário. Usar ADC/workload identity no servidor. Não colocar tokens, arquivos de service account ou `GA4_API_SECRET` no navegador.
4. Configurar `GA4_PROPERTY_ID`. Manter `STOREFRONT_ANALYTICS_MODE=firestore` e `GA4_REPORTS_VALIDATED=false` enquanto valida os quatro relatórios usados pelo serviço e compara o dashboard.
5. Conferir no GA4 o `page_view` explícito da vitrine, `view_item`, `add_to_cart`, `begin_checkout`, busca por comprimento/contagem e campanha com rótulos controlados. Nenhuma pesquisa livre, e-mail, telefone, nome do cliente ou URL com parâmetros pessoais deve ser enviado.
6. Após validação, configurar `STOREFRONT_ANALYTICS_MODE=ga4` e `GA4_REPORTS_VALIDATED=true`. O serviço só deixa de persistir eventos redundantes se a consulta GA4 estiver funcional; em falha retorna ao coletor Firestore e informa a origem do relatório.
7. Compra criada no navegador continua sendo `order_created`. `purchase` é exportado apenas pelo backend para pedido efetivamente pago, com `transaction_id` estável, intenção durável na outbox e IDs anônimos. Exportação depende de `GA4_PURCHASE_EXPORT_ENABLED=true`, `GA4_MEASUREMENT_ID` e `GA4_API_SECRET`, além da validação anterior.

Não foi removido o histórico `storefront_events`. O dashboard financeiro continua usando o Firestore e o pagamento confirmado; não confunde pedido criado com receita. A atribuição financeira detalhada por campanha ainda não está implementada: o contrato existente sinaliza `attributedFinancialsUnavailable`, em vez de inventar receita atribuída. Isso permanece uma limitação para completar a análise de campanhas.

## F. Implantação, retenção e rollback

### 1. Preparação e identificação do banco

Nenhum comando de implantação abaixo foi executado. Primeiro, em um terminal com credenciais válidas:

```powershell
gcloud firestore databases describe --project=confloraai --database='(default)' --format='json(name,locationId,type,databaseEdition)'
gcloud firestore fields ttls list --project=confloraai --database='(default)'
gcloud firestore indexes fields list --project=confloraai --database='(default)'
```

A consulta via Firebase CLI falhou por acesso à rede; a consulta via gcloud falhou por permissão nos arquivos locais de credenciais. Não foram copiadas credenciais nem alteradas permissões do computador para contornar isso. O código continua usando o SDK servidor e operações Core já existentes, sem presumir uma mudança de edição ou introduzir Pipelines de outra edição.

### 2. Validação local e homologação

```powershell
node --import ./scripts/test-env.js --test test/firestore-finops-regression.test.js test/firestore-optimization.test.js
node --import ./scripts/test-env.js --test test/firestore-finops-load.test.js test/firestore-load.test.js
npm run test:dev
npm run build
npm run lint
npm run test:e2e
```

Revisar o código final e os commits/diffs, publicar primeiro em homologação pelo processo existente do projeto e validar autorização por função, relatórios, estoque concorrente e callbacks. Nenhum índice composto novo passou a ser requisito: paginação usa os filtros atuais com ordenação por ID. Os índices existentes foram preservados. Não executar exclusão global de índices.

### 3. Inspeção e compactação

Inspeção é somente leitura, exige projeto explícito e tem limite por execução; revisar indicadores `truncated` antes de tirar conclusões:

```powershell
$env:GOOGLE_CLOUD_PROJECT='confloraai'
node scripts/inspect-firestore-retention.js
```

O script verifica elegibilidade de compactação, expiração insegura na inbox e tipo dos campos TTL nas três coleções propostas. Não lista conteúdo de mensagens, documentos ou credenciais no relatório. Não ativa políticas, não exclui documentos e não percorre/exclui subcoleções de conversas.

Teste de escrita permitido somente com emulador em execução e namespace `demo-*`:

```powershell
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:GOOGLE_CLOUD_PROJECT='demo-conflora-retention'
node scripts/inspect-firestore-retention.js --apply
```

Nunca usar esse bloco com credenciais de produção. O script recusa `--apply` sem emulador local ou fora de `demo-*`. Compactação de produção precisa de uma etapa futura aprovada; não foi criada uma rota pública ou um job com poder de apagar registros financeiros.

### 4. TTL: ativar somente após inspeção e aprovação

O plano em `config/firestore-retention-plan.json` não é implantado por `firebase deploy`. Campos Date gravados pelo SDK são Timestamp no Firestore; strings de data não são tratadas como TTL válido. Confirmar tipos e escopo antes de ativar. Exemplo para login, repetindo depois para `request_limits` e `whatsapp_delivery_events` após a mesma revisão:

```powershell
gcloud firestore indexes fields update expiresAt --collection-group=web_sessions --database='(default)' --project=confloraai --disable-indexes
gcloud firestore fields ttls update expiresAt --collection-group=web_sessions --database='(default)' --project=confloraai --enable-ttl
gcloud firestore fields ttls list --collection-group=web_sessions --database='(default)' --project=confloraai
```

As três coleções consultam os registros por ID/estado, não por `expiresAt`; a isenção é proposta somente para esse campo. Verificar configuração real antes de alterar uma isenção existente. Não aplicar TTL a `pdv_outbox`, `incoming_messages`, `processed_messages`, `orders`, comprovantes ou eventos financeiros. Se a inbox já tiver política TTL real, revisar e desabilitar essa política antes de depender da compactação permanente; registros antigos ainda podem possuir `expiresAt`.

Não aplicar TTL ao pai `sessions`: exclusão do pai não remove subcoleções. Histórico opcional utiliza `WHATSAPP_HISTORY_RETENTION_DAYS` entre 90 e 3.650 e o campo `historyExpiresAt` no grupo `messages`, ambos desligados por padrão. Exige política de retenção aprovada e inspeção de todas as coleções chamadas `messages`; campos históricos não são retroativamente preenchidos. Considerar conversas humanas abertas/auditorias antes de habilitar uma política global.

Logout e expiração lógica não dependem do TTL. A exclusão física é assíncrona e não deve ser usada como controle de autenticação.

### 5. Rollback

- Aplicação: reverter somente os arquivos/commits desta mudança após identificar os commits externos, sem reset destrutivo do diretório compartilhado. Os documentos novos continuam compatíveis.
- Analytics: voltar `STOREFRONT_ANALYTICS_MODE=firestore`, `GA4_REPORTS_VALIDATED=false` e, se necessário, `GA4_PURCHASE_EXPORT_ENABLED=false`. O histórico legado continua presente.
- TTL: `gcloud firestore fields ttls update expiresAt --collection-group=web_sessions --database='(default)' --project=confloraai --disable-ttl`, repetindo somente para políticas efetivamente ativadas. Desabilitar TTL não restaura documentos já excluídos; restaurar exige backup/PITR existente e procedimento separado.
- Isenção de índice: se criada por esta implantação e necessário restaurar o padrão anterior, usar `gcloud firestore indexes fields update expiresAt --collection-group=web_sessions --database='(default)' --project=confloraai --clear-exemption`, após comparar com a configuração previamente registrada.
- Retenção WhatsApp: remover a variável desliga o preenchimento de datas para mensagens novas. Se a política opcional foi ativada, desabilitá-la também; remover a variável não cancela datas já gravadas.

Configuração de tentativas: inbox `INCOMING_MAX_ATTEMPTS` (padrão 12), outbox `PDV_OUTBOX_MAX_ATTEMPTS` (padrão 12); após o limite requerem conciliação operacional. Retenção de payloads `PDV_OUTBOX_RETENTION_DAYS` e `INCOMING_RETENTION_DAYS` (padrão 30), sempre sem apagar os marcadores permanentes.

## Referências oficiais

- [TTL do Firestore](https://firebase.google.com/docs/firestore/ttl).
- [Atualizar TTL via gcloud](https://docs.cloud.google.com/sdk/gcloud/reference/firestore/fields/ttls/update).
- [Isenções de índices por campo](https://docs.cloud.google.com/sdk/gcloud/reference/firestore/indexes/fields/update).
- [GA4 Data API — runReport](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport).
- [Preços do Firestore por localização](https://cloud.google.com/firestore/pricing).

## Registro final de validação

| Verificação executada | Resultado |
| --- | --- |
| Regressão focada de FinOps + otimizações existentes | 28 testes aprovados, sem falhas |
| Duas suítes de carga instrumentada | Aprovadas nos cenários 100/500/1.000; sem serviços reais |
| Suíte geral `npm run test:dev` | 323 testes: 274 aprovados, 48 falhas `connect EACCES 127.0.0.1`, 1 ignorado por ausência de emulador |
| Subconjunto ampliado de agente, PDV, integridade e entregas | 150 testes: 134 aprovados, 16 falhas de conexão local, sem falha funcional adicional identificada |
| `npm run build` | Aprovado, incluindo `check:full` |
| Lint dos arquivos desta alteração | Aprovado sem erros |
| Lint geral | Reprovado por erros preexistentes da vitrine/scripts/teste antigo; não foram corrigidos arquivos alheios ao escopo |
| `git diff --check` | Aprovado |
| Playwright | Tentativa com prazo reduzido para inicialização; permaneceu na inicialização do servidor e foi interrompida. Não houve aprovação e2e/visual |
| Consulta remota de edição/TTL | Bloqueada por rede/permissão local; nenhum estado remoto presumido |
| Deploy, TTL real, carga em produção e mensagens reais | Não executados |

Foram acrescentados 12 testes de regressão e uma suíte de carga incremental; a suíte anterior de FinOps foi ajustada para testar explicitamente o backoff e o marcador permanente da inbox. Os registros de validação locais ficam em `tmp/finops-*.log`; o relatório JSON de medições foi copiado para `docs/firestore-finops-results.json`.

As 48 falhas da suíte geral foram inspecionadas e todas apresentaram `EACCES` ao conectar ao loopback; não são apresentadas como testes aprovados. Reexecutar os contratos HTTP, permissões de comprovantes por rota e o Playwright em um ambiente que permita conexões locais. Testes simulados não homologam credenciais, TTL, índices remotos ou entrega real de mensagens.
