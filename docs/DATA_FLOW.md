# Fluxos de dados

1. **Consulta:** catálogo/índice identifica candidatos; preços apresentados pelo agente verificado são relidos em `products`. Cache visual não autoriza venda.
2. **Checkout:** adaptador valida o canal, lê produtos por IDs e calcula totais. O núcleo relê os produtos na transação; mudança de preço, nome, status ou unidade rejeita o checkout para revisão.
3. **Persistência:** a mesma transação cria pedido, reserva e intenções de recibo/equipe. Em WhatsApp, mantém também preferências do cliente sem substituir saldo ou dívida.
4. **Cobrança:** Sicredi é chamado fora da transação com TXID estável; anexação da cobrança revalida valor e identidade. Falhas deixam estado durável para recuperação, nunca sucesso fictício.
5. **Recebimento:** caixa autorizado ou evento bancário verificado aciona transação de pagamento/baixa/fiado/crédito. Notificações posteriores não desfazem o pagamento.
6. **Entrega e relatórios:** consomem o pedido oficial. Dados de navegação GA4 são auxiliares; receita e saldos vêm do Firestore.

Veja [estoque](INVENTORY_FLOW.md), [pagamento](PAYMENT_FLOW.md) e [WhatsApp](WHATSAPP_ARCHITECTURE.md) para regras e estados.
