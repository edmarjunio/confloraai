# Conflora AI — carregamento inteligente

Implementação local revisada em 22/10/2026. Não houve deploy, cobrança, envio real de WhatsApp ou alteração de credenciais.

## 1. Entrega e escopo

O projeto original foi inspecionado em C:/Users/Junin/confloraai. A implementação está em C:/Users/Junin/OneDrive/Documents/ChatGPT/LOJA CONFLORA/confloraai, dentro da área editável desta sessão. O repositório original não foi sobrescrito. O pacote inclui um patch relativo à referência local atual e este relatório. É necessário aplicar o patch no checkout usado para publicar.

Já havia uma implementação e evidências locais de uma etapa anterior. Esta revisão reaproveitou esse trabalho, conferiu os arquivos contra a referência, corrigiu o isolamento da invalidação entre lojas e o fallback de rede quando CacheStorage falha, acrescentou testes e repetiu medições. Os resultados recentes estão identificados separadamente das evidências anteriores.

## 2. Diagnóstico e prioridades

A aplicação usa Express/Cloud Run, vitrine JavaScript modular, Web Components, navegação pela History API e Firestore acessado pelo backend. Já existiam cache público local, QueryClient, paginação visual em lotes de 24, IntersectionObserver, fotos WebP persistidas e um Service Worker.

Gargalos identificados na referência:

- Cada resposta do catálogo relia produtos e configurações, inclusive em solicitações simultâneas.
- Visitas repetidas baixavam o catálogo novamente sem respeitar sua validade recente.
- Atualizações, filtros e paginação reconstruíam todos os cards.
- Administração, entrada de produtos e informações secundárias participavam do grafo inicial.
- O worker usava cache-first em URLs mutáveis e ativação forçada.
- Arquivos da vitrine sem hash precisavam de revalidação recorrente.
- Um redirecionamento de foto por ID usava immutable embora seu destino pudesse mudar.

Prioridade: preservar autorização e validação comercial; deduplicar leituras; diminuir o carregamento inicial; reutilizar DOM/estado; assegurar atualização de versão. Não foram substituídos o roteador, autenticação, integrações ou regras financeiras.

Na revisão, também foram corrigidos dois casos: invalidação de outra loja causava consulta desnecessária na aba atual; falha ao abrir ou consultar CacheStorage interrompia respostas que poderiam vir da rede.

## 3. Funcionamento do carregamento

1. O HTML apresenta estrutura, navegação e placeholders discretos.
2. Um snapshot público disponível aparece imediatamente. Ele é fresco durante 60 segundos; depois pode aparecer enquanto a rede é consultada, até o limite de 24 horas.
3. Revalidação ocorre em segundo plano; dados idênticos não reconstroem a interface.
4. Os cards são reconciliados por ID/conteúdo. Novos ou alterados são substituídos; os demais preservam sua instância.
5. A lista continua em lotes de 24. As primeiras duas fotos no móvel e quatro no desktop têm prioridade; as demais são lazy. O detalhe principal é eager.
6. Administração, entrada de produtos e conteúdo informativo são importados sob demanda. A intenção de abrir informações antecipa apenas esse módulo, após 120 ms canceláveis e respeitando Save-Data/2G.
7. Voltar/avançar restaura rolagem e preserva carrinho, filtros e componentes compartilhados.
8. A atualização periódica ocorre aproximadamente a cada 60 segundos enquanto a aba está visível e houve interação nos últimos dois minutos. Abas ociosas/ocultas deixam de consultar. Retorno, reconexão e interação retomam a atualização.

Não foi adicionada biblioteca de estado/cache nem dependência nova.

## 4. Políticas de cache e segurança

| Recurso | Estratégia e prazo |
| --- | --- |
| JS, CSS e logo em dist/versioned | Hash de conteúdo; immutable por um ano no HTTP; cache-first no worker |
| HTML público | Revalidação HTTP; network-first no worker; shell público como fallback offline |
| Worker e manifestos | Revalidação, sem immutable; gerados pelo build |
| Catálogo no navegador | Snapshot público por loja; fresco 60 s; fallback máximo 24 h |
| Catálogo no backend | Snapshot em memória por processo; TTL 15 s; compartilha solicitação em andamento |
| Redirecionamento de foto por ID | Cache HTTP revalidável de 300 s |
| APIs privadas, pedidos, Pix, comprovantes, login e clientes | Network-only no worker; políticas private/no-store preservadas |
| Carrinho | Persistência existente, isolada por usuário/aba; sempre sujeito à validação comercial do backend |

O endpoint público continua no-store no HTTP. O snapshot local explícito contém configuração e produtos públicos; identidade de sessão, tokens, pedidos e respostas financeiras não entram nele. O worker não guarda respostas de /api, parâmetros de URL, telas de caixa ou administração.

Preços, descontos, entrega, disponibilidade e estoque são apurados novamente no backend. O checkout consulta os IDs solicitados e a configuração atual, mantendo as transações/reservas existentes. O teste com preço visual antigo confirmou pedido e recibo com preço atual do backend.

