# Integração Oficial Conflora Horta e Viveiro & Meta Business Agent Platform

Documento técnico com arquitetura, mapeamento do banco de dados, políticas de verificação, contratos OpenAPI/JSON Schema e diretrizes de configuração do agente no Meta Business Suite.

---

## 1. Mapeamento de Campos Reais do Firestore

A fonte oficial do catálogo continua sendo a coleção `products` do Firestore existente, sem duplicação de dados, sem uso de planilhas locais e sem inferência pelo modelo.

| Contrato do Atendimento | Campos Reais no Firestore (`products`) | Regra de Resolução e Validação |
| :--- | :--- | :--- |
| **Identificador do Produto** | Document ID (`doc.id`) | Obrigatório. Usado para referenciar itens no catálogo e no carrinho. |
| **Nome Oficial** | `name`, `descricao`, `DESCRIÇÃO`, `canonicalName` | Prioridade na ordem listada. Se houver divergência entre campos preenchidos, gera bloqueio (`name_conflict`). |
| **Preço Unitário** | `price`, `valor_num`, `VALOR` | Valores convertidos para centavos inteiros (`priceToCents`). Valores <= 0 ou com mais de 2 casas decimais são rejeitados (`price_invalid`). Se houver divergência entre campos preenchidos (ex: `price` != `valor_num`), o item é bloqueado (`price_conflict`). |
| **Unidade de Venda** | `saleUnit.code`, `unit`, `unidade` | Apenas `UN` e `KG`. `UN` exige quantidades inteiras. `KG` permite fracionário com mínimo de 0.1 kg e incremento de 0.05 kg. |
| **Status do Produto** | `status`, `STATUS` | Normalizado para `ATIVO` ou `INATIVO`. Itens com status diferente de ativo são imediatamente bloqueados (`product_inactive`). |
| **Estoque e Reserva** | `stockQuantity`, `estoque`, `reservedQuantity` | Saldo disponível = `stockQuantity - (reservedQuantity || 0)`. **Importante:** Disponibilidade só é afirmada ao cliente se `store_settings/inventory.stockControlEnabled === true`. Se o controle de estoque estiver desativado ou desconhecido, o campo de disponibilidade é omitido na resposta. |
| **Apresentação / Variação** | `variation`, `variacao` | Opcional. Se ausente, a linha é omitida sem exibir placeholders. |
| **Categoria** | `category`, `categoria`, `CATEGORIA`, `subcategory` | Usado para busca explícita por categoria solicitada pelo cliente. |
| **Promoções** | `promocao`, `promoPrice`, `desconto`, etc. | **Bloqueio:** O sistema comercial atual não possui motor de vigência de promoções. Se algum campo promocional estiver preenchido, o produto é bloqueado (`promo_unverified`) até que haja regra comercial oficial cadastrada. |

### Coleções Adicionais Utilizadas:
- `agent_synonyms`: Coleção de sinônimos aprovados (`{ term, productIds: string[], approved: boolean }`). Sinônimos com `approved: false` ou ambíguos (apontando para mais de um produto) geram ambiguidade e handoff silencioso. `tagsAi` não é utilizado como fonte de sinônimo comercial.
- `store_settings/inventory`: Documento único que dita se o controle de estoque está habilitado (`stockControlEnabled: boolean`).
- `agent_pilot_carts`: Coleção isolada de carrinhos (`{ tenantId, customerKey, pilot: true, lines: [], version, ops: {} }`). Totalmente desacoplada de vendas reais, sem baixa de estoque e sem geração de Pix.
- `agent_handoffs`: Fila de atendimento humano contendo chamados abertos (`requestId`, `customerPhone`, `reason`, `metadata`, `status: 'open'`).
- `agent_conversations`: Controle de estado da automação por cliente (`{ customerKey, automation: 'active' | 'paused', handoffId }`).

---

## 2. Política de Verificação e Frescor de Dados

Toda informação comercial enviada ao cliente possui proveniência identificável:
1. **Identificador da Requisição (`request_id`):** UUIDv4 único gerado para cada chamada de ferramenta.
2. **Registro de Origem (`source`):** Documento lido no Firestore, carimbo de leitura no servidor (`read_at`) e momento da última alteração (`update_time`).
3. **Barreira Final Determinística (`Message Guard`):**
   - Bloqueio imediato de frases proibidas ("não encontrei", "aguarde", "vou verificar", reticências).
   - Bloqueio de placeholders vazios (`{{...}}`, `undefined`, `null`, `NaN`, nomes técnicos de campos).
   - Bloqueio de stack traces e caminhos de arquivo do servidor.
   - Bloqueio de preços não autorizados: todo valor monetário (`R$ X,XX`) presente na mensagem é confrontado com a lista de centavos autorizados pela regra de negócio. Se houver qualquer divergência, a mensagem é descartada e o handoff silencioso é acionado.
4. **Handoff Silencioso Absoluto:**
   - Em caso de ambiguidade, produto inexistente, produto inativo, divergência cadastral ou erro de timeout, o conector retorna `status: "handoff"`, `send_customer_message: false` e registra na fila `agent_handoffs`.
   - Nenhuma mensagem automática de desculpas é enviada ao cliente pelo conector.

---

## 3. Especificação do Conector HTTP Meta Business Agent

