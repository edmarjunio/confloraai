# Ambiente de homologação

O ambiente separado continua sendo confloraai-dev. Seus scripts exigem projeto, bucket, autenticação e fila próprios e mantêm o WhatsApp real desabilitado.

O modo inicial é PIX_MODE=MANUAL. Para a homologação bancária, siga [Ativação Sicredi](ATIVACAO-SICREDI.md) com credenciais autorizadas para o ambiente indicado pelo banco. Não copie credenciais de produção para um projeto de testes sem planejamento e não confunda pagamento real com simulação.

Use scripts/bootstrap-dev.ps1 para infraestrutura isolada e scripts/deploy-dev.ps1 para a entrega desse ambiente. O check de saúde precisa informar o projeto de homologação e o modo manual esperado. Esses scripts não devem publicar no projeto principal.
