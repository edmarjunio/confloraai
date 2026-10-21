# Firestore: auditoria e implantação controlada

Auditoria local em 21/10/2026, antes das alterações desta tarefa. Projeto configurado: `confloraai`. Existem modificações anteriores no working tree; não foram revertidas. Não houve acesso a documentos de produção. A CLI Firebase retornou credenciais expiradas; gcloud não conseguiu abrir seu diretório de credenciais. Edição do banco, IAM, regras efetivas, índices implantados e TTL ativos **não verificados**. Não provisionar nem trocar a edição do banco para aplicar este trabalho.

## Mapa de dados e dependências

| Coleção | Escrita e leitura | Retenção / decisão |
| --- | --- | --- |
| web_sessions | security/web-session: emissão, resolução, troca de perfil, logout | Login de equipe, 12 horas; validação lógica em cada acesso, sem cache de autorização. Date serializado pelo SDK como Timestamp. TTL somente depois de revisão. |
| stores/{tenant}/sessions | storefront/auth: emissão, resolução, invalidação | Login de clientes, distinto de sessions raiz; não habilitar TTL genérico para collection group sessions. |
| sessions/{phone}/messages | database/firestore.repository: appendMessage, getSessionHistory | Conversas WhatsApp; leitura dos últimos 10; pai não é equivalente a login. Sem exclusão automática, subcoleções preservadas. |
| storefront_events | http/app: ingestão; database/firestore.repository: resumo; views-admin: consumidor | Histórico de navegação; manter enquanto GA4 não validado. Navegador não é fonte financeira confiável. |
| store_settings | database/firestore.repository: inventory; storefront/existing-store: configuração pública; agent/product-source | Permanente. Estoque e checkout usam leitura atual/transacional. Não introduzir cache de preço/estoque. |
| request_limits | security/request-protection: transação de contador por minuto, IP e conta | Janela lógica independente de TTL, proteção entre instâncias; bloqueios não escrevem. Sem cache permissivo local. |
| pdv_outbox | orders/pdv.repository e service; conversation-outbox, message.service, manual-pix, customer-debt-pix, fechamentos | Fila persistente; IDs determinísticos, claim transacional, checkpoints e backoff existentes. Consultas de retry sem limite e janela incerta entre envio e persistência identificadas. Manter tombstone para deduplicação. |
| incoming_messages | incoming-message.service: accept/claim/finish/retry; webhook e tarefas | Payload durável, lease e proprietário; expiresAt estava sendo gravado inclusive após erro. Nunca expirar pendências. |
| processed_messages | firestore.repository: isDuplicateMessage/markMessageProcessed | Deduplicação durável existente; preservar, sem TTL automático. |
| pdv_pix_events | webhook app e pdv.service | Pendentes reprocessados; DONE preservado como prova de idempotência. Sem TTL financeiro. |
| whatsapp_delivery_events | webhook app | Deduplicação de callbacks por message/status/timestamp; Date de 30 dias existente. Não habilitar TTL sem revisão da janela de replay. |
| orders | PDV, catálogo existente e compatibilidade legada; recibos, relatórios e entregas | Permanente. Preços, reserva, baixa, partes de pagamento e recebimento protegidos por transações; não reescrever. |
| payment_proofs | pdv.routes, manual-pix.routes, payment-proof | Metadados no Firestore; arquivos privados payment-proofs/{uuid} no Storage; acesso por função/operador/pedido; sem TTL financeiro. IAM/ACL reais do bucket pendentes de validação externa. |
| delivery_events | delivery-metrics, chamado dentro da transação de entrega | Histórico completo; manter. |
| orders.deliveryHistory | mesmos fluxos; telas/recibos | Projeção limitada aos últimos 50 eventos; duplicação intencional para leitura do pedido. Não remover antes de migrar consumidores. |
| delivery_driver_metrics | pdv.repository, pdv.service | Consolidado por entregador, atualização na mesma transação da conclusão. Preservar. |
| products/product_images/stock_movements | repository, catálogo, importações e PDV | Permanente; movimentações auditáveis, reserva/baixa transacionais. Catálogo possui cache e agente revalida produtos. |
| customers/customer_debts/debt_settlements/customer_pix_charges | repository e serviços de fiado/Pix | Financeiros permanentes; preservar quitações parciais, saldos e IDs idempotentes. |
| users/user_emails | repository e autenticação | Permissões e identidade; sem cache de autorização ou TTL. |
| cashier_closings/discount_approvals/order_alterations/notifications | repository e rotas administrativas | Auditoria comercial; não remover. |
| application_errors | error-history.service | Já existe TTL declarado de 30 dias em firestore.indexes.json; isso não comprova implantação. |
| product_imports/learned_tags/agent collections/stores subcollections | importação, learning, agent-store, StoreRepository | Sem nova política genérica; handoffs e conversas preservados. StoreRepository.list e algumas consultas legadas ainda precisam paginação específica por consumidor. |

