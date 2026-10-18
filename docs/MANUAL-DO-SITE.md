# Manual do site — Conflora Horta e Viveiro

Versão de operação: 17/10/2026. Catálogo, caixa, administração e entregas.

## 1. Antes de começar o dia

1. Abra o site e entre com sua própria conta. A equipe também pode entrar pelo PIN cadastrado.
2. Confira seu nome e cargo no topo. Não compartilhe a conta de outro colaborador: ela identifica vendas, recebimentos e entregas.
3. O administrador deve conferir preços, produtos ativos, contatos e a opção de controle de estoque.
4. Abra o caixa e consulte as comandas pendentes. O quadro atualiza automaticamente enquanto houver conexão.
5. Confira as integrações em Admin → Teste de conexões/servidor. Uma configuração preenchida não comprova pagamento ou mensagem entregue.

**Para começar antes da contagem:** Admin → Estoque → Desativar estoque. Novas vendas podem ser feitas sem saldo cadastrado. O sistema continua registrando os pedidos e pagamentos. Reservas anteriores continuam protegidas; mudar essa opção não apaga compromissos já assumidos.

**Para controlar quantidades:** faça a contagem física e use o ajuste de contagem para informar o saldo real. Depois ative o estoque. Entrada soma, baixa subtrai com justificativa, contagem substitui o saldo pela quantidade informada.

## 2. O que cada pessoa pode fazer

| Perfil | Uso principal |
| --- | --- |
| Cliente | Consultar catálogo, montar sacola, comprar, acompanhar histórico, saldo e fiados da própria conta. |
| Vendedor | Criar comandas e consultar suas vendas. Pode confirmar Pix manual de uma comanda própria com comprovante; recebimentos em dinheiro/cartão ficam com caixa/admin. Pix emitido com parcelas de outros meios também fica com caixa/admin. |
| Caixa | Receber comandas, selecionar pagamentos, conferir Pix manual e registrar recebimentos de clientes. |
| Admin | Administrar equipe, catálogo, estoque e relatórios; aprovar fiado e operações que exigem autorização. |
| Entregador | Ver o quadro da equipe, assumir pedidos, separar, sair em rota e receber/concluir suas entregas. Pode visitar o catálogo como cliente. Não cria vendas de caixa. |

O nome do vendedor continua associado à venda. O recebimento e a entrega registram quem realizou cada ação. A entrega não transfere a autoria da venda para o entregador.

## 3. Comprar pelo catálogo

1. Pesquise pelo nome ou escolha uma categoria. O botão de informação mostra os detalhes do produto.
2. Toque em Adicionar. Produtos configurados por KG pedem o peso; confira a unidade e a quantidade.
3. Abra a Sacola e revise itens, quantidades e valores.
4. Escolha retirada ou entrega. Para entrega, preencha nome, WhatsApp com DDD e endereço completo; informe número/complemento e referência.
5. Quando o mapa estiver disponível, use a busca de endereço ou o GPS e ajuste o pino no local de chegada. Confira o endereço textual mesmo usando GPS.
6. Escolha Pix, dinheiro com troco, crédito, débito ou fiado sujeito à aprovação do admin.
7. Finalize uma vez e acompanhe o estado do pedido. Um pedido aguardando pagamento ainda não é uma venda paga.

CPF é opcional. O e-mail do cliente vem do login; o caixa pode cadastrar uma venda sem e-mail. Nome, telefone e endereço de entrega devem estar corretos para permitir contato e localização.

O histórico fica em Minha conta. Abra uma compra para ver seu recibo. O saldo distingue dívida de crédito disponível. As compras e dados de uma conta não devem ser usados por outra; cada aba mantém a sessão e sacola correspondentes.

## 4. Venda no caixa

1. Entre em Ir para o caixa.
2. Busque e adicione produtos, ajustando unidade, peso e quantidade.
3. Escolha Balcão ou Entrega. Entrega abre o cadastro/seleção do cliente.
4. Use Buscar cliente e digite ao menos quatro letras. Selecione um cadastro existente para completar os dados. Para pessoa nova, informe os dados e use Adicionar cliente.
5. Revise descontos, frete e total. Descontos que excedam a permissão do operador aguardam aprovação.
6. Abra o pagamento e toque no botão da forma recebida. Para dividir, informe cada parcela; a soma deve corresponder ao total.
7. Em dinheiro, informe o valor entregue para calcular o troco. Em cartão, confirme o recebimento efetivo na maquininha antes de finalizar.
8. Confira o recibo e a indicação de pagamento concluído.

