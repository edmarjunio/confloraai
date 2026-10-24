# Diagnóstico anterior à padronização — 24/10/2026

Base `42a573c`, branch `codex/contratos-produtos`, checkout isolado. A main e seus processos não serão modificados. Nenhuma migração, mensagem real, pagamento, regra remota ou deploy é parte desta auditoria. As evidências antigas descrevem suas próprias revisões, não uma homologação desta branch.

## Causas e plano incremental

| Achado na implementação real | Evidência | Consequência | Correção planejada |
| --- | --- | --- | --- |
| JSON validado já não participa do runtime | `validated-catalog-profiles.js` ausente; busca em `src` não importa `conflora-validated-catalog.json` | A suspeita de enriquecimento ativo está desatualizada; o arquivo histórico ainda exige comparação | Comparação somente leitura e plano dry-run sem reaplicar seus dados |
| Política de foto real foi confundida com localização Storage | `actual-product-photo.js` exige `CONFLORA_ACTUAL_PRODUCT` e somente um host | Fonte externa legítima não pode ser representada; referências antigas não devem ganhar aprovação automática | Consolidar contrato de mídia com fonte e proveniência explícitas; manter leitor de fotos reais compatível |
| O diagnóstico de migração aprova por hostname | `image-migration.service.js:classifyImageStatus` marca URLs como `EXTERNAL_APPROVED`/`STORAGE_VALIDATED` sem licença/identidade | Relatório pode sugerir autorização inexistente | Classificar localização separadamente de autorização; dry-run idempotente |
| Especificações estruturadas desaparecem no Caixa | `cashier-product-details.js:firstText` aceita só strings; vitrine filtra objetos `{label,value}` | Mesmo documento produz informação diferente entre telas | Normalizador único de informações com aliases centralizados e especificações tipadas |
| Aliases e preparação repetidos | `existing-store.js:toProduct`, `/api/caixa/products`, `normalize-catalog-item.js`, `product-info-content.js`, `pdv/app.jsx` | Prioridades e galerias podem divergir | Projeções derivadas do mesmo conteúdo/mídia normalizados, sem expor documento bruto publicamente |
| Saldo físico e disponível têm nomes pouco claros | Caixa retorna `stockQuantity`; vitrine desconta `reservedQuantity` | Diferença funcional válida pode parecer erro | Contrato explícito para físico/reservado/disponível, preservando cálculo transacional |
| Paginação visual não reduz leitura | `existing-store.js` e inventário chamam `getAllProducts` antes de `slice` | Custo cresce com catálogo completo | Cursor real no repositório, listagens leves e detalhes por ID, migração dos consumidores junto dos filtros |
| Escritas administrativas precisam de revisão concorrente | `saveProduct` usa merge fora de transação, salvo condição de imagem | Formulário antigo pode reenviar campos comerciais obsoletos | Mapear produtores, preservar atualizações parciais e acrescentar precondições proporcionais, sem reescrever financeiro |
| Documentação contraditória | `ARCHITECTURE.md` diz scaffold Functions; `WHATSAPP_IMPLEMENTATION.md` ainda descreve agente virtual; arquitetura atual descreve humano | Instruções operacionais antigas podem induzir erro | Documento atual de autoridade com marcação de registros históricos |

## Limites preservados

Pedidos guardam snapshots históricos legítimos dos itens; não devem ser recalculados com o produto atual. Saldo de estoque é transacional, cache não autoriza venda. `stores/{tenantId}` continua isolado das coleções da Conflora. Pix Sicredi manual, simulador isolado e integração real pendente permanecem. Testes e fixtures não entram no runtime/deploy.

## Sequência de commits

1. Diagnóstico, inventário de consumidores e auditoria somente leitura.
2. Conteúdo e mídia canônicos, adaptação dos consumidores e testes de compatibilidade.
3. Leituras/escritas, invalidação e paginação efetiva, mantendo APIs legadas justificadas.
4. Validação isolada, matriz individual de AGENTS, relatório, rollback e PR revisável.

Sessão funcional/performance iniciada expressamente anteriormente pelo usuário. A continuidade usa somente testes isolados; não se deduz autorização pela data. Operações remotas desta fase limitam-se às consultas solicitadas. Qualquer migração real precisa de aprovação adicional.
