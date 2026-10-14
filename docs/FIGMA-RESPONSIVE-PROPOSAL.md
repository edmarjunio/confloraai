# Conflora — proposta responsiva

[Abrir projeto no Figma](https://www.figma.com/design/ixVGq8mtkZnuAbregH28Ss)

## Entrega atual

30 telas em três larguras (1440, 768 e 390 px), totalizando 90 layouts editáveis. Fonte Inter, cores da Conflora e controles reutilizáveis importados do Simple Design System. Valores e cadastros demonstrativos. O site em produção não foi alterado.

Cliente: catálogo, produto, assistente, sacola, checkout, confirmação, pedidos, login, cadastro e estados de feedback.

Operação: PDV, abertura, pagamento, comprovante, vendas em espera e fechamento de caixa.

Gestão: visão geral, vendas, detalhe de venda, produtos, edição de produto, estoque, movimentação, clientes, detalhe de cliente, financeiro, equipe, convite, configurações e assistente.

## Regras para implementação

- Menos de 768 px: navegação inferior, margem de 20 px, painéis empilhados e botões principais de largura total. Suportar telas de 320 px sem rolagem horizontal.
- Entre 768 e 1199 px: margem de 32 px, navegação compacta, catálogo em duas colunas e resumo abaixo dos itens.
- A partir de 1200 px: barra lateral de 220 px na operação e gestão; itens e resumo do PDV lado a lado; catálogo em três colunas.
- Usar CSS Grid com minmax e Flexbox para adaptar larguras intermediárias. Pranchetas Figma são referências; não comprovam responsividade funcional.
- Alvos de toque de pelo menos 44 px; rótulos explícitos, foco visível e navegação por teclado. Não comunicar status apenas por cor.
- Formulários de desktop devem ter largura de leitura limitada na implementação. Não esticar campos de dados curtos desnecessariamente.
- Confirmar ações destrutivas e mostrar motivo de cancelamento. Permissões devem ser verificadas no servidor.
- Não confundir pedido recebido com pagamento confirmado. Pix e cartão precisam de confirmação confiável; a interface não pode marcar pagamento só ao exibir uma chave.
- A confirmação do checkout deve usar idempotência e impedir duplo envio. Preservar sacola e dados após erro recuperável.
- Utilizar imagens reais do catálogo, com proporção consistente e texto alternativo. Os layouts atuais são estruturais e ainda não incluem fotografia dos produtos.

## Pendências explícitas

O limite de chamadas do Figma MCP no plano Starter interrompeu a entrega após a tela de estados. Faltam: entrega/endereço e recuperação de acesso nas três larguras; conectar navegação do protótipo; revisão visual completa; componentes locais para cartões e linhas repetidas; refinar tabelas de desktop e fotos de produto. O catálogo móvel foi inspecionado visualmente e seu cabeçalho corrigido, mas não houve revisão visual pós-correção por causa do limite.

Os IDs das telas e ligações planejadas estão em `figma-responsive-design-state.json`. Não recriar as telas já existentes ao retomar.
