# WhatsApp — implementação local, homologação pendente

Contrato operacional, configuração e roteiro: [WHATSAPP_IMPLEMENTATION.md](WHATSAPP_IMPLEMENTATION.md).

Webhook assinado → validação de WABA/número → normalização de texto/quick reply/order → incoming_messages com geração → Cloud Tasks ou recuperação da mesma inbox → worker autenticado → MessageService → parser determinístico / consulta verificada / SalesConversationService → OrderService / OrderIntakeService → núcleo comercial oficial → pdv_outbox → transporte → Meta.

A inbox serializa o telefone com lease. Não concatena uma mensagem já processada com a seguinte. O worker recebe o ID e relê o payload persistido; o corpo da tarefa não altera produtos/ações. Tombstones e gerações preservam deduplicação e bloqueiam eventos anteriores à intervenção humana.

Apresentação e menu usam exclusivamente sendWelcomeTemplate, com logo e componentes do contrato conferido. CTA URL abre o site sem mensagem intermediária. Montar minha sacola envia catalog_message; sem habilitação, informa a pendência e aceita texto. Falar com atendente registra human_requested/NEEDS_HUMAN_ATTENTION e deixa a conversa silenciosa para a equipe. Não inicia agente virtual nem consulta catálogo/IA. Callbacks antigos de categoria/produto redirecionam para a entrada nova; entrega/pagamento antigos não confirmam vendas.

O atendimento WhatsApp não utiliza fallback Gemini. O checkout usa o parser determinístico; texto que não puder ser resolvido com segurança vai para revisão humana. A assistência independente do site foi preservada. Catálogo/Firestore resolvem identidade, variantes, preços e disponibilidade. Carrinho Meta descarta o preço recebido e passa por resumo, modalidade/endereço/taxa, pagamento e confirmação final explícita. A comanda oficial tem origem WHATSAPP_BOT, conversationId e pagamento pendente; reserva não equivale a baixa física ou quitação. Procura por encomenda reutiliza o serviço existente e requer consentimento; cotação real e aceite são posteriores.

Posse humana persiste em agent_conversations. O compositor reivindica posse ao receber foco e só libera edição após confirmação do servidor. O envio manual também pausa no servidor, exige requestId e não simula confirmação do provedor. Retomada é explícita/autorizada; human_requested, cliente, menu e mudança de dia não retomam o agente.

A geração acompanha o contexto até as transações comerciais e o ponto de submissão em WhatsAppClient.postRequest. Outbox revalida chunks, retentativas e consultas verificadas; trabalhos antigos são ignorados ou conciliados. SENDING precede a chamada externa; resultado desconhecido exige reconciliação, sem retry cego. Mensagem já aceita pela Meta não tem cancelamento retroativo garantido.

Coexistência, quando disponível, usa smb_message_echoes; IDs próprios confirmados têm índice durável em whatsapp_delivery, inclusive chunks. Echo humano repetido é deduplicado na inbox. Echo sem correspondência local causa pausa conservadora. Não existe observação inventada da digitação humana; capacidade e estrutura da conta ainda precisam de homologação.

Sincronização preparada: trigger de products/{productId} em functions/src/index.ts → identidade na outbox existente. O worker relê a versão atual, verifica revisão comercial, usa retailer_id estável, fingerprint, lease e geração. Produto inativo/excluído/reprovado fica indisponível na projeção Meta. Exige flag, autorização ADMIN persistida e publicação futura autorizada do trigger; primeira sincronização não executada. Não há sincronização global por mensagem.

Menu, novo dia e reinício não apagam pedidos, pagamentos, operações, histórico ou pausa. Reinício arquiva contexto de vendas na coleção de atendimento existente antes de limpar o contexto ativo, preservando rascunhos comerciais. Reset administrativo limita-se ao telefone de teste configurado.

O piloto do conector permanece isolado e não é o checkout Meta. Pix manual, simulador isolado e Sicredi real aguardando liberação foram preservados. Nenhum teste funcional/performance, deploy, envio real ou sincronização inicial foi executado nesta entrega.
