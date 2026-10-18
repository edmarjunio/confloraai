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
