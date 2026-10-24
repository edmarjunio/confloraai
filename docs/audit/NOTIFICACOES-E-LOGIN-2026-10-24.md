# Notificações operacionais e login Google — alterações locais em integração

## Estado

Atualização posterior: a integração e as correções de preservação estão descritas
em [MERGE-SEGURO-PR14-2026-10-24.md](MERGE-SEGURO-PR14-2026-10-24.md).
Esse relatório posterior substitui as pendências de merge e a política de
supressão de avisos descritas historicamente abaixo: avisos de novo pedido,
comprovante e quitação foram preservados, assim como os detalhes por caixa.

Implementação local em andamento, sem deploy, sem mensagens reais e sem alteração
de configurações persistidas reais. A conclusão foi interrompida por merge externo
no mesmo worktree, com conflitos em `src/services/message.service.js` e
`docs/AI_AGENT_FLOW.md`. O merge externo também substituiu a alteração de
`firebase.json` que encaminhava `/storefront-auth.js` ao Cloud Run. Não confundir
as edições desta entrega com as exclusões de `output/` provenientes desse merge.

## Login Google

Consulta HTTP somente de leitura a `confloraai.web.app/storefront-auth.js` e
`lojaconflora.web.app/storefront-auth.js`: status 200 com `text/html`, em lugar do
módulo JavaScript esperado. O catch-all do Hosting entrega o shell nessa rota.
As três variáveis Firebase públicas necessárias estão presentes no `.env` local
original; isso não comprova configuração do ambiente hospedado, provedor Google
habilitado nem domínios autorizados.

Correção necessária em `firebase.json`, antes do catch-all:

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
oficiais e painéis. Avisos de encomendas/atendimento e relatórios solicitados
manualmente pertencem a fluxos independentes preservados: a filtragem global
desses destinos ainda precisa ser revisada antes de afirmar que nenhum outro
tipo de mensagem alcançará os números configurados.

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

Antes do merge externo: check:full e lint aprovados; 73 testes Node isolados de
PDV, caixa e notificações aprovados. Após ajustes adicionais: 9 testes focados de
notificações aprovados, incluindo permissão Admin, atualização concorrente,
deduplicação, retry incerto e resumo invalidado por nova abertura. Um teste de
contrato Hosting detectou a perda da rota durante o merge. Validação integrada,
build e navegador finais permanecem pendentes até resolver a concorrência.
Não houve sessão de performance ou homologação real nova. Sem tempos reais de
resposta medidos; duração de teste não representa latência da loja.

Até cinco jobs por evento, mais a raiz e checkpoints; números repetidos reduzem
o fanout. Cada chunk revalida configuração e registro oficial, aumentando leituras
de forma proporcional aos destinatários. Fechamento lê dados do dia pelo serviço
de relatórios, somente ao produzir o resumo. Nenhuma consulta acrescentada ao
carregamento do catálogo. Sem alteração de preços, reservas, baixas, Pix manual
Sicredi ou integração bancária pendente.

## Homologação e rollback

Depois de integrar o merge: reconstruir frontend, executar lint/checks e regressões
isoladas; verificar Google com domínio autorizado; testar os cinco destinos somente
com autorização de envio, aprovação/recusa de desconto, recibo dinheiro/Pix/fiado,
entrega assumida/concluída, dois caixas e fechamento simultâneo, nova abertura,
rede interrompida e reconciliação. Conferir valores com Relatórios.

Para pausar os novos avisos, Admin desmarca Ativo nos destinatários; cada chunk
revalida essa preferência. Não interrompe loja/caixa. Mensagens aceitas pela Meta
não podem ser canceladas retroativamente. Rollback de código deve preservar o
tratamento dos novos jobs; não remover o handler enquanto existirem pendências.
Não apagar outbox, configuração, pedidos, clientes ou registros financeiros.
