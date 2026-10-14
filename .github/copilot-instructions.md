# Diretrizes de Arquitetura e Economia de Créditos (FinOps) - Conflora

## 1. Mapa de Arquitetura (Não pesquise a árvore inteira à toa)
- **Vitrine Pública (Storefront):** `public/storefront/catalog.js`, `public/storefront/product-entry.js` e `public/storefront/store.css`.
- **Painel Admin Principal (Operação Conflora - rota `/admin`):** Renderizado em `src/http/views-admin.js` com estilos em `public/admin-shell-v1.css` e endpoints em `/api/admin/*` (ex: `/api/admin/inventory-settings`).
- **Editor SaaS Multi-tenant:** `public/storefront/admin.js` (endpoints `/api/storefront/*`). **NÃO** edite este arquivo quando a tarefa for para o Admin principal da Conflora, a menos que seja explicitamente solicitado.

## 2. Regras Estritas de Execução e FinOps (Obrigatório)
- **PROIBIDO Playwright / Browser Server sem pedido explícito:** NUNCA execute Playwright, testes de navegador headless ou comandos bloqueantes como `node test/browser-server.js` ou `npm run dev`. O próprio desenvolvedor faz a validação visual no navegador.
- **Leitura antes da Edição:** Sempre leia o bloco exato de linhas (ex: 30 linhas antes e depois) antes de aplicar um patch para evitar erros de sintaxe e retrabalho.
- **Validação Única no Final (Batch Check):** Faça TODAS as edições necessárias em JS e CSS primeiro e execute o validador (`node --check <arquivo>` ou `node scripts/check-storefront.js`) **APENAS UMA VEZ** ao final de todas as edições.