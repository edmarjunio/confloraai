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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Conflora — Caixa & Frente de Loja</title>
  <style>
    :root {
      --primary: #2e9348;
      --primary-hover: #25783b;
      --primary-light: #dcfce7;
      --primary-dark: #14532d;
      --pix: #059669;
      --pix-bg: #ecfdf5;
      --card: #2563eb;
      --card-bg: #eff6ff;
      --cash: #d97706;
      --cash-bg: #fffbeb;
      --bg: #f8f9fa;
      --surface: #ffffff;
      --border: #e2e8f0;
      --text: #1a1a1a;
      --muted: #64748b;
      --danger: #dc2626;
      --radius: 12px;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
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
    .operator-access { display: flex; align-items: center; gap: 6px; }
    .operator-access input { width: 82px; padding: 6px 8px; font-size: 12px; }
    .operator-access button, .operator-session button { min-height: 34px; padding: 6px 10px; border: 0; border-radius: 8px; background: var(--primary); color: #fff; font-size: 12px; font-weight: 700; }
    .operator-session { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 10px; background: #fff; font-size: 12px; }
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
    @media (min-width: 1024px) {
      .products-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    }
    @media (max-width: 480px) {
      .products-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        padding: 8px;
      }
    }
    .prod-card {
      background: #fff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px;
      min-width: 0;
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
    .discount-control { display: grid; grid-template-columns: 1fr 110px; align-items: center; gap: 8px; font-size: 13px; font-weight: 650; }
    .discount-control input { padding: 8px 10px; }
    .financial-summary { display: grid; gap: 4px; color: var(--muted); font-size: 12px; }
    .financial-summary > div { display: flex; justify-content: space-between; gap: 10px; }
    .financial-summary strong { color: var(--text); font-weight: 650; }
    .customer-quick-form { display: grid; gap: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: #fff; }
    [hidden] { display: none !important; }
    @media (max-width: 640px) {
      header { padding-bottom: 12px; }
      .header-right { width: 100%; justify-content: flex-end; }
      .operator-access { display: grid; grid-template-columns: minmax(0, 1fr) 76px auto; width: 100%; }
      .operator-access select { min-width: 0; width: 100%; }
      .operator-access input { width: 100%; }
      .operator-session { justify-content: space-between; }
      .header-right .nav-tabs { position: fixed; inset: auto 0 0; z-index: 500; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: 8px 8px calc(8px + env(safe-area-inset-bottom)); border-radius: 0; border-top: 1px solid var(--border); background: #fff; box-shadow: 0 -4px 16px rgba(26, 26, 26, 0.08); }
      .tab-btn { justify-content: center; min-height: 44px; padding: 6px 2px; gap: 3px; font-size: 11px; }
      main { padding-bottom: 82px; }
      .pos-layout { gap: 10px; }
      .catalog-panel, .cart-panel { border-radius: 12px; }
      .modal-overlay { align-items: flex-end; padding: 0; }
      .modal-card { max-height: 88dvh; border-radius: 16px 16px 0 0; padding-bottom: calc(20px + env(safe-area-inset-bottom)); }
      .modal-card::before { content: ""; width: 42px; height: 5px; border-radius: 5px; background: #cbd5e1; align-self: center; margin-top: -8px; }
      .discount-control { grid-template-columns: 1fr 96px; }
    }
    .pos-layout.cart-mode { grid-template-columns: minmax(0, 1fr); height: auto; }
    .pos-layout.cart-mode .catalog-panel { display: none; }
    .pos-layout.cart-mode .cart-panel { width: 100%; max-width: 720px; min-height: calc(100dvh - 150px); margin: 0 auto; }
    .pos-layout.cart-mode .cart-items { max-height: none; }
    @media (max-width: 860px) {
      .pos-layout.cart-mode { display: grid; }
      .pos-layout.cart-mode .cart-panel { min-height: calc(100dvh - 185px); }
    }
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
      <div class="operator-access" id="operatorAccess">
        <select id="operatorSelect" class="operator-select" aria-label="Operador do caixa">
          <option value="Atendente do Caixa">Atendente do Caixa</option>
        </select>
        <input type="password" id="operatorPin" inputmode="numeric" autocomplete="current-password" placeholder="PIN" aria-label="PIN do operador">
        <button id="operatorLoginBtn" type="button">Entrar</button>
      </div>
      <div class="operator-session" id="operatorSession" hidden>
        <span id="operatorSessionLabel"></span>
        <button id="operatorLogoutBtn" type="button">Sair</button>
      </div>

      <div class="nav-tabs">
        <button class="tab-btn active" id="tabBtnPos" onclick="switchTab('pos')">
          ⚡ Venda
        </button>
        <button class="tab-btn" id="tabBtnCart" onclick="switchTab('cart')">
          🧾 Comanda <span id="cartBadge" class="badge-count zero">0</span>
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
          <div class="financial-summary">
            <div><span>Subtotal</span><strong id="cartSubtotalDisplay">R$ 0,00</strong></div>
            <div><span>Desconto</span><strong id="cartDiscountDisplay">- R$ 0,00</strong></div>
          </div>
          <div class="total-row">
            <span>TOTAL A PAGAR</span>
            <strong id="cartTotalDisplay">R$ 0,00</strong>
          </div>
          <div id="discountApprovalStatus" class="live-status-box waiting" hidden role="status" aria-live="polite">
            <span>Solicitação enviada ao Admin</span>
            <small>O carrinho ficará bloqueado até a revisão.</small>
          </div>

          <div class="customer-fields">
            <input type="search" id="custSearch" class="cust-input" list="custSuggestions" placeholder="Buscar cliente por nome ou celular..." autocomplete="off">
            <datalist id="custSuggestions"></datalist>
            <input type="hidden" id="custPhone">
            <input type="hidden" id="custName">
            <button type="button" class="btn-action" id="quickRegisterToggle" hidden>＋ Cadastro rápido</button>
            <div class="customer-quick-form" id="customerQuickForm" hidden>
              <input type="text" id="quickCustomerName" class="cust-input" placeholder="Nome do cliente">
              <input type="tel" id="quickCustomerPhone" class="cust-input" placeholder="Celular com DDD">
              <button type="button" class="btn-action primary" id="quickCustomerSave">Salvar cadastro</button>
            </div>
            <label class="discount-control" for="discountPercent">
              <span>Desconto da venda (%)</span>
              <input type="number" id="discountPercent" class="cust-input" min="0" max="100" step="0.5" value="0" inputmode="decimal">
            </label>
            <div class="cust-hint">
              <span>Descontos acima de 5% precisam da aprovação do administrador.</span>
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

  <!-- MODAL PIX (CONFIRMAÇÃO AUTOMÁTICA PELO MERCADO PAGO) -->
  <div id="modalPix" class="modal-overlay hidden">
    <div class="modal-card">
      <div class="modal-header">
        <h3 id="modalPixTitle">Pagamento PIX · Pedido #000</h3>
        <button class="btn-modal-close" onclick="closePixModal()">×</button>
      </div>

      <div class="live-status-box waiting" id="pixLiveStatus">
        <span style="font-size:18px;">🟡</span>
        <span id="pixStatusText">Aguardando pagamento aprovado pelo Mercado Pago...</span>
        <small style="font-weight:400; opacity:0.85;">O pedido é confirmado automaticamente após a aprovação real do PIX.</small>
      </div>

      <div class="qr-container">
        <div style="font-size:13px; color:#64748b; margin-bottom:6px;">O QR Code Pix aparece na página segura do Mercado Pago:</div>
        <div style="font-size:22px; font-weight:800; color:var(--pix);" id="pixTotalText">R$ 0,00</div>
        <a id="pixCheckoutLink" class="btn-action pix-confirm" target="_blank" rel="noopener noreferrer" style="display:block; margin-top:10px; text-decoration:none;">
          Abrir pagamento Pix
        </a>
      </div>

      <pre id="pixReceiptText" style="max-height:180px; overflow:auto; white-space:pre-wrap; background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:10px; font-family:inherit; font-size:12px; line-height:1.5;"></pre>

      <div style="display:flex; flex-direction:column; gap:6px;">
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
    let activeApprovalId = null;
    let approvalPollingInterval = null;
    let customerSuggestions = new Map();
    let customerSearchTimer = null;
    let saleSubmitting = false;
    let currentOperatorUser = null;
    let customerAuthWarningShown = false;
    let availableOperators = [];

    // INICIALIZAÇÃO
    window.addEventListener('DOMContentLoaded', async () => {
      await loadOperatorSession();
      await loadProducts();
      await loadQueueOrders();
      setInterval(() => {
        if (!document.hidden) loadQueueOrders();
      }, 15000);

      document.getElementById('prodSearch').addEventListener('input', renderProducts);
      document.getElementById('cashReceivedInput').addEventListener('input', calculateChange);
      document.getElementById('discountPercent').addEventListener('input', renderCart);
      document.getElementById('custSearch').addEventListener('input', scheduleCustomerSearch);
      document.getElementById('custSearch').addEventListener('change', selectCustomerSuggestion);
      document.getElementById('quickRegisterToggle').addEventListener('click', openQuickCustomerForm);
      document.getElementById('quickCustomerSave').addEventListener('click', saveQuickCustomer);
      document.getElementById('operatorLoginBtn').addEventListener('click', loginOperator);
      document.getElementById('operatorLogoutBtn').addEventListener('click', logoutOperator);
      document.getElementById('operatorPin').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') loginOperator();
      });
    });

    async function loadOperatorSession() {
      try {
        const [sessionResponse, operatorsResponse] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/admin/auth/users'),
        ]);
        if (operatorsResponse.ok) {
          availableOperators = (await operatorsResponse.json()).filter((user) => ['ADMIN', 'CAIXA'].includes(user.role));
          const select = document.getElementById('operatorSelect');
          select.replaceChildren(...availableOperators.map((user) => {
            const option = document.createElement('option');
            option.value = user.name;
            option.textContent = user.name;
            option.dataset.userId = user.id;
            return option;
          }));
        }
        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          if (['ADMIN', 'CAIXA'].includes(session.user?.role)) currentOperatorUser = session.user;
        }
        if (currentOperatorUser) document.getElementById('operatorSelect').value = currentOperatorUser.name;
        updateOperatorSession();
      } catch (_) {
        updateOperatorSession();
      }
    }

    function updateOperatorSession() {
      const isAuthenticated = !!currentOperatorUser;
      document.getElementById('operatorAccess').hidden = isAuthenticated;
      document.getElementById('operatorSession').hidden = !isAuthenticated;
      if (isAuthenticated) {
        document.getElementById('operatorSessionLabel').textContent = currentOperatorUser.name + ' · ' + currentOperatorUser.role;
      }
    }

    async function loginOperator() {
      const selectedOperator = availableOperators.find((user) => user.name === document.getElementById('operatorSelect').value);
      const pin = document.getElementById('operatorPin').value.trim();
      if (!selectedOperator || !pin) {
        showToast('Selecione o operador e informe o PIN.');
        return;
      }
      try {
        const response = await fetch('/api/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: selectedOperator.id, pin }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'PIN inválido.');
        currentOperatorUser = result.user;
        customerAuthWarningShown = false;
        document.getElementById('operatorPin').value = '';
        updateOperatorSession();
        await loadQueueOrders();
        showToast('Caixa liberado para ' + currentOperatorUser.name + '.');
      } catch (error) {
        showToast(error.message);
      }
    }

    async function logoutOperator() {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      currentOperatorUser = null;
      updateOperatorSession();
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      clearTimeout(showToast.timer);
      showToast.timer = setTimeout(() => t.classList.add('hidden'), 3500);
    }

    function switchTab(tab) {
      document.getElementById('tabBtnPos').classList.toggle('active', tab === 'pos');
      document.getElementById('tabBtnCart').classList.toggle('active', tab === 'cart');
      document.getElementById('tabBtnQueue').classList.toggle('active', tab === 'queue');
      document.getElementById('tabBtnHistory').classList.toggle('active', tab === 'history');

      const isPosView = tab === 'pos' || tab === 'cart';
      document.getElementById('viewPos').style.display = isPosView ? 'grid' : 'none';
      document.getElementById('viewPos').classList.toggle('cart-mode', tab === 'cart');
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
      const subtotal = getCartSubtotal();
      const percent = Math.max(0, Math.min(100, Number(document.getElementById('discountPercent').value) || 0));
      return Math.max(0, Number((subtotal * (1 - percent / 100)).toFixed(2)));
    }

    function getCartSubtotal() {
      return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    function renderCart() {
      const container = document.getElementById('cartItems');
      const totalDisplay = document.getElementById('cartTotalDisplay');
      const total = getCartTotal();
      const subtotal = getCartSubtotal();
      const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

      totalDisplay.textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
      document.getElementById('cartSubtotalDisplay').textContent = 'R$ ' + subtotal.toFixed(2).replace('.', ',');
      document.getElementById('cartDiscountDisplay').textContent = '- R$ ' + (subtotal - total).toFixed(2).replace('.', ',');
      document.getElementById('cartBadge').textContent = cartCount;
      document.getElementById('cartBadge').classList.toggle('zero', cartCount === 0);

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
      if (saleSubmitting || activeApprovalId) return;
      if (!currentOperatorUser) {
        showToast('Entre com o PIN do operador para registrar uma venda.');
        document.getElementById('operatorPin').focus();
        return;
      }
      if (!cart.length) {
        showToast('Adicione ao menos um produto para lançar a venda.');
        return;
      }

      const custPhone = document.getElementById('custPhone').value.trim();
      const custName = document.getElementById('custName').value.trim();
      const operatorName = document.getElementById('operatorSelect').value;
      const discountPercent = Number(document.getElementById('discountPercent').value) || 0;
      if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
        showToast('Informe um desconto entre 0% e 100%.');
        return;
      }

      if (paymentMethod === 'PIX' && !custPhone) {
        if (!confirm('Recomendamos informar o WhatsApp do cliente para validar o comprovante automaticamente. Deseja continuar mesmo sem telefone?')) {
          document.getElementById('custPhone').focus();
          return;
        }
      }

      try {
        saleSubmitting = true;
        const payload = {
          items: cart,
          paymentMethod,
          customerPhone: custPhone,
          customerName: custName,
          operatorName,
          discountPercent,
        };

        const res = await fetch('/api/caixa/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao registrar venda');
        if (data.approvalRequired) {
          activeApprovalId = data.approval.id;
          setApprovalPending(true);
          pollDiscountApproval();
          return;
        }

        const order = data.order;
        clearCart();
        clearCustomerSelection();
        document.getElementById('discountPercent').value = '0';

        if (paymentMethod === 'PIX') {
          openPixModal(order);
        } else {
          showToast(\`✅ Pedido #\${order.ticketNumber || order.id.slice(-4)} encaminhado para o Caixa!\`);
          loadQueueOrders();
        }
      } catch (err) {
        showToast('Erro: ' + err.message);
      } finally {
        saleSubmitting = false;
      }
    }

    function setApprovalPending(isPending) {
      document.getElementById('discountApprovalStatus').hidden = !isPending;
      document.getElementById('discountPercent').disabled = isPending;
      document.getElementById('prodSearch').disabled = isPending;
      document.querySelectorAll('#viewPos .btn-pay, #viewPos .btn-clear-cart, #viewPos .btn-qty').forEach((button) => {
        button.disabled = isPending;
      });
      document.getElementById('productsGrid').style.pointerEvents = isPending ? 'none' : '';
    }

    function pollDiscountApproval() {
      clearInterval(approvalPollingInterval);
      showToast('Desconto enviado ao Admin. Aguardando aprovação.');
      approvalPollingInterval = setInterval(async () => {
        if (!activeApprovalId) return;
        try {
          const response = await fetch('/api/caixa/discount-approvals/' + encodeURIComponent(activeApprovalId));
          const result = await response.json();
          if (!response.ok || result.status === 'PENDING') return;
          clearInterval(approvalPollingInterval);
          activeApprovalId = null;
          setApprovalPending(false);
          if (result.status === 'APPROVED' && result.order) {
            clearCart();
            clearCustomerSelection();
            document.getElementById('discountPercent').value = '0';
            if (result.order.paymentMethod === 'PIX') openPixModal(result.order);
            else showToast('Desconto aprovado. Venda liberada para recebimento.');
            loadQueueOrders();
            return;
          }
          showToast('Desconto recusado: ' + (result.reason || 'consulte o administrador.'));
        } catch (_) {}
      }, 2500);
    }

    function scheduleCustomerSearch() {
      clearTimeout(customerSearchTimer);
      customerSearchTimer = setTimeout(searchCustomers, 350);
    }

    async function searchCustomers() {
      const query = document.getElementById('custSearch').value.trim();
      const suggestions = document.getElementById('custSuggestions');
      customerSuggestions = new Map();
      suggestions.replaceChildren();
      document.getElementById('quickRegisterToggle').hidden = true;
      if (query.length < 3) return;
      try {
        const response = await fetch('/api/caixa/customers?q=' + encodeURIComponent(query));
        if (response.status === 401) {
          if (!customerAuthWarningShown) showToast('Entre com seu PIN para consultar clientes.');
          customerAuthWarningShown = true;
          return;
        }
        if (!response.ok) return;
        const customers = await response.json();
        customers.forEach((customer) => {
          const label = customer.name + ' · ' + customer.phone;
          customerSuggestions.set(label, customer);
          const option = document.createElement('option');
          option.value = label;
          suggestions.appendChild(option);
        });
        document.getElementById('quickRegisterToggle').hidden = customers.length > 0;
      } catch (_) {}
    }

    function selectCustomerSuggestion() {
      const customer = customerSuggestions.get(document.getElementById('custSearch').value);
      if (!customer) return;
      document.getElementById('custName').value = customer.name || '';
      document.getElementById('custPhone').value = customer.phone || '';
      document.getElementById('customerQuickForm').hidden = true;
    }

    function openQuickCustomerForm() {
      const query = document.getElementById('custSearch').value.trim();
      const digits = query.replace(/\D/g, '');
      document.getElementById('quickCustomerName').value = digits ? '' : query;
      document.getElementById('quickCustomerPhone').value = digits;
      document.getElementById('customerQuickForm').hidden = false;
      document.getElementById(digits ? 'quickCustomerName' : 'quickCustomerPhone').focus();
    }

    async function saveQuickCustomer() {
      const name = document.getElementById('quickCustomerName').value.trim();
      const phone = document.getElementById('quickCustomerPhone').value.trim();
      if (!name || phone.replace(/\D/g, '').length < 10) {
        showToast('Informe nome e celular com DDD para cadastrar.');
        return;
      }
      try {
        const response = await fetch('/api/caixa/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível cadastrar o cliente.');
        document.getElementById('custSearch').value = name + ' · ' + phone;
        document.getElementById('custName').value = name;
        document.getElementById('custPhone').value = phone;
        document.getElementById('customerQuickForm').hidden = true;
        showToast('Cliente cadastrado e selecionado.');
      } catch (err) {
        showToast(err.message);
      }
    }

    function clearCustomerSelection() {
      document.getElementById('custSearch').value = '';
      document.getElementById('custPhone').value = '';
      document.getElementById('custName').value = '';
      document.getElementById('customerQuickForm').hidden = true;
    }

    // MODAL PIX & VERIFICAÇÃO DE PAGAMENTO NO MERCADO PAGO
    function openPixModal(order) {
      activePixOrderId = order.id;
      const modal = document.getElementById('modalPix');
      modal.classList.remove('hidden');

      document.getElementById('modalPixTitle').textContent = \`Pagamento PIX · Pedido #\${order.ticketNumber || order.id.slice(-4)}\`;
      document.getElementById('pixTotalText').textContent = 'R$ ' + Number(order.total || 0).toFixed(2).replace('.', ',');
      document.getElementById('pixReceiptText').textContent = order.receiptText || '';
      const checkoutLink = document.getElementById('pixCheckoutLink');
      checkoutLink.href = order.paymentCheckoutUrl || '#';
      checkoutLink.hidden = !order.paymentCheckoutUrl;
      if (
        order.receiptDelivery?.sent === false &&
        order.receiptDelivery.reason !== 'Envio não solicitado.'
      ) {
        showToast('Recibo não enviado pelo WhatsApp: ' + order.receiptDelivery.reason);
      }

      const statusBox = document.getElementById('pixLiveStatus');
      statusBox.className = 'live-status-box waiting';
      document.getElementById('pixStatusText').textContent = 'Aguardando pagamento aprovado pelo Mercado Pago...';

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
              <p style="font-size:12px; font-weight:400; margin-top:4px;">Pagamento aprovado pelo Mercado Pago.</p>
            \`;
            showToast('✅ PIX Confirmado com sucesso!');
            loadQueueOrders();
          }
        } catch (_) {}
      }, 10000);
    }

    function closePixModal() {
      clearInterval(pixPollingInterval);
      activePixOrderId = null;
      document.getElementById('modalPix').classList.add('hidden');
    }

    async function resendPixWhatsApp() {
      if (!activePixOrderId) return;
      const phone = prompt('Digite o número de WhatsApp do cliente com DDD (apenas números):');
      if (!phone) return;
      try {
        const response = await fetch(\`/api/caixa/orders/\${activePixOrderId}/send-whatsapp\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Falha no envio pelo WhatsApp.');
        showToast('Dados do PIX enviados no WhatsApp!');
      } catch (err) {
        showToast('Erro: ' + err.message);
      }
    }

    // CARREGAR FILA DO CAIXA & HISTÓRICO
    async function loadQueueOrders() {
      if (!currentOperatorUser) return;
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
