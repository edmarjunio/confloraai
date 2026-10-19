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

  const ownerQuickSwitchBox = document.getElementById('ownerQuickSwitchBox');
  const pinInput = document.getElementById('teamPinInput');

  let currentOperator = {
    name: 'Não autenticado',
    role: 'VISITANTE',
    id: '',
    canSwitchProfiles: false,
  };

  // Carrega operador autenticado exclusivamente da sessão segura do servidor
  async function loadCurrentOperator() {
    try {
      const res = await window.ConfloraSession.apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          currentOperator = {
            name: data.user.name || 'Colaborador',
            role: data.user.role || 'CAIXA',
            id: data.user.id || '',
            canSwitchProfiles: Boolean(data.user.canSwitchProfiles),
          };
          updateDrawerUI();
          return;
        }
      }
    } catch {
      // ignore
    }

    currentOperator = {
      name: 'Não autenticado',
      role: 'VISITANTE',
      id: '',
      canSwitchProfiles: false,
    };
    updateDrawerUI();
  }

  function updateDrawerUI() {
    const roleUpper = String(currentOperator.role).toUpperCase();
    const isDriver = roleUpper === 'ENTREGADOR';
    const isSeller = roleUpper === 'VENDEDOR';
    const isCaixa = roleUpper === 'CAIXA';
    const isAdmin = roleUpper === 'ADMIN';

    const opNameEl = document.getElementById('teamOpName');
    const opBadgeEl = document.getElementById('teamOpRoleBadge');
    const subtitleEl = document.getElementById('teamOperatorSubtitle');
    const caixaDescEl = document.getElementById('teamCaixaScopeDesc');

    if (opNameEl) {opNameEl.textContent = currentOperator.name;}
    if (opBadgeEl) {
      opBadgeEl.textContent = isDriver
        ? 'CARGO: ENTREGADOR'
        : isSeller
          ? 'CARGO: VENDEDOR'
          : isCaixa
            ? 'CARGO: CAIXA'
            : isAdmin
              ? 'CARGO: ADMIN'
              : 'FAÇA LOGIN COM PIN';
      opBadgeEl.className = 'team-role-badge ' + (isAdmin ? 'admin' : 'caixa');
    }
    if (subtitleEl) {
      subtitleEl.textContent = isDriver
        ? 'Entregas e recebimentos na rota'
        : isSeller
          ? 'Vendedor · Comandas e Pix'
          : isCaixa
            ? 'Caixa Liberado · Acesso exclusivo às suas vendas de hoje'
            : isAdmin
              ? 'Administração Geral Liberada'
              : 'Identifique seu cargo com PIN';
    }
    if (caixaDescEl) {
      caixaDescEl.textContent = isDriver
        ? 'Aceitar pedidos, abrir a rota e confirmar entregas'
        : isSeller
          ? 'Atendimento, geração de comandas e Pix'
          : isCaixa
            ? 'Acesso estrito às suas vendas e números de hoje'
            : 'Frente de Caixa Geral e Balcão';
    }

    if (ownerQuickSwitchBox) {
      ownerQuickSwitchBox.classList.toggle('hidden', !currentOperator.canSwitchProfiles);
      ownerQuickSwitchBox.querySelectorAll('.owner-role-btn').forEach((btn) => {
        const isCurrent = btn.getAttribute('data-role') === roleUpper;
        btn.style.background = isCurrent ? '#15803d' : '#fff';
        btn.style.color = isCurrent ? '#fff' : '#1f2937';
      });
    }

    // Se não for ADMIN: Esconde completamente todas as ferramentas de administração e Looker
    if (adminSection) {
      adminSection.style.display = isAdmin ? 'block' : 'none';
    }

    if (teamLinkCaixa) {
      teamLinkCaixa.href = '/caixa?operatorName=' + encodeURIComponent(currentOperator.name) + '&userId=' + encodeURIComponent(currentOperator.id);
    }
  }

  if (ownerQuickSwitchBox) {
    ownerQuickSwitchBox.querySelectorAll('.owner-role-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetRole = btn.getAttribute('data-role');
        if (!targetRole) return;
        try {
          const res = await window.ConfloraSession.apiFetch('/api/auth/switch-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: targetRole }),
          });
          const data = await res.json();
          if (res.ok && data.success && data.user) {
            currentOperator = {
              name: data.user.name || 'Edmar Júnio',
              role: data.user.role,
              id: data.user.id,
              canSwitchProfiles: Boolean(data.user.canSwitchProfiles),
            };
            updateDrawerUI();
          } else {
            alert(data.error || 'Não foi possível alternar o perfil.');
          }
        } catch {
          alert('Erro de conexão ao alternar perfil.');
        }
      });
    });
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
      const res = await window.ConfloraSession.apiFetch('/api/admin/auth/users');
      if (res.ok) {
        const users = await res.json();
        if (Array.isArray(users) && users.length > 0) {
          selectUser.replaceChildren(...users.map(user => {
            const option = document.createElement('option'); option.value = user.id;
            option.dataset.name = user.name; option.dataset.role = user.role;
            option.textContent = `${user.name} (${user.role})`; option.selected = user.name === currentOperator.name;
            return option;
          }));
          return;
        }
      }
    } catch {
      // ignore
    }

    selectUser.innerHTML = '<option value="">Nenhum operador disponível</option>';
  }

  if (confirmOpBtn && selectUser) {
    confirmOpBtn.addEventListener('click', async () => {
      const opt = selectUser.selectedOptions[0];
      if (!opt || !selectUser.value) {return;}
      const id = selectUser.value;
      const pin = pinInput ? pinInput.value.trim() : '';
      if (!pin) {
        alert('Digite seu PIN de segurança para confirmar o operador.');
        return;
      }

      try {
        const res = await window.ConfloraSession.apiFetch('/api/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: id, pin }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          alert(data.error || 'PIN incorreto.');
          return;
        }
        currentOperator = {
          name: data.user.name,
          role: data.user.role,
          id: data.user.id,
          canSwitchProfiles: Boolean(data.user.canSwitchProfiles),
        };
        if (pinInput) pinInput.value = '';
        updateDrawerUI();
        opSelectorBox.classList.add('hidden');
      } catch {
        alert('Erro ao validar PIN no servidor.');
      }
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
