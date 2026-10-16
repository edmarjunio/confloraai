# PDV: vendas, caixa, Sicredi e WhatsApp

## Arquitetura

A página `/pdv` (também `/caixa`) carrega os componentes React de `public/pdv/`. A estrutura visual existente foi preservada, sem a faixa de simulação, login automático, produtos fictícios ou carrinho preenchido. O catálogo é carregado do servidor e apresentado em lotes de 60 produtos.

`src/http/pdv.routes.js` controla autenticação e permissões. `src/orders/pdv.service.js` valida os dados e coordena o Sicredi e o WhatsApp. `src/orders/pdv.repository.js` grava as operações em transações do Firestore. O cliente Sicredi usa HTTPS nativo com certificado e chave privada, sem a opção `agent` incompatível com o `fetch` nativo.

O navegador envia IDs e quantidades. Preços são recalculados no servidor; cada linha é arredondada em centavos. `createdBy` vem da sessão, nunca do nome enviado pelo navegador. `receivedBy` vem da sessão do caixa ou do vendedor original quando o Pix é confirmado. A venda continua atribuída ao criador.

## Funcionamento

1. **VENDEDOR:** cria Pix ou comanda aguardando caixa. Não recebe dinheiro, cartão nem registra fiado diretamente. Tem acesso às próprias comandas e números.
2. **CAIXA/ADMIN:** podem criar e receber vendas. A tela “Comandas e meus números” também recebe comandas de outros vendedores, preservando a autoria. Dinheiro registra valor recebido e troco. Débito e crédito são distintos.
3. **Pix:** o pedido e seu identificador são persistidos antes de criar a cobrança imediata `PUT /cob/{txid}` no Sicredi. A cobrança usa o valor calculado no servidor e `modalidadeAlteracao: 0`; o QR Code e o Pix Copia e Cola retornados pelo Sicredi não permitem ajustar o valor. O QR é enviado como imagem junto com o recibo.
4. **Confirmação:** somente o webhook autenticado inicia a conciliação. O servidor consulta `GET /pix/{endToEndId}` na API Sicredi e verifica identificador do pedido, chave beneficiária, valor exato e ausência de devoluções. O botão de consulta apenas lê o status do pedido, sem confirmar manualmente.
5. **Baixa:** recebimento, estoque, autoria, fiado e intenção de notificação são gravados juntos. Repetições não baixam estoque nem lançam dívida novamente. “CONFIRMED” mantém a compatibilidade com o catálogo; `completedAt` indica conclusão. Pix/cash/cartão usam `paymentStatus: APPROVED`; fiado usa `ON_ACCOUNT` e `paidAt: null`.
6. **Fiado:** exige cliente cadastrado. A quitação parcial ou total é registrada separadamente, com o recebedor, sem criar nova venda ou baixar estoque novamente. A interface de quitação aceita dinheiro, débito e crédito. Valores acima do saldo são recusados atomicamente.
7. **WhatsApp:** sem número, não há envio ao cliente. Números brasileiros são normalizados com 55 e DDD. Falhas ficam em `pdv_outbox`, com tentativas e última mensagem de erro. Eventos Pix recebidos ficam em `pdv_pix_events`, para reprocessamento se a consulta ao banco ou o estoque falhar. Mensagens à horta usam apenas `OWNER_WHATSAPP_NUMBER` configurado.
8. **Descontos:** acima de 5%, vendedores/caixas solicitam aprovação do administrador. A aprovação mantém o vendedor e exige recebimento posterior no caixa para formas não Pix.

O identificador da operação é reutilizado no navegador em tentativas com o mesmo conteúdo. Reutilizá-lo com dados diferentes é recusado. Após recarregar o navegador, consulte as comandas antes de refazer uma operação cujo resultado ficou incerto.

## Configuração necessária para pagamentos reais

Não foram criadas cobranças reais, enviados WhatsApps reais nem publicado o projeto nesta alteração.