O vendedor pode lançar a comanda para recebimento no caixa. Selecionar uma intenção de pagamento não significa que o dinheiro já foi recebido.

**Relatório a qualquer hora:** em Caixa/Vendas ou Caixa → Relatório, use **Baixar PDF** ou **Enviar PDF no WhatsApp**. O Admin recebe o caixa geral da loja; o Caixa recebe somente os valores atribuídos ao seu caixa. O PDF é uma posição parcial até a emissão e não encerra o caixa. O envio vai ao WhatsApp da loja configurado no sistema. Para enviar automaticamente fora da janela de atendimento do WhatsApp, é necessário o modelo de documento aprovado na Meta, descrito no README.

## 5. Comandas

| Coluna | Significado e ação |
| --- | --- |
| Esperando confirmação — amarelo | Pendência de autorização/confirmação. Fiado exige admin. |
| Esperando pagamento — azul | Venda lançada, ainda não recebida. Abra o cartão, confira o recibo e registre o pagamento. |
| Pagos/finalizados — verde | Recebimento concluído. Consulte o recibo e o responsável. |
| Fiados — vermelho | Venda autorizada a prazo, ainda com dívida. Não confundir com dinheiro recebido. |

O arraste permite confirmação → pagamento e pagamento → pago. O segundo movimento abre o diálogo de recebimento; arrastar sozinho não comprova pagamento. As demais mudanças não são permitidas pelo arraste.

Os cartões mostram o responsável pela entrega quando atribuído. Novas comandas recebem destaque e aparecem automaticamente. Se perder conexão, confira a atualização da tela antes de repetir uma operação.

## 6. Pix automático Sicredi

1. A loja cria uma cobrança vinculada ao pedido, com identificador único, valor fixo e prazo de validade.
2. O cliente usa o QR Code ou Pix copia e cola. O valor solicitado na cobrança não pode ser editado pelo pagador.
3. Com estoque ativo, a quantidade fica reservada. Reservar reduz o disponível para outras vendas, mas não reduz o saldo físico.
4. A notificação bancária provoca uma consulta ao Sicredi. O sistema verifica identificador, valor, chave e situação do recebimento.
5. Confirmado o pagamento, a transação registra a venda paga e baixa o estoque uma única vez. Uma entrega paga ainda precisa ser separada e entregue.
6. Sem pagamento até o prazo, o pedido é cancelado e a reserva é liberada. A liberação não é uma entrada adicional no estoque.

**Se o pagamento chegar depois do cancelamento:** o sistema registra necessidade de conciliação. O administrador deve conferir a conta e decidir uma nova venda ou devolução. Não prometa o item se ele já foi vendido.

**Se faltar estoque na confirmação:** o sistema bloqueia a baixa e a finalização. O pagamento bancário pode já existir, portanto o admin precisa verificar a conta e resolver a divergência; não peça um segundo pagamento. Corrija apenas o saldo comprovado pela contagem física ou providencie a conciliação/devolução.

O fluxo automático depende da autorização bancária e das credenciais válidas. Sem isso, não trate um QR exibido, uma imagem ou a intenção de pagamento como aprovação bancária.

## 7. Pix manual com comprovante

Use quando o cliente transferiu diretamente ou a confirmação automática ainda não chegou.

1. Abra a comanda correta e confira valor e cliente.
2. Escolha Pix manual/confirmar manualmente, conforme a tela.
3. Anexe foto JPG, PNG, WebP ou PDF, até 3 MB.
4. Confira o valor e a conta recebedora; registre uma observação com pelo menos oito caracteres e marque a conferência.
5. Confirme uma vez e veja o estado pago.

Caixa/admin usam as comandas permitidas ao seu perfil. O vendedor usa somente suas próprias comandas; não recebe parcelas de dinheiro/cartão por esse atalho. O entregador recebe apenas o pedido que assumiu e cuja saída já registrou. O arquivo fica vinculado ao pedido e ao colaborador que enviou.

**A conferência humana não autentica automaticamente uma imagem de comprovante.** Confira o crédito na conta quando houver dúvida. A confirmação manual registra a responsabilidade do operador e encerra a necessidade de novas consultas desse pedido pelo fluxo automático. Ela não cancela uma transferência bancária que já esteja em trânsito.

## 8. Entregas

