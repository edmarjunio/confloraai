# Vendas e estoque — 08/10/2026

Base: main d48cd6200c04076a55105b0456131925810642e9, após clone e git pull --ff-only.

## Alterações

- `/lancamentos`: ações grandes para vender vários produtos, registrar entrada, perda/retirada, receber pagamento, contagem ADMIN, importar XLSX e acompanhar vendas por mês.
- Preços consultados no backend; nome e preço originais registrados nos itens. Desconto em reais no cabeçalho, máximo de 20% da soma dos produtos, sem entrega. Acima de 5% cria notificação exclusiva para ADMIN.
- Venda, baixa, movimentações, pendência de estoque e alerta de desconto na mesma transação Firestore. Operações usam UUID e marcador de idempotência; erro de banco não retorna sucesso em memória.
- Saldo negativo permitido com confirmação do operador. Uma pendência por produto atualiza o saldo, sem alertas duplicados.
- Entrada soma ao saldo; contagem física define o saldo final. Exemplo: −4 para 20 cria ajuste +24. Contagem exige ADMIN, motivo e versão do estoque para rejeitar contagens desatualizadas.
- Recebimento não cria nova venda nem baixa; impede valor maior que o saldo. Cancelamento ADMIN preserva venda, registra motivo e estorna estoque uma única vez. Não estorna histórico importado.
- Importação XLSX com simulação: VENDAS HORTA vai para vendas, recebimentos históricos e caixa separados. ITENS importa apenas ENTRADA; Página3 é ignorada. Campos originais, aba, linha e lote preservados. IDs repetidos recebem IDs determinísticos por arquivo/aba/linha. Reenvio do mesmo arquivo não duplica registros ou entradas. Execução em blocos retomáveis de 200 linhas.
- Produtos sem ID na entrada são associados pelo nome somente quando há um único candidato. Na simulação, ADMIN resolve os demais pela seleção do cadastro e simula novamente.
- Desconto histórico negativo −0,02 na linha 4902 é preservado e sinalizado, sem correção arbitrária. Limite de 20% vale para novas vendas, não altera histórico.
- Sessão de operador no backend com cookie HttpOnly, SameSite e expiração de 8 horas. Permissões consultadas no Firestore a cada requisição. Listagem de operadores não expõe PIN ou senha.
- Site e WhatsApp usam a nova transação de venda; pedidos WhatsApp em andamento ficam em `pending_orders`, e vendas concluídas em `orders` com IDs exclusivos.
- Rotas antigas de lançamento/entrada/cancelamento direcionam ao novo fluxo; importador antigo fica restrito a produtos. Edição do cadastro não altera o saldo.
- `firestore.rules` nega acesso direto pelo SDK cliente; backend mantém acesso via IAM. O arquivo não foi publicado automaticamente.

## Como utilizar

1. Instalar dependências com `npm ci`, validar com `npm run check` e `npm test`, e publicar o backend conforme scripts existentes.
2. Entrar no painel `/admin` com Google ou PIN de operador cadastrado e abrir o link Lançamentos.
3. ADMIN envia o XLSX original, simula, resolve associações e confirma. Os dados antigos não movimentam estoque; apenas as 79 entradas são somadas ao saldo atual.
4. Após importar, conferir estoque físico pela ação Conferir estoque. Não lançar contagem como entrada.
5. A virada ocorre quando o novo backend passa a receber lançamentos. Não repetir manualmente vendas anteriores como novas vendas.

## Limites e validação

A implementação e os testes locais não equivalem a uma validação no projeto Firebase real. Não houve deploy, importação no banco real, apagamento de produtos ou conciliação automática de recebimentos antigos. A importação preserva o histórico, mas não presume a dívida atual; novas cobranças de vendas antigas ficam bloqueadas até conciliação. O painel inicial soma vendas por mês a partir do Firestore; evoluir agregados materializados se o volume crescer. Abertura e movimentações em dinheiro foram incluídas na etapa adicional descrita abaixo; fechamento formal persistido não está incluído.

Pedidos WhatsApp antigos na coleção `orders` não são transferidos automaticamente para `pending_orders`; o atendimento deve iniciar um pedido novo após a virada. Alteração aprovada no fluxo antigo não deve ser usada para corrigir novas vendas com estoque: usar cancelamento e novo lançamento.

## Adições solicitadas durante a implementação

### Fiados (`/fiados`)

- Cadastro de cliente com ID exclusivo e telefone opcional, sem agrupar automaticamente pessoas com o mesmo nome. Venda fiado exige selecionar um cliente cadastrado.
- Lista de todos os devedores com saldo positivo, pesquisa por nome/telefone, total a receber e histórico de vendas, recebimentos e cancelamentos por cliente.
- Venda R$ 900 aumenta a dívida em R$ 900; receber R$ 400 deixa R$ 500. Recebimento parcial distribui automaticamente entre vendas mais antigas. Pagamento por venda e por cliente atualizam o mesmo saldo.
- Backend valida valor positivo e não superior à dívida; saldo, recibo, aplicações por venda e auditoria são gravados na mesma transação. Reenvio não gera segundo recebimento. Sem dívida, recebimento é bloqueado.
- Cancelamento reduz apenas o saldo ainda não pago. Se houve recebimento, sinaliza devolução pendente; não presume dinheiro devolvido.
- Login por PIN agora exige credencial realmente cadastrada: usuários que só têm login Google não entram fornecendo um PIN arbitrário.

