# Conflora Horta e Viveiro

Aplicação atual da Conflora para catálogo público, pedidos, frente de caixa, administração e atendimento com Gemini/WhatsApp. O catálogo, produtos, estoque, pedidos, usuários e configurações operacionais usam Firestore; as fotos de produtos usam Firebase Storage.

## Áreas do site

| Endereço | Uso |
| --- | --- |
| `/` | Catálogo público, busca, informações de produto, sacola, login Google e checkout |
| `/caixa` e `/pdv` | Frente de caixa, venda por vendedor/caixa, comandas, PIX Sicredi, fiado e relatórios |
| `/admin` | Produtos, estoque, equipe, vendas, conexões e configurações |
| `/admin-gerencial` e `/admin/gerencial` | Painel gerencial diário e comparação de vendas por período |
| `/health` | Diagnóstico básico do serviço e do ambiente |
| `/webhook` | Recebimento de mensagens da WhatsApp Cloud API/Meta |

## Como cada venda funciona

### Catálogo público

O servidor confere produtos, preços e quantidades. O checkout Pix do catálogo principal usa **Sicredi**: reserva as unidades no Firestore, gera a cobrança de valor fixo e mostra QR Code e Pix Copia e Cola no recibo. O webhook avisa o servidor, que consulta o pagamento no banco antes de confirmar e baixar o estoque. Pedidos de dinheiro/cartão aguardam recebimento pelo caixa. Recibos e notificações usam a fila durável `pdv_outbox`.

Clientes autenticados acessam **Minha conta** para consultar compras, recibos, fiados, recebimentos e crédito. O Pix de quitação parcial ou total da dívida usa um identificador próprio e não cria outra venda nem baixa estoque.

### Frente de caixa

1. **VENDEDOR** cria a venda. PIX gera uma cobrança Sicredi; dinheiro, cartão e fiado ficam como comanda para o caixa. A venda permanece atribuída ao vendedor que a abriu.
2. **CAIXA/ADMIN** pode receber dinheiro, débito, crédito ou fiado, inclusive pagamentos divididos. A confirmação, o registro do pagamento e a baixa do estoque ocorrem juntos em uma transação do Firestore. Antes do vencimento, Pix também pode ser confirmado manualmente após conferir comprovante, valor e conta recebedora, registrando a justificativa e o operador. Vendedores não têm essa permissão.
3. Para **PIX Sicredi**, o servidor recalcula o total, envia uma cobrança dinâmica com `modalidadeAlteracao: 0` e mostra o QR Code e o Pix Copia e Cola. O recibo com o código é enviado por WhatsApp e o QR vai como imagem quando há telefone e as credenciais/modelos de WhatsApp estão configurados.
4. O webhook Sicredi serve como aviso. O servidor consulta `GET /pix/{endToEndId}` e confere transação, `txid`, chave recebedora, valor exato e ausência de devolução. Só após essas validações marca o pedido como pago, finaliza e baixa o estoque.
5. Repetições do mesmo webhook ou da confirmação não repetem a baixa. Notificações de pagamento são enviadas após o registro transacional. Vendas e recebimentos aparecem conforme o papel e a autoria no relatório de caixa.

O código do pedido e a chave de idempotência impedem que uma repetição da mesma solicitação crie outra cobrança. Se o navegador perder a resposta, consulte a venda/comanda antes de iniciar uma nova. **Pix emitido reserva estoque**: com saldo físico 10 e reserva 2, ficam 8 disponíveis. A confirmação converte a reserva em baixa; o vencimento cancela o pedido e libera a reserva, sem aumentar o saldo físico. A reserva Pix permanece obrigatória mesmo com o controle legado de estoque desativado.

A tela de comandas recebe mudanças em tempo real e destaca pedidos novos. Comandas do vendedor, pedidos para retirada e pedidos para entrega entram em **Esperando pagamento**, inclusive dinheiro e cartão. Os itens ficam reservados, sem baixa física, até receber ou cancelar. Somente a cobrança Pix emitida tem confirmação automática pelo banco e prazo de vencimento; escolher a forma de pagamento não comprova recebimento. Pagamentos divididos com Pix cobram somente a parcela Pix; se vencerem após receber dinheiro/cartão, o cancelamento preserva esses valores e marca conciliação/estorno. Pix recebido para pedido já cancelado é registrado para conciliação, sem reabrir a venda automaticamente.

