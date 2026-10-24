# Preparação para dados reais — 23/10/2026

> Relatório histórico: os resultados abaixo não homologam a revisão atual do atendimento WhatsApp. Ver [WHATSAPP_IMPLEMENTATION.md](WHATSAPP_IMPLEMENTATION.md): configuração Meta e sessão explícita de testes ainda pendentes, sem deploy ou mensagens reais.

## Fluxo e autoridade dos dados

Loja, caixa e WhatsApp enviam IDs e quantidades ao backend. O backend lê os registros atuais do Firestore e valida produto, preço, unidade, estoque, identidade, permissão e pagamento. Uma falha de leitura não autoriza usar dados comerciais antigos ou registrar uma venda em memória. O armazenamento em memória dos testes fica restrito ao ambiente isolado; o simulador Sicredi possui armazenamento descartável próprio.

Não há produtos, usuários, vendas ou saldos de demonstração inicializados no aplicativo. Foram removidos os scripts de carga fictícia, descrições/cuidados inventados e fotos genéricas de produtos. Produtos sem preço válido não aparecem como itens gratuitos no catálogo de vendas. Cadastro de inventário sem preço pode ser corrigido antes de disponibilizar o produto.

## Atendimento

A primeira mensagem no WhatsApp abre três opções: catálogo virtual, sacola pelo WhatsApp e atendimento pelo agente. O agente pede produtos e quantidades, confirma encomendas dos itens indisponíveis e confirma separadamente a venda dos disponíveis. O pedido recebe recibo e segue para pagamento sem transferência obrigatória a um atendente.

Pix manual permanece pendente até conferência autorizada na conta bancária. Pix Sicredi automático depende da configuração e liberação reais do banco; cobrança e callback não são substituídos por aprovação fictícia. O simulador preservado testa cobrança, reserva, confirmação e repetição de callback sem criar dados no Firestore real ou enviar mensagens reais.

## Login, idiomas e PIX

Ao acionar o login Google, o provedor solicita seleção de conta. Uma sessão do aplicativo já válida continua autenticada. O backend verifica token, revogação, provedor Google e e-mail verificado; o cliente não pode atribuir a si um cargo de equipe.

Textos fixos da interface usam chaves em inglês e dicionários locais para português, inglês, espanhol e francês. Português é o padrão, inclusive em navegador configurado em outro idioma; a preferência escolhida é preservada. Nomes originais do Firestore não são alterados. Nomes comuns conhecidos ou traduções cadastradas em `nameTranslations` são exibidos no idioma escolhido; nomes sem tradução e cultivares conservam o original. Não se envia conteúdo do Firestore a serviços de tradução.

A imagem PIX fornecida está na loja e no caixa. O botão usa verde claro e sombra nas cores da marca. A imagem pulsa somente quando PIX está selecionado e respeita movimento reduzido.

## Armazenamento e limpeza

Catálogo comercial, sacola e dados preenchidos do cliente não são persistidos como cópias locais. A atualização limpa snapshots antigos e os caches da Conflora no navegador. Rascunhos de contagem ficam na tela atual e são descartados ao recarregar. Credenciais de sessão e preferência de idioma continuam próprias de sua finalidade.

O service worker atende notificações e não fornece catálogo offline. Arquivos de código e imagens com hash continuam usando cache HTTP; não são fonte de preço, estoque ou pagamento. Fixtures de testes não fazem parte do pacote publicado.

## Validação e limites

| Verificação final | Resultado |
| --- | --- |
| Backend e regras de negócio | 435 cenários: 434 aprovados, 0 falhas, 1 ignorado por ausência de emulador. |
| Navegador, fluxos e responsividade | 91 aprovados, 0 falhas. |
| Telas com base isolada vazia | 1 cenário completo aprovado, incluindo todas as seções administrativas. |
| Build, lint, sintaxe e arquivos necessários à inicialização | Aprovados. |

O resumo estruturado está em `validation-2026-10-23.json`. Os relatórios de execuções antigas não representam esta validação final.

A validação de banco vazio usa servidor separado, sem produtos, pedidos, clientes, operadores fictícios ou configuração comercial. O teste cria apenas uma identidade descartável para conferir áreas protegidas e percorre loja, caixa no celular, todas as seções administrativas, gerenciamento, configurações e páginas legais.

Uma consulta somente de leitura ao Firestore real em 23/10/2026 às 14:54 UTC encontrou 759 produtos, 1 pedido, 0 clientes, 2 usuários e 1 configuração de loja. Esses registros foram preservados. Os testes usam dados isolados e não limpam nem populam a base real.

As regras locais `firestore.rules` negam todo acesso direto do cliente; operações comerciais passam pelo backend. A revisão estática está em `firestore-rules-review.json`. A execução não confirma implantação das regras ou IAM. O cenário de concorrência com emulador exige `FIRESTORE_EMULATOR_HOST` e fica explicitamente ignorado quando ele não está disponível. O login real na conta Google, o recebimento real pela Meta e a liquidação real no banco dependem da homologação externa, não dos transports isolados.

## Executar novamente

```powershell
npm run build:frontend
npm run test:dev
$env:CHROMIUM_PATH = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:e2e
npm run test:empty
npm start
```

Para testar pelo WhatsApp local, mantenha o servidor e o túnel abertos. O callback da Meta deve ser a URL HTTPS atual do túnel com `/webhook`; o token deve corresponder à variável configurada no servidor. `WHATSAPP_CATALOG_URL` deve apontar para o túnel se o botão precisar abrir a versão local da loja. O endereço muda quando um túnel temporário é recriado.

Estas alterações são locais. Reinicie o servidor para testá-las; a publicação em produção é uma etapa separada.
