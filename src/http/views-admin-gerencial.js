// Painel gerencial diário da Conflora, usado para revisão e fechamento do caixa.

function renderAdminGerencialHtml() {
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
  <title>Conflora — Fechamento diário</title>
  <link rel="stylesheet" href="/store-assets/site-header.css">
  <link rel="stylesheet" href="/store-assets/design-system.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #2e9348;
      --primary-hover: #25783b;
      --primary-light: #dcfce7;
      --primary-dark: #14532d;
      --pix: #2e9348;
      --card: #71ad7f;
      --cash: #9cc9a5;
      --bg: #f4f7f4;
      --surface: #ffffff;
      --border: #e5e7eb;
      --text: #1a1a1a;
      --muted: #647067;
      --danger: #dc2626;
      --radius: 10px;
      --shadow-sm: 0 1px 3px rgba(31, 55, 37, 0.06);
      --shadow: 0 2px 8px rgba(31, 55, 37, 0.07);
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
      overflow-x: hidden;
    }
    header {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: none;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-action {
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      border: 1px solid var(--border);
      background: #fff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      color: var(--text);
      transition: all 0.15s ease;
    }
    .btn-action:hover { background: #f3f6f3; }
    .btn-action.primary {
      background: var(--primary);
      color: #fff;
      border-color: var(--primary);
    }
    .btn-action.primary:hover { background: var(--primary-hover); }
    #btnSendReport[hidden] { display: none; }
    .btn-action:focus-visible { outline: 3px solid #b8ddc1; outline-offset: 2px; }

    .main-container {
      max-width: 1600px;
      width: 100%;
      margin: 0 auto;
      padding: 20px 16px 40px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* BARRA DE CONTROLE E DATA */
    .toolbar {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      min-width: 0;
    }
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .date-filter {
      display: inline-flex;
      flex: 0 0 auto;
      overflow: hidden;
      border-radius: 8px;
    }
    .date-filter .btn-action {
      min-height: 44px;
      border-radius: 0;
    }
    .date-filter .date-today {
      min-width: 82px;
      justify-content: center;
      border-radius: 8px 0 0 8px;
      padding-inline: 14px;
    }
    .date-filter .date-calendar {
      width: 44px;
      justify-content: center;
      border-left: 1px solid rgba(255,255,255,0.35);
      border-radius: 0 8px 8px 0;
      padding: 0;
    }
    .date-filter .btn-action:hover { background: var(--primary-hover); }
    .native-date-picker {
      position: fixed;
      width: 1px;
      height: 1px;
      padding: 0;
      border: 0;
      opacity: 0;
      overflow: hidden;
      clip-path: inset(50%);
      pointer-events: none;
    }
    .icon-button {
      width: 44px;
      min-width: 44px;
      height: 44px;
      padding: 0;
      justify-content: center;
    }
    .button-icon {
      display: block;
      width: 18px;
      height: 18px;
      flex: 0 0 auto;
    }
    #btnRefresh.is-loading .button-icon { animation: spin 0.8s linear infinite; }
    .close-day-button {
      min-height: 44px;
      padding-inline: 16px;
    }
    .shortcut-hint {
      margin-left: 4px;
      padding: 3px 6px;
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 5px;
      color: rgba(255,255,255,0.9);
      font: inherit;
      font-size: 10px;
      font-weight: 500;
      white-space: nowrap;
    }

    /* CARDS DE RESUMO NO TOPO */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }
    .summary-card {
      background: #fff;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      padding: 16px 18px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
    }
    .summary-card::before { content: none; }

    .summary-label {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .summary-val {
      font-size: 25px;
      font-weight: 700;
      color: var(--primary);
      letter-spacing: -0.35px;
    }
    /* LAYOUT DE 2 COLUNAS PARA MÉTRICAS DETALHADAS */
    .details-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
    }
    .panel-card {
      background: #fff;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      padding: 20px;
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #edf1ed;
      padding-bottom: 10px;
    }
    .panel-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .panel-tag {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      background: #f3f7f3;
      color: var(--muted);
    }

    /* BARRA DE PARTICIPAÇÃO DE PAGAMENTO */
    .payment-bar {
      height: 14px;
      border-radius: 7px;
      background: #e2e8f0;
      display: flex;
      overflow: hidden;
      margin-top: 6px;
    }
    .payment-bar-seg {
      height: 100%;
      transition: width 0.3s ease;
    }
    .payment-bar-seg.pix { background: var(--pix); }
    .payment-bar-seg.card { background: var(--card); }
    .payment-bar-seg.cash { background: var(--cash); }
    .payment-bar-seg.debit { background: #86b991; }
    .payment-bar-seg.credit { background: #b2d3b8; }
    .payment-bar-seg.account { background: #d4e6d7; }

    .payment-legend {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-top: 8px;
    }
    .legend-item {
      padding: 10px;
      background: #f8fbf8;
      border-radius: 8px;
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .legend-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .legend-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }
    .legend-val {
      font-size: 15px;
      font-weight: 800;
      color: var(--text);
    }
    .legend-sub {
      font-size: 10.5px;
      color: var(--muted);
    }

    /* LISTA DE COLABORADORES & RANKING */
    .ranking-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ranking-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 12px;
      border-radius: 8px;
      background: #f8fbf8;
      border: 1px solid #edf1ed;
      gap: 12px;
    }
    .ranking-info {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 0;
    }
    .ranking-rank {
      font-size: 12px;
      font-weight: 800;
      color: var(--muted);
      width: 20px;
    }
    .ranking-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--primary-dark);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ranking-meta {
      font-size: 11px;
      color: var(--muted);
    }
    .ranking-values {
      text-align: right;
    }
    .ranking-val {
      font-size: 13.5px;
      font-weight: 700;
      color: var(--primary);
    }
    .metric-empty { color: var(--muted); font-size: 13px; padding: 10px; }
    .metric-loading { opacity: 0.6; pointer-events: none; }
    /* LOADING & SKELETON */
    .loading-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* TOAST */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f172a;
      color: #fff;
      padding: 12px 20px;
      border-radius: 30px;
      font-size: 13px;
      font-weight: 600;
      z-index: 2000;
      box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    }
    .toast.hidden { display: none; }
    @media (max-width: 1000px) {
      header { flex-wrap: wrap; padding: 12px 16px; }
      .header-actions { width: 100%; flex-wrap: wrap; }
      .main-container { padding: 14px 14px 28px; gap: 14px; }
      .summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 760px) {
      .details-grid { grid-template-columns: minmax(0, 1fr); }
      .toolbar { align-items: stretch; }
      .toolbar-right { flex-wrap: wrap; }
    }
    @media (max-width: 600px) {
      header { position: static; gap: 10px; }
      .header-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .header-actions .btn-action { min-height: 42px; justify-content: center; padding: 8px; font-size: 11px; }
      .header-actions #btnSendReport { grid-column: 1 / -1; }
      .main-container { width: 100%; min-width: 0; padding: 12px 10px calc(20px + env(safe-area-inset-bottom)); }
      .toolbar { padding: 0; gap: 8px; }
      .toolbar-right { display: grid; width: 100%; min-width: 0; grid-template-columns: minmax(0, 1fr) 44px; gap: 8px; }
      .date-filter { width: 100%; }
      .date-filter .date-today { flex: 1; }
      .toolbar-right #btnRefresh { grid-column: 2; grid-row: 1; }
      .toolbar-right #btnCloseCash { grid-column: 1 / -1; justify-content: center; }
      .shortcut-hint { display: none; }
      .summary-grid { width: 100%; min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .summary-card, .details-grid, .panel-card { min-width: 0; }
      .summary-card { padding: 12px; }
      .summary-val { font-size: clamp(16px, 5.5vw, 21px); }
      .summary-label { font-size: 10px; line-height: 1.3; }
      .details-grid { grid-template-columns: minmax(0, 1fr); gap: 10px; }
      .panel-card { padding: 14px; gap: 12px; }
      .panel-header { align-items: flex-start; gap: 8px; flex-wrap: wrap; }
      .panel-title { font-size: 14px; }
      .payment-legend { grid-template-columns: minmax(0, 1fr); }
      .legend-item { display: grid; grid-template-columns: 1fr auto; align-items: center; }
      .legend-title { grid-column: 1; }
      .legend-val { grid-column: 2; grid-row: 1 / span 2; }
      .legend-sub { grid-column: 1; }
      .toast { bottom: calc(14px + env(safe-area-inset-bottom)); max-width: calc(100vw - 24px); text-align: center; }
      button, .btn-action { min-height: 42px; }
    }
  </style>
</head>
<body>

  <!-- CABEÇALHO -->
  <header class="conflora-site-header">
    <a href="/" class="conflora-site-brand" aria-label="Conflora — página inicial">
      <img src="/store-assets/brands/conflora-logo.png" alt="" />
      <span><strong>Conflora Horta e Viveiro</strong><small>Mineiros - GO</small></span>
    </a>
    <span class="conflora-site-header__context">Fechamento diário</span>

    <div class="header-actions">
      <a href="/caixa" class="btn-action">Ir ao Caixa / PDV</a>
      <a href="/admin" class="btn-action">Admin completo</a>
      <button id="btnSendReport" class="btn-action primary" onclick="sendDailyReport()" hidden>Enviar para Júnior</button>
    </div>
  </header>

  <!-- CONTEÚDO PRINCIPAL -->
  <div class="main-container">

    <!-- DATA DO FECHAMENTO -->
    <div class="toolbar">
      <div class="toolbar-right">
        <div class="date-filter" role="group" aria-label="Data do fechamento">
          <button type="button" id="dateTodayButton" class="btn-action primary date-today" onclick="setReportDateToday()"><span id="dateButtonLabel">HOJE</span></button>
          <button type="button" class="btn-action primary date-calendar" onclick="openReportDatePicker()" aria-label="Selecionar outra data" title="Selecionar outra data">
            <svg class="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>
          </button>
        </div>
        <input type="date" id="reportDate" class="native-date-picker" aria-label="Selecionar data do fechamento" onchange="handleReportDateChange()" />
        <button type="button" id="btnRefresh" class="btn-action icon-button" onclick="loadExecutiveMetrics()" aria-label="Atualizar dados" title="Atualizar dados">
          <svg class="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9A7 7 0 0 1 18 6.5L20 12M4 12l2 5.5A7 7 0 0 0 18.4 15"/></svg>
        </button>
        <button type="button" id="btnCloseCash" class="btn-action primary close-day-button" onclick="registerCashClosing()" aria-keyshortcuts="Control+Shift+Enter" title="Atalho: Ctrl + Shift + Enter">
          <span>Registrar fechamento</span><kbd class="shortcut-hint">Ctrl + Shift + Enter</kbd>
        </button>
      </div>
    </div>

    <!-- INDICADORES DO DIA -->
    <div class="summary-grid">
      <div class="summary-card highlight">
        <div class="summary-label">Recebimento de dívida</div>
        <div class="summary-val" id="cardDebtReceived">R$ 0,00</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Vendas a receber · Fiado</div>
        <div class="summary-val" id="cardOnAccount">R$ 0,00</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Quantidade de vendas</div>
        <div class="summary-val" id="cardCount">0</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Ticket médio</div>
        <div class="summary-val" id="cardTicket">R$ 0,00</div>
      </div>
      <div class="summary-card cash">
        <div class="summary-label">Troco + vendas em dinheiro</div>
        <div class="summary-val" id="cardCashTendered">R$ 0,00</div>
      </div>
      <div class="summary-card pix">
        <div class="summary-label">Pix recebido</div>
        <div class="summary-val" id="cardPix">R$ 0,00</div>
      </div>
      <div class="summary-card card">
        <div class="summary-label">Cartão de crédito</div>
        <div class="summary-val" id="cardCredit">R$ 0,00</div>
      </div>
      <div class="summary-card card">
        <div class="summary-label">Cartão de débito</div>
        <div class="summary-val" id="cardDebit">R$ 0,00</div>
      </div>
      <div class="summary-card cash">
        <div class="summary-label">Troco do dia</div>
        <div class="summary-val" id="cardChange">R$ 0,00</div>
      </div>
      <div class="summary-card cash">
        <div class="summary-label">Vendas em dinheiro</div>
        <div class="summary-val" id="cardCashSales">R$ 0,00</div>
      </div>
      <div class="summary-card highlight">
        <div class="summary-label">Total recebido · Vendas</div>
        <div class="summary-val" id="cardTotalReceived">R$ 0,00</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Caderno · Vendas + recebimentos</div>
        <div class="summary-val" id="cardLedger">R$ 0,00</div>
      </div>
    </div>

    <!-- COMPOSIÇÃO DOS RECEBIMENTOS E VENDAS POR COLABORADOR -->
    <div class="details-grid">
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Formas de pagamento</div>
          <span class="panel-tag">Participação nas vendas</span>
        </div>
        <div class="payment-bar" id="paymentBar">
          <div class="payment-bar-seg pix" data-method="PIX"></div>
          <div class="payment-bar-seg cash" data-method="DINHEIRO"></div>
          <div class="payment-bar-seg debit" data-method="DEBITO"></div>
          <div class="payment-bar-seg credit" data-method="CREDITO"></div>
          <div class="payment-bar-seg card" data-method="CARTAO"></div>
          <div class="payment-bar-seg account" data-method="FIADO"></div>
          <div class="payment-bar-seg account" data-method="OUTROS"></div>
        </div>
        <div class="payment-legend">
          <div id="paymentBreakdown" style="display:contents;"></div>
        </div>
      </div>

      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Vendas por colaborador</div>
          <span class="panel-tag">Vendedor e recebedor</span>
        </div>
        <div class="ranking-list" id="collaboratorList"><div class="metric-empty">Carregando equipe...</div></div>
      </div>
    </div>

    <!-- RANKINGS DE PRODUTO -->
    <div class="details-grid">
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Mais vendidos por quantidade</div>
          <span class="panel-tag">5 produtos</span>
        </div>
        <div class="ranking-list" id="topProductsQuantity"><div class="metric-empty">Carregando produtos...</div></div>
      </div>
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">Mais vendidos por valor</div>
          <span class="panel-tag">5 produtos</span>
        </div>
        <div class="ranking-list" id="topProductsValue"><div class="metric-empty">Carregando produtos...</div></div>
      </div>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>

  <!-- Interações do painel -->
  <script>
    document.addEventListener('DOMContentLoaded', initializeDashboard);
    document.addEventListener('keydown', handleDashboardShortcut);

    async function initializeDashboard() {
      document.getElementById('reportDate').value = getBusinessToday();
      updateDateButtonLabel();
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (response.ok && data.user && data.user.role === 'ADMIN') {
          document.getElementById('btnSendReport').hidden = false;
          await loadExecutiveMetrics();
          return;
        }
        showToast('Painel disponível somente para ADMIN.');
        document.querySelector('.main-container').innerHTML = '<div class="panel-card"><strong>Acesso restrito</strong><span>Entre com uma conta ADMIN para consultar o fechamento diário.</span></div>';
      } catch (_) {
        showToast('Não foi possível validar seu acesso. Entre novamente.');
      }
    }

    function getBusinessToday() {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
      }).formatToParts(new Date());
      const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
      return values.year + '-' + values.month + '-' + values.day;
    }

    function formatReportDate(date) {
      const parts = String(date || '').split('-');
      return parts.length === 3 ? parts[2] + '/' + parts[1] + '/' + parts[0] : 'HOJE';
    }

    function updateDateButtonLabel() {
      const date = document.getElementById('reportDate').value;
      const isToday = date === getBusinessToday();
      const todayButton = document.getElementById('dateTodayButton');
      document.getElementById('dateButtonLabel').textContent = isToday ? 'HOJE' : formatReportDate(date);
      todayButton.setAttribute('aria-label', isToday ? 'Hoje. Clique para atualizar o dia atual.' : 'Data ' + formatReportDate(date) + '. Clique para voltar para hoje.');
      todayButton.title = isToday ? 'Atualizar para hoje' : 'Voltar para hoje';
    }

    function setReportDateToday() {
      document.getElementById('reportDate').value = getBusinessToday();
      updateDateButtonLabel();
      loadExecutiveMetrics();
    }

    function handleReportDateChange() {
      updateDateButtonLabel();
      loadExecutiveMetrics();
    }

    function openReportDatePicker() {
      const input = document.getElementById('reportDate');
      if (typeof input.showPicker === 'function') {
        try {
          input.showPicker();
          return;
        } catch (_) {}
      }
      input.focus();
      input.click();
    }

    function handleDashboardShortcut(event) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key !== 'Enter' || event.repeat) { return; }
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) { return; }
      const button = document.getElementById('btnCloseCash');
      if (!button || button.disabled) { return; }
      event.preventDefault();
      registerCashClosing();
    }

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      setTimeout(() => t.classList.add('hidden'), 3500);
    }

    const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
    const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

    async function loadExecutiveMetrics() {
      const date = document.getElementById('reportDate').value || getBusinessToday();
      document.querySelector('.main-container').classList.add('metric-loading');
      const refreshButton = document.getElementById('btnRefresh');
      refreshButton.disabled = true;
      refreshButton.classList.add('is-loading');
      try {
        const res = await fetch('/api/admin/executive-metrics?date=' + encodeURIComponent(date));
        if (res.status === 401 || res.status === 403) {
          showToast('Acesso restrito ao Administrador.');
          return;
        }
        const data = await res.json();
        if (!res.ok) { throw new Error(data.error || 'Não foi possível carregar o resumo.'); }
        renderMetrics(data);
      } catch (err) {
        showToast('Erro ao carregar dados do dia: ' + err.message);
      } finally {
        document.querySelector('.main-container').classList.remove('metric-loading');
        refreshButton.disabled = false;
        refreshButton.classList.remove('is-loading');
      }
    }

    function renderMetrics(m) {
      if (!m) return;
      document.getElementById('cardCount').textContent = m.orderCount || 0;
      const values = {
        cardDebtReceived: m.debtReceived,
        cardOnAccount: m.onAccountSales,
        cardTicket: m.ticketMedio,
        cardCashTendered: m.cashTendered,
        cardPix: m.byPayment?.PIX?.total,
        cardCredit: m.byPayment?.CREDITO?.total,
        cardDebit: m.byPayment?.DEBITO?.total,
        cardChange: m.changeGiven,
        cardCashSales: m.cashSales,
        cardTotalReceived: m.totalReceivedSales,
        cardLedger: m.ledgerVolume,
      };
      Object.entries(values).forEach(([id, value]) => { document.getElementById(id).textContent = formatCurrency(value); });
      renderPaymentBreakdown(m);
      renderCollaborators(m.byCollaborator || []);
      renderProducts('topProductsQuantity', m.topProductsByQuantity || []);
      renderProducts('topProductsValue', m.topProductsByValue || []);
    }

    function renderPaymentBreakdown(metrics) {
      const methods = [
        ['PIX', 'Pix', 'var(--pix)'], ['DINHEIRO', 'Dinheiro', 'var(--cash)'],
        ['DEBITO', 'Cartão de débito', '#86b991'], ['CREDITO', 'Cartão de crédito', '#b2d3b8'],
        ['FIADO', 'Fiado', '#d4e6d7'], ['CARTAO', 'Cartão (não especificado)', 'var(--card)'],
      ];
      const payments = metrics.byPayment || {};
      const total = Number(metrics.totalRevenue || 0);
      document.querySelectorAll('#paymentBar [data-method]').forEach((bar) => {
        const amount = Number(payments[bar.dataset.method]?.total || 0);
        bar.style.width = (total > 0 ? (amount / total) * 100 : 0) + '%';
      });
      document.getElementById('paymentBreakdown').innerHTML = methods.map(([key, label, color]) => {
        const payment = payments[key] || { total: 0, count: 0 };
        const percent = total > 0 ? Math.round((Number(payment.total || 0) / total) * 100) : 0;
        return '<div class="legend-item"><div class="legend-title"><span class="legend-dot" style="background:' + color + ';"></span>' + label + '</div><div class="legend-val">' + formatCurrency(payment.total) + '</div><div class="legend-sub">' + (payment.count || 0) + ' venda(s) · ' + percent + '%</div></div>';
      }).join('');
    }

    function renderCollaborators(collabs) {
      const container = document.getElementById('collaboratorList');
      if (!collabs.length) {
        container.innerHTML = '<div class="metric-empty">Nenhum colaborador cadastrado.</div>';
        return;
      }
      container.innerHTML = collabs.map((person, index) => '<div class="ranking-row"><div class="ranking-info"><span class="ranking-rank">' + (index + 1) + 'º</span><div><div class="ranking-name">' + escapeHtml(person.name) + '</div><div class="ranking-meta">' + escapeHtml(person.role) + ' · ' + (person.count || 0) + ' venda(s) · ' + (person.percentage || 0) + '% das vendas · recebeu ' + (person.receivedCount || 0) + ' vez(es)</div></div></div><div class="ranking-values"><div class="ranking-val">' + formatCurrency(person.total) + '</div><div class="ranking-meta">Recebeu ' + formatCurrency(person.receivedTotal) + '</div></div></div>').join('');
    }

    function renderProducts(containerId, products) {
      const container = document.getElementById(containerId);
      if (!products.length) {
        container.innerHTML = '<div class="metric-empty">Nenhum produto vendido nesta data.</div>';
        return;
      }
      container.innerHTML = products.map((product, index) => '<div class="ranking-row"><div class="ranking-info"><span class="ranking-rank" style="color:var(--primary);">' + (index + 1) + 'º</span><div><div class="ranking-name" title="' + escapeHtml(product.name) + '">' + escapeHtml(product.name) + '</div><div class="ranking-meta">' + escapeHtml(product.category || 'Geral') + ' · ' + product.quantity + ' unidade(s)</div></div></div><div class="ranking-values"><div class="ranking-val">' + formatCurrency(product.revenue) + '</div></div></div>').join('');
    }

    async function sendDailyReport() {
      const button = document.getElementById('btnSendReport');
      const originalText = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="loading-spinner"></span> Enviando relatório...';
      try {
        const response = await fetch('/api/admin/executive-metrics/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: document.getElementById('reportDate').value }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Falha ao enviar o relatório.');
        showToast('Relatório enviado para Júnior pelo WhatsApp.');
      } catch (err) {
        showToast('Não foi possível enviar: ' + err.message);
      } finally {
        button.innerHTML = originalText;
        button.disabled = false;
      }
    }

    async function registerCashClosing() {
      const date = document.getElementById('reportDate').value;
      if (!date || !window.confirm('Registrar o fechamento do caixa de ' + date.split('-').reverse().join('/') + '?')) return;
      const button = document.getElementById('btnCloseCash');
      const originalText = button.innerHTML;
      button.disabled = true;
      button.textContent = 'Registrando fechamento...';
      try {
        const response = await fetch('/api/admin/cashier/close-day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Não foi possível registrar o fechamento.');
        showToast('Fechamento de ' + date.split('-').reverse().join('/') + ' registrado.');
      } catch (error) {
        showToast('Não foi possível registrar: ' + error.message);
      } finally {
        button.innerHTML = originalText;
        button.disabled = false;
      }
    }
  </script>
</body>
</html>
`;
}

module.exports = {
  renderAdminGerencialHtml,
};