Em produção, a expiração é agendada no Cloud Tasks. Configure `TASK_SECRET`, `SERVICE_URL`, projeto, região e fila; conceda ao backend permissão para criar tarefas. O serviço recusa iniciar a cobrança quando não consegue garantir esse agendamento. Localmente há uma varredura de expiração enquanto o servidor está ativo.

O fluxo de aprovação de desconto do PDV cria a cobrança Sicredi após a aprovação. Os endpoints legados de pedido manual e aprovação fora do PDV em `src/http/app.js` ainda mantêm Mercado Pago; não devem ser confundidos com o checkout principal ou com o PDV. A vitrine de cada tenant em `src/storefront` também tem seu próprio contrato de checkout.

## Componentes principais

```text
src/http/                         Rotas, páginas e autenticação
src/orders/pdv.service.js          Venda/PIX do caixa, recibo e notificações
src/orders/pdv.repository.js       Transação de pagamento, pedido e estoque
src/orders/order-integrity.js      Validações de estoque e confirmação
src/integrations/sicredi-pix.client.js  OAuth mTLS, cobrança e consulta Sicredi
src/integrations/mercado-pago.client.js Compatibilidade dos endpoints legados
src/database/firestore.repository.js    Firestore, estoque e pedidos da loja
src/catalog/                       Catálogo e fotos do Firebase Storage
public/pdv/                         Interface web da frente de caixa
test/                               Testes HTTP, regras e transações simuladas
docs/PDV-SICREDI.md                 Detalhes do caixa e da integração Sicredi
docs/PIX-TESTE-E-INTEGRIDADE.md     Fluxo PIX público e limitações
```

## Rodar e conferir localmente

Requisitos: Node.js 20 ou superior e acesso às credenciais do projeto de desenvolvimento. Não aponte testes para o Firestore de produção.

```powershell
cd C:\Users\Junin\confloraai
npm ci
Copy-Item .env.example .env
```

Preencha no `.env` as configurações do projeto de desenvolvimento. Para acessar Firestore/Storage/Gemini localmente, autentique a conta Google apropriada com Application Default Credentials:

```powershell
gcloud auth application-default login
```

Depois rode a aplicação e os testes:

```powershell
npm run dev
npm run check:full
npm run test:pix
npm run test:dev
```

`test:pix` simula os provedores, webhooks, pagamentos repetidos e concorrência; não cria cobrança nem movimenta dinheiro. `check:sicredi` apenas confere se as configurações estão preenchidas. Com credenciais válidas, `npm run check:sicredi -- --connect` valida OAuth/mTLS e **não cria cobrança**.

## Login com Google

O fluxo do site já usa Firebase Authentication para obter a identidade Google e o servidor valida o ID token. O papel `CLIENTE`, `VENDEDOR`, `CAIXA` ou `ADMIN` vem do cadastro interno, não é concedido pela conta Google.

1. No Firebase Console do projeto correto, crie/confira o app Web e habilite **Authentication → Sign-in method → Google**.
2. Em **Authentication → Settings → Authorized domains**, inclua o domínio publicado. Para desenvolvimento, autorize `localhost` manualmente se ainda não estiver listado.
3. Preencha `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET` e `FIREBASE_APP_ID` com os valores do app Web do mesmo projeto que o servidor valida.
4. Teste no domínio publicado: login, logout, acesso do cliente à própria conta e bloqueio de cliente nas telas `/admin` e `/caixa`. Para liberar equipe, cadastre/atribua o papel no cadastro interno; login Google não dá acesso administrativo por si só.

Não use credencial privada de conta de serviço no navegador. O backend deve usar a identidade de runtime do Google Cloud ou Application Default Credentials.

## Operar o quadro de comandas e receber dívidas

