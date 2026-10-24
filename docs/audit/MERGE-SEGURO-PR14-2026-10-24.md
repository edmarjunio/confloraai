# Integração segura da main no PR #14 — 24/10/2026

## Referências, preservação e escopo

Repositório `edmarjunio/confloraai`; destino de revisão `main`; trabalho realizado
exclusivamente no worktree já existente de `codex/contratos-produtos`.

- Origem inicial: `dfe0c0aa007b882ece72f92f0966b28afb01001c`.
- Main atualizada por `git fetch origin`: `d1f93ff9b3005beba1204f8ecae88230c0b96c18`.
- Ancestral comum: `73a98a28fe47977f6e189f718d71c6618e379de0`.
- Não havia merge incompleto. Havia 11 arquivos modificados e três não rastreados.
  Todos foram preservados no checkpoint `15e74e7`, antes de iniciar o merge.
- Backup privado em `.private/node_modules/merge-backup-20261024/`: bundle de
  todas as referências, patch binário das alterações rastreadas, cópia dos arquivos
  novos, `firebase.json` e `.firebaserc`. `git bundle verify` confirmou histórico
  completo. A pasta usa `node_modules` para também ficar fora da varredura ESLint;
  não contém instalação de dependências. Está fora do Git e do pacote cloud.
- Nenhum reset, force push, abort automático, nova dependência, deploy, escrita em
  Firestore/Storage real ou alteração direta da main foi executado.

O pedido explícito desta sessão autorizou os testes isolados; eles não foram
iniciados automaticamente em razão da data. Contratos lidos: `AGENTS.md`,
`docs/performance/CONTRATO.md`, documentação de implementação/performance,
`ARCHITECTURE.md` e `WHATSAPP_ARCHITECTURE.md`.

## Conflitos e decisões

| Arquivo/alteração | Main, Codex e decisão |
| --- | --- |
| `src/services/message.service.js` — conteúdo | A mudança da main, relativa ao ancestral, separa `standaloneGreeting` e formaliza saudação de canal ativo. A branch já substituiu o antigo fluxo misto pelo parser determinístico, checkout Meta, inbox e transporte duráveis. Integrada a saudação formal e a resposta específica de sacola no fluxo atual. Preservadas também as frases explícitas de menu, sem bypass de pausa, geração ou transporte. Não copiado o bloco antigo de IA/checkout, cujos contratos não correspondem ao serviço atual. A main ainda referenciava `greeting` depois de renomeá-lo; essa referência inconsistente não foi importada. |
| `docs/AI_AGENT_FLOW.md` — modificar/excluir | Main excluía o documento; Codex o atualizou. Mantido e corrigida a descrição obsoleta de fallback Gemini: WhatsApp determinístico, assistência independente do site preservada. |
| `firebase.json` — merge automático revisado | Mantido `target: loja` vindo da main, resolvido por `.firebaserc` para `lojaconflora`, projeto `confloraai`. Acrescentado rewrite `/storefront-auth.js` para Cloud Run antes do catch-all HTML, necessário ao login local preservado. Demais rewrites, região, headers e ignores mantidos. |
| `output/` — exclusões automáticas revisadas | Preservados os 11 artefatos históricos que a main excluía: patch, implantação, sete PDFs e duas revisões Markdown/PDF. Restaurados byte a byte do checkpoint; não executados, reaplicados ou publicados. |

Não houve escolha global de ours/theirs nem substituição integral do serviço.
O diff do serviço contra o checkpoint é pequeno: menu compatível, nome da variável,
normalização da saudação e texto específico de sacola.

## Regressões encontradas no estado local e corrigidas

O checkpoint preservava trabalho ainda incompleto de notificações e login. A
política local suprimia avisos anteriores: novo pedido aguardando pagamento,
comprovante para conferência e quitação de fiado. Nesta integração prevalece a
preservação solicitada: os três avisos foram mantidos, sem confirmar pagamentos.
Comprovante e quitação conservam os destinatários legados; os eventos novos usam
a configuração administrativa. Não se afirma que todos os avisos legados sejam
controlados pelos cinco destinatários configuráveis.

