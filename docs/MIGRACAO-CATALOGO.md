# Migração do catálogo da Conflora

Em 18/10/2026, foram removidos os 742 documentos da coleção `products` do projeto `confloraai`. A contagem final foi zero e a consulta pública pelo Hosting e Cloud Run também retornou zero produtos. Nenhum produto tinha reserva ativa no momento da operação.

Vendas, clientes, saldos, dívidas, comprovantes, relatórios, movimentos históricos e arquivos de imagens não foram apagados. As fotos foram preservadas para não destruir material útil na migração e na recuperação do catálogo antigo.

## Cópias de segurança

- Arquivo privado local: `.private/backups/catalog-before-reset-2026-10-18T18-13-29-346Z.json`.
- Arquivo no Firestore: `catalog_archives/2026-10-18T18-13-29-346Z/products`. Essa cópia preserva os tipos originais do banco e não é usada como catálogo de venda.
- O histórico de conclusão está no documento pai `catalog_archives/2026-10-18T18-13-29-346Z`.

Não restaure a cópia antiga sobre o catálogo atualizado sem planejamento: isso pode reintroduzir preços e estoques anteriores. O utilitário `scripts/reset-product-catalog.js` faz diagnóstico por padrão; `--apply` só deve ser usado numa limpeza deliberada e autorizada. Ele não deve entrar na inicialização ou na publicação.

## Como importar os dados atualizados

No aplicativo novo: Admin → Produtos → Importar planilha de produtos → Baixar modelo CSV. Preencha o arquivo e salve CSV UTF-8. O [manual da equipe](MANUAL-EQUIPE-CONFLORA.md) detalha cada coluna e passo.

A mesma janela aceita JSON como lista de produtos, usando a mesma prévia e confirmação. O [guia de IA e importação](SEGURANCA-IA-E-IMPORTACAO.md) contém um exemplo e as regras do formato.

A importação admite até 2.000 linhas e 1 MB. Exige código único, nome, categoria, unidade UN/KG, preço positivo e estoque válido. Não depende de uma conta, link de planilha ou sincronização externa. Não importa fotos pelo arquivo.

Primeiro é apresentada a prévia; somente a confirmação escreve no banco. A gravação usa lotes de até 200 produtos com identificação do arquivo e da conta administrativa. Se um lote falhar, podem existir produtos já salvos; reenviar o mesmo arquivo retoma a operação sem duplicar ou regravar o estoque das linhas concluídas. Código já existente de outro arquivo deve ser corrigido pela edição no sistema.

A limpeza já foi executada no banco real. A nova tela de importação e as demais mudanças de código ainda dependem de publicação. O sistema remoto pode continuar exibindo a interface antiga até essa publicação e a atualização do cache do navegador.