1. Abra `/caixa` com a conta de entregador. O quadro mostra as entregas da equipe.
2. Em Aguardando entregador, abra o recibo e use Assumir e separar pedido.
3. O pedido passa a Pedidos em separação, com a identificação do entregador. Separe os produtos conforme o recibo.
4. Ao sair de fato, toque em Saí da horta · iniciar entrega. O pedido passa a Em rota e o sistema registra o horário; a fila do WhatsApp recebe o aviso de saída.
5. Use o mapa, Abrir no Waze ou Abrir no Google Maps. Confirme o pino e o endereço antes de dirigir.
6. Pedido já pago: entregue e confirme a entrega. Não cobre novamente.
7. Pagamento na entrega: receba, selecione dinheiro/crédito/débito/Pix e finalize. Pix manual exige comprovante; Pix automático precisa da confirmação bancária.
8. Se souber a distância efetivamente percorrida, informe os quilômetros ao finalizar. O pedido vai para Pedidos finalizados/entregue.

Somente o responsável ou admin altera uma entrega atribuída. Dois entregadores não podem assumir o mesmo pedido ao mesmo tempo. Um entregador pode consultar o estado da equipe, mas não receber pelo pedido de outro.

O tempo de separação é distinto do tempo desde a saída. As médias por km distinguem quilômetros informados de distância estimada pelo mapa. Não há medição contínua de GPS ou odômetro; o retorno à horta não está incluído. Registros antigos sem horário real de saída não entram como duração exata.

## 9. Estoque: reserva, baixa e falta de produto

**Entrada e conferência por toque:**

1. Abra **Admin → Estoque** e busque o produto pelo nome ou categoria.
2. O modo inicial é **Conferir o que tenho**. Digite 100 para deixar o saldo em exatamente 100, mesmo se o saldo anterior era negativo. Use **Receber produtos** para somar novas unidades ao saldo. Use **Conferir o que tenho** para contar do zero e substituir o saldo pela quantidade física encontrada.
3. Cada toque na foto, no nome ou em **Contar 1 unidade** soma uma unidade à contagem. Para KG, cada toque soma 1 kg; você pode digitar o peso com até três casas decimais.
4. Confira o número destacado. Use **Desfazer último toque** para corrigir um engano ou **Recomeçar este produto** para zerar o rascunho. Na conferência, digite **0** para registrar um produto esgotado.
5. Não encontrou o produto? Use **Cadastrar este produto**. O nome pesquisado vem preenchido e, após salvar, você volta ao estoque com os outros produtos contados preservados.
6. Clique em **Salvar entradas** ou **Concluir conferência**. Até esse momento, o saldo oficial não foi alterado. Somente produtos contados serão ajustados; os demais ficam como estavam.

O rascunho é guardado por operador nesta aba e sobrevive a uma atualização da página. Se houver falha ao salvar, tente novamente: a mesma movimentação não será registrada duas vezes. Caso uma venda ou outra movimentação altere o saldo durante a conferência, atualize a tela, use **Recomeçar este produto** e conte novamente. O sistema bloqueia ajustes abaixo das quantidades reservadas para pedidos.

Exemplo: saldo físico 10 e reserva 2 → disponível para novas vendas 8. Quando a venda é paga, o físico passa a 8 e a reserva volta a zero. Se cancelar antes de pagar, o físico continua 10 e a reserva volta a zero.

Separar ou sair em rota não significa receber dinheiro. Para pedidos ainda não pagos, mantenha o item reservado. Venda já paga baixa antes da entrega e não baixa novamente ao concluir a entrega.

**Fiado — regra confirmada pelo proprietário:** a aprovação do admin registra a dívida e baixa o estoque, porque a venda foi autorizada a prazo. A quitação posterior não baixa novamente.

Não ajuste uma contagem abaixo de compromissos reservados sem resolver a divergência. Em caso de avaria ou item faltando na separação, avise o admin e confira o pedido antes de cobrar/concluir. Desativar estoque não é uma forma de apagar reservas antigas.

## 10. Fiados, recebimentos e créditos

1. Use um cliente cadastrado para lançar fiado.
2. O admin aprova a venda a prazo. Ela fica identificada como fiado, sem ser apresentada como dinheiro recebido.
3. No atendimento financeiro do cliente, registre o recebimento da dívida e selecione a forma real de pagamento.
4. Recebimentos podem ser parciais ou divididos. Uma dívida de R$ 200 com recebimento de R$ 100 mantém R$ 100 pendentes.
5. Confira o novo saldo. Valores pagos antecipadamente são crédito do cliente e devem ser registrados nessa modalidade.

