# Validação da importação e dos fluxos web

Base: main, commit d48cd62. Verificação em 09/10/2026.

## Arquivo utilizado

`test/fixtures/lista-de-produtos.xlsx` é uma cópia do arquivo LISTA DE PRODUTOS (7).xlsx enviado para esta tarefa. A aba PRODUTOS contém 745 registros, 742 ATIVOS e 3 INATIVOS, sem IDs duplicados. A aba Página4 (79 registros) é ignorada. Os valores misturam números Excel e textos monetários; a leitura preserva os valores e normaliza os preços no servidor.

## Resultado

- `npm run check`: aprovado.
- `npm run lint`: aprovado.
- `npm test`: 28 testes aprovados.
- `npm run test:e2e`: 5 cenários de navegador aprovados em Chromium, banco em memória.

| Área | Cobertura |
| --- | --- |
| Admin | Navegação nas 11 abas: analytics, caixa, alterações, pedidos, estoque, preço, produtos, equipe, importação, notificações e conexões |
| Produtos | Criação, edição de produto importado, atualização dos aliases de preço/nome, exclusão e entrada rápida de estoque |
| Equipe | Cadastro, mudança de perfil, exclusão e troca de operador |
| Caixa | Login PIN, cinco abas permitidas, bloqueio das demais e venda no balcão |
| Cliente | Cadastro, login por senha, pesquisa, sacola, checkout, abas pedidos/mais comprados/fidelidade e logout |
| Login | PIN incorreto, conta sem PIN, conta inativa, cadastro sobre conta existente, sessão revogada e persistência após recarregar |
| Google | Backend com tokens/identidades simulados: admin, caixa, cliente, token inválido, e-mail não verificado, provedor incorreto e conta inativa. Botão sem configuração permanece desabilitado |
| Importação | Upload do Excel real, prévia, confirmação obrigatória, 745 produtos após substituição, reenvio idempotente, arquivo inválido, preservação no modo mesclar e falha simulada no segundo lote |
| Alterações de venda | Solicitação pelo caixa, bloqueio da aprovação pelo caixa, aprovação/recusa pelo admin, notificações e métricas (API) |
| Acesso | API administrativa exige sessão e perfil; lista pública não expõe PIN/senha; histórico de cliente usa ID da sessão |

## Correções realizadas

Upload direto de XLSX e substituição com prévia. Removida a restauração automática de produtos antigos pelo catálogo padrão. Sessões verificadas no servidor, acesso por perfil, logout, bloqueio de contas inativas e proteção contra vincular senha por cadastro público a contas existentes. Produtos INATIVOS não aparecem no catálogo do cliente. Edição de produtos importados sincroniza os campos usados pela interface.

## Limites desta validação

Os testes não utilizaram credenciais de produção. O popup real Google/Firebase, leituras e gravações reais no Firestore, WhatsApp, Google Sheets, GA4 e deploy no Cloud Run não foram homologados nesta execução. Navegar pela tela de conexões/analytics não comprova as integrações externas nem a veracidade das métricas GA4 já existentes.

A substituição é feita em lotes, com aviso de falha parcial e possibilidade de reenvio. Não há atomicidade global nem bloqueio distribuído para vendas/edições concorrentes. O botão de cópia baixa JSON; a restauração desse backup pode usar a API administrativa legada `POST /api/admin/import-data` com `type: products` e `records`, em sessão ADMIN (mescla registros, não apaga IDs adicionais).

A revisão não constitui uma auditoria completa de segurança ou de concorrência dos pedidos. O armazenamento legado de senhas/PINs e outras regras de venda não foram redesenhados neste trabalho.

Nenhuma exclusão ou importação foi executada na base de produção. É necessário integrar a branch e implantar o código para disponibilizar a nova tela no site publicado.
