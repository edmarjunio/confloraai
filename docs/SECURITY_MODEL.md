# Modelo de segurança

O backend valida a sessão e o papel real; frontends não concedem permissão. Firebase Admin/SDK servidor ignora regras de cliente, portanto a autorização das rotas continua obrigatória. ADMIN, CAIXA, VENDEDOR, ENTREGADOR e clientes mantêm os limites existentes.

Webhook Meta exige assinatura sobre corpo original. Worker usa comparação temporalmente constante do segredo configurado e lê o payload persistido. Sicredi mantém sua autenticação e conferência bancária; nenhum comprovante de cliente é autoridade de pagamento automático.

Persistência comercial falha de modo fechado. Bloqueio/expiração lógica de sessão, rate limiter compartilhado, proteção de credenciais, minimização de logs e armazenamento privado de comprovantes existentes foram preservados. Segredos reais não foram lidos ou impressos por esta tarefa.

Arquivos financeiros não entram no cache público. A retenção proposta distingue dados técnicos de evidência financeira e marcadores de idempotência. Não foi ativado TTL, alterado IAM, regra remota, credencial ou política real.

Pendências: confirmar regras e índices efetivos do banco, região/edição, IAM do Cloud Run/Tasks, permissões Storage, autenticação bancária, autorização HTTP por papel em ambiente com loopback e homologação Meta. As regras locais de desenvolvimento negam acesso direto do cliente; `firebase.json` raiz aponta índices, mas não comprova as regras remotas implantadas.