- **Amarelo:** reservado para pedidos com uma etapa explícita de confirmação prévia. Comandas comuns do vendedor e pedidos de retirada/entrega entram diretamente no **azul**, esperando pagamento. Vendedor apenas lança e acompanha.
- **Azul → verde:** arrastar abre o recebimento; nenhuma baixa ocorre ao arrastar. Escolha uma ou mais formas, confira os valores e confirme. As demais movimentações são bloqueadas no servidor.
- **Vermelho:** fiados registrados. Os recebimentos são lançados na conta do cliente, sem repetir a baixa da venda original.
- **Pix recebido diretamente na chave:** em Esperando pagamento, escolha **Pix já recebido (conferir comprovante)**; confira o valor e a conta, marque a conferência, anexe obrigatoriamente a foto ou o PDF do comprovante e registre a observação. JPG, PNG, WebP e PDF são aceitos até 3 MB; o arquivo é salvo no Storage e vinculado ao pagamento. O recibo da comanda oferece **Ver comprovante Pix anexado** para Caixa/Admin. Para cobrança já emitida, use **Confirmar Pix manualmente e finalizar**. Somente Caixa/Admin confirma. Após a confirmação manual, eventos seguintes não consultam o Sicredi nem repetem a baixa. As parcelas de uma cobrança emitida permanecem fixas para preservar a conciliação.
- **Recebimento parcial:** abra Receber pagamento, selecione o cliente e informe o valor recebido. Em dívida de R$ 200, receber R$ 100 deixa R$ 100 pendentes. Use **Receber valor restante** para registrar outro recebimento com nova identificação. Cada recebimento também pode ser dividido entre dinheiro, débito, crédito e Pix conferido.
- O chat mantém a navegação por categorias nos botões; texto digitado busca em todo o catálogo. Os resultados usam o cartão compartilhado, com uma coluna no celular e até três em telas maiores.

## Clientes, entrega e recebimento no caixa

- Abra a comanda, toque no botão da forma de pagamento e confirme o recebimento. O mesmo conjunto de botões atende pagamentos divididos e recebimentos de dívida.
- Ao selecionar **Entrega**, a identificação do cliente abre automaticamente. Nome, WhatsApp com DDD e endereço completo (rua, número, bairro e cidade) são obrigatórios. CPF e e-mail são opcionais no caixa; o e-mail serve para vincular o cadastro ao login do cliente, não para gerar a cobrança Pix.
- No diálogo de identificação, **BUSCAR CLIENTE** abre uma janela própria. A busca começa após quatro letras do nome. Selecione um resultado para preencher os dados e confirme em **Selecionar cliente**. Para um cadastro novo, use **Adicionar cliente**.
- No catálogo, o cadastro vinculado ao e-mail do login preenche os campos vazios da sacola. Dados já digitados permanecem preservados.
- Clicar fora das janelas fecha o diálogo. Fechar o diálogo de pagamento não cancela a comanda nem confirma recebimento.
- O backend precisa de acesso ao bucket configurado em `FIREBASE_STORAGE_BUCKET` para guardar comprovantes. Falha no envio bloqueia a confirmação manual; os testes usam armazenamento isolado em memória.

## Entregador, localização e navegação

### Fluxo operacional

1. **Cliente / caixa:** ao escolher Entrega, informe nome, WhatsApp e endereço. Use **Usar minha localização**, **Selecionar no mapa** ou **Buscar endereço**; ajuste o pino no portão e informe a referência. O ponto acompanha o pedido. E-mail e CPF continuam opcionais no caixa.
2. **Caixa/Admin:** abra **Entregas → Preparando**, confira e separe os itens; use **Pedido separado · liberar entrega**. Pix pendente não é liberado. Quando o Pix é confirmado, o pedido pago já fica disponível para entrega.
3. **Entregador:** entre em `/caixa` com o PIN do usuário de cargo **ENTREGADOR**, cadastrado em **Admin → Equipe**. A sessão abre a aba Entregas. Em **Disponíveis**, abra o pedido e toque em **Aceitar e sair para entrega**. A aceitação é transacional: apenas um responsável assume o pedido. O WhatsApp do cliente recebe o aviso de saída pela fila de mensagens configurada.
4. **Rota:** em **Minhas entregas**, abra o pedido para ver endereço, referência, mapa, estimativa de distância/tempo e botões **Abrir no Google Maps / Abrir no Waze**. A rota integrada parte da loja configurada ou do GPS usado explicitamente pelo entregador. A navegação curva a curva acontece no aplicativo Google Maps/Waze.
5. **Na casa do cliente:** pedido já pago exige apenas **Confirmar entrega ao cliente**. Pedido pendente permite dinheiro, débito, crédito, pagamentos divididos, QR Pix na hora ou Pix manual com comprovante obrigatório. Receber e concluir gravam pagamento, operador, entregador e baixa em uma única transação. Se o Pix da porta for confirmado pelo banco, falta apenas confirmar a entrega física. Fiado precisa ser autorizado previamente pelo caixa; o entregador não lança novas dívidas.
6. **Devolver à fila:** use quando precisar transferir a entrega. O pagamento e a reserva do pedido permanecem; outro entregador pode assumir. Pedidos cancelados desaparecem da fila. Pedidos Pix vencidos continuam sujeitos ao cancelamento e à liberação da reserva.

