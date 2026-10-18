# Manual da equipe Conflora

Versão: 18/10/2026. Guia da versão preparada para operação com Pix manual. O catálogo antigo foi retirado para receber produtos e preços atualizados. A versão nova e a importação precisam estar publicadas antes de iniciar a operação descrita aqui.

## 1. Regras para toda a equipe

1. Abra o site da Conflora e entre com a sua própria conta. Colaboradores também podem entrar pela tela do Caixa selecionando o usuário e informando o PIN pessoal.
2. Confira seu nome e sua função no cabeçalho. Não registre vendas usando a conta de outra pessoa.
3. Clique no botão de menu de três linhas para escolher a página. Os atalhos disponíveis dependem da função.
4. Use o botão **Voltar** para retornar. Para trocar de área, abra novamente o menu.
5. Ao terminar o trabalho ou entregar o aparelho, clique em **Sair**, o botão vermelho.
6. Se uma operação demorar ou der erro, consulte **Comandas** ou o histórico antes de repetir. Não refaça a mesma venda sem conferir se ela já foi registrada.
7. Comprovante enviado, mensagem no WhatsApp e pedido criado não significam dinheiro recebido. No Pix manual, a confirmação é responsabilidade do Caixa ou Admin após conferir a conta bancária.

## 2. Funções e responsabilidades

| Função | Responsabilidade principal |
|---|---|
| Administrador / dono | Produtos, preços, estoque, equipe, aprovações, painel gerencial, fechamento e erros |
| Caixa | Conferir pedidos, receber pagamentos, validar Pix manual, receber dívidas e acompanhar suas operações |
| Vendedor | Montar a venda, identificar cliente, solicitar desconto quando necessário e encaminhar ao caixa |
| Entregador | Assumir a entrega, separar, registrar saída, atender o cliente e concluir sua rota |
| Cliente | Escolher produtos, informar retirada/entrega, pagar e enviar comprovante |

A função de estoque descrita adiante é uma responsabilidade atribuída pelo dono a uma conta com permissão administrativa. Não existe um cargo adicional “estoquista” separado no cadastro atual.

## 3. Administrador / dono

### 3.1 Preparar a equipe

1. Menu → **Equipe**.
2. Escolha **Novo Funcionário**.
3. Informe nome, e-mail, função e PIN pessoal. Cadastre o telefone quando o formulário disponibilizar esse campo; as notificações de entregador dependem de telefone válido no cadastro.
4. Salve e peça ao funcionário para entrar com a própria identificação.
5. Confira os atalhos e permissões com cada pessoa. Não distribua a conta Admin para toda a equipe.
6. Quando alguém sair da empresa, desative ou exclua seu acesso e confira o resultado na lista.

### 3.2 Importar os produtos atualizados pela planilha

1. Menu → **Produtos** → **Importar planilha de produtos**.
2. Clique em **Baixar modelo CSV**. O modelo contém somente o cabeçalho; nenhuma linha de demonstração será cadastrada como produto real.
3. Abra o arquivo no Excel e mantenha a coluna `codigo` como texto para preservar zeros à esquerda.
4. Preencha uma linha por produto. Não use fórmulas nas colunas numéricas; cole os valores finais.
5. Use as colunas abaixo, sem renomear os cabeçalhos do modelo.

| Coluna | Como preencher |
|---|---|
| `codigo` | Código único e estável do sistema atual. Até 64 letras/números, ponto, traço ou sublinhado |
| `nome` | Nome que o cliente e o caixa verão |
| `preco` | Preço de venda: por exemplo `4,50` ou `4.50`; maior que zero e sem separador de milhar |
| `categoria` | Grupo do produto, por exemplo Horta ou Plantas |
| `subcategoria` | Opcional |
| `unidade` | `UN` para unidade ou `KG` para quilograma |
| `estoque` | Quantidade atual conferida. UN usa inteiro; KG aceita até três casas decimais |
| `status` | `ATIVO` ou `INATIVO`; vazio significa ATIVO |

