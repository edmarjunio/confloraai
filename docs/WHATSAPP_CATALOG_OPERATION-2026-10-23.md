# Catálogo WhatsApp: sessão real autorizada em 23/10/2026

> **Histórico supersedido em 24/10/2026:** o usuário passou a exigir exclusivamente fotos dos produtos reais da Conflora. As referências e a ilustração descritas abaixo foram excluídas da exibição local e os 580 registros Meta passaram a `discontinued`. Consulte [PRODUCT_INTEGRITY_REPORT-2026-10-24.md](PRODUCT_INTEGRITY_REPORT-2026-10-24.md) para o estado atual. Nenhuma licença, foto real ou disponibilidade deve ser inferida deste registro histórico.

## Escopo e estado

O usuário autorizou testes reais no número de teste Meta, a vinculação do catálogo, a primeira carga e a gravação de imagens no Firestore/Storage. Não houve deploy de Hosting, Cloud Run ou Functions. Facebook Shop, Instagram Shopping e outras páginas não foram configurados nem homologados nesta sessão.

Catálogo: `1834176020928565` — Catálogo de produtos CONFLORA. WABA de teste: `1109837771546167`; Phone Number ID: `1346441561890238`. O vínculo foi consultado na API. A Meta aceitou a configuração comercial anteriormente, mas a leitura `whatsapp_commerce_settings` retorna uma lista vazia; uma nova tentativa com parâmetros de URL retornou HTTP 500/código 1. Não declaramos essa leitura validada. A captura do usuário comprova entrega da mensagem nativa de catálogo, mas a primeira abertura estava vazia.

Resultados datados, com cada produto e seu motivo:

- [Relatório completo](WHATSAPP_CATALOG_RESULT-2026-10-23.json).
- [Produtos não vinculados](WHATSAPP_CATALOG_RESULT-2026-10-23-NAO-VINCULADOS.csv).
- [Rejeitados pela Meta](WHATSAPP_CATALOG_RESULT-2026-10-23-REJEITADOS.csv).
- [Aguardando revisão da Meta](WHATSAPP_CATALOG_RESULT-2026-10-23-AGUARDANDO-META.csv).

“Vinculado” significa que a API retornou o registro no catálogo. Não equivale a aprovação, visibilidade ou venda homologada. O relatório consulta separadamente `capability_to_review_status` para WHATSAPP. Esses estados podem mudar após sua geração.

Os dois primeiros rejeitados foram CARTELA DE OVOS 12 OVOS e CARTELA DE OVOS 30 OVOS. A Meta retornou `PRODUCT_NOT_APPROVED`, com referência genérica às Políticas de Comércio; não detalhou uma causa individual. Não se atribuiu a rejeição a um motivo presumido e não se contornou a restrição com outro formato de publicação. Revisar no Commerce Manager e solicitar revisão pela via oficial se cabível.

## Fonte dos produtos e imagens

Firestore permanece como fonte oficial. O catálogo público e a normalização do atendimento deixaram de consultar `conflora-validated-catalog.json`: os dois consumidores agora recebem diretamente o registro do backend. Perfis técnicos que existiam apenas no JSON não são promovidos automaticamente a informação oficial. O arquivo histórico e seu módulo foram preservados, sem apagar dados; não são mais importados por esses consumidores. Não houve auditoria ou remoção global de arquivos sem uso. Testes/fixtures continuam isolados.

Essa correção de runtime está local. O site hospedado só receberá a mudança de código após um deploy autorizado. As alterações de dados no Firestore/Storage são reais e compartilhadas com o backend configurado.

Na leitura inicial havia 759 registros com referência de imagem: 81 eram caminhos locais, existentes no projeto, porém amostras consultadas no Hosting retornavam 404; uma URL externa de DELIMITADOR DE GRAMA também retornava 404. As outras 289 URLs externas únicas responderam como imagem. Essa checagem HTTP não comprova correspondência visual nem licença individual.

