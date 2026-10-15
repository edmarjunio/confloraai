# Fluxo de Vendas PDV: Recibo WhatsApp, Pix Sicredi Travado, Fiado e Duplo Vínculo Vendedor/Caixa

Plano de modernização do fluxo de checkout e PDV da Conflora, implementando remoção da barra promocional de testes, geração de recibo com envio para WhatsApp do cliente, geração de QR Code e Pix Copia e Cola travados na conta Sicredi, conciliação e baixa automática via Webhook do Sicredi, novas modalidades de pagamento no Caixa (Débito, Crédito, Fiado e Quitação de Dívidas) e auditoria transparente de vendedor criador vs operador de caixa.

---

## Decisões Confirmadas e Alinhamentos

> [!IMPORTANT]
> **Definições alinhadas com o usuário nas perguntas preliminares:**
> - **Identificação de Vendedor e Caixa**: Utilização do usuário autenticado na sessão (`req.user`), registrando `createdBy` (Vendedor responsável pela venda e comissão) e `receivedBy` (Caixa responsável pela conferência de dinheiro/cartão).
> - **Formas de Pagamento no Caixa**: Cartão de Débito, Cartão de Crédito, Dinheiro, Fiado (débito em conta de cliente cadastrado) e aba/função específica de **Recebimento de Dívida** para quitação de saldo devedor.
> - **Pix Sicredi**: Geração direta de BR Code EMV / QR Code e Pix Copia e Cola com valor exato fixo (sem permissão de edição pelo pagador), verificação via API/Webhook do Sicredi com baixa automática de pedido e estoque, e disparo automático de confirmação para o WhatsApp do cliente e da Horta.
> - **Remoção da Faixa Superior**: Eliminação imediata do banner verde de testes de cupom (`#promoBanner`) do topo do cardápio digital.

---

## 1. Visão Geral e Conceito

O sistema passa a suportar o fluxo completo de balcão e retaguarda da Conflora:
1. **Remoção da Faixa Verde de Teste**: Limpeza visual da barra superior `#promoBanner` no cardápio digital.
2. **Geração de Recibo em Tempo Real**: O espelho exato do cupom montado no painel direito (itens, quantidades, valores unitários, subtotal, descontos, frete e total) é convertido para recibo estruturado.
3. **Envio Inteligente via WhatsApp**: Se houver telefone cadastrado ou digitado na hora, o recibo é transmitido via API do WhatsApp. Caso não haja telefone informado, o sistema conclui a venda localmente sem emitir erro.
4. **Cobrança Pix Sicredi com Valor Travado**:
   - Geração de QR Code e string Pix Copia e Cola vinculados à conta Sicredi com valor monetário fixo (impossibilitando alteração do montante no app bancário do pagador).
   - O recibo enviado ao cliente por WhatsApp já contém a chave Pix Copia e Cola e instruções claras.
5. **Automação de Baixa Pix Sicredi**:
   - Webhook oficial (`/api/webhooks/sicredi-pix`) e consulta na API Sicredi para identificar o pagamento.
   - Assim que o pagamento é liquidado: pedido marcado como `PAID`, estoque baixado, mensagem de confirmação enviada ao cliente e alerta com resumo do pedido enviado ao WhatsApp da Horta.
6. **Formas de Pagamento Exclusivas de Caixa**:
   - Débito, Crédito, Dinheiro (com cálculo de troco) e Fiado (vinculado a cliente cadastrado com limite/histórico).
   - Recurso de **Recebimento de Dívida / Quitação**: liquidação parcial ou total do saldo devedor de fiado do cliente no caixa, emitindo comprovante de quitação.
7. **Auditoria de Responsabilidades (Vendedor vs Caixa)**:
   - Se venda for finalizada diretamente pelo vendedor via Pix: `Pedido feito por: Fulano | Recebido por: Fulano (ou Pix Automático)`.
   - Se comanda for aberta por um vendedor e paga no Caixa (Dinheiro/Cartão/Fiado): `Pedido feito por: Fulano (venda creditada a ele) | Recebido por: Siclano (caixa responsável pelo recebimento)`.

---

## 2. Experiência do Usuário e Interface Visual

### 2.1. Topo Limpo (Sem a Faixa Verde de Teste)
- Remoção do contêiner `.promo-banner` no topo de `views-home.js`.
- Preservação da barra de navegação superior com logo, alternador de idioma e botões de acesso rápido ao PDV/Caixa.

### 2.2. Painel Lateral de Caixa (Mobile & Desktop)
- **Seletor de Pagamento Atualizado**:
  - `PIX (Sicredi)`: Exibe QR Code com valor fixo, botão de copiar chave e aviso de confirmação automática.
  - `Cartão Débito` e `Cartão Crédito`: Seleção direta no caixa.
  - `Dinheiro`: Campo para inserção de valor recebido e cálculo instantâneo de troco em reais.
  - `Fiado`: Habilitado apenas para clientes selecionados da base, gerando registro no extrato devedor do cliente.