6. Salve como **CSV UTF-8**, preferencialmente separado por ponto e vírgula. O arquivo aceita até 2.000 produtos e 1 MB. Se ultrapassar, divida por grupos de produtos.
7. Selecione o arquivo no site e clique em **Validar e mostrar prévia**. Esta etapa não cadastra produtos.
8. Confira o total e os primeiros 20 produtos mostrados: nome, preço, unidade e estoque. Se houver erro, corrija a planilha e envie novamente.
9. Clique em **Confirmar importação** somente quando a prévia estiver correta. Aguarde a mensagem final.
10. Feche a janela e confira a lista de produtos. Abra o catálogo e o Caixa para verificar os valores antes da primeira venda.

A importação cria novos produtos. Ela não substitui o estoque de códigos já cadastrados por outra importação. Para corrigir preço ou estoque depois de começar a vender, use as telas do sistema. Se houver interrupção após salvar parte dos lotes, reenvie exatamente o mesmo arquivo: os lotes concluídos não serão duplicados nem terão seu estoque restaurado para o valor inicial.

### 3.3 Cadastrar ou corrigir um produto individualmente

1. Menu → **Produtos**.
2. Abra o cadastro do produto ou a opção de novo produto.
3. Confira nome, categoria, unidade e preço. Para KG, o preço é por quilograma.
4. Adicione fotos reais e as informações do produto quando disponíveis.
5. Salve e confira a lista. Para retirar um produto temporariamente da venda, marque-o como INATIVO.
6. Faça movimentações de estoque na tela de estoque, com motivo, em vez de alterar o saldo sem registro durante a operação.

### 3.4 Aprovar descontos e fiado

1. Confira a notificação ou a comanda aguardando aprovação.
2. Verifique cliente, produtos, valor original, desconto e responsável pela venda.
3. Descontos acima de 5% solicitados por Caixa/Vendedor dependem da aprovação administrativa.
4. Aprove quando autorizado. Se recusar desconto, informe o motivo.
5. No fiado, confira o cliente cadastrado e a política da empresa. Aprovar fiado registra dívida; não é recebimento de dinheiro.
6. Oriente o caixa a concluir as parcelas de pagamento aplicáveis. Não aprove novamente uma operação cujo resultado já consta na comanda.

### 3.5 Acompanhar os números da empresa

1. Menu → **Painel Gerencial**.
2. Selecione o período desejado: semana, mês ou ano, conforme os filtros da tela.
3. Compare vendas e recebimentos. Uma venda feita num mês e paga no seguinte aparece no recebimento do mês do pagamento.
4. Confira os produtos que mais e menos vendem em quantidade e valor e os líderes mensais.
5. Separe KG de UN ao analisar quantidades; quilogramas e unidades não são medidas equivalentes.
6. Produto sem venda pode estar sem estoque. Não use faturamento como se fosse lucro; custo e margem só podem ser analisados quando esses dados estiverem registrados.

### 3.6 Conferir e fechar o caixa

1. Confira a data e o período do relatório.
2. Compare os valores registrados em dinheiro, Pix e cartões com o dinheiro físico, o extrato bancário e os comprovantes das máquinas.
3. Confira as quitações de fiado e os créditos usados separadamente das novas vendas.
4. Resolva as divergências com o operador antes do fechamento. Não altere venda antiga somente para fazer o total bater.
5. Baixe o PDF para conferir os detalhes. A ação de fechar o dia está disponível para Admin na área gerencial de fechamento.
6. Execute o fechamento uma vez e aguarde a confirmação. Em caso de demora, consulte o estado antes de criar outro fechamento.
7. O relatório é colocado na fila para o WhatsApp do Júnior. Ausência de mensagem não autoriza fechar novamente; consulte o sistema.

### 3.7 Acompanhar erros

