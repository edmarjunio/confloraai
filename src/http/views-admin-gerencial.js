// Painel Admin Gerencial Conflora — Substituição de Alto Desempenho do Looker Studio
// Desenvolvido para os donos da empresa com foco em performance, UI/UX limpa e fechamento diário com envio de PDF no WhatsApp.

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
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Conflora — Painel Gerencial & Fluxo de Caixa (Looker)</title>
  <style>
    :root {
      --primary: #15803d;
      --primary-hover: #166534;
      --primary-light: #dcfce7;
      --primary-dark: #14532d;
      --pix: #059669;
      --card: #2563eb;
      --cash: #d97706;
      --bg: #f8fafc;
      --surface: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --muted: #64748b;
      --danger: #dc2626;
      --radius: 12px;
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.05);
      --shadow: 0 4px 12px rgba(0,0,0,0.06);
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
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: var(--shadow-sm);
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: var(--text);
    }
    .brand-logo {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: var(--primary);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 18px;
    }
    .brand-title {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.3px;
    }
    .brand-sub {
      font-size: 12px;
      color: var(--muted);
      display: block;
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
    .btn-action:hover { background: #f1f5f9; }
    .btn-action.primary {
      background: var(--primary);
      color: #fff;
      border-color: var(--primary);
    }
    .btn-action.primary:hover { background: var(--primary-hover); }
    .btn-action.close-day {
      background: #0f172a;
      color: #fff;
      border-color: #0f172a;
      box-shadow: 0 2px 6px rgba(15,23,42,0.2);
    }
    .btn-action.close-day:hover { background: #1e293b; }

    .main-container {
      max-width: 1240px;
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
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      background: #fff;
      padding: 14px 18px;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-sm);
    }
    .toolbar-left h1 {
      font-size: 20px;
      font-weight: 800;
      color: var(--text);
      letter-spacing: -0.4px;
    }
    .toolbar-left p {
      font-size: 13px;
      color: var(--muted);
      margin-top: 2px;
    }
    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .date-input {
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      background: #f8fafc;
    }

    /* CARDS DE RESUMO NO TOPO */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
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
      overflow: hidden;
    }
    .summary-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 4px;
      background: var(--border);
    }
    .summary-card.highlight::before { background: var(--primary); }
    .summary-card.pix::before { background: var(--pix); }
    .summary-card.card::before { background: var(--card); }
    .summary-card.cash::before { background: var(--cash); }

    .summary-label {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .summary-val {
      font-size: 24px;
      font-weight: 900;
      color: var(--text);
      letter-spacing: -0.5px;
    }
    .summary-sub {
      font-size: 11.5px;
      color: var(--muted);
      font-weight: 500;
    }
    .summary-sub strong { color: var(--text); }

    /* LAYOUT DE 2 COLUNAS PARA MÉTRICAS DETALHADAS */
    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
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
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 10px;
    }
    .panel-title {
      font-size: 15px;
      font-weight: 800;
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
      background: #f1f5f9;
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

    .payment-legend {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 8px;
    }
    .legend-item {
      padding: 10px;
      background: #f8fafc;
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
      background: #f8fafc;
      border: 1px solid #f1f5f9;
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
      color: var(--text);
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
      font-weight: 800;
      color: var(--text);
    }
    .ranking-pct {
      font-size: 11px;
      font-weight: 600;
      color: var(--primary);
    }

    /* BARRAS POR HORÁRIO */
    .hourly-grid {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      height: 120px;
      padding-top: 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .hourly-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      height: 100%;
      justify-content: flex-end;
    }
    .hourly-bar {
      width: 100%;
      background: #93c5fd;
      border-radius: 4px 4px 0 0;
      transition: height 0.3s ease;
      min-height: 4px;
    }
    .hourly-bar.peak { background: var(--primary); }
    .hourly-label {
      font-size: 10px;
      color: var(--muted);
      font-weight: 600;
    }

    /* MODAL DE FECHAMENTO DE CAIXA */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(3px);
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
      max-width: 480px;
      width: 100%;
      padding: 24px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.25);
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-header h3 { font-size: 18px; font-weight: 800; }
    .btn-modal-close {
      background: none; border: none; font-size: 24px; cursor: pointer; color: var(--muted);
    }
    .close-summary-box {
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .close-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
    }
    .close-row strong { font-weight: 800; }

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
  </style>
