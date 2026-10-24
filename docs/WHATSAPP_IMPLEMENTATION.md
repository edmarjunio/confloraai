# Atendimento WhatsApp — entrega local de 23/10/2026

**Implementação local, sem homologação funcional ou de performance. Não publicar nem operar automaticamente em 24/10 apenas por causa da data.** Este documento substitui a descrição de atendimento dos relatórios históricos. Não comprova aprovação, entrega Meta, vínculo de catálogo ou liquidação Sicredi.

[Manifesto completo de arquivos](WHATSAPP_CHANGED_FILES.md) e [registro das checagens estáticas](whatsapp-static-validation-2026-10-23.json). Resultado final: sintaxe de 35 arquivos JS sem falhas, ESLint completo com código 0, TypeScript `--noEmit` com código 0, JSX analisado em memória e diff sem erros de whitespace. Esses resultados não executam nem substituem homologação.

## Revisões e preservação

Início: branch `main`, `f7ec6478b5ee79614f6fa7ff8d03d88e286ec3e6`, árvore limpa. Durante a implementação houve commits/merge feitos externamente a este agente. As gravações foram suspensas; o usuário confirmou “Já realizei todas alterações, pode continuar / Main atualiazda”. Continuação sobre `aeb65b6a7dc1464ae9ff1cd94fcc39d24be04204`, novamente limpa. O agente não executou commit, staging, merge, pull ou deploy. Parte das primeiras alterações foi incorporada pelo trabalho externo; avaliar também o diff cumulativo desde `f7ec647`, além do diff local contra `aeb65b6`.

Não houve exclusão/migração de documentos Firestore, alteração de credenciais, assinatura de eventos na Meta, publicação de função, sincronização real, envio real ou inicialização de servidor. Pix manual, comprovantes, conciliação financeira, simulador isolado e cliente Sicredi real aguardando liberação continuam nos serviços originais.

## Caminho e evidência estática

| Entrada real | Consumidor e resultado |
| --- | --- |
| `POST /webhook`, em `src/http/app.js` | Assinatura → WABA/número → normalização → `incoming.accept` → mesma fila Cloud Tasks/inbox. Conta ausente retorna 503; conta divergente não é processada. |
| `src/integrations/whatsapp-inbound.js` | `button.payload`, `interactive.button_reply.id`, `interactive.list_reply.id` e títulos legados reconhecidos; `order.product_items` validado e preços recebidos descartados. |
| `src/http/incoming-task.js` | Autentica worker e relê o payload persistido pelo ID. Não aceita substituir produtos/ações pelo corpo da tarefa. |
| `MessageService.sendMainMenu` | Chama transporte durável e `sendWelcomeTemplate`, que monta `type: template`, imagem e componentes conferidos. Não existe menu genérico nesse caminho. |
| `montar_sacola` / `btn_sacola` | `WhatsAppClient.sendCatalogMessage` → `interactive.type: catalog_message`, `action.name: catalog_message`; sem categorias próprias. |
| `btn_atendente` | Mensagem curta solicitada → canal `agent` → `SalesConversationService.handle`. |
| Texto objetivo | `sales-parser.js` antes de `extractSalesIntent`; sem chamada Gemini nos formatos determinísticos. |
| Carrinho recebido | `receiveMetaCart` → produtos oficiais por ID → resumo/backend → entrega/endereço/taxa → pagamento → `FINAL_CONFIRMATION` → `OrderService.confirmOrder` → `createCommercialOrder`. |
| Encomenda aceita | `registerProcurement` reutiliza `OrderIntakeService.register`; cotação/aceite/sinal/chegada continuam em `ProcurementWorkflowService`. |
| Envio | `durable-conversation-transport`, `PdvService.deliver`/`deliverCatalog` e guard final em `WhatsAppClient.postRequest`. |

O núcleo comercial vincula `conversationId` na comanda, `orderId` na conversa, telefone validado, origem `WHATSAPP_BOT`, itens e preços atuais, modalidade de entrega e pagamento pendente. A reserva do núcleo existente não equivale à baixa física ou quitação. Submissões anteriores da mesma comanda retornam sua identidade estável.

