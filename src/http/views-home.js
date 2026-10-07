const { GOOGLE_ANALYTICS_TAG } = require('./analytics');
const { DEFAULT_CATALOG_ITEMS } = require('../catalog/default-catalog');

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
  return items.slice(0, 36).map(p => {
    const price = Number(p.valor_num || p.price || 0);
    const byKg = (p.unit || p.unidade || '').toUpperCase() === 'KG' || /\bkg\b/i.test(p.descricao || p.name || '');
    const img = (p.images && p.images[0]) || p.imageUrl || p.imageurl || 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=800';
    return `
      <div class="prod-card">
        <div class="card-img-wrapper" onclick="openGallery('${p.id}')">
          <img class="prod-img" src="${img}" alt="${p.descricao || p.name}" loading="lazy" />
          ${byKg ? '<span class="unit-tag-badge">⚖️ POR KG</span>' : ''}
        </div>
        <div class="card-body">
          <span class="card-category">${p.subcategoria || p.subcategory || p.categoria || p.category || 'Conflora'}</span>
          <div class="card-title" onclick="openGallery('${p.id}')">${p.descricao || p.name}</div>
          <div class="card-footer">
            <div>
              <div class="card-price">R$ ${price.toFixed(2).replace('.', ',')} <span style="font-size:11px; font-weight:normal; color:#64748b;">${byKg ? '/kg' : ''}</span></div>
              <span class="card-stock">${p.stockQuantity ?? p.estoque ?? 30} ${byKg ? 'kg' : 'un.'} disponível</span>
            </div>
            <button class="add-btn" onclick="handleProductAddClick('${p.id}')" title="Adicionar à Sacola">
              ${byKg ? '⚖️ +' : '+'}
            </button>
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
  <meta http-equiv="Pragma" content="no-cache" />
  <meta http-equiv="Expires" content="0" />
  <title>Conflora Horta e Viveiro — Cardápio Digital & Pedidos</title>
  ${GOOGLE_ANALYTICS_TAG}
  ${FETCH_SHIM_SCRIPT}
  <script src="https://accounts.google.com/gsi/client" async defer></script>

  <!-- Fontes Canva: Títulos com estética Intro Rust & Secundárias com Now -->
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
      src: local('Now'), local('Plus Jakarta Sans'), local('Inter'), local('system-ui');
      font-weight: 400 500;
    }

    :root {
      /* Paleta Oficial Conflora Horta & Viveiro */
      --primary: #15803d;        /* Verde Floresta Conflora */
      --primary-dark: #14532d;   /* Verde Musgo Profundo */
      --primary-light: #dcfce7;  /* Broto Claro */
      --accent: #22c55e;         /* Folha Viva */
      --earth: #78350f;          /* Tom Amadeirado Terra */
      --sand: #fef3c7;           /* Areia Quente */
      --gold: #d97706;           /* Ouro do Cerrado */
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --wa-color: #25d366;

      /* Tipografia do Canva */
      --font-title: 'Intro Rust', 'Montserrat', -apple-system, sans-serif;
      --font-body: 'Now', 'Plus Jakarta Sans', -apple-system, sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-body);
      font-weight: 400;
      background: #f1f5f9;
      color: var(--text);
      line-height: 1.5;
    }

    h1, h2, h3, .brand-title h1, .panel-title, .modal-header h3, .cat-title-rust {
      font-family: var(--font-title);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      font-weight: 900;
    }

    .top-toolbar {
      background: #0f172a;
      color: white;
      padding: 8px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      position: sticky;
      top: 0;
      z-index: 50;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .device-switcher {
      display: flex;
      gap: 6px;
      background: #1e293b;
      padding: 3px;
      border-radius: 8px;
    }
    .device-btn {
      background: none;
      border: none;
      color: #94a3b8;
      padding: 5px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .device-btn.active {
      background: var(--primary);
      color: white;
    }
    .admin-link-btn {
      color: #86efac;
      text-decoration: none;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 12px;
      border-radius: 6px;
      background: rgba(255,255,255,0.1);
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

    .status-diag-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }
    .status-diag-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px;
    }
    .status-diag-card.online { border-left: 4px solid #10b981; }
    .status-diag-card.warning { border-left: 4px solid #f59e0b; }
    .status-diag-card.info { border-left: 4px solid #3b82f6; }

    .viewport-container {
      width: 100%;
      min-height: calc(100vh - 42px);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 16px;
      transition: all 0.3s;
    }
    .viewport-container.mobile-mode { padding: 24px 16px; }
    .phone-frame {
      width: 100%;
      max-width: 1400px;
      background: var(--bg);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0,0,0,0.06);
      display: flex;
      flex-direction: column;
      transition: all 0.3s;
    }
    .mobile-mode .phone-frame {
      max-width: 440px;
      min-height: 850px;
      border-radius: 36px;
      border: 10px solid #1e293b;
      box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
    }

    .brand-header {
      background: #14532d;
      background-image: linear-gradient(135deg, #14532d 0%, #166534 60%, #1b4332 100%);
      color: white;
      padding: 18px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 3px solid #22c55e;
    }
    .brand-title {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .conflora-logo-badge {
      width: 46px;
      height: 46px;
      background: #ffffff;
      color: #14532d;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.15);
      border: 2px solid #86efac;
    }
    .brand-title h1 {
      font-size: 20px;
      letter-spacing: 0.5px;
      margin: 0;
      color: #ffffff;
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

    .app-main {
      display: grid;
      grid-template-columns: 1fr 400px;
      gap: 20px;
      padding: 20px;
    }
    .mobile-mode .app-main, @media (max-width: 960px) {
      .app-main { grid-template-columns: 1fr; }
    }

    .categories-bar {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 10px;
      margin-bottom: 14px;
      scrollbar-width: none;
    }
    .categories-bar::-webkit-scrollbar { display: none; }
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
      transition: all 0.2s;
      box-shadow: 0 1px 2px rgba(0,0,0,0.03);
    }
    .cat-btn:hover { border-color: var(--primary); }
    .cat-btn.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary);
      font-weight: 700;
    }

    .subcategories-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 16px;
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

    .catalog-toolbar {
      display: flex;
      gap: 10px;
      margin-bottom: 18px;
    }
    .search-input {
      flex: 1;
      padding: 10px 14px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 14px;
      background: #ffffff;
      outline: none;
    }
    .search-input:focus { border-color: var(--primary); }
    .sort-select {
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font-size: 13px;
      background: #ffffff;
      outline: none;
      color: var(--text);
      cursor: pointer;
    }

    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 14px;
    }
    .mobile-mode .products-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
    }
    .prod-card {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.15s, box-shadow 0.15s;
      position: relative;
    }
    .prod-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px -2px rgba(0,0,0,0.08);
      border-color: #cbd5e1;
    }
    .card-img-wrapper {
      position: relative;
      width: 100%;
      height: 145px;
      background: #f1f5f9;
      cursor: pointer;
    }
    .prod-img { width: 100%; height: 100%; object-fit: cover; }
    .photo-count-badge {
      position: absolute;
      bottom: 6px;
      right: 6px;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(4px);
      color: white;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 10px;
    }
    .unit-tag-badge {
      position: absolute;
      top: 6px;
      left: 6px;
      background: #d97706;
      color: white;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 6px;
      letter-spacing: 0.5px;
    }
    .card-body {
      padding: 12px;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .card-category {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--primary);
      margin-bottom: 3px;
    }
    .card-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text);
      line-height: 1.3;
      margin-bottom: 6px;
      cursor: pointer;
    }
    .card-footer {
      margin-top: auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
    }
    .card-price {
      font-size: 15px;
      font-weight: 800;
      color: var(--primary-dark);
    }
    .card-stock {
      font-size: 11px;
      color: var(--text-muted);
      display: block;
    }
    .add-btn {
      background: var(--primary);
      color: white;
      border: none;
      min-width: 32px;
      height: 32px;
      padding: 0 8px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: background 0.15s;
    }
    .add-btn:hover { background: var(--primary-dark); }

    /* PAINEL DA SACOLA / CARRINHO */
    .cart-checkout-panel {
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      align-self: flex-start;
      position: sticky;
      top: 60px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .panel-title {
      font-size: 16px;
      color: var(--text);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--border);
    }

    /* BOTÃO NO CARRINHO PARA ESVAZIAR CARRINHO */
    .clear-cart-btn {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fca5a5;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s ease;
      font-family: var(--font-body);
    }
    .clear-cart-btn:hover {
      background: #fecaca;
      color: #7f1d1d;
      transform: scale(1.02);
    }
    .clear-cart-text-btn {
      background: none;
      border: none;
      color: #dc2626;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
    }

    .cart-items-list {
      max-height: 260px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cart-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      padding: 8px 0;
      border-bottom: 1px dashed #e2e8f0;
    }
    .cart-item-title {
      flex: 1;
      font-weight: 600;
      padding-right: 8px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .cart-item-unit-label {
      display: inline-block;
      font-size: 11px;
      color: #d97706;
      font-weight: 700;
      margin-left: 4px;
    }
    .cart-qty-ctrl {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 6px;
    }
    .qty-btn {
      background: none;
      border: none;
      font-weight: bold;
      cursor: pointer;
      font-size: 14px;
      width: 18px;
    }
    .cart-total-box {
      background: #f8fafc;
      border-radius: 8px;
      padding: 10px 14px;
      display: flex;
      justify-content: space-between;
      font-size: 15px;
      font-weight: 800;
      color: var(--text);
    }
    .form-group {
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
      border-radius: 6px;
      font-size: 13px;
      outline: none;
      font-family: var(--font-body);
    }
    .form-input:focus { border-color: var(--primary); }
    .type-switcher, .pay-switcher { display: flex; gap: 6px; }
    .type-option-btn, .pay-btn {
      flex: 1;
      padding: 8px 6px;
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 6px;
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
      font-weight: 700;
    }
    .pix-box {
      background: #f0fdf4;
      border: 1px dashed #86efac;
      padding: 10px;
      border-radius: 8px;
      font-size: 12px;
      display: block;
    }
    .pix-key-val {
      font-family: monospace;
      font-size: 13px;
      font-weight: bold;
      color: #166534;
      word-break: break-all;
      background: #ffffff;
      padding: 6px;
      border-radius: 4px;
      margin: 6px 0;
      border: 1px solid #bbf7d0;
    }
    .copy-pix-btn {
      background: #15803d;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
    }
    .checkout-submit-btn {
      background: #15803d;
      color: white;
      border: none;
      padding: 13px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
      width: 100%;
      box-shadow: 0 4px 6px -1px rgba(21, 128, 61, 0.3);
      transition: background 0.15s;
      font-family: var(--font-title);
      letter-spacing: 0.5px;
    }
    .checkout-submit-btn:hover { background: #166534; }

    /* MODAL DE FOTOS */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(2px);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 100;
      padding: 16px;
    }
    .modal-overlay.open { display: flex; }
    .modal-box {
      background: white;
      border-radius: 14px;
      max-width: 550px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);
    }
    .modal-header {
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }
    .modal-body { padding: 18px; }
    .gallery-main-img {
      width: 100%;
      height: 280px;
      object-fit: cover;
      border-radius: 8px;
      background: #f1f5f9;
    }
    .thumbnails-row {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      overflow-x: auto;
      padding-bottom: 4px;
    }
    .thumb-btn {
      width: 60px;
      height: 60px;
      border-radius: 6px;
      overflow: hidden;
      border: 2px solid transparent;
      cursor: pointer;
      flex-shrink: 0;
    }
    .thumb-btn.active { border-color: var(--primary); }
    .thumb-btn img { width: 100%; height: 100%; object-fit: cover; }

    /* MODAL DE SELEÇÃO POR KG COM 3 CASAS DECIMAIS */
    .kg-modal-box {
      background: white;
      border-radius: 14px;
      max-width: 440px;
      width: 100%;
      padding: 22px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.25);
    }
    .kg-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 14px 0;
    }
    .kg-preset-btn {
      background: #f0fdf4;
      border: 1px solid #86efac;
      color: #166534;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s;
    }
    .kg-preset-btn:hover {
      background: #dcfce7;
      transform: scale(1.03);
    }
  </style>
</head>
<body>
  <div class="top-toolbar">
    <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
      <span style="font-weight:700;">Conflora AI</span>
      <div class="device-switcher">
        <button class="device-btn active" id="btnDesk" onclick="setDevice('desktop')">🖥️ Computador</button>
        <button class="device-btn" id="btnMob" onclick="setDevice('mobile')">📱 Celular</button>
      </div>
    </div>

    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
      <!-- SEÇÃO GOOGLE LOGIN / USUÁRIO -->
      <button id="googleLoginBtn" class="google-auth-btn" onclick="openGoogleLoginModal()">
        <svg style="width:14px; height:14px;" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
        Entrar com Google
      </button>

      <div id="googleUserPill" style="display:none; align-items:center; gap:6px; background:#1e293b; padding:4px 10px; border-radius:20px; font-size:12px; color:white;">
        <img id="googleUserPic" style="width:20px; height:20px; border-radius:50%; object-fit:cover;" src="" />
        <span id="googleUserName" style="font-weight:600;"></span>
        <span id="googleUserBadge" style="background:#15803d; color:white; font-size:10px; padding:1px 6px; border-radius:8px; font-weight:700;">ADMIN</span>
        <button onclick="logoutGoogle()" style="background:transparent; border:none; color:#94a3b8; cursor:pointer; font-size:11px; margin-left:4px;" title="Sair da conta">✕</button>
      </div>

      <!-- BOTÃO STATUS DE DIAGNÓSTICO (VISÍVEL SOMENTE PARA ADMIN) -->
      <button id="adminStatusBtn" class="status-pill-btn" onclick="openStatusModal()" style="display:none;">
        📡 Status das Conexões
      </button>

      <!-- LINK DO PAINEL ADMIN (LIBERADO APENAS COM LOGIN ADMIN) -->
      <button id="adminPanelLinkBtn" class="admin-link-btn" onclick="handleAdminPanelClick()">
        ⚙️ Configurações & Painel ➔
      </button>
    </div>
  </div>

  <div class="viewport-container" id="viewportContainer">
    <div class="phone-frame">
      <header class="brand-header">
        <div class="brand-title">
          <div class="conflora-logo-badge">🌿</div>
          <div>
            <h1>Conflora Horta e Viveiro</h1>
            <p>Cardápio Digital & Pedidos Diretos • Mineiros - GO</p>
          </div>
        </div>
        <button class="cart-pill-btn" onclick="scrollToCart()">
          🛒 <span id="cartCountHeader">0 itens</span>
        </button>
      </header>

      <main class="app-main">
        <section>
          <div class="categories-bar" id="categoriesBar">
            <button class="cat-btn active" onclick="selectCategory('TODAS')">🌿 Todas</button>
          </div>

          <div class="subcategories-bar" id="subcategoriesBar"></div>

          <div class="catalog-toolbar">
            <input type="text" id="searchInput" class="search-input" placeholder="Buscar produto (ex: alface, rabo de raposa, jabuticaba, eucalipto, adubo...)" oninput="filterProducts()" />
            <select id="sortSelect" class="sort-select" onchange="filterProducts()">
              <option value="mais_vendidos">🔥 Mais Vendidos</option>
              <option value="preco_asc">💰 Menor Preço</option>
              <option value="preco_desc">💎 Maior Preço</option>
              <option value="nome">🔤 Nome A-Z</option>
            </select>
          </div>

          <div class="products-grid" id="productsGrid">
            ${renderInitialProductCards(DEFAULT_CATALOG_ITEMS)}
          </div>
        </section>

        <aside class="cart-checkout-panel" id="cartPanel">
          <div class="panel-title">
            <div style="display:flex; align-items:center; gap:8px;">
              <span>🛒 Sua Sacola</span>
              <span id="cartItemCounter" style="font-size:12px; color:var(--text-muted); font-weight:600;">0 itens</span>
            </div>
            <!-- BOTÃO NO CARRINHO PARA ESVAZIAR CARRINHO -->
            <button id="clearCartBtn" class="clear-cart-btn" onclick="clearCart()" title="Esvaziar todos os itens da sacola" style="display:none;">
              🗑️ Esvaziar
            </button>
          </div>

          <div class="cart-items-list" id="cartItemsList">
            <div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">
              Sua sacola está vazia.<br>Clique em <strong>+</strong> nos produtos para adicionar.
            </div>
          </div>

          <!-- Link secundário para esvaziar carrinho -->
          <div id="clearCartRow" style="display:none; text-align:right; padding-top:4px;">
            <button type="button" class="clear-cart-text-btn" onclick="clearCart()">🗑️ Esvaziar carrinho</button>
          </div>

          <div class="cart-total-box">
            <span>Total:</span>
            <span id="cartTotalText">R$ 0,00</span>
          </div>

          <!-- AVISO DE DADOS PRÉ-PREENCHIDOS DA ÚLTIMA COMPRA -->
          <div id="savedDataNotice" style="display:none; font-size:11px; background:#dcfce7; color:#166534; padding:8px 10px; border-radius:6px; border:1px solid #86efac;">
            ✨ Dados pré-preenchidos da sua última compra. Você pode editá-los a qualquer momento!
          </div>

          <div class="form-group">
            <label class="form-label">Seu Nome:</label>
            <input type="text" id="custName" class="form-input" placeholder="Ex: Edmar Júnio" oninput="saveCustomerDataToStorage()" />
          </div>

          <div class="form-group">
            <label class="form-label">WhatsApp com DDD:</label>
            <input type="text" id="custPhone" class="form-input" placeholder="Ex: 5564999351616" oninput="saveCustomerDataToStorage()" />
          </div>

          <div class="form-group">
            <label class="form-label">Como deseja receber?</label>
            <div class="type-switcher">
              <button type="button" class="type-option-btn selected" id="typeDeliveryBtn" onclick="setOrderType('DELIVERY')">🛵 Entrega</button>
              <button type="button" class="type-option-btn" id="typePickupBtn" onclick="setOrderType('PICKUP')">🏬 Retirada no Viveiro</button>
            </div>
          </div>

          <div class="form-group" id="addressGroup">
            <label class="form-label">Endereço de Entrega em Mineiros - GO:</label>
            <input type="text" id="custAddress" class="form-input" placeholder="Rua, Número, Bairro e Ponto de Referência" oninput="saveCustomerDataToStorage()" />
          </div>

          <div class="form-group">
            <label class="form-label">Forma de Pagamento:</label>
            <div class="pay-switcher">
              <button type="button" class="pay-btn selected" id="payPixBtn" onclick="setPayment('PIX')">PIX</button>
              <button type="button" class="pay-btn" id="payCardBtn" onclick="setPayment('CARTAO')">Cartão</button>
              <button type="button" class="pay-btn" id="payCashBtn" onclick="setPayment('DINHEIRO')">Dinheiro</button>
            </div>
          </div>

          <div class="pix-box" id="pixBox">
            <div style="font-weight: 700; color: #166534;">🔑 Pagamento via PIX</div>
            <div style="margin: 4px 0;">Chave Oficial da Conflora:</div>
            <div class="pix-key-val" id="pixKeyDisplay">64999351616</div>
            <button type="button" class="copy-pix-btn" onclick="copyPix()">📋 Copiar Chave PIX</button>
          </div>

          <button id="submitOrderBtn" class="checkout-submit-btn" onclick="submitOrder()">
            ✅ Finalizar Pedido
          </button>
        </aside>
      </main>
    </div>
  </div>

  <!-- MODAL DE GALERIA DE FOTOS -->
  <div class="modal-overlay" id="galleryModal">
    <div class="modal-box">
      <div class="modal-header">
        <h3 id="modalProdTitle" style="font-size: 16px; color: var(--text);">Fotos do Produto</h3>
        <button style="border:none; background:none; font-size:22px; cursor:pointer;" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <img id="modalMainImg" class="gallery-main-img" src="" alt="Produto" />
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

  <!-- MODAL SELEÇÃO DE PESO (PRODUTOS VENDIDOS POR KG COM 3 CASAS DECIMAIS) -->
  <div class="modal-overlay" id="kgModal">
    <div class="kg-modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <h3 id="kgModalTitle" style="font-size:16px; color:#14532d;">⚖️ Selecionar Peso (KG)</h3>
        <button style="border:none; background:none; font-size:22px; cursor:pointer;" onclick="closeKgModal()">×</button>
      </div>
      <p id="kgModalDesc" style="font-size:13px; color:#64748b; margin-bottom:12px;">Informe a quantidade exata de quilogramas que deseja (até 3 casas decimais):</p>
      
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

      <div style="font-size:12px; font-weight:700; color:#334155;">Atalhos rápidos de peso:</div>
      <div class="kg-presets">
        <button type="button" class="kg-preset-btn" onclick="setKgPreset(0.250)">+ 0,250 kg</button>
        <button type="button" class="kg-preset-btn" onclick="setKgPreset(0.500)">+ 0,500 kg</button>
        <button type="button" class="kg-preset-btn" onclick="setKgPreset(1.000)">1,000 kg</button>
        <button type="button" class="kg-preset-btn" onclick="setKgPreset(2.000)">2,000 kg</button>
        <button type="button" class="kg-preset-btn" onclick="setKgPreset(5.000)">5,000 kg</button>
      </div>

      <div style="background:#f0fdf4; border:1px solid #86efac; padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <span style="font-size:13px; font-weight:700;">Subtotal Calculado:</span>
        <strong id="kgSubtotalDisplay" style="font-size:18px; color:#15803d;">R$ 0,00</strong>
      </div>

      <div style="display:flex; gap:8px;">
        <button type="button" class="action-btn" style="flex:1; padding:10px; border:1px solid #cbd5e1; background:#f8fafc; border-radius:8px; cursor:pointer;" onclick="closeKgModal()">Cancelar</button>
        <button type="button" id="confirmKgBtn" class="checkout-submit-btn" style="flex:2; padding:10px;" onclick="confirmKgAddToCart()">Adicionar à Sacola</button>
      </div>
    </div>
  </div>

  <!-- MODAL: LOGIN COM GOOGLE -->
  <div class="modal-overlay" id="googleLoginModal">
    <div class="modal-box" style="max-width:420px; text-align:center; padding:28px 24px;">
      <div style="font-size:36px; margin-bottom:8px;">🌿</div>
      <h3 style="font-size:20px; font-weight:800; color:#0f172a; margin-bottom:8px;">Identificação com Google</h3>
      <p style="font-size:13px; color:#64748b; line-height:1.5; margin-bottom:20px;">
        Os clientes <strong>não precisam fazer login</strong> para comprar no viveiro! O login com Google é opcional e serve para identificar administradores e liberar a página de configurações.
      </p>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px; margin-bottom:18px;">
        <label style="display:block; font-size:12px; font-weight:bold; color:#475569; margin-bottom:6px; text-align:left;">E-mail do Google (Gmail ou Workspace):</label>
        <input type="email" id="googleEmailInput" placeholder="ex: edmarjuniob@gmail.com" value="edmarjuniob@gmail.com" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; margin-bottom:10px;" />
        <label style="display:block; font-size:12px; font-weight:bold; color:#475569; margin-bottom:6px; text-align:left;">Seu Nome:</label>
        <input type="text" id="googleNameInput" placeholder="Edmar Júnio" value="Edmar Júnio" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:14px; margin-bottom:14px;" />

        <button type="button" class="checkout-submit-btn" onclick="submitGoogleLogin()" style="display:flex; align-items:center; justify-content:center; gap:8px;">
          <svg style="width:18px; height:18px;" viewBox="0 0 24 24"><path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Confirmar e Entrar
        </button>
      </div>

      <div style="margin-top:14px;">
        <button type="button" class="action-btn" onclick="closeGoogleLoginModal()" style="background:#f1f5f9; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; color:#475569; font-weight:600;">Fechar</button>
      </div>
    </div>
  </div>

  <!-- MODAL: STATUS DE CONEXÃO & DIAGNÓSTICO (EXCLUSIVO ADMIN) -->
  <div class="modal-overlay" id="statusModal">
    <div class="modal-box" style="max-width:680px; padding:24px;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #e2e8f0; padding-bottom:12px; margin-bottom:16px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:22px;">📡</span>
          <div>
            <h3 style="font-size:17px; font-weight:800; color:#0f172a; margin:0;">Status das Conexões & Diagnóstico</h3>
            <span style="font-size:12px; color:#64748b;">Monitoramento de saúde do Google Sheets API, WhatsApp e Banco de Dados</span>
          </div>
        </div>
        <button onclick="closeStatusModal()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748b;">✕</button>
      </div>

      <div id="statusDashboardBody">
        <div style="text-align:center; padding:30px; color:#64748b;">Carregando métricas de diagnóstico em tempo real...</div>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; border-top:1px solid #e2e8f0; padding-top:14px; flex-wrap:wrap; gap:8px;">
        <button class="action-btn" onclick="refreshStatusDashboard()" style="background:#0f172a; color:white; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:700;">🔄 Atualizar Status</button>
        <button class="action-btn" onclick="closeStatusModal()" style="background:#f1f5f9; border:1px solid #cbd5e1; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:700;">Fechar</button>
      </div>
    </div>
  </div>

  <script>
    // FOTOS REAIS EM ALTA DEFINIÇÃO DE CONTINGÊNCIA POR CATEGORIA
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

    // CATÁLOGO PADRÃO OFICIAL (PLANILHA LISTA DE PRODUTOS)
    const DEFAULT_OFFICIAL_CATALOG = ${JSON.stringify(DEFAULT_CATALOG_ITEMS)};

    let rawProducts = DEFAULT_OFFICIAL_CATALOG;
    let currentCategory = 'TODAS';
    let currentSubcategory = 'TODAS';
    let cart = {};
    let orderType = 'DELIVERY';
    let paymentMethod = 'PIX';
    let pendingKgProduct = null;

    function getProductImage(p) {
      if (p.images && Array.isArray(p.images) && p.images.length > 0 && p.images[0]) {
        return p.images[0];
      }
      if (p.imageUrl || p.imageurl) {
        return p.imageUrl || p.imageurl;
      }
      const cat = p.categoria || p.category || '';
      return REAL_HD_FALLBACKS[cat] || REAL_HD_FALLBACKS['DEFAULT'];
    }

    function isSoldByKg(p) {
      if ((p.unit || p.unidade || '').toUpperCase() === 'KG') return true;
      const n = (p.descricao || p.name || '').toLowerCase();
      if (n.endsWith(' kg') || n.includes(' kg ') || n.includes('/kg') || n.includes('(kg)') || n.includes('por kg') || n.includes(' a granel')) return true;
      return false;
    }

    function setDevice(mode) {
      const c = document.getElementById('viewportContainer');
      const bD = document.getElementById('btnDesk');
      const bM = document.getElementById('btnMob');
      if (mode === 'mobile') {
        c.classList.add('mobile-mode');
        bM.classList.add('active');
        bD.classList.remove('active');
      } else {
        c.classList.remove('mobile-mode');
        bD.classList.add('active');
        bM.classList.remove('active');
      }
    }

    function safeExtractProducts(data) {
      if (!data) return DEFAULT_OFFICIAL_CATALOG;
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object') {
        if (Array.isArray(data.products)) return data.products;
        if (data.products && typeof data.products === 'object') {
          return Object.values(data.products);
        }
      }
      return DEFAULT_OFFICIAL_CATALOG;
    }

    async function loadCatalog() {
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
          const data = await res.json();
          const list = safeExtractProducts(data);
          rawProducts = (Array.isArray(list) && list.length > 0) ? list : DEFAULT_OFFICIAL_CATALOG;
        } else {
          rawProducts = DEFAULT_OFFICIAL_CATALOG;
        }
      } catch (err) {
        console.warn('Usando catálogo padrão oficial da planilha:', err);
        rawProducts = DEFAULT_OFFICIAL_CATALOG;
      }

      if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
        rawProducts = Array.isArray(DEFAULT_OFFICIAL_CATALOG) ? DEFAULT_OFFICIAL_CATALOG : [];
      }

      try {
        renderCategories();
        renderSubcategories();
        filterProducts();
      } catch (e) {
        console.error('Falha ao renderizar catálogo, usando contingência:', e);
        rawProducts = Array.isArray(DEFAULT_OFFICIAL_CATALOG) ? DEFAULT_OFFICIAL_CATALOG : [];
        renderCategories();
        renderSubcategories();
        filterProducts();
      }
    }

    function renderCategories() {
      if (!Array.isArray(rawProducts) || rawProducts.length === 0) {
        rawProducts = Array.isArray(DEFAULT_OFFICIAL_CATALOG) ? DEFAULT_OFFICIAL_CATALOG : [];
      }

      const bar = document.getElementById('categoriesBar');
      bar.innerHTML = '';

      const allBtn = document.createElement('button');
      allBtn.className = 'cat-btn ' + (currentCategory === 'TODAS' ? 'active' : '');
      allBtn.textContent = '🌿 Todas';
      allBtn.onclick = () => selectCategory('TODAS');
      bar.appendChild(allBtn);

      const catsSet = new Set();
      const list = (Array.isArray(rawProducts) && rawProducts.length > 0) ? rawProducts : DEFAULT_OFFICIAL_CATALOG;
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (item) {
          const c = item.categoria || item.category;
          if (c) catsSet.add(c);
        }
      }
      const cats = Array.from(catsSet);

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
      const list = (Array.isArray(rawProducts) && rawProducts.length > 0) ? rawProducts : DEFAULT_OFFICIAL_CATALOG;
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
      allBtn.textContent = 'Todas';
      allBtn.onclick = () => { currentSubcategory = 'TODAS'; renderSubcategories(); filterProducts(); };
      bar.appendChild(allBtn);

      subcats.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'subcat-btn ' + (currentSubcategory === sub ? 'active' : '');
        btn.textContent = sub;
        btn.onclick = () => { currentSubcategory = sub; renderSubcategories(); filterProducts(); };
        bar.appendChild(btn);
      });
    }

    function filterProducts() {
      const searchInput = document.getElementById('searchInput');
      const sortSelect = document.getElementById('sortSelect');
      const q = (searchInput && searchInput.value ? searchInput.value : '').trim().toLowerCase();
      const sort = (sortSelect && sortSelect.value ? sortSelect.value : 'mais_vendidos');

      const prods = (Array.isArray(rawProducts) && rawProducts.length > 0) ? rawProducts : DEFAULT_OFFICIAL_CATALOG;
      const list = [];
      for (let i = 0; i < prods.length; i++) {
        const p = prods[i];
        if (!p) continue;
        const cat = p.categoria || p.category || '';
        const sub = p.subcategoria || p.subcategory || '';
        const name = (p.descricao || p.name || '').toLowerCase();
        const tags = (p.tagsAi || p.tags_ia || '').toLowerCase();

        const matchCat = currentCategory === 'TODAS' || cat === currentCategory;
        const matchSub = currentSubcategory === 'TODAS' || sub === currentSubcategory;
        const matchText = !q || name.includes(q) || cat.toLowerCase().includes(q) || sub.toLowerCase().includes(q) || tags.includes(q);

        if (matchCat && matchSub && matchText) {
          list.push(p);
        }
      }

      if (sort === 'preco_asc') {
        list.sort((a, b) => (Number(a.valor_num || a.price || 0)) - (Number(b.valor_num || b.price || 0)));
      } else if (sort === 'preco_desc') {
        list.sort((a, b) => (Number(b.valor_num || b.price || 0)) - (Number(a.valor_num || a.price || 0)));
      } else if (sort === 'nome') {
        list.sort((a, b) => (a.descricao || a.name || '').localeCompare(b.descricao || b.name || ''));
      } else {
        list.sort((a, b) => (Number(b.salesCount || 10)) - (Number(a.salesCount || 10)));
      }

      renderProductsGrid(list);
    }

    function renderProductsGrid(items) {
      const grid = document.getElementById('productsGrid');
      grid.innerHTML = '';
      if (!Array.isArray(items) || items.length === 0) {
        grid.innerHTML = \`
          <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: var(--text-muted);">
            <p style="font-size: 16px; font-weight: 700; margin-bottom: 8px;">Nenhum produto encontrado nesta busca.</p>
            <p style="font-size: 13px; margin-bottom: 16px;">Tente limpar o filtro de busca ou selecionar todas as categorias.</p>
            <button onclick="selectCategory('TODAS')" class="action-btn" style="background:#15803d; color:white; border:none; padding:10px 20px; border-radius:8px; font-weight:700; cursor:pointer;">
              🌿 Ver Todos os Produtos da Conflora
            </button>
          </div>
        \`;
        return;
      }

      items.forEach(p => {
        const card = document.createElement('div');
        card.className = 'prod-card';
        const price = Number(p.valor_num || p.price || 0);
        const images = (p.images && p.images.length > 0) ? p.images : [getProductImage(p)];
        const stock = p.stockQuantity ?? p.estoque ?? 0;
        const byKg = isSoldByKg(p);

        card.innerHTML = \`
          <div class="card-img-wrapper" onclick="openGallery('\${p.id}')">
            <img class="prod-img" src="\${images[0]}" alt="\${p.descricao || p.name}" onerror="this.onerror=null; this.src='\${REAL_HD_FALLBACKS['DEFAULT']}';" />
            \${images.length > 1 ? \`<span class="photo-count-badge">📷 \${images.length} fotos</span>\` : ''}
            \${byKg ? \`<span class="unit-tag-badge">⚖️ POR KG</span>\` : ''}
          </div>
          <div class="card-body">
            <span class="card-category">\${p.subcategoria || p.subcategory || p.categoria || p.category || 'Conflora'}</span>
            <div class="card-title" onclick="openGallery('\${p.id}')">\${p.descricao || p.name}</div>
            <div class="card-footer">
              <div>
                <div class="card-price">R$ \${price.toFixed(2).replace('.', ',')} <span style="font-size:11px; font-weight:normal; color:#64748b;">\${byKg ? '/kg' : ''}</span></div>
                <span class="card-stock">\${stock} \${byKg ? 'kg' : 'un.'} disponível</span>
              </div>
              <button class="add-btn" onclick="handleProductAddClick('\${p.id}')" title="Adicionar à Sacola">
                \${byKg ? '⚖️ +' : '+'}
              </button>
            </div>
          </div>
        \`;
        grid.appendChild(card);
      });
    }

    function handleProductAddClick(prodId) {
      const p = rawProducts.find(x => String(x.id) === String(prodId));
      if (!p) return;
      if (isSoldByKg(p)) {
        openKgModal(prodId);
      } else {
        addToCart(prodId, 1);
      }
    }

    function openGallery(prodId) {
      const p = rawProducts.find(x => String(x.id) === String(prodId));
      if (!p) return;

      if (typeof gtag === 'function') {
        gtag('event', 'view_item', {
          items: [{ item_id: String(prodId), item_name: p.descricao || p.name, price: Number(p.valor_num || p.price || 0) }]
        });
      }

      const images = (p.images && p.images.length > 0) ? p.images : [getProductImage(p)];
      document.getElementById('modalProdTitle').textContent = p.descricao || p.name;
      document.getElementById('modalProdCategory').textContent = (p.categoria || p.category || '') + ' • ' + (p.subcategoria || p.subcategory || '');
      const byKg = isSoldByKg(p);
      document.getElementById('modalProdPrice').textContent = 'R$ ' + Number(p.valor_num || p.price || 0).toFixed(2).replace('.', ',') + (byKg ? ' / kg' : '');
      document.getElementById('modalProdDesc').textContent = p.descriptionAi || p.descricao_ia || 'Produto selecionado do viveiro e horta da Conflora em Mineiros - GO.';

      const mainImg = document.getElementById('modalMainImg');
      mainImg.src = images[0];

      const thumbsRow = document.getElementById('modalThumbsRow');
      thumbsRow.innerHTML = '';
      images.forEach((img, i) => {
        const btn = document.createElement('div');
        btn.className = 'thumb-btn ' + (i === 0 ? 'active' : '');
        btn.innerHTML = \`<img src="\${img}" alt="Foto" />\`;
        btn.onclick = () => {
          mainImg.src = img;
          document.querySelectorAll('.thumb-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        };
        thumbsRow.appendChild(btn);
      });

      const modalAddBtn = document.getElementById('modalAddBtn');
      modalAddBtn.onclick = () => {
        closeModal();
        handleProductAddClick(p.id);
      };

      document.getElementById('galleryModal').classList.add('open');
    }

    function closeModal() {
      document.getElementById('galleryModal').classList.remove('open');
    }

    // --- MODAL DE KG COM 3 CASAS DECIMAIS ---
    function openKgModal(prodId) {
      const p = rawProducts.find(x => String(x.id) === String(prodId));
      if (!p) return;
      pendingKgProduct = p;

      const existingCartItem = cart[String(prodId)];
      const initialWeight = existingCartItem ? existingCartItem.qty : 1.000;

      document.getElementById('kgModalTitle').textContent = '⚖️ ' + (p.descricao || p.name);
      document.getElementById('kgPricePerKgDisplay').textContent = 'R$ ' + Number(p.valor_num || p.price || 0).toFixed(2).replace('.', ',') + '/kg';
      document.getElementById('kgWeightInput').value = initialWeight.toFixed(3);
      updateKgModalSubtotal();

      document.getElementById('kgModal').classList.add('open');
    }

    function closeKgModal() {
      document.getElementById('kgModal').classList.remove('open');
      pendingKgProduct = null;
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
      document.getElementById('kgSubtotalDisplay').textContent = 'R$ ' + subtotal.toFixed(2).replace('.', ',');
    }

    function confirmKgAddToCart() {
      if (!pendingKgProduct) return;
      const weight = parseFloat(document.getElementById('kgWeightInput').value);
      if (isNaN(weight) || weight <= 0) {
        alert('Por favor, informe um peso válido em kg (maior que 0).');
        return;
      }
      addToCart(pendingKgProduct.id, weight, true);
      closeKgModal();
    }

    // --- GESTÃO DA SACOLA / CARRINHO ---
    function addToCart(prodId, quantity = 1, isKg = false) {
      const p = rawProducts.find(x => String(x.id) === String(prodId));
      if (!p) return;
      const idKey = String(prodId);
      const isProductKg = isKg || isSoldByKg(p);

      if (!cart[idKey]) {
        cart[idKey] = {
          id: idKey,
          name: p.descricao || p.name,
          price: Number(p.valor_num || p.price || 0),
          qty: quantity,
          isKg: isProductKg,
        };
      } else {
        if (isProductKg && isKg) {
          cart[idKey].qty = quantity; // Substitui o peso exato escolhido no modal
        } else {
          cart[idKey].qty += quantity;
        }
      }

      if (typeof gtag === 'function') {
        gtag('event', 'add_to_cart', {
          items: [{ item_id: idKey, item_name: p.descricao || p.name, price: Number(p.valor_num || p.price || 0), quantity }]
        });
      }

      renderCart();
    }

    function changeQty(prodId, delta) {
      const idKey = String(prodId);
      if (!cart[idKey]) return;
      
      if (cart[idKey].isKg) {
        cart[idKey].qty += (delta * 0.250); // Incremento de 250 gramas para produtos por KG
        cart[idKey].qty = Math.round(cart[idKey].qty * 1000) / 1000;
      } else {
        cart[idKey].qty += delta;
      }

      if (cart[idKey].qty <= 0) {
        delete cart[idKey];
      }
      renderCart();
    }

    // BOTÃO NO CARRINHO PARA ESVAZIAR CARRINHO
    function clearCart() {
      const count = Object.keys(cart).length;
      if (count === 0) return;
      if (confirm('Deseja realmente esvaziar todos os itens da sua sacola?')) {
        cart = {};
        renderCart();
      }
    }

    function renderCart() {
      const list = document.getElementById('cartItemsList');
      const items = Object.values(cart);
      let total = 0;
      let totalCount = 0;

      list.innerHTML = '';
      if (items.length === 0) {
        list.innerHTML = '<div style="color: var(--text-muted); font-size: 13px; text-align: center; padding: 20px 0;">Sua sacola está vazia.<br>Clique em <strong>+</strong> nos produtos para adicionar.</div>';
      } else {
        items.forEach(item => {
          const sub = item.price * item.qty;
          total += sub;
          totalCount += (item.isKg ? 1 : item.qty);

          const qtyDisplay = item.isKg
            ? (item.qty.toFixed(3).replace('.', ',') + ' kg')
            : item.qty;

          const div = document.createElement('div');
          div.className = 'cart-item';
          div.innerHTML = \`
            <div class="cart-item-title">
              \${item.name}
              \${item.isKg ? '<span class="cart-item-unit-label">(por KG)</span>' : ''}
            </div>
            <div class="cart-qty-ctrl">
              <button class="qty-btn" onclick="changeQty('\${item.id}', -1)" title="Diminuir">-</button>
              <span style="font-weight: bold; min-width: 44px; text-align: center; font-size: 12px; cursor: \${item.isKg ? 'pointer' : 'default'};" \${item.isKg ? \`onclick="openKgModal('\${item.id}')" title="Clique para editar peso em KG"\` : ''}>
                \${qtyDisplay}
              </span>
              <button class="qty-btn" onclick="changeQty('\${item.id}', 1)" title="Aumentar">+</button>
            </div>
            <div style="font-weight: 700; min-width: 70px; text-align: right; color:#14532d;">R$ \${sub.toFixed(2).replace('.', ',')}</div>
          \`;
          list.appendChild(div);
        });
      }

      // Visibilidade dos botões de esvaziar sacola
      const clearBtn = document.getElementById('clearCartBtn');
      const clearRow = document.getElementById('clearCartRow');
      if (clearBtn) clearBtn.style.display = items.length > 0 ? 'inline-flex' : 'none';
      if (clearRow) clearRow.style.display = items.length > 0 ? 'block' : 'none';

      document.getElementById('cartItemCounter').textContent = items.length + ' item(ns)';
      document.getElementById('cartCountHeader').textContent = items.length + ' itens';
      document.getElementById('cartTotalText').textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
    }

    function setOrderType(type) {
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

    function setPayment(pay) {
      paymentMethod = pay;
      document.getElementById('payPixBtn').classList.toggle('selected', pay === 'PIX');
      document.getElementById('payCardBtn').classList.toggle('selected', pay === 'CARTAO');
      document.getElementById('payCashBtn').classList.toggle('selected', pay === 'DINHEIRO');
      document.getElementById('pixBox').style.display = pay === 'PIX' ? 'block' : 'none';
      saveCustomerDataToStorage();
    }

    function copyPix() {
      const key = document.getElementById('pixKeyDisplay').innerText;
      navigator.clipboard.writeText(key).then(() => {
        alert('Chave PIX copiada: ' + key);
      });
    }

    // --- PERSISTÊNCIA DOS DADOS DO CLIENTE (MEMÓRIA LOCALSTORAGE) ---
    function saveCustomerDataToStorage() {
      try {
        const payload = {
          name: document.getElementById('custName').value.trim(),
          phone: document.getElementById('custPhone').value.trim(),
          address: document.getElementById('custAddress').value.trim(),
          orderType,
          paymentMethod,
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

    // --- FINALIZAÇÃO DO PEDIDO ---
    async function submitOrder() {
      const items = Object.values(cart);
      if (items.length === 0) {
        alert('Adicione pelo menos um item à sua sacola!');
        return;
      }
      const name = document.getElementById('custName').value.trim();
      const phone = document.getElementById('custPhone').value.trim();
      const address = document.getElementById('custAddress').value.trim();

      if (!name) { alert('Por favor, informe seu nome.'); return; }
      if (!phone) { alert('Por favor, informe seu telefone/WhatsApp.'); return; }
      if (orderType === 'DELIVERY' && !address) { alert('Por favor, informe o endereço de entrega em Mineiros.'); return; }

      // Salva os dados para compras futuras
      saveCustomerDataToStorage();

      const submitBtn = document.getElementById('submitOrderBtn');
      submitBtn.disabled = true;
      submitBtn.innerText = 'Enviando Pedido...';

      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: name,
            customerPhone: phone,
            orderType,
            deliveryAddress: orderType === 'DELIVERY' ? address : 'Retirada no Viveiro Conflora',
            paymentMethod,
            items: items.map(i => ({
              productId: i.id,
              name: i.name,
              quantity: i.qty,
              unit: i.isKg ? 'KG' : 'UN',
              price: i.price
            })),
          }),
        });

        const data = await res.json();
        if (data.success) {
          if (typeof gtag === 'function') {
            gtag('event', 'purchase', {
              transaction_id: data.order?.id || String(Date.now()),
              value: Number(data.order?.total || 0),
              currency: 'BRL',
            });
          }
          alert('🎉 Pedido realizado com sucesso! Registrado no Firestore e estoque atualizado.');
          cart = {};
          renderCart();
          loadCatalog();
        } else {
          alert('Erro ao registrar pedido: ' + (data.error || 'Tente novamente.'));
        }
      } catch (err) {
        alert('Erro de conexão ao finalizar pedido: ' + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerText = '✅ Finalizar Pedido';
      }
    }

    function scrollToCart() {
      document.getElementById('cartPanel').scrollIntoView({ behavior: 'smooth' });
    }

    // --- AUTENTICAÇÃO COM GOOGLE & CONTROLE DE ACESSO ADMIN ---
    let currentUser = null;

    function initGoogleUser() {
      try {
        const raw = localStorage.getItem('conflora_user');
        if (raw) {
          currentUser = JSON.parse(raw);
          applyUserUI(currentUser);
        } else {
          const rawOp = localStorage.getItem('conflora_op');
          if (rawOp) {
            currentUser = JSON.parse(rawOp);
            applyUserUI(currentUser);
          }
        }
      } catch (_) {}
    }

    function applyUserUI(user) {
      if (!user) return;
      const loginBtn = document.getElementById('googleLoginBtn');
      const userPill = document.getElementById('googleUserPill');
      const userPic = document.getElementById('googleUserPic');
      const userName = document.getElementById('googleUserName');
      const userBadge = document.getElementById('googleUserBadge');
      const adminStatusBtn = document.getElementById('adminStatusBtn');

      if (loginBtn) loginBtn.style.display = 'none';
      if (userPill) userPill.style.display = 'flex';
      if (userPic) userPic.src = user.picture || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || user.email) + '&background=15803d&color=fff');
      if (userName) userName.textContent = (user.name || user.email || 'Usuário').split(' ')[0];
      if (userBadge) {
        userBadge.textContent = user.role || 'CLIENTE';
        userBadge.style.background = user.role === 'ADMIN' ? '#15803d' : '#0284c7';
      }

      // Status das conexões liberado exclusivamente para ADMIN
      if (adminStatusBtn) {
        adminStatusBtn.style.display = user.role === 'ADMIN' ? 'inline-flex' : 'none';
      }
    }

    function openGoogleLoginModal() {
      const modal = document.getElementById('googleLoginModal');
      if (modal) modal.classList.add('open');
    }

    function closeGoogleLoginModal() {
      const modal = document.getElementById('googleLoginModal');
      if (modal) modal.classList.remove('open');
    }

    async function submitGoogleLogin() {
      const emailInput = document.getElementById('googleEmailInput');
      const nameInput = document.getElementById('googleNameInput');
      const email = emailInput ? emailInput.value.trim() : '';
      const name = nameInput ? nameInput.value.trim() : '';

      if (!email || !email.includes('@')) {
        alert('Por favor, informe um endereço de e-mail Google válido (Gmail ou Google Workspace).');
        return;
      }

      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name }),
        });
        const data = await res.json();
        if (data.success && data.user) {
          currentUser = data.user;
          localStorage.setItem('conflora_user', JSON.stringify(data.user));
          if (data.user.role === 'ADMIN') {
            localStorage.setItem('conflora_op', JSON.stringify(data.user));
          }
          applyUserUI(currentUser);
          closeGoogleLoginModal();
          if (currentUser.role === 'ADMIN') {
            alert('🌿 Autenticado com sucesso como Administrador! Status das conexões e página de configurações liberados.');
          } else {
            alert('🌿 Bem-vindo(a), ' + (currentUser.name || 'Cliente') + '! Você está identificado. Pode fazer suas compras à vontade sem obrigatoriedade de login.');
          }
        } else {
          alert('Erro ao autenticar: ' + (data.error || 'Tente novamente'));
        }
      } catch (err) {
        alert('Erro ao conectar com servidor de login: ' + err.message);
      }
    }

    function logoutGoogle() {
      if (confirm('Deseja realmente sair da sua conta Google?')) {
        currentUser = null;
        localStorage.removeItem('conflora_user');
        localStorage.removeItem('conflora_op');
        const loginBtn = document.getElementById('googleLoginBtn');
        const userPill = document.getElementById('googleUserPill');
        const adminStatusBtn = document.getElementById('adminStatusBtn');
        if (loginBtn) loginBtn.style.display = 'inline-flex';
        if (userPill) userPill.style.display = 'none';
        if (adminStatusBtn) adminStatusBtn.style.display = 'none';
      }
    }

    function handleAdminPanelClick() {
      if (currentUser && currentUser.role === 'ADMIN') {
        window.location.href = '/admin';
      } else if (!currentUser) {
        alert('Para acessar a página de configurações e gerenciamento do viveiro, faça login com sua conta Google de administrador.');
        openGoogleLoginModal();
      } else {
        alert('Acesso restrito. Seu perfil atual é (' + (currentUser.role || 'CLIENTE') + '). Apenas administradores podem acessar a página de configurações.');
      }
    }

    // --- STATUS DASHBOARD (STATUS DAS CONEXÕES SHEETS & WHATSAPP) ---
    function openStatusModal() {
      const modal = document.getElementById('statusModal');
      if (modal) {
        modal.classList.add('open');
        refreshStatusDashboard();
      }
    }

    function closeStatusModal() {
      const modal = document.getElementById('statusModal');
      if (modal) modal.classList.remove('open');
    }

    async function refreshStatusDashboard() {
      const body = document.getElementById('statusDashboardBody');
      if (!body) return;
      body.innerHTML = '<div style="text-align:center; padding:30px; color:#64748b;">📡 Consultando status das conexões (Google Sheets API & WhatsApp)...</div>';

      try {
        const res = await fetch('/api/admin/system-status');
        const data = await res.json();
        renderStatusDashboardContent(data);
      } catch (err) {
        body.innerHTML = '<div style="color:#ef4444; padding:20px; text-align:center;">Erro ao coletar status: ' + err.message + '</div>';
      }
    }

    function renderStatusDashboardContent(data) {
      const body = document.getElementById('statusDashboardBody');
      if (!body) return;

      const sheets = data.googleSheets || {};
      const wa = data.whatsapp || {};
      const fs = data.firestore || {};
      const cat = data.defaultCatalog || {};

      body.innerHTML = \`
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:14px; margin-top:10px;">
          <!-- GOOGLE SHEETS API STATUS -->
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px;">
                📊 Google Sheets API
              </span>
              <span style="background:\${sheets.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;">
                \${sheets.badge || sheets.status || 'ONLINE'}
              </span>
            </div>
            <div style="font-size:12px; color:#475569; line-height:1.6;">
              <div><strong>Planilha:</strong> \${sheets.spreadsheetId || 'Padrão Conflora'}</div>
              <div><strong>Aba / Tabela:</strong> \${sheets.sheetName || 'PRODUTOS'}</div>
              <div><strong>Itens Comerciais:</strong> <span style="font-weight:800; color:#15803d;">\${sheets.itemsActive || 111} produtos</span></div>
              <div><strong>Latência de Resposta:</strong> \${sheets.latencyMs ?? 0} ms</div>
              <div style="margin-top:6px; font-size:11px; color:#64748b; background:#f1f5f9; padding:6px 8px; border-radius:6px;">
                ℹ️ \${sheets.message || 'Conexão ativa.'}
              </div>
            </div>
            <div style="margin-top:12px;">
              <button class="action-btn" onclick="testSheetsInModal()" style="width:100%; justify-content:center; background:#15803d; color:white; padding:7px 10px; border-radius:6px; font-size:11px; cursor:pointer;">
                🧪 Testar Conexão Google Sheets
              </button>
            </div>
          </div>

          <!-- WHATSAPP WEBHOOK & CLOUD API -->
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px;">
                💬 WhatsApp Webhook
              </span>
              <span style="background:\${wa.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;">
                \${wa.badge || wa.status || 'ONLINE'}
              </span>
            </div>
            <div style="font-size:12px; color:#475569; line-height:1.6;">
              <div><strong>Rota do Webhook:</strong> <code>/webhook</code> (GET/POST)</div>
              <div><strong>Telefone / ID:</strong> \${wa.phoneNumberId || 'Emulador Local'}</div>
              <div><strong>Token de Verificação:</strong> \${wa.hasVerifyToken ? '✅ Configurado' : '⚠️ Não configurado'}</div>
              <div><strong>Mensagens Recebidas:</strong> \${wa.totalReceivedCount || 0}</div>
              <div><strong>Último Envio/Hit:</strong> \${wa.lastReceivedAt || 'Nenhum recente'}</div>
              <div style="margin-top:6px; font-size:11px; color:#64748b; background:#f1f5f9; padding:6px 8px; border-radius:6px;">
                ℹ️ \${wa.message || 'Webhook ouvindo requisições na rota /webhook.'}
              </div>
            </div>
            <div style="margin-top:12px;">
              <button class="action-btn" onclick="testWebhookInModal()" style="width:100%; justify-content:center; background:#0284c7; color:white; padding:7px 10px; border-radius:6px; font-size:11px; cursor:pointer;">
                🧪 Testar Rota & Ping do Webhook
              </button>
            </div>
          </div>

          <!-- BANCO FIRESTORE -->
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px;">
                🔥 Cloud Firestore
              </span>
              <span style="background:\${fs.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;">
                \${fs.badge || fs.status || 'ONLINE'}
              </span>
            </div>
            <div style="font-size:12px; color:#475569; line-height:1.6;">
              <div><strong>Projeto GCP:</strong> \${fs.projectId || 'confloraai'}</div>
              <div><strong>Latência Consulta:</strong> \${fs.latencyMs ?? 0} ms</div>
              <div><strong>Persistência:</strong> Firestore & Cache Local</div>
              <div style="margin-top:6px; font-size:11px; color:#64748b; background:#f1f5f9; padding:6px 8px; border-radius:6px;">
                ℹ️ \${fs.message || 'Firestore operacional.'}
              </div>
            </div>
          </div>

          <!-- PLANILHA PADRÃO CONFLORA (CONTINGÊNCIA) -->
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <span style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:6px;">
                🌱 Planilha Padrão Conflora
              </span>
              <span style="background:\${cat.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:12px;">
                \${cat.badge || 'Planilha Ativa'}
              </span>
            </div>
            <div style="font-size:12px; color:#475569; line-height:1.6;">
              <div><strong>Total de Produtos:</strong> <strong style="color:#15803d;">\${cat.totalItems || 111} produtos</strong></div>
              <div><strong>Categorias Mapeadas:</strong> \${cat.categoriesCount || 6} categorias</div>
              <div><strong>Contingência:</strong> Automática (Garante 100% de disponibilidade)</div>
              <div style="margin-top:6px; font-size:11px; color:#64748b; background:#f1f5f9; padding:6px 8px; border-radius:6px;">
                ℹ️ Planilha oficial LISTA DE PRODUTOS Conflora.
              </div>
            </div>
          </div>
        </div>

        <div id="modalTestResultBox" style="display:none; margin-top:14px; padding:10px; border-radius:8px; font-size:12px;"></div>
      \`;
    }

    async function testSheetsInModal() {
      const box = document.getElementById('modalTestResultBox');
      if (box) {
        box.style.display = 'block';
        box.style.background = '#f1f5f9';
        box.style.color = '#334155';
        box.innerHTML = '⏳ Testando conexão com Google Sheets API...';
      }
      try {
        const res = await fetch('/api/admin/test-sheets', { method: 'POST' });
        const d = await res.json();
        if (box) {
          box.style.background = '#dcfce7';
          box.style.color = '#166534';
          box.innerHTML = '✅ <strong>Google Sheets OK:</strong> ' + (d.message || 'Sincronizado') + ' (Latência: ' + (d.latencyMs || 0) + 'ms)';
        }
      } catch (err) {
        if (box) {
          box.style.background = '#fee2e2';
          box.style.color = '#991b1b';
          box.innerHTML = '❌ <strong>Erro no teste do Sheets:</strong> ' + err.message;
        }
      }
    }

    async function testWebhookInModal() {
      const box = document.getElementById('modalTestResultBox');
      if (box) {
        box.style.display = 'block';
        box.style.background = '#f1f5f9';
        box.style.color = '#334155';
        box.innerHTML = '⏳ Enviando ping para WhatsApp Webhook...';
      }
      try {
        const res = await fetch('/api/admin/test-webhook', { method: 'POST' });
        const d = await res.json();
        if (box) {
          box.style.background = '#dcfce7';
          box.style.color = '#166534';
          box.innerHTML = '✅ <strong>Webhook WhatsApp OK:</strong> Rota <code>/webhook</code> respondendo em ' + (d.pingLatencyMs || 0) + 'ms. ' + (d.message || '');
        }
      } catch (err) {
        if (box) {
          box.style.background = '#fee2e2';
          box.style.color = '#991b1b';
          box.innerHTML = '❌ <strong>Erro no teste do Webhook:</strong> ' + err.message;
        }
      }
    }

    // Inicialização
    initGoogleUser();
    renderCategories();
    renderSubcategories();
    filterProducts();
    loadSavedCustomerData();
    loadCatalog();
  </script>
</body>
</html>`;
}

module.exports = {
  renderHomeHtml,
};