Foram migradas as 81 fotos já existentes no projeto, reutilizando ImageMigrationService, uploadProductImage e saveProductPhoto, com atualização coerente de `images`, `imagePaths`, `imageUrl`, `imagePath`, `imagePathCache` e `imageFileId`. Não foram classificadas como fotos novas livres de direitos: sua licença individual não foi certificada. Referências externas já cadastradas continuam existindo. Firestore guarda metadados; os bytes ficam no Storage ou nas URLs externas registradas, não em documentos base64.

O usuário autorizou uma ilustração gerada para a fita plástica verde. O `image_gen` produziu `public/store-assets/products/delimitador-grama-ilustrativo-v1.png`; o serviço oficial gravou a foto e a procedência `AI_GENERATED_USER_AUTHORIZED`. O produto recebe indicação de imagem ilustrativa no catálogo local e na descrição; não é foto de estoque, não tem fabricante nem dimensões confirmadas.

Prompt usado: “One square ecommerce catalog illustration for a green flexible plastic lawn edging strip; simple roll partially unrolled, rounded top rim, white background, no brand, text, dimensions, packaging or accessories; illustrative depiction, not a photograph of actual stock.”

## Sincronização e concorrência

Produção preparada: `products/{productId}` → queueWhatsAppProduct → mesma `pdv_outbox` → PdvService → MetaCatalogSyncService → API Meta. O trigger foi ajustado, mas não publicado.

Teste local ativo: `WHATSAPP_META_LOCAL_WATCH_ENABLED=true`, somente fora de NODE_ENV=production, observa alterações do Firestore e enfileira nessa mesma outbox. O worker existente processa os registros. Não é uma segunda base comercial nem uma fila paralela. O processo local precisa permanecer ligado; isso não oferece disponibilidade hospedada.

O estado `CATALOG_PENDING` impede que versões antigas ou workers de notificação sem sincronização habilitada consumam indevidamente os trabalhos de catálogo. A migração foi motivada por bloqueios observados `INITIAL_SYNC_NOT_AUTHORIZED`; não se interromperam as notificações comerciais comuns. Lease, geração, identidade estável, leitura da versão atual e fingerprint continuam no serviço oficial. Repetição de evento não cria outro produto; a consulta por retailer_id reconcilia resultados antes de criar. Não se relê/sincroniza o catálogo inteiro a cada mensagem.

O observador ignora mudanças que não afetam a projeção comercial e usa fingerprint persistida para não gerar trabalho repetido da mesma projeção após reconexão. A primeira observação local lê os produtos; isso tem custo. Pausa global exige reconciliação dos produtos alterados durante o intervalo antes de retomar a publicação.

Preço, descrição pública, imagem e disponibilidade passam pelo serviço. Revisões novas registram a identidade comercial; mudança de nome/categoria/subcategoria exige nova revisão para não transportar a autorização a outra espécie/produto. Os filtros conservadores diferenciam ornamentais como “bico-de-papagaio” de animais vivos. Os grupos pendentes não são declarados universalmente proibidos; faltam identificação/origem/apresentação e revisão, conforme cada linha do relatório.

O estoque continuou desativado. Não foram criados saldos fictícios nem modificados preços, nomes, categorias, unidades, status ou reservas para viabilizar a carga. Uma comparação dos 759 registros com o snapshot anterior encontrou zero alterações nesses campos. A disponibilidade Meta reflete a opção comercial sem controle de estoque; não atesta contagem física.

Uma falha preexistente de saveProduct em atualizações parciais esvaziou tags/descrições auxiliares durante esta sessão. O serviço foi corrigido para preservar o registro anterior; 652 produtos tiveram apenas os campos auxiliares vazios repostos pelo snapshot. A verificação posterior encontrou zero campos auxiliares anteriormente preenchidos ainda vazios. Backups e relatório da reparação estão em `.private/whatsapp-diagnostics/`; não foram restaurados documentos completos sobre alterações atuais.

