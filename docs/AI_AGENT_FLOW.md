# Agente e evidência comercial

O agente verificado identifica IDs usando nomes, sinônimos aprovados e características botânicas revisadas. Depois relê documentos oficiais e verifica coerência de identidade, preço, status e unidade. Respostas de preço não usam texto livre de IA como autoridade.

Consultas ambíguas a um produto específico geram atendimento humano. Consultas por características podem listar até três opções verificadas. Produto inexistente, ausência de evidência botânica, conflito de campos ou falha de persistência não autorizam produto/preço inventado.

`MessageService` agora liga esse agente à outbox já existente. Durante um carrinho ativo, confirmação e atualização de detalhes continuam no fluxo determinístico; outras consultas seguem para o agente verificado. O módulo Gemini legado é mantido para compatibilidade e consultoria, sem promoção de respostas livres a operações financeiras.

`agent_pilot_carts` e suas ferramentas continuam atrás dos controles existentes. A preparação de checkout do piloto é um resumo, não confirmação financeira. A extensão para compra conversacional completa, edição arbitrária de quantidades e coleta guiada de endereço deve ser homologada separadamente.
