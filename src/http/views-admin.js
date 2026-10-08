const { tHtml } = require('../i18n');
const { renderFirebaseAuthScript } = require('./firebase-client');
const { GOOGLE_ANALYTICS_TAG } = require('./analytics');

const FETCH_SHIM_SCRIPT = `<script>
  try {
    var _origFetch = window.fetch;
    Object.defineProperty(window, 'fetch', {
      get: function() { return _origFetch; },
      set: function(v) { _origFetch = v; },
      configurable: true,
      enumerable: true
    });
  } catch (_) {}
</script>`;

function renderAdminHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${tHtml("interface.label.f9e271a4df57")}</title>
  ${GOOGLE_ANALYTICS_TAG}
  ${FETCH_SHIM_SCRIPT}

  <!-- Fontes Canva: Títulos com Intro Rust & Secundárias com Now -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,800;0,900;1,800&family=Plus+Jakarta+Sans:wght@400;500;600&display=swap" rel="stylesheet">

  <style>
    @font-face {
      font-family: 'Intro Rust';
      src: local('Intro Rust'), local('IntroRust-Base'), local('Montserrat-Black');
      font-weight: 800 900;
    }
    @font-face {
      font-family: 'Now';
      src: local('Now'), local('Plus Jakarta Sans'), local('Inter');
      font-weight: 400 500;
    }

    :root {
      /* Paleta Oficial Conflora Horta & Viveiro */
      --primary: #15803d;
      --primary-dark: #14532d;
      --accent: #22c55e;
      --earth: #78350f;
      --gold: #d97706;
      --border: #e2e8f0;
      --bg: #f8fafc;
      --diff-del-bg: #fee2e2;
      --diff-del-text: #991b1b;
      --diff-add-bg: #dcfce7;
      --diff-add-text: #166534;
      --diff-info-bg: #f1f5f9;
      --diff-info-text: #475569;

      /* Tipografia do Canva */
      --font-title: 'Intro Rust', 'Montserrat', -apple-system, sans-serif;
      --font-body: 'Now', 'Plus Jakarta Sans', -apple-system, sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: var(--font-body); background: #f1f5f9; color: #0f172a; padding: 16px; font-weight: 400; }
    h1, h2, h3, header h1, .nav-btn, .stat-val { font-family: var(--font-title); letter-spacing: 0.5px; }
    .container { max-width: 1380px; margin: 0 auto; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; }
    
    /* CABEÇALHO COM OPERADOR */
    header {
      background: #14532d;
      color: white;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .user-pill {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(255,255,255,0.15);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
    }
    .role-badge {
      background: #22c55e;
      color: #052e16;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
    }
    .role-badge.caixa { background: #facc15; color: #713f12; }
    .header-actions { display: flex; align-items: center; gap: 8px; }
    .header-btn {
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 7px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.2s;
    }
    .header-btn:hover { background: rgba(255,255,255,0.3); }

    /* NAVEGAÇÃO */
    .nav-tabs { display: flex; background: #0f172a; overflow-x: auto; scrollbar-width: none; }
    .nav-tabs::-webkit-scrollbar { display: none; }
    .nav-btn {
      padding: 13px 18px;
      color: #94a3b8;
      background: none;
      border: none;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border-bottom: 3px solid transparent;
      white-space: nowrap;
      transition: all 0.2s;
    }
    .nav-btn.active { color: #ffffff; border-bottom-color: #22c55e; background: rgba(255,255,255,0.05); }
    .tab-content { padding: 22px; display: none; }
    .tab-content.active { display: block; }

    /* CARDS & ESTATÍSTICAS */
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 20px; }
    .stat-card {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      position: relative;
    }
    .stat-val { font-size: 24px; font-weight: 800; color: var(--primary-dark); margin-top: 4px; }
    .stat-label { font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; }

    /* TABELAS */
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); font-size: 13px; }
    th { background: #f8fafc; font-weight: 700; color: #334155; }
    .prod-thumb { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; }

    /* BOTÕES GERAIS */
    .action-btn {
      padding: 8px 14px;
      border-radius: 6px;
      border: none;
      font-weight: 700;
      cursor: pointer;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: filter 0.15s;
    }
    .action-btn:hover { filter: brightness(0.92); }
    .btn-green { background: var(--primary); color: white; }
    .btn-blue { background: #0284c7; color: white; }
    .btn-red { background: #ef4444; color: white; }
    .btn-amber { background: #f59e0b; color: white; }
    .btn-gray { background: #e2e8f0; color: #334155; }

    /* GIT DIFF CARD */
    .diff-card {
      border: 1px solid var(--border);
      border-radius: 10px;
      margin-bottom: 16px;
      overflow: hidden;
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.04);
    }
    .diff-header {
      background: #f8fafc;
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
      gap: 8px;
    }
    .diff-reason-box {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 10px 14px;
      font-size: 13px;
      color: #92400e;
      margin: 12px 16px 6px 16px;
      border-radius: 4px;
    }
    .diff-body {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12.5px;
      padding: 10px 16px;
      line-height: 1.6;
    }
    .diff-line { padding: 3px 8px; border-radius: 4px; margin-bottom: 2px; }
    .diff-del { background: var(--diff-del-bg); color: var(--diff-del-text); }
    .diff-add { background: var(--diff-add-bg); color: var(--diff-add-text); }
    .diff-info { background: var(--diff-info-bg); color: var(--diff-info-text); font-weight: bold; }
    .diff-actions { padding: 12px 16px; background: #f8fafc; border-top: 1px solid var(--border); display: flex; justify-content: flex-end; gap: 8px; }

    /* ESTOQUE ÁGIL */
    .quick-stock-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 12px; margin-top: 14px; }
    .stock-card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; background: white; }
    .stock-btns-row { display: flex; gap: 4px; }
    .plus-btn { flex: 1; padding: 8px 2px; background: #f0fdf4; border: 1px solid #86efac; color: #166534; font-weight: 800; border-radius: 6px; cursor: pointer; font-size: 12px; }
    .plus-btn:hover { background: #dcfce7; }

    /* NOTIFICAÇÃO CARD */
    .notif-card { border-left: 4px solid #0284c7; background: #f0f9ff; padding: 12px 16px; border-radius: 6px; margin-bottom: 10px; font-size: 13px; }
    .notif-card.rejected { border-left-color: #ef4444; background: #fef2f2; }
    .notif-card.approved { border-left-color: #15803d; background: #f0fdf4; }

    /* MODAIS */
    .modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center; z-index: 100; padding: 16px; }
    .modal.open { display: flex; }
    .modal-card { background: white; border-radius: 12px; padding: 22px; max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto; }
    .badge { padding: 3px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-confirmed { background: #dcfce7; color: #166534; }
    .badge-delivered { background: #e0f2fe; color: #0369a1; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1 style="font-size: 18px; display:flex; align-items:center; gap:8px;">
          ${tHtml("interface.label.d3b681f2bd45")}
          <span style="font-size:12px; font-weight:normal; background:rgba(255,255,255,0.2); padding:2px 8px; border-radius:10px;">${tHtml("interface.label.fd3f1f75de5f")}</span>
        </h1>
        <p style="font-size: 11px; color: #bbf7d0; margin-top:2px;">${tHtml("interface.message.07c896303594")}</p>
      </div>

      <div class="header-actions">
        <div class="user-pill" id="userHeaderPill">
          <span>${tHtml("interface.label.92aa31bd77ad")}</span>
          <img id="loggedUserPhoto" alt="Foto do operador" referrerpolicy="no-referrer" hidden style="width:28px; height:28px; border-radius:50%; object-fit:cover;" />
          <strong id="loggedUserName">${tHtml("interface.label.1258573b225a")}</strong>
          <span class="role-badge" id="loggedUserRole">${tHtml("interface.label.835d6dc88b70")}</span>
        </div>
        <button class="header-btn" onclick="openLoginModal()">${tHtml("interface.label.327e044293ae")}</button>
        <button class="header-btn" onclick="logoutAdmin()" style="background:rgba(239,68,68,0.25); border:1px solid rgba(239,68,68,0.4);" title="${tHtml("interface.message.1bf69dca63ac")}">${tHtml("interface.message.09454f39c6ed")}</button>
        <button class="header-btn" onclick="showTab('notifs')">🔔 <span id="notifBadge">0</span></button>
        <a href="/" class="header-btn">${tHtml("interface.message.344ba51acfba")}</a>
      </div>
    </header>

    <!-- NAVEGAÇÃO POR ABAS (FILTRADAS AUTOMATICAMENTE POR CARGO) -->
    <div class="nav-tabs" id="navTabsContainer">
      <!-- Abas ADMIN -->
      <button class="nav-btn active" id="tabBtn-analytics" onclick="showTab('analytics')">${tHtml("interface.label.dfca290b852a")}</button>
      <button class="nav-btn" id="tabBtn-cashier" onclick="showTab('cashier')">${tHtml("interface.message.c3bf0d0d1b44")}</button>
      <button class="nav-btn" id="tabBtn-diff" onclick="showTab('diff')">${tHtml("interface.message.4771a9016dc6")} <span id="diffCountBadge" style="background:#ef4444; color:white; padding:1px 6px; border-radius:10px; font-size:10px; margin-left:4px; display:none;">0</span></button>
      <button class="nav-btn" id="tabBtn-orders" onclick="showTab('orders')">${tHtml("interface.message.97c3c95bd5ed")}</button>
      <a class="nav-btn" href="/lancamentos">${tHtml("interface.message.fb753ddf0084")}</a><a class="nav-btn" href="/fiados">${tHtml("interface.label.3eda97d0a64b")}</a><a class="nav-btn" href="/caixa">${tHtml("interface.message.5a3ac9c3b984")}</a>
      <button class="nav-btn" id="tabBtn-stock" onclick="showTab('stock')">${tHtml("interface.message.6de89ed96183")}</button>
      <button class="nav-btn" id="tabBtn-price" onclick="showTab('price')">${tHtml("interface.message.693410157af0")}</button>
      <button class="nav-btn" id="tabBtn-products" onclick="showTab('products')">${tHtml("interface.message.2f828dde928a")}</button>
      <button class="nav-btn" id="tabBtn-team" onclick="showTab('team')">${tHtml("interface.message.65f807e6587b")}</button>
      <button class="nav-btn" id="tabBtn-import" onclick="showTab('import')">${tHtml("interface.message.3143b313236a")}</button>
      <button class="nav-btn" id="tabBtn-notifs" onclick="showTab('notifs')">${tHtml("interface.message.d79b33802d7d")}</button>
      <button class="nav-btn" id="tabBtn-status" onclick="showTab('status')">${tHtml("interface.message.0f5412629907")}</button>
    </div>

    <!-- ABA 1: ANALYTICS & MÉTRICAS (EXCLUSIVA ADMIN) -->
    <div id="tab-analytics" class="tab-content active">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>${tHtml("interface.message.426ad02e4a6a")}</h2>
          <p style="font-size:12px; color:#64748b;">${tHtml("interface.label.b61c7238dcb0")} <strong>${tHtml("interface.label.d98486448988")}</strong></p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <span style="font-size:12px; background:#dcfce7; color:#166534; font-weight:bold; padding:4px 10px; border-radius:12px;">${tHtml("interface.label.68addf807195")}</span>
          <button class="action-btn btn-blue" onclick="testGaEvent()">${tHtml("interface.label.a3ba68ed05f4")}</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">${tHtml("interface.message.0fa32cae7498")}</div>
          <div class="stat-val" id="analyticsVisitors">142</div>
          <div style="font-size:11px; color:#166534; margin-top:4px;">${tHtml("interface.message.1993fff39939")}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${tHtml("interface.message.056d31a7d190")}</div>
          <div class="stat-val" id="analyticsViews">684</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">${tHtml("interface.label.699336c35d6a")}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${tHtml("interface.message.06322a14c96f")}</div>
          <div class="stat-val" id="analyticsConversion">12.4%</div>
          <div style="font-size:11px; color:#166534; margin-top:4px;">${tHtml("interface.message.7b2ca4d556b1")}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${tHtml("interface.label.ae67763c1c41")}</div>
          <div class="stat-val" id="analyticsRevenue">R$ 0,00</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">${tHtml("interface.message.a6272027d2c3")}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:16px;">
        <div style="border:1px solid var(--border); border-radius:8px; padding:16px;">
          <h3 style="font-size:14px; margin-bottom:12px;">${tHtml("interface.message.64693bbe3b83")}</h3>
          <div id="analyticsTopProducts" style="font-size:13px; color:#334155;">${tHtml("interface.message.f0e80c74ead9")}</div>
        </div>
        <div style="border:1px solid var(--border); border-radius:8px; padding:16px;">
          <h3 style="font-size:14px; margin-bottom:12px;">${tHtml("interface.message.6860f33a60ca")}</h3>
          <div id="analyticsPaymentSplit" style="font-size:13px; color:#334155;">${tHtml("interface.message.60c6adbfabc1")}</div>
        </div>
      </div>
    </div>

    <!-- ABA 2: FRENTE DE CAIXA & VENDAS DO DIA (ADMIN E CAIXA) -->
    <div id="tab-cashier" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>${tHtml("interface.message.eada9e49ecdd")}</h2>
          <p style="font-size:12px; color:#64748b;">${tHtml("interface.message.8cdc94c33e53")}</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="action-btn btn-green" onclick="openManualOrderModal()">${tHtml("interface.message.1d5dcae23f4b")}</button>
          <button class="action-btn btn-gray" onclick="loadCashierDaily()">${tHtml("interface.label.0c20213b9434")}</button>
        </div>
      </div>

      <div class="stat-grid" style="grid-template-columns: repeat(4, 1fr);">
        <div class="stat-card">
          <div class="stat-label">${tHtml("interface.message.39a75a7a759d")}</div>
          <div class="stat-val" id="cashierTotalToday">R$ 0,00</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${tHtml("interface.label.ed69a41041e6")}</div>
          <div class="stat-val" id="cashierPixToday" style="color:#15803d;">R$ 0,00</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${tHtml("interface.message.b8b2fc796fba")}</div>
          <div class="stat-val" id="cashierCardToday" style="color:#0284c7;">R$ 0,00</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${tHtml("interface.message.a3cdad6f5317")}</div>
          <div class="stat-val" id="cashierCashToday" style="color:#d97706;">R$ 0,00</div>
        </div>
      </div>

      <h3 style="margin-top:16px; font-size:14px;">${tHtml("interface.message.fc4d61570359")}</h3>
      <table id="todayOrdersTable">
        <thead>
          <tr>
            <th>${tHtml("interface.message.9e9ea5774a2d")}</th>
            <th>${tHtml("interface.message.f851d9a83ab0")}</th>
            <th>${tHtml("interface.label.120266e0386d")}</th>
            <th>${tHtml("interface.message.de58da2b5fd7")}</th>
            <th>${tHtml("interface.label.c9b3c38247f7")}</th>
            <th>${tHtml("interface.label.920e413c7d41")}</th>
            <th>${tHtml("interface.message.cb36b9d842f3")}</th>
          </tr>
        </thead>
        <tbody id="todayOrdersBody"></tbody>
      </table>
    </div>

    <!-- ABA 3: SOLICITAÇÕES DE ALTERAÇÃO - GIT DIFF (ADMIN E CAIXA) -->
    <div id="tab-diff" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>${tHtml("interface.message.c13f40d2ae9d")}</h2>
          <p style="font-size:12px; color:#64748b;">
            ${tHtml("interface.label.66e30c4a01f4")}
          </p>
        </div>
        <button class="action-btn btn-gray" onclick="loadAlterations()">${tHtml("interface.message.fc84ac3d656d")}</button>
      </div>

      <div id="alterationsListContainer">${tHtml("interface.message.0f3e76255f3a")}</div>
    </div>

    <!-- ABA 4: HISTÓRICO COMPLETO DE PEDIDOS (ADMIN) -->
    <div id="tab-orders" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <h2>${tHtml("interface.message.2371fa2f3d70")}</h2>
        <button class="action-btn btn-gray" onclick="loadAllOrders()">${tHtml("interface.label.0c20213b9434")}</button>
      </div>
      <div id="allOrdersListContainer">${tHtml("interface.message.a433f1ed73f2")}</div>
    </div>

    <!-- ABA 5: ENTRADA ÁGIL DE ESTOQUE (ADMIN E CAIXA) -->
    <div id="tab-stock" class="tab-content">
      <h2>${tHtml("interface.message.ef0f2424624d")}</h2>
      <p style="font-size:12px; color:#64748b; margin-bottom:12px;">${tHtml("interface.message.da5404588f99")}</p>
      <input type="text" id="stockSearchInput" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px;" placeholder="${tHtml("interface.message.d74c2309afbc")}" oninput="filterStockCards()" />
      <div class="quick-stock-grid" id="stockCardsGrid"></div>
    </div>

    <!-- ABA 6: CONSULTA RÁPIDA DE PREÇO (ADMIN E CAIXA) -->
    <div id="tab-price" class="tab-content">
      <h2>${tHtml("interface.message.3e6a9b28609c")}</h2>
      <p style="font-size:12px; color:#64748b; margin-bottom:12px;">${tHtml("interface.message.eaa333d7b39f")}</p>
      <input type="text" id="priceSearchInput" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-size:15px;" placeholder="${tHtml("interface.message.e3ac7530f177")}" oninput="filterPriceTable()" />
      <table style="margin-top:14px;">
        <thead>
          <tr>
            <th>${tHtml("interface.label.494e0843d958")}</th>
            <th>${tHtml("interface.message.ba1c87cedbc4")}</th>
            <th>${tHtml("interface.label.3b88e98ed63c")}</th>
            <th>${tHtml("interface.message.5d2a9297ceda")}</th>
            <th>${tHtml("interface.message.cfe73f31661d")}</th>
          </tr>
        </thead>
        <tbody id="priceTableBody"></tbody>
      </table>
    </div>

    <!-- ABA 7: CADASTRO DE PRODUTOS COM MÚLTIPLAS IMAGENS (ADMIN) -->
    <div id="tab-products" class="tab-content">
      <h2 id="productFormTitle">${tHtml("interface.message.f3e1f6158751")}</h2>
      <form id="prodForm" onsubmit="handleProductSubmit(event)" style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:14px;">
        <input type="hidden" id="formProdId" />
        <div>
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.612d4482d2e1")}</label>
          <input type="text" id="formProdName" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="${tHtml("interface.message.ade6d16b0d2c")}" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.label.8a4cbf5a2478")}</label>
          <input type="text" id="formProdCat" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="${tHtml("interface.message.2dd369472379")}" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.label.59bb2a433a1b")}</label>
          <input type="text" id="formProdSubcat" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="${tHtml("interface.message.3c329c8c5f13")}" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">Preço de Venda (R$):</label>
          <input type="number" step="0.01" id="formProdPrice" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="190.00" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.2903a5bdd3ba")}</label>
          <input type="number" id="formProdStock" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="15" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.1ab02ba817ad")}</label>
          <input type="text" id="formProdImages" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="https://..., https://..." />
        </div>
        <div style="grid-column: 1/-1;">
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.406314cebb40")}</label>
          <textarea id="formProdDesc" style="width:100%; height:60px; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Porte da muda, rega, sol pleno ou meia sombra..."></textarea>
        </div>
        <div style="grid-column: 1/-1; display:flex; gap:8px;">
          <button type="submit" class="action-btn btn-green">${tHtml("interface.label.56a824832285")}</button>
          <button type="button" class="action-btn btn-gray" onclick="resetProdForm()">${tHtml("interface.message.a104cdf1ec8c")}</button>
        </div>
      </form>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:28px; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0;">${tHtml("interface.message.29328c72ec1c")}</h3>
        <button type="button" class="action-btn btn-green" onclick="seedDefaultConflora()">${tHtml("interface.message.1c4b0457199f")}</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>${tHtml("interface.label.494e0843d958")}</th>
            <th>${tHtml("interface.label.5086900635fe")}</th>
            <th>${tHtml("interface.label.54276aa0307f")}</th>
            <th>${tHtml("interface.message.9586221ed35b")}</th>
            <th>${tHtml("interface.message.170dc34ba4a3")}</th>
            <th>${tHtml("interface.message.7d3e4d6dc900")}</th>
          </tr>
        </thead>
        <tbody id="adminProductsTableBody"></tbody>
      </table>
    </div>

    <!-- ABA 8: EQUIPE & PERMISSÕES (ADMIN) -->
    <div id="tab-team" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h2>${tHtml("interface.message.9ff8d18aff22")}</h2>
          <p style="font-size:12px; color:#64748b;">${tHtml("interface.message.dd69a2c3623e")}</p>
        </div>
        <button class="action-btn btn-green" onclick="openNewUserModal()">${tHtml("interface.message.81c1e21b03d4")}</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>${tHtml("interface.label.5086900635fe")}</th>
            <th>${tHtml("interface.message.7c3e0a691adc")}</th>
            <th>${tHtml("interface.message.038ab4d01ff9")}</th>
            <th>${tHtml("interface.label.709e58acb65e")}</th>
            <th>${tHtml("interface.label.920e413c7d41")}</th>
            <th>${tHtml("interface.message.7d3e4d6dc900")}</th>
          </tr>
        </thead>
        <tbody id="teamTableBody"></tbody>
      </table>
    </div>

    <!-- ABA 9: IMPORTAR PLANILHAS (ADMIN) -->
    <div id="tab-import" class="tab-content">
      <h2>${tHtml("interface.message.468fa0f036dc")}</h2>
      <p style="font-size:12px; color:#64748b; margin-top:4px;">${tHtml("interface.message.bb2c516c63a4")}</p>

      <div style="background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:16px; margin-top:14px;">
        <label style="font-weight:bold; font-size:13px;">${tHtml("interface.label.96ef12c1ea1e")}</label>
        <select id="importTypeSelect" style="padding:6px; border-radius:6px; border:1px solid #cbd5e1; margin-left:8px;">
          <option value="products">${tHtml("interface.message.1589f260c817")}</option>
          <option value="orders">${tHtml("interface.message.52687145099f")}</option>
          <option value="movements">${tHtml("interface.message.c4fbc3ebba41")}</option>
        </select>

        <div style="margin-top:12px;">
          <textarea id="importRawTextarea" style="width:100%; height:120px; font-family:monospace; font-size:12px; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" placeholder='[{"name": "Palmeira Imperial", "category": "Palmeiras", "price": 180, "stockQuantity": 15}]'></textarea>
        </div>

        <div style="display:flex; gap:8px; margin-top:12px;">
          <button class="action-btn btn-blue" onclick="validateImportPayload()">${tHtml("interface.label.fce838dcd15a")}</button>
          <button class="action-btn btn-green" onclick="submitImportPayload()">${tHtml("interface.label.692720baf89b")}</button>
          <button class="action-btn btn-green" onclick="seedDefaultConflora()">${tHtml("interface.message.1c4b0457199f")}</button>
        </div>
        <div id="importFeedback" style="margin-top:10px; font-size:13px;"></div>
      </div>
    </div>

    <!-- ABA 10: NOTIFICAÇÕES (CAIXA E ADMIN) -->
    <div id="tab-notifs" class="tab-content">
      <h2>${tHtml("interface.message.cca604a944e1")}</h2>
      <p style="font-size:12px; color:#64748b; margin-bottom:14px;">${tHtml("interface.message.c67995b4080f")}</p>
      <div id="notificationsContainer">${tHtml("interface.label.563d37925e08")}</div>
    </div>

    <!-- ABA 11: STATUS DAS CONEXÕES & DIAGNÓSTICO (EXCLUSIVA ADMIN) -->
    <div id="tab-status" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
        <div>
          <h2>${tHtml("interface.message.3439510af938")}</h2>
          <p style="font-size:12px; color:#64748b;">${tHtml("interface.message.dd1e26d4b424")}</p>
        </div>
        <button class="action-btn btn-green" onclick="loadAdminStatusData()" style="padding:10px 16px; font-size:13px;">
          ${tHtml("interface.label.621be55ca907")}
        </button>
      </div>

      <div id="adminStatusDashboardContainer">
        <div style="padding:30px; text-align:center; color:#64748b;">${tHtml("interface.message.4665ca143a57")}</div>
      </div>
    </div>
  </div>

  <!-- MODAL: LOGIN / TROCA DE OPERADOR / GOOGLE LOGIN -->
  <div class="modal" id="loginModal">
    <div class="modal-card" style="max-width:480px;">
      <h3 style="margin-bottom:6px; display:flex; align-items:center; gap:8px;">
        ${tHtml("interface.label.c4ae10c857d7")}
      </h3>
      <p style="font-size:12px; color:#64748b; margin-bottom:16px;">
        ${tHtml("interface.label.b5f59b8a2741")}
      </p>

      <!-- SEÇÃO 1: LOGIN COM GOOGLE -->
      <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:14px; margin-bottom:18px;">
        <div style="font-size:13px; font-weight:800; color:#14532d; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <svg style="width:16px; height:16px;" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          ${tHtml("interface.label.3e39a50641ee")}
        </div>
        <p data-google-status role="status">${tHtml("interface.message.a08d8558a271")}</p>
        <button type="button" class="action-btn btn-green" id="adminGoogleLoginButton" data-google-login disabled onclick="submitAdminGoogleLogin()" style="width:100%; justify-content:center; padding:9px; font-size:13px;">
          ${tHtml("interface.label.a1b27e47851e")}
        </button>
      </div>

      <!-- SEÇÃO 2: LOGIN COM PIN DE OPERADOR -->
      <div style="border-top:1px dashed #cbd5e1; padding-top:14px;">
        <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:8px;">
          ${tHtml("interface.label.c459e8d25a6c")}
        </div>
        <div id="userSelectList" style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;"></div>
        <div style="margin-bottom:14px;">
          <label style="font-size:11px; font-weight:bold; color:#475569;">${tHtml("interface.label.9a7a292dad13")}</label>
          <input type="password" id="loginPinInput" maxlength="6" style="width:100%; padding:8px; font-size:18px; text-align:center; letter-spacing:4px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="••••" />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="action-btn btn-gray" onclick="closeLoginModal()">${tHtml("interface.label.0f2bd88ef0ac")}</button>
          <button class="action-btn btn-green" onclick="performLogin()">${tHtml("interface.message.4311d253ee6f")}</button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL: SOLICITAÇÃO DE ALTERAÇÃO PELO CAIXA -->
  <div class="modal" id="alterationRequestModal">
    <div class="modal-card">
      <h3 style="margin-bottom:8px;">${tHtml("interface.message.293a3d8c77f6")}</h3>
      <p style="font-size:12px; color:#64748b; margin-bottom:12px;">
        ${tHtml("interface.label.67234ef61fa4")}
      </p>
      <input type="hidden" id="altOrderId" />
      <div style="margin-bottom:10px;">
        <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.07dc559c3d74")}</label>
        <input type="text" id="altCustName" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" />
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.86fa1bf5b8c2")}</label>
        <select id="altPayMethod" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">
          <option value="DINHEIRO">${tHtml("interface.message.f74b4c3d0e62")}</option>
          <option value="PIX">${tHtml("interface.label.41b0635bb279")}</option>
          <option value="CARTAO_DEBITO">${tHtml("interface.message.d072ee1e3af9")}</option>
          <option value="CARTAO_CREDITO">${tHtml("interface.message.3a23123ab237")}</option>
        </select>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px; font-weight:bold;">Valor Total Correto (R$):</label>
        <input type="number" step="0.01" id="altTotal" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" />
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:12px; font-weight:bold; color:#b45309;">${tHtml("interface.message.e9c5b13e43d3")}</label>
        <textarea id="altReason" required style="width:100%; height:60px; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="Ex: Cliente devolveu 1 muda e pegou outra de R$ 50,00 no dinheiro..."></textarea>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="action-btn btn-gray" onclick="closeAlterationModal()">${tHtml("interface.message.bb9dbb406dcb")}</button>
        <button class="action-btn btn-amber" onclick="submitAlterationRequest()">${tHtml("interface.message.7cfa8195b8c9")}</button>
      </div>
    </div>
  </div>

  <!-- MODAL: RECUSAR ALTERAÇÃO (EDMAR DIGITA O MOTIVO) -->
  <div class="modal" id="rejectReasonModal">
    <div class="modal-card">
      <h3 style="margin-bottom:8px; color:#991b1b;">${tHtml("interface.message.5c2886640cb4")}</h3>
      <p style="font-size:12px; color:#64748b; margin-bottom:12px;">
        ${tHtml("interface.label.af4239bbb159")}
      </p>
      <input type="hidden" id="rejectRequestId" />
      <div style="margin-bottom:14px;">
        <label style="font-size:12px; font-weight:bold;">${tHtml("interface.label.092f6e84e912")}</label>
        <textarea id="rejectionReasonText" required style="width:100%; height:80px; padding:8px; border:1px solid #ef4444; border-radius:6px;" placeholder="${tHtml("interface.message.8aad3647f89a")}"></textarea>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="action-btn btn-gray" onclick="closeRejectModal()">${tHtml("interface.label.59dc926760d0")}</button>
        <button class="action-btn btn-red" onclick="confirmRejectAlteration()">${tHtml("interface.message.f3f52c66bb2c")}</button>
      </div>
    </div>
  </div>

  <!-- MODAL: LANÇAR VENDA MANUAL NO BALCÃO -->
  <div class="modal" id="manualOrderModal">
    <div class="modal-card">
      <h3 style="margin-bottom:12px;">${tHtml("interface.message.7d8a722d615b")}</h3>
      <form onsubmit="submitManualOrder(event)">
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.2144f9321d51")}</label>
          <input type="text" id="mCustName" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="${tHtml("interface.message.033a7f5bde38")}" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.label.f867611159c2")}</label>
          <input type="text" id="mCustPhone" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="64999990000" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.3fa2b9070e87")}</label>
          <select id="mProdSelect" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></select>
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.7a0f29ee272a")}</label>
          <input type="number" id="mQty" min="1" value="1" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" />
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.fdef49897d85")}</label>
          <select id="mPayMethod" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">
            <option value="DINHEIRO">${tHtml("interface.message.f74b4c3d0e62")}</option>
            <option value="PIX">${tHtml("interface.label.41b0635bb279")}</option>
            <option value="CARTAO_DEBITO">${tHtml("interface.message.d072ee1e3af9")}</option>
            <option value="CARTAO_CREDITO">${tHtml("interface.message.3a23123ab237")}</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="action-btn btn-gray" onclick="closeManualOrderModal()">${tHtml("interface.message.bb9dbb406dcb")}</button>
          <button type="submit" class="action-btn btn-green">${tHtml("interface.message.47e31eb7b701")}</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: NOVO FUNCIONÁRIO -->
  <div class="modal" id="userModal">
    <div class="modal-card">
      <h3 style="margin-bottom:12px;">${tHtml("interface.message.ad7d8ec3160d")}</h3>
      <form onsubmit="handleUserSubmit(event)">
        <input type="hidden" id="uId" />
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.label.f5350d7d8446")}</label>
          <input type="text" id="uName" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: Maria Atendente" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.df52daac8d59")}</label>
          <input type="email" id="uEmail" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="${tHtml("interface.message.5ddb37787786")}" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.68c788ae147b")}</label>
          <select id="uRole" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">
            <option value="CLIENTE">${tHtml("interface.message.4b8a354eee3f")}</option>
            <option value="CAIXA">${tHtml("interface.message.2c6fc9fd5064")}</option>
            <option value="ADMIN">${tHtml("interface.message.e9820876a0ab")}</option>
          </select>
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:bold;">${tHtml("interface.message.f2db7a952e0d")}</label>
          <input type="text" id="uPin" maxlength="6" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: 1111" />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="action-btn btn-gray" onclick="closeUserModal()">${tHtml("interface.message.bb9dbb406dcb")}</button>
          <button type="submit" class="action-btn btn-green">${tHtml("interface.message.321eb4459815")}</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    // ESTADO GLOBAL
    const DEFAULT_OFFICIAL_CATALOG = [];
    let currentUser = null;
    try {
      const saved = localStorage.getItem('conflora_user') || localStorage.getItem('conflora_op');
      if (saved) {
        currentUser = JSON.parse(saved);
      }
    } catch (_) {}

    let allProducts = DEFAULT_OFFICIAL_CATALOG;
    let allOrders = [];
    let currentSelectedUserIdForLogin = '';

    function applyUserRoleUI() {
      const photo = document.getElementById('loggedUserPhoto');
      photo.hidden = !currentUser?.picture;
      if (currentUser?.picture) photo.src = currentUser.picture;
      else photo.removeAttribute('src');
      if (!currentUser) {
        document.getElementById('loggedUserName').innerText = t("interface.message.4430f025f85f");
        const roleEl = document.getElementById('loggedUserRole');
        roleEl.innerText = 'BLOQUEADO';
        roleEl.className = 'role-badge caixa';

        // Esconde todas as abas até que haja login
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => {
          b.style.display = 'none';
        });

        // Abre o modal de identificação obrigatório
        openLoginModal();
        return;
      }

      document.getElementById('loggedUserName').innerText = currentUser.name || currentUser.email || 'Operador';
      const roleEl = document.getElementById('loggedUserRole');
      roleEl.innerText = currentUser.role || 'OPERADOR';
      roleEl.className = 'role-badge ' + (currentUser.role === 'CAIXA' ? 'caixa' : '');

      const isAdmin = currentUser.role === 'ADMIN';

      // Mostra as abas básicas
      document.getElementById('tabBtn-cashier').style.display = 'block';
      document.getElementById('tabBtn-diff').style.display = 'block';
      document.getElementById('tabBtn-stock').style.display = 'block';
      document.getElementById('tabBtn-price').style.display = 'block';
      document.getElementById('tabBtn-notifs').style.display = 'block';

      // Visibilidade das abas exclusivas de ADMIN
      document.getElementById('tabBtn-analytics').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('tabBtn-orders').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('tabBtn-products').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('tabBtn-team').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('tabBtn-import').style.display = isAdmin ? 'block' : 'none';
      const statusBtn = document.getElementById('tabBtn-status');
      if (statusBtn) statusBtn.style.display = isAdmin ? 'block' : 'none';

      // Se for Caixa e estiver em aba proibida, redireciona para Caixa
      if (!isAdmin) {
        showTab('cashier');
      } else {
        showTab('analytics');
      }
    }

    function showTab(tab) {
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      
      const targetContent = document.getElementById('tab-' + tab);
      const targetBtn = document.getElementById('tabBtn-' + tab);
      if (targetContent) targetContent.classList.add('active');
      if (targetBtn) targetBtn.classList.add('active');

      if (tab === 'analytics') loadAnalyticsData();
      if (tab === 'cashier') loadCashierDaily();
      if (tab === 'diff') loadAlterations();
      if (tab === 'orders') loadAllOrders();
      if (tab === 'stock') loadStockProducts();
      if (tab === 'price') loadPriceProducts();
      if (tab === 'products') loadAdminProducts();
      if (tab === 'team') loadTeam();
      if (tab === 'notifs') loadNotifications();
      if (tab === 'status') loadAdminStatusData();
    }

    // 1. ANALYTICS & MÉTRICAS
    async function loadAnalyticsData() {
      try {
        const res = await fetch('/api/admin/daily-metrics');
        const m = await res.json();
        document.getElementById('analyticsRevenue').innerText = 'R$ ' + Number(m.totalRevenue || 0).toFixed(2).replace('.', ',');
        
        // Split de pagamento
        const pEl = document.getElementById('analyticsPaymentSplit');
        pEl.innerHTML = \`
          <div style="margin-bottom:6px;">• <strong>${tHtml("interface.label.d03d4dc16e93")}</strong> R$ \${Number(m.byPayment?.PIX || 0).toFixed(2)}</div>
          <div style="margin-bottom:6px;">• <strong>${tHtml("interface.message.475a4f48060e")}</strong> R$ \${Number(m.byPayment?.CARTAO || 0).toFixed(2)}</div>
          <div style="margin-bottom:6px;">• <strong>${tHtml("interface.message.5f3593fe766b")}</strong> R$ \${Number(m.byPayment?.DINHEIRO || 0).toFixed(2)}</div>
          <div style="margin-top:10px; font-weight:bold; color:#15803d;">Ticket Médio: R$ \${Number(m.ticketMedio || 0).toFixed(2)}</div>
        \`;

        // Produtos mais buscados
        const topEl = document.getElementById('analyticsTopProducts');
        topEl.innerHTML = \`
          <div style="margin-bottom:6px;">${tHtml("interface.message.cc9b4ed21d6b")}</div>
          <div style="margin-bottom:6px;">${tHtml("interface.message.7a57dd7f9b6e")}</div>
          <div style="margin-bottom:6px;">${tHtml("interface.message.54da7b2637f0")}</div>
          <div style="margin-bottom:6px;">${tHtml("interface.message.640a5056e0b8")}</div>
        \`;
      } catch (err) {
        console.error(t("interface.message.66db3d589491"), err);
      }
    }

    function testGaEvent() {
      if (typeof gtag === 'function') {
        gtag('event', 'admin_analytics_test', { event_category: 'admin', user: currentUser.name });
        alert(t("interface.message.e859402ae20b"));
      } else {
        alert('Google Analytics tag G-TX7SZBP9J8 ativa em background.');
      }
    }

    // 2. CAIXA & VENDAS DO DIA
    async function loadCashierDaily() {
      try {
        const res = await fetch('/api/admin/daily-metrics');
        const m = await res.json();
        document.getElementById('cashierTotalToday').innerText = 'R$ ' + Number(m.totalRevenue || 0).toFixed(2).replace('.', ',');
        document.getElementById('cashierPixToday').innerText = 'R$ ' + Number(m.byPayment?.PIX || 0).toFixed(2).replace('.', ',');
        document.getElementById('cashierCardToday').innerText = 'R$ ' + Number(m.byPayment?.CARTAO || 0).toFixed(2).replace('.', ',');
        document.getElementById('cashierCashToday').innerText = 'R$ ' + Number(m.byPayment?.DINHEIRO || 0).toFixed(2).replace('.', ',');

        const tbody = document.getElementById('todayOrdersBody');
        tbody.innerHTML = '';
        const list = m.todayOrders || [];
        if (list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">${tHtml("interface.message.c0c5d3a99f11")}</td></tr>';
          return;
        }

        list.forEach(o => {
          const tr = document.createElement('tr');
          const itemsTxt = (o.items || []).map(i => i.name + ' (' + (i.quantity || 1) + 'x)').join(', ');
          tr.innerHTML = \`
            <td><strong>#\${(o.id || '').slice(-6)}</strong></td>
            <td>\${o.customerName || t("interface.message.033a7f5bde38")}</td>
            <td>\${itemsTxt}</td>
            <td>\${o.paymentMethod || 'PIX'}</td>
            <td><strong>R$ \${Number(o.total || 0).toFixed(2).replace('.', ',')}</strong></td>
            <td><span class="badge \${o.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-pending'}">\${o.status}</span></td>
            <td>
              <button class="action-btn btn-amber" style="padding:4px 8px;" onclick="openAlterationModal('\${o.id}')" title="${tHtml("interface.message.25a448bb1fd1")}">${tHtml("interface.message.aa7307b3616f")}</button>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (err) {
        console.error(t("interface.message.8c895e794975"), err);
      }
    }

    // 3. CENTRAL DE ALTERAÇÕES - GIT DIFF
    async function loadAlterations() {
      const container = document.getElementById('alterationsListContainer');
      try {
        const res = await fetch('/api/admin/alterations');
        const list = await res.json();
        container.innerHTML = '';
        
        const pendingCount = list.filter(a => a.status === 'PENDING').length;
        const badge = document.getElementById('diffCountBadge');
        if (pendingCount > 0) {
          badge.innerText = pendingCount;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }

        if (list.length === 0) {
          container.innerHTML = '<div style="padding:20px; color:#64748b; text-align:center;">${tHtml("interface.message.32ed50ec392b")}</div>';
          return;
        }

        const isAdmin = currentUser.role === 'ADMIN';

        list.forEach(alt => {
          const card = document.createElement('div');
          card.className = 'diff-card';
          
          let diffLinesHtml = '';
          (alt.diffLines || []).forEach(line => {
            const cls = line.type === 'del' ? 'diff-del' : (line.type === 'add' ? 'diff-add' : 'diff-info');
            diffLinesHtml += \`<div class="diff-line \${cls}">\${line.text}</div>\`;
          });

          card.innerHTML = \`
            <div class="diff-header">
              <div>
                <strong>Pedido #\${(alt.orderId || '').slice(-6)}</strong> ${tHtml("interface.label.b3586ba606a0")} <strong>\${alt.requestedByName || 'Caixa'}</strong> em \${new Date(alt.createdAt).toLocaleTimeString()}
              </div>
              <div>
                <span class="badge \${alt.status === 'APPROVED' ? 'badge-confirmed' : (alt.status === 'REJECTED' ? 'badge-cancelled' : 'badge-pending')}">
                  \${alt.status === 'PENDING' ? 'AGUARDANDO EDMAR' : (alt.status === 'APPROVED' ? 'APROVADO' : 'RECUSADO')}
                </span>
              </div>
            </div>

            <div class="diff-reason-box">
              <strong>${tHtml("interface.label.0d764aeb47c7")}</strong> "\${alt.reason || t("interface.message.0d0beb5744d7")}"
              \${alt.rejectionReason ? \`<div style="margin-top:6px; color:#991b1b;"><strong>${tHtml("interface.label.1574a42eaa1d")}</strong> "\${alt.rejectionReason}"</div>\` : ''}
            </div>

            <div class="diff-body">
              \${diffLinesHtml}
            </div>

            \${isAdmin && alt.status === 'PENDING' ? \`
              <div class="diff-actions">
                <button class="action-btn btn-red" onclick="openRejectModal('\${alt.id}')">${tHtml("interface.message.5f82d9cdc16c")}</button>
                <button class="action-btn btn-green" onclick="approveAlteration('\${alt.id}')">${tHtml("interface.message.45c3722acbb4")}</button>
              </div>
            \` : ''}
          \`;
          container.appendChild(card);
        });
      } catch (err) {
        container.innerHTML = t("interface.text.9ff2788cf5f5") + err.message;
      }
    }

    async function approveAlteration(requestId) {
      if (!confirm(t("interface.message.cfbd40051b1c"))) return;
      const res = await fetch('/api/admin/alterations/' + requestId + '/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVED', reviewedBy: currentUser.name })
      });
      const data = await res.json();
      if (data.success) {
        alert(t("interface.message.2e28a159bc3c"));
        loadAlterations();
        loadCashierDaily();
      }
    }

    function openRejectModal(requestId) {
      document.getElementById('rejectRequestId').value = requestId;
      document.getElementById('rejectionReasonText').value = '';
      document.getElementById('rejectReasonModal').classList.add('open');
    }

    function closeRejectModal() {
      document.getElementById('rejectReasonModal').classList.remove('open');
    }

    async function confirmRejectAlteration() {
      const id = document.getElementById('rejectRequestId').value;
      const reason = document.getElementById('rejectionReasonText').value.trim();
      if (!reason) { alert(t("interface.message.7f1b1be6657d")); return; }

      const res = await fetch('/api/admin/alterations/' + id + '/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECTED', reviewedBy: currentUser.name, rejectionReason: reason })
      });
      const data = await res.json();
      if (data.success) {
        alert(t("interface.message.800d0127ab7e"));
        closeRejectModal();
        loadAlterations();
      }
    }

    // 4. SOLICITAÇÃO DE ALTERAÇÃO PELO CAIXA
    async function openAlterationModal(orderId) {
      const res = await fetch('/api/admin/orders');
      const orders = await res.json();
      const ord = orders.find(o => String(o.id) === String(orderId));
      if (!ord) return;

      document.getElementById('altOrderId').value = ord.id;
      document.getElementById('altCustName').value = ord.customerName || '';
      document.getElementById('altPayMethod').value = ord.paymentMethod || 'DINHEIRO';
      document.getElementById('altTotal').value = Number(ord.total || 0);
      document.getElementById('altReason').value = '';
      document.getElementById('alterationRequestModal').classList.add('open');
    }

    function closeAlterationModal() {
      document.getElementById('alterationRequestModal').classList.remove('open');
    }

    async function submitAlterationRequest() {
      const orderId = document.getElementById('altOrderId').value;
      const res = await fetch('/api/admin/orders');
      const orders = await res.json();
      const orig = orders.find(o => String(o.id) === String(orderId));

      const newCust = document.getElementById('altCustName').value;
      const newPay = document.getElementById('altPayMethod').value;
      const newTot = parseFloat(document.getElementById('altTotal').value);
      const reason = document.getElementById('altReason').value.trim();

      if (!reason) { alert(t("interface.message.9487e40f9d06")); return; }

      const proposed = { ...orig, customerName: newCust, paymentMethod: newPay, total: newTot };

      await fetch('/api/admin/alterations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          originalOrder: orig,
          proposedOrder: proposed,
          requestedBy: currentUser.id,
          requestedByName: currentUser.name,
          reason,
        })
      });

      alert(t("interface.message.4f7c3264132c"));
      closeAlterationModal();
      loadAlterations();
    }

    // 5. NOTIFICAÇÕES PARA ATENDENTE / ADMIN
    async function loadNotifications() {
      const container = document.getElementById('notificationsContainer');
      try {
        const res = await fetch('/api/admin/notifications?userId=' + currentUser.id);
        const list = await res.json();
        container.innerHTML = '';
        
        const unreadCount = list.filter(n => !n.read).length;
        document.getElementById('notifBadge').innerText = unreadCount;

        if (list.length === 0) {
          container.innerHTML = '<div style="color:#64748b; padding:20px;">${tHtml("interface.message.7fbc608298aa")}</div>';
          return;
        }

        list.forEach(n => {
          const div = document.createElement('div');
          div.className = 'notif-card ' + (n.type === 'REJECTED' ? 'rejected' : (n.type === 'APPROVED' ? 'approved' : ''));
          div.innerHTML = \`
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong>\${n.title || t("interface.message.2cae02ad356c")}</strong>
              <span style="font-size:11px; color:#64748b;">\${new Date(n.createdAt).toLocaleTimeString()}</span>
            </div>
            <div style="margin-top:6px;">\${n.message}</div>
            \${n.reason ? \`<div style="margin-top:6px; font-weight:bold; color:#991b1b;">Motivo do Cancelamento: "\${n.reason}"</div>\` : ''}
          \`;
          container.appendChild(div);
        });
      } catch (err) {
        container.innerHTML = t("interface.text.91a981ac2323") + err.message;
      }
    }

    function safeExtractProductsAdmin(data) {
      if (!data) return DEFAULT_OFFICIAL_CATALOG;
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object') {
        if (Array.isArray(data.products)) return data.products;
        if (data.products && typeof data.products === 'object') return Object.values(data.products);
      }
      return DEFAULT_OFFICIAL_CATALOG;
    }

    // 6. CONSULTA RÁPIDA DE PREÇO
    async function loadPriceProducts() {
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
          const data = await res.json();
          const list = safeExtractProductsAdmin(data);
          allProducts = (Array.isArray(list) && list.length > 0) ? list : DEFAULT_OFFICIAL_CATALOG;
        } else {
          allProducts = DEFAULT_OFFICIAL_CATALOG;
        }
      } catch (e) {
        console.warn(t("interface.message.2425d7dc4ef8"), e);
        allProducts = DEFAULT_OFFICIAL_CATALOG;
      }
      if (!Array.isArray(allProducts)) allProducts = DEFAULT_OFFICIAL_CATALOG;
      filterPriceTable();
    }

    function filterPriceTable() {
      if (!Array.isArray(allProducts)) allProducts = DEFAULT_OFFICIAL_CATALOG;
      const q = document.getElementById('priceSearchInput').value.toLowerCase();
      const tbody = document.getElementById('priceTableBody');
      tbody.innerHTML = '';

      allProducts.filter(p => !q || (p.name || p.descricao || '').toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q)).forEach(p => {
        const tr = document.createElement('tr');
        const img = (p.images && p.images[0]) || p.imageUrl || p.imageurl || t("interface.text.671028bdaaed");
        tr.innerHTML = \`
          <td><img src="\${img}" class="prod-thumb" /></td>
          <td><strong>\${p.descricao || p.name}</strong></td>
          <td>\${p.categoria || p.category || ''} • \${p.subcategoria || ''}</td>
          <td><strong style="color:#15803d; font-size:15px;">R$ \${Number(p.valor_num || p.price || 0).toFixed(2).replace('.', ',')}</strong></td>
          <td><span style="font-weight:bold;">\${p.stockQuantity ?? p.estoque ?? 0}</span> ${tHtml("interface.message.31939750f55e")}</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    // 7. EQUIPE & PERMISSÕES
    async function loadTeam() {
      const res = await fetch('/api/admin/auth/users');
      const users = await res.json();
      const tbody = document.getElementById('teamTableBody');
      tbody.innerHTML = '';

      users.forEach(u => {
        const tr = document.createElement('tr');
        const role = u.role || 'CLIENTE';
        tr.innerHTML = \`
          <td><strong>\${u.name || 'Sem nome'}</strong></td>
          <td>\${u.email}</td>
          <td>
            <select onchange="changeUserRole('\${u.id}', this.value)" style="padding:4px 8px; border-radius:6px; font-weight:700; font-size:12px; border:1px solid #cbd5e1; background:\${role === 'ADMIN' ? '#dcfce7' : (role === 'CAIXA' ? '#e0f2fe' : '#f8fafc')}; color:\${role === 'ADMIN' ? '#166534' : (role === 'CAIXA' ? '#0369a1' : '#475569')}; cursor:pointer;" \${u.id === 'usr-edmar' ? 'disabled' : ''}>
              <option value="CLIENTE" \${role === 'CLIENTE' ? 'selected' : ''}>${tHtml("interface.message.8b4140d0ce15")}</option>
              <option value="CAIXA" \${role === 'CAIXA' ? 'selected' : ''}>${tHtml("interface.message.4cbb417d7b39")}</option>
              <option value="ADMIN" \${role === 'ADMIN' ? 'selected' : ''}>${tHtml("interface.label.f9a6e8d91e0b")}</option>
            </select>
          </td>
          <td>\${u.pin ? '••••' : (u.password ? t("interface.message.35f27f1d1a9e") : '🌐 Google')}</td>
          <td>\${u.active !== false ? '🟢 Ativo' : '🔴 Inativo'}</td>
          <td>
            \${u.id !== 'usr-edmar' ? \`<button class="action-btn btn-red" style="padding:4px 8px;" onclick="deleteUser('\${u.id}')">${tHtml("interface.label.8b19518ff49b")}</button>\` : '<em>${tHtml("interface.label.7964bc5d411b")}</em>'}
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    async function changeUserRole(userId, newRole) {
      try {
        const res = await fetch('/api/admin/users/' + encodeURIComponent(userId) + '/role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        });
        const data = await res.json();
        if (data.success) {
          alert(t("interface.text.16f0f4d2f7c1") + newRole + t("interface.text.e1cb17404b4c"));
          loadTeam();
        } else {
          alert(t("interface.text.0a2492fb394d") + (data.error || t("interface.message.b02b6687f852")));
          loadTeam();
        }
      } catch (err) {
        alert(t("interface.text.b458aa19769d") + err.message);
        loadTeam();
      }
    }

    function openNewUserModal() {
      document.getElementById('uId').value = '';
      document.getElementById('uName').value = '';
      document.getElementById('uEmail').value = '';
      document.getElementById('uRole').value = 'CAIXA';
      document.getElementById('uPin').value = '';
      document.getElementById('userModal').classList.add('open');
    }

    function closeUserModal() {
      document.getElementById('userModal').classList.remove('open');
    }

    async function handleUserSubmit(e) {
      e.preventDefault();
      const id = document.getElementById('uId').value || ('usr-' + Date.now());
      const name = document.getElementById('uName').value;
      const email = document.getElementById('uEmail').value;
      const role = document.getElementById('uRole').value;
      const pin = document.getElementById('uPin').value;

      await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, email, role, pin, active: true })
      });

      alert(t("interface.message.d42c3d346141"));
      closeUserModal();
      loadTeam();
    }

    async function deleteUser(id) {
      if (!confirm(t("interface.message.c28dc732a62e"))) return;
      await fetch('/api/admin/users/' + id, { method: 'DELETE' });
      loadTeam();
    }

    // 8. LOGIN / TROCA DE OPERADOR
    async function openLoginModal() {
      const res = await fetch('/api/admin/auth/users');
      const users = await res.json();
      const listEl = document.getElementById('userSelectList');
      listEl.innerHTML = '';
      
      users.forEach(u => {
        const btn = document.createElement('div');
        btn.style.cssText = 'padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;';
        btn.innerHTML = \`
          <div>
            <strong>\${u.name}</strong><br>
            <span style="font-size:11px; color:#64748b;">\${u.role}</span>
          </div>
          <span style="font-size:12px; color:#15803d; font-weight:bold;">${tHtml("interface.label.41d4b4ecb2db")}</span>
        \`;
        btn.onclick = () => {
          document.querySelectorAll('#userSelectList div').forEach(d => d.style.borderColor = '#cbd5e1');
          btn.style.borderColor = '#15803d';
          btn.style.background = '#f0fdf4';
          currentSelectedUserIdForLogin = u.id;
        };
        listEl.appendChild(btn);
      });

      // Seleciona o primeiro por padrão
      if (users.length > 0) {
        currentSelectedUserIdForLogin = users[0].id;
        listEl.children[0].style.borderColor = '#15803d';
        listEl.children[0].style.background = '#f0fdf4';
      }

      document.getElementById('loginModal').classList.add('open');
    }

    function closeLoginModal() {
      document.getElementById('loginModal').classList.remove('open');
    }

    async function performLogin() {
      const pin = document.getElementById('loginPinInput').value;
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentSelectedUserIdForLogin, pin })
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        localStorage.setItem('conflora_user', JSON.stringify(currentUser));
        localStorage.setItem('conflora_op', JSON.stringify(currentUser));
        closeLoginModal();
        applyUserRoleUI();
        alert(t("interface.text.b6db26817503") + currentUser.name + ' (' + currentUser.role + ')!');
      } else {
        alert(t("interface.text.7d357221362c") + (data.error || 'PIN incorreto.'));
      }
    }

    async function submitAdminGoogleLogin() {
      const button = document.getElementById('adminGoogleLoginButton');
      if (button.disabled) return;
      button.disabled = true;
      try {
        const data = await window.authenticateGoogle();
        if (data.success && data.user) {
          currentUser = data.user;
          localStorage.setItem('conflora_user', JSON.stringify(currentUser));
          localStorage.setItem('conflora_op', JSON.stringify(currentUser));
          closeLoginModal();
          applyUserRoleUI();
          if (currentUser.role === 'ADMIN') {
            alert(t("interface.message.bd1078b717bb"));
          } else {
            alert(t("interface.text.e998d780aab5") + currentUser.name + '! Perfil identificado: ' + currentUser.role);
          }
        } else {
          alert(t("interface.text.da3d1857fa76") + (data.error || t("interface.text.b33f0647fdda")));
        }
      } catch (err) {
        alert(err.code === 'auth/popup-closed-by-user' ? 'Login cancelado.' : err.code === 'auth/popup-blocked' ? t("interface.message.89c6789636b3") : t("interface.text.7d357221362c") + err.message);
      } finally {
        button.disabled = false;
      }
    }

    async function logoutAdmin() {
      if (confirm(t("interface.message.88902a3b8e82"))) {
        if (window.signOutGoogle) {
          try { await window.signOutGoogle(); } catch (error) { alert(t("interface.text.346a2f78875a") + error.message); return; }
        }
        currentUser = null;
        localStorage.removeItem('conflora_user');
        localStorage.removeItem('conflora_op');
        applyUserRoleUI();
      }
    }

    // 11. DIAGNÓSTICO & STATUS DAS CONEXÕES (SHEETS, WHATSAPP, FIRESTORE)
    async function loadAdminStatusData() {
      const container = document.getElementById('adminStatusDashboardContainer');
      if (!container) return;
      container.innerHTML = '<div style="padding:30px; text-align:center; color:#64748b;">${tHtml("interface.message.067510ce6ef3")}</div>';

      try {
        const res = await fetch('/api/admin/system-status');
        const data = await res.json();
        const sheets = data.googleSheets || {};
        const wa = data.whatsapp || {};
        const fs = data.firestore || {};
        const cat = data.defaultCatalog || {};

        container.innerHTML = \`
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
            <!-- GOOGLE SHEETS API STATUS -->
            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="font-size:15px; display:flex; align-items:center; gap:6px;">${tHtml("interface.label.9b68943ea1bd")}</h3>
                <span style="background:\${sheets.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:10px;">
                  \${sheets.badge || sheets.status || 'ONLINE'}
                </span>
              </div>
              <div style="font-size:13px; color:#475569; line-height:1.7;">
                <div><strong>${tHtml("interface.label.3b82787eed4b")}</strong> <code>\${sheets.spreadsheetId || t("interface.message.89bc07b2aad9")}</code></div>
                <div><strong>${tHtml("interface.label.a41f24a4a854")}</strong> <strong>\${sheets.sheetName || 'PRODUTOS'}</strong></div>
                <div><strong>${tHtml("interface.message.6dc56ee6d1b8")}</strong> <span style="font-weight:800; color:#15803d;">\${sheets.itemsActive || 111} itens</span></div>
                <div><strong>${tHtml("interface.message.fc47b3208438")}</strong> \${sheets.latencyMs ?? 0} ms</div>
                <div><strong>${tHtml("interface.message.a40441802c9d")}</strong> \${sheets.source || 'Planilha'}</div>
                <div style="margin-top:8px; font-size:12px; color:#64748b; background:#f1f5f9; padding:8px 10px; border-radius:6px;">
                  ℹ️ \${sheets.message || t("interface.message.de7672e3c15b")}
                </div>
              </div>
              <div style="margin-top:14px;">
                <button class="action-btn btn-green" onclick="testSheetsFromAdmin()" style="width:100%; justify-content:center; padding:8px;">
                  ${tHtml("interface.label.f5d777de4812")}
                </button>
              </div>
            </div>

            <!-- WHATSAPP WEBHOOK STATUS -->
            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="font-size:15px; display:flex; align-items:center; gap:6px;">${tHtml("interface.label.facfdad38948")}</h3>
                <span style="background:\${wa.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:10px;">
                  \${wa.badge || wa.status || 'ONLINE'}
                </span>
              </div>
              <div style="font-size:13px; color:#475569; line-height:1.7;">
                <div><strong>${tHtml("interface.label.11c78449294d")}</strong> <code>${tHtml("interface.label.3bed6d2e3c21")}</code> ${tHtml("interface.message.95613fda7f98")}</div>
                <div><strong>${tHtml("interface.message.4f27bba1ed5f")}</strong> \${wa.phoneNumberId || 'Emulador Local'}</div>
                <div><strong>${tHtml("interface.label.bc9189b80d43")}</strong> \${wa.hasVerifyToken ? '✅ Configurado' : t("interface.message.4dd3cead6337")}</div>
                <div><strong>${tHtml("interface.label.3bb6fab4a20c")}</strong> \${wa.hasAccessToken ? '✅ Ativo' : '⚠️ Emulador'}</div>
                <div><strong>${tHtml("interface.label.a93978289509")}</strong> \${wa.totalReceivedCount || 0}</div>
                <div><strong>${tHtml("interface.message.a179de2498c6")}</strong> \${wa.lastReceivedAt || t("interface.message.9a3ea94f5e20")}</div>
                <div style="margin-top:8px; font-size:12px; color:#64748b; background:#f1f5f9; padding:8px 10px; border-radius:6px;">
                  ℹ️ \${wa.message || 'Webhook operacional.'}
                </div>
              </div>
              <div style="margin-top:14px;">
                <button class="action-btn btn-blue" onclick="testWebhookFromAdmin()" style="width:100%; justify-content:center; padding:8px;">
                  ${tHtml("interface.label.672e4b802949")}
                </button>
              </div>
            </div>

            <!-- CLOUD FIRESTORE -->
            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="font-size:15px; display:flex; align-items:center; gap:6px;">${tHtml("interface.label.72c4a129e835")}</h3>
                <span style="background:\${fs.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:10px;">
                  \${fs.badge || fs.status || 'ONLINE'}
                </span>
              </div>
              <div style="font-size:13px; color:#475569; line-height:1.7;">
                <div><strong>${tHtml("interface.label.26a405183ca4")}</strong> <code>\${fs.projectId || 'confloraai'}</code></div>
                <div><strong>${tHtml("interface.message.b26880294f1e")}</strong> \${fs.latencyMs ?? 0} ms</div>
                <div><strong>${tHtml("interface.message.7ed57c6c529c")}</strong> \${fs.message || 'Conectado ao Firestore.'}</div>
                <div><strong>${tHtml("interface.message.32ffee6e236d")}</strong> ${tHtml("interface.label.99bfd55d7f18")}</div>
              </div>
            </div>

            <!-- PLANILHA OFICIAL DE CONTINGÊNCIA -->
            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="font-size:15px; display:flex; align-items:center; gap:6px;">${tHtml("interface.label.98b400e7d5c9")}</h3>
                <span style="background:\${cat.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:10px;">
                  \${cat.badge || 'Carregada'}
                </span>
              </div>
              <div style="font-size:13px; color:#475569; line-height:1.7;">
                <div><strong>${tHtml("interface.label.fcd863bc4c50")}</strong> <strong style="color:#15803d;">\${cat.totalItems || 111} itens</strong></div>
                <div><strong>${tHtml("interface.label.36b4da28022f")}</strong> \${cat.categoriesCount || 6}</div>
                <div><strong>${tHtml("interface.label.731c04537d84")}</strong> \${cat.autoFallback || '100% garantida'}</div>
              </div>
            </div>
          </div>

          <div id="adminTestResultBox" style="display:none; margin-top:16px; padding:12px; border-radius:8px; font-size:13px;"></div>
        \`;
      } catch (err) {
        container.innerHTML = '<div style="color:#ef4444; padding:20px; text-align:center;">${tHtml("interface.message.56b568b3f90e")}</div>';
      }
    }

    async function testSheetsFromAdmin() {
      const box = document.getElementById('adminTestResultBox');
      if (box) {
        box.style.display = 'block';
        box.style.background = '#f1f5f9';
        box.style.color = '#334155';
        box.innerHTML = t("interface.message.febcd03e2f76");
      }
      try {
        const res = await fetch('/api/admin/test-sheets', { method: 'POST' });
        const d = await res.json();
        if (box) {
          box.style.background = '#dcfce7';
          box.style.color = '#166534';
          box.innerHTML = '✅ <strong>${tHtml("interface.message.3bc505040360")}</strong> ' + (d.message || t("interface.message.21c8799a6ca7")) + t("interface.text.81356a98d71b") + (d.latencyMs || 0) + 'ms)';
        }
      } catch (err) {
        if (box) {
          box.style.background = '#fee2e2';
          box.style.color = '#991b1b';
          box.innerHTML = '❌ <strong>${tHtml("interface.message.bd534082af8f")}</strong> ' + err.message;
        }
      }
    }

    async function testWebhookFromAdmin() {
      const box = document.getElementById('adminTestResultBox');
      if (box) {
        box.style.display = 'block';
        box.style.background = '#f1f5f9';
        box.style.color = '#334155';
        box.innerHTML = t("interface.message.2c10e389bf9d");
      }
      try {
        const res = await fetch('/api/admin/test-webhook', { method: 'POST' });
        const d = await res.json();
        if (box) {
          box.style.background = '#dcfce7';
          box.style.color = '#166534';
          box.innerHTML = '✅ <strong>${tHtml("interface.label.02c64587d8f8")}</strong> ${tHtml("interface.label.7c81b807e573")} <code>${tHtml("interface.label.3bed6d2e3c21")}</code> respondeu com sucesso em ' + (d.pingLatencyMs || 0) + 'ms. ' + (d.message || '');
        }
      } catch (err) {
        if (box) {
          box.style.background = '#fee2e2';
          box.style.color = '#991b1b';
          box.innerHTML = '❌ <strong>${tHtml("interface.message.45538e9b167b")}</strong> ' + err.message;
        }
      }
    }

    // 9. ESTOQUE ÁGIL (+1, +5, +10)
    async function loadStockProducts() {
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
          const data = await res.json();
          const list = safeExtractProductsAdmin(data);
          allProducts = (Array.isArray(list) && list.length > 0) ? list : DEFAULT_OFFICIAL_CATALOG;
        } else {
          allProducts = DEFAULT_OFFICIAL_CATALOG;
        }
      } catch (e) {
        console.warn(t("interface.message.ff02748902da"), e);
        allProducts = DEFAULT_OFFICIAL_CATALOG;
      }
      if (!Array.isArray(allProducts)) allProducts = DEFAULT_OFFICIAL_CATALOG;
      filterStockCards();
    }

    function filterStockCards() {
      if (!Array.isArray(allProducts)) allProducts = DEFAULT_OFFICIAL_CATALOG;
      const q = document.getElementById('stockSearchInput').value.toLowerCase();
      const grid = document.getElementById('stockCardsGrid');
      grid.innerHTML = '';

      allProducts.filter(p => !q || (p.name || p.descricao || '').toLowerCase().includes(q)).forEach(p => {
        const div = document.createElement('div');
        div.className = 'stock-card';
        const img = (p.images && p.images[0]) || p.imageUrl || p.imageurl || '';
        div.innerHTML = \`
          <div style="display:flex; gap:10px; align-items:center;">
            \${img ? \`<img src="\${img}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;" />\` : ''}
            <div>
              <div style="font-weight:bold; font-size:13px;">\${p.descricao || p.name}</div>
              <div style="font-size:11px; color:#64748b;">\${p.subcategoria || p.categoria || ''}</div>
            </div>
          </div>
          <div style="font-size:12px; color:#64748b;">${tHtml("interface.message.0c741a470cee")} <strong id="stk-\${p.id}" style="color:#15803d; font-size:16px;">\${p.stockQuantity ?? p.estoque ?? 0}</strong> ${tHtml("interface.label.68bca10eea2b")}</div>
          <div class="stock-btns-row">
            <button class="plus-btn" onclick="addStock('\${p.id}', 1)">+1</button>
            <button class="plus-btn" onclick="addStock('\${p.id}', 5)">+5</button>
            <button class="plus-btn" onclick="addStock('\${p.id}', 10)">+10</button>
            <button class="plus-btn" onclick="addStock('\${p.id}', 50)">+50</button>
          </div>
        \`;
        grid.appendChild(div);
      });
    }

    async function addStock(prodId, qty) {
      window.location.href = '/lancamentos'; return;
      const res = await fetch('/api/admin/stock/quick-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: prodId, quantityAdded: qty })
      });
      const data = await res.json();
      if (data.success) {
        const el = document.getElementById('stk-' + prodId);
        if (el) el.innerText = data.newStock;
      }
    }

    // 10. CADASTRO DE PRODUTOS
    async function loadAdminProducts() {
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
          const data = await res.json();
          const list = safeExtractProductsAdmin(data);
          allProducts = (Array.isArray(list) && list.length > 0) ? list : DEFAULT_OFFICIAL_CATALOG;
        } else {
          allProducts = DEFAULT_OFFICIAL_CATALOG;
        }
      } catch (e) {
        console.warn(t("interface.message.d1a99e76d06b"), e);
        allProducts = DEFAULT_OFFICIAL_CATALOG;
      }
      if (!Array.isArray(allProducts)) allProducts = DEFAULT_OFFICIAL_CATALOG;
      const tbody = document.getElementById('adminProductsTableBody');
      tbody.innerHTML = '';

      allProducts.forEach(p => {
        const tr = document.createElement('tr');
        const img = (p.images && p.images[0]) || p.imageUrl || p.imageurl || t("interface.text.671028bdaaed");
        tr.innerHTML = \`
          <td><img src="\${img}" class="prod-thumb" /></td>
          <td><strong>\${p.descricao || p.name}</strong></td>
          <td>\${p.categoria || p.category || ''}</td>
          <td>R$ \${Number(p.valor_num || p.price || 0).toFixed(2).replace('.', ',')}</td>
          <td><strong style="color:#15803d;">\${p.stockQuantity ?? p.estoque ?? 0}</strong> ${tHtml("interface.label.68bca10eea2b")}</td>
          <td>
            <button class="action-btn btn-blue" style="padding:4px 8px;" onclick="editProduct('\${p.id}')">${tHtml("interface.label.e3bd2ee1d054")}</button>
            <button class="action-btn btn-red" style="padding:4px 8px;" onclick="deleteProduct('\${p.id}')">${tHtml("interface.label.5c8f0523b199")}</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function editProduct(id) {
      const p = allProducts.find(x => String(x.id) === String(id));
      if (!p) return;
      document.getElementById('formProdId').value = p.id;
      document.getElementById('formProdName').value = p.descricao || p.name;
      document.getElementById('formProdCat').value = p.categoria || p.category;
      document.getElementById('formProdSubcat').value = p.subcategoria || p.subcategory || '';
      document.getElementById('formProdPrice').value = Number(p.valor_num || p.price || 0);
      document.getElementById('formProdStock').value = p.stockQuantity ?? p.estoque ?? 0;
      document.getElementById('formProdImages').value = (p.images || [p.imageUrl || p.imageurl]).filter(Boolean).join(', ');
      document.getElementById('formProdDesc').value = p.descriptionAi || p.descricao_ia || '';
      document.getElementById('productFormTitle').textContent = t("interface.text.6c8ac6fb440e") + p.id;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetProdForm() {
      document.getElementById('prodForm').reset();
      document.getElementById('formProdId').value = '';
      document.getElementById('productFormTitle').textContent = t("interface.message.707f57de93b4");
    }

    async function deleteProduct(id) {
      if (!confirm(t("interface.message.8777a09a3727"))) return;
      await fetch('/api/admin/products/' + id, { method: 'DELETE' });
      loadAdminProducts();
    }

    async function handleProductSubmit(e) {
      e.preventDefault();
      const id = document.getElementById('formProdId').value || ('prod-' + Date.now());
      const name = document.getElementById('formProdName').value;
      const cat = document.getElementById('formProdCat').value;
      const sub = document.getElementById('formProdSubcat').value;
      const price = parseFloat(document.getElementById('formProdPrice').value);
      const stock = parseInt(document.getElementById('formProdStock').value, 10);
      const imgs = document.getElementById('formProdImages').value.split(',').map(s => s.trim()).filter(Boolean);
      const desc = document.getElementById('formProdDesc').value;

      await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name,
          category: cat,
          subcategory: sub,
          unit: document.getElementById('formProdUnit') ? document.getElementById('formProdUnit').value : 'UN',
          price,
          stockQuantity: stock,
          images: imgs,
          imageUrl: imgs[0] || '',
          descriptionAi: desc,
        })
      });

      alert(t("interface.message.e9fb202b58ab"));
      resetProdForm();
      loadAdminProducts();
    }

    // 11. HISTÓRICO GERAL DE PEDIDOS
    async function loadAllOrders() {
      const container = document.getElementById('allOrdersListContainer');
      try {
        const res = await fetch('/api/admin/orders');
        const orders = await res.json();
        container.innerHTML = '';
        if (orders.length === 0) {
          container.innerHTML = '<div style="color:#64748b; padding:20px;">${tHtml("interface.message.2b184dcafc6b")}</div>';
          return;
        }

        orders.forEach(o => {
          const div = document.createElement('div');
          div.style.cssText = 'border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;';
          const itemsTxt = (o.items || []).map(i => i.name + ' (' + (i.quantity || 1) + 'x)').join(', ');
          div.innerHTML = \`
            <div>
              <strong>#\${(o.id || '').slice(-6)} — \${o.customerName || t("interface.message.f851d9a83ab0")}</strong> (\${o.customerPhone || 'Presencial'})<br>
              <span style="font-size:12px; color:#64748b;">Itens: \${itemsTxt}</span><br>
              <span style="font-size:12px; color:#64748b;">\${o.deliveryAddress || t("interface.message.ff09483495a3")} • \${o.paymentMethod || 'PIX'} • \${new Date(o.createdAt).toLocaleString()}</span>
            </div>
            <div style="text-align:right;">
              <span class="badge \${o.status === 'CONFIRMED' ? 'badge-confirmed' : (o.status === 'DELIVERED' ? 'badge-delivered' : 'badge-pending')}">\${o.status}</span>
              <div style="font-weight:bold; color:#15803d; font-size:15px; margin-top:4px;">R$ \${Number(o.total || 0).toFixed(2).replace('.', ',')}</div>
            </div>
          \`;
          container.appendChild(div);
        });
      } catch (err) {
        container.innerHTML = t("interface.text.ba05b383ac82") + err.message;
      }
    }

    // 12. VENDA MANUAL NO BALCÃO
    function openManualOrderModal() {
      window.location.href = '/lancamentos'; return;
      const select = document.getElementById('mProdSelect');
      select.innerHTML = '';
      allProducts.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = (p.descricao || p.name) + ' — R$ ' + Number(p.valor_num || p.price || 0).toFixed(2);
        select.appendChild(opt);
      });
      document.getElementById('manualOrderModal').classList.add('open');
    }

    function closeManualOrderModal() {
      document.getElementById('manualOrderModal').classList.remove('open');
    }

    async function submitManualOrder(e) {
      e.preventDefault(); window.location.href='/lancamentos'; return;
      e.preventDefault();
      const name = document.getElementById('mCustName').value;
      const phone = document.getElementById('mCustPhone').value;
      const prodId = document.getElementById('mProdSelect').value;
      const qty = parseInt(document.getElementById('mQty').value, 10);
      const pay = document.getElementById('mPayMethod').value;

      const p = allProducts.find(x => String(x.id) === String(prodId));
      if (!p) return;

      const items = [{ productId: p.id, name: p.descricao || p.name, price: Number(p.valor_num || p.price || 0), quantity: qty }];

      await fetch('/api/admin/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name, customerPhone: phone, items, paymentMethod: pay })
      });

      alert(t("interface.message.6f6c4b4e0048"));
      closeManualOrderModal();
      loadCashierDaily();
    }

    // 13. PLANILHA MODELO E IMPORTADOR COM AUDITORIA LINHA A LINHA
    function downloadCsvTemplate() {
      const csvContent = 'id,name,category,subcategory,unit,price,stockQuantity,images,descriptionAi,tagsAi\\n' +
        t("interface.text.2205963ea24d") +
        t("interface.text.68b31696aff7") +
        t("interface.text.d614d0d5e5cc");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'planilha_modelo_conflora.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    let auditedRecords = [];

    function parseCsvOrJson(val) {
      val = val.trim();
      if (!val) return [];
      if (val.startsWith('[')) {
        return JSON.parse(val);
      }
      const lines = val.split('\\n').map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) throw new Error(t("interface.message.ae1c62640cf4"));
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const records = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        const row = { _line: i + 1 };
        headers.forEach((h, colIdx) => {
          row[h] = parts[colIdx] || '';
        });
        records.push(row);
      }
      return records;
    }

    function validateImportPayload() {
      const val = document.getElementById('importRawTextarea').value.trim();
      const fb = document.getElementById('importFeedback');
      const submitBtn = document.getElementById('btnSubmitImport');
      auditedRecords = [];

      try {
        const list = parseCsvOrJson(val);
        if (!Array.isArray(list) || list.length === 0) {
          throw new Error(t("interface.message.49d96baea99f"));
        }

        const errors = [];
        const warnings = [];

        list.forEach((item, idx) => {
          const lineNum = item._line || (idx + 1);
          const name = item.name || item.descricao || '';
          const cat = item.category || item.categoria || '';
          const price = parseFloat(item.price || item.valor_num || item.valor || 0);

          if (!name) {
            errors.push('Linha ' + lineNum + t("interface.text.55cd93a9b899"));
          }
          if (!cat) {
            errors.push('Linha ' + lineNum + t("interface.text.95b1310e27b8"));
          }
          if (isNaN(price) || price <= 0) {
            errors.push('Linha ' + lineNum + t("interface.text.95b40cfb55a8"));
          }
          const hasImg = item.images || item.imageUrl || item.imageurl;
          if (!hasImg) {
            warnings.push('Linha ' + lineNum + ' (' + (name || t("interface.message.a25a5e3451d3")) + t("interface.text.71cc66bb4263"));
          }
        });

        if (errors.length > 0) {
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            submitBtn.style.cursor = 'not-allowed';
            submitBtn.innerText = t("interface.text.5625bd729947") + errors.length + t("interface.text.1ff002753705");
          }
          fb.innerHTML = \`
            <div style="background:#fee2e2; border:1px solid #ef4444; color:#991b1b; padding:12px; border-radius:8px;">
              <strong>⚠️ Encontradas \${errors.length} inconsistências que impedem a importação:</strong>
              <ul style="margin:8px 0 0 20px; font-size:12px;">
                \${errors.slice(0, 15).map(e => '<li>${tHtml("interface.label.8fbaa8bdafea")}</li>').join('')}
                \${errors.length > 15 ? '<li>${tHtml("interface.message.b365a9e3d443")}</li>' : ''}
              </ul>
              <div style="margin-top:8px; font-size:11px;">${tHtml("interface.message.9e162fcbde4a")}</div>
            </div>
          \`;
        } else {
          auditedRecords = list;
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            submitBtn.style.cursor = 'pointer';
            submitBtn.innerText = '🚀 Gravar ' + list.length + ' Produtos Validados no Firestore';
          }
          fb.innerHTML = \`
            <div style="background:#dcfce7; border:1px solid #86efac; color:#166534; padding:12px; border-radius:8px;">
              <strong>✅ Planilha 100% Válida! (\${list.length} produtos auditados com sucesso)</strong>
              <div style="font-size:12px; margin-top:4px;">${tHtml("interface.message.3985bf10592b")}</div>
              \${warnings.length > 0 ? \`<div style="margin-top:6px; font-size:11px; color:#15803d;">ℹ️ Aviso: \${warnings.length} produto(s) usarão foto botânica real em alta definição de contingência.</div>\` : ''}
            </div>
          \`;
        }
      } catch (err) {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.5';
          submitBtn.style.cursor = 'not-allowed';
        }
        fb.innerHTML = \`<div style="color:#991b1b; background:#fee2e2; padding:10px; border-radius:6px; border:1px solid #fca5a5;">❌ Erro de Formatação: \${err.message}</div>\`;
      }
    }

    async function submitImportPayload() {
      if (!auditedRecords || auditedRecords.length === 0) {
        alert('Por favor, clique primeiro em "1. Analisar & Auditar Linhas da Planilha".');
        return;
      }
      const type = document.getElementById('importTypeSelect').value;
      try {
        const res = await fetch('/api/admin/import-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, records: auditedRecords })
        });
        const d = await res.json();
        if (d.success) {
          alert('🎉 ' + d.count + t("interface.text.0d57ccf4adc1"));
          document.getElementById('importRawTextarea').value = '';
          document.getElementById('importFeedback').innerHTML = '';
          loadAdminProducts();
        } else {
          alert(t("interface.text.679a4702fd70") + (d.message || t("interface.message.a09a707694c1")));
        }
      } catch (err) {
        alert(t("interface.text.679a4702fd70") + err.message);
      }
    }

    // 14. CONTROLE / MODO CONTAGEM DE ESTOQUE
    function setStockControlMode(active) {
      localStorage.setItem('conflora_stock_control_active', active ? 'true' : 'false');
      updateStockControlBadge(active);
      if (active) {
        alert(t("interface.message.d327b00faf43"));
      } else {
        alert(t("interface.message.be901534b135"));
      }
    }

    function updateStockControlBadge(active) {
      const label = document.getElementById('stockModeLabel');
      if (!label) return;
      if (active) {
        label.textContent = t("interface.message.f39e9a3bfa1e");
        label.style.background = '#dcfce7';
        label.style.color = '#15803d';
      } else {
        label.textContent = t("interface.message.f3ef0834aafa");
        label.style.background = '#fef3c7';
        label.style.color = '#92400e';
      }
    }

    async function seedDefaultConflora() {
      if (!confirm(t("interface.message.8b0b0868daf0"))) return;
      const res = await fetch('/api/admin/seed-catalog', { method: 'POST' });
      const d = await res.json();
      if (d.success) {
        alert(t("interface.message.3431746c6683"));
        loadAdminProducts();
        loadCashierDaily();
      }
    }

    // INICIALIZAÇÃO
    applyUserRoleUI();
    loadNotifications();
    loadPriceProducts();
    const isStockActive = localStorage.getItem('conflora_stock_control_active') !== 'false';
    updateStockControlBadge(isStockActive);
  </script>
${renderFirebaseAuthScript()}
</body>
</html>`;
}

module.exports = {
  renderAdminHtml,
};
