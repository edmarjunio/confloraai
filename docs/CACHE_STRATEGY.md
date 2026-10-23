# Cache e consultas

Dados comerciais vêm do Firestore por meio do backend. Não há catálogo persistido, funcionamento com catálogo offline, recuperação de preço antigo após erro nem sacola salva no navegador. Rascunhos de contagem ficam somente na tela atual. A atualização remove snapshots comerciais de versões anteriores do armazenamento do navegador.

| Dado | Política |
| --- | --- |
| Arquivos estáticos versionados | Cache HTTP permitido para código e imagens identificados por hash. Nenhum dado comercial usa esse mecanismo. |
| Service worker | Somente notificações; remove caches antigos da Conflora e não intercepta requisições de catálogo. |
| Identificação de produto | Leitura atual; índices servem à busca da resposta corrente, sem TTL para reaproveitar dados comerciais. |
| Checkout | IDs solicitados, configuração atual e revalidação transacional; indisponibilidade retorna erro. |
| Caixa | Pedidos abertos + entregas ativas + histórico do período solicitado. Removida leitura global de até 10.000 pedidos. |
| Consultas simultâneas do caixa | Compartilha somente Promise em andamento por período/repositório. Resultado clonado; após conclusão a próxima chamada relê os dados. |
| Dashboard/GA4 | Deduplicação e flags anteriores preservadas; não confundir navegação com receita. |

Não foi criada `daily_metrics`: falta definição de consumidor e medição que justifique manter outra projeção. A consulta histórica do caixa pode ler um pedido em mais de um índice de data; os resultados são deduplicados por ID. Medir o custo no ambiente real antes de consolidar campos históricos.
