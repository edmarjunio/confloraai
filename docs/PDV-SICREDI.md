# PDV: vendas, caixa, Sicredi e WhatsApp

## Confirmação do pedido no WhatsApp

`src/orders/customer-order-message.js` formata a mensagem inicial do cliente com a marca Conflora, número do pedido, cliente, itens em linhas compactas, total, forma de pagamento e agradecimento. A orientação varia entre espera do Pix, envio da maquininha e preparação de troco. Débito e crédito usam o rótulo Cartão. A mensagem inicial é usada na fila dos pedidos pendentes, incluindo pedidos web de dinheiro/cartão; o comprovante financeiro persistido e as confirmações de pagamento continuam separados. Para Pix, o código copia e cola acompanha a legenda da imagem do QR Code.

O formato usa `*texto*` para o negrito do WhatsApp. Envios como mensagens livres preservam as quebras de linha; o template genérico existente normaliza espaços nos parâmetros. Para reproduzir o layout integral fora da janela de atendimento, o template Utility aprovado na Meta também precisa ser compatível com o conteúdo desejado.

## Conta do cliente e pagamentos combinados

Clientes autenticados acessam **Minha conta**, com saldo devedor no botão do cabeçalho quando houver dívida. A tela reúne compras, datas de pagamento, fiados, quitações e crédito. O vínculo financeiro é resolvido no servidor pelo e-mail da sessão; identificadores de cliente enviados na requisição não selecionam a conta financeira.

`CustomerDebtPixService` cria cobranças parciais ou totais em `customer_debt_pix`, com txid de namespace exclusivo `DBT`. O cliente informa o valor até o limite da dívida atual e recebe QR Code/copia e cola. O navegador somente consulta o status: apenas o webhook autenticado e a consulta oficial `GET /pix/{endToEndId}` permitem confirmar. A transação grava quitação, novo saldo e notificações sem movimentar estoque nem gerar venda. Se outra quitação reduzir a dívida antes da confirmação, o excedente vira crédito e fica identificado no lançamento. O botão **Falar com a loja** abre o WhatsApp configurado para divergências.

No PDV, **Somente criar comanda e encaminhar ao caixa** deixa a venda em `AWAITING_CASHIER`, inclusive para intenção de Pix, sem emitir cobrança, reservar ou baixar estoque. O caixa escolhe a forma ao receber. `deferToCashier` faz parte da identificação idempotente da operação.

`paymentParts` armazena cada forma e valor. A soma em centavos precisa coincidir com o total, sem formas repetidas. Dinheiro, débito, crédito e fiado podem ser combinados; fiado exige cadastro. Pix pode ser combinado com esses meios e cobra apenas sua parcela. A parte não Pix é conferida pelo caixa, o Pix é validado pelo banco e o estoque é baixado uma única vez na conclusão. Vendedores encaminham pagamentos com parcelas não Pix ao caixa. Saldo antecipado do cliente pode ser combinado com meios manuais; sua combinação com Pix é recusada, pois exigiria reserva financeira adicional.

Se a parcela Pix vencer após recebimento de dinheiro/cartão, o estoque reservado é liberado e a comanda mantém os valores recebidos, marcada para conciliação/estorno; o dinheiro não é tratado como uma venda finalizada. Relatórios do caixa e executivos distribuem as parcelas por forma, mantendo uma única venda para o vendedor e atribuindo o recebimento ao caixa identificado.

O chat usa o mesmo renderer compacto do caixa. Ao listar produtos orienta o cliente a digitar um nome específico; após adicionar, oferece limpar a busca ou manter a seleção. Limpar a busca preserva a sacola.

## Arquitetura

A página `/pdv` (também `/caixa`) carrega os componentes React de `public/pdv/`. A estrutura visual existente foi preservada, sem a faixa de simulação, login automático, produtos fictícios ou carrinho preenchido. O catálogo é carregado do servidor e apresentado em lotes de 60 produtos.

`src/http/pdv.routes.js` controla autenticação e permissões. `src/orders/pdv.service.js` valida os dados e coordena o Sicredi e o WhatsApp. `src/orders/pdv.repository.js` grava as operações em transações do Firestore. O cliente Sicredi usa HTTPS nativo com certificado e chave privada, sem a opção `agent` incompatível com o `fetch` nativo.

