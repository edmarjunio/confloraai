# Loja Conflora — atendimento comercial verificado

Relatório de implementação local e roteiro de homologação — 21/10/2026.

## Situação da entrega

Implementação local, sem publicação, sem envio de mensagens reais e sem alteração de documentos reais do Firestore. Os testes utilizam dados fictícios isolados. A homologação externa permanece pendente. A tentativa de criar `feat/whatsapp-verified-catalog` foi bloqueada pela permissão de escrita em `.git`; as alterações estão no diretório de trabalho da branch `main`, sem commit ou push.

## Diagnóstico e decisões

- `src/agent` já continha contratos, validação comercial, índice de identificação, carrinho piloto e HandoffStore. Esses componentes foram reutilizados.
- `MessageService` usava outro fluxo: catálogo em memória com fallback após falha de atualização, geração livre por IA e imagens sem a mesma validação comercial. O caminho de produção passa agora pelo agente estruturado. Sem esse serviço, o processamento automático falha fechado.
- A autenticação do conector aceitava uma chave padrão e o segredo administrativo. Ambos os fallbacks foram removidos. Chaves padrão conhecidas são recusadas; em produção a chave configurada deve ter ao menos 32 caracteres.
- O encaminhamento anterior criava um registro por requisição. Agora uma transação verifica a conversa antes de abrir a pendência, evitando múltiplos atendimentos abertos para o mesmo contato. Retomada exige ação autorizada e o handoff atual.
- O resolvedor da vitrine possui imagens ilustrativas, e há informações botânicas geradas por inferência. Esses dados não fundamentam respostas do WhatsApp.
- O repositório não comprova habilitação, contrato homologado ou controle de silêncio do Meta Business Agent nessa conta. A especificação HTTP existente foi preservada como adaptador interno não homologado. Não foi configurado conector no painel Meta.

## Comportamento implementado

O fluxo utiliza WhatsApp Cloud API, inbox durável existente, agente estruturado, `products`, HandoffStore e outbox operacional existente. Nenhum novo cadastro de produtos ou checkout foi criado.

1. Registra a mensagem recebida no histórico de forma persistente e idempotente.
2. Verifica o responsável configurado e se a automação está pausada.
3. Interpreta consultas por nome, ID, sinônimo aprovado ou atributos botânicos revisados. Não chama IA para essas consultas.
4. Usa índice de identificação com TTL e atualização compartilhada. Falha na atualização vencida bloqueia a resposta.
5. Relê os documentos comerciais selecionados. Ausência, conflito, inativação, preço inválido ou alteração dos atributos usados na indicação causam encaminhamento silencioso.
6. Persiste na fila de saída apenas referências de produtos e critérios, sem congelar preços ou textos comerciais.
7. Antes do envio, relê e valida novamente os produtos, a pausa da conversa, os critérios e o texto final. Até três opções são enviadas em lista curta; um produto pode ser enviado como imagem com legenda.
8. Atualiza as referências de “primeira/segunda/terceira” após confirmação do envio pela API. Nova consulta ou foto relê o documento; o histórico textual nunca fornece preços.

Referências com tamanho, cor ou outras variações que não possam ser distinguidas com segurança são encaminhadas à equipe. O interpretador local é deliberadamente limitado: qualificadores desconhecidos, negações e alternativas complexas causam silêncio, sem uma indicação aproximada. Não foram adicionados embeddings, banco vetorial ou nova chamada paga de IA.

Consultas não alteram vendas, carrinho, reservas, estoque ou pagamentos. Interesse de compra e assuntos fora do catálogo seguem para atendimento humano; os demais canais existentes de pedidos, site, PDV e Pix permanecem disponíveis. O carrinho piloto do conector fica desabilitado por padrão.

Produto ativo não produz afirmação de estoque. A política atual de bootstrap mantém `assertAvailability=false`. Uma futura habilitação de disponibilidade exige controle oficial ligado e quantidades válidas; existência do cadastro não comprova estoque.

## Características botânicas aprovadas

