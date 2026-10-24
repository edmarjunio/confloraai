# Manifesto de arquivos — atendimento WhatsApp

Cópia: C:/Users/Junin/confloraai. Revisão inicial: f7ec6478b5ee79614f6fa7ff8d03d88e286ec3e6. Continuação autorizada: aeb65b6a7dc1464ae9ff1cd94fcc39d24be04204.

O usuário incorporou parte das primeiras mudanças em commits/merge externos. O agente não fez commit, staging ou merge. Por isso, o diff cumulativo é a referência para revisar toda a implementação; o incremental mostra o trabalho posterior à atualização da main. A/M/D indicam adição/modificação/remoção.

## Cumulativo contra a revisão inicial

```text
M	.env.example
M	docs/AI_AGENT_FLOW.md
M	docs/DEPLOYMENT_GUIDE.md
M	docs/REAL_SCENARIO_READINESS.md
M	docs/WHATSAPP_ARCHITECTURE.md
M	functions/src/index.ts
M	public/pdv/components.jsx
M	scripts/check-whatsapp-config.js
M	src/agent/agent-store.js
M	src/catalog/catalog.repository.js
M	src/database/repositories/whatsapp-delivery.js
M	src/database/transactions.js
M	src/http/app.js
M	src/http/whatsapp-admin.routes.js
A	src/integrations/whatsapp-inbound.js
A	src/integrations/whatsapp-welcome.js
M	src/integrations/whatsapp.client.js
M	src/orders/commercial-order.js
M	src/orders/order.service.js
M	src/orders/pdv.repository.js
M	src/orders/pdv.service.js
M	src/server.js
A	src/services/automation-send-guard.js
M	src/services/conversation-automation.js
D	src/services/conversation-outbox.js
M	src/services/customer-service-policy.js
M	src/services/durable-conversation-transport.js
M	src/services/incoming-message.service.js
M	src/services/message.service.js
A	src/services/meta-catalog-sync.service.js
M	src/services/order-intake.service.js
M	src/services/procurement-workflow.service.js
M	src/services/sales-conversation.service.js
A	src/services/sales-parser.js
A	src/services/whatsapp-echo.service.js
M	test/app.test.js
M	test/meta-agent.test.js
M	test/order-intake.test.js
M	test/sales-conversation.test.js
M	test/verified-whatsapp-catalog.test.js
M	test/whatsapp-flow.test.js
M	test/whatsapp-greeting.test.js
```

## Incremental contra a main atualizada

```text
M	.env.example
M	docs/AI_AGENT_FLOW.md
M	docs/DEPLOYMENT_GUIDE.md
M	docs/REAL_SCENARIO_READINESS.md
M	docs/WHATSAPP_ARCHITECTURE.md
M	public/pdv/components.jsx
M	scripts/check-whatsapp-config.js
M	src/agent/agent-store.js
M	src/database/repositories/whatsapp-delivery.js
M	src/database/transactions.js
M	src/http/app.js
M	src/http/whatsapp-admin.routes.js
M	src/integrations/whatsapp.client.js
M	src/orders/commercial-order.js
M	src/orders/order.service.js
M	src/orders/pdv.repository.js
M	src/orders/pdv.service.js
M	src/server.js
M	src/services/automation-send-guard.js
M	src/services/conversation-automation.js
D	src/services/conversation-outbox.js
M	src/services/customer-service-policy.js
M	src/services/durable-conversation-transport.js
M	src/services/incoming-message.service.js
M	src/services/message.service.js
M	src/services/meta-catalog-sync.service.js
M	src/services/order-intake.service.js
M	src/services/procurement-workflow.service.js
M	src/services/sales-conversation.service.js
M	src/services/sales-parser.js
M	src/services/whatsapp-echo.service.js
M	test/app.test.js
M	test/meta-agent.test.js
M	test/order-intake.test.js
M	test/sales-conversation.test.js
M	test/verified-whatsapp-catalog.test.js
M	test/whatsapp-flow.test.js
M	test/whatsapp-greeting.test.js
```

## Arquivos novos ainda não rastreados

- docs/WHATSAPP_CHANGED_FILES.md
- docs/WHATSAPP_IMPLEMENTATION.md
- docs/whatsapp-static-validation-2026-10-23.json
- test/whatsapp-acceptance.test.js

Resultados estáticos: [registro](whatsapp-static-validation-2026-10-23.json). Fluxos, remoções, preservações, pendências e operação: [relatório](WHATSAPP_IMPLEMENTATION.md). Nenhum teste funcional/performance foi executado.
