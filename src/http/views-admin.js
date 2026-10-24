require('../i18n/default');
const { renderFirebaseAuthScript } = require('./firebase-client');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

// Keep the admin markup, shared card and its styles on the same release,
// even when an older storefront worker controls this tab.
const productAssetsVersion = createHash('sha256')
  .update(readFileSync(resolve(__dirname, '../../public/storefront/design-system.css')))
  .update(readFileSync(resolve(__dirname, '../../public/storefront/admin-shell-v1.css')))
  .update(readFileSync(resolve(__dirname, '../../public/storefront/site-header.css')))
  .update(readFileSync(resolve(__dirname, '../../public/storefront/topbar.js')))
  .update(readFileSync(resolve(__dirname, '../../public/storefront/site-navigation.js')))
  .update(readFileSync(resolve(__dirname, '../../public/storefront/product-card.js')))
  .update(readFileSync(resolve(__dirname, '../../public/storefront/stock-counting.js')))
  .update(readFileSync(resolve(__dirname, '../../public/storefront/cashier-report-actions.js')))
  .digest('hex').slice(0, 12);



function renderAdminHtml(storeConfig) {
  const escape = value => String(value || '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
  const name = escape(storeConfig?.identity.name || 'administration'.tr);
  const colors = storeConfig?.branding.colors || {};
  const color = (key, fallback) => /^#[0-9a-f]{6}$/i.test(colors[key]) ? colors[key] : fallback;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<script src="/store-assets/i18n-runtime.js"></script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name} — Administração</title>
  <script src="/store-assets/tab-session.js"></script>
    <link rel="stylesheet" href="/store-assets/order-display.css" />
    <script src="/store-assets/order-display.js"></script>

  <link rel="stylesheet" href="/store-assets/admin-shell-v1.css?v=${productAssetsVersion}">
  <link rel="stylesheet" href="/store-assets/site-header.css?v=${productAssetsVersion}">
  <script src="/store-assets/site-navigation.js?v=1"></script>
  <script src="/store-assets/error-history.js" defer></script>
  <script src="/store-assets/product-import.js" defer></script>
  <script src="/store-assets/error-monitor.js"></script>
  <script src="/store-assets/topbar.js?v=${productAssetsVersion}"></script>
  <script src="/store-assets/button-3d.js?v=${productAssetsVersion}"></script>
  <link rel="stylesheet" href="/store-assets/design-system.css?v=${productAssetsVersion}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>:root { --primary: ${color('primary','#2e9348')}; --primary-dark: ${color('primary','#2e9348')}; --accent: ${color('accent','#f5c518')}; --bg: ${color('background','#f8f9fa')}; } body { color: ${color('text','#1a1a1a')}; }</style>
  <style>
    .header-actions { flex-wrap: wrap; justify-content: flex-end; }
    button, .header-btn { transition: transform .18s ease, box-shadow .18s ease, filter .18s ease, background-color .18s ease; }
    button:hover, .header-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15, 23, 42, .12); }
    button:focus-visible, .header-btn:focus-visible { outline: 3px solid rgba(46, 147, 72, .28); outline-offset: 2px; }
    button:disabled, .header-btn:disabled { transform: none; box-shadow: none; cursor: not-allowed; }
    .admin-cashier-link { background: var(--accent); color: #111827; border-color: #eab308; font-weight: 800; }
    .admin-section-heading { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:16px; }
    .stock-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
    .stock-toolbar-actions { display:flex; gap:8px; flex-wrap:wrap; }
    .stock-search { width:min(100%, 420px); padding:11px 14px; border:1px solid var(--border); border-radius:12px; font:inherit; }
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
    .admin-product-dialog { margin:auto; width:min(980px, calc(100vw - 32px)); max-width:none; max-height:calc(100dvh - 32px); padding:0; border:1px solid #dbe6dd; border-radius:22px; overflow:auto; background:#fff; color:#17251a; box-shadow:0 24px 80px rgba(15,23,42,.28); }
    .admin-product-dialog::backdrop { background:rgba(15,23,42,.48); backdrop-filter:blur(3px); }
    .admin-product-dialog__surface { padding:24px; }
    .admin-product-dialog__header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; margin-bottom:18px; }
    .admin-product-dialog__header h2 { margin:0 0 6px; }
    .admin-product-dialog__header p { margin:0; color:#64748b; font-size:13px; }
    .admin-product-dialog__close { width:42px; height:42px; flex:none; border-radius:50%; font-size:24px; line-height:1; background:#fff; }
    .admin-product-dialog .product-form { box-shadow:none; }
    @media (max-width:700px) { .admin-product-dialog__surface { padding:18px 14px; } .admin-product-dialog .product-form { padding:14px; } }
    @media (max-width:700px) { .tab-content { padding:18px 14px; } .header-actions { justify-content:flex-start; } .stock-toolbar-actions { width:100%; } .stock-toolbar-actions button { flex:1; } }

    /* ESTILOS DE CONFERÊNCIA E FECHAMENTO DO CAIXA */
    .cashier-conference-box {
      margin-top: 14px;
      margin-bottom: 20px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      background: #fafcfb;
    }
    .cashier-conf-header {
      display: grid;
      grid-template-columns: 2fr 1.2fr 1.5fr 1.2fr;
      padding: 12px 16px;
      background: #f1f5f2;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #526356;
      border-bottom: 1px solid #e2e8f0;
    }
    .cashier-conf-row {
      display: grid;
      grid-template-columns: 2fr 1.2fr 1.5fr 1.2fr;
      padding: 12px 16px;
      align-items: center;
      border-bottom: 1px solid #eef2ef;
      background: #ffffff;
      font-size: 13px;
    }
    .cashier-conf-row:nth-child(even) { background: #fcfdfc; }
    .cashier-conf-total {
      display: grid;
      grid-template-columns: 2fr 1.2fr 1.5fr 1.2fr;
      padding: 14px 16px;
      align-items: center;
      background: #eaf3ed;
      border-top: 2px solid #cbdcd0;
      font-weight: 800;
      font-size: 14px;
    }
    .conf-col-method {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .conf-method-icon {
      font-size: 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: #edf5ef;
    }
    .conf-input-wrapper {
      display: flex;
      align-items: center;
      background: #fff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 4px 8px;
      width: 100%;
      max-width: 190px;
      transition: all 0.15s ease;
    }
    .conf-input-wrapper:focus-within {
      border-color: #2e9348;
      box-shadow: 0 0 0 2px rgba(46, 147, 72, 0.15);
    }
    .conf-input-wrapper span {
      font-size: 12px;
      font-weight: 700;
      color: #64748b;
      margin-right: 4px;
    }
    .conf-input-wrapper input {
      border: none;
      outline: none;
      width: 100%;
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      background: transparent;
    }
    .conf-diff-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .conf-diff-badge.exact { background: #dcfce7; color: #15803d; }
    .conf-diff-badge.surplus { background: #fef9c3; color: #854d0e; }
    .conf-diff-badge.shortage { background: #fee2e2; color: #991b1b; }
    .conf-badge-open {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .conf-badge-closed {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .cashier-closing-extras {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 16px;
      padding: 16px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
    }
    @media(max-width: 800px) {
      .cashier-conf-header, .cashier-conf-row, .cashier-conf-total {
        grid-template-columns: 1fr;
        gap: 6px;
      }
      .cashier-closing-extras { grid-template-columns: 1fr; }
    }
  </style>

</head>
<body>
  <conflora-topbar context="admin" managed local-search></conflora-topbar>
  <div class="container">
    <nav class="cf-work-actions" aria-label="Opções administrativas">
      <button type="button" class="cf-back-button" data-site-back>← Voltar</button>
      <span id="adminPageLabel">Administração</span>
      <span id="ownerProfileSwitcherWrap" style="display:none; align-items:center; gap:6px; background:#fefce8; border:1px solid #fde047; padding:3px 8px; border-radius:8px;">
        <span style="font-size:11px; font-weight:800; color:#854d0e;">👑 Perfil Teste:</span>
        <select id="ownerProfileSelect" onchange="switchOwnerProfile(this.value)" style="background:#fff; color:#1e293b; border:1px solid #cbd5e1; border-radius:6px; padding:3px 6px; font-size:11px; font-weight:700; cursor:pointer;">
          <option value="ADMIN">ADMIN (Total)</option>
          <option value="CAIXA">CAIXA (PDV)</option>
          <option value="VENDEDOR">VENDEDOR (Comandas/Pix)</option>
          <option value="ENTREGADOR">ENTREGADOR (Entregas)</option>
        </select>
      </span>
      <button class="header-btn" onclick="openLoginModal()">Trocar operador</button>
      <button class="header-btn cf-notification-button" onclick="showTab('notifs')" aria-label="Notificações" title="Notificações não lidas"><svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span id="notifBadge">0</span></button>
      <button class="cf-danger-button" onclick="logoutAdmin()">Sair</button>
    </nav>

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

      <cashier-report-actions id="adminCashierReport"></cashier-report-actions>
      
      <!-- STAT CARDS DAS FORMAS DE PAGAMENTO (PADRÃO RESULTADOS DA LOJA) -->
      <div class="stat-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px;">
        <div class="stat-card">
          <div class="stat-label">💵 Dinheiro em Caixa</div>
          <div class="stat-val" id="cashierCashToday" style="color:#d97706;">R$ 0,00</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">Vendas balcão</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">⚡ PIX Recebido</div>
          <div class="stat-val" id="cashierPixToday" style="color:#15803d;">R$ 0,00</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">Sicredi / manual</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">💳 Cartão de Crédito</div>
          <div class="stat-val" id="cashierCreditToday" style="color:#0284c7;">R$ 0,00</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">Maquininha</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">💳 Cartão de Débito</div>
          <div class="stat-val" id="cashierDebitToday" style="color:#0369a1;">R$ 0,00</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">Maquininha</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">📝 Fiado (A Receber)</div>
          <div class="stat-val" id="cashierDebtToday" style="color:#dc2626;">R$ 0,00</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">A prazo</div>
        </div>
        <div class="stat-card" style="background:#f0fdf4; border-color:#bbf7d0;">
          <div class="stat-label" style="color:#166534; font-weight:700;">💰 Total de Vendas Hoje</div>
          <div class="stat-val" id="cashierTotalToday" style="color:#15803d;">R$ 0,00</div>
          <div id="cashierOrdersCountToday" style="font-size:11px; color:#15803d; margin-top:2px;">0 vendas realizadas</div>
        </div>
      </div>

      <!-- PAINEL DE CONFERÊNCIA E FECHAMENTO DO CAIXA -->
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:16px; padding:20px; margin-bottom:24px; box-shadow:0 1px 4px rgba(0,0,0,0.04);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <h3 style="margin:0; font-size:16px; font-weight:800; color:#0f381e;">🔒 Conferência e Fechamento do Caixa</h3>
              <span id="cashierClosingBadge" class="conf-badge-open">Caixa Aberto (Em Conferência)</span>
            </div>
            <p style="margin:4px 0 0; font-size:12px; color:#64748b;">Digite o valor que você conferiu em mãos ou no relatório da maquininha para fechar o caixa.</p>
          </div>
          <button type="button" class="action-btn btn-gray" onclick="fillCountedFromSystem()" style="font-size:12px; padding:6px 12px;">
            ✨ Preencher conferido com valores do sistema
          </button>
        </div>

        <div class="cashier-conference-box">
          <div class="cashier-conf-header">
            <div>Forma de Pagamento</div>
            <div>Apurado Sistema</div>
            <div>Valor Conferido</div>
            <div>Diferença</div>
          </div>

          <!-- DINHEIRO -->
          <div class="cashier-conf-row">
            <div class="conf-col-method">
              <span class="conf-method-icon">💵</span>
              <div>
                <strong>Dinheiro em Caixa</strong>
                <div style="font-size:11px; color:#64748b;">Notas e moedas na gaveta</div>
              </div>
            </div>
            <div id="rowSysCash" style="font-weight:700; color:#334155;">R$ 0,00</div>
            <div>
              <div class="conf-input-wrapper">
                <span>R$</span>
                <input type="number" step="0.01" min="0" id="inputCountedCash" placeholder="0,00" oninput="calculateCashierDiffs()" />
              </div>
            </div>
            <div id="diffTagCash"><span class="conf-diff-badge exact">R$ 0,00 (Exato)</span></div>
          </div>

          <!-- PIX -->
          <div class="cashier-conf-row">
            <div class="conf-col-method">
              <span class="conf-method-icon">⚡</span>
              <div>
                <strong>PIX Recebido</strong>
                <div style="font-size:11px; color:#64748b;">Extrato bancário Sicredi</div>
              </div>
            </div>
            <div id="rowSysPix" style="font-weight:700; color:#334155;">R$ 0,00</div>
            <div>
              <div class="conf-input-wrapper">
                <span>R$</span>
                <input type="number" step="0.01" min="0" id="inputCountedPix" placeholder="0,00" oninput="calculateCashierDiffs()" />
              </div>
            </div>
            <div id="diffTagPix"><span class="conf-diff-badge exact">R$ 0,00 (Exato)</span></div>
          </div>

          <!-- CARTÃO CRÉDITO -->
          <div class="cashier-conf-row">
            <div class="conf-col-method">
              <span class="conf-method-icon">💳</span>
              <div>
                <strong>Cartão de Crédito</strong>
                <div style="font-size:11px; color:#64748b;">Relatório da maquininha</div>
              </div>
            </div>
            <div id="rowSysCredit" style="font-weight:700; color:#334155;">R$ 0,00</div>
            <div>
              <div class="conf-input-wrapper">
                <span>R$</span>
                <input type="number" step="0.01" min="0" id="inputCountedCredit" placeholder="0,00" oninput="calculateCashierDiffs()" />
              </div>
            </div>
            <div id="diffTagCredit"><span class="conf-diff-badge exact">R$ 0,00 (Exato)</span></div>
          </div>

          <!-- CARTÃO DÉBITO -->
          <div class="cashier-conf-row">
            <div class="conf-col-method">
              <span class="conf-method-icon">💳</span>
              <div>
                <strong>Cartão de Débito</strong>
                <div style="font-size:11px; color:#64748b;">Relatório da maquininha</div>
              </div>
            </div>
            <div id="rowSysDebit" style="font-weight:700; color:#334155;">R$ 0,00</div>
            <div>
              <div class="conf-input-wrapper">
                <span>R$</span>
                <input type="number" step="0.01" min="0" id="inputCountedDebit" placeholder="0,00" oninput="calculateCashierDiffs()" />
              </div>
            </div>
            <div id="diffTagDebit"><span class="conf-diff-badge exact">R$ 0,00 (Exato)</span></div>
          </div>

          <!-- FIADO -->
          <div class="cashier-conf-row">
            <div class="conf-col-method">
              <span class="conf-method-icon">📝</span>
              <div>
                <strong>Fiado (A Receber)</strong>
                <div style="font-size:11px; color:#64748b;">Vendas a prazo registradas</div>
              </div>
            </div>
            <div id="rowSysDebt" style="font-weight:700; color:#334155;">R$ 0,00</div>
            <div>
              <div class="conf-input-wrapper">
                <span>R$</span>
                <input type="number" step="0.01" min="0" id="inputCountedDebt" placeholder="0,00" oninput="calculateCashierDiffs()" />
              </div>
            </div>
            <div id="diffTagDebt"><span class="conf-diff-badge exact">R$ 0,00 (Exato)</span></div>
          </div>

          <!-- TOTAL GERAL -->
          <div class="cashier-conf-total">
            <div class="conf-col-method">
              <span class="conf-method-icon" style="background:#dcfce7; color:#15803d;">💰</span>
              <div>TOTAL GERAL</div>
            </div>
            <div id="rowSysTotal" style="color:#15803d;">R$ 0,00</div>
            <div id="rowCountedTotal" style="color:#0f172a;">R$ 0,00</div>
            <div id="diffTagTotal"><span class="conf-diff-badge exact">R$ 0,00 (Exato)</span></div>
          </div>
        </div>

        <!-- EXTRAS: COMPROVANTE DA MAQUININHA + OBSERVAÇÕES -->
        <div class="cashier-closing-extras">
          <div>
            <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:6px;">
              📸 Comprovante da Maquininha (Foto do Fechamento)
            </label>
            <div id="receiptUploadWrapper">
              <div style="border:2px dashed #cbd5e1; border-radius:10px; padding:16px; text-align:center; background:#f8fafc; cursor:pointer;" onclick="document.getElementById('machineReceiptInput').click()">
                <div style="font-size:24px; margin-bottom:4px;">📷</div>
                <div style="font-size:13px; font-weight:700; color:#0f381e;">Tirar foto ou anexar comprovante</div>
                <div style="font-size:11px; color:#64748b; margin-top:2px;">Relatório impresso da maquininha</div>
              </div>
              <input type="file" id="machineReceiptInput" accept="image/*" capture="environment" style="display:none;" onchange="handleReceiptPhotoSelected(event)" />
            </div>
            <div id="receiptPreviewBox" style="display:none; align-items:center; gap:12px; margin-top:10px; padding:8px; border:1px solid #e2e8f0; border-radius:8px; background:#f8fafc;">
              <img id="receiptPreviewImg" src="" alt="Comprovante" style="width:60px; height:60px; object-fit:cover; border-radius:6px; border:1px solid #cbd5e1;" />
              <div style="flex:1; min-width:0;">
                <div style="font-size:12px; font-weight:700; color:#15803d;">✅ Foto anexada</div>
                <div id="receiptFileName" style="font-size:11px; color:#64748b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"></div>
              </div>
              <button type="button" class="action-btn btn-gray" style="padding:4px 8px; font-size:11px;" onclick="removeReceiptPhoto()">Remover</button>
            </div>
          </div>

          <div>
            <label style="display:block; font-size:12px; font-weight:700; color:#334155; margin-bottom:6px;">
              📝 Observações do Fechamento (Opcional)
            </label>
            <textarea id="cashierClosingNotes" placeholder="Ex: Faltou R$ 2,00 por troco arredondado, cliente X pagou PIX direto..." style="width:100%; height:82px; border:1px solid #cbd5e1; border-radius:8px; padding:8px 10px; font-size:12px; resize:vertical; font-family:inherit;"></textarea>
          </div>
        </div>

        <!-- BOTÕES DE AÇÃO DO FECHAMENTO -->
        <div style="display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap; margin-top:16px;">
          <button type="button" class="action-btn btn-green" id="btnSubmitCloseCash" onclick="submitCashierClosing()" style="min-height:44px; padding:10px 20px; font-size:13px;">
            🔒 Registrar Fechamento do Caixa
          </button>
        </div>
      </div>

      <!-- AUDITORIA DE VENDAS DO DIA COM BUSCA RÁPIDA -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0; font-size:15px; font-weight:800; color:#0f381e;">Lista de Vendas Realizadas Hoje</h3>
        <div style="position:relative; width:min(100%, 320px);">
          <input type="search" id="cashierOrderSearch" placeholder="Filtrar por cliente, pedido, forma..." 
            style="width:100%; height:36px; padding:6px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:12px; outline:none;" 
            oninput="filterTodayOrdersTable(this.value)" />
        </div>
      </div>

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
        <div><h2>Entrada e conferência de estoque</h2><p class="muted">Busque o produto, digite a quantidade real e conclua a conferência. Também pode contar com toques.</p></div>
      </div>
      <section id="stockControlBanner" class="stock-control-banner" aria-label="Controle de estoque">
        <div><strong>Controle de estoque nas vendas</strong><p id="stockControlHelp" role="status"></p></div>
        <button type="button" id="stockControlToggle" class="action-btn" aria-pressed="false" onclick="toggleStockControl()" disabled>Carregando controle…</button>
      </section>
      <div class="stock-toolbar">
        <input type="search" id="stockSearchInput" class="stock-search" aria-label="Buscar produto no estoque" placeholder="1. Busque o produto pelo nome ou categoria…" oninput="filterStockCards()" />
        <span id="stockProductsCount" class="muted" role="status"></span>
      </div>
      <div class="stock-count-toolbar" role="group" aria-label="Tipo de contagem">
        <button type="button" id="stockModeEntry" class="action-btn btn-green" aria-pressed="true" onclick="StockCounting.setMode('ENTRY')">＋ Receber produtos</button>
        <button type="button" id="stockModeCount" class="action-btn btn-gray" aria-pressed="false" onclick="StockCounting.setMode('SET')">✓ Conferir o que tenho</button>
        <button type="button" class="action-btn btn-green" onclick="StockCounting.createProduct()">＋ Cadastrar produto</button>
      </div>
      <p id="stockCountingHelp" class="stock-count-help"></p>
      <div class="stock-count-summary">
        <strong id="stockDraftSummary">Nenhum produto contado</strong>
        <button type="button" id="stockUndo" class="action-btn btn-gray" onclick="StockCounting.undo()" disabled>↶ Desfazer último toque</button>
        <button type="button" id="stockSave" class="action-btn btn-green" onclick="StockCounting.save()" disabled>Salvar entradas</button>
      </div>
      <p id="stockCountingStatus" role="status" aria-live="polite"></p>
      <div class="admin-products-grid" id="stockCardsGrid"></div>
      <details class="stock-extra-actions">
        <summary>Outros ajustes de estoque</summary>
        <div class="stock-toolbar-actions">
          <button type="button" class="action-btn btn-gray" onclick="openStockAdjustment('ENTRY')">Entrada por quantidade</button>
          <button type="button" class="action-btn btn-gray" onclick="openStockAdjustment('EXIT')">Baixa com justificativa</button>
        </div>
      </details>
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
      <button type="button" class="action-btn btn-green" onclick="window.ConfloraProductImport.open()">Importar planilha de produtos</button>
      <div class="admin-products-toolbar">
        <h2>Cadastro de produtos</h2>
        <button type="button" class="admin-add-product" onclick="openNewProductDialog()">＋ ADICIONAR PRODUTO</button>
      </div>
      <button type="button" class="action-btn btn-gray" onclick="showTab('price')">Abrir consulta e ajuste de preços</button>
      <dialog id="productEditorDialog" oncancel="event.preventDefault(); closeProductEditorDialog()" class="admin-product-dialog" aria-labelledby="productFormTitle">
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
          <div style="font-size:10px; color:#15803d; margin-top:2px;">⚡ <strong>Qualidade Máxima &amp; Zoom HD:</strong> Os arquivos originais são preservados no armazenamento. Clique na foto para ampliar; use as setas para ordenar. A primeira foto é a capa.</div>
          <div id="formProdPhotoPreviewBox" style="display:none; margin-top:8px; padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-size:12px; font-weight:bold; color:#14532d;">📸 Galeria de Fotos (<span id="formProdPhotoCount">0</span> foto(s)):</div>
              <button type="button" onclick="clearAllPendingPhotos()" style="font-size:11px; background:none; border:none; color:#ef4444; cursor:pointer; text-decoration:underline;">Limpar todas as fotos</button>
            </div>
            <label style="display:block; margin:8px 0; font-size:12px;"><input type="checkbox" id="formProdRealPhotoConfirmed" /> Confirmo que as fotos enviadas mostram os produtos reais da Conflora, sem imagens de banco, referência ou geradas.</label>
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
          <input type="text" id="formProdImages" placeholder="URLs HTTPS separadas por vírgula" />
          <label>Licença <select id="formProdMediaLicense"><option value="">Selecione</option><option value="CC0">CC0</option><option value="PUBLIC_DOMAIN">Domínio público</option><option value="CC_BY">CC BY</option><option value="PERMISSION">Permissão expressa</option></select></label>
          <label>Evidência / URL da licença <input type="url" id="formProdMediaLicenseUrl" /></label>
          <label>Crédito / atribuição <input type="text" id="formProdMediaAttribution" /></label>
          <label><input type="checkbox" id="formProdMediaConfirmed" /> Conferi a autorização de uso e que a imagem representa este produto e variedade.</label>
          <small>As imagens externas permanecem na origem; não são copiadas para o Storage. Referências antigas não são aprovadas automaticamente.</small>
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
          <button type="button" id="deleteEditingProduct" class="action-btn btn-red" hidden onclick="deleteProduct(document.getElementById('formProdId').value)">Excluir produto</button>
        </div>
      </form>
        </div>
      </dialog>

      <!-- BARRA DE CONTROLE DE BUSCA, ORDENAÇÃO E FILTROS DO CATÁLOGO ADMIN -->
      <div class="admin-catalog-controls" style="margin-top:24px; margin-bottom:16px; background:#ffffff; padding:16px 20px; border-radius:14px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.04);">
        <!-- Topo: Título, Contador e Status -->
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:14px;">
          <div>
            <h3 style="margin:0; font-size:18px; font-weight:700; color:#1e293b;">Produtos no Banco de Dados</h3>
            <p id="productStatusCount" role="status" style="margin:4px 0 0; font-size:13px; color:#64748b; font-weight:500;"></p>
          </div>
          <div id="productStatusFilters" role="group" aria-label="Filtrar produtos por status" style="display:flex; flex-wrap:wrap; gap:8px;">
            <button type="button" class="action-btn btn-gray" data-status="TODOS" aria-pressed="false" onclick="setProductStatusFilter('TODOS')">TODOS</button>
            <button type="button" class="action-btn btn-green" data-status="ATIVO" aria-pressed="true" onclick="setProductStatusFilter('ATIVO')">ATIVOS</button>
            <button type="button" class="action-btn btn-gray" data-status="INATIVO" aria-pressed="false" onclick="setProductStatusFilter('INATIVO')">INATIVOS</button>
          </div>
        </div>

        <!-- Meio: Campo de Busca por Nome + Dropdown Ordenar -->
        <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:14px;">
          <div style="flex:1; min-width:260px; position:relative;">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute; left:12px; top:50%; transform:translateY(-50%); width:18px; height:18px; color:#94a3b8; pointer-events:none;"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
            <input type="search" id="adminProductSearch" placeholder="Buscar produto por nome, código ou categoria..." 
              style="width:100%; height:42px; padding:8px 36px 8px 38px; border:1px solid #cbd5e1; border-radius:10px; font-size:14px; outline:none; transition:border-color 0.18s ease; background:#f8fafc;"
              onfocus="this.style.borderColor='var(--primary, #2e9348)'; this.style.background='#fff';"
              onblur="this.style.borderColor='#cbd5e1'; if(!this.value) this.style.background='#f8fafc';"
              oninput="handleAdminProductSearch(this.value)" />
            <button type="button" id="adminSearchClearBtn" onclick="clearAdminProductSearch()" style="display:none; position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; color:#94a3b8; font-size:16px; cursor:pointer; padding:4px;" title="Limpar busca">✕</button>
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <label for="adminProductSort" style="font-size:13px; font-weight:700; color:#475569; white-space:nowrap; display:flex; align-items:center; gap:4px;">
              <span>⇅</span> Ordenar:
            </label>
            <select id="adminProductSort" onchange="handleAdminProductSort(this.value)" 
              style="height:42px; padding:0 14px; border:1px solid #cbd5e1; border-radius:10px; font-size:13px; font-weight:600; background:#ffffff; color:#1e293b; cursor:pointer;">
              <option value="az" selected>A a Z (Padrão)</option>
              <option value="za">Z a A</option>
              <option value="price-asc">Menor preço</option>
              <option value="price-desc">Maior preço</option>
            </select>
          </div>
        </div>

        <!-- Categorias: Chips com ícones e contadores -->
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.5px;">Categorias:</span>
            <button type="button" id="adminClearFiltersBtn" style="display:none; font-size:12px; color:#16a34a; background:none; border:none; cursor:pointer; font-weight:600;" onclick="clearAllAdminFilters()">Limpar todos os filtros</button>
          </div>
          <div id="adminCategoryChips" style="display:flex; flex-wrap:wrap; gap:6px; max-height:160px; overflow-y:auto; padding:2px 0;">
            <!-- Gerado dinamicamente -->
          </div>
          <div id="adminSubcategoryChips" hidden style="display:flex; flex-wrap:wrap; align-items:center; gap:6px; margin-top:8px; padding:6px 10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:999px;">
            <!-- Subcategorias geradas dinamicamente -->
          </div>
        </div>
      </div>

      <div id="adminProductsGrid" class="admin-products-grid" aria-label="Produtos para editar"></div>
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
      <section id="sicrediPixMonitorSection" style="margin-top:28px">
        <h2>Teste do Pix Sicredi</h2>
        <p>Valida QR Code, conferência bancária e baixa do estoque em uma simulação isolada, sem pagamento nem dados reais.</p>
        <button type="button" id="runSicrediSimulation" class="action-btn btn-green">Executar simulação</button>
        <p id="sicrediSimulationStatus" role="status"></p>
      </section>
      <section style="margin-top:28px" aria-label="Histórico de erros">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><h2>Histórico de erros</h2><button type="button" id="errorHistoryRefresh" class="action-btn btn-gray">Atualizar histórico</button></div>
        <p style="font-size:13px;color:#64748b">Falhas do servidor e do navegador. Acesso exclusivo do administrador.</p>
        <p id="errorHistoryStatus" role="status">O histórico será carregado ao abrir esta página.</p>
        <div id="errorHistoryList"></div>
        <button type="button" id="errorHistoryMore" class="action-btn btn-gray" hidden>Carregar registros anteriores</button>
        <p style="font-size:12px;color:#64748b">Se o site estiver indisponível, consulte os <a href="https://console.cloud.google.com/logs/query?project=confloraai" target="_blank" rel="noopener noreferrer">logs no Google Cloud</a>.</p>
      </section>
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
        Informe a correção e o motivo. O administrador vai conferir a solicitação.
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
        <button class="action-btn btn-amber" onclick="submitAlterationRequest()">Enviar para análise</button>
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
          <input type="email" id="uEmail" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="E-mail do cliente" />
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

  <script src="/store-assets/category-ui.js"></script>
  <script src="/store-assets/render-image.js"></script>
  <script src="/store-assets/product-card.js?v=${productAssetsVersion}"></script>
  <script src="/store-assets/stock-counting.js?v=${productAssetsVersion}"></script>
  <script src="/store-assets/cashier-report-actions.js?v=${productAssetsVersion}"></script>
  <script>
    // ESTADO GLOBAL
    let currentUser = null;
    window.ConfloraSession.apiFetch('/api/auth/me').then(res => res.json()).then(data => {
      currentUser = data.user;
      if (currentUser && ['ADMIN', 'CAIXA', 'VENDEDOR', 'ENTREGADOR'].includes(currentUser.role)) closeLoginModal();
      applyUserRoleUI();
    }).catch(() => { currentUser = null; applyUserRoleUI(); });

    let allProducts = [];
    window.addEventListener('products-imported', () => loadAdminProducts());
    document.addEventListener('cf-topbar-search', e => {
      const q = e.detail?.query || '';
      const searchInput = document.getElementById('adminProductSearch');
      if (searchInput) searchInput.value = q;
      handleAdminProductSearch(q);
    });
    let allOrders = [];
    let currentSelectedUserIdForLogin = '';

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
    }

    async function switchOwnerProfile(targetRole) {
      if (!targetRole) return;
      try {
        const res = await window.ConfloraSession.apiFetch('/api/auth/switch-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: targetRole }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          currentUser = data.user;
          applyUserRoleUI();
        } else {
          alert(data.error || 'error_switching_test_profile'.tr);
        }
      } catch {
        alert('connection_error_when_switching_profile'.tr);
      }
    }

    function applyUserRoleUI() {
      document.querySelector('conflora-topbar').user = currentUser;
      const switcherWrap = document.getElementById('ownerProfileSwitcherWrap');
      const switcherSelect = document.getElementById('ownerProfileSelect');
      if (switcherWrap && switcherSelect) {
        if (currentUser && currentUser.canSwitchProfiles) {
          switcherWrap.style.display = 'inline-flex';
          switcherSelect.value = currentUser.role || 'ADMIN';
        } else {
          switcherWrap.style.display = 'none';
        }
      }
      if (currentUser?.role === 'ENTREGADOR' && !currentUser?.canSwitchProfiles) { location.replace('/caixa'); return; }
      const photo = document.getElementById('loggedUserPhoto');
      photo.hidden = !currentUser?.picture;
      if (currentUser?.picture) photo.src = currentUser.picture;
      else photo.removeAttribute('src');
      if (!currentUser || !['ADMIN', 'CAIXA', 'VENDEDOR', 'ENTREGADOR'].includes(currentUser.role)) {
        document.getElementById('loggedUserName').innerText = 'not_authenticated'.tr;
        const roleEl = document.getElementById('loggedUserRole');
        roleEl.innerText = 'BLOQUEADO';
        roleEl.className = 'role_badge_cashier'.tr;

        // Esconde todas as abas até que haja login
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => {
          b.style.display = 'none';
        });

        // Abre o modal de identificação obrigatório
        openLoginModal(true);
        return;
      }

      document.getElementById('loggedUserName').innerText = currentUser.name || currentUser.email || 'team_operator'.tr;
      const roleEl = document.getElementById('loggedUserRole');
      roleEl.innerText = currentUser.role || 'OPERADOR';
      roleEl.className = 'role-badge ' + (currentUser.role === 'CAIXA' ? 'caixa' : '');

      document.getElementById('adminCashierReport').hidden = !['ADMIN', 'CAIXA'].includes(currentUser.role);
      document.getElementById('adminCashierReport').setAttribute('scope-label', currentUser.role === 'ADMIN' ? 'Caixa geral da loja · hoje' : 'only_your_register_today'.tr);
      const isAdmin = currentUser.role === 'ADMIN';
      const isDriver = currentUser.role === 'ENTREGADOR';

      const visibleTabs = isAdmin
        ? ['cashier', 'orders', 'stock', 'products', 'team', 'status', 'analytics']
        : isDriver
          ? ['orders', 'cashier']
          : ['cashier'];
      for (const tab of ['cashier', 'orders', 'stock', 'products', 'team', 'status', 'analytics']) {
        const button = document.getElementById('tabBtn-' + tab);
        if (button) button.style.display = visibleTabs.includes(tab) ? 'block' : 'none';
      }
      const salesFilter = document.getElementById('adminSalesFilterWrap');
      if (salesFilter) salesFilter.hidden = !isAdmin;
      const alterationsButton = document.getElementById('cashierAlterationsButton');
      if (alterationsButton) alterationsButton.hidden = ['VENDEDOR', 'ENTREGADOR'].includes(currentUser.role);
      const defaultTab = isDriver ? 'orders' : 'cashier';
      const requestedTab = new URLSearchParams(location.search).get('tab') || defaultTab;
      showTab(document.getElementById('tab-' + requestedTab) && (isAdmin || visibleTabs.includes(requestedTab) || ['diff', 'price', 'notifs'].includes(requestedTab)) ? requestedTab : defaultTab, { replace: true });
    }

    window.addEventListener('cf-admin-navigate', event => showTab(event.detail.tab));
    window.addEventListener('popstate', () => showTab(new URLSearchParams(location.search).get('tab') || 'cashier', { fromHistory: true }));
    function showTab(tab, options = {}) {
      if (!currentUser || !['ADMIN', 'CAIXA', 'VENDEDOR'].includes(currentUser.role)) return;
      const isAdmin = currentUser.role === 'ADMIN';
      const isStaffAuxiliaryTab = ['diff', 'price', 'notifs'].includes(tab);
      if (!isAdmin && tab !== 'cashier' && !(['CAIXA', 'VENDEDOR'].includes(currentUser.role) && ['diff', 'price', 'notifs'].includes(tab))) return;
      if (!document.getElementById('tab-' + tab)) return;
      if (!options.fromHistory) {
        const url = new URL(location.href); url.searchParams.set('tab', tab);
        if (options.replace || location.search === url.search) history.replaceState({ confloraNavigation: true }, '', url);
        else history.pushState({ confloraNavigation: true }, '', url);
      }
      const names = { cashier: 'register_sales'.tr, orders: 'Comandas', stock: 'stock'.tr, products: 'products_595f74'.tr, team: 'header_team_menu'.tr, status: 'Sistema e erros', analytics: 'Eventos', notifs: 'notifications'.tr, price: 'prices'.tr, diff: 'correction_requests'.tr };
      document.getElementById('adminPageLabel').textContent = names[tab] || 'administration'.tr;
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
      if (tab === 'status') { loadAdminStatusData(); window.ConfloraErrorHistory?.load(); }
    }

    // 1. EVENTOS DO CATÁLOGO & INDICADORES PARA MARKETING
    async function loadAnalyticsData() {
      const status = document.getElementById('analyticsStatus');
      status.textContent = 'Buscando eventos coletados…';
      try {
        const days = Number(document.getElementById('analyticsPeriod').value || 30);
        const res = await window.ConfloraSession.apiFetch('/api/admin/analytics/events?days=' + encodeURIComponent(days));
        const metrics = await res.json();
        if (!res.ok) throw new Error(metrics.error || 'could_not_load_events'.tr);
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
          row.textContent = (index + 1) + '. ' + product.name + ' · ' + number(product.views) + 'views'.tr + number(product.adds) + 'additions'.tr + number(product.purchases) + ' vendidos';
          return row;
        }) : [Object.assign(document.createElement('p'), { textContent: 'Ainda não há eventos de produto neste período.' })]));
        const campaignEl = document.getElementById('analyticsCampaigns');
        const campaigns = metrics.campaigns || [];
        campaignEl.replaceChildren(...(campaigns.length ? campaigns.map(campaign => {
          const row = document.createElement('div');
          row.style.marginBottom = '8px';
          row.textContent = campaign.name + ' · ' + number(campaign.visits) + ' visitas' + (metrics.attributedFinancialsUnavailable ? ' · atribuição financeira não disponível' : ' · ' + number(campaign.purchases) + 'orders_c26495'.tr + currency(campaign.revenue));
          return row;
        }) : [Object.assign(document.createElement('p'), { textContent: 'Nenhuma campanha UTM registrada ainda. Use utm_source, utm_medium e utm_campaign nos links de anúncios.' })]));
        status.textContent = number(metrics.collectedEvents) + 'events_in_the_last'.tr + days + ' dias (' + (metrics.navigationSource || 'Firestore') + 'revenue_confirmed_receipts_in_firestore_conversion_paid_orders_per_visitor_traffic_ma'.tr;
      } catch (err) {
        status.textContent = err.message || 'error_loading_catalog_events'.tr;
      }
    }

    function testGaEvent() {
      if (typeof gtag === 'function') {
        gtag('event', 'admin_analytics_test', { event_category: 'admin' });
        alert('test_event_queued_in_google_analytics_4_check_for_arrival_in_ga4_debugview'.tr);
      } else {
        alert('the_google_analytics_library_was_not_loaded_on_this_page'.tr);
      }
    }

    // 2. CAIXA & VENDAS DO DIA
    let currentCashierOrdersList = [];
    let currentReceiptProofBase64 = null;
    let systemCashierTotals = { cash: 0, pix: 0, credit: 0, debit: 0, debt: 0, total: 0 };

    async function loadCashierDaily() {
      try {
        const isAdmin = currentUser?.role === 'ADMIN';
        const operator = isAdmin ? document.getElementById('adminSalesFilter')?.value || '' : '';
        const selectedOperatorName = isAdmin ? document.getElementById('adminSalesFilter')?.selectedOptions?.[0]?.textContent || '' : '';
        const url = '/api/admin/daily-metrics' + (operator ? '?operator=' + encodeURIComponent(operator) + '&operatorName=' + encodeURIComponent(selectedOperatorName) : '');
        const res = await window.ConfloraSession.apiFetch(url);
        const m = await res.json();
        if (!res.ok) throw new Error(m.error || 'could_not_load_sales'.tr);

        const fmt = val => 'R$ ' + Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const cashVal = Number(m.byPayment?.DINHEIRO || 0);
        const pixVal = Number(m.byPayment?.PIX || 0);
        const creditVal = Number(m.byPayment?.CREDITO || 0);
        const debitVal = Number(m.byPayment?.DEBITO || 0);
        const debtVal = Number(m.byPayment?.FIADO || 0);
        const totalVal = Number(m.totalRevenue || 0);

        systemCashierTotals = { cash: cashVal, pix: pixVal, credit: creditVal, debit: debitVal, debt: debtVal, total: totalVal };

        // Atualizar Stat Cards
        document.getElementById('cashierTotalToday').innerText = fmt(totalVal);
        document.getElementById('cashierPixToday').innerText = fmt(pixVal);
        document.getElementById('cashierCreditToday').innerText = fmt(creditVal);
        document.getElementById('cashierDebitToday').innerText = fmt(debitVal);
        document.getElementById('cashierDebtToday').innerText = fmt(debtVal);
        document.getElementById('cashierCashToday').innerText = fmt(cashVal);
        const orderCountEl = document.getElementById('cashierOrdersCountToday');
        if (orderCountEl) orderCountEl.innerText = (m.todayOrdersCount || (m.todayOrders || []).length) + 'completed_sales'.tr;

        // Atualizar Linhas da Conferência (Apurado Sistema)
        document.getElementById('rowSysCash').innerText = fmt(cashVal);
        document.getElementById('rowSysPix').innerText = fmt(pixVal);
        document.getElementById('rowSysCredit').innerText = fmt(creditVal);
        document.getElementById('rowSysDebit').innerText = fmt(debitVal);
        document.getElementById('rowSysDebt').innerText = fmt(debtVal);
        document.getElementById('rowSysTotal').innerText = fmt(totalVal);

        calculateCashierDiffs();
        checkAdminCashierClosingStatus();

        currentCashierOrdersList = m.todayOrders || [];
        if (isAdmin && !operator) {
          const select = document.getElementById('adminSalesFilter');
          const selectedValue = select.value;
          const operators = new Map();
          for (const order of currentCashierOrdersList) {
            const id = String(order.operatorId || '');
            const name = String(order.operatorName || '').trim();
            const value = id || (name ? 'name:' + name : '');
            if (value && !operators.has(value)) operators.set(value, name || id);
          }
          select.replaceChildren(new Option('all_bd02b9a7d7'.tr, ''), ...[...operators].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR')).map(([value, label]) => new Option(label, value)));
          select.value = selectedValue;
        }

        renderTodayOrdersTable(currentCashierOrdersList);
      } catch (err) {
        document.getElementById('todayOrdersBody').innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#b91c1c;">' + escapeHtml(err.message || 'Erro ao carregar vendas.') + '</td></tr>';
      }
    }

    function renderTodayOrdersTable(list) {
      const tbody = document.getElementById('todayOrdersBody');
      tbody.innerHTML = '';
      if (!list || list.length === 0) {
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
          <td><strong>R$ \${Number(o.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
          <td><span class="badge \${o.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-pending'}">\${escapeHtml(({ AWAITING_PAYMENT: 'awaiting_payment_49c236'.tr, AWAITING_CASHIER: 'awaiting_payment_49c236'.tr, AWAITING_PIX: 'awaiting_pix_payment_4fd77b'.tr, CREATING_PIX: 'PREPARANDO PIX', AWAITING_CONFIRMATION: 'awaiting_confirmation_05b361'.tr, CONFIRMED: 'CONFIRMADO', PAID_CONFIRMED: 'PAGO', DELIVERED: 'ENTREGUE', CANCELLED: 'CANCELADO', PENDING: 'PENDENTE' })[o.status] || 'in_progress_66a062'.tr)}</span></td>
          <td>
            <button class="action-btn btn-amber" style="padding:4px 8px;" onclick="openAlterationModal('\${o.id}')" title="Corrigir se errou no lançamento">✏️ Corrigir Venda</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function filterTodayOrdersTable(query) {
      const q = (query || '').trim().toLowerCase();
      if (!q) {
        renderTodayOrdersTable(currentCashierOrdersList);
        return;
      }
      const filtered = currentCashierOrdersList.filter(o => {
        const id = String(o.id || '').toLowerCase();
        const customer = String(o.customerName || '').toLowerCase();
        const pay = String(o.paymentMethod || '').toLowerCase();
        const seller = String(o.operatorName || '').toLowerCase();
        return id.includes(q) || customer.includes(q) || pay.includes(q) || seller.includes(q);
      });
      renderTodayOrdersTable(filtered);
    }

    function calculateCashierDiffs() {
      const getVal = id => {
        const v = parseFloat(document.getElementById(id)?.value);
        return isNaN(v) ? null : v;
      };

      const countedCash = getVal('inputCountedCash');
      const countedPix = getVal('inputCountedPix');
      const countedCredit = getVal('inputCountedCredit');
      const countedDebit = getVal('inputCountedDebit');
      const countedDebt = getVal('inputCountedDebt');

      const updateDiffBadge = (elemId, counted, system) => {
        const el = document.getElementById(elemId);
        if (!el) return;
        if (counted === null) {
          el.innerHTML = '<span class="conf-diff-badge exact">Aguardando contagem</span>';
          return;
        }
        const diff = Math.round((counted - system) * 100) / 100;
        const fmtDiff = 'R$ ' + Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (Math.abs(diff) < 0.01) {
          el.innerHTML = '<span class="conf-diff-badge exact">✓ Bateu certinho (R$ 0,00)</span>';
        } else if (diff > 0) {
          el.innerHTML = '<span class="conf-diff-badge surplus">▲ Sobra de ' + fmtDiff + '</span>';
        } else {
          el.innerHTML = '<span class="conf-diff-badge shortage">▼ Falta de ' + fmtDiff + '</span>';
        }
      };

      updateDiffBadge('diffTagCash', countedCash, systemCashierTotals.cash);
      updateDiffBadge('diffTagPix', countedPix, systemCashierTotals.pix);
      updateDiffBadge('diffTagCredit', countedCredit, systemCashierTotals.credit);
      updateDiffBadge('diffTagDebit', countedDebit, systemCashierTotals.debit);
      updateDiffBadge('diffTagDebt', countedDebt, systemCashierTotals.debt);

      const items = [countedCash, countedPix, countedCredit, countedDebit, countedDebt];
      const hasAnyCounted = items.some(x => x !== null);
      if (hasAnyCounted) {
        const totalCounted = items.reduce((s, x) => s + (x || 0), 0);
        document.getElementById('rowCountedTotal').innerText = 'R$ ' + totalCounted.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        updateDiffBadge('diffTagTotal', totalCounted, systemCashierTotals.total);
      } else {
        document.getElementById('rowCountedTotal').innerText = 'R$ 0,00';
        document.getElementById('diffTagTotal').innerHTML = '<span class="conf-diff-badge exact">Aguardando</span>';
      }
    }

    function fillCountedFromSystem() {
      document.getElementById('inputCountedCash').value = Number(systemCashierTotals.cash || 0).toFixed(2);
      document.getElementById('inputCountedPix').value = Number(systemCashierTotals.pix || 0).toFixed(2);
      document.getElementById('inputCountedCredit').value = Number(systemCashierTotals.credit || 0).toFixed(2);
      document.getElementById('inputCountedDebit').value = Number(systemCashierTotals.debit || 0).toFixed(2);
      document.getElementById('inputCountedDebt').value = Number(systemCashierTotals.debt || 0).toFixed(2);
      calculateCashierDiffs();
    }

    function handleReceiptPhotoSelected(event) {
      const file = event.target?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        currentReceiptProofBase64 = e.target.result;
        document.getElementById('receiptPreviewImg').src = currentReceiptProofBase64;
        document.getElementById('receiptFileName').innerText = file.name || 'comprovante.jpg';
        document.getElementById('receiptPreviewBox').style.display = 'flex';
      };
      reader.readAsDataURL(file);
    }

    function removeReceiptPhoto() {
      currentReceiptProofBase64 = null;
      document.getElementById('receiptPreviewImg').src = '';
      document.getElementById('receiptFileName').innerText = '';
      document.getElementById('receiptPreviewBox').style.display = 'none';
      const input = document.getElementById('machineReceiptInput');
      if (input) input.value = '';
    }

    async function checkAdminCashierClosingStatus() {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const res = await window.ConfloraSession.apiFetch('/api/admin/cashier/closing?date=' + todayStr);
        const json = await res.json();
        const badge = document.getElementById('cashierClosingBadge');
        const btnSubmit = document.getElementById('btnSubmitCloseCash');
        if (json.closing && json.closing.status === 'CLOSED') {
          badge.className = 'conf-badge-closed';
          badge.textContent = 'closed_by_ecc035'.tr + (json.closing.closedBy || 'team_operator'.tr) + 'at'.tr + new Date(json.closing.closedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          if (btnSubmit) {
            btnSubmit.textContent = 'today_s_register_already_closed_refresh'.tr;
            btnSubmit.className = 'action-btn btn-gray';
          }
          if (json.closing.notes && !document.getElementById('cashierClosingNotes').value) {
            document.getElementById('cashierClosingNotes').value = json.closing.notes;
          }
        } else {
          badge.className = 'conf-badge-open';
          badge.textContent = 'open_cash_register_under_reconciliation'.tr;
          if (btnSubmit) {
            btnSubmit.textContent = 'register_cash_closing'.tr;
            btnSubmit.className = 'action-btn btn-green';
          }
        }
      } catch (_) {}
    }

    async function submitCashierClosing() {
      const getVal = id => {
        const v = parseFloat(document.getElementById(id)?.value);
        return isNaN(v) ? 0 : v;
      };

      const counted = {
        cash: getVal('inputCountedCash'),
        pix: getVal('inputCountedPix'),
        credit: getVal('inputCountedCredit'),
        debit: getVal('inputCountedDebit'),
        debt: getVal('inputCountedDebt'),
      };
      counted.total = Math.round((counted.cash + counted.pix + counted.credit + counted.debit + counted.debt) * 100) / 100;

      const notes = document.getElementById('cashierClosingNotes')?.value || '';
      const todayStr = new Date().toISOString().slice(0, 10);

      if (!window.confirm('confirm_and_register_today_s_register_closing'.tr + todayStr.split('-').reverse().join('/') + ')?')) {
        return;
      }

      const btn = document.getElementById('btnSubmitCloseCash');
      if (btn) { btn.disabled = true; btn.textContent = 'Registrando fechamento...'; }

      try {
        let receiptUrl = '';
        if (currentReceiptProofBase64) {
          try {
            const proofRes = await window.ConfloraSession.apiFetch('/api/caixa/payment-proofs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                targetType: 'CLOSING',
                targetId: 'closing_' + todayStr,
                base64: currentReceiptProofBase64,
                mimeType: 'image/jpeg',
                fileName: 'fechamento_' + todayStr + '.jpg'
              })
            });
            const proofData = await proofRes.json();
            receiptUrl = proofData.url || proofData.proofUrl || '';
          } catch (e) {
            console.warn('failed_to_upload_receipt_image'.tr, e);
          }
        }

        const res = await window.ConfloraSession.apiFetch('/api/admin/cashier/close-day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: todayStr,
            requestId: 'close_' + Date.now(),
            counted,
            receiptProofUrl: receiptUrl,
            notes
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          alert('register_closing_successfully_recorded'.tr);
          await loadCashierDaily();
        } else {
          alert('error_recording_closing'.tr + (data.error || 'server_failure'.tr));
        }
      } catch (err) {
        alert('error_communicating_with_server'.tr + err.message);
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'register_cash_closing'.tr; }
      }
    }


    // 3. CENTRAL DE ALTERAÇÕES - GIT DIFF
    async function loadAlterations() {
      const container = document.getElementById('alterationsListContainer');
      try {
        const res = await window.ConfloraSession.apiFetch('/api/admin/alterations');
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
                <strong>Pedido #\${(alt.orderId || '').slice(-6)}</strong> • Solicitado por: <strong>\${alt.requestedByName || 'checkout'.tr}</strong> em \${new Date(alt.createdAt).toLocaleTimeString()}
              </div>
              <div>
                <span class="badge \${alt.status === 'APPROVED' ? 'badge-confirmed' : (alt.status === 'REJECTED' ? 'badge-cancelled' : 'badge-pending')}">
                  \${alt.status === 'PENDING' ? 'AGUARDANDO EDMAR' : (alt.status === 'APPROVED' ? 'APROVADO' : 'RECUSADO')}
                </span>
              </div>
            </div>

            <div class="diff-reason-box">
              <strong>💬 Justificativa do Atendente:</strong> "\${alt.reason || 'bug_fix'.tr}"
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
        container.innerHTML = 'error_loading_changes'.tr + escapeHtml(err.message);
      }
    }

    async function approveAlteration(requestId) {
      if (!confirm('do_you_want_to_consolidate_this_change_in_the_order_and_update_inventory'.tr)) return;
      const res = await window.ConfloraSession.apiFetch('/api/admin/alterations/' + requestId + '/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVED', reviewedBy: currentUser.name })
      });
      const data = await res.json();
      if (data.success) {
        alert('change_successfully_consolidated_in_firestore_notification_sent_to_the_cashier'.tr);
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
      if (!reason) { alert('please_provide_the_reason_for_cancellation_to_the_attendant'.tr); return; }

      const res = await window.ConfloraSession.apiFetch('/api/admin/alterations/' + id + '/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECTED', reviewedBy: currentUser.name, rejectionReason: reason })
      });
      const data = await res.json();
      if (data.success) {
        alert('request_declined_the_notification_with_the_reason_was_sent_directly_to_the_cashier_at'.tr);
        closeRejectModal();
        loadAlterations();
      }
    }

    // 4. SOLICITAÇÃO DE ALTERAÇÃO PELO CAIXA
    async function openAlterationModal(orderId) {
      const res = await window.ConfloraSession.apiFetch('/api/admin/orders');
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
      const res = await window.ConfloraSession.apiFetch('/api/admin/orders');
      const orders = await res.json();
      const orig = orders.find(o => String(o.id) === String(orderId));

      const newCust = document.getElementById('altCustName').value;
      const newPay = document.getElementById('altPayMethod').value;
      const newTot = parseFloat(document.getElementById('altTotal').value);
      const reason = document.getElementById('altReason').value.trim();

      if (!reason) { alert('explain_the_reason_for_the_correction'.tr); return; }

      const proposed = { ...orig, customerName: newCust, paymentMethod: newPay, total: newTot };

      await window.ConfloraSession.apiFetch('/api/admin/alterations', {
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

      alert('change_request_sent_to_the_administrator_they_will_review_the_differences_in_the_git_'.tr);
      closeAlterationModal();
      loadAlterations();
    }

    // 5. NOTIFICAÇÕES PARA ATENDENTE / ADMIN
    async function loadNotifications() {
      const container = document.getElementById('notificationsContainer');
      try {
        if (!currentUser) return;
        const res = await window.ConfloraSession.apiFetch('/api/admin/notifications?userId=' + currentUser.id);
        const list = await res.json();
        container.replaceChildren();

        const notifications = Array.isArray(list) ? list : [];
        const unreadCount = notifications.filter(n => !n.read).length;
        document.getElementById('notifBadge').innerText = unreadCount;
        document.getElementById('notifBadge').hidden = unreadCount === 0;

        if (notifications.length === 0) {
          const empty = document.createElement('p');
          empty.className = 'muted';
          empty.textContent = 'no_notifications_at_the_moment'.tr;
          container.appendChild(empty);
        }

        notifications.forEach(n => {
          const div = document.createElement('div');
          const isSale = n.type === 'SALE_COMPLETED';
          div.className = 'notif-card ' + (n.type === 'REJECTED' ? 'rejected' : (isSale ? 'sale' : (n.type === 'APPROVED' ? 'approved' : '')));
          const heading = document.createElement('strong');
          heading.textContent = n.title || 'administration_notice'.tr;
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
            ordersButton.textContent = 'view_orders'.tr;
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
        container.textContent = 'error_loading_notifications'.tr + err.message;
      }
    }

    async function renderDiscountApprovals(container) {
      const response = await window.ConfloraSession.apiFetch('/api/admin/discount-approvals');
      if (!response.ok) return;
      const approvals = await response.json();
      if (!Array.isArray(approvals) || approvals.length === 0) return;

      const panel = document.createElement('section');
      panel.id = 'discountApprovalsPanel';
      panel.className = 'discount-approvals-panel';
      const title = document.createElement('h2');
      title.textContent = 'pending_discount_approvals'.tr;
      panel.appendChild(title);

      approvals.forEach((approval) => {
        const card = document.createElement('article');
        card.className = 'discount-approval-card';
        const heading = document.createElement('h3');
        heading.textContent = 'sale_to'.tr + (approval.customerName || 'customer'.tr);
        const meta = document.createElement('p');
        meta.className = 'muted';
        meta.textContent = (approval.operatorName || 'team_operator'.tr) + ' · ' + (approval.customerPhone || 'no_phone'.tr);
        const items = document.createElement('ul');
        items.className = 'discount-approval-items';
        (approval.items || []).forEach((item) => {
          const row = document.createElement('li');
          const quantity = Number(item.quantity) || 0;
          const subtotal = Number(item.price || 0) * quantity;
          row.title = item.name || 'product'.tr;
          row.textContent = quantity + ' × ' + (item.name || 'product'.tr) + ' · ' + Number(item.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) + ' un · ' + subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
          items.appendChild(row);
        });
        const totals = document.createElement('div');
        totals.className = 'discount-approval-totals';
        const subtotalLine = document.createElement('p');
        subtotalLine.textContent = 'Subtotal: ' + Number(approval.subtotal || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const discountLine = document.createElement('p');
        discountLine.textContent = 'Desconto: ' + Number(approval.discountPercent || 0) + '% · − ' + Number(approval.discountAmount || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const totalLine = document.createElement('strong');
        totalLine.textContent = 'sale_total'.tr + Number(approval.total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
        rejectionReason = window.prompt('enter_the_reason_for_refusal'.tr) || '';
        if (!rejectionReason.trim()) {
          if (rejectionReason !== '') alert('O motivo da recusa é obrigatório.');
          return;
        }
      }
      button.disabled = true;
      alternateButton.disabled = true;
      try {
        const response = await window.ConfloraSession.apiFetch('/api/admin/discount-approvals/' + encodeURIComponent(approvalId) + '/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, rejectionReason }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'could_not_review_the_discount'.tr);
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

    // Share only concurrent reads; never persist private inventory in the browser.
    let inventoryPending = null;
    let inventoryRevision = 0;
    window.addEventListener('cf-catalog-invalidated', () => {
      inventoryRevision++;
      inventoryPending = null;
    });
    async function readAdminInventory() {
      const revision = inventoryRevision;
      const identity = currentUser?.id;
      inventoryPending ||= window.ConfloraSession.apiFetch('/api/inventory');
      const pending = inventoryPending;
      try {
        const response = await pending;
        if (identity !== currentUser?.id) throw new Error('Sessão alterada. Atualize a consulta.');
        if (revision !== inventoryRevision) return readAdminInventory();
        return response.clone();
      } finally {
        if (inventoryPending === pending) inventoryPending = null;
      }
    }

    async function loadInventoryProducts(warning) {
      try {
        const res = await readAdminInventory();
        if (res.ok) {
          const data = await res.json();
          const list = safeExtractProductsAdmin(data);
          allProducts = Array.isArray(list) ? list : [];
        } else {
          allProducts = [];
        }
      } catch (e) {
        console.warn(warning, e);
        allProducts = [];
      }
      if (!Array.isArray(allProducts)) allProducts = [];
    }

    // 6. CONSULTA RÁPIDA DE PREÇO
    async function loadPriceProducts() {
      await loadInventoryProducts('price_lookup_failed'.tr);
      filterPriceTable();
    }

    function isStoredProductImageUrl(url) {
      const value = String(url || '').trim().toLowerCase();
      return value.startsWith('/api/images/') || /^https:\\/\\/(?:firebasestorage|storage)\\.googleapis\\.com\\//i.test(value);
    }

    function getProductImageUrl(product) {
      if (product.media?.version === 1) return product.media.primaryUrl || product.media.placeholderUrl;
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
          <td><img src="\${escapeHtml(img)}" class="prod-thumb" /></td>
          <td><strong>\${escapeHtml(p.descricao || p.name)}</strong></td>
          <td>\${escapeHtml(p.categoria || p.category || '')} • \${escapeHtml(p.subcategoria || '')}</td>
          <td><strong style="color:#15803d; font-size:15px;">R$ \${Number(p.valor_num || p.price || 0).toFixed(2).replace('.', ',')}</strong></td>
          <td><span style="font-weight:bold;">\${p.stockQuantity ?? p.estoque ?? 0}</span> \${getAdminProductSaleUnit(p) === 'KG' ? 'kg' : 'unit'.tr} em estoque</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    // 7. EQUIPE & PERMISSÕES
    async function loadTeam() {
      const res = await window.ConfloraSession.apiFetch('/api/admin/auth/users');
      const users = await res.json();
      const tbody = document.getElementById('teamTableBody');
      tbody.innerHTML = '';

      users.forEach(u => {
        const tr = document.createElement('tr');
        const role = u.role || 'CLIENTE';
        tr.innerHTML = \`
          <td><strong>\${escapeHtml(u.name || 'unnamed'.tr)}</strong></td>
          <td>\${escapeHtml(u.email)}</td>
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
        const res = await window.ConfloraSession.apiFetch('/api/admin/users/' + encodeURIComponent(userId) + '/role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        });
        const data = await res.json();
        if (data.success) {
          alert('profile_updated_to'.tr + newRole + 'successfully'.tr);
          loadTeam();
        } else {
          alert('error_changing_profile'.tr + (data.error || 'Falha'));
          loadTeam();
        }
      } catch (err) {
        alert('error_connecting_to_server'.tr + err.message);
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

      await window.ConfloraSession.apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, email, role, pin, active: true })
      });

      alert('employee_registered_successfully'.tr);
      closeUserModal();
      loadTeam();
    }

    async function deleteUser(id) {
      if (!confirm('do_you_want_to_delete_this_employee_s_access'.tr)) return;
      await window.ConfloraSession.apiFetch('/api/admin/users/' + id, { method: 'DELETE' });
      loadTeam();
    }

    // 8. LOGIN / TROCA DE OPERADOR
    async function openLoginModal(automatic = false) {
      const res = await window.ConfloraSession.apiFetch('/api/admin/auth/users');
      const users = await res.json();
      const listEl = document.getElementById('userSelectList');
      listEl.innerHTML = '';
      
      users.forEach(u => {
        const btn = document.createElement('div');
        btn.style.cssText = 'padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;';
        btn.innerHTML = \`
          <div>
            <strong>\${escapeHtml(u.name)}</strong><br>
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
      const res = await window.ConfloraSession.apiFetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentSelectedUserIdForLogin, pin })
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        closeLoginModal();
        applyUserRoleUI();
        alert('Bem-vindo(a), ' + currentUser.name + ' (' + currentUser.role + ')!');
      } else {
        alert('error_authenticating'.tr + (data.error || 'PIN incorreto.'));
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
          closeLoginModal();
          applyUserRoleUI();
          if (currentUser.role === 'ADMIN') {
            alert('successfully_authenticated_as_google_administrator_dashboard_and_settings_unlocked'.tr);
          } else {
            alert('🌿 Bem-vindo(a), ' + currentUser.name + '! Perfil identificado: ' + currentUser.role);
          }
        } else {
          alert('error_authenticating_via_google'.tr + (data.error || 'Tente novamente'));
        }
      } catch (err) {
        alert(err.code === 'auth/popup-closed-by-user' ? 'Login cancelado.' : err.code === 'auth/popup-blocked' ? 'Permita pop-ups para entrar com o Google.' : 'error_authenticating'.tr + err.message);
      } finally {
        button.disabled = false;
      }
    }

    async function logoutAdmin() {
      if (confirm('do_you_really_want_to_sign_out_of_your_administrative_account'.tr)) {
        if (window.signOutGoogle) {
          try { await window.signOutGoogle(); } catch (error) { alert('error_signing_out'.tr + error.message); return; }
        }
        await window.ConfloraSession.apiFetch('/api/auth/logout', { method: 'POST' });
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
        const response = await window.ConfloraSession.apiFetch('/api/admin/system-status');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'failed_to_check_diagnostics'.tr);
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
    // 9. ESTOQUE ÁGIL (+1, +5, +10)
    let stockControlActive = null;
    function renderStockControl() {
      const button = document.getElementById('stockControlToggle');
      button.hidden = currentUser?.role !== 'ADMIN';
      button.disabled = stockControlActive === null;
      button.setAttribute('aria-pressed', String(stockControlActive === true));
      document.getElementById('stockControlBanner').dataset.enabled = String(stockControlActive === true);
      button.className = 'action-btn ' + (stockControlActive ? 'btn-green' : 'btn-amber');
      button.textContent = stockControlActive === null ? 'Verificar controle de estoque' : stockControlActive ? '✓ Estoque ativo · Desativar' : 'free_sale_enable_inventory'.tr;
      document.getElementById('stockControlHelp').textContent = stockControlActive === null ? 'Não foi possível consultar o controle de estoque.' : stockControlActive
        ? 'Estoque ativo: as vendas exigem saldo disponível e a baixa ocorre na confirmação do pagamento.'
        : 'free_sale_sell_without_registering_inventory_entries_including_via_pix_previous_reser'.tr;
    }
    async function loadStockControl() {
      try {
        const response = await window.ConfloraSession.apiFetch('/api/admin/inventory-settings');
        if (!response.ok) throw new Error('failed_to_check_inventory'.tr);
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
        const response = await window.ConfloraSession.apiFetch('/api/admin/inventory-settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stockControlEnabled: !stockControlActive }) });
        const settings = await response.json();
        if (!response.ok) throw new Error(settings.error || 'could_not_save_inventory_control'.tr);
        stockControlActive = settings.stockControlEnabled;
      } catch (error) { alert(error.message); }
      finally { renderStockControl(); }
    }
    async function loadStockProducts() {
      const controls = loadStockControl();
      await loadInventoryProducts('failed_to_load_inventory'.tr);
      filterStockCards();
      await controls;
      await loadStockMovements();
    }

    function getAdminProductSaleUnit(product = {}) {
      const savedUnit = String(product.saleUnit?.code || product.unit || product.unidade || '').trim().toUpperCase();
      if (savedUnit) return savedUnit;
      return /(^|[^A-Z])KG([^A-Z]|$)/i.test(String(product.name || product.descricao || '')) ? 'KG' : 'UN';
    }

    function filterStockCards() {
      window.StockCounting.configure({
        userId: currentUser?.id || '',
        getProducts: () => allProducts,
        getUnit: getAdminProductSaleUnit,
        updateBalance: updateStockBalance,
        refreshMovements: loadStockMovements,
        adjust: openStockAdjustment,
        create: () => {
          openNewProductDialog();
          document.getElementById('formProdName').value = document.getElementById('stockSearchInput').value.trim();
          returnToStock = true;
        },
      });
      window.StockCounting.render();
    }

    function createStockRequestId() {
      return window.crypto?.randomUUID?.() || \`stock-\${Date.now()}-\${Math.random().toString(36).slice(2, 12)}\`;
    }

    function updateStockBalance(productId, value) {
      const stock = Number(value);
      if (!Number.isFinite(stock)) return;
      const element = document.getElementById('stk-' + productId);
      if (element) element.textContent = String(stock);
      const product = allProducts.find(item => String(item.id) === String(productId));
      if (product) { product.stockQuantity = stock; product.estoque = stock; }
      window.StockCounting?.refreshBalances();
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
      document.getElementById('stockAdjustmentTitle').textContent = kind === 'ENTRY' ? 'Entrada de estoque' : kind === 'EXIT' ? 'Baixa de estoque' : 'inventory_count_and_adjustment'.tr;
      document.getElementById('stockAdjustmentHelp').textContent = kind === 'SET' ? 'Informe a quantidade física contada. O saldo será substituído por esse valor.' : 'record_the_moved_quantity_the_operation_will_be_added_to_the_inventory_history'.tr;
      document.getElementById('stockAdjustmentQuantityLabel').textContent = kind === 'SET' ? 'Novo estoque contado' : 'product_quantity'.tr;
      document.getElementById('stockAdjustmentQuantity').value = kind === 'SET' ? '0' : '1';
      document.getElementById('stockAdjustmentReasonWrap').hidden = kind === 'ENTRY';
      reason.required = kind !== 'ENTRY';
      reason.value = '';
      document.getElementById('stockAdjustmentError').hidden = true;
      select.replaceChildren(new Option('select_a_product_578b3d'.tr, ''));
      [...allProducts].sort((a, b) => String(a.name || a.descricao || '').localeCompare(String(b.name || b.descricao || ''), 'pt-BR'))
        .forEach(product => select.add(new Option(\`\${product.name || product.descricao || 'product'.tr} — estoque \${product.stockQuantity ?? product.estoque ?? 0}\`, product.id)));
      if (productId) select.value = productId;
      const quantityInput = document.getElementById('stockAdjustmentQuantity');
      const updateQuantityUnit = () => {
        const product = allProducts.find(row => String(row.id) === String(select.value));
        const isKg = getAdminProductSaleUnit(product) === 'KG';
        document.getElementById('stockAdjustmentQuantityLabel').textContent = (kind === 'SET' ? 'Novo estoque contado' : 'product_quantity'.tr) + (isKg ? ' (kg)' : ' (unidades)');
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
        errorMessage.textContent = 'check_the_product_quantity_and_reason_for_the_operation'.tr;
        errorMessage.hidden = false;
        return;
      }
      submitButton.disabled = true;
      errorMessage.hidden = true;
      try {
        const response = await window.ConfloraSession.apiFetch('/api/admin/stock/adjustments', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, operation, quantity, reason, requestId: createStockRequestId() }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'could_not_save_the_movement'.tr);
        updateStockBalance(productId, data.newStock);
        closeStockAdjustment();
        await loadStockMovements();
      } catch (error) {
        errorMessage.textContent = error.message || 'could_not_save_the_movement'.tr;
        errorMessage.hidden = false;
      } finally {
        submitButton.disabled = false;
      }
    }

    async function loadStockMovements() {
      const container = document.getElementById('stockMovementsList');
      if (!container) return;
      try {
        const response = await window.ConfloraSession.apiFetch('/api/admin/stock/movements?limit=20');
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'could_not_load_movements'.tr);
        const movements = Array.isArray(data.movements) ? data.movements : [];
        if (!movements.length) { container.textContent = 'no_movements_recorded'.tr; return; }
        const list = document.createElement('div');
        list.style.display = 'grid';
        list.style.gap = '8px';
        movements.forEach(movement => {
          const row = document.createElement('div');
          row.className = 'stock-movement-row';
          row.textContent = \`\${new Date(movement.createdAt || Date.now()).toLocaleString('pt-BR')} · \${movement.productName || 'product'.tr} · \${movement.operation || movement.type || 'Movimento'} · \${movement.quantity} un · \${movement.reason || movement.actorName || 'sale_83fe1f'.tr}\`;
          list.appendChild(row);
        });
        container.replaceChildren(list);
      } catch (error) {
        container.textContent = error.message || 'could_not_load_movements'.tr;
      }
    }
    // 10. CADASTRO DE PRODUTOS
    let productStatusFilter = 'ATIVO';
    let productSearchQuery = '';
    let productSortOrder = 'az'; // Padrão: A a Z
    let productCategoryFilter = '';
    let selectedAdminCategories = [];
    let selectedAdminSubcategories = [];

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

    function handleAdminProductSearch(query) {
      productSearchQuery = String(query || '').trim();
      const clearBtn = document.getElementById('adminSearchClearBtn');
      if (clearBtn) clearBtn.style.display = productSearchQuery ? 'block' : 'none';
      updateClearFiltersBtnVisibility();
      renderAdminProducts();
    }

    function clearAdminProductSearch() {
      const input = document.getElementById('adminProductSearch');
      if (input) input.value = '';
      handleAdminProductSearch('');
    }

    function handleAdminProductSort(order) {
      productSortOrder = order || 'az';
      renderAdminProducts();
    }

    function setAdminCategoryFilter(cat) {
      if (!cat) {
        selectedAdminCategories = [];
        selectedAdminSubcategories = [];
      } else if (window.ConfloraCategoryUi?.toggleSelection) {
        selectedAdminCategories = window.ConfloraCategoryUi.toggleSelection(selectedAdminCategories, cat);
      } else {
        selectedAdminCategories = selectedAdminCategories.includes(cat)
          ? selectedAdminCategories.filter(item => item !== cat)
          : [...selectedAdminCategories, cat];
      }
      productCategoryFilter = selectedAdminCategories.join(', ');
      updateClearFiltersBtnVisibility();
      renderAdminCategoryChips();
      renderAdminProducts();
    }

    function toggleAdminSubcategoryFilter(subKey) {
      if (!subKey) {
        selectedAdminSubcategories = [];
      } else if (window.ConfloraCategoryUi?.toggleSelection) {
        selectedAdminSubcategories = window.ConfloraCategoryUi.toggleSelection(selectedAdminSubcategories, subKey);
      } else {
        selectedAdminSubcategories = selectedAdminSubcategories.includes(subKey)
          ? selectedAdminSubcategories.filter(item => item !== subKey)
          : [...selectedAdminSubcategories, subKey];
      }
      updateClearFiltersBtnVisibility();
      renderAdminCategoryChips();
      renderAdminProducts();
    }

    function clearAllAdminFilters() {
      productCategoryFilter = '';
      selectedAdminCategories = [];
      selectedAdminSubcategories = [];
      productSearchQuery = '';
      const input = document.getElementById('adminProductSearch');
      if (input) input.value = '';
      const clearBtn = document.getElementById('adminSearchClearBtn');
      if (clearBtn) clearBtn.style.display = 'none';
      const sortSelect = document.getElementById('adminProductSort');
      if (sortSelect) sortSelect.value = 'az';
      productSortOrder = 'az';
      updateClearFiltersBtnVisibility();
      renderAdminCategoryChips();
      renderAdminProducts();
    }

    function updateClearFiltersBtnVisibility() {
      const btn = document.getElementById('adminClearFiltersBtn');
      if (btn) btn.style.display = (selectedAdminCategories.length || selectedAdminSubcategories.length || productSearchQuery) ? 'inline-block' : 'none';
    }

    function renderAdminCategoryChips() {
      const container = document.getElementById('adminCategoryChips');
      const subContainer = document.getElementById('adminSubcategoryChips');
      if (!container) return;

      const categoriesMap = new Map();
      allProducts.forEach(p => {
        const cat = String(p.category || p.categoria || p.CATEGORIA || '').trim();
        if (cat) {
          categoriesMap.set(cat, (categoriesMap.get(cat) || 0) + 1);
        }
      });

      const sortedCats = Array.from(categoriesMap.entries()).sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));

      container.replaceChildren();

      const makeTag = (label, selected, kind, colorCategory, onClick) => {
        const tag = document.createElement('render-category-tag');
        tag.setAttribute('category', label);
        tag.setAttribute('variant', kind === 'action' ? 'action' : 'filter');
        if (kind && kind !== 'action') tag.setAttribute('kind', kind);
        if (kind === 'action') tag.setAttribute('kind', 'all');
        if (colorCategory) tag.setAttribute('color-category', colorCategory);
        tag.setAttribute('selected', String(Boolean(selected)));
        tag.onclick = onClick;
        return tag;
      };

      container.appendChild(makeTag('all'.tr, selectedAdminCategories.length === 0, 'all', '', () => setAdminCategoryFilter('')));

      sortedCats.forEach(([catName]) => {
        const isActive = selectedAdminCategories.includes(catName);
        container.appendChild(makeTag(catName, isActive, '', catName, () => setAdminCategoryFilter(catName)));
      });

      if (selectedAdminCategories.length > 0) {
        container.appendChild(makeTag('Limpar categorias', false, 'action', '', () => setAdminCategoryFilter('')));
      }

      if (subContainer) {
        const subMap = new Map();
        if (selectedAdminCategories.length > 0) {
          allProducts.forEach(p => {
            const cat = String(p.category || p.categoria || p.CATEGORIA || '').trim();
            if (!selectedAdminCategories.includes(cat)) return;
            const sub = String(p.subcategory || p.subcategoria || p.SUBCATEGORIA || '').trim();
            const key = window.ConfloraCategoryUi?.normalize ? window.ConfloraCategoryUi.normalize(sub) : sub.toLowerCase();
            if (key && !subMap.has(key)) subMap.set(key, { name: sub, parent: cat });
          });
        }
        selectedAdminSubcategories = selectedAdminSubcategories.filter(k => subMap.has(k));
        subContainer.hidden = subMap.size === 0;
        subContainer.style.display = subMap.size === 0 ? 'none' : 'flex';
        subContainer.replaceChildren();
        if (subMap.size > 0) {
          const badge = document.createElement('span');
          badge.style.cssText = 'font-size:11px; font-weight:800; color:#14532d; text-transform:uppercase; padding:0 6px;';
          badge.textContent = 'subcategories'.tr;
          subContainer.appendChild(badge);
          Array.from(subMap.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name, 'pt-BR')).forEach(([key, sub]) => {
            subContainer.appendChild(makeTag(sub.name, selectedAdminSubcategories.includes(key), '', sub.parent, () => toggleAdminSubcategoryFilter(key)));
          });
          if (selectedAdminSubcategories.length > 0) {
            subContainer.appendChild(makeTag('Limpar subcategorias', false, 'action', '', () => toggleAdminSubcategoryFilter('')));
          }
        }
      }
    }

    async function loadAdminProducts() {
      await loadInventoryProducts('failed_to_load_products'.tr);
      renderAdminCategoryChips();
      renderAdminProducts();
    }

    function renderAdminProducts() {
      const grid = document.getElementById('adminProductsGrid');
      if (!grid) return;
      grid.replaceChildren();

      // 1. Filtragem por Status
      let visible = allProducts.filter(p => {
        if (productStatusFilter === 'TODOS') return true;
        const inactive = productIsInactive(p);
        return productStatusFilter === 'INATIVO' ? inactive : !inactive;
      });

      // 2. Filtragem por Categoria e Subcategoria
      if (selectedAdminCategories.length > 0) {
        visible = visible.filter(p => {
          const cat = String(p.category || p.categoria || p.CATEGORIA || '').trim();
          return selectedAdminCategories.includes(cat);
        });
      }
      if (selectedAdminSubcategories.length > 0) {
        visible = visible.filter(p => {
          const sub = String(p.subcategory || p.subcategoria || p.SUBCATEGORIA || '').trim();
          const key = window.ConfloraCategoryUi?.normalize ? window.ConfloraCategoryUi.normalize(sub) : sub.toLowerCase();
          return selectedAdminSubcategories.includes(key);
        });
      }

      // 3. Busca por Nome / SKU / Categoria
      if (productSearchQuery) {
        const qNorm = productSearchQuery.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        visible = visible.filter(p => {
          const name = String(p.name || p.descricao || p.canonicalName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const sku = String(p.sku || p.codigo || p.id || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const cat = String(p.category || p.categoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          const sub = String(p.subcategory || p.subcategoria || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
          return name.includes(qNorm) || sku.includes(qNorm) || cat.includes(qNorm) || sub.includes(qNorm);
        });
      }

      // 4. Ordenação (Padrão: A a Z)
      visible.sort((a, b) => {
        const nameA = String(a.name || a.descricao || a.canonicalName || '').trim();
        const nameB = String(b.name || b.descricao || b.canonicalName || '').trim();
        const priceA = Number(a.price ?? a.valor_num ?? a.valor ?? a.VALOR ?? 0);
        const priceB = Number(b.price ?? b.valor_num ?? b.valor ?? b.VALOR ?? 0);

        if (productSortOrder === 'za') {
          return nameB.localeCompare(nameA, 'pt-BR', { sensitivity: 'base' });
        } else if (productSortOrder === 'price-asc') {
          if (priceA !== priceB) return priceA - priceB;
          return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
        } else if (productSortOrder === 'price-desc') {
          if (priceA !== priceB) return priceB - priceA;
          return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
        }
        // Padrão: 'az' (A a Z)
        return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
      });

      // 5. Atualização do contador de status
      const countEl = document.getElementById('productStatusCount');
      if (countEl) {
        const statusLabel = productStatusFilter === 'TODOS' ? 'Todos os status' : productStatusFilter === 'INATIVO' ? 'Inativos' : 'Ativos';
        const filterDetails = [];
        if (productCategoryFilter) filterDetails.push('Categoria: ' + productCategoryFilter);
        if (productSearchQuery) filterDetails.push('Busca: "' + productSearchQuery + '"');
        const extra = filterDetails.length ? ' • ' + filterDetails.join(' • ') : '';
        countEl.textContent = visible.length + 'item_s'.tr + statusLabel + extra;
      }

      // 6. Mensagem de vazio se nada corresponder
      if (visible.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.style.cssText = 'grid-column: 1 / -1; padding: 48px 24px; text-align: center; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 14px; color: #64748b; margin-top: 10px;';
        emptyDiv.innerHTML = '<div style="font-size: 36px; margin-bottom: 10px;">🔍</div><div style="font-weight: 700; font-size: 16px; color: #334155;">Nenhum produto encontrado</div><div style="font-size: 13px; margin-top: 6px; color:#64748b;">Tente mudar os termos da busca, limpar os filtros ou selecionar outra categoria.</div><button type="button" class="action-btn btn-green" onclick="clearAllAdminFilters()" style="margin-top:14px;">Limpar filtros</button>';
        grid.appendChild(emptyDiv);
        return;
      }

      const fragment = document.createDocumentFragment();
      visible.forEach(product => {
        const card = document.createElement('render-product-card');
        card.setAttribute('variant', 'admin');
        card.product = product;
        card.addEventListener('cf-product-card-action', event => {
          if (['edit', 'open'].includes(event.detail.action)) editProduct(product.id);
        });
        fragment.appendChild(card);
      });
      grid.appendChild(fragment);
    }

    function slugifyClient(text) {
      if (!text) return 'catalog_product_singular'.tr;
      return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produto';
    }

    let pendingPhotosList = [];
    let previewProduct = null;

    function renderPendingPhotosGrid() {
      const box = document.getElementById('formProdPhotoPreviewBox');
      const grid = document.getElementById('formProdPhotosGrid');
      const countSpan = document.getElementById('formProdPhotoCount');
      const base64Input = document.getElementById('formProdPhotoBase64');
      if (!box || !grid) return;

      if (pendingPhotosList.length === 0) {
        if (base64Input) base64Input.value = '';
        if (countSpan) countSpan.textContent = '0';
        grid.replaceChildren();
        box.style.display = previewProduct ? 'block' : 'none';
        if (previewProduct) {
          const preview = document.createElement('button');
          preview.type = 'button';
          preview.style.cssText = 'grid-column:1/-1;background:white;padding:12px;border:0;border-radius:12px';
          preview.setAttribute('aria-label', 'enlarge_image_shown_in_catalog'.tr);
          const image = document.createElement('img');
          image.src = previewProduct.imageFallbackUrl || '/store-assets/placeholder.svg';
          image.alt = previewProduct.name || previewProduct.descricao || 'product_image'.tr;
          image.style.cssText = 'display:block;width:100%;height:240px;object-fit:contain';
          const caption = document.createElement('p');
          caption.textContent = 'illustrative_catalog_image_add_real_photos_to_set_the_cover_for_this_product'.tr;
          preview.append(image, caption);
          preview.onclick = () => openProductPhoto(image.src, image.alt);
          grid.appendChild(preview);
        }
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
            '<img src="' + escapeHtml(imgSrc) + '" style="width:100%; height:100%; object-fit:cover;" alt="Foto" />' +
            badge +
          '</div>' +
          '<div style="font-size:10px; font-weight:bold; color:#334155; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:center;" title="' + escapeHtml(label) + '">' +
            escapeHtml(label) +
          '</div>' +
          '<div style="display:flex; gap:4px; width:100%; justify-content:center; margin-top:2px;">' +
            capaBtn +
            '<button type="button" onclick="removePendingPhoto(' + index + ')" title="Remover esta foto" style="font-size:10px; padding:2px 6px; border:1px solid #fecaca; border-radius:4px; background:#fef2f2; color:#dc2626; cursor:pointer;">🗑️</button>' +
          '</div>';

        if (isPrimary) card.style.gridColumn = '1 / -1';
        const preview = card.querySelector('img');
        preview.parentElement.style.height = isPrimary ? '280px' : '120px';
        preview.style.objectFit = 'contain';
        const expand = document.createElement('button');
        expand.type = 'button';
        expand.setAttribute('aria-label', 'Ampliar foto ' + (index + 1));
        expand.style.cssText = 'display:block;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:zoom-in';
        preview.replaceWith(expand);
        expand.appendChild(preview);
        expand.onclick = () => openProductPhoto(imgSrc, label);
        const actions = card.lastElementChild;
        [-1, 1].forEach(direction => {
          const move = document.createElement('button');
          move.type = 'button';
          move.textContent = direction < 0 ? '←' : '→';
          move.title = direction < 0 ? 'Mover foto antes' : 'Mover foto depois';
          move.disabled = index + direction < 0 || index + direction >= pendingPhotosList.length;
          move.onclick = () => {
            [pendingPhotosList[index], pendingPhotosList[index + direction]] = [pendingPhotosList[index + direction], pendingPhotosList[index]];
            renderPendingPhotosGrid();
          };
          actions.appendChild(move);
        });
        grid.appendChild(card);
      });
    }

    function openProductPhoto(url, label) {
      const dialog = document.createElement('dialog');
      dialog.setAttribute('aria-label', 'enlarged_product_photo'.tr);
      dialog.style.cssText = 'position:fixed;inset:0;margin:auto;width:100vw;height:100dvh;max-width:none;max-height:none;padding:20px;border:0;background:#101810;color:white';
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'Fechar ✕';
      close.style.cssText = 'position:absolute;right:20px;top:20px;padding:12px 20px;z-index:1;border-radius:24px;background:white;color:#123b25';
      close.onclick = () => dialog.close();
      const image = document.createElement('img');
      image.src = url;
      image.alt = label;
      image.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;cursor:zoom-in';
      image.onclick = () => {
        const zoomed = image.dataset.zoomed === 'true';
        image.dataset.zoomed = String(!zoomed);
        image.style.cssText = zoomed ? 'display:block;width:100%;height:100%;object-fit:contain;cursor:zoom-in' : 'display:block;max-width:none;width:auto;height:auto;cursor:zoom-out';
      };
      dialog.append(close, image);
      dialog.addEventListener('close', () => dialog.remove(), { once: true });
      document.body.appendChild(dialog);
      dialog.showModal();
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

      const name = document.getElementById('formProdName').value || 'catalog_product_singular'.tr;
      const id = document.getElementById('formProdId').value || 'novo';
      const oversizedFile = files.find((file) => file.size > 20 * 1024 * 1024);
      if (oversizedFile) {
        alert('each_photo_must_be_up_to_20_mb_the_original_file_will_be_preserved'.tr);
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
      renderPendingPhotosGrid();
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
      document.getElementById('formProdRealPhotoConfirmed').checked = false;
      document.getElementById('formProdMediaConfirmed').checked = false;
      document.getElementById('formProdMediaLicense').value = '';
      document.getElementById('formProdMediaLicenseUrl').value = '';
      document.getElementById('formProdMediaAttribution').value = '';
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

      // Reuse the catalog image resolver for legacy fields and Storage paths.
      clearAllPendingPhotos();
      previewProduct = p;
      document.getElementById('deleteEditingProduct').hidden = false;
      const existingImgs = window.ConfloraProductCard?.getImageCandidates(p) || [];
      existingImgs.forEach((url, i) => {
        pendingPhotosList.push({
          url,
          dataUrl: url,
          fileName: (p.imageFileId || slugifyClient(p.descricao || p.name)) + (i > 0 ? '_' + i : '') + '.jpg',
          isExisting: true,
        });
      });
      renderPendingPhotosGrid();

      document.getElementById('productFormTitle').textContent = 'edit_product_6c8ac6'.tr + p.id;
      document.getElementById('productEditorDialog').showModal();
    }

    let returnToStock = false;
    function openNewProductDialog() {
      returnToStock = false;
      showTab('products');
      resetProdForm();
      document.getElementById('productFormTitle').textContent = 'new_product_in_the_catalog'.tr;
      document.getElementById('productEditorDialog').showModal();
      document.getElementById('formProdName').focus();
    }

    function closeProductEditorDialog() {
      const dialog = document.getElementById('productEditorDialog');
      if (dialog?.open) dialog.close();
      resetProdForm();
      if (returnToStock) { returnToStock = false; showTab('stock'); }
    }

    function resetProdForm() {
      previewProduct = null;
      document.getElementById('deleteEditingProduct').hidden = true;
      document.getElementById('prodForm').reset();
      document.getElementById('formProdId').value = '';
      document.getElementById('formProdUnit').value = 'UN';
      productUnitTouched = false;
      syncProductStockStep();
      document.getElementById('formProdPhotoBase64').value = '';
      document.getElementById('formProdTags').value = '';
      clearAllPendingPhotos();
      document.getElementById('productFormTitle').textContent = 'new_product_in_catalog'.tr;
    }

    async function deleteProduct(id) {
      if (!confirm('do_you_want_to_delete_this_product_and_its_photos'.tr)) return;
      const response = await window.ConfloraSession.apiFetch('/api/admin/products/' + id, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) {
        alert('could_not_delete_product'.tr + (result.error || 'failed_to_remove_product'.tr));
        return;
      }
      closeProductEditorDialog();
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
        expectedUpdatedAt: savedProduct?.updatedAt,
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
        externalMedia: externalImgs.map(url => ({ url, licenseCode: document.getElementById('formProdMediaLicense').value,
          licenseUrl: document.getElementById('formProdMediaLicenseUrl').value.trim(), attribution: document.getElementById('formProdMediaAttribution').value.trim(),
          productMatchConfirmed: document.getElementById('formProdMediaConfirmed').checked, rightsConfirmed: document.getElementById('formProdMediaConfirmed').checked })),
      };

      if (newUploads.length && !document.getElementById('formProdRealPhotoConfirmed')?.checked) throw new Error('Confirme a origem das fotos reais do produto antes de enviar.');
      const res = await window.ConfloraSession.apiFetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Product-Content-Confirmed': 'true' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        document.getElementById('formProdId').value = id;
        try {
          for (const upload of newUploads) {
            const photoResponse = await window.ConfloraSession.apiFetch('/api/admin/products/' + encodeURIComponent(id) + '/photo', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/octet-stream',
                'X-Photo-Content-Type': upload.file.type || 'image/jpeg',
                'X-Photo-Append': 'true',
                'X-Photo-Actual-Product': 'true',
              },
              body: upload.file,
            });
            const photoResult = await photoResponse.json();
            if (!photoResponse.ok || !photoResult.success) {
              throw new Error(photoResult.error || 'could_not_upload_one_of_the_photos'.tr);
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
          if (newUploads.length || storedImages.length) {
            const finalResponse = await window.ConfloraSession.apiFetch('/api/admin/products', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Product-Photos-Update': 'true' },
              body: JSON.stringify({
                ...payload,
                images: finalImages,
                imageUrl: finalImages[0] || '',
              }),
            });
            const finalResult = await finalResponse.json();
            if (!finalResponse.ok || !finalResult.success) {
              throw new Error(finalResult.error || 'could_not_complete_photo_replacement'.tr);
            }
          }
        } catch (error) {
          renderPendingPhotosGrid();
          loadAdminProducts();
          alert('product_saved_but_could_not_complete_the_photo_cycle'.tr + error.message + '. Tente novamente.');
          return;
        }
        if (!returnToStock) alert('product_saved_and_photos_uploaded_to_firebase_storage_in_high_quality_for_zoom'.tr);
        document.getElementById('productEditorDialog').close();
        resetProdForm();
        loadAdminProducts();
        loadPriceProducts();
        if (returnToStock) { returnToStock = false; showTab('stock'); }
      } else {
        alert('error_saving_to_firestore'.tr + (data.error || 'Falha'));
      }
    }

    // 11. HISTÓRICO GERAL DE PEDIDOS
    async function loadAllOrders() {
      const container = document.getElementById('allOrdersListContainer');
      try {
        const res = await window.ConfloraSession.apiFetch('/api/admin/orders');
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
              <strong>#\${(o.id || '').slice(-6)} — \${o.customerName || 'customer'.tr}</strong> (\${o.customerPhone || 'Presencial'})<br>
              <span style="font-size:12px; color:#64748b;">Itens: \${itemsTxt}</span><br>
              <span style="font-size:12px; color:#64748b;">\${o.deliveryAddress || 'cart_pickup_option'.tr} • \${o.paymentMethod || 'PIX'} • \${new Date(o.createdAt).toLocaleString()}</span>
            </div>
            <div style="text-align:right;">
              <span class="badge \${o.status === 'CONFIRMED' ? 'badge-confirmed' : (o.status === 'DELIVERED' ? 'badge-delivered' : 'badge-pending')}">\${o.status}</span>
              <div style="font-weight:bold; color:#15803d; font-size:15px; margin-top:4px;">R$ \${Number(o.total || 0).toFixed(2).replace('.', ',')}</div>
            </div>
          \`;
          container.appendChild(div);
        });
      } catch (err) {
        container.innerHTML = 'error_loading_history'.tr + escapeHtml(err.message);
      }
    }

    // 12. VENDA MANUAL NO BALCÃO
    async function openManualOrderModal() {
      if (!allProducts.length) {
        try {
          const response = await window.ConfloraSession.apiFetch('/api/inventory');
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'could_not_load_products_637303'.tr);
          allProducts = safeExtractProductsAdmin(data);
        } catch (error) {
          alert(error.message || 'could_not_load_products_for_sale'.tr);
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
        alert('no_products_available_to_register_the_sale'.tr);
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
        const response = await window.ConfloraSession.apiFetch('/api/admin/orders/manual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerName: name, customerPhone: phone, items, paymentMethod: pay })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'could_not_register_the_sale'.tr);

        alert(result.order?.paymentMethod === 'PIX' ? 'Pedido registrado. Abra a comanda para acompanhar ou conferir o Pix.' : 'sale_successfully_registered_at_the_cash_register'.tr);
        closeManualOrderModal();
        loadCashierDaily();
      } catch (error) {
        alert(error.message || 'could_not_register_the_sale'.tr);
      }
    }

    document.getElementById('runSicrediSimulation').addEventListener('click', async event => {
      const button = event.currentTarget;
      const status = document.getElementById('sicrediSimulationStatus');
      button.disabled = true;
      status.textContent = 'validating_simulation'.tr;
      try {
        const response = await window.ConfloraSession.apiFetch('/api/admin/sicredi-pix/simulate', { method: 'POST',
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unitPrice: 45, quantity: 2 }) });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'simulation_failed'.tr);
        status.textContent = 'simulation_completed_fixed_qr_code_payment_verified_stock_deducted_once_no_real_data_'.tr;
      } catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; }
    });

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