Fechamento mantém o fallback legado para o responsável quando Junior não está
configurado, os detalhes de cada caixa (troco, recebimentos, esperado, contado e
diferença), além dos indicadores e top 3 novos. O payload dessas sessões permanece
na outbox privada, sem novo cache público. A revisão diária continua bloqueando
resumo obsoleto após reabertura. Fechamento antigo sem data/revisão vai para
`NEEDS_RECONCILIATION`, sem descarte nem tentativa cega de envio.

No Caixa móvel, Loja e Sair haviam ficado inacessíveis após ocultar o cabeçalho
desktop. Restaurados no menu existente, usando o logout oficial. Nenhuma consulta
foi adicionada para renderizar esses atalhos.

Testes de navegador interceptavam URLs sem `?projection=list`; por isso seus
cenários de IA, Pix, cache e catálogo extenso não estavam sendo configurados.
Atualizados os interceptadores e o contrato separado de detalhe de produto, sem
retirar query nem ampliar payload real. Testes de arrastar e consultar finalizados
agora selecionam explicitamente a opção Todas no filtro de etapas existente.
Testes de recuperação de transporte agora usam uma entrega válida; um fechamento
sem revisão é coberto separadamente como pendência de reconciliação.

## Evidência por contrato preservado

| Contrato | Evidência isolada |
| --- | --- |
| Caixa, descontos, reservas, estoque, recebimentos e fiado | `pdv.test.js`, `cashier-sessions.test.js`, `cashier-operator-closing.test.js`, `order-integrity.test.js`; cenários Playwright de caixa, comandas e pagamentos. |
| WhatsApp, entrada e saída duráveis | `whatsapp-flow.test.js`, `whatsapp-acceptance.test.js`, `whatsapp-greeting.test.js`, `firestore-optimization.test.js`: inbox persistida, ack, repetição, transporte incerto, pausa humana, gerações, reset diário e callbacks antigos. Novos testes de menu verificam uma submissão durável e bloqueio do evento repetido. |
| Catálogo Meta e compra por texto | Aceitação WhatsApp cobre carrinho com preço recebido ignorado, confirmação final, uma comanda oficial e evento repetido; sincronização incremental e autorização persistida mantidas. Nenhuma sincronização real executada. |
| Pix manual e Sicredi | `manual-pix.test.js`, `sicredi-full-flow.test.js`, `pdv.test.js`: conferência autorizada, consulta bancária interceptada, webhook repetido sem nova baixa. Alerta de comprovante tem regressão verificando que o pedido continua pendente. |
| Entregas e comunicação | Testes Node de entrega e Playwright verificam atribuição, saída, recebimento e conclusão; handlers e transações não foram substituídos. |
| Carregamento e isolamento | `test:loading`, testes de snapshot/TTL/invalidação, leitores cursor e suíte móvel/desktop: dados utilizáveis durante revalidação, respostas obsoletas, lazy loading, logout e isolamento de sessão. |
| Permissões e autenticação | Suíte Node completa, configuração de destinatários restrita a ADMIN com versão concorrente; navegador cobre Google simulado, sessão por aba, perfis e saída; rewrite de autenticação coberto. |

As melhorias de catálogo da main já se sobrepõem ao trabalho integrado no
ancestral e na branch: projeções de listagem, detalhe separado, API cursor e
serviço de migração de imagens foram mantidos. `product-read-paths.test.js` verifica
limite efetivo de leituras e que a rota cursor não chama o scan global.
Interfaces que ainda dependem do índice completo não foram convertidas nesta
tarefa; não se declara paginação integral nem performance de produção validada.

## Arquivos removidos e APIs antigas

Nenhum arquivo foi removido por este merge em relação ao checkpoint. Contra a
main, a branch já removia dois módulos antes desta sessão:

- `src/catalog/validated-catalog-profiles.js`: enriquecia documentos com JSON
  histórico. Consumidores migrados para conteúdo/mídia registrados e normalização
  compartilhada; busca em `src`, `public`, `scripts` e `test` não encontra imports.
  O JSON histórico não é reaplicado ao ambiente real.
- `src/services/conversation-outbox.js`: exportação sem consumidores; transporte
  oficial é `durable-conversation-transport.js`, usado explicitamente no serviço,
  com checkpoints e ack reais. Documentado anteriormente em
  `WHATSAPP_IMPLEMENTATION.md`.

