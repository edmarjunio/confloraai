# Encomendas: cotação, sinal de 50%, chegada e entrega

Implementação na cópia local do Conflora AI, em 22/10/2026. Sem deploy, alterações no banco remoto ou mensagens reais nesta tarefa.

## Como operar

1. O cliente informa itens e quantidades e confirma o registro. O backend cria uma comanda sem preço e sem recebimento. A equipe e o Junior recebem os avisos existentes.
2. Em **Configurações → Encomendas**, o responsável informa **valor unitário** e **Data da chegada do item** de cada linha. O vínculo com o produto pode ser informado nessa etapa ou na chegada.
3. Ao confirmar a cotação, o sistema consulta o cliente com os itens, valores, datas, total, sinal de 50% e saldo na retirada ou entrega.
4. O aceite coloca a comanda em **Aguardando chegada**. O sinal continua pendente até conferência efetiva do caixa. A mensagem "paguei" não confirma dinheiro.
5. O responsável registra o sinal em dinheiro, débito, crédito ou Pix já recebido. Pix exige comprovante privado do pedido e confirmação do crédito na conta, com observação da conferência.
6. Depois da entrada dos produtos pelo controle de estoque existente, o responsável vincula os itens aos produtos cadastrados, confere todos e confirma a chegada. O sistema reserva os itens e avisa o cliente.
7. Retirada: responde **"Combinado, estamos te esperando aqui!"** e encaminha o saldo ao recebimento normal do caixa.
8. Entrega: consulta cadastro pelo telefone, apresenta o endereço e pede confirmação. Sem cadastro/endereço, solicita o endereço completo e o confirma antes de prosseguir. Uma alteração fica somente nesta venda e remove coordenadas antigas.
9. O endereço confirmado coloca a venda em **Aguardando entregador**, usando `PENDING_DELIVERY`. Aceite do entregador, separação, saída, cobrança do restante e conclusão seguem os serviços de entrega existentes.

ADMIN e CAIXA acessam o painel de encomendas. O caixa tem acesso somente à seção de encomendas dessa tela; não recebe permissão de alterar a configuração geral da vitrine. A comanda também aparece na coluna **Encomendas** do PDV, com atalho para a operação.

## Estados

| Situação | Estado da comanda |
| --- | --- |
| Registro sem valor/data | `AWAITING_QUOTE` |
| Cotação enviada | `AWAITING_QUOTE_ACCEPTANCE` |
| Cliente aceitou | `AWAITING_ARRIVAL` — Aguardando chegada |
| Chegada confirmada | `AWAITING_FULFILLMENT` |
| Retirada escolhida | `AWAITING_CASHIER` |
| Endereço confirmado | `AWAITING_CASHIER` + `deliveryStatus: PENDING_DELIVERY` |
| Saldo recebido | Estados normais de pagamento e entrega |
| Pix do saldo vencido | `AWAITING_RECONCILIATION` — conferência do caixa |

O estado de chegada e o estado financeiro são independentes. `paymentStatus: PARTIAL` indica sinal recebido; não significa venda quitada. Confirmação de chegada é uma ação explícita da equipe, nunca inferida da data prevista. Quando os itens têm datas diferentes, a escolha de entrega/retirada é solicitada depois da chegada e conferência de todos os itens da comanda.

## Mensagens ao cliente

Cotação de exemplo para 2 itens de R$ 40:

> Encontramos sua encomenda! 2 galinhas da angola: R$ 80,00; chega 05/11/2026. Total: R$ 80,00. Sinal de 50%: R$ 40,00 agora; restante de R$ 40,00 na retirada ou entrega. Podemos confirmar?

A data e os valores acima são apenas exemplo de documentação; no atendimento vêm da cotação confirmada pelo operador.

Chegada:

> Sua encomenda já está disponível na loja! Prefere entrega ou retirada?

Endereço conhecido:

> Entregamos em [endereço cadastrado]? Confirma ou prefere outro endereço?

Novo endereço:

> Confirma a entrega em [novo endereço]?

Não há prazo automático, preço criado por IA nem promessa de pagamento recebido. Respostas fora desses estados continuam seguindo as regras de atendimento breve e o fluxo comercial existente.

## Financeiro e estoque

- O total da venda permanece integral. O sinal fica em `order.procurement.deposit`; `paymentParts` representa o recebimento do saldo na conclusão. O recibo mostra sinal e saldo separadamente.
- Exemplo: venda de R$ 80, sinal de R$ 40 e saldo de R$ 40. O caixa registra R$ 40 de adiantamento e R$ 40 no recebimento final, totalizando R$ 80. A venda final conserva total de R$ 80; não se cobra R$ 80 novamente.
- O sinal é registrado como `ENCOMENDA_SINAL` na coleção de recebimentos já existente, `debt_settlements`. Não cria dívida fiada nem crédito livre para gastar em outra venda. Os relatórios identificam esse lançamento como adiantamento/sinal.
- Para total com centavo ímpar, o sinal arredonda para cima no centavo; o saldo é o restante exato. Os dois valores são apresentados antes do aceite.
- O recebimento do sinal é conferido por ADMIN/CAIXA. Esta entrega não cria cobrança Sicredi automática para o sinal. O Pix do saldo reaproveita o fluxo automático ou manual já configurado no projeto.
- A chegada não aumenta estoque automaticamente. Usa a entrada de estoque existente e reserva a quantidade conferida em transação. A baixa ocorre uma vez no recebimento final, preservando as validações existentes.
- O preço especial aprovado na cotação fica congelado na comanda aceita. Alterar o preço geral do catálogo depois não muda o valor já aceito da encomenda.
- O comprovante do sinal não pode ser reutilizado para quitar o saldo. Falhas de transação não deixam recebimento parcial ou sinal fictício.
- Cancelamento após sinal exige conciliação/estorno. Pix do saldo vencido preserva o sinal e os produtos, aguarda conferência; uma quitação manual exige comprovante e crédito efetivamente conferido. Não há estorno nem reemissão automática de Pix nesta entrega.
- Nenhuma nova regra de frete ou tarifa foi criada; não há cálculo adicional de frete específico nesse fluxo.

