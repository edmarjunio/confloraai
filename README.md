# Conflora AI

Refatoração arquitetural de 22/10/2026: [arquitetura](docs/ARCHITECTURE.md), [implementação e pendências](docs/IMPLEMENTATION_STATUS.md), [evidências de testes](docs/TEST_REPORT.md) e [preparação de publicação](docs/DEPLOYMENT_GUIDE.md). Publicação e migração dependem de autorização explícita.

Aplicativo da Conflora Horta e Viveiro: catálogo, Caixa, comandas, estoque, equipe, entregas e painel gerencial.

## Operação

- [Manual da equipe por função](docs/MANUAL-EQUIPE-CONFLORA.html) — leitura, impressão e exportação para PDF pelo navegador.
- [Manual em texto](docs/MANUAL-EQUIPE-CONFLORA.md).
- [Migração e importação do catálogo](docs/MIGRACAO-CATALOGO.md).
- [Configuração e ativação do Sicredi](docs/ATIVACAO-SICREDI.md).
- [Histórico de erros](docs/OPERACAO-E-ERROS.md).
- [IA, cache e importação segura](docs/SEGURANCA-IA-E-IMPORTACAO.md).

O Pix funciona em modo manual até a homologação bancária: cliente copia a chave configurada, paga e envia comprovante; Caixa/Admin confere o crédito na conta e confirma. O único banco previsto para confirmação automática é o Sicredi.

A importação de produtos usa arquivo CSV UTF-8 ou JSON enviado pelo Admin, com prévia e validação. Não há sincronização com serviços externos de planilha. Vendas e saldos não são apagados pela migração de produtos.

## Desenvolvimento e execução

Node.js 20 ou superior. Instale com npm ci, configure o ambiente a partir de .env.example e execute npm run build:frontend. Depois, npm start inicia somente o servidor e confere o pacote compilado, sem executar testes ou modo watch.

npm run test:all executa a validação pontual do código. Os testes ficam fora do pacote publicado. npm run check:sicredi lista as configurações bancárias pendentes sem mostrar segredos. Nenhuma dessas verificações representa homologação bancária real.

## Estrutura

- src/http: rotas e páginas administrativas.
- src/orders: políticas de pedido, pagamento, comprovante, estoque e entrega.
- src/catalog: catálogo e importação por arquivo.
- src/integrations/sicredi-pix.client.js: conexão bancária.
- src/security: autenticação, credenciais e proteção HTTP.
- src/services/error-history.service.js: histórico privado e limitado de falhas.
- public/storefront: catálogo e recursos compartilhados.
- public/pdv: fonte da interface do caixa; dist é gerado pelo build.

## Publicação

Projeto/serviço: confloraai, região southamerica-east1. Compile antes de publicar. Publicação e migrações de produção precisam ser ações deliberadas; scripts de limpeza nunca entram na inicialização.

Mantenha PIX_MODE=MANUAL até obter, configurar e homologar as credenciais completas do Sicredi. Segredos pertencem ao ambiente/Secret Manager, nunca ao Git ou à planilha de produtos.