## Fluxo dos três botões

1. **Catálogo virtual:** CTA URL do template aprovado abre o site diretamente. Abrir a URL não gera mensagem adicional. A Meta controla o comportamento do navegador; não há promessa de nova aba/navegador externo. Callback de um menu antigo reapresenta o template, sem enviar texto com link.
2. **Montar minha sacola:** mensagem oficial de catálogo. A plataforma exige o toque no botão de abrir catálogo e o envio explícito do carrinho; escolha de vários produtos e quantidades ocorre na interface nativa, quando habilitada. Sem habilitação, o cliente recebe a pendência e pode comprar por texto. Nenhuma lista própria simula o carrinho nativo.
3. **Falar com atendente:** “Olá! 🌱 Sou o assistente virtual da Conflora. O que você procura?”. Pedidos objetivos seguem sem Gemini. Pedido explícito de pessoa transfere à equipe e mantém pausa até retomada autorizada.

`menu` reapresenta o template somente quando permitido. `reiniciar` e `recomeçar conversa` arquivam o contexto ativo, preservam dados/rascunhos comerciais e pausa, e reapresentam o template quando autorizados. Novo dia usa `America/Sao_Paulo`; não cancela compromissos.

## Configuração Meta pendente, sem segredos

Checagem local `node scripts/check-whatsapp-config.js`: há token/número/verify token/app secret e nome de template configurados; **WABA ausente, contrato do template ausente, catálogo desabilitado e sincronização desativada**. Essa checagem só verifica presença/estrutura. Nenhuma consulta autenticada à conta Meta foi executada, nem se presumiu que o token seja válido.

Conferir externamente antes de habilitar:

- WABA correta (`WHATSAPP_BUSINESS_ACCOUNT_ID`), número (`WHATSAPP_PHONE_NUMBER_ID`), versão Graph suportada pelo aplicativo, assinatura e inscrição no campo `messages`.
- Nome exato existente em `WHATSAPP_WELCOME_TEMPLATE`, idioma `WHATSAPP_TEMPLATE_LANGUAGE`, status real `APPROVED`, tipo de cabeçalho, quantidade/ordem dos parâmetros do corpo e botões efetivamente aprovados. Não criar/aprovar outro template silenciosamente.
- Logo real de `public/storefront/brands/conflora-logo.png`; o envio faz upload de mídia e usa o ID no cabeçalho. Conferir o logo visualmente na homologação.
- CTA HTTPS oficial em `WHATSAPP_CATALOG_URL` (ou `STORE_URL`), rótulo “Catálogo virtual”. Se estático, a URL deve coincidir com o template e sua alteração acontece na Meta. Se dinâmico, declarar exatamente a URL aprovada com `{{1}}` no final; o código envia apenas o sufixo suportado.
- Rótulos “Montar minha sacola” e “Falar com atendente”, índices 1 e 2. Payloads de envio: `montar_sacola` e `btn_atendente`. Mudar rótulo exige aprovação externa; não renomeamos para “Comprar agora” na Meta.
- Catálogo existente, ID em `WHATSAPP_META_CATALOG_ID`, vínculo correto WABA/número, comércio/carrinho habilitados e permissões dos ativos/token, incluindo mensagens e gestão comercial necessárias. Só então ativar `WHATSAPP_META_CATALOG_ENABLED=true`.
- Elegibilidade e políticas atuais por categoria. Publicação exige `metaCommerceReview` no produto com `approved`, `reviewedBy`, `reviewedAt`, `policyVersion` e `category: PERMITTED_PLANT_OR_GARDEN_PRODUCT`. Isso é revisão explícita pela equipe, não aprovação automática da Meta. Animais e categorias restritas não são publicados pela integração; indícios nos pedidos pedem revisão humana. Não usar texto/encomenda para contornar proibição.
- Coexistência disponível e inscrição oficial em `smb_message_echoes`; confirmar formato real de `value.message_echoes`, metadados e destinatário. Esse evento não fornece a primeira tecla digitada no aplicativo WhatsApp Business.