O entregador acessa pedidos disponíveis e suas próprias entregas; não acessa vendas gerais, estoque, clientes, relatórios financeiros ou administração. A aba atualiza por eventos do servidor e possui atualização de apoio. O histórico de entregas é limitado aos 100 registros mais recentes.

### Configurar Google Maps

- Configure `GOOGLE_MAPS_API_KEY` no backend publicado. A chave anteriormente fornecida foi mantida no `.env` local; não há chave fixa no código. No Google Cloud do projeto da chave, habilite **Maps JavaScript API**, **Geocoding API** e **Routes API**, com faturamento ativo.
- Restrinja a chave aos domínios de produção e desenvolvimento usados pela loja e às APIs acima. Use `GOOGLE_MAPS_MAP_ID` para o Map ID da loja; sem ele, a integração usa o ID de demonstração dos exemplos oficiais.
- Configure `STORE_LAT` e `STORE_LNG` com o ponto real da Conflora. Sem essas coordenadas, a rota integrada solicita o GPS do entregador; ela não usa o centro de Mineiros como se fosse a loja.
- GPS exige HTTPS (localhost funciona para desenvolvimento) e autorização do navegador. Falha do mapa não bloqueia informar endereço ou abrir navegação externa. A API de mapas só é carregada quando o usuário abre o mapa; a posição do entregador não é acompanhada continuamente.
- Os índices de `deliveryStatus`, `assignedDriver.id` e `deliveredAt` estão em `firestore.indexes.json`. Em novos ambientes, publique-os com `firebase deploy --only firestore:indexes --project SEU_PROJETO`.
- Referências: [rotas na Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/routes/get-a-route), [marcador arrastável](https://developers.google.com/maps/documentation/javascript/advanced-markers/draggable-markers), [navegação Waze](https://developers.google.com/waze/deeplinks/).

## Vincular a API Pix do Sicredi

O catálogo principal e o PDV usam a **API Pix Sicredi**. A conexão real depende de adesão, credenciais e certificado emitidos para a Conflora. Os testes locais usam integrações simuladas.

1. Solicite à cooperativa a adesão à API Pix e a habilitação de cobrança imediata. Confirme a chave Pix da conta recebedora e guarde o ID de adesão.
2. No Portal do Desenvolvedor Sicredi, abra o chamado de acesso à API Pix com o ID de adesão. Para integração própria, registre um CSR, aguarde a assinatura, baixe o certificado e a chave privada e gere Client ID/Client Secret sobre o certificado.
3. Solicite primeiro as credenciais/host de **homologação**. A URL de homologação não é pública e é informada pelo Sicredi; não invente a URL nem use a de produção para simular pagamento.
4. Configure as variáveis abaixo no `.env` de homologação ou nos segredos protegidos do Cloud Run. No Cloud Run, crie os segredos no Secret Manager, conceda acesso à conta de runtime `conflora-api-sa` e mapeie cada segredo para a variável de ambiente com o mesmo nome. Nunca envie certificados, chave privada ou Client Secret pelo chat/Git.

```dotenv
SICREDI_PIX_BASE_URL=https://api-pix.sicredi.com.br/api/v2
SICREDI_OAUTH_URL=https://api-pix.sicredi.com.br/oauth/token
SICREDI_CLIENT_ID=
SICREDI_CLIENT_SECRET=
SICREDI_CERT_PEM=
SICREDI_KEY_PEM=
SICREDI_PIX_KEY=
SICREDI_WEBHOOK_SECRET=
SERVICE_URL=https://seu-dominio-publicado
TASK_SECRET=
CLOUD_TASKS_QUEUE=conflora-jobs
GCP_REGION=southamerica-east1
PIX_PAYMENT_TTL_SECONDS=3600
```

`SICREDI_PIX_KEY` é a chave Pix registrada na conta Sicredi (CPF/CNPJ, e-mail, telefone ou EVP), não o Client ID. O certificado e a chave privada devem formar o par emitido para esta integração. O cliente Sicredi usa mTLS e OAuth2 Client Credentials; a credencial precisa dos escopos `cob.write`, `cob.read`, `pix.read` e `webhook.write` (e `webhook.read` se habilitado para consulta). O aplicativo envia o valor travado (`modalidadeAlteracao: 0`).

5. Gere um segredo aleatório exclusivo, com pelo menos 32 caracteres, para `SICREDI_WEBHOOK_SECRET`. Publique primeiro o backend com esse segredo e `SERVICE_URL` HTTPS público. O endpoint registra o evento e consulta o pagamento ao Sicredi antes de atualizar Firestore.
6. Configure a fila Cloud Tasks no projeto/região usados pelo backend e o mesmo `TASK_SECRET` no serviço. Publique Cloud Run e os rewrites do Firebase Hosting para `/api/**`, `/tasks/**` e `/webhooks/**`. Com as credenciais autorizadas, execute `npm run check:sicredi -- --connect` para testar autenticação sem gerar Pix. Depois rode `npm run sicredi:webhook` para registrar a URL `/webhooks/sicredi-pix/{segredo}` na chave Pix.
7. Confira o cadastro do webhook no Sicredi. Faça uma cobrança real pequena, de valor e estoque controlados, usando a tela `/caixa`. Confirme no pedido: recibo e QR entregues, valor do pedido idêntico ao valor pago, status `APPROVED`/`CONFIRMED`, `paymentTransactionId`, uma única movimentação de estoque e uma única baixa após reenviar o webhook.

Para endurecer o recebimento do webhook, use um gateway HTTPS que valide o certificado cliente Sicredi e injete `SICREDI_WEBHOOK_GATEWAY_SECRET`; o backend só deve confiar nesse header quando ele for inserido pelo gateway após a validação mTLS. Não permita que um cliente externo envie esse mesmo header. A alternativa da URL com segredo aleatório deve ser tratada como proteção por segredo, não como validação criptográfica do certificado Sicredi.

Se o WhatsApp ainda não estiver conectado, o PDV continua mostrando o QR e o Pix Copia e Cola na tela da venda; para enviar recibo/QR ao telefone, configure `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION`, `WHATSAPP_PDV_TEXT_TEMPLATE` e `WHATSAPP_PDV_QR_TEMPLATE` (ou o template de cliente já aprovado), além de `OWNER_WHATSAPP_NUMBER`. O número do cliente precisa ter DDD válido e os modelos Meta devem estar aprovados para mensagens fora da janela de atendimento.

## Implantação e operação

- Não coloque `.env`, tokens, certificados nem arquivos de Service Account no Git.
- Configure segredos reais em Secret Manager/Cloud Run e mantenha Firestore, Firebase Auth, Storage, `SERVICE_URL`, webhook e segredos do mesmo ambiente.
- `scripts/deploy-dev.ps1` é específico do ambiente de validação `confloraai-dev` e atualmente valida o checkout Mercado Pago de teste/real; não é o deploy de produção do Sicredi.
- Antes de publicar mudanças, rode `npm run check:full`, `npm run test:pix` e `npm run test:dev`. A suíte não substitui a homologação com Firestore, WhatsApp e Sicredi reais.
- Mantenha backup e reconciliação financeira. Se o banco confirmar um recebimento e o estoque não puder ser baixado (por exemplo, estoque insuficiente), não entregue o pedido automaticamente: faça a conciliação e resolva/refunde no banco.

## Documentação oficial

- [Guia oficial de integração da API Pix Sicredi](https://developers.sicredi.com.br/public/docs/getting-started-pix)
- [Informações gerais, autenticação e segurança de webhooks do Sicredi](https://developers.sicredi.com.br/public/docs/general-information)
- [Login Google para Web no Firebase](https://firebase.google.com/docs/auth/web/google-signin)
- [Documentação interna do fluxo PDV/Sicredi](docs/PDV-SICREDI.md)
- [Documentação interna dos fluxos Pix e limites](docs/PIX-TESTE-E-INTEGRIDADE.md)

## Ativar estoque ou vender sem entradas

Em **Admin → Estoque**, o botão **Ativar estoque / Estoque ativo · Desativar** controla o catálogo, caixa, comandas e entregas. Apenas Admin altera essa configuração.

- **Desativado (venda livre):** permite vender sem cadastrar entradas, inclusive gerar e receber Pix, sem reservar nem alterar o saldo de novos pedidos.
- **Ativado:** exige saldo disponível, reserva os itens dos pedidos pendentes e baixa o estoque na confirmação do pagamento.
- Reservas criadas antes da desativação são preservadas até o pagamento ou cancelamento do respectivo pedido. A mudança não apaga entradas, saldos ou movimentações anteriores. Atualize uma tela de venda já aberta para recarregar a disponibilidade do catálogo.