Listeners: PDV usa duas consultas limitadas de pedidos por conexão; unsubscribe existente. Não remover tempo real sem redesenhar o contrato SSE. Relatórios executivos já paginam por 1.000 documentos; não substituir por um limite que trunque valores financeiros. Exclusões existentes incluem logout e ferramentas de reset/importação; estas não foram executadas.

## Restrições

Nenhum deploy, limpeza real, backfill ou habilitação TTL foi autorizado nesta tarefa. Nenhum índice existente foi removido. Comandos preparados abaixo não foram executados em produção.

## A. Implementação concluída

- **PDV**: `getProductsByIds` lê somente os IDs distintos da venda, em grupos de até 100, sem cache e sem fallback para preços em memória em caso de falha do banco. Antes, `PdvService.create` carregava todos os produtos. Leituras simples do PdvRepository deixam de abrir transações desnecessárias. Configuração de estoque no recebimento passa a ser lida na própria transação; falha de leitura da configuração interrompe a operação em vez de reutilizar estado local.
- **Fila**: `scanPage` usa índice automático de igualdade + ID do documento, limite e cursor rotativo. Outbox/Pix processam páginas de 100; mensagens recebidas reservam 25 posições para pendentes e 25 para interrompidas, evitando que uma categoria bloqueie a outra. Claim recebe proprietário aleatório, lease e teto configurável de tentativas (12 por padrão). Checkpoints do trabalhador verificam proprietário; alterações sem efeito não escrevem novamente.
- **Envio**: estado SENDING é persistido antes de cada chamada ao provedor. Aceitação salva checkpoint e ID do provedor. Falhas comprovadamente anteriores ao envio (inclusive upload de mídia) mantêm backoff. Timeout/queda depois da tentativa, falha de persistência depois de aceitação ou crash durante SENDING vão para `NEEDS_RECONCILIATION`; não há retry automático desse estado. A Meta não oferece uma transação atômica com Firestore: não se promete entrega exactly-once. Essa escolha evita repetir uma mensagem cuja aceitação não se consegue determinar.
- **Retenção**: somente mensagens incoming COMPLETED recebem Date de expiração; PROCESSING/PENDING recebem null, incluindo a remoção de um prazo antigo ao retomar. `retention.js` compacta mensagens outbox SENT após prazo configurável, preservando no mesmo ID status, referência financeira e IDs/checkpoints de envio. Tombstone não expira. Pendentes, falhas incertas e SKIPPED não são compactados. O script de manutenção é read-only por padrão e só aceita `--apply` com emulador loopback. Não agenda nem executa limpeza de produção.
- **Autenticação**: troca de perfil recusa sessão vencida e usuário inativo; resolução e logout continuam consultando/removendo a sessão. Sessões de cliente recebem kind LOGIN e invalidação como Date(0), distinguindo-as das conversas. Nenhum TTL genérico em sessions.
- **Analytics**: serviço backend com Data API, ADC, cache de navegação de 60 segundos, coalescência de chamadas e recuo de 60 segundos após falha da API. Sem Redis ou serviço novo. Coleta Firestore continua por padrão. GA4 só substitui essa coleta com modo ga4, propriedade numérica e confirmação explícita de validação; indisponibilidade detectada mantém/reinicia coleta Firestore. Uma falha no intervalo de cache pode demorar até 60 segundos para ser detectada; isso não é uma migração atômica nem substitui monitoramento. Histórico existente não é apagado.
- **Eventos**: page_view automático da configuração gtag desabilitado em favor do explícito; UUID consistente entre os dois destinos; create por ID no Firestore impede regravação e mudança da data no retry. Checkout emite order_created; eventos purchase informados pelo navegador são ignorados como fonte financeira. Busca envia somente comprimento e quantidade de resultados, sem termo. Localização/referrer/título do GA4 são sanitizados e UTM aceita somente rótulos restritos; nomes de clientes, telefones, e-mails, endereços, nomes de itens e segredos não entram no payload de eventos implementado.
- **Compra GA4 opcional**: após pagamento integral aprovado de um WEB_CATALOG, com identificador anônimo válido e flags habilitadas, a transação de recebimento cria um único job `ga4-purchase` na outbox. Exportação via Measurement Protocol exclusivamente pelo servidor. transaction_id é o ID persistente do pedido, cliente anônimo coincide com o configurado na tag. Sem backfill de pedidos antigos, exportação de fiado, exportação de pedidos pendentes ou cobrança bancária adicional. Credenciais e validação externa continuam pendentes. 2xx confirma transporte, não processamento semântico pelo GA4.
- **Painel**: contrato principal mantido. Tráfego vem do GA4 quando habilitado, com fallback identificado; pagamentos vêm de consultas por período paginadas ao Firestore, usando o mesmo paymentFacts dos relatórios financeiros, inclusive parcelas recebidas. Compra contabilizada somente com paidAt e status de pagamento aprovado. Conversão passa a ser pedidos pagos / visitantes, identificada na interface. Crédito de cliente/fiado não são tratados como dinheiro novo. Essas consultas financeiras não usam o cache de navegação nem truncam valores em 10.000 documentos. Falha de banco gera erro, sem inventar faturamento parcial.
- **Limitação de atribuição**: cartões de campanhas mantêm visitas; compras/faturamento por campanha são marcados como indisponíveis, pois o histórico de purchases do navegador não comprova recebimento. Não se reaproveitaram números falsos. Atribuição financeira por campanha/sessão exige validação adicional no GA4; envio de client_id ajuda a vincular eventos, mas não garante atribuição em compras tardias. Produtos no painel usam quantidades de pedidos integralmente pagos.
- **Comprovantes/entregas**: nenhuma exclusão, alteração de armazenamento ou remoção das fontes existentes. Metadados financeiros, arquivos privados e transações das métricas preservados. Corrigida também referência JavaScript já indefinida no atalho Minha conta, encontrada pelo lint no arquivo modificado.

