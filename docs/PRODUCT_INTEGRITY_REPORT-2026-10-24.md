# Integridade de produtos — Conflora — 24/10/2026

## Resultado e bloqueadores

Implementação local em `main`, base `429a1d4`, com alterações não commitadas preservadas. Não houve deploy, merge ou alteração do ambiente hospedado. Revisão local identificável: `local-429a1d4-products-20261024`. A sessão de testes foi iniciada explicitamente pelo usuário; a data não foi usada como autorização.

O Firestore continua sendo a fonte oficial. Os bytes das fotografias ficam no Firebase Storage; Firestore guarda URLs, caminhos e procedência. Loja principal, busca, detalhes, administração, inventário, PDV e publicação Meta usam o mesmo contrato de fotos reais. Isso não significa que toda a operação já tenha fotos ou esteja homologada em produção.

Auditoria real, somente leitura:

- 759 registros de produtos; nenhuma divergência de identidade, preço ou imagem entre as projeções verificadas.
- 757 registros na API da vitrine: 754 disponíveis e 3 inativos. Os 2 itens financeiros internos foram excluídos dessa projeção, preservados no Firestore e no histórico.
- **0 produtos com foto real confirmada. 759 pendências de foto.** As imagens previamente cadastradas eram referências externas, fotos migradas de referência ou a ilustração gerada. Não foram reclassificadas artificialmente como fotos dos produtos reais.
- 82 referências principais apontam para o Storage; todas responderam HTTP 200, com tipo imagem e conteúdo não vazio, em consultas HEAD. Isso comprova existência naquele instante, não correspondência com o produto real.
- O estoque permanece sem controle, conforme a decisão comercial anterior; não foram criadas quantidades fictícias.
- A inspeção anterior de marcadores explícitos encontrou 0 clientes, 2 usuários e 1 pedido, sem marcadores de teste. Ausência de marcador não certifica a origem de cada registro; nenhum foi apagado por inferência.

Listas completas: [auditoria JSON](PRODUCT_INTEGRITY-2026-10-24.json), [fotos reais pendentes](PRODUCT_PHOTOS_PENDING-2026-10-24.csv), [itens indisponíveis na Meta e motivos](WHATSAPP_CATALOG_RESULT-2026-10-23-INDISPONIVEIS.csv), [registros ausentes na Meta](WHATSAPP_CATALOG_RESULT-2026-10-23-NAO-VINCULADOS.csv).

## Fluxos implementados e consumidores reais

1. **Upload:** formulário da administração ou cadastro da vitrine principal → sessão e permissão no servidor → confirmação explícita de foto real → `/api/admin/products/:id/photo` → serviço oficial de Storage → metadados em `product_images` e referências em `products`. Fotos externas e geradas não recebem procedência de foto real por migração automática. O servidor não consegue certificar visualmente a declaração do funcionário.
2. **Listagens:** `actualProductImages` valida bucket configurado, pasta do próprio produto e caminhos confirmados. `actualProductPhotoFields` limpa também os aliases antigos que os componentes de cartões ainda leem. Ausência de foto usa indicação neutra, nunca a imagem de outro produto.
3. **Preço/descrição:** edição comum preserva referências fotográficas, inclusive históricas ocultas. A remoção/ordenação explícita aceita apenas fotos reais já vinculadas ao próprio produto. Upload concorrente usa a referência anterior como condição de gravação. URLs novas são geradas pelo Storage e têm cache imutável; a referência do produto muda após confirmação.
4. **Conteúdo:** descrições e especificações geradas/importadas sem confirmação não substituem informações registradas pela equipe. Na ausência de descrição pública confirmada, a apresentação usa o nome cadastrado. Não se inventam cuidados, material, prazo ou características.
5. **Comércio:** preço zero editável não perde prioridade para um alias antigo no PDV. A disponibilidade e validação comercial continuam no servidor. `TROCO DO DIA` e `RECEBIMENTO` deixam de ser produtos vendáveis; funções financeiras, abertura de caixa e históricos permanecem.
6. **Cache:** mutação confirmada invalida a projeção do processo e sinaliza abas por timestamp, sem compartilhar dados privados. A geração pública `cf-public-20261023-real-products1` começa vazia e elimina somente as duas gerações públicas antigas. Nenhuma autenticação, venda ou operação pendente é apagada.
7. **Sincronização:** alteração de produto → observador local explicitamente habilitado ou trigger hospedado preparado → mesma `pdv_outbox`, estado `CATALOG_PENDING` → worker oficial → leitura atual do backend → validação de elegibilidade → API Meta. Fingerprint, geração e lease evitam recriação por eventos repetidos e preservam reconciliação. Não se sincroniza tudo a cada mensagem. O trigger hospedado não foi publicado.

