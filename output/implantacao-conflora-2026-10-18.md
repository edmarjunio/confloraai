# Conflora — alterações e preparação para operação

Data: 18/10/2026. Código em `C:\Users\Junin\confloraai`. Alterações locais, sem publicação ou movimentação financeira real.

## Pix manual

Novas vendas usam `PIX_MODE=MANUAL` por padrão. A chave vem de `PIX_KEY` (alternativas legadas: `STORE_PIX_KEY` e `SICREDI_PIX_KEY`), com titular em `PIX_TITULAR`. CPF formatado é normalizado e tem dígitos verificadores conferidos. Configuração ausente ou inválida impede criar uma nova venda Pix.

O cliente copia a chave, paga pelo banco e anexa JPG, PNG, WebP ou PDF de até 3 MB no acompanhamento do pedido. O comprovante fica privado. Enviar o arquivo não confirma pagamento. A comanda continua pendente até CAIXA ou ADMIN verificar o valor efetivamente recebido e aprovar, registrando observação. É possível recusar e reenviar; o histórico é preservado. As verificações impedem aprovar comprovante substituído ou usar o de outro pedido. Estoque e recebimento são confirmados em transação.

O link de visitante usa token assinado em fragmento da URL; trate esse link como informação privada. Configure `ORDER_ACCESS_SECRET` persistente, ou mantenha o mesmo `TASK_SECRET` usado como alternativa. Trocar esse segredo invalida os links antigos.

Não são gerados QR Code ou código EMV para novas vendas manuais. Cobranças bancárias anteriores conservam seus mecanismos de conciliação. A quitação autônoma de dívida pelo Sicredi fica bloqueada no modo manual: o cliente procura a loja e o caixa registra a quitação com comprovante. Vendas Pix do formulário administrativo antigo passam pelo serviço do caixa; solicitações de desconto Pix legadas precisam ser refeitas no Caixa.

## WhatsApp

| Papel | Destino/configuração |
|---|---|
| Remetente dos testes | Número oficial de teste da Meta já configurado: +1 555-152-7087 |
| Loja: novo pedido e comprovante para conferir | Conflora, 64 99935-1616 — `STORE_NOTIFICATION_PHONE` |
| Fechamento de caixa | Júnior, 64 99936-1572 — `OWNER_WHATSAPP_NUMBER` |
| Entregas | Colaboradores ativos com cargo ENTREGADOR e telefone cadastrado |

Os testes autorizados para a loja e o fechamento demonstrativo para Júnior foram aceitos pela API da Meta. Aceitação não comprova entrega ou leitura no aparelho. Os testes não criaram vendas nem fecharam um caixa real. Não foram enviados testes a entregadores, pois não foram informados números para essa finalidade.

O admin tem testes de pedido, pagamento, fechamento e entrega com conteúdo demonstrativo. Exigem `WHATSAPP_TEST_ENABLED=true` e destinatários na lista `WHATSAPP_TEST_ALLOWED_NUMBERS`. Desabilite os testes quando encerrar a validação. O token permanece no arquivo local ignorado pelo Git; não deve ir para documentos, código ou logs.

Mensagens operacionais são persistidas na fila antes do envio. O sistema registra aceitação pelo provedor e recebe callbacks assinados de envio, entrega, leitura e falha. Essa fila permite repetição após falha, mas não promete entrega exatamente uma vez: uma queda entre a aceitação pela Meta e a gravação local pode provocar repetição. O atendimento legado com IA ainda requer revisão adicional dos efeitos de negócio em tentativas repetidas.

Para operação definitiva, use um número real dedicado ao atendimento automático, registrado na API oficial. Um número fictício não substitui um remetente verificado. O número de teste serve para destinatários liberados no painel da Meta. Antes de ampliar os envios, valide templates aprovados e as condições de envio fora da janela de atendimento. A disponibilidade dessas condições depende da conta Meta.

## Situação das 22 recomendações da revisão

