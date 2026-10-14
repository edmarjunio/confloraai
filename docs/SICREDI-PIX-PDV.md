# Sicredi Pix — PDV, liquidação e caixa

## Visão arquitetural

O PDV chama `POST /api/caixa/orders`, autenticado como CAIXA/ADMIN, com `Idempotency-Key` persistido no navegador. O backend recalcula os produtos pelo catálogo e persiste o total (incluindo frete e desconto), a intenção e o txid antes de acessar o Sicredi. Uma repetição da mesma tentativa reutiliza a venda; outro conteúdo com a mesma chave é rejeitado.

O cliente usa HTTPS nativo com certificado e chave privada (mTLS), OAuth com cache e renovação após 401. Consulta primeiro a cobrança pelo txid para recuperar tentativas anteriores; apenas 404 autoriza o PUT. O QR Code é gerado localmente a partir de `pixCopiaECola`. Não há fallback para Pix estático nem aprovação por comprovante enviado pelo cliente.

A confirmação exige `GET /cob/{txid}` com `CONCLUIDA`, chave e valor esperados, um recebimento com E2E e `GET /pix/{endToEndId}` correspondente. Recebimentos divergentes, múltiplos ou com devolução ficam para conciliação. Uma indisponibilidade deixa a venda pendente, jamais paga por presunção.

Uma transação Firestore grava `orders.status=PAGO`, `paymentStatus=PAGO`, evidência bancária, `cash_movements/sicredi_{endToEndId}` e a fila de recibo. Essa chave impede lançamento repetido mesmo com webhooks e consultas concorrentes. Cancelamento local seguido de recebimento é registrado no caixa e sinalizado com `reconciliationRequired`.

Estoque é um efeito posterior idempotente em `sicredi_stock_jobs`, usando a rotina transacional existente. Falta de estoque não apaga recebimento bancário: o trabalho permanece pendente com `lastError` para correção. Não liberar entrega se houver esse erro. O caixa e os relatórios existentes reconhecem PAGO; lançamentos detalhados ficam em `cash_movements`.

## Código e responsabilidades

- `src/integrations/sicredi-pix.client.js`: transporte mTLS, OAuth, cobrança e validação de recebimento.
- `src/orders/sicredi-payment.service.js`: persistência, conciliação, transação financeira, fila WhatsApp e estoque.
- `src/http/app.js`: endpoints autenticados de PDV, consulta, recuperação e webhook.
- `src/http/views-caixa.html`: frontend realmente servido pelo projeto; QR, polling, erros e recibo com valores do servidor. O protótipo isolado PdvCaixa.jsx não é o frontend servido.
- `scripts/reconcile-sicredi.js`: reconciliação independente do navegador e cadastro do webhook.
- `test/sicredi-pix.test.js`: testes sem movimentar dinheiro ou enviar mensagens reais.

## Configuração

Use o gerenciador de segredos do ambiente. Nunca coloque certificados, credenciais ou chaves privadas no frontend/repositório.

```dotenv
PDV_PIX_PROVIDER=SICREDI
SICREDI_PIX_BASE_URL=https://api-pix.sicredi.com.br/api/v2
SICREDI_OAUTH_URL=https://api-pix.sicredi.com.br/oauth/token
SICREDI_CLIENT_ID=
SICREDI_CLIENT_SECRET=
SICREDI_PIX_KEY=
SICREDI_CERT_PATH=
SICREDI_KEY_PATH=
SICREDI_CA_PATH=
SICREDI_WEBHOOK_URL=https://SEU_DOMINIO/webhooks/sicredi
SICREDI_RECONCILE_SECRET=
SICREDI_BACKGROUND_WORKER=true
SICREDI_WHATSAPP_CHARGE_TEMPLATE=
SICREDI_WHATSAPP_CODE_TEMPLATE=
SICREDI_WHATSAPP_RECEIPT_TEMPLATE=
```

Os certificados também podem ser fornecidos como PEM em `SICREDI_CERT_PEM`, `SICREDI_KEY_PEM`, `SICREDI_CA_PEM`. A CA opcional precisa conter a cadeia confiável apropriada. Configure a chave Pix e as credenciais da conta recebedora correta; não há chave padrão. Confirme com a cooperativa a habilitação da conta da proprietária: o guia público apresenta o produto para associados PJ, portanto chave CPF não garante elegibilidade da conta PF.

