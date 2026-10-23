# Cache e consultas

Política local revisada em 23/10/2026, ainda aguardando homologação. Consulte
[o contrato permanente](performance/CONTRATO.md) e [o estado da implementação](performance/IMPLEMENTACAO-2026-10-23.md).
Firestore/backend continuam como fonte oficial. O cache novo começa vazio e não
importa snapshots antigos. A consulta pública pode exibir dados salvos com aviso;
enviar pedidos e confirmar operações continua dependendo do servidor.

| Dado | Política |
| --- | --- |
| Arquivos estáticos versionados | Cache HTTP permitido para código e imagens identificados por hash. Nenhum dado comercial usa esse mecanismo. |
| Service worker | Somente notificações; remove caches antigos da Conflora e não intercepta requisições de catálogo. |
| Catálogo público no navegador | Memória e IndexedDB `cf-public-20261023-reset1`; fresco por 60 s, retido até 24 h, limite persistente de 4 MiB. Revalidação em segundo plano e aviso de falha/offline. Sem usuários, pedidos ou dados financeiros. |
| Reset solicitado | Nova geração sem migração; exclusão do IndexedDB anterior e snapshots legados via rotina comum às telas. Cache corrente é preservado nas visitas seguintes. Abas antigas podem bloquear a exclusão física; tentar novamente na próxima visita. |
| Catálogo público no servidor | Projeção por processo por 15 s; compartilha leituras simultâneas; invalida antes/depois das rotas comerciais. Alterações externas convergem por TTL. |
| Invalidação entre abas | Mutações HTTP confirmadas emitem sinal local e timestamp não sensível em localStorage. Abas abertas descartam a projeção; abas futuras rejeitam snapshots anteriores ao sinal. TTL cobre armazenamento indisponível e outros dispositivos. |
| Inventário administrativo | Compartilha somente chamadas simultâneas entre produtos, preços e estoque; sem persistência privada. |
| Checkout | IDs solicitados, configuração atual e revalidação transacional; indisponibilidade retorna erro. |
| Caixa | Pedidos abertos + entregas ativas + histórico do período solicitado. Removida leitura global de até 10.000 pedidos. |
| Consultas simultâneas do caixa | Compartilha somente Promise em andamento por período/repositório. Resultado clonado; após conclusão a próxima chamada relê os dados. |
| Interface de comandas | Agrupa atualizações durante requisição em andamento, faz leitura posterior quando necessário e cancela a consulta na mudança de período/identidade ou desmontagem. |
| Streams | Uma conexão por sessão/endpoint na aba; cada consumidor libera seus listeners; último consumidor ou troca de sessão encerra a conexão. Não há persistência de eventos. |
| Dashboard/GA4 | Deduplicação e flags anteriores preservadas; não confundir navegação com receita. |

Não foi criada `daily_metrics`: falta definição de consumidor e medição que justifique manter outra projeção. A consulta histórica do caixa pode ler um pedido em mais de um índice de data; os resultados são deduplicados por ID. Medir o custo no ambiente real antes de consolidar campos históricos.