O navegador envia IDs e quantidades. Preços são recalculados no servidor; cada linha é arredondada em centavos. `createdBy` vem da sessão, nunca do nome enviado pelo navegador. `receivedBy` vem da sessão do caixa ou do vendedor original quando o Pix é confirmado. A venda continua atribuída ao criador.

## Funcionamento

1. **VENDEDOR:** cria Pix ou comanda aguardando caixa. Não recebe dinheiro, cartão nem registra fiado diretamente. Tem acesso às próprias comandas e números.
2. **CAIXA/ADMIN:** podem criar e receber vendas. A tela “Comandas e meus números” também recebe comandas de outros vendedores, preservando a autoria. Dinheiro registra valor recebido e troco. Débito e crédito são distintos.
3. **Pix:** antes de emitir a cobrança, o servidor reserva as unidades disponíveis, inclusive com o controle legado de estoque desativado. Pedido, identificador e vencimento são persistidos antes de criar a cobrança imediata `PUT /cob/{txid}` no Sicredi. A cobrança usa o valor calculado no servidor (ou somente a parcela Pix) e `modalidadeAlteracao: 0`. O QR é enviado como imagem junto com o código copia e cola. Em produção, Cloud Tasks agenda a expiração com `TASK_SECRET`; falha no agendamento impede emitir a cobrança e libera a reserva.
4. **Confirmação:** o webhook autenticado inicia a conciliação. O servidor consulta `GET /pix/{endToEndId}` e verifica identificador, chave beneficiária, valor exato e ausência de devoluções. Caixa/Admin também podem confirmar Pix manualmente antes do vencimento, registrando comprovante conferido e justificativa. Em pagamento dividido, conferem a parcela Pix; o recibo identifica a confirmação manual. O botão de consulta apenas lê o status.
5. **Baixa:** recebimento, estoque, autoria, fiado e intenção de notificação são gravados juntos. Repetições não baixam estoque nem lançam dívida novamente. “CONFIRMED” mantém a compatibilidade com o catálogo; `completedAt` indica conclusão. Pix/cash/cartão usam `paymentStatus: APPROVED`; fiado usa `ON_ACCOUNT` e `paidAt: null`.
6. **Fiado:** exige cliente cadastrado. A quitação parcial ou total é registrada separadamente, com o recebedor, sem criar nova venda ou baixar estoque novamente. A interface de quitação aceita dinheiro, débito e crédito. Valores acima do saldo são recusados atomicamente.
7. **WhatsApp:** sem número, não há envio ao cliente. Números brasileiros são normalizados com 55 e DDD. Falhas ficam em `pdv_outbox`, com tentativas e última mensagem de erro. Eventos Pix recebidos ficam em `pdv_pix_events`, para reprocessamento se a consulta ao banco ou o estoque falhar. Mensagens à horta usam apenas `OWNER_WHATSAPP_NUMBER` configurado.
8. **Descontos:** acima de 5%, vendedores/caixas solicitam aprovação do administrador. A aprovação mantém o vendedor e exige recebimento posterior no caixa para formas não Pix.

O identificador da operação é reutilizado no navegador em tentativas com o mesmo conteúdo. Reutilizá-lo com dados diferentes é recusado. Após recarregar o navegador, consulte as comandas antes de refazer uma operação cujo resultado ficou incerto. Cancelamento, liberação da reserva e registro dos valores parciais recebidos para conciliação são gravados na mesma transação, inclusive em falha do agendamento. Confirmações manuais simultâneas não recriam mensagens já enviadas na fila.

## Configuração necessária para pagamentos reais

Não foram criadas cobranças reais, enviados WhatsApps reais nem publicado o projeto nesta alteração.