## Evidência e operação local

- Template aprovado e conta/número conferidos por GET na Meta, sem imprimir token.
- Primeiro envio de catálogo confirmado pela captura real do usuário.
- Três produtos iniciais consultados na API com IDs estáveis e preços oficiais em BRL; imagens chegaram a FETCHED.
- Alteração da descrição pública da rúcula chegou ao mesmo ID Meta, sem alterar preço/estoque.
- RAÇÃO GIRASSOL foi enfileirada com `requestedBy=local-firestore-watch` e sincronizada após a gravação de revisão, sem enfileiramento manual dessa alteração.
- 81 fotos migradas: 81 metadados existentes e zero divergências em referências, preços ou estoque. Ilustração do delimitador: referência Storage consistente e HTTP 200.
- Suite local autorizada de regressão: 154 testes isolados aprovados; testes adicionais e sintaxe/lint registrados em `.private/whatsapp-diagnostics/`. Isso não comprova homologação do aparelho, checkout real, Pix ou performance de produção.
- Guardas contra armazenamento em memória fora de testes e Pix Sicredi manual/simulador isolado/integração real aguardando liberação foram preservados. Não se criou venda nem confirmou pagamento para executar a sincronização.

O webhook inscrito continua `https://shiny-crews-matter.loca.lt/webhook`. O túnel foi recuperado sem alterar sua inscrição na Meta. Verificar `/health` na mesma origem e correlacionar `revision`, `receivedByRevision` da inbox e `processedByRevision`; a revisão local tem prefixo `local-...-whatsapp-catalog-20261023`, não representa publicação hospedada.

Existe um servidor local iniciado por esta sessão na porta 8080; não iniciar outro npm start nessa porta. Conferir o PID efetivo com `Get-NetTCPConnection -LocalPort 8080 -State Listen`. Para assumir o processo no terminal, parar somente esse PID verificado e executar npm start na pasta do projeto. Os logs correntes estão em `.private/whatsapp-diagnostics/server-catalog-reviewed.stdout.log` e `.stderr.log`. Não usar `taskkill /IM node.exe`, pois encerraria outros serviços.

Foi corrigido o callback Express 5 que anunciava sucesso mesmo recebendo erro de bind. Em EADDRINUSE o processo agora encerra com código 1, libera o observador e não permanece como worker invisível. Teste isolado ocupa uma porta e comprova esse comportamento.

## Impacto e limites

Houve leitura integral de 759 produtos para auditoria/carga/relatório administrativo; não se adicionou leitura global de pedidos. O observador local exige leitura inicial dos produtos e leituras incrementais posteriores, com consulta às configurações e transações da outbox. O worker relê produto/configuração e usa lease/fingerprint; só chama a Meta quando a projeção mudou. Não foram medidas latência p75, throughput, bytes de rede ou desempenho em aparelho.

Foram enviados 82 arquivos ao Storage nesta sessão (81 existentes e uma ilustração). Metadados permanecem no Firestore e URLs públicas de produto não carregam credenciais da API Meta. Cache público não recebe pagamentos, clientes ou permissões. Projeções do site convergem pelos TTLs/invalidações já contratados; não se apagou cache global nem Firestore.

## Homologação e rollback

