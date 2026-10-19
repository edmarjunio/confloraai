/* Shared navigation and dismissal behavior for the catalog and staff screens. */
(() => {
  const adminPages = [['Caixa/Vendas', 'cashier'], ['Comandas', 'orders'], ['Estoque', 'stock'], ['Produtos', 'products'], ['Equipe', 'team'], ['Sistema e erros', 'status'], ['Eventos', 'analytics']];
  function destinations(user) {
    const role = user?.role;
    const links = [['Página inicial', '/']];
    if (role === 'ADMIN') links.push(...adminPages.map(([label, tab]) => [label, '/admin?tab=' + tab]));
    else if (['CAIXA', 'VENDEDOR'].includes(role)) links.push(['Caixa/Vendas', '/admin?tab=cashier'], ['Comandas', '/caixa?view=commands']);
    if (['ADMIN', 'CAIXA', 'VENDEDOR'].includes(role)) links.push(['Caixa', '/caixa']);
    if (role === 'ADMIN') links.push(['Painel Gerencial', '/admin-gerencial']);
    if (['ADMIN', 'CAIXA', 'ENTREGADOR'].includes(role)) links.push(['Entregas', '/caixa?view=deliveries']);
    links.push([role ? 'Editar meu perfil' : 'Entrar na minha conta', role ? '/?conta=1&editar=1' : '/?conta=1']);
    if (role === 'ADMIN') links.push(['Personalizar minha loja', '/configuracoes']);
    return links;
  }
  async function logout(button) {
    button.disabled = true;
    try {
      const response = await window.ConfloraSession.apiFetch('/api/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error('Não foi possível sair. Tente novamente.');
      if (window.signOutGoogle) await window.signOutGoogle().catch(() => {});
      location.assign('/');
    } catch (error) {
      button.disabled = false;
      button.closest('dialog').querySelector('[role=status]').textContent = error.message;
    }
  }
  function open(user) {
    let dialog = document.getElementById('siteNavigationDrawer');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'siteNavigationDrawer'; dialog.className = 'cf-navigation-drawer';
      dialog.setAttribute('aria-label', 'Navegação da loja');
      document.body.append(dialog);
    }
    dialog.replaceChildren();
    const heading = document.createElement('div'); heading.className = 'cf-navigation-heading';
    const title = document.createElement('h2'); title.textContent = 'Para onde vamos?';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'cf-drawer-close'; close.textContent = '»'; close.setAttribute('aria-label', 'Fechar navegação'); close.onclick = () => dialog.close();
    heading.append(title, close);
    const nav = document.createElement('nav'); nav.setAttribute('aria-label', 'Páginas da loja');
    for (const [label, href] of destinations(user)) {
      const link = document.createElement('a'); link.href = href; link.textContent = label;
      if (location.pathname + location.search === href) link.setAttribute('aria-current', 'page');
      link.onclick = event => {
        if (location.pathname !== '/admin' || !href.startsWith('/admin?tab=')) return;
        event.preventDefault(); dialog.close();
        window.dispatchEvent(new CustomEvent('cf-admin-navigate', { detail: { tab: new URL(href, location.origin).searchParams.get('tab') } }));
      };
      nav.append(link);
    }
    const footer = document.createElement('footer');
    const status = document.createElement('p'); status.setAttribute('role', 'status'); footer.append(status);
    if (user?.canSwitchProfiles) {
      const switcher = document.createElement('div');
      switcher.style.cssText = 'margin:12px 0;padding:12px;border-radius:12px;background:#fefce8;border:1px solid #fde047;';
      const swTitle = document.createElement('div');
      swTitle.style.cssText = 'font-size:11px;font-weight:800;color:#854d0e;text-transform:uppercase;margin-bottom:8px;';
      swTitle.textContent = '👑 Modo Teste (Exclusivo Dono)';
      const grid = document.createElement('div');
      grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;';
      for (const [role, label] of [['ADMIN', '👑 Admin'], ['CAIXA', '💵 Caixa'], ['VENDEDOR', '🛍️ Vendedor'], ['ENTREGADOR', '🛵 Entregador']]) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const active = user.role === role;
        btn.style.cssText = `padding:7px 8px;font-size:12px;font-weight:700;border-radius:8px;cursor:pointer;border:1px solid ${active ? '#15803d' : '#cbd5e1'};background:${active ? '#15803d' : '#fff'};color:${active ? '#fff' : '#1e293b'};`;
        btn.textContent = label;
        btn.onclick = async () => {
          btn.disabled = true;
          try {
            const res = await window.ConfloraSession.apiFetch('/api/auth/switch-profile', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ role }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao alternar perfil.');
            location.reload();
          } catch (err) {
            btn.disabled = false;
            status.textContent = err.message;
          }
        };
        grid.append(btn);
      }
      switcher.append(swTitle, grid);
      footer.append(switcher);
    }
    if (user?.role) {
      const exit = document.createElement('button'); exit.type = 'button'; exit.className = 'cf-danger-button'; exit.textContent = 'Sair'; exit.onclick = () => logout(exit); footer.append(exit);
    }
    dialog.append(heading, nav, footer);
    if (!dialog.open) dialog.showModal();
  }
  function back() {
    if (history.length > 1 && (history.state?.confloraNavigation || document.referrer.startsWith(location.origin + '/'))) history.back();
    else location.assign('/');
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-site-back]')) { event.preventDefault(); back(); return; }
    const target = event.target;
    if (target instanceof window.HTMLDialogElement && target.open) {
      const rect = target.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
        if (target.dispatchEvent(new window.Event('cancel', { cancelable: true }))) target.close();
      }
    }
    if (target.matches('.modal.open')) {
      const handlers = { loginModal: 'closeLoginModal', userModal: 'closeUserModal', manualOrderModal: 'closeManualOrderModal', alterationRequestModal: 'closeAlterationModal', rejectReasonModal: 'closeRejectModal', stockAdjustmentModal: 'closeStockAdjustment' };
      const close = window[handlers[target.id]];
      if (typeof close === 'function') close();
      else target.classList.remove('open');
    }
  });
  window.ConfloraNavigation = { open, back };
})();