- Solicitar à cooperativa Sicredi a habilitação da API Pix Cobrança. No portal de desenvolvedores, cadastrar o app, enviar o CSR para assinatura e guardar em Secret Manager o certificado assinado, a chave privada e o Client ID/Secret. Configurar `SICREDI_CLIENT_ID`, `SICREDI_CLIENT_SECRET`, `SICREDI_CERT_PEM`, `SICREDI_KEY_PEM` e `SICREDI_PIX_KEY`; a chave Pix precisa pertencer à conta Sicredi e ser a mesma usada no webhook. Habilitar `cob.read`, `cob.write`, `pix.read`, `webhook.read` e `webhook.write`.
- O registro do webhook usa `PUT /api/v2/webhook/{chave}` com o campo JSON `webhookUrl` conforme o guia de início Sicredi. O endpoint de confirmação consulta a API do próprio Sicredi antes de aceitar a notificação.
- Definir `SERVICE_URL` como a URL HTTPS pública do serviço. Para callback com gateway mTLS, configure também `SICREDI_WEBHOOK_URL` como a URL HTTPS pública do gateway e um `SICREDI_WEBHOOK_GATEWAY_SECRET` aleatório (mínimo 32 caracteres); o gateway deve validar a cadeia completa de certificados Sicredi, remover headers externos com o mesmo nome e só então injetar esse segredo. Para callback direto, use `SICREDI_WEBHOOK_SECRET` com pelo menos 32 caracteres; o endpoint ainda exige HTTPS e a conciliação oficial do Pix. Rode `npm run check:sicredi` para conferir a presença dos campos; `npm run check:sicredi -- --connect` valida o OAuth sem criar cobrança. Depois de publicar a versão configurada, rode `npm run sicredi:webhook` para cadastrar o callback.
- A URL registrada usa `/webhooks/sicredi-pix/{segredo}` quando há segredo de rota, ou `/webhooks/sicredi-pix` atrás do gateway. Mesmo com essas proteções, o evento só confirma venda após consulta `GET /pix/{endToEndId}` e validação do txid, chave, valor exato e ausência de devoluções.
- Configurar `OWNER_WHATSAPP_NUMBER`, credenciais Meta e templates Utility aprovados. `WHATSAPP_PDV_TEXT_TEMPLATE` tem uma variável de corpo; `WHATSAPP_PDV_QR_TEMPLATE` tem header IMAGE e uma variável de corpo para a legenda. O texto pode usar o template existente `WHATSAPP_CUSTOMER_ORDER_TEMPLATE` como fallback. Sem templates, mensagens livres dependem da janela de atendimento da Meta; uma recusa fica registrada na fila, sem indicar envio bem-sucedido.
- Agendar chamada periódica a `POST /internal/pdv/retry-notifications` com `Authorization: Bearer <PDV_WORKER_SECRET>`. O processo também tenta a cada 30 segundos enquanto está ativo, mas esse timer não substitui um agendador em Cloud Run com escala a zero. O endpoint reprocessa eventos Pix e mensagens pendentes.
- Administradores consultam falhas em `GET /api/admin/pdv/pending-deliveries` e podem tentar novamente via `POST /api/admin/pdv/retry-notifications`.
- Homologar: cobrança, pagamento exato, callback repetido, cliente sem telefone, falha/reinício do worker e envio de template a cliente sem conversa ativa. Credenciais/certificados Sicredi estavam ausentes no ambiente revisado.

A baixa de estoque é exatamente uma vez por pedido. Mensagens externas têm entrega com tentativas: uma queda entre a aceitação da Meta e o registro local pode repetir uma mensagem. O status SENT significa aceitação da Meta, não leitura pelo destinatário. Falta de estoque mantém a conciliação pendente para correção; não se mascara uma falha de inventário como conclusão.

## Validação

- `npm run test:pdv`
- `npm run test:pix` (inclui catálogo/PDV Sicredi, integridade do estoque)
- `npx playwright test test/browser/pdv.spec.js` (pode usar `CHROMIUM_PATH` para o navegador instalado).
- Testes de transação usam um double que recusa leituras após escritas e simula falha de commit. Não substituem homologação no Firestore e Sicredi reais.

O teste da página inicial confirma que a faixa promocional de teste permanece removida, enquanto o campo de cupom da sacola continua disponível.

Referências: [Guia técnico Sicredi](https://developer.sicredi.com.br/api-portal/sites/default/files/Guia_tecnico_integracoes_APIPix_Sicredi_v1.9.5.pdf), seções de OAuth, cobrança e webhook; [exemplo oficial Meta de template com imagem](https://www.postman.com/meta/whatsapp-business-platform/request/n3jhmr4/create-template-w-image-header-text-body-text-footer-and-2-call-to-action-buttons).