## 5. Invalidação e novas versões

- Mutações comerciais HTTP invalidam o snapshot do processo antes e depois da resposta, inclusive falhas com possíveis gravações parciais.
- Uma leitura superada por uma alteração não repopula o snapshot com dados antigos.
- Mutações na vitrine invalidam o snapshot local e as consultas relacionadas, com atualização pública em segundo plano.
- Eventos storage de remoção invalidam somente o snapshot da loja correspondente; limpar todo o storage também provoca revalidação. Outra loja não gera consulta.
- Alterações externas no Firestore/outras instâncias convergem pelo TTL do backend e pelo ciclo do cliente. Não há propagação instantânea entre processos.
- Hashes mudam com o conteúdo; build produz shell, manifest e worker compatíveis.
- Instalação incompleta do worker é descartada. Ativação limpa somente caches antigos da Conflora. Falhas de gravação, abertura ou leitura de CacheStorage não impedem respostas válidas da rede.
- Não há recarga automática nem ativação forçada que interrompa checkout. Na primeira migração do worker antigo v42, feche todas as abas uma vez para ativar o novo.
- O build mantém os hashes já presentes na pasta. Pipelines com checkout vazio precisam preservar os assets da versão anterior durante a janela de atualização, para módulos lazy em abas antigas.

## 6. Firestore e imagens: limites mantidos

Não foram adicionados listeners ao catálogo, coleções, índices ou persistência offline nativa do SDK. A vitrine consome a API; outro cache Firestore no navegador duplicaria mecanismos. O cache reduz consultas efetivas, mas não permite prometer ausência de leituras faturáveis.

A paginação visual foi preservada. Busca, categorias, subcategorias e seleção guiada dependem do catálogo completo: paginação remota exige evolução conjunta desses contratos. O scan público passa a ser reutilizado por janela/processo. Paginação e compartilhamento de listeners comerciais existentes foram mantidos.

O pipeline de fotos persistidas e WebP foi reaproveitado, sem conversão a cada acesso. Não se introduziu srcset sem variantes reais nem reduziu a resolução ampliada. AVIF e variantes responsivas adicionais permanecem fora desta alteração.

## 7. Medições reais

Nova execução local: Chromium headless, viewport móvel 390 × 844, 120 produtos, três amostras por cenário e latência artificial de 50 ms por requisição. Medianas:

| Métrica | Referência | Implementação |
| --- | ---: | ---: |
| Catálogo visível, primeira visita | 525,1 ms | 359,3 ms |
| Catálogo visível, segunda visita | 382,8 ms | 230,5 ms |
| Requisições locais, primeira visita | 53 | 24 |
| Requisições locais, segunda visita | 53 | 23 |
| Corpos de respostas, primeira visita | 902.980 bytes | 822.182 bytes |
| Corpos de respostas, segunda visita | 902.980 bytes | 652.439 bytes |
| Chamadas de catálogo, segunda visita | 1 | 0 |
| LCP observado, primeira visita | 200 ms | 224 ms |
| LCP observado, segunda visita | 164 ms | 180 ms |
| CLS observado, primeira visita | 0,0039 | 0,0039 |
| TTFB simulado, primeira visita | 68,1 ms | 64,8 ms |

O catálogo apareceu aproximadamente 31,6% antes na primeira visita e 39,8% antes na segunda. O LCP desta execução piorou ligeiramente; não há ganho de LCP comprovado. Estes valores não são percentis de campo nem previsão de produção.

As respostas do Express são entregues por transporte em memória; recursos externos e Service Worker ficam bloqueados nesse benchmark. A interceptação desativa cache HTTP. Bytes significam soma dos corpos sem compressão, não transferência faturada. Fotos reais, CDN, gzip/Brotli e cache HTTP/SW em condições reais precisam de medição própria. Não existe amostra de INP ou comprovação do percentil 75 em produção.

Dados recentes: before-review.json e after-review.json. As medições anteriores before.json/after.json foram preservadas como histórico.

Evidência instrumentada anterior, preservada em firestore-cache.json: 100 solicitações simultâneas, 120 produtos, 12.200 leituras/100 consultas na referência versus 122 leituras/1 consulta com 99 solicitações compartilhadas. Isso mede um double de teste, não a fatura GCP. Não foi estimada economia em reais.

## 8. Monitoramento

window.ConfloraPerformance.snapshot() informa LCP, estimativa de INP, CLS por janelas, TTFB, tempo até catálogo, recursos/bytes informados pelo navegador, quantidade/duração de imagens, acertos/falhas do cache e cards criados/reutilizados. APIs não suportadas retornam valores nulos; timing pode omitir bytes de cache ou recursos sem permissão.

app.locals.publicCatalogCache.metrics expõe hits, misses, compartilhamentos e invalidações. Não há envio de URLs, dados pessoais ou tokens a uma nova integração.

## 9. Testes e pendências

Validação desta revisão:

