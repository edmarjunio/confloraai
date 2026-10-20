/* Shared navigation and dismissal behavior for the catalog and staff screens. */
(() => {
  // Configuração dos itens de navegação com ícones, cores temáticas e subtítulos amigáveis
  function getNavigationSections(user) {
    const role = user?.role;
    const sections = [];

    // --- SEÇÃO 1: LOJA & ATENDIMENTO ---
    const shopItems = [
      {
        id: 'home',
        label: 'Catálogo & Loja',
        subtitle: 'Mudas, flores, hortifruti e vasos',
        icon: '🌿',
        iconBg: '#dcfce7',
        href: '/',
        roles: ['ALL'],
      },
    ];

    if (['ADMIN', 'CAIXA', 'VENDEDOR'].includes(role)) {
      shopItems.push({
        id: 'pos',
        label: 'Frente de Caixa (PDV)',
        subtitle: 'Vendas balcão, caixa rápido e troco',
        icon: '⚡',
        iconBg: '#fef9c3',
        href: '/caixa',
        roles: ['ADMIN', 'CAIXA', 'VENDEDOR'],
      });
      shopItems.push({
        id: 'orders',
        label: 'Comandas & Pedidos',
        subtitle: 'Acompanhe pedidos em tempo real',
        icon: '📋',
        iconBg: '#e0f2fe',
        href: role === 'ADMIN' ? '/admin?tab=orders' : '/caixa?view=commands',
        roles: ['ADMIN', 'CAIXA', 'VENDEDOR'],
      });
    }

    if (['ADMIN', 'CAIXA', 'ENTREGADOR'].includes(role)) {
      shopItems.push({
        id: 'deliveries',
        label: 'Entregas & Expedição',
        subtitle: 'Check verde na horta, rotas e GPS',
        icon: '🛵',
        iconBg: '#ccfbf1',
        href: '/caixa?view=deliveries',
        roles: ['ADMIN', 'CAIXA', 'ENTREGADOR'],
      });
    }

    sections.push({
      title: 'Loja & Atendimento',
      items: shopItems,
    });

    // --- SEÇÃO 2: GESTÃO DO NEGÓCIO (Exclusivo ADMIN / Gestores) ---
    if (role === 'ADMIN') {
      sections.push({
        title: 'Gestão & Finanças',
        items: [
          {
            id: 'executive',
            label: 'Resultados da Loja (HOJE)',
            subtitle: 'Faturamento, DRE e WhatsApp dos sócios',
            icon: '📈',
            iconBg: '#f3e8ff',
            href: '/admin-gerencial',
            roles: ['ADMIN'],
          },
          {
            id: 'cashier-audit',
            label: 'Conferência de Caixas',
            subtitle: 'Auditoria de fechamentos e comprovantes',
            icon: '💰',
            iconBg: '#ecfdf5',
            href: '/admin?tab=cashier',
            roles: ['ADMIN'],
          },
          {
            id: 'stock',
            label: 'Controle de Estoque',
            subtitle: 'Inventário, contagem e baixas',
            icon: '📦',
            iconBg: '#ffedd5',
            href: '/admin?tab=stock',
            roles: ['ADMIN'],
          },
          {
            id: 'products',
            label: 'Catálogo de Produtos',
            subtitle: 'Ordenação A-Z, preços e importação',
            icon: '🏷️',
            iconBg: '#e0e7ff',
            href: '/admin?tab=products',
            roles: ['ADMIN'],
          },
          {
            id: 'team',
            label: 'Equipe & Colaboradores',
            subtitle: 'Gestão de acessos, cargos e PINs',
            icon: '👥',
            iconBg: '#fef3c7',
            href: '/admin?tab=team',
            roles: ['ADMIN'],
          },
          {
            id: 'store-settings',
            label: 'Personalizar Loja',
            subtitle: 'Identidade visual, horários e banners',
            icon: '🎨',
            iconBg: '#fce7f3',
            href: '/configuracoes',
            roles: ['ADMIN'],
          },
          {
            id: 'system-status',
            label: 'Sistema & Diagnósticos',
            subtitle: 'Conexões WhatsApp, Pix e logs',
            icon: '🛡️',
            iconBg: '#f1f5f9',
            href: '/admin?tab=status',
            roles: ['ADMIN'],
          },
        ],
      });
    } else if (['CAIXA'].includes(role)) {
      sections.push({
        title: 'Finanças do Caixa',
        items: [
          {
            id: 'cashier-report',
            label: 'Conferência do Meu Caixa',
            subtitle: 'Fechamento do turno e comprovantes',
            icon: '💰',
            iconBg: '#ecfdf5',
            href: '/admin?tab=cashier',
            roles: ['CAIXA'],
          },
        ],
      });
    }

    // --- SEÇÃO 3: CONTA & ACESSO ---
    const accountItems = [];
    const teamRoles = ['ADMIN', 'CAIXA', 'VENDEDOR', 'ENTREGADOR'];
    if (teamRoles.includes(role)) {
      const guideMap = {
        ADMIN: '/guias/admin.html',
        CAIXA: '/guias/caixa.html',
        VENDEDOR: '/guias/vendedor.html',
        ENTREGADOR: '/guias/entregador.html',
      };
      accountItems.push({
        id: 'guides',
        label: `Guia Operacional (${role})`,
        subtitle: 'Passo a passo didático com prints da sua função',
        icon: '📖',
        iconBg: '#ecfdf5',
        href: guideMap[role] || '/guias/index.html',
        roles: teamRoles,
      });
    }
    accountItems.push({
      id: 'profile',
      label: role ? 'Meu Perfil' : 'Entrar na Minha Conta',
      subtitle: role ? 'Seus dados e segurança' : 'Acesse seus pedidos e histórico',
      icon: '👤',
      iconBg: '#f0fdf4',
      href: role ? '/?conta=1&editar=1' : '/?conta=1',
      roles: ['ALL'],
    });

    sections.push({
      title: 'Minha Conta',
      items: accountItems,
    });

    return sections;
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
      const status = button.closest('dialog')?.querySelector('[role=status]');
      if (status) status.textContent = error.message;
    }
  }

  function renderUserHeader(user) {
    const card = document.createElement('div');
    card.className = 'cf-nav-user-card';

    const avatar = document.createElement('div');
    avatar.className = 'cf-nav-user-avatar';
    
    // Ícone de avatar baseado no cargo
    const roleIcons = { ADMIN: '👑', CAIXA: '💵', VENDEDOR: '🛍️', ENTREGADOR: '🛵' };
    avatar.textContent = roleIcons[user?.role] || '🌿';

    const info = document.createElement('div');
    info.className = 'cf-nav-user-info';

    const name = document.createElement('strong');
    name.className = 'cf-nav-user-name';
    name.textContent = user?.name || 'Visitante · Conflora';

    const badge = document.createElement('span');
    const roleKey = (user?.role || 'CLIENTE').toLowerCase();
    badge.className = `cf-nav-role-badge ${roleKey}`;
    
    const roleLabels = {
      ADMIN: 'Dono / Administrador',
      CAIXA: 'Operador de Caixa',
      VENDEDOR: 'Vendedor Balcão',
      ENTREGADOR: 'Entregador',
      CLIENTE: 'Cliente Amigo'
    };
    badge.textContent = roleLabels[user?.role] || 'Cliente Amigo';

    info.append(name, badge);
    card.append(avatar, info);
    return card;
  }

  function open(user) {
    let dialog = document.getElementById('siteNavigationDrawer');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'siteNavigationDrawer';
      dialog.className = 'cf-navigation-drawer';
      dialog.setAttribute('aria-label', 'Navegação da loja');
      document.body.append(dialog);
    }
    dialog.replaceChildren();

    // 1. Cabeçalho Padronizado da Aba Lateral (com botão » de 38px idêntico à sacola)
    const heading = document.createElement('div');
    heading.className = 'cf-navigation-heading';

    const title = document.createElement('h2');
    title.textContent = 'Menu & Navegação';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'cf-drawer-close';
    close.innerHTML = '<span aria-hidden="true">»</span>';
    close.setAttribute('aria-label', 'Fechar navegação');
    close.onclick = () => dialog.close();

    heading.append(title, close);

    // 2. Corpo rolável do menu
    const body = document.createElement('div');
    body.className = 'cf-navigation-body';

    // Card do Usuário ativo
    body.append(renderUserHeader(user));

    // Seções de Navegação com Cards Modernos
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Páginas da loja');

    const sections = getNavigationSections(user);

    for (const section of sections) {
      if (!section.items.length) continue;

      const secWrap = document.createElement('div');
      secWrap.className = 'cf-nav-section';

      const secTitle = document.createElement('div');
      secTitle.className = 'cf-nav-section-title';
      secTitle.textContent = section.title;
      secWrap.append(secTitle);

      for (const item of section.items) {
        const link = document.createElement('a');
        link.className = 'cf-nav-item';
        link.href = item.href;

        // Ícone temático
        const iconWrap = document.createElement('div');
        iconWrap.className = 'cf-nav-icon-wrap';
        iconWrap.style.backgroundColor = item.iconBg || '#f1f5f9';
        iconWrap.textContent = item.icon;

        // Textos (Título + Subtítulo)
        const textWrap = document.createElement('div');
        textWrap.className = 'cf-nav-text';

        const itemTitle = document.createElement('span');
        itemTitle.className = 'cf-nav-title';
        itemTitle.textContent = item.label;

        const itemSubtitle = document.createElement('span');
        itemSubtitle.className = 'cf-nav-subtitle';
        itemSubtitle.textContent = item.subtitle;

        textWrap.append(itemTitle, itemSubtitle);

        // Indicador de seta discreta
        const arrow = document.createElement('span');
        arrow.className = 'cf-nav-arrow';
        arrow.textContent = '›';

        link.append(iconWrap, textWrap, arrow);

        // Marca página atual
        const currentLoc = location.pathname + location.search;
        if (currentLoc === item.href || (item.href === '/' && location.pathname === '/')) {
          link.setAttribute('aria-current', 'page');
        }

        // Navegação de abas internas no /admin sem reload
        link.onclick = (event) => {
          if (location.pathname === '/admin' && item.href.startsWith('/admin?tab=')) {
            event.preventDefault();
            dialog.close();
            const tab = new URL(item.href, location.origin).searchParams.get('tab');
            window.dispatchEvent(new CustomEvent('cf-admin-navigate', { detail: { tab } }));
          } else {
            dialog.close();
          }
        };

        secWrap.append(link);
      }

      nav.append(secWrap);
    }

    body.append(nav);

    // 3. Rodapé do Menu
    const footer = document.createElement('footer');
    footer.className = 'cf-navigation-footer';

    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    footer.append(status);

    // Widget Exclusivo do Dono para Teste Rápido de 4 Cargos
    if (user?.canSwitchProfiles) {
      const switcher = document.createElement('div');
      switcher.className = 'cf-nav-test-box';

      const swTitle = document.createElement('div');
      swTitle.className = 'cf-nav-test-title';
      swTitle.innerHTML = '👑 <span>Modo Teste (Exclusivo Dono)</span>';

      const grid = document.createElement('div');
      grid.className = 'cf-nav-test-grid';

      const profileOptions = [
        ['ADMIN', '👑 Admin', '#854d0e', '#fef08a'],
        ['CAIXA', '💵 Caixa', '#1e40af', '#dbeafe'],
        ['VENDEDOR', '🛍️ Vendedor', '#9a3412', '#ffedd5'],
        ['ENTREGADOR', '🛵 Entregador', '#115e59', '#ccfbf1'],
      ];

      for (const [role, label, color, bg] of profileOptions) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const active = user.role === role;
        btn.className = `cf-nav-role-btn ${active ? 'active' : ''}`;
        btn.textContent = label;
        btn.style.setProperty('--role-color', color);
        btn.style.setProperty('--role-bg', bg);

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

    // Botão de Logout
    if (user?.role) {
      const exit = document.createElement('button');
      exit.type = 'button';
      exit.className = 'cf-danger-button cf-nav-logout-btn';
      exit.innerHTML = '<span>🚪</span><span>Sair da Conta</span>';
      exit.onclick = () => logout(exit);
      footer.append(exit);
    }

    dialog.append(heading, body, footer);
    if (!dialog.open) dialog.showModal();
  }

  function back() {
    if (history.length > 1 && (history.state?.confloraNavigation || document.referrer.startsWith(location.origin + '/'))) {
      history.back();
    } else {
      location.assign('/');
    }
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-site-back]')) {
      event.preventDefault();
      back();
      return;
    }
    const target = event.target;
    if (target instanceof window.HTMLDialogElement && target.open) {
      const rect = target.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
        if (target.dispatchEvent(new window.Event('cancel', { cancelable: true }))) target.close();
      }
    }
    if (target.matches && target.matches('.modal.open')) {
      const handlers = {
        loginModal: 'closeLoginModal',
        userModal: 'closeUserModal',
        manualOrderModal: 'closeManualOrderModal',
        alterationRequestModal: 'closeAlterationModal',
        rejectReasonModal: 'closeRejectModal',
        stockAdjustmentModal: 'closeStockAdjustment',
      };
      const close = window[handlers[target.id]];
      if (typeof close === 'function') close();
      else target.classList.remove('open');
    }
  });

  window.ConfloraNavigation = { open, back, getNavigationSections };
})();