## Persistência e autorização

Nenhuma coleção nova:

| Coleção existente | Uso |
| --- | --- |
| `agent_handoffs` | Solicitação, itens, cotação, responsável, versões e andamento |
| `orders` | Comanda oficial vinculada pelo mesmo identificador, total, sinal, saldo e entrega |
| `sessions` | Rascunho e confirmação atual da conversa |
| `pdv_outbox` | Avisos duráveis, versões e confirmação do transporte |
| `debt_settlements` | Recebimento do sinal com tipo explícito |
| `payment_proofs` | Comprovantes privados e vínculo com o pedido |
| `products` / `stock_movements` | Reserva e baixa pelos controles existentes |

APIs de gestão exigem ADMIN/CAIXA e usam `private, no-store`. Dados pessoais, comprovantes e respostas transacionais não entram em cache público. O endereço só é consultado para o telefone da conversa e só se aplica à venda depois da confirmação do cliente. Cadastros ambíguos não são escolhidos arbitrariamente.

Confirmações duplicadas não geram nova comanda, sinal ou reserva. A versão da cotação é verificada. Uma conversa não recebe perguntas concorrentes de encomendas diferentes: a equipe precisa concluir a confirmação atual antes de enviar a próxima. Uma nova solicitação não faz um "sim" aceitar a cotação errada.

APIs adicionadas:

- `POST /api/caixa/encomendas/:id/cotacao`
- `POST /api/caixa/encomendas/:id/sinal`
- `POST /api/caixa/encomendas/:id/chegada`

O endpoint antigo `/previsao` permanece compatível com solicitações antigas sem cotação; não pode alterar uma encomenda já cotada/aceita.

## Avisos e configurações

- `STORE_NOTIFICATION_PHONE`: responsável da Conflora.
- `JUNIOR_WHATSAPP_NUMBER`: Junior nas encomendas.
- O fallback dos destinos continua `OWNER_WHATSAPP_NUMBER`, com deduplicação se for o mesmo número.
- Os avisos reaproveitam `sendPdvText`, que suporta os modelos aprovados já configuráveis por `WHATSAPP_PDV_TEXT_TEMPLATE` ou `WHATSAPP_CUSTOMER_ORDER_TEMPLATE`. Conferir o modelo e a parametrização reais antes da publicação, especialmente para avisos futuros.
- Falha de transporte não é tratada como mensagem entregue. O outbox mantém pendências; resultados incertos exigem reconciliação, sem retry cego. A recuperação depende do worker existente e de sua execução no ambiente publicado.

## Testes e entrega

Resultados reais desta revisão estão em `validacao-atendimento.json`, acompanhados dos logs. Incluem cotação, sinal, chegada, retirada, endereço salvo/alterado/ausente, entrega normal, Pix do saldo, expiração e conferência, relatórios sem duplicação, permissões, concorrência e falhas de transação. Os testes de navegador cobrem celular e desktop Chromium, incluindo upload privado do sinal Pix.

As integrações externas usam doubles. Esta tarefa não confirma entrega Meta, liquidação bancária, Firestore remoto ou comportamento em Firefox/WebKit. Os testes com emulador dependem da disponibilidade dele. Os três testes de carga prolongada continuam fora da regressão selecionada.

O pacote é cumulativo contra a referência local original e inclui as melhorias anteriores de carregamento e atendimento. Aplicar somente após `git apply --check`; executar build, lint e testes depois de aplicar. Nenhum segredo, coleção, regra de segurança ou serviço remoto foi provisionado/modificado por esta entrega. Não foi realizado deploy.

Para testar o domínio localmente:

```powershell
node --import ./scripts/test-env.js --test test/order-intake.test.js test/procurement-workflow.test.js
npm run build
npm run lint
npm run test:loading:browser
```

Para a regressão em ambiente sem sockets locais, há o adaptador de teste existente:

```powershell
$env:CONFLORA_IN_PROCESS_HTTP = 'true'
$files = Get-ChildItem test -Filter '*.test.js' -File | Where-Object { $_.Name -notin @('commercial-load.test.js', 'firestore-finops-load.test.js', 'firestore-load.test.js') } | ForEach-Object { $_.FullName }
node --require ./test/helpers/in-process-http.js --import ./scripts/test-env.js --test @files
```

Antes da publicação, conferir os destinos, o modelo aprovado, o acesso do responsável e a rotina de recuperação do outbox; homologar a conversa completa com usuários e dados autorizados.
