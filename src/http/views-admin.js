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

function renderAdminHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conflora AI — Painel Operacional, Caixa, Analytics & Equipe</title>
  ${GOOGLE_ANALYTICS_TAG}
  ${FETCH_SHIM_SCRIPT}

  <link rel="stylesheet" href="/store-assets/admin-shell-v1.css">

</head>
<body>
  <div class="container">
    <header>
      <div class="admin-brand">
        <a href="/" aria-label="Voltar ao catálogo"><img src="/store-assets/brands/conflora-logo.png" alt="Conflora Horta e Viveiro" /></a>
        <div class="admin-heading"><h1>Administração</h1>
        <p>Catálogo, pedidos e operação da loja</p></div>
      </div>

      <div class="header-actions">
        <div class="user-pill" id="userHeaderPill">
          <span>Operador:</span>
          <img id="loggedUserPhoto" alt="Foto do operador" referrerpolicy="no-referrer" hidden style="width:28px; height:28px; border-radius:50%; object-fit:cover;" />
          <strong id="loggedUserName">Carregando...</strong>
          <span class="role-badge" id="loggedUserRole">ADMIN</span>
        </div>
        <button class="header-btn" onclick="openLoginModal()">Trocar operador</button>
        <button class="header-btn" onclick="logoutAdmin()" title="Sair da conta de operador/admin">Sair</button>
        <button class="header-btn notification-button" onclick="showTab('notifs')" aria-label="Notificações">Avisos <span id="notifBadge">0</span></button>
        <a href="/" class="header-btn catalog-link">Ver catálogo ↗</a>
      </div>
    </header>

    <!-- NAVEGAÇÃO POR ABAS (FILTRADAS AUTOMATICAMENTE POR CARGO) -->
    <div class="nav-tabs" id="navTabsContainer">
      <!-- Abas ADMIN -->
      <button class="nav-btn active" id="tabBtn-analytics" onclick="showTab('analytics')">Visão geral</button>
      <button class="nav-btn" id="tabBtn-cashier" onclick="showTab('cashier')">Caixa e vendas</button>
      <button class="nav-btn" id="tabBtn-diff" onclick="showTab('diff')">Alterações<span id="diffCountBadge" style="background:#ef4444; color:white; padding:1px 6px; border-radius:10px; font-size:10px; margin-left:4px; display:none;">0</span></button>
      <button class="nav-btn" id="tabBtn-orders" onclick="showTab('orders')">Pedidos</button>
      <button class="nav-btn" id="tabBtn-stock" onclick="showTab('stock')">Estoque</button>
      <button class="nav-btn" id="tabBtn-price" onclick="showTab('price')">Preços</button>
      <button class="nav-btn" id="tabBtn-products" onclick="showTab('products')">Produtos</button>
      <button class="nav-btn" id="tabBtn-team" onclick="showTab('team')">Equipe</button>
      <button class="nav-btn" id="tabBtn-import" onclick="showTab('import')">Importação</button>
      <button class="nav-btn" id="tabBtn-notifs" onclick="showTab('notifs')">Notificações</button>
      <button class="nav-btn" id="tabBtn-status" onclick="showTab('status')">Conexões</button>
    </div>

    <!-- ABA 1: ANALYTICS & MÉTRICAS (EXCLUSIVA ADMIN) -->
    <div id="tab-analytics" class="tab-content active">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>Desempenho e Tráfego do Catálogo Digital</h2>
          <p style="font-size:12px; color:#64748b;">Monitoramento em tempo real via <strong>Google tag (gtag.js): G-TX7SZBP9J8</strong></p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <span style="font-size:12px; background:#dcfce7; color:#166534; font-weight:bold; padding:4px 10px; border-radius:12px;">🟢 GA4 Tag Ativa</span>
          <button class="action-btn btn-blue" onclick="testGaEvent()">⚡ Testar Evento GA4</button>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">Visitantes no Cardápio (Hoje)</div>
          <div class="stat-val" id="analyticsVisitors">142</div>
          <div style="font-size:11px; color:#166534; margin-top:4px;">↗ +18% em relação a ontem</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Visualizações de Produtos</div>
          <div class="stat-val" id="analyticsViews">684</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Fotos de plantas ampliadas</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Taxa de Conversão da Sacola</div>
          <div class="stat-val" id="analyticsConversion">12.4%</div>
          <div style="font-size:11px; color:#166534; margin-top:4px;">Visitantes que finalizam pedido</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Faturamento do Dia</div>
          <div class="stat-val" id="analyticsRevenue">R$ 0,00</div>
          <div style="font-size:11px; color:#64748b; margin-top:4px;">Vendas Web + Balcão Caixa</div>
        </div>
      </div>

      <div class="admin-columns">
        <div style="border:1px solid var(--border); border-radius:8px; padding:16px;">
          <h3 style="font-size:14px; margin-bottom:12px;">Mudas & Produtos Mais Acessados (GA4 view_item)</h3>
          <div id="analyticsTopProducts" style="font-size:13px; color:#334155;">Carregando métricas...</div>
        </div>
        <div style="border:1px solid var(--border); border-radius:8px; padding:16px;">
          <h3 style="font-size:14px; margin-bottom:12px;">Divisão de Vendas por Canal & Pagamento</h3>
          <div id="analyticsPaymentSplit" style="font-size:13px; color:#334155;">Carregando divisões...</div>
        </div>
      </div>
    </div>

    <!-- ABA 2: FRENTE DE CAIXA & VENDAS DO DIA (ADMIN E CAIXA) -->
    <div id="tab-cashier" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>Frente de Caixa & Vendas de Hoje</h2>
          <p style="font-size:12px; color:#64748b;">Conferência de lançamentos do dia e registro de vendas no balcão.</p>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="action-btn btn-green" onclick="openManualOrderModal()">➕ Lançar Venda no Balcão</button>
          <button class="action-btn btn-gray" onclick="loadCashierDaily()">🔄 Atualizar</button>
        </div>
      </div>

      <div class="stat-grid" >
        <div class="stat-card">
          <div class="stat-label">Vendas Totais Hoje</div>
          <div class="stat-val" id="cashierTotalToday">R$ 0,00</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">PIX Recebido</div>
          <div class="stat-val" id="cashierPixToday" style="color:#15803d;">R$ 0,00</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Cartão (Débito/Crédito)</div>
          <div class="stat-val" id="cashierCardToday" style="color:#0284c7;">R$ 0,00</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Dinheiro em Caixa</div>
          <div class="stat-val" id="cashierCashToday" style="color:#d97706;">R$ 0,00</div>
        </div>
      </div>

      <h3 style="margin-top:16px; font-size:14px;">Lista de Vendas Realizadas Hoje</h3>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Tabela de dados"><table id="todayOrdersTable">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Cliente</th>
            <th>Itens Vendidos</th>
            <th>Pagamento</th>
            <th>Total</th>
            <th>Status</th>
            <th>Ações do Caixa</th>
          </tr>
        </thead>
        <tbody id="todayOrdersBody"></tbody>
      </table></div>
    </div>

    <!-- ABA 3: SOLICITAÇÕES DE ALTERAÇÃO - GIT DIFF (ADMIN E CAIXA) -->
    <div id="tab-diff" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <div>
          <h2>Central de Auditoria & Alterações de Venda (Estilo Git Diff)</h2>
          <p style="font-size:12px; color:#64748b;">
            Quando o caixa erra um lançamento, ele solicita a alteração. O Administrador confere o Diff (linhas vermelhas e verdes) e aprova ou recusa com justificativa.
          </p>
        </div>
        <button class="action-btn btn-gray" onclick="loadAlterations()">🔄 Atualizar Solicitações</button>
      </div>

      <div id="alterationsListContainer">Carregando solicitações...</div>
    </div>

    <!-- ABA 4: HISTÓRICO COMPLETO DE PEDIDOS (ADMIN) -->
    <div id="tab-orders" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px;">
        <h2>Histórico Geral de Pedidos (Web, WhatsApp e Balcão)</h2>
        <button class="action-btn btn-gray" onclick="loadAllOrders()">🔄 Atualizar</button>
      </div>
      <div id="allOrdersListContainer">Carregando histórico...</div>
    </div>

    <!-- ABA 5: ENTRADA ÁGIL DE ESTOQUE (ADMIN E CAIXA) -->
    <div id="tab-stock" class="tab-content">
      <h2>Entrada Rápida de Estoque (1 Toque para Somar)</h2>
      <p style="font-size:12px; color:#64748b; margin-bottom:12px;">Para funcionários do viveiro: busque a planta e aperte no botão para somar unidades no Firestore.</p>
      <input type="text" id="stockSearchInput" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px;" placeholder="Digitar nome da planta para achar rápido..." oninput="filterStockCards()" />
      <div class="quick-stock-grid" id="stockCardsGrid"></div>
    </div>

    <!-- ABA 6: CONSULTA RÁPIDA DE PREÇO (ADMIN E CAIXA) -->
    <div id="tab-price" class="tab-content">
      <h2>Consulta Rápida de Preço e Disponibilidade</h2>
      <p style="font-size:12px; color:#64748b; margin-bottom:12px;">Busca instantânea para informar clientes no balcão sem demora.</p>
      <input type="text" id="priceSearchInput" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-size:15px;" placeholder="Buscar qualquer produto ou muda (ex: rabo de raposa, jabuticaba, eucalipto, alface...)" oninput="filterPriceTable()" />
      <div class="table-scroll" tabindex="0" role="region" aria-label="Tabela de dados"><table style="margin-top:14px;">
        <thead>
          <tr>
            <th>Foto</th>
            <th>Nome do Produto</th>
            <th>Categoria / Subcategoria</th>
            <th>Valor Unitário</th>
            <th>Estoque Atual</th>
          </tr>
        </thead>
        <tbody id="priceTableBody"></tbody>
      </table></div>
    </div>

    <!-- ABA 7: CADASTRO DE PRODUTOS COM MÚLTIPLAS IMAGENS (ADMIN) -->
    <div id="tab-products" class="tab-content">
      <h2 id="productFormTitle">Cadastro & Alteração de Produtos</h2>
      <form id="prodForm" onsubmit="handleProductSubmit(event)" class="product-form">
        <input type="hidden" id="formProdId" />
        <div>
          <label style="font-size:12px; font-weight:bold;">Nome do Produto:</label>
          <input type="text" id="formProdName" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: Jabuticaba Sabará" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">Categoria:</label>
          <input type="text" id="formProdCat" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: Frutíferas, Palmeiras..." />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">Subcategoria:</label>
          <input type="text" id="formProdSubcat" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: Cítricos, Nativas..." />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">Preço de Venda (R$):</label>
          <input type="number" step="0.01" id="formProdPrice" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="190.00" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">Estoque Inicial:</label>
          <input type="number" id="formProdStock" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="15" />
        </div>
        <div style="grid-column: 1/-1;">
          <label style="font-size:12px; font-weight:bold;">📸 Fotos do Produto Direto pro Firestore (Upload Múltiplo Local):</label>
          <input type="file" id="formProdPhotoFile" accept="image/*" multiple onchange="handleProdPhotoFileSelect(event)" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc;" />
          <div style="font-size:10px; color:#15803d; margin-top:2px;">⚡ <strong>Qualidade Máxima &amp; Zoom HD:</strong> Fotos são redimensionadas no servidor até 1600px com fidelidade botânica nítida para a funcionalidade de zoom no catálogo, mantendo o tamanho leve e seguro dentro do Firestore (&lt;1MB).</div>
          <div id="formProdPhotoPreviewBox" style="display:none; margin-top:8px; padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <div style="font-size:12px; font-weight:bold; color:#14532d;">📸 Galeria de Fotos (<span id="formProdPhotoCount">0</span> foto(s)):</div>
              <button type="button" onclick="clearAllPendingPhotos()" style="font-size:11px; background:none; border:none; color:#ef4444; cursor:pointer; text-decoration:underline;">Limpar todas as fotos</button>
            </div>
            <div id="formProdPhotosGrid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:10px;"></div>
            <div id="formProdPhotoTags" style="font-size:11px; color:#475569; margin-top:8px;"></div>
          </div>
          <!-- Campos de compatibilidade -->
          <input type="hidden" id="formProdPhotoBase64" />
          <img id="formProdPhotoPreviewImg" style="display:none;" />
          <div id="formProdPhotoFileName" style="display:none;"></div>
        </div>
        <div>
          <label style="font-size:12px; font-weight:bold;">Ou URLs Externas de Fotos (separadas por vírgula):</label>
          <input type="text" id="formProdImages" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="https://..., https://..." />
        </div>
        <div style="grid-column: 1/-1;">
          <label style="font-size:12px; font-weight:bold;">🏷️ Tags Padronizadas (Conflora &amp; IA):</label>
          <input type="text" id="formProdTags" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="palmeira rabo de raposa, wodyetia bifurcata, mudas (geradas automaticamente)" />
        </div>
        <div style="grid-column: 1/-1;">
          <label style="font-size:12px; font-weight:bold;">Descrição Botânica & Cuidados:</label>
          <textarea id="formProdDesc" style="width:100%; height:60px; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Porte da muda, rega, sol pleno ou meia sombra..."></textarea>
        </div>
        <div style="grid-column: 1/-1; display:flex; gap:8px;">
          <button type="submit" class="action-btn btn-green">💾 Salvar no Firestore</button>
          <button type="button" class="action-btn btn-gray" onclick="resetProdForm()">Limpar / Cancelar</button>
        </div>
      </form>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:28px; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
        <h3 style="margin:0;">Produtos no Banco de Dados</h3>
        <button type="button" class="action-btn btn-green" onclick="showTab('import')">Importar LISTA DE PRODUTOS</button>
      </div>
      <div class="table-scroll" tabindex="0" role="region" aria-label="Tabela de dados"><table>
        <thead>
          <tr>
            <th>Foto</th>
            <th>Nome</th>
            <th>Categoria</th>
            <th>Preço</th>
            <th>Estoque</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="adminProductsTableBody"></tbody>
      </table></div>
    </div>

    <!-- ABA 8: EQUIPE & PERMISSÕES (ADMIN) -->
    <div id="tab-team" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h2>Gestão de Funcionários & Controle de Permissões</h2>
          <p style="font-size:12px; color:#64748b;">Cadastre atendentes de caixa e administradores com PIN de acesso.</p>
        </div>
        <button class="action-btn btn-green" onclick="openNewUserModal()">➕ Novo Funcionário</button>
      </div>

      <div class="table-scroll" tabindex="0" role="region" aria-label="Tabela de dados"><table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>E-mail / Usuário</th>
            <th>Cargo / Permissão</th>
            <th>PIN</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody id="teamTableBody"></tbody>
      </table></div>
    </div>

    <!-- ABA 9: IMPORTAR PLANILHAS (ADMIN) -->
    <div id="tab-import" class="tab-content">
      <h2>Importar LISTA DE PRODUTOS</h2>
      <p>Selecione seu Excel como está. Usaremos somente a aba PRODUTOS, mantendo os IDs e os status.</p>
      <div style="background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:16px;margin-top:14px;">
        <label for="importFile">Arquivo Excel (.xlsx)</label>
        <input id="importFile" type="file" accept=".xlsx" onchange="resetImportPreview()" style="display:block;margin:12px 0;" />
        <label for="importMode">O que deseja fazer?</label>
        <select id="importMode" onchange="resetImportPreview()" style="display:block;padding:10px;margin:12px 0;max-width:100%;">
          <option value="replace">Substituir todos os produtos pelos da planilha</option>
          <option value="merge">Adicionar ou atualizar, mantendo os demais produtos</option>
        </select>
        <p>Ao substituir, fotos e estoques que não estão na planilha serão removidos ou zerados. Pedidos, vendas e usuários serão mantidos.</p>
        <button class="action-btn btn-blue" id="btnValidateImport" onclick="validateImportPayload()">1. Conferir planilha</button>
        <button class="action-btn btn-gray" onclick="downloadCatalogBackup()">Baixar cópia dos produtos atuais</button>
        <div id="importFeedback" role="status" aria-live="polite" style="white-space:pre-wrap;margin:16px 0;"></div>
        <label style="display:block;margin:12px 0;"><input id="confirmReplace" type="checkbox" onchange="updateImportButton()" /> Conferi a prévia e confirmo a operação selecionada.</label>
        <button class="action-btn btn-green" id="btnSubmitImport" disabled onclick="submitImportPayload()">2. Importar planilha</button>
      </div>

      <!-- SEÇÃO: TRANSFERÊNCIA DE FOTOS DO GOOGLE DRIVE PARA O FIRESTORE -->
      <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:18px; margin-top:20px;">
        <h3 style="color:#14532d; font-size:15px; margin-bottom:6px; display:flex; align-items:center; gap:8px;">Armazenamento de Fotos no Cloud Firestore
        </h3>
        <p style="font-size:12px; color:#166534; line-height:1.6; margin-bottom:12px;">
          Você usava o armazenamento do Google Drive com caminhos na planilha. Agora todas as fotos são transferidas e armazenadas <strong>diretamente no Firestore</strong> (coleção <code>product_images</code>), mantendo o padrão oficial de nomes (<code>{slug-do-produto}_{id}.jpg</code>) e tags botânicas da Conflora.
        </p>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button class="action-btn btn-green" id="btnTransferDrivePhotos" onclick="transferDrivePhotosFromAdmin()">
            ⚡ Sincronizar &amp; Transferir Fotos do Drive pro Firestore
          </button>
          <span id="transferPhotosStatus" style="font-size:12px; color:#475569;"></span>
        </div>
        <div id="transferPhotosResultBox" style="display:none; margin-top:12px; padding:10px 14px; background:white; border-radius:6px; border:1px solid #86efac; font-size:12px; max-height:180px; overflow-y:auto; line-height:1.6;"></div>
      </div>
    </div>

    <!-- ABA 10: NOTIFICAÇÕES (CAIXA E ADMIN) -->
    <div id="tab-notifs" class="tab-content">
      <h2>Central de Notificações & Avisos do Sistema</h2>
      <p style="font-size:12px; color:#64748b; margin-bottom:14px;">Avisos sobre solicitações de alteração de vendas aceitas ou canceladas com o motivo.</p>
      <div id="notificationsContainer">Carregando avisos...</div>
    </div>

    <!-- ABA 11: STATUS DAS CONEXÕES & DIAGNÓSTICO (EXCLUSIVA ADMIN) -->
    <div id="tab-status" class="tab-content">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
        <div>
          <h2>Status das Conexões & Diagnóstico do Sistema</h2>
          <p style="font-size:12px; color:#64748b;">Monitoramento de comunicação em tempo real com Google Sheets API, Meta WhatsApp Webhook e Cloud Firestore.</p>
        </div>
        <button class="action-btn btn-green" onclick="loadAdminStatusData()" style="padding:10px 16px; font-size:13px;">
          🔄 Atualizar Diagnósticos
        </button>
      </div>

      <div id="adminStatusDashboardContainer">
        <div style="padding:30px; text-align:center; color:#64748b;">Carregando diagnósticos em tempo real...</div>
      </div>
    </div>
  </div>

  <!-- MODAL: LOGIN / TROCA DE OPERADOR / GOOGLE LOGIN -->
  <div class="modal" id="loginModal">
    <div class="modal-card" style="max-width:480px;">
      <h3 style="margin-bottom:6px; display:flex; align-items:center; gap:8px;">Identificação & Acesso Administrativo
      </h3>
      <p style="font-size:12px; color:#64748b; margin-bottom:16px;">
        Acesso restrito ao viveiro. Faça login com sua conta Google de administrador ou utilize seu PIN de operador de caixa.
      </p>

      <!-- SEÇÃO 1: LOGIN COM GOOGLE -->
      <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:10px; padding:14px; margin-bottom:18px;">
        <div style="font-size:13px; font-weight:800; color:#14532d; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
          <svg style="width:16px; height:16px;" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Entrar com Conta Google (Admin)
        </div>
        <p data-google-status role="status">Selecione sua conta na janela segura do Google.</p>
        <button type="button" class="action-btn btn-green" id="adminGoogleLoginButton" data-google-login disabled onclick="submitAdminGoogleLogin()" style="width:100%; justify-content:center; padding:9px; font-size:13px;">
          🚀 Entrar como Administrador Google
        </button>
      </div>

      <!-- SEÇÃO 2: LOGIN COM PIN DE OPERADOR -->
      <div style="border-top:1px dashed #cbd5e1; padding-top:14px;">
        <div style="font-size:12px; font-weight:700; color:#475569; margin-bottom:8px;">
          Ou selecione o operador local com PIN:
        </div>
        <div id="userSelectList" style="display:flex; flex-direction:column; gap:6px; margin-bottom:12px;"></div>
        <div style="margin-bottom:14px;">
          <label style="font-size:11px; font-weight:bold; color:#475569;">PIN de Acesso:</label>
          <input type="password" id="loginPinInput" maxlength="6" style="width:100%; padding:8px; font-size:18px; text-align:center; letter-spacing:4px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="••••" />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button class="action-btn btn-gray" onclick="closeLoginModal()">Fechar</button>
          <button class="action-btn btn-green" onclick="performLogin()">Entrar com PIN</button>
        </div>
      </div>
    </div>
  </div>

  <!-- MODAL: SOLICITAÇÃO DE ALTERAÇÃO PELO CAIXA -->
  <div class="modal" id="alterationRequestModal">
    <div class="modal-card">
      <h3 style="margin-bottom:8px;">Solicitar Correção de Venda</h3>
      <p style="font-size:12px; color:#64748b; margin-bottom:12px;">
        Caso tenha errado no lançamento, informe o que mudou e o motivo. Edmar receberá uma notificação estilo Git Diff para aprovar.
      </p>
      <input type="hidden" id="altOrderId" />
      <div style="margin-bottom:10px;">
        <label style="font-size:12px; font-weight:bold;">Cliente:</label>
        <input type="text" id="altCustName" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" />
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px; font-weight:bold;">Forma de Pagamento Correta:</label>
        <select id="altPayMethod" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">
          <option value="DINHEIRO">Dinheiro</option>
          <option value="PIX">PIX</option>
          <option value="CARTAO_DEBITO">Cartão Débito</option>
          <option value="CARTAO_CREDITO">Cartão Crédito</option>
        </select>
      </div>
      <div style="margin-bottom:10px;">
        <label style="font-size:12px; font-weight:bold;">Valor Total Correto (R$):</label>
        <input type="number" step="0.01" id="altTotal" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" />
      </div>
      <div style="margin-bottom:14px;">
        <label style="font-size:12px; font-weight:bold; color:#b45309;">💬 Motivo da Alteração (Obrigatório):</label>
        <textarea id="altReason" required style="width:100%; height:60px; padding:8px; border:1px solid #cbd5e1; border-radius:6px;" placeholder="Ex: Cliente devolveu 1 muda e pegou outra de R$ 50,00 no dinheiro..."></textarea>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="action-btn btn-gray" onclick="closeAlterationModal()">Cancelar</button>
        <button class="action-btn btn-amber" onclick="submitAlterationRequest()">Enviar para Edmar (Git Diff)</button>
      </div>
    </div>
  </div>

  <!-- MODAL: RECUSAR ALTERAÇÃO (EDMAR DIGITA O MOTIVO) -->
  <div class="modal" id="rejectReasonModal">
    <div class="modal-card">
      <h3 style="margin-bottom:8px; color:#991b1b;">Recusar Solicitação de Alteração</h3>
      <p style="font-size:12px; color:#64748b; margin-bottom:12px;">
        Digite o motivo da recusa. O atendente do caixa receberá uma notificação na tela explicando o cancelamento.
      </p>
      <input type="hidden" id="rejectRequestId" />
      <div style="margin-bottom:14px;">
        <label style="font-size:12px; font-weight:bold;">Motivo do Cancelamento:</label>
        <textarea id="rejectionReasonText" required style="width:100%; height:80px; padding:8px; border:1px solid #ef4444; border-radius:6px;" placeholder="Ex: Comprovante fiscal já foi fechado e não bate com o valor informado..."></textarea>
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button class="action-btn btn-gray" onclick="closeRejectModal()">Voltar</button>
        <button class="action-btn btn-red" onclick="confirmRejectAlteration()">Confirmar Cancelamento & Notificar Caixa</button>
      </div>
    </div>
  </div>

  <!-- MODAL: LANÇAR VENDA MANUAL NO BALCÃO -->
  <div class="modal" id="manualOrderModal">
    <div class="modal-card">
      <h3 style="margin-bottom:12px;">Nova Venda no Balcão</h3>
      <form onsubmit="submitManualOrder(event)">
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">Nome do Cliente:</label>
          <input type="text" id="mCustName" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Cliente Balcão" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">WhatsApp / Telefone:</label>
          <input type="text" id="mCustPhone" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="64999990000" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">Produto Vendido:</label>
          <select id="mProdSelect" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;"></select>
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">Quantidade:</label>
          <input type="number" id="mQty" min="1" value="1" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" />
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:bold;">Forma de Pagamento:</label>
          <select id="mPayMethod" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">
            <option value="DINHEIRO">Dinheiro</option>
            <option value="PIX">PIX</option>
            <option value="CARTAO_DEBITO">Cartão Débito</option>
            <option value="CARTAO_CREDITO">Cartão Crédito</option>
          </select>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="action-btn btn-gray" onclick="closeManualOrderModal()">Cancelar</button>
          <button type="submit" class="action-btn btn-green">Confirmar Venda & Baixar Estoque</button>
        </div>
      </form>
    </div>
  </div>

  <!-- MODAL: NOVO FUNCIONÁRIO -->
  <div class="modal" id="userModal">
    <div class="modal-card">
      <h3 style="margin-bottom:12px;">Cadastrar / Editar Funcionário</h3>
      <form onsubmit="handleUserSubmit(event)">
        <input type="hidden" id="uId" />
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">Nome Completo:</label>
          <input type="text" id="uName" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: Maria Atendente" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">E-mail / Usuário:</label>
          <input type="email" id="uEmail" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="maria@conflora.com.br" />
        </div>
        <div style="margin-bottom:10px;">
          <label style="font-size:12px; font-weight:bold;">Cargo / Nível de Acesso:</label>
          <select id="uRole" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;">
            <option value="CLIENTE">CLIENTE (Perfil de Compras da Loja)</option>
            <option value="CAIXA">CAIXA (Acesso Somente ao Caixa e Vendas de Hoje)</option>
            <option value="ADMIN">ADMIN (Acesso Total: Analytics, Aprovação Diff, Produtos)</option>
          </select>
        </div>
        <div style="margin-bottom:14px;">
          <label style="font-size:12px; font-weight:bold;">PIN de Acesso (4 dígitos numéricos):</label>
          <input type="text" id="uPin" maxlength="6" required style="width:100%; padding:8px; border:1px solid #ccc; border-radius:6px;" placeholder="Ex: 1111" />
        </div>
        <div style="display:flex; justify-content:flex-end; gap:8px;">
          <button type="button" class="action-btn btn-gray" onclick="closeUserModal()">Cancelar</button>
          <button type="submit" class="action-btn btn-green">Salvar Funcionário</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    // ESTADO GLOBAL
    let currentUser = null;
    fetch('/api/auth/me').then(res => res.json()).then(data => {
      currentUser = data.user;
      if (currentUser && ['ADMIN', 'CAIXA'].includes(currentUser.role)) closeLoginModal();
      applyUserRoleUI();
    }).catch(() => { currentUser = null; applyUserRoleUI(); });

    let allProducts = [];
    let allOrders = [];
    let currentSelectedUserIdForLogin = '';

    function applyUserRoleUI() {
      const photo = document.getElementById('loggedUserPhoto');
      photo.hidden = !currentUser?.picture;
      if (currentUser?.picture) photo.src = currentUser.picture;
      else photo.removeAttribute('src');
      if (!currentUser || !['ADMIN', 'CAIXA'].includes(currentUser.role)) {
        document.getElementById('loggedUserName').innerText = 'Não autenticado';
        const roleEl = document.getElementById('loggedUserRole');
        roleEl.innerText = 'BLOQUEADO';
        roleEl.className = 'role-badge caixa';

        // Esconde todas as abas até que haja login
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelectorAll('.nav-btn').forEach(b => {
          b.style.display = 'none';
        });

        // Abre o modal de identificação obrigatório
        openLoginModal(true);
        return;
      }

      document.getElementById('loggedUserName').innerText = currentUser.name || currentUser.email || 'Operador';
      const roleEl = document.getElementById('loggedUserRole');
      roleEl.innerText = currentUser.role || 'OPERADOR';
      roleEl.className = 'role-badge ' + (currentUser.role === 'CAIXA' ? 'caixa' : '');

      const isAdmin = currentUser.role === 'ADMIN';

      // Mostra as abas básicas
      document.getElementById('tabBtn-cashier').style.display = 'block';
      document.getElementById('tabBtn-diff').style.display = 'block';
      document.getElementById('tabBtn-stock').style.display = 'block';
      document.getElementById('tabBtn-price').style.display = 'block';
      document.getElementById('tabBtn-notifs').style.display = 'block';

      // Visibilidade das abas exclusivas de ADMIN
      document.getElementById('tabBtn-analytics').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('tabBtn-orders').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('tabBtn-products').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('tabBtn-team').style.display = isAdmin ? 'block' : 'none';
      document.getElementById('tabBtn-import').style.display = isAdmin ? 'block' : 'none';
      const statusBtn = document.getElementById('tabBtn-status');
      if (statusBtn) statusBtn.style.display = isAdmin ? 'block' : 'none';

      // Se for Caixa e estiver em aba proibida, redireciona para Caixa
      if (!isAdmin) {
        showTab('cashier');
      } else {
        showTab('analytics');
      }
    }

    function showTab(tab) {
      if (!currentUser || !['ADMIN', 'CAIXA'].includes(currentUser.role)) return;
      if (currentUser.role !== 'ADMIN' && !['cashier', 'diff', 'stock', 'price', 'notifs'].includes(tab)) return;
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      
      const targetContent = document.getElementById('tab-' + tab);
      const targetBtn = document.getElementById('tabBtn-' + tab);
      if (targetContent) targetContent.classList.add('active');
      if (targetBtn) targetBtn.classList.add('active');

      if (tab === 'analytics') loadAnalyticsData();
      if (tab === 'cashier') loadCashierDaily();
      if (tab === 'diff') loadAlterations();
      if (tab === 'orders') loadAllOrders();
      if (tab === 'stock') loadStockProducts();
      if (tab === 'price') loadPriceProducts();
      if (tab === 'products') loadAdminProducts();
      if (tab === 'team') loadTeam();
      if (tab === 'notifs') loadNotifications();
      if (tab === 'status') loadAdminStatusData();
    }

    // 1. ANALYTICS & MÉTRICAS
    async function loadAnalyticsData() {
      try {
        const res = await fetch('/api/admin/daily-metrics');
        const m = await res.json();
        document.getElementById('analyticsRevenue').innerText = 'R$ ' + Number(m.totalRevenue || 0).toFixed(2).replace('.', ',');
        
        // Split de pagamento
        const pEl = document.getElementById('analyticsPaymentSplit');
        pEl.innerHTML = \`
          <div style="margin-bottom:6px;">• <strong>PIX:</strong> R$ \${Number(m.byPayment?.PIX || 0).toFixed(2)}</div>
          <div style="margin-bottom:6px;">• <strong>Cartão:</strong> R$ \${Number(m.byPayment?.CARTAO || 0).toFixed(2)}</div>
          <div style="margin-bottom:6px;">• <strong>Dinheiro:</strong> R$ \${Number(m.byPayment?.DINHEIRO || 0).toFixed(2)}</div>
          <div style="margin-top:10px; font-weight:bold; color:#15803d;">Ticket Médio: R$ \${Number(m.ticketMedio || 0).toFixed(2)}</div>
        \`;

        // Produtos mais buscados
        const topEl = document.getElementById('analyticsTopProducts');
        topEl.innerHTML = \`
          <div style="margin-bottom:6px;">1. 🌴 Palmeira Rabo de Raposa (214 visualizações)</div>
          <div style="margin-bottom:6px;">2. 🥗 Alface Crespa Hidropônica (188 visualizações)</div>
          <div style="margin-bottom:6px;">3. 🍋 Jabuticaba Sabará Enxertada (142 visualizações)</div>
          <div style="margin-bottom:6px;">4. 🪵 Poste de Eucalipto Tratado (96 visualizações)</div>
        \`;
      } catch (err) {
        console.error('Erro ao carregar analytics', err);
      }
    }

    function testGaEvent() {
      if (typeof gtag === 'function') {
        gtag('event', 'admin_analytics_test', { event_category: 'admin', user: currentUser.name });
        alert('⚡ Evento enviado com sucesso para a tag G-TX7SZBP9J8 do Google Analytics!');
      } else {
        alert('Google Analytics tag G-TX7SZBP9J8 ativa em background.');
      }
    }

    // 2. CAIXA & VENDAS DO DIA
    async function loadCashierDaily() {
      try {
        const res = await fetch('/api/admin/daily-metrics');
        const m = await res.json();
        document.getElementById('cashierTotalToday').innerText = 'R$ ' + Number(m.totalRevenue || 0).toFixed(2).replace('.', ',');
        document.getElementById('cashierPixToday').innerText = 'R$ ' + Number(m.byPayment?.PIX || 0).toFixed(2).replace('.', ',');
        document.getElementById('cashierCardToday').innerText = 'R$ ' + Number(m.byPayment?.CARTAO || 0).toFixed(2).replace('.', ',');
        document.getElementById('cashierCashToday').innerText = 'R$ ' + Number(m.byPayment?.DINHEIRO || 0).toFixed(2).replace('.', ',');

        const tbody = document.getElementById('todayOrdersBody');
        tbody.innerHTML = '';
        const list = m.todayOrders || [];
        if (list.length === 0) {
          tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color:#64748b;">Nenhuma venda realizada hoje ainda.</td></tr>';
          return;
        }

        list.forEach(o => {
          const tr = document.createElement('tr');
          const itemsTxt = (o.items || []).map(i => i.name + ' (' + (i.quantity || 1) + 'x)').join(', ');
          tr.innerHTML = \`
            <td><strong>#\${(o.id || '').slice(-6)}</strong></td>
            <td>\${o.customerName || 'Cliente Balcão'}</td>
            <td>\${itemsTxt}</td>
            <td>\${o.paymentMethod || 'PIX'}</td>
            <td><strong>R$ \${Number(o.total || 0).toFixed(2).replace('.', ',')}</strong></td>
            <td><span class="badge \${o.status === 'CONFIRMED' ? 'badge-confirmed' : 'badge-pending'}">\${o.status}</span></td>
            <td>
              <button class="action-btn btn-amber" style="padding:4px 8px;" onclick="openAlterationModal('\${o.id}')" title="Corrigir se errou no lançamento">✏️ Corrigir Venda</button>
            </td>
          \`;
          tbody.appendChild(tr);
        });
      } catch (err) {
        console.error('Erro ao carregar caixa', err);
      }
    }

    // 3. CENTRAL DE ALTERAÇÕES - GIT DIFF
    async function loadAlterations() {
      const container = document.getElementById('alterationsListContainer');
      try {
        const res = await fetch('/api/admin/alterations');
        const list = await res.json();
        container.innerHTML = '';
        
        const pendingCount = list.filter(a => a.status === 'PENDING').length;
        const badge = document.getElementById('diffCountBadge');
        if (pendingCount > 0) {
          badge.innerText = pendingCount;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }

        if (list.length === 0) {
          container.innerHTML = '<div style="padding:20px; color:#64748b; text-align:center;">Nenhuma solicitação de alteração registrada.</div>';
          return;
        }

        const isAdmin = currentUser.role === 'ADMIN';

        list.forEach(alt => {
          const card = document.createElement('div');
          card.className = 'diff-card';
          
          let diffLinesHtml = '';
          (alt.diffLines || []).forEach(line => {
            const cls = line.type === 'del' ? 'diff-del' : (line.type === 'add' ? 'diff-add' : 'diff-info');
            diffLinesHtml += \`<div class="diff-line \${cls}">\${line.text}</div>\`;
          });

          card.innerHTML = \`
            <div class="diff-header">
              <div>
                <strong>Pedido #\${(alt.orderId || '').slice(-6)}</strong> • Solicitado por: <strong>\${alt.requestedByName || 'Caixa'}</strong> em \${new Date(alt.createdAt).toLocaleTimeString()}
              </div>
              <div>
                <span class="badge \${alt.status === 'APPROVED' ? 'badge-confirmed' : (alt.status === 'REJECTED' ? 'badge-cancelled' : 'badge-pending')}">
                  \${alt.status === 'PENDING' ? 'AGUARDANDO EDMAR' : (alt.status === 'APPROVED' ? 'APROVADO' : 'RECUSADO')}
                </span>
              </div>
            </div>

            <div class="diff-reason-box">
              <strong>💬 Justificativa do Atendente:</strong> "\${alt.reason || 'Correção de erro'}"
              \${alt.rejectionReason ? \`<div style="margin-top:6px; color:#991b1b;"><strong>❌ Motivo do Cancelamento de Edmar:</strong> "\${alt.rejectionReason}"</div>\` : ''}
            </div>

            <div class="diff-body">
              \${diffLinesHtml}
            </div>

            \${isAdmin && alt.status === 'PENDING' ? \`
              <div class="diff-actions">
                <button class="action-btn btn-red" onclick="openRejectModal('\${alt.id}')">❌ Recusar Alteração (Enviar Motivo)</button>
                <button class="action-btn btn-green" onclick="approveAlteration('\${alt.id}')">✅ Aceitar Alteração (Merge)</button>
              </div>
            \` : ''}
          \`;
          container.appendChild(card);
        });
      } catch (err) {
        container.innerHTML = 'Erro ao carregar alterações: ' + err.message;
      }
    }

    async function approveAlteration(requestId) {
      if (!confirm('Deseja consolidar esta alteração no pedido e atualizar o estoque?')) return;
      const res = await fetch('/api/admin/alterations/' + requestId + '/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVED', reviewedBy: currentUser.name })
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Alteração consolidada no Firestore com sucesso! Notificação enviada para o caixa.');
        loadAlterations();
        loadCashierDaily();
      }
    }

    function openRejectModal(requestId) {
      document.getElementById('rejectRequestId').value = requestId;
      document.getElementById('rejectionReasonText').value = '';
      document.getElementById('rejectReasonModal').classList.add('open');
    }

    function closeRejectModal() {
      document.getElementById('rejectReasonModal').classList.remove('open');
    }

    async function confirmRejectAlteration() {
      const id = document.getElementById('rejectRequestId').value;
      const reason = document.getElementById('rejectionReasonText').value.trim();
      if (!reason) { alert('Por favor, informe o motivo do cancelamento para o atendente.'); return; }

      const res = await fetch('/api/admin/alterations/' + id + '/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECTED', reviewedBy: currentUser.name, rejectionReason: reason })
      });
      const data = await res.json();
      if (data.success) {
        alert('Solicitação recusada. A notificação com o motivo foi enviada diretamente para o atendente do caixa.');
        closeRejectModal();
        loadAlterations();
      }
    }

    // 4. SOLICITAÇÃO DE ALTERAÇÃO PELO CAIXA
    async function openAlterationModal(orderId) {
      const res = await fetch('/api/admin/orders');
      const orders = await res.json();
      const ord = orders.find(o => String(o.id) === String(orderId));
      if (!ord) return;

      document.getElementById('altOrderId').value = ord.id;
      document.getElementById('altCustName').value = ord.customerName || '';
      document.getElementById('altPayMethod').value = ord.paymentMethod || 'DINHEIRO';
      document.getElementById('altTotal').value = Number(ord.total || 0);
      document.getElementById('altReason').value = '';
      document.getElementById('alterationRequestModal').classList.add('open');
    }

    function closeAlterationModal() {
      document.getElementById('alterationRequestModal').classList.remove('open');
    }

    async function submitAlterationRequest() {
      const orderId = document.getElementById('altOrderId').value;
      const res = await fetch('/api/admin/orders');
      const orders = await res.json();
      const orig = orders.find(o => String(o.id) === String(orderId));

      const newCust = document.getElementById('altCustName').value;
      const newPay = document.getElementById('altPayMethod').value;
      const newTot = parseFloat(document.getElementById('altTotal').value);
      const reason = document.getElementById('altReason').value.trim();

      if (!reason) { alert('Informe a justificativa do erro para que Edmar possa avaliar.'); return; }

      const proposed = { ...orig, customerName: newCust, paymentMethod: newPay, total: newTot };

      await fetch('/api/admin/alterations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          originalOrder: orig,
          proposedOrder: proposed,
          requestedBy: currentUser.id,
          requestedByName: currentUser.name,
          reason,
        })
      });

      alert('🚀 Solicitação de alteração enviada para o Administrador! Ele analisará as diferenças no visualizador Git Diff.');
      closeAlterationModal();
      loadAlterations();
    }

    // 5. NOTIFICAÇÕES PARA ATENDENTE / ADMIN
    async function loadNotifications() {
      const container = document.getElementById('notificationsContainer');
      try {
        const res = await fetch('/api/admin/notifications?userId=' + currentUser.id);
        const list = await res.json();
        container.innerHTML = '';
        
        const unreadCount = list.filter(n => !n.read).length;
        document.getElementById('notifBadge').innerText = unreadCount;

        if (list.length === 0) {
          container.innerHTML = '<div style="color:#64748b; padding:20px;">Nenhuma notificação no momento.</div>';
          return;
        }

        list.forEach(n => {
          const div = document.createElement('div');
          const isSale = n.type === 'SALE_COMPLETED';
          div.className = 'notif-card ' + (n.type === 'REJECTED' ? 'rejected' : (isSale ? 'sale' : (n.type === 'APPROVED' ? 'approved' : '')));
          div.innerHTML = \`
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="\${isSale ? 'color:#15803d; font-size:14px;' : ''}">\${n.title || 'Aviso da Administração'}</strong>
              <span style="font-size:11px; color:#64748b;">\${new Date(n.createdAt).toLocaleTimeString()}</span>
            </div>
            <div style="margin-top:6px;">\${n.message}</div>
            \${n.reason ? \`<div style="margin-top:6px; font-weight:bold; color:#991b1b;">Motivo do Cancelamento: "\${n.reason}"</div>\` : ''}
            \${isSale ? \`<div style="margin-top:8px; display:flex; gap:8px;"><button type="button" class="btn" style="padding:4px 10px; font-size:11px; background:#15803d; color:white; border-radius:4px; border:none; cursor:pointer;" onclick="switchTab('orders')">Ver Pedidos ➔</button></div>\` : ''}
          \`;
          container.appendChild(div);
        });
      } catch (err) {
        container.innerHTML = 'Erro ao carregar notificações: ' + err.message;
      }
    }

    function safeExtractProductsAdmin(data) {
      if (!data) return [];
      if (Array.isArray(data)) return data;
      if (data && typeof data === 'object') {
        if (Array.isArray(data.products)) return data.products;
        if (data.products && typeof data.products === 'object') return Object.values(data.products);
      }
      return [];
    }

    // 6. CONSULTA RÁPIDA DE PREÇO
    async function loadPriceProducts() {
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
          const data = await res.json();
          const list = safeExtractProductsAdmin(data);
          allProducts = Array.isArray(list) ? list : [];
        } else {
          allProducts = [];
        }
      } catch (e) {
        console.warn('Falha na consulta de preços:', e);
        allProducts = [];
      }
      if (!Array.isArray(allProducts)) allProducts = [];
      filterPriceTable();
    }

    function filterPriceTable() {
      if (!Array.isArray(allProducts)) allProducts = [];
      const q = document.getElementById('priceSearchInput').value.toLowerCase();
      const tbody = document.getElementById('priceTableBody');
      tbody.innerHTML = '';

      allProducts.filter(p => !q || (p.name || p.descricao || '').toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q)).forEach(p => {
        const tr = document.createElement('tr');
        const img = (p.images && p.images[0]) || p.imageUrl || p.imageurl || 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=600';
        tr.innerHTML = \`
          <td><img src="\${img}" class="prod-thumb" /></td>
          <td><strong>\${p.descricao || p.name}</strong></td>
          <td>\${p.categoria || p.category || ''} • \${p.subcategoria || ''}</td>
          <td><strong style="color:#15803d; font-size:15px;">R$ \${Number(p.valor_num || p.price || 0).toFixed(2).replace('.', ',')}</strong></td>
          <td><span style="font-weight:bold;">\${p.stockQuantity ?? p.estoque ?? 0}</span> em estoque</td>
        \`;
        tbody.appendChild(tr);
      });
    }

    // 7. EQUIPE & PERMISSÕES
    async function loadTeam() {
      const res = await fetch('/api/admin/auth/users');
      const users = await res.json();
      const tbody = document.getElementById('teamTableBody');
      tbody.innerHTML = '';

      users.forEach(u => {
        const tr = document.createElement('tr');
        const role = u.role || 'CLIENTE';
        tr.innerHTML = \`
          <td><strong>\${u.name || 'Sem nome'}</strong></td>
          <td>\${u.email}</td>
          <td>
            <select onchange="changeUserRole('\${u.id}', this.value)" style="padding:4px 8px; border-radius:6px; font-weight:700; font-size:12px; border:1px solid #cbd5e1; background:\${role === 'ADMIN' ? '#dcfce7' : (role === 'CAIXA' ? '#e0f2fe' : '#f8fafc')}; color:\${role === 'ADMIN' ? '#166534' : (role === 'CAIXA' ? '#0369a1' : '#475569')}; cursor:pointer;" \${u.id === 'usr-edmar' ? 'disabled' : ''}>
              <option value="CLIENTE" \${role === 'CLIENTE' ? 'selected' : ''}>👤 CLIENTE (Padrão)</option>
              <option value="CAIXA" \${role === 'CAIXA' ? 'selected' : ''}>🛒 CAIXA (Balcão)</option>
              <option value="ADMIN" \${role === 'ADMIN' ? 'selected' : ''}>👑 ADMIN (Total)</option>
            </select>
          </td>
          <td>\${u.hasPin ? '••••' : (u.hasPassword ? '🔑 Senha' : '🌐 Google')}</td>
          <td>\${u.active !== false ? '🟢 Ativo' : '🔴 Inativo'}</td>
          <td>
            \${u.id !== 'usr-edmar' ? \`<button class="action-btn btn-red" style="padding:4px 8px;" onclick="deleteUser('\${u.id}')">Excluir</button>\` : '<em>Administrador Geral</em>'}
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    async function changeUserRole(userId, newRole) {
      try {
        const res = await fetch('/api/admin/users/' + encodeURIComponent(userId) + '/role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: newRole }),
        });
        const data = await res.json();
        if (data.success) {
          alert('✅ Perfil atualizado para ' + newRole + ' com sucesso!');
          loadTeam();
        } else {
          alert('Erro ao alterar perfil: ' + (data.error || 'Falha'));
          loadTeam();
        }
      } catch (err) {
        alert('Erro ao conectar com servidor: ' + err.message);
        loadTeam();
      }
    }

    function openNewUserModal() {
      document.getElementById('uId').value = '';
      document.getElementById('uName').value = '';
      document.getElementById('uEmail').value = '';
      document.getElementById('uRole').value = 'CAIXA';
      document.getElementById('uPin').value = '';
      document.getElementById('userModal').classList.add('open');
    }

    function closeUserModal() {
      document.getElementById('userModal').classList.remove('open');
    }

    async function handleUserSubmit(e) {
      e.preventDefault();
      const id = document.getElementById('uId').value || ('usr-' + Date.now());
      const name = document.getElementById('uName').value;
      const email = document.getElementById('uEmail').value;
      const role = document.getElementById('uRole').value;
      const pin = document.getElementById('uPin').value;

      await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, email, role, pin, active: true })
      });

      alert('Colaborador cadastrado com sucesso!');
      closeUserModal();
      loadTeam();
    }

    async function deleteUser(id) {
      if (!confirm('Deseja excluir o acesso deste funcionário?')) return;
      await fetch('/api/admin/users/' + id, { method: 'DELETE' });
      loadTeam();
    }

    // 8. LOGIN / TROCA DE OPERADOR
    async function openLoginModal(automatic = false) {
      const res = await fetch('/api/admin/auth/users');
      const users = await res.json();
      const listEl = document.getElementById('userSelectList');
      listEl.innerHTML = '';
      
      users.forEach(u => {
        const btn = document.createElement('div');
        btn.style.cssText = 'padding:10px 14px; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;';
        btn.innerHTML = \`
          <div>
            <strong>\${u.name}</strong><br>
            <span style="font-size:11px; color:#64748b;">\${u.role}</span>
          </div>
          <span style="font-size:12px; color:#15803d; font-weight:bold;">Selecionar ➔</span>
        \`;
        btn.onclick = () => {
          document.querySelectorAll('#userSelectList div').forEach(d => d.style.borderColor = '#cbd5e1');
          btn.style.borderColor = '#15803d';
          btn.style.background = '#f0fdf4';
          currentSelectedUserIdForLogin = u.id;
        };
        listEl.appendChild(btn);
      });

      // Seleciona o primeiro por padrão
      if (users.length > 0) {
        currentSelectedUserIdForLogin = users[0].id;
        listEl.children[0].style.borderColor = '#15803d';
        listEl.children[0].style.background = '#f0fdf4';
      }

      if (!automatic || !currentUser || !['ADMIN', 'CAIXA'].includes(currentUser.role)) document.getElementById('loginModal').classList.add('open');
    }

    function closeLoginModal() {
      document.getElementById('loginModal').classList.remove('open');
    }

    async function performLogin() {
      const pin = document.getElementById('loginPinInput').value;
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentSelectedUserIdForLogin, pin })
      });
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        localStorage.setItem('conflora_user', JSON.stringify(currentUser));
        localStorage.setItem('conflora_op', JSON.stringify(currentUser));
        closeLoginModal();
        applyUserRoleUI();
        alert('Bem-vindo(a), ' + currentUser.name + ' (' + currentUser.role + ')!');
      } else {
        alert('Erro ao autenticar: ' + (data.error || 'PIN incorreto.'));
      }
    }

    async function submitAdminGoogleLogin() {
      const button = document.getElementById('adminGoogleLoginButton');
      if (button.disabled) return;
      button.disabled = true;
      try {
        const data = await window.authenticateGoogle();
        if (data.success && data.user) {
          currentUser = data.user;
          localStorage.setItem('conflora_user', JSON.stringify(currentUser));
          localStorage.setItem('conflora_op', JSON.stringify(currentUser));
          closeLoginModal();
          applyUserRoleUI();
          if (currentUser.role === 'ADMIN') {
            alert('🌿 Autenticado com sucesso como Administrador Google! Painel e configurações liberados.');
          } else {
            alert('🌿 Bem-vindo(a), ' + currentUser.name + '! Perfil identificado: ' + currentUser.role);
          }
        } else {
          alert('Erro ao autenticar via Google: ' + (data.error || 'Tente novamente'));
        }
      } catch (err) {
        alert(err.code === 'auth/popup-closed-by-user' ? 'Login cancelado.' : err.code === 'auth/popup-blocked' ? 'Permita pop-ups para entrar com o Google.' : 'Erro ao autenticar: ' + err.message);
      } finally {
        button.disabled = false;
      }
    }

    async function logoutAdmin() {
      if (confirm('Deseja realmente sair da sua conta administrativa?')) {
        if (window.signOutGoogle) {
          try { await window.signOutGoogle(); } catch (error) { alert('Erro ao sair: ' + error.message); return; }
        }
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        localStorage.removeItem('conflora_user');
        localStorage.removeItem('conflora_op');
        applyUserRoleUI();
      }
    }

    // 11. DIAGNÓSTICO & STATUS DAS CONEXÕES (SHEETS, WHATSAPP, FIRESTORE)
    async function loadAdminStatusData() {
      const container = document.getElementById('adminStatusDashboardContainer');
      if (!container) return;
      container.innerHTML = '<div style="padding:30px; text-align:center; color:#64748b;">📡 Consultando diagnóstico em tempo real (Google Sheets & WhatsApp)...</div>';

      try {
        const res = await fetch('/api/admin/system-status');
        const data = await res.json();
        const sheets = data.googleSheets || {};
        const wa = data.whatsapp || {};
        const fs = data.firestore || {};
        const cat = data.defaultCatalog || {};

        container.innerHTML = \`
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:16px;">
            <!-- GOOGLE SHEETS API STATUS -->
            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="font-size:15px; display:flex; align-items:center; gap:6px;">Google Sheets API</h3>
                <span style="background:\${sheets.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:10px;">
                  \${sheets.badge || sheets.status || 'ONLINE'}
                </span>
              </div>
              <div style="font-size:13px; color:#475569; line-height:1.7;">
                <div><strong>ID da Planilha:</strong> <code>\${sheets.spreadsheetId || 'Padrão Conflora'}</code></div>
                <div><strong>Aba Configurada:</strong> <strong>\${sheets.sheetName || 'PRODUTOS'}</strong></div>
                <div><strong>Produtos Indexados:</strong> <span style="font-weight:800; color:#15803d;">\${sheets.itemsActive || 111} itens</span></div>
                <div><strong>Latência API:</strong> \${sheets.latencyMs ?? 0} ms</div>
                <div><strong>Fonte dos Dados:</strong> \${sheets.source || 'Planilha'}</div>
                <div style="margin-top:8px; font-size:12px; color:#64748b; background:#f1f5f9; padding:8px 10px; border-radius:6px;">
                  ℹ️ \${sheets.message || 'Operação normal.'}
                </div>
              </div>
              <div style="margin-top:14px;">
                <button class="action-btn btn-green" onclick="testSheetsFromAdmin()" style="width:100%; justify-content:center; padding:8px;">
                  🧪 Testar Conexão Google Sheets Agora
                </button>
              </div>
            </div>

            <!-- WHATSAPP WEBHOOK STATUS -->
            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="font-size:15px; display:flex; align-items:center; gap:6px;">WhatsApp Webhook & API</h3>
                <span style="background:\${wa.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:10px;">
                  \${wa.badge || wa.status || 'ONLINE'}
                </span>
              </div>
              <div style="font-size:13px; color:#475569; line-height:1.7;">
                <div><strong>Rota Ativa:</strong> <code>/webhook</code> (GET verificação / POST mensagens)</div>
                <div><strong>Número / Phone ID:</strong> \${wa.phoneNumberId || 'Emulador Local'}</div>
                <div><strong>Verify Token:</strong> \${wa.hasVerifyToken ? '✅ Configurado' : '⚠️ Não configurado'}</div>
                <div><strong>Access Token Graph:</strong> \${wa.hasAccessToken ? '✅ Ativo' : '⚠️ Emulador'}</div>
                <div><strong>Total Mensagens:</strong> \${wa.totalReceivedCount || 0}</div>
                <div><strong>Último Hit Recebido:</strong> \${wa.lastReceivedAt || 'Nenhum recente'}</div>
                <div style="margin-top:8px; font-size:12px; color:#64748b; background:#f1f5f9; padding:8px 10px; border-radius:6px;">
                  ℹ️ \${wa.message || 'Webhook operacional.'}
                </div>
              </div>
              <div style="margin-top:14px;">
                <button class="action-btn btn-blue" onclick="testWebhookFromAdmin()" style="width:100%; justify-content:center; padding:8px;">
                  🧪 Testar Ping & Rota do Webhook
                </button>
              </div>
            </div>

            <!-- CLOUD FIRESTORE -->
            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="font-size:15px; display:flex; align-items:center; gap:6px;">Cloud Firestore</h3>
                <span style="background:\${fs.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:10px;">
                  \${fs.badge || fs.status || 'ONLINE'}
                </span>
              </div>
              <div style="font-size:13px; color:#475569; line-height:1.7;">
                <div><strong>Projeto GCP:</strong> <code>\${fs.projectId || 'confloraai'}</code></div>
                <div><strong>Latência de Resposta:</strong> \${fs.latencyMs ?? 0} ms</div>
                <div><strong>Status de Conexão:</strong> \${fs.message || 'Conectado ao Firestore.'}</div>
                <div><strong>Persistência:</strong> Firestore + Cache Local</div>
              </div>
            </div>

            <!-- PLANILHA OFICIAL DE CONTINGÊNCIA -->
            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:10px; padding:18px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="font-size:15px; display:flex; align-items:center; gap:6px;">Planilha Oficial Conflora</h3>
                <span style="background:\${cat.color || '#10b981'}; color:white; font-size:11px; font-weight:800; padding:2px 8px; border-radius:10px;">
                  \${cat.badge || 'Carregada'}
                </span>
              </div>
              <div style="font-size:13px; color:#475569; line-height:1.7;">
                <div><strong>Itens Comerciais Oficiais:</strong> <strong style="color:#15803d;">\${cat.totalItems || 111} itens</strong></div>
                <div><strong>Categorias Mapeadas:</strong> \${cat.categoriesCount || 6}</div>
                <div><strong>Disponibilidade:</strong> \${cat.autoFallback || '100% garantida'}</div>
              </div>
            </div>
          </div>

          <div id="adminTestResultBox" style="display:none; margin-top:16px; padding:12px; border-radius:8px; font-size:13px;"></div>
        \`;
      } catch (err) {
        container.innerHTML = '<div style="color:#ef4444; padding:20px; text-align:center;">Erro ao carregar diagnóstico: ' + err.message + '</div>';
      }
    }

    async function testSheetsFromAdmin() {
      const box = document.getElementById('adminTestResultBox');
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
          box.innerHTML = '✅ <strong>Google Sheets Conexão OK:</strong> ' + (d.message || 'Sincronizado com sucesso.') + ' (Latência: ' + (d.latencyMs || 0) + 'ms)';
        }
      } catch (err) {
        if (box) {
          box.style.background = '#fee2e2';
          box.style.color = '#991b1b';
          box.innerHTML = '❌ <strong>Erro no teste do Sheets:</strong> ' + err.message;
        }
      }
    }

    async function testWebhookFromAdmin() {
      const box = document.getElementById('adminTestResultBox');
      if (box) {
        box.style.display = 'block';
        box.style.background = '#f1f5f9';
        box.style.color = '#334155';
        box.innerHTML = '⏳ Enviando ping para rota /webhook do WhatsApp...';
      }
      try {
        const res = await fetch('/api/admin/test-webhook', { method: 'POST' });
        const d = await res.json();
        if (box) {
          box.style.background = '#dcfce7';
          box.style.color = '#166534';
          box.innerHTML = '✅ <strong>Webhook WhatsApp OK:</strong> Rota <code>/webhook</code> respondeu com sucesso em ' + (d.pingLatencyMs || 0) + 'ms. ' + (d.message || '');
        }
      } catch (err) {
        if (box) {
          box.style.background = '#fee2e2';
          box.style.color = '#991b1b';
          box.innerHTML = '❌ <strong>Erro no teste do Webhook:</strong> ' + err.message;
        }
      }
    }

    // 9. ESTOQUE ÁGIL (+1, +5, +10)
    async function loadStockProducts() {
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
          const data = await res.json();
          const list = safeExtractProductsAdmin(data);
          allProducts = Array.isArray(list) ? list : [];
        } else {
          allProducts = [];
        }
      } catch (e) {
        console.warn('Falha ao carregar estoque:', e);
        allProducts = [];
      }
      if (!Array.isArray(allProducts)) allProducts = [];
      filterStockCards();
    }

    function filterStockCards() {
      if (!Array.isArray(allProducts)) allProducts = [];
      const q = document.getElementById('stockSearchInput').value.toLowerCase();
      const grid = document.getElementById('stockCardsGrid');
      grid.innerHTML = '';

      allProducts.filter(p => !q || (p.name || p.descricao || '').toLowerCase().includes(q)).forEach(p => {
        const div = document.createElement('div');
        div.className = 'stock-card';
        const img = (p.images && p.images[0]) || p.imageUrl || p.imageurl || '';
        div.innerHTML = \`
          <div style="display:flex; gap:10px; align-items:center;">
            \${img ? \`<img src="\${img}" style="width:40px; height:40px; border-radius:6px; object-fit:cover;" />\` : ''}
            <div>
              <div style="font-weight:bold; font-size:13px;">\${p.descricao || p.name}</div>
              <div style="font-size:11px; color:#64748b;">\${p.subcategoria || p.categoria || ''}</div>
            </div>
          </div>
          <div style="font-size:12px; color:#64748b;">Estoque Atual: <strong id="stk-\${p.id}" style="color:#15803d; font-size:16px;">\${p.stockQuantity ?? p.estoque ?? 0}</strong> un</div>
          <div class="stock-btns-row">
            <button class="plus-btn" onclick="addStock('\${p.id}', 1)">+1</button>
            <button class="plus-btn" onclick="addStock('\${p.id}', 5)">+5</button>
            <button class="plus-btn" onclick="addStock('\${p.id}', 10)">+10</button>
            <button class="plus-btn" onclick="addStock('\${p.id}', 50)">+50</button>
          </div>
        \`;
        grid.appendChild(div);
      });
    }

    async function addStock(prodId, qty) {
      const res = await fetch('/api/admin/stock/quick-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: prodId, quantityAdded: qty })
      });
      const data = await res.json();
      if (data.success) {
        const el = document.getElementById('stk-' + prodId);
        if (el) el.innerText = data.newStock;
      }
    }

    // 10. CADASTRO DE PRODUTOS
    async function loadAdminProducts() {
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
          const data = await res.json();
          const list = safeExtractProductsAdmin(data);
          allProducts = Array.isArray(list) ? list : [];
        } else {
          allProducts = [];
        }
      } catch (e) {
        console.warn('Falha ao carregar produtos:', e);
        allProducts = [];
      }
      if (!Array.isArray(allProducts)) allProducts = [];
      const tbody = document.getElementById('adminProductsTableBody');
      tbody.innerHTML = '';

      allProducts.forEach(p => {
        const tr = document.createElement('tr');
        const img = (p.images && p.images[0]) || p.imageUrl || p.imageurl || 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=600';
        tr.innerHTML = \`
          <td><img src="\${img}" class="prod-thumb" /></td>
          <td><strong>\${p.descricao || p.name}</strong></td>
          <td>\${p.categoria || p.category || ''}</td>
          <td>R$ \${Number(p.valor_num || p.price || 0).toFixed(2).replace('.', ',')}</td>
          <td><strong style="color:#15803d;">\${p.stockQuantity ?? p.estoque ?? 0}</strong> un</td>
          <td>
            <button class="action-btn btn-blue" style="padding:4px 8px;" onclick="editProduct('\${p.id}')">✏️ Editar</button>
            <button class="action-btn btn-red" style="padding:4px 8px;" onclick="deleteProduct('\${p.id}')">🗑️ Excluir</button>
          </td>
        \`;
        tbody.appendChild(tr);
      });
    }

    function slugifyClient(text) {
      if (!text) return 'produto';
      return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'produto';
    }

    let pendingPhotosList = [];

    function renderPendingPhotosGrid() {
      const box = document.getElementById('formProdPhotoPreviewBox');
      const grid = document.getElementById('formProdPhotosGrid');
      const countSpan = document.getElementById('formProdPhotoCount');
      const base64Input = document.getElementById('formProdPhotoBase64');
      if (!box || !grid) return;

      if (pendingPhotosList.length === 0) {
        box.style.display = 'none';
        if (base64Input) base64Input.value = '';
        return;
      }

      box.style.display = 'block';
      if (countSpan) countSpan.textContent = pendingPhotosList.length;
      if (base64Input) base64Input.value = pendingPhotosList[0]?.dataUrl || '';

      grid.innerHTML = '';
      pendingPhotosList.forEach((item, index) => {
        const card = document.createElement('div');
        const isPrimary = index === 0;
        card.style.cssText = 'position:relative; background:#ffffff; border:1px solid ' + (isPrimary ? '#22c55e' : '#cbd5e1') + '; border-radius:8px; padding:6px; display:flex; flex-direction:column; align-items:center; gap:4px; box-shadow:0 1px 3px rgba(0,0,0,0.05);';

        const imgSrc = item.dataUrl || item.url || '';
        const badge = isPrimary
          ? '<span style="position:absolute; top:4px; left:4px; background:#16a34a; color:white; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:10px;">⭐ Capa</span>'
          : '<span style="position:absolute; top:4px; left:4px; background:rgba(0,0,0,0.6); color:white; font-size:10px; padding:1px 5px; border-radius:10px;">#' + (index + 1) + '</span>';

        const label = item.fileName || ('Foto ' + (index + 1));
        const capaBtn = !isPrimary
          ? '<button type="button" onclick="setPrimaryPendingPhoto(' + index + ')" title="Definir como foto principal" style="font-size:10px; padding:2px 6px; border:1px solid #cbd5e1; border-radius:4px; background:#f8fafc; cursor:pointer;">⭐ Capa</button>'
          : '';

        card.innerHTML =
          '<div style="position:relative; width:100%; height:80px; border-radius:6px; overflow:hidden; background:#f1f5f9;">' +
            '<img src="' + imgSrc + '" style="width:100%; height:100%; object-fit:cover;" alt="Foto" />' +
            badge +
          '</div>' +
          '<div style="font-size:10px; font-weight:bold; color:#334155; width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; text-align:center;" title="' + label + '">' +
            label +
          '</div>' +
          '<div style="display:flex; gap:4px; width:100%; justify-content:center; margin-top:2px;">' +
            capaBtn +
            '<button type="button" onclick="removePendingPhoto(' + index + ')" title="Remover esta foto" style="font-size:10px; padding:2px 6px; border:1px solid #fecaca; border-radius:4px; background:#fef2f2; color:#dc2626; cursor:pointer;">🗑️</button>' +
          '</div>';

        grid.appendChild(card);
      });
    }

    function setPrimaryPendingPhoto(index) {
      if (index <= 0 || index >= pendingPhotosList.length) return;
      const [photo] = pendingPhotosList.splice(index, 1);
      pendingPhotosList.unshift(photo);
      renderPendingPhotosGrid();
    }

    function removePendingPhoto(index) {
      if (index < 0 || index >= pendingPhotosList.length) return;
      pendingPhotosList.splice(index, 1);
      renderPendingPhotosGrid();
    }

    function clearAllPendingPhotos() {
      pendingPhotosList = [];
      const fileInput = document.getElementById('formProdPhotoFile');
      if (fileInput) fileInput.value = '';
      renderPendingPhotosGrid();
    }

    function handleProdPhotoFileSelect(event) {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const name = document.getElementById('formProdName').value || 'produto';
      const id = document.getElementById('formProdId').value || 'novo';
      const tagsInput = document.getElementById('formProdTags');
      if (!tagsInput.value) {
        const cat = document.getElementById('formProdCat').value;
        const sub = document.getElementById('formProdSubcat').value;
        const autoTags = [name.toLowerCase(), cat.toLowerCase(), sub.toLowerCase()].filter(Boolean).join(', ');
        tagsInput.value = autoTags;
        const tagsBox = document.getElementById('formProdPhotoTags');
        if (tagsBox) tagsBox.textContent = '🏷️ Tags Conflora: ' + autoTags;
      }

      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = function(e) {
          const dataUrl = e.target.result;
          const stdName = slugifyClient(name) + '_' + id + '_' + (pendingPhotosList.length + 1) + '.jpg';
          pendingPhotosList.push({
            dataUrl,
            fileName: stdName,
            isExisting: false,
          });
          renderPendingPhotosGrid();
        };
        reader.readAsDataURL(file);
      });
    }

    function editProduct(id) {
      const p = allProducts.find(x => String(x.id) === String(id));
      if (!p) return;
      document.getElementById('formProdId').value = p.id;
      document.getElementById('formProdName').value = p.descricao || p.name;
      document.getElementById('formProdCat').value = p.categoria || p.category;
      document.getElementById('formProdSubcat').value = p.subcategoria || p.subcategory || '';
      document.getElementById('formProdPrice').value = Number(p.valor_num || p.price || 0);
      document.getElementById('formProdStock').value = p.stockQuantity ?? p.estoque ?? 0;
      document.getElementById('formProdImages').value = (p.images || [p.imageUrl || p.imageurl]).filter(Boolean).join(', ');
      document.getElementById('formProdTags').value = p.tagsAi || p.tags_ia || '';
      document.getElementById('formProdDesc').value = p.descriptionAi || p.descricao_ia || '';
      document.getElementById('formProdPhotoBase64').value = '';

      // Carrega fotos existentes do produto no gerenciador de fotos
      pendingPhotosList = [];
      const existingImgs = (Array.isArray(p.images) && p.images.length > 0)
        ? p.images.filter(Boolean)
        : (p.imageUrl || p.imageurl ? [p.imageUrl || p.imageurl] : []);

      existingImgs.forEach((url, i) => {
        pendingPhotosList.push({
          url,
          dataUrl: url,
          fileName: (p.imageFileId || slugifyClient(p.descricao || p.name)) + (i > 0 ? '_' + i : '') + '.jpg',
          isExisting: true,
        });
      });
      renderPendingPhotosGrid();

      document.getElementById('productFormTitle').textContent = 'Editar Produto #' + p.id;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function resetProdForm() {
      document.getElementById('prodForm').reset();
      document.getElementById('formProdId').value = '';
      document.getElementById('formProdPhotoBase64').value = '';
      document.getElementById('formProdTags').value = '';
      clearAllPendingPhotos();
      document.getElementById('productFormTitle').textContent = 'Novo Produto no Catálogo';
    }

    async function deleteProduct(id) {
      if (!confirm('Deseja excluir este produto do Firestore?')) return;
      await fetch('/api/admin/products/' + id, { method: 'DELETE' });
      loadAdminProducts();
    }

    async function handleProductSubmit(e) {
      e.preventDefault();
      const id = document.getElementById('formProdId').value || ('prod-' + Date.now());
      const name = document.getElementById('formProdName').value;
      const cat = document.getElementById('formProdCat').value;
      const sub = document.getElementById('formProdSubcat').value;
      const price = parseFloat(document.getElementById('formProdPrice').value);
      const stock = parseInt(document.getElementById('formProdStock').value, 10);
      const externalImgs = document.getElementById('formProdImages').value.split(',').map(s => s.trim()).filter(Boolean);
      const tags = document.getElementById('formProdTags').value;
      const desc = document.getElementById('formProdDesc').value;

      const newUploads = pendingPhotosList.filter(p => p.dataUrl && !p.isExisting).map(p => p.dataUrl);
      const existingUrls = pendingPhotosList.filter(p => p.isExisting && p.url).map(p => p.url);
      const combinedImgs = [...existingUrls, ...externalImgs];

      const payload = {
        id,
        name,
        category: cat,
        subcategory: sub,
        unit: document.getElementById('formProdUnit') ? document.getElementById('formProdUnit').value : 'UN',
        price,
        stockQuantity: stock,
        images: combinedImgs,
        imageUrl: combinedImgs[0] || '',
        tagsAi: tags,
        tags_ia: tags,
        descriptionAi: desc,
      };

      if (newUploads.length > 0) {
        payload.photosBase64 = newUploads;
        payload.photoBase64 = newUploads[0];
      }

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        alert('✅ Produto e fotos salvos com sucesso no Firestore com alta qualidade para zoom!');
        resetProdForm();
        loadAdminProducts();
        loadPriceProducts();
      } else {
        alert('Erro ao salvar no Firestore: ' + (data.error || 'Falha'));
      }
    }

    async function transferDrivePhotosFromAdmin() {
      const btn = document.getElementById('btnTransferDrivePhotos');
      const status = document.getElementById('transferPhotosStatus');
      const box = document.getElementById('transferPhotosResultBox');
      btn.disabled = true;
      status.textContent = '⏳ Analisando catálogo e transferindo fotos para o Firestore...';
      box.style.display = 'none';

      try {
        const res = await fetch('/api/admin/transfer-drive-photos', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          status.textContent = '✅ ' + data.count + ' fotos sincronizadas no Firestore!';
          box.style.display = 'block';
          box.innerHTML = '<strong>Resultado da Transferência para o Firestore (coleção product_images):</strong><br>' +
            (data.details && data.details.length > 0
              ? data.details.slice(0, 15).map(d => '• <strong>' + d.name + '</strong> ➔ Arquivo: <code>' + d.fileName + '</code> | Tags: <em>' + d.tags + '</em>').join('<br>') +
                (data.details.length > 15 ? '<br><em>... e mais ' + (data.details.length - 15) + ' produtos sincronizados.</em>' : '')
              : 'Todos os produtos já possuem fotos gravadas e sincronizadas no Firestore com o padrão oficial.');
          await loadAdminProducts();
          await loadPriceProducts();
        } else {
          status.textContent = 'Erro: ' + (data.error || 'Falha ao transferir');
        }
      } catch (err) {
        status.textContent = 'Erro ao transferir: ' + err.message;
      } finally {
        btn.disabled = false;
      }
    }

    // 11. HISTÓRICO GERAL DE PEDIDOS
    async function loadAllOrders() {
      const container = document.getElementById('allOrdersListContainer');
      try {
        const res = await fetch('/api/admin/orders');
        const orders = await res.json();
        container.innerHTML = '';
        if (orders.length === 0) {
          container.innerHTML = '<div style="color:#64748b; padding:20px;">Nenhum pedido registrado.</div>';
          return;
        }

        orders.forEach(o => {
          const div = document.createElement('div');
          div.style.cssText = 'border:1px solid var(--border); border-radius:8px; padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;';
          const itemsTxt = (o.items || []).map(i => i.name + ' (' + (i.quantity || 1) + 'x)').join(', ');
          div.innerHTML = \`
            <div>
              <strong>#\${(o.id || '').slice(-6)} — \${o.customerName || 'Cliente'}</strong> (\${o.customerPhone || 'Presencial'})<br>
              <span style="font-size:12px; color:#64748b;">Itens: \${itemsTxt}</span><br>
              <span style="font-size:12px; color:#64748b;">\${o.deliveryAddress || 'Retirada'} • \${o.paymentMethod || 'PIX'} • \${new Date(o.createdAt).toLocaleString()}</span>
            </div>
            <div style="text-align:right;">
              <span class="badge \${o.status === 'CONFIRMED' ? 'badge-confirmed' : (o.status === 'DELIVERED' ? 'badge-delivered' : 'badge-pending')}">\${o.status}</span>
              <div style="font-weight:bold; color:#15803d; font-size:15px; margin-top:4px;">R$ \${Number(o.total || 0).toFixed(2).replace('.', ',')}</div>
            </div>
          \`;
          container.appendChild(div);
        });
      } catch (err) {
        container.innerHTML = 'Erro ao carregar histórico: ' + err.message;
      }
    }

    // 12. VENDA MANUAL NO BALCÃO
    function openManualOrderModal() {
      const select = document.getElementById('mProdSelect');
      select.innerHTML = '';
      allProducts.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = (p.descricao || p.name) + ' — R$ ' + Number(p.valor_num || p.price || 0).toFixed(2);
        select.appendChild(opt);
      });
      document.getElementById('manualOrderModal').classList.add('open');
    }

    function closeManualOrderModal() {
      document.getElementById('manualOrderModal').classList.remove('open');
    }

    async function submitManualOrder(e) {
      e.preventDefault();
      const name = document.getElementById('mCustName').value;
      const phone = document.getElementById('mCustPhone').value;
      const prodId = document.getElementById('mProdSelect').value;
      const qty = parseInt(document.getElementById('mQty').value, 10);
      const pay = document.getElementById('mPayMethod').value;

      const p = allProducts.find(x => String(x.id) === String(prodId));
      if (!p) return;

      const items = [{ productId: p.id, name: p.descricao || p.name, price: Number(p.valor_num || p.price || 0), quantity: qty }];

      await fetch('/api/admin/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name, customerPhone: phone, items, paymentMethod: pay })
      });

      alert('Venda registrada com sucesso no caixa e estoque baixado!');
      closeManualOrderModal();
      loadCashierDaily();
    }

    // 13. PLANILHA MODELO E IMPORTADOR COM AUDITORIA LINHA A LINHA
    function downloadCsvTemplate() {
      const csvContent = 'id,name,category,subcategory,unit,price,stockQuantity,images,descriptionAi,tagsAi\\n' +
        '1,Palmeira Imperial,Palmeiras,Imperial,UN,180.00,10,https://images.unsplash.com/photo-1596726596162-421712a433a0?w=800,Muda vistosa de porte nobre para sol pleno,palmeira imperial muda\\n' +
        '2,Adubo Orgânico Compostado,Gramas & Insumos,Adubação,KG,4.50,150,,Adubo rico em matéria orgânica mineralizada,adubo organico por kg terra\\n' +
        '3,Jabuticaba Sabará,Frutíferas,Nativas,UN,95.00,20,,Muda enxertada produzindo precocemente,fruta jabuticaba sabara\\n';
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'planilha_modelo_conflora.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    let importPreview = null;
    let importBusy = false;
    function updateImportButton() {
      document.getElementById('btnSubmitImport').disabled = importBusy || !importPreview || !document.getElementById('confirmReplace').checked;
    }
    function resetImportPreview() {
      importPreview = null;
      document.getElementById('confirmReplace').checked = false;
      document.getElementById('importFeedback').textContent = '';
      updateImportButton();
    }
    function setImportBusy(busy) {
      importBusy = busy;
      ['importFile', 'importMode', 'btnValidateImport', 'confirmReplace'].forEach(id => document.getElementById(id).disabled = busy);
      updateImportButton();
    }
    async function uploadWorkbook(commit) {
      const file = document.getElementById('importFile').files[0];
      if (!file || !file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Selecione a LISTA DE PRODUTOS em formato .xlsx.');
      if (file.size > 10 * 1024 * 1024) throw new Error('O arquivo deve ter até 10 MB.');
      const mode = document.getElementById('importMode').value;
      const response = await fetch('/api/admin/import-xlsx?commit=' + commit + '&mode=' + mode, {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Confirm-Replace': commit ? 'SUBSTITUIR' : '' }, body: file
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || (data.errors || []).join('\\n') || data.error || 'Não foi possível importar.');
      return data;
    }
    async function validateImportPayload() {
      resetImportPreview();
      setImportBusy(true);
      const feedback = document.getElementById('importFeedback');
      feedback.textContent = 'Conferindo a planilha...';
      try {
        const data = await uploadWorkbook(false);
        importPreview = data;
        feedback.textContent = data.count + ' produtos válidos (' + data.inactive + ' inativos). Base atual: ' + data.currentCount + ' produtos.' +
          '\\nAba utilizada: ' + data.sheet + '. Abas ignoradas: ' + (data.ignoredSheets.join(', ') || 'nenhuma') +
          (document.getElementById('importMode').value === 'replace' ? '\\nA base ficará com exatamente ' + data.count + ' produtos. ' + data.removed + ' IDs antigos serão removidos.' : '\\nOs demais produtos, fotos e estoques existentes serão mantidos quando não informados.') +
          '\\n\\nPrévia:\\n' + data.preview.map(p => p.id + ' — ' + p.name + ' — ' + Number(p.price).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) + ' — ' + p.status).join('\\n');
      } catch (error) { feedback.textContent = error.message; }
      finally { setImportBusy(false); }
    }
    async function submitImportPayload() {
      if (importBusy || !importPreview || !document.getElementById('confirmReplace').checked) return;
      const replace = document.getElementById('importMode').value === 'replace';
      if (!confirm(replace ? 'Substituir o catálogo pelos ' + importPreview.count + ' produtos da planilha? Fotos e estoques não informados serão removidos ou zerados.' : 'Adicionar ou atualizar os produtos da planilha?')) return;
      setImportBusy(true);
      const feedback = document.getElementById('importFeedback');
      feedback.textContent = 'Importando. Aguarde a conclusão...';
      try {
        const data = await uploadWorkbook(true);
        importPreview = null;
        document.getElementById('confirmReplace').checked = false;
        feedback.textContent = data.count + ' produtos importados com sucesso. ' + (data.removed || 0) + ' IDs antigos removidos.';
        await loadAdminProducts();
      } catch (error) {
        importPreview = null;
        feedback.textContent = error.message + '\\nConfira novamente a planilha antes de tentar de novo.';
      } finally { setImportBusy(false); }
    }
    async function downloadCatalogBackup() {
      try {
        const response = await fetch('/api/inventory');
        if (!response.ok) throw new Error('Não foi possível obter a cópia.');
        const data = await response.json();
        const url = URL.createObjectURL(new Blob([JSON.stringify(data.products, null, 2)], {type: 'application/json'}));
        const link = document.createElement('a'); link.href = url; link.download = 'produtos-antes-importacao.json'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { document.getElementById('importFeedback').textContent = error.message; }
    }

    // 14. CONTROLE / MODO CONTAGEM DE ESTOQUE
    function setStockControlMode(active) {
      localStorage.setItem('conflora_stock_control_active', active ? 'true' : 'false');
      updateStockControlBadge(active);
      if (active) {
        alert('✅ Controle de Estoque ATIVADO: Vendas no cardápio e no balcão darão baixa automática no estoque.');
      } else {
        alert('📋 MODO CONTAGEM ATIVADO: Durante essa semana de inventário, as vendas registradas NÃO descontarão do estoque, permitindo a contagem física com a loja rodando sem divergências.');
      }
    }

    function updateStockControlBadge(active) {
      const label = document.getElementById('stockModeLabel');
      if (!label) return;
      if (active) {
        label.textContent = '✅ Baixa Automática Ativa';
        label.style.background = '#dcfce7';
        label.style.color = '#15803d';
      } else {
        label.textContent = '📋 Modo Inventário (Sem Baixa)';
        label.style.background = '#fef3c7';
        label.style.color = '#92400e';
      }
    }

    async function seedDefaultConflora() {
      if (!confirm('Deseja restaurar o catálogo oficial da Conflora Horta e Viveiro no Firestore?')) return;
      const res = await fetch('/api/admin/seed-catalog', { method: 'POST' });
      const d = await res.json();
      if (d.success) {
        alert('Catálogo completo sincronizado no Firestore com sucesso!');
        loadAdminProducts();
        loadCashierDaily();
      }
    }

    // INICIALIZAÇÃO
    applyUserRoleUI();
    loadNotifications();
    loadPriceProducts();
    const isStockActive = localStorage.getItem('conflora_stock_control_active') !== 'false';
    updateStockControlBadge(isStockActive);
  </script>
${renderFirebaseAuthScript()}
</body>
</html>`;
}

module.exports = {
  renderAdminHtml,
};
