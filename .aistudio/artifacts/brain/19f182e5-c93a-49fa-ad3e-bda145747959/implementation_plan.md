# Fluxo de Entregas Conflora: Cargo de Entregador, Mapa no Checkout e Navegação Guiada

Implementação completa do fluxo de entregas da Conflora, conectando a seleção precisa de localização pelo cliente no checkout (mapa interativo, GPS atual e busca de endereço) à fila de despacho e navegação guiada para o novo cargo de **Entregador** dentro do painel `/caixa`.

### User Review & Critical Decisions

> [!IMPORTANT]
> As decisões abaixo foram alinhadas e confirmadas para guiar a implementação:

- **Localização do Cliente no Checkout**: Mapa interativo integrado ao escolher a opção **Entrega** (no catálogo online e no PDV), com botão **"Usar minha localização GPS"**, busca de endereço, ajuste do pino no mapa e campo de ponto de referência.
- **Acesso e Cargo de Entregador**: Novo perfil `ENTREGADOR` com autenticação por PIN na tela `/caixa`, abrindo diretamente a aba dedicada **"Entregas"** (também acessível para `ADMIN` e `CAIXA` acompanharem todas as rotas).
- **Navegação Guiada e Rota**: Visualização do mapa com rota traçada entre a Conflora e o endereço do cliente na própria tela do entregador, acompanhada de botões de 1 toque para abrir a navegação guiada no **Waze** e no **Google Maps**.
- **Recebimento na Entrega**: O entregador pode concluir tanto pedidos já pagos quanto cobrar na porta do cliente (**Dinheiro** com cálculo de troco, **Cartão de Débito/Crédito** ou **Pix**), registrando a baixa financeira, o estoque e o vínculo de quem vendeu, quem recebeu e quem entregou.

---

### 1. Overview & Core Concept

- **What It Does**: Transforma pedidos com modalidade `DELIVERY` em uma operação logística rastreável de ponta a ponta. O cliente marca sua casa no mapa durante o pedido; assim que o pedido é confirmado/separado, ele entra na fila **"Aguardando Entregador"**. O entregador aceita a corrida, navega até o cliente com auxílio de mapa de rota + Waze/Google Maps e registra o recebimento e a conclusão da entrega na porta do cliente.
- **Target Audience / Persona**:
  - **Clientes da Conflora**: Informam sua localização exata sem depender apenas de descrições textuais de ruas ou chácaras.
  - **Entregadores**: Acessam pelo celular uma fila limpa de entregas disponíveis e em rota, com botões grandes para dirigir e dar baixa.
  - **Caixa e Administração**: Visualizam em tempo real com qual entregador está cada pedido e conferem os valores recebidos em rota no fechamento do dia.