“Aplicado” descreve o código local; não significa publicado ou migrado em produção.

| Item | Alteração e limite |
|---|---|
| R01 | Escapados dados de cadastro nos pontos administrativos identificados; opções do seletor criadas pelo DOM. Teste de execução de HTML malicioso passou. Política de conteúdo inicial adicionada; política estrita de scripts exige remover outros scripts inline. |
| R02 | Senhas e PINs novos usam scrypt com sal; hashes não retornam ao cliente; credenciais legadas migram ao autenticar. Migração integral dos registros antigos preparada, ainda não aplicada. |
| R03 | Limitação por IP e identidade nas rotas de autenticação e assistência identificadas; contadores compartilhados no Firestore. Falta medir e ajustar limites/proxy no ambiente publicado. |
| R04 | Usuários padrão restritos aos testes; autenticação não habilita usuários padrão após erro de banco. Outros caminhos legados de dados ainda conservam fallbacks e merecem auditoria separada. |
| R05 | PDFs novos fora do diretório público, armazenamento privado e acesso autenticado. Hosting exclui relatórios do pacote. Arquivos históricos já publicados precisam ser removidos do ambiente público na implantação. |
| R06 | Relatórios diário e por período separam data da venda e data efetiva do recebimento; parcelas usam seus próprios recebimentos. Relatórios históricos já exportados não foram regravados. |
| R07 | Webhook persiste mensagens recebidas antes do reconhecimento; trabalhador retoma mensagens pendentes/interrompidas. Agendamento externo ainda precisa ser configurado. |
| R08 | Mensagens têm reivindicação com prazo e conclusão após sucesso; textos de resposta usam fila com identificadores determinísticos. Ainda há efeitos legados do atendimento a revisar e cenário de repetição após aceitação externa. |
| R09 | Endpoints internos rejeitam requisições quando o segredo está ausente ou errado. |
| R10 | Índice transacional de e-mail normalizado para novos cadastros/edições. Cadastros antigos precisam passar pelo diagnóstico e migração do índice. |
| R11 | Exclusão de usuário propaga falha de gravação. Fechamento tem identificador de operação, reivindicação e arquivo privado antes da conclusão. Persistência real e recuperação devem ser validadas em homologação. |
| R12 | Stream acompanha fila aberta limitada e até 200 concluídos recentes, com escopo de cargo. Algumas consultas de quadro/relatório ainda carregam até 10 mil registros; paginação ampla e listeners compartilhados permanecem evolução pendente. |
| R13 | Sessão consulta usuário diretamente pelo ID, conferindo cargo e situação atuais. |
| R14 | Destino padrão dos scripts alinhado a `confloraai` e revisão exposta na saúde. Conferência pelo domínio e rollback dependem da publicação autorizada. |
| R15 | Comando de teste executa a suíte real; CI inclui build, análise e navegador. Criado teste de concorrência para emulador, ainda não executado por falta de emulador Java local. |
| R16 | Caixa usa React/JSX e CSS compilados localmente, com arquivos nomeados por hash; retirados compilador JSX e dependências principais por CDN. Mapas externos continuam integrações separadas. |
| R17 | Dependências atualizadas com lockfile; auditoria final não apontou vulnerabilidades. Testes locais não substituem homologação de serviços reais. |
| R18 | Falha de atualização conserva o último catálogo válido em memória. Preço e disponibilidade continuam sujeitos à conferência do servidor. |
| R19 | Unidade aceita `saleUnit.code`; melhorado tratamento de indisponibilidade no PDV e erros de JSON/tamanho; há identificador de requisição. Padronização completa de DTOs e códigos de todos os fluxos legados permanece pendente. |
| R20 | Diagnóstico separa configuração de conexão verificada; logs redigem segredos; filas, callbacks e correlação foram adicionados. Alertas, TTL, backup e restauração ainda precisam de implantação e ensaio. |
| R21 | Extraídos módulos de credenciais, proteção HTTP, Pix manual, filas, fatos financeiros e relatórios privados. A divisão dos grandes módulos e tipagem completa continua incremental. |
| R22 | Ranking distingue kg/unidade e informa disponibilidade atual para itens sem venda; venda e recebimento têm critérios separados. Não se inventa margem, perda ou cobertura sem histórico de custo/estoque. Esses registros precisam existir antes dos respectivos indicadores. |