- Configurar `SICREDI_CLIENT_ID`, `SICREDI_CLIENT_SECRET`, `SICREDI_CERT_PEM`, `SICREDI_KEY_PEM` e `SICREDI_PIX_KEY` no ambiente/Secret Manager. Os campos PEM devem conter certificados completos com quebras de linha reais. A chave precisa ser a mesma chave Pix Sicredi cadastrada para o webhook. Habilitar os escopos de cobrança (`cob.read` e `cob.write`) e Pix (`pix.read`) no app Sicredi; confirmar acesso à API de Cobrança com a cooperativa antes da produção.
- Registrar o webhook da chave via `PUT /webhook/{chave}`. O receptor aceita `/webhooks/sicredi-pix` e `/webhooks/sicredi-pix/pix` (também os aliases `/api/webhooks/...`).
- No gateway HTTPS, validar a cadeia/certificado de cliente do Sicredi, remover qualquer header externo `x-sicredi-gateway-secret` e injetar o segredo `SICREDI_WEBHOOK_GATEWAY_SECRET` somente após a validação. Restringir o upstream ao gateway. Alternativamente, TLS direto deve validar o cliente e comparar o fingerprint configurado. Sem uma dessas verificações, o endpoint retorna 401.
- Configurar `OWNER_WHATSAPP_NUMBER`, credenciais Meta e templates Utility aprovados. `WHATSAPP_PDV_TEXT_TEMPLATE` tem uma variável de corpo; `WHATSAPP_PDV_QR_TEMPLATE` tem header IMAGE e uma variável de corpo para a legenda. O texto pode usar o template existente `WHATSAPP_CUSTOMER_ORDER_TEMPLATE` como fallback. Sem templates, mensagens livres dependem da janela de atendimento da Meta; uma recusa fica registrada na fila, sem indicar envio bem-sucedido.
- Agendar chamada periódica a `POST /internal/pdv/retry-notifications` com `Authorization: Bearer <PDV_WORKER_SECRET>`. O processo também tenta a cada 30 segundos enquanto está ativo, mas esse timer não substitui um agendador em Cloud Run com escala a zero. O endpoint reprocessa eventos Pix e mensagens pendentes.
- Administradores consultam falhas em `GET /api/admin/pdv/pending-deliveries` e podem tentar novamente via `POST /api/admin/pdv/retry-notifications`.
- Homologar: cobrança, pagamento exato, callback repetido, cliente sem telefone, falha/reinício do worker e envio de template a cliente sem conversa ativa. Credenciais/certificados Sicredi estavam ausentes no ambiente revisado.

A baixa de estoque é exatamente uma vez por pedido. Mensagens externas têm entrega com tentativas: uma queda entre a aceitação da Meta e o registro local pode repetir uma mensagem. O status SENT significa aceitação da Meta, não leitura pelo destinatário. Falta de estoque mantém a conciliação pendente para correção; não se mascara uma falha de inventário como conclusão.

## Validação

- `node --test test/pdv.test.js test/admin-sale-notifications.test.js test/order-integrity.test.js test/mercado-pago.test.js`
- `npx playwright test test/browser/pdv.spec.js` (pode usar `CHROMIUM_PATH` para o navegador instalado).
- Testes de transação usam um double que recusa leituras após escritas e simula falha de commit. Não substituem homologação no Firestore e Sicredi reais.

O teste da página inicial confirma que a faixa promocional de teste permanece removida, enquanto o campo de cupom da sacola continua disponível.

Referências: [Guia técnico Sicredi](https://developer.sicredi.com.br/api-portal/sites/default/files/Guia_tecnico_integracoes_APIPix_Sicredi_v1.9.5.pdf), seções de OAuth, cobrança e webhook; [exemplo oficial Meta de template com imagem](https://www.postman.com/meta/whatsapp-business-platform/request/n3jhmr4/create-template-w-image-header-text-body-text-footer-and-2-call-to-action-buttons).