Não lance uma nova venda para dar baixa em uma dívida antiga: isso duplicaria o faturamento operacional. Use o recebimento do cliente.

## 11. WhatsApp

O sistema usa uma fila para enviar recibos, QR/copia e cola e aviso de saída. Falha de mensagem não desfaz a venda. A fila tenta novamente com intervalos progressivos e mantém o progresso do texto e QR já enviados.

Forneça um WhatsApp válido com DDD. Sem telefone, não há destinatário para o recibo. Token inválido, modelo não aprovado, permissões ausentes e indisponibilidade da Meta podem impedir o envio.

Um identificador de mensagem retornado pela Meta confirma a aceitação da requisição; não comprova leitura pelo cliente. Em uma falha de rede após a Meta aceitar o envio, pode haver reenvio: não existe garantia absoluta de entrega única entre serviços externos.

Pedidos cancelados não devem receber QR atrasado pela fila. Avisos de saída pendentes são descartados quando o pedido já não está em rota.

## 12. Administração e acompanhamento

- Caixa/Vendas: acompanhe vendas e recebimentos, diferenciando vendedor, recebedor e entregador.
- Comandas: acompanhe pendências operacionais.
- Estoque: entrada, baixa justificada, contagem e ativação do controle.
- Produtos: cadastre/edite nome, preço, unidade, categoria, imagem e informações. Revise KG versus unidade antes de vender.
- Equipe: cadastre usuários, cargos e PINs individuais.
- Teste de conexões/servidor: confira integrações e pendências de configuração.
- Eventos: consulte os dados disponíveis da integração analítica. Ausência de dados/configuração não representa ausência de visitantes.

Ao comparar relatórios, use o mesmo período e diferencie venda, recebimento de venda, quitação de dívida e crédito antecipado. O dinheiro recebido pelo entregador não altera o autor original da venda.

## 13. Ativação real do Sicredi e WhatsApp

1. Solicite adesão à API Pix e acesso para integração própria à cooperativa.
2. Obtenha certificado, chave privada, Client ID e Client Secret no processo indicado pelo Sicredi. Solicite o ambiente de homologação e seus endereços.
3. Configure os campos Sicredi do ambiente do servidor, inclusive a chave Pix e a proteção do webhook. Configure também os segredos dos workers e Cloud Tasks.
4. Publique o backend HTTPS e configure o webhook conforme a exigência de segurança do banco. Configure certificado cliente/gateway quando exigido.
5. Valide autenticação e faça a homologação de cobrança, pagamento, notificação, consulta, vencimento e repetição do evento.
6. Configure WhatsApp com token válido, número remetente, segredo do aplicativo e modelos aprovados para mensagens fora da janela de atendimento.
7. Faça uma venda controlada: confira extrato, valor, recibo, QR/copia e cola, uma única baixa, aviso de saída e conclusão da entrega.

Referência: [guia oficial Sicredi](https://developers.sicredi.com.br/public/docs/getting-started-pix). A conta/chave usada precisa ser aceita no contrato de API da cooperativa. Não presuma que apenas cadastrar uma chave Pix libera a integração.

## 14. Problemas frequentes

| Situação | Ação |
| --- | --- |
| WhatsApp: HTTP 401 / código 190 | Renovar o token, atualizar o ambiente e reiniciar. Verificar permissões e modelos. |
| Pix pago, pedido pendente | Conferir conta, identificador e fila de eventos. Usar confirmação manual com comprovante quando autorizado. Não cobrar novamente. |
| Estoque insuficiente | Conferir físico, reservas e outras vendas. Não inventar saldo para forçar recebimento. |
| Pedido sumiu após vencimento | Consultar histórico/cancelamento. A reserva pode ter sido liberada; verificar antes de recriar. |
| Mapa não aparece | Conferir chave, APIs, restrição de domínio e carregamento. Endereço textual continua essencial. |
| Tela desatualizada | Conferir conexão e recarregar. Após publicação, aguardar atualização dos arquivos do site. |
| Outro nome no topo | Trocar para a conta correta antes de operar. Conferir a sessão daquela aba. |

Este manual descreve a versão revisada do código. A publicação e a homologação externa precisam ocorrer para confirmar o comportamento no ambiente real.
