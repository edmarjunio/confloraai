# Cache e consultas

Preservados service worker público, arquivos estáticos versionados, cache de identificação de catálogo, paginação visual, carregamento de fotos e listeners compartilhados do PDV. Nenhum cache novo autoriza preço, estoque ou pagamento.

| Dado | Política |
| --- | --- |
| Shell/imagens públicas | Cache visual existente; recursos privados continuam fora do cache público. |
| Identificação de produto | Índice com expiração; campos comerciais relidos antes da resposta verificada. |
| Checkout | IDs solicitados, configuração atual e revalidação transacional; indisponibilidade retorna erro. |
| Caixa | Pedidos abertos + entregas ativas + histórico do período solicitado. Removida leitura global de até 10.000 pedidos. |
| Consultas simultâneas do caixa | Compartilha somente Promise em andamento por período/repositório. Resultado clonado; após conclusão a próxima chamada relê os dados. |
| Dashboard/GA4 | Deduplicação e flags anteriores preservadas; não confundir navegação com receita. |

Não foi criada `daily_metrics`: falta definição de consumidor e medição que justifique manter outra projeção. A consulta histórica do caixa pode ler um pedido em mais de um índice de data; os resultados são deduplicados por ID. Medir o custo no ambiente real antes de consolidar campos históricos.