1. Reabrir o catálogo no WhatsApp Web e no celular; conferir produtos APROVADOS no Commerce Manager, fotos, variantes, unidades e preços. Não presumir que cadastro aceito elimina revisão/propagação da Meta.
2. Enviar menu no número de teste, abrir o CTA do site e Montar minha sacola. Enviar carrinho com itens aprovados; conferir resumo oficial, entrega/retirada, taxa, pagamento pendente e confirmação final. Só confirmar uma compra real se houver intenção comercial correspondente.
3. Conferir no caixa uma única comanda de origem WhatsApp. Duplicar evento apenas em teste isolado. Homologar cancelamento, contagem/controle de estoque, Pix manual, troca de usuário e permissões em sessão própria; não se executaram transações financeiras reais nesta carga.
4. Falar com atendente deve deixar a conversa para a equipe, silenciosa e persistente. Menu e mensagem do cliente não retomam posse humana. Testar intervenção durante fila e retentativa.
5. Alterar um produto autorizado pelo site e conferir o mesmo retailer_id na Meta. Testar indisponibilidade de rede, reconexão, inativação, reativação/revisão e pausa. Não usar item rejeitado em outro formato para contornar restrição.
6. Para operação contínua hospedada, revisar diff e autorizar especificamente o deploy do trigger e do backend compatível com CATALOG_PENDING. Não publicar apenas o trigger sobre um worker antigo. Facebook/Instagram exigem configuração e validação separadas do mesmo ativo.

Pausa imediata da sincronização: ação ADMIN `/api/admin/whatsapp/catalog/pause-sync`, com `{ "pause": true }`; preserva os produtos e a operação da loja. Desligar a flag local e reiniciar interrompe o observador/worker de catálogo. Para pausar respostas de uma conversa, usar assumir atendimento; para suspensão global, desligar WHATSAPP_AI_ENABLED no ambiente pertinente e reiniciar somente o serviço autorizado. Nenhuma dessas pausas apaga vendas ou comprovantes.

Rollback preparado, não executado: pausar primeiro; guardar diff/configuração e snapshots privados. Imagens podem ser repontadas pelos campos específicos do backup, preservando campos comerciais atuais; não apagar blobs/documentos durante o rollback. Produtos Meta podem ser despublicados/inativados pelo serviço após revisão/autorização, sem apagar a origem Firestore. Não baixar o worker para uma versão que ignore posse humana ou retome automaticamente conversas. Deploy e rollback hospedados continuam sujeitos a autorização específica.

## Arquivos da implementação e preservações

- `src/services/meta-catalog-sync.service.js` e `meta-catalog-watch.js`: projeção, diagnósticos seguros, filtros, fingerprint e observação local.
- `src/orders/pdv.repository.js` e `pdv.service.js`: claim e recuperação dos trabalhos de catálogo na outbox existente, preservando notificações comuns.
- `functions/src/index.ts`: trigger com retry e região do Firestore, preparado sem publicação.
- `src/database/firestore.repository.js` e `src/catalog/image-migration.service.js`: atualizações parciais seguras, referência coerente e registro das fotos.
- `src/storefront/existing-store.js`, `src/catalog/normalize-catalog-item.js` e `src/http/app.js`: fonte persistida e indicação de ilustração.
- `src/http/whatsapp-admin.routes.js`: revisão com identidade e proteção contra publicação de itens internos/Pets não habilitados.
- `src/server.js` e `.env.example`: startup correto, observador condicionado e configuração documentada. `.env` local continua ignorado e não é distribuído.
- `scripts/sync-meta-catalog.js` e `scripts/report-meta-catalog.js`: carga controlada e reconciliação por produto. Nenhum script envia mensagens a clientes para testar produtos.
- `test/meta-catalog-watch.test.js`, `test/server-startup.test.js`, `test/image-migration.test.js` e `test/catalog-image-url.test.js`: testes isolados dos consumidores e regressões corrigidas.
- `public/store-assets/products/delimitador-grama-ilustrativo-v1.png`: ilustração autorizada, com cópia no Storage e procedência no Firestore.

Parte das mudanças desta sessão foi incorporada externamente ao commit `429a1d4` durante o trabalho; as demais permanecem locais. Não houve commit/merge/deploy executado por este agente nesta sessão. Os registros de imagens e produtos do Firestore, arquivos locais históricos, mocks/fixtures isolados, simulador Sicredi e integrações comerciais existentes não foram apagados.
