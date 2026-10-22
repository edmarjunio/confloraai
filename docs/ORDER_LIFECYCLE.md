# Ciclo de pedidos

Estados existentes foram preservados, sem renomear o histórico. `AWAITING_CONFIRMATION` representa aprovação/detalhes pendentes; `AWAITING_CASHIER` e `AWAITING_PAYMENT` aguardam recebimento; `CREATING_PIX` prepara cobrança; `AWAITING_PIX` aguarda verificação. `CONFIRMED` possui `completedAt` e o estado financeiro correspondente. `CANCELLED` impede nova confirmação. Entrega possui seu próprio estado.

| Garantia | Implementação |
| --- | --- |
| Identidade | PDV usa request UUID; web usa chave de idempotência; WhatsApp guarda ID próprio no rascunho antes do checkout. |
| Replay | Núcleo retorna pedido existente somente com fingerprint/hash, origem e ator compatíveis. Não reseta outbox nem reserva. |
| Valores históricos | Nome, preço, quantidade, unidade e subtotal ficam no item persistido. Não recalcular vendas concluídas com o catálogo atual. |
| Confirmação comercial | WhatsApp cria pedido com pagamento `PENDING`; confirmação verbal não é quitação. |
| Cancelamento | Caminho transacional existente libera reserva uma vez e preserva parcelas recebidas para conciliação. |

Rascunhos novos são `sessions/{phone}.orderDraft`. Leitura de `orders/{phone}` só aceita registro legado sem origem, baixa ou conclusão; uma edição copia o rascunho para `sessions` sem apagar o original. Histórico oficial endereçado por telefone nunca é aberto como carrinho.

O carrinho piloto `agent_pilot_carts` prepara resumo, mas continua sem criar vendas ou movimentar estoque. Integração financeira automática desse piloto permanece pendente e não deve ser declarada concluída.
