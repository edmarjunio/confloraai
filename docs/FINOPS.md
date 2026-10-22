# FinOps — incremento arquitetural

A referência anterior continua em [FIRESTORE-FINOPS.md](FIRESTORE-FINOPS.md). Não se atribuem novamente a esta rodada os ganhos anteriores de cache, GA4, listeners ou compactação.

Incrementos: produtos relidos por IDs no núcleo e reutilizados na validação de reserva; endpoint legado web deixa de varrer catálogo; caixa troca histórico global por intervalos e trabalhos abertos, com compartilhamento apenas de leituras simultâneas; expiração Pix corrige igualdade com array para operador `in`; avisos por pedido/administrador tornam-se idempotentes.

Há escritas deliberadas adicionais para intenções duráveis de equipe e marcadores de submissão WhatsApp. Elas protegem pedidos e evitam reenvios; não são descritas como redução de escritas. Callbacks possuem duas consultas por IDs do provedor mais transação; medir antes de adicionar uma projeção extra.

Retenção segue [firestore-retention-plan.json](../config/firestore-retention-plan.json). Nada foi ativado em produção. Novos rascunhos não recebem TTL indiscriminado; pedidos, filas financeiras e marcadores permanentes não são removidos.

As métricas desta rodada ficam em [commercial-load-results.json](commercial-load-results.json): simulação local com transações serializadas, sem latência/retries/cobrança do Firestore real. Não extrapolar esse tempo local para promessa de throughput ou valor de fatura. Revalidar os relatórios anteriores após os novos custos de consistência.