- **Key Value**: Elimina erros de localização em entregas, agiliza o despacho com rota traçada e garante integridade financeira nos pedidos cobrados na entrega.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Cliente no Checkout (Catálogo & PDV)**:
     - Ao selecionar **Entrega**, o formulário expande o seletor de localização.
     - O cliente pode tocar em **"Usar minha localização atual (GPS)"**, pesquisar seu endereço ou arrastar o pino no mapa até a entrada exata.
     - As coordenadas (`lat`, `lng`), o endereço formatado e o ponto de referência são salvos junto ao pedido.
  2. **Despacho e Aceite pelo Entregador (`/caixa` → Aba Entregas)**:
     - O entregador faz login com seu PIN no `/caixa` e visualiza a aba **Entregas**, dividida em **"Disponíveis para Entrega"**, **"Minhas Entregas em Rota"** e **"Entregues Hoje"**.
     - Cada card mostra número do pedido, nome e WhatsApp do cliente, endereço/referência, distância estimada, itens e status financeiro (*"Já Pago"* ou *"Cobrar na Entrega: R$ XX,XX"*).
     - Ao tocar em **"Aceitar e Sair para Entrega"**, o pedido passa para `OUT_FOR_DELIVERY` vinculado ao entregador.
  3. **Navegação Guiada (Mapa + Waze / Google Maps)**:
     - No card da entrega ativa, o entregador visualiza o mapa interativo com a rota traçada desde a Conflora até o pino do cliente, distância e tempo estimado.
     - Dois botões de ação rápida abrem a navegação curva a curva diretamente no aplicativo **Waze** ou **Google Maps** do celular com as coordenadas exatas de destino.
  4. **Recebimento e Baixa na Casa do Cliente**:
     - Ao chegar no cliente, o entregador toca em **"Finalizar Entrega"**.
     - Se o pedido já estiver pago (`APPROVED`), confirma a entrega com 1 toque.
     - Se o pedido estiver pendente de pagamento (`AWAITING_CASHIER` / pagamento na entrega), o entregador confirma a forma recebida na hora (**Dinheiro** com informação de troco, **Cartão Débito**, **Cartão Crédito** ou **Pix**), marcando o pedido como **Pago e Entregue (`DELIVERED`)** e disparando o comprovante final via WhatsApp.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Segue fielmente o design system botânico e operacional da Conflora — superfícies claras em creme/papel (`#F7F4ED` / `#FFFFFF`), verde floresta profundo (`#1B4332` / `#2D6A4F`) para ações principais e acentos terrosos discretos para estados de atenção.
  - *Typography & Hierarchy*: Títulos em `Plus Jakarta Sans` / `DM Sans` com pesos bem definidos (600/700) e valores financeiros, distâncias e coordenadas em numerais tabulares (`tabular-nums`) para leitura rápida em movimento.
  - *Component Styling & Layout*:
    - No celular (entregador em campo), botões de ação possuem altura mínima de `48px` na zona natural do polegar, evitando toques acidentais.
    - No desktop (painel `/caixa`), layout em colunas com a fila de entregas à esquerda e o mapa de rota/detalhes da entrega selecionada à direita.
  - *Interactive Feedback & Motion*: Atualização em tempo real via stream SSE (`/api/caixa/orders/stream`) quando novos pedidos de entrega entram na fila ou mudam de status, com transições suaves (`<= 200ms`) e aviso imediato de confirmação.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Mapa de Rota Integrado + Deep Links Nativos (Waze & Google Maps)**
  - *Chosen Approach*: Exibir o mapa interativo com pino e rota diretamente na tela para conferência visual rápida e oferecer botões diretos para Waze (`https://waze.com/ul?ll=LAT,LNG&navigate=yes`) e Google Maps (`https://www.google.com/maps/dir/?api=1&destination=LAT,LNG`).
  - *Why*: O mapa embutido permite ao entregador e ao caixa enxergarem onde fica a entrega antes mesmo de sair, enquanto o deep link abre o GPS nativo do celular com alertas de trânsito e voz durante o trajeto.
- **Decision 2: Triplo Vínculo Operacional (Vendedor · Recebedor · Entregador)**
  - *Chosen Approach*: Preservar no pedido os campos `createdBy` (quem vendeu), `receivedBy` (quem recebeu o pagamento — caixa ou entregador na porta) e `deliveredBy` / `assignedDriver` (quem realizou a entrega).
  - *Why*: Permite que o fechamento de caixa saiba exatamente quanto dinheiro ou comprovante de maquininha está na mão de cada entregador ao final do turno, sem misturar com o gaveteiro físico do balcão.
- **Decision 3: Gestão do Cargo `ENTREGADOR` no RBAC Existente**
  - *Chosen Approach*: Adicionar `ENTREGADOR` aos perfis de equipe (`ADMIN`, `CAIXA`, `VENDEDOR`, `ENTREGADOR`) no cadastro de colaboradores e login por PIN.
  - *Why*: Mantém o mesmo fluxo de autenticação rápida por PIN que a equipe já utiliza no `/caixa`, restringindo o perfil `ENTREGADOR` às operações de logística e baixa de suas entregas.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CHECKOUT (CATÁLOGO & PDV CAIXA)                     │
