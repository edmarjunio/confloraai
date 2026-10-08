# Testar a branch em outro computador

Branch: `feat/vendas-estoque-firestore-20261008`.

Instale Node.js e Git, abra o terminal e execute:

```bash
git clone --branch feat/vendas-estoque-firestore-20261008 https://github.com/edmarjunio/confloraai.git
cd confloraai
npm ci
npm run check
npm test
npm run test:local
```

Se usar o ZIP, extraia, abra um terminal na pasta que contém `package.json` e execute a partir de `npm ci`.

Acesse http://localhost:3000/admin e selecione **Administrador de teste**, PIN **1234**. O operador de caixa também usa PIN **1234**. O terminal precisa continuar aberto. Para parar, pressione Ctrl+C.

Páginas: `/` (cardápio), `/admin`, `/lancamentos`, `/fiados` e `/caixa`. O link localhost funciona no computador que executa o app; ele não é um endereço público. Este pacote não publica um serviço externo.

O modo local usa um banco próprio em `.local-test-data`, persiste os lançamentos e não inicializa o servidor de produção nem requer credenciais Firebase. WhatsApp, IA e filas são simulados. Autenticação Google e as integrações reais devem ser verificadas separadamente em homologação. Para começar de novo, pare o servidor e exclua `.local-test-data`.

## Importação e sequência de conferência

1. Em `/lancamentos`, entre como ADMIN, selecione **LISTA DE PRODUTOS.xlsx**, simule e confira erros, quantidades, preços e IDs. Confirme a substituição somente após conferir. O catálogo anterior é preservado; produtos com o mesmo ID mantêm o estoque e os custos. Produtos novos começam com estoque zero.
2. Selecione **RELATORIO VENDAS HORTA**, opção **Somente vendas**. A importação usa apenas **VENDAS HORTA**, separando vendas, recebimentos históricos e troco. Não usa ITENS para reconstruir vendas de produtos e não desconta o estoque atual.
3. Se precisar importar as entradas confiáveis, escolha **Somente entradas**. A aba **ITENS** fornece exclusivamente ENTRADA/ENTRY. Saídas antigas e Página3 são ignoradas. Vincule as entradas sem Product ID a produtos do catálogo; Sale ID pode ficar vazio.
4. Confira os totais e alertas da simulação antes de confirmar. Executar novamente o mesmo arquivo não duplica suas linhas. Um arquivo alterado possui uma nova identidade: não reimporte versões editadas sem reconciliar os registros já importados.
5. Lance uma entrada, uma venda com desconto, uma perda e uma contagem física. Verifique os saldos, custos opcionais e permissões de CAIXA/ADMIN.
6. Cadastre um cliente, lance venda fiado de R$900, receba R$400 e confira saldo R$500. Tente receber R$501: deve ser bloqueado. Confira também cancelamento e repetição do recebimento.
7. Em `/caixa`, confira troco, vendas por pagamento, recebimentos, retiradas e fechamento. Reabra o servidor e confira a persistência.

Antes de migrar produção, reconciliar os fiados históricos por cliente: o importador preserva registros financeiros históricos, mas não cria automaticamente os saldos operacionais de `credit_customers`. Conferir os totais por dia contra a planilha/Looker e fazer uma contagem física inicial. Estes passos evitam tratar o histórico de ITENS como estoque confiável.

## Limites da validação

Os testes automatizados exercitam regras financeiras, idempotência, autorização, catálogo, importação, persistência local, HTTP e sintaxe dos scripts gerados. O banco local não substitui testes do SDK, índices/regras e concorrência do Firestore real. A conferência visual e as integrações reais ainda devem ser feitas antes de produção.