1. Menu → **Sistema e erros**.
2. Clique em **Atualizar histórico**.
3. Abra o registro e anote horário, operação e identificador da requisição, quando disponível.
4. Informe ao suporte o que estava sendo feito, sem compartilhar PIN, senha, token, chave privada ou comprovante de cliente em grupo público.
5. Se o próprio site estiver indisponível, use o link de logs do Google Cloud com a conta autorizada do dono.

## 4. Caixa

### 4.1 Iniciar o atendimento e registrar venda presencial

1. Entre com sua conta e abra **Caixa**.
2. Busque o produto e adicione à sacola. Confira preço, quantidade e unidade.
3. Em produto KG, informe o peso medido e confira o total calculado.
4. Se necessário, selecione ou cadastre o cliente. Fiado e uso de crédito exigem cliente cadastrado.
5. Escolha retirada/balcão ou entrega. Para entrega, confira nome, telefone com DDD e endereço completo.
6. Use **Pagar / F1** e selecione a forma de pagamento.
7. Dinheiro: informe o valor recebido e confira o troco. Cartão: só confirme depois da aprovação na máquina.
8. Se houver mais de uma forma, distribua os valores e confira que a soma é exatamente o total. Uma parcela fiada gera dívida, não recebimento.
9. Conclua e confira o recibo. Para outro atendimento, use **Nova venda** ou **Voltar ao caixa**, conforme a situação exibida.

### 4.2 Receber Pix manual de pedido criado no site

1. Abra **Comandas / F2** e localize o pedido pelo cliente ou identificador.
2. Abra os detalhes e confira o total e o estado do pagamento.
3. O cliente copia a chave e envia o comprovante pelo acompanhamento do pedido.
4. Quando aparecer comprovante aguardando conferência, clique em **Ver comprovante enviado pelo cliente**.
5. No aplicativo/extrato bancário da empresa, confira o crédito efetivo, o valor, o titular recebedor e se a operação não está apenas agendada.
6. Marque **Conferi o recebimento na conta bancária e o valor da parcela Pix**.
7. Registre uma observação e clique em **Confirmar recebimento Pix**.
8. Confira que a comanda foi confirmada. O sistema registra o recebimento e a baixa de estoque sem repeti-los por novo clique.
9. Se o comprovante estiver errado, registre o motivo e use **Recusar comprovante**. O pedido continua pendente e o cliente pode reenviar.

Não confirme pela foto do comprovante isoladamente. A conferência deve ser na conta da empresa. Em pagamento dividido, confira o valor da parcela Pix, que pode ser menor que o total da venda.

### 4.3 Receber Pix manual de venda no balcão

1. Escolha Pix no Caixa e registre o pedido pendente.
2. Mostre a chave Pix da loja e informe o beneficiário ao cliente.
3. Abra a comanda para conferir o pagamento.
4. Confira o crédito bancário e anexe a foto ou PDF do comprovante no recebimento manual quando ele não tiver sido enviado pelo cliente.
5. Marque a conferência, informe a observação e confirme o pagamento.
6. Se o pagamento não entrou, mantenha pendente. Não registre como dinheiro ou cartão para contornar o Pix.

### 4.4 Atender pedidos do catálogo e comandas do vendedor

1. Abra **Comandas** e confira as etapas: esperando confirmação, esperando pagamento, entregas e concluídos.
2. Abra cada pedido e confira produtos, quantidades, cliente e forma de pagamento.
3. Avance a confirmação quando o pedido puder ser atendido. Fiado pendente precisa da aprovação do Admin.
4. Registre os recebimentos. Comprovante enviado não muda a responsabilidade de conferir o banco.
5. Entrega Pix pendente não deve ser liberada como paga. Para pedidos já pagos, organize a separação e a liberação conforme a etapa exibida.
6. Consulte o histórico antes de refazer pedido que possa já existir.

### 4.5 Receber dívida ou registrar crédito do cliente

