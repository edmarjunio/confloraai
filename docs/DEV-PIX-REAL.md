# ConfloraAI Dev — teste com Pix real (Mercado Pago)

O projeto principal continua `confloraai`. O ambiente separado é `confloraai-dev`;
não é outro repositório. Nenhum script deste roteiro publica no projeto principal.
Os pagamentos deste roteiro movimentam dinheiro real na conta recebedora Mercado Pago.
Credenciais de teste não validam a liquidação bancária real.

## Separação

| Recurso | Principal | Dev |
| --- | --- | --- |
| Projeto Google Cloud/Firebase | confloraai | confloraai-dev |
| Cloud Run | confloraai | confloraai-dev |
| Hosting | confloraai.web.app | confloraai-dev.web.app |
| Firestore | banco do principal | banco próprio, inicialmente vazio |
| Storage | bucket do principal | confloraai-dev.firebasestorage.app |
| Cloud Tasks | fila existente | conflora-jobs-dev |
| Credenciais Google | existentes | conta conflora-dev-runtime, sem permissões no principal |
| Mercado Pago | aplicação existente | criar aplicação separada para dev, com credenciais de produção |
| WhatsApp | existente | desabilitado nesta homologação de pagamentos |

O dev bloqueia IDs de projeto, credenciais explícitas, Auth, bucket, fila e URL de outro
ambiente antes de abrir conexões. Não copie credenciais, `.env`, pedidos, usuários ou
estoque de produção. `NODE_ENV=production` é o modo do Node; `APP_ENV=dev` identifica
o destino. O modo real é verificado pelo campo `live_mode` retornado pelo Mercado Pago,
nunca inferido apenas pelo prefixo do token.

## 1. Criar os recursos

Pré-requisitos: Node 24, gcloud e Firebase CLI instalados; contas autenticadas com
permissão para criar projeto, vincular faturamento, gerenciar IAM e publicar Cloud Run.
O ID `confloraai-dev` precisa estar disponível globalmente ou já pertencer a você.

Na raiz do checkout desta branch:

```powershell
gcloud auth login
firebase login
gcloud billing accounts list
.\scripts\bootstrap-dev.ps1 -BillingAccount ID_DA_CONTA_DE_FATURAMENTO
```

Se a organização exigir, passe `-OrganizationId` OU `-FolderId`. O script pode ser
reexecutado: consulta os recursos antes de criar. Não muda o projeto padrão do gcloud.
Cloud Run, Firestore, build e Storage podem gerar custos na conta vinculada.

No [console Firebase do dev](https://console.firebase.google.com/project/confloraai-dev/overview):

1. Registre um aplicativo Web e guarde `apiKey` e `appId` desse aplicativo.
2. Inicialize Authentication, habilite Google e autorize `confloraai-dev.web.app`.
3. Inicialize Storage em `southamerica-east1`, com bucket `confloraai-dev.firebasestorage.app`.
4. Confira o site padrão Hosting `confloraai-dev`. Se necessário, crie-o:
   `firebase hosting:sites:create confloraai-dev --project confloraai-dev`.

As regras dev negam acesso direto de clientes a Firestore/Storage; o servidor usa IAM.
O login Google existente reconhece o administrador Edmar pelo e-mail já definido no app.
Os demais perfis de teste devem ser cadastrados no admin do dev.

## 2. Configurar Mercado Pago e secrets

Em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app), crie uma
aplicação separada para esta homologação, ligada à conta recebedora desejada. Use as
credenciais **de produção dessa aplicação**. Isso isola a configuração de webhook,
mas o dinheiro continua entrando na conta real do vendedor.

Configure eventos de pagamento com a URL em modo produção:

`https://confloraai-dev.web.app/webhooks/mercadopago`

No Secret Manager de **confloraai-dev**, adicione uma versão habilitada a cada segredo
criado pelo bootstrap:

| Segredo | Conteúdo |
| --- | --- |
| mercado-pago-access-token | Access Token de produção da aplicação dev |
| mercado-pago-webhook-secret | Assinatura secreta do webhook dessa mesma aplicação |
| conflora-admin-secret | Valor aleatório exclusivo do dev |
| conflora-task-secret | Outro valor aleatório exclusivo do dev |

Não envie tokens no chat, não copie os secrets automaticamente do principal e não os
coloque em arquivos versionados. A URL enviada em cada preferência já aponta para dev.

## 3. Testar e publicar somente dev

```powershell
npm ci
npm run test:pix
npm run test:dev-isolation
.\scripts\deploy-dev.ps1 -FirebaseApiKey SUA_API_KEY_WEB_DEV -FirebaseAppId SEU_APP_ID_WEB_DEV
```

