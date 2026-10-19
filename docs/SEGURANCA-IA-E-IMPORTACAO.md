# IA, cache e importação — Conflora

Implementação local revisada em 18/10/2026. Esta alteração ainda não foi publicada.

## Arquitetura e fluxo de dados

O navegador usa `ConfloraSession.apiFetch`. Esse cliente envia a credencial da aba somente para a API da própria loja, sem substituir `window.fetch`. Login, logout, acompanhamento de pedidos e abertura de comprovantes mantêm a sessão da aba. As lojas com endereço `/shop/` preservam sua autenticação separada.

No chat principal, o navegador envia `message` e `history` para `POST /api/chat` e recebe somente `{ "reply": "..." }`. O adaptador da interface apresenta essa resposta na conversa. A rota anterior continua disponível para compatibilidade; ela retorna também os produtos e as fontes públicas. Nenhuma dessas respostas inclui a instrução interna da IA.

O SDK Gemini permanece como dependência do servidor: removê-lo do projeto inteiro impediria as chamadas do backend. As instruções, credenciais, importação e validações definitivas de venda permanecem no Node.js. Os cálculos visuais do carrinho servem para apresentar uma estimativa; o servidor determina os valores aceitos e a reserva de estoque.

O código público foi inspecionado para referências a `@google/genai`, `GEMINI_API_KEY` e `systemInstruction`. Nenhuma foi encontrada. O arquivo local de ambiente não contém variáveis com prefixo `VITE_` ou `REACT_APP_`. Não foi criada uma chave mestra administrativa para o navegador: a importação exige uma sessão com cargo ADMIN.

As credenciais de IA continuam sendo configuradas somente no servidor: `GEMINI_API_KEY` é opcional; sem ela, o cliente usa a identidade do serviço no Vertex AI. `GEMINI_MODEL` seleciona o modelo existente. O modelo padrão de configuração da vitrine usa `STOREFRONT_CHAT_MODE=GUIDED`; `AI` seleciona o modo generativo quando não há uma configuração salva da loja que prevaleça. Esta refatoração preserva o modo atual e não ativa consumo de IA por conta própria. A presença de uma credencial no ambiente não equivale à sua homologação em produção.

## Cache e custos

- O catálogo de atendimento possui validade de dez minutos por processo, inclusive quando está vazio.
- Mensagens simultâneas compartilham a consulta em andamento.
- Edições, remoções, ajustes administrativos e importações invalidam o cache do processo que atende a alteração. Uma importação parcialmente concluída também causa invalidação.
- Uma leitura iniciada antes da edição não pode publicar uma versão anterior depois da invalidação.
- A vitrine, a conferência de preço e as transações de estoque continuam usando seus fluxos de consulta e validação existentes. O cache de atendimento não autoriza uma venda.
- Em várias instâncias do servidor, outra instância pode manter a referência antiga até vencer o prazo de dez minutos. A invalidação em memória não é uma transmissão entre servidores.

O chat aceita até 800 caracteres por mensagem. Envia ao modelo as últimas seis mensagens do histórico, com até 600 caracteres cada. Cada chamada de resposta usa temperatura 0,3 e limite de saída de 400 tokens.

Na consultoria da vitrine, somente até doze produtos relacionados são incluídos no contexto. Sem pesquisa externa, há uma chamada ao modelo. Com pesquisa externa habilitada pelo administrador, há uma chamada de pesquisa e outra de seleção, ambas limitadas. O atendimento por WhatsApp também limita mensagem, histórico e saída. A consultoria botânica possui limite de mensagem e resposta e usa produtos relacionados.

`POST /api/chat` compartilha a proteção de oito tentativas por minuto por IP usada nas rotas de IA. Em produção, os contadores usam o banco; no ambiente isolado, memória. A origem do endereço IP depende da configuração de proxy já existente.

Não foram medidas reduções de 95% de leituras ou 50% de tokens. O ganho real depende de tráfego, quantidade de produtos, instâncias e uso de pesquisa externa. A validação executada comprovou uma leitura para vinte consultas simultâneas ao cache, sem acessar o banco real.

## Uso da importação

1. Entre como administrador e abra **Produtos → Importar planilha de produtos**.
2. Escolha CSV UTF-8 ou JSON: até 1 MB e 2.000 produtos.
3. Gere a prévia e confira nomes, preços, unidades e estoques.
4. Confirme a importação. Os lotes são processados no servidor com validação e registro de progresso.
5. Se houver interrupção, reenvie o mesmo arquivo. A operação retoma os lotes pendentes, sem duplicar produtos nem restaurar estoques já movimentados.

O modelo CSV continua disponível na janela. Exemplo de JSON aceito:

```json
[
  {
    "sku": "HORTA-001",
    "name": "Alface",
    "price": 4.5,
    "category": "Horta",
    "unit": "UN",
    "stock": 20,
    "active": true
  }
]
```

Unidades: `UN` ou `KG`. Preços devem ser positivos, com até duas casas decimais. Estoques em UN são inteiros; em KG aceitam até três casas. Não use separador de milhar. Códigos existentes não são substituídos por outra importação. O campo `id` fornecido no arquivo não determina o documento de destino: o servidor gera o identificador pelo código normalizado.

Para integração autenticada, a prévia aceita `POST /api/admin/import-products/preview`, com `{ "products": [...] }` ou `{ "csv": "..." }`. A confirmação usa `POST /api/admin/import-products`, com o mesmo conteúdo e o `importId` retornado pela prévia. As URLs antigas de importação continuam funcionando.

## Uso do chat e proteção do navegador

Ao enviar, a interface mostra imediatamente a mensagem e o indicador de espera. Enter envia; Shift+Enter preserva o comportamento do campo; Escape limpa o campo sem fechar a conversa. Composição de texto pelo teclado não dispara envio antecipado.

O build do caixa usa minificação, remoção de `debugger` e `sourcemap: false`. As páginas não redefinem o `fetch` da janela ou de seus protótipos. O histórico de erros continua ativo e não é removido pela compilação.

F12 ainda permite observar o código e os dados públicos recebidos pelo navegador. Minificação dificulta a leitura, mas não é controle de acesso. Instruções contra extração de prompt reduzem o risco, porém não garantem sigilo absoluto do comportamento de um modelo. Por isso, as instruções não contêm credenciais e a IA não executa checkout nem altera estoque.

## Conferência executada

- Sintaxe dos arquivos alterados e dos módulos da vitrine: aprovada.
- Compilação do caixa e verificação de estilo: aprovadas.
- Verificações dirigidas de catálogo, limites de IA, isolamento de lojas, importação e consultoria botânica: aprovadas.
- Navegação, largura do caixa, erros de cadastro, perfil, histórico de erros, sessões em duas abas e importação CSV: dez cenários de navegador aprovados.
- Importação CSV e JSON pela interface: dois cenários adicionais aprovados.
- Chat: envio imediato, contrato público sem campos internos, Enter e Escape conferidos no navegador com resposta simulada.
- Nenhuma suíte completa foi executada em ciclo e nenhum processo de teste foi deixado acompanhando arquivos.

Essas verificações usam banco e respostas de IA isolados. Não comprovam entrega de mensagens reais, disponibilidade do Gemini em produção ou homologação bancária. Esta alteração não publica o site e não ativa o Sicredi.