`WHATSAPP_WELCOME_CONTRACT` é um JSON de configuração **copiado da conferência real**, não uma comprovação automática de aprovação. Estrutura, sem valores reais:

```json
{
  "name": "NOME_EXATO_APROVADO",
  "language": "pt_BR",
  "status": "APPROVED",
  "verifiedAt": "DATA_DA_CONFERENCIA_REAL",
  "header": "IMAGE",
  "bodyParameters": ["customer_name"],
  "buttons": [
    { "type": "URL", "text": "Catálogo virtual", "mode": "static", "url": "URL_HTTPS_OFICIAL_CONFERIDA" },
    { "type": "QUICK_REPLY", "text": "Montar minha sacola" },
    { "type": "QUICK_REPLY", "text": "Falar com atendente" }
  ]
}
```

O exemplo descreve estrutura, não deve ser aplicado como configuração real. `bodyParameters` deve refletir os parâmetros posicionais existentes: lista vazia se não houver; `customer_name` para nome; `greeting_fragment` somente se o modelo realmente usar o fragmento de saudação do contrato anterior. Não adicionar variável por conveniência. Outro contrato de parâmetros exige adaptar o mapeamento antes da habilitação. Falha/configuração incompleta entra em reconciliação; não existe fallback para menu genérico.

A Meta permite logo/foto, texto/parâmetros e botões aprovados. Fotos, preços e disponibilidade do catálogo vêm dos campos comerciais permitidos. Cores, layout e comportamento da interface nativa pertencem ao WhatsApp.

