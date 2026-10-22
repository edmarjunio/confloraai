# Atendimento breve e encomendas — Conflora AI

> Histórico da implementação inicial. O fluxo atual, incluindo comanda em `orders`, cotação por item, sinal de 50%, chegada e entrega/retirada, está em [ENCOMENDAS_FLUXO_COMPLETO.md](ENCOMENDAS_FLUXO_COMPLETO.md). As seções de persistência e previsão abaixo descrevem a versão anterior e foram substituídas por esse fluxo.

Implementação local em 22/10/2026. Sem deploy, cobrança ou envio real de WhatsApp nesta tarefa.

## Comportamento

- Ausência no catálogo não gera negativa de venda. O agente oferece possível encomenda de produto permitido, sem preço ou prazo inventados.
- Mensagens curtas, sem apresentações e encerramentos repetidos, propaganda ou ofertas adicionais automáticas.
- Produtos e quantidades são confirmados antes do registro. Itens desconhecidos não são descartados de pedidos mistos.
- Sem previsão: “Assim que a equipe confirmar a previsão de chegada, te aviso!”. Sem valor: “Vou confirmar o valor e te aviso!”.
- Linguagem explícita de finalidade ilícita não produz confirmação automática. Itens sem cadastro ficam pendentes de avaliação comercial pela equipe.
- O backend não usa texto do modelo para inventar SKU, preço, recebimento ou registro. Preços monetários de respostas de IA são comparados aos valores do contexto; confirmações fictícias e prazos gerados são bloqueados.
- A confirmação de pedido com quantidade faltante pergunta somente essa informação. A resposta completa o registro já aceito, sem pedir a mesma confirmação novamente.

## Exemplos executáveis cobertos pelos testes

| Cliente | Resposta/caminho |
| --- | --- |
| Tem galinha da angola francesa? | Podemos encomendar! Quer que eu registre seu pedido? |
| Quando chega? | Assim que a equipe confirmar a previsão de chegada, te aviso! |
| Quanto custa? | Vou confirmar o valor e te aviso! |
| Quero 2 galos combatentes e 3 galinhas da angola | Preserva os dois itens e quantidades e pede confirmação |
| Quero 4 alfaces e 2 galinhas da angola | Identifica pronta entrega somente com estoque verificado; mantém encomenda separada por item |
| Pode registrar | Persiste a comanda e os avisos antes de responder “Pedido registrado!” |

## Persistência e consistência

Não há coleção nova. O rascunho fica em `sessions/{phone}.orderIntake`. A comanda de atendimento confirmada fica em `agent_handoffs/{requestId}` com `kind: ORDER_REQUEST`, `requestStatus: AWAITING_QUOTE`, itens e quantidades, cliente e versão. Ela aparece na nova aba administrativa **Encomendas**.

Essa comanda registra a solicitação comercial. Ela não é uma venda quitada: itens sem preço confirmado mantêm `priceMinor: null`, o total financeiro é `null`, não há Pix, cobrança, faturamento ou reserva/baixa de estoque. O pedido misto mantém todos os itens na comanda de atendimento. A equipe precisa cotar e seguir o checkout comercial existente para efetivar a venda; não há conversão automática dessa comanda em pedido financeiro nesta entrega.

Pedidos integralmente identificados e aptos à venda continuam no fluxo existente. Escolha de variante/preço e consultas de categoria preservam o roteamento anterior. A classificação usa o índice de catálogo existente para identificar candidatos e relê somente seus IDs; não força uma leitura global por mensagem quando esse índice está disponível.

A transação registra juntos comanda, transição do rascunho e intenções de aviso na `pdv_outbox`. Confirmação duplicada não cria outra comanda. A atualização do rascunho verifica a versão e preserva os demais campos de `sessions`.

Falha de persistência não autoriza resposta de sucesso. Falha de envio mantém a intenção para recuperação; resultado incerto não recebe retry cego. A mensagem ao cliente confirma o registro, sem afirmar que um responsável já leu o aviso.

## Avisos à Conflora e ao Junior

Após o commit, o backend tenta imediatamente:

1. Criar aviso para administradores em `notifications`.
2. Enviar o resumo ao WhatsApp da Conflora.
3. Se há encomenda, enviar também ao Junior.

Configuração, sem números ou segredos embutidos no código:

| Destino | Configuração |
| --- | --- |
| Conflora | `STORE_NOTIFICATION_PHONE`; utiliza o número do proprietário existente como fallback |
| Junior | `JUNIOR_WHATSAPP_NUMBER`; fallback `OWNER_WHATSAPP_NUMBER` |
| Transporte | Configuração WhatsApp Cloud API existente |