### Custos e lucro

- Entrada aceita custo unitário opcional, incluindo zero quando realmente informado. Sale ID não é exigido em entrada.
- Importador também preserva custo unitário quando a célula está preenchida; campo vazio continua sem custo.
- Produto guarda o último custo informado, com data e origem. Item vendido guarda esse custo e o preço vendido para preservar o histórico.
- Lucro bruto estimado = receita do item após rateio do desconto − quantidade × custo. O rateio existe apenas para calcular lucro: o preço original do item permanece intacto.
- Margem sobre venda = lucro / receita × 100; também registra lucro sobre custo (markup) separadamente. Exemplo: custo R$ 10, venda R$ 50 = lucro R$ 40 e margem 80%, sem desconto.
- Sem custo conhecido, lucro e percentual ficam nulos, nunca são inventados. São estimativas com base no último custo informado, não apuração de lucro líquido ou custo médio de estoque.

### Valores de hoje (`/caixa`)

Referência: PDF `CAIXA_CONFLORA_HORTA_E_VIVEIRO (2).pdf` enviado pelo usuário. Implementa 12 cartões e dois gráficos de composição (pagamento e responsável), com seleção de data e horário de São Paulo:

1. Recebimento de dívida.
2. Vendas a receber (fiado), em reais.
3. Quantidade de vendas.
4. Ticket médio.
5. Troco + entradas em dinheiro − saídas.
6. Pix.
7. Cartão de crédito.
8. Cartão de débito.
9. Troco do dia.
10. Vendas em dinheiro.
11. Total recebido em vendas.
12. Caderno: recebido das vendas + recebimentos de dívida.

Recebimentos não contam como vendas nem aumentam a quantidade de vendas. Os cartões de formas de pagamento incluem recebimentos e vendas efetivamente recebidas. Fiado ainda não recebido não entra nos valores de caixa. O saldo físico inclui recebimentos de fiado em dinheiro; esse componente aparece separado para conferência. Cartão sem distinção entre crédito/débito aparece em Outros, evitando classificação inventada.

Permite registrar troco do dia (uma abertura por data, incluindo proteção contra duplicação com troco importado), retirada, despesa e devolução realmente pagas em dinheiro, com motivo e responsável. Campo de contagem física compara dinheiro contado ao saldo esperado. Essa conferência não representa fechamento formal persistido ou bloqueio de novos lançamentos.

As fórmulas foram derivadas dos indicadores e valores visíveis no PDF; o PDF não contém as expressões internas do Looker. Teste de referência reproduz os valores de R$ 426,89 de vendas, R$ 440 de recebimento, R$ 866,89 no caderno, R$ 452,23 de saldo, 13 vendas e ticket R$ 32,84. Não é uma leitura ao vivo do Looker.

## Validação final

- `npm run check`: valida a sintaxe dos módulos existentes e novos.
- Testes cobrem descontos, estoque negativo, contagem com concorrência detectada, entradas, importação repetida, fiados parciais, bloqueio de excesso, custo opcional, margem, caixa, fuso e autenticação.
- Os módulos alterados passam no ESLint; o lint global ainda contém problemas anteriores em outras partes do repositório.
- Tentativa de validação visual automatizada não completou: Chromium do ambiente encerrou com SIGSEGV. O código JavaScript das telas passou no teste de análise de sintaxe; a validação visual e a integração com Firebase real ainda devem ocorrer antes do uso definitivo.

## Atualização: internacionalização e teste local

- Traduções centralizadas em JSON, chaves em inglês, seleção de idioma e formatação de moeda/datas por locale. Guia: `INTERNACIONALIZACAO.md`.
- Produtos XLSX: simulação, substituição por catálogo versionado, preservação do catálogo anterior e estoque/custos por ID. Mudanças concorrentes do catálogo/estoque impedem a troca.
- Histórico: seleção independente de vendas ou entradas; saídas da aba ITENS nunca reconstruem vendas de produtos.
- Páginas carregam o catálogo efetivo; não misturam produtos de contingência ao catálogo importado.
- `npm run test:local`: banco persistente isolado, operadores de teste e integrações simuladas. Guia: `TESTE-LOCAL.md` e atalho `teste-local.bat`.
- Validação adicional: substituição/repetição de catálogo, uso do novo catálogo pelo ledger, persistência após reinício, autenticação HTTP, scripts de todas as páginas, idioma adicional e rejeição de tradução incompleta.
- Lint global aprovado nesta atualização. Conferência visual e integração com Firebase real continuam pendentes.
