require('../i18n/default');
// Painel gerencial diário da Conflora, usado para revisão e fechamento do caixa.

function renderAdminGerencialHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<script src="/store-assets/i18n-runtime.js"></script>
  <meta charset="UTF-8">
  <script src="/store-assets/error-monitor.js"></script>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Conflora — Fechamento diário</title>
  <script src="/store-assets/tab-session.js"></script>
  <link rel="stylesheet" href="/store-assets/site-header.css?v=topbar-1">
  <script src="/store-assets/site-navigation.js?v=1"></script>
  <script src="/store-assets/topbar.js?v=3"></script>
  <script src="/store-assets/button-3d.js?v=1"></script>
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
    .period-analytics { gap: 16px; }
    .period-controls { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; }
    .period-presets { display: inline-flex; flex-wrap: wrap; gap: 6px; }
    .period-presets button, .period-refresh { min-height: 40px; }
    .period-date { display: grid; gap: 4px; color: var(--muted); font-size: 10px; font-weight: 750; text-transform: uppercase; }
    .period-date input { min-height: 40px; padding: 7px 9px; border: 1px solid var(--border); border-radius: 8px; color: var(--text); font: inherit; font-size: 12px; text-transform: none; }
    .period-summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
    .period-metric { min-width: 0; padding: 13px 15px; border: 1px solid var(--border); border-radius: 10px; background: #fff; }
    .period-metric span, .period-metric small { display: block; color: var(--muted); font-size: 11px; }
    .period-metric strong { display: block; margin: 5px 0; color: var(--primary); font-size: clamp(18px, 2vw, 24px); overflow-wrap: anywhere; }
    .period-insight { padding: 13px; border: 1px solid #dce9df; border-radius: 10px; background: #f7fbf8; color: #173c26; }
    .period-list { display: grid; gap: 8px; }
    .period-row { display: grid; grid-template-columns: minmax(100px, 1fr) minmax(70px, 1.7fr) auto; align-items: center; gap: 9px; font-size: 11px; }
    .period-row-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .period-bar-track { height: 8px; overflow: hidden; border-radius: 999px; background: #edf2ee; }
    .period-bar-fill { height: 100%; border-radius: inherit; background: var(--primary); }
    .period-empty { color: var(--muted); font-size: 12px; }
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
      .period-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .period-metric { padding: 11px; }
      .period-controls { align-items: stretch; }
      .period-presets { width: 100%; }
      .period-presets button { flex: 1; }
      .period-date { flex: 1; min-width: 130px; }
      .period-refresh { width: 100%; justify-content: center; }
      .period-row { grid-template-columns: minmax(92px, 1fr) minmax(48px, 1fr) auto; gap: 6px; }
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
    /* Executive overview: numbers first, operational detail on demand. */
    .main-container.cf-work-body { max-width:1600px; padding-top:28px; padding-bottom:40px; }
    .executive-heading { margin-bottom:28px; }
    .executive-heading p { color:#138441; letter-spacing:.12em; font-size:11px; font-weight:800; margin-bottom:8px; }
    .executive-heading h1 { font-size:clamp(28px,4vw,40px); letter-spacing:-.04em; margin-bottom:8px; }
    .executive-heading span { color:var(--muted); font-size:14px; }
    .period-analytics { padding:24px; margin-bottom:24px; background:white; }
    .period-analytics h2,.seasonal-panel h2 { font-size:22px; letter-spacing:-.02em; }
    .period-summary-grid { grid-template-columns:repeat(3,minmax(0,1fr)); gap:16px; margin:22px 0; }
    .period-metric { padding:22px; border-radius:18px; background:#f5faf6; border:1px solid #e0ebe2; min-width:0; }
    .period-metric strong { display:block; font-size:clamp(25px,3vw,40px); letter-spacing:-.04em; font-variant-numeric:tabular-nums; line-height:1.2; margin:10px 0; overflow-wrap:anywhere; }
    .period-metric:first-child { background:#123c26; color:white; }
    .period-metric:first-child :is(span,strong,small) { color:white; }
    .period-metric small { display:block; line-height:1.5; }
    .details-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .details-grid > * { min-width:0; }
    .product-rankings { margin-top:20px; }
    .product-rankings h3,.period-analytics h3 { font-size:15px; margin-bottom:16px; }
    .product-number-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:16px; padding:12px 0; border-bottom:1px solid #edf1ee; font-size:13px; }
    .product-number-row span { overflow-wrap:anywhere; }
    .product-number-row strong { font-variant-numeric:tabular-nums; text-align:right; white-space:nowrap; }
    .year-highlight { display:grid; gap:8px; margin:20px 0; padding:24px; border-radius:18px; background:#f1f9f3; }
    .year-highlight strong { font-size:clamp(30px,5vw,48px); color:#123c26; letter-spacing:-.04em; font-variant-numeric:tabular-nums; }
    .seasonal-mobile-hint { display:none; }
    .period-evolution > summary { font-weight:700; cursor:pointer; }
    .period-evolution[open] > summary { margin-bottom:20px; }
    .seasonal-scroll { width:100%; overflow-x:auto; margin-top:20px; }
    .seasonal-table { width:100%; border-collapse:collapse; font-size:13px; }
    .seasonal-table :is(th,td) { padding:16px 12px; border-bottom:1px solid #e7eee9; text-align:left; vertical-align:top; }
    .seasonal-table th { color:#65756b; font-size:11px; text-transform:uppercase; letter-spacing:.04em; }
    .seasonal-table td:nth-child(2) { color:#123c26; font-weight:800; white-space:nowrap; }
    .seasonal-table td:first-child { text-transform:capitalize; font-weight:700; }
    .seasonal-panel { margin-bottom:24px; padding:24px; }
    .daily-closing { border:1px solid #dce6df; border-radius:18px; padding:20px; background:white; }
    .daily-closing > summary { cursor:pointer; font-size:16px; font-weight:800; padding:6px 0; }
    .daily-closing[open] > summary { margin-bottom:24px; }
    .period-date input { min-height:42px; border-radius:12px; border:1px solid #dbe5df; padding:8px 12px; }
    /* NAVEGAÇÃO DE VISÕES: FECHAMENTO vs RESULTADOS */
    .executive-tabs-wrap {
      display: inline-flex;
      background: #e7eee9;
      padding: 4px;
      border-radius: 12px;
      gap: 4px;
      margin-top: 14px;
      max-width: 100%;
      overflow-x: auto;
    }
    .view-tab-btn {
      padding: 10px 18px;
      border-radius: 9px;
      font-size: 13px;
      font-weight: 700;
      border: none;
      background: transparent;
      color: #3b5042;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      white-space: nowrap;
      transition: all 0.15s ease;
    }
    .view-tab-btn.active {
      background: #ffffff;
      color: #0f381e;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    }
    .view-tab-btn:hover:not(.active) {
      background: rgba(255,255,255,0.4);
    }

    /* PAINEL DE CONFERÊNCIA DE CAIXA */
    .closing-conference-panel {
      padding: 24px;
      margin-bottom: 24px;
      background: #ffffff;
      border-radius: 18px;
      border: 1px solid #dce6df;
    }
    .closing-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .closing-badge.open {
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .closing-badge.closed {
      background: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }

    .conference-box {
      margin-top: 18px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      background: #fafcfb;
    }
    .conference-header-row {
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
    .conference-row {
      display: grid;
      grid-template-columns: 2fr 1.2fr 1.5fr 1.2fr;
      padding: 14px 16px;
      align-items: center;
      border-bottom: 1px solid #eef2ef;
      background: #ffffff;
    }
    .conference-row:nth-child(even) {
      background: #fcfdfc;
    }
    .conference-total-row {
      display: grid;
      grid-template-columns: 2fr 1.2fr 1.5fr 1.2fr;
      padding: 16px;
      align-items: center;
      background: #eaf3ed;
      border-top: 2px solid #cbdcd0;
      font-weight: 800;
    }
    .col-method {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .method-icon {
      font-size: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: #f1f5f2;
    }
    .method-icon.cash { background: #fef3c7; }
    .method-icon.pix { background: #dcfce7; }
    .method-icon.card { background: #e0f2fe; }
    .method-icon.account { background: #f3e8ff; }
    .col-system {
      font-weight: 700;
      font-size: 15px;
      color: #1e293b;
    }
    .input-currency-wrapper {
      display: inline-flex;
      align-items: center;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      padding: 4px 10px;
      background: #ffffff;
      width: 100%;
      max-width: 180px;
      transition: border-color 0.15s ease;
    }
    .input-currency-wrapper:focus-within {
      border-color: #2e9348;
      box-shadow: 0 0 0 3px rgba(46, 147, 72, 0.15);
    }
    .input-currency-wrapper span {
      font-size: 13px;
      font-weight: 700;
      color: #64748b;
      margin-right: 4px;
    }
    .input-currency-wrapper input {
      border: none;
      outline: none;
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      width: 100%;
      background: transparent;
    }
    .diff-tag {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
    }
    .diff-tag.exact { background: #dcfce7; color: #15803d; }
    .diff-tag.surplus { background: #fef9c3; color: #854d0e; }
    .diff-tag.shortage { background: #fee2e2; color: #b91c1c; }

    /* ANEXO DE COMPROVANTE & OBSERVAÇÕES */
    .closing-extras-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 18px;
    }
    .proof-upload-card, .closing-notes-card {
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
      background: #ffffff;
    }
    .proof-label {
      display: block;
      font-size: 13px;
      font-weight: 800;
      color: #0f381e;
      margin-bottom: 6px;
    }
    .proof-dropzone {
      border: 2px dashed #94a3b8;
      background: #f8fafc;
      border-radius: 12px;
      padding: 24px 16px;
      text-align: center;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }
    .proof-dropzone:hover {
      background: #f1f5f9;
      border-color: #2e9348;
    }
    .proof-preview-wrapper {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #f8fafc;
      border-radius: 12px;
      padding: 12px;
      border: 1px solid #e2e8f0;
    }
    .proof-thumb {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
    }
    .closing-notes-textarea {
      width: 100%;
      height: 105px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px 12px;
      font-family: inherit;
      font-size: 13px;
      resize: vertical;
      outline: none;
    }
    .closing-notes-textarea:focus {
      border-color: #2e9348;
      box-shadow: 0 0 0 3px rgba(46, 147, 72, 0.15);
    }
    .closing-actions-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }
    .sales-audit-section {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
    }

    @media(max-width: 850px) {
      .conference-header-row, .conference-row, .conference-total-row {
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .col-method { margin-bottom: 4px; }
      .closing-extras-grid { grid-template-columns: 1fr; }
    }
    @media(max-width:700px) {
      .period-summary-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .period-metric { padding:14px; }
      .period-metric strong { font-size:25px; }
      .period-analytics,.seasonal-panel,.daily-closing { padding:16px; }
      .details-grid { grid-template-columns:minmax(0,1fr); }
      .product-number-row { grid-template-columns:minmax(0,1fr); gap:5px; }
      .product-number-row strong { text-align:left; }
      .seasonal-mobile-hint { display:block; }
      .seasonal-table { min-width:720px; }
      .period-row { min-width:0; }
      .period-presets { flex-wrap:wrap; }
    }
  </style>
</head>
<body>

  <!-- CABEÇALHO -->
  <conflora-topbar></conflora-topbar>
  <nav class="cf-work-actions" aria-label="Opções do painel gerencial">
    <span>Painel Gerencial</span>
    <button type="button" class="cf-back-button" data-site-back>← Voltar</button>
    <button id="btnSendReport" class="btn-action primary" onclick="sendDailyReport()" hidden>Enviar para Júnior</button>
  </nav>

  <!-- CONTEÚDO PRINCIPAL -->
  <div class="main-container cf-work-body">

    <section class="executive-heading">
      <div>
        <p>GESTÃO DA CONFLORA</p>
        <h1 id="executivePageTitle">Resultados da loja</h1>
        <span>Vendas, conferência de caixa e recebimentos. Os números que ajudam a decidir.</span>
      </div>
      <div class="executive-tabs-wrap" role="tablist">
        <button type="button" class="view-tab-btn active" id="btnTabClosing" onclick="switchExecutiveTab('closing')">
          <span>🔒</span> Fechamento & Conferência do Caixa
        </button>
        <button type="button" class="view-tab-btn" id="btnTabAnalytics" onclick="switchExecutiveTab('analytics')">
          <span>📊</span> Resultados e Períodos
        </button>
      </div>
    </section>

    <!-- ABA 1: CONFERÊNCIA E FECHAMENTO DE CAIXA -->
    <div id="viewClosing" class="executive-view">
      <section class="panel-card closing-conference-panel" id="fechamento" aria-labelledby="closingSectionTitle">
        <div class="panel-header" style="flex-wrap:wrap; gap:12px;">
          <div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
              <h2 class="panel-title" id="closingSectionTitle">Conferência de Caixa por Forma de Pagamento</h2>
              <span id="closingStatusBadge" class="closing-badge open">Caixa Aberto (Em Conferência)</span>
            </div>
            <p class="period-empty" style="margin-top:4px;">Confira os valores apurados pelo sistema com os valores físicos/extratos antes de encerrar o dia.</p>
          </div>
          
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
          </div>
        </div>

        <!-- TABELA DE CONFERÊNCIA: SISTEMA vs CONFERIDO -->
        <div class="conference-box">
          <div class="conference-header-row">
            <div class="col-method">Forma de Pagamento</div>
            <div class="col-system">Apurado Sistema</div>
            <div class="col-counted">Valor Conferido (Em Mãos/Extrato)</div>
            <div class="col-diff">Diferença</div>
          </div>

          <!-- DINHEIRO -->
          <div class="conference-row">
            <div class="col-method">
              <span class="method-icon cash">💵</span>
              <div>
                <strong>Dinheiro em Caixa</strong>
                <small id="subCashNotes">Vendas + troco do dia</small>
              </div>
            </div>
            <div class="col-system" id="sysValCash">R$ 0,00</div>
            <div class="col-counted">
              <div class="input-currency-wrapper">
                <span>R$</span>
                <input type="number" step="0.01" min="0" id="inputCountedCash" placeholder="0,00" oninput="calculateDifferences()" />
              </div>
            </div>
            <div class="col-diff" id="diffBadgeCash"><span class="diff-tag exact">R$ 0,00 (Exato)</span></div>
          </div>

          <!-- PIX -->
          <div class="conference-row">
            <div class="col-method">
              <span class="method-icon pix">📱</span>
              <div>
                <strong>PIX Recebido</strong>
                <small>Extrato bancário / Sicredi</small>
              </div>
            </div>
            <div class="col-system" id="sysValPix">R$ 0,00</div>
            <div class="col-counted">
              <div class="input-currency-wrapper">
                <span>R$</span>
                <input type="number" step="0.01" min="0" id="inputCountedPix" placeholder="0,00" oninput="calculateDifferences()" />
              </div>
            </div>
            <div class="col-diff" id="diffBadgePix"><span class="diff-tag exact">R$ 0,00 (Exato)</span></div>
          </div>

          <!-- CARTÃO DE CRÉDITO -->
          <div class="conference-row">
            <div class="col-method">
              <span class="method-icon card">💳</span>
              <div>
                <strong>Cartão de Crédito</strong>
                <small>Fechamento / Filipeta Maquininha</small>
              </div>
            </div>
            <div class="col-system" id="sysValCredit">R$ 0,00</div>
            <div class="col-counted">
              <div class="input-currency-wrapper">
                <span>R$</span>
                <input type="number" step="0.01" min="0" id="inputCountedCredit" placeholder="0,00" oninput="calculateDifferences()" />
              </div>
            </div>
            <div class="col-diff" id="diffBadgeCredit"><span class="diff-tag exact">R$ 0,00 (Exato)</span></div>
          </div>

          <!-- CARTÃO DE DÉBITO -->
          <div class="conference-row">
            <div class="col-method">
              <span class="method-icon card">💳</span>
              <div>
                <strong>Cartão de Débito</strong>
                <small>Fechamento / Filipeta Maquininha</small>
              </div>
            </div>
            <div class="col-system" id="sysValDebit">R$ 0,00</div>
            <div class="col-counted">
              <div class="input-currency-wrapper">
                <span>R$</span>
                <input type="number" step="0.01" min="0" id="inputCountedDebit" placeholder="0,00" oninput="calculateDifferences()" />
              </div>
            </div>
            <div class="col-diff" id="diffBadgeDebit"><span class="diff-tag exact">R$ 0,00 (Exato)</span></div>
          </div>

          <!-- FIADO -->
          <div class="conference-row">
            <div class="col-method">
              <span class="method-icon account">📋</span>
              <div>
                <strong>Fiado (A receber)</strong>
                <small>Caderno / Vendas a prazo</small>
              </div>
            </div>
            <div class="col-system" id="sysValOnAccount">R$ 0,00</div>
            <div class="col-counted">
              <div class="input-currency-wrapper">
                <span>R$</span>
                <input type="number" step="0.01" min="0" id="inputCountedOnAccount" placeholder="0,00" oninput="calculateDifferences()" />
              </div>
            </div>
            <div class="col-diff" id="diffBadgeOnAccount"><span class="diff-tag exact">R$ 0,00 (Exato)</span></div>
          </div>

          <!-- TOTAIS -->
          <div class="conference-total-row">
            <div class="col-method">
              <strong>TOTAL GERAL</strong>
            </div>
            <div class="col-system"><strong id="sysValTotal">R$ 0,00</strong></div>
            <div class="col-counted"><strong id="countedValTotal" style="color:#0f381e;">R$ 0,00</strong></div>
            <div class="col-diff" id="diffBadgeTotal"><span class="diff-tag exact">R$ 0,00 (Bateu)</span></div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; margin-top:8px;">
          <button type="button" class="btn-action" onclick="fillCountedWithSystem()" style="font-size:12px;">
            ✨ Preencher conferido com os valores do sistema
          </button>
        </div>

        <!-- ANEXO DO COMPROVANTE DA MAQUININHA & OBSERVAÇÕES -->
        <div class="closing-extras-grid">
          <div class="proof-upload-card">
            <label class="proof-label">📷 Comprovante da Maquininha (Foto da Filipeta)</label>
            <p style="font-size:12px; color:#64748b; margin-bottom:10px;">Tire uma foto ou anexe o comprovante de fechamento emitido pela maquininha de cartão.</p>
            
            <input type="file" id="machineReceiptFile" accept="image/*,application/pdf" capture="environment" style="display:none;" onchange="handleMachineReceiptUpload(this)" />
            
            <div id="proofUploadArea" class="proof-dropzone" onclick="document.getElementById('machineReceiptFile').click()">
              <span style="font-size:28px;">📷</span>
              <strong id="proofUploadText">Clique para tirar foto ou anexar comprovante</strong>
              <small style="color:#64748b;">Suporta câmera do celular, JPG, PNG e PDF</small>
            </div>

            <div id="proofPreviewArea" class="proof-preview-wrapper" hidden>
              <img id="proofPreviewImg" src="" alt="Comprovante da Maquininha" class="proof-thumb" />
              <div style="display:flex; flex-direction:column; gap:6px;">
                <strong id="proofFileName" style="font-size:12px; word-break:break-all;">comprovante.jpg</strong>
                <span style="font-size:11px; color:#15803d; font-weight:700;">✓ Comprovante anexado</span>
                <button type="button" class="btn-action" onclick="removeMachineReceiptProof()" style="font-size:11px; color:#dc2626; border-color:#fca5a5;">Remover foto</button>
              </div>
            </div>
          </div>

          <div class="closing-notes-card">
            <label class="proof-label">📝 Observações do Caixa (Opcional)</label>
            <textarea id="closingNotesInput" class="closing-notes-textarea" placeholder="Ex: R$ 50,00 de sangria para compra de adubo às 15h, conferido por Rose..."></textarea>
          </div>
        </div>

        <!-- AÇÕES DO FECHAMENTO -->
        <div class="closing-actions-bar">
          <button type="button" id="btnCloseCash" class="btn-action primary close-day-button" onclick="registerCashClosing()" aria-keyshortcuts="Control+Shift+Enter" title="Atalho: Ctrl + Shift + Enter">
            <span>🔒 Registrar Fechamento do Caixa</span><kbd class="shortcut-hint">Ctrl + Shift + Enter</kbd>
          </button>
          <button type="button" id="btnSendWhatsappClosing" class="btn-action primary" onclick="sendDailyReport()" style="background:#15803d; border-color:#15803d;">
            📲 Enviar Resumo para Júnior (WhatsApp)
          </button>
          <a id="btnDownloadClosingPdf" class="btn-action" href="#" target="_blank" hidden>
            📄 Baixar PDF do Fechamento
          </a>
        </div>

        <!-- HISTÓRICO DE VENDAS PARA CONFERÊNCIA -->
        <div class="sales-audit-section">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:12px;">
            <div>
              <h3 style="font-size:15px; font-weight:800; color:#0f381e;">🧾 Vendas Realizadas na Data</h3>
              <p style="font-size:12px; color:#64748b;">Consulte cada pedido do dia para conferência item por item.</p>
            </div>
            <input type="search" id="salesSearchInput" placeholder="Filtrar por cliente, pedido ou pagamento..." oninput="filterTodayOrdersTable(this.value)" style="padding:8px 12px; border-radius:8px; border:1px solid #dbe5df; font-size:13px; min-width:260px;" />
          </div>

          <div class="table-scroll">
            <table class="seasonal-table" id="tableTodaySalesAudit">
              <thead>
                <tr>
                  <th>Horário</th>
                  <th>Pedido / Comanda</th>
                  <th>Cliente</th>
                  <th>Forma de Pagamento</th>
                  <th>Total</th>
                  <th>Vendedor / Operador</th>
                </tr>
              </thead>
              <tbody id="bodyTodaySalesAudit">
                <tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">Carregando vendas do dia...</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- RESUMO DETALHADO DO DIA -->
        <details class="daily-closing" style="margin-top:24px;"><summary>Ver todos os indicadores e métricas detalhadas do dia</summary>
          <!-- INDICADORES DO DIA -->
          <div class="summary-grid" style="margin-top:16px;">
            <div class="summary-card highlight">
              <div class="summary-label">Recebimento de dívida</div>
              <div class="summary-val" id="cardDebtReceived">R$ 0,00</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Crédito antecipado recebido</div>
              <div class="summary-val" id="cardAdvanceCredit">R$ 0,00</div>
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
          <div class="details-grid" style="margin-top:16px;">
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
                <div class="payment-bar-seg account" data-method="SALDO_CLIENTE"></div>
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
          <div class="details-grid" style="margin-top:16px;">
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
        </details>
      </section>
    </div>

    <!-- ABA 2: RESULTADOS DA LOJA & PERÍODOS -->
    <div id="viewAnalytics" class="executive-view" style="display:none;">
      <section class="panel-card period-analytics" aria-labelledby="periodAnalyticsTitle">
        <div class="panel-header">
          <h2 class="panel-title" id="periodAnalyticsTitle">Quanto vendemos?</h2>
          <span class="panel-tag">Vendas do caixa e do catálogo</span>
        </div>
        <div class="period-controls">
          <label class="period-date">Escolher mês<input type="month" id="selectedMonth" aria-label="Mês das vendas" onchange="selectReportMonth()"></label>
          <div class="period-presets" role="group" aria-label="Períodos rápidos">
            <button type="button" class="btn-action primary" onclick="setPeriodPreset('today')">Hoje</button>
            <button type="button" class="btn-action" onclick="setPeriodPreset('week')">7 dias</button>
            <button type="button" class="btn-action" onclick="setPeriodPreset('month')">Este mês</button>
            <button type="button" class="btn-action" onclick="setPeriodPreset('year')">Este ano</button>
          </div>
          <label class="period-date">De<input type="date" id="periodFrom" aria-label="Data inicial do acompanhamento" onchange="periodComparisonMode='previous';loadPeriodMetrics()" /></label>
          <label class="period-date">Até<input type="date" id="periodTo" aria-label="Data final do acompanhamento" onchange="periodComparisonMode='previous';loadPeriodMetrics()" /></label>
          <button type="button" id="periodRefresh" class="btn-action primary period-refresh" onclick="loadPeriodMetrics()">Atualizar período</button>
        </div>
        <p id="periodStatus" class="period-empty" role="status">Selecione um período para carregar as vendas.</p>
        <div class="period-summary-grid">
          <article class="period-metric"><span>Vendas registradas</span><strong id="periodSales">R$ 0,00</strong><small id="periodSalesChange">—</small></article>
          <article class="period-metric"><span>Dinheiro recebido</span><strong id="periodReceived">R$ 0,00</strong><small id="periodReceivedChange">—</small></article>
          <article class="period-metric"><span>Vendas no fiado</span><strong id="periodOnAccount">R$ 0,00</strong><small id="periodOnAccountChange">—</small></article>
          <article class="period-metric"><span>Crédito antecipado recebido</span><strong id="periodAdvanceCredit">R$ 0,00</strong><small id="periodAdvanceCreditChange">—</small></article>
          <article class="period-metric"><span>Vendas</span><strong id="periodOrders">0</strong><small id="periodOrdersChange">—</small></article>
          <article class="period-metric"><span>Ticket médio</span><strong id="periodTicket">R$ 0,00</strong><small id="periodTicketChange">—</small></article>
        </div>
        <div class="details-grid">
          <section class="period-insight"><div class="panel-title">Dia da semana com maior faturamento</div><strong id="periodStrongestWeekday">—</strong><p id="periodWeekdayNote" class="period-empty">Compara os dias da semana no período selecionado.</p></section>
          <section class="panel-card"><div class="panel-title">Vendas e recebimentos por forma</div><div id="periodPayments" class="period-list"><span class="period-empty">Aguardando dados…</span></div></section>
        </div>
      <section class="panel-card seasonal-panel" aria-labelledby="seasonalTitle">
        <div class="panel-header"><div><h2 id="seasonalTitle">O que mais vende em cada mês?</h2><p class="period-empty">Histórico real do ano escolhido. Meses sem registros não indicam previsão de vendas.</p></div><label class="period-date">Ano<input id="seasonalYear" type="number" min="2000" max="2100" aria-label="Ano do histórico mensal" onchange="loadSeasonalMetrics()"></label></div>
        <div class="year-highlight"><span>Vendas no ano</span><strong id="yearSales">—</strong><small id="yearSalesChange">—</small></div>
        <p id="seasonalStatus" role="status" class="period-empty"></p>
        <p class="seasonal-mobile-hint period-empty">Deslize a tabela para o lado para ver os produtos líderes.</p><div class="seasonal-scroll"><table class="seasonal-table"><thead><tr><th>Mês</th><th>Vendas</th><th>Comparação anual</th><th>Líder em quantidade</th><th>Líder em valor</th></tr></thead><tbody id="monthlyLeaders"></tbody></table></div>
      </section>
        <h2 class="panel-title">Produtos no período selecionado</h2>
        <label class="period-date">Unidade do ranking<select id="rankingUnit" aria-label="Unidade do ranking" onchange="if(lastPeriodResult)renderPeriodMetrics(lastPeriodResult)"><option value="all">Todas (medidas diferentes)</option><option value="kg">Quilos</option><option value="un.">Unidades</option></select></label>
        <p class="period-empty">Margem, perdas e cobertura de estoque: indisponíveis até registrar custos e histórico de disponibilidade. Nenhuma previsão é estimada sem esses dados.</p>
        <div class="details-grid product-rankings">
          <section class="panel-card"><h3>Mais vendidos · quantidade</h3><div id="periodProducts" class="period-list"></div></section>
          <section class="panel-card"><h3>Mais vendidos · valor</h3><div id="periodProductsValue" class="period-list"></div></section>
          <section class="panel-card"><h3>Menos vendidos · quantidade</h3><div id="periodLeastQuantity" class="period-list"></div></section>
          <section class="panel-card"><h3>Menos vendidos · valor</h3><div id="periodLeastValue" class="period-list"></div></section>
        </div>
        <p id="unsoldProductsNote" class="period-empty"></p>
        <p class="period-empty">Quantidade respeita a unidade de cada produto. Quilos e unidades não representam o mesmo volume. Valor dos produtos considera descontos e exclui entrega.</p>
        <details class="panel-card period-evolution"><summary>Ver evolução das vendas por dia/semana</summary><div id="periodDaily" class="period-list"></div></details>
      </section>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>

  <!-- Interações do painel -->
  <script>
    let periodComparisonMode = 'previous';
    let periodRequestVersion = 0;
    let lastPeriodResult = null;
    let seasonalRequestVersion = 0;
    let currentSystemTotals = { cash: 0, pix: 0, credit: 0, debit: 0, onAccount: 0, total: 0 };
    let currentTodayOrders = [];
    let currentUploadedProofUrl = null;

    document.addEventListener('DOMContentLoaded', initializeDashboard);
    document.addEventListener('keydown', handleDashboardShortcut);

    function switchExecutiveTab(tab) {
      const isClosing = tab === 'closing';
      document.getElementById('viewClosing').style.display = isClosing ? 'block' : 'none';
      document.getElementById('viewAnalytics').style.display = isClosing ? 'none' : 'block';
      document.getElementById('btnTabClosing').classList.toggle('active', isClosing);
      document.getElementById('btnTabAnalytics').classList.toggle('active', !isClosing);
    }

    async function initializeDashboard() {
      document.getElementById('reportDate').value = getBusinessToday();
      setPeriodPreset('today', false);
      document.getElementById('selectedMonth').value = getBusinessToday().slice(0,7);
      document.getElementById('seasonalYear').value = getBusinessToday().slice(0,4);
      updateDateButtonLabel();
      try {
        const response = await window.ConfloraSession.apiFetch('/api/auth/me');
        const data = await response.json();
        if (response.ok && data.user && data.user.role === 'ADMIN') {
          document.getElementById('btnSendReport').hidden = false;
          await Promise.all([loadPeriodMetrics(), loadSeasonalMetrics(), loadExecutiveMetrics(), checkClosingStatus(getBusinessToday())]);
          return;
        }
        showToast('dashboard_available_for_admin_only'.tr);
        document.querySelector('.main-container').innerHTML = '<div class="panel-card"><strong>Acesso restrito</strong><span>Entre com uma conta ADMIN para consultar o fechamento diário.</span></div>';
      } catch (_) {
        showToast('could_not_validate_your_access_please_log_in_again'.tr);
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

    function addCalendarDays(date, amount) {
      const [year, month, day] = date.split('-').map(Number);
      const value = new Date(Date.UTC(year, month - 1, day + amount, 12));
      return value.toISOString().slice(0, 10);
    }

    function setPeriodPreset(period, refresh = true) {
      periodComparisonMode = (period === 'today' || period === 'week') ? 'previous' : period;
      document.querySelectorAll('.period-presets button').forEach(button => button.classList.toggle('primary', button.getAttribute('onclick')?.includes("'" + period + "'")));
      const today = getBusinessToday();
      const [year, month] = today.split('-');
      const from = period === 'today' ? today
        : period === 'week' ? addCalendarDays(today, -6)
        : period === 'year' ? year + '-01-01'
        : year + '-' + month + '-01';
      document.getElementById('periodFrom').value = from;
      document.getElementById('periodTo').value = today;
      if (refresh) loadPeriodMetrics();
    }

    function comparisonText(change, unit = '') {
      if (!change) return 'comparison_unavailable'.tr;
      if (change.percent === null) return change.absolute > 0 ? 'Acima do período anterior, sem base comparável' : 'no_sales_in_previous_period'.tr;
      const arrow = change.absolute > 0 ? '▲ ' : change.absolute < 0 ? '▼ ' : '';
      const value = unit === 'sales_0ec6c3'.tr
        ? Math.abs(change.absolute) + ' ' + unit
        : formatCurrency(Math.abs(change.absolute));
      return arrow + (change.absolute > 0 ? '+' : change.absolute < 0 ? '−' : '') + Math.abs(change.percent).toLocaleString('pt-BR') + '% · ' + value + ' vs período anterior';
    }

    function renderPeriodMetrics(result) {
      lastPeriodResult = result;
      const current = result.current || {};
      const comparison = result.comparison || {};
      document.getElementById('periodSales').textContent = formatCurrency(current.sales);
      document.getElementById('periodReceived').textContent = formatCurrency(current.totalCashIn);
      document.getElementById('periodOnAccount').textContent = formatCurrency(current.onAccountSales);
      document.getElementById('periodAdvanceCredit').textContent = formatCurrency(current.advanceCreditReceived);
      document.getElementById('periodOrders').textContent = Number(current.orderCount || 0).toLocaleString('pt-BR');
      document.getElementById('periodTicket').textContent = formatCurrency(current.averageTicket);
      document.getElementById('periodSalesChange').textContent = comparisonText(comparison.sales);
      document.getElementById('periodReceivedChange').textContent = comparisonText(comparison.totalCashIn);
      document.getElementById('periodOnAccountChange').textContent = comparisonText(comparison.onAccountSales);
      document.getElementById('periodAdvanceCreditChange').textContent = comparisonText(comparison.advanceCreditReceived);
      document.getElementById('periodOrdersChange').textContent = comparisonText(comparison.orderCount, 'sales_0ec6c3'.tr);
      document.getElementById('periodTicketChange').textContent = comparisonText(comparison.averageTicket);
      const rangeText = result.range.from === result.range.to
        ? formatReportDate(result.range.from)
        : formatReportDate(result.range.from) + ' a ' + formatReportDate(result.range.to);
      const previousText = formatReportDate(result.range.previousFrom) + ' a ' + formatReportDate(result.range.previousTo);
      document.getElementById('periodStatus').textContent = rangeText + 'comparison_with'.tr + previousText;

      const strongest = current.strongestWeekday;
      document.getElementById('periodStrongestWeekday').textContent = strongest?.name || 'no_sales_in_this_period'.tr;
      document.getElementById('periodWeekdayNote').textContent = strongest
        ? 'average_of'.tr + formatCurrency(strongest.averageSales) + 'per_occurrence'.tr + strongest.sampleDays + ' dia(s) · ' + strongest.orderCount + ' venda(s). Inclui fiado.'
        : 'compares_days_of_the_week_in_the_selected_period'.tr;

      const methods = [
        ['PIX', 'Pix'], ['DINHEIRO', 'cart_cash_option'.tr], ['DEBITO', 'debit'.tr],
        ['CREDITO', 'credit'.tr], ['CARTAO', 'card'.tr], ['FIADO', 'cart_fiado_option'.tr], ['SALDO_CLIENTE', 'customer_balance'.tr], ['OUTROS', 'Outros'],
      ];
      const paymentRows = methods.map(([key, label]) => ({ key, label, ...(current.byPayment?.[key] || {}) }))
        .filter((payment) => Number(payment.sales || 0) > 0 || Number(payment.receipts || 0) > 0);
      document.getElementById('periodPayments').innerHTML = paymentRows.length
        ? paymentRows.map((payment) => '<div class="period-row"><span class="period-row-label">' + payment.label + '</span><span class="period-row-label">Vendas ' + formatCurrency(payment.sales) + ' · recebimentos ' + formatCurrency(payment.receipts) + '</span><strong>' + (payment.orderCount || 0) + ' venda(s)</strong></div>').join('')
        : '<span class="period-empty">Nenhuma venda ou recebimento no período.</span>';

      const allRankings = current.rankings || {};
      const unit = document.getElementById('rankingUnit').value;
      const rankings = unit === 'all' ? allRankings : allRankings.byUnit?.[unit] || {};
      renderPeriodProducts('periodProducts', rankings.mostByQuantity || current.topProducts || []);
      renderPeriodProducts('periodProductsValue', rankings.mostByRevenue || []);
      renderPeriodProducts('periodLeastQuantity', rankings.leastByQuantity || []);
      renderPeriodProducts('periodLeastValue', rankings.leastByRevenue || []);
      document.getElementById('unsoldProductsNote').textContent = (rankings.unsoldCount || 0) + 'active_product_s_without_sale_in_this_period'.tr + (rankings.unsoldWithStock || 0) + 'in_stock'.tr + (rankings.unsoldWithoutStock || 0) + 'out_of_stock_current_balance_does_not_show_historical_availability'.tr;

      let series = Array.isArray(current.daily) ? current.daily : [];
      if (series.length > 31) {
        const grouped = new Map();
        for (const day of series) {
          const date = new Date(day.date + 'T12:00:00.000Z');
          let key;
          let label;
          if (series.length <= 120) {
            const weekday = (date.getUTCDay() + 6) % 7;
            const start = addCalendarDays(day.date, -weekday);
            key = start;
            label = 'week_of'.tr + formatReportDate(start);
          } else {
            key = day.date.slice(0, 7);
            label = key.split('-').reverse().join('/');
          }
          const group = grouped.get(key) || { label, sales: 0, orderCount: 0 };
          group.sales += Number(day.sales || 0);
          group.orderCount += Number(day.orderCount || 0);
          grouped.set(key, group);
        }
        series = [...grouped.values()];
      } else {
        series = series.map((day) => ({ ...day, label: formatReportDate(day.date) }));
      }
      const maxSales = Math.max(1, ...series.map((day) => Number(day.sales || 0)));
      document.getElementById('periodDaily').innerHTML = series.length
        ? series.map((day) => '<div class="period-row"><span class="period-row-label">' + escapeHtml(day.label) + '</span><span class="period-row-label"><strong>' + formatCurrency(day.sales) + '</strong></span></div>').join('')
        : '<span class="period-empty">Sem dados para exibir.</span>';
    }

    function renderPeriodProducts(id, products) {
      const host = document.getElementById(id); host.replaceChildren();
      if (!products.length) { host.textContent = 'no_products_in_this_period'.tr; return; }
      products.forEach((product, index) => {
        const row = document.createElement('div'); row.className = 'product-number-row';
        const name = document.createElement('span'); name.textContent = (index + 1) + '. ' + product.name;
        const numbers = document.createElement('strong'); numbers.textContent = Number(product.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 }) + ' ' + (product.unit || 'un.') + ' · ' + formatCurrency(product.revenue);
        row.append(name, numbers); host.append(row);
      });
    }
    function selectReportMonth() {
      const month = document.getElementById('selectedMonth').value;
      if (!/^\\d{4}-\\d{2}$/.test(month)) return;
      const [year, number] = month.split('-').map(Number);
      const last = new Date(Date.UTC(year, number, 0)).toISOString().slice(0,10);
      document.getElementById('periodFrom').value = month + '-01';
      document.getElementById('periodTo').value = month === getBusinessToday().slice(0,7) ? getBusinessToday() : last;
      periodComparisonMode = 'month'; loadPeriodMetrics();
    }
    async function loadSeasonalMetrics() {
      const version = ++seasonalRequestVersion;
      const year = Number(document.getElementById('seasonalYear').value);
      const status = document.getElementById('seasonalStatus');
      if (!Number.isInteger(year) || year < 2000 || year > 2100) { status.textContent = 'choose_a_year_between_2000_and_2100'.tr; return; }
      status.textContent = 'loading_monthly_history'.tr;
      try {
        const today = getBusinessToday();
        const to = year === Number(today.slice(0,4)) ? today : year + '-12-31';
        const response = await window.ConfloraSession.apiFetch('/api/admin/executive-period-metrics?from=' + year + '-01-01&to=' + to + '&comparisonMode=year');
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'could_not_load_history'.tr);
        if (version !== seasonalRequestVersion) return;
        document.getElementById('yearSales').textContent = formatCurrency(result.current.sales);
        document.getElementById('yearSalesChange').textContent = comparisonText(result.comparison.sales);
        const current = new Map((result.current.monthly || []).map(row => [row.month, row]));
        const previous = new Map((result.previous.monthly || []).map(row => [row.month.slice(5), row]));
        const host = document.getElementById('monthlyLeaders'); host.replaceChildren();
        for (let number = 1; number <= 12; number++) {
          const key = year + '-' + String(number).padStart(2,'0');
          const month = current.get(key); const before = previous.get(key.slice(5));
          const quantity = month?.rankings.mostByQuantity[0]; const value = month?.rankings.mostByRevenue[0];
          const change = before?.sales ? ((Number(month?.sales || 0) - before.sales) / before.sales * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '% vs ' + (year - 1) : 'no_previous_base'.tr;
          const label = new Date(Date.UTC(year, number - 1, 1)).toLocaleDateString('pt-BR', { month: 'long', timeZone:'UTC' });
          const values = [label, formatCurrency(month?.sales || 0), key > today.slice(0,7) ? 'Ainda não realizado' : change, quantity ? quantity.name + ' · ' + quantity.quantity.toLocaleString('pt-BR') + ' ' + quantity.unit : 'Sem vendas', value ? value.name + ' · ' + formatCurrency(value.revenue) : 'Sem vendas'];
          const row = document.createElement('tr');
          values.forEach(text => { const cell = document.createElement('td'); cell.textContent = text; row.append(cell); }); host.append(row);
        }
        status.textContent = 'comparison_with_the_previous_year_up_to_the_same_date_ongoing_months_are_partial_sale'.tr;
      } catch (error) { if (version === seasonalRequestVersion) status.textContent = error.message; }
    }

    async function loadPeriodMetrics() {
      const requestVersion = ++periodRequestVersion;
      const from = document.getElementById('periodFrom').value;
      const to = document.getElementById('periodTo').value;
      if (!from || !to || from > to) {
        document.getElementById('periodStatus').textContent = 'select_a_valid_date_range'.tr;
        return;
      }
      const button = document.getElementById('periodRefresh');
      button.disabled = true;
      document.getElementById('periodStatus').textContent = 'loading_sales_and_receipts'.tr;
      try {
        const response = await window.ConfloraSession.apiFetch('/api/admin/executive-period-metrics?from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + '&comparisonMode=' + periodComparisonMode);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'could_not_load_the_period'.tr);
        if (requestVersion === periodRequestVersion) renderPeriodMetrics(data);
      } catch (error) {
        if (requestVersion === periodRequestVersion) document.getElementById('periodStatus').textContent = error.message;
      } finally {
        if (requestVersion === periodRequestVersion) button.disabled = false;
      }
    }

    function updateDateButtonLabel() {
      const date = document.getElementById('reportDate').value;
      const isToday = date === getBusinessToday();
      const todayButton = document.getElementById('dateTodayButton');
      document.getElementById('dateButtonLabel').textContent = isToday ? 'HOJE' : formatReportDate(date);
      todayButton.setAttribute('aria-label', isToday ? 'Hoje. Clique para atualizar o dia atual.' : 'Data ' + formatReportDate(date) + '. Clique para voltar para hoje.');
      todayButton.title = isToday ? 'Atualizar para hoje' : 'back_to_today'.tr;
    }

    function setReportDateToday() {
      document.getElementById('reportDate').value = getBusinessToday();
      updateDateButtonLabel();
      loadExecutiveMetrics();
      checkClosingStatus(getBusinessToday());
    }

    function handleReportDateChange() {
      updateDateButtonLabel();
      loadExecutiveMetrics();
      checkClosingStatus(document.getElementById('reportDate').value);
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
        const res = await window.ConfloraSession.apiFetch('/api/admin/executive-metrics?date=' + encodeURIComponent(date));
        if (res.status === 401 || res.status === 403) {
          showToast('access_restricted_to_administrator'.tr);
          return;
        }
        const data = await res.json();
        if (!res.ok) { throw new Error(data.error || 'could_not_load_summary'.tr); }
        renderMetrics(data);
      } catch (err) {
        showToast('error_loading_day_data'.tr + err.message);
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
        cardAdvanceCredit: m.advanceCreditReceived,
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
      Object.entries(values).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = formatCurrency(value);
      });

      // Atualiza valores do sistema para conferência de caixa
      currentSystemTotals = {
        cash: Number(m.cashTendered || m.cashSales || 0),
        pix: Number(m.byPayment?.PIX?.total || 0),
        credit: Number(m.byPayment?.CREDITO?.total || 0),
        debit: Number(m.byPayment?.DEBITO?.total || 0),
        onAccount: Number(m.onAccountSales || 0),
        total: Number(m.totalRevenue || 0),
      };

      document.getElementById('sysValCash').textContent = formatCurrency(currentSystemTotals.cash);
      document.getElementById('sysValPix').textContent = formatCurrency(currentSystemTotals.pix);
      document.getElementById('sysValCredit').textContent = formatCurrency(currentSystemTotals.credit);
      document.getElementById('sysValDebit').textContent = formatCurrency(currentSystemTotals.debit);
      document.getElementById('sysValOnAccount').textContent = formatCurrency(currentSystemTotals.onAccount);
      document.getElementById('sysValTotal').textContent = formatCurrency(currentSystemTotals.total);
      calculateDifferences();

      renderPaymentBreakdown(m);
      renderCollaborators(m.byCollaborator || []);
      renderProducts('topProductsQuantity', m.topProductsByQuantity || []);
      renderProducts('topProductsValue', m.topProductsByValue || []);
      renderTodayOrdersAudit(m.todayOrders || []);
    }

    function calculateDifferences() {
      const getVal = (id) => {
        const raw = document.getElementById(id)?.value;
        if (!raw || isNaN(raw)) return 0;
        return parseFloat(raw) || 0;
      };

      const counted = {
        cash: getVal('inputCountedCash'),
        pix: getVal('inputCountedPix'),
        credit: getVal('inputCountedCredit'),
        debit: getVal('inputCountedDebit'),
        onAccount: getVal('inputCountedOnAccount'),
      };

      const countedTotal = counted.cash + counted.pix + counted.credit + counted.debit + counted.onAccount;
      document.getElementById('countedValTotal').textContent = formatCurrency(countedTotal);

      const updateBadge = (elemId, diff) => {
        const elem = document.getElementById(elemId);
        if (!elem) return;
        const diffFixed = Math.round(diff * 100) / 100;
        if (Math.abs(diffFixed) < 0.01) {
          elem.innerHTML = '<span class="diff-tag exact">R$ 0,00 (Exato)</span>';
        } else if (diffFixed > 0) {
          elem.innerHTML = '<span class="diff-tag surplus">+' + formatCurrency(diffFixed) + ' (Sobra)</span>';
        } else {
          elem.innerHTML = '<span class="diff-tag shortage">' + formatCurrency(diffFixed) + ' (Falta)</span>';
        }
      };

      updateBadge('diffBadgeCash', counted.cash - currentSystemTotals.cash);
      updateBadge('diffBadgePix', counted.pix - currentSystemTotals.pix);
      updateBadge('diffBadgeCredit', counted.credit - currentSystemTotals.credit);
      updateBadge('diffBadgeDebit', counted.debit - currentSystemTotals.debit);
      updateBadge('diffBadgeOnAccount', counted.onAccount - currentSystemTotals.onAccount);
      updateBadge('diffBadgeTotal', countedTotal - currentSystemTotals.total);
    }

    function fillCountedWithSystem() {
      document.getElementById('inputCountedCash').value = Number(currentSystemTotals.cash || 0).toFixed(2);
      document.getElementById('inputCountedPix').value = Number(currentSystemTotals.pix || 0).toFixed(2);
      document.getElementById('inputCountedCredit').value = Number(currentSystemTotals.credit || 0).toFixed(2);
      document.getElementById('inputCountedDebit').value = Number(currentSystemTotals.debit || 0).toFixed(2);
      document.getElementById('inputCountedOnAccount').value = Number(currentSystemTotals.onAccount || 0).toFixed(2);
      calculateDifferences();
      showToast('values_filled_with_system_calculated_data'.tr);
    }

    async function handleMachineReceiptUpload(input) {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result;
        document.getElementById('proofPreviewImg').src = dataUrl;
        document.getElementById('proofFileName').textContent = file.name;
        document.getElementById('proofUploadArea').hidden = true;
        document.getElementById('proofPreviewArea').hidden = false;
        try {
          const res = await window.ConfloraSession.apiFetch('/api/caixa/payment-proofs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetType: 'CLOSING',
              targetId: 'closing_' + document.getElementById('reportDate').value,
              fileName: file.name,
              dataUrl,
            }),
          });
          const json = await res.json();
          if (res.ok && json.url) {
            currentUploadedProofUrl = json.url;
            showToast('card_machine_receipt_attached'.tr);
          }
        } catch (e) {
          console.warn('Falha upload comprovante:', e);
        }
      };
      reader.readAsDataURL(file);
    }

    function removeMachineReceiptProof() {
      currentUploadedProofUrl = null;
      document.getElementById('machineReceiptFile').value = '';
      document.getElementById('proofUploadArea').hidden = false;
      document.getElementById('proofPreviewArea').hidden = true;
    }

    function renderTodayOrdersAudit(orders) {
      currentTodayOrders = orders || [];
      filterTodayOrdersTable(document.getElementById('salesSearchInput')?.value || '');
    }

    function filterTodayOrdersTable(query) {
      const tbody = document.getElementById('bodyTodaySalesAudit');
      if (!tbody) return;
      const q = String(query || '').toLowerCase().trim();
      const filtered = currentTodayOrders.filter(o => 
        !q || 
        String(o.customerName || '').toLowerCase().includes(q) ||
        String(o.id || '').toLowerCase().includes(q) ||
        String(o.paymentMethod || '').toLowerCase().includes(q) ||
        String(o.sellerName || '').toLowerCase().includes(q)
      );

      if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">' + (currentTodayOrders.length ? 'Nenhuma venda encontrada para esta busca.' : 'Nenhuma venda registrada nesta data.') + '</td></tr>';
        return;
      }

      tbody.innerHTML = filtered.map(o => {
        const time = o.createdAt ? new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
        const methodBadges = {
          PIX: '<span class="diff-tag exact">📱 Pix</span>',
          DINHEIRO: '<span class="diff-tag surplus">💵 Dinheiro</span>',
          CREDITO: '<span class="diff-tag" style="background:#e0f2fe;color:#0369a1;">💳 Crédito</span>',
          DEBITO: '<span class="diff-tag" style="background:#e0f2fe;color:#0369a1;">💳 Débito</span>',
          FIADO: '<span class="diff-tag shortage">📋 Fiado</span>',
        };
        const badge = methodBadges[o.paymentMethod] || '<span class="diff-tag exact">' + escapeHtml(o.paymentMethod) + '</span>';
        return '<tr>' +
          '<td><strong>' + time + '</strong></td>' +
          '<td><code>#' + escapeHtml(String(o.id).slice(-6).toUpperCase()) + '</code></td>' +
          '<td>' + escapeHtml(o.customerName) + '</td>' +
          '<td>' + badge + '</td>' +
          '<td><strong>' + formatCurrency(o.total) + '</strong></td>' +
          '<td>' + escapeHtml(o.sellerName) + '</td>' +
        '</tr>';
      }).join('');
    }

    async function checkClosingStatus(date) {
      try {
        const res = await window.ConfloraSession.apiFetch('/api/admin/cashier/closing?date=' + encodeURIComponent(date));
        const json = await res.json();
        const badge = document.getElementById('closingStatusBadge');
        const pdfBtn = document.getElementById('btnDownloadClosingPdf');
        if (json && json.closing) {
          badge.className = 'closing-badge closed';
          badge.textContent = 'closed_by'.tr + (json.closing.closedBy || 'Admin') + 'at'.tr + new Date(json.closing.closedAt).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
          if (json.closing.reportFileName) {
            pdfBtn.href = '/reports/' + json.closing.reportFileName;
            pdfBtn.hidden = false;
          }
          if (json.closing.counted) {
            document.getElementById('inputCountedCash').value = json.closing.counted.cash ?? '';
            document.getElementById('inputCountedPix').value = json.closing.counted.pix ?? '';
            document.getElementById('inputCountedCredit').value = json.closing.counted.credit ?? '';
            document.getElementById('inputCountedDebit').value = json.closing.counted.debit ?? '';
            document.getElementById('inputCountedOnAccount').value = json.closing.counted.onAccount ?? '';
            calculateDifferences();
          }
        } else {
          badge.className = 'closing-badge open';
          badge.textContent = 'open_cash_register_under_reconciliation'.tr;
          if (pdfBtn) pdfBtn.hidden = true;
        }
      } catch (_) {}
    }

    function renderPaymentBreakdown(metrics) {
      const methods = [
        ['PIX', 'Pix', 'var(--pix)'], ['DINHEIRO', 'cart_cash_option'.tr, 'var(--cash)'],
        ['DEBITO', 'cart_debit_option'.tr, '#86b991'], ['CREDITO', 'cart_card_option'.tr, '#b2d3b8'],
        ['FIADO', 'cart_fiado_option'.tr, '#d4e6d7'], ['SALDO_CLIENTE', 'customer_balance'.tr, '#a9c6eb'],
        ['CARTAO', 'card_unspecified'.tr, 'var(--card)'],
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
        return '<div class="legend-item"><div class="legend-title"><span class="legend-dot" style="background:' + color + ';"></span>' + label + '</div><div class="legend-val"> + formatCurrency(payment.total) + </div><div class="legend-sub">' + (payment.count || 0) + ' venda(s) · ' + percent + '%</div></div>';
      }).join('');
    }

    function renderCollaborators(collabs) {
      const container = document.getElementById('collaboratorList');
      if (!collabs.length) {
        container.innerHTML = '<div class="metric-empty">Nenhum colaborador cadastrado.</div>';
        return;
      }
      container.innerHTML = collabs.map((person, index) => '<div class="ranking-row"><div class="ranking-info"><span class="ranking-rank">' + (index + 1) + 'º</span><div><div class="ranking-name">' + escapeHtml(person.name) + '</div><div class="ranking-meta">' + escapeHtml(person.role) + ' · ' + (person.count || 0) + ' venda(s) · ' + (person.percentage || 0) + '% das vendas · recebeu ' + (person.receivedCount || 0) + ' vez(es)</div></div></div><div class="ranking-values"><div class="ranking-val"> + formatCurrency(person.total) + </div><div class="ranking-meta">Recebeu ' + formatCurrency(person.receivedTotal) + '</div></div></div>').join('');
    }

    function renderProducts(containerId, products) {
      const container = document.getElementById(containerId);
      if (!container) return;
      if (!products.length) {
        container.innerHTML = '<div class="metric-empty">Nenhum produto vendido nesta data.</div>';
        return;
      }
      container.innerHTML = products.map((product, index) => '<div class="ranking-row"><div class="ranking-info"><span class="ranking-rank" style="color:var(--primary);">' + (index + 1) + 'º</span><div><div class="ranking-name" title="' + escapeHtml(product.name) + '">' + escapeHtml(product.name) + '</div><div class="ranking-meta">' + escapeHtml(product.category || 'Geral') + ' · ' + product.quantity + ' unidade(s)</div></div></div><div class="ranking-values"><div class="ranking-val">' + formatCurrency(product.revenue) + '</div></div></div>').join('');
    }

    async function sendDailyReport() {
      const button = document.getElementById('btnSendReport');
      const whatsappBtn = document.getElementById('btnSendWhatsappClosing');
      const activeBtn = button || whatsappBtn;
      const originalText = activeBtn ? activeBtn.innerHTML : '';
      if (activeBtn) {
        activeBtn.disabled = true;
        activeBtn.innerHTML = '<span class="loading-spinner"></span> Enviando relatório...';
      }
      try {
        const response = await window.ConfloraSession.apiFetch('/api/admin/executive-metrics/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: document.getElementById('reportDate').value }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'failed_to_send_report'.tr);
        showToast('report_sent_to_junior_via_whatsapp'.tr);
      } catch (err) {
        showToast('could_not_send_955d6b'.tr + err.message);
      } finally {
        if (activeBtn) {
          activeBtn.innerHTML = originalText;
          activeBtn.disabled = false;
        }
      }
    }

    async function registerCashClosing() {
      const date = document.getElementById('reportDate').value;
      if (!date || !window.confirm('confirm_and_record_cash_register_closure_for'.tr + date.split('-').reverse().join('/') + '?')) return;
      const button = document.getElementById('btnCloseCash');
      const originalText = button.innerHTML;
      button.disabled = true;
      button.textContent = 'Registrando fechamento...';
      try {
        const getVal = (id) => {
          const raw = document.getElementById(id)?.value;
          if (!raw || isNaN(raw)) return 0;
          return parseFloat(raw) || 0;
        };
        const counted = {
          cash: getVal('inputCountedCash'),
          pix: getVal('inputCountedPix'),
          credit: getVal('inputCountedCredit'),
          debit: getVal('inputCountedDebit'),
          onAccount: getVal('inputCountedOnAccount'),
        };
        const notes = document.getElementById('closingNotesInput')?.value.trim() || '';
        const receiptProofUrl = currentUploadedProofUrl || null;

        const response = await window.ConfloraSession.apiFetch('/api/admin/cashier/close-day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date,
            counted,
            receiptProofUrl,
            notes,
            requestId: sessionStorage.getItem('closing:' + date) || (() => { const id = crypto.randomUUID(); sessionStorage.setItem('closing:' + date, id); return id; })()
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'could_not_record_closure'.tr);
        showToast('closure_of'.tr + date.split('-').reverse().join('/') + ' registrado com sucesso!');
        if (data.pdfUrl) {
          const pdfBtn = document.getElementById('btnDownloadClosingPdf');
          if (pdfBtn) {
            pdfBtn.href = data.pdfUrl;
            pdfBtn.hidden = false;
          }
        }
        checkClosingStatus(date);
      } catch (error) {
        showToast('could_not_record'.tr + error.message);
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