- npm run build, npm run lint e node scripts/check-runtime.js: aprovados.
- 10 testes específicos de cache/worker: aprovados, incluindo falhas ao abrir/consultar CacheStorage.
- 20 cenários Playwright: aprovados em Chromium com viewports móvel e desktop. Cobrem visitas repetidas, módulos lazy, prioridade de imagens, DOM preservado, preço/estoque/carrinho, histórico/rolagem, paginação, login/logout/troca de usuário, isolamento, falha de rede, checkout com preço antigo, Save-Data, abas ociosas, invalidação entre lojas e atualização lenta.
- Regressão sem os três arquivos de carga prolongada: referência com 362 testes, 345 aprovados, 16 falhas e 1 ignorado; implementação com 370 testes, 353 aprovados, 16 falhas, 1 ignorado e nenhum cancelado. As 16 localizações de falha foram comparadas e são idênticas. As falhas são as já registradas na referência: quinze doubles WhatsApp sem sendInteractiveButtons e um teste de stream que espera um ID no primeiro chunk, recebendo primeiro o snapshot vazio.
- A tentativa de repetir a suíte incluindo carga foi interrompida enquanto o teste de carga prolongada não concluía. Esses três arquivos não foram aprovados novamente nesta revisão; as evidências da execução anterior permanecem preservadas.
- Os testes transacionais exercitados incluem preço/estoque/reservas, Pix simulado, PDV, pedidos, autorização e contratos WhatsApp. O envio WhatsApp fica simulado; logs esperados de doubles incompletos não comprovam a integração real.
- O teste que depende de FIRESTORE_EMULATOR_HOST permanece ignorado sem emulador.
- Firefox, Safari, dispositivos reais, CDN e ciclo real de atualização do worker seguem pendentes. A execução atual em Chromium reutilizou o navegador já instalado, configurando PLAYWRIGHT_BROWSERS_PATH.
- Pix real, comprovantes, WhatsApp e operação real do PDV ainda exigem homologação. Nenhuma operação externa foi executada.

Não se declara a suíte inteira aprovada nem o sistema pronto para produção sem essas verificações.

## 10. Arquivos alterados

| Grupo | Arquivos |
| --- | --- |
| Build/configuração | .gitignore; package.json; firebase.json; eslint.config.js; scripts/build-frontend.js; scripts/build-storefront.js; scripts/check-runtime.js |
| Vitrine | public/storefront/app.js; catalog.js; public-cache.mjs; performance.mjs; index.html; store.css; product-card.js; render-image.js; product-entry.js; sw.js |
| Backend | src/storefront/public-snapshot.js; existing-store.js; routes.js; src/http/app.js |
| Testes/medição | scripts/benchmark-loading.js; playwright.loading.config.js; test/loading/browser.spec.js; test/helpers/in-process-http.js; test/public-snapshot.test.js; test/smart-loading.test.js; test/public-cache.test.js; test/firestore-finops-regression.test.js; test/browser/public-cache.spec.js |
| Evidências | docs/performance/RELATORIO.md e os JSON dessa pasta |

Arquivos dist, shell.html e sw-built.js são gerados pelo build e ficam fora do Git. O lockfile e as dependências não mudaram.

## 11. Aplicação e publicação

1. Confira o checkout original antes de aplicar. O patch corresponde à referência local inspecionada; alterações concorrentes precisam de resolução.
2. Execute git apply --check conflora-carregamento-inteligente.patch e depois git apply conflora-carregamento-inteligente.patch, a partir da raiz do repositório.
3. Execute npm run build, npm run lint, npm run test:loading e npm run test:loading:browser. Se necessário, indique o navegador já instalado por PLAYWRIGHT_BROWSERS_PATH. No ambiente sem sockets, os testes HTTP usam CONFLORA_IN_PROCESS_HTTP=true e o preload test/helpers/in-process-http.js.
4. Homologue os fluxos comerciais e resolva as falhas preexistentes dos testes antes de liberar.
5. Publique backend e Hosting de forma coordenada pelo processo existente; confirme projeto, serviço e região. Não execute o script deploy cegamente: package.json aponta us-central1, enquanto os rewrites do Hosting apontam southamerica-east1. Essa divergência preexistente não foi alterada nesta tarefa.
6. O Hosting passa a executar build no predeploy; o runtime verifica os assets essenciais. Preserve hashes anteriores para abas abertas. Não publique shell sem seus assets e worker gerados.
7. Após publicação autorizada, valide cabeçalhos, primeira/segunda visita, atualização do worker e dados após alterações. Meça LCP/INP/CLS em dispositivos e conexões reais antes de afirmar metas de percentil 75.

Não há migração de coleção, índice, credencial ou segredo. O pacote inclui hashes e patch para revisão; a aplicação é verificada numa cópia descartável da referência, sem modificar o checkout original.

Referências técnicas consultadas: [Hosting](https://firebase.google.com/docs/hosting/full-config), [cache HTTP do Hosting](https://firebase.google.com/docs/hosting/manage-cache), [faturamento do Firestore](https://firebase.google.com/docs/firestore/pricing). As métricas e resultados acima vieram dos testes locais.
