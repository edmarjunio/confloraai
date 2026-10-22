# Pagamentos e conciliação

Recebimento permanece em `PdvRepository.receive`, usado também pelos pedidos oficiais `WHATSAPP_BOT`. Dinheiro, crédito, débito, Pix, fiado, crédito do cliente e pagamentos divididos mantêm seus contratos. A soma das parcelas deve fechar o total em centavos; troco é calculado sobre a parcela em dinheiro. A calculadora informativa do frontend não cria recebimento.

**Pix automático:** pedido/reserva → TXID persistido → cobrança Sicredi → webhook autenticado → consulta ao banco → valor, chave, TXID, E2E e devoluções conferidos → recebimento idempotente. Pagamento tardio vai para `pdv_pix_late_payments`, sem confirmação cega.

**Pix manual:** chave/titular precisam estar configurados. Pedido continua pendente; apenas os responsáveis autorizados conferem o crédito bancário e comprovante conforme rotas existentes. O recibo WhatsApp passa a mostrar a chave configurada e deixar a pendência explícita. Copiar Pix, enviar comprovante ou dizer “paguei” não quita a venda.

Fiado/crédito permanecem vinculados ao cadastro e à autorização. A loja principal nova recusa FIADO no checkout público; o endpoint legado autenticado mantém o fluxo preexistente de solicitação com aprovação administrativa, para não alterar suas regras financeiras silenciosamente.

`pdv_pix_events`, `pdv_pix_late_payments`, comprovantes e quitações foram mantidos. Homologação Sicredi, configuração real do webhook, certificados e devolução bancária completa permanecem externos/pendentes; não houve chamada de pagamento real nem criação de estorno novo.