## Estado dos canais

Catálogo Meta `1834176020928565`: 580 registros vinculados, todos consultados como `discontinued`; 179 ausentes. Nenhum produto está localmente autorizado a publicar sem foto real. Os registros remotos continuam existindo; disponibilidade não apaga a imagem histórica do Commerce Manager. Se a Meta mantiver conteúdo em cache, sua remoção retroativa do cliente não pode ser garantida.

Os ovos de 12 e 30 unidades continuam com rejeição comercial da Meta, sem motivo específico além do retorno genérico do provedor. Corrigir texto não equivale a obter aprovação. Preços foram preservados; não se usa outra mensagem para contornar política. Animais e demais grupos pendentes mantêm bloqueios conservadores e revisão de elegibilidade.

Facebook Shop, Instagram Shopping, outras páginas e o catálogo `1445423021133841` não foram certificados como equivalentes nem vinculados nesta entrega. Não é correto afirmar que todos os catálogos de todas as plataformas estão iguais.

O menu mantém o template real e CTA URL do site. “Montar minha sacola” usa catálogo nativo quando habilitado; no local ele permanece desabilitado enquanto faltam fotos reais e homologação. “Falar com atendente” registra a pausa humana persistente e deixa a mensagem para a equipe; não inicia agente virtual. O layout nativo do WhatsApp e a propagação da Meta não são controlados pelo site.

## Carregamento e impacto

Estrutura e catálogo essencial vêm antes de módulos secundários. Conteúdo utilizável permanece durante revalidação ou falha. O cache público tem validade de 60 segundos, retenção de 24 horas e limite de 4 MiB. O snapshot do servidor tem TTL de 15 segundos por processo, compartilha requisições concorrentes e descarta resultados anteriores a uma invalidação. Outros processos e alterações externas convergem por expiração; isso não é uma garantia transacional.

Não foi acrescentada leitura global de pedidos à abertura do catálogo/inventário. Dados privados não entram no IndexedDB público. Sessões são por aba; logout e troca de usuário encerram streams e descartam contexto privado. Rascunhos de sacola não são recuperados de cache público após reload.

**Limitação identificada:** a primeira leitura ainda carrega o catálogo completo. Os parâmetros legados `limit/page` recortam um snapshot em memória e não reduzem as leituras iniciais no Firestore; não são apresentados como otimização de banco. Alterar isso exige migração coordenada dos consumidores de filtros e totais para cursores reais. Assim, não certificamos aderência integral ao requisito de paginação do CONTRATO.md.

Upload acrescenta gravação do objeto, metadados e produto; sincronização acrescenta transações da outbox e chamadas Meta quando a projeção muda. Auditorias integrais são operações administrativas, não parte do caminho de cada mensagem. Fotos novas com URL versionada evitam reutilizar bytes antigos. Não foram estimados custos de fatura nem leituras reais em produção.

## Tempos medidos

Cinco GETs sequenciais por rota/origem, do computador local, sem login e sem envio de mensagens. Estado inicial de cache não controlado. Valores abaixo são medianas de amostras HTTP, não LCP, INP, p75 ou tempo de interação em celular.

| Ambiente e rota | Até cabeçalhos | Resposta completa | Corpo decodificado |
| --- | ---: | ---: | ---: |
| Local `/` | 15,67 ms | 15,89 ms | 33.986 bytes |
| Local `/api/storefront/catalog` | 14,10 ms | 16,26 ms | 841.780 bytes |
| Hospedado `/` | 957,68 ms | 1.151,38 ms | 33.407 bytes |
| Hospedado `/api/storefront/catalog` | 2.897,13 ms | 4.527,59 ms | 3.165.733 bytes |

Primeira amostra local do catálogo: 384,51 ms; seguintes: 8,12 a 16,72 ms. A coleta ocorreu antes do último filtro dos 2 itens internos; a resposta final pode ter tamanho ligeiramente diferente. A linha de base local tinha 1.336.301 bytes, mas a redução inclui conteúdo/imagens não confirmados que deixaram de ser enviados. Não é comparação controlada de otimização. O ambiente hospedado usa outra revisão, por isso sua diferença não mede ganho causado pelo código local.