Quando os dois destinos configurados são o mesmo número, um trabalho combinado evita duplicação. Número ou provedor ausente não é tratado como envio bem-sucedido. O worker existente recupera pendências; em Cloud Run parado/escala zero, permanece necessária a integração operacional de recuperação já descrita no projeto.

## Previsão posterior de chegada

No site principal, abrir **Configurações → Encomendas** com ADMIN. A tela lista o cliente e os itens, permite informar a previsão e exige confirmar sua origem na equipe/fornecedor. Para itens sem verificação comercial, exige também confirmar a comercialização permitida.

O backend grava a previsão, o operador e uma nova versão junto de um trabalho de aviso ao cliente. Não existe data automática de sete dias ou uma semana. Atualizações repetidas com a mesma versão/conteúdo não duplicam o aviso. Um trabalho de previsão superada não envia informação antiga.

Endpoints privados:

- `GET /api/caixa/encomendas`: ADMIN/CAIXA, até 100 registros por consulta.
- `POST /api/caixa/encomendas/:id/previsao`: ADMIN/CAIXA; corpo com `version`, `forecast`, `confirmed: true` e, quando exigido, `commercializationAllowed: true`.

Exemplo de corpo de uma atualização humana, sem prazo padrão:

```json
{
  "version": 1,
  "forecast": "previsão efetivamente confirmada pelo fornecedor",
  "confirmed": true,
  "commercializationAllowed": true
}
```

A interface adicionada é administrativa. CAIXA conserva acesso aos endpoints autorizados, sem ganhar acesso geral à administração da vitrine.

## Canais de atendimento

- **WhatsApp Cloud API:** o fluxo de encomendas atua antes do menu e do texto livre para solicitações reconhecidas, respeitando pausa de atendimento humano, configuração do proprietário da automação e deduplicação da inbox.
- **Agente verificado/conector:** produtos ausentes recebem oferta de encomenda; não viram produtos falsos nem provocam pausa apenas por ausência. Ambiguidade, falha técnica e conflito de dados continuam protegidos. O envelope identifica `ORDER_INTAKE`, sem cards/SKUs inventados.
- **Vitrine principal:** usuário autenticado com telefone cadastrado pode usar o mesmo serviço pelo assistente habilitado. Sem contexto de registro/identificação, a consultoria orienta o WhatsApp e não afirma que registrou.
- **Guia de categorias:** busca sem resultados oferece a possibilidade de encomenda e direciona ao WhatsApp.
- **Outras lojas:** recebem a política textual de concisão no assistente; não há migração de seus dados nem unificação automática com as comandas da Conflora.

O parser determinístico cobre solicitações explícitas, listas e quantidades dos exemplos. Não se declara compreensão irrestrita de qualquer frase livre. Ambiguidades e condições que dependem de confirmação humana não autorizam promessa de pronta entrega.

## Arquivos principais

- Novos: `src/services/customer-service-policy.js`, `src/services/order-intake.service.js`, `src/http/order-intake.routes.js`, `test/order-intake.test.js`.
- Integração: `src/http/app.js`, `src/services/message.service.js`, `src/agent/agent-service.js`, `src/orders/pdv.service.js`, `src/storefront/existing-store.js`.
- Linguagem: `src/ai/agent.service.js`, `src/storefront/assistant.js`, `src/services/direct-price.service.js`, `src/agent/templates.js`, `src/orders/order.service.js`, `public/storefront/guided-chat.js`.
- Interface: `public/storefront/admin.js`.
- Regressões ajustadas: testes de atendimento, contratos do agente, fluxo nativo e navegador. Assertions foram atualizadas para as mensagens breves, e os doubles de menu passaram a representar o transporte utilizado. O teste SSE passa a consumir o snapshot inicial antes de procurar o evento do pedido, mantendo limite de tempo.

## Validação e publicação

Resultados finais estão em `validacao-atendimento.json` e logs do pacote. Testes usam doubles de Firestore/WhatsApp e transporte HTTP em memória; não comprovam homologação bancária ou entrega real Meta. Os três arquivos de carga prolongada não fazem parte da rodada de regressão selecionada. O cenário com emulador continua condicionado à sua disponibilidade.

A consulta de edição do banco remoto não pôde ser concluída nesta sessão. Foi reutilizada a fronteira de transações já existente, sem provisionamento, migração, alteração de regras ou operação remota de dados.

O pacote é um patch cumulativo verificado contra a referência local original, incluindo as melhorias locais de carregamento anteriores necessárias à cópia de trabalho. Antes de aplicar em um checkout diferente, executar `git apply --check`. Não aplicar à força sobre mudanças concorrentes.

Após aplicar: executar build, lint, testes de atendimento e testes de navegador; conferir os destinos dos avisos e homologar o fluxo Meta em ambiente autorizado. Preservar as orientações de atualização de assets do relatório de carregamento. Nenhum deploy foi executado por esta tarefa.