Produção e homologação precisam de URLs, certificado, credenciais, chave e banco de dados próprios. O guia cita /api/v2 e contém exemplo /api/v3; use a versão efetivamente habilitada para o contrato. Não use a base sem `/api/v2` ou versão equivalente.

## Operação passo a passo

1. Instalar dependências e configurar Firestore persistente com permissões de servidor para as novas coleções. Negar escrita direta pelo cliente nas coleções financeiras/filas.
2. Validar mTLS e cobrança em homologação com o Sicredi.
3. Cadastrar webhook explicitamente: `node scripts/reconcile-sicredi.js --register-webhook`. A URL recebe POST em `/webhooks/sicredi` e `/webhooks/sicredi/pix`, pois o PSP pode anexar `/pix`. Não é POST no endpoint de cadastro do banco: o cadastro usa PUT `/webhook/{chave}`.
4. Servir callback em HTTPS/443 com cadeia exigida pelo Sicredi. Configurar autenticação do certificado do webhook no proxy quando disponível e limitar volume no gateway. A aplicação não confia em headers de certificado enviados pelo cliente. Mesmo sem validação do certificado de origem, nenhum payload autoriza baixa: só consultas autenticadas ao banco. IDs desconhecidos são ignorados.
5. Em servidor persistente o worker inicia automaticamente com credenciais completas, a cada 30 segundos, sem sobreposição local. Em Cloud Run com CPU suspensa/scale-to-zero, configurar Cloud Scheduler a cada minuto para POST `/tasks/reconcile-sicredi`, com `Authorization: Bearer <SICREDI_RECONCILE_SECRET>` (segredo aleatório de pelo menos 32 caracteres), ou executar `node scripts/reconcile-sicredi.js` como Cloud Run Job. Não depender de timer em instância suspensa. Ajustar timeout ao volume; o worker percorre páginas de 100 sem abandonar vendas antigas. O endpoint retorna `processed` e `failed`; alertar quando `failed>0` e sobre idade/lastError das filas pendentes.
6. Configurar WhatsApp Cloud API. Para contato iniciado pela loja fora da janela de atendimento, cadastrar templates utilitários aprovados para resumo, código separado e recibo. Cada nome acima deve apontar para um template pt_BR com um parâmetro textual no body. Sem template, usa texto livre; rejeições da Meta permanecem pendentes e não são tratadas como envio bem-sucedido. Validar os limites e o formato dos templates na aprovação da Meta.
7. No PDV, finalizar Pix abre a cobrança; o modal consulta a cada 5 segundos ou manualmente. Após PAGO, mostra recibo bancário. Recarregar recupera o pedido salvo ou a tentativa conhecida. Descontos acima de 5% seguem a aprovação administrativa.
8. Homologar recebimento real de pequeno valor e comparar chave, conta credenciada, E2E e extrato. Só depois ativar em produção. Nenhuma transferência real foi executada pelos testes automatizados.

## Garantias e limites práticos

- Baixa financeira exatamente uma vez por E2E no Firestore, com transação e validação de vínculo.
- WhatsApp tem entrega com retentativa e lease persistente; uma queda após a Meta aceitar e antes de gravar o ID pode repetir uma mensagem. Não existe garantia de exactly-once entre Firestore e Meta. Aceite da Meta não significa leitura ou entrega no celular.
- O backend registra erros de criação e mantém a intenção para recuperação. O polling não cria uma segunda cobrança quando a primeira está incerta.
- QR expirado continua em conciliação para capturar recebimento tardio. Não é automaticamente reemitido. Revisar/cancelar pelo procedimento operacional apropriado após checar o banco.
- Devoluções posteriores à baixa e MED exigem fluxo próprio de estorno; este módulo não debita o caixa automaticamente por devolução posterior.
- Falhas de banco, certificado ou rede não permitem confirmação infalível em tempo real. Recuperação persistente e consulta ao banco reduzem perdas de notificações sem inventar liquidação.
- A autenticação de operador existente é reutilizada; a consulta Pix limita o caixa aos próprios pedidos e permite ADMIN.

## Fontes oficiais

- Guia Sicredi: https://www.sicredi.com.br/media/produtos/filer_public/2026/01/13/guia_tecnico_integracoes_apipix.pdf
- Cobrança: https://developers.sicredi.com.br/public/reference/put_cob-txid
- Consulta: https://developers.sicredi.com.br/public/reference/get_cob-txid
- Especificação Pix: https://bacen.github.io/pix-api/
