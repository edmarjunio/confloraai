# Contrato permanente de performance e integridade

Antes de alterar carregamento, navegação, cache ou consultas, leia
`docs/performance/CONTRATO.md`. Estas regras se aplicam a todo o projeto.

- Preserve design, permissões e fluxos comerciais existentes.
- Preserve a aprovação manual do Pix Sicredi e a integração real aguardando
  liberação da API. Não classifique esses fluxos como resíduos ou mocks removíveis.
- Limpeza de cache significa apagar projeções armazenadas, mantendo o mecanismo
  novo. Use geração explícita para resets; nunca apague Firestore, autenticação,
  operações pendentes ou dados de outros aplicativos. Não zere em cada navegação.
- Renderize estrutura primeiro e dados essenciais antes de recursos secundários.
- Nunca acrescente uma leitura global de pedidos ao caminho do catálogo/inventário.
- Reutilize dados públicos por uma política explícita de validade e invalidação.
  Cache é apenas uma projeção de leitura; Firestore/backend são a fonte oficial.
- Não persista pagamentos, comandas, clientes, permissões ou credenciais no cache
  público. Isole dados privados por usuário, perfil e loja; limpe na troca/logout.
- Não confirme vendas, estoque ou pagamentos com base no cache. Preserve
  transações, idempotência, reconciliação e validação no servidor.
- Não substitua uma lista já utilizável por um loading global durante revalidação.
- Paginação deve reduzir leituras efetivas. Não use um loop que lê todas as páginas
  para fingir paginação de uma tela. Relatórios completos são uma exceção explícita.
- Streams precisam de deduplicação, cleanup e recuperação; respostas antigas não
  podem sobrescrever um contexto novo. Prefetch deve respeitar conexão/economia.
- Dados fictícios são exclusivos de testes isolados. Nunca injete exemplos ou
  fallback em memória no ambiente real. Não remova guardas que rejeitam mocks.
- Não apague testes/fixtures só por conterem a palavra mock: são ferramentas de
  validação, não dados iniciais do produto. Não inclua esses arquivos no deploy.
- O usuário confirmou que deseja manter testes isolados e realiza testes manuais
  diariamente. Mantenha fixtures compartilhadas e testes fora do bundle/runtime;
  remova exemplos e módulos sem consumidores após verificar suas referências.
- Mudanças futuras devem explicar impacto em leituras, bytes, estado e segurança.
  Execute os testes pertinentes quando autorizados, compare antes/depois e informe
  limitações. Nunca declare performance perfeita ou produção validada sem medição.
- Não publique mudanças sem validação dos fluxos críticos e autorização de deploy.

Orientação desta entrega: os testes funcionais e de performance ficam para
24/10/2026, por solicitação do usuário. Não execute automaticamente por data;
aguarde o início da sessão de testes. Checagem estática não substitui homologação.
