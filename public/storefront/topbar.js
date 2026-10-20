/* One topbar for staff pages; the catalog uses the same layout classes. */
(() => {
  const paths = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/>',
    user: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-3a7 7 0 0 1 14 0v3"/>',
    cart: '<path d="M3 3h2l3 12h10l3-8H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/>',
    cashier: '<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M7 9V3h10v6M7 13h10M8 17h1m3 0h1m3 0h1"/>',
    truck: '<path d="M3 6h11v11H3zM14 10h4l3 4v3h-7"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
    chart: '<path d="M4 20V10h4v10m2 0V4h4v16m2 0V7h4v13"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  };
  const trSafe = s => {
    try {
      if (!s) return '';
      let t = typeof window.tr === 'function' ? window.tr(s) : (typeof s.tr === 'string' ? s.tr : s);
      if (typeof t !== 'string' || !t || t === 'undefined') t = s;
      return t;
    } catch (_) {
      return s;
    }
  };
  const icon = name => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + paths[name] + '</svg>';
  class ConfloraTopbar extends HTMLElement {
    static get observedAttributes() { return ['user-name', 'user-role', 'user-photo', 'search-value']; }
    connectedCallback() {
      if (this.header) return;
      const admin = this.getAttribute('context') === 'admin';
      this.innerHTML = '<header class="cf-topbar-layout conflora-site-header">' +
        '<a class="cf-topbar-brand" href="/" aria-label="Conflora - página inicial"><img src="/store-assets/brands/conflora-logo.png" alt="Conflora Horta e Viveiro"></a>' +
        '<form class="cf-topbar-search" role="search">' + icon('search') + '<input type="search" aria-label="Buscar produtos" placeholder="O que você procura?"><button type="submit">Buscar</button></form>' +
        '<div class="cf-topbar-actions">' +
        '<select class="cf-topbar-language" aria-label="Idioma do catálogo"><option value="pt">BR PT</option><option value="en">EN</option><option value="es">ES</option><option value="fr">FR</option></select>' +
        '<button class="cf-topbar-identity" type="button" aria-label="Abrir minha conta">' + icon('user') + '<img hidden ' + (admin ? 'id="loggedUserPhoto"' : '') + ' alt="Foto do operador" referrerpolicy="no-referrer"><span><strong ' + (admin ? 'id="loggedUserName"' : '') + '></strong><small ' + (admin ? 'id="loggedUserRole"' : '') + '></small></span></button>' +
        '<a class="cf-topbar-pill cf-topbar-guide" href="/guias" aria-label="Guias Operacionais" title="Guias e Treinamento" hidden>' + icon('book') + '<span>GUIA</span></a>' +
        '<a class="cf-topbar-pill cf-topbar-dark" href="/" data-primary>' + icon('cart') + '<span>Sacola</span></a>' +
        '<a class="cf-topbar-pill cf-topbar-cashier" href="/caixa" aria-label="Caixa">' + icon('cashier') + '<span>CAIXA</span></a>' +
        '<button class="cf-topbar-menu" type="button" aria-label="Menu da loja">' + icon('menu') + '</button>' +
        '</div></header>';
      this.header = this.querySelector('header');
      this.input = this.querySelector('input');
      this.input.placeholder = this.getAttribute('search-placeholder') || 'O que você procura?';
      this.input.value = this.getAttribute('search-value') || '';
      this.querySelector('form').onsubmit = event => {
        event.preventDefault();
        if (this.hasAttribute('local-search')) this.search();
        else window.location.assign('/?q=' + encodeURIComponent(this.input.value.trim()));
      };
      this.input.oninput = () => { if (this.hasAttribute('local-search')) this.search(); };
      this.querySelector('.cf-topbar-cashier').onclick = event => {
        if (!this.hasAttribute('local-cashier')) return;
        event.preventDefault(); this.dispatchEvent(new CustomEvent('cf-topbar-cashier', { bubbles: true }));
      };
      this.querySelector('.cf-topbar-menu').onclick = () => window.ConfloraNavigation.open(this.identityUser);
      const guideBtn = this.querySelector('.cf-topbar-guide');
      if (guideBtn) {
        guideBtn.onclick = event => {
          const r = String(this.identityUser?.role || this.currentUser?.role || '').toUpperCase();
          const guideMap = {
            ADMIN: '/guias/admin.html',
            CAIXA: '/guias/caixa.html',
            VENDEDOR: '/guias/vendedor.html',
            ENTREGADOR: '/guias/entregador.html',
          };
          if (guideMap[r]) {
            event.preventDefault();
            window.location.assign(guideMap[r]);
          }
        };
      }
      this.querySelector('.cf-topbar-identity').onclick = () => window.location.assign('/?conta=1');
      const language = this.querySelector('select');
      try { language.value = window.localStorage.getItem('conflora_lang') || 'pt'; } catch { /* The catalog remains usable without storage. */ }
      language.onchange = () => {
        import('/store-assets/v5/i18n/index.js').then(module => module.setLanguage(language.value)).catch(() => {});
      };
      this.updateIdentity();
      this.updateSize = () => document.documentElement.style.setProperty('--cf-topbar-height', this.header.getBoundingClientRect().height + 'px');
      this.updateSize();
      if (window.ResizeObserver) {
        this.sizeObserver = new window.ResizeObserver(this.updateSize); this.sizeObserver.observe(this.header);
      } else window.addEventListener('resize', this.updateSize);
      if (!this.hasAttribute('managed')) {
        window.ConfloraSession.apiFetch('/api/auth/me').then(response => response.json()).then(data => { if (this.isConnected) this.user = data.user; }).catch(() => {});
      }
    }
    attributeChangedCallback(name) {
      if (!this.header) return;
      if (name === 'search-value') { if (this.input.value !== (this.getAttribute(name) || '')) this.input.value = this.getAttribute(name) || ''; }
      else this.updateIdentity();
    }
    disconnectedCallback() { if (this.onLangChange) window.removeEventListener('conflora-lang-change', this.onLangChange); this.sizeObserver?.disconnect(); window.removeEventListener('resize', this.updateSize); }
    set user(value) { this.currentUser = value; this.updateIdentity(); }
    search() { this.dispatchEvent(new CustomEvent('cf-topbar-search', { detail: { query: this.input.value }, bubbles: true })); }
    updateIdentity() {
      if (!this.header) return;
      const user = this.currentUser || { name: this.getAttribute('user-name'), role: this.getAttribute('user-role'), picture: this.getAttribute('user-photo') };
      this.identityUser = user;
      const role = user.role || '';
      const identity = this.querySelector('.cf-topbar-identity');
      identity.querySelector('strong').textContent = user.name || trSafe('Entrar');
      identity.querySelector('small').textContent = role;
      identity.title = user.name || trSafe('Sua conta');
      const photo = identity.querySelector('img'); photo.hidden = !user.picture;
      if (user.picture) photo.src = user.picture;
      const guide = this.querySelector('.cf-topbar-guide');
      const isTeam = ['ADMIN', 'CAIXA', 'VENDEDOR', 'ENTREGADOR'].includes(role);
      if (guide) {
        guide.hidden = !isTeam;
        if (isTeam) {
          const guideMap = {
            ADMIN: '/guias/admin.html',
            CAIXA: '/guias/caixa.html',
            VENDEDOR: '/guias/vendedor.html',
            ENTREGADOR: '/guias/entregador.html',
          };
          guide.href = guideMap[role] || '/guias/index.html';
          guide.title = `Guia Operacional - ${role}`;
          guide.setAttribute('aria-label', `Guia Operacional de ${role}`);
        }
      }
      const cashier = this.querySelector('.cf-topbar-cashier');
      cashier.querySelector('svg').outerHTML = icon(role === 'ENTREGADOR' ? 'truck' : 'cashier');
      cashier.hidden = this.hasAttribute('hide-cashier') || !['ADMIN', 'CAIXA', 'VENDEDOR', 'ENTREGADOR'].includes(role);
      cashier.querySelector('span').textContent = trSafe(role === 'ENTREGADOR' ? 'ENTREGAS' : 'CAIXA');
      cashier.setAttribute('aria-label', trSafe(role === 'ENTREGADOR' ? 'Minhas entregas' : 'Caixa'));
      const primary = this.querySelector('[data-primary]');
      primary.href = role === 'ADMIN' ? '/admin-gerencial' : '/?sacola=1';
      const label = role === 'ADMIN' ? (trSafe('Painel Gerencial') || 'Painel Gerencial') : (trSafe('Sacola') || 'Sacola');
      primary.innerHTML = icon(role === 'ADMIN' ? 'chart' : 'cart') + '<span>' + (label && label !== 'undefined' ? label : (role === 'ADMIN' ? 'Painel Gerencial' : 'Sacola')) + '</span>';

    }
  }
  if (!customElements.get('conflora-topbar')) customElements.define('conflora-topbar', ConfloraTopbar);
})();