As descrições atuais de IA não têm comprovação de revisão. Para habilitar indicações por características, revisar cada produto e enviar o campo `botanical` pelo endpoint administrativo existente `POST /api/admin/products`, junto do produto. Isso utiliza o mesmo documento de `products`, sem catálogo paralelo. O backend atribui `reviewedBy` ao operador autenticado e grava `reviewedAt`; não aceita a identidade de revisor enviada pelo cliente como autoridade.

Exemplo de formato, sem atribuir esses atributos a qualquer produto real:

```json
{
  "approved": true,
  "traits": {
    "light": ["sol_pleno"],
    "environment": ["externo"],
    "use": ["cerca_viva"]
  }
}
```

| Campo | Valores aceitos |
| --- | --- |
| `light` | `sol_pleno`, `sombra` |
| `environment` | `interno`, `externo` |
| `use` | `cerca_viva`, `jardim_vertical`, `vaso_grande` |
| `size` | `pequeno` |
| `growth` | `pendente` |
| `leaf` | `grande` |

Não preencher automaticamente. Ausência de revisão impede recomendação por essas características. Revogar `approved` bloqueia indicações subsequentes na releitura. A atualização administrativa invalida o índice local; outras instâncias atualizam pelo TTL, com revalidação dos dados comerciais a cada resposta. Inclusões ou novos atributos podem levar até cinco minutos para serem descobertos em outras instâncias.

## Imagens

O agente consulta apenas campos originais do documento (`images`, `imageUrl` e aliases). Aceita imagens HTTPS do bucket Firebase configurado, em objetos sob `products/`, após verificar acesso, tipo JPEG/PNG e tamanho até 5 MiB. Não segue redirecionamentos nem acessa URLs locais/privadas, outras origens, o resolvedor ilustrativo ou imagens da internet. Fotos ausentes/inacessíveis são omitidas; um pedido explícito de foto sem imagem verificável abre atendimento humano.

Imagens em outras origens, formatos ou rotas internas podem existir no site, mas são omitidas pelo WhatsApp até haver um mecanismo seguro homologado para elas. Listas com vários produtos usam texto; a foto de uma opção pode ser solicitada em seguida.

## Pausa, falhas e duplicidade

- `agent_handoffs` e `agent_conversations` continuam sendo a fila e o estado oficial da automação.
- A mensagem original e o motivo acompanham o encaminhamento; mensagens posteriores continuam no histórico.
- Falha ao persistir o handoff não autoriza resposta externa e gera evento técnico `catalog_handoff_persistence_failed` para investigação.
- Não há retomada por nova mensagem do cliente.
- A fila administrativa existente é acessível por sessão da equipe em `GET /api/meta-agent/admin/handoffs`. ADMIN, CAIXA e VENDEDOR podem consultar; ADMIN e CAIXA podem retomar em `POST /api/meta-agent/admin/handoffs/{id}/resume`. Não foi criado um novo inbox visual ou substituído o canal humano de envio de mensagens.
- Respostas livres antigas na outbox são descartadas quando o agente controlado está presente.
- Antes de chamar a Meta, o envio de catálogo passa para `SENDING`. Um timeout, erro de provedor ou queda após envio não provoca reenvio automático. Resultado incerto abre handoff para conciliação. Registros `SENDING` abandonados por mais de dois minutos são reconciliados pelo trabalhador existente.
- Mensagens comerciais aguardando envio por mais de dez minutos são encaminhadas para a equipe.
- Essa política evita tentativas duplicadas após resultado incerto, mas não constitui garantia de exactly-once da Meta. A verificação de pausa e a chamada HTTP também não formam uma transação distribuída: uma mensagem já em trânsito não pode ser cancelada pelo backend.

## Configuração de homologação

Não alterar a configuração de produção antes de revisar o código e concluir os testes em ambiente isolado. Os segredos devem ser injetados no backend pelo mecanismo já usado na hospedagem, preferencialmente Secret Manager; não incluí-los em Git, navegador ou capturas de tela.

