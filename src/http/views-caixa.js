// Conflora — Frente de Caixa & Balcão (PDV Rápido e Minimalista)
// Otimizado para celular do colaborador na loja e computador do caixa

function renderCaixaHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <script>
    (function() {
      try {
        var _fetch = typeof window !== 'undefined' ? window.fetch : null;
        var _current = _fetch ? _fetch.bind(window) : null;
        var desc = {
          get: function() { return _current; },
          set: function(fn) { _current = fn; },
          configurable: true,
          enumerable: true
        };
        try { Object.defineProperty(window, 'fetch', desc); } catch (_) {}
        try { if (typeof Window !== 'undefined' && Window.prototype) Object.defineProperty(Window.prototype, 'fetch', desc); } catch (_) {}
        try { if (typeof window !== 'undefined' && window.__proto__) Object.defineProperty(window.__proto__, 'fetch', desc); } catch (_) {}
      } catch (_) {}
    })();
  </script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Conflora — Caixa & Frente de Loja</title>
  <style>
    :root {
      --primary: #15803d;
      --primary-hover: #166534;
      --primary-light: #dcfce7;
      --primary-dark: #14532d;
      --pix: #059669;
      --pix-bg: #ecfdf5;
      --card: #2563eb;
      --card-bg: #eff6ff;
      --cash: #d97706;
      --cash-bg: #fffbeb;
      --bg: #f8fafc;
      --surface: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --danger: #dc2626;
      --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      -webkit-tap-highlight-color: transparent;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      position: sticky;
      top: 0;
      z-index: 100;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      color: var(--text);
    }
    .brand-logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 16px;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .brand-sub {
      font-size: 11px;
      color: var(--muted);
      display: block;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .operator-select {
      background: #f1f5f9;
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 4px 10px;
      font-size: 12px;
      color: #334155;
      font-weight: 500;
    }
    .nav-tabs {
      display: flex;
      gap: 4px;
      background: #e2e8f0;
      padding: 4px;
      border-radius: 10px;
    }
    .tab-btn {
      border: none;
      background: transparent;
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .tab-btn.active {
      background: var(--surface);
      color: var(--text);
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .badge-count {
      background: var(--danger);
      color: white;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 10px;
      font-weight: 700;
    }
    .badge-count.zero { display: none; }

    /* METRICS STRIP */
    .metrics-bar {
      background: #ffffff;
      border-bottom: 1px solid var(--border);
      padding: 6px 16px;
      display: flex;
      gap: 16px;
      overflow-x: auto;
      font-size: 12px;
      color: #475569;
      white-space: nowrap;
    }
    .metric-pill strong { color: var(--text); }
    .metric-pill.pix strong { color: var(--pix); }
    .metric-pill.card strong { color: var(--card); }
    .metric-pill.cash strong { color: var(--cash); }

    /* MAIN CONTAINER */
    main {
      flex: 1;
      padding: 12px 16px;
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }

    /* POS GRID (DESKTOP) */
    .pos-layout {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 16px;
      height: calc(100vh - 125px);
    }
    @media (max-width: 860px) {
      .pos-layout {
        display: flex;
        flex-direction: column;
        height: auto;
      }
    }

    /* CATALOG PANEL */
    .catalog-panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .catalog-header {
      padding: 12px;
      border-bottom: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .search-input {
      width: 100%;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 15px;
      background: #f8fafc;
      outline: none;
    }
    .search-input:focus {
      border-color: var(--primary);
      background: #fff;
    }
    .category-chips {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .chip {
      border: 1px solid var(--border);
      background: #fff;
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      color: #475569;
      cursor: pointer;
      white-space: nowrap;
    }
    .chip.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
    }
    .products-grid {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 10px;
    }
    @media (max-width: 480px) {
      .products-grid {
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        padding: 8px;
      }
    }
    .prod-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 6px;
      cursor: pointer;
      transition: all 0.1s ease;
      user-select: none;
    }
    .prod-card:hover {
      border-color: var(--primary);
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .prod-card:active {
      transform: scale(0.98);
      background: var(--primary-light);
    }
    .prod-card-name {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.3;
      color: var(--text);
    }
    .prod-card-bottom {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: 4px;
    }
    .prod-card-price {
      font-size: 14px;
      font-weight: 700;
      color: var(--primary);
    }
    .prod-card-stock {
      font-size: 10px;
      color: var(--muted);
    }

    /* CART & SALE PANEL */
    .cart-panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .cart-header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
    }
    .cart-header h2 {
      font-size: 15px;
      font-weight: 700;
    }
    .btn-clear-cart {
      background: none;
      border: none;
      color: var(--danger);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .cart-items {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
      max-height: 280px;
    }
    .cart-empty {
      text-align: center;
      padding: 30px 10px;
      color: var(--muted);
      font-size: 13px;
    }
    .cart-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f1f5f9;
      gap: 8px;
    }
    .cart-item-info {
      flex: 1;
      min-width: 0;
    }
    .cart-item-name {
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cart-item-price {
      font-size: 12px;
      color: var(--muted);
    }
    .qty-controls {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-qty {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #f8fafc;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn-qty:active { background: #e2e8f0; }
    .cart-item-qty {
      font-size: 13px;
      font-weight: 700;
      min-width: 20px;
      text-align: center;
    }
    .cart-item-subtotal {
      font-size: 13px;
      font-weight: 700;
      min-width: 60px;
      text-align: right;
    }

    /* CHECKOUT BOX */
    .checkout-box {
      border-top: 1px solid var(--border);
      padding: 12px 16px;
      background: #f8fafc;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .total-row span { font-size: 14px; color: var(--muted); }
    .total-row strong { font-size: 24px; font-weight: 800; color: var(--text); }

    /* CUSTOMER INPUTS */
    .customer-fields {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cust-input-group {
      display: flex;
      gap: 6px;
    }
    .cust-input {
      padding: 8px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      background: #fff;
      flex: 1;
    }
    .cust-hint {
      font-size: 11px;
      color: #047857;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* 3 PAYMENT BUTTONS */
    .payment-buttons-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .btn-pay {
      border: none;
      padding: 12px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: transform 0.05s ease, filter 0.1s ease;
      color: white;
    }
    .btn-pay:hover { filter: brightness(0.95); }
    .btn-pay:active { transform: scale(0.98); }
    .btn-pay.pix {
      background: var(--pix);
    }
    .btn-pay.card {
      background: var(--card);
    }
    .btn-pay.cash {
      background: var(--cash);
    }
    .btn-pay small {
      font-size: 11px;
      font-weight: 400;
      opacity: 0.9;
    }

    /* QUEUE PANEL (FILA DO CAIXA) */
    .queue-container {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .queue-section-title {
      font-size: 15px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .orders-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 12px;
    }
    .order-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    .order-card.cashier-wait {
      border-left: 4px solid var(--card);
    }
    .order-card.pix-wait {
      border-left: 4px solid var(--pix);
    }
    .order-card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .order-card-ticket {
      font-size: 16px;
      font-weight: 800;
    }
    .order-card-meta {
      font-size: 11px;
      color: var(--muted);
    }
    .order-status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
    }
    .order-status-badge.wait-cashier {
      background: var(--card-bg);
      color: var(--card);
    }
    .order-status-badge.wait-pix {
      background: var(--pix-bg);
      color: var(--pix);
      animation: pulse 2s infinite;
    }
    .order-status-badge.confirmed {
      background: #dcfce7;
      color: #15803d;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.65; }
    }
    .order-card-items {
      font-size: 12px;
      color: #334155;
      background: #f8fafc;
      padding: 8px;
      border-radius: 6px;
      max-height: 80px;
      overflow-y: auto;
    }
    .order-card-total {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .order-card-total span { font-size: 12px; color: var(--muted); }
    .order-card-total strong { font-size: 18px; font-weight: 800; color: var(--text); }
    .order-actions {
      display: flex;
      gap: 8px;
    }
    .btn-action {
      flex: 1;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #fff;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
    }
    .btn-action.primary {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
    }
    .btn-action.pix-confirm {
      background: var(--pix);
      color: white;
      border-color: var(--pix);
    }
    .btn-action.cancel {
      color: var(--danger);
      background: #fef2f2;
      border-color: #fecaca;
      flex: 0 0 40px;
    }

    /* MODAL POPUPS */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(2px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    }
    .modal-overlay.hidden { display: none; }
    .modal-card {
      background: #fff;
      border-radius: 16px;
      max-width: 440px;
      width: 100%;
      padding: 20px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.25);
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: 90vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header h3 { font-size: 18px; font-weight: 800; }
    .btn-modal-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--muted);
    }
    .qr-container {
      text-align: center;
      padding: 12px;
      background: #f8fafc;
      border-radius: 12px;
      border: 1px solid var(--border);
    }
    .qr-img {
      width: 200px;
      height: 200px;
      margin: 0 auto 10px;
      display: block;
      background: #fff;
      border-radius: 8px;
    }
    .pix-code-box {
      font-family: monospace;
      font-size: 11px;
      background: #fff;
      border: 1px dashed var(--border);
      padding: 8px;
      border-radius: 6px;
      word-break: break-all;
      max-height: 70px;
      overflow-y: auto;
      text-align: left;
    }
    .live-status-box {
      padding: 12px;
      border-radius: 10px;
      text-align: center;
      font-weight: 700;
      font-size: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .live-status-box.waiting {
      background: #fef3c7;
      color: #92400e;
      border: 1px solid #fde68a;
    }
    .live-status-box.success {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #86efac;
    }
    .cash-calc-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      margin-top: 6px;
    }
    .btn-cash-preset {
      padding: 8px;
      border: 1px solid var(--border);
      background: #f8fafc;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .btn-cash-preset:active { background: #e2e8f0; }

    /* TOAST NOTIFICATION */
    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #fff;
      padding: 10px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      z-index: 2000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: opacity 0.2s ease;
    }
    .toast.hidden { display: none; }
  </style>
</head>
<body>

  <!-- HEADER -->
  <header>
    <a href="/" class="brand">
      <div class="brand-logo">C</div>
      <div>
        <div class="brand-title">Conflora Caixa</div>
        <span class="brand-sub">PDV Rápido · Celular & Balcão</span>
      </div>
    </a>

    <div class="header-right">
      <select id="operatorSelect" class="operator-select">
        <option value="Colaborador Loja">👤 Colaborador Loja</option>
        <option value="Edmar Júnio">👤 Edmar Júnio</option>
        <option value="Atendente Caixa">👤 Atendente Caixa</option>
        <option value="Vendedor 1">👤 Vendedor 1</option>
      </select>

      <div class="nav-tabs">
        <button class="tab-btn active" id="tabBtnPos" onclick="switchTab('pos')">
          ⚡ Venda
        </button>
        <button class="tab-btn" id="tabBtnQueue" onclick="switchTab('queue')">
          📥 Fila <span id="queueBadge" class="badge-count zero">0</span>
        </button>
        <button class="tab-btn" id="tabBtnHistory" onclick="switchTab('history')">
          📊 Dia
        </button>
      </div>
    </div>
  </header>

  <!-- METRICS STRIP -->
  <div class="metrics-bar">
    <div class="metric-pill">Hoje: <strong id="metricTotal">R$ 0,00</strong> (<span id="metricCount">0</span> vendas)</div>
    <div class="metric-pill pix">PIX: <strong id="metricPix">R$ 0,00</strong></div>
    <div class="metric-pill card">Cartão: <strong id="metricCard">R$ 0,00</strong></div>
    <div class="metric-pill cash">Dinheiro: <strong id="metricCash">R$ 0,00</strong></div>
    <div style="margin-left:auto;"><a href="/admin" style="color:#64748b; text-decoration:none;">Painel Geral ↗</a></div>
  </div>

  <main>
    <!-- VIEW 1: POS / LANÇAR VENDA RÁPIDA -->
    <div id="viewPos" class="pos-layout">
      <!-- CATÁLOGO -->
      <section class="catalog-panel">
        <div class="catalog-header">
          <input type="search" id="prodSearch" class="search-input" placeholder="🔍 Buscar produto por nome ou código..." autocomplete="off">
          <div class="category-chips" id="categoryChips">
            <button class="chip active" onclick="filterCategory('')">Todos</button>
          </div>
        </div>
        <div class="products-grid" id="productsGrid">
          <div style="padding:20px; color:#64748b;">Carregando produtos...</div>
        </div>
      </section>

      <!-- COMANDA & PAGAMENTO -->
      <section class="cart-panel">
        <div class="cart-header">
          <h2>Comanda da Venda</h2>
          <button class="btn-clear-cart" onclick="clearCart()">Limpar</button>
        </div>

        <div class="cart-items" id="cartItems">
          <div class="cart-empty">Nenhum produto adicionado.<br>Toque em um item do catálogo para lançar.</div>
        </div>

        <div class="checkout-box">
          <div class="total-row">
            <span>TOTAL A PAGAR</span>
            <strong id="cartTotalDisplay">R$ 0,00</strong>
          </div>

          <div class="customer-fields">
            <div class="cust-input-group">
              <input type="tel" id="custPhone" class="cust-input" placeholder="📱 WhatsApp do Cliente (DDD + número)">
              <input type="text" id="custName" class="cust-input" placeholder="👤 Nome (opcional)" style="flex:0.8;">
            </div>
            <div class="cust-hint">
              <span>⚡ O WhatsApp vincula o comprovante para liberação automática sem fila no caixa!</span>
            </div>
          </div>

          <div class="payment-buttons-grid">
            <button class="btn-pay pix" onclick="submitSale('PIX')">
              <span>🟢 PIX · Libera Automático</span>
              <small>Sem fila no caixa</small>
            </button>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
              <button class="btn-pay card" onclick="submitSale('CARTAO')">
                <span>🔵 CARTÃO</span>
                <small>Pagar no Caixa</small>
              </button>
              <button class="btn-pay cash" onclick="submitSale('DINHEIRO')">
                <span>🟡 DINHEIRO</span>
                <small>Pagar no Caixa</small>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- VIEW 2: FILA DO CAIXA & PEDIDOS AGUARDANDO -->
    <div id="viewQueue" class="queue-container" style="display:none;">
      <div>
        <div class="queue-section-title">
          <span>💳 Aguardando no Caixa (Cartão / Dinheiro)</span>
          <span id="cashierCountBadge" class="badge-count zero">0</span>
        </div>
        <div class="orders-grid" id="cashierOrdersGrid">
          <div style="color:#64748b; font-size:13px;">Nenhum cliente aguardando no caixa no momento.</div>
        </div>
      </div>

      <div style="margin-top:16px;">
        <div class="queue-section-title">
          <span>🟢 Vendas no Piso Aguardando PIX</span>
          <span id="pixCountBadge" class="badge-count zero">0</span>
        </div>
        <div class="orders-grid" id="pixOrdersGrid">
          <div style="color:#64748b; font-size:13px;">Nenhum PIX pendente de comprovante.</div>
        </div>
      </div>
    </div>

    <!-- VIEW 3: HISTÓRICO & RELATÓRIO DO DIA -->
    <div id="viewHistory" style="display:none;">
      <h2 style="font-size:18px; font-weight:800; margin-bottom:12px;">Vendas Concluídas Hoje</h2>
      <div class="orders-grid" id="historyOrdersGrid">
        <div style="color:#64748b; font-size:13px;">Carregando histórico...</div>
      </div>
    </div>
  </main>

  <!-- MODAL PIX (COM AUTO-VERIFICAÇÃO DE COMPROVANTE) -->
  <div id="modalPix" class="modal-overlay hidden">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="modalPixTitle">Pagamento PIX · Pedido #000</h3>
        <button class="btn-modal-close" onclick="closePixModal()">×</button>
      </div>

      <div class="live-status-box waiting" id="pixLiveStatus">
        <span style="font-size:18px;">🟡</span>
        <span id="pixStatusText">Aguardando cliente enviar comprovante no WhatsApp...</span>
        <small style="font-weight:400; opacity:0.85;">Ao receber o comprovante no WhatsApp da loja, o pedido finaliza automaticamente!</small>
      </div>

      <div class="qr-container">
        <div style="font-size:13px; color:#64748b; margin-bottom:6px;">Aponte a câmera ou app do banco:</div>
        <img id="pixQrImg" class="qr-img" alt="QR Code PIX">
        <div style="font-size:22px; font-weight:800; color:var(--pix);" id="pixTotalText">R$ 0,00</div>
      </div>

      <div>
        <label style="font-size:11px; font-weight:700; color:#64748b;">Código Copia e Cola:</label>
        <div class="pix-code-box" id="pixCodeBox"></div>
        <button class="btn-action" style="margin-top:6px; width:100%;" onclick="copyPixCode()">📋 Copiar Código PIX</button>
      </div>

      <div style="display:flex; flex-direction:column; gap:6px;">
        <button class="btn-action pix-confirm" id="btnConfirmPixManual" onclick="confirmCurrentPixManual()">⚡ Validar / Confirmar PIX Manualmente</button>
        <button class="btn-action" id="btnSendPixWhatsApp" onclick="resendPixWhatsApp()">📲 Reenviar Dados no WhatsApp</button>
      </div>
    </div>
  </div>

  <!-- MODAL RECEBIMENTO NO CAIXA (CARTÃO / DINHEIRO) -->
  <div id="modalCashierPay" class="modal-overlay hidden">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="modalPayTitle">Receber Pedido #000</h3>
        <button class="btn-modal-close" onclick="closePayModal()">×</button>
      </div>

      <div id="modalPayDetails" style="background:#f8fafc; padding:12px; border-radius:10px; font-size:13px;"></div>

      <div id="cashCalcSection" style="display:none;">
        <label style="font-size:12px; font-weight:700; color:#64748b;">Valor Recebido em Dinheiro (R$):</label>
        <input type="number" step="0.01" id="cashReceivedInput" class="cust-input" placeholder="0,00" style="font-size:18px; font-weight:800;">
        <div class="cash-calc-grid" id="cashPresets"></div>
        <div style="margin-top:10px; padding:10px; background:#fffbeb; border:1px solid #fde68a; border-radius:8px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:600; color:#92400e;">TROCO A DEVOLVER:</span>
          <strong id="changeDueDisplay" style="font-size:20px; color:#d97706;">R$ 0,00</strong>
        </div>
      </div>

      <button class="btn-action primary" id="btnConfirmCashierPay" style="padding:14px; font-size:16px;" onclick="confirmCashierPaymentAction()">
        ✅ Confirmar Pagamento e Finalizar
      </button>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>

  <script>
    // ESTADO DA APLICAÇÃO
    let allProducts = [];
    let currentCategory = '';
    let cart = [];
    let activePixOrderId = null;
    let pixPollingInterval = null;
    let activeCashierOrder = null;

    // INICIALIZAÇÃO
    window.addEventListener('DOMContentLoaded', async () => {
      await loadProducts();
      await loadQueueOrders();
      setInterval(loadQueueOrders, 3000); // Polling leve da fila a cada 3s

      document.getElementById('prodSearch').addEventListener('input', renderProducts);
      document.getElementById('cashReceivedInput').addEventListener('input', calculateChange);
    });

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => t.classList.add('hidden'), 3500);
    }

    function switchTab(tab) {
      document.getElementById('tabBtnPos').classList.toggle('active', tab === 'pos');
      document.getElementById('tabBtnQueue').classList.toggle('active', tab === 'queue');
      document.getElementById('tabBtnHistory').classList.toggle('active', tab === 'history');

      document.getElementById('viewPos').style.display = tab === 'pos' ? 'grid' : 'none';
      document.getElementById('viewQueue').style.display = tab === 'queue' ? 'flex' : 'none';
      document.getElementById('viewHistory').style.display = tab === 'history' ? 'block' : 'none';

      if (tab === 'queue' || tab === 'history') {
        loadQueueOrders();
      }
    }

    // CARREGAR PRODUTOS
    async function loadProducts() {
      try {
        const res = await fetch('/api/caixa/products');
        allProducts = await res.json();
        buildCategories();
        renderProducts();
      } catch (err) {
        showToast('Erro ao carregar catálogo: ' + err.message);
      }
    }

    function buildCategories() {
      const cats = [...new Set(allProducts.map(p => p.category).filter(Boolean))];
      const container = document.getElementById('categoryChips');
      container.innerHTML = '<button class="chip active" onclick="filterCategory(\\'\\')">Todos</button>' +
        cats.map(c => \`<button class="chip" onclick="filterCategory('\${c}')">\${c}</button>\`).join('');
    }

    function filterCategory(cat) {
      currentCategory = cat;
      document.querySelectorAll('#categoryChips .chip').forEach(chip => {
        chip.classList.toggle('active', (chip.textContent === 'Todos' && !cat) || chip.textContent === cat);
      });
      renderProducts();
    }

    function renderProducts() {
      const q = document.getElementById('prodSearch').value.toLowerCase().trim();
      const grid = document.getElementById('productsGrid');

      const filtered = allProducts.filter(p => {
        const matchCat = !currentCategory || p.category === currentCategory;
        const matchQ = !q || p.name.toLowerCase().includes(q) || (p.category && p.category.toLowerCase().includes(q));
        return matchCat && matchQ;
      });

      if (!filtered.length) {
        grid.innerHTML = '<div style="padding:20px; color:#64748b;">Nenhum produto encontrado.</div>';
        return;
      }

      grid.innerHTML = filtered.map(p => {
        const pJson = JSON.stringify(p).replace(/"/g, '&quot;');
        return \`
          <div class="prod-card" onclick="addToCart(\${pJson})">
            <div class="prod-card-name">\${p.name}</div>
            <div class="prod-card-bottom">
              <span class="prod-card-price">R$ \${p.price.toFixed(2).replace('.', ',')}</span>
              <span class="prod-card-stock">\${p.stock > 0 ? p.stock + ' ' + (p.unit || 'UN') : 'Livre'}</span>
            </div>
          </div>
        \`;
      }).join('');
    }

    // CARRINHO DE VENDA
    function addToCart(product) {
      const existing = cart.find(i => i.productId === product.id);
      if (existing) {
        existing.quantity += 1;
      } else {
        cart.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          unit: product.unit || 'UN',
        });
      }
      renderCart();
    }

    function updateQty(index, delta) {
      cart[index].quantity += delta;
      if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
      }
      renderCart();
    }

    function clearCart() {
      cart = [];
      renderCart();
    }

    function getCartTotal() {
      return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    function renderCart() {
      const container = document.getElementById('cartItems');
      const totalDisplay = document.getElementById('cartTotalDisplay');
      const total = getCartTotal();

      totalDisplay.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');

      if (!cart.length) {
        container.innerHTML = '<div class="cart-empty">Nenhum produto adicionado.<br>Toque em um item do catálogo para lançar.</div>';
        return;
      }

      container.innerHTML = cart.map((item, idx) => \`
        <div class="cart-item">
          <div class="cart-item-info">
            <div class="cart-item-name">\${item.name}</div>
            <div class="cart-item-price">R$ \${item.price.toFixed(2).replace('.', ',')} / \${item.unit}</div>
          </div>
          <div class="qty-controls">
            <button class="btn-qty" onclick="updateQty(\${idx}, -1)">-</button>
            <span class="cart-item-qty">\${item.quantity}</span>
            <button class="btn-qty" onclick="updateQty(\${idx}, 1)">+</button>
          </div>
          <div class="cart-item-subtotal">R$ \${(item.price * item.quantity).toFixed(2).replace('.', ',')}</div>
        </div>
      \`).join('');
    }

    // SUBMETER VENDA
    async function submitSale(paymentMethod) {
      if (!cart.length) {
        showToast('Adicione ao menos um produto para lançar a venda.');
        return;
      }

      const custPhone = document.getElementById('custPhone').value.trim();
      const custName = document.getElementById('custName').value.trim();
      const operatorName = document.getElementById('operatorSelect').value;

      if (paymentMethod === 'PIX' && !custPhone) {
        if (!confirm('Recomendamos informar o WhatsApp do cliente para validar o comprovante automaticamente. Deseja continuar mesmo sem telefone?')) {
          document.getElementById('custPhone').focus();
          return;
        }
      }

      try {
        const payload = {
          items: cart,
          paymentMethod,
          customerPhone: custPhone,
          customerName: custName,
          operatorName,
        };

        const res = await fetch('/api/caixa/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao registrar venda');

        const order = data.order;
        clearCart();
        document.getElementById('custPhone').value = '';
        document.getElementById('custName').value = '';

        if (paymentMethod === 'PIX') {
          openPixModal(order);
        } else {
          showToast(\`✅ Pedido #\${order.ticketNumber || order.id.slice(-4)} encaminhado para o Caixa!\`);
          loadQueueOrders();
        }
      } catch (err) {
        showToast('Erro: ' + err.message);
      }
    }

    // MODAL PIX & POLLING DE COMPROVANTE WHATSAPP
    function openPixModal(order) {
      activePixOrderId = order.id;
      const modal = document.getElementById('modalPix');
      modal.classList.remove('hidden');

      document.getElementById('modalPixTitle').textContent = \`Pagamento PIX · Pedido #\${order.ticketNumber || order.id.slice(-4)}\`;
      document.getElementById('pixTotalText').textContent = 'R$ ' + Number(order.total || 0).toFixed(2).replace('.', ',');
      document.getElementById('pixCodeBox').textContent = order.pixCode || '';

      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(order.pixCode || '');
      document.getElementById('pixQrImg').src = qrUrl;

      const statusBox = document.getElementById('pixLiveStatus');
      statusBox.className = 'live-status-box waiting';
      document.getElementById('pixStatusText').textContent = 'Aguardando cliente enviar comprovante no WhatsApp...';

      // Polling a cada 2s para detectar quando o comprovante do cliente cair no WhatsApp
      clearInterval(pixPollingInterval);
      pixPollingInterval = setInterval(async () => {
        if (!activePixOrderId) return;
        try {
          const res = await fetch(\`/api/caixa/orders/\${activePixOrderId}\`);
          const ord = await res.json();
          if (ord.status === 'CONFIRMED' || ord.status === 'PAID_CONFIRMED') {
            clearInterval(pixPollingInterval);
            statusBox.className = 'live-status-box success';
            statusBox.innerHTML = \`
              <span style="font-size:24px;">🎉</span>
              <span>PAGAMENTO PIX CONFIRMADO! ✅</span>
              <p style="font-size:12px; font-weight:400; margin-top:4px;">Comprovante validado com sucesso! Cliente liberado sem fila no caixa.</p>
            \`;
            showToast('✅ PIX Confirmado com sucesso!');
            loadQueueOrders();
          }
        } catch (_) {}
      }, 2000);
    }

    function closePixModal() {
      clearInterval(pixPollingInterval);
      activePixOrderId = null;
      document.getElementById('modalPix').classList.add('hidden');
    }

    function copyPixCode() {
      const code = document.getElementById('pixCodeBox').textContent;
      navigator.clipboard.writeText(code).then(() => showToast('Chave PIX copiada!'));
    }

    async function confirmCurrentPixManual() {
      if (!activePixOrderId) return;
      if (!confirm('Deseja confirmar o recebimento do PIX manualmente?')) return;
      try {
        await fetch(\`/api/caixa/orders/\${activePixOrderId}/confirm\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verifiedVia: 'PIX_MANUAL_COLABORADOR' }),
        });
        showToast('PIX confirmado manualmente!');
        closePixModal();
        loadQueueOrders();
      } catch (err) {
        showToast('Erro: ' + err.message);
      }
    }

    async function resendPixWhatsApp() {
      if (!activePixOrderId) return;
      const phone = prompt('Digite o número de WhatsApp do cliente com DDD (apenas números):');
      if (!phone) return;
      try {
        await fetch(\`/api/caixa/orders/\${activePixOrderId}/send-whatsapp\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
        showToast('Dados do PIX enviados no WhatsApp!');
      } catch (err) {
        showToast('Erro: ' + err.message);
      }
    }

    // CARREGAR FILA DO CAIXA & HISTÓRICO
    async function loadQueueOrders() {
      try {
        const res = await fetch('/api/caixa/orders');
        const data = await res.json();

        // Atualiza métricas
        const m = data.metrics || {};
        document.getElementById('metricTotal').textContent = 'R$ ' + Number(m.totalRevenue || 0).toFixed(2).replace('.', ',');
        document.getElementById('metricCount').textContent = m.orderCount || 0;
        document.getElementById('metricPix').textContent = 'R$ ' + Number(m.byPayment?.PIX || 0).toFixed(2).replace('.', ',');
        document.getElementById('metricCard').textContent = 'R$ ' + Number(m.byPayment?.CARTAO || 0).toFixed(2).replace('.', ',');
        document.getElementById('metricCash').textContent = 'R$ ' + Number(m.byPayment?.DINHEIRO || 0).toFixed(2).replace('.', ',');

        // Atualiza Badges de contagem
        const totalPending = (data.pendingCashier?.length || 0) + (data.pendingPix?.length || 0);
        const qBadge = document.getElementById('queueBadge');
        qBadge.textContent = totalPending;
        qBadge.classList.toggle('zero', totalPending === 0);

        const cBadge = document.getElementById('cashierCountBadge');
        cBadge.textContent = data.pendingCashier?.length || 0;
        cBadge.classList.toggle('zero', (data.pendingCashier?.length || 0) === 0);

        const pBadge = document.getElementById('pixCountBadge');
        pBadge.textContent = data.pendingPix?.length || 0;
        pBadge.classList.toggle('zero', (data.pendingPix?.length || 0) === 0);

        // Renderiza Fila do Caixa (Cartão / Dinheiro)
        renderCashierList(data.pendingCashier || []);

        // Renderiza Fila do PIX
        renderPixList(data.pendingPix || []);

        // Renderiza Histórico
        renderHistoryList(data.completedToday || []);
      } catch (_) {}
    }

    function renderCashierList(orders) {
      const container = document.getElementById('cashierOrdersGrid');
      if (!orders.length) {
        container.innerHTML = '<div style="color:#64748b; font-size:13px; padding:10px;">Nenhum cliente aguardando no caixa no momento.</div>';
        return;
      }

      container.innerHTML = orders.map(ord => {
        const itemsTxt = (ord.items || []).map(i => \`\${i.quantity}x \${i.name}\`).join(', ');
        const ordJson = JSON.stringify(ord).replace(/"/g, '&quot;');
        return \`
          <div class="order-card cashier-wait">
            <div class="order-card-top">
              <div>
                <span class="order-card-ticket">#\${ord.ticketNumber || ord.id.slice(-4)}</span>
                <span style="font-weight:700; margin-left:6px;">\${ord.customerName}</span>
                <div class="order-card-meta">\${ord.customerPhone || 'Balcão'} · \${ord.operatorName || 'Colaborador'}</div>
              </div>
              <span class="order-status-badge wait-cashier">\${ord.paymentMethod === 'CARTAO' ? '💳 Cartão' : '💵 Dinheiro'}</span>
            </div>
            <div class="order-card-items">\${itemsTxt}</div>
            <div class="order-card-total">
              <span>Total a receber</span>
              <strong>R$ \${Number(ord.total || 0).toFixed(2).replace('.', ',')}</strong>
            </div>
            <div class="order-actions">
              <button class="btn-action primary" onclick="openCashierPayModal(\${ordJson})">💵 Receber no Caixa</button>
              <button class="btn-action cancel" onclick="cancelOrderAction('\${ord.id}')" title="Cancelar">✕</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderPixList(orders) {
      const container = document.getElementById('pixOrdersGrid');
      if (!orders.length) {
        container.innerHTML = '<div style="color:#64748b; font-size:13px; padding:10px;">Nenhum PIX pendente de comprovante no momento.</div>';
        return;
      }

      container.innerHTML = orders.map(ord => {
        const itemsTxt = (ord.items || []).map(i => \`\${i.quantity}x \${i.name}\`).join(', ');
        const ordJson = JSON.stringify(ord).replace(/"/g, '&quot;');
        return \`
          <div class="order-card pix-wait">
            <div class="order-card-top">
              <div>
                <span class="order-card-ticket">#\${ord.ticketNumber || ord.id.slice(-4)}</span>
                <span style="font-weight:700; margin-left:6px;">\${ord.customerName}</span>
                <div class="order-card-meta">WhatsApp: \${ord.customerPhone || 'Não informado'}</div>
              </div>
              <span class="order-status-badge wait-pix">🟡 Aguardando PIX</span>
            </div>
            <div class="order-card-items">\${itemsTxt}</div>
            <div class="order-card-total">
              <span>Valor PIX</span>
              <strong style="color:var(--pix);">R$ \${Number(ord.total || 0).toFixed(2).replace('.', ',')}</strong>
            </div>
            <div class="order-actions">
              <button class="btn-action" onclick="openPixModal(\${ordJson})">🔍 QR Code</button>
              <button class="btn-action pix-confirm" onclick="confirmOrderDirect('\${ord.id}', 'PIX')">✅ Validar</button>
              <button class="btn-action cancel" onclick="cancelOrderAction('\${ord.id}')" title="Cancelar">✕</button>
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderHistoryList(orders) {
      const container = document.getElementById('historyOrdersGrid');
      if (!orders.length) {
        container.innerHTML = '<div style="color:#64748b; font-size:13px; padding:10px;">Nenhuma venda finalizada hoje ainda.</div>';
        return;
      }

      container.innerHTML = orders.map(ord => {
        const itemsTxt = (ord.items || []).map(i => \`\${i.quantity}x \${i.name}\`).join(', ');
        const time = (ord.paidAt || ord.createdAt || '').slice(11, 16);
        return \`
          <div class="order-card" style="border-left:4px solid #16a34a;">
            <div class="order-card-top">
              <div>
                <span class="order-card-ticket">#\${ord.ticketNumber || ord.id.slice(-4)}</span>
                <span style="font-weight:700; margin-left:6px;">\${ord.customerName}</span>
                <div class="order-card-meta">\${time} · \${ord.paymentMethod} · \${ord.verifiedVia || 'Finalizado'}</div>
              </div>
              <span class="order-status-badge confirmed">✅ Concluído</span>
            </div>
            <div class="order-card-items">\${itemsTxt}</div>
            <div class="order-card-total">
              <span>Total Pago</span>
              <strong>R$ \${Number(ord.total || 0).toFixed(2).replace('.', ',')}</strong>
            </div>
          </div>
        \`;
      }).join('');
    }

    // MODAL DE RECEBER NO CAIXA
    function openCashierPayModal(order) {
      activeCashierOrder = order;
      document.getElementById('modalCashierPay').classList.remove('hidden');
      document.getElementById('modalPayTitle').textContent = \`Receber Pedido #\${order.ticketNumber || order.id.slice(-4)}\`;

      const itemsHtml = (order.items || []).map(i => \`<div>• \${i.quantity}x \${i.name} (R$ \${(i.price * i.quantity).toFixed(2).replace('.', ',')})</div>\`).join('');
      document.getElementById('modalPayDetails').innerHTML = \`
        <div style="font-weight:700; font-size:14px; margin-bottom:4px;">\${order.customerName} (\${order.paymentMethod})</div>
        \${itemsHtml}
        <div style="margin-top:8px; font-size:16px; font-weight:800; border-top:1px solid #e2e8f0; padding-top:6px;">
          Total a Pagar: R$ \${Number(order.total || 0).toFixed(2).replace('.', ',')}
        </div>
      \`;

      const isCash = (order.paymentMethod || '').toUpperCase() === 'DINHEIRO';
      const cashSection = document.getElementById('cashCalcSection');
      cashSection.style.display = isCash ? 'block' : 'none';

      if (isCash) {
        document.getElementById('cashReceivedInput').value = '';
        document.getElementById('changeDueDisplay').textContent = 'R$ 0,00';
        const total = Number(order.total || 0);
        const presets = [Math.ceil(total), Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50 || 50, 100];
        const uniquePresets = [...new Set(presets.filter(p => p >= total))].slice(0, 4);

        document.getElementById('cashPresets').innerHTML = uniquePresets.map(val => \`
          <button class="btn-cash-preset" type="button" onclick="setCashReceived(\${val})">R$ \${val.toFixed(2).replace('.', ',')}</button>
        \`).join('');
      }
    }

    function closePayModal() {
      activeCashierOrder = null;
      document.getElementById('modalCashierPay').classList.add('hidden');
    }

    function setCashReceived(val) {
      document.getElementById('cashReceivedInput').value = val.toFixed(2);
      calculateChange();
    }

    function calculateChange() {
      if (!activeCashierOrder) return;
      const total = Number(activeCashierOrder.total || 0);
      const received = parseFloat(document.getElementById('cashReceivedInput').value) || 0;
      const change = Math.max(0, received - total);
      document.getElementById('changeDueDisplay').textContent = 'R$ ' + change.toFixed(2).replace('.', ',');
    }

    async function confirmCashierPaymentAction() {
      if (!activeCashierOrder) return;
      const isCash = (activeCashierOrder.paymentMethod || '').toUpperCase() === 'DINHEIRO';
      const received = parseFloat(document.getElementById('cashReceivedInput').value) || null;
      const change = Math.max(0, (received || 0) - Number(activeCashierOrder.total || 0));

      try {
        await fetch(\`/api/caixa/orders/\${activeCashierOrder.id}/confirm\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verifiedVia: isCash ? 'CAIXA_DINHEIRO' : 'CAIXA_CARTAO',
            receivedAmount: isCash ? received : null,
            changeGiven: isCash ? change : 0,
          }),
        });

        showToast('✅ Pagamento recebido com sucesso!');
        closePayModal();
        loadQueueOrders();
      } catch (err) {
        showToast('Erro: ' + err.message);
      }
    }

    async function confirmOrderDirect(orderId, method) {
      if (!confirm(\`Confirmar pagamento do pedido via \${method}?\`)) return;
      try {
        await fetch(\`/api/caixa/orders/\${orderId}/confirm\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verifiedVia: 'DIRETO_' + method }),
        });
        showToast('Pedido finalizado com sucesso!');
        loadQueueOrders();
      } catch (err) {
        showToast('Erro: ' + err.message);
      }
    }

    async function cancelOrderAction(orderId) {
      if (!confirm('Tem certeza que deseja cancelar este pedido?')) return;
      try {
        await fetch(\`/api/caixa/orders/\${orderId}/cancel\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Cancelado pelo operador' }),
        });
        showToast('Pedido cancelado.');
        loadQueueOrders();
      } catch (err) {
        showToast('Erro: ' + err.message);
      }
    }
  </script>
</body>
</html>`;
}

module.exports = {
  renderCaixaHtml,
};