</head>
<body>

  <!-- CABEÇALHO -->
  <header>
    <a href="/admin" class="brand">
      <div class="brand-logo">C</div>
      <div>
        <div class="brand-title">Conflora Gerencial</div>
        <span class="brand-sub">Substituição Looker Studio · Faturamento & Equipe</span>
      </div>
    </a>

    <div class="header-actions">
      <a href="/caixa" class="btn-action">⚡ Ir ao Caixa / PDV</a>
      <a href="/admin" class="btn-action">⚙️ Admin Completo</a>
      <button class="btn-action close-day" onclick="openCloseDayModal()">
        🏁 Fechar Caixa & Enviar PDF (WhatsApp)
      </button>
    </div>
  </header>

  <!-- CONTEÚDO PRINCIPAL -->
  <div class="main-container">

    <!-- TOOLBAR COM FILTRO DE DATA -->
    <div class="toolbar">
      <div class="toolbar-left">
        <h1>Fluxo de Caixa & Métricas Oficiais</h1>
        <p>Valores consolidados em tempo real diretamente do Firestore</p>
      </div>
      <div class="toolbar-right">
        <label for="reportDate" style="font-size:12px; font-weight:700; color:var(--muted);">Data:</label>
        <input type="date" id="reportDate" class="date-input" onchange="loadExecutiveMetrics()" />
        <button class="btn-action primary" onclick="loadExecutiveMetrics()">
          🔄 Atualizar
        </button>
      </div>
    </div>

    <!-- CARDS DE RESUMO DO DIA (VALORES DO DIA NO TOPO) -->
    <div class="summary-grid">
      <div class="summary-card highlight">
        <div class="summary-label">💰 Fluxo Consolidado</div>
        <div class="summary-val" id="cardTotal">R$ 0,00</div>
        <div class="summary-sub"><strong id="cardCount">0</strong> vendas realizadas</div>
      </div>

      <div class="summary-card">
        <div class="summary-label">🎯 Ticket Médio</div>
        <div class="summary-val" id="cardTicket">R$ 0,00</div>
        <div class="summary-sub">Média por pedido</div>
      </div>

      <div class="summary-card pix">
        <div class="summary-label">📱 Vendas no PIX</div>
        <div class="summary-val" id="cardPix">R$ 0,00</div>
        <div class="summary-sub"><strong id="cardPixCount">0</strong> comprovantes validados</div>
      </div>

      <div class="summary-card card">
        <div class="summary-label">💳 Vendas Cartão</div>
        <div class="summary-val" id="cardCard">R$ 0,00</div>
        <div class="summary-sub"><strong id="cardCardCount">0</strong> no débito/crédito</div>
      </div>

      <div class="summary-card cash">
        <div class="summary-label">💵 Vendas Dinheiro</div>
        <div class="summary-val" id="cardCash">R$ 0,00</div>
        <div class="summary-sub"><strong id="cardCashCount">0</strong> recebimentos em espécie</div>
      </div>
    </div>

    <!-- PAINÉIS DETALHADOS -->
    <div class="details-grid">

      <!-- PAINEL 1: FORMAS DE PAGAMENTO -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">💳 Formas de Pagamento</div>
          <span class="panel-tag">Segmentação do Faturamento</span>
        </div>

        <div class="payment-bar" id="paymentBar">
          <div class="payment-bar-seg pix" id="barPix" style="width: 33.3%;"></div>
          <div class="payment-bar-seg card" id="barCard" style="width: 33.3%;"></div>
          <div class="payment-bar-seg cash" id="barCash" style="width: 33.4%;"></div>
        </div>

        <div class="payment-legend">
          <div class="legend-item">
            <div class="legend-title"><span class="legend-dot" style="background:var(--pix);"></span> PIX</div>
            <div class="legend-val" id="legPixVal">R$ 0,00</div>
            <div class="legend-sub" id="legPixPct">0% do total</div>
          </div>

          <div class="legend-item">
            <div class="legend-title"><span class="legend-dot" style="background:var(--card);"></span> Cartão</div>
            <div class="legend-val" id="legCardVal">R$ 0,00</div>
            <div class="legend-sub" id="legCardPct">0% do total</div>
          </div>

          <div class="legend-item">
            <div class="legend-title"><span class="legend-dot" style="background:var(--cash);"></span> Dinheiro</div>
            <div class="legend-val" id="legCashVal">R$ 0,00</div>
            <div class="legend-sub" id="legCashPct">0% do total</div>
          </div>
        </div>

        <!-- HORÁRIO DE PICOS -->
        <div style="margin-top:12px;">
          <div style="font-size:12px; font-weight:700; color:var(--muted); margin-bottom:4px;">Fluxo de Vendas por Horário Comercial (08h às 19h)</div>
          <div class="hourly-grid" id="hourlyChart"></div>
        </div>
      </div>

      <!-- PAINEL 2: VENDAS POR COLABORADOR -->
      <div class="panel-card">
        <div class="panel-header">
          <div class="panel-title">👥 Vendas por Colaborador</div>
          <span class="panel-tag">Desempenho da Equipe</span>
        </div>

        <div class="ranking-list" id="collaboratorList">
          <div style="color:var(--muted); font-size:13px; padding:10px;">Carregando colaboradores...</div>
        </div>
      </div>

      <!-- PAINEL 3: PRODUTOS MAIS VENDIDOS -->
      <div class="panel-card" style="grid-column: 1 / -1;">
        <div class="panel-header">
          <div class="panel-title">🏆 Ranking dos Produtos Mais Vendidos</div>
          <span class="panel-tag">Itens em Destaque</span>
        </div>

        <div class="ranking-list" id="topProductsList">
          <div style="color:var(--muted); font-size:13px; padding:10px;">Carregando ranking de produtos...</div>
        </div>
      </div>

    </div>

  </div>

  <!-- MODAL DE FECHAMENTO DE CAIXA -->
  <div id="modalCloseDay" class="modal-overlay hidden">
    <div class="modal-card">
      <div class="modal-header">
        <h3>🏁 Fechar Caixa & Notificar Patrão</h3>
        <button class="btn-modal-close" onclick="closeCloseDayModal()">✕</button>
      </div>

      <p style="font-size:13px; color:var(--muted);">
        Ao confirmar, o sistema gerará o <strong>Relatório Executivo em PDF</strong> com todos os valores do dia e enviará automaticamente via WhatsApp para o número cadastrado da diretoria.
      </p>

      <div class="close-summary-box">
        <div class="close-row">
          <span>Data de Fechamento:</span>
          <strong id="modalCloseDate">--/--/----</strong>
        </div>
        <div class="close-row">
          <span>Faturamento Consolidado:</span>
          <strong id="modalCloseTotal" style="color:var(--primary);">R$ 0,00</strong>
        </div>
        <div class="close-row">
          <span>Total de Vendas:</span>
          <strong id="modalCloseCount">0 pedidos</strong>
        </div>
        <div class="close-row">
          <span>WhatsApp Destino:</span>
          <span style="font-size:11.5px; color:var(--muted);" id="modalClosePhone">Número do Patrão (Oficial)</span>
        </div>
      </div>

      <div>
        <label for="closeOperator" style="display:block; font-size:12px; font-weight:700; color:var(--text); margin-bottom:4px;">
          Responsável pelo Fechamento:
        </label>
        <input type="text" id="closeOperator" value="Administrador" style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;" />
      </div>

      <div>
        <label for="closeNotes" style="display:block; font-size:12px; font-weight:700; color:var(--text); margin-bottom:4px;">
          Observações / Ocorrências do dia (opcional):
        </label>
        <textarea id="closeNotes" rows="2" placeholder="Ex: Sem pendências; sangria realizada com sucesso." style="width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font-size:13px;"></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:8px;">
        <button class="btn-action" onclick="closeCloseDayModal()">Cancelar</button>
        <button id="btnConfirmCloseDay" class="btn-action close-day" onclick="submitCloseDay()">
          Confirmar Fechamento & Enviar PDF
        </button>
      </div>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>

  <!-- SCRIPT GERENCIAL -->
  <script>
    let currentMetrics = null;

    // Inicialização da data
    document.addEventListener('DOMContentLoaded', () => {
      const today = new Date().toISOString().slice(0, 10);
      document.getElementById('reportDate').value = today;
      loadExecutiveMetrics();
    });

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.remove('hidden');
      setTimeout(() => t.classList.add('hidden'), 3500);
    }

    async function loadExecutiveMetrics() {
      const date = document.getElementById('reportDate').value || new Date().toISOString().slice(0, 10);
      try {
        const res = await fetch('/api/admin/executive-metrics?date=' + encodeURIComponent(date));
        if (res.status === 401 || res.status === 403) {
          showToast('Acesso restrito ao Administrador.');
          return;
        }
        const data = await res.json();
        currentMetrics = data;
        renderMetrics(data);
      } catch (err) {
        showToast('Erro ao carregar dados do dia: ' + err.message);
      }
    }

    function renderMetrics(m) {
      if (!m) return;

      const fmt = (v) => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

      // Top Cards
      document.getElementById('cardTotal').textContent = fmt(m.totalRevenue);
      document.getElementById('cardCount').textContent = m.orderCount || 0;
      document.getElementById('cardTicket').textContent = fmt(m.ticketMedio);

      const pPix = m.byPayment?.PIX || { total: 0, count: 0 };
      const pCard = m.byPayment?.CARTAO || { total: 0, count: 0 };
      const pCash = m.byPayment?.DINHEIRO || { total: 0, count: 0 };

      document.getElementById('cardPix').textContent = fmt(pPix.total);
      document.getElementById('cardPixCount').textContent = pPix.count || 0;

      document.getElementById('cardCard').textContent = fmt(pCard.total);
      document.getElementById('cardCardCount').textContent = pCard.count || 0;

      document.getElementById('cardCash').textContent = fmt(pCash.total);
      document.getElementById('cardCashCount').textContent = pCash.count || 0;

      // Barras de Pagamento
      const total = Number(m.totalRevenue || 0);
      const pixPct = total > 0 ? Math.round((pPix.total / total) * 100) : 0;
      const cardPct = total > 0 ? Math.round((pCard.total / total) * 100) : 0;
      const cashPct = total > 0 ? Math.max(0, 100 - pixPct - cardPct) : 0;

      document.getElementById('barPix').style.width = pixPct + '%';
      document.getElementById('barCard').style.width = cardPct + '%';
      document.getElementById('barCash').style.width = cashPct + '%';

      document.getElementById('legPixVal').textContent = fmt(pPix.total);
      document.getElementById('legPixPct').textContent = pixPct + '% do dia';

      document.getElementById('legCardVal').textContent = fmt(pCard.total);
      document.getElementById('legCardPct').textContent = cardPct + '% do dia';

      document.getElementById('legCashVal').textContent = fmt(pCash.total);
      document.getElementById('legCashPct').textContent = cashPct + '% do dia';

      // Gráfico de horários
      renderHourlyChart(m.hourlyDistribution || []);

      // Colaboradores
      renderCollaborators(m.byCollaborator || []);

      // Produtos Mais Vendidos
      renderTopProducts(m.topProducts || []);
    }

    function renderHourlyChart(hours) {
      const container = document.getElementById('hourlyChart');
      if (!hours || !hours.length) {
        container.innerHTML = '<div style="font-size:11px; color:var(--muted); padding:10px;">Sem dados horários registrados hoje.</div>';
        return;
      }
      const maxVal = Math.max(...hours.map(h => h.total || 0), 1);
      container.innerHTML = hours.map(h => {
        const heightPct = Math.max(8, Math.round(((h.total || 0) / maxVal) * 100));
        const isPeak = heightPct > 70;
        return \`
          <div class="hourly-col" title="\${h.hour}: R$ \${Number(h.total||0).toFixed(2)} (\${h.count} vendas)">
            <div class="hourly-bar \${isPeak ? 'peak' : ''}" style="height: \${heightPct}%;"></div>
            <span class="hourly-label">\${h.hour.slice(0, 2)}h</span>
          </div>
        \`;
      }).join('');
    }

    function renderCollaborators(collabs) {
      const container = document.getElementById('collaboratorList');
      if (!collabs.length) {
        container.innerHTML = '<div style="font-size:13px; color:var(--muted); padding:10px;">Nenhuma venda atribuída à equipe nesta data.</div>';
        return;
      }
      container.innerHTML = collabs.map((c, i) => \`
        <div class="ranking-row">
          <div class="ranking-info">
            <span class="ranking-rank">\${i + 1}º</span>
            <div>
              <div class="ranking-name">👤 \${c.name}</div>
              <div class="ranking-meta">\${c.count} atendimentos concluídos</div>
            </div>
          </div>
          <div class="ranking-values">
            <div class="ranking-val">R$ \${Number(c.total || 0).toFixed(2).replace('.', ',')}</div>
            <div class="ranking-pct">\${c.percentage || 0}% do dia</div>
          </div>
        </div>
      \`).join('');
    }

    function renderTopProducts(products) {
      const container = document.getElementById('topProductsList');
      if (!products.length) {
        container.innerHTML = '<div style="font-size:13px; color:var(--muted); padding:10px;">Nenhum produto registrado nesta data.</div>';
        return;
      }
      container.innerHTML = products.map((p, i) => \`
        <div class="ranking-row">
          <div class="ranking-info">
            <span class="ranking-rank" style="color:var(--primary);">#\${i + 1}</span>
            <div>
              <div class="ranking-name">\${p.name}</div>
              <div class="ranking-meta">\${p.category || 'Geral'} · \${p.quantity} unidades vendidas</div>
            </div>
          </div>
          <div class="ranking-values">
            <div class="ranking-val">R$ \${Number(p.revenue || 0).toFixed(2).replace('.', ',')}</div>
          </div>
        </div>
      \`).join('');
    }

    // FECHAMENTO DE CAIXA
    function openCloseDayModal() {
      if (!currentMetrics) {
        showToast('Aguarde o carregamento dos dados...');
        return;
      }
      const date = document.getElementById('reportDate').value || '';
      document.getElementById('modalCloseDate').textContent = date.split('-').reverse().join('/');
      document.getElementById('modalCloseTotal').textContent = 'R$ ' + Number(currentMetrics.totalRevenue || 0).toFixed(2).replace('.', ',');
      document.getElementById('modalCloseCount').textContent = (currentMetrics.orderCount || 0) + ' vendas';
      document.getElementById('modalCloseDay').classList.remove('hidden');
    }

    function closeCloseDayModal() {
      document.getElementById('modalCloseDay').classList.add('hidden');
    }

    async function submitCloseDay() {
      const btn = document.getElementById('btnConfirmCloseDay');
      const originalText = btn.innerHTML;
      btn.innerHTML = '<span class="loading-spinner"></span> Fechando e enviando PDF...';
      btn.disabled = true;

      const date = document.getElementById('reportDate').value;
      const closedBy = document.getElementById('closeOperator').value;
      const notes = document.getElementById('closeNotes').value;

      try {
        const res = await fetch('/api/admin/cashier/close-day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, closedBy, notes }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Falha ao fechar o caixa');

        closeCloseDayModal();
        let successMsg = '✅ Caixa fechado com sucesso!';
        if (data.whatsappSent) {
          successMsg += ' Relatório enviado no WhatsApp do Patrão!';
        }
        showToast(successMsg);

        if (data.pdfUrl) {
          setTimeout(() => {
            if (confirm('Deseja abrir o PDF do relatório agora?')) {
              window.open(data.pdfUrl, '_blank');
            }
          }, 800);
        }
      } catch (err) {
        showToast('Erro: ' + err.message);
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
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