Arquivos centrais: `src/database/firestore.repository.js`, `src/orders/pdv.repository.js`, `src/orders/pdv.service.js`, `src/services/incoming-message.service.js`, `src/services/storefront-analytics.service.js`, `src/integrations/ga4-purchase.client.js`, `src/integrations/whatsapp.client.js`, `src/database/retention.js`, `src/security/web-session.js`, `src/storefront/auth.js`, `src/storefront/existing-store.js`, `src/http/app.js`, `src/http/views-admin.js`, `public/storefront/app.js`, `public/storefront/cart.js`. Configurações, manutenção e testes estão nos arquivos novos associados. `google-auth-library` já estava instalada transitivamente; agora é dependência direta fixada em 10.9.1.

## B. Medição reproduzível

Resultados completos em `FIRESTORE-LOAD-RESULTS.json`. `test/firestore-load.test.js` executa o mesmo fluxo atual duas vezes, substituindo **somente** a leitura por IDs pela antiga leitura integral na variante A. Assim, a diferença isola a otimização do catálogo; os totais A não pretendem reproduzir todo o sistema anterior às demais correções.

Ambiente: mock instrumentado, transações serializadas, 1.000 produtos, 3 produtos distintos por venda, 20 checkouts simultâneos; criação, recebimento em dinheiro, estoque, recibo WhatsApp simulado e 20 confirmações repetidas por cenário. Não é medição da latência, contenção, billing ou retries reais do Firestore. O mock conta documentos de leitura/gravação/exclusão e consultas; não mede entradas de índice, rede, CPU do Cloud Run, Storage ou tarifas bancárias/Meta.

| Vendas simuladas | Leituras com catálogo inteiro | Leituras por IDs | Leituras evitadas | Gravações A / B | Exclusões A / B |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 101.520 | 1.820 | 99.700 | 1.400 / 1.400 | 0 / 0 |
| 500 | 507.520 | 9.020 | 498.500 | 7.000 / 7.000 | 0 / 0 |
| 1.000 | 1.015.020 | 18.020 | 997.000 | 14.000 / 14.000 | 0 / 0 |

