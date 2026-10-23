# Contrato de carregamento, performance e integridade

## Regras permanentes

Firestore e os serviços oficiais são a fonte dos dados. Cache serve para exibir
uma projeção de leitura; nunca autoriza preço, estoque, pagamento ou conclusão
de venda. Preserve transações, permissões, idempotência e reconciliação existentes.

Renderize a estrutura primeiro. Mostre dados disponíveis enquanto revalida, sem
substituir conteúdo utilizável por um spinner global. Preserve filtros, pesquisa,
rolagem e rascunhos apropriados à sessão. Não mantenha dados privados ao trocar
usuário, perfil ou loja. Nenhuma gravação financeira offline automática.

O comportamento desejado inspira-se na experiência de navegação do YouTube;
não pressupõe acesso à implementação interna nem igualdade de arquitetura.

## Cache novo

- Não importe snapshots antigos, mocks ou initialData de demonstração.
- O namespace IndexedDB `cf-public-20261023-reset1` começa vazio e recebe somente a
  projeção pública do catálogo principal após resposta do backend.
- A geração anterior `cf-public-20261023` é excluída pela rotina compartilhada
  de limpeza, inclusive quando a entrada é pelo PDV ou administração. Não copie
  os dados antigos. Se a exclusão estiver bloqueada por outra aba, tente na
  próxima visita; não declare exclusão física concluída antes de verificar.
- Mude a geração somente em um reset intencional. Não apague o cache corrente
  em cada visita. Não apague sessões, operações pendentes nem o Firestore.
- Validade para revalidação: 60 segundos. Retenção máxima: 24 horas. Limite de
  persistência por catálogo: 4 MiB. Armazenamento indisponível não bloqueia rede.
- Configurações públicas e produtos podem aparecer como dados salvos; indique
  falha, offline e desatualização. Não apresente falha de rede como atualização.
- Nunca grave usuários, pedidos, clientes, pagamentos, tokens ou permissões nesse
  banco. A sessão por aba mantém seu contrato independente.
- Invalide após mutações confirmadas; respostas iniciadas antes da invalidação
  não podem repovoar o cache com dados antigos.
- A projeção pública do servidor tem TTL de 15 segundos por processo e
  invalidação nas rotas comerciais. Outros processos e alterações externas
  convergem por expiração; não confunda isso com consistência transacional.

## Consultas e recursos

Não leia histórico global de vendas para abrir catálogo/inventário. Paginação
deve limitar leituras reais, com cursores, filtros e ordenação compatíveis. Antes
de limitar uma consulta, identifique consumidores de totais e relatórios para
não esconder resultados. Justifique índices, coleções e dependências adicionais.

Compartilhe requisições simultâneas compatíveis. Descarte respostas de contextos
antigos e encerre listeners sem consumidores. Prefetch é opcional, limitado e
subordinado à operação atual, visibilidade e economia de dados. Não armazene APIs
privadas em service worker. Não force reload durante uma venda.

## Validação e entrega

Mudanças devem registrar arquivos, comportamento, riscos, custo e rollback.
Teste primeiro acesso, retorno, rede lenta, reconexão, mudanças por outro usuário,
logout e troca de conta. Valide cadastro, comandas, vendas, Pix, estoque, entregas,
WhatsApp e webhooks antes de publicar alterações que os afetem.

Compare requisições, leituras, bytes, memória e tempos antes/depois. Metas, não
resultados: LCP p75 até 2,5 s, INP até 200 ms, CLS até 0,1; resposta visual de
navegação até 100 ms e conteúdo já em memória utilizável até 200 ms, sujeitos à
medição em dispositivo representativo. Primeiro acesso em rede lenta exige uma
meta própria depois da linha de base. Não invente ganhos nem declare conclusão
somente por adicionar cache.

Testes isolados podem usar fixtures; produção jamais. Preserve testes e guardas
contra mocks. Os testes funcionais e de performance desta entrega aguardam a
sessão solicitada para 24/10/2026; a data sozinha não autoriza execução automática.
Análise estática não substitui testes. Não faça deploy sem validação e autorização.

Preserve o Pix Sicredi manual, o simulador isolado utilizado pelo fluxo atual e
a integração real aguardando a liberação da API. O usuário confirmou testes
manuais diários e manutenção dos testes isolados; estes não devem integrar o
bundle do site nem ser publicados como recursos de produção.
