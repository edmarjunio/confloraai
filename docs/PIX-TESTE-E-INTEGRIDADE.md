# PIX: integridade e roteiro de teste

## Arquitetura implementada

Escopo: checkout Mercado Pago em `src/http/app.js`, loja em `/api/orders`, PDV e confirmação em `FirestoreRepository`.

1. O servidor calcula o pedido com os produtos cadastrados e gera a preferência no Mercado Pago.
2. O pedido PIX é persistido pendente. A criação não altera o estoque.
3. O webhook valida a assinatura e consulta o pagamento na API do Mercado Pago. Exige PIX aprovado, BRL, referência do pedido e valor correspondente.
4. Uma transação relê o pedido e os produtos, valida quantidades, soma linhas do mesmo produto e verifica o estoque. Pagamento, baixa, marca `stockDeducted` e movimentos são gravados juntos.
5. Reenvios não repetem a baixa. Pedidos antigos com `stockDeducted: true` mantêm a baixa anterior. Pedidos entregues não voltam a confirmados.
6. Confirmação administrativa usa a mesma operação. Cancelamento disputa a mesma transação e não pode apagar pagamento/baixa existente. Falhas do Firestore não resultam em confirmação apenas em memória.

As regras de validação estão separadas em `src/orders/order-integrity.js`. Movimentos novos incluem `orderId` para rastreabilidade.

## Credenciais

Você precisa obter os dois segredos na sua conta Mercado Pago. Preencha o `.env` local; na hospedagem, use variáveis protegidas/Secret Manager. Não envie os valores no chat nem os versione.

```dotenv
MERCADO_PAGO_ACCESS_TOKEN=preencha_com_o_access_token_do_ambiente
MERCADO_PAGO_WEBHOOK_SECRET=preencha_com_a_assinatura_secreta_do_webhook
SERVICE_URL=https://seu-backend-de-homologacao
```

- **Access Token:** aplicação em [Suas integrações](https://www.mercadopago.com.br/developers/panel/app). Para homologação, use as credenciais e contas de teste indicadas para Checkout Pro via Preferences API. Não deduza o ambiente apenas pelo prefixo do token.
- **Webhook secret:** na mesma aplicação, Webhooks → Configurar notificação. Cadastre eventos de pagamento e a URL `https://seu-backend-de-homologacao/webhooks/mercadopago`. Copie a assinatura secreta gerada para `MERCADO_PAGO_WEBHOOK_SECRET`.
- **SERVICE_URL:** endereço HTTPS público do backend que recebe o webhook. `localhost` não é acessível pelo Mercado Pago. Um túnel HTTPS para o backend local ou uma implantação de homologação atende essa finalidade.
- **Firestore:** o backend precisa de credenciais de serviço e permissão de leitura/gravação no banco de homologação. Uma Firebase API Key sozinha não substitui essa autorização.
- `PIX_KEY`, `PIX_TITULAR` e `STORE_PIX_KEY` pertencem a fluxos de PIX estático existentes no projeto. Não substituem os segredos do Mercado Pago neste checkout. Public Key não é consumida por este fluxo de redirecionamento.
- Para enviar recibos por WhatsApp, configure também `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` e um modelo aprovado em `WHATSAPP_CUSTOMER_ORDER_TEMPLATE`.

Referência: [configuração e assinatura de notificações](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/payment-notifications). A assinatura aceita timestamp em milissegundos ou segundos e rejeita assinaturas inválidas/expiradas.

## Teste local sem dinheiro real

```powershell
npm run test:pix
npm run check:pix
```

`test:pix` usa pagamentos simulados, HTTP local e armazenamento em memória/double transacional. Não precisa de token nem movimenta dinheiro. Cobre duplicidade, concorrência, valor divergente, assinatura, cancelamento, estoque insuficiente, produto ausente e falha no commit.

`check:pix` informa apenas preenchido/pendente, sem revelar segredos. Não valida os valores na API nem a conectividade/permissões do Firestore. Na inspeção inicial, os três campos acima estavam ausentes/vazios.

## Homologação com Mercado Pago

1. Configure as credenciais de teste, webhook e banco separado; rode `npm run check:pix` e inicie com `npm run dev`.
2. Cadastre um produto com estoque 10 e preço conhecido. Deixe o controle de estoque habilitado.
3. Crie um pedido de 2 unidades na loja. Verifique que está pendente, tem link de checkout e o estoque permanece 10.
4. Abra o checkout em janela anônima com a conta compradora de teste. Confira preço e referência.
5. Para Checkout Pro via Preferences API, a documentação considera bem-sucedido o teste de PIX offline que permanece **pendente**. Não espere aprovação bancária automática nesse teste: [compras de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/integration-test/test-purchases).
6. A aprovação e as repetições são exercitadas por `test:pix`. Para homologar o ciclo financeiro real, programe separadamente uma transação real controlada; isso ainda não foi executado.
7. Repita a criação no PDV: PIX continua aguardando aprovação; dinheiro/cartão é confirmado pelo caixa. Após uma aprovação válida, o esperado é estoque 8, um movimento e pedido confirmado. Reenvios mantêm estoque 8.

## Limites e conciliação

- Não há reserva antecipada neste fluxo. Se o estoque acabar entre a criação e o pagamento, a confirmação falha sem baixar parcialmente. O pagamento externo pode já ter ocorrido: exige conciliação e eventual reembolso, não entrega automática.
- Cancelar no sistema não cancela uma cobrança no Mercado Pago. PIX recebido depois do cancelamento exige conciliação. Reembolso automático não está implementado.
- Pedidos históricos que sofreram baixa sem a marca `stockDeducted` precisam de auditoria antes de confirmar novamente. Não foi feita migração nem alteração dos pedidos e estoques reais.
- Falha de envio de recibo não desfaz pagamento confirmado; não existe fila durável de reenvio de recibos neste ajuste.
- Os testes transacionais usam um double com commit/rollback e exigência de leituras antes de escritas. Ainda é necessária homologação com Firestore real/emulador e com as credenciais do provedor.
- A vitrine SaaS em `src/storefront` tem um fluxo próprio de reserva/PIX estático; este documento não a certifica como integrada ao Mercado Pago.

## Validação

Suíte automatizada completa passou após o ajuste dos cenários antigos. Uploads reais do Storage foram bloqueados em modo de teste; o repositório em memória usa imagens locais ou o storage injetado pelo teste. Nenhum deploy ou cobrança foi realizado por esta entrega.
