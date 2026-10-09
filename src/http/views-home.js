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

function renderInitialProductCards(items) {
  if (!Array.isArray(items)) {
    return '';
  }
  return items.slice(0, 24).map(p => {
    const price = Number(p.valor_num || p.price || 0);
    const byKg = (p.unit || p.unidade || '').toUpperCase() === 'KG' || /\bkg\b/i.test(p.descricao || p.name || '');
    const img = (p.images && p.images[0]) || p.imageUrl || p.imageurl || 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=800';
    return `
      <div class="prod-card" data-prod-id="${p.id}">
        <div class="card-img-wrapper" onclick="openGallery('${p.id}')">
          <img class="prod-img" src="${img}" alt="${p.descricao || p.name}" loading="lazy" decoding="async" />
          ${byKg ? '<span class="unit-tag-badge">⚖️ POR KG</span>' : ''}
        </div>
        <div class="card-body">
          <span class="card-category">${p.subcategoria || p.subcategory || p.categoria || p.category || 'Conflora'}</span>
          <div class="card-title" onclick="openGallery('${p.id}')">${p.descricao || p.name}</div>
          <div class="card-footer">
            <div>
              <div class="card-price">R$ ${price.toFixed(2).replace('.', ',')} <span style="font-size:11px; font-weight:normal; color:#64748b;">${byKg ? '/kg' : ''}</span></div>
              <span class="card-stock">${p.stockQuantity ?? p.estoque ?? 30} ${byKg ? 'kg' : 'un.'} disp.</span>
            </div>
            <div class="card-btn-container" id="cardBtnContainer_${p.id}">
              <button class="add-btn add-btn-initial" onclick="handleProductAddClick('${p.id}', event)" title="Adicionar à Sacola">
                ${byKg ? '⚖️ +' : '+'}
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHomeHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
  <title>Conflora Horta e Viveiro — Cardápio Digital & Pedidos</title>
  <meta name="description" content="Cardápio Digital & Pedidos Diretos - Conflora Horta e Viveiro em Mineiros - GO">
  ${GOOGLE_ANALYTICS_TAG}
  ${FETCH_SHIM_SCRIPT}
  <script src="https://accounts.google.com/gsi/client" async defer></script>

  <!-- Fontes Canva: Títulos com estética Intro Rust & Secundárias com Now -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,800;0,900;1,800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">

  <style>
    @font-face {
      font-family: 'Intro Rust';
      src: local('Intro Rust'), local('IntroRust-Base'), local('Montserrat-Black');
      font-weight: 800 900;
    }
    @font-face {
      font-family: 'Now';
      src: local('Now'), local('Plus Jakarta Sans'), local('Inter'), local('system-ui');
      font-weight: 400 500;
    }

    :root {
      --primary: #2E9348;
      --primary-dark: #237438;
      --primary-light: #eaf6ed;
      --accent: #2E9348;
      --earth: #78350f;
      --sand: #fef9c3;
      --gold: #F5C518;
      --accent-gold: #F5C518;
      --bg: #F8F9FA;
      --card-bg: #ffffff;
      --text: #1A1A1A;
      --text-muted: #64748b;
      --border: #E5E7EB;
      --wa-color: #25d366;
      --danger: #ef4444;

      --font-title: 'Intro Rust', 'Montserrat', -apple-system, sans-serif;
      --font-body: 'Now', 'Plus Jakarta Sans', -apple-system, sans-serif;
    }

    /* 1. RESPONSIVIDADE MOBILE-FIRST & RESET TOTAL DE OVERFLOW */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      min-width: 100%;
      max-width: 100%;
      overflow-x: hidden;
      font-family: var(--font-body);
      font-weight: 400;
      background: #f1f5f9;
      color: var(--text);
      line-height: 1.5;
      -webkit-tap-highlight-color: transparent;
    }

    h1, h2, h3, .brand-title h1, .panel-title, .modal-header h3, .cat-title-rust {
      font-family: var(--font-title);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-weight: 900;
    }

    /* BARRA SUPERIOR DE TOOLBAR */
    .top-toolbar {
      width: 100%;
      background: #0f172a;
      color: white;
      padding: 8px 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      position: sticky;
      top: 0;
      z-index: 50;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      flex-wrap: wrap;
      gap: 8px;
    }

    .lang-selector-group {
      display: inline-flex;
      background: rgba(255,255,255,0.12);
      border-radius: 6px;
      padding: 2px;
      gap: 2px;
    }
    .lang-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }
    .lang-btn:hover { color: white; }
    .lang-btn.active {
      background: #15803d;
      color: white;
    }

    .admin-link-btn {
      color: #86efac;
      text-decoration: none;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 6px;
      background: rgba(255,255,255,0.1);
      border: none;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s;
    }
    .admin-link-btn:hover { background: rgba(255,255,255,0.2); }

    .google-auth-btn {
      background: white;
      color: #1e293b;
      border: 1px solid #cbd5e1;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .google-auth-btn:hover { background: #f8fafc; border-color: #94a3b8; }

    .status-pill-btn {
      background: #064e3b;
      color: #6ee7b7;
      border: 1px solid #059669;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s;
    }
    .status-pill-btn:hover { background: #047857; color: white; }

    /* 6. BANNER DE CUPOM DE DESCONTO NO TOPO */
    .promo-banner {
      width: 100%;
      background: linear-gradient(90deg, #166534 0%, #15803d 50%, #14532d 100%);
      color: white;
      padding: 10px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      border-bottom: 2px solid #86efac;
      flex-wrap: wrap;
    }
    .promo-banner-content {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .promo-badge {
      background: #facc15;
      color: #78350f;
      font-size: 11px;
      font-weight: 900;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }
    .promo-text {
      font-size: 13px;
      font-weight: 600;
    }
    .promo-apply-btn {
      background: #ffffff;
      color: #14532d;
      border: none;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.12);
      transition: all 0.15s;
      white-space: nowrap;
    }
    .promo-apply-btn:hover {
      background: #f0fdf4;
      transform: scale(1.03);
    }

    /* CONTAINER PRINCIPAL DA APLICAÇÃO */
    .app-container {
      width: 100%;
      max-width: 1380px;
      margin: 0 auto;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: var(--bg);
      box-shadow: 0 0 25px rgba(0,0,0,0.04);
      position: relative;
    }

    .brand-header {
      width: 100%;
      background: #14532d;
      background-image: linear-gradient(135deg, #14532d 0%, #166534 60%, #1b4332 100%);
      color: white;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #22c55e;
      flex-wrap: wrap;
      gap: 12px;
    }
    .brand-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .conflora-logo-badge {
      width: 44px;
      height: 44px;
      background: #ffffff;
      color: #14532d;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.15);
      border: 2px solid #86efac;
      flex-shrink: 0;
    }
    .brand-title h1 {
      font-size: 19px;
      letter-spacing: 0.5px;
      margin: 0;
      color: #ffffff;
      line-height: 1.2;
    }
    .brand-title p {
      font-size: 12px;
      color: #bbf7d0;
      margin-top: 2px;
    }
    .cart-pill-btn {
      background: #ffffff;
      color: #14532d;
      border: none;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: transform 0.15s;
    }
    .cart-pill-btn:hover { transform: scale(1.03); }

    /* LAYOUT PRINCIPAL DO CATÁLOGO */
    .app-main {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 390px;
      gap: 20px;
      padding: 20px;
      max-width: 100%;
    }
    @media (max-width: 980px) {
      .app-main {
        grid-template-columns: 1fr;
        padding: 12px 10px 90px 10px;
        gap: 14px;
      }
    }

    /* 4. CARROSSEL DE CATEGORIAS ISOLADO */
    .categories-bar-wrapper {
      width: 100%;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .categories-bar {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      flex-wrap: nowrap;
      white-space: nowrap;
      padding: 4px 2px 8px 2px;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      width: 100%;
    }
    .categories-bar::-webkit-scrollbar {
      display: none;
    }
    .cat-btn {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.15s;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .cat-btn:hover { border-color: var(--primary); }
    .cat-btn.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
      font-weight: 700;
      box-shadow: 0 2px 6px rgba(21, 128, 61, 0.25);
    }

    .subcategories-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 14px;
      width: 100%;
    }
    .subcat-btn {
      background: #f1f5f9;
      border: 1px solid transparent;
      border-radius: 14px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s;
    }
    .subcat-btn:hover { background: #e2e8f0; color: var(--text); }
    .subcat-btn.active {
      background: var(--primary-light);
      color: var(--primary-dark);
      font-weight: 700;
      border-color: #86efac;
    }

    /* 3. ORDENAÇÃO A-Z COMO REGRA PADRÃO & BARRA DE BUSCA */
    .catalog-toolbar {
      width: 100%;
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search-input-wrap {
      flex: 1;
      min-width: 200px;
      position: relative;
    }
    .search-input {
      width: 100%;
      padding: 10px 14px 10px 38px;
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 14px;
      background: #ffffff;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .search-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.15);
    }
    .search-icon-inside {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 15px;
      color: #94a3b8;
      pointer-events: none;
    }
    .sort-select {
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 13px;
      background: #ffffff;
      outline: none;
      cursor: pointer;
      font-weight: 600;
      color: var(--text);
    }

    /* 5. GRID MOBILE 2 COLUNAS PROPORCIONAIS & CARDS IFOOD */
    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 14px;
      width: 100%;
    }
    @media (max-width: 640px) {
      .products-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
    }

    .prod-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 5px rgba(0,0,0,0.02);
      transition: transform 0.15s, box-shadow 0.15s;
      position: relative;
    }
    .prod-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 14px rgba(0,0,0,0.06);
    }

    .card-img-wrapper {
      width: 100%;
      aspect-ratio: 1/1;
      background: #f1f5f9;
      position: relative;
      cursor: pointer;
      overflow: hidden;
    }
    .prod-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.3s;
    }
    .prod-card:hover .prod-img {
      transform: scale(1.04);
    }

    .photo-count-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      background: rgba(15, 23, 42, 0.75);
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 10px;
      backdrop-filter: blur(2px);
    }
    .unit-tag-badge {
      position: absolute;
      bottom: 6px;
      left: 6px;
      background: #f59e0b;
      color: #78350f;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }

    .card-body {
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      flex: 1;
      justify-content: space-between;
    }
    .card-category {
      font-size: 11px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 700;
      margin-bottom: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .card-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
      line-height: 1.3;
      margin-bottom: 8px;
      cursor: pointer;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 34px;
    }
    .card-title:hover { color: var(--primary); }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 4px;
    }
    .card-price {
      font-size: 15px;
      font-weight: 800;
      color: var(--primary-dark);
      line-height: 1.1;
    }
    .card-stock {
      font-size: 10px;
      color: #64748b;
      display: block;
      margin-top: 2px;
    }

    /* 5. CONTROLE DE QUANTIDADE ESTILO IFOOD NO PRÓPRIO CARD */
    .card-btn-container {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      min-height: 32px;
    }
    .add-btn {
      background: var(--primary);
      color: white;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      font-size: 18px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      box-shadow: 0 2px 4px rgba(21, 128, 61, 0.2);
    }
    .add-btn:hover { background: #166534; transform: scale(1.05); }
    .add-btn:active { transform: scale(0.95); }

    .card-qty-ctrl {
      display: flex;
      align-items: center;
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 8px;
      overflow: hidden;
      height: 32px;
    }
    .card-qty-btn {
      background: transparent;
      border: none;
      color: var(--primary-dark);
      width: 28px;
      height: 100%;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.1s;
    }
    .card-qty-btn:hover { background: #bbf7d0; }
    .card-qty-num {
      padding: 0 6px;
      font-size: 12px;
      font-weight: 800;
      color: var(--primary-dark);
      min-width: 24px;
      text-align: center;
    }

    /* PAINEL LATERAL / SACOLA */
    .cart-panel {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
      height: fit-content;
      max-height: calc(100vh - 70px);
      overflow-y: auto;
      position: sticky;
      top: 54px;
    }
    .bottom-sheet-handle-bar {
      display: none;
    }
    .bottom-sheet-close-btn {
      display: none;
    }
    .cart-bottom-sheet-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(2px);
      z-index: 115;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease-out;
    }
    .cart-bottom-sheet-backdrop.open {
      opacity: 1;
      pointer-events: auto;
    }
    .cart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 12px;
    }
    .cart-header h2 {
      font-size: 17px;
      color: var(--primary-dark);
    }
    .cart-items-list {
      max-height: 280px;
      overflow-y: auto;
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 4px;
    }
    .cart-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 10px;
      background: #f8fafc;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      gap: 8px;
    }
    .cart-item-title {
      flex: 1;
      font-size: 12px;
      font-weight: 600;
      color: var(--text);
      line-height: 1.2;
    }
    .cart-qty-ctrl-row {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .qty-btn {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      background: white;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .qty-btn:hover { background: #e2e8f0; }

    /* CUPOM DE DESCONTO NA SACOLA */
    .coupon-box {
      background: #f8fafc;
      border: 1px dashed #94a3b8;
      border-radius: 10px;
      padding: 10px;
      margin-bottom: 12px;
    }
    .coupon-input-wrap {
      display: flex;
      gap: 6px;
    }
    .coupon-input {
      flex: 1;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 12px;
      text-transform: uppercase;
      font-weight: 700;
      outline: none;
    }
    .coupon-input:focus { border-color: var(--primary); }
    .coupon-btn {
      background: #0f172a;
      color: white;
      border: none;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s;
    }
    .coupon-btn:hover { background: #1e293b; }
    .coupon-feedback {
      margin-top: 6px;
      font-size: 11px;
      font-weight: 600;
      display: none;
    }
    .coupon-feedback.success {
      color: #166534;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .coupon-feedback.error { color: #dc2626; }
    .coupon-remove-btn {
      background: none;
      border: none;
      color: #ef4444;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: underline;
    }

    .cart-totals-summary {
      border-top: 1px solid var(--border);
      padding-top: 10px;
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 13px;
    }
    .cart-summary-line {
      display: flex;
      justify-content: space-between;
      color: var(--text-muted);
    }
    .cart-summary-line.total-line {
      font-size: 16px;
      font-weight: 800;
      color: var(--text);
      border-top: 1px solid var(--border);
      padding-top: 6px;
      margin-top: 4px;
    }
    .cart-discount-val {
      color: #166534;
      font-weight: 700;
    }

    /* FORMULÁRIO DE CHECKOUT */
    .form-group {
      margin-bottom: 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .form-label {
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }
    .form-input {
      padding: 9px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      background: white;
    }
    .form-input:focus { border-color: var(--primary); }

    .type-switcher, .pay-switcher {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px;
    }
    .pay-switcher {
      grid-template-columns: repeat(3, 1fr);
    }
    .type-option-btn, .pay-btn {
      padding: 8px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: white;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
      transition: all 0.15s;
    }
    .type-option-btn.selected, .pay-btn.selected {
      background: var(--primary-light);
      border-color: #86efac;
      color: var(--primary-dark);
      font-weight: 800;
    }

    .pix-box {
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
      font-size: 12px;
    }
    .pix-key-val {
      font-family: monospace;
      background: white;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid #cbd5e1;
      margin: 4px 0;
      font-weight: bold;
      word-break: break-all;
    }
    .copy-pix-btn {
      background: #166534;
      color: white;
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      margin-top: 4px;
    }

    /* 7. CAMPO DE DINHEIRO & CÁLCULO DE TROCO EM TEMPO REAL */
    .cash-calc-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .cash-quick-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }
    .cash-chip-btn {
      background: white;
      border: 1px solid #cbd5e1;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      color: #334155;
      transition: all 0.15s;
    }
    .cash-chip-btn:hover {
      background: #fef3c7;
      border-color: #f59e0b;
      color: #78350f;
    }
    .change-result-box {
      background: white;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 12px;
      margin-top: 4px;
      border: 1px solid #cbd5e1;
    }
    .change-result-box.ok {
      background: #f0fdf4;
      border-color: #86efac;
      color: #166534;
    }
    .change-result-box.warning {
      background: #fef2f2;
      border-color: #fca5a5;
      color: #991b1b;
    }

    .checkout-submit-btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 12px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      width: 100%;
      margin-top: 8px;
      box-shadow: 0 4px 10px rgba(21, 128, 61, 0.25);
      transition: all 0.15s;
    }
    .checkout-submit-btn:hover { background: #166534; transform: translateY(-1px); }
    .checkout-submit-btn:disabled {
      background: #94a3b8;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    /* 8. BOTÕES FLUTUANTES (FABs) AO ROLAR A TELA (> 150px) */
    .fabs-group {
      position: fixed;
      right: 16px;
      bottom: 74px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 40;
      opacity: 0;
      pointer-events: none;
      transform: translateY(10px);
      transition: opacity 0.25s, transform 0.25s;
    }
    .fabs-group.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }
    .fab-btn {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #0f172a;
      color: white;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      cursor: pointer;
      transition: transform 0.15s, background 0.15s;
    }
    .fab-btn:hover {
      transform: scale(1.08);
      background: #15803d;
    }
    .fab-btn:active {
      transform: scale(0.95);
    }

    /* 9. BARRA FIXA INFERIOR NO MOBILE */
    .mobile-cart-float-bar {
      display: none;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      width: 100%;
      background: #14532d;
      color: white;
      padding: 12px 18px;
      padding-bottom: calc(12px + env(safe-area-inset-bottom));
      justify-content: space-between;
      align-items: center;
      z-index: 45;
      box-shadow: 0 -4px 15px rgba(0,0,0,0.15);
      cursor: pointer;
    }
    @media (max-width: 980px) {
      .mobile-cart-float-bar {
        display: flex;
      }
      .cart-panel {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        top: auto;
        width: 100%;
        max-height: 88vh;
        border-radius: 24px 24px 0 0;
        z-index: 120;
        box-shadow: 0 -12px 36px rgba(0,0,0,0.22);
        transform: translateY(105%);
        transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
        padding: 12px 18px 24px 18px;
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
      }
      .cart-panel.bottom-sheet-open {
        transform: translateY(0);
      }
      .bottom-sheet-handle-bar {
        display: flex;
        justify-content: center;
        padding-bottom: 8px;
        cursor: grab;
      }
      .bottom-sheet-handle {
        width: 44px;
        height: 5px;
        background: #cbd5e1;
        border-radius: 4px;
      }
      .bottom-sheet-close-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: #f1f5f9;
        border: none;
        color: #64748b;
        font-size: 15px;
        font-weight: bold;
        cursor: pointer;
      }
    }

    /* CONFLORA AI - AGENTE BOTÂNICO */
    .botanical-ai-fab {
      position: fixed;
      right: 18px;
      bottom: 84px;
      width: 54px;
      height: 54px;
      border-radius: 50%;
      background: linear-gradient(135deg, #2E9348 0%, #1e6d33 100%);
      border: 2px solid #F5C518;
      box-shadow: 0 6px 20px rgba(46, 147, 72, 0.4), 0 2px 6px rgba(0,0,0,0.15);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 95;
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s;
      outline: none;
    }
    @media (min-width: 981px) {
      .botanical-ai-fab {
        bottom: 24px;
        right: 24px;
        width: 58px;
        height: 58px;
      }
    }
    .botanical-ai-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 8px 24px rgba(46, 147, 72, 0.5);
    }
    .botanical-ai-fab:active {
      transform: scale(0.95);
    }
    .ai-fab-icon {
      font-size: 24px;
      line-height: 1;
    }
    .ai-fab-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      background: #F5C518;
      color: #1A1A1A;
      font-size: 10px;
      font-weight: 900;
      padding: 1px 5px;
      border-radius: 8px;
      border: 1px solid white;
      letter-spacing: 0.3px;
    }

    /* CHAT DRAWER DO AGENTE BOTÂNICO */
    .botanical-ai-drawer {
      position: fixed;
      right: 24px;
      bottom: 92px;
      width: 410px;
      max-width: calc(100vw - 24px);
      height: 600px;
      max-height: calc(100vh - 110px);
      background: #FFFFFF;
      border: 1px solid #E5E7EB;
      border-radius: 20px;
      box-shadow: 0 16px 40px rgba(0,0,0,0.22);
      z-index: 125;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transform: scale(0.92) translateY(20px);
      opacity: 0;
      pointer-events: none;
      transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .botanical-ai-drawer.open {
      transform: scale(1) translateY(0);
      opacity: 1;
      pointer-events: auto;
    }
    @media (max-width: 640px) {
      .botanical-ai-drawer {
        right: 0;
        left: 0;
        bottom: 0;
        width: 100%;
        max-width: 100%;
        height: 85vh;
        max-height: 85vh;
        border-radius: 22px 22px 0 0;
        transform: translateY(105%);
      }
      .botanical-ai-drawer.open {
        transform: translateY(0);
      }
    }

    .ai-drawer-header {
      background: linear-gradient(135deg, #2E9348 0%, #1e6d33 100%);
      color: white;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #F5C518;
    }
    .ai-drawer-title-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ai-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      border: 2px solid #F5C518;
    }
    .ai-title-text h3 {
      font-size: 14px;
      font-weight: 800;
      margin: 0;
      color: white;
      letter-spacing: 0.3px;
    }
    .ai-title-text span {
      font-size: 11px;
      color: #dcfce7;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .ai-status-dot {
      width: 7px;
      height: 7px;
      background: #4ade80;
      border-radius: 50%;
      display: inline-block;
    }

    .ai-chat-messages {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #F8F9FA;
    }

    .ai-msg {
      display: flex;
      flex-direction: column;
      max-width: 88%;
      animation: aiMsgFadeIn 0.2s ease-out;
    }
    @keyframes aiMsgFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ai-msg.bot {
      align-self: flex-start;
    }
    .ai-msg.user {
      align-self: flex-end;
    }
    .ai-bubble {
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.45;
    }
    .ai-msg.bot .ai-bubble {
      background: white;
      color: #1A1A1A;
      border: 1px solid #E5E7EB;
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.03);
    }
    .ai-msg.user .ai-bubble {
      background: #2E9348;
      color: white;
      border-bottom-right-radius: 4px;
      box-shadow: 0 2px 6px rgba(46, 147, 72, 0.25);
    }

    /* MINI CARDS DE PRODUTOS RECOMENDADOS DENTRO DO CHAT */
    .ai-recommendations-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
      width: 100%;
    }
    .ai-product-mini-card {
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 12px;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.04);
      transition: border-color 0.15s;
    }
    .ai-product-mini-card:hover {
      border-color: #2E9348;
    }
    .ai-mini-card-img {
      width: 50px;
      height: 50px;
      border-radius: 8px;
      object-fit: cover;
      background: #f1f5f9;
      flex-shrink: 0;
    }
    .ai-mini-card-info {
      flex: 1;
      min-width: 0;
    }
    .ai-mini-card-tag {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ai-mini-card-name {
      font-size: 12px;
      font-weight: 700;
      color: #1A1A1A;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin: 1px 0;
    }
    .ai-mini-card-price {
      font-size: 13px;
      font-weight: 800;
      color: #2E9348;
    }
    .ai-mini-add-btn {
      background: #2E9348;
      color: white;
      border: none;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.15s;
    }
    .ai-mini-add-btn:hover {
      background: #237438;
      transform: scale(1.02);
    }
    .ai-mini-add-btn.added {
      background: #14532d;
    }

    /* CHIPS DE SUGESTÃO RÁPIDA */
    .ai-chips-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .ai-quick-chip {
      background: white;
      border: 1px solid #E5E7EB;
      border-radius: 16px;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #1A1A1A;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;
    }
    .ai-quick-chip:hover {
      border-color: #2E9348;
      background: #eaf6ed;
      color: #2E9348;
    }

    .ai-drawer-input-bar {
      padding: 10px 12px;
      background: white;
      border-top: 1px solid #E5E7EB;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ai-chat-input {
      flex: 1;
      padding: 9px 12px;
      border: 1px solid #E5E7EB;
      border-radius: 10px;
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }
    .ai-chat-input:focus {
      border-color: #2E9348;
    }
    .ai-chat-send-btn {
      background: #2E9348;
      color: white;
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      flex-shrink: 0;
    }
    .ai-chat-send-btn:hover {
      background: #237438;
      transform: scale(1.04);
    }

    /* COACH MARKS TOOLTIP */
    .ai-coach-mark {
      position: fixed;
      right: 20px;
      bottom: 148px;
      background: #1A1A1A;
      color: white;
      padding: 12px 14px;
      border-radius: 12px;
      max-width: 250px;
      font-size: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      z-index: 96;
      border-left: 4px solid #F5C518;
      animation: coachFade 0.3s ease-out;
    }
    @keyframes coachFade {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ai-coach-mark strong {
      display: block;
      color: #F5C518;
      margin-bottom: 2px;
    }
    .ai-coach-mark p {
      margin: 0 0 8px 0;
      color: #e2e8f0;
      line-height: 1.35;
    }
    .coach-mark-dismiss-btn {
      background: #2E9348;
      color: white;
      border: none;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
    }

    /* MODAIS */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 16px;
      backdrop-filter: blur(2px);
    }
    .modal-overlay.open {
      display: flex;
    }
    .modal-box {
      background: white;
      border-radius: 16px;
      width: 100%;
      max-height: 92vh;
      overflow-y: auto;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
      animation: modalFadeIn 0.2s ease-out;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .modal-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .modal-body {
      padding: 18px;
    }

    /* CARROSSEL E ZOOM HD */
    .carousel-container {
      width: 100%;
      position: relative;
    }
    .carousel-viewport {
      width: 100%;
      aspect-ratio: 4/3;
      background: #0f172a;
      border-radius: 12px;
      overflow: hidden;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .gallery-main-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      transition: opacity 0.15s;
    }
    .carousel-nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(255,255,255,0.85);
      color: #0f172a;
      border: none;
      font-size: 20px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0,0,0,0.2);
      transition: background 0.15s;
      z-index: 5;
    }
    .carousel-nav-btn:hover { background: white; }
    .carousel-nav-btn.prev { left: 8px; }
    .carousel-nav-btn.next { right: 8px; }
    .carousel-counter-badge {
      position: absolute;
      bottom: 8px;
      right: 8px;
      background: rgba(0,0,0,0.65);
      color: white;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
    }
    .carousel-zoom-cue-btn {
      position: absolute;
      bottom: 8px;
      left: 8px;
      background: rgba(0,0,0,0.65);
      color: white;
      border: 1px solid rgba(255,255,255,0.3);
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
      cursor: pointer;
    }
    .carousel-dots-row {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 10px;
    }
    .carousel-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #cbd5e1;
      cursor: pointer;
      transition: all 0.15s;
    }
    .carousel-dot.active {
      background: var(--primary);
      transform: scale(1.3);
    }
    .thumbnails-row {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      margin-top: 10px;
      padding-bottom: 4px;
    }
    .thumb-btn {
      width: 54px;
      height: 54px;
      border-radius: 8px;
      overflow: hidden;
      border: 2px solid transparent;
      cursor: pointer;
      flex-shrink: 0;
    }
    .thumb-btn.active {
      border-color: var(--primary);
    }
    .thumb-btn img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* ZOOM INTERATIVO FULLSCREEN */
    .photo-zoom-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.96);
      z-index: 150;
      display: flex;
      flex-direction: column;
    }
    .zoom-toolbar {
      padding: 10px 16px;
      background: rgba(0,0,0,0.5);
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .zoom-toolbar-title {
      font-size: 13px;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .zoom-toolbar-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .zoom-action-btn {
      background: rgba(255,255,255,0.15);
      color: white;
      border: none;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .zoom-action-btn:hover { background: rgba(255,255,255,0.25); }
    .zoom-close-btn { background: #ef4444; }
    .zoom-viewport {
      flex: 1;
      width: 100%;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      cursor: zoom-in;
      user-select: none;
    }
    .zoom-modal-img {
      max-width: 90vw;
      max-height: 85vh;
      object-fit: contain;
      transition: transform 0.1s ease-out;
      transform-origin: center center;
    }
    .zoom-hint-bar {
      padding: 6px 14px;
      background: rgba(0,0,0,0.6);
      color: #cbd5e1;
      font-size: 11px;
      text-align: center;
    }

    /* 10. COMPROVANTE DIGITAL DO CLIENTE */
    .receipt-modal-box {
      background: white;
      border-radius: 14px;
      width: 100%;
      max-width: 480px;
      padding: 20px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.25);
    }
    .receipt-paper {
      background: #fafafa;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 16px;
      margin: 14px 0;
      font-family: monospace;
      font-size: 12px;
      line-height: 1.4;
      color: #1e293b;
    }
    .receipt-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .receipt-divider {
      border-top: 1px dashed #cbd5e1;
      margin: 8px 0;
    }
  </style>
</head>
<body>
  <div class="top-toolbar">
    <div style="display:flex; align-items:center; gap:8px;">
      <span>🌱 Conflora Horta & Viveiro</span>
      <span style="opacity:0.6;">|</span>
      <span>Mineiros - GO</span>
    </div>
    <div style="display:flex; align-items:center; gap:8px;">
      <div class="lang-selector-group" id="langSelectorGroup">
        <button type="button" class="lang-btn active" id="langPtBtn" onclick="setLanguage('pt-BR')" title="Português (Brasil)">🇧🇷 PT</button>
        <button type="button" class="lang-btn" id="langEnBtn" onclick="setLanguage('en-US')" title="English (US)">🇺🇸 EN</button>
        <button type="button" class="lang-btn" id="langEsBtn" onclick="setLanguage('es-ES')" title="Español">🇪🇸 ES</button>
      </div>
      <button id="adminStatusBtn" type="button" class="status-pill-btn" onclick="openStatusModal()" style="display:none;" data-i18n="header.systemStatus">
        📡 Status
      </button>
      <button id="authOpenBtn" type="button" class="google-auth-btn" onclick="openAuthModal()" data-i18n="header.loginButton">
        👤 Entrar
      </button>
      <div id="userHeaderPill" style="display:none; align-items:center; gap:6px;">
        <img id="userHeaderPic" style="width:24px; height:24px; border-radius:50%; object-fit:cover;" src="" />
        <span id="userHeaderName" style="font-weight:700; font-size:12px; cursor:pointer;" onclick="openCustomerPortalModal()"></span>
        <span id="userHeaderBadge" style="font-size:10px; padding:2px 6px; border-radius:10px; color:white; font-weight:800;"></span>
      </div>
      <button type="button" class="admin-link-btn" onclick="handleAdminPanelClick()" data-i18n="header.adminPortal">
        ⚙️ Painel da Equipe
      </button>
    </div>
  </div>

  <!-- 6. BANNER DE CUPOM DE DESCONTO NO TOPO -->
  <div class="promo-banner" id="promoBanner">
    <div class="promo-banner-content">
      <span class="promo-badge" data-i18n="promo.badge">🎉 PROMOÇÃO</span>
      <span class="promo-text" data-i18n="promo.text">Use o cupom <strong>CONFLORA10</strong> para 10% OFF no seu primeiro pedido!</span>
    </div>
    <button type="button" class="promo-apply-btn" onclick="applyPromoCouponDirect('CONFLORA10')" data-i18n="promo.applyButton">
      Usar Cupom
    </button>
  </div>

  <div class="app-container">
    <header class="brand-header">
      <div class="brand-title">
        <div class="conflora-logo-badge">🌿</div>
        <div>
          <h1 data-i18n="header.brandTitle">Conflora</h1>
          <p data-i18n="header.brandSubtitle">Horta e Viveiro • Mineiros - GO</p>
        </div>
      </div>
      <div>
        <button class="cart-pill-btn" onclick="scrollToCart()">
          🛒 <span id="cartCountHeader">0 itens</span>
        </button>
      </div>
    </header>

    <main class="app-main">
      <section style="width: 100%;">
        <!-- 4. CARROSSEL DE CATEGORIAS ISOLADO (overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none;) -->
        <div class="categories-bar-wrapper">
          <div class="categories-bar" id="categoriesBar">
            <button class="cat-btn active" onclick="selectCategory('TODAS')" data-i18n="category.all">🌿 Todas</button>
          </div>
        </div>

        <!-- SUB-CATEGORIAS DINÂMICAS -->
        <div class="subcategories-bar" id="subcategoriesBar"></div>

        <!-- 3. ORDENAÇÃO A-Z COMO REGRA PADRÃO & BUSCA COM DEBOUNCE -->
        <div class="catalog-toolbar">
          <div class="search-input-wrap">
            <span class="search-icon-inside">🔍</span>
            <input type="text" id="searchInput" class="search-input" placeholder="Buscar por planta, muda, insumo, semente..." data-i18n-placeholder="header.searchPlaceholder" oninput="onSearchInputDebounced()" />
          </div>
          <select id="sortSelect" class="sort-select" onchange="filterProducts()">
            <option value="nome_asc" selected>Ordem: A a Z</option>
            <option value="nome_desc">Ordem: Z a A</option>
            <option value="preco_asc">Menor Preço</option>
            <option value="preco_desc">Maior Preço</option>
          </select>
        </div>

        <!-- 2. GRID VIRTUALIZADO / PAGINADO EM LOTES -->
        <div class="products-grid" id="productsGrid">
          ${renderInitialProductCards()}
        </div>

        <!-- 2. SENTINELA INVISÍVEL PARA INTERSECTION OBSERVER -->
        <div id="catalogSentinel" style="height: 20px; width: 100%; pointer-events: none;"></div>
      </section>

      <!-- OVERLAY BACKDROP DA BOTTOM SHEET NO MOBILE -->
      <div class="cart-bottom-sheet-backdrop" id="cartBottomSheetBackdrop" onclick="closeCartBottomSheet()"></div>

      <!-- PAINEL LATERAL (DESKTOP) / BOTTOM SHEET (MOBILE): SACOLA & CHECKOUT -->
      <aside class="cart-panel" id="cartPanel">
        <!-- BARRA / HANDLE DA BOTTOM SHEET MOBILE -->
        <div class="bottom-sheet-handle-bar">
          <div class="bottom-sheet-handle"></div>
        </div>

        <div class="cart-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <h2 class="panel-title" data-i18n="cart.title">Sua Sacola</h2>
            <span id="cartItemCounter" style="font-size:12px; background:var(--primary-light); color:var(--primary-dark); padding:2px 8px; border-radius:10px; font-weight:800;">0 itens</span>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <button type="button" class="action-btn" id="clearCartBtn" onclick="clearCart()" style="display:none; background:none; border:none; color:#ef4444; font-size:12px; font-weight:700; cursor:pointer;" data-i18n="cart.clearButton">
              Limpar
            </button>
            <button type="button" class="bottom-sheet-close-btn" onclick="closeCartBottomSheet()" title="Fechar Sacola" aria-label="Fechar Sacola">
              ✕
            </button>
          </div>
        </div>

        <!-- ITENS DA SACOLA -->
        <div class="cart-items-list" id="cartItemsList">
          <div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;" data-i18n="cart.emptyMessage">
            Sua sacola está vazia.<br>Clique em <strong>+</strong> nos produtos para adicionar em 1 clique!
          </div>
        </div>

        <!-- 6. CAMPO DE CUPOM DE DESCONTO -->
        <div class="coupon-box">
          <div class="coupon-input-wrap">
            <input type="text" id="couponInput" class="coupon-input" placeholder="Código do Cupom" data-i18n-placeholder="cart.couponInputPlaceholder" />
            <button type="button" class="coupon-btn" onclick="applyCouponFromInput()" data-i18n="cart.couponApplyButton">Aplicar</button>
          </div>
          <div id="couponFeedback" class="coupon-feedback"></div>
        </div>

        <!-- RESUMO DE TOTAIS COM SUBTOTAIS E DESCONTOS -->
        <div class="cart-totals-summary">
          <div class="cart-summary-line">
            <span data-i18n="cart.subtotal">Subtotal:</span>
            <span id="cartSubtotalText">R$ 0,00</span>
          </div>
          <div class="cart-summary-line" id="discountSummaryRow" style="display:none;">
            <span><span data-i18n="cart.discount">Desconto Cupom</span> (<span id="discountCouponName"></span>):</span>
            <span class="cart-discount-val" id="cartDiscountText">- R$ 0,00</span>
          </div>
          <div class="cart-summary-line total-line">
            <span data-i18n="cart.total">Total da Compra:</span>
            <span id="cartTotalText" style="color:var(--primary-dark);">R$ 0,00</span>
          </div>
        </div>

        <!-- AVISO DE DADOS PRÉ-PREENCHIDOS DA ÚLTIMA COMPRA -->
        <div id="savedDataNotice" style="display:none; font-size:11px; background:#dcfce7; color:#166534; padding:8px 10px; border-radius:6px; border:1px solid #86efac;" data-i18n="customer.noticePrefilled">
          ✨ Seus dados foram pré-preenchidos da última compra para maior agilidade!
        </div>

        <div class="form-group">
          <label class="form-label" data-i18n="customer.nameLabel">Seu Nome:</label>
          <input type="text" id="custName" class="form-input" placeholder="Ex: Edmar Júnio" data-i18n-placeholder="customer.namePlaceholder" oninput="saveCustomerDataToStorage()" />
        </div>

        <div class="form-group">
          <label class="form-label" data-i18n="customer.phoneLabel">WhatsApp com DDD:</label>
          <input type="text" id="custPhone" class="form-input" placeholder="(64) 99935-1616" data-i18n-placeholder="customer.phonePlaceholder" oninput="applyPhoneMask(event); saveCustomerDataToStorage();" />
        </div>

        <div class="form-group">
          <label class="form-label" data-i18n="customer.deliveryTypeLabel">Como deseja receber?</label>
          <div class="type-switcher">
            <button type="button" class="type-option-btn selected" id="typeDeliveryBtn" onclick="setOrderType('DELIVERY')" data-i18n="customer.deliveryOption">🛵 Entrega em Mineiros - GO</button>
            <button type="button" class="type-option-btn" id="typePickupBtn" onclick="setOrderType('PICKUP')" data-i18n="customer.pickupOption">🏬 Retirada no Viveiro</button>
          </div>
        </div>

        <div class="form-group" id="addressGroup">
          <label class="form-label" data-i18n="customer.addressLabel">Endereço de Entrega em Mineiros - GO:</label>
          <input type="text" id="custAddress" class="form-input" placeholder="Rua, Número, Bairro e Referência" data-i18n-placeholder="customer.addressPlaceholder" oninput="saveCustomerDataToStorage()" />
        </div>

        <!-- 7. FORMA DE PAGAMENTO EM DINHEIRO COM CÁLCULO DE TROCO -->
        <div class="form-group">
          <label class="form-label" data-i18n="payment.methodLabel">Forma de Pagamento:</label>
          <div class="pay-switcher">
            <button type="button" class="pay-btn selected" id="payPixBtn" onclick="setPayment('PIX')">PIX</button>
            <button type="button" class="pay-btn" id="payCardBtn" onclick="setPayment('CARTAO')" data-i18n="payment.card">Cartão</button>
            <button type="button" class="pay-btn" id="payCashBtn" onclick="setPayment('DINHEIRO')" data-i18n="payment.cash">Dinheiro</button>
          </div>
        </div>

        <div class="pix-box" id="pixBox">
          <div style="font-weight: 700; color: #166534;" data-i18n="payment.pixTitle">🔑 Pagamento via PIX</div>
          <div style="margin: 4px 0;" data-i18n="payment.pixSubtitle">Chave Oficial da Conflora:</div>
          <div class="pix-key-val" id="pixKeyDisplay">64999351616</div>
          <button type="button" class="copy-pix-btn" onclick="copyPix()" data-i18n="payment.pixCopyButton">📋 Copiar Chave PIX</button>
        </div>

        <!-- CAMPO DE DINHEIRO & CÁLCULO DE TROCO EM TEMPO REAL -->
        <div class="cash-calc-box" id="cashCalcBox" style="display:none;">
          <label class="form-label" style="color:#92400e;" data-i18n="payment.cashQuestion">💵 Quanto você tem em dinheiro?</label>
          <div style="display:flex; align-items:center; gap:6px;">
            <span style="font-weight:bold; color:#78350f;">R$</span>
            <input type="number" id="cashTenderedInput" class="form-input" placeholder="Ex: 50,00 ou 100,00" data-i18n-placeholder="payment.cashPlaceholder" step="0.50" min="0" oninput="calculateChange()" />
          </div>
          <div class="cash-quick-chips" id="cashQuickChips"></div>
          <div id="changeResultBox" class="change-result-box" style="display:none;"></div>
        </div>

        <button id="submitOrderBtn" class="checkout-submit-btn" onclick="submitOrder()" data-i18n="checkout.submitButton">
          ✅ Finalizar Pedido
        </button>
      </aside>
    </main>
  </div>

  <!-- 8. BOTÕES FLUTUANTES (FABs) AO ROLAR A TELA (> 150px) -->
  <div class="fabs-group" id="fabsGroup">
    <button type="button" class="fab-btn" onclick="scrollToTop()" title="Voltar ao Topo" aria-label="Voltar ao Topo" data-i18n-title="fabs.scrollToTop">
      ⬆️
    </button>
    <button type="button" class="fab-btn" onclick="scrollToFilters()" title="Filtrar Categorias" aria-label="Filtrar Categorias" data-i18n-title="fabs.filterCategories">
      🔍
    </button>
  </div>

  <!-- 9. BARRA FIXA INFERIOR NO MOBILE -->
  <div class="mobile-cart-float-bar" id="mobileCartFloatBar" onclick="scrollToCart()">
    <div>
      <span>🛒 <span id="mobCartCount">0</span> <span data-i18n="cart.itemsCount">item(ns)</span></span>
      <span style="margin-left:8px; font-weight:800; color:#86efac;" id="mobCartTotal">R$ 0,00</span>
    </div>
    <span style="background:white; color:#14532d; padding:4px 12px; border-radius:14px; font-size:12px; font-weight:800;" data-i18n="cart.viewButton">Ver Sacola ➔</span>
  </div>

  <!-- COACH MARK ONBOARDING TOOLTIP DO AGENTE BOTÂNICO IA -->
  <div id="aiOnboardingTooltip" class="ai-coach-mark" style="display:none;">
    <strong>🌿 Conflora AI</strong>
    <p>Peça dicas para o seu ambiente ou tire dúvidas botânicas em tempo real!</p>
    <button type="button" class="coach-mark-dismiss-btn" onclick="dismissAiCoachMark(event)">Entendi</button>
  </div>

  <!-- FLOATING ACTION BUTTON (FAB) DO AGENTE BOTÂNICO IA -->
  <button type="button" class="botanical-ai-fab" id="botanicalAiFab" onclick="toggleBotanicalAiChat()" title="Consultoria Botânica Conflora AI" aria-label="Consultoria Botânica Conflora AI">
    <span class="ai-fab-icon">🌿✨</span>
    <span class="ai-fab-badge">IA</span>
  </button>

  <!-- BACKDROP DO CHAT IA NO MOBILE -->
  <div class="cart-bottom-sheet-backdrop" id="botanicalAiBackdrop" onclick="closeBotanicalAiChat()"></div>

  <!-- GAVETA / DRAWER DO CHAT BOTÂNICO IA CONFLORA -->
  <div class="botanical-ai-drawer" id="botanicalAiDrawer" role="dialog" aria-label="Consultoria Botânica Conflora AI">
    <div class="ai-drawer-header">
      <div class="ai-drawer-title-group">
        <div class="ai-avatar">🌿</div>
        <div class="ai-title-text">
          <h3>Conflora AI</h3>
          <span><i class="ai-status-dot"></i> Consultora Botânica • Online</span>
        </div>
      </div>
      <button type="button" class="bottom-sheet-close-btn" onclick="closeBotanicalAiChat()" title="Fechar Chat" aria-label="Fechar Chat">
        ✕
      </button>
    </div>

    <!-- MENSAGENS DO CHAT -->
    <div class="ai-chat-messages" id="aiChatMessages">
      <div class="ai-msg bot">
        <div class="ai-bubble">
          Olá! Sou a <strong>Conflora AI</strong>, sua consultora botânica em Mineiros - GO! 🌿✨
          <br><br>
          Posso te ajudar a encontrar a planta perfeita para o seu ambiente, solo e rotina de rega no Cerrado. Escolha um tema abaixo ou pergunte livremente:
          <div class="ai-chips-container" id="aiQuickChips">
            <button type="button" class="ai-quick-chip" onclick="handleAiQuickChip('Planta para sombra')">🌿 Planta para sombra</button>
            <button type="button" class="ai-quick-chip" onclick="handleAiQuickChip('Frutíferas para vasos')">🪴 Frutíferas para vasos</button>
            <button type="button" class="ai-quick-chip" onclick="handleAiQuickChip('Plantas seguras para pets')">🐱 Pet-friendly</button>
            <button type="button" class="ai-quick-chip" onclick="handleAiQuickChip('Horta para apartamento')">🏡 Horta em apê</button>
            <button type="button" class="ai-quick-chip" onclick="handleAiQuickChip('Adubos e substratos')">🌱 Adubos & Substratos</button>
            <button type="button" class="ai-quick-chip" onclick="handleAiQuickChip('Plantas para sol pleno')">☀️ Sol pleno</button>
          </div>
        </div>
      </div>
    </div>

    <!-- BARRA DE INPUT DO CHAT -->
    <div class="ai-drawer-input-bar">
      <input type="text" id="aiChatInput" class="ai-chat-input" placeholder="Ex: Qual planta aguenta sol forte?" onkeydown="if(event.key==='Enter') sendAiChatMessage()" />
      <button type="button" class="ai-chat-send-btn" id="aiChatSendBtn" onclick="sendAiChatMessage()" title="Enviar pergunta">
        ➤
      </button>
    </div>
  </div>

  <!-- MODAL DE GALERIA DE FOTOS COM CARROSSEL E ZOOM HD -->
  <div class="modal-overlay" id="galleryModal">
    <div class="modal-box" style="max-width: 580px;">
      <div class="modal-header">
        <h3 id="modalProdTitle" style="font-size: 16px; color: var(--text);">Fotos do Produto</h3>
        <button style="border:none; background:none; font-size:22px; cursor:pointer;" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="carousel-container" id="modalCarouselContainer">
          <div class="carousel-viewport" id="modalCarouselViewport">
            <img id="modalMainImg" class="gallery-main-img" src="" alt="Produto" onclick="openPhotoZoom()" style="cursor:zoom-in;" title="Clique para abrir foto com zoom em alta resolução" />
            <button type="button" class="carousel-nav-btn prev" id="carouselPrevBtn" onclick="prevCarouselPhoto(event)" title="Foto anterior" aria-label="Foto anterior">‹</button>
            <button type="button" class="carousel-nav-btn next" id="carouselNextBtn" onclick="nextCarouselPhoto(event)" title="Próxima foto" aria-label="Próxima foto">›</button>
            <div class="carousel-counter-badge" id="carouselCounterBadge">1 / 1</div>
            <button type="button" class="carousel-zoom-cue-btn" onclick="openPhotoZoom()" title="Clique para abrir com zoom e detalhes botânicos">
              🔍 Zoom HD
            </button>
          </div>
          <div class="carousel-dots-row" id="carouselDotsRow"></div>
        </div>

        <div class="thumbnails-row" id="modalThumbsRow"></div>

        <div style="margin-top: 14px;">
          <div id="modalProdCategory" style="font-size: 12px; color: var(--text-muted); font-weight: bold;"></div>
          <div id="modalProdPrice" style="font-size: 20px; font-weight: 800; color: var(--primary-dark); margin: 4px 0;"></div>
          <p id="modalProdDesc" style="font-size: 13px; color: #334155; line-height: 1.5;"></p>
          <div style="margin-top: 14px;">
            <button id="modalAddBtn" class="checkout-submit-btn" style="padding: 10px;" onclick="">
              🛒 Adicionar este produto à sacola
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL DE ZOOM INTERATIVO EM ALTA RESOLUÇÃO -->
  <div class="photo-zoom-overlay" id="photoZoomModal" style="display:none;">
    <div class="zoom-modal-container">
      <div class="zoom-toolbar">
        <div class="zoom-toolbar-title" id="zoomProdTitle">Visualização com Zoom em Alta Resolução</div>
        <div class="zoom-toolbar-actions">
          <button type="button" class="zoom-action-btn" onclick="zoomIn()" title="Aproximar (+)">🔎 +</button>
          <button type="button" class="zoom-action-btn" onclick="zoomOut()" title="Afastar (-)">🔍 -</button>
          <button type="button" class="zoom-action-btn" onclick="resetZoom()" title="Tamanho Normal (100%)">↺ <span id="zoomLevelText">100%</span></button>
          <button type="button" class="zoom-action-btn" onclick="prevCarouselPhoto(event)" title="Foto Anterior">‹</button>
          <span id="zoomCounterBadge" style="color:white; font-size:12px; font-weight:bold; padding:0 4px;">1 / 1</span>
          <button type="button" class="zoom-action-btn" onclick="nextCarouselPhoto(event)" title="Próxima Foto">›</button>
          <button type="button" class="zoom-action-btn zoom-close-btn" onclick="closePhotoZoom()" title="Fechar Zoom">✕</button>
        </div>
      </div>
      <div class="zoom-viewport" id="zoomViewport" onwheel="handleZoomWheel(event)" onmousedown="startZoomPan(event)" onmousemove="doZoomPan(event)" onmouseup="endZoomPan()" onmouseleave="endZoomPan()" ondblclick="toggleZoomLevel()">
        <img id="zoomModalImg" class="zoom-modal-img" src="" alt="Foto Ampliada" draggable="false" />
      </div>
      <div class="zoom-hint-bar">
        <span>💡 Use a roda do mouse, duplo-clique, botões +/- ou arraste para navegar nos detalhes botânicos e qualidade original da foto</span>
      </div>
    </div>
  </div>

  <!-- MODAL DE PESO POR KG COM 3 CASAS DECIMAIS -->
  <div class="modal-overlay" id="kgModal">
    <div class="modal-box" style="max-width: 440px; padding: 22px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 id="kgModalTitle" style="font-size:16px; color:#14532d;">⚖️ Selecionar Peso (KG)</h3>
        <button style="border:none; background:none; font-size:22px; cursor:pointer;" onclick="closeKgModal()">×</button>
      </div>
      <p id="kgModalDesc" style="font-size:13px; color:#64748b; margin-bottom:12px;">Informe a quantidade exata de quilogramas (até 3 casas decimais):</p>
      
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:12px; font-weight:700;">Preço por KG:</span>
          <strong id="kgPricePerKgDisplay" style="color:#15803d; font-size:15px;">R$ 0,00/kg</strong>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="number" id="kgWeightInput" step="0.001" min="0.050" max="999.000" value="1.000" style="flex:1; padding:10px; font-size:18px; font-weight:800; border:2px solid #86efac; border-radius:8px; text-align:center; outline:none;" oninput="updateKgModalSubtotal()" />
          <span style="font-size:16px; font-weight:800; color:#14532d;">KG</span>
        </div>
      </div>

      <div style="font-size:12px; font-weight:700; color:#334155; margin-bottom:6px;">Atalhos rápidos de peso:</div>
      <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:14px;">
        <button type="button" class="cash-chip-btn" onclick="setKgPreset(0.250)">0,250 kg</button>
        <button type="button" class="cash-chip-btn" onclick="setKgPreset(0.500)">0,500 kg</button>
        <button type="button" class="cash-chip-btn" onclick="setKgPreset(1.000)">1,000 kg</button>
        <button type="button" class="cash-chip-btn" onclick="setKgPreset(2.000)">2,000 kg</button>
      </div>

      <div style="background:#f0fdf4; border:1px solid #86efac; padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <span style="font-size:13px; font-weight:700;">Subtotal Calculado:</span>
        <strong id="kgSubtotalDisplay" style="font-size:18px; color:#15803d;">R$ 0,00</strong>
      </div>

      <div style="display:flex; gap:8px;">
        <button type="button" style="flex:1; padding:10px; border:1px solid #cbd5e1; background:#f8fafc; border-radius:8px; cursor:pointer;" onclick="closeKgModal()">Cancelar</button>
        <button type="button" id="confirmKgBtn" class="checkout-submit-btn" style="flex:2; padding:10px;" onclick="confirmKgAddToCart()">Adicionar à Sacola</button>
      </div>
    </div>
  </div>

  <!-- 10. MODAL DO RECIBO DIGITAL DO CLIENTE & NOTIFICAÇÃO DO PROPRIETÁRIO -->
  <div class="modal-overlay" id="orderReceiptModal">
    <div class="receipt-modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:10px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:24px;">🎉</span>
          <div>
            <h3 style="font-size:16px; color:#14532d; margin:0;" data-i18n="receipt.title">Comprovante do Pedido</h3>
            <span style="font-size:11px; color:#64748b;" data-i18n="receipt.storeSubtitle">Conflora Horta e Viveiro</span>
          </div>
        </div>
        <button onclick="closeReceiptModal()" style="border:none; background:none; font-size:22px; cursor:pointer;">×</button>
      </div>

      <div class="receipt-paper" id="receiptPaperContent">
        <!-- Conteúdo do recibo preenchido dinamicamente -->
      </div>

      <div style="display:flex; flex-direction:column; gap:8px; margin-top:14px;">
        <a id="receiptOwnerWaLink" href="#" target="_blank" class="checkout-submit-btn" style="text-align:center; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:8px; background:#25d366;">
          <span style="font-size:18px;">💬</span> <span data-i18n="receipt.notifyOwner">Notificar WhatsApp do Viveiro</span>
        </a>
        <div style="display:flex; gap:8px;">
          <button type="button" class="action-btn" onclick="copyReceiptText()" style="flex:1; background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:12px;" data-i18n="receipt.copyButton">
            📋 Copiar Recibo
          </button>
          <button type="button" class="action-btn" onclick="printReceipt()" style="flex:1; background:#f1f5f9; border:1px solid #cbd5e1; padding:10px; border-radius:8px; font-weight:700; cursor:pointer; font-size:12px;" data-i18n="receipt.printButton">
            🖨️ Imprimir / Salvar
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL: LOGIN / CADASTRO DE CLIENTE -->
  <div class="modal-overlay" id="authModal">
    <div class="modal-box" style="max-width:440px; padding:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:24px;">🌿</span>
          <h3 style="font-size:18px; font-weight:800; color:#0f172a; margin:0;">Identificação Conflora</h3>
        </div>
        <button onclick="closeAuthModal()" style="border:none; background:none; font-size:20px; cursor:pointer; color:#64748b;">✕</button>
      </div>

      <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:10px 12px; margin-bottom:14px; font-size:12px; color:#166534; line-height:1.4;">
        ✨ <strong>O login é 100% opcional!</strong> Você pode comprar à vontade sem conta.
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px; margin-bottom:14px;">
        <p data-google-status role="status" style="font-size:13px; margin-bottom:10px;">Acesso rápido com sua conta Google:</p>
        <button type="button" class="checkout-submit-btn" id="googleLoginButton" data-google-login disabled onclick="submitGoogleLogin()" style="display:flex; align-items:center; justify-content:center; gap:8px;">
          <svg style="width:16px; height:16px;" viewBox="0 0 24 24"><path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Entrar com Google
        </button>
      </div>

      <div style="text-align:center; margin-top:14px;">
        <button type="button" onclick="closeAuthModal()" style="background:#f1f5f9; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; color:#64748b; font-weight:600;">Fechar</button>
      </div>
    </div>
  </div>

  <!-- MODAL: PAINEL DO CLIENTE -->
  <div class="modal-overlay" id="customerPortalModal">
    <div class="modal-box" style="max-width:750px; padding:22px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:14px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <img id="portalUserPic" style="width:36px; height:36px; border-radius:50%; object-fit:cover;" src="" />
          <div>
            <h3 id="portalUserName" style="font-size:16px; font-weight:800; color:#0f172a; margin:0;">Painel do Cliente</h3>
            <span id="portalUserEmail" style="font-size:12px; color:#64748b;"></span>
          </div>
        </div>
        <button onclick="closeCustomerPortalModal()" style="background:none; border:none; font-size:22px; cursor:pointer; color:#64748b;">✕</button>
      </div>
      <div id="customerOrdersList" style="padding:10px 0;">Carregando pedidos...</div>
    </div>
  </div>

  <!-- MODAL: STATUS DE CONEXÃO & DIAGNÓSTICO (ADMIN) -->
  <div class="modal-overlay" id="statusModal">
    <div class="modal-box" style="max-width:680px; padding:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:22px;">📡</span>
          <h3 style="font-size:17px; font-weight:800; color:#0f172a; margin:0;">Status das Conexões</h3>
        </div>
        <button onclick="closeStatusModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748b;">✕</button>
      </div>
      <div id="statusDashboardBody">
        <div style="text-align:center; padding:30px; color:#64748b;">Consultando status em tempo real...</div>
      </div>
    </div>
  </div>

  <script>
    /**
     * =========================================================================
     * CLEAN CODE ARCHITECTURE & INTERNATIONALIZATION (i18n) - CONFLORA V2
     * Robert C. Martin (Clean Code) Principles:
     * 1. Meaningful Names strictly in English without cryptic abbreviations.
     * 2. Small Functions & Single Responsibility Principle (SRP).
     * 3. Guard Clauses & Early Returns (eliminating arrow anti-pattern).
     * 4. Decoupled Layers: LocalizationService, Pure Calculations,
     *    CatalogCacheRepository, CartStore, ViewControllers.
     * 5. Scalability 3 to 100,000 items with IntersectionObserver batching.
     * 6. Initial mandatory A-Z sort in all listings.
     * =========================================================================
     */

    const OWNER_WHATSAPP_PHONE = '5564999351616';

    const REAL_HD_FALLBACKS = {
      'Palmeiras': 'https://images.unsplash.com/photo-1596726596162-421712a433a0?w=800&auto=format&fit=crop&q=80',
      'Frutíferas': 'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=800&auto=format&fit=crop&q=80',
      'Flores & Ornamentais': 'https://images.unsplash.com/photo-1508615039623-a25605d2b022?w=800&auto=format&fit=crop&q=80',
      'Horta & Temperos': 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80',
      'Agromadeiras & Rurais': 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800&auto=format&fit=crop&q=80',
      'Gramas & Insumos': 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&auto=format&fit=crop&q=80',
      'Pets & Animais': 'https://images.unsplash.com/photo-1535083783855-76ae62b2914e?w=800&auto=format&fit=crop&q=80',
      'Plantas / Mudas': 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=800&auto=format&fit=crop&q=80',
      'DEFAULT': 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=800&auto=format&fit=crop&q=80',
    };

    const VALID_COUPONS = {
      'CONFLORA10': { type: 'PERCENT', value: 10, label: '10% de desconto' },
      'CONFLORA15': { type: 'PERCENT', value: 15, label: '15% de desconto' },
      'VERDE5': { type: 'FIXED', value: 5.0, label: 'R$ 5,00 OFF' },
      'BEMVINDO': { type: 'PERCENT', value: 10, label: '10% de desconto' },
      'PRIMEIRACOMPRA': { type: 'PERCENT', value: 10, label: '10% de desconto' },
      'CERRADO20': { type: 'PERCENT', value: 20, label: '20% de desconto' },
    };

    // =========================================================================
    // LAYER 1: LOCALIZATION SERVICE (i18n READY)
    // =========================================================================
    const TRANSLATIONS = {
      'pt-BR': {
        'locale.currency': 'BRL',
        'locale.name': 'Português',
        'header.brandTitle': 'Conflora',
        'header.brandSubtitle': 'Horta e Viveiro • Mineiros - GO',
        'header.searchPlaceholder': 'Buscar por planta, muda, insumo, semente...',
        'header.adminPortal': '⚙️ Painel da Equipe',
        'header.loginButton': '👤 Entrar',
        'header.systemStatus': '📡 Status',
        'promo.badge': '🎉 PROMOÇÃO',
        'promo.text': 'Use o cupom <strong>CONFLORA10</strong> para 10% OFF no seu primeiro pedido!',
        'promo.applyButton': 'Usar Cupom',
        'category.all': '🌿 Todas',
        'sort.nameAsc': 'Ordem: A a Z',
        'sort.nameDesc': 'Ordem: Z a A',
        'sort.priceAsc': 'Menor Preço',
        'sort.priceDesc': 'Maior Preço',
        'cart.title': 'Sua Sacola',
        'cart.itemsCount': 'item(ns)',
        'cart.emptyMessage': 'Sua sacola está vazia.<br>Clique em <strong>+</strong> nos produtos para adicionar em 1 clique!',
        'cart.clearButton': 'Limpar',
        'cart.couponInputPlaceholder': 'Código do Cupom',
        'cart.couponApplyButton': 'Aplicar',
        'cart.couponRemove': 'Remover',
        'cart.subtotal': 'Subtotal:',
        'cart.discount': 'Desconto Cupom',
        'cart.total': 'Total da Compra:',
        'cart.viewButton': 'Ver Sacola ➔',
        'customer.noticePrefilled': '✨ Seus dados foram pré-preenchidos da última compra para maior agilidade!',
        'customer.nameLabel': 'Seu Nome:',
        'customer.namePlaceholder': 'Ex: Edmar Júnio',
        'customer.phoneLabel': 'WhatsApp com DDD:',
        'customer.phonePlaceholder': 'Ex: 5564999351616',
        'customer.deliveryTypeLabel': 'Como deseja receber?',
        'customer.deliveryOption': '🛵 Entrega',
        'customer.pickupOption': '🏬 Retirada no Viveiro',
        'customer.addressLabel': 'Endereço de Entrega em Mineiros - GO:',
        'customer.addressPlaceholder': 'Rua, Número, Bairro e Referência',
        'payment.methodLabel': 'Forma de Pagamento:',
        'payment.card': 'Cartão',
        'payment.cash': 'Dinheiro',
        'payment.pixTitle': '🔑 Pagamento via PIX',
        'payment.pixSubtitle': 'Chave Oficial da Conflora:',
        'payment.pixCopyButton': '📋 Copiar Chave PIX',
        'payment.cashQuestion': '💵 Quanto você tem em dinheiro?',
        'payment.cashPlaceholder': 'Ex: 50,00 ou 100,00',
        'payment.cashExactAmount': 'Valor Exato',
        'payment.cashChangeRequired': 'Troco a devolver:',
        'payment.cashExactNotice': 'Valor exato em mãos: Não precisa de troco.',
        'payment.cashInsufficient': 'Atenção: O valor em dinheiro informado é menor que o total da compra!',
        'checkout.submitButton': '✅ Finalizar Pedido',
        'checkout.processing': 'Processando Pedido...',
        'receipt.title': 'Comprovante do Pedido',
        'receipt.orderNumber': 'PEDIDO #',
        'receipt.storeSubtitle': 'Conflora Horta e Viveiro',
        'receipt.notifyOwner': 'Notificar WhatsApp do Viveiro',
        'receipt.copyButton': '📋 Copiar Recibo',
        'receipt.printButton': '🖨️ Imprimir / Salvar',
        'receipt.copySuccess': '📋 Recibo copiado com sucesso para a área de transferência!',
        'fabs.scrollToTop': 'Voltar ao Topo',
        'fabs.filterCategories': 'Filtrar Categorias',
      },
      'en-US': {
        'locale.currency': 'USD',
        'locale.name': 'English',
        'header.brandTitle': 'Conflora',
        'header.brandSubtitle': 'Garden & Nursery • Mineiros - GO',
        'header.searchPlaceholder': 'Search for plants, seeds, fertilizers...',
        'header.adminPortal': '⚙️ Staff Portal',
        'header.loginButton': '👤 Sign In',
        'header.systemStatus': '📡 Status',
        'promo.badge': '🎉 SPECIAL OFFER',
        'promo.text': 'Use coupon <strong>CONFLORA10</strong> for 10% OFF your first order!',
        'promo.applyButton': 'Use Coupon',
        'category.all': '🌿 All',
        'sort.nameAsc': 'Order: A to Z',
        'sort.nameDesc': 'Order: Z to A',
        'sort.priceAsc': 'Lowest Price',
        'sort.priceDesc': 'Highest Price',
        'cart.title': 'Your Cart',
        'cart.itemsCount': 'item(s)',
        'cart.emptyMessage': 'Your cart is empty.<br>Click <strong>+</strong> on items to add with 1 click!',
        'cart.clearButton': 'Clear',
        'cart.couponInputPlaceholder': 'Coupon Code',
        'cart.couponApplyButton': 'Apply',
        'cart.couponRemove': 'Remove',
        'cart.subtotal': 'Subtotal:',
        'cart.discount': 'Coupon Discount',
        'cart.total': 'Total Amount:',
        'cart.viewButton': 'View Cart ➔',
        'customer.noticePrefilled': '✨ Your details were auto-filled from your previous order!',
        'customer.nameLabel': 'Your Name:',
        'customer.namePlaceholder': 'e.g. John Doe',
        'customer.phoneLabel': 'WhatsApp / Phone:',
        'customer.phonePlaceholder': 'e.g. 5564999351616',
        'customer.deliveryTypeLabel': 'Delivery Method:',
        'customer.deliveryOption': '🛵 Delivery',
        'customer.pickupOption': '🏬 Nursery Pickup',
        'customer.addressLabel': 'Delivery Address in Mineiros - GO:',
        'customer.addressPlaceholder': 'Street, Number, Neighborhood',
        'payment.methodLabel': 'Payment Method:',
        'payment.card': 'Card',
        'payment.cash': 'Cash',
        'payment.pixTitle': '🔑 Instant PIX Payment',
        'payment.pixSubtitle': 'Official Conflora Key:',
        'payment.pixCopyButton': '📋 Copy PIX Key',
        'payment.cashQuestion': '💵 How much cash will you pay?',
        'payment.cashPlaceholder': 'e.g. 50.00 or 100.00',
        'payment.cashExactAmount': 'Exact Amount',
        'payment.cashChangeRequired': 'Change to return:',
        'payment.cashExactNotice': 'Exact cash tendered: No change needed.',
        'payment.cashInsufficient': 'Warning: Tendered cash is less than the total purchase amount!',
        'checkout.submitButton': '✅ Complete Order',
        'checkout.processing': 'Processing Order...',
        'receipt.title': 'Order Receipt',
        'receipt.orderNumber': 'ORDER #',
        'receipt.storeSubtitle': 'Conflora Garden and Nursery',
        'receipt.notifyOwner': 'Notify Store via WhatsApp',
        'receipt.copyButton': '📋 Copy Receipt',
        'receipt.printButton': '🖨️ Print / Save',
        'receipt.copySuccess': '📋 Receipt successfully copied to clipboard!',
        'fabs.scrollToTop': 'Back to Top',
        'fabs.filterCategories': 'Filter Categories',
      },
      'es-ES': {
        'locale.currency': 'EUR',
        'locale.name': 'Español',
        'header.brandTitle': 'Conflora',
        'header.brandSubtitle': 'Huerto y Vivero • Mineiros - GO',
        'header.searchPlaceholder': 'Buscar plantas, mudas, abonos, semillas...',
        'header.adminPortal': '⚙️ Panel de Equipo',
        'header.loginButton': '👤 Acceder',
        'header.systemStatus': '📡 Estado',
        'promo.badge': '🎉 PROMOCIÓN',
        'promo.text': '¡Usa el cupón <strong>CONFLORA10</strong> para un 10% de descuento!',
        'promo.applyButton': 'Usar Cupón',
        'category.all': '🌿 Todas',
        'sort.nameAsc': 'Orden: A a Z',
        'sort.nameDesc': 'Orden: Z a A',
        'sort.priceAsc': 'Menor Precio',
        'sort.priceDesc': 'Mayor Precio',
        'cart.title': 'Tu Cesta',
        'cart.itemsCount': 'artículo(s)',
        'cart.emptyMessage': 'Tu cesta está vacía.<br>¡Haz clic en <strong>+</strong> en los produtos para añadir en 1 clic!',
        'cart.clearButton': 'Vaciar',
        'cart.couponInputPlaceholder': 'Código de Cupón',
        'cart.couponApplyButton': 'Aplicar',
        'cart.couponRemove': 'Eliminar',
        'cart.subtotal': 'Subtotal:',
        'cart.discount': 'Descuento Cupón',
        'cart.total': 'Total de la Compra:',
        'cart.viewButton': 'Ver Cesta ➔',
        'customer.noticePrefilled': '✨ ¡Tus datos se rellenaron automáticamente!',
        'customer.nameLabel': 'Tu Nombre:',
        'customer.namePlaceholder': 'Ej: Edmar Júnio',
        'customer.phoneLabel': 'WhatsApp con código:',
        'customer.phonePlaceholder': 'Ej: 5564999351616',
        'customer.deliveryTypeLabel': '¿Cómo deseas recibirlo?',
        'customer.deliveryOption': '🛵 Entrega',
        'customer.pickupOption': '🏬 Recogida en Vivero',
        'customer.addressLabel': 'Dirección de Entrega:',
        'customer.addressPlaceholder': 'Calle, Número, Barrio y Referencia',
        'payment.methodLabel': 'Forma de Pago:',
        'payment.card': 'Tarjeta',
        'payment.cash': 'Efectivo',
        'payment.pixTitle': '🔑 Pago vía PIX',
        'payment.pixSubtitle': 'Clave Oficial de Conflora:',
        'payment.pixCopyButton': '📋 Copiar Clave PIX',
        'payment.cashQuestion': '💵 ¿Cuánto tienes en efectivo?',
        'payment.cashPlaceholder': 'Ej: 50,00 o 100,00',
        'payment.cashExactAmount': 'Importe Exacto',
        'payment.cashChangeRequired': 'Cambio a devolver:',
        'payment.cashExactNotice': 'Importe exacto: No se necesita cambio.',
        'payment.cashInsufficient': '¡Atención: El dinero entregado es inferior al total!',
        'checkout.submitButton': '✅ Finalizar Pedido',
        'checkout.processing': 'Procesando Pedido...',
        'receipt.title': 'Comprobante del Pedido',
        'receipt.orderNumber': 'PEDIDO #',
        'receipt.storeSubtitle': 'Conflora Huerto y Vivero',
        'receipt.notifyOwner': 'Notificar al Vivero por WhatsApp',
        'receipt.copyButton': '📋 Copiar Recibo',
        'receipt.printButton': '🖨️ Imprimir / Guardar',
        'receipt.copySuccess': '📋 ¡Comprobante copiado con éxito al portapapeles!',
        'fabs.scrollToTop': 'Volver Arriba',
        'fabs.filterCategories': 'Filtrar Categorías',
      }
    };

    class LocalizationService {
      constructor(defaultLocale = 'pt-BR') {
        const saved = localStorage.getItem('conflora_locale');
        this.currentLocale = saved && TRANSLATIONS[saved] ? saved : defaultLocale;
        this.updateFormatter();
      }

      updateFormatter() {
        const currencyCode = TRANSLATIONS[this.currentLocale]?.['locale.currency'] || 'BRL';
        this.currencyFormatter = new Intl.NumberFormat(this.currentLocale, {
          style: 'currency',
          currency: currencyCode,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      }

      setLocale(locale) {
        if (!TRANSLATIONS[locale]) return;
        this.currentLocale = locale;
        this.updateFormatter();
        try { localStorage.setItem('conflora_locale', locale); } catch (_) {}
        this.applyDomTranslations();
        updateLanguageButtons(locale);
        renderCartUI();
      }

      translate(key, fallback = '') {
        const dict = TRANSLATIONS[this.currentLocale] || TRANSLATIONS['pt-BR'];
        if (dict && dict[key] !== undefined) return dict[key];
        const defaultDict = TRANSLATIONS['pt-BR'];
        return defaultDict[key] !== undefined ? defaultDict[key] : (fallback || key);
      }

      formatCurrency(amount) {
        return this.currencyFormatter.format(Number(amount) || 0);
      }

      applyDomTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
          const key = el.getAttribute('data-i18n');
          const text = this.translate(key);
          if (text) el.innerHTML = text;
        });

        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
          const key = el.getAttribute('data-i18n-placeholder');
          const placeholder = this.translate(key);
          if (placeholder) el.placeholder = placeholder;
        });

        document.querySelectorAll('[data-i18n-title]').forEach(el => {
          const key = el.getAttribute('data-i18n-title');
          const title = this.translate(key);
          if (title) el.title = title;
        });

        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect && sortSelect.options && sortSelect.options.length >= 4) {
          sortSelect.options[0].textContent = this.translate('sort.nameAsc', 'Ordem: A a Z');
          sortSelect.options[1].textContent = this.translate('sort.nameDesc', 'Ordem: Z a A');
          sortSelect.options[2].textContent = this.translate('sort.priceAsc', 'Menor Preço');
          sortSelect.options[3].textContent = this.translate('sort.priceDesc', 'Maior Preço');
        }
      }
    }

    const localization = new LocalizationService('pt-BR');

    function setLanguage(locale) {
      localization.setLocale(locale);
    }
    window.setLanguage = setLanguage;

    function updateLanguageButtons(activeLocale) {
      const ptBtn = document.getElementById('langPtBtn');
      const enBtn = document.getElementById('langEnBtn');
      const esBtn = document.getElementById('langEsBtn');
      if (ptBtn) ptBtn.classList.toggle('active', activeLocale === 'pt-BR');
      if (enBtn) enBtn.classList.toggle('active', activeLocale === 'en-US');
      if (esBtn) esBtn.classList.toggle('active', activeLocale === 'es-ES');
    }

    // =========================================================================
    // LAYER 2: PURE DOMAIN CALCULATIONS (SRP - NO SIDE EFFECTS)
    // =========================================================================

    function calculateDiscountAmount(subtotalAmount, coupon) {
      if (!coupon || subtotalAmount <= 0) return 0;
      if (coupon.type === 'PERCENT') {
        return (subtotalAmount * coupon.value) / 100;
      }
      if (coupon.type === 'FIXED') {
        return Math.min(subtotalAmount, coupon.value);
      }
      return 0;
    }

    function calculateChangeAmount(tenderedCashAmount, finalTotalAmount) {
      return Number((Number(tenderedCashAmount) - Number(finalTotalAmount)).toFixed(2));
    }

    function calculateOrderTotals({ items = [], coupon = null }) {
      let subtotal = 0;
      let count = 0;

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        subtotal += Number(it.price || 0) * Number(it.qty || 1);
        count += (it.isKg ? 1 : Number(it.qty || 1));
      }

      const discount = calculateDiscountAmount(subtotal, coupon);
      const total = Math.max(0, subtotal - discount);

      return {
        subtotal: Number(subtotal.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        total: Number(total.toFixed(2)),
        count,
        itemsCount: items.length,
      };
    }

    function normalizeSearchString(text) {
      return (text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
    }

    function isSoldByKg(product) {
      if (!product) return false;
      const unit = (product.unit || product.unidade || '').toUpperCase();
      if (unit === 'KG') return true;
      const name = (product.descricao || product.name || '').toLowerCase();
      return name.endsWith(' kg') || name.includes(' kg ') || name.includes('/kg') || name.includes('(kg)') || name.includes('por kg') || name.includes(' a granel');
    }

    function getProductImage(product) {
      if (product.images && Array.isArray(product.images) && product.images.length > 0 && product.images[0]) {
        return product.images[0];
      }
      if (product.imageUrl || product.imageurl) {
        return product.imageUrl || product.imageurl;
      }
      const category = product.categoria || product.category || '';
      return REAL_HD_FALLBACKS[category] || REAL_HD_FALLBACKS['DEFAULT'];
    }

    // =========================================================================
    // LAYER 3: REPOSITORY & CACHE (CATALOG PERSISTENCE)
    // =========================================================================
    class CatalogRepository {
      static CACHE_KEY_V2 = 'conflora_catalog_cache_v2';
      static CACHE_KEY_LEGACY = 'conflora_catalog_cache';

      static loadFromCache() {
        try {
          const cached = localStorage.getItem(this.CACHE_KEY_V2) || localStorage.getItem(this.CACHE_KEY_LEGACY);
          if (!cached) return null;
          const parsed = JSON.parse(cached);
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
        } catch (_) {
          return null;
        }
      }

      static saveToCache(productsList) {
        try {
          if (Array.isArray(productsList) && productsList.length > 0) {
            const data = JSON.stringify(productsList);
            localStorage.setItem(this.CACHE_KEY_V2, data);
            localStorage.setItem(this.CACHE_KEY_LEGACY, data);
          }
        } catch (_) {}
      }
    }

    // =========================================================================
    // LAYER 4: STATE & STORE (PREDICTABLE GLOBAL CART & FILTER STATE)
    // =========================================================================
    class CartStore {
      constructor() {
        this.cartItemsMap = {};
        this.activeCoupon = null;
        this.orderType = 'DELIVERY';
        this.paymentMethod = 'PIX';
        this.cashTenderedAmount = 0;
      }

      addItem(product, quantity = 1, isKg = false) {
        if (!product || !product.id) return;
        const idKey = String(product.id);
        const existing = this.cartItemsMap[idKey];
        const isProductKg = isKg || isSoldByKg(product);

        if (!existing) {
          this.cartItemsMap[idKey] = {
            id: idKey,
            name: product.descricao || product.name,
            price: Number(product.valor_num || product.price || 0),
            qty: quantity,
            isKg: isProductKg,
          };
        } else {
          if (isProductKg && isKg) {
            existing.qty = quantity;
          } else {
            existing.qty += quantity;
          }
        }
      }

      changeItemQuantity(productId, delta) {
        const idKey = String(productId);
        const item = this.cartItemsMap[idKey];
        if (!item) return;

        if (item.isKg) {
          item.qty += (delta * 0.250);
          item.qty = Math.round(item.qty * 1000) / 1000;
        } else {
          item.qty += delta;
        }

        if (item.qty <= 0) {
          delete this.cartItemsMap[idKey];
        }
      }

      clear() {
        this.cartItemsMap = {};
      }

      applyCoupon(couponData) {
        this.activeCoupon = couponData;
      }

      removeCoupon() {
        this.activeCoupon = null;
      }

      setOrderType(type) {
        this.orderType = type;
      }

      setPaymentMethod(method) {
        this.paymentMethod = method;
      }

      setCashTendered(amount) {
        this.cashTenderedAmount = Number(amount) || 0;
      }

      getItems() {
        return Object.values(this.cartItemsMap);
      }

      getTotals() {
        return calculateOrderTotals({
          items: this.getItems(),
          coupon: this.activeCoupon,
        });
      }
    }

    const cartStore = new CartStore();

    // Proxies para compatibilidade retroativa total com eventos e testes
    let cart = cartStore.cartItemsMap;
    let orderType = cartStore.orderType;
    let paymentMethod = cartStore.paymentMethod;
    let appliedCoupon = cartStore.activeCoupon;

    let rawProducts = [];
    let currentCategory = 'TODAS';
    let currentSubcategory = 'TODAS';
    let pendingKgProduct = null;
    let currentUser = null;
    let lastCompletedOrderReceipt = null;

    // 2. VIRTUALIZAÇÃO / PAGINAÇÃO EM LOTES (IntersectionObserver)
    const BATCH_SIZE = 24;
    let currentFilteredList = [];
    let renderedCount = 0;
    let intersectionObserver = null;

    // =========================================================================
    // LAYER 5: UI & VIEW CONTROLLERS
    // =========================================================================

    function loadCatalogFromCache() {
      const cached = CatalogRepository.loadFromCache();
      if (!cached) return;
      rawProducts = cached;
      renderCategories();
      renderSubcategories();
      filterProducts();
    }

    function saveCatalogToCache(list) {
      CatalogRepository.saveToCache(list);
    }

    async function loadCatalog() {
      loadCatalogFromCache();
      try {
        const res = await fetch('/api/inventory');
        if (!res.ok) return;
        const data = await res.json();
        let list = [];
        if (Array.isArray(data)) list = data;
        else if (data && Array.isArray(data.products)) list = data.products;
        else if (data && data.products && typeof data.products === 'object') list = Object.values(data.products);

        if (list.length > 0) {
          rawProducts = list;
          saveCatalogToCache(list);
          renderCategories();
          renderSubcategories();
          filterProducts();
        }
      } catch (err) {
        console.warn('Carregamento via API:', err);
      }
    }

    // 4. CARROSSEL DE CATEGORIAS ISOLADO
    function renderCategories() {
      const bar = document.getElementById('categoriesBar');
      if (!bar) return;
      bar.innerHTML = '';

      const allBtn = document.createElement('button');
      allBtn.className = 'cat-btn ' + (currentCategory === 'TODAS' ? 'active' : '');
      allBtn.textContent = localization.translate('category.all', '🌿 Todas');
      allBtn.onclick = () => selectCategory('TODAS');
      bar.appendChild(allBtn);

      const catsSet = new Set();
      const list = Array.isArray(rawProducts) ? rawProducts : [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item) {
          const c = item.categoria || item.category;
          if (c) catsSet.add(c);
        }
      }
      const cats = Array.from(catsSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

      const icons = {
        'Hortifrutti': '🍎',
        'Horta': '🥗',
        'Plantas / Mudas': '🌱',
        'Frutífera': '🍋',
        'Frutíferas': '🍋',
        'Pets': '🐾',
        'Insumos / Outros': '🪴',
        'Palmeiras': '🌴',
        'Flores & Ornamentais': '🌺',
        'Horta & Temperos': '🥗',
        'Agromadeiras & Rurais': '🪵',
        'Gramas & Insumos': '🪴',
        'Pets & Animais': '🐾',
      };

      cats.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'cat-btn ' + (currentCategory === c ? 'active' : '');
        btn.textContent = (icons[c] || '🌱') + ' ' + c;
        btn.onclick = () => selectCategory(c);
        bar.appendChild(btn);
      });
    }

    function selectCategory(cat) {
      currentCategory = cat;
      currentSubcategory = 'TODAS';
      document.querySelectorAll('.cat-btn').forEach(b => {
        b.classList.toggle('active', b.innerText.includes(cat) || (cat === 'TODAS' && b.innerText.includes('Todas')));
      });
      renderSubcategories();
      filterProducts();
    }

    function renderSubcategories() {
      const bar = document.getElementById('subcategoriesBar');
      if (!bar) return;
      bar.innerHTML = '';
      if (currentCategory === 'TODAS') return;

      const subcats = new Set();
      const list = Array.isArray(rawProducts) ? rawProducts : [];
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p && (p.categoria || p.category) === currentCategory) {
          const sub = p.subcategoria || p.subcategory;
          if (sub) subcats.add(sub);
        }
      }

      if (subcats.size === 0) return;

      const allBtn = document.createElement('button');
      allBtn.className = 'subcat-btn ' + (currentSubcategory === 'TODAS' ? 'active' : '');
      allBtn.textContent = localization.translate('category.all', 'Todas');
      allBtn.onclick = () => { currentSubcategory = 'TODAS'; renderSubcategories(); filterProducts(); };
      bar.appendChild(allBtn);

      Array.from(subcats).sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'subcat-btn ' + (currentSubcategory === sub ? 'active' : '');
        btn.textContent = sub;
        btn.onclick = () => { currentSubcategory = sub; renderSubcategories(); filterProducts(); };
        bar.appendChild(btn);
      });
    }

    // 2. BUSCA REATIVA COM DEBOUNCE DE 150MS
    let searchDebounceTimer = null;
    function onSearchInputDebounced() {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        filterProducts();
      }, 150);
    }

    // 3. ORDENAÇÃO A-Z COMO REGRA PADRÃO EM TODAS AS LISTAGENS
    function filterProducts() {
      const searchInput = document.getElementById('searchInput');
      const sortSelect = document.getElementById('sortSelect');
      const q = normalizeSearchString(searchInput ? searchInput.value : '');
      const sort = sortSelect && sortSelect.value ? sortSelect.value : 'nome_asc';

      const prods = Array.isArray(rawProducts) ? rawProducts : [];
      const list = [];

      for (let i = 0; i < prods.length; i++) {
        const p = prods[i];
        if (!p || (p.status || p.STATUS || 'ATIVO').toUpperCase() === 'INATIVO') continue;
        const cat = p.categoria || p.category || '';
        const sub = p.subcategoria || p.subcategory || '';
        const nameNorm = normalizeSearchString(p.descricao || p.name || '');
        const catNorm = normalizeSearchString(cat);
        const subNorm = normalizeSearchString(sub);
        const tagsNorm = normalizeSearchString(p.tagsAi || p.tags_ia || '');

        const matchCat = currentCategory === 'TODAS' || cat === currentCategory;
        const matchSub = currentSubcategory === 'TODAS' || sub === currentSubcategory;
        const matchText = !q || nameNorm.includes(q) || catNorm.includes(q) || subNorm.includes(q) || tagsNorm.includes(q);

        if (matchCat && matchSub && matchText) {
          list.push(p);
        }
      }

      // ORDENAÇÃO (PADRÃO A-Z via localeCompare("pt-BR"))
      if (sort === 'nome_desc') {
        list.sort((a, b) => (b.descricao || b.name || '').localeCompare(a.descricao || a.name || '', 'pt-BR'));
      } else if (sort === 'preco_asc') {
        list.sort((a, b) => (Number(a.valor_num || a.price || 0)) - (Number(b.valor_num || b.price || 0)));
      } else if (sort === 'preco_desc') {
        list.sort((a, b) => (Number(b.valor_num || b.price || 0)) - (Number(a.valor_num || a.price || 0)));
      } else {
        // Padrão obrigatório: A a Z com pt-BR localeCompare
        list.sort((a, b) => (a.descricao || a.name || '').localeCompare(b.descricao || b.name || '', 'pt-BR'));
      }

      currentFilteredList = list;
      renderedCount = 0;

      const grid = document.getElementById('productsGrid');
      grid.innerHTML = '';

      if (list.length === 0) {
        grid.innerHTML = \`
          <div style="grid-column: 1/-1; padding: 40px 20px; text-align: center; color: var(--text-muted);">
            <p style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Nenhum produto encontrado nesta busca.</p>
            <p style="font-size: 13px; margin-bottom: 16px;">Tente limpar o campo de busca ou selecionar todas as categorias.</p>
            <button onclick="selectCategory('TODAS')" class="checkout-submit-btn" style="max-width:260px; margin:0 auto; padding:8px 16px; font-size:13px;">
              🌿 Ver Todos os Produtos
            </button>
          </div>
        \`;
        return;
      }

      renderNextBatch();
      setupIntersectionObserver();
    }

    // 2. RENDERIZAÇÃO EM LOTES (INTERSECTION OBSERVER)
    function renderNextBatch() {
      if (renderedCount >= currentFilteredList.length) return;
      const nextBatch = currentFilteredList.slice(renderedCount, renderedCount + BATCH_SIZE);
      const grid = document.getElementById('productsGrid');

      nextBatch.forEach(p => {
        const card = createProductCardElement(p);
        grid.appendChild(card);
      });

      renderedCount += nextBatch.length;
    }

    function setupIntersectionObserver() {
      if (intersectionObserver) {
        intersectionObserver.disconnect();
      }
      const sentinel = document.getElementById('catalogSentinel');
      if (!sentinel) return;

      intersectionObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          if (renderedCount < currentFilteredList.length) {
            renderNextBatch();
          }
        }
      }, { rootMargin: '300px' });

      intersectionObserver.observe(sentinel);
    }

    // 5. CRIAÇÃO DO CARD ESTILO IFOOD COM ADIÇÃO EM 1 CLIQUE
    function createProductCardElement(p) {
      const card = document.createElement('div');
      card.className = 'prod-card';
      card.dataset.prodId = p.id;
      const price = Number(p.valor_num || p.price || 0);
      const images = (p.images && p.images.length > 0) ? p.images : [getProductImage(p)];
      const stock = p.stockQuantity ?? p.estoque ?? 30;
      const byKg = isSoldByKg(p);

      card.innerHTML = \`
        <div class="card-img-wrapper" onclick="openGallery('\${p.id}')">
          <img class="prod-img" src="\${images[0]}" alt="\${p.descricao || p.name}" loading="lazy" decoding="async" onerror="this.onerror=null; this.src='\${REAL_HD_FALLBACKS['DEFAULT']}';" />
          \${images.length > 1 ? ('<span class="photo-count-badge">📷 ' + images.length + ' fotos</span>') : ''}
          \${byKg ? '<span class="unit-tag-badge">⚖️ POR KG</span>' : ''}
        </div>
        <div class="card-body">
          <span class="card-category">\${p.subcategoria || p.subcategory || p.categoria || p.category || 'Conflora'}</span>
          <div class="card-title" onclick="openGallery('\${p.id}')">\${p.descricao || p.name}</div>
          <div class="card-footer">
            <div>
              <div class="card-price">\${localization.formatCurrency(price)} <span style="font-size:11px; font-weight:normal; color:#64748b;">\${byKg ? '/kg' : ''}</span></div>
              <span class="card-stock">\${stock} \${byKg ? 'kg' : 'un.'} disp.</span>
            </div>
            <div class="card-btn-container" id="cardBtnContainer_\${p.id}">
              \${renderCardButtonHtml(p.id)}
            </div>
          </div>
        </div>
      \`;

      return card;
    }

    // 5. UX ESTILO IFOOD: '+' SE TRANSFORMA EM '[-] [QUANTIDADE] [+]' NO PRÓPRIO CARD
    function renderCardButtonHtml(prodId) {
      const idKey = String(prodId);
      const item = cartStore.cartItemsMap[idKey];
      const p = rawProducts.find(x => String(x.id) === idKey);
      const byKg = p ? isSoldByKg(p) : false;

      if (!item || item.qty <= 0) {
        return \`
          <button class="add-btn add-btn-initial" onclick="handleProductAddClick('\${idKey}', event)" title="Adicionar à Sacola">
            \${byKg ? '⚖️ +' : '+'}
          </button>
        \`;
      }

      const qtyDisplay = item.isKg ? item.qty.toFixed(item.qty % 1 === 0 ? 0 : 2) : item.qty;
      return \`
        <div class="card-qty-ctrl">
          <button type="button" class="card-qty-btn" onclick="handleCardQtyChange('\${idKey}', -1, event)" title="Diminuir">-</button>
          <span class="card-qty-num">\${qtyDisplay}</span>
          <button type="button" class="card-qty-btn" onclick="handleCardQtyChange('\${idKey}', 1, event)" title="Aumentar">+</button>
        </div>
      \`;
    }

    function updateCardButtonInGrid(prodId) {
      const container = document.getElementById('cardBtnContainer_' + prodId);
      if (container) {
        container.innerHTML = renderCardButtonHtml(prodId);
      }
    }

    function updateAllCardButtonsInGrid() {
      Object.keys(cartStore.cartItemsMap).forEach(id => {
        updateCardButtonInGrid(id);
      });
      document.querySelectorAll('.card-btn-container').forEach(el => {
        const id = el.id.replace('cardBtnContainer_', '');
        if (!cartStore.cartItemsMap[id]) {
          el.innerHTML = renderCardButtonHtml(id);
        }
      });
    }

    function handleProductAddClick(prodId, event) {
      if (event && event.stopPropagation) event.stopPropagation();
      const p = rawProducts.find(x => String(x.id) === String(prodId));
      if (!p) return;

      if (isSoldByKg(p)) {
        openKgModal(prodId);
      } else {
        addToCart(prodId, 1);
      }
    }

    function handleCardQtyChange(prodId, delta, event) {
      if (event && event.stopPropagation) event.stopPropagation();
      changeQty(prodId, delta);
    }

    // --- CARROSSEL E ZOOM INTERATIVO ---
    let currentGalleryImages = [];
    let currentGalleryIndex = 0;
    let currentGalleryProduct = null;
    let currentZoomScale = 1.0;
    let zoomPanX = 0;
    let zoomPanY = 0;
    let isZoomPanning = false;
    let startZoomPanX = 0;
    let startZoomPanY = 0;

    function setCarouselPhoto(index) {
      if (!currentGalleryImages || currentGalleryImages.length === 0) return;
      currentGalleryIndex = (index + currentGalleryImages.length) % currentGalleryImages.length;
      const currentUrl = currentGalleryImages[currentGalleryIndex];

      const mainImg = document.getElementById('modalMainImg');
      if (mainImg) {
        mainImg.style.opacity = '0.7';
        mainImg.src = currentUrl;
        setTimeout(() => { mainImg.style.opacity = '1'; }, 80);
      }

      document.querySelectorAll('.thumb-btn').forEach((btn, i) => {
        if (i === currentGalleryIndex) {
          btn.classList.add('active');
          try { btn.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' }); } catch (e) {}
        } else {
          btn.classList.remove('active');
        }
      });

      document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        if (i === currentGalleryIndex) dot.classList.add('active');
        else dot.classList.remove('active');
      });

      const counterBadge = document.getElementById('carouselCounterBadge');
      if (counterBadge) {
        counterBadge.textContent = (currentGalleryIndex + 1) + ' / ' + currentGalleryImages.length;
      }

      const zoomModal = document.getElementById('photoZoomModal');
      const zoomImg = document.getElementById('zoomModalImg');
      if (zoomModal && zoomModal.style.display !== 'none' && zoomImg) {
        zoomImg.src = currentUrl;
        const zoomBadge = document.getElementById('zoomCounterBadge');
        if (zoomBadge) zoomBadge.textContent = (currentGalleryIndex + 1) + ' / ' + currentGalleryImages.length;
        resetZoom();
      }
    }

    function prevCarouselPhoto(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      setCarouselPhoto(currentGalleryIndex - 1);
    }

    function nextCarouselPhoto(e) {
      if (e && e.stopPropagation) e.stopPropagation();
      setCarouselPhoto(currentGalleryIndex + 1);
    }

    function openPhotoZoom() {
      if (!currentGalleryImages || currentGalleryImages.length === 0) return;
      const zoomModal = document.getElementById('photoZoomModal');
      const zoomImg = document.getElementById('zoomModalImg');
      const zoomTitle = document.getElementById('zoomProdTitle');
      const zoomBadge = document.getElementById('zoomCounterBadge');

      if (zoomTitle && currentGalleryProduct) {
        zoomTitle.textContent = '🔍 ' + (currentGalleryProduct.descricao || currentGalleryProduct.name) + ' • Qualidade Máxima';
      }
      if (zoomBadge) {
        zoomBadge.textContent = (currentGalleryIndex + 1) + ' / ' + currentGalleryImages.length;
      }
      if (zoomImg) {
        zoomImg.src = currentGalleryImages[currentGalleryIndex];
      }

      resetZoom();
      if (zoomModal) zoomModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function closePhotoZoom() {
      const zoomModal = document.getElementById('photoZoomModal');
      if (zoomModal) zoomModal.style.display = 'none';
      const galleryModal = document.getElementById('galleryModal');
      if (!galleryModal || !galleryModal.classList.contains('open')) {
        document.body.style.overflow = '';
      }
    }

    function updateZoomTransform() {
      const zoomImg = document.getElementById('zoomModalImg');
      const levelText = document.getElementById('zoomLevelText');
      if (levelText) {
        levelText.textContent = Math.round(currentZoomScale * 100) + '%';
      }
      if (zoomImg) {
        zoomImg.style.transform = 'translate(' + zoomPanX + 'px, ' + zoomPanY + 'px) scale(' + currentZoomScale + ')';
        zoomImg.style.cursor = currentZoomScale > 1.05 ? 'grab' : 'zoom-in';
      }
    }

    function resetZoom() {
      currentZoomScale = 1.0;
      zoomPanX = 0;
      zoomPanY = 0;
      updateZoomTransform();
    }

    function zoomIn() {
      currentZoomScale = Math.min(4.5, currentZoomScale + 0.5);
      updateZoomTransform();
    }

    function zoomOut() {
      currentZoomScale = Math.max(0.75, currentZoomScale - 0.5);
      if (currentZoomScale <= 1.0) {
        zoomPanX = 0;
        zoomPanY = 0;
      }
      updateZoomTransform();
    }

    function toggleZoomLevel() {
      if (currentZoomScale >= 2.0) resetZoom();
      else { currentZoomScale = 2.2; updateZoomTransform(); }
    }

    function handleZoomWheel(e) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.25 : -0.25;
      currentZoomScale = Math.min(4.5, Math.max(0.75, currentZoomScale + zoomFactor));
      if (currentZoomScale <= 1.0) { zoomPanX = 0; zoomPanY = 0; }
      updateZoomTransform();
    }

    function startZoomPan(e) {
      if (currentZoomScale <= 1.05) return;
      isZoomPanning = true;
      startZoomPanX = e.clientX - zoomPanX;
      startZoomPanY = e.clientY - zoomPanY;
      const vp = document.getElementById('zoomViewport');
      if (vp) vp.classList.add('dragging');
    }

    function doZoomPan(e) {
      if (!isZoomPanning || currentZoomScale <= 1.05) return;
      zoomPanX = e.clientX - startZoomPanX;
      zoomPanY = e.clientY - startZoomPanY;
      updateZoomTransform();
    }

    function endZoomPan() {
      isZoomPanning = false;
      const vp = document.getElementById('zoomViewport');
      if (vp) vp.classList.remove('dragging');
    }

    function openGallery(prodId) {
      const p = rawProducts.find(x => String(x.id) === String(prodId));
      if (!p) return;

      currentGalleryProduct = p;
      if (typeof gtag === 'function') {
        gtag('event', 'view_item', {
          items: [{ item_id: String(prodId), item_name: p.descricao || p.name, price: Number(p.valor_num || p.price || 0) }]
        });
      }

      currentGalleryImages = (Array.isArray(p.images) && p.images.length > 0)
        ? p.images
        : [getProductImage(p)];
      currentGalleryIndex = 0;

      document.getElementById('modalProdTitle').textContent = p.descricao || p.name;
      document.getElementById('modalProdCategory').textContent = (p.categoria || p.category || '') + ' • ' + (p.subcategoria || p.subcategory || '');
      const byKg = isSoldByKg(p);
      document.getElementById('modalProdPrice').textContent = localization.formatCurrency(Number(p.valor_num || p.price || 0)) + (byKg ? ' / kg' : '');
      document.getElementById('modalProdDesc').textContent = p.descriptionAi || p.descricao_ia || 'Produto selecionado do viveiro e horta da Conflora em Mineiros - GO com garantia de procedência.';

      const dotsRow = document.getElementById('carouselDotsRow');
      if (dotsRow) {
        dotsRow.innerHTML = '';
        if (currentGalleryImages.length > 1) {
          dotsRow.style.display = 'flex';
          currentGalleryImages.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'carousel-dot ' + (i === 0 ? 'active' : '');
            dot.onclick = () => setCarouselPhoto(i);
            dotsRow.appendChild(dot);
          });
        } else {
          dotsRow.style.display = 'none';
        }
      }

      const prevBtn = document.getElementById('carouselPrevBtn');
      const nextBtn = document.getElementById('carouselNextBtn');
      if (prevBtn) prevBtn.style.display = currentGalleryImages.length > 1 ? 'flex' : 'none';
      if (nextBtn) nextBtn.style.display = currentGalleryImages.length > 1 ? 'flex' : 'none';

      const thumbsRow = document.getElementById('modalThumbsRow');
      thumbsRow.innerHTML = '';
      if (currentGalleryImages.length > 1) {
        thumbsRow.style.display = 'flex';
        currentGalleryImages.forEach((img, i) => {
          const btn = document.createElement('div');
          btn.className = 'thumb-btn ' + (i === 0 ? 'active' : '');
          btn.innerHTML = '<img src="' + img + '" alt="Foto ' + (i + 1) + '" loading="lazy" decoding="async" />';
          btn.onclick = () => setCarouselPhoto(i);
          thumbsRow.appendChild(btn);
        });
      } else {
        thumbsRow.style.display = 'none';
      }

      setCarouselPhoto(0);

      const modalAddBtn = document.getElementById('modalAddBtn');
      modalAddBtn.onclick = () => {
        closeModal();
        handleProductAddClick(p.id);
      };

      document.getElementById('galleryModal').classList.add('open');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      document.getElementById('galleryModal').classList.remove('open');
      closePhotoZoom();
      document.body.style.overflow = '';
    }

    // Atalhos de teclado
    document.addEventListener('keydown', (e) => {
      const zoomModal = document.getElementById('photoZoomModal');
      const isZoomOpen = zoomModal && zoomModal.style.display !== 'none';
      const galleryModal = document.getElementById('galleryModal');
      const isGalleryOpen = galleryModal && galleryModal.classList.contains('open');

      if (isZoomOpen) {
        if (e.key === 'Escape') closePhotoZoom();
        else if (e.key === 'ArrowLeft') prevCarouselPhoto();
        else if (e.key === 'ArrowRight') nextCarouselPhoto();
        else if (e.key === '+' || e.key === '=') zoomIn();
        else if (e.key === '-') zoomOut();
        else if (e.key === '0') resetZoom();
      } else if (isGalleryOpen) {
        if (e.key === 'Escape') closeModal();
        else if (e.key === 'ArrowLeft') prevCarouselPhoto();
        else if (e.key === 'ArrowRight') nextCarouselPhoto();
      }
    });

    // --- MODAL DE KG ---
    function openKgModal(prodId) {
      const p = rawProducts.find(x => String(x.id) === String(prodId));
      if (!p) return;
      pendingKgProduct = p;

      const existingCartItem = cartStore.cartItemsMap[String(prodId)];
      const initialWeight = existingCartItem ? existingCartItem.qty : 1.000;

      document.getElementById('kgModalTitle').textContent = '⚖️ ' + (p.descricao || p.name);
      document.getElementById('kgPricePerKgDisplay').textContent = localization.formatCurrency(Number(p.valor_num || p.price || 0)) + '/kg';
      document.getElementById('kgWeightInput').value = initialWeight.toFixed(3);
      updateKgModalSubtotal();

      document.getElementById('kgModal').classList.add('open');
    }

    function closeKgModal() {
      document.getElementById('kgModal').classList.remove('open');
      pendingKgProduct = null;
    }

    function openKgModalIfKg(prodId) {
      const item = cartStore.cartItemsMap[String(prodId)];
      if (item && item.isKg) {
        openKgModal(prodId);
      }
    }

    function setKgPreset(weight) {
      const input = document.getElementById('kgWeightInput');
      input.value = Number(weight).toFixed(3);
      updateKgModalSubtotal();
    }

    function updateKgModalSubtotal() {
      if (!pendingKgProduct) return;
      const weight = parseFloat(document.getElementById('kgWeightInput').value) || 0;
      const price = Number(pendingKgProduct.valor_num || pendingKgProduct.price || 0);
      const subtotal = weight * price;
      document.getElementById('kgSubtotalDisplay').textContent = localization.formatCurrency(subtotal);
    }

    function confirmKgAddToCart() {
      if (!pendingKgProduct) return;
      const weight = parseFloat(document.getElementById('kgWeightInput').value);
      if (isNaN(weight) || weight <= 0) {
        alert('Por favor, informe um peso válido em kg.');
        return;
      }
      addToCart(pendingKgProduct.id, weight, true);
      closeKgModal();
    }

    // --- SACOLA / CARRINHO ---
    function addToCart(prodId, quantity = 1, isKg = false) {
      const p = rawProducts.find(x => String(x.id) === String(prodId));
      if (!p) return;
      const idKey = String(prodId);

      cartStore.addItem(p, quantity, isKg);
      cart = cartStore.cartItemsMap;

      if (typeof gtag === 'function') {
        gtag('event', 'add_to_cart', {
          items: [{ item_id: idKey, item_name: p.descricao || p.name, price: Number(p.valor_num || p.price || 0), quantity }]
        });
      }

      renderCartUI();
      updateCardButtonInGrid(idKey);
    }

    function changeQty(prodId, delta) {
      const idKey = String(prodId);
      cartStore.changeItemQuantity(idKey, delta);
      cart = cartStore.cartItemsMap;
      renderCartUI();
      updateCardButtonInGrid(idKey);
    }

    function clearCart() {
      if (Object.keys(cartStore.cartItemsMap).length === 0) return;
      if (confirm('Deseja realmente esvaziar sua sacola?')) {
        cartStore.clear();
        cart = cartStore.cartItemsMap;
        renderCartUI();
        updateAllCardButtonsInGrid();
      }
    }

    // 6. SISTEMA DE CUPOM DE DESCONTO
    function applyPromoCouponDirect(code) {
      const input = document.getElementById('couponInput');
      if (input) input.value = code;
      applyCoupon(code);
      scrollToCart();
    }

    function applyCouponFromInput() {
      const input = document.getElementById('couponInput');
      const code = (input ? input.value : '').trim().toUpperCase();
      if (!code) {
        showCouponFeedback('Por favor, digite o código do cupom.', 'error');
        return;
      }
      applyCoupon(code);
    }

    function applyCoupon(code) {
      const cleanCode = (code || '').trim().toUpperCase();
      const couponData = VALID_COUPONS[cleanCode];

      if (!couponData) {
        cartStore.removeCoupon();
        appliedCoupon = null;
        showCouponFeedback('⚠️ Cupom "' + cleanCode + '" inválido ou expirado.', 'error');
        renderCartUI();
        return;
      }

      cartStore.applyCoupon({ code: cleanCode, ...couponData });
      appliedCoupon = cartStore.activeCoupon;
      showCouponFeedback(
        '<span>✅ <strong>' + cleanCode + '</strong> aplicado (' + couponData.label + ')!</span> <button type="button" class="coupon-remove-btn" onclick="removeCoupon()">Remover</button>',
        'success'
      );
      renderCartUI();
    }

    function removeCoupon() {
      cartStore.removeCoupon();
      appliedCoupon = null;
      const input = document.getElementById('couponInput');
      if (input) input.value = '';
      const fb = document.getElementById('couponFeedback');
      if (fb) {
        fb.style.display = 'none';
        fb.innerHTML = '';
      }
      renderCartUI();
    }

    function showCouponFeedback(html, type) {
      const fb = document.getElementById('couponFeedback');
      if (!fb) return;
      fb.className = 'coupon-feedback ' + type;
      fb.innerHTML = html;
      fb.style.display = type === 'success' ? 'flex' : 'block';
    }

    function calculateCartTotals() {
      return cartStore.getTotals();
    }

    function renderCart() {
      renderCartUI();
    }

    function renderCartUI() {
      const list = document.getElementById('cartItemsList');
      const items = cartStore.getItems();
      const totals = cartStore.getTotals();

      list.innerHTML = '';
      if (items.length === 0) {
        list.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">' + localization.translate('cart.emptyMessage') + '</div>';
      } else {
        items.forEach(item => {
          const sub = item.price * item.qty;
          const qtyDisplay = item.isKg ? (item.qty.toFixed(3).replace('.', ',') + ' kg') : item.qty;

          const div = document.createElement('div');
          div.className = 'cart-item';
          div.innerHTML = \`
            <div class="cart-item-title">
              \${item.name}
              \${item.isKg ? '<span style="font-size:10px; color:#d97706; font-weight:700; margin-left:4px;">(KG)</span>' : ''}
            </div>
            <div class="cart-qty-ctrl-row">
              <button class="qty-btn" onclick="changeQty('\${item.id}', -1)" title="Diminuir">-</button>
              <span style="font-weight:bold; min-width:38px; text-align:center; font-size:12px; cursor:\${item.isKg ? 'pointer' : 'default'};" \${item.isKg ? ('onclick="openKgModal(&quot;' + item.id + '&quot;)"') : ''}>
                \${qtyDisplay}
              </span>
              <button class="qty-btn" onclick="changeQty('\${item.id}', 1)" title="Aumentar">+</button>
            </div>
            <div style="font-weight:700; min-width:65px; text-align:right; color:#14532d; font-size:12px;">\${localization.formatCurrency(sub)}</div>
          \`;
          list.appendChild(div);
        });
      }

      // Visibilidade de botões e contadores
      const clearBtn = document.getElementById('clearCartBtn');
      if (clearBtn) clearBtn.style.display = items.length > 0 ? 'inline-flex' : 'none';

      document.getElementById('cartItemCounter').textContent = items.length + ' item(ns)';
      document.getElementById('cartCountHeader').textContent = items.length + ' itens';
      document.getElementById('cartSubtotalText').textContent = localization.formatCurrency(totals.subtotal);

      const discountRow = document.getElementById('discountSummaryRow');
      const discountName = document.getElementById('discountCouponName');
      const discountVal = document.getElementById('cartDiscountText');
      if (discountRow) {
        if (totals.discount > 0 && cartStore.activeCoupon) {
          discountRow.style.display = 'flex';
          if (discountName) discountName.textContent = cartStore.activeCoupon.code;
          if (discountVal) discountVal.textContent = '- ' + localization.formatCurrency(totals.discount);
        } else {
          discountRow.style.display = 'none';
        }
      }

      document.getElementById('cartTotalText').textContent = localization.formatCurrency(totals.total);

      // Barra inferior mobile
      const mobBar = document.getElementById('mobileCartFloatBar');
      const mobCount = document.getElementById('mobCartCount');
      const mobTotal = document.getElementById('mobCartTotal');
      if (mobBar && mobCount && mobTotal) {
        if (items.length > 0) {
          mobBar.style.display = 'flex';
          mobCount.textContent = items.length;
          mobTotal.textContent = localization.formatCurrency(totals.total);
        } else {
          mobBar.style.display = 'none';
        }
      }

      // Atualiza troco se pagamento for dinheiro
      if (cartStore.paymentMethod === 'DINHEIRO') {
        calculateChange();
        renderQuickCashChips(totals.total);
      }
    }

    function setOrderType(type) {
      cartStore.setOrderType(type);
      orderType = type;
      const delBtn = document.getElementById('typeDeliveryBtn');
      const pickBtn = document.getElementById('typePickupBtn');
      const addrGroup = document.getElementById('addressGroup');

      if (type === 'PICKUP') {
        pickBtn.classList.add('selected');
        delBtn.classList.remove('selected');
        addrGroup.style.display = 'none';
      } else {
        delBtn.classList.add('selected');
        pickBtn.classList.remove('selected');
        addrGroup.style.display = 'flex';
      }
      saveCustomerDataToStorage();
    }

    // 7. FORMA DE PAGAMENTO EM DINHEIRO COM CÁLCULO DE TROCO
    function setPayment(pay) {
      cartStore.setPaymentMethod(pay);
      paymentMethod = pay;
      document.getElementById('payPixBtn').classList.toggle('selected', pay === 'PIX');
      document.getElementById('payCardBtn').classList.toggle('selected', pay === 'CARTAO');
      document.getElementById('payCashBtn').classList.toggle('selected', pay === 'DINHEIRO');

      document.getElementById('pixBox').style.display = pay === 'PIX' ? 'block' : 'none';
      const cashBox = document.getElementById('cashCalcBox');
      if (cashBox) {
        cashBox.style.display = pay === 'DINHEIRO' ? 'flex' : 'none';
        if (pay === 'DINHEIRO') {
          const totals = cartStore.getTotals();
          renderQuickCashChips(totals.total);
          calculateChange();
        }
      }
      saveCustomerDataToStorage();
    }

    function renderQuickCashChips(total) {
      const container = document.getElementById('cashQuickChips');
      if (!container) return;
      container.innerHTML = '';
      if (total <= 0) return;

      const exactBtn = document.createElement('button');
      exactBtn.type = 'button';
      exactBtn.className = 'cash-chip-btn';
      exactBtn.textContent = 'Valor Exato (' + localization.formatCurrency(total) + ')';
      exactBtn.onclick = () => setTenderedCash(total);
      container.appendChild(exactBtn);

      const targets = [20, 50, 100, 200];
      targets.forEach(v => {
        if (v >= total) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'cash-chip-btn';
          b.textContent = localization.formatCurrency(v);
          b.onclick = () => setTenderedCash(v);
          container.appendChild(b);
        }
      });
    }

    function setTenderedCash(val) {
      const input = document.getElementById('cashTenderedInput');
      if (input) {
        input.value = Number(val).toFixed(2);
        calculateChange();
      }
    }

    function calculateChange() {
      const input = document.getElementById('cashTenderedInput');
      const box = document.getElementById('changeResultBox');
      if (!input || !box) return;

      const tendered = parseFloat(input.value) || 0;
      const totals = cartStore.getTotals();
      const total = totals.total;

      if (!input.value || tendered <= 0) {
        box.style.display = 'none';
        return;
      }

      box.style.display = 'block';
      const change = calculateChangeAmount(tendered, total);

      if (change > 0.001) {
        box.className = 'change-result-box ok';
        box.innerHTML = '💰 <strong>Troco a devolver:</strong> ' + localization.formatCurrency(change);
      } else if (Math.abs(change) <= 0.001) {
        box.className = 'change-result-box ok';
        box.innerHTML = '✅ <strong>Valor exato em mãos:</strong> Não precisa de troco.';
      } else {
        box.className = 'change-result-box warning';
        box.innerHTML = '⚠️ <strong>Atenção:</strong> O valor em dinheiro informado é menor que o total da compra (Faltam ' + localization.formatCurrency(Math.abs(change)) + ')!';
      }
    }

    function copyPix() {
      const key = document.getElementById('pixKeyDisplay').innerText;
      navigator.clipboard.writeText(key).then(() => {
        alert('Chave PIX copiada: ' + key);
      });
    }

    // --- PERSISTÊNCIA DOS DADOS DO CLIENTE ---
    function saveCustomerDataToStorage() {
      try {
        const payload = {
          name: document.getElementById('custName').value.trim(),
          phone: document.getElementById('custPhone').value.trim(),
          address: document.getElementById('custAddress').value.trim(),
          orderType: cartStore.orderType,
          paymentMethod: cartStore.paymentMethod,
        };
        localStorage.setItem('conflora_customer', JSON.stringify(payload));
      } catch (_) {}
    }

    function loadSavedCustomerData() {
      try {
        const raw = localStorage.getItem('conflora_customer');
        if (raw) {
          const d = JSON.parse(raw);
          if (d.name) document.getElementById('custName').value = d.name;
          if (d.phone) document.getElementById('custPhone').value = d.phone;
          if (d.address) document.getElementById('custAddress').value = d.address;
          if (d.orderType) setOrderType(d.orderType);
          if (d.paymentMethod) setPayment(d.paymentMethod);

          if (d.name || d.phone) {
            const notice = document.getElementById('savedDataNotice');
            if (notice) notice.style.display = 'block';
          }
        }
      } catch (_) {}
    }

    // 10. FINALIZAÇÃO DO PEDIDO, RECIBO DO CLIENTE E NOTIFICAÇÃO DO PROPRIETÁRIO
    async function submitOrder() {
      const items = cartStore.getItems();
      if (items.length === 0) {
        alert('Adicione pelo menos um item à sua sacola!');
        return;
      }
      const name = document.getElementById('custName').value.trim();
      const phone = document.getElementById('custPhone').value.trim();
      const address = document.getElementById('custAddress').value.trim();

      if (!name) { alert('Por favor, informe seu nome.'); return; }
      if (!phone) { alert('Por favor, informe seu telefone/WhatsApp.'); return; }
      if (cartStore.orderType === 'DELIVERY' && !address) { alert('Por favor, informe o endereço de entrega em Mineiros.'); return; }

      const totals = cartStore.getTotals();
      let cashTendered = 0;
      let changeDue = 0;

      if (cartStore.paymentMethod === 'DINHEIRO') {
        const tenderedInput = document.getElementById('cashTenderedInput');
        cashTendered = parseFloat(tenderedInput ? tenderedInput.value : 0) || totals.total;
        if (cashTendered < totals.total) {
          if (!confirm('O valor em dinheiro informado (' + localization.formatCurrency(cashTendered) + ') é menor que o total (' + localization.formatCurrency(totals.total) + '). Deseja continuar assim mesmo?')) {
            return;
          }
        }
        changeDue = Math.max(0, cashTendered - totals.total);
      }

      saveCustomerDataToStorage();

      const submitBtn = document.getElementById('submitOrderBtn');
      submitBtn.disabled = true;
      submitBtn.innerText = localization.translate('checkout.processing', 'Processando Pedido...');

      try {
        const payload = {
          customerId: currentUser ? currentUser.id : '',
          customerEmail: currentUser ? currentUser.email : '',
          customerName: name,
          customerPhone: phone,
          orderType: cartStore.orderType,
          deliveryAddress: cartStore.orderType === 'DELIVERY' ? address : 'Retirada no Viveiro Conflora',
          paymentMethod: cartStore.paymentMethod,
          subtotal: totals.subtotal,
          coupon: cartStore.activeCoupon ? cartStore.activeCoupon.code : '',
          discount: totals.discount,
          cashTendered,
          changeDue,
          items: items.map(i => ({
            productId: i.id,
            name: i.name,
            quantity: i.qty,
            unit: i.isKg ? 'KG' : 'UN',
            price: i.price,
            subtotal: i.price * i.qty,
          })),
        };

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success && data.order) {
          const ord = data.order;
          if (typeof gtag === 'function') {
            gtag('event', 'purchase', {
              transaction_id: ord.id || String(Date.now()),
              value: Number(ord.total || totals.total),
              currency: localization.translate('locale.currency', 'BRL'),
            });
          }

          lastCompletedOrderReceipt = {
            order: ord,
            customerName: name,
            customerPhone: phone,
            deliveryAddress: cartStore.orderType === 'DELIVERY' ? address : 'Retirada no Viveiro Conflora',
            orderType: cartStore.orderType,
            paymentMethod: cartStore.paymentMethod,
            subtotal: totals.subtotal,
            coupon: cartStore.activeCoupon ? cartStore.activeCoupon.code : '',
            discount: totals.discount,
            total: ord.total || totals.total,
            cashTendered,
            changeDue,
            items: payload.items,
            date: new Date().toLocaleString('pt-BR'),
          };

          // Limpa sacola e atualiza UI
          cartStore.clear();
          cartStore.removeCoupon();
          cart = cartStore.cartItemsMap;
          appliedCoupon = null;
          renderCartUI();
          updateAllCardButtonsInGrid();

          // Abre Comprovante Digital do Cliente e Prepara Notificação WhatsApp
          showCustomerReceiptModal(lastCompletedOrderReceipt);
          loadCatalog();
          if (currentUser) {
            loadCustomerData();
          }
        } else {
          alert('Erro ao registrar pedido: ' + (data.error || 'Tente novamente.'));
        }
      } catch (err) {
        alert('Erro de conexão ao finalizar pedido: ' + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = localization.translate('checkout.submitButton', '✅ Finalizar Pedido');
      }
    }

    // 10. COMPROVANTE DIGITAL DO CLIENTE & NOTIFICAÇÃO DO PROPRIETÁRIO
    function buildOwnerWhatsAppMessage(rec) {
      const itemsListText = rec.items
        .map(it => '• ' + it.quantity + (it.unit === 'KG' ? ' kg' : 'x') + ' ' + it.name + ' (R$ ' + Number(it.price || 0).toFixed(2).replace('.', ',') + ') = R$ ' + Number(it.subtotal || (it.price * it.quantity)).toFixed(2).replace('.', ','))
        .join('\\n');

      const couponText = rec.discount > 0
        ? '🎟️ *Cupom:* ' + rec.coupon + ' (-R$ ' + Number(rec.discount).toFixed(2).replace('.', ',') + ')\\n'
        : '';

      let cashDetails = '';
      if (rec.paymentMethod === 'DINHEIRO') {
        if (rec.changeDue > 0) {
          cashDetails = '💵 *Dinheiro em mãos:* R$ ' + Number(rec.cashTendered).toFixed(2).replace('.', ',') + '\\n' +
                        '💰 *Levar de troco:* R$ ' + Number(rec.changeDue).toFixed(2).replace('.', ',') + '\\n';
        } else {
          cashDetails = '💵 *Dinheiro em mãos:* R$ ' + Number(rec.cashTendered || rec.total).toFixed(2).replace('.', ',') + '\\n' +
                        '✅ *Valor exato, não precisa de troco*\\n';
        }
      }

      return (
        '🔔 *NOVO PEDIDO FECHADO - CONFLORA HORTA E VIVEIRO* 🔔\\n\\n' +
        '📦 *Pedido:* #' + rec.order.id + '\\n' +
        '📅 *Data:* ' + rec.date + '\\n\\n' +
        '👤 *Cliente:* ' + rec.customerName + '\\n' +
        '📱 *Telefone/WhatsApp:* ' + rec.customerPhone + '\\n' +
        '📍 *Entrega:* ' + rec.deliveryAddress + ' (' + (rec.orderType === 'DELIVERY' ? '🛵 Entrega' : '🏬 Retirada') + ')\\n\\n' +
        '🛒 *Relação de Itens:*\\n' +
        itemsListText + '\\n\\n' +
        '💵 *Subtotal:* R$ ' + Number(rec.subtotal).toFixed(2).replace('.', ',') + '\\n' +
        couponText +
        '💰 *Total Final da Compra:* R$ ' + Number(rec.total).toFixed(2).replace('.', ',') + '\\n' +
        '💳 *Forma de Pagamento:* ' + rec.paymentMethod + '\\n' +
        cashDetails
      );
    }

    function showCustomerReceiptModal(rec) {
      const modal = document.getElementById('orderReceiptModal');
      const paper = document.getElementById('receiptPaperContent');
      const waBtn = document.getElementById('receiptOwnerWaLink');
      if (!modal || !paper) return;

      const itemsHtml = rec.items.map(it => {
        const sub = it.price * it.quantity;
        return \`
          <div class="receipt-row" style="margin-bottom:4px;">
            <span>\${it.quantity}\${it.unit === 'KG' ? 'kg' : 'x'} \${it.name}</span>
            <span>R$ \${sub.toFixed(2).replace('.', ',')}</span>
          </div>
        \`;
      }).join('');

      let trocoHtml = '';
      if (rec.paymentMethod === 'DINHEIRO') {
        if (rec.changeDue > 0) {
          trocoHtml = \`
            <div class="receipt-row">
              <span>Dinheiro informado:</span>
              <span>R$ \${Number(rec.cashTendered).toFixed(2).replace('.', ',')}</span>
            </div>
            <div class="receipt-row" style="color:#166534; font-weight:bold;">
              <span>Troco a devolver:</span>
              <span>R$ \${Number(rec.changeDue).toFixed(2).replace('.', ',')}</span>
            </div>
          \`;
        } else {
          trocoHtml = \`
            <div class="receipt-row" style="color:#166534;">
              <span>Dinheiro:</span>
              <span>Valor exato (sem troco)</span>
            </div>
          \`;
        }
      }

      paper.innerHTML = \`
        <div style="text-align:center; font-weight:bold; margin-bottom:8px;">
          🌿 CONFLORA HORTA E VIVEIRO<br>
          <span style="font-size:11px; font-weight:normal;">Mineiros - GO • Telefone: (64) 99935-1616</span>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-row"><strong>PEDIDO #\${rec.order.id}</strong><span>\${rec.date}</span></div>
        <div class="receipt-row"><span>Cliente: \${rec.customerName}</span><span>\${rec.customerPhone}</span></div>
        <div style="font-size:11px; margin-top:2px;">📍 \${rec.deliveryAddress} (\${rec.orderType === 'DELIVERY' ? 'Entrega' : 'Retirada'})</div>
        <div class="receipt-divider"></div>
        <div style="font-weight:bold; margin-bottom:6px;">ITENS:</div>
        \${itemsHtml}
        <div class="receipt-divider"></div>
        <div class="receipt-row"><span>Subtotal:</span><span>R$ \${Number(rec.subtotal).toFixed(2).replace('.', ',')}</span></div>
        \${rec.discount > 0 ? ('<div class="receipt-row" style="color:#166534;"><span>Cupom (' + rec.coupon + '):</span><span>- R$ ' + Number(rec.discount).toFixed(2).replace('.', ',') + '</span></div>') : ''}
        <div class="receipt-row" style="font-size:15px; font-weight:bold; margin-top:4px;">
          <span>TOTAL:</span>
          <span>R$ \${Number(rec.total).toFixed(2).replace('.', ',')}</span>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-row"><span>Pagamento:</span><span>\${rec.paymentMethod}</span></div>
        \${trocoHtml}
        <div class="receipt-divider"></div>
        <div style="text-align:center; font-size:11px; color:#64748b; margin-top:6px;">
          Obrigado pela preferência! Já estamos preparando suas plantas com todo carinho 🌱.
        </div>
      \`;

      // Monta notificação formatada para o WhatsApp do proprietário
      const msg = buildOwnerWhatsAppMessage(rec);
      const waUrl = 'https://wa.me/' + OWNER_WHATSAPP_PHONE + '?text=' + encodeURIComponent(msg);
      if (waBtn) {
        waBtn.href = waUrl;
      }

      modal.classList.add('open');
    }

    function closeReceiptModal() {
      const modal = document.getElementById('orderReceiptModal');
      if (modal) modal.classList.remove('open');
    }

    function copyReceiptText() {
      if (!lastCompletedOrderReceipt) return;
      const text = buildOwnerWhatsAppMessage(lastCompletedOrderReceipt);
      navigator.clipboard.writeText(text).then(() => {
        alert(localization.translate('receipt.copySuccess', '📋 Recibo copiado com sucesso para a área de transferência!'));
      });
    }

    function printReceipt() {
      window.print();
    }

    // 8. CONTROLES DE SCROLL FLUTUANTES (FABs) & BOTTOM SHEET MOBILE
    function openCartBottomSheet() {
      const panel = document.getElementById('cartPanel');
      const backdrop = document.getElementById('cartBottomSheetBackdrop');
      if (panel) panel.classList.add('bottom-sheet-open');
      if (backdrop) backdrop.classList.add('open');
      if (window.innerWidth <= 980) {
        document.body.style.overflow = 'hidden';
      }
    }

    function closeCartBottomSheet() {
      const panel = document.getElementById('cartPanel');
      const backdrop = document.getElementById('cartBottomSheetBackdrop');
      if (panel) panel.classList.remove('bottom-sheet-open');
      if (backdrop) backdrop.classList.remove('open');
      document.body.style.overflow = '';
    }

    function scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function scrollToFilters() {
      const bar = document.getElementById('categoriesBar');
      if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function scrollToCart() {
      if (window.innerWidth <= 980) {
        openCartBottomSheet();
      } else {
        const panel = document.getElementById('cartPanel');
        if (panel) panel.scrollIntoView({ behavior: 'smooth' });
      }
    }

    function applyPhoneMask(e) {
      if (!e || !e.target) return;
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val.length > 11) val = val.substring(0, 11);
      if (val.length <= 2) {
        e.target.value = val.length ? '(' + val : '';
      } else if (val.length <= 6) {
        e.target.value = '(' + val.substring(0, 2) + ') ' + val.substring(2);
      } else if (val.length <= 10) {
        e.target.value = '(' + val.substring(0, 2) + ') ' + val.substring(2, 6) + '-' + val.substring(6);
      } else {
        e.target.value = '(' + val.substring(0, 2) + ') ' + val.substring(2, 7) + '-' + val.substring(7, 11);
      }
    }

    // --- AGENTE BOTÂNICO IA (CONFLORA AI) ---
    let isAiChatOpen = false;

    function toggleBotanicalAiChat() {
      if (isAiChatOpen) {
        closeBotanicalAiChat();
      } else {
        openBotanicalAiChat();
      }
    }

    function openBotanicalAiChat() {
      const drawer = document.getElementById('botanicalAiDrawer');
      const backdrop = document.getElementById('botanicalAiBackdrop');
      if (drawer) drawer.classList.add('open');
      if (backdrop && window.innerWidth <= 640) backdrop.classList.add('open');
      isAiChatOpen = true;
      dismissAiCoachMark();
      const input = document.getElementById('aiChatInput');
      if (input) setTimeout(() => input.focus(), 150);
    }

    function closeBotanicalAiChat() {
      const drawer = document.getElementById('botanicalAiDrawer');
      const backdrop = document.getElementById('botanicalAiBackdrop');
      if (drawer) drawer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
      isAiChatOpen = false;
    }

    function dismissAiCoachMark(e) {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      const tooltip = document.getElementById('aiOnboardingTooltip');
      if (tooltip) tooltip.style.display = 'none';
      try {
        localStorage.setItem('conflora_coachmark_ai_seen', 'true');
      } catch (_) {}
    }

    function checkAiCoachMark() {
      try {
        const seen = localStorage.getItem('conflora_coachmark_ai_seen');
        if (!seen) {
          setTimeout(() => {
            const tooltip = document.getElementById('aiOnboardingTooltip');
            if (tooltip) tooltip.style.display = 'block';
          }, 1500);
        }
      } catch (_) {}
    }

    function handleAiQuickChip(topicText) {
      const input = document.getElementById('aiChatInput');
      if (input) input.value = topicText;
      sendAiChatMessage();
    }

    async function sendAiChatMessage() {
      const input = document.getElementById('aiChatInput');
      const messagesBox = document.getElementById('aiChatMessages');
      if (!input || !messagesBox) return;

      const query = input.value.trim();
      if (!query) return;

      // Adiciona balão do usuário
      const userDiv = document.createElement('div');
      userDiv.className = 'ai-msg user';
      userDiv.innerHTML = '<div class="ai-bubble">' + escapeHtml(query) + '</div>';
      messagesBox.appendChild(userDiv);
      input.value = '';
      messagesBox.scrollTop = messagesBox.scrollHeight;

      // Indicador de digitação
      const typingDiv = document.createElement('div');
      typingDiv.className = 'ai-msg bot';
      typingDiv.id = 'aiTypingIndicator';
      typingDiv.innerHTML = '<div class="ai-bubble" style="color:#64748b; font-style:italic;">🌿 Conflora AI consultando o catálogo do viveiro...</div>';
      messagesBox.appendChild(typingDiv);
      messagesBox.scrollTop = messagesBox.scrollHeight;

      try {
        const res = await fetch('/api/ai/botanical-consultant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query }),
        });

        const data = await res.json();
        if (typingDiv.parentNode) typingDiv.parentNode.removeChild(typingDiv);

        const botDiv = document.createElement('div');
        botDiv.className = 'ai-msg bot';

        let recommendationsHtml = '';
        if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
          recommendationsHtml = '<div class="ai-recommendations-grid">' + data.recommendations.map(function(p) {
            return '<div class="ai-product-mini-card" data-prod-id="' + p.id + '">' +
              '<img src="' + p.imageUrl + '" alt="' + escapeHtml(p.name) + '" class="ai-mini-card-img" loading="lazy" decoding="async" />' +
              '<div class="ai-mini-card-info">' +
                '<span class="ai-mini-card-tag">' + escapeHtml(p.category) + '</span>' +
                '<div class="ai-mini-card-name">' + escapeHtml(p.name) + '</div>' +
                '<div class="ai-mini-card-price">' + p.formattedPrice + '</div>' +
              '</div>' +
              '<button type="button" class="ai-mini-add-btn" data-add-id="' + p.id + '" onclick="addFromAiChat(this.dataset.addId, event)">' +
                '+ Sacola' +
              '</button>' +
            '</div>';
          }).join('') + '</div>';
        }

        let formattedReply = (data.reply || 'Aqui estão algumas opções especiais do nosso viveiro!');
        const nl = String.fromCharCode(10);
        formattedReply = formattedReply
          .split(nl + nl).join('<br><br>')
          .split(nl).join('<br>');
        while (formattedReply.indexOf('**') !== -1) {
          const firstIdx = formattedReply.indexOf('**');
          const nextIdx = formattedReply.indexOf('**', firstIdx + 2);
          if (nextIdx === -1) break;
          formattedReply = formattedReply.substring(0, firstIdx) + '<strong>' + formattedReply.substring(firstIdx + 2, nextIdx) + '</strong>' + formattedReply.substring(nextIdx + 2);
        }

        botDiv.innerHTML = '<div class="ai-bubble">' + formattedReply + recommendationsHtml + '</div>';
        messagesBox.appendChild(botDiv);
        messagesBox.scrollTop = messagesBox.scrollHeight;
      } catch (err) {
        if (typingDiv.parentNode) typingDiv.parentNode.removeChild(typingDiv);

        // Fallback no catálogo local do cliente
        const cached = typeof CatalogRepository !== 'undefined' ? CatalogRepository.getCachedProducts() : (Array.isArray(rawProducts) ? rawProducts : []);
        const fallbackProducts = cached.filter(function(p) {
          const text = ((p.descricao || p.name || '') + ' ' + (p.subcategoria || p.subcategory || '')).toLowerCase();
          return query.toLowerCase().split(' ').some(function(token) { return token.trim().length > 2 && text.includes(token.trim()); });
        }).slice(0, 3);

        const botDiv = document.createElement('div');
        botDiv.className = 'ai-msg bot';
        let recommendationsHtml = '';
        if (fallbackProducts.length > 0) {
          recommendationsHtml = '<div class="ai-recommendations-grid">' + fallbackProducts.map(function(p) {
            const price = Number(p.valor_num || p.price || 0);
            const img = (p.images && p.images[0]) || p.imageUrl || p.imageurl || 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=800';
            return '<div class="ai-product-mini-card" data-prod-id="' + p.id + '">' +
              '<img src="' + img + '" alt="' + escapeHtml(p.descricao || p.name) + '" class="ai-mini-card-img" loading="lazy" decoding="async" />' +
              '<div class="ai-mini-card-info">' +
                '<span class="ai-mini-card-tag">' + escapeHtml(p.subcategoria || p.categoria || 'Plantas') + '</span>' +
                '<div class="ai-mini-card-name">' + escapeHtml(p.descricao || p.name) + '</div>' +
                '<div class="ai-mini-card-price">R$ ' + price.toFixed(2).replace('.', ',') + '</div>' +
              '</div>' +
              '<button type="button" class="ai-mini-add-btn" data-add-id="' + p.id + '" onclick="addFromAiChat(this.dataset.addId, event)">' +
                '+ Sacola' +
              '</button>' +
            '</div>';
          }).join('') + '</div>';
        }

        botDiv.innerHTML = '<div class="ai-bubble">🌿 Encontrei estas opções no viveiro Conflora que atendem ao que você procura:' + recommendationsHtml + '</div>';
        messagesBox.appendChild(botDiv);
        messagesBox.scrollTop = messagesBox.scrollHeight;
      }
    }

    function addFromAiChat(productId, event) {
      if (event) event.stopPropagation();
      cartStore.addItem(productId, 1);
      const targetBtn = event ? event.currentTarget : null;
      if (targetBtn) {
        const originalText = targetBtn.innerHTML;
        targetBtn.classList.add('added');
        targetBtn.innerHTML = '✓ Adicionado!';
        setTimeout(function() {
          targetBtn.classList.remove('added');
          targetBtn.innerHTML = originalText;
        }, 1400);
      }
    }

    window.addFromAiChat = addFromAiChat;
    window.toggleBotanicalAiChat = toggleBotanicalAiChat;
    window.openBotanicalAiChat = openBotanicalAiChat;
    window.closeBotanicalAiChat = closeBotanicalAiChat;
    window.sendAiChatMessage = sendAiChatMessage;
    window.handleAiQuickChip = handleAiQuickChip;
    window.dismissAiCoachMark = dismissAiCoachMark;

    window.addEventListener('scroll', () => {
      const fabs = document.getElementById('fabsGroup');
      if (fabs) {
        if (window.scrollY > 150) {
          fabs.classList.add('visible');
        } else {
          fabs.classList.remove('visible');
        }
      }
    }, { passive: true });

    // --- AUTENTICAÇÃO E PAINEL DO CLIENTE ---
    async function initCurrentUser() {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        currentUser = data.user;
        if (currentUser) applyUserUI(currentUser);
      } catch (_) { currentUser = null; }
    }

    function applyUserUI(user) {
      if (!user) return;
      const authBtn = document.getElementById('authOpenBtn');
      const pill = document.getElementById('userHeaderPill');
      const pic = document.getElementById('userHeaderPic');
      const name = document.getElementById('userHeaderName');
      const badge = document.getElementById('userHeaderBadge');
      const adminStatusBtn = document.getElementById('adminStatusBtn');

      if (authBtn) authBtn.style.display = 'none';
      if (pill) pill.style.display = 'inline-flex';
      if (pic) pic.src = user.picture || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || user.email) + '&background=15803d&color=fff');
      if (name) name.textContent = (user.name || user.email || 'Usuário').split(' ')[0];
      if (badge) {
        badge.textContent = user.role || 'CLIENTE';
        badge.style.background = user.role === 'ADMIN' ? '#15803d' : '#0284c7';
      }
      if (adminStatusBtn) {
        adminStatusBtn.style.display = user.role === 'ADMIN' ? 'inline-flex' : 'none';
      }

      const custName = document.getElementById('custName');
      const custPhone = document.getElementById('custPhone');
      const custAddress = document.getElementById('custAddress');
      if (custName && !custName.value && user.name) custName.value = user.name;
      if (custPhone && !custPhone.value && user.phone) custPhone.value = user.phone;
      if (custAddress && !custAddress.value && user.address) custAddress.value = user.address;
    }

    function openAuthModal() {
      const modal = document.getElementById('authModal');
      if (modal) modal.classList.add('open');
    }
    function closeAuthModal() {
      const modal = document.getElementById('authModal');
      if (modal) modal.classList.remove('open');
    }
    const openGoogleLoginModal = openAuthModal;
    const closeGoogleLoginModal = closeAuthModal;

    async function submitGoogleLogin() {
      const button = document.getElementById('googleLoginButton');
      if (button.disabled) return;
      button.disabled = true;
      try {
        const data = await window.authenticateGoogle();
        if (data.success && data.user) {
          currentUser = data.user;
          applyUserUI(currentUser);
          closeAuthModal();
        } else {
          alert('Erro ao autenticar: ' + (data.error || 'Tente novamente'));
        }
      } catch (err) {
        alert('Erro ao conectar com servidor de login: ' + err.message);
      } finally {
        button.disabled = false;
      }
    }

    async function logoutCurrentUser() {
      if (confirm('Deseja realmente sair da sua conta?')) {
        if (window.signOutGoogle) {
          try { await window.signOutGoogle(); } catch (_) {}
        }
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        const authBtn = document.getElementById('authOpenBtn');
        const pill = document.getElementById('userHeaderPill');
        const adminStatusBtn = document.getElementById('adminStatusBtn');
        if (authBtn) authBtn.style.display = 'inline-flex';
        if (pill) pill.style.display = 'none';
        if (adminStatusBtn) adminStatusBtn.style.display = 'none';
        closeCustomerPortalModal();
      }
    }
    const logoutGoogle = logoutCurrentUser;

    function handleAdminPanelClick() {
      if (currentUser && currentUser.role === 'ADMIN') {
        window.location.href = '/admin';
      } else if (!currentUser) {
        alert('Para acessar a página de configurações, faça login com uma conta Google de administrador.');
        openAuthModal();
      } else {
        alert('Acesso restrito a administradores.');
      }
    }

    function openCustomerPortalModal() {
      if (!currentUser) { openAuthModal(); return; }
      const modal = document.getElementById('customerPortalModal');
      if (modal) modal.classList.add('open');
      loadCustomerData();
    }
    function closeCustomerPortalModal() {
      const modal = document.getElementById('customerPortalModal');
      if (modal) modal.classList.remove('open');
    }

    async function loadCustomerData() {
      if (!currentUser) return;
      try {
        const res = await fetch('/api/customer/orders?userId=' + encodeURIComponent(currentUser.id || ''));
        const data = await res.json();
        const container = document.getElementById('customerOrdersList');
        if (data.success && Array.isArray(data.orders)) {
          if (data.orders.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:20px; color:#64748b;">Nenhum pedido realizado ainda.</div>';
          } else {
            container.innerHTML = data.orders.map(o => \`
              <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; font-weight:bold;">
                  <span>Pedido #\${o.id}</span>
                  <span style="color:#15803d;">\${localization.formatCurrency(Number(o.total || 0))}</span>
                </div>
                <div style="font-size:12px; color:#64748b;">\${new Date(o.createdAt || Date.now()).toLocaleString('pt-BR')} • \${o.status || 'PENDING'}</div>
              </div>
            \`).join('');
          }
        }
      } catch (_) {}
    }

    // --- STATUS MODAL (ADMIN) ---
    function openStatusModal() {
      const modal = document.getElementById('statusModal');
      if (modal) modal.classList.add('open');
      refreshStatusDashboard();
    }
    function closeStatusModal() {
      const modal = document.getElementById('statusModal');
      if (modal) modal.classList.remove('open');
    }
    async function refreshStatusDashboard() {
      const body = document.getElementById('statusDashboardBody');
      if (!body) return;
      try {
        const res = await fetch('/api/admin/system-status');
        const data = await res.json();
        body.innerHTML = \`
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px;">
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px;">
              <strong>📊 Google Sheets API:</strong> \${data.googleSheets?.status || 'ONLINE'}<br>
              <span style="font-size:11px; color:#64748b;">\${data.googleSheets?.itemsActive || 0} produtos ativos</span>
            </div>
            <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:12px;">
              <strong>💬 WhatsApp Webhook:</strong> \${data.whatsapp?.status || 'ONLINE'}<br>
              <span style="font-size:11px; color:#64748b;">Rota /webhook ativa</span>
            </div>
          </div>
        \`;
      } catch (e) {
        body.innerHTML = '<div style="color:red;">Erro ao obter status: ' + e.message + '</div>';
      }
    }

    // Inicialização da Arquitetura Limpa
    localization.applyDomTranslations();
    updateLanguageButtons(localization.currentLocale);
    initCurrentUser();
    loadSavedCustomerData();
    loadCatalog();
    checkAiCoachMark();
  </script>
${renderFirebaseAuthScript()}
</body>
</html>`;
}

module.exports = {
  renderHomeHtml,
};