1. No relatório do Caixa, escolha **Receber pagamento**.
2. Busque o cliente e confirme seu cadastro e saldo.
3. Escolha quitação de fiado ou crédito antecipado, conforme a situação real.
4. Informe o valor e a forma de pagamento. Para Pix, anexe comprovante, confira a conta e registre observação.
5. Confirme e confira o novo saldo e o recibo. É possível receber uma parte da dívida e depois o restante.
6. Não use venda nova fictícia para quitar dívida antiga.

### 4.6 Relatório, correção e fim do turno

1. Abra **Relatório / F3** e escolha o período.
2. Confira suas vendas, recebimentos e quitações. O Admin pode ver o conjunto da loja.
3. Baixe o PDF quando necessário. O fechamento diário definitivo é responsabilidade do Admin.
4. Se houver erro numa venda, comunique o responsável e use a solicitação de correção disponível na área de vendas, com o motivo real.
5. Em Pix já emitido ou recebido, não apague o registro para esconder divergência; encaminhe para conciliação pelo Admin.
6. Entregue os valores e pendências ao responsável e clique em **Sair**.

## 5. Vendedor

1. Entre com a sua conta → **Caixa**.
2. Identifique o cliente e monte a sacola com os produtos e quantidades corretos.
3. Confira UN ou KG, preço e valor final com o cliente.
4. Se houver entrega, preencha telefone, endereço e referência; confirme o ponto do mapa quando disponível.
5. Aplique apenas o desconto autorizado. Acima de 5%, envie a solicitação e aguarde o Admin.
6. Para fiado, selecione cliente cadastrado e aguarde aprovação administrativa.
7. Encaminhe a comanda ao caixa. Informe ao cliente o identificador do pedido para evitar cadastro duplicado.
8. Consulte suas comandas e acompanhe a etapa. No Pix manual, o Caixa/Admin confirma o recebimento.
9. Se houver divergência de preço, estoque ou pagamento, pare a conclusão e chame o responsável. Não troque a forma de pagamento para forçar a finalização.
10. Ao sair do posto, use **Sair**.

## 6. Entregador

### 6.1 Assumir e separar

1. Entre com sua conta → **Entregas**.
2. Confira os pedidos disponíveis. Uma notificação no WhatsApp é um aviso; a situação válida é a que aparece no sistema.
3. Abra o pedido, confira produtos, endereço, telefone e situação do pagamento.
4. Clique em **Assumir e separar pedido**. A entrega fica vinculada ao responsável; dois entregadores não devem assumir a mesma saída.
5. Separe e confira os itens. Se não puder atender, use **Devolver à fila de entregas** e avise o responsável.

### 6.2 Sair e concluir

1. Quando estiver saindo, clique em **Saí da horta · iniciar entrega**.
2. Use **Abrir no Google Maps** ou **Abrir no Waze**. Se necessário, use o telefone do cliente para esclarecer endereço.
3. Entrega paga: confira a identificação e entregue os produtos. Não cobre novamente.
4. Entrega a receber: registre apenas os valores realmente recebidos, conforme as opções permitidas para sua entrega. Em dinheiro, confira o troco; em cartão, a aprovação da máquina.
5. Se o cliente optar por Pix manual, peça a conferência ao Caixa/Admin; o entregador não aprova o Pix manual dessa nova modalidade.
6. Informe os quilômetros percorridos, se estiver usando esse controle.
7. Clique em **Confirmar entrega** quando o pedido estiver entregue e a situação financeira permitir a conclusão.
8. Em endereço incorreto, recusa ou pagamento não recebido, não marque entrega concluída. Contate o caixa/administrador e registre a orientação no processo da empresa.

Somente o responsável pela rota ou Admin pode executar as alterações permitidas daquela entrega. Não use a conta de outro entregador.

## 7. Responsável por estoque, produtos e preços