## Publicação e pendências externas

1. Confirmar no Codex a vinculação ao projeto desejado. O projeto salvo como “confloraai” aponta para uma pasta aninhada que contém apenas README; o aplicativo está na pasta acima. A tentativa de associação exigiu confirmação na interface por acesso à pasta de origem. Nenhum arquivo foi movido para contornar isso.
2. Executar `npm ci` e `npm run test:all` em homologação. Conferir o teste de concorrência com `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080` apontando exclusivamente para emulador local. Ele usa projeto `demo-conflora-tests` e não faz limpeza global do banco. Precisa de Java e emulador Firestore.
3. Fazer backup do Firestore e testar restauração em projeto separado. O script `node scripts/migrate-user-security.js` faz diagnóstico sem escrever e não imprime senhas/e-mails. Somente após conferir o resultado, backup e destino, `--apply` migra credenciais e índices. Esse comando não foi executado em produção. Interrompe diante de duplicidades; não consolida clientes nem saldos automaticamente.
4. Publicar segredos pelo Secret Manager: WhatsApp, assinatura Meta e tarefas. Preservar o segredo dos links de pedidos. Configurar chave/titular Pix e destinatários no ambiente de execução; o `.env` local não atualiza o Cloud Run.
5. Manter `PIX_MODE=MANUAL`. Certificar que o bucket de comprovantes/relatórios não é público e que a conta de serviço tem acesso mínimo necessário.
6. Agendar POST `/internal/messages/retry` com `X-Conflora-Task-Secret`; agendar POST `/internal/pdv/retry-notifications` com `Authorization: Bearer <PDV_WORKER_SECRET ou TASK_SECRET>`. Guardar cabeçalhos como segredos e impedir logs dos valores. A cada minuto é um ponto inicial. Temporizadores internos não garantem execução com Cloud Run sem CPU ou sem instância ativa.
7. Ativar e conferir TTL por `expiresAt` nas coleções de sessões, limites e mensagens, após verificar tipos de timestamp dos registros antigos. Definir retenção de comprovantes com o responsável financeiro. Evitar apagar pendências não conciliadas.
8. Criar alertas para mensagens antigas pendentes, falhas de autenticação da Meta, indisponibilidade do banco e fechamento incompleto. Ensaiar erro e recuperação em homologação.
9. Conferir Hosting → serviço/região, revisão retornada por `/health`, acesso privado aos PDFs e rollback para revisão conhecida. Remover relatórios antigos que já tenham sido publicados; excluir do novo pacote não revoga URLs históricas sozinho.
10. Somente com acesso bancário validado, homologar o Sicredi, certificado, webhook autenticado, valores e repetição de eventos. Ativar `PIX_MODE=SICREDI` deliberadamente para novas vendas. Pedidos manuais existentes continuam manuais.

## Validação registrada

- Servidor: 245 testes aprovados, nenhum reprovado; 1 teste de emulador não executado.
- Navegador: 72 cenários aprovados.
- Verificação de sintaxe e análise estática: aprovadas.
- Auditoria de dependências: zero vulnerabilidades reportadas nesta execução.
- Conferência visual: tela de envio do comprovante e tela de revisão pelo administrador.

Resultados finais devem ser lidos junto dos registros da execução. Foram validados fluxo de comprovante, rejeição/reenvio, permissões, repetição de aprovação, datas financeiras, segurança de cadastro, limites de login, modo manual sem banco e regressões de interface. O teste do emulador é declarado separadamente como não executado; não representa prova de concorrência em Firestore real.

Não houve publicação, troca de número da Conflora, migração de dados reais nem fechamento financeiro real.
