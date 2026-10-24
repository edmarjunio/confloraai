# Preparação de publicação — não executada

Publicação, merge, migração, TTL e alterações de produção continuam bloqueados até autorização explícita.

1. Revisar o PR e o `IMPLEMENTATION_STATUS.md`, sobretudo pendências de integração e rollback.
2. Restaurar autenticação da CLI pelo operador. Confirmar projeto `confloraai`, banco usado pelo SDK, edição, região, índices/regras remotos, IAM e Storage. A tentativa desta tarefa falhou por credenciais expiradas; nenhum estado remoto foi presumido.
3. Resolver divergência de configuração: rewrites do Hosting apontam `southamerica-east1`; o script npm `deploy` existente usa `us-central1`. Confirmar a região do serviço real antes de executar qualquer comando. Não usar o script cegamente.
4. Executar `npm ci`, `npm run build`, `npm run lint`, `npm run test:dev` e `npm run test:e2e` em ambiente com conexão local permitida. Rodar testes com emulador local em projeto `demo-*`; não direcionar carga para produção.
5. Homologar por papel: dinheiro/troco/dividido, fiado/crédito, estoque concorrente, Sicredi/expiração/pagamento tardio, comprovantes privados, inbox/outbox após reinício, pausa/retomada humana e entregas.
6. Conferir flags GA4 sem ativar migração definitiva por conveniência; Firestore permanece financeiro oficial. Preservar credenciais, fila, templates e parâmetros de retenção atuais.
7. Preparar backup, revisão anterior e rollback com compatibilidade dos rascunhos/origens novos. Somente então solicitar/autorização da publicação concreta.

Não há comando de reset ou limpeza nesta preparação. O diretório `functions` permanece scaffold; não criar deploy de funções adicionais para esta mudança. Monitorar erros de checkout, reservas, filas em `NEEDS_RECONCILIATION`, callbacks bancários tardios e divergência de saldos após uma implantação autorizada.
