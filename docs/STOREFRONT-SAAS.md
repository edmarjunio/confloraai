# Vitrine SaaS multi-tenant

## Arquitetura

A nova vitrine está em `/shop/:slug`, com produto em `/shop/:slug/products/:id`
e painel em `/shop/:slug/admin`. A API está em `/api/stores/:slug`.
O slug é o identificador imutável do tenant, validado no servidor.
Não existe fallback de uma loja desconhecida para a Conflora.

- `src/storefront/contracts.d.ts`: contratos públicos de configuração e produto.
- `validation.js`: validação e projeção dos campos permitidos.
- `repository.js`: acesso ao Firestore com caminhos isolados e transações.
- `auth.js`: senhas scrypt, sessão HttpOnly específica da loja e autorização.
- `assistant.js`: pesquisa opcional, contexto da loja e seleção validada de produtos.
- `order-delivery.js`: entrega de webhooks assinados com repetição controlada.
- `public/storefront`: módulos nativos do navegador, sem dependência de framework.

As rotas antigas continuam disponíveis. Elas **não são a API multi-tenant** e não
devem ser usadas por novas lojas. `STOREFRONT_STORE_SLUG=conflora` muda somente a
entrada `/` para a nova loja, após provisionamento e conferência.

## Provisionamento

Configure as credenciais do Firestore já utilizadas pelo projeto e uma senha
forte na variável `STORE_ADMIN_PASSWORD` do processo. Não coloque a senha no
comando, em arquivos versionados ou em mensagens.

```powershell
node scripts/provision-store.js loja-exemplo "Minha Loja" admin@exemplo.com
```

Para a Conflora, existe um perfil inicial com as logos fornecidas. PIX, telefone
e endereço não foram inventados; precisam ser configurados pelo lojista.

```powershell
node scripts/provision-store.js conflora "Conflora Horta e Viveiro" admin@exemplo.com --import-legacy --config=config/stores/conflora.example.json
```

O importador lê os produtos diretamente do Firestore, copia fotos raster locais
para a coleção da loja e mantém imagens HTTPS. Ele não usa o catálogo de fallback.
Valida os produtos antes da escrita e publica a configuração pública somente ao
final. Uma falha anterior à publicação pode ser corrigida e a importação repetida.
Lojas já publicadas não são sobrescritas pelo comando.

Contas, pedidos e mensagens antigos permanecem nas coleções antigas: não são
copiados nem expostos automaticamente. Faça backup e planeje a virada de estoque;
não opere os dois checkouts simultaneamente sobre cópias independentes do estoque.
A importação não foi executada em produção por esta implementação.

Para outras identidades, passe um arquivo de StoreConfig com `--config=arquivo`.
As duas lojas dos testes (`garden` e `pets`) só existem no servidor de testes.

## Painel do lojista

Entre com o administrador provisionado pela conta da nova loja. O botão da conta
oferece o acesso ao painel. É possível:

- Cadastrar, editar e ocultar produtos; configurar fotos, unidade, estoque,
  categorias, tags, especificações e seções de conteúdo.
- Criar e renomear categorias com IDs estáveis ou ocultá-las.
- Alterar identidade, cores, logo, ícone e região.
- Habilitar pagamentos, configurar PIX, entrega por regiões/taxa fixa e retirada.
- Configurar persona, instruções, nome do assistente e pesquisa externa.
- Ver pedidos, confirmar separação, marcar entrega ou cancelar com restituição
  do estoque reservado. Alterações concorrentes de produto/configuração são rejeitadas.

O conteúdo da página do produto vem do cadastro. O sistema não inventa cuidados,
compatibilidade ou informações técnicas. Variações com estoque próprio podem
ser cadastradas como produtos separados; um editor de famílias de variantes não
faz parte deste contrato inicial.

## Checkout

O navegador envia apenas IDs, quantidades e dados de fechamento. Preços, taxa,
disponibilidade, unidade e estoque são verificados no servidor. O registro do
pedido e a reserva de estoque são transacionais. A chave de idempotência evita
pedidos duplicados quando a resposta falha e o cliente tenta novamente.

