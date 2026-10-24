# Vínculo Meta e atendimento humano — 23/10/2026

## Ações externas executadas sob solicitação do usuário

- Nova credencial lida do `.env`, validada pela Meta, com `catalog_management`, `business_management`, `whatsapp_business_management` e `whatsapp_business_messaging`. Token não registrado neste documento.
- Catálogo `1834176020928565`, **Catálogo de produtos CONFLORA**, confirmado no portfólio Conflora Horta e Viveiro, inicialmente com zero produtos.
- `POST /1109837771546167/product_catalogs` com o catálogo acima: `success: true`; GET posterior confirmou o vínculo. Conta é a WABA de teste, não o número real da loja.
- `POST /1346441561890238/whatsapp_commerce_settings` com `is_catalog_visible: true` e `is_cart_enabled: true`: aceito pela Meta (`success: true`). GET subsequente retornou lista vazia; a exibição no aparelho ainda precisa de homologação. Não se declara verificação visual dessas flags.
- ID do catálogo salvo no `.env`; envio de catálogo e sincronização automática ainda não ativados enquanto o catálogo está vazio e os produtos aguardam revisão.
- Nenhum produto publicado, nenhuma venda/estoque alterado e nenhuma gravação de revisão comercial feita no Firestore. Sem deploy ou alteração do callback Meta.

## Conferência dos produtos

Leitura oficial: 759 registros. Todos estão sem revisão `metaCommerceReview`. Há 81 sem imagem HTTPS, 5 inativos e 102 que acionaram a triagem textual restritiva (triagem não é conclusão legal). Categorias internas incluem TROCO DO DIA e RECEBIMENTO; Outros inclui TAXA DE ENTREGA e produtos que precisam de avaliação específica. Não publicar esses registros como produtos físicos automaticamente.

Imagens: 101 Unsplash, 410 iNaturalist S3, 167 static.iNaturalist e 81 sem imagem. Origem pública não comprova licença para republicação comercial nem representação fiel do item vendido. Nos itens de horta consultados não foram encontrados campos de licença/atribuição. Não substituir por imagens inventadas nem retirar guardas comerciais para acelerar publicação.

Os exemplos oficiais consultados de RÚCULA, ALFACE CRESPA e MOSTARDA têm estoque físico zero, mas a configuração oficial está com `stockControlEnabled: false`. Portanto, a regra comercial atual permite venda sem exigir saldo físico e a projeção considera 754 registros ativos disponíveis. Preservar essa regra; saldo zero sozinho não bloqueia venda nesse modo. Não alterar saldo nem habilitar controle para forçar outro resultado. Confirmar com a equipe quais itens realmente devem ser oferecidos antes da publicação. Preços são os existentes no backend; nomes iguais representam variantes com IDs/preços distintos e devem continuar distintos.

Relação revisável: [WHATSAPP_CATALOG_REVIEW.csv](WHATSAPP_CATALOG_REVIEW.csv), sem credenciais ou dados pessoais. Contém somente IDs e dados públicos de produtos com pendências. Primeiro lote depende de revisão das categorias, fotos/direitos e disponibilidade; em seguida usar o serviço/outbox existentes e monitorar respostas da Meta. Publicação automática ainda depende da integração preparada e de implantação autorizada do trigger, sem sincronizar tudo a cada mensagem.

## Mudança solicitada de atendimento

`btn_atendente` de template/interactive e texto equivalente agora registram `human_requested` + `NEEDS_HUMAN_ATTENTION` e retornam resposta vazia. Handoff/conversa incluem telefone e nome privado para a equipe existente. Não se envia saudação virtual nem se chama catálogo/checkout/IA nessa seleção. Mensagens posteriores, menu, novo dia e reinício não removem a pausa. Retomada permanece ação explícita autorizada.

O adaptador WhatsApp não injeta mais `AgentService` em `SalesConversationService`; o checkout determinístico e o carrinho Meta permanecem. Serviços independentes do site e fixtures isoladas são preservados. A ação do painel foi renomeada para “Retomar automação”. Nenhuma mensagem foi enviada a responsáveis externos como parte desta mudança.

Validação local: 233 testes isolados aprovados, zero falhas; ESLint/sintaxe/diff aprovados; build frontend concluído. Logs em `.private/whatsapp-diagnostics/human-handoff-tests.log`. O processo do servidor no terminal do usuário usa código já carregado: aplicar o comportamento novo requer Ctrl+C e `npm start` nessa mesma janela. O agente não encerrou o processo controlado pelo usuário nem iniciou outra instância na porta 8080.

Limitações: catálogo vinculado está vazio, publicação pendente; WABA/número ainda de teste; imagens e estoque precisam de revisão; nenhum teste de compra de produto nativo no aparelho ou produção foi declarado concluído. Atendimento humano pode ser testado após reiniciar o servidor local, sem reativação automática de conversas já pausadas.
