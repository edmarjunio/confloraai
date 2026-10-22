# Estoque

Fonte: `products.stockQuantity/estoque`; reserva: `reservedQuantity`. Disponível = físico − reservado. A vitrine agora apresenta o saldo após reservas. Movimento histórico não substitui saldo.

`prepareStockReservation` lê a configuração na transação e aproveita os produtos já relidos pelo núcleo, evitando uma segunda leitura dos mesmos documentos. Quantidades repetidas são somadas; saldo/reserva inválidos e disponibilidade insuficiente impedem todo o commit. UN/KG, mínimos, incrementos e até três casas de quantidade são preservados.

Reservar não baixa estoque físico. Receber efetiva baixa e libera a própria reserva; reservas de outros pedidos continuam protegidas mesmo se a configuração global for desabilitada. Cancelamento libera uma vez. Esses fluxos existentes são cobertos por testes de integridade e pelos novos cenários entre canais.

Importação já existente recusa código cadastrado e usa lotes transacionais com checkpoints. Não foi executada importação, ajuste ou limpeza real. Administração ainda possui caminhos legados de edição de produto/estoque que exigem revisão específica antes de permitir edição concorrente com vendas; não houve migração geral desses caminhos nesta rodada.
