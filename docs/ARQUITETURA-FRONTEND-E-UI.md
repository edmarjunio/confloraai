# Arquitetura de interface e plano de manutenção

## Como o app funciona hoje

O projeto ainda não tem um único runtime de frontend. Ele combina três superfícies:

1. **Loja:** módulos JavaScript nativos em `public/storefront`, com componentes DOM e folhas CSS.
2. **Caixa:** React carregado no navegador a partir de `public/pdv`, além de uma implementação React antiga em `src/components/PdvCaixa.jsx`.
3. **Admin/Gerencial:** HTML criado por funções Node em `src/http/views-admin*.js`, com scripts no próprio HTML.

O servidor Express atende essas telas, aplica regras de acesso e conecta pedidos, catálogo, pagamentos, WhatsApp e Firestore. As telas acessam os endpoints; as regras de negócio e as permissões devem continuar no servidor.

## Fundação compartilhada adicionada

`public/storefront/design-system.css` centraliza tokens da marca e os estilos comuns de cartão (`<cf-card>`), botão (`.cf-button`) e lista (`<cf-list>` / `<cf-list-item>`). Loja, caixa, admin e gerencial carregam a mesma folha. Os cartões de produto da loja/caixa, cartões de comanda, cartões de métrica e listas do carrinho/recibo já usam os primitivos; cartões de áreas antigas devem ser migrados por tela, preservando seus estados e interações.

Exemplos:

```html
<cf-card padding="md">Conteúdo reutilizável</cf-card>
<cf-list><cf-list-item>Uma linha</cf-list-item></cf-list>
<button class="cf-button" data-variant="secondary">Voltar</button>
```

Para mudar a aparência base dos cartões, edite os tokens `--cf-*` e as regras `cf-card` no CSS compartilhado. O cartão padrão controla superfície, borda, raio e sombra; os componentes de cada tela controlam só o layout interno. A migração dos cartões antigos restantes deve substituir gradualmente o estilo local pelo componente; não é seguro apagar as classes de todas as telas em uma única mudança, porque algumas também definem layout e estados operacionais.

## Fluxo de dados e custo

```text
Navegador → Express/rotas → serviços de domínio → repositórios → Firestore/integrações
    ↑                 ↓
    └──── estado visual local / respostas de API ────┘
```

- O navegador não deve calcular autorizações, preços definitivos, estoque ou confirmação de pagamento.
- O cache TanStack Query deve ser usado para compartilhar respostas e controlar `staleTime`/invalidação sem repetir leituras do Firestore.
- Zustand deve guardar estado de interface e carrinho local; não deve copiar indiscriminadamente catálogos inteiros ou dados que já vivem no cache de consultas.
- Gemini só deve ser chamado por ações explícitas e com entradas pequenas. Não gerar descrições automaticamente em cada renderização ou consulta do catálogo.
- Leituras em lote, paginação e índices devem preceder qualquer tela que busque todo o histórico ou catálogo sem limites.

## Próximas etapas recomendadas

1. Criar componentes semânticos únicos para `Card`, `Button`, `Field`, `PageHeader`, `DataList`, `EmptyState` e `StatusBadge`; migrar uma tela por vez e remover classes duplicadas depois de comparar visualmente.
2. Consolidar o PDV: escolher `public/pdv` como versão oficial ou migrar para módulos React buildados; remover a implementação antiga apenas depois de confirmar que nenhuma rota a utiliza.
3. Adotar Vite ou ferramenta semelhante para compilar React e CSS localmente. Isso reduz dependência de Babel/Tailwind CDN em produção, permite imports tipados e melhora cache e previsibilidade de deploy.
4. Separar `views-admin*.js` em layouts, componentes e serviços de tela. Evitar HTML extenso dentro de funções Express.
5. Definir contratos TypeScript ou JSON Schema para produtos, usuários, pedidos, pagamentos e respostas de API; validar no limite HTTP e no Firestore.
6. Adotar TanStack Query em consultas remotas com chaves por loja/usuário/período, paginação e invalidação após mutações. Medir leituras para evitar custo e vazamento de dados entre contas.
7. Definir permissões no servidor por papel e escopo, com testes de isolamento para CAIXA, VENDEDOR e ADMIN. A UI pode esconder ações, mas não substitui autorização.
8. Adicionar telemetria sem dados pessoais: erros de API, latência, falhas de imagem, pagamentos pendentes e falhas na fila do WhatsApp.
9. Criar catálogo de tokens e documentação de componentes com exemplos. Mudanças de cor, espaço, radius e estados devem começar no design system.
10. Fazer refatorações pequenas, com comparação visual e testes direcionados; evitar transformar toda a aplicação junto com mudanças financeiras ou de estoque.

## Guia rápido para localizar alterações

| Quero mudar | Arquivo inicial |
|---|---|
| Tokens e aparência base de cartão/botão/lista | `public/storefront/design-system.css` |
| Loja e cartões de produto | `public/storefront/catalog.js`, `public/storefront/store.css` |
| Caixa e atalhos | `public/pdv/app.jsx`, `public/pdv/components.jsx` |
| Administração | `src/http/views-admin.js` |
| Relatório gerencial | `src/http/views-admin-gerencial.js` |
| Rotas e integração entre telas e serviços | `src/http/app.js`, `src/http/pdv.routes.js`, `src/storefront/routes.js` |
| Regras de catálogo e produto | `src/catalog` |
| Regras de pedido/pagamento | `src/orders` |
| Persistência | `src/database` |
| Estado visual e carrinho React | `src/state` |

