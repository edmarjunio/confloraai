# Operação e acompanhamento de erros — Conflora

Preparação realizada em 18/10/2026 para a operação prevista em 19/10/2026. As alterações desta preparação ainda não foram publicadas.

## Onde acompanhar

Entre como administrador, abra o menu de páginas e escolha **Sistema e erros**. O endereço é `/admin?tab=status`. A página reúne diagnóstico das conexões e histórico de erros. Use **Atualizar histórico** para consultar; abra um registro para ver os detalhes. O histórico não fica consultando o servidor em segundo plano.

Se o aplicativo estiver indisponível, consulte o [Google Cloud Logging do projeto](https://console.cloud.google.com/logs/query?project=confloraai). Filtre por recurso Cloud Run, serviço `confloraai` e severidade ERROR. O acesso depende da sua conta Google e das permissões no projeto.

O novo histórico dentro do admin estará disponível depois de publicar esta versão. A versão publicada verificada hoje ainda informa um provedor antigo, portanto **a compra real pelo Pix manual ainda precisa da publicação**.

## O que fica registrado

- Falhas inesperadas nas operações HTTP, com identificador da requisição e código de resposta.
- Erros registrados pelos serviços, incluindo falhas de notificações, recebimento de mensagens e trabalhadores de recuperação.
- Erros de JavaScript e promessas não tratadas no navegador, com página e posição do arquivo.
- Falhas fatais do processo também seguem para a saída de erros do servidor, disponível no Google Cloud; a aplicação pode reiniciar antes de conseguir gravá-las no banco.

Informações de senha, token, autorização, CPF, telefone e e-mail reconhecíveis são ocultadas. Corpos de requisição, anexos e comprovantes não são enviados ao histórico. Registros do navegador são dados não confiáveis e são exibidos como texto, sem executar HTML. Um erro tratado apenas na interface pode não aparecer automaticamente; os serviços críticos registram suas falhas no servidor.

A captura no navegador limita a cinco mensagens distintas por página. O recebimento tem limites por endereço de rede e por instância. No servidor, há fila limitada, cache de até 200 registros e supressão de repetições durante um minuto. Os arquivos locais privados têm rotação de aproximadamente 1 MB, conservando o arquivo atual e três anteriores. Não há biblioteca externa de rastreamento nem coleta contínua de desempenho.

O destino central é a coleção privada `application_errors` do Firestore. Os registros recebem vencimento em 30 dias; a regra TTL foi declarada na configuração e precisa ser publicada. Enquanto isso, não há garantia de exclusão automática em 30 dias. O arquivo local `.private/logs/errors.jsonl` é uma alternativa quando o banco falha. Em Cloud Run, esse arquivo é temporário e não substitui o Firestore ou o Cloud Logging.

## Limpeza e consumo

Foram retirados o simulador WhatsApp, o endpoint local de conversa, os controles de envio demonstrativo do admin, o ping de teste que apenas inspecionava configuração, o catálogo clássico sem rota ativa, uma segunda implementação React sem importação no aplicativo, cópias antigas de bibliotecas e scripts duplicados de execução. As dependências diretas sem uso `@tanstack/react-query`, `zustand`, `lucide-react` e `dotenv` foram removidas; os recursos ativos da loja em `public/storefront` permanecem.

Os testes de desenvolvimento não iniciam com o servidor e não entram na publicação do backend. Os testes antigos que verificavam exclusivamente o catálogo retirado também foram excluídos. Os testes de pagamentos, estoque, permissões e fluxos atuais continuam disponíveis para execução pontual quando houver manutenção. Não há modo de teste contínuo iniciado por `npm start`.

A compilação acontece antes da publicação; a inicialização apenas verifica os arquivos já compilados. O servidor passa a abrir somente a porta configurada. As telas do caixa e de entregas usam o mesmo acompanhamento de atualizações e só fazem consultas periódicas de reserva quando a conexão em tempo real falha; páginas ocultas deixam de atualizar os dados. A rotina de expiração deixa de carregar até 10 mil pedidos a cada passagem e passa a buscar lotes dos pedidos vencidos, com os índices correspondentes declarados.

O redirecionamento antigo da página inicial foi removido: o Hosting já entrega o catálogo pela regra de navegação, preservando o endereço e o fragmento do link privado de acompanhamento. Foram declaradas as rotas do Hosting para os arquivos compilados do caixa, a saúde do serviço e os relatórios privados; é necessário publicar também essa configuração.

Filas de notificações, recuperação de mensagens, reservas, comprovantes e o código da integração Sicredi foram preservados porque pertencem à operação atual ou à integração bancária já solicitada.

A exclusão física final dos artefatos de execução (`test-results`, eventual `playwright-report`, arquivos de diagnóstico e SDK gerado sem uso) foi bloqueada pela revisão automática de permissões, que retornou apenas “blocked by policy”. Os arquivos que permanecem estão excluídos da publicação e não executam processos. Não foi tentada outra forma de contornar o bloqueio.

## Verificação real feita hoje

- Cloud Run respondeu HTTP 200; revisão encontrada: `confloraai-00104-mfr`.
- O backend publicado informou um provedor antigo, confirmando que a versão manual preparada localmente ainda não está no ar.
- A consulta sem login a `/api/admin/errors` foi negada com HTTP 401; isso comprova o bloqueio de acesso nessa versão, não a instalação da nova tela.
- A Meta aceitou a conexão do número de teste **+1 555-152-7087**.
- O envio final para a Conflora e o envio final para Júnior foram aceitos pela Meta. Aceitação não comprova entrega ou leitura no aparelho. As mensagens foram identificadas como testes; nenhuma venda, estoque, saldo ou fechamento real foi alterado.

O remetente continua sendo o número de teste da Meta. Ele não equivale a um número definitivo habilitado para enviar mensagens a todos os clientes. A liberação dos destinatários e a configuração de mensagens proativas precisam estar corretas antes de prometer confirmações pelo WhatsApp para o público.

## Antes da primeira venda real por Pix manual

1. Publicar os índices de expiração e a regra de retenção de erros declarados em `firestore.indexes.json`. Conferir que os índices terminaram de criar antes de habilitar a nova rotina.
2. Publicar o aplicativo e os arquivos estáticos compilados, mantendo `PIX_MODE=MANUAL`, a chave CPF válida e o titular corretos. Conferir também os segredos e os destinatários da loja e do dono no Cloud Run; o `.env` local não atualiza a publicação.
3. Conferir `/health`: a resposta precisa informar `paymentProvider: MANUAL` e a revisão nova. Conferir a tela de erros como admin e negar acesso como cliente/caixa.
4. Confirmar o armazenamento privado dos comprovantes e relatórios e a execução agendada das filas. Não ativar o Sicredi nessa etapa.
5. Fazer uma compra de pequeno valor e produto escolhido pelo responsável, pagar de verdade no banco e enviar o comprovante. O caixa confere o crédito na conta e só então aprova no site. Verificar estoque, recibo e notificações. Não simular recebimento nem aprovar um comprovante sem crédito bancário.

Para iniciar localmente após a compilação: `npm start`. Para compilar deliberadamente antes de uma entrega: `npm run build:frontend`. O diagnóstico real sem gravações pode ser repetido com `node scripts/check-live-readiness.js`; ele não cria pedidos nem envia mensagens.

## Resultado da validação local

232 testes de servidor aprovados, nenhum reprovado; um teste de emulador não executado. Foram aprovados 73 cenários de navegador. Após a retirada das consultas periódicas duplicadas, os sete cenários específicos de caixa, entregas e histórico também passaram. A conferência do histórico após ajuste da alternativa local passou nos quatro testes específicos. Build e análise estática aprovados.

Os erros artificiais usados para validar os registros ficaram somente nos ambientes isolados dos testes. Não foram inseridos no histórico real da empresa.