| Variável | Configuração para fluxo próprio |
| --- | --- |
| `WHATSAPP_AI_ENABLED` | `false` durante preparação; `true` somente na homologação autorizada |
| `WHATSAPP_AGENT_OWNER` | `cloud_api`; `disabled` para bloquear o backend; `meta_native` para delegar à Meta sem respostas próprias |
| `WHATSAPP_TOKEN` | Token do remetente e permissões correspondentes, mantido no backend |
| `WHATSAPP_PHONE_NUMBER_ID` | ID do número da Cloud API, não o telefone em texto |
| `WHATSAPP_VERIFY_TOKEN` | Valor secreto escolhido para verificar o webhook |
| `META_APP_SECRET` | Segredo do aplicativo para validar `X-Hub-Signature-256` |
| `WHATSAPP_GRAPH_VERSION` | Versão da Graph API suportada pela conta; confirmar no aplicativo |
| `FIREBASE_STORAGE_BUCKET` | Confirmar o nome da variável de bucket no `src/config/env.js` e usar o bucket efetivo do projeto |
| `META_AGENT_API_KEY` | Opcional para o adaptador; segredo exclusivo, aleatório, pelo menos 32 caracteres em produção |

O seletor de responsável é global, aplicando um único mecanismo a todas as conversas, enquanto a pausa humana é individual por contato. Seletores inválidos falham fechados. O backend não desliga agentes configurados no painel da Meta: antes de habilitar `cloud_api`, desabilitar as respostas do agente nativo para o mesmo número. Essa verificação externa é pré-requisito de homologação.

### Painel Meta: conexão pela Cloud API

Não foi acessado o painel autenticado da conta nesta execução. Portanto, não há confirmação dos ativos, permissões, nomes de telas disponíveis ou recursos exclusivos liberados. Utilizar o aplicativo já vinculado à Conflora; não criar outra conta ou outro catálogo por suposição.

1. Em Meta for Developers, abrir o aplicativo que possui o número WhatsApp da Conflora. Na configuração/API do WhatsApp, conferir a conta WABA e o Phone Number ID. Confirmar que o token usado pelo backend possui acesso a esse remetente e permissão de envio.
2. Na configuração de webhooks do WhatsApp desse aplicativo, cadastrar como callback **`https://DOMINIO_DO_BACKEND/webhook`**, substituindo o domínio pelo endpoint HTTPS real da homologação. Usar o mesmo valor de `WHATSAPP_VERIFY_TOKEN`. O backend atende GET de verificação e POST de eventos nessa rota.
3. Assinar o campo **`messages`** para receber mensagens e atualizações de status. Confirmar que o aplicativo está inscrito na WABA correta. Conferir `META_APP_SECRET` no backend; uma assinatura incorreta deve resultar em HTTP 401.
4. Manter o agente nativo e quaisquer outras automações de resposta desabilitados para o número usado na homologação do fluxo próprio.
5. Em um ambiente isolado, após autorização para mensagens reais, ativar `WHATSAPP_AI_ENABLED=true` e `WHATSAPP_AGENT_OWNER=cloud_api`. Confirmar que o trabalhador de inbox/outbox existente está rodando; o recebimento HTTP por si só não significa que a resposta já foi enviada.
6. Com um contato autorizado, consultar um produto conhecido, alterar o preço apenas no ambiente de teste e consultar novamente. Testar lista por atributos revisados, foto da primeira opção, produto inexistente, atendimento humano, repetição do mesmo evento, pausa e retomada autorizada.
7. Conferir uma resposta por mensagem, silêncio nas falhas, preço vigente, imagem correta e ausência de efeitos em estoque/pagamento/vendas. Validar também os eventos de status do provedor. Só então avaliar publicação separadamente.

### Meta Business Agent e cartões nativos

Não há comprovação de suporte a ferramentas externas nessa conta. Não registrar os endpoints como se fossem uma integração oficial garantida. Se a conta disponibilizar ferramentas, obter primeiro o contrato vigente e validar autenticação, identificação do cliente, idempotência e capacidade de impedir qualquer texto externo no handoff. A definição existente usa macros que ainda precisam dessa comprovação.

As chamadas de ferramentas ficam bloqueadas por padrão. Para um piloto homologado do adaptador, seria necessário escolher exclusivamente `WHATSAPP_AGENT_OWNER=meta_connector` e configurar `META_AGENT_CONNECTOR_VERIFIED=true`. Esse sinal é uma declaração operacional de homologação, não uma prova automática. Não o ativar sem evidência real. O carrinho piloto possui ainda o opt-in separado `META_AGENT_PILOT_CART_ENABLED=true`, desnecessário para esta entrega de consultas.