O script valida o App ID contra o número do projeto dev, verifica versões dos secrets,
usa contas de build/runtime próprias, publica Cloud Run e o arquivo `firebase.dev.json`
explicitamente e verifica `/health`. Todas as rotas, inclusive webhook, passam pelo
backend dev. `firebase.json` e a hospedagem principal não são alterados.

Não use `scripts/deploy.sh` para esse procedimento: é um script legado, sem as
proteções e sem o destino desta homologação.

## 4. Dados de teste e conferência local

```powershell
Copy-Item config/dev.env.example .env.dev
```

Preencha `.env.dev` com os valores do dev. Para executar ferramentas locais, autentique
Application Default Credentials com uma conta que possa acessar **apenas os recursos
necessários do dev** (`gcloud auth application-default login`), ou use uma conta de
serviço do dev via `GOOGLE_APPLICATION_CREDENTIALS`. Não reutilize um arquivo
`firebase-service-account.json` do principal; ele será recusado.

```powershell
npm run seed:dev
```

O seed cria um produto ativo `dev-pix-1-real`, de R$ 1,00, com estoque 10 e habilita
controle de estoque apenas se ainda não existir a configuração. Reexecuções não
sobrescrevem produto, saldo nem configuração. Confira o controle de estoque no admin.

## 5. Roteiro de aceite antes da produção

1. Abra `https://confloraai-dev.web.app/health`: espere `environment=dev`,
   `projectId=confloraai-dev`, `paymentProvider=MERCADO_PAGO`, `expectedLiveMode=true`.
2. Teste login/logout de administrador, caixa e cliente, inclusive tentativa de um
   cliente acessar telas/APIs de admin e caixa. Dados e sessões devem existir só no dev.
3. Na loja principal `/`, compre uma unidade do produto de teste. Anote o ID do pedido;
   espere `AWAITING_PIX`, checkout Mercado Pago e estoque ainda 10.
4. Confira destinatário e valor de R$ 1,00 no banco e pague você mesmo. Não use contas
   de teste do Mercado Pago. O pagamento deve ser feito por um comprador real distinto
   do recebedor, conforme as regras da conta. Não há Pix bancário automático neste script.
5. Espere webhook HTTP 200. No banco dev, espere `CONFIRMED`, `paymentStatus=APPROVED`,
   `paymentTransactionId` preenchido, `stockDeducted=true` e estoque 9.
6. Execute a conferência somente de leitura, com os dois IDs reais:

   ```powershell
   npm run check:dev-pix -- ID_DO_PEDIDO ID_DO_PAGAMENTO_MERCADO_PAGO
   ```

   Ela consulta `/health`, Firestore dev e `GET /v1/payments/{id}`; exige Pix aprovado,
   BRL, valor/referência corretos e `live_mode=true`, e cruza a confirmação persistida.
7. Reenvie a notificação pelo painel Mercado Pago, com assinatura válida atual.
   Confira estoque ainda 9, uma única baixa e pedido ainda confirmado.
8. Repita a criação no PDV e no fluxo de aprovação de desconto. Pedido sem pagamento
   permanece pendente e não pode ser entregue/confirmado manualmente como Pix.
9. Teste cancelamento antes de pagar, falha/atraso do webhook e recuperação. Não pague
   deliberadamente pedidos cancelados sem planejar conciliação; cancelamento local
   não devolve dinheiro. Os cenários de falha/concorrência também têm testes automatizados.

O teste de R$ 1,00 é uma sugestão operacional, não um limite imposto ao checkout.
A tela de `/shop/:slug` (SaaS) usa outro fluxo e não está certificada por este roteiro.
WhatsApp/Gemini ficam fora do aceite inicial: mensagens reais estão bloqueadas no dev,
e a consultoria precisa de configuração própria se for incluída depois.

## Promoção e limites

O workflow `Dev Pix validation` executa testes sem segredos e **não faz deploy**.
Guarde ID do pedido/pagamento, resultado da conferência e saldo antes/depois do reenvio.
Somente após esse aceite, revise e faça merge da PR; a publicação em `confloraai`
continua sendo uma etapa separada. Não copie `.env.dev` ou o banco dev para produção.

Se o pagamento for aprovado externamente e a baixa falhar (ex.: estoque insuficiente),
é necessária conciliação. Reembolso automático e reenvio durável de recibos não estão
implementados. O `/health` confirma identidade do ambiente; sozinho não comprova
permissão do Firestore, validade dos tokens ou recebimento de webhook.

Referências: [Webhooks Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications),
[Firebase CLI](https://firebase.google.com/docs/cli),
[build Cloud Run com conta própria](https://cloud.google.com/run/docs/configuring/services/build-service-account).