Dados de medição: [PRODUCT_HTTP_MEASUREMENTS-2026-10-24.json](performance/PRODUCT_HTTP_MEASUREMENTS-2026-10-24.json). Não foram medidas memória, INP, LCP, CLS ou throughput em dispositivo real. As metas do contrato permanecem metas, não resultados certificados.

## Verificação

- Build frontend, sintaxe dos módulos, ESLint e TypeScript das Functions verificados localmente.
- Suíte Node isolada: 482 testes, 481 aprovados, 0 falhas, 1 teste dependente de emulador não executado.
- Carregamento em navegador: 30 aprovados, incluindo upload pelo formulário, revalidação lenta/falha, separação de usuários, checkout e encomendas/Pix manual.
- Banco vazio: 1 teste aprovado, sem injetar dados iniciais no runtime.
- Suíte ampliada de navegador: resultado final e eventuais ressalvas serão registrados após a última execução; as primeiras execuções identificaram expectativas antigas de controles móveis e seletores, corrigidas nos testes.
- Auditoria real de produtos/Meta/Storage foi somente leitura nesta retomada. As disponibilidades Meta foram retiradas na etapa anterior em atendimento à exigência de fotos reais. Testes de venda e pagamento desta retomada ficaram isolados, sem mensagens ou cobranças reais.

## Limpeza e preservações

As 56 imagens de referência/ilustração antes publicáveis foram arquivadas fora de `public`, em `.private/reference-product-assets-20261023-real-only`; não são fotos reais certificadas. A fixture necessária foi copiada para `test/fixtures`. O módulo `validated-catalog-profiles` perdeu todos os consumidores de runtime e foi retirado; o fallback de carregar JSON de produtos na migração também foi removido. O gerador SVG sem consumidores foi retirado. Configurações de deploy excluem referências e scripts históricos de geração/reset.

Documentos e referências históricas do Firestore não foram apagados. Objetos antigos do Storage foram preservados; sua eliminação requer reconciliação das referências e autorização separada. Testes, fixtures e guardas contra mocks continuam fora do bundle/runtime/deploy. Pix Sicredi manual, simulador isolado, integração real aguardando API, pedidos, reservas, comandas e comprovantes foram preservados.

## Próximos passos operacionais e rollback

1. A equipe envia fotografias próprias pelo formulário e confirma a origem; revisa descrições reais, espécies, variantes, preço e disponibilidade. Não confirmar em lote fotografias de referência.
2. Revisar os itens elegíveis no Commerce Manager, resolver rejeições pelo procedimento oficial e conferir imagens/preços no cliente WhatsApp. Só então habilitar o catálogo nativo para a operação desejada.
3. Homologar permissões/troca de usuário, cadastro, atualização entre telas, venda/comanda, estoque ativo e livre, cancelamento, entrega/retirada/taxa, encomenda/cotação/aceitação, Pix manual, intervenção humana, duplicação de webhook e recuperação de rede.
4. Publicar Hosting/Cloud Run/Functions somente com autorização específica e validação dos fluxos críticos. O observador local não substitui serviço hospedado.
5. Pausar sincronização pelo controle oficial `store_settings/whatsapp_commerce.enabled=false` e/ou `WHATSAPP_META_SYNC_ENABLED=false`; a flag local `WHATSAPP_META_CATALOG_ENABLED=false` impede abrir o catálogo pelo botão. Desativar automação WhatsApp pela configuração existente e manter a loja/Pix operantes; não apagar outbox/inbox ou dados financeiros.
6. Rollback de código: preservar o diff atual, selecionar revisão revisada e reconstruir assets antes de publicar sob autorização. Não executar reset global, não restaurar imagens não confirmadas nem reabrir produtos Meta indiscriminadamente. Trabalhos pendentes precisam de conciliação da geração vigente.

Para reiniciar localmente: identificar o PID que escuta 8080, confirmar que é este `src/server.js`, encerrar somente esse processo e executar `npm start` no repositório. `EADDRINUSE` significa servidor já escutando, não necessidade de iniciar outro. `npm start` não atualiza o Hosting/Cloud Run. `/health` mostra `revision`; inbox registra `receivedByRevision` e `processedByRevision`, permitindo distinguir entrada e processamento do webhook. O túnel HTTPS precisa estar ativo e corresponder à URL cadastrada na Meta.

Sugestões prioritárias: fotografar primeiro os produtos mais vendidos, revisar conteúdo e elegibilidade por grupo, homologar um carrinho completo com a equipe, migrar a carga inicial para paginação real com índices/cursores e medir p75 em rede/dispositivo representativos após publicação autorizada. Nenhuma medição desta entrega permite declarar produção validada ou ausência de risco.
