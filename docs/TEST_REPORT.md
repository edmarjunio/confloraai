# Evidências de validação — 22/10/2026

| Execução | Resultado |
| --- | --- |
| `npm run build` | Aprovado: frontend compilado, `check:full` e sintaxe dos módulos SaaS. |
| `npm run lint` | Aprovado sem erros ou warnings após correção dos problemas encontrados. |
| Suíte ampla com `--test-timeout=30000 --test-concurrency=4` | 362 testes: 309 aprovados, 52 falhas de conexão `EACCES` ao loopback e 1 ignorado por ausência de emulador. Não é aprovação da suíte inteira. |
| Regressão final após as últimas proteções de versão do carrinho | 118 testes aprovados, 0 falhas, 0 ignorados. |
| Playwright | Não homologado. Primeira configuração temporária tinha caminho incorreto e foi corrigida; a segunda tentativa iniciou o servidor, não concluiu a verificação local e foi interrompida. Nenhuma aprovação visual/e2e. |
| `git diff --check` | Aprovado. Avisos de conversão LF/CRLF são configuração local do Git. |
| Inspeção remota Firestore | Falhou por credenciais Firebase expiradas. Não se presumiu edição, região, TTL, IAM ou regras efetivas. |
| Produção / Meta / banco | Sem escrita, carga, cobrança, mensagem real, deploy, merge, limpeza ou migração. |

O resumo estruturado com os testes bloqueados está em [architecture-test-results.json](architecture-test-results.json). A suíte ampla ocorreu antes do último incremento de versionamento de rascunho; as alterações finais foram verificadas pela regressão focada, lint e revisão de diff. Os conjuntos se sobrepõem e não devem ser somados como testes distintos.

O commit concorrente `6064552` incorporou grande parte do trabalho na main enquanto esta tarefa ainda executava. Os arquivos remanescentes e o relatório são entregues localmente em patch complementar; a revisão automática bloqueou o upload e nenhum PR foi criado. A tarefa não criou esse commit na main nem realizou merge ou deploy.

## Regressão final reproduzível

```powershell
node --import ./scripts/test-env.js --test --test-timeout=30000 --test-force-exit test/commercial-architecture.test.js test/commercial-load.test.js test/verified-whatsapp-catalog.test.js test/order-integrity.test.js test/firestore-finops-regression.test.js test/smart-receipt-and-payments.test.js test/delivery-metrics.test.js
```

Cobertura: contratos de produto/unidade/moeda, reserva concorrente entre canais, rejeição de preço/status/unidade alterados, rollback de commit simulado, replay com conteúdo divergente, KG, recebimento e troco, carrinho legado e histórico, confirmação WhatsApp sem quitação verbal, edições concorrentes do carrinho, vínculo transacional entre rascunho/pedido, pausa humana, falha de persistência, leitura limitada do caixa, autenticação e payload canônico de Tasks, callbacks fora de ordem, envio incerto sem ressubmissão, notificação administrativa idempotente, agente verificado, métricas de entrega e regras existentes de pagamentos divididos.

O novo arquivo `commercial-architecture.test.js` adiciona 25 cenários; `commercial-load.test.js` adiciona uma execução parametrizada de carga. Adaptações em fixtures antigas fornecem produtos reais do cenário, acknowledgment com ID do provedor e flags explícitas de teste; não removem a exigência de preço, autenticação ou confirmação bancária do código de produção.

## Carga simulada

Catálogo de 1.000 produtos, três itens por venda, 20 chamadas simultâneas, um replay por pedido e recebimento. Os canais alternam PDV, web e WhatsApp. Transações do double são serializadas e verificam leituras antes de escritas; não simulam contenção/retries reais do Firestore.

| Vendas equivalentes | Tempo local | p95 local | Leituras de documento | Escritas de documento |
| --- | ---: | ---: | ---: | ---: |
| 100 | 52 ms | 14,14 ms | 1.133 | 1.433 |
| 500 | 200 ms | 8,88 ms | 5.666 | 7.166 |
| 1.000 | 273 ms | 7,60 ms | 11.333 | 14.333 |

Dados brutos: [commercial-load-results.json](commercial-load-results.json). Contagens refletem este cenário, incluindo intenções duráveis e preferências WhatsApp. Não são fatura, benchmark remoto, estimativa de custo ou garantia de atender esse volume por dia. Índices, rede, retries, quotas, imagens, banco e Meta não estão medidos.

Antes da publicação: executar a suíte inteira, HTTP/e2e e concorrência em emulador em ambiente que permita conexões locais; depois homologar integrações externas conforme `DEPLOYMENT_GUIDE.md`.
