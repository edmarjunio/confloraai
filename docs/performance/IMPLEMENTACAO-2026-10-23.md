# Implementação local em andamento — 23/10/2026

## Acordos e limites

Recomeçar o cache significa descartar a versão antiga e alimentar a nova com
respostas reais. Não significa apagar produtos, vendas ou estoque do Firestore.
Não houve deploy nesta retomada. Testes funcionais e medições ficam para a sessão
combinada pelo usuário para 24/10. Nenhuma medição abaixo é apresentada como ganho
real. As instruções permanentes estão em AGENTS.md e CONTRATO.md.

## Alterações locais

| Área/arquivos | Alteração | Benefício esperado / atenção |
| --- | --- | --- |
| existing-store.js, http/app.js | Remove histórico global de pedidos da abertura de catálogo/inventário; paraleliza configurações e produtos | Evita leituras proporcionais às vendas para consultar produtos. Catálogo ainda lê todos os produtos. |
| public-snapshot.js | TTL público de 15 s, deduplicação e proteção contra leitura anterior à invalidação | Menos consultas repetidas por processo; não substitui validação transacional. |
| public-catalog.mjs, storefront/app.js | Novo IndexedDB público, validade/limite, cache visível, revalidação e backoff separado da frescura | Retorno mais rápido; dados podem estar desatualizados e precisam do aviso. |
| tab-session.js | Invalida após mutações HTTP bem-sucedidas; sinaliza outras abas sem transmitir dados privados | Evita reutilizar a projeção anterior à edição. Outros dispositivos dependem de revalidação. |
| tab-session.js | Compartilha SSE por sessão/endpoint e encerra ao liberar último consumidor ou trocar sessão | Menos conexões duplicadas; teste dedicado de isolamento preparado, não executado. |
| existing-api.js | Limita tentativas GET e libera Promise administrativa depois da conclusão | Evita resposta presa indefinidamente; cancelamento e rede instável precisam de homologação. |
| cart.js | Remove wrapper antigo de consultas, mantém envio oficial e chave idempotente | Sem cache antigo no checkout. |
| views-admin.js | Compartilha inventário simultâneo, paraleliza controle de estoque e evita segunda gravação sem fotos novas | Menos consultas e gravações; validar substituição/reordenação de fotos. |
| views-admin-gerencial.js | Carrega análises secundárias ao abrir a aba, após autorização | Reduz concorrência com fechamento inicial. |
| pdv/app.jsx, site-navigation.js | Navegação interna do PDV por History API; prefetch de imagens menor e condicionado à rede | Evita reload entre vistas do PDV; não unifica todos os módulos. |
| pdv/components.jsx | Serializa atualizações de comandas com leitura posterior; cancela ao trocar contexto | Evita sobreposição e respostas antigas substituindo período novo. |
| pdv.repository.js | Ordena entregas concluídas por deliveredAt antes do limite 100 | Busca as mais recentes em vez de ordenar amostra arbitrária. Índice já declarado; confirmar disponibilidade e campos históricos antes de publicar. |
| query/tanstackQuery.js, firebase firebase-admin | Remove camada antiga e arquivo de saída de busca sem uso | Testes isolados e guardas contra mocks permanecem. |

## Verificação nesta retomada

- Parsing estático de 17 JS/JSX/MJS e dois scripts embutidos aprovado; não executa aplicação.
- Revisão de diff e referências à camada removida.
- Lint dos 13 arquivos JS selecionados aprovado após corrigir declarações de
  globais nos testes; app.js novamente verificado após a última alteração.
- Testes de TTL/invalidação e de navegador atualizados, ainda não executados.
- Build, testes de regressão, laboratório de rede e comparação antes/depois não
  executados nesta retomada. Não há resultado novo de LCP/INP/CLS ou custo.

## Pendências para concluir a otimização global

1. Paginação real de catálogo, inventário, comandas/histórico e encomendas. Definir
   contratos de filtros, totais, busca e cursores junto dos consumidores; não
   truncar resultados usados pelo caixa. Encomendas ainda usa cursor do servidor.
2. Homologar compartilhamento SSE entre notificações e quadro, incluindo
   reconexão, troca de sessão, fallback e callbacks de consumidores desmontados.
3. Layout persistente entre vitrine, administrativo e PDV, preservação de estado
   de componentes desmontados e carregamento dividido do bundle PDV. Navegação
   interna do PDV já ajustada não equivale a SPA global.
4. Política de retenção de assets antigos durante publicação e avaliação de cache
   estático do worker. O worker atual continua sem interceptar requisições.
5. Validar documentos de entregas sem deliveredAt e índices no ambiente alvo.
   orderBy exclui documentos sem esse campo; não migrar dados sem levantamento.
6. Medir autenticação, consultas, endpoints, bundles, memória, custo e localização
   dos serviços. Não afirmar que o backend é o único gargalo.

## Roteiro da sessão de testes

Capturar baseline da revisão anterior em ambiente isolado e comparar a mesma
carga/dispositivo com esta revisão: sem cache, cache novo, cache antigo descartado,
retorno, mutações em outra aba/usuário, rede lenta, queda e reconexão. Validar
cache desabilitado/cheio, logout/troca de identidade e ausência de dados privados
no IndexedDB público. Executar regressões de pedidos, estoque, pagamentos, Pix,
entregas, cadastro/fotos e integrações antes de autorizar deploy.

Os testes que já existiam não são dados iniciais de produção. Não remover fixtures
de regressão nem guardas de isolamento para satisfazer uma busca por “mock”.

## Rollback

Reverter somente os hunks desta entrega, preservando alterações do usuário. O
namespace novo é independente: desativar seu consumidor não altera o Firestore.
Sem migração de schema nem criação de coleção/índice nesta etapa. Uma reversão de
frontend publicado exige reconstruir e publicar a versão aprovada; nunca forçar
reload de uma venda em andamento.