Consultas integrais de produtos: 100/500/1.000 para zero; substituídas por batch-get dos IDs. A consulta paginada da fila limita a 100 documentos em vez de carregar N antes de fatiar; cursor garante que registros adiados não prendam permanentemente os seguintes durante execução de uma instância. Cursores são locais ao processo; cold starts repetidos podem atrasar a varredura, mas a exclusão mútua é persistente.

Outros ensaios: 100 refreshes simultâneos do catálogo resultaram em uma carga de 1.000 documentos (cache já existente, não ganho novo); 1.000 eventos resultaram em 1.000 gravações no modo fallback e zero no modo GA4 validado; 100 mensagens recebidas foram concluídas e recusaram novo processamento; 20 consultas concorrentes ao mesmo relatório GA4 compartilharam 4 requests. Navegação legada também compartilha resumo por 60 segundos. Resultados de tempo de execução do mock constam no JSON e **não** devem ser interpretados como latência de produção.

## C. Projeção de economia — estimativas condicionais

Para catálogo com P produtos e U IDs distintos por venda, leitura de validação cai de P para U. Ganho diário: S × (P − U), onde S é número de vendas PDV. Não foi contado o catálogo real de produção. Se ele tem menos de 1.000 produtos, recalcular.

Modelo ilustrativo: P=1.000, U=3; 10 visitas ao catálogo por venda, 5 eventos por visita, 2 atendimentos WhatsApp por venda. Mês de 30 dias. Ganho de eventos só existe depois de habilitar e validar GA4; inicialmente é zero.

| Vendas/dia | Visitas/dia (hipótese) | Atendimentos WA/dia (hipótese) | Leituras PDV evitadas/mês | Gravações de navegação evitadas/mês, GA4 ativo |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 1.000 | 200 | 2.991.000 | 150.000 |
| 500 | 5.000 | 1.000 | 14.955.000 | 750.000 |
| 1.000 | 10.000 | 2.000 | 29.910.000 | 1.500.000 |

Custos adicionais de integridade: aproximadamente uma gravação SENDING por chamada de mensagem ao provedor; exportar purchase GA4 adiciona aproximadamente quatro gravações por compra (intenção, claim, SENDING, conclusão), além de leituras. Retenção compactada custa uma leitura/gravação de manutenção antes de economizar armazenamento futuro. TTL gera exclusões faturáveis e não é limpeza instantânea/grátis. Mensagens incoming, processed_messages e tombstones continuam necessários; não se promete eliminar seu custo. Relatórios financeiros exatos acrescentam consultas por data ao painel de eventos, podendo ler um mesmo pedido em mais de um campo de data. Não se afirma redução líquida de todas as gravações/leituras do sistema.

Para monetizar sem inventar tarifa/região: seja R a tarifa vigente por 100.000 leituras e W por 100.000 gravações no banco real. Economia bruta mensal PDV = 29,91R / 149,55R / 299,10R nos três cenários. Economia bruta de eventos = 1,5W / 7,5W / 15W quando GA4 ativo. Subtrair operações adicionais descritas, aplicar franquias e impostos/câmbio. Região/edição/quantidade real de produtos e billing não puderam ser consultados; **não há estimativa monetária real da conta**. Nenhum Redis, BigQuery, job pago ou outro serviço recorrente foi adicionado.

## D. Validação e limites

Comandos executados sem produção:

```powershell
npm run build
npm run check:full
npm run lint
npm run test:dev
node --import ./scripts/test-env.js --test test/firestore-optimization.test.js test/firestore-load.test.js
npm run test:e2e
node scripts/inspect-firestore-retention.js --apply
```

Baseline: 290 testes, 241 aprovados, 48 falhas HTTP por EACCES em 127.0.0.1 e 1 teste de emulador pulado. Após mudanças: 307 testes, 258 aprovados, as mesmas 48 falhas de conexão e 1 emulador pulado. Uma comparação automática confirmou que os 48 locais de falha são idênticos aos do baseline. Os 17 testes novos (16 de otimização e um de carga) passam. Build/check sintático passam. Lint dos arquivos desta implementação passa; lint global ainda encontra problemas anteriores em outros arquivos (button-3d, tab-session, team-drawer, topbar, reset-and-seed-real-catalog e smart-receipt-and-payments, além de warnings de agent). A suíte E2E ficou aguardando disponibilidade do servidor local e foi interrompida sem validar telas; não está aprovada. O comando de manutenção com --apply sem emulador foi recusado antes de acessar qualquer banco.

