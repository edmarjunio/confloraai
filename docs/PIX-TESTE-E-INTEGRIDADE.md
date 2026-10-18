# Pix e integridade

O Pix manual exige comprovante privado, conferência bancária e aprovação por Caixa/Admin. Pedidos ficam pendentes até a aprovação. O envio de texto ou imagem por conversa não aprova pagamentos.

O Pix automático usa somente Sicredi e depende da configuração e homologação descritas em [Ativação Sicredi](ATIVACAO-SICREDI.md). O callback autenticado consulta o banco e confere identificador, chave, valor e devoluções antes de registrar pagamento e baixa de estoque.

Reservas e recebimentos são gravados em transações. Repetir uma confirmação não repete a baixa. A fila de notificações permite novas tentativas após falha; uma queda entre a aceitação da mensagem pelo provedor e o registro local ainda pode provocar repetição de mensagem.

Para validar o código de forma pontual: npm run test:pix. Para validar a interface: npm run test:e2e. Esses comandos não acompanham alterações continuamente e não iniciam com o servidor.