O antigo `sendNativeProductsList` era chamado apenas pelo antigo bloco interno
de categorias/subcategorias. Não há consumidor externo remanescente. Sua
experiência foi substituída anteriormente por catálogo Meta e texto determinístico;
callbacks antigos redirecionam sem autorizar vendas. Atendimento humano não é
convertido em atendimento por IA. Estas diferenças intencionais do PR são
incompatibilidades com o fluxo antigo, e não funcionalidades reintroduzidas às
cegas durante a resolução.

## Arquitetura, custo e segurança

Contra o checkpoint não há alteração nos módulos de snapshot público, IndexedDB,
geração de cache, TTL, catálogo, banco, transações, Sicredi, regras ou índices.
Preservados shell primeiro, importações secundárias, code splitting, cache de
15 s no servidor e 60 s/24 h no cliente, invalidação, deduplicação, respostas
obsoletas, limpeza de listeners e prefetch controlado. Nenhuma leitura global de
pedidos foi adicionada ao catálogo/inventário. Nenhuma permissão foi relaxada.

O trabalho local de notificações acrescenta configuração privada, jobs e
checkpoints na outbox existente: até cinco destinatários normalizados por evento,
com deduplicação por pedido/evento/número. Cada chunk relê configuração/estado;
portanto aumenta leituras e gravações das notificações. Fechamento consulta o
relatório do dia e agora também preserva a descrição individual por caixa, que
aumenta seus bytes/chunks. O login inicia antes da espera do catálogo; não cria
nova consulta comercial. Sem dependências novas. Não houve medição nova de
LCP/INP/CLS, bytes de rede real, latência ou fatura Firestore.

## Validação e limites

Logs completos ficam em `.private/merge-*.log`, fora do deploy/Git. A linha de base
local anterior à resolução teve 506 testes Node: 498 aprovados, sete falhas e um
ignorado. Duas falhas vieram do sandbox impedindo o esbuild de ler dependências
compartilhadas; outras eram fechamento, recuperação com fixture antiga, rewrite
ausente e texto Pix. A execução elevada leu dependências instaladas, sem instalação
ou mudança na política do sistema. Usado `npm.cmd` porque PowerShell bloqueia
`npm.ps1`.

| Comando final | Resultado |
| --- | --- |
| `npm run build` | Aprovado; inclui `check:full` e compilação dos módulos reais. |
| `npm run lint` | Aprovado. |
| `npm run test:dev` | 511 testes: 510 aprovados, zero falhas, um dependente de emulador ignorado. |
| `npm run test:whatsapp` | Sete aprovados. |
| `npm run test:loading` | Oito aprovados. |
| `npm run test:e2e` | 95 aprovados. |
| `npm run test:loading:browser` | 41 aprovados, um caso exclusivo de móvel ignorado no projeto desktop. |
| `git diff --check` | Aprovado; nenhum marcador de conflito pendente no índice. |

Primeira
suíte navegador teve 89 aprovados/seis falhas; após investigar e corrigir os
contratos/testes e os atalhos reais, a repetição completa teve 95 aprovados.
Suíte adicional de carregamento teve 41 aprovados e um caso exclusivo de móvel
ignorado no projeto desktop. Nenhum teste foi desativado para passar.

Pendências: Firestore Emulator indisponível (um teste condicional ignorado),
Sicredi/Meta reais, sessão Google hospedada/domínios, concorrência em múltiplas
instâncias cloud, Safari/iPhone físico, rede real com mais de 1.000 produtos e
medição de custo/performance de produção. Fixtures usam armazenamento descartável;
aprovação local não equivale a homologação dessas integrações reais.

O workflow versionado `dev-pix-validation.yml` foi inspecionado: executa build,
lint e testes em push/PR, sem etapa de deploy. A main não será mesclada
automaticamente; o PR aguarda revisão humana. CI remoto deve ser distinguido dos
resultados locais e acompanhado após o push.

## Rollback recuperável

O merge tem o checkpoint e a main como pais; a referência original e o checkpoint
permanecem recuperáveis no histórico e no bundle. Para desfazer a integração após
revisão, preparar um revert do merge com pai principal da branch, sem reset/force,
preservando o checkpoint. Não remover handlers de jobs enquanto existirem eventos
pendentes, nem apagar outbox, configurações, autenticação ou dados financeiros.
Publicação de qualquer rollback exige autorização própria; nenhuma ocorreu aqui.
