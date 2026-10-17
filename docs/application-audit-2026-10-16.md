# Validação local do aplicativo — 16/10/2026

## Ambiente e alcance

Aplicativo localizado em `C:/Users/Junin/confloraai`. A subpasta
`confloraai/` contém apenas um README de outro checkout.
Testes usam repositórios em memória e integrações simuladas. Nenhum pagamento,
envio real de WhatsApp, consulta a IA paga ou gravação de produção foi solicitado.

## Correções e organização

- Carrinho persistido: entradas nulas e inválidas são descartadas sem interromper
  a loja; produtos repetidos são consolidados por ID usando Map. Só ID e quantidade
  são recuperados; preço continua vindo do catálogo, com validação final no servidor.
- A normalização foi extraída para `public/storefront/cart-storage.mjs`, função
  pura independente da interface e coberta por testes de dados corrompidos.
- Catálogo e busca guiada agora compartilham a mesma normalização de texto,
  eliminando uma implementação duplicada.
- Teste do PDV importa TextDecoder explicitamente do Node, corrigindo o lint.
- Dois testes do chat foram atualizados para o nome acessível atual da ação de
  adicionar produto. Não foi necessário alterar a ação da interface.
- Novos testes de navegador verificam recuperação do carrinho, ausência de erros
  JavaScript e ausência de rolagem horizontal em 320, 390, 768 e 1440 pixels.

## Evidências

- Execução final completa após as alterações: **178 testes de lógica e 26 testes
  de navegador aprovados**, sem falhas.
- Revalidação intermediária após compartilhar a normalização da busca: 13 testes
  de navegador aprovados.
- Suíte de lógica inicial: 176 testes aprovados, nenhuma falha.
- Novos testes de persistência: 2 aprovados.
- Busca guiada após remoção da duplicação: 3 testes aprovados.
- Navegador inicial: 20 aprovados e 2 falhas por seletores desatualizados.
- Revalidação dos dois fluxos, catálogo, administração e novas resoluções:
  8 testes aprovados, nenhuma falha.
- Lint e verificação de sintaxe completos aprovados; módulos da loja verificados
  novamente após a correção do carrinho.

Os fluxos existentes incluem cliente, vendedor, Caixa, Admin, estoque, pedidos,
pagamento dividido, Pix simulado, histórico, recibos e isolamento entre lojas.
Os testes de navegador usam Chromium; larguras móveis não equivalem a testes em
aparelhos físicos, Safari/iOS ou todos os navegadores.

## Manutenção: dívida técnica observada

A aplicação tem componentes compartilhados e camadas de serviço/repositório,
mas ainda não está integralmente componentizada. `src/http/app.js` concentra
muitas rotas; `views-admin.js` e `views-home.js` mantêm documentos extensos com
interface e scripts embutidos. Também existem componentes React em
`src/components/` e componentes da loja em `public/storefront/`.

Próxima etapa arquitetural: mapear as entradas efetivamente servidas, separar
rotas por domínio preservando autenticação e contratos HTTP, extrair scripts das
views e consolidar componentes e regras entre interfaces. Fazer por módulo,
mantendo cobertura funcional a cada extração. Esta auditoria não certifica
ausência de toda duplicação nem conclui essa migração estrutural.

## Limites da validação

Sicredi real depende da autorização, certificado e credenciais bancárias.
Google real, WhatsApp, IA e persistência Firestore de produção precisam de
validação própria de integração. Aprovação local não comprova disponibilidade,
desempenho sob carga ou configuração dos serviços publicados.
