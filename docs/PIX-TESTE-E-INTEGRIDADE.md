# Pix: integridade e roteiro de teste

O catálogo principal (`/api/orders` e o adaptador `/api/storefront/orders`) e o PDV usam Sicredi. As rotas legadas de pedido manual e aprovação fora do PDV ainda contêm Mercado Pago; os testes de compatibilidade desse provedor continuam na suíte. A vitrine de tenants em `src/storefront` tem um checkout próprio e não deve ser tratada como integração Sicredi por este documento.

## Pedido, reserva e pagamento

1. O servidor recalcula produtos, quantidades, preços, parcelas e total. O pedido e seu txid são persistidos antes da cobrança.
2. A emissão do Pix reserva unidades em uma transação. O saldo físico não muda: físico 10, reservado 2, disponível 8. Outras vendas não podem consumir as unidades reservadas.
3. O servidor agenda o vencimento no Cloud Tasks e solicita a cobrança de valor fixo ao Sicredi. Em pagamento dividido, cobra apenas a parcela Pix. A resposta contém QR Code e copia e cola.
4. O webhook autenticado registra o evento durável e consulta o Pix no banco. Txid, endToEndId, chave recebedora, valor exato e ausência de devolução precisam corresponder ao pedido.
5. A confirmação relê pedido e produtos na transação: grava pagamento, conclusão, uma baixa de estoque e liberação da reserva. Repetições não repetem os efeitos.
6. Caixa/Admin também podem confirmar manualmente antes do vencimento, com comprovante conferido e justificativa. O operador e o método de confirmação ficam no pedido e no recibo. Vendedor não confirma recebimento.
7. No vencimento, a comanda é cancelada e a reserva liberada. Se dinheiro/cartão já foi recebido, o mesmo commit mantém as parcelas e grava `PARTIAL_RECONCILIATION`, `requiresRefund` e `refundDue`. Isso também vale para falha no agendamento. Não há reembolso bancário automático.
8. Pix constatado para pedido cancelado/vencido é registrado em `pdv_pix_late_payments` para conciliação; não reabre a venda nem consome estoque liberado.

Sem cobrança, a opção de encaminhar ao caixa deixa somente a comanda. Fiado finalizado registra a dívida; quitar depois não gera outra venda nem baixa novamente. O Pix autônomo da dívida usa `customer_debt_pix`, com txid próprio, e consulta oficial do banco. Pagamento acima da dívida remanescente por quitação concorrente vira crédito identificado.

## Configuração operacional

Use `.env.example` como referência de nomes. Não versione valores reais de tokens, certificados, chave privada ou segredos.

- Sicredi: `SICREDI_CLIENT_ID`, `SICREDI_CLIENT_SECRET`, `SICREDI_CERT_PEM`, `SICREDI_KEY_PEM`, `SICREDI_PIX_KEY` e os hosts autorizados para o ambiente.
- Webhook: `SERVICE_URL` HTTPS e segredo de rota `SICREDI_WEBHOOK_SECRET` com pelo menos 32 caracteres, ou gateway mTLS configurado. O evento sempre exige consulta posterior à API bancária.
- Expiração: `TASK_SECRET`, `CLOUD_TASKS_QUEUE`, `GCP_PROJECT_ID` e `GCP_REGION`. A fila precisa existir e a conta de execução deve poder criar tarefas. `PIX_PAYMENT_TTL_SECONDS` define o prazo entre 300 e 86400 segundos; o padrão é 3600.
- Publicação: Cloud Run e Firebase Hosting com os rewrites `/api/**`, `/tasks/**` e `/webhooks/**`. O endpoint de expiração exige o mesmo `TASK_SECRET` usado pela tarefa.
- Recibos: credenciais WhatsApp e modelos aprovados, conforme [PDV-SICREDI.md](PDV-SICREDI.md). Falhas de envio permanecem em `pdv_outbox`; não desfazem uma venda confirmada. Uma rotina externa pode acionar o worker protegido por `PDV_WORKER_SECRET` quando não houver instâncias ativas.

## Validação local sem dinheiro real

```powershell
npm run check:pix
npm run test:pix
```

`check:pix` e `check:sicredi` conferem a configuração do Sicredi e da expiração. Sem `--connect`, não chamam serviços externos nem exibem segredos. Esse diagnóstico não comprova credenciais válidas, permissões, fila existente ou webhook acessível.

`test:pix` usa HTTP local, armazenamento em memória e um double transacional. Verifica concorrência, idempotência, parcelas Pix, confirmação manual, divergência de valor, reserva, cancelamento, baixa e falha de commit. Não movimenta dinheiro nem envia WhatsApp real.

## Roteiro de homologação

1. Configure um ambiente separado com Firestore, Storage, autenticação, fila, WhatsApp de teste e os hosts/credenciais de homologação fornecidos pelo Sicredi.
2. Cadastre um produto com saldo 10. Gere um Pix de 2 unidades: o esperado é saldo físico 10, reserva 2 e disponível 8.
3. Confira no QR/copia e cola o valor fixo. Confirme a entrega do recibo e do QR no telefone autorizado.
4. Após pagamento validado pelo banco, confira pedido finalizado, transação identificada, saldo 8, reserva 0 e um movimento de estoque. Repetir o evento deve preservar esses valores.
5. Gere outro Pix e deixe vencer: pedido cancelado, reserva liberada e saldo físico inalterado. Confira o processamento da tarefa mesmo após a instância do servidor encerrar.
6. Teste dinheiro/cartão mais Pix: o QR deve cobrar somente a parcela Pix. A conferência manual usa esse mesmo valor. Se o Pix vencer, as parcelas recebidas continuam identificadas para conciliação.
7. Teste dois operadores tentando confirmar a mesma venda: deve haver uma baixa e um conjunto de notificações.
8. Valide os papéis: vendedor lança; Caixa/Admin recebem; cliente acessa apenas sua conta e seus pedidos.

Essas etapas com serviços reais ainda exigem homologação. O double transacional não substitui a validação no Firestore real/emulador, nem comprova entrega Meta ou disponibilidade do banco. Uma cobrança externa não é estornada ao cancelar no aplicativo; divergências e recebimentos tardios exigem conciliação.
