# Zustand + TanStack Query

## Visão arquitetural

A entrada `src/web/app/main.jsx` instala um único `QueryClientProvider`. As telas continuam em componentes por domínio. Formulários, modais e filtros permanecem em estado local React.

| Responsabilidade | Implementação |
| --- | --- |
| Carrinhos por loja/operador | `state/cart-store.mjs`, Zustand vanilla com hook seletor em `cart/useCart.mjs` |
| Tentativa de venda e recuperação | `state/sale-store.mjs`, Zustand, persistência do identificador e intenção |
| Preferência de idioma | Store Zustand em `i18n/runtime.mjs`, mantendo `.tr` |
| Sessão autenticada | TanStack Query em `auth/SessionProvider.jsx` |
| Produtos, pedidos, configurações, relatórios | `useResource`, adaptador pequeno sobre `useQuery` |
| Operações de escrita | `useAction`, adaptador sobre `useMutation` |
| Consulta Pix | `pdv/usePixStatus.mjs`, `useQuery` com intervalo condicional |

As factories `createCartStore`, `createSaleStore` e `createQueryClient` permitem testar cada responsabilidade isoladamente. Os hooks selecionam o estado necessário; os componentes não acessam diretamente o armazenamento. O formato dos carrinhos antigos permanece compatível. Tentativas antigas contendo um pedido completo são convertidas em referências, descartando o estado de pagamento armazenado localmente.

## Cache e isolamento

Cada consulta de recurso usa uma chave `[tipo, loja, usuário:perfil, recurso, parâmetros...]`. Datas, identificadores e outros filtros que afetam a resposta devem fazer parte da chave. Duas telas que consultam a mesma chave compartilham cache e requisição em andamento. Os padrões são 30 segundos de validade e 5 minutos de retenção após a última tela sair.

Login/logout cancelam as consultas em andamento e removem dados privados do cache. A sessão não é armazenada em localStorage. A autorização continua nos endpoints do backend; os stores não concedem permissões.

Após escrita bem-sucedida, os recursos são invalidados. Consultas ativas são atualizadas, sem cancelar outra atualização já em andamento. Falhas 4xx não recebem repetição automática; falhas transitórias de leitura podem repetir uma vez. As mutações não têm retry nem fila automática de reenvio ao reconectar.

Exemplo para uma nova tela:

```jsx
const orders = useResource(
  signal => request(`/api/orders?date=${date}`, { signal }),
  ['orders', date],
);
const save = useAction();
```

Não copie respostas da API para Zustand. Use Zustand para estado local compartilhado e `useState` para detalhes exclusivos de um componente. A fachada `useResource` preserva `data/loading/error/refresh`, facilitando alterações de tela sem espalhar regras de cache.

## Pix: fonte de verdade

1. Zustand grava a chave da tentativa antes do POST. A repetição explícita mantém essa chave.
2. A resposta do servidor entra no cache Query, enquanto Zustand persiste apenas referência do pedido/aprovação e intenção da venda.
3. Ao recarregar, Query busca o pedido novamente no backend. A consulta Pix não utiliza `initialData` persistido como aprovação.
4. O Pix é consultado a cada 5 segundos; após falha, o intervalo passa a 15 segundos. A consulta automática para quando o backend informa `PAGO`.
5. A confirmação invalida pedidos, estoque e relatórios. A transação financeira continua no backend Sicredi; nada é baixado diretamente no navegador.

Cancelamento usa o sinal fornecido pelo Query, combinado com timeout da API. O botão de consulta compartilha a requisição em andamento. Credenciais, certificados e evidências bancárias não são persistidos pelos stores.

## Execução e validação

```sh
npm run build
npm run lint:web
npm run test:state
npm run test:state:e2e
npm run test:dev
```

O navegador de testes usa Edge, um servidor local e dados isolados. Pix é simulado nesses testes; não há movimentação financeira nem envio real de WhatsApp. As rotas principais React são instaladas em `src/http/react-frontend.js`. O projeto mantém páginas legadas de políticas/simulador fora desta migração de estado.

O build gera `public/react` e os shells HTML. Execute-o antes de iniciar/publicar o serviço; `npm run dev` também executa o build. Esta alteração não publica o aplicativo nem substitui a homologação bancária.
