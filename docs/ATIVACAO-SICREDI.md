# Ativação do Pix Sicredi

O único banco integrado ao Pix automático é o Sicredi. Enquanto a habilitação bancária não estiver concluída, mantenha `PIX_MODE=MANUAL`: o cliente paga na chave CPF configurada, envia comprovante e Caixa/Admin confere a entrada na conta antes de confirmar.

## Solicitar ao banco em 20/10/2026

Solicite a habilitação da API Pix Cobrança para a conta da Conflora e os dados necessários para usar a integração. O cliente implementado exige os itens abaixo; uma chave Pix CPF sozinha não substitui as credenciais da API.

| Configuração | Finalidade |
|---|---|
| `SICREDI_CLIENT_ID` | Identificação da aplicação autorizada |
| `SICREDI_CLIENT_SECRET` | Segredo OAuth |
| `SICREDI_CERT_PEM` | Certificado usado na conexão mTLS |
| `SICREDI_KEY_PEM` | Chave privada correspondente ao certificado |
| `SICREDI_PIX_KEY` ou `PIX_KEY` | Chave Pix da conta recebedora |
| `SICREDI_WEBHOOK_SECRET` | Segredo de acesso ao callback, gerado pela Conflora; mínimo de 32 caracteres |
| `SERVICE_URL` | Endereço HTTPS do serviço publicado |

Os endereços padrão estão no cliente e podem ser substituídos por `SICREDI_PIX_BASE_URL` e `SICREDI_OAUTH_URL` caso o banco indique ambiente diferente. Confira com o banco a versão da API, os escopos autorizados e as exigências do callback antes de ativar. O código existente não comprova que a conta já está habilitada.

## Sequência técnica de ativação

1. Guardar os dados bancários no Secret Manager. Nunca enviar certificado, chave privada ou segredo pelo chat, planilha de produtos ou tela do cliente.
2. Preencher as configurações no ambiente publicado. As alterações no `.env` local não alteram o Cloud Run.
3. Manter `PIX_MODE=MANUAL` durante o preenchimento. Executar `npm run check:sicredi` para listar campos pendentes sem mostrar os valores.
4. Executar `npm run check:sicredi -- --connect` para validar autenticação sem criar cobrança.
5. Publicar a configuração completa. O script de publicação já prevê os segredos `sicredi-client-id`, `sicredi-client-secret`, `sicredi-cert-pem`, `sicredi-key-pem` e `sicredi-webhook-secret` quando o modo Sicredi for escolhido.
6. Registrar o callback com `npm run sicredi:webhook`. O script utiliza `/webhooks/sicredi-pix/{segredo}` e não imprime o segredo. Se houver gateway mTLS, configurar e validar a identidade do banco conforme o roteiro do gateway antes de usá-lo.
7. Em homologação, validar cobrança de valor fixo, QR Code, Pix copia e cola, pagamento com valor exato, callback repetido, falta de estoque, vencimento e falha temporária de comunicação.
8. Só então ativar `PIX_MODE=SICREDI` para novos pedidos e acompanhar o histórico de erros e as notificações.

## Comportamento após ativar

A cobrança gera QR Code e Pix copia e cola. A notificação do banco provoca consulta ao próprio Sicredi; o sistema verifica identificador, chave e valor antes de confirmar. A confirmação e a baixa de estoque são protegidas contra repetição. Falhas não devem ser resolvidas aprovando manualmente sem conferir o crédito bancário.

Pedidos que nasceram no modo manual continuam manuais; trocar a configuração não converte comprovantes antigos em cobranças bancárias. O histórico de vendas e os produtos não precisam ser apagados para ativar a API.

## Situação em 18/10/2026

Integração preparada no código; a habilitação, as credenciais, o certificado e a homologação bancária continuam pendentes. O segredo local do callback foi preparado sem exibir o valor. Não foram criadas cobranças bancárias reais nesta etapa.

A API Cloud Tasks foi ativada no projeto e a fila `conflora-jobs` foi criada em `southamerica-east1`, limitada a cinco despachos e cinco execuções simultâneas, com retentativas limitadas. Os segredos locais de tarefas e de acompanhamento também foram preparados. Na publicação, os valores usados pelo servidor e pelos produtores de tarefas precisam corresponder aos segredos do ambiente; a presença local não valida esse vínculo. O script de publicação reutiliza a conta de execução do serviço existente, evitando apontar para uma conta inexistente.