- **Módulo de Recebimento de Dívida (Quitação de Fiado)**:
  - Botão de acesso rápido no caixa para consultar saldo devedor de clientes.
  - Permite lançar recebimento parcial ou total (em dinheiro, pix ou cartão), registrando quem recebeu e abater do saldo fiado.
- **Modal de Recibo Final**:
  - Exibe o comprovante no padrão idêntico ao painel direito.
  - Exibe os campos de auditoria em destaque:
    - `Vendedor (Criador): [Nome]`
    - `Recebido por: [Nome do Operador de Caixa / Automação Pix]`
  - Botão para reimprimir ou reenviar via WhatsApp (se houver telefone).

---

## 3. Decisões Técnicas e Arquitetura de Dados

### 3.1. Esquema de Dados do Pedido e Transações
Cada pedido no Firestore passa a registrar:
```json
{
  "id": "uuid",
  "ticketNumber": "142",
  "items": [...],
  "total": 125.50,
  "paymentMethod": "PIX" | "DEBITO" | "CREDITO" | "DINHEIRO" | "FIADO",
  "paymentStatus": "AWAITING_PAYMENT" | "PAID",
  "createdBy": {
    "uid": "user-123",
    "name": "Fulano",
    "role": "VENDEDOR"
  },
  "receivedBy": {
    "uid": "user-456",
    "name": "Siclano",
    "role": "CAIXA"
  },
  "customerPhone": "64999999999",
  "customerName": "Maria Silva",
  "pixData": {
    "txid": "cfl20261015...",
    "copiaECola": "00020126580014br.gov.bcb.pix...",
    "amount": 125.50,
    "provider": "SICREDI"
  }
}
```

### 3.2. Fluxo de Liquidação Pix Sicredi
```
┌─────────────────┐       ┌─────────────────┐       ┌──────────────────────┐
│ Vendedor/Caixa  │──────>│ Backend Cria    │──────>│ Sicredi EMV BR Code  │
│ Finaliza Venda  │       │ Pedido Awaiting │       │ (Valor Travado)      │
└─────────────────┘       └─────────────────┘       └──────────────────────┘
                                                               │
                                                               ▼
┌─────────────────┐       ┌─────────────────┐       ┌──────────────────────┐
│ Cliente Paga    │<──────│ Notifica Cliente│<──────│ Recibo + Copia e Cola│
│ no Sicredi Pix  │       │ via WhatsApp    │       │ na Tela & WhatsApp   │
└─────────────────┘       └─────────────────┘       └──────────────────────┘
         │
         ▼
┌─────────────────────────┐
│ Webhook / API Sicredi   │
│ Detecta Liquidação      │
└─────────────────────────┘
         │
         ├───> Atualiza Status do Pedido para "PAID" (Mantém Vendedor: Fulano)
         ├───> Baixa Estoque dos Itens do Pedido
         ├───> Dispara WhatsApp de Confirmação para o Cliente
         └───> Dispara WhatsApp de Notificação para a Horta Conflora
```

### 3.3. Gestão de Fiado e Quitação de Dívidas
- Coleção `customerDebts` / subcoleção em `customers`:
  - Lançamentos de compras fiadas (débito).
  - Lançamentos de amortização / quitação (crédito), indicando data, valor, forma de pagamento e operador de caixa que recebeu o dinheiro.

---

## 4. Etapas de Execução

1. **Remoção da Faixa Verde**: Excluir elemento `#promoBanner` e estilos correlatos de `src/http/views-home.js`.
2. **Atualização do `SicrediPixClient` & Geração de Cobrança**:
   - Garantir que a geração do BR Code contenha o valor exato travado (`modalidadeAlteracao: 0` e tag `54` do padrão EMV BCB).
   - Inserir retorno do QR Code e Pix Copia e Cola no endpoint de criação do pedido.
3. **Webhook e Baixa Automática Sicredi**:
   - Endpoint `/api/webhooks/sicredi-pix` com processamento idempotente.
   - Disparo duplo de WhatsApp: mensagem de sucesso para o cliente e alerta para o número da Horta (`64999351616` ou configurado em ambiente).
4. **Ajustes de UI no PDV Caixa (`views-caixa.html` & `views-home.js`)**:
   - Inclusão das opções: `Cartão de Débito`, `Cartão de Crédito`, `Fiado` e `Recebimento de Dívida`.
   - Registro automático dos campos `createdBy` (vendedor) e `receivedBy` (caixa).
   - Modal e tela de quitação de fiado de clientes cadastrados.
   - Envio condicional de recibo ao WhatsApp (somente se número presente).
5. **Verificação e Testes**: Compilação e checagem de integridade dos endpoints.
