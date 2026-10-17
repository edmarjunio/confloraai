const { renderFirebaseAuthScript } = require('./firebase-client');
const { GOOGLE_ANALYTICS_TAG } = require('./analytics');

const FETCH_SHIM_SCRIPT = `<script>
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
</script>`;

function renderAdminHtml(storeConfig) {
  const escape = value => String(value || '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
  const name = escape(storeConfig?.identity.name || 'Administração');
  const logo = escape(storeConfig?.branding.logoUrl || '/store-assets/placeholder.svg');
  const colors = storeConfig?.branding.colors || {};
  const color = (key, fallback) => /^#[0-9a-f]{6}$/i.test(colors[key]) ? colors[key] : fallback;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} — Administração</title>
  ${GOOGLE_ANALYTICS_TAG}
  ${FETCH_SHIM_SCRIPT}

  <link rel="stylesheet" href="/store-assets/admin-shell-v1.css">
  <link rel="stylesheet" href="/store-assets/site-header.css">
  <link rel="stylesheet" href="/store-assets/design-system.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>:root { --primary: ${color('primary','#2e9348')}; --primary-dark: ${color('primary','#2e9348')}; --accent: ${color('accent','#f5c518')}; --bg: ${color('background','#f8f9fa')}; } body { color: ${color('text','#1a1a1a')}; }</style>
  <style>
    .header-actions { flex-wrap: wrap; justify-content: flex-end; }
    button, .header-btn { transition: transform .18s ease, box-shadow .18s ease, filter .18s ease, background-color .18s ease; }
    button:hover, .header-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(15, 23, 42, .14); }
    button:focus-visible, .header-btn:focus-visible { outline: 3px solid rgba(46, 147, 72, .28); outline-offset: 2px; }
    button:disabled, .header-btn:disabled { transform: none; box-shadow: none; cursor: not-allowed; }
    .admin-cashier-link { background: var(--accent); color: #111827; border-color: #eab308; font-weight: 800; }
    .admin-section-heading { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:16px; }
    .stock-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
    .stock-toolbar-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .stock-search { width:min(100%, 420px); padding:11px 14px; border:1px solid var(--border); border-radius:12px; font:inherit; }
    .stock-cards { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }
    .stock-card { border:1px solid var(--border); border-radius:16px; background:#fff; padding:14px; display:grid; gap:12px; cursor:pointer; box-shadow:0 2px 6px rgba(15,23,42,.05); transition:transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
    .stock-card:hover { transform:translateY(-2px); box-shadow:0 9px 22px rgba(15,23,42,.12); border-color:#86c99a; }
    .stock-card-head { display:flex; align-items:center; gap:12px; min-width:0; }
    .stock-card render-image { width:64px; height:64px; flex:none; overflow:hidden; border-radius:12px; background:#f1f5f3; }
    .stock-card render-image img { width:100%; height:100%; object-fit:cover; }
    .stock-card-name { font-weight:800; font-size:14px; color:#0f172a; overflow-wrap:anywhere; }
    .stock-card-category { font-size:11px; color:#64748b; margin-top:4px; }
    .stock-card-balance { font-size:13px; color:#475569; }
    .stock-card-balance strong { font-size:20px; color:var(--primary-dark); }
    .stock-card-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .stock-card-actions .action-btn { flex:1; justify-content:center; }
    .stock-movement-row { padding:10px 12px; border:1px solid #e2e8f0; border-radius:10px; background:#fff; color:#475569; font-size:12px; line-height:1.5; }
    .stock-adjust-modal .modal-card { width:min(100% - 24px, 520px); border-radius:20px; padding:24px; }
    .stock-adjust-form { display:grid; gap:14px; margin-top:16px; }
    .stock-adjust-form label, .product-form label { display:grid; gap:6px; font-weight:700; font-size:12px; color:#334155; }
    .stock-adjust-form input, .stock-adjust-form select, .stock-adjust-form textarea, .product-form input:not([type=file]):not([type=hidden]), .product-form select, .product-form textarea { width:100%; min-height:44px !important; padding:11px 13px !important; border:1px solid #cbd5e1 !important; border-radius:12px !important; background:#fff; font:inherit; }
    .product-form textarea, .stock-adjust-form textarea { min-height:96px !important; height:auto !important; resize:vertical; }
    .product-form { border:1px solid var(--border); border-radius:18px; padding:20px; background:#fbfdfb; gap:16px; box-shadow:0 4px 16px rgba(15,23,42,.04); }
    .admin-products-toolbar { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:18px; }
    .admin-products-toolbar h2 { margin:0; }
    .admin-add-product { min-height:48px; padding:12px 20px; border:0; border-radius:14px; background:var(--primary); color:#fff; font-weight:800; font-size:14px; box-shadow:0 5px 14px rgba(46,147,72,.22); }
    .admin-product-dialog { width:min(980px, calc(100vw - 32px)); max-width:none; max-height:calc(100dvh - 32px); padding:0; border:1px solid #dbe6dd; border-radius:22px; overflow:auto; background:#fff; color:#17251a; box-shadow:0 24px 80px rgba(15,23,42,.28); }
    .admin-product-dialog::backdrop { background:rgba(15,23,42,.48); backdrop-filter:blur(3px); }
    .admin-product-dialog__surface { padding:24px; }
    .admin-product-dialog__header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; }
    .admin-product-dialog__header h2 { margin:0 0 6px; }
    .admin-product-dialog__header p { margin:0; color:#64748b; font-size:13px; }
    .admin-product-dialog__close { width:42px; height:42px; flex:none; border-radius:50%; font-size:24px; line-height:1; background:#fff; }
    .admin-product-dialog .product-form { box-shadow:none; }
    @media (max-width:700px) { .admin-product-dialog__surface { padding:18px 14px; } .admin-product-dialog .product-form { padding:14px; } }
    @media (max-width:700px) { .tab-content { padding:18px 14px; } .header-actions { justify-content:flex-start; } .stock-toolbar-actions { width:100%; } .stock-toolbar-actions button { flex:1; } }
  </style>

</head>
<body>
  <div class="container">
    <header class="conflora-site-header">
      <a href="/" class="conflora-site-brand" aria-label="${name} — página inicial">
        <img src="${logo}" alt="" />
        <span><strong>${name}</strong><small>Horta e Viveiro · Mineiros - GO</small></span>
      </a>
      <span class="conflora-site-header__context">Administração</span>

      <div class="header-actions">
        <div class="user-pill" id="userHeaderPill">
          <span>Operador:</span>
          <img id="loggedUserPhoto" alt="Foto do operador" referrerpolicy="no-referrer" hidden style="width:28px; height:28px; border-radius:50%; object-fit:cover;" />
          <strong id="loggedUserName">Carregando...</strong>
          <span class="role-badge" id="loggedUserRole">ADMIN</span>
        </div>
        <button class="header-btn" onclick="openLoginModal()">Trocar operador</button>
        <button class="header-btn" onclick="logoutAdmin()" title="Sair da conta de operador/admin">Sair</button>
        <a href="/caixa" class="header-btn admin-cashier-link" aria-label="Ir para o Caixa">▣ IR PARA O CAIXA</a>
        <a href="/admin-gerencial" class="header-btn" style="background:#0f172a; color:#fff;" title="Painel Gerencial Executivo & Looker Studio">📊 Painel Gerencial</a>
        <button class="header-btn notification-button" onclick="showTab('notifs')" aria-label="Notificações">Avisos <span id="notifBadge">0</span></button>
        <a href="/configuracoes" class="header-btn">Personalizar loja</a>
        <a href="/" class="header-btn catalog-link">Ver catálogo ↗</a>
      </div>
    </header>

    <!-- NAVEGAÇÃO POR ABAS (FILTRADAS AUTOMATICAMENTE POR CARGO) -->
    <div class="nav-tabs" id="navTabsContainer">
      <!-- Abas ADMIN -->
      <button class="nav-btn active" id="tabBtn-cashier" onclick="showTab('cashier')">Caixa/Vendas</button>
      <button class="nav-btn" id="tabBtn-orders" onclick="showTab('orders')">Comandas</button>
      <button class="nav-btn" id="tabBtn-stock" onclick="showTab('stock')">Estoque</button>
      <button class="nav-btn" id="tabBtn-products" onclick="showTab('products')">Produtos</button>
      <button class="nav-btn" id="tabBtn-team" onclick="showTab('team')">Equipe</button>
      <button class="nav-btn" id="tabBtn-status" onclick="showTab('status')">Teste de conexões/servidor</button>
      <button class="nav-btn" id="tabBtn-analytics" onclick="showTab('analytics')">Eventos</button>
    </div>

    <!-- ABA 1: ANALYTICS & MÉTRICAS (EXCLUSIVA ADMIN) -->
    <div id="tab-analytics" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>Eventos e desempenho do catálogo</h2>
          <p style="font-size:12px; color:#64748b;">Eventos reais do catálogo enviados ao Google Analytics 4 e registrados para apoiar decisões de marketing.</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <label for="analyticsPeriod" style="font-size:12px;">Período</label>
          <select id="analyticsPeriod" onchange="loadAnalyticsData()"><option value="7">7 dias</option><option value="30" selected>30 dias</option><option value="90">90 dias</option></select>
          <button class="action-btn btn-blue" onclick="testGaEvent()">Testar evento GA4</button>
          <button class="action-btn btn-gray" onclick="loadAnalyticsData()">Atualizar</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Visitantes únicos</div>
          <div class="stat-val" id="analyticsVisitors">0</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Sessões sem dados pessoais</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Visualizações de Produtos</div>
          <div class="stat-val" id="analyticsViews">0</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Evento view_item</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Adições à sacola</div>
          <div class="stat-val" id="analyticsAdds">0</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Evento add_to_cart</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Inícios de finalização</div>
          <div class="stat-val" id="analyticsCheckouts">0</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Evento begin_checkout</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pedidos pelo catálogo</div>
          <div class="stat-val" id="analyticsPurchases">0</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Evento purchase</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Conversão visita → compra</div>
          <div class="stat-val" id="analyticsConversion">0%</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Baseada em visitantes identificados</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Receita atribuída ao catálogo</div>
          <div class="stat-val" id="analyticsRevenue">R$ 0,00</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Pedidos online no período</div>
        </div>
      </div>

      <div class="admin-columns">
        <div style="border:1px solid var(--border); border-radius:8px; padding:16px;">
          <h3 style="font-size:14px; margin-bottom:12px;">Produtos mais vistos e vendidos</h3>
          <div id="analyticsTopProducts" style="font-size:13px; color:#334155;">Carregando eventos…</div>
        </div>
        <div style="border:1px solid var(--border); border-radius:8px; padding:16px;">
          <h3 style="font-size:14px; margin-bottom:12px;">Campanhas e origem do tráfego</h3>
          <div id="analyticsCampaigns" style="font-size:13px; color:#334155;">Carregando campanhas…</div>
        </div>
      </div>
      <p id="analyticsStatus" role="status" style="font-size:12px; color:#64748b; margin-top:12px;"></p>
    </div>

    <!-- ABA 2: FRENTE DE CAIXA & VENDAS DO DIA (ADMIN E CAIXA) -->
    <div id="tab-cashier" class="tab-content active">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>Caixa/Vendas de Hoje</h2>
          <p style="font-size:12px; color:#64748b;">Caixa e vendas: ADMIN vê o total da loja e pode filtrar por operador. CAIXA e VENDEDOR veem apenas as próprias vendas.</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <label id="adminSalesFilterWrap" hidden style="display:flex; align-items:center; gap:6px; font-size:12px;">Vendedor/caixa <select id="adminSalesFilter"><option value="">Todos</option></select></label>
          <button class="action-btn btn-green" onclick="openManualOrderModal()">➕ Lançar Venda no Balcão</button>
          <button class="action-btn btn-gray" id="cashierAlterationsButton" onclick="showTab('diff')">Solicitações de correção</button>
          <button class="action-btn btn-gray" onclick="showTab('price')">Consultar preços</button>
          <button class="action-btn btn-gray" onclick="loadCashierDaily()">🔄 Atualizar</button>
        </div>
      </div>

      <div class="stat-grid" >
        <div class="stat-card">
          <div class="stat-label">Vendas Totais Hoje</div>
          <div class="stat-val" id="cashierTotalToday">R$ 0,00</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">PIX Recebido</div>
          <div class="stat-val" id="cashierPixToday" style="color:#15803d;">R$ 0,00</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cartão (Débito/Crédito)</div>
          <div class="stat-val" id="cashierCardToday" style="color:#0284c7;">R$ 0,00</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Dinheiro em Caixa</div>
          <div class="stat-val" id="cashierCashToday" style="color:#d97706;">R$ 0,00</div>
        </div>
      </div>

      <h3 style="margin-top:16px; font-size:14px;">Lista de Vendas Realizadas Hoje</h3>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Tabela de dados"><table id="todayOrdersTable">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Itens Vendidos</th>
            <th>Pagamento</th>
            <th>Total</th>
            <th>Status</th>
            <th>Ações do Caixa</th>
          </tr>
        </thead>
        <tbody id="todayOrdersBody"></tbody>
      </table></div>
    </div>

    <!-- ABA 3: SOLICITAÇÕES DE ALTERAÇÃO - GIT DIFF (ADMIN E CAIXA) -->
    <div id="tab-diff" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>Central de Auditoria & Alterações de Venda (Estilo Git Diff)</h2>
          <p style="font-size:12px; color:#64748b;">
            Quando o caixa erra um lançamento, ele solicita a alteração. O Administrador confere o Diff (linhas vermelhas e verdes) e aprova ou recusa com justificativa.
          </p>
        </div>
        <button class="action-btn btn-gray" onclick="loadAlterations()">🔄 Atualizar Solicitações</button>
      </div>

      <div id="alterationsListContainer">Carregando solicitações...</div>
    </div>

    <!-- ABA 4: HISTÓRICO COMPLETO DE PEDIDOS (ADMIN) -->
    <div id="tab-orders" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <h2>Comandas e pedidos (Web, WhatsApp e Balcão)</h2>
        <div style="display:flex; gap:8px; align-items:center;"><button class="action-btn btn-gray" onclick="showTab('diff')">Alterações <span id="diffCountBadge" style="background:#ef4444; color:white; padding:1px 6px; border-radius:10px; font-size:10px; margin-left:4px; display:none;">0</span></button><button class="action-btn btn-gray" onclick="loadAllOrders()">🔄 Atualizar</button></div>
      </div>
      <div id="allOrdersListContainer">Carregando histórico...</div>
    </div>

    <!-- ABA 5: CONTROLE DE ESTOQUE -->
    <div id="tab-stock" class="tab-content">
      <div class="admin-section-heading">
        <div><h2>Estoque</h2><p class="muted">Toque no cartão para somar uma unidade; use os botões para entrada, baixa ou contagem exata.</p></div>
        <div class="stock-toolbar-actions">
          <button type="button" id="stockControlToggle" class="action-btn btn-gray" aria-pressed="false" onclick="toggleStockControl()" disabled>Carregando controle…</button>
          <button type="button" class="action-btn btn-green" onclick="openStockAdjustment('ENTRY')">＋ Entrada de estoque</button>
          <button type="button" class="action-btn btn-red" onclick="openStockAdjustment('EXIT')">− Baixa de estoque</button>
        </div>
      </div>
      <p id="stockControlHelp" class="muted" role="status"></p>
      <div class="stock-toolbar">
        <input type="search" id="stockSearchInput" class="stock-search" placeholder="Buscar produto no estoque…" oninput="filterStockCards()" />
        <span id="stockProductsCount" class="muted" role="status"></span>
      </div>
      <div class="stock-cards" id="stockCardsGrid"></div>
      <div class="card" style="margin-top:22px;">
        <h3>Movimentações recentes</h3>
        <div id="stockMovementsList" class="muted">Carregando movimentações…</div>
      </div>
    </div>

    <div class="modal stock-adjust-modal" id="stockAdjustmentModal" role="dialog" aria-modal="true" aria-labelledby="stockAdjustmentTitle">
      <div class="modal-card">
        <div class="admin-section-heading">
          <div><h2 id="stockAdjustmentTitle">Movimentar estoque</h2><p id="stockAdjustmentHelp" class="muted"></p></div>
          <button type="button" class="header-btn" onclick="closeStockAdjustment()" aria-label="Fechar">✕</button>
        </div>
        <form id="stockAdjustmentForm" class="stock-adjust-form" onsubmit="submitStockAdjustment(event)">
          <input type="hidden" id="stockAdjustmentOperation" />
          <label>Produto
            <select id="stockAdjustmentProduct" required></select>
          </label>
          <label><span id="stockAdjustmentQuantityLabel">Quantidade</span>
            <input type="number" id="stockAdjustmentQuantity" min="0" step="0.001" required inputmode="decimal" />
          </label>
          <label id="stockAdjustmentReasonWrap" hidden>Motivo
            <textarea id="stockAdjustmentReason" rows="3" maxlength="300" placeholder="Explique o motivo da baixa ou da contagem." ></textarea>
          </label>
          <p id="stockAdjustmentError" class="error" role="alert" hidden></p>
          <div class="stock-toolbar-actions">
            <button type="button" class="action-btn btn-gray" onclick="closeStockAdjustment()">Cancelar</button>
            <button type="submit" id="stockAdjustmentSubmit" class="action-btn btn-green">Salvar movimentação</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ABA 6: CONSULTA RÁPIDA DE PREÇO (ADMIN E CAIXA) -->
    <div id="tab-price" class="tab-content">
      <h2>Consulta Rápida de Preço e Disponibilidade</h2>
      <p style="font-size:12px; color:#64748b; margin-bottom:12px;">Busca instantânea para informar clientes no balcão sem demora.</p>
      <input type="text" id="priceSearchInput" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-size:15px;" placeholder="Buscar qualquer produto ou muda (ex: rabo de raposa, jabuticaba, eucalipto, alface...)" oninput="filterPriceTable()" />
      <div class="table-scroll" tabindex="0" role="region" aria-label="Tabela de dados"><table style="margin-top:14px;">
        <thead>
          <tr>
            <th>Foto</th>
            <th>Nome do Produto</th>
            <th>Categoria / Subcategoria</th>
            <th>Valor Unitário</th>
            <th>Estoque Atual</th>
          </tr>
        </thead>
        <tbody id="priceTableBody"></tbody>
      </table></div>
    </div>

    <!-- ABA 7: CADASTRO DE PRODUTOS COM MÚLTIPLAS IMAGENS (ADMIN) -->
    <div id="tab-products" class="tab-content">
      <div class="admin-products-toolbar">
        <h2>Cadastro de produtos</h2>
        <button type="button" class="admin-add-product" onclick="openNewProductDialog()">＋ ADICIONAR PRODUTO</button>
      </div>
      <button type="button" class="action-btn btn-gray" onclick="showTab('price')">Abrir consulta e ajuste de preços</button>
      <dialog id="productEditorDialog" class="admin-product-dialog" aria-labelledby="productFormTitle">
        <div class="admin-product-dialog__surface">
          <div class="admin-product-dialog__header">
            <div>
              <h2 id="productFormTitle">Novo produto no catálogo</h2>
              <p>Cadastre categoria, preço, estoque, fotos e informações para o catálogo.</p>
            </div>
            <button type="button" class="admin-product-dialog__close" aria-label="Fechar cadastro de produto" onclick="closeProductEditorDialog()">×</button>
          </div>
      <form id="prodForm" onsubmit="handleProductSubmit(event)" class="product-form">
        <input type="hidden" id="formProdId" />
        <div>
          <label style="font-size:12px; font-weight:bold;">Nome do Produto:</label>
          <input type="text" id="formProdName" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: Jabuticaba Sabará" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">Categoria:</label>
          <input type="text" id="formProdCat" required oninput="suggestProductSaleUnit()" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: Frutíferas, Palmeiras..." />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">Subcategoria:</label>
          <input type="text" id="formProdSubcat" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: Cítricos, Nativas..." />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">Preço de Venda (R$):</label>
          <input type="number" step="0.01" id="formProdPrice" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="190.00" />
        </div>
        <div>
          <label for="formProdUnit" style="font-size:12px; font-weight:bold;">Unidade de venda:</label>
          <select id="formProdUnit" onchange="markProductUnitChoice()" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"><option value="UN">Unidade (UN)</option><option value="KG">Quilograma (KG)</option></select>
          <small style="display:block; margin-top:5px; color:#64748b;">Hortifrutti novo começa sugerido por KG; confirme a unidade antes de salvar. Produtos por KG perguntam o peso na venda.</small>
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">Estoque inicial (na unidade selecionada):</label>
          <input type="number" id="formProdStock" required min="0" step="0.001" inputmode="decimal" value="0" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="15" />
        </div>
        <div>
          <label for="formProdStatus" style="font-size:12px; font-weight:bold;">Status no catálogo:</label>
          <select id="formProdStatus"><option value="ATIVO">ATIVO</option><option value="INATIVO">INATIVO — oculto no catálogo</option></select>
        </div>
        <div style="grid-column: 1/-1;">
          <label style="font-size:12px; font-weight:bold;">📸 Fotos do Produto no Firebase Storage (Upload Múltiplo Local):</label>
          <div class="photo-upload-actions">
            <label class="photo-upload-control">
              <span>Escolher fotos da galeria</span>
              <input type="file" id="formProdPhotoFile" accept="image/*" multiple onchange="handleProdPhotoFileSelect(event)" />
            </label>
            <label class="photo-upload-control">
              <span>📷 Tirar foto com a câmera traseira</span>
              <input type="file" id="formProdCameraFile" accept="image/*" capture="environment" onchange="handleProdPhotoFileSelect(event)" />
            </label>
          </div>
          <div style="font-size:10px; color:#15803d; margin-top:2px;">⚡ <strong>Qualidade Máxima &amp; Zoom HD:</strong> Fotos são otimizadas no servidor antes do envio ao Firebase Storage e ficam disponíveis no catálogo.</div>
          <div id="formProdPhotoPreviewBox" style="display:none; margin-top:8px; padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-size:12px; font-weight:bold; color:#14532d;">📸 Galeria de Fotos (<span id="formProdPhotoCount">0</span> foto(s)):</div>
              <button type="button" onclick="clearAllPendingPhotos()" style="font-size:11px; background:none; border:none; color:#ef4444; cursor:pointer; text-decoration:underline;">Limpar todas as fotos</button>
            </div>
            <div id="formProdPhotosGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:10px;"></div>
            <div id="formProdPhotoTags" style="font-size:11px; color:#475569; margin-top:8px;"></div>
          </div>
          <!-- Campos de compatibilidade -->
          <input type="hidden" id="formProdPhotoBase64" />
          <img id="formProdPhotoPreviewImg" style="display:none;" />
          <div id="formProdPhotoFileName" style="display:none;"></div>
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">Ou URLs Externas de Fotos (separadas por vírgula):</label>
          <input type="text" id="formProdImages" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="https://..., https://..." />
        </div>
        <div style="grid-column: 1/-1;">
          <label style="font-size:12px; font-weight:bold;">🏷️ Tags Padronizadas (Conflora &amp; IA):</label>
          <input type="text" id="formProdTags" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="palmeira rabo de raposa, wodyetia bifurcata, mudas (geradas automaticamente)" />
        </div>
        <div style="grid-column: 1/-1;">
          <label style="font-size:12px; font-weight:bold;">Descrição Botânica & Cuidados:</label>
          <textarea id="formProdDesc" style="width:100%; height:60px; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Porte da muda, rega, sol pleno ou meia sombra..."></textarea>
        </div>
        <div style="grid-column: 1/-1; display:flex; gap:8px; flex-wrap:wrap;">
          <button type="submit" class="action-btn btn-green">💾 Salvar no Firestore</button>
          <button type="button" class="action-btn btn-gray" onclick="closeProductEditorDialog()">Cancelar</button>
        </div>
      </form>
        </div>
      </dialog>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:28px; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0;">Produtos no Banco de Dados</h3>
        <div id="productStatusFilters" role="group" aria-label="Filtrar produtos por status" style="display:flex; flex-wrap:wrap; gap:8px;">
          <button type="button" class="action-btn btn-gray" data-status="TODOS" aria-pressed="false" onclick="setProductStatusFilter('TODOS')">TODOS</button>
          <button type="button" class="action-btn btn-green" data-status="ATIVO" aria-pressed="true" onclick="setProductStatusFilter('ATIVO')">ATIVOS</button>
          <button type="button" class="action-btn btn-gray" data-status="INATIVO" aria-pressed="false" onclick="setProductStatusFilter('INATIVO')">INATIVOS</button>
        </div>
        <p id="productStatusCount" role="status" style="font-size:13px;"></p>
      </div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Tabela de dados"><table>
        <thead>
          <tr>
            <th>Foto</th>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Preço</th>
            <th>Estoque</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="adminProductsTableBody"></tbody>
      </table></div>
    </div>

    <!-- ABA 8: EQUIPE & PERMISSÕES (ADMIN) -->
    <div id="tab-team" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h2>Gestão de Funcionários & Controle de Permissões</h2>
          <p style="font-size:12px; color:#64748b;">Cadastre atendentes de caixa e administradores com PIN de acesso.</p>
        </div>
        <button class="action-btn btn-green" onclick="openNewUserModal()">➕ Novo Funcionário</button>
      </div>

      <div class="table-scroll" tabindex="0" role="region" aria-label="Tabela de dados"><table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>E-mail / Usuário</th>
            <th>Cargo / Permissão</th>
            <th>PIN</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="teamTableBody"></tbody>
      </table></div>
    </div>

    <!-- ABA 10: NOTIFICAÇÕES (CAIXA E ADMIN) -->
    <div id="tab-notifs" class="tab-content">
      <h2>Central de Notificações & Avisos do Sistema</h2>
      <p style="font-size:12px; color:#64748b; margin-bottom:14px;">Avisos sobre solicitações de alteração de vendas aceitas ou canceladas com o motivo.</p>
      <div id="notificationsContainer">Carregando avisos...</div>
    </div>

    <!-- ABA 11: STATUS DAS CONEXÕES & DIAGNÓSTICO (EXCLUSIVA ADMIN) -->
    <div id="tab-status" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
        <div>
          <h2>Status das Conexões & Diagnóstico do Sistema</h2>
          <p style="font-size:12px; color:#64748b;">Monitoramento do WhatsApp e do Cloud Firestore.</p>
        </div>
        <button class="action-btn btn-green" onclick="loadAdminStatusData()" style="padding:10px 16px; font-size:13px;">
          🔄 Atualizar Diagnósticos
        </button>
      </div>

      <div id="adminStatusDashboardContainer">
        <div style="padding:30px; text-align:center; color:#64748b;">Carregando diagnósticos em tempo real...</div>
      </div>
    </div>
  </div>

  <!-- MODAL: LOGIN / TROCA DE OPERADOR / GOOGLE LOGIN -->
  <div class="modal" id="loginModal">
    <div class="modal-card" style="max-width:480px;">
      <h3 style="margin-bottom:6px; display:flex; align-items:center; gap:8px;">Identificação & Acesso Administrativo
      </h3>
      <p style="font-size:12px; color:#64748b; margin-bottom:16px;">
        Acesso restrito ao viveiro. Faça login com sua conta Google de administrador ou utilize seu PIN de operador de caixa.
      </p>

      <!-- SEÇÃO 1: LOGIN COM GOOGLE -->
      <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:14px; margin-bottom:18px;">
        <div style="font-size:13px; font-weight:800; color:#14532d; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <svg style="width:16px; height:16px;" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Entrar com Conta Google (Admin)
        </div>
        <p data-google-status role="status">Selecione sua conta na janela segura do Google.</p>
        <button type="button" class="action-btn btn-green" id="adminGoogleLoginButton" data-google-login disabled onclick="submitAdminGoogleLogin()" style="width:100%; justify-content:center; padding:9px; font-size:13px;">
          🚀 Entrar como Administrador Google
        </button>
      </div>

      <!-- SEÇÃO 2: LOGIN COM PIN DE OPERADOR -->
      <div style="border-top:1px dashed #cbd5e1; padding-top:14px;">
        <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:8px;">
          Ou selecione o operador local com PIN:
        </div>
        <div id="userSelectList" style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;"></div>
        <div style="margin-bottom:14px;">
          <label style="font-size:11px; font-weight:bold; color:#475569;">PIN de Acesso:</label>
          <input type="password" id="loginPinInput" maxlength="6" style="width:100%; padding:8px; font-size:18px; text-align:center; letter-spacing:4px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="••••" />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="action-btn btn-gray" onclick="closeLoginModal()">Fechar</button>
          <button class="action-btn btn-green" onclick="performLogin()">Entrar com PIN</button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL: SOLICITAÇÃO DE ALTERAÇÃO PELO CAIXA -->
  <div class="modal" id="alterationRequestModal">
    <div class="modal-card">
      <h3 style="margin-bottom:8px;">Solicitar Correção de Venda</h3>
      <p style="font-size:12px; color:#64748b; margin-bottom:12px;">
        Caso tenha errado no lançamento, informe o que mudou e o motivo. Edmar receberá uma notificação estilo Git Diff para aprovar.
      </p>
      <input type="hidden" id="altOrderId" />
      <div style="margin-bottom:10px;">
        <label style="font-size:12px; font-weight:bold;">Cliente:</label>
        <input type="text" id="altCustName" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" />
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px; font-weight:bold;">Forma de Pagamento Correta:</label>
        <select id="altPayMethod" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">
          <option value="DINHEIRO">Dinheiro</option>
          <option value="PIX">PIX</option>
          <option value="CARTAO_DEBITO">Cartão Débito</option>
          <option value="CARTAO_CREDITO">Cartão Crédito</option>
        </select>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px; font-weight:bold;">Valor Total Correto (R$):</label>
        <input type="number" step="0.01" id="altTotal" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" />
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:12px; font-weight:bold; color:#b45309;">💬 Motivo da Alteração (Obrigatório):</label>
        <textarea id="altReason" required style="width:100%; height:60px; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="Ex: Cliente devolveu 1 muda e pegou outra de R$ 50,00 no dinheiro..."></textarea>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="action-btn btn-gray" onclick="closeAlterationModal()">Cancelar</button>
        <button class="action-btn btn-amber" onclick="submitAlterationRequest()">Enviar para Edmar (Git Diff)</button>
      </div>
    </div>
  </div>

  <!-- MODAL: RECUSAR ALTERAÇÃO (EDMAR DIGITA O MOTIVO) -->
  <div class="modal" id="rejectReasonModal">
    <div class="modal-card">
      <h3 style="margin-bottom:8px; color:#991b1b;">Recusar Solicitação de Alteração</h3>
      <p style="font-size:12px; color:#64748b; margin-bottom:12px;">
        Digite o motivo da recusa. O atendente do caixa receberá uma notificação na tela explicando o cancelamento.
      </p>
      <input type="hidden" id="rejectRequestId" />
      <div style="margin-bottom:14px;">
        <label style="font-size:12px; font-weight:bold;">Motivo do Cancelamento:</label>
        <textarea id="rejectionReasonText" required style="width:100%; height:80px; padding:8px; border:1px solid #ef4444; border-radius:6px;" placeholder="Ex: Comprovante fiscal já foi fechado e não bate com o valor informado..."></textarea>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="action-btn btn-gray" onclick="closeRejectModal()">Voltar</button>
        <button class="action-btn btn-red" onclick="confirmRejectAlteration()">Confirmar Cancelamento & Notificar Caixa</button>
      </div>
    </div>
  </div>

  <!-- MODAL: LANÇAR VENDA MANUAL NO BALCÃO -->
  <div class="modal" id="manualOrderModal">
    <div class="modal-card">
      <h3 style="margin-bottom:12px;">Nova Venda no Balcão</h3>
      <form onsubmit="submitManualOrder(event)">
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">Nome do Cliente:</label>
          <input type="text" id="mCustName" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Cliente Balcão" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">WhatsApp / Telefone:</label>
          <input type="text" id="mCustPhone" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="64999990000" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">Produto Vendido:</label>
          <select id="mProdSelect" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></select>
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">Quantidade:</label>
          <input type="number" id="mQty" min="1" value="1" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" />
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:bold;">Forma de Pagamento:</label>
          <select id="mPayMethod" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">
            <option value="DINHEIRO">Dinheiro</option>
            <option value="PIX">PIX</option>
            <option value="CARTAO_DEBITO">Cartão Débito</option>
            <option value="CARTAO_CREDITO">Cartão Crédito</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="action-btn btn-gray" onclick="closeManualOrderModal()">Cancelar</button>
          <button type="submit" class="action-btn btn-green">Confirmar Venda & Baixar Estoque</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: NOVO FUNCIONÁRIO -->
  <div class="modal" id="userModal">
    <div class="modal-card">
      <h3 style="margin-bottom:12px;">Cadastrar / Editar Funcionário</h3>
      <form onsubmit="handleUserSubmit(event)">
        <input type="hidden" id="uId" />
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">Nome Completo:</label>
          <input type="text" id="uName" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: Maria Atendente" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">E-mail / Usuário:</label>
          <input type="email" id="uEmail" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="maria@conflora.com.br" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">Cargo / Nível de Acesso:</label>
          <select id="uRole" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">
            <option value="CLIENTE">CLIENTE (Perfil de Compras da Loja)</option>
            <option value="CAIXA">CAIXA (Acesso Somente ao Caixa e Vendas de Hoje)</option>
            <option value="VENDEDOR">VENDEDOR (Comandas e Pix)</option>
            <option value="ENTREGADOR">ENTREGADOR (Entregas)</option>
            <option value="ADMIN">ADMIN (Acesso Total: Analytics, Aprovação Diff, Produtos)</option>
          </select>
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:bold;">PIN de Acesso (4 dígitos numéricos):</label>
          <input type="text" id="uPin" maxlength="6" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: 1111" />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="action-btn btn-gray" onclick="closeUserModal()">Cancelar</button>
          <button type="submit" class="action-btn btn-green">Salvar Funcionário</button>
        </div>
      </form>
    </div>
  </div>

  <script src="/store-assets/render-image.js"></script>
  <script src="/store-assets/product-card.js"></script>
  <script>
    // ESTADO GLOBAL
    let currentUser = null;
    fetch('/api/auth/me').then(res => res.json()).then(data => {
      currentUser = data.user;
      if (currentUser && ['ADMIN', 'CAIXA', 'VENDEDOR'].includes(currentUser.role)) closeLoginModal();
      applyUserRoleUI();
    }).catch(() => { currentUser = null; applyUserRoleUI(); });

    let allProducts = [];
    let allOrders = [];
    let currentSelectedUserIdForLogin = '';

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    }

    function applyUserRoleUI() {
      const photo = document.getElementById('loggedUserPhoto');
      photo.hidden = !currentUser?.picture;
      if (currentUser?.picture) photo.src = currentUser.picture;
      else photo.removeAttribute('src');
      if (!currentUser || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(currentUser.role)) {
        document.getElementById('loggedUserName').innerText = 'Não autenticado';
        const roleEl = document.getElementById('loggedUserRole');
        roleEl.innerText = 'BLOQUEADO';
        roleEl.className = 'role-badge caixa';

        // Esconde todas as abas até que haja login
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => {
          b.style.display = 'none';
        });

        // Abre o modal de identificação obrigatório
        openLoginModal(true);
        return;
      }

      document.getElementById('loggedUserName').innerText = currentUser.name || currentUser.email || 'Operador';
      const roleEl = document.getElementById('loggedUserRole');
      roleEl.innerText = currentUser.role || 'OPERADOR';
      roleEl.className = 'role-badge ' + (currentUser.role === 'CAIXA' ? 'caixa' : '');

      const isAdmin = currentUser.role === 'ADMIN';

      const visibleTabs = isAdmin
        ? ['cashier', 'orders', 'stock', 'products', 'team', 'status', 'analytics']
        : ['cashier'];
      for (const tab of ['cashier', 'orders', 'stock', 'products', 'team', 'status', 'analytics']) {
        const button = document.getElementById('tabBtn-' + tab);
        if (button) button.style.display = visibleTabs.includes(tab) ? 'block' : 'none';
      }
      const salesFilter = document.getElementById('adminSalesFilterWrap');
      if (salesFilter) salesFilter.hidden = !isAdmin;
      const alterationsButton = document.getElementById('cashierAlterationsButton');
      if (alterationsButton) alterationsButton.hidden = currentUser.role === 'VENDEDOR';
      showTab('cashier');
    }

    function showTab(tab) {
      if (!currentUser || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(currentUser.role)) return;
      const isAdmin = currentUser.role === 'ADMIN';
      const isStaffAuxiliaryTab = ['diff', 'price', 'notifs'].includes(tab);
      if (!isAdmin && tab !== 'cashier' && !(['CAIXA', 'VENDEDOR'].includes(currentUser.role) && ['diff', 'price', 'notifs'].includes(tab))) return;
      if (!document.getElementById('tab-' + tab)) return;
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      
      const targetContent = document.getElementById('tab-' + tab);
      const targetBtn = document.getElementById('tabBtn-' + tab);
      if (targetContent) targetContent.classList.add('active');
      if (targetBtn) targetBtn.classList.add('active');
      if (isStaffAuxiliaryTab && targetBtn) targetBtn.classList.remove('active');

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

    // 1. EVENTOS DO CATÁLOGO & INDICADORES PARA MARKETING
    async function loadAnalyticsData() {
      const status = document.getElementById('analyticsStatus');
      status.textContent = 'Buscando eventos coletados…';
      try {
        const days = Number(document.getElementById('analyticsPeriod').value || 30);
        const res = await fetch('/api/admin/analytics/events?days=' + encodeURIComponent(days));
        const metrics = await res.json();
        if (!res.ok) throw new Error(metrics.error || 'Não foi possível carregar os eventos.');
        const number = value => Number(value || 0).toLocaleString('pt-BR');
        const currency = value => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('analyticsVisitors').textContent = number(metrics.visitors);
        document.getElementById('analyticsViews').textContent = number(metrics.productViews);
        document.getElementById('analyticsAdds').textContent = number(metrics.addToCart);
        document.getElementById('analyticsCheckouts').textContent = number(metrics.checkoutStarts);
        document.getElementById('analyticsPurchases').textContent = number(metrics.purchases);
        document.getElementById('analyticsConversion').textContent = Number(metrics.conversionRate || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
        document.getElementById('analyticsRevenue').textContent = currency(metrics.revenue);
        const topEl = document.getElementById('analyticsTopProducts');
        const topProducts = metrics.topProducts || [];
        topEl.replaceChildren(...(topProducts.length ? topProducts.map((product, index) => {
          const row = document.createElement('div');
          row.style.marginBottom = '7px';
          row.textContent = (index + 1) + '. ' + product.name + ' · ' + number(product.views) + ' visualizações · ' + number(product.adds) + ' adições · ' + number(product.purchases) + ' vendidos';
          return row;
        }) : [Object.assign(document.createElement('p'), { textContent: 'Ainda não há eventos de produto neste período.' })]));
        const campaignEl = document.getElementById('analyticsCampaigns');
        const campaigns = metrics.campaigns || [];
        campaignEl.replaceChildren(...(campaigns.length ? campaigns.map(campaign => {
          const row = document.createElement('div');
          row.style.marginBottom = '8px';
          row.textContent = campaign.name + ' · ' + number(campaign.visits) + ' visitas · ' + number(campaign.purchases) + ' pedidos · ' + currency(campaign.revenue);
          return row;
        }) : [Object.assign(document.createElement('p'), { textContent: 'Nenhuma campanha UTM registrada ainda. Use utm_source, utm_medium e utm_campaign nos links de anúncios.' })]));
        status.textContent = number(metrics.collectedEvents) + ' eventos coletados nos últimos ' + days + ' dias. Métricas começam a acumular após a publicação desta versão.';
      } catch (err) {
        status.textContent = err.message || 'Erro ao carregar eventos do catálogo.';
      }
    }

    function testGaEvent() {
      if (typeof gtag === 'function') {
        gtag('event', 'admin_analytics_test', { event_category: 'admin' });
        alert('Evento de teste colocado na fila do Google Analytics 4. Confira a chegada no DebugView do GA4.');
      } else {
        alert('A biblioteca do Google Analytics não foi carregada nesta página.');
      }
    }

    // 2. CAIXA & VENDAS DO DIA
    async function loadCashierDaily() {
      try {
        const isAdmin = currentUser?.role === 'ADMIN';
        const operator = isAdmin ? document.getElementById('adminSalesFilter')?.value || '' : '';
        const selectedOperatorName = isAdmin ? document.getElementById('adminSalesFilter')?.selectedOptions?.[0]?.textContent || '' : '';
        const url = '/api/admin/daily-metrics' + (operator ? '?operator=' + encodeURIComponent(operator) + '&operatorName=' + encodeURIComponent(selectedOperatorName) : '');
        const res = await fetch(url);
        const m = await res.json();
        if (!res.ok) throw new Error(m.error || 'Não foi possível carregar as vendas.');
        document.getElementById('cashierTotalToday').innerText = 'R$ ' + Number(m.totalRevenue || 0).toFixed(2).replace('.', ',');
        document.getElementById('cashierPixToday').innerText = 'R$ ' + Number(m.byPayment?.PIX || 0).toFixed(2).replace('.', ',');
        document.getElementById('cashierCardToday').innerText = 'R$ ' + Number(m.byPayment?.CARTAO || 0).toFixed(2).replace('.', ',');
        document.getElementById('cashierCashToday').innerText = 'R$ ' + Number(m.byPayment?.DINHEIRO || 0).toFixed(2).replace('.', ',');

        const tbody = document.getElementById('todayOrdersBody');
        tbody.innerHTML = '';
        const list = m.todayOrders || [];
        if (isAdmin && !operator) {
          const select = document.getElementById('adminSalesFilter');
          const selectedValue = select.value;
          const operators = new Map();
          for (const order of list) {
            const id = String(order.operatorId || '');
            const name = String(order.operatorName || '').trim();
            const value = id || (name ? 'name:' + name : '');
            if (value && !operators.has(value)) operators.set(value, name || id);
          }
          select.replaceChildren(new Option('Todos', ''), ...[...operators].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([value, label]) => new Option(label, value)));
          select.value = selectedValue;
        }
        if (list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Nenhuma venda realizada hoje ainda.</td></tr>';
          return;
        }

        list.forEach(o => {
          const tr = document.createElement('tr');
          const itemsTxt = (o.items || []).map(i => escapeHtml(i.name) + ' (' + (i.quantity || 1) + 'x)').join(', ');
          tr.innerHTML = \`
            <td><strong>#\${(o.id || '').slice(-6)}</strong></td>
            <td>\${escapeHtml(o.customerName || 'Cliente Balcão')}</td>
            <td>\${itemsTxt}</td>
            <td>\${escapeHtml(o.paymentMethod || 'PIX')}</td>
            <td><strong>R$ \${Number(o.total || 0).toFixed(2).replace('.', ',')}</strong></td>
            <td><span class="badge \${o.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-pending'}">\${escapeHtml(o.status)}</span></td>
            <td>
              <button class="action-btn btn-amber" style="padding:4px 8px;" onclick="openAlterationModal('\${o.id}')" title="Corrigir se errou no lançamento">✏️ Corrigir Venda</button>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (err) {
        document.getElementById('todayOrdersBody').innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#b91c1c;">' + escapeHtml(err.message || 'Erro ao carregar vendas.') + '</td></tr>';
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
          container.innerHTML = '<div style="padding:20px; color:#64748b; text-align:center;">Nenhuma solicitação de alteração registrada.</div>';
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
                <strong>Pedido #\${(alt.orderId || '').slice(-6)}</strong> • Solicitado por: <strong>\${alt.requestedByName || 'Caixa'}</strong> em \${new Date(alt.createdAt).toLocaleTimeString()}
              </div>
              <div>
                <span class="badge \${alt.status === 'APPROVED' ? 'badge-confirmed' : (alt.status === 'REJECTED' ? 'badge-cancelled' : 'badge-pending')}">
                  \${alt.status === 'PENDING' ? 'AGUARDANDO EDMAR' : (alt.status === 'APPROVED' ? 'APROVADO' : 'RECUSADO')}
                </span>
              </div>
            </div>

            <div class="diff-reason-box">
              <strong>💬 Justificativa do Atendente:</strong> "\${alt.reason || 'Correção de erro'}"
              \${alt.rejectionReason ? \`<div style="margin-top:6px; color:#991b1b;"><strong>❌ Motivo do Cancelamento de Edmar:</strong> "\${alt.rejectionReason}"</div>\` : ''}
            </div>

            <div class="diff-body">
              \${diffLinesHtml}
            </div>

            \${isAdmin && alt.status === 'PENDING' ? \`
              <div class="diff-actions">
                <button class="action-btn btn-red" onclick="openRejectModal('\${alt.id}')">❌ Recusar Alteração (Enviar Motivo)</button>
                <button class="action-btn btn-green" onclick="approveAlteration('\${alt.id}')">✅ Aceitar Alteração (Merge)</button>
              </div>
            \` : ''}
          \`;
          container.appendChild(card);
        });
      } catch (err) {
        container.innerHTML = 'Erro ao carregar alterações: ' + err.message;
      }
    }

    async function approveAlteration(requestId) {
      if (!confirm('Deseja consolidar esta alteração no pedido e atualizar o estoque?')) return;
      const res = await fetch('/api/admin/alterations/' + requestId + '/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVED', reviewedBy: currentUser.name })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Alteração consolidada no Firestore com sucesso! Notificação enviada para o caixa.');
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
      if (!reason) { alert('Por favor, informe o motivo do cancelamento para o atendente.'); return; }

      const res = await fetch('/api/admin/alterations/' + id + '/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECTED', reviewedBy: currentUser.name, rejectionReason: reason })
      });
      const data = await res.json();
      if (data.success) {
        alert('Solicitação recusada. A notificação com o motivo foi enviada diretamente para o atendente do caixa.');
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

      if (!reason) { alert('Informe a justificativa do erro para que Edmar possa avaliar.'); return; }

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

      alert('🚀 Solicitação de alteração enviada para o Administrador! Ele analisará as diferenças no visualizador Git Diff.');
      closeAlterationModal();
      loadAlterations();
    }

    // 5. NOTIFICAÇÕES PARA ATENDENTE / ADMIN
    async function loadNotifications() {
      const container = document.getElementById('notificationsContainer');
      try {
        if (!currentUser) return;
        const res = await fetch('/api/admin/notifications?userId=' + currentUser.id);
        const list = await res.json();
        container.replaceChildren();

        const notifications = Array.isArray(list) ? list : [];
        const unreadCount = notifications.filter(n => !n.read).length;
        document.getElementById('notifBadge').innerText = unreadCount;

        if (notifications.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'muted';
          empty.textContent = 'Nenhuma notificação no momento.';
          container.appendChild(empty);
        }

        notifications.forEach(n => {
          const div = document.createElement('div');
          const isSale = n.type === 'SALE_COMPLETED';
          div.className = 'notif-card ' + (n.type === 'REJECTED' ? 'rejected' : (isSale ? 'sale' : (n.type === 'APPROVED' ? 'approved' : '')));
          const heading = document.createElement('strong');
          heading.textContent = n.title || 'Aviso da Administração';
          const timestamp = document.createElement('time');
          timestamp.dateTime = n.createdAt || '';
          timestamp.textContent = n.createdAt ? new Date(n.createdAt).toLocaleString('pt-BR') : '';
          const top = document.createElement('div');
          top.className = 'notification-heading';
          top.append(heading, timestamp);
          const message = document.createElement('p');
          message.textContent = n.message || '';
          div.append(top, message);
          if (n.reason) {
            const reason = document.createElement('p');
            reason.className = 'notification-reason';
            reason.textContent = 'Motivo: ' + n.reason;
            div.appendChild(reason);
          }
          if (isSale) {
            const ordersButton = document.createElement('button');
            ordersButton.type = 'button';
            ordersButton.className = 'action-btn btn-green';
            ordersButton.textContent = 'Ver pedidos';
            ordersButton.addEventListener('click', () => showTab('orders'));
            div.appendChild(ordersButton);
          }
          if (n.type === 'DISCOUNT_APPROVAL_PENDING') {
            const reviewButton = document.createElement('button');
            reviewButton.type = 'button';
            reviewButton.className = 'action-btn btn-green';
            reviewButton.textContent = 'Abrir auditoria';
            reviewButton.addEventListener('click', () => {
              showTab('notifs');
              document.getElementById('discountApprovalsPanel')?.scrollIntoView({ behavior: 'smooth' });
            });
            div.appendChild(reviewButton);
          }
          container.appendChild(div);
        });

        if (String(currentUser.role).toUpperCase() === 'ADMIN') {
          await renderDiscountApprovals(container);
        }
      } catch (err) {
        container.textContent = 'Erro ao carregar notificações: ' + err.message;
      }
    }

    async function renderDiscountApprovals(container) {
      const response = await fetch('/api/admin/discount-approvals');
      if (!response.ok) return;
      const approvals = await response.json();
      if (!Array.isArray(approvals) || approvals.length === 0) return;

      const panel = document.createElement('section');
      panel.id = 'discountApprovalsPanel';
      panel.className = 'discount-approvals-panel';
      const title = document.createElement('h2');
      title.textContent = 'Aprovações de desconto pendentes';
      panel.appendChild(title);

      approvals.forEach((approval) => {
        const card = document.createElement('article');
        card.className = 'discount-approval-card';
        const heading = document.createElement('h3');
        heading.textContent = 'Venda para ' + (approval.customerName || 'Cliente');
        const meta = document.createElement('p');
        meta.className = 'muted';
        meta.textContent = (approval.operatorName || 'Operador') + ' · ' + (approval.customerPhone || 'Sem telefone');
        const items = document.createElement('ul');
        items.className = 'discount-approval-items';
        (approval.items || []).forEach((item) => {
          const row = document.createElement('li');
          const quantity = Number(item.quantity) || 0;
          const subtotal = Number(item.price || 0) * quantity;
          row.title = item.name || 'Produto';
          row.textContent = quantity + ' × ' + (item.name || 'Produto') + ' · ' + Number(item.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ' un · ' + subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          items.appendChild(row);
        });
        const totals = document.createElement('div');
        totals.className = 'discount-approval-totals';
        const subtotalLine = document.createElement('p');
        subtotalLine.textContent = 'Subtotal: ' + Number(approval.subtotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const discountLine = document.createElement('p');
        discountLine.textContent = 'Desconto: ' + Number(approval.discountPercent || 0) + '% · − ' + Number(approval.discountAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const totalLine = document.createElement('strong');
        totalLine.textContent = 'Total da venda: ' + Number(approval.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        totals.append(subtotalLine, discountLine, totalLine);
        const actions = document.createElement('div');
        actions.className = 'discount-review-actions';
        const accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'discount-review-accept';
        accept.setAttribute('aria-label', 'Aceitar desconto');
        accept.textContent = '✓ Aceitar';
        accept.addEventListener('click', () => reviewDiscountApproval(approval.id, 'APPROVED', accept, reject));
        const reject = document.createElement('button');
        reject.type = 'button';
        reject.className = 'discount-review-reject';
        reject.setAttribute('aria-label', 'Recusar desconto');
        reject.textContent = '× Recusar';
        reject.addEventListener('click', () => reviewDiscountApproval(approval.id, 'REJECTED', reject, accept));
        actions.append(accept, reject);
        card.append(heading, meta, items, totals, actions);
        panel.appendChild(card);
      });
      container.appendChild(panel);
    }

    async function reviewDiscountApproval(approvalId, action, button, alternateButton) {
      let rejectionReason = '';
      if (action === 'REJECTED') {
        rejectionReason = window.prompt('Informe o motivo da recusa:') || '';
        if (!rejectionReason.trim()) {
          if (rejectionReason !== '') alert('O motivo da recusa é obrigatório.');
          return;
        }
      }
      button.disabled = true;
      alternateButton.disabled = true;
      try {
        const response = await fetch('/api/admin/discount-approvals/' + encodeURIComponent(approvalId) + '/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, rejectionReason }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível revisar o desconto.');
        await loadNotifications();
      } catch (error) {
        button.disabled = false;
        alternateButton.disabled = false;
        alert(error.message);
      }
    }

    function safeExtractProductsAdmin(data) {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object') {
        if (Array.isArray(data.products)) return data.products;
        if (data.products && typeof data.products === 'object') return Object.values(data.products);
      }
      return [];
    }

    // 6. CONSULTA RÁPIDA DE PREÇO
    async function loadPriceProducts() {
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
          const data = await res.json();
          const list = safeExtractProductsAdmin(data);
          allProducts = Array.isArray(list) ? list : [];
        } else {
          allProducts = [];
        }
      } catch (e) {
        console.warn('Falha na consulta de preços:', e);
        allProducts = [];
      }
      if (!Array.isArray(allProducts)) allProducts = [];
      filterPriceTable();
    }

    function isStoredProductImageUrl(url) {
      const value = String(url || '').trim().toLowerCase();
      return value.startsWith('/api/images/') || /^https:\\/\\/(?:firebasestorage|storage)\\.googleapis\\.com\\//i.test(value);
    }

    function getProductImageUrl(product) {
      const sharedCandidates = window.ConfloraProductCard?.getImageCandidates(product) || [];
      if (sharedCandidates.length) return sharedCandidates[0];
      const candidates = [
        ...(Array.isArray(product.images) ? product.images : []),
        ...(Array.isArray(product.imagePaths) ? product.imagePaths : []),
        product.imageUrl,
        product.imageurl,
        product.imagePathCache,
      ].map((image) => typeof image === 'string' ? image.trim() : image?.url || image?.imageUrl || '');
      return candidates.find(isStoredProductImageUrl) || product.imageFallbackUrl || '/store-assets/placeholder.svg';
    }

    function filterPriceTable() {
      if (!Array.isArray(allProducts)) allProducts = [];
      const q = document.getElementById('priceSearchInput').value.toLowerCase();
      const tbody = document.getElementById('priceTableBody');
      tbody.innerHTML = '';

      allProducts.filter(p => !q || (p.name || p.descricao || '').toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q)).forEach(p => {
        const tr = document.createElement('tr');
        const img = getProductImageUrl(p);
        tr.innerHTML = \`
          <td><img src="\${img}" class="prod-thumb" /></td>
          <td><strong>\${p.descricao || p.name}</strong></td>
          <td>\${p.categoria || p.category || ''} • \${p.subcategoria || ''}</td>
          <td><strong style="color:#15803d; font-size:15px;">R$ \${Number(p.valor_num || p.price || 0).toFixed(2).replace('.', ',')}</strong></td>
          <td><span style="font-weight:bold;">\${p.stockQuantity ?? p.estoque ?? 0}</span> \${getAdminProductSaleUnit(p) === 'KG' ? 'kg' : 'un.'} em estoque</td>
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
              <option value="CLIENTE" \${role === 'CLIENTE' ? 'selected' : ''}>👤 CLIENTE (Padrão)</option>
              <option value="VENDEDOR" \${role === 'VENDEDOR' ? 'selected' : ''}>VENDEDOR (Comandas)</option>
              <option value="CAIXA" \${role === 'CAIXA' ? 'selected' : ''}>🛒 CAIXA (Balcão)</option>
              <option value="ENTREGADOR" \${role === 'ENTREGADOR' ? 'selected' : ''}>🛵 ENTREGADOR (Entregas)</option>
              <option value="ADMIN" \${role === 'ADMIN' ? 'selected' : ''}>👑 ADMIN (Total)</option>
            </select>
          </td>
          <td>\${u.hasPin ? '••••' : (u.hasPassword ? '🔑 Senha' : '🌐 Google')}</td>
          <td>\${u.active !== false ? '🟢 Ativo' : '🔴 Inativo'}</td>
          <td>
            \${u.id !== 'usr-edmar' ? \`<button class="action-btn btn-red" style="padding:4px 8px;" onclick="deleteUser('\${u.id}')">Excluir</button>\` : '<em>Administrador Geral</em>'}
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
          alert('✅ Perfil atualizado para ' + newRole + ' com sucesso!');
          loadTeam();
        } else {
          alert('Erro ao alterar perfil: ' + (data.error || 'Falha'));
          loadTeam();
        }
      } catch (err) {
        alert('Erro ao conectar com servidor: ' + err.message);
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

      alert('Colaborador cadastrado com sucesso!');
      closeUserModal();
      loadTeam();
    }

    async function deleteUser(id) {
      if (!confirm('Deseja excluir o acesso deste funcionário?')) return;
      await fetch('/api/admin/users/' + id, { method: 'DELETE' });
      loadTeam();
    }

    // 8. LOGIN / TROCA DE OPERADOR
    async function openLoginModal(automatic = false) {
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
          <span style="font-size:12px; color:#15803d; font-weight:bold;">Selecionar ➔</span>
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

      if (!automatic || !currentUser || !['ADMIN', 'CAIXA'].includes(currentUser.role)) document.getElementById('loginModal').classList.add('open');
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
        alert('Bem-vindo(a), ' + currentUser.name + ' (' + currentUser.role + ')!');
      } else {
        alert('Erro ao autenticar: ' + (data.error || 'PIN incorreto.'));
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
            alert('🌿 Autenticado com sucesso como Administrador Google! Painel e configurações liberados.');
          } else {
            alert('🌿 Bem-vindo(a), ' + currentUser.name + '! Perfil identificado: ' + currentUser.role);
          }
        } else {
          alert('Erro ao autenticar via Google: ' + (data.error || 'Tente novamente'));
        }
      } catch (err) {
        alert(err.code === 'auth/popup-closed-by-user' ? 'Login cancelado.' : err.code === 'auth/popup-blocked' ? 'Permita pop-ups para entrar com o Google.' : 'Erro ao autenticar: ' + err.message);
      } finally {
        button.disabled = false;
      }
    }

    async function logoutAdmin() {
      if (confirm('Deseja realmente sair da sua conta administrativa?')) {
        if (window.signOutGoogle) {
          try { await window.signOutGoogle(); } catch (error) { alert('Erro ao sair: ' + error.message); return; }
        }
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        localStorage.removeItem('conflora_user');
        localStorage.removeItem('conflora_op');
        applyUserRoleUI();
      }
    }

    // 11. Diagnóstico das conexões WhatsApp e Firestore
    async function loadAdminStatusData() {
      const container = document.getElementById('adminStatusDashboardContainer');
      if (!container) return;
      container.innerHTML = '<div style="padding:30px;text-align:center;color:#64748b;">Consultando WhatsApp e Firestore...</div>';
      try {
        const response = await fetch('/api/admin/system-status');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Falha ao consultar o diagnóstico.');
        const cards = [
          ['WhatsApp', data.whatsapp],
          ['Cloud Firestore', data.firestore],
        ];
        container.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;">' + cards.map(([title, item]) => {
          const details = title === 'WhatsApp'
            ? '<p style="font-size:12px;color:#475569;">Rota: <code>/webhook</code><br>Número: ' + (item?.phoneNumberId || 'Não configurado') + '<br>Mensagens recebidas: ' + (item?.totalReceivedCount || 0) + '</p>'
            : '<p style="font-size:12px;color:#475569;">Projeto: <code>' + (item?.projectId || 'confloraai') + '</code><br>Latência: ' + (item?.latencyMs ?? 0) + ' ms</p>';
          return '<section style="background:#f8fafc;border:1px solid var(--border);border-radius:10px;padding:18px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">' +
              '<h3 style="font-size:15px;">' + title + '</h3>' +
              '<span style="background:' + (item?.color || '#64748b') + ';color:white;font-size:11px;font-weight:800;padding:2px 8px;border-radius:10px;">' + (item?.badge || item?.status || 'Indisponível') + '</span>' +
            '</div>' +
            '<p style="font-size:13px;color:#475569;line-height:1.7;">' + (item?.message || 'Sem dados de diagnóstico.') + '</p>' + details +
            '</section>';
        }).join('') + '</div>';
      } catch (error) {
        container.innerHTML = '<div style="color:#ef4444;padding:20px;text-align:center;">Erro ao carregar diagnóstico: ' + error.message + '</div>';
      }
    }
    async function testWebhookFromAdmin() {
      const box = document.getElementById('adminTestResultBox');
      if (box) {
        box.style.display = 'block';
        box.style.background = '#f1f5f9';
        box.style.color = '#334155';
        box.innerHTML = '⏳ Enviando ping para rota /webhook do WhatsApp...';
      }
      try {
        const res = await fetch('/api/admin/test-webhook', { method: 'POST' });
        const d = await res.json();
        if (box) {
          box.style.background = '#dcfce7';
          box.style.color = '#166534';
          box.innerHTML = '✅ <strong>Webhook WhatsApp OK:</strong> Rota <code>/webhook</code> respondeu com sucesso em ' + (d.pingLatencyMs || 0) + 'ms. ' + (d.message || '');
        }
      } catch (err) {
        if (box) {
          box.style.background = '#fee2e2';
          box.style.color = '#991b1b';
          box.innerHTML = '❌ <strong>Erro no teste do Webhook:</strong> ' + err.message;
        }
      }
    }

    // 9. ESTOQUE ÁGIL (+1, +5, +10)
    let stockControlActive = null;
    function renderStockControl() {
      const button = document.getElementById('stockControlToggle');
      button.hidden = currentUser?.role !== 'ADMIN';
      button.disabled = stockControlActive === null;
      button.setAttribute('aria-pressed', String(stockControlActive === true));
      button.className = 'action-btn ' + (stockControlActive ? 'btn-green' : 'btn-gray');
      button.textContent = stockControlActive ? '✓ Estoque ativo · Desativar' : 'Ativar estoque';
      document.getElementById('stockControlHelp').textContent = stockControlActive === null ? 'Não foi possível consultar o controle de estoque.' : stockControlActive
        ? 'Estoque ativo: as vendas exigem saldo disponível e a baixa ocorre na confirmação do pagamento.'
        : 'Venda livre: venda sem cadastrar entradas de estoque, inclusive no Pix. Reservas anteriores continuam protegidas.';
    }
    async function loadStockControl() {
      try {
        const response = await fetch('/api/admin/inventory-settings');
        if (!response.ok) throw new Error('Falha ao consultar o estoque.');
        const settings = await response.json();
        stockControlActive = settings.stockControlEnabled;
      } catch { stockControlActive = null; }
      renderStockControl();
    }
    async function toggleStockControl() {
      if (stockControlActive === null || currentUser?.role !== 'ADMIN') return;
      const button = document.getElementById('stockControlToggle');
      if (button.disabled) return;
      button.disabled = true;
      try {
        const response = await fetch('/api/admin/inventory-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stockControlEnabled: !stockControlActive }) });
        const settings = await response.json();
        if (!response.ok) throw new Error(settings.error || 'Não foi possível salvar o controle de estoque.');
        stockControlActive = settings.stockControlEnabled;
      } catch (error) { alert(error.message); }
      finally { renderStockControl(); }
    }
    async function loadStockProducts() {
      await loadStockControl();
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
          const data = await res.json();
          const list = safeExtractProductsAdmin(data);
          allProducts = Array.isArray(list) ? list : [];
        } else {
          allProducts = [];
        }
      } catch (e) {
        console.warn('Falha ao carregar estoque:', e);
        allProducts = [];
      }
      if (!Array.isArray(allProducts)) allProducts = [];
      filterStockCards();
      await loadStockMovements();
    }

    function getAdminProductSaleUnit(product = {}) {
      const savedUnit = String(product.saleUnit?.code || product.unit || product.unidade || '').trim().toUpperCase();
      if (savedUnit) return savedUnit;
      return /(^|[^A-Z])KG([^A-Z]|$)/i.test(String(product.name || product.descricao || '')) ? 'KG' : 'UN';
    }

    function filterStockCards() {
      if (!Array.isArray(allProducts)) allProducts = [];
      const query = String(document.getElementById('stockSearchInput')?.value || '').trim().toLocaleLowerCase('pt-BR');
      const grid = document.getElementById('stockCardsGrid');
      if (!grid) return;
      grid.replaceChildren();
      const products = allProducts.filter(product => {
        const searchableText = [product.name, product.descricao, product.category, product.categoria, product.subcategory, product.subcategoria]
          .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
        return !query || searchableText.includes(query);
      });
      const count = document.getElementById('stockProductsCount');
      if (count) count.textContent = \`\${products.length} produto\${products.length === 1 ? '' : 's'}\`;
      products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'stock-card';
        card.dataset.productId = product.id;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        const stockUnit = getAdminProductSaleUnit(product);
        card.setAttribute('aria-label', stockUnit === 'KG' ? \`Adicionar 1 kg de \${product.name || product.descricao || 'produto'} ao estoque\` : \`Adicionar uma unidade de \${product.name || product.descricao || 'produto'} ao estoque\`);
        const image = document.createElement('render-image');
        image.setAttribute('alt', product.name || product.descricao || 'Produto');
        image.setAttribute('loading', 'lazy');
        image.setAttribute('fallback-src', '/store-assets/placeholder.svg');
        const candidates = window.ConfloraProductCard?.getImageCandidates(product) || [getProductImageUrl(product)];
        image.setAttribute('image-candidates', JSON.stringify(candidates));
        image.setAttribute('src', candidates[0] || '/store-assets/placeholder.svg');
        const head = document.createElement('div');
        head.className = 'stock-card-head';
        head.appendChild(image);
        const meta = document.createElement('div');
        meta.style.minWidth = '0';
        const name = document.createElement('div');
        name.className = 'stock-card-name';
        name.textContent = product.name || product.descricao || 'Produto sem nome';
        const category = document.createElement('div');
        category.className = 'stock-card-category';
        category.textContent = window.ConfloraProductCard?.getCategory(product) || product.category || product.categoria || '';
        meta.append(name, category);
        head.appendChild(meta);
        const balance = document.createElement('div');
        balance.className = 'stock-card-balance';
        balance.append('Estoque atual: ');
        const quantity = document.createElement('strong');
        quantity.id = 'stk-' + product.id;
        quantity.textContent = String(product.stockQuantity ?? product.estoque ?? 0);
        balance.append(quantity, stockUnit === 'KG' ? ' kg' : ' un');
        const actions = document.createElement('div');
        actions.className = 'stock-card-actions';
        const addButton = document.createElement('button');
        addButton.type = 'button';
        addButton.className = 'action-btn btn-green';
        addButton.textContent = stockUnit === 'KG' ? '＋1 kg Entrada' : '＋1 Entrada';
        addButton.addEventListener('click', () => addStock(product.id, 1));
        const countButton = document.createElement('button');
        countButton.type = 'button';
        countButton.className = 'action-btn btn-gray';
        countButton.textContent = 'Contagem';
        countButton.addEventListener('click', () => openStockAdjustment('SET', product.id));
        const exitButton = document.createElement('button');
        exitButton.type = 'button';
        exitButton.className = 'action-btn btn-red';
        exitButton.textContent = 'Baixa';
        exitButton.addEventListener('click', () => openStockAdjustment('EXIT', product.id));
        actions.append(addButton, countButton, exitButton);
        card.append(head, balance, actions);
        card.addEventListener('click', event => {
          if (!event.target.closest('button')) addStock(product.id, 1);
        });
        card.addEventListener('keydown', event => {
          if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('button')) {
            event.preventDefault();
            addStock(product.id, 1);
          }
        });
        grid.appendChild(card);
      });
    }

    function createStockRequestId() {
      return window.crypto?.randomUUID?.() || \`stock-\${Date.now()}-\${Math.random().toString(36).slice(2, 12)}\`;
    }

    async function addStock(productId, quantity) {
      const selector = \`.stock-card[data-product-id="\${CSS.escape(String(productId))}"]\`;
      const card = document.querySelector(selector);
      if (card?.dataset.saving === 'true') return;
      if (card) { card.dataset.saving = 'true'; card.setAttribute('aria-busy', 'true'); }
      try {
        const response = await fetch('/api/admin/stock/adjustments', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, operation: 'ENTRY', quantity, requestId: createStockRequestId() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar o estoque.');
        updateStockBalance(productId, data.newStock);
      } catch (error) {
        alert(error.message || 'Não foi possível atualizar o estoque.');
      } finally {
        if (card) { card.dataset.saving = 'false'; card.removeAttribute('aria-busy'); }
      }
    }

    function updateStockBalance(productId, value) {
      const stock = Number(value);
      if (!Number.isFinite(stock)) return;
      const element = document.getElementById('stk-' + productId);
      if (element) element.textContent = String(stock);
      const product = allProducts.find(item => String(item.id) === String(productId));
      if (product) { product.stockQuantity = stock; product.estoque = stock; }
    }

    function openStockAdjustment(operation, productId = '') {
      if (currentUser?.role !== 'ADMIN') return;
      const form = document.getElementById('stockAdjustmentForm');
      const modal = document.getElementById('stockAdjustmentModal');
      const select = document.getElementById('stockAdjustmentProduct');
      const reason = document.getElementById('stockAdjustmentReason');
      if (!form || !modal || !select) return;
      const kind = String(operation || 'ENTRY').toUpperCase();
      document.getElementById('stockAdjustmentOperation').value = kind;
      document.getElementById('stockAdjustmentTitle').textContent = kind === 'ENTRY' ? 'Entrada de estoque' : kind === 'EXIT' ? 'Baixa de estoque' : 'Contagem e ajuste de estoque';
      document.getElementById('stockAdjustmentHelp').textContent = kind === 'SET' ? 'Informe a quantidade física contada. O saldo será substituído por esse valor.' : 'Registre a quantidade movimentada. A operação ficará no histórico de estoque.';
      document.getElementById('stockAdjustmentQuantityLabel').textContent = kind === 'SET' ? 'Novo estoque contado' : 'Quantidade';
      document.getElementById('stockAdjustmentQuantity').value = kind === 'SET' ? '0' : '1';
      document.getElementById('stockAdjustmentReasonWrap').hidden = kind === 'ENTRY';
      reason.required = kind !== 'ENTRY';
      reason.value = '';
      document.getElementById('stockAdjustmentError').hidden = true;
      select.replaceChildren(new Option('Selecione um produto', ''));
      [...allProducts].sort((a, b) => String(a.name || a.descricao || '').localeCompare(String(b.name || b.descricao || ''), 'pt-BR'))
        .forEach(product => select.add(new Option(\`\${product.name || product.descricao || 'Produto'} — estoque \${product.stockQuantity ?? product.estoque ?? 0}\`, product.id)));
      if (productId) select.value = productId;
      const quantityInput = document.getElementById('stockAdjustmentQuantity');
      const updateQuantityUnit = () => {
        const product = allProducts.find(row => String(row.id) === String(select.value));
        const isKg = getAdminProductSaleUnit(product) === 'KG';
        document.getElementById('stockAdjustmentQuantityLabel').textContent = (kind === 'SET' ? 'Novo estoque contado' : 'Quantidade') + (isKg ? ' (kg)' : ' (unidades)');
        quantityInput.step = isKg ? '0.001' : '1';
        quantityInput.inputMode = isKg ? 'decimal' : 'numeric';
      };
      select.onchange = updateQuantityUnit;
      updateQuantityUnit();
      modal.classList.add('open');
      select.focus();
    }

    function closeStockAdjustment() {
      document.getElementById('stockAdjustmentModal')?.classList.remove('open');
    }

    async function submitStockAdjustment(event) {
      event.preventDefault();
      const operation = document.getElementById('stockAdjustmentOperation').value;
      const productId = document.getElementById('stockAdjustmentProduct').value;
      const quantity = Number(document.getElementById('stockAdjustmentQuantity').value);
      const reason = document.getElementById('stockAdjustmentReason').value.trim();
      const submitButton = document.getElementById('stockAdjustmentSubmit');
      const errorMessage = document.getElementById('stockAdjustmentError');
      const requiresReason = operation === 'SET' || operation === 'EXIT';
      const selectedProduct = allProducts.find(product => String(product.id) === String(productId));
      const isKgProduct = getAdminProductSaleUnit(selectedProduct) === 'KG';
      const quantityValid = Number.isFinite(quantity) && quantity >= 0 && (isKgProduct
        ? Math.abs(quantity - Number(quantity.toFixed(3))) < 0.000001
        : Number.isInteger(quantity));
      if (!productId || !quantityValid || (operation !== 'SET' && quantity === 0) || (requiresReason && reason.length < 3)) {
        errorMessage.textContent = 'Confira o produto, a quantidade e o motivo da operação.';
        errorMessage.hidden = false;
        return;
      }
      submitButton.disabled = true;
      errorMessage.hidden = true;
      try {
        const response = await fetch('/api/admin/stock/adjustments', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, operation, quantity, reason, requestId: createStockRequestId() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível salvar a movimentação.');
        updateStockBalance(productId, data.newStock);
        closeStockAdjustment();
        await loadStockMovements();
      } catch (error) {
        errorMessage.textContent = error.message || 'Não foi possível salvar a movimentação.';
        errorMessage.hidden = false;
      } finally {
        submitButton.disabled = false;
      }
    }

    async function loadStockMovements() {
      const container = document.getElementById('stockMovementsList');
      if (!container) return;
      try {
        const response = await fetch('/api/admin/stock/movements?limit=20');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as movimentações.');
        const movements = Array.isArray(data.movements) ? data.movements : [];
        if (!movements.length) { container.textContent = 'Nenhuma movimentação registrada.'; return; }
        const list = document.createElement('div');
        list.style.display = 'grid';
        list.style.gap = '8px';
        movements.forEach(movement => {
          const row = document.createElement('div');
          row.className = 'stock-movement-row';
          row.textContent = \`\${new Date(movement.createdAt || Date.now()).toLocaleString('pt-BR')} · \${movement.productName || 'Produto'} · \${movement.operation || movement.type || 'Movimento'} · \${movement.quantity} un · \${movement.reason || movement.actorName || 'Venda'}\`;
          list.appendChild(row);
        });
        container.replaceChildren(list);
      } catch (error) {
        container.textContent = error.message || 'Não foi possível carregar as movimentações.';
      }
    }
    // 10. CADASTRO DE PRODUTOS
    let productStatusFilter = 'ATIVO';
    function productIsInactive(product) {
      return String(product.status || product.STATUS || 'ATIVO').trim().toUpperCase() !== 'ATIVO';
    }
    function setProductStatusFilter(status) {
      productStatusFilter = status;
      document.querySelectorAll('#productStatusFilters button').forEach(button => {
        const selected = button.dataset.status === status;
        button.setAttribute('aria-pressed', String(selected));
        button.className = 'action-btn ' + (selected ? 'btn-green' : 'btn-gray');
      });
      renderAdminProducts();
    }
    async function loadAdminProducts() {
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
          const data = await res.json();
          const list = safeExtractProductsAdmin(data);
          allProducts = Array.isArray(list) ? list : [];
        } else {
          allProducts = [];
        }
      } catch (e) {
        console.warn('Falha ao carregar produtos:', e);
        allProducts = [];
      }
      if (!Array.isArray(allProducts)) allProducts = [];
      renderAdminProducts();
    }
    function renderAdminProducts() {
      const tbody = document.getElementById('adminProductsTableBody');
      tbody.innerHTML = '';

      const visible = allProducts.filter(p => productStatusFilter === 'TODOS' || productIsInactive(p) === (productStatusFilter === 'INATIVO'));
      document.getElementById('productStatusCount').textContent = visible.length + ' produto(s) · ' + (productStatusFilter === 'TODOS' ? 'Todos os status' : productStatusFilter === 'INATIVO' ? 'Inativos' : 'Ativos');
      visible.forEach(p => {
        const tr = document.createElement('tr');
        const img = getProductImageUrl(p);
        tr.innerHTML = \`
          <td><img src="\${img}" class="prod-thumb" /></td>
          <td><strong>\${p.descricao || p.name}</strong>\${productIsInactive(p) ? '<p style="color:#92400e; background:#fef3c7; padding:6px 8px; border-radius:6px; font-size:12px; margin-top:6px;">INATIVO — oculto no catálogo, indisponível para compra.</p>' : ''}</td>
          <td>\${p.categoria || p.category || ''}</td>
          <td>R$ \${Number(p.valor_num || p.price || 0).toFixed(2).replace('.', ',')}</td>
          <td><strong style="color:#15803d;">\${p.stockQuantity ?? p.estoque ?? 0}</strong> \${getAdminProductSaleUnit(p) === 'KG' ? 'kg' : 'un.'}</td>
          <td>
            <button class="action-btn btn-blue" style="padding:4px 8px;" onclick="editProduct('\${p.id}')">✏️ Editar</button>
            <button class="action-btn btn-red" style="padding:4px 8px;" onclick="deleteProduct('\${p.id}')">🗑️ Excluir</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function slugifyClient(text) {
      if (!text) return 'produto';
      return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produto';
    }

    let pendingPhotosList = [];

    function renderPendingPhotosGrid() {
      const box = document.getElementById('formProdPhotoPreviewBox');
      const grid = document.getElementById('formProdPhotosGrid');
      const countSpan = document.getElementById('formProdPhotoCount');
      const base64Input = document.getElementById('formProdPhotoBase64');
      if (!box || !grid) return;

      if (pendingPhotosList.length === 0) {
        box.style.display = 'none';
        if (base64Input) base64Input.value = '';
        return;
      }

      box.style.display = 'block';
      if (countSpan) countSpan.textContent = pendingPhotosList.length;
      if (base64Input) base64Input.value = pendingPhotosList[0]?.dataUrl || '';

      grid.innerHTML = '';
      pendingPhotosList.forEach((item, index) => {
        const card = document.createElement('div');
        const isPrimary = index === 0;
        card.style.cssText = 'position:relative; background:#ffffff; border:1px solid ' + (isPrimary ? '#22c55e' : '#cbd5e1') + '; border-radius:8px; padding:6px; display:flex; flex-direction:column; align-items:center; gap:4px; box-shadow:0 1px 3px rgba(0,0,0,0.05);';

        const imgSrc = item.previewUrl || item.dataUrl || item.url || '';
        const badge = isPrimary
          ? '<span style="position:absolute; top:4px; left:4px; background:#16a34a; color:white; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:10px;">⭐ Capa</span>'
          : '<span style="position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.6); color:white; font-size:10px; padding:1px 5px; border-radius:10px;">#' + (index + 1) + '</span>';

        const label = item.fileName || ('Foto ' + (index + 1));
        const capaBtn = !isPrimary
          ? '<button type="button" onclick="setPrimaryPendingPhoto(' + index + ')" title="Definir como foto principal" style="font-size:10px; padding:2px 6px; border:1px solid #cbd5e1; border-radius:4px; background:#f8fafc; cursor:pointer;">⭐ Capa</button>'
          : '';

        card.innerHTML =
          '<div style="position:relative; width:100%; height:80px; border-radius:6px; overflow:hidden; background:#f1f5f9;">' +
            '<img src="' + imgSrc + '" style="width:100%; height:100%; object-fit:cover;" alt="Foto" />' +
            badge +
          '</div>' +
          '<div style="font-size:10px; font-weight:bold; color:#334155; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:center;" title="' + label + '">' +
            label +
          '</div>' +
          '<div style="display:flex; gap:4px; width:100%; justify-content:center; margin-top:2px;">' +
            capaBtn +
            '<button type="button" onclick="removePendingPhoto(' + index + ')" title="Remover esta foto" style="font-size:10px; padding:2px 6px; border:1px solid #fecaca; border-radius:4px; background:#fef2f2; color:#dc2626; cursor:pointer;">🗑️</button>' +
          '</div>';

        grid.appendChild(card);
      });
    }

    function setPrimaryPendingPhoto(index) {
      if (index <= 0 || index >= pendingPhotosList.length) return;
      const [photo] = pendingPhotosList.splice(index, 1);
      pendingPhotosList.unshift(photo);
      renderPendingPhotosGrid();
    }

    function removePendingPhoto(index) {
      if (index < 0 || index >= pendingPhotosList.length) return;
      const [removedPhoto] = pendingPhotosList.splice(index, 1);
      if (removedPhoto.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(removedPhoto.previewUrl);
      renderPendingPhotosGrid();
    }

    function clearAllPendingPhotos() {
      pendingPhotosList.forEach((photo) => {
        if (photo.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl);
      });
      pendingPhotosList = [];
      for (const inputId of ['formProdPhotoFile', 'formProdCameraFile']) {
        const fileInput = document.getElementById(inputId);
        if (fileInput) fileInput.value = '';
      }
      renderPendingPhotosGrid();
    }

    function handleProdPhotoFileSelect(event) {
      const files = Array.from(event.target.files || []);
      if (!files || files.length === 0) return;
      event.target.value = '';

      const name = document.getElementById('formProdName').value || 'produto';
      const id = document.getElementById('formProdId').value || 'novo';
      const oversizedFile = files.find((file) => file.size > 20 * 1024 * 1024);
      if (oversizedFile) {
        alert('Cada foto deve ter até 20 MB. A imagem original será otimizada no servidor.');
        return;
      }
      const tagsInput = document.getElementById('formProdTags');
      if (!tagsInput.value) {
        const cat = document.getElementById('formProdCat').value;
        const sub = document.getElementById('formProdSubcat').value;
        const autoTags = [name.toLowerCase(), cat.toLowerCase(), sub.toLowerCase()].filter(Boolean).join(', ');
        tagsInput.value = autoTags;
        const tagsBox = document.getElementById('formProdPhotoTags');
        if (tagsBox) tagsBox.textContent = '🏷️ Tags Conflora: ' + autoTags;
      }

      files.forEach((file) => {
        const upload = {
          file,
          previewUrl: URL.createObjectURL(file),
          fileName: slugifyClient(name) + '_' + id + '_' + (pendingPhotosList.length + 1) + '.jpg',
          isExisting: false,
        };
        pendingPhotosList.push(upload);
      });
    }

    let productUnitTouched = false;

    function syncProductStockStep() {
      const unit = document.getElementById('formProdUnit')?.value || 'UN';
      const stock = document.getElementById('formProdStock');
      if (!stock) return;
      stock.step = unit === 'KG' ? '0.001' : '1';
      stock.inputMode = unit === 'KG' ? 'decimal' : 'numeric';
    }

    function markProductUnitChoice() {
      productUnitTouched = true;
      syncProductStockStep();
    }

    function suggestProductSaleUnit() {
      if (document.getElementById('formProdId').value) return;
      const category = String(document.getElementById('formProdCat').value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (!productUnitTouched) document.getElementById('formProdUnit').value = category.includes('hortifrutt') ? 'KG' : 'UN';
      syncProductStockStep();
    }

    function editProduct(id) {
      const p = allProducts.find(x => String(x.id) === String(id));
      if (!p) return;
      showTab('products');
      document.getElementById('formProdId').value = p.id;
      document.getElementById('formProdName').value = p.descricao || p.name;
      document.getElementById('formProdCat').value = p.categoria || p.category;
      document.getElementById('formProdSubcat').value = p.subcategoria || p.subcategory || '';
      document.getElementById('formProdPrice').value = Number(p.valor_num || p.price || 0);
      document.getElementById('formProdStock').value = p.stockQuantity ?? p.estoque ?? 0;
      document.getElementById('formProdUnit').value = getAdminProductSaleUnit(p);
      productUnitTouched = true;
      syncProductStockStep();
      document.getElementById('formProdStatus').value = productIsInactive(p) ? 'INATIVO' : 'ATIVO';
      document.getElementById('formProdImages').value = '';
      document.getElementById('formProdTags').value = p.tagsAi || p.tags_ia || '';
      document.getElementById('formProdDesc').value = p.descriptionAi || p.descricao_ia || '';
      document.getElementById('formProdPhotoBase64').value = '';

      // Carrega fotos existentes do produto no gerenciador de fotos
      pendingPhotosList = [];
      const existingImgs = (Array.isArray(p.images) && p.images.length > 0)
        ? p.images.filter(Boolean)
        : (p.imageUrl || p.imageurl ? [p.imageUrl || p.imageurl] : []);

      existingImgs.filter(isStoredProductImageUrl).forEach((url, i) => {
        pendingPhotosList.push({
          url,
          dataUrl: url,
          fileName: (p.imageFileId || slugifyClient(p.descricao || p.name)) + (i > 0 ? '_' + i : '') + '.jpg',
          isExisting: true,
        });
      });
      renderPendingPhotosGrid();

      document.getElementById('productFormTitle').textContent = 'Editar Produto #' + p.id;
      document.getElementById('productEditorDialog').showModal();
    }

    function openNewProductDialog() {
      showTab('products');
      resetProdForm();
      document.getElementById('productFormTitle').textContent = 'Novo produto no catálogo';
      document.getElementById('productEditorDialog').showModal();
      document.getElementById('formProdName').focus();
    }

    function closeProductEditorDialog() {
      const dialog = document.getElementById('productEditorDialog');
      if (dialog?.open) dialog.close();
      resetProdForm();
    }

    function resetProdForm() {
      document.getElementById('prodForm').reset();
      document.getElementById('formProdId').value = '';
      document.getElementById('formProdUnit').value = 'UN';
      productUnitTouched = false;
      syncProductStockStep();
      document.getElementById('formProdPhotoBase64').value = '';
      document.getElementById('formProdTags').value = '';
      clearAllPendingPhotos();
      document.getElementById('productFormTitle').textContent = 'Novo Produto no Catálogo';
    }

    async function deleteProduct(id) {
      if (!confirm('Deseja excluir este produto e suas fotos?')) return;
      const response = await fetch('/api/admin/products/' + id, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) {
        alert('Não foi possível excluir o produto: ' + (result.error || 'Falha ao remover o produto.'));
        return;
      }
      loadAdminProducts();
    }

    async function handleProductSubmit(e) {
      e.preventDefault();
      const id = document.getElementById('formProdId').value || ('prod-' + Date.now());
      const name = document.getElementById('formProdName').value;
      const cat = document.getElementById('formProdCat').value;
      const sub = document.getElementById('formProdSubcat').value;
      const price = parseFloat(document.getElementById('formProdPrice').value);
      const stock = parseFloat(document.getElementById('formProdStock').value);
      const externalImgs = document.getElementById('formProdImages').value.split(',').map(s => s.trim()).filter(Boolean);
      const tags = document.getElementById('formProdTags').value;
      const desc = document.getElementById('formProdDesc').value;

      const newUploads = pendingPhotosList.filter(p => p.file && !p.isExisting);
      const existingUrls = pendingPhotosList.filter(p => p.isExisting && p.url).map(p => p.url);
      const combinedImgs = [...existingUrls, ...externalImgs];
      const savedProduct = allProducts.find(product => String(product.id) === String(id));
      const storedImages = Array.isArray(savedProduct?.images) && savedProduct.images.length
        ? savedProduct.images
        : (savedProduct?.imageUrl ? [savedProduct.imageUrl] : []);
      const imagesForInitialSave = newUploads.length
        ? [...new Set([...storedImages, ...externalImgs])]
        : combinedImgs;

      const payload = {
        id,
        name,
        category: cat,
        subcategory: sub,
        unit: document.getElementById('formProdUnit') ? document.getElementById('formProdUnit').value : 'UN',
        price,
        stockQuantity: stock,
        status: document.getElementById('formProdStatus').value,
        images: imagesForInitialSave,
        imageUrl: imagesForInitialSave[0] || '',
        tagsAi: tags,
        tags_ia: tags,
        descriptionAi: desc,
      };

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        document.getElementById('formProdId').value = id;
        try {
          for (const upload of newUploads) {
            const photoResponse = await fetch('/api/admin/products/' + encodeURIComponent(id) + '/photo', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/octet-stream',
                'X-Photo-Content-Type': upload.file.type || 'image/jpeg',
                'X-Photo-Append': 'true',
                'X-Product-Name': name,
              },
              body: upload.file,
            });
            const photoResult = await photoResponse.json();
            if (!photoResponse.ok || !photoResult.success) {
              throw new Error(photoResult.error || 'Não foi possível enviar uma das fotos.');
            }
            if (upload.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(upload.previewUrl);
            upload.url = photoResult.photos?.[0]?.url || photoResult.photo?.url || '';
            upload.previewUrl = upload.url;
            upload.dataUrl = upload.url;
            upload.file = null;
            upload.isExisting = Boolean(upload.url);
          }

          const finalImages = [...new Set([
            ...pendingPhotosList.filter(photo => photo.isExisting && photo.url).map(photo => photo.url),
            ...externalImgs,
          ])];
          const finalResponse = await fetch('/api/admin/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...payload,
              images: finalImages,
              imageUrl: finalImages[0] || '',
            }),
          });
          const finalResult = await finalResponse.json();
          if (!finalResponse.ok || !finalResult.success) {
            throw new Error(finalResult.error || 'Não foi possível concluir a substituição das fotos.');
          }
        } catch (error) {
          renderPendingPhotosGrid();
          loadAdminProducts();
          alert('Produto salvo, mas não foi possível concluir o ciclo das fotos: ' + error.message + '. Tente novamente.');
          return;
        }
        alert('✅ Produto salvo e fotos enviadas ao Firebase Storage em alta qualidade para zoom!');
        document.getElementById('productEditorDialog').close();
        resetProdForm();
        loadAdminProducts();
        loadPriceProducts();
      } else {
        alert('Erro ao salvar no Firestore: ' + (data.error || 'Falha'));
      }
    }

    // 11. HISTÓRICO GERAL DE PEDIDOS
    async function loadAllOrders() {
      const container = document.getElementById('allOrdersListContainer');
      try {
        const res = await fetch('/api/admin/orders');
        const orders = await res.json();
        container.innerHTML = '';
        if (orders.length === 0) {
          container.innerHTML = '<div style="color:#64748b; padding:20px;">Nenhum pedido registrado.</div>';
          return;
        }

        orders.forEach(o => {
          const div = document.createElement('div');
          div.style.cssText = 'border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;';
          const itemsTxt = (o.items || []).map(i => i.name + ' (' + (i.quantity || 1) + 'x)').join(', ');
          div.innerHTML = \`
            <div>
              <strong>#\${(o.id || '').slice(-6)} — \${o.customerName || 'Cliente'}</strong> (\${o.customerPhone || 'Presencial'})<br>
              <span style="font-size:12px; color:#64748b;">Itens: \${itemsTxt}</span><br>
              <span style="font-size:12px; color:#64748b;">\${o.deliveryAddress || 'Retirada'} • \${o.paymentMethod || 'PIX'} • \${new Date(o.createdAt).toLocaleString()}</span>
            </div>
            <div style="text-align:right;">
              <span class="badge \${o.status === 'CONFIRMED' ? 'badge-confirmed' : (o.status === 'DELIVERED' ? 'badge-delivered' : 'badge-pending')}">\${o.status}</span>
              <div style="font-weight:bold; color:#15803d; font-size:15px; margin-top:4px;">R$ \${Number(o.total || 0).toFixed(2).replace('.', ',')}</div>
            </div>
          \`;
          container.appendChild(div);
        });
      } catch (err) {
        container.innerHTML = 'Erro ao carregar histórico: ' + err.message;
      }
    }

    // 12. VENDA MANUAL NO BALCÃO
    async function openManualOrderModal() {
      if (!allProducts.length) {
        try {
          const response = await fetch('/api/inventory');
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Não foi possível carregar os produtos.');
          allProducts = safeExtractProductsAdmin(data);
        } catch (error) {
          alert(error.message || 'Não foi possível carregar os produtos para a venda.');
          return;
        }
      }
      const select = document.getElementById('mProdSelect');
      select.innerHTML = '';
      allProducts.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = (p.descricao || p.name) + ' — R$ ' + Number(p.valor_num || p.price || 0).toFixed(2);
        select.appendChild(opt);
      });
      if (!allProducts.length) {
        alert('Não há produtos disponíveis para registrar a venda.');
        return;
      }
      document.getElementById('manualOrderModal').classList.add('open');
    }

    function closeManualOrderModal() {
      document.getElementById('manualOrderModal').classList.remove('open');
    }

    async function submitManualOrder(e) {
      e.preventDefault();
      const name = document.getElementById('mCustName').value;
      const phone = document.getElementById('mCustPhone').value;
      const prodId = document.getElementById('mProdSelect').value;
      const qty = parseInt(document.getElementById('mQty').value, 10);
      const pay = document.getElementById('mPayMethod').value;

      const p = allProducts.find(x => String(x.id) === String(prodId));
      if (!p) return;

      const items = [{ productId: p.id, name: p.descricao || p.name, price: Number(p.valor_num || p.price || 0), quantity: qty }];

      try {
        const response = await fetch('/api/admin/orders/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerName: name, customerPhone: phone, items, paymentMethod: pay })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Não foi possível registrar a venda.');

        if (result.order?.paymentCheckoutUrl) {
          const paymentWindow = window.open(result.order.paymentCheckoutUrl, '_blank', 'noopener,noreferrer');
          if (!paymentWindow) {
            window.prompt('Copie o link seguro do pagamento Pix:', result.order.paymentCheckoutUrl);
          }
          const receiptWarning = result.receiptDelivery?.sent === false
            ? ' Aviso: ' + result.receiptDelivery.reason
            : '';
          alert('Venda registrada. Aguardando aprovação do Pix pelo Mercado Pago.' + receiptWarning);
        } else {
          alert('Venda registrada com sucesso no caixa!');
        }
        closeManualOrderModal();
        loadCashierDaily();
      } catch (error) {
        alert(error.message || 'Não foi possível registrar a venda.');
      }
    }

    async function seedDefaultConflora() {
      if (!confirm('Deseja restaurar o catálogo oficial da Conflora Horta e Viveiro no Firestore?')) return;
      const res = await fetch('/api/admin/seed-catalog', { method: 'POST' });
      const d = await res.json();
      if (d.success) {
        alert('Catálogo completo sincronizado no Firestore com sucesso!');
        loadAdminProducts();
        loadCashierDaily();
      }
    }

    // INICIALIZAÇÃO
    applyUserRoleUI();
    document.getElementById('adminSalesFilter')?.addEventListener('change', loadCashierDaily);
  </script>
${renderFirebaseAuthScript()}
</body>
</html>`;
}

module.exports = {
  renderAdminHtml,
};