Cobertura positiva nas suítes de domínio e novos testes: vendas, confirmação repetida, reserva/baixa, pagamentos divididos, Pix verificado e manual, fiado/crédito, checkpoints de WhatsApp, interrupções de jobs, expiração/logout/perfis, rate limiting entre instâncias, métricas de entrega, comprovantes vinculados e payload GA4 sem PII. As permissões por HTTP, webhook HTTP e telas abrangidas pelos testes bloqueados não foram aprovadas por esta execução. Mock transacional exige leituras antes de gravações, mas serializa concorrência; contenção/retries em Firestore real exigem emulador/homologação. Nenhum teste de carga usou banco, WhatsApp, Sicredi ou GA4 reais. Clientes GA4 recusam rede real em NODE_ENV=test.

Dois testes antigos de retry passaram a marcar explicitamente uma falha anterior à submissão da mensagem. Uma exceção genérica de rede agora representa resultado incerto; os novos testes asseguram que ela não provoca reenvio.

## E. Pendências externas

1. Renovar autenticação das CLIs e confirmar projeto, banco `(default)`, edição, região, índices e políticas TTL efetivas. Configuração local não é prova de implantação. Não habilitar Enterprise nem criar um novo banco para este trabalho.
2. GA4: localizar o **ID numérico da propriedade**, habilitar Data API e dar papel Viewer na propriedade à identidade de serviço do Cloud Run. ADC/workload identity no servidor; não publicar chave JSON. Definir GA4_PROPERTY_ID e testar tráfego, produtos e campanhas em homologação antes de mudar o modo. A propriedade deve usar fuso America/Sao_Paulo para comparar dias com Firestore.
3. Desabilitar no fluxo GA4 a medição aprimorada que gere page_view por histórico/formulários/termos de busca/links com parâmetros privados, validar no DebugView que existe apenas um page_view por carregamento e revisar qualquer tag/GTM externa. A alteração de send_page_view no código não substitui revisão da configuração externa.
4. Para exportação de purchase: criar Measurement Protocol API secret do mesmo fluxo, mantê-lo no ambiente seguro do servidor e validar payload no endpoint de debug do GA4 antes de habilitar GA4_PURCHASE_EXPORT_ENABLED. Nenhum evento purchase real foi enviado. Falta comprovar atribuição real a campanhas/sessões e compatibilidade dos relatórios nessa propriedade.
5. Auditar IAM/ACL real do bucket de comprovantes e regras Storage/Firestore em homologação. Não alterar ACL nem política financeira sem aprovação. Manter comprovantes, orders, Pix, saldos e entregas permanentes.
6. TTL de incoming só pode ser considerado depois de comprovar a janela de reentrega/replay, o uso consistente da deduplicação permanente e remover expiresAt legado de pendências sob autorização. **Não está incluído no arquivo TTL preparado.** processed_messages, outbox, sessions, provas e eventos financeiros não recebem nova exclusão automática.
7. Queries legadas restantes: getAllProducts para indexação/importação, StoreRepository.list, contas de clientes, notificações/listeners e relatórios grandes ainda podem exigir trabalho específico. Não foram artificialmente limitados quando isso perderia histórico, saldos ou contratos. Expiração Pix ainda usa consulta limitada existente; testar grande backlog em homologação antes de refatorar consultas/indexação.

## F. Ordem de implantação e rollback

Não executar os comandos de alteração de produção abaixo sem autorização posterior. Repositório tem trabalho anterior misturado: revisar diff por arquivo e criar commit isolado por alteração; não usar git reset/checkout para desfazer arquivos inteiros do usuário.

### 1. Validar destino e estado atual (read-only)

```powershell
firebase login --reauth
firebase firestore:databases:list --project confloraai
firebase firestore:databases:get '(default)' --project confloraai
gcloud firestore fields ttls list --project=confloraai --database='(default)'
```

Confirmar edição/região e copiar o resultado para a revisão da implantação. As consultas novas de fila não precisam de índice composto novo; verificar índice automático de status e ordenação por documento no emulador/homologação. `firestore.indexes.json` existente foi preservado.

### 2. Homologação isolada

```powershell
firebase emulators:start --config firebase.dev.json --only firestore --project demo-conflora-tests
# Em outro terminal, com emulador local ativo:
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'
$env:GOOGLE_CLOUD_PROJECT='demo-conflora-tests'
npm run test:dev
node scripts/inspect-firestore-retention.js
node scripts/inspect-firestore-retention.js --apply
```

