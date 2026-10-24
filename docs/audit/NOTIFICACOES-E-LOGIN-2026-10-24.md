# Notificações operacionais e login Google — implementação local integrada

## Estado

Integração retomada sobre `6684eca`, sem conflitos pendentes. Sem deploy, mensagens
reais ou alterações de configurações persistidas reais. O merge preservou o código;
a revisão final restabeleceu a seleção de avisos solicitada pelo usuário: sem
novo pedido genérico, sem comprovante/quitacão avulsa para proprietários e sem usar
o número do responsável como substituto silencioso do Junior. Detalhes por caixa
continuam nos registros e relatórios; o WhatsApp recebe o resumo compacto.
Este documento substitui as decisões divergentes de notificações em
[MERGE-SEGURO-PR14-2026-10-24.md](MERGE-SEGURO-PR14-2026-10-24.md).

## Login Google

Consulta HTTP somente de leitura a `confloraai.web.app/storefront-auth.js` e
`lojaconflora.web.app/storefront-auth.js`: status 200 com `text/html`, em lugar do
módulo JavaScript esperado. O catch-all do Hosting entrega o shell nessa rota.
As três variáveis Firebase públicas necessárias estão presentes no `.env` local
original; isso não comprova configuração do ambiente hospedado, provedor Google
habilitado nem domínios autorizados.

Correção integrada em `firebase.json`, antes do catch-all:

```json
{
  "source": "/storefront-auth.js",
  "run": { "serviceId": "confloraai", "region": "southamerica-east1" }
}
```

`public/storefront/app.js` inicia a autenticação independentemente da carga do
catálogo e exibe falha de importação. `src/http/firebase-client.js` consulta os
botões no momento em que o SDK termina de carregar. Não habilita botão sem SDK,
configuração e função de autenticação disponíveis. E-mail/senha permanecem.

Referência: https://firebase.google.com/docs/hosting/full-config

## Configuração administrativa

Admin → Status das Conexões → Destinatários WhatsApp. Cinco posições fixas:
Horta, Edmar Júnio, Junior, Telvia e Rose. Telefone com DDD, ativo, avisos
operacionais e fechamento diário. Campos vazios não enviam. Fechamento vem
selecionado somente para Junior. A lista inicial usa as variáveis legadas quando
presentes; confira o número legado do responsável antes de atribuí-lo à Horta.
`JUNIOR_WHATSAPP_NUMBER` não está configurado no `.env` original consultado.

GET/PUT `/api/admin/whatsapp/notification-settings`: somente ADMIN, resposta
privada/no-store; persistência em `store_settings/whatsapp_notifications`.
Valida números brasileiros e versão concorrente. Não grava no cache público.
Salvar configurações não dispara teste ou reenvia notificações históricas.

## Fluxos implementados

- Pedido de desconto >5% do vendedor: gravação atômica da aprovação e intenção
  na outbox, sem criar venda ou pagamento; alerta com motivo, itens, valor dos
  produtos, percentual/valor do desconto e total final.
- Comanda aguardando confirmação/fiado: motivo e ação a tomar. Espera simples de
  pagamento não produz o antigo aviso genérico de novo pedido.
- Recebimento oficial: recibo compacto com itens, desconto, taxa, total, vendedor
  e situação. Fiado permanece identificado como a receber.
- Entrega disponível sem responsável: alerta para atribuir entregador. Estado
  relido antes do envio impede aviso depois de alguém assumir.
- Entrega concluída: usa estado oficial entregue e recebimento/fiado registrado.
  Fiado é identificado como pendente; nunca apresentado como dinheiro recebido.
- Último caixa fechado: resumo numérico, top 3 por quantidade e valor, usando
  `getDailyExecutiveMetrics`, o mesmo serviço dos relatórios; inclui total vendido,
  recebido, ticket médio, fiado, quitação e valores conferidos por meio. Fundo de
  caixa separado do faturamento. Nova abertura invalida resumos ainda pendentes;
  novo fechamento gera revisão atualizada.

Raízes existentes `owner-new`, `owner-paid` e novas intenções são expandidas em
`pdv_outbox` com identidade estável por evento/pedido/destinatário. Destinatários
iguais não duplicam. Cada envio usa claim, lease, checkpoint de chunks e ack do
transporte existentes. Resultado desconhecido exige reconciliação, sem retry cego.
O status agregado da raiz significa fila expandida; a API de fechamento só
informa envio quando todos os filhos possuem ack. Meta aceitar não prova entrega.

`proof-review` e `owner-debt-paid` deixam de gerar avisos WhatsApp de proprietário
sob a política selecionada; conferência Pix e quitação continuam nos fluxos
oficiais e painéis. Encomendas continuam notificando o painel da equipe; o aviso
WhatsApp inicial para responsáveis foi suprimido. Cotação, previsão e eventos de
encomenda para clientes permanecem. Relatórios solicitados manualmente continuam
independentes da assinatura automática. Notificações de cliente e entregador
mantêm seus destinatários legítimos, mesmo se um telefone também estiver na equipe.

## Dependências externas

Avisos proativos fora da janela de 24h exigem template aprovado e apropriado à
finalidade. O transporte existente `sendPdvText` usa o template configurado; sem
ele, texto livre depende de janela aberta. Não foi criado/aprovado template na
Meta. Um template que comprime texto em parâmetro pode alterar quebras de linha;
homologar o resultado visual e a finalidade aprovada. O número de teste depende
da lista de destinatários autorizados. Não houve verificação/envio real aos cinco.

