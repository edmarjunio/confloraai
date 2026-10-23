# Reformulação operacional — 23/10/2026

## 1. Auditoria e arquitetura

O PDV usa React em `public/pdv/app.jsx`, componentes compartilhados em `components.jsx`, entregas em `delivery.jsx` e os cards do catálogo em `public/storefront/product-card.js`. A persistência continua no repositório Firestore existente. O servidor isolado dos testes usa repositório em memória e não envia pagamentos ou mensagens reais.

Problemas encontrados: cabeçalho de loja e atalhos de teclado ocupando a tela mobile, recibo inicialmente aberto, botões flutuantes sobre o catálogo, formulário rápido que navegava ao concluir e não adicionava o item, ausência de sugestões de duplicados e aviso de notificações sobrepondo ações inferiores.

O carrinho de uma nova venda pertence ao estado do App. As comandas que já foram persistidas têm estados de pagamento, reserva e entrega próprios; não são o mesmo objeto do carrinho em elaboração.

## 2. Decisões de interface implementadas

- Desktop conserva cabeçalho, atalhos, recibo lateral e colunas de entrega.
- Mobile tem cabeçalho compacto, busca imediata, opções operacionais recolhidas, cards verticais e barra de total com Ver carrinho.
- O carrinho detalhado aparece quando solicitado. Desconto, entrega, cliente, pagamento dividido, dinheiro e Pix continuam nos componentes existentes.
- Cadastro rápido no catálogo e no grupo de ações de Comandas. Campos principais: nome, categoria existente ou nova, unidade e preço com máscara BRL. Estoque fica em Mais opções e inicia zerado, sem inventar saldo.
- Sugestões de produtos semelhantes usam a lista já carregada, sem consultas por tecla. Categorias usam a mesma lista.
- O diálogo contém o foco, aceita Escape, impede rolagem da página e mantém dados após erro. O salvamento exige confirmação da API.
- Salvar produto atualiza o catálogo e preserva a tela atual. Salvar e adicionar usa o mecanismo existente de inclusão, incluindo seleção de peso para KG, mantendo os itens anteriores.
- Gerenciamento completo ganhou busca por nome/código/descrição e filtros de categoria e status. O formulário tradicional agrupa status, foto e descrição em Mais opções.
- Entregas mobile mostra uma etapa por vez e acompanha o status confirmado pelo servidor; desktop mantém as colunas.

## 3. Persistência e segurança

POST `/api/caixa/products` mantém autorização ADMIN/CAIXA/VENDEDOR, validação de preço, nome, estoque e unidades UN/KG no servidor. Um UUID de tentativa acompanha o formulário e é reutilizado após falha; uma repetição retorna o produto previamente salvo. O servidor verifica o autor e o nome antes de reutilizar o registro. O cache de catálogo e índice de produtos é invalidado após a gravação.

Não houve migração, publicação, alteração de produtos reais nem mudança nos cálculos financeiros. Nenhum registro de pagamento real foi criado.

## 4. Validação

Compilação: `npm run build:frontend`.

Regressão de negócio: 102 testes aprovados em `pdv`, `order-integrity`, `manual-pix`, `stock-adjustments` e `delivery-metrics`.

Navegador: `npx playwright test test/browser/operational-ux.spec.js`. Os três cenários cobrem:

1. Dois itens existentes, produto não encontrado, falha de rede, repetição, criação, atualização da pesquisa, inclusão como terceiro item e finalização em dinheiro.
2. Sugestões semelhantes, cancelar, salvar sem adicionar e ausência de rolagem horizontal no formulário em 320, 390, 430, 768 e 1440 pixels.
3. Rejeição sem autenticação, dados inválidos e repetição do mesmo cadastro sem duplicar o produto.

Entrega: cenário existente `driver receives new orders` em `test/browser/delivery.spec.js`: assumir, separar, rota, recebimento, conclusão e apresentação desktop.

Capturas após a mudança são geradas em `artifacts/ux/ux-sale-mobile.png` e `artifacts/ux/ux-sale-desktop.png`. As imagens fornecidas pelo usuário são a referência anterior: cabeçalho ocupando a maior parte da tela e recibo aberto. A captura mobile nova mostra cabeçalho e busca compactos, catálogo livre e resumo inferior do carrinho.

## 5. Limitações e pendências explícitas

- Salvar e adicionar está ligado à venda em elaboração no PDV. Não acrescenta itens em comandas já persistidas: isso exige uma operação de edição de pedido com recálculo, autorização e tratamento de reservas que o contrato atual não oferece. O cadastro pode ser salvo sem abandonar a comanda aberta, mas a edição de itens dessa comanda ainda não foi implementada.
- A foto continua disponível no cadastro completo; o formulário rápido não envia imagens.
- As unidades rápidas permanecem UN/KG, únicas aceitas pelo serviço atual. Não foram introduzidos códigos de unidade sem suporte do backend.
- Foram usados navegadores desktop com larguras simuladas. Ainda precisam ser conferidos em aparelhos Android/iOS reais: teclado virtual, safe area e comportamento específico do Safari. A redução de viewport não substitui esse teste.
- Não foram injetadas falhas diretamente no Firestore real. O teste de recuperação usa interrupção HTTP e persistência em memória. A suíte completa do repositório não foi executada.
- Uma nova consulta das demais telas recebe o catálogo invalidado no servidor. Não foi criado um canal de sincronização instantânea de produtos entre sessões distintas.

## Validação local segura

Execute `npm run build:frontend` e os testes de navegador indicados. O Playwright inicia automaticamente `test/browser-server.js` em `127.0.0.1:8099`, usando dados em memória. Não é necessário configurar credenciais reais. Para conferência manual, inicie esse mesmo servidor e use o perfil de teste Caixa (`usr-caixa1`, PIN `0000`). Não utilize essas credenciais em produção.
