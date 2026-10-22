# Entregas

Pedido pendente de despacho → preparação/atribuição → saída → entrega concluída. As transições existentes ficam em `pdv.repository.js` e `delivery-policy.js`; não foi criada outra máquina de estados concorrente.

ADMIN/CAIXA e entregador responsável obedecem às permissões de cada operação. Entregador não recebe ou altera pedido de outro responsável. Entrega com Pix ou fiado pendente segue as exigências financeiras existentes.

`delivery_events` mantém o histórico completo, `orders.deliveryHistory` mantém a janela consumida pelas telas, e `delivery_driver_metrics` é atualizada na transação de conclusão. Repetição da conclusão não soma uma entrega novamente. O suporte a pedidos oficiais WhatsApp vem da ampliação explícita das origens comerciais aceitas no caixa.

O snapshot do caixa busca entregas ativas independentemente da data do pedido; consultar apenas vendas do dia não faz uma entrega antiga desaparecer. Testes de métricas/transições são locais; fluxo HTTP e operação com entregador real dependem da homologação indicada em `TEST_REPORT.md`.