Referência: https://business.whatsapp.com/policy/preview?lang=pt_BR

## Imagens e carregamento

A correção anterior permanece no commit `dfe0c0a`: PDV chama
`ConfloraProductCard.getImageCandidates`, compartilhado com a vitrine. Fonte,
proveniência e referência canônica seguem a auditoria de produtos. Não significa
que toda imagem já seja Storage; a auditoria anterior distingue fontes externas,
locais e Storage. Nenhum upload/migração ocorreu nesta entrega. As capturas do
ambiente hospedado não refletem correções locais sem publicação autorizada.

## Verificação e custos

Build, check:full e lint aprovados. Suíte funcional isolada: 510 aprovados,
1 ignorado por depender do emulador, zero falhas. Seleção exclui testes de carga,
performance e benchmark. O glob inicial incluiu inadvertidamente o teste
instrumentado `firestore-finops-load.test.js`; foi interrompido sem concluir.
Isso não constituiu homologação de performance, não tocou Firestore real e nenhum
resultado parcial foi adotado como medição. A execução funcional posterior usou
seleção explícita sem esse arquivo.

Testes de navegador adicionados: formulário real Admin com cinco destinatários,
persistência/reload, viewport móvel/desktop; habilitação do botão e exibição de
erro Google usando módulo SDK substituído exclusivamente no teste. Cenário
existente confirmou a mesma URL Storage e imagem carregada (naturalWidth > 0)
no Caixa e vitrine. Esses testes não autenticam conta Google real, não enviam à
Meta e não comprovam que todas as fotografias do banco real sejam Storage.
Resultado final da suíte de navegador em `NOTIFICACOES-validation.json`.
Sem tempos reais de resposta medidos; duração de teste não representa latência
da loja. LCP/INP/CLS e teste Safari/iPhone real permanecem pendentes.

Navegador: 45 aprovados e 1 exclusivo de layout móvel ignorado no desktop.
Suíte de notificações: 13 regressões, incluindo transições oficiais de entrega
desde disponibilidade até recebimento e conclusão, sem duplicação do recibo.

## Arquivos e consumidores

| Arquivo | Alteração e consumidor real |
| --- | --- |
| `firebase.json` | Rewrite da autenticação ao backend, antes do shell. |
| `public/storefront/app.js`, `src/http/firebase-client.js` | Inicialização independente do catálogo, habilitação após SDK, falhas visíveis. |
| `src/http/views-admin.js` | Cinco posições, preferências, persistência e proteção contra resposta de outro usuário/perfil. |
| `src/http/whatsapp-admin.routes.js` | GET/PUT privados, Admin, validação e versão concorrente. |
| `src/orders/operational-notifications.js` | Seleção, formatação e expansão idempotente dos destinos na outbox oficial. |
| `src/orders/pdv.service.js` | Intenção de aprovação; worker revalida destinatários/estado por chunk e usa transporte existente. |
| `src/orders/pdv.repository.js` | Intenções nas transações de recebimento e entrega. |
| `src/orders/cashier-sessions.js` | Intenção somente após último caixa, revisão e valores conferidos; sem duplicar sessões no novo job. |
| `src/reports/daily-executive-report.js` | Resumo compacto das métricas oficiais; relatório completo preservado. |
| `src/http/pdv.routes.js` | Distingue fanout enfileirado de filhos aceitos pelo provedor. |
| Testes de notificações/navegador, PDV, Sicredi, fechamento e encomendas | Cobertura da seleção de avisos, preservando recibos de clientes, cotação/previsão e validação comercial. |

## Conformidade aplicável

- Conforme na implementação local: estrutura antes dos recursos secundários;
  catálogo sem novas consultas de pedidos; cache público derivado; configuração
  privada; transações/idempotência; nenhuma confirmação financeira por cache;
  fixtures fora do bundle; Pix manual, simulador isolado e Sicredi pendente preservados.
- Conforme nas regressões isoladas: mesma imagem, recarga, proteção por perfil,
  deduplicação, recebimento oficial, entrega, último caixa e falhas.
- Pendente: Google real, domínios/provedor, aprovação/finalidade do template,
  envio real aos cinco números, Safari/iPhone e performance medida. Sem declaração
  de produção validada.

Até cinco jobs por evento, mais a raiz e checkpoints; números repetidos reduzem
o fanout. Cada chunk revalida configuração e registro oficial, aumentando leituras
de forma proporcional aos destinatários. Fechamento lê dados do dia pelo serviço
de relatórios, somente ao produzir o resumo. Nenhuma consulta acrescentada ao
carregamento do catálogo. Sem alteração de preços, reservas, baixas, Pix manual
Sicredi ou integração bancária pendente.

## Homologação e rollback

Antes de publicar: verificar Google com domínio autorizado; testar os cinco destinos somente
com autorização de envio, aprovação/recusa de desconto, recibo dinheiro/Pix/fiado,
entrega assumida/concluída, dois caixas e fechamento simultâneo, nova abertura,
rede interrompida e reconciliação. Conferir valores com Relatórios.

Para pausar os novos avisos, Admin desmarca Ativo nos destinatários; cada chunk
revalida essa preferência. Não interrompe loja/caixa. Mensagens aceitas pela Meta
não podem ser canceladas retroativamente. Rollback de código deve preservar o
tratamento dos novos jobs; não remover o handler enquanto existirem pendências.
Não apagar outbox, configuração, pedidos, clientes ou registros financeiros.
