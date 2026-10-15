import { onLanguageChange } from './i18n/index.js';
import { storeQueries } from './query/tanstackQuery.js';
import { appStore } from './store/index.js';

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

  if (!drawerBtn || !overlay || !sheet) {
    return;
  }

  let currentOperator = {
    name: 'Atendente Caixa',
    role: 'CAIXA',
    id: '',
  };

  // Re-render UI on language switch
  onLanguageChange(() => {
    updateDrawerUI();
  });

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
          appStore.getState().setUser(currentOperator);
          updateDrawerUI();
          return;
        }
      }
    } catch {
      // Ignora erro e usa fallback
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
      appStore.getState().setUser(currentOperator);
    }
    updateDrawerUI();
  }

  function updateDrawerUI() {
    const isCaixa = String(currentOperator.role).toUpperCase() === 'CAIXA';
    const isAdmin = String(currentOperator.role).toUpperCase() === 'ADMIN';

    const opNameEl = document.getElementById('teamOpName');
    const opBadgeEl = document.getElementById('teamOpRoleBadge');
    const subtitleEl = document.getElementById('teamOperatorSubtitle');
    const caixaDescEl = document.getElementById('teamCaixaScopeDesc');

    if (opNameEl) {
      opNameEl.textContent = currentOperator.name;
    }
    if (opBadgeEl) {
      opBadgeEl.textContent = isCaixa ? 'team.role_cashier'.tr : (isAdmin ? 'team.role_admin'.tr : 'team.operator'.tr);
      opBadgeEl.className = 'team-role-badge ' + (isAdmin ? 'admin' : 'caixa');
    }
    if (subtitleEl) {
      subtitleEl.textContent = isCaixa
        ? 'team.cashier_desc'.tr
        : 'team.admin_full_desc'.tr;
    }
    if (caixaDescEl) {
      caixaDescEl.textContent = 'team.cashier_desc'.tr;
    }

    // Se for CAIXA: Esconde completamente todas as ferramentas de administração e Looker
    if (adminSection) {
      adminSection.style.display = isCaixa ? 'none' : 'block';
    }

    if (teamLinkCaixa) {
      teamLinkCaixa.href = '/caixa?operatorName=' + encodeURIComponent(currentOperator.name) + '&userId=' + encodeURIComponent(currentOperator.id);
    }
  }

  function openDrawer() {
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
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

  if (closeBtn) {
    closeBtn.addEventListener('click', closeDrawer);
  }
  if (backToShopBtn) {
    backToShopBtn.addEventListener('click', closeDrawer);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeDrawer();
    }
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
    if (!selectUser) {
      return;
    }
    selectUser.innerHTML = `<option value="">${'common.loading'.tr}</option>`;
    try {
      // Use TanStack Query cache for team users
      const users = await storeQueries.getTeamUsers();
      if (Array.isArray(users) && users.length > 0) {
        selectUser.innerHTML = users.map((u) => `
          <option value="${u.id}" data-name="${u.name}" data-role="${u.role}" ${u.name === currentOperator.name ? 'selected' : ''}>
            ${u.role === 'ADMIN' ? '👑' : '👤'} ${u.name} (${u.role})
          </option>
        `).join('');
        return;
      }
    } catch {
      // Ignora erro e usa fallback
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
      if (!opt) {
        return;
      }
      const name = opt.getAttribute('data-name') || opt.textContent.trim();
      const role = opt.getAttribute('data-role') || 'CAIXA';
      const id = selectUser.value;

      currentOperator = { name, role, id };
      localStorage.setItem('conflora_operator_name', name);
      localStorage.setItem('conflora_operator_role', role);
      localStorage.setItem('conflora_operator_id', id);

      appStore.getState().setUser(currentOperator);
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