1. Entre com a conta administrativa autorizada → **Estoque**.
2. Confira o produto e sua unidade antes de registrar movimentação.
3. Entrada de mercadoria: informe a quantidade efetivamente recebida e o motivo.
4. Saída extraordinária, perda ou descarte: registre a quantidade e a justificativa. Não registre venda fictícia para corrigir saldo.
5. Contagem física: conte o saldo real e use a função de contagem. Contagem substitui o saldo pela quantidade informada; não é uma entrada adicional.
6. Confira o saldo final e o histórico. Se a operação demorar, confira antes de repetir.
7. Produto fora de linha: marque INATIVO em **Produtos**. Produto sem estoque deve ter saldo correto; a política de controle de estoque é definida pelo Admin.
8. Mudança de preço: altere o cadastro e confira catálogo e Caixa. Não reimporte o estoque inicial depois que as vendas começaram.

## 8. Orientação para passar ao cliente

1. Escolha os produtos no site e confira a sacola.
2. Informe nome e telefone. Escolha retirada ou entrega e preencha os dados solicitados.
3. Revise o total e a forma de pagamento antes de enviar o pedido.
4. Para Pix manual, copie a chave, confira o beneficiário e pague no aplicativo do banco.
5. Envie a foto ou PDF do comprovante no acompanhamento do pedido. Guarde o link para consultar depois; ele é privado e não deve ser publicado.
6. Aguarde a conferência da loja. Se o comprovante for recusado, leia o motivo e envie o arquivo correto.
7. Cliente com conta pode consultar compras e saldo em **Minha conta**. Para quitar dívida neste momento, deve falar com a loja e aguardar o registro pelo caixa.

## 9. Atalhos do Caixa

| Atalho | Ação |
|---|---|
| F1 | Pagamento |
| F2 | Comandas |
| F3 | Relatório |
| F4 | Desconto |
| F8 | Entrega |
| F9 | Histórico |

As mesmas ações podem ser abertas pelos botões na tela. No celular, use os botões.

## 10. Se algo der errado

| Situação | Como agir |
|---|---|
| Internet caiu ou tela travou após confirmar | Reconecte e consulte a comanda antes de repetir |
| Cliente diz que pagou, mas valor não aparece no banco | Mantenha pendente e peça conferência ao Caixa/Admin |
| Comprovante incorreto | Recuse com motivo e peça reenvio |
| Venda ou recebimento possivelmente duplicado | Pare e peça revisão ao Admin; não apague registros por conta própria |
| Produto/preço/estoque errado | Avise o responsável e corrija no cadastro ou movimentação apropriada |
| WhatsApp não chegou | Consulte o pedido no site; ausência de mensagem não significa falha na gravação |
| Erro inesperado | Anote horário e operação; Admin consulta Sistema e erros |
| Entrega não pode ser feita | Não conclua; informe o responsável para decidir o próximo passo |

## 11. Quando o Sicredi automático for ativado

Após a homologação e ativação pelo responsável técnico, os novos pedidos poderão mostrar QR Code e Pix copia e cola e receber confirmação automática após validação com o banco. Até lá, siga o procedimento manual deste guia. Pedidos antigos manuais continuam exigindo conferência; não se tornam automáticos apenas porque a configuração mudou.

## 12. Roteiro de treinamento da equipe

1. Admin importa e confere os produtos e preços atualizados.
2. Cada pessoa entra com sua própria função e confere seus atalhos.
3. Vendedor monta uma comanda e a encaminha ao Caixa.
4. Caixa confere um pagamento e o recibo; no Pix, confere o crédito bancário e o comprovante.
5. Entregador assume, registra a saída e conclui uma entrega autorizada.
6. Admin confere o relatório e ensina onde consultar erros.
7. O responsável define quem pode conceder desconto, aprovar fiado, conciliar divergências e fechar o dia.

Para treinamento com dinheiro ou mercadoria real, combine antes os valores, o produto e os responsáveis. Não crie recebimentos fictícios no caixa real.
