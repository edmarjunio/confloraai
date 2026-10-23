# Agente e evidência comercial

O agente verificado identifica IDs usando nomes, sinônimos aprovados e características botânicas revisadas. Depois relê documentos oficiais e verifica coerência de identidade, preço, status e unidade. Respostas de preço não usam texto livre de IA como autoridade.

Na primeira mensagem do WhatsApp, o cliente escolhe catálogo virtual, sacola no WhatsApp ou atendimento pelo agente. Os botões são mensagens interativas da sessão iniciada pelo cliente. O agente extrai os produtos e as quantidades; preços, disponibilidade e operações financeiras são decididos pelo backend com documentos atuais do Firestore. Uma identificação ambígua pede esclarecimento, sem escolher um produto arbitrariamente.

`SalesConversationService` registra o estado da conversa no Firestore. Itens indisponíveis são oferecidos como encomenda, sem inventar prazo exato ou preço. Após consentimento, somente esses itens são registrados como encomenda. A venda dos itens disponíveis exige confirmação separada, seguida de retirada/entrega, endereço quando necessário e forma de pagamento. A taxa de entrega é informada e confirmada antes de gerar o pedido.

Antes de criar a venda, o backend relê preços e disponibilidade, reserva estoque e gera recibo com identificador estável. Cliques antigos e repetições não geram nova venda. Pix Sicredi usa cobrança e confirmação bancária verificadas quando as credenciais reais estão configuradas. Pix manual continua pendente até conferência autorizada; texto do cliente ou comprovante isolado nunca confirma pagamento. O simulador Sicredi usa armazenamento descartável e não grava vendas nem envia WhatsApp real.
