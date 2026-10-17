// Gerenciador do Menu da Equipe (Bottomsheet no Mobile e Aba Direita no PC)
// Garante que o cliente veja apenas a loja e a equipe tenha acesso com base em cargo (CAIXA vs ADMIN).

export function initTeamDrawer() {
  const drawerBtn = document.getElementById('teamDrawerBtn');
  const overlay = document.getElementById('teamDrawerOverlay');
  const sheet = document.getElementById('teamDrawerSheet');
  const closeBtn = document.getElementById('closeTeamDrawerBtn');
  const backToShopBtn = document.getElementById('teamBackToShopBtn');
  const switchOpBtn = document.getElementById('teamSwitchOpBtn');
  const opSelectorBox = document.getElementById('teamOpSelectorBox');
  const selectUser = document.getElementById('teamSelectUser');
  const confirmOpBtn = document.getElementById('teamConfirmOpBtn');
  const cancelOpBtn = document.getElementById('teamCancelOpBtn');
  const adminSection = document.getElementById('teamAdminSection');
  const teamLinkCaixa = document.getElementById('teamLinkCaixa');
  const openEntryBtn = document.getElementById('teamOpenEntryBtn');

  if (!drawerBtn || !overlay || !sheet) {return;}

  let currentOperator = {
    name: 'Atendente Caixa',
    role: 'CAIXA',
    id: '',
  };

  // Carrega operador salvo ou busca da sessão
  async function loadCurrentOperator() {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          currentOperator = {
            name: data.user.name || 'Colaborador',
            role: data.user.role || 'CAIXA',
            id: data.user.id || '',
          };
          updateDrawerUI();
          return;
        }
      }
    } catch {
      // ignore
    }

    // Fallback no localStorage
    const savedName = localStorage.getItem('conflora_operator_name');
    const savedRole = localStorage.getItem('conflora_operator_role');
    const savedId = localStorage.getItem('conflora_operator_id');
    if (savedName) {
      currentOperator = {
        name: savedName,
        role: savedRole || 'CAIXA',
        id: savedId || '',
      };
    }
    updateDrawerUI();
  }

  function updateDrawerUI() {
    const isDriver = String(currentOperator.role).toUpperCase() === 'ENTREGADOR';
    const isCaixa = String(currentOperator.role).toUpperCase() === 'CAIXA';
    const isAdmin = String(currentOperator.role).toUpperCase() === 'ADMIN';

    const opNameEl = document.getElementById('teamOpName');
    const opBadgeEl = document.getElementById('teamOpRoleBadge');
    const subtitleEl = document.getElementById('teamOperatorSubtitle');
    const caixaDescEl = document.getElementById('teamCaixaScopeDesc');

    if (opNameEl) {opNameEl.textContent = currentOperator.name;}
    if (opBadgeEl) {
      opBadgeEl.textContent = isDriver ? 'CARGO: ENTREGADOR' : isCaixa ? 'CARGO: CAIXA' : (isAdmin ? 'CARGO: ADMIN' : 'COLABORADOR');
      opBadgeEl.className = 'team-role-badge ' + (isAdmin ? 'admin' : 'caixa');
    }
    if (subtitleEl) {
      subtitleEl.textContent = isDriver ? 'Entregas e recebimentos na rota' : isCaixa
        ? 'Caixa Liberado · Acesso exclusivo às suas vendas de hoje'
        : 'Administração Geral Liberada';
    }
    if (caixaDescEl) {
      caixaDescEl.textContent = isDriver ? 'Aceitar pedidos, abrir a rota e confirmar entregas' : isCaixa
        ? 'Acesso estrito às suas vendas e números de hoje'
        : 'Frente de Caixa Geral e Balcão';
    }

    // Se for CAIXA: Esconde completamente todas as ferramentas de administração e Looker
    if (adminSection) {
      adminSection.style.display = isAdmin ? 'block' : 'none';
    }

    if (teamLinkCaixa) {
      teamLinkCaixa.href = '/caixa?operatorName=' + encodeURIComponent(currentOperator.name) + '&userId=' + encodeURIComponent(currentOperator.id);
    }
  }

  function openDrawer() {
    overlay.classList.remove('hidden');
    window.requestAnimationFrame(() => {
      sheet.classList.add('active');
    });
  }

  function closeDrawer() {
    sheet.classList.remove('active');
    setTimeout(() => {
      overlay.classList.add('hidden');
    }, 250);
  }

  drawerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openDrawer();
  });

  if (closeBtn) {closeBtn.addEventListener('click', closeDrawer);}
  if (backToShopBtn) {backToShopBtn.addEventListener('click', closeDrawer);}

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {closeDrawer();}
  });

  // Troca de operador
  if (switchOpBtn && opSelectorBox) {
    switchOpBtn.addEventListener('click', async () => {
      opSelectorBox.classList.toggle('hidden');
      if (!opSelectorBox.classList.contains('hidden')) {
        await populateOperatorList();
      }
    });
  }

  if (cancelOpBtn && opSelectorBox) {
    cancelOpBtn.addEventListener('click', () => {
      opSelectorBox.classList.add('hidden');
    });
  }

  async function populateOperatorList() {
    if (!selectUser) {return;}
    selectUser.innerHTML = '<option value="">Carregando operadores...</option>';
    try {
      const res = await fetch('/api/admin/auth/users');
      if (res.ok) {
        const users = await res.json();
        if (Array.isArray(users) && users.length > 0) {
          selectUser.innerHTML = users.map(u => `
            <option value="${u.id}" data-name="${u.name}" data-role="${u.role}" ${u.name === currentOperator.name ? 'selected' : ''}>
              ${u.role === 'ADMIN' ? '👑' : '👤'} ${u.name} (${u.role})
            </option>
          `).join('');
          return;
        }
      }
    } catch {
      // ignore
    }

    // Fallback padrão de operadores
    selectUser.innerHTML = `
      <option value="op-caixa-1" data-name="Atendente Caixa" data-role="CAIXA">👤 Atendente Caixa (CAIXA)</option>
      <option value="op-caixa-2" data-name="Edmar Júnio" data-role="CAIXA">👤 Edmar Júnio (CAIXA)</option>
      <option value="op-admin" data-name="Administrador Conflora" data-role="ADMIN">👑 Administrador (ADMIN)</option>
    `;
  }

  if (confirmOpBtn && selectUser) {
    confirmOpBtn.addEventListener('click', () => {
      const opt = selectUser.selectedOptions[0];
      if (!opt) {return;}
      const name = opt.getAttribute('data-name') || opt.textContent.trim();
      const role = opt.getAttribute('data-role') || 'CAIXA';
      const id = selectUser.value;

      currentOperator = { name, role, id };
      localStorage.setItem('conflora_operator_name', name);
      localStorage.setItem('conflora_operator_role', role);
      localStorage.setItem('conflora_operator_id', id);

      updateDrawerUI();
      opSelectorBox.classList.add('hidden');
    });
  }

  // Abertura do modal de produtos via botão do drawer
  if (openEntryBtn) {
    openEntryBtn.addEventListener('click', () => {
      closeDrawer();
      const dlg = document.getElementById('productEntryDialog');
      if (dlg && typeof dlg.showModal === 'function') {
        dlg.showModal();
      }
    });
  }

  loadCurrentOperator();
}