│  ┌──────────────────────────┐       ┌────────────────────────────────┐  │
│  │ Seletor de Localização   │──────▶│ GPS Atual + Busca de Endereço  │  │
│  │ (Mapa + Pino Arrastável) │       │ + Coordenadas (lat, lng, ref)  │  │
│  └─────────────┬────────────┘       └───────────────┬────────────────┘  │
└────────────────┼────────────────────────────────────┼───────────────────┘
                 │Grava deliveryLocation no Pedido    │
                 ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   SERVIDOR & REPOSITÓRIO DE PEDIDOS                     │
│  ┌──────────────────────┐   ┌───────────────────────┐   ┌────────────┐  │
│  │ Fila de Entregas     │──▶│ Aceite / Despacho     │──▶│ Baixa &    │  │
│  │ (Aguardando / Rota)  │   │ (assignedDriver)      │   │ Pagamento  │  │
│  └──────────┬───────────┘   └───────────┬───────────┘   └─────┬──────┘  │
└─────────────┼───────────────────────────┼─────────────────────┼─────────┘
              │Stream Tempo Real (SSE)    │                     │
              ▼                           ▼                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                 PAINEL /CAIXA — ABA DEDICADA "ENTREGAS"                 │
│  ┌──────────────────────┐   ┌───────────────────────┐   ┌────────────┐  │
│  │ Cards de Entregas    │   │ Mapa de Rota Na Tela  │   │ Modal de   │  │
│  │ (Disponíveis / Rota) │   │ + Botões Waze / Maps  │   │ Recebimento│  │
│  └──────────────────────┘   └───────────────────────┘   └────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Objeto `deliveryLocation` no Pedido (`orders`)**:
    - `lat` (number), `lng` (number), `address` (string), `reference` (string), `accuracy` (number opcional), `mapsUrl` (string).
  - **Campos de Logística no Pedido (`orders`)**:
    - `deliveryStatus`: `'PENDING_DISPATCH'` | `'OUT_FOR_DELIVERY'` | `'DELIVERED'`
    - `assignedDriver`: `{ id, name, email, role, assignedAt }`
    - `deliveredBy`: `{ id, name, email, role, deliveredAt }`
  - **Perfis de Usuário (`users`)**:
    - Inclusão do papel `'ENTREGADOR'` nas validações de equipe, gerenciamento de colaboradores e autenticação por PIN.

- **Interactive Component & State Mapping**:
  - **Mapa de Checkout (`LocationPicker`)**:
    - Botão *"Usar minha localização GPS"* aciona `navigator.geolocation.getCurrentPosition`, centraliza o mapa, posiciona o marcador e preenche o endereço via geocodificação reversa.
    - Busca de endereço consulta localizações e move o marcador para o ponto escolhido; clicar ou arrastar o pino atualiza `lat`/`lng` em tempo real.
  - **Fila e Painel do Entregador (`DeliveryBoard`)**:
    - Filtro por sub-abas: *Disponíveis*, *Em Rota (Minhas)* e *Concluídas*.
    - Ação *"Pegar Entrega"* (`POST /api/caixa/orders/:id/assign-delivery`): vincula o entregador autenticado e muda `deliveryStatus` para `OUT_FOR_DELIVERY`.
    - Ação *"Ver Rota / Navegar"*: exibe o trajeto no mapa integrado entre a origem da loja e `deliveryLocation` do cliente, com botões diretos para Waze e Google Maps.
    - Ação *"Confirmar Entrega e Pagamento"* (`POST /api/caixa/orders/:id/complete-delivery`):
      - Se o pedido ainda não foi pago, valida a forma de pagamento recebida pelo entregador (`DINHEIRO`, `DEBITO`, `CREDITO` ou `PIX`), calcula troco se aplicável, executa a baixa atômica de estoque/pagamento (`receivedBy = entregador`) e marca `status = 'DELIVERED'` / `deliveryStatus = 'DELIVERED'`.
      - Se já estava pago, apenas registra a conclusão da entrega (`deliveredBy = entregador`, `status = 'DELIVERED'`) e envia notificação/recibo ao cliente.