Usar porta efetiva do emulador, não presumir 8080 caso a configuração local use outra. Conferir que FIRESTORE_EMULATOR_HOST e GOOGLE_CLOUD_PROJECT não vazem para o deploy. Script não imprime payloads, telefones, credenciais ou dados de pedidos. Reexecutar manutenção deve resultar em zero novos candidatos já compactados. Mock de carga é a alternativa disponível nesta execução; emulador requer instalação Java/runtime compatível.

### 3. Publicar código posteriormente, com flags conservadoras

Instalar dependências do package.json pelo fluxo habitual e implantar apenas após revisão/autorização; usar o pipeline existente, sem copiar segredos para arquivos públicos. Começar com STOREFRONT_ANALYTICS_MODE=firestore, GA4_REPORTS_VALIDATED=false e GA4_PURCHASE_EXPORT_ENABLED=false. Nenhuma mudança de preço/estoque fica atrás de cache novo. Monitorar erro de validação, fila pendente, NEEDS_RECONCILIATION, tempo de confirmação e integridade financeira.

### 4. Ativar Analytics separadamente

Configurar propriedade/identidade, habilitar API no projeto correto depois de autorização:

```powershell
gcloud services enable analyticsdata.googleapis.com --project=confloraai
```

Validar a API e o painel em homologação; então definir GA4_REPORTS_VALIDATED=true e STOREFRONT_ANALYTICS_MODE=ga4. Exportação de compras é outra flag e requer secret/teste próprios. Manter histórico Firestore. Se GA4 cair, há fallback marcado e coleta Firestore retomada quando a falha for detectada; GA4 continua sujeito a bloqueadores/consentimento no navegador e atrasos de processamento.

### 5. TTL separado, somente após aprovação explícita

O arquivo `config/firestore-retention.staged.json` não está ligado ao deploy padrão. Ele prepara somente web_sessions/request_limits, sem aplicar nada ao banco. Se a edição confirmada e a revisão de documentos aprovarem políticas TTL por campo, comandos sugeridos:

```powershell
gcloud firestore fields ttls update expiresAt --collection-group=web_sessions --enable-ttl --project=confloraai --database='(default)'
gcloud firestore fields ttls update expiresAt --collection-group=request_limits --enable-ttl --project=confloraai --database='(default)'
gcloud firestore fields ttls list --project=confloraai --database='(default)'
```

Revisar isenções de índice para expiresAt separadamente, sem substituir o manifesto inteiro pelo arquivo staged (isso poderia remover índices existentes). TTL não é controle de autorização e não remove subcoleções. Não ligar TTL genérico de sessions nem de pdv_outbox; não ativar incoming antes de corrigir dados antigos e aprovar sua janela de deduplicação.

### 6. Rollback

- Analytics: voltar STOREFRONT_ANALYTICS_MODE=firestore, GA4_REPORTS_VALIDATED=false, GA4_PURCHASE_EXPORT_ENABLED=false. Histórico mantido; a lacuna de navegação do período exclusivamente GA4 não é restaurada ao Firestore automaticamente.
- Código: reimplantar versão anterior revisada se necessário, mas **não reintroduzir um worker antigo sobre jobs SENDING/NEEDS_RECONCILIATION sem revisão da fila**. Fazer rollback parcial preservando a proteção de envios incertos. Não limpar leases/status para forçar reenvio; um operador deve conferir IDs do provedor e o estágio enviado antes de qualquer liberação manual autorizada.
- TTL: desabilitar política, por exemplo `gcloud firestore fields ttls update expiresAt --collection-group=web_sessions --disable-ttl --project=confloraai --database='(default)'`, e equivalente para request_limits. Isso não recupera documentos já apagados. Nenhum comando de ativação foi executado.
- Compactação: não é reversível sem backup do payload; manter tombstone e referências. O script não permite mutação de produção nesta entrega. Políticas financeiras e dados reais ficam intactos.

## Fontes oficiais consultadas

- [Retenção TTL e subcoleções](https://firebase.google.com/docs/firestore/ttl)
- [Cobrança do Firestore](https://cloud.google.com/firestore/pricing)
- [GA4 Data API](https://developers.google.com/analytics/devguides/reporting/data/v1/basics)
- [GA4 Measurement Protocol e validação](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events?client_type=gtag)