Referências oficiais consultadas: [mensagens Cloud API, coleção Meta no Postman](https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages), [template com componentes interativos](https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive), [parâmetros de botão no SDK publicado pela Meta](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/types/button_parameter_object/) e [políticas WhatsApp Business](https://business.whatsapp.com/policy/preview?lang=pt_BR). O SDK é referência legada para o formato, não comprovação de suporte atual da conta. As páginas diretas de catálogo, webhook de coexistência e catálogo Graph em developers.facebook.com retornaram bloqueio/429 nesta sessão; a confirmação integral dessas referências atuais e das capacidades da conta permanece pendente. Não usamos documentação de terceiros como comprovação de homologação.

## Sincronização preparada, não executada

`functions/src/index.ts` contém trigger preparado para `products/{productId}`. Ele observa alterações/cadastro/inativação/exclusão e enfileira apenas o ID no `pdv_outbox`. Requer publicação futura autorizada da função e execução do worker existente. Não há outro banco/fila comercial.

Cada ID tem um trabalho estável `meta-product-<hash>`; `product_retailer_id` corresponde ao ID oficial do produto, sem conversão para exemplos. O worker lê a versão atual, projeta nome, descrição pública, preço em centavos, BRL, imagem HTTPS e disponibilidade. Não usa o payload antigo do evento. Fingerprint/ID estável evitam criação duplicada; geração mantém pendência se o produto mudar durante o envio. Falha usa backoff/limite e reconciliação existentes. Item inativo/excluído/sem revisão passa a `discontinued` na projeção remota, sem apagar o Firestore.

Ativação futura exige todas as condições: `WHATSAPP_META_SYNC_ENABLED=true`, autorização ADMIN persistida em `store_settings/whatsapp_commerce` e catálogo correspondente. `POST /api/admin/whatsapp/catalog/authorize-sync` exige `authorizeInitialSync: true` e ID correspondente. Esse endpoint não publica itens. Lotes explícitos de até 50 IDs são preparados por `POST /api/admin/whatsapp/catalog/sync`; o trigger cuida das mudanças seguintes. **Nenhum desses endpoints foi acionado.**

A revisão por produto tem rota protegida `POST /api/admin/whatsapp/catalog/products/:id/review`: ADMIN, decisão booleana, categoria permitida e versão da política conferida; o servidor registra operador/data e reutiliza `saveProduct`. Não houve aprovação real de produto. `POST /api/admin/whatsapp/catalog/pause-sync` com `pause: true` suspende a sincronização preservando filas e autorização histórica. Nenhuma dessas ações foi executada.

Reconciliar mudanças globais de política/controle de estoque com lotes explícitos dos produtos afetados; não há varredura de todos os produtos por mensagem. A atualização na Meta é eventual, depende de rede/moderação, e não substitui a validação transacional de preço/estoque no checkout. Homologar os campos, filtros Graph, permissões e tratamento de erros na conta real antes da primeira publicação.

## Atendimento humano e reconciliação

Takeover/release/send existentes são autenticados por ADMIN/CAIXA/VENDEDOR. A composição solicita posse antes de liberar edição; erro impede envio. A rota de envio também pausa antes do transporte e exige `requestId` estável. Outro operador recebe conflito; retomada exige responsável atual ou ADMIN. A versão aumenta em pausa, retomada, fechamento e reset. Não existe retomada por `human_requested`.

Antes de cada envio automático há leitura oficial de pausa/posse/versão, inclusive cada chunk, upload seguido de template e retentativa. O guard também verifica as transações do contexto automatizado, evitando compromisso comercial em geração superada. Jobs anteriores sem geração, cujo contexto não possa ser comprovado após intervenção humana, são ignorados para revisão. A inbox aceita apenas o payload persistido e vincula sua geração ao recebimento.

O índice `whatsapp_delivery` conserva cada ID confirmado do provedor; callbacks dos chunks podem ser conciliados mesmo depois de o campo do último ID mudar. Echo sem correspondência local causa pausa conservadora. Existe uma janela de corrida entre a última conferência local e a aceitação externa: não se pode cancelar retroativamente mensagem aceita pela Meta, nem observar a primeira tecla no WhatsApp Business sem um evento oficial correspondente.

Operação protegida, sem envio automático de recuperação incerta:

- `GET /api/admin/whatsapp/operations?source=inbox&status=NEEDS_RECONCILIATION` (ou outbox; cursor real, 25 registros).
- `POST /api/admin/whatsapp/operations/:id/resolve`: ADMIN, nota e `resolvedByTeam: true`; registra tratamento, não reenvia. Resultado desconhecido precisa de inspeção do provedor/equipe.
- Para falha do template: corrigir contrato/template/credencial, conciliar o evento e enviar **novo** comando `menu` após retomada autorizada. Não reexecutar a submissão incerta.
- `POST /api/admin/whatsapp/conversations/:phone/takeover`: pausa esse atendimento sem interromper caixa, estoque, pagamentos ou outros clientes. Liberação é explícita em `/release`.
- `POST /api/admin/whatsapp/conversations/:phone/reset-test-context`: somente ADMIN, telefone idêntico a `WHATSAPP_TEST_PHONE` e `confirm: RESET_CONVERSATION_CONTEXT`. Arquiva contexto em `agent_handoffs` com tipo `CONVERSATION_CONTEXT_ARCHIVE`; mantém histórico, operações, deduplicação, pedidos, encomendas e pausa. Não foi executado.

As rotas privadas usam `private, no-store`. A listagem de conversas e históricos usa páginas efetivas limitadas; filtros visuais podem retornar página menor, mas o cursor avança sobre a página oficial consultada. Falha de banco não é apresentada como lista vazia atualizada.

## Limpeza e preservações

Removidos após busca de consumidores em `src`, frontend, jobs, scripts e testes:

- Menu genérico de três respostas e envio intermediário de link.
- Handlers de categorias/subcategorias/lista própria/adicionar ao carrinho do botão de compra; método `sendNativeProductsList` e `SalesConversationService.startCart` sem consumidores restantes.
- `src/services/conversation-outbox.js`: apenas definição/exportação, nenhum consumidor; transporte durável existente é o caminho oficial.
- `OrderService.notifyOwner`: apenas definição; notificações oficiais já passam por `queueOperationalNotifications`/outbox.
- Método duplicado `sendCatalogMessage` introduzido no merge externo: sobrescrevia a implementação oficial com outro formato. Restou um método com `catalog_message`.
- Dependências de router/preço/learning sem consumo no `MessageService` e suas instanciações no bootstrap. Módulos com consumidores de teste foram preservados como ferramentas de validação, sem instanciação nesse runtime.
- Envio direto de recibos em dois caminhos administrativos foi consolidado na outbox existente. Ausência de destinatário não é marcada como envio bem-sucedido.

Preservados: callbacks antigos com resposta segura; `sessions.orderDraft`, `orderIntake`, `procurementConversation`, histórico/ops; núcleo comercial, estoque/reservas, caixa e permissões; conector/piloto com consumidores próprios e gate existente; guardas contra mocks; fixtures e testes isolados; Pix manual/simulador/Sicredi real. Busca textual limitada aos caminhos relevantes não é prova de auditoria integral de todo o produto. Nenhum dado fictício foi acrescentado ao runtime; exemplos novos estão exclusivamente nos testes/documentação. Não foram apagados campos/documentos persistidos ou reescrito histórico.

## Checagens e limites

Executados: `node --check` nos JS afetados; ESLint com `no-dupe-class-members` nos arquivos afetados; TypeScript de `functions` com `--noEmit`; transformação sintática JSX em memória; `git diff --check`; checagem local de presença/configuração WhatsApp. Os resultados finais constam da mensagem de entrega. Esses comandos não executam os cenários funcionais.

Preparados/ajustados: `test/whatsapp-acceptance.test.js`, `whatsapp-flow.test.js`, `whatsapp-greeting.test.js`, `sales-conversation.test.js` e regressões de intake/agente. A nova suíte exercita contrato/payload real em transporte isolado, CTA dinâmico, quick replies, parser sem IA, carrinho por webhook assinado até comanda, replay, procura consentida, pausa/retentativa/echo e reset. **Não executados.** Não há evidência de entrega Meta, compra real, coexistência, moderação, liquidação bancária, performance ou comportamento em dispositivo da loja nesta revisão.

Impacto sem medições:

- Leituras adicionais limitadas da conversa na aceitação, transação e envio; leitura/escrita do lease por telefone; por ID confirmado há índice durável. Isso aumenta I/O para garantir posse/idempotência.
- Índice de catálogo existente reaproveitado com validade de 15 s e invalidação das mutações administrativas; decisão comercial relê IDs atuais. Não se adicionou consulta global de pedidos ao catálogo/inventário. Cache nunca autoriza venda.
- Saída inicial contém template e upload do logo; elimina a mensagem intermediária com URL e listas próprias. Não há comparação medida de bytes/latência. Logo ainda é carregado/uploadado por apresentação, sujeito a otimização futura com validade explícita.
- Contexto privado permanece no backend por usuário/conversa; nenhum pagamento, endereço ou permissão novo em cache público. Arquivos históricos não são migrados. Novos campos são aditivos; geração, timestamps e índices de entrega permanecem auditáveis.

## Revisão que recebe o webhook e servidor

Conferir no WhatsApp Manager a URL efetiva inscrita. Consultar `/health` nessa mesma origem: `revision` vem de `K_REVISION`, depois `APP_REVISION`, ou `local`. Correlacionar o nome da revisão com imagem/digest/commit no registro da implantação. Não inferir a revisão hospedada pelo Git local. Cada evento aceito guarda `payload.receivedByRevision`; a inbox guarda `processedByRevision`, permitindo distinguir recebedor e worker. Eventos anteriores podem não ter esses campos.

Local: parar com Ctrl+C a janela que realmente executa o servidor; usar `npm run dev:isolated` com `.env.dev` já configurado para o ambiente isolado. `node --watch` reinicia o processo em alterações. Conferir a porta exibida e `/health`; não iniciar o servidor local com credenciais reais enquanto envios não estiverem autorizados, pois workers existentes recuperam filas. Não reiniciamos nenhum processo nesta tarefa.

Reiniciar Node local não atualiza Hosting/Cloud Run/Cloud Functions. Publicação futura exige build de frontend, revisão/imagem e serviço corretos. O repositório já registra divergência entre região dos rewrites e script npm de deploy; resolver com o operador antes de qualquer publicação. Não executar deploy de Hosting ou função como tentativa de “reiniciar”.

## Homologação, somente quando a sessão for iniciada explicitamente

1. Ambiente isolado `demo-*`, rede de saída bloqueada/doubles, banco sem dados reais; confirmar que `test/` não integra assets/runtime/deploy. Rodar as suítes de atendimento e depois regressões comerciais sob autorização da sessão. Resolver falhas antes de usar a conta Meta.
2. Login/papéis, logout/troca de usuário, acesso negado a operações de outro perfil, compositor sem permissão/conflito/reload. Não vazar mensagens/endereço na troca.
3. Catálogo real autorizado: produtos/variantes/preços/estoque, imagens e políticas. Entrada nova, alteração incremental, inativação, duplicata, evento atrasado, falha de API e retomada; primeira sincronização precisa de autorização específica.
4. Template na conta autorizada: nome/idioma/logo/parâmetros/rótulos, CTA estático/dinâmico, um toque no site sem mensagem extra; respostas de template e interativas. Validar em aparelhos reais o catálogo/carrinho, inclusive toque adicional exigido pela Meta. Mensagens reais precisam de autorização própria.
5. Texto sem IA: listas e variantes, quantidades ausentes, soma/remoção/substituição, pagamento e retirada na mesma mensagem; nenhum preço do cliente altera a cobrança. Ambiguidade fica silenciosa e vai para equipe.
6. Carrinho nativo repetido, assinatura/conta/estrutura inválida, moeda/quantidade/ID inválidos, produto inativo, preço/estoque alterado entre resumo e confirmação. Uma comanda oficial pendente; não baixar estoque físico ao enviar carrinho.
7. Entrega/retirada: endereço/taxa, dados já fornecidos, indisponibilidade de entrega, mudança da taxa, confirmação final explícita. Caixa, reserva, concorrência, recebimento e cancelamento seguem o núcleo oficial.
8. Encomendas/mistos: consentimento só de procura, quantidade/especificação, ausência de preço/data, equipe recebe solicitação; cotação real, aceite, sinal de 50%, conferência manual Pix, chegada após entrada de estoque, saldo e entrega. Sem fornecedor/data fictícios.
9. Pix manual: comprovante não quita, permissões de conferência; Sicredi real segue bloqueado até liberação/configuração/homologação autorizada. Preservar simulador isolado, idempotência, expiração/pagamento tardio e reconciliação.
10. Humano durante IA/upload/envio/outbox/backoff: pausar antes da composição; cliente/menu/novo dia não retomam. Após release, geração antiga continua bloqueada. Coexistência/echo só se disponível. Simular falha de rede antes/depois de aceitação; nunca retry cego de resultado desconhecido.
11. Reinício por texto e reset do telefone de teste: preservar comandas, encomendas, pagamentos, comprovantes, histórico e dedup. Interrupção/reinício de worker e Cloud Tasks; callbacks duplicados e de chunks antigos.
12. Medir leituras, chamadas, bytes, latência e recuperação em dispositivo/conexão representativos; comparar antes/depois. Só então avaliar autorização de publicação.

## Rollback e bloqueadores

Bloqueadores atuais: WABA/contrato real ausentes, catálogo/vínculo/permissões/revisão de produtos não conferidos, trigger não publicado, coexistência não confirmada, homologação funcional e performance pendentes. Compra por texto só é alternativa operacional real depois de configurados/homologados transporte, acesso e serviços comerciais; não substitui template inválido por sucesso fictício.

Antes de publicar, guardar diff cumulativo, artefato anterior e configurações, sem segredos no Git. Em incidente: takeover das conversas afetadas; suspender sincronização (`enabled=false` em operação administrativa autorizada e flag de ambiente); preservar inbox/outbox e registros `SENDING`/reconciliação. Não apagar Firestore, filas, pagamentos ou provas. Rollback de tráfego Cloud Run/artefatos Hosting/função exige autorização e revisão compatível com gerações/pausas novas. Não voltar cegamente a uma revisão que retoma `human_requested` ou ignora posse. Primeiro interromper automação e manter operação comercial/humana; revisar migração/compatibilidade antes de liberar agente antigo.