Mensagens nativas de produto exigem catálogo Meta vinculado e identificação `catalog_id`/`product_retailer_id`. Não foi encontrada comprovação dessa vinculação nem sincronização com o Firestore. Por isso, esta entrega usa imagem com legenda ou texto e não cria sincronização Commerce Manager. Não foi instalado o SDK Node arquivado da Meta.

Referências oficiais consultadas:

- [Cloud API — configuração inicial](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started) — a abertura detalhada exigiu login nesta execução.
- [Coleção oficial da Meta no Postman](https://www.postman.com/meta/whatsapp-business-platform/collection/wlk6lh4/whatsapp-cloud-api).
- [Referência Meta de objetos de produto](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/types/ActionObject/) — documentação de SDK arquivado, utilizada apenas como referência do formato de catálogo, sem presumir suporte da conta.

## Arquivos alterados

| Área | Arquivos |
| --- | --- |
| Consulta e validação | `src/agent/agent-service.js`, `product-source.js`, `product-search.js`, `product-contract.js`, `schema.js` |
| Novos auxiliares do mesmo agente | `src/agent/plant-search.js`, `src/agent/product-image.js` |
| Apresentação e estado | `src/agent/templates.js`, `src/agent/agent-store.js` |
| Adaptador Meta | `src/agent/meta-connector-tools.js`, `src/http/meta-agent.routes.js` |
| Pipeline e persistência | `src/services/message.service.js`, `src/database/firestore.repository.js`, `src/orders/pdv.service.js` |
| Composição e configuração | `src/http/app.js`, `src/http/pdv.routes.js`, `src/config/env.js`, `src/security/request-protection.js` |
| Testes | `test/meta-agent.test.js`, `test/helpers/agent-firestore.js`, `test/verified-whatsapp-catalog.test.js` |

## Verificação

| Verificação | Resultado |
| --- | --- |
| Novos testes de catálogo/WhatsApp | 35 aprovados; incluem os 27 cenários solicitados e testes adicionais de concorrência, timeout, revisão revogada, limites e preços conflitantes |
| Suíte geral `npm run test:dev` | 290 testes: 241 aprovados, 48 falhas por `connect EACCES 127.0.0.1`, 1 ignorado |
| `npm run build` | Aprovado, incluindo `check:full` |
| Lint dos arquivos alterados/adicionados | Sem erros; aviso de diretiva antiga de eslint em `schema.js` |
| Lint geral | Encontrou erros preexistentes fora do escopo, incluindo arquivos da vitrine e scripts antigos; não considerado aprovado |
| `git diff --check` | Aprovado |
| Playwright `npm run test:e2e` | Iniciado, mas não concluiu a inicialização do servidor de teste; interrompido. Ambiente também bloqueia conexões HTTP locais. Sem aprovação visual/e2e |
| Meta, Firestore e Storage reais | Não homologados e não alterados |

Logs reproduzíveis estão em `tmp/verified-catalog-*.log`; são intermediários locais. Os testes novos exercitam contratos Express em processo sem sockets e utilizam um double de Firestore com transações serializadas. Isso não substitui emulador/Firestore real, teste de rede, verificação do bucket ou validação de permissões da conta Meta.

O agente registra `catalog_agent_result` com operação, estado, motivo e latência, sem telefone/texto do cliente. Contadores locais do serviço indicam consultas, resultados e encaminhamentos; a fonte de produtos conta cargas de índice e documentos lidos. Não representam um painel agregado entre instâncias; o provedor pode contabilizar leituras adicionais de transações/repetições.

## Pendências para aceite completo

Reexecutar a suíte HTTP e o Playwright em ambiente que permita conexões locais; tratar o lint preexistente; revisar os atributos botânicos reais; verificar credenciais, bucket, WABA e remetente no painel; confirmar desativação de outras automações; homologar com mensagens reais somente após autorização. A edição/instância do Firestore em produção não foi inspecionada; o código reutiliza a instância e o SDK servidor existentes, sem provisionar banco, índice ou serviço pago.

Criar a branch e commitar as alterações após liberar a escrita em Git. Não considerar a integração externa ou a entrega inteira homologada apenas pelos testes simulados.
