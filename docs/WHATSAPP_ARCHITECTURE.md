# WhatsApp

Webhook Meta assinado → `incoming_messages` persistido → Cloud Tasks ou recuperação da inbox → worker autenticado → estado da conversa → consulta/carrinho → pedido oficial → pagamento → outbox.

O worker recebe apenas `messageId` como referência. Lê o payload original persistido, incluindo `interactiveId`; campos adicionais enviados na chamada não substituem o webhook. Tarefas antigas que já contêm o payload continuam compatíveis pelo mesmo ID. Sem inbox persistida a tarefa é recusada.

Pausa de atendimento humano é consultada antes de saudações, catálogo nativo, carrinho e pagamento, em todos os ambientes. Encaminhamento e pausa são gravados juntos; indisponibilidade impede resposta automática. Retomada usa a rota autenticada e o `HandoffStore` existentes. Agente também revalida pausa antes de autorizar resposta.

Consultas do agente verificado geram trabalhos `conversation-catalog` contendo IDs, não texto com preço em cache. O worker relê produtos antes do envio. O proprietário configurado (`cloud_api` / `meta_native`) determina quem pode responder; não há duas automações concorrentes por padrão.

Envios nativos/legados agora possuem marcador durável por mensagem, método, destinatário e etapa. `SENDING` vem antes da submissão; confirmação do provedor grava `SENT`. Timeout ou resultado desconhecido gera conciliação e pausa, sem retry cego. Falha comprovadamente anterior à submissão pode ser repetida com limite. Reinício após submissão desconhecida não dispara nova mensagem.

Callbacks de entrega usam hash de mensagem/estado e transação. `READ/DELIVERED` não retrocedem; falha pode suceder `SENT`. Callback recebido antes da gravação do ID fica pendente para reconciliação pelo worker. O último ID de texto/documento permanece reconhecido; callbacks de todos os chunks históricos ainda requerem ampliação do índice de identificadores.

Limites: o carrinho piloto não foi promovido a checkout; atalhos nativos de quantidade mantêm a experiência existente de adicionar incrementos. Homologação de templates, transporte Meta, retomada operacional e expiração de tarefas exigem ambiente externo autorizado.