A integração é realizada via conector oficial HTTP da Meta Business Agent Platform (versão `2.0.0`).

### 3.1 Autenticação e Headers
- **Header Obrigatório:** `X-Conflora-Agent-Key: <META_AGENT_API_KEY>` (ou `Authorization: Bearer <TOKEN>`)
- **Headers do Servidor:** `X-API-Version: 2.0.0`, `Content-Type: application/json`

### 3.2 Macros Injetadas pela Meta
- `WHATSAPP_PHONE_NUMBER`: Injetado automaticamente no corpo no parâmetro `customer_phone`.
- `WHATSAPP_MESSAGE_ID`: Injetado no parâmetro `message_id` para garantir idempotência em operações de escrita.
- `WHATSAPP_CONVERSATION_ID`: Injetado no parâmetro `conversation_id`.

### 3.3 Ferramentas Registradas (`Tools`)

1. **`consultar_produto`**
   - **Descrição:** Consulta valor oficial, apresentação e disponibilidade de um produto ou lote de produtos.
   - **Parâmetros:** `customer_phone` (string), `query` (string, opcional), `product_id` (string, opcional), `queries_json` (string/array, opcional), `intent` ("preco" | "disponibilidade").
2. **`buscar_produtos`**
   - **Descrição:** Busca produtos por termo ou lista produtos de uma categoria solicitada pelo cliente.
   - **Parâmetros:** `customer_phone` (string), `query` (string, opcional), `category` (string, opcional), `limit` (inteiro 1 a 10).
3. **`consultar_carrinho`**
   - **Descrição:** Consulta itens atuais, quantidades, preços unitários e subtotal do carrinho do piloto.
   - **Parâmetros:** `customer_phone` (string).
4. **`adicionar_item`**
   - **Descrição:** Adiciona item ou lote de itens ao carrinho com mutação atômica e idempotente.
   - **Parâmetros:** `customer_phone` (string), `message_id` (string), `product_id` (string, opcional), `query` (string, opcional), `quantity` (número/string), `items_json` (string/array, opcional).
5. **`alterar_quantidade`**
   - **Descrição:** Ajusta a quantidade de um item já existente no carrinho.
   - **Parâmetros:** `customer_phone` (string), `message_id` (string), `product_id` (string, opcional), `query` (string, opcional), `quantity` (número/string).
6. **`remover_item`**
   - **Descrição:** Remove um item do carrinho do cliente.
   - **Parâmetros:** `customer_phone` (string), `message_id` (string), `product_id` (string, opcional), `query` (string, opcional).
7. **`preparar_finalizacao`**
   - **Descrição:** Revalida em tempo real os preços e o cadastro de todos os itens do carrinho e gera o resumo final antes do envio para a equipe.
   - **Parâmetros:** `customer_phone` (string), `message_id` (string), `price_change_token` (string, opcional).
8. **`encaminhar_atendente`**
   - **Descrição:** Registra a solicitação de transferência para atendente humano e pausa a automação.
   - **Parâmetros:** `customer_phone` (string), `message_id` (string), `reason` (string, opcional).

Catálogo OpenAPI/JSON Schema acessível no endpoint: `GET /api/meta-agent/tools-spec`.

---

## 4. Prompt de Configuração do Agente no Meta Business Suite

Copie as instruções abaixo para o campo de instruções do Agente no painel da Meta:

```text
Você é o assistente virtual da Conflora Horta e Viveiro. Seu papel é atender os clientes no WhatsApp consultando EXCLUSIVAMENTE as ferramentas oficiais integradas.

DIRETRIZES FUNDAMENTAIS:
1. NUNCA invente preços, unidades, variedades ou estoque. Se a informação não vier diretamente do retorno da ferramenta, você NÃO a conhece.
2. NUNCA envie mensagens de desculpas como "não encontrei", "aguarde um momento" ou "vou chamar um atendente" quando a ferramenta retornar status de handoff ou não encontrar o produto. Permaneça em silêncio absoluto nesses casos para que a equipe humana assuma a conversa.
3. SEMPRE que consultar um produto e obtiver retorno válido, envie ao cliente o texto pronto retornado no campo "customer_message" ou siga estritamente o formato:
   🌿 *{Nome Exato do Produto}*
   • Apresentação: {Variação ou tamanho, quando existente}
   • Valor: *{Preço} / {Unidade}*
   • Disponibilidade: {Somente se verificada no retorno}

   Você precisa de mais algum produto?

4. Para gerenciar carrinho (adicionar, consultar, alterar ou remover), use sempre as ferramentas "adicionar_item", "consultar_carrinho", "alterar_quantidade" e "remover_item".
5. Quando o cliente pedir para fechar o pedido ou verificar a compra, chame "preparar_finalizacao".
6. Se o cliente solicitar explicitamente falar com um atendente humano, chame a ferramenta "encaminhar_atendente".
```

---

## 5. Endpoints de Gestão da Fila Humana

- `GET /api/meta-agent/admin/handoffs`: Lista atendimentos pendentes na fila humana (requer perfil ADMIN, CAIXA ou VENDEDOR autenticado).
- `POST /api/meta-agent/admin/handoffs/:id/resume`: Retoma a automação para o cliente após atendimento humano concluído.
