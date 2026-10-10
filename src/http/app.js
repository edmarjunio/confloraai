const { createWebSessions, safeUser } = require('../security/web-session');
const { readProductWorkbook } = require('../catalog/spreadsheet-import');
const { rankProductSales } = require('../catalog/product-sales');
let expressModule = null;
function getExpress() {
  if (!expressModule) {
    try {
      expressModule = require('express');
    } catch {
      return null;
    }
  }
  return expressModule;
}

const config = require('../config/env');
const { verifyFirebaseToken } = require('../security/firebase-auth');
const Logger = require('../shared/logger');
const { SignatureValidator } = require('../security/signature.validator');
const { SystemStatusService } = require('../services/system-status.service');
const { renderHomeHtml, renderAdminHtml } = require('./views');

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

function renderPrivacyPolicyHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Política de Privacidade | Conflora Horta e Viveiro</title>
  ${FETCH_SHIM_SCRIPT}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 800px; margin: 0 auto; padding: 24px 16px; background-color: #f7fafc; }
    .card { background: white; padding: 36px 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    h1 { color: #22543d; font-size: 28px; margin-bottom: 8px; }
    h2 { color: #276749; font-size: 20px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    p, li { font-size: 15px; color: #4a5568; }
    ul { padding-left: 20px; }
    .contact-box { background: #edf2f7; border-left: 4px solid #38a169; padding: 14px 18px; border-radius: 4px; margin-top: 20px; }
    footer { text-align: center; margin-top: 32px; font-size: 13px; color: #a0aec0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Política de Privacidade</h1>
    <p><strong>Conflora Horta e Viveiro & Agromadeiras</strong> — Mineiros, Goiás</p>
    <p><em>Última atualização: Outubro de 2026</em></p>

    <p>Esta Política de Privacidade descreve como a Conflora coleta, utiliza e protege os dados pessoais fornecidos por usuários que interagem com nosso canal oficial de atendimento automatizado e vendas no WhatsApp, em total conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong> e as políticas da <strong>Meta Platforms</strong>.</p>

    <h2>1. Dados Coletados</h2>
    <p>Ao interagir com nosso atendimento via WhatsApp, podemos coletar exclusivamente:</p>
    <ul>
      <li><strong>Identificação básica:</strong> Nome de exibição do perfil no WhatsApp e número de telefone celular.</li>
      <li><strong>Mensagens de atendimento:</strong> Histórico das mensagens trocadas, dúvidas sobre plantas, pedidos de orçamento e itens solicitados do catálogo.</li>
      <li><strong>Comprovantes de pagamento:</strong> Imagens ou documentos de comprovante PIX enviados voluntariamente para confirmação de compras.</li>
    </ul>

    <h2>2. Finalidade do Tratamento dos Dados</h2>
    <p>Os dados coletados são utilizados estritamente para:</p>
    <ul>
      <li>Prestar atendimento ao cliente, responder dúvidas sobre espécies de plantas, portes e valores.</li>
      <li>Montar orçamentos e emitir resumos de pedidos comerciais.</li>
      <li>Confirmar pagamentos PIX e organizar a separação de plantas para retirada ou entrega.</li>
      <li>Garantir a segurança, prevenção contra fraudes e melhoria contínua do atendimento.</li>
    </ul>

    <h2>3. Compartilhamento Seguro de Dados</h2>
    <p>A Conflora <strong>não comercializa, não aluga e não compartilha</strong> dados pessoais com terceiros para fins publicitários. Os dados transitam unicamente por provedores de infraestrutura tecnológica essenciais para o funcionamento do serviço:</p>
    <ul>
      <li><strong>Meta Platforms (WhatsApp Cloud API):</strong> Infraestrutura oficial de envio e recebimento de mensagens.</li>
      <li><strong>Google Cloud Platform:</strong> Hospedagem segura de servidores e banco de dados para armazenamento do histórico de atendimento.</li>
    </ul>

    <h2>4. Retenção e Segurança dos Dados</h2>
    <p>Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados contra acessos não autorizados ou destruição acidental. O histórico de mensagens é mantido apenas pelo tempo necessário para cumprimento das finalidades comerciais ou exigências legais.</p>

    <h2>5. Seus Direitos (LGPD) e Exclusão de Dados</h2>
    <p>Você tem o direito de solicitar a confirmação de tratamento, acesso, correção ou a <strong>exclusão total de seus dados pessoais</strong> a qualquer momento.</p>
    <p>Para solicitar a exclusão definitiva de seus dados do nosso sistema, consulte nossa página de <a href="/exclusao-de-dados" style="color: #276749; font-weight: bold;">Instruções de Exclusão de Dados</a> ou envie uma mensagem diretamente para nosso canal de contato.</p>

    <div class="contact-box">
      <strong>Canal do Encarregado de Dados (DPO / Contato):</strong><br>
      E-mail: <a href="mailto:edmarjuniob@gmail.com">edmarjuniob@gmail.com</a><br>
      Localização: Mineiros - GO, Brasil
    </div>
  </div>
  <footer>
    &copy; 2026 Conflora Horta e Viveiro. Todos os direitos reservados.
  </footer>
</body>
</html>`;
}

function renderDataDeletionHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Instruções de Exclusão de Dados | Conflora AI</title>
  ${FETCH_SHIM_SCRIPT}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 800px; margin: 0 auto; padding: 24px 16px; background-color: #f7fafc; }
    .card { background: white; padding: 36px 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    h1 { color: #22543d; font-size: 26px; margin-bottom: 8px; }
    h2 { color: #276749; font-size: 19px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    p, li { font-size: 15px; color: #4a5568; }
    .step-box { background: #f0fff4; border-left: 4px solid #38a169; padding: 14px 18px; border-radius: 4px; margin: 16px 0; }
    footer { text-align: center; margin-top: 32px; font-size: 13px; color: #a0aec0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Instruções de Exclusão de Dados do Usuário</h1>
    <p><strong>Conflora Horta e Viveiro</strong> — Atendimento WhatsApp</p>
    <p>Em conformidade com as diretrizes da <strong>Meta Platforms</strong> e o Artigo 18 da <strong>LGPD</strong>, você tem o direito de solicitar a remoção completa de todas as suas informações e histórico de conversas do nosso sistema a qualquer momento.</p>

    <h2>Como solicitar a exclusão de seus dados:</h2>

    <div class="step-box">
      <strong>Opção 1: Via E-mail Oficial</strong><br>
      Envie um e-mail para <a href="mailto:edmarjuniob@gmail.com"><strong>edmarjuniob@gmail.com</strong></a> com:<br>
      • <strong>Assunto:</strong> Solicitação de Exclusão de Dados (LGPD)<br>
      • <strong>Corpo do e-mail:</strong> Informe o número de telefone (com DDD) utilizado no WhatsApp da Conflora.
    </div>

    <div class="step-box">
      <strong>Opção 2: Diretamente pelo WhatsApp</strong><br>
      Envie a mensagem <code>"Excluir meus dados"</code> ou <code>"Apagar histórico"</code> para o nosso número de atendimento comercial no WhatsApp.
    </div>

    <h2>Prazo e Procedimento:</h2>
    <p>Após o recebimento da solicitação, nossa equipe processará a exclusão em até <strong>48 horas úteis</strong>. Todas as sessões, mensagens e informações vinculadas ao seu número de telefone serão permanentemente apagadas ou anonimizadas do nosso banco de dados no Firestore.</p>

    <p><a href="/politica-de-privacidade" style="color: #276749;">← Voltar para a Política de Privacidade</a></p>
  </div>
  <footer>
    &copy; 2026 Conflora Horta e Viveiro. Todos os direitos reservados.
  </footer>
</body>
</html>`;
}

function renderWhatsAppSimulatorHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Conflora AI — WhatsApp Web Simulator & Live Firestore</title>
  ${FETCH_SHIM_SCRIPT}
  <style>
    :root {
      --wa-teal: #008069;
      --wa-teal-dark: #005c4b;
      --wa-teal-light: #25d366;
      --wa-bg: #efeae2;
      --wa-panel-bg: #f0f2f5;
      --wa-card: #ffffff;
      --wa-bubble-in: #ffffff;
      --wa-bubble-out: #d9fdd3;
      --wa-text: #111b21;
      --wa-text-muted: #667781;
      --wa-border: #e9edef;
      --wa-blue-tick: #53bdeb;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #dadbd5;
      color: var(--wa-text);
      height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    .app-wrapper {
      width: 100vw;
      height: 100vh;
      background: var(--wa-card);
      display: flex;
      box-shadow: 0 6px 18px rgba(0,0,0,0.1);
      position: relative;
    }
    @media (min-width: 1200px) {
      .app-wrapper {
        width: 98vw;
        height: 96vh;
        border-radius: 10px;
        overflow: hidden;
      }
    }
    /* LEFT SIDEBAR: ESTOQUE E AUDITORIA FIRESTORE */
    .sidebar {
      width: 380px;
      min-width: 340px;
      background: #ffffff;
      border-right: 1px solid var(--wa-border);
      display: flex;
      flex-direction: column;
      z-index: 2;
    }
    @media (max-width: 768px) {
      .sidebar { display: none; }
    }
    .sidebar-header {
      background: var(--wa-panel-bg);
      padding: 12px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--wa-border);
    }
    .db-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      font-weight: 700;
      color: #03543f;
      background: #def7ec;
      padding: 4px 10px;
      border-radius: 12px;
    }
    .db-badge::before {
      content: "";
      width: 7px;
      height: 7px;
      background: #31c48d;
      border-radius: 50%;
    }
    .tabs-bar {
      display: flex;
      background: var(--wa-panel-bg);
      border-bottom: 1px solid var(--wa-border);
    }
    .tab-btn {
      flex: 1;
      padding: 10px 8px;
      font-size: 12px;
      font-weight: 600;
      text-align: center;
      border: none;
      background: none;
      cursor: pointer;
      color: var(--wa-text-muted);
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    .tab-btn.active {
      color: var(--wa-teal);
      border-bottom-color: var(--wa-teal);
      background: #ffffff;
    }
    .customer-config {
      padding: 10px 14px;
      background: #f8fafc;
      border-bottom: 1px solid var(--wa-border);
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .config-row {
      display: flex;
      gap: 6px;
    }
    .config-input {
      flex: 1;
      padding: 6px 10px;
      border: 1px solid #cbd5e0;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
    }
    .config-input:focus { border-color: var(--wa-teal); }
    .sidebar-content {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .product-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
      margin-bottom: 6px;
      transition: background 0.15s;
    }
    .product-item:hover { background: #f8fafc; }
    .product-thumb {
      width: 44px;
      height: 44px;
      border-radius: 6px;
      object-fit: cover;
      background: #e2e8f0;
      flex-shrink: 0;
    }
    .product-info { flex: 1; min-width: 0; }
    .product-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--wa-text);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .product-sub {
      font-size: 11px;
      color: var(--wa-text-muted);
      margin-top: 2px;
    }
    .stock-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 10px;
      background: #e0f2fe;
      color: #0369a1;
      flex-shrink: 0;
      text-align: right;
    }
    .stock-badge.low {
      background: #fee2e2;
      color: #b91c1c;
    }
    .movement-item {
      padding: 8px 10px;
      border-left: 3px solid var(--wa-teal);
      background: #f8fafc;
      border-radius: 0 6px 6px 0;
      margin-bottom: 8px;
      font-size: 12px;
    }
    .movement-date { font-size: 10px; color: var(--wa-text-muted); }

    /* RIGHT CHAT AREA: WHATSAPP WEB AUTHENTIC UI */
    .chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--wa-bg);
      position: relative;
    }
    .chat-header {
      background: var(--wa-panel-bg);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid var(--wa-border);
      z-index: 2;
    }
    .avatar-wrapper {
      position: relative;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: var(--wa-teal);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 20px;
      flex-shrink: 0;
    }
    .chat-header-info { flex: 1; }
    .chat-header-name {
      font-size: 15px;
      font-weight: 600;
      color: var(--wa-text);
    }
    .chat-header-status {
      font-size: 12px;
      color: var(--wa-text-muted);
    }
    .chat-body {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px;
      background-color: #efeae2;
      background-image: radial-gradient(#d4cdc4 1px, transparent 1px);
      background-size: 20px 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .enc-notice {
      align-self: center;
      background: #ffeecd;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 11px;
      color: #54656f;
      text-align: center;
      max-width: 80%;
      margin-bottom: 10px;
      box-shadow: 0 1px 1px rgba(0,0,0,0.06);
    }
    .bubble {
      max-width: 68%;
      padding: 8px 12px;
      border-radius: 7.5px;
      font-size: 14.2px;
      line-height: 1.45;
      position: relative;
      word-wrap: break-word;
      white-space: pre-wrap;
      box-shadow: 0 1px 0.5px rgba(11,20,26,0.13);
    }
    .bubble.user {
      align-self: flex-end;
      background: var(--wa-bubble-out);
      border-top-right-radius: 0;
    }
    .bubble.assistant {
      align-self: flex-start;
      background: var(--wa-bubble-in);
      border-top-left-radius: 0;
    }
    .bubble-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      font-size: 11px;
      color: var(--wa-text-muted);
      margin-top: 4px;
      float: right;
      padding-left: 10px;
    }
    .blue-ticks {
      color: var(--wa-blue-tick);
      font-weight: bold;
    }
    .bubble-img {
      max-width: 100%;
      border-radius: 6px;
      margin-bottom: 6px;
      display: block;
    }

    /* QUICK PILLS BAR */
    .quick-bar {
      padding: 8px 16px;
      background: #f7fafc;
      border-top: 1px solid var(--wa-border);
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      gap: 6px;
      scrollbar-width: none;
    }
    .quick-bar::-webkit-scrollbar { display: none; }
    .pill-btn {
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      padding: 5px 12px;
      font-size: 12px;
      color: #334155;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .pill-btn:hover {
      background: var(--wa-teal);
      color: white;
      border-color: var(--wa-teal);
    }
    .pill-btn.highlight {
      background: #dcfce7;
      border-color: #86efac;
      color: #166534;
      font-weight: 600;
    }
    .pill-btn.highlight:hover {
      background: #16a34a;
      color: white;
    }

    /* WHATSAPP INPUT FOOTER */
    .chat-footer {
      background: var(--wa-panel-bg);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-top: 1px solid var(--wa-border);
    }
    .input-icon-btn {
      background: none;
      border: none;
      font-size: 20px;
      color: #54656f;
      cursor: pointer;
      padding: 4px;
    }
    .message-input {
      flex: 1;
      background: #ffffff;
      border: 1px solid transparent;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14.5px;
      outline: none;
      transition: border-color 0.2s;
    }
    .message-input:focus { border-color: #cbd5e1; }
    .send-circle-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: var(--wa-teal);
      border: none;
      color: white;
      font-size: 18px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .send-circle-btn:hover { background: var(--wa-teal-dark); }
    .send-circle-btn:disabled { background: #cbd5e1; cursor: not-allowed; }

    /* TOAST NOTIFICATION */
    .toast {
      position: absolute;
      top: 70px;
      right: 24px;
      background: #0f172a;
      color: white;
      padding: 12px 18px;
      border-radius: 8px;
      font-size: 13px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      z-index: 100;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s;
      pointer-events: none;
      max-width: 320px;
    }
    .toast.show { opacity: 1; transform: translateY(0); }
  </style>
</head>
<body>
  <div class="app-wrapper">
    <!-- SIDEBAR COM ESTOQUE AO VIVO NO FIRESTORE -->
    <div class="sidebar">
      <div class="sidebar-header">
        <div>
          <strong style="font-size: 14px; color: var(--wa-teal);">Conflora Viveiro</strong>
          <div style="font-size: 11px; color: var(--wa-text-muted);">Painel do Administrador</div>
        </div>
        <span class="db-badge">Firestore (confloraai)</span>
      </div>

      <div class="tabs-bar">
        <button class="tab-btn active" id="tabStockBtn" onclick="switchTab('stock')">Estoque em Tempo Real</button>
        <button class="tab-btn" id="tabMoveBtn" onclick="switchTab('movements')">Baixas & Movimentações</button>
        <button class="tab-btn" id="tabMetaBtn" onclick="switchTab('meta')">Links Meta</button>
      </div>

      <div class="customer-config">
        <div style="font-weight: 600; color: #475569;">Simular com seu número:</div>
        <div class="config-row">
          <input type="text" id="custPhone" class="config-input" value="5564999351616" placeholder="Telefone com DDD" style="width: 140px;" />
          <input type="text" id="custName" class="config-input" value="Edmar Júnio" placeholder="Seu Nome" />
        </div>
      </div>

      <div class="sidebar-content" id="sidebarStockContent">
        <div id="productList">
          <div style="padding: 20px; text-align: center; color: var(--wa-text-muted); font-size: 13px;">Carregando produtos do Firestore...</div>
        </div>
      </div>

      <div class="sidebar-content" id="sidebarMoveContent" style="display: none;">
        <div id="movementList">
          <div style="padding: 20px; text-align: center; color: var(--wa-text-muted); font-size: 13px;">Nenhuma baixa realizada ainda nesta sessão.</div>
        </div>
      </div>

      <div class="sidebar-content" id="sidebarMetaContent" style="display: none; padding: 16px;">
        <div style="font-size: 13px; font-weight: 600; margin-bottom: 10px; color: var(--wa-teal);">Páginas Oficiais de Verificação Meta:</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <a href="/politica-de-privacidade" target="_blank" style="padding: 8px 12px; background: #f1f5f9; border-radius: 6px; text-decoration: none; color: #334155; font-size: 13px; font-weight: 500;">📄 Política de Privacidade</a>
          <a href="/exclusao-de-dados" target="_blank" style="padding: 8px 12px; background: #f1f5f9; border-radius: 6px; text-decoration: none; color: #334155; font-size: 13px; font-weight: 500;">🗑️ Exclusão de Dados (LGPD)</a>
          <a href="/termos-de-servico" target="_blank" style="padding: 8px 12px; background: #f1f5f9; border-radius: 6px; text-decoration: none; color: #334155; font-size: 13px; font-weight: 500;">⚖️ Termos de Serviço</a>
          <a href="/health" target="_blank" style="padding: 8px 12px; background: #f1f5f9; border-radius: 6px; text-decoration: none; color: #334155; font-size: 13px; font-weight: 500;">🩺 Health Check API</a>
        </div>
      </div>
    </div>

    <!-- CHAT AREA WHATSAPP WEB -->
    <div class="chat-area">
      <div class="chat-header">
        <div class="avatar-wrapper">🌱</div>
        <div class="chat-header-info">
          <div class="chat-header-name">Conflora Horta e Viveiro & Agromadeiras</div>
          <div class="chat-header-status">online • Atendimento Inteligente WhatsApp</div>
        </div>
        <div style="display: flex; gap: 14px; color: #54656f; font-size: 18px; cursor: pointer;">
          <span>🔍</span>
          <span title="Recarregar Estoque do Firestore" onclick="fetchInventory()">🔄</span>
        </div>
      </div>

      <div class="chat-body" id="chatBody">
        <div class="enc-notice">
          🔒 As mensagens desta conversa utilizam IA Gemini e realizam baixa atômica de estoque em tempo real no Cloud Firestore (projeto confloraai).
        </div>

        <div class="bubble assistant">
          Olá! Seja muito bem-vindo à Conflora Horta e Viveiro 🌱.
Sou o assistente oficial de vendas. Como posso ajudar com nossas plantas, mudas ou hortaliças hoje?
          <div class="bubble-meta"><span>10:00</span></div>
        </div>
      </div>

      <!-- PILLS DE TESTE RÁPIDO -->
      <div class="quick-bar">
        <button class="pill-btn" onclick="sendPrompt('qual valor da palmeira rabo de raposa?')">🌴 Palmeira Rabo de Raposa</button>
        <button class="pill-btn" onclick="sendPrompt('Vocês tem mini cabra??')">🐐 Mini Cabra</button>
        <button class="pill-btn" onclick="sendPrompt('Vocês tem palmeiras?')">🌱 Consultoria Palmeiras</button>
        <button class="pill-btn highlight" onclick="sendPrompt('Manda pra mim 3 alface cabeça de 8, 3 rucula e 5 cebolinha')">🛒 Fazer Pedido Horta</button>
        <button class="pill-btn" onclick="sendPrompt('pode me mandar foto da palmeira rabo de raposa?')">📸 Pedir Fotos</button>
        <button class="pill-btn" onclick="sendPrompt('Hoje vai ser no débito')">💳 Mudar Pagamento</button>
        <button class="pill-btn highlight" onclick="sendPrompt('Pode confirmar!')">✅ Confirmar Pedido (Dá Baixa no Estoque)</button>
      </div>

      <!-- BARRA DE DIGITAÇÃO WHATSAPP -->
      <div class="chat-footer">
        <button class="input-icon-btn">😊</button>
        <button class="input-icon-btn">📎</button>
        <input type="text" id="chatInput" class="message-input" placeholder="Mensagem" onkeydown="if(event.key==='Enter') sendChatMessage()" />
        <button id="sendCircleBtn" class="send-circle-btn" onclick="sendChatMessage()">➤</button>
      </div>

      <div class="toast" id="stockToast"></div>
    </div>
  </div>

  <script>
    const chatBodyEl = document.getElementById('chatBody');
    const chatInputEl = document.getElementById('chatInput');
    const sendCircleBtnEl = document.getElementById('sendCircleBtn');
    const custPhoneEl = document.getElementById('custPhone');
    const custNameEl = document.getElementById('custName');
    const productListEl = document.getElementById('productList');
    const movementListEl = document.getElementById('movementList');
    const stockToastEl = document.getElementById('stockToast');

    function switchTab(tab) {
      document.getElementById('tabStockBtn').className = 'tab-btn ' + (tab === 'stock' ? 'active' : '');
      document.getElementById('tabMoveBtn').className = 'tab-btn ' + (tab === 'movements' ? 'active' : '');
      document.getElementById('tabMetaBtn').className = 'tab-btn ' + (tab === 'meta' ? 'active' : '');

      document.getElementById('sidebarStockContent').style.display = tab === 'stock' ? 'block' : 'none';
      document.getElementById('sidebarMoveContent').style.display = tab === 'movements' ? 'block' : 'none';
      document.getElementById('sidebarMetaContent').style.display = tab === 'meta' ? 'block' : 'none';
    }

    function showToast(msg) {
      stockToastEl.textContent = msg;
      stockToastEl.classList.add('show');
      setTimeout(() => stockToastEl.classList.remove('show'), 4000);
    }

    function getTimeString() {
      const now = new Date();
      return String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }

    function sendPrompt(text) {
      chatInputEl.value = text;
      sendChatMessage();
    }

    async function sendChatMessage() {
      const text = chatInputEl.value.trim();
      const phone = custPhoneEl.value.trim() || '5564999351616';
      const name = custNameEl.value.trim() || 'Edmar Júnio';
      if (!text) return;

      appendBubble(text, 'user', getTimeString());
      chatInputEl.value = '';
      sendCircleBtnEl.disabled = true;

      const typingBubble = appendBubble('Digitando...', 'assistant', getTimeString(), true);

      try {
        const res = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telefone: phone, nome: name, mensagem: text }),
        });
        const data = await res.json();
        typingBubble.remove();

        if (data.reply) {
          appendBubble(data.reply, 'assistant', getTimeString());

          // Se a intenção foi fechar pedido, atualiza estoque na hora
          if (data.intent === 'ORDER_CONFIRMATION') {
            showToast('📉 Pedido confirmado! Baixa de estoque registrada no Firestore.');
            fetchInventory();
          }
        } else if (data.error) {
          appendBubble('Erro: ' + data.error, 'assistant', getTimeString());
        }
      } catch (err) {
        typingBubble.remove();
        appendBubble('Erro de conexão: ' + err.message, 'assistant', getTimeString());
      } finally {
        sendCircleBtnEl.disabled = false;
        chatInputEl.focus();
      }
    }

    function appendBubble(text, role, time, isTyping = false) {
      const bubble = document.createElement('div');
      bubble.className = 'bubble ' + role;
      bubble.textContent = text;

      if (!isTyping) {
        const meta = document.createElement('div');
        meta.className = 'bubble-meta';
        meta.innerHTML = '<span>' + time + '</span>' + (role === 'user' ? ' <span class="blue-ticks">✓✓</span>' : '');
        bubble.appendChild(meta);
      }

      chatBodyEl.appendChild(bubble);
      chatBodyEl.scrollTop = chatBodyEl.scrollHeight;
      return bubble;
    }

    async function fetchInventory() {
      try {
        const res = await fetch('/api/inventory');
        const data = await res.json();
        if (Array.isArray(data.products)) {
          renderProducts(data.products);
        }
        if (Array.isArray(data.movements)) {
          renderMovements(data.movements);
        }
      } catch (err) {
        console.error('Erro ao carregar estoque:', err);
      }
    }

    function renderProducts(products) {
      productListEl.innerHTML = '';
      products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'product-item';
        const qty = p.stockQuantity ?? p.estoque ?? 0;
        const isLow = qty <= 5;
        const img = p.imageurl || 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?auto=format&fit=crop&w=100&q=80';

        div.innerHTML = \`
          <img src="\${img}" class="product-thumb" alt="\${p.descricao || p.name}" onerror="this.src='https://placehold.co/44x44/22543d/white?text=🌱'" />
          <div class="product-info">
            <div class="product-title">\${p.descricao || p.name}</div>
            <div class="product-sub">\${p.categoria || ''} • R$ \${Number(p.valor_num || p.price || 0).toFixed(2)}</div>
          </div>
          <span class="stock-badge \${isLow ? 'low' : ''}">\${qty} un</span>
        \`;
        productListEl.appendChild(div);
      });
    }

    function renderMovements(movements) {
      movementListEl.innerHTML = '';
      if (movements.length === 0) {
        movementListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--wa-text-muted); font-size: 13px;">Nenhuma baixa realizada ainda.</div>';
        return;
      }
      movements.forEach(m => {
        const div = document.createElement('div');
        div.className = 'movement-item';
        div.innerHTML = \`
          <div><strong>\${m.productName}</strong>: -\${m.quantityDeducted} un</div>
          <div style="font-size: 11px; color: #475569;">Estoque: \${m.previousStock} ➔ \${m.newStock}</div>
          <div class="movement-date">\${new Date(m.createdAt).toLocaleTimeString()} • WhatsApp (\${m.customerPhone || 'Cliente'})</div>
        \`;
        movementListEl.appendChild(div);
      });
    }

    // Carrega estoque ao abrir
    fetchInventory();
  </script>
</body>
</html>`;
}

function renderTermsOfServiceHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termos de Serviço | Conflora AI</title>
  ${FETCH_SHIM_SCRIPT}
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #2d3748; max-width: 800px; margin: 0 auto; padding: 24px 16px; background-color: #f7fafc; }
    .card { background: white; padding: 36px 28px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    h1 { color: #22543d; font-size: 26px; margin-bottom: 8px; }
    h2 { color: #276749; font-size: 19px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    p, li { font-size: 15px; color: #4a5568; }
    footer { text-align: center; margin-top: 32px; font-size: 13px; color: #a0aec0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Termos de Serviço</h1>
    <p><strong>Conflora Horta e Viveiro</strong> — Atendimento WhatsApp</p>

    <h2>1. O Serviço</h2>
    <p>O canal de atendimento via WhatsApp da Conflora é uma ferramenta voltada para disponibilizar catálogo de plantas, tirar dúvidas sobre espécies e portes, orçar pedidos e fornecer suporte a clientes na cidade de Mineiros - GO e região.</p>

    <h2>2. Disponibilidade e Preços</h2>
    <p>Os valores e disponibilidades de mudas, plantas ornamentais, hortaliças e insumos são baseados no estoque físico e catálogo oficial da Conflora. Os pedidos tornam-se vinculantes após a confirmação mútua e validação do pagamento.</p>

    <h2>3. Contato</h2>
    <p>Dúvidas sobre estes termos podem ser enviadas para <a href="mailto:edmarjuniob@gmail.com">edmarjuniob@gmail.com</a>.</p>
  </div>
  <footer>
    &copy; 2026 Conflora Horta e Viveiro. Todos os direitos reservados.
  </footer>
</body>
</html>`;
}

function createApp({ messageService, taskQueueClient, verifyGoogleToken = verifyFirebaseToken, storeRepository, storeAssistant }) {
  const express = getExpress();
  if (!express) { throw new Error('Express module not available'); }
  const app = express();
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'private, no-store');
    next();
  });
  const signatureValidator = new SignatureValidator(config.whatsapp.metaAppSecret);
  const systemStatusService = new SystemStatusService({
    catalogRepo: messageService ? messageService.catalogRepo : null,
    firestoreRepo: messageService ? messageService.firestoreRepo : null,
    whatsappClient: messageService ? messageService.whatsappClient : null,
  });

  // Preserve raw body buffer for signature validation
  app.use(
    express.json({
      limit: '5mb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  const { installStorefront } = require('../storefront/routes');
  const { StoreAssistant } = require('../storefront/assistant');
  installStorefront(app, {
    express,
    firestore: messageService.firestoreRepo.firestore,
    repository: storeRepository,
    assistant: storeAssistant || new StoreAssistant({ client: messageService.agentService?.getAiClient?.(), model: config.gemini.model }),
  });

  const sessions = createWebSessions(messageService.firestoreRepo);
  app.use('/api', sessions.resolve);
  const { installExistingStore, normalizeExistingCheckout } = require('../storefront/existing-store');
  installExistingStore(app, {
    repository: messageService.firestoreRepo,
    assistant: storeAssistant || new StoreAssistant({ client: messageService.agentService?.getAiClient?.(), model: config.gemini.model }),
  });
  app.get('/api/auth/me', (req, res) => {
    res.status(req.user ? 200 : 401).json({ user: req.user || null });
  });
  app.post('/api/auth/logout', async (req, res) => {
    await sessions.logout(req, res);
    res.json({ success: true });
  });
  app.use('/api/admin', (req, res, next) => {
    if (req.path === '/auth/login' || (req.path === '/auth/users' && req.method === 'GET')) {return next();}
    if (!req.user) {return res.status(401).json({ error: 'Entre na sua conta.' });}
    const cashierRoute = /^(?:\/orders(?:\/manual)?|\/daily-metrics|\/stock\/quick-entry|\/alterations|\/notifications(?:\/[^/]+\/read)?)$/.test(req.path);
    if (req.user.role !== 'ADMIN' && !(req.user.role === 'CAIXA' && cashierRoute)) {
      return res.status(403).json({ error: 'Acesso não autorizado para este perfil.' });
    }
    next();
  });
  app.post('/api/admin/import-xlsx', express.raw({ type: 'application/octet-stream', limit: '10mb' }), async (req, res) => {
    try {
      if (!Buffer.isBuffer(req.body)) {return res.status(400).json({ error: 'Envie um arquivo .xlsx.' });}
      const audit = await readProductWorkbook(req.body);
      const previous = await messageService.firestoreRepo.getAllProducts();
      const incoming = new Set(audit.products.map(p => p.id));
      if (req.query.commit !== 'true') {
        return res.status(audit.errors.length ? 422 : 200).json({
          success: audit.errors.length === 0, count: audit.products.length, currentCount: previous.length,
          removed: previous.filter(p => !incoming.has(p.id)).length,
          inactive: audit.products.filter(p => p.status === 'INATIVO').length,
          sheet: audit.sheet, ignoredSheets: audit.ignoredSheets, errors: audit.errors,
          preview: audit.products.slice(0, 8).map(p => ({ id: p.id, name: p.name, price: p.price, status: p.status })),
        });
      }
      if (!['replace', 'merge'].includes(req.query.mode)) {return res.status(400).json({ error: 'Escolha o modo de importação.' });}
      if (req.query.mode === 'replace' && req.headers['x-confirm-replace'] !== 'SUBSTITUIR') {return res.status(400).json({ error: 'Confirme a substituição do catálogo.' });}
      if (audit.errors.length) {return res.status(422).json({ success: false, errors: audit.errors, message: audit.errors.join('\n') });}
      const result = req.query.mode === 'replace'
        ? await messageService.firestoreRepo.replaceProducts(audit.records)
        : await messageService.firestoreRepo.importSpreadsheetData({ type: 'products', records: audit.records });
      if (messageService.catalogRepo) {messageService.catalogRepo.lastCacheTime = 0;}
      return res.status(result.success ? 200 : 503).json(result);
    } catch (error) { return res.status(400).json({ success: false, error: error.message }); }
  });

  // Home / Cardápio Digital Conflora
  app.get(['/', '/products/:productId'], (req, res) => {
    if (process.env.STOREFRONT_STORE_SLUG) {
      const detail = req.params.productId ? '/products/' + encodeURIComponent(req.params.productId) : '';
      return res.redirect('/shop/' + encodeURIComponent(process.env.STOREFRONT_STORE_SLUG) + detail);
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.sendFile(require('node:path').resolve(__dirname, '../../public/storefront/index.html'));
  });
  app.get('/catalogo-classico', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).send(renderHomeHtml());
  });

  // Painel de Administração, Frente de Caixa & Estoque
  app.get('/admin', (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).send(renderAdminHtml());
  });

  // Simulador WhatsApp Oficial
  app.get(['/simulador', '/chat-simulador'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderWhatsAppSimulatorHtml());
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  // Meta Verification: Política de Privacidade
  app.get(['/politica-de-privacidade', '/privacy'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderPrivacyPolicyHtml());
  });

  // Meta Verification: Exclusão de Dados do Usuário
  app.get(['/exclusao-de-dados', '/data-deletion'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderDataDeletionHtml());
  });

  // Meta Verification: Termos de Serviço
  app.get(['/termos-de-servico', '/terms'], (_req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(renderTermsOfServiceHtml());
  });

  // Meta Webhook Verification (GET)
  app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
      Logger.info('Meta Webhook verificado com sucesso.');
      return res.status(200).send(challenge);
    }

    Logger.warn('Tentativa de verificação do Webhook com token inválido.');
    return res.sendStatus(403);
  });

  // Meta Webhook Event Receiver (POST)
  app.post('/webhook', async (req, res) => {
    const signature = req.headers['x-hub-signature-256'];

    if (!signatureValidator.validate(req.rawBody, signature)) {
      Logger.warn('Assinatura do webhook inválida.');
      return res.sendStatus(401);
    }

    res.sendStatus(200);

    const body = req.body;
    if (body.object !== 'whatsapp_business_account' || !Array.isArray(body.entry)) {
      return;
    }

    for (const entry of body.entry) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value || !Array.isArray(value.messages)) {
          continue;
        }

        for (const msg of value.messages) {
          const phone = msg.from;
          const messageId = msg.id;
          const text = msg.text?.body || '';
          const customerName = value.contacts?.[0]?.profile?.name || '';

          if (!text) {
            continue;
          }

          systemStatusService.recordWebhookHit(phone);

          const taskPayload = { phone, message: text, customerName, messageId };

          if (taskQueueClient) {
            await taskQueueClient.enqueueProcessMessage(taskPayload).catch((err) => {
              Logger.error('Erro ao enfileirar tarefa; processando diretamente', err);
              messageService.handleCustomerMessage(taskPayload).catch(() => {});
            });
          } else {
            setImmediate(() => {
              messageService.handleCustomerMessage(taskPayload).catch(() => {});
            });
          }
        }
      }
    }
  });

  // Cloud Tasks Processing Endpoint
  app.post('/tasks/processar-mensagem', async (req, res) => {
    const secret = req.headers['x-conflora-task-secret'];
    if (config.tasks.taskSecret && secret !== config.tasks.taskSecret) {
      return res.sendStatus(401);
    }

    const { phone, message, customerName, messageId } = req.body;
    if (!phone || !message) {
      return res.status(400).send('Dados inválidos');
    }

    try {
      const result = await messageService.handleCustomerMessage({
        phone,
        message,
        customerName,
        messageId,
      });
      res.status(200).json(result);
    } catch (error) {
      Logger.error('Erro ao processar mensagem via Cloud Tasks', error);
      res.status(500).send('Erro interno');
    }
  });

  // Live Inventory & Stock Movements API (Firestore com fallback garantido na planilha padrão LISTA DE PRODUTOS)
  const handleInventoryRequest = async (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    try {
      let products = await messageService.firestoreRepo.getAllProducts();
      if (typeof messageService.firestoreRepo.getSalesOrders === 'function') {
        try {
          const orders = await messageService.firestoreRepo.getSalesOrders();
          products = rankProductSales(products, orders);
        } catch (error) {
          Logger.warn('Ranking de vendas temporariamente indisponível', { error: error.message });
        }
      }
      let movements = [];
      try {
        movements = await messageService.firestoreRepo.getStockMovements(15);
      } catch {
        movements = [];
      }
      res.status(200).json({ products, movements: movements || [] });
    } catch {
      res.status(503).json({ error: 'Catálogo indisponível. Tente novamente.' });
    }
  };

  app.get('/api/inventory', handleInventoryRequest);
  app.get('/api/products', handleInventoryRequest);
  app.get('/api/catalog', handleInventoryRequest);

  // Consultoria Botânica com Agente Conflora AI
  app.post('/api/ai/botanical-consultant', async (req, res) => {
    try {
      const { query, history } = req.body || {};
      const { BotanicalConsultantService } = require('../ai/botanical-consultant');
      const catalogProducts = await messageService.firestoreRepo.getAllProducts();
      const result = await BotanicalConsultantService.consult({
        query: query || '',
        history: history || [],
        catalogProducts: catalogProducts || [],
        agentService: messageService?.agentService || null,
      });
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro na consultoria botânica Conflora AI', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Servir Foto de Produto Armazenada no Cloud Firestore
  app.get('/api/images/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const photo = await messageService.firestoreRepo.getProductPhoto(id);
      if (photo && photo.data) {
        const mimeType = photo.contentType || 'image/jpeg';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
        if (photo.fileName) {
          res.setHeader('Content-Disposition', `inline; filename="${photo.fileName}"`);
        }
        const imgBuffer = Buffer.from(photo.data, 'base64');
        return res.status(200).send(imgBuffer);
      }

      // Se não encontrou foto diretamente, tenta buscar o produto correspondente
      const cleanProdId = id.replace(/^img_/, '');
      const prod = await messageService.firestoreRepo.getProductById(cleanProdId);
      if (prod && prod.imageUrl && prod.imageUrl.startsWith('http') && !prod.imageUrl.includes('/api/images/')) {
        return res.redirect(prod.imageUrl);
      }

      // Fallback em SVG da Conflora
      const { createConfloraSvgFallback } = require('../catalog/product-photo.service');
      const fallbackBase64 = createConfloraSvgFallback(prod?.name || 'Conflora', prod?.category || 'Viveiro');
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(Buffer.from(fallbackBase64, 'base64'));
    } catch (err) {
      Logger.error('Erro ao servir imagem do Firestore', err);
      res.status(500).send('Erro ao carregar imagem');
    }
  });

  // Client Web Orders API
  app.post(['/api/orders', '/api/storefront/orders'], async (req, res) => {
    try {
      await normalizeExistingCheckout(req, messageService.firestoreRepo);
      const {
        customerName,
        customerPhone,
        orderType,
        deliveryAddress,
        paymentMethod,
        items,
        coupon,
        discount,
        subtotal,
        cashTendered,
        changeDue,
      } = req.body;

      if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Dados do pedido incompletos.' });
      }

      const calculatedSubtotal = Number(subtotal) || items.reduce((acc, it) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
      const appliedDiscount = Math.max(0, Number(discount) || 0);
      const finalTotal = Math.max(0, calculatedSubtotal - appliedDiscount);

      const order = await messageService.firestoreRepo.createDirectOrder({
        customerId: req.user?.id || '',
        customerEmail: req.user?.email || '',
        customerName,
        customerPhone,
        orderType: orderType || 'DELIVERY',
        deliveryAddress: deliveryAddress || 'Retirada no Viveiro Conflora',
        paymentMethod: paymentMethod || 'PIX',
        items,
        subtotal: calculatedSubtotal,
        coupon: coupon || '',
        discount: appliedDiscount,
        total: finalTotal,
        cashTendered: Number(cashTendered) || 0,
        changeDue: Number(changeDue) || 0,
        status: 'PENDING',
        source: 'WEB_CATALOG',
      });

      await messageService.firestoreRepo.deductStock(items, customerPhone);

      // Notificação para todos os usuários ADMIN sobre a venda finalizada
      await messageService.firestoreRepo.notifyAllAdminUsersOfSale(order, { source: 'WEB_CATALOG' }).catch((err) => {
        Logger.warn('Aviso: falha ao notificar administradores sobre nova venda web', { error: err.message });
      });

      // Notificação ao Proprietário via WhatsApp se o client estiver ativo
      const ownerNumber = process.env.OWNER_WHATSAPP_NUMBER || '5564999351616';
      if (messageService.whatsappClient && ownerNumber) {
        try {
          const itemsListText = items
            .map((it) => `• ${it.quantity}x ${it.name} (R$ ${Number(it.price || 0).toFixed(2).replace('.', ',')} un) = R$ ${(Number(it.price || 0) * Number(it.quantity || 1)).toFixed(2).replace('.', ',')}`)
            .join('\n');

          const couponText = appliedDiscount > 0
            ? `🎟️ *Cupom:* ${coupon} (-R$ ${appliedDiscount.toFixed(2).replace('.', ',')})\n`
            : '';

          let cashDetails = '';
          if (paymentMethod === 'DINHEIRO') {
            const tendered = Number(cashTendered) || 0;
            const change = Number(changeDue) || 0;
            if (change > 0) {
              cashDetails = `💵 *Dinheiro em mãos:* R$ ${tendered.toFixed(2).replace('.', ',')}\n💰 *Levar de troco:* R$ ${change.toFixed(2).replace('.', ',')}\n`;
            } else {
              cashDetails = `💵 *Dinheiro em mãos:* R$ ${(tendered || finalTotal).toFixed(2).replace('.', ',')}\n✅ *Valor exato, não precisa de troco*\n`;
            }
          }

          const notificationText = (
            `🔔 *NOVO PEDIDO FECHADO - CONFLORA* 🔔\n\n` +
            `📦 *Pedido:* #${order.id}\n` +
            `📅 *Data:* ${new Date().toLocaleString('pt-BR')}\n\n` +
            `👤 *Cliente:* ${customerName}\n` +
            `📱 *WhatsApp:* ${customerPhone}\n` +
            `📍 *Entrega:* ${orderType === 'DELIVERY' ? deliveryAddress : '🏬 Retirada no Viveiro Conflora'}\n\n` +
            `🛒 *Itens do Pedido:*\n` +
            `${itemsListText}\n\n` +
            `💵 *Subtotal:* R$ ${calculatedSubtotal.toFixed(2).replace('.', ',')}\n` +
            `${couponText}` +
            `💰 *Total Final:* R$ ${finalTotal.toFixed(2).replace('.', ',')}\n` +
            `💳 *Forma de Pagamento:* ${paymentMethod}\n` +
            `${cashDetails}`
          );

          await messageService.whatsappClient.sendTextMessage(ownerNumber, notificationText).catch(() => {});
        } catch {
          // Mensagem opcional de WhatsApp para dono
        }
      }

      res.status(200).json({ success: true, order });
    } catch (err) {
      Logger.error('Erro ao registrar pedido web', err);
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  // Client: Histórico de Compras e Produtos Mais Comprados
  app.get('/api/customer/orders', async (req, res) => {
    try {
      if (!req.user) {return res.status(401).json({ error: 'Entre na sua conta.' });}
      const data = await messageService.firestoreRepo.getCustomerPurchases(req.user.id);
      res.status(200).json({ success: true, ...data });
    } catch (err) {
      Logger.error('Erro ao buscar pedidos do cliente', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: Get all orders (Web & WhatsApp)
  app.get('/api/admin/orders', async (_req, res) => {
    try {
      const orders = await messageService.firestoreRepo.getAllOrders(50);
      res.status(200).json(orders);
    } catch (err) {
      Logger.error('Erro ao buscar pedidos no admin', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Update order status (CONFIRMED, DELIVERED, CANCELLED)
  app.post('/api/admin/orders/:id/action', async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await messageService.firestoreRepo.updateOrderStatus(id, status);
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro ao atualizar status do pedido', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Nova Venda Manual no Balcão / Caixa
  app.post('/api/admin/orders/manual', async (req, res) => {
    try {
      const { customerName, customerPhone, items, paymentMethod, notes } = req.body;
      const order = await messageService.firestoreRepo.createManualOrder({
        customerName,
        customerPhone,
        items,
        paymentMethod,
        notes,
      });

      // Notificação para todos os usuários ADMIN sobre a venda manual no balcão
      await messageService.firestoreRepo.notifyAllAdminUsersOfSale(order, { source: 'CAIXA_MANUAL' }).catch((err) => {
        Logger.warn('Aviso: falha ao notificar administradores sobre venda manual no caixa', { error: err.message });
      });

      res.status(200).json({ success: true, order });
    } catch (err) {
      Logger.error('Erro ao lançar pedido manual no caixa', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Entrada Rápida de Estoque
  app.post('/api/admin/stock/quick-entry', async (req, res) => {
    try {
      const { productId, quantityAdded } = req.body;
      const result = await messageService.firestoreRepo.quickAddStock(productId, quantityAdded);
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro na entrada rápida de estoque', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Salvar / Atualizar Produto (com suporte a foto direta no Firestore e padrão de nomes/tags)
  app.post('/api/admin/products', async (req, res) => {
    try {
      const product = req.body;
      await messageService.firestoreRepo.saveProduct(product);
      if (messageService.catalogRepo) {
        messageService.catalogRepo.lastCacheTime = 0;
      }
      res.status(200).json({ success: true, product });
    } catch (err) {
      Logger.error('Erro ao salvar produto no admin', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Enviar Foto(s) de Produto Direto para o Firestore (com compressão inteligente, padrão Conflora e preservação para zoom)
  app.post('/api/admin/products/:id/photo', async (req, res) => {
    try {
      const { id } = req.params;
      const prod = (await messageService.firestoreRepo.getProductById(id)) || { id, name: req.body.name || 'Produto' };

      const { photoBase64, photosBase64, photos, contentType, maxWidth, maxHeight, quality, format, append } = req.body || {};
      const incomingList = Array.isArray(photosBase64) && photosBase64.length > 0
        ? photosBase64
        : (Array.isArray(photos) && photos.length > 0 ? photos : (photoBase64 ? [photoBase64] : null));

      if (!incomingList || incomingList.length === 0) {
        return res.status(400).json({ error: 'Envie os dados da foto em base64.' });
      }

      const { buildOptimizedFirestorePhotoDocument } = require('../catalog/product-photo.service');
      const savedPhotos = [];
      const existingImages = (append && Array.isArray(prod.images)) ? [...prod.images] : [];
      const startIndex = existingImages.length;

      for (let i = 0; i < incomingList.length; i++) {
        const item = incomingList[i];
        const rawBase = typeof item === 'string' ? item : (item.photoBase64 || item.base64 || item.data || '');
        const cType = (typeof item === 'object' && item.contentType) ? item.contentType : (contentType || 'image/jpeg');
        const cleanBase64 = String(rawBase).replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

        const photoDoc = await buildOptimizedFirestorePhotoDocument(prod, {
          base64Data: cleanBase64,
          contentType: cType,
          source: 'WEBSITE_DIRECT',
          index: startIndex + i,
          maxWidth: maxWidth ? parseInt(maxWidth, 10) : undefined,
          maxHeight: maxHeight ? parseInt(maxHeight, 10) : undefined,
          quality: quality ? parseInt(quality, 10) : undefined,
          format,
          preserveZoomQuality: true,
        });

        await messageService.firestoreRepo.saveProductPhoto(photoDoc);
        savedPhotos.push(photoDoc);
      }

      const newUrls = savedPhotos.map((p) => `/api/images/${p.id}`);
      const allUrls = append ? Array.from(new Set([...existingImages, ...newUrls])) : newUrls;
      const primaryPhoto = savedPhotos[0];

      const updatedProduct = {
        ...prod,
        imageUrl: allUrls[0] || `/api/images/${primaryPhoto.id}`,
        images: allUrls,
        imageFileId: primaryPhoto.id,
        imagePathCache: allUrls[0],
        tagsAi: primaryPhoto.tagsAi,
        tags_ia: primaryPhoto.tagsAi,
        descriptionAi: primaryPhoto.descriptionAi,
        descricao_ia: primaryPhoto.descriptionAi,
        updatedAt: new Date().toISOString(),
      };

      await messageService.firestoreRepo.saveProduct(updatedProduct);

      if (messageService.catalogRepo) {
        messageService.catalogRepo.lastCacheTime = 0;
      }

      res.status(200).json({
        success: true,
        photo: {
          id: primaryPhoto.id,
          fileName: primaryPhoto.fileName,
          tags: primaryPhoto.tagsAi,
          url: updatedProduct.imageUrl,
          compression: primaryPhoto.compression || null,
        },
        photos: savedPhotos.map((p) => ({
          id: p.id,
          fileName: p.fileName,
          tags: p.tagsAi,
          url: `/api/images/${p.id}`,
          compression: p.compression || null,
        })),
        product: updatedProduct,
      });
    } catch (err) {
      Logger.error('Erro no upload de foto para o Firestore', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Upload múltiplo direto via /api/admin/products/:id/photos
  app.post('/api/admin/products/:id/photos', async (req, res) => {
    req.url = `/api/admin/products/${req.params.id}/photo`;
    return app.handle(req, res);
  });

  // Público: Consulta fotos detalhadas de um produto
  app.get('/api/products/:id/photos', async (req, res) => {
    try {
      const { id } = req.params;
      const photos = await messageService.firestoreRepo.getProductPhotos(id);
      res.status(200).json({ success: true, count: photos.length, photos });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Utilitário de Compressão e Redimensionamento de Imagem no Servidor
  app.post('/api/admin/images/compress', async (req, res) => {
    try {
      const { imageBase64, maxWidth, maxHeight, quality, format } = req.body || {};
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'Envie imageBase64 para compressão.' });
      }

      const { compressImageBase64 } = require('../catalog/image-compressor');
      const result = await compressImageBase64(imageBase64, {
        maxWidth: maxWidth ? parseInt(maxWidth, 10) : undefined,
        maxHeight: maxHeight ? parseInt(maxHeight, 10) : undefined,
        quality: quality ? parseInt(quality, 10) : undefined,
        format,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      Logger.error('Erro na compressão de imagem no servidor', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Transferir Fotos do Google Drive da Planilha para o Firestore com Padrão de Nomes e Tags
  app.post('/api/admin/transfer-drive-photos', async (_req, res) => {
    try {
      const result = await messageService.firestoreRepo.transferAllDrivePhotosToFirestore();
      if (messageService.catalogRepo) {
        messageService.catalogRepo.lastCacheTime = 0;
      }
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro ao transferir fotos do Google Drive para o Firestore', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Excluir Produto
  app.delete('/api/admin/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await messageService.firestoreRepo.deleteProduct(id);
      res.status(200).json({ success: true });
    } catch (err) {
      Logger.error('Erro ao excluir produto no admin', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Importar Dados da Planilha
  app.post('/api/admin/import-data', async (req, res) => {
    try {
      const { type, records } = req.body;
      const result = await messageService.firestoreRepo.importSpreadsheetData({ type, records });
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro na importação de dados da planilha', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Restaurar / Popular Catálogo Padrão
  app.post('/api/admin/seed-catalog', async (_req, res) => {
    try {
      const { DEFAULT_CATALOG_ITEMS } = require('../catalog/default-catalog');
      await messageService.firestoreRepo.batchUpsertProducts(DEFAULT_CATALOG_ITEMS);
      res.status(200).json({ success: true, count: DEFAULT_CATALOG_ITEMS.length });
    } catch (err) {
      Logger.error('Erro ao semear catálogo padrão', err);
      res.status(500).json({ error: err.message });
    }
  });

  // System Diagnostics & Connection Status API (Exclusivo Admin)
  app.get('/api/admin/system-status', async (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    try {
      const status = await systemStatusService.getSystemStatus();
      res.status(200).json(status);
    } catch (err) {
      Logger.error('Erro ao coletar status do sistema', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/test-sheets', async (_req, res) => {
    try {
      const result = await systemStatusService.checkGoogleSheetsStatus();
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/admin/test-webhook', async (_req, res) => {
    try {
      const t0 = Date.now();
      const status = systemStatusService.checkWhatsAppStatus();
      res.status(200).json({ ...status, pingLatencyMs: Date.now() - t0, pingSuccess: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Auth: Google Sign-In (Clientes opcionais e Admin com acesso liberado)
  app.post('/api/auth/google', async (req, res) => {
    try {
      const { idToken } = req.body || {};
      if (typeof idToken !== 'string' || !idToken.trim()) {
        return res.status(401).json({ success: false, error: 'Token Firebase obrigatório.' });
      }
      let identity;
      try {
        identity = await verifyGoogleToken(idToken);
      } catch {
        return res.status(401).json({ success: false, error: 'Sessão Google inválida ou expirada. Entre novamente.' });
      }
      if (!identity.email || identity.email_verified !== true || identity.firebase?.sign_in_provider !== 'google.com') {
        return res.status(401).json({ success: false, error: 'Use uma conta Google com e-mail verificado.' });
      }
      const { email, name, picture, uid } = identity;

      const normalizedEmail = email.toLowerCase().trim();
      const users = await messageService.firestoreRepo.getAllUsers();
      const existingUser = users.find((u) => u.email && u.email.toLowerCase().trim() === normalizedEmail);

      if (existingUser?.active === false) {return res.status(403).json({ error: 'Usuário inativo.' });}

      // Edmar Júnio ou qualquer usuário previamente cadastrado com perfil ADMIN
      const isSuperAdmin = normalizedEmail === 'edmarjuniob@gmail.com' || (existingUser && existingUser.role === 'ADMIN');
      const role = isSuperAdmin ? 'ADMIN' : (existingUser ? existingUser.role : 'CLIENTE');

      const user = {
        id: existingUser ? existingUser.id : `usr-g-${uid}`,
        name: name || (existingUser ? existingUser.name : normalizedEmail.split('@')[0]),
        email: normalizedEmail,
        picture: picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(name || normalizedEmail)}&background=15803d&color=fff`,
        role,
        authProvider: 'GOOGLE',
        firebaseUid: uid,
      };

      // Sempre persiste o usuário para que o admin possa gerenciá-lo na lista de usuários
      await messageService.firestoreRepo.saveUser({ ...existingUser, ...user });

      await sessions.issue(req, res, user);
      res.status(200).json({ success: true, user });
    } catch (err) {
      Logger.error('Erro na autenticação Google', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Auth: Cadastro de Cliente com Email e Senha (perfil padrão: CLIENTE)
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password, phone, address } = req.body;
      const result = await messageService.firestoreRepo.registerUser({ name, email, password, phone, address });
      if (!result.success) {
        return res.status(400).json(result);
      }
      await sessions.issue(req, res, result.user);
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro no cadastro de usuário', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Auth: Login do Cliente com Email e Senha
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await messageService.firestoreRepo.loginUser(email, password);
      if (!result.success) {
        return res.status(401).json(result);
      }
      await sessions.issue(req, res, result.user);
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro no login de usuário', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Admin: Alterar Perfil de qualquer Usuário (CLIENTE, CAIXA, ADMIN)
  app.post('/api/admin/users/:id/role', async (req, res) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const result = await messageService.firestoreRepo.updateUserRole(id, role);
      if (result.user) {result.user = safeUser(result.user);}
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro ao atualizar perfil do usuário', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Auth: Login do Colaborador (Admin ou Caixa)
  app.post('/api/admin/auth/login', async (req, res) => {
    try {
      const { userId, pin } = req.body;
      const result = await messageService.firestoreRepo.authenticateUser(userId, pin);
      if (!result.success) {
        return res.status(401).json(result);
      }
      await sessions.issue(req, res, result.user);
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro no login admin', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Auth: Listar Colaboradores para Autenticação e Gestão
  app.get('/api/admin/auth/users', async (req, res) => {
    try {
      const users = await messageService.firestoreRepo.getAllUsers();
      res.status(200).json(req.user?.role === 'ADMIN' ? users.map(safeUser) : users.filter(u => u.active !== false && ['ADMIN', 'CAIXA'].includes(u.role)).map(u => ({ id: u.id, name: u.name, role: u.role })));
    } catch (err) {
      Logger.error('Erro ao listar usuários', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Criar ou Editar Colaborador
  app.post('/api/admin/users', async (req, res) => {
    try {
      const userData = req.body;
      const saved = await messageService.firestoreRepo.saveUser(userData);
      res.status(200).json({ success: true, user: safeUser(saved) });
    } catch (err) {
      Logger.error('Erro ao salvar colaborador', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: Excluir Colaborador
  app.delete('/api/admin/users/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await messageService.firestoreRepo.deleteUser(id);
      res.status(200).json({ success: deleted });
    } catch (err) {
      Logger.error('Erro ao excluir colaborador', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Alterações de Venda: Listar Solicitações
  app.get('/api/admin/alterations', async (_req, res) => {
    try {
      const alterations = await messageService.firestoreRepo.getAllOrderAlterations();
      res.status(200).json(alterations);
    } catch (err) {
      Logger.error('Erro ao buscar alterações', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Alterações de Venda: Criar Solicitação pelo Atendente do Caixa
  app.post('/api/admin/alterations', async (req, res) => {
    try {
      const { orderId, originalOrder, proposedOrder, reason } = req.body;
      if (!orderId || !proposedOrder) {
        return res.status(400).json({ error: 'Dados da solicitação incompletos.' });
      }
      const requestObj = await messageService.firestoreRepo.createOrderAlterationRequest({
        orderId,
        originalOrder,
        proposedOrder,
        requestedBy: req.user.id,
        requestedByName: req.user.name,
        reason,
      });
      res.status(200).json({ success: true, request: requestObj });
    } catch (err) {
      Logger.error('Erro ao criar solicitação de alteração', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Alterações de Venda: Administrador Aceita ou Recusa com Motivo
  app.post('/api/admin/alterations/:id/review', async (req, res) => {
    try {
      const { id } = req.params;
      const { action, rejectionReason } = req.body;
      const result = await messageService.firestoreRepo.reviewOrderAlteration({
        requestId: id,
        action,
        reviewedBy: req.user.id,
        rejectionReason,
      });
      res.status(200).json(result);
    } catch (err) {
      Logger.error('Erro ao revisar alteração', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Notificações: Buscar para o usuário (Caixa ou Admin)
  app.get('/api/admin/notifications', async (req, res) => {
    try {
      const userId = req.user.id;
      const notifs = await messageService.firestoreRepo.getUserNotifications(userId);
      res.status(200).json(notifs);
    } catch (err) {
      Logger.error('Erro ao buscar notificações', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Notificações: Marcar como lida
  app.post('/api/admin/notifications/:id/read', async (req, res) => {
    try {
      const { id } = req.params;
      await messageService.firestoreRepo.markNotificationRead(id);
      res.status(200).json({ success: true });
    } catch (err) {
      Logger.error('Erro ao atualizar notificação', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Métricas do Dia e Resumo do Caixa
  app.get('/api/admin/daily-metrics', async (_req, res) => {
    try {
      const metrics = await messageService.firestoreRepo.getDailySalesMetrics();
      res.status(200).json(metrics);
    } catch (err) {
      Logger.error('Erro ao buscar métricas diárias', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Local Testing Chat Endpoint
  if (config.isDev || process.env.NODE_ENV !== 'production') {
    app.post('/chat', async (req, res) => {
      const { telefone, nome, mensagem } = req.body;
      if (!telefone || !mensagem) {
        return res.status(400).json({ error: 'Campos "telefone" e "mensagem" são obrigatórios.' });
      }

      try {
        const result = await messageService.handleCustomerMessage({
          phone: telefone,
          message: mensagem,
          customerName: nome || 'Cliente Teste',
          messageId: `local-${Date.now()}`,
        });
        const products = await messageService.firestoreRepo.getAllProducts();
        res.status(200).json({ ...result, products });
      } catch (error) {
        Logger.error('Erro no endpoint /chat local', error);
        res.status(500).json({ error: error.message });
      }
    });
  }

  return app;
}

module.exports = {
  createApp,
  renderHomeHtml,
  renderAdminHtml,
  renderWhatsAppSimulatorHtml,
  renderPrivacyPolicyHtml,
  renderDataDeletionHtml,
  renderTermsOfServiceHtml,
};
