# Compatibilidade e migração

Nenhuma migração de dados em produção é requisito desta mudança. Não há renomeação de coleções/campos, exclusão de pedidos ou recomputação de valores históricos.

1. Publicar somente após autorização e homologação isolada descritas em `DEPLOYMENT_GUIDE.md`.
2. Confirmar contratos e amostras de pedidos legados, incluindo compras por telefone sem ID de produto. Registros ambíguos exigem atendimento humano; nunca escolher um produto por aproximação no fechamento.
3. Novos rascunhos ficam em `sessions.orderDraft`. Legado pendente pode ser lido e copiado ao editar, mantendo o documento original. Pais `sessions` não recebem TTL.
4. Novos pedidos WhatsApp possuem ID independente e origem `WHATSAPP_BOT`, reconhecida pelo caixa/recebimento. Não existe duplicação de venda por telefone.
5. IDs de outbox, inbox, eventos e notificações permanecem estáveis. Não limpar marcadores concluídos para “liberar espaço”.

## Rollback

Antes de qualquer implantação, conservar revisão/imagem anterior, configuração de ambiente e exportação/PITR conforme política já existente. O rollback de aplicação não exige exclusão de documentos novos.

Se já houver pedidos WhatsApp novos ou rascunhos em `sessions`, um rollback completo para a main anterior esconderia esses dados nas telas antigas. Nessa situação manter o leitor de rascunhos e a compatibilidade `COMMERCIAL_SOURCES`, pausar o atendimento automático e reverter somente o componente defeituoso. Não copiar de volta carrinhos para `orders/{phone}` nem baixar estoque para “reconstruir” vendas.

Reversão ampla sem esse patch de compatibilidade só é segura antes de qualquer escrita pelo novo fluxo. A compatibilidade de uma versão de rollback deve ser testada com uma cópia isolada dos formatos reais. Não houve execução de backup, restauração ou migração remota nesta tarefa.
