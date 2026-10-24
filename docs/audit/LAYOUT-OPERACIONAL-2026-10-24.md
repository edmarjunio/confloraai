# Ajustes operacionais de apresentação — 24/10/2026

Escopo: Caixa, Comandas, Entregas, atalhos por perfil, preferência de alertas e resolução de imagens. Continuação na branch `codex/contratos-produtos`/PR #14 sobre `e0ff7ec`. Sem deploy, merge na main, gravação Firestore, upload Storage ou mensagens reais.

## Mudanças observáveis

| Problema | Correção e caminho real |
| --- | --- |
| Imagem aparece na vitrine e some no Caixa | `toPdvProduct` agora usa diretamente `ConfloraProductCard.getImageCandidates`, o mesmo resolvedor do catálogo. Retirado o filtro adicional por domínio no adaptador do PDV. Mantém o contrato `media` recebido do backend, sem aprovar fotos desconhecidas. |
| Aviso de dados salvos ocupando a vitrine | Removida a frase solicitada no estado de cache válido. Avisos de falha, offline e revalidação continuam; cache, TTL e autoridade comercial não foram alterados. |
| Alertas dependiam do botão de permissão | Alertas dentro do Caixa/Comandas ficam ligados por padrão. Controle explícito permite desligar/religar e preserva a preferência por usuário/perfil. Permissão nativa permanece opcional e depende de clique; não existe concessão automática pelo site. |
| Som na tela de venda | Reaproveitado o tocador existente nas chegadas de pedidos, respeitando mute/preferência e evitando duplicar o som da tela de Comandas. Reprodução continua sujeita à interação/política de áudio do navegador. |
| WhatsApp comprimido | Coluna própria com largura limitada e flexível; etapas em grade ao lado. No celular, abas existentes mostram Comandas ou WhatsApp usando a largura disponível. |
| Comandas com rolagem horizontal | Grade responsiva e rolagem vertical da página. Nada é escondido por simplesmente cortar overflow. Colunas vazias são compactas; no resumo móvel de pendentes não ocupam cartões inteiros. Filtro permite consultar cada etapa e concluídos. |
| Métricas fixas cobrindo o trabalho | Resumo recolhível: lateral no desktop e bloco compacto no celular. Mesmos valores e cálculos existentes. |
| Entregador via “Minha conta” em vez de Entregas | “Minha conta” do cliente deixa de ser mostrado simultaneamente para entregador. Evita sobreposição dos dois controles na mesma posição da grade móvel. Mantém o botão laranja de Entregas e as permissões do perfil. |
| Entregas sem retorno | Link “Início” com `href="/"`, independente do histórico. Regra global que escondia `.cf-back-button` foi restrita à vitrine; não esconde mais navegação das telas da equipe. |
| Botões móveis desalinhados | Grades explícitas para cabeçalho e busca; alvos de 44 px; ações dos cards alinhadas; respiro para a barra de sacola. Testadas larguras de 320 e 390 px. |

## Preservações e limites

- Carregamento existente: shell primeiro, recursos secundários sob demanda, cache público com revalidação, cards preservados durante atualização, lazy loading e limpeza de listeners. Não foi trocado por nova estratégia de consultas ou carregamento. Não se afirma equivalência à implementação interna do YouTube.
- Nenhuma consulta, fila, assinatura de stream ou mecanismo de polling adicional foi criado para o layout/alertas. A preferência grava somente on/off no armazenamento do navegador, sem dados comerciais; os canais existentes continuam deduplicando eventos e encerram na troca de usuário.
- O filtro de etapas só seleciona a apresentação de dados já recebidos. Não altera status, pedidos, comanda, entrega, Pix, Sicredi, saldo, preços ou estoque.
- A resolução da imagem é única; ela não prova os direitos nem a correspondência de cada foto. Fotos pendentes de proveniência permanecem pendentes. A auditoria de dados anterior não foi reexecutada nem suas contagens apresentadas como novas.
- Capturas fornecidas são do ambiente hospedado. Os ajustes desta branch não aparecem lá até uma publicação autorizada. Nenhuma publicação foi feita para validar as telas.

## Verificação

Testes de regressão preparados/executados em `test/loading/browser.spec.js` usando HTTP em processo, repositório em memória restrito a teste e imagens de fixture. Cobrem largura mínima da coluna WhatsApp, ausência de overflow horizontal, resumo recolhido, atalho por perfil, retorno à home, preferência de alertas após reload, botões alinhados em 320/390 px e imagem realmente renderizada com a mesma URL na vitrine e no PDV. O teste exclusivo de celular é ignorado no projeto desktop por definição, não por falha do recurso.

Suite dedicada de notificações: três testes aprovados, incluindo deduplicação, botão de detalhes e ausência de solicitação automática de permissão. Suite Node pertinente: 17 aprovados, zero falhas. Build local e lint também foram executados. O resumo final da execução de navegador e checagens está em `LAYOUT-validation.json`; logs e capturas de laboratório ficam em diretórios ignorados. Os tempos de teste não são métricas de carregamento da loja; LCP/INP/CLS e homologação em Safari/iPhone real continuam pendentes.

Arquivos de produção alterados: `public/pdv/app.jsx`, `components.jsx`, `delivery.jsx`, `styles.css`; `public/storefront/app.js`, `browser-notifications.js`, `order-notifications.css`, `site-header.css`. Fixtures/testes não entram no bundle de produção.

Rollback: reverter o commit de apresentação em uma branch de revisão e recompilar os assets. Nenhum dado remoto precisa ser desfeito. A preferência local on/off pode permanecer armazenada, sem impacto financeiro. A missão anterior de paginação integral e revisão de mídia continua registrada no relatório global e não é declarada concluída por estes ajustes de layout.