Valores monetários são inteiros em centavos. PIX é cópia de chave e conferência
manual; cartão é seleção para pagamento combinado com a loja. Não há captura
de cartão nem liquidação bancária automática. Copiar PIX não confirma pagamento.

O padrão `IN_APP` registra e confirma o pedido na tela. `WHATSAPP_HANDOFF`
oferece, após o registro, um link explícito com o resumo, sem abrir outra página
automaticamente. A integração automatizada pode ser feita via webhook.

## Webhooks

O operador configura `STORE_WEBHOOK_ALLOWED_HOSTS` com uma lista de domínios
HTTPS autorizados, separados por vírgula. O segredo fica em variável de ambiente
`STORE_WEBHOOK_SECRET_<NOME>`. O painel guarda somente a referência, nunca o valor.
Não habilite destinos que resolvam para infraestrutura privada da plataforma.

Cada pedido gera um evento de outbox na mesma transação. Há uma tentativa após o
checkout; falha externa não desfaz o pedido. Para retentativas, execute periodicamente:

```powershell
node scripts/deliver-store-orders.js conflora
```

Configure essa execução no ambiente de hospedagem; nenhum agendamento remoto
é criado automaticamente. O receptor deve deduplicar por `X-Event-Id` e validar
`X-Store-Signature` (HMAC-SHA256 do corpo bruto). Entrega é ao menos uma vez.
Não são seguidos redirecionamentos. Retentativas usam backoff e lease.

## IA e pesquisa

O cliente Gemini existente é injetado pelo backend; use as configurações de
credenciais e `GEMINI_MODEL` do projeto. Pesquisa externa é habilitada por loja.
A implementação usa a API `models.generateContent` suportada pelo SDK instalado,
com `googleSearch`. Veja a documentação de referência:
https://ai.google.dev/gemini-api/docs/google-search

Fluxo: mensagem/contexto → requisitos e pesquisa → seleção de IDs → validação
contra catálogo disponível → cards. Fontes e sugestões de pesquisa são exibidas;
HTML do provedor fica em iframe com sandbox e política sem scripts.
E-mails e telefones reconhecidos são removidos do texto enviado ao modelo.
Nome, endereço e telefone do checkout não são adicionados ao contexto do chat.

O catálogo candidato é limitado a 100 produtos por solicitação. Catálogos maiores
usam pré-seleção lexical; descoberta sem palavras em comum pode exigir busca
vetorial futura. Isso não altera os filtros de isolamento do tenant.

Sem cliente IA, a interface informa “Busca no catálogo · IA indisponível”.
As chamadas reais ao Gemini, Google Search e webhooks não são feitas nos testes.

## Segurança e operação

Todos os acessos da nova vitrine ao banco passam pelo backend. Bloqueie acesso
direto dos clientes a `stores/**` nas regras do Firestore; não substitua regras
existentes da aplicação sem revisão. O Admin SDK usa IAM e não regras de cliente.
Configure TTL para `sessions.expiresAt`/rate limits conforme os tipos de campos
adotados (sessões usam milissegundos; `rateLimits.expiresAt` usa timestamp), ou um
job de limpeza que respeite esses formatos. As expirações são verificadas no código.

Use HTTPS em produção. Cookies são HttpOnly, SameSite=Strict e Secure em produção.
Os limites de autenticação, pedidos e chat são por tenant/IP/minuto, persistidos
no Firestore. Se houver proxy, configure o número exato de saltos confiáveis no
Express antes de usar o IP do cliente para cotas. Não aceite trust proxy irrestrito.

## Validação local

```powershell
npm run check
npm run lint
npm test
$env:CHROMIUM_PATH='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm run test:e2e
```

O servidor dos testes inicializa duas lojas isoladas, sem acesso a Firestore,
WhatsApp ou Gemini reais. Testes cobrem compra concorrente, idempotência,
isolamento de sessão/pedidos, permissões, configuração, produto, chat e responsividade.
