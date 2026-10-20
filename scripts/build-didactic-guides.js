const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

const ROOT_DIR = path.resolve(__dirname, '..');
const GUIAS_DIR = path.resolve(ROOT_DIR, 'public/guias');
const SCREENS_DIR = path.resolve(ROOT_DIR, 'tmp/guide-screens');
const BRAIN_DIR = 'C:/Users/Junin/.gemini/antigravity/brain/540fc688-80a5-4954-b08e-bcd05b9b8033';

if (!fs.existsSync(GUIAS_DIR)) fs.mkdirSync(GUIAS_DIR, { recursive: true });

function getBase64Img(name) {
  const file = path.join(SCREENS_DIR, name);
  if (!fs.existsSync(file)) return '';
  return `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
}

const baseCss = `
  @page {
    size: A4;
    margin: 12mm 14mm 14mm 14mm;
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #1e293b;
    background: #f8fafc;
    margin: 0;
    padding: 24px;
    line-height: 1.6;
    font-size: 14px;
  }
  .container {
    max-width: 860px;
    margin: 0 auto;
    background: #ffffff;
    border-radius: 20px;
    padding: 32px 36px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.06);
    border: 1px solid #e2e8f0;
  }
  .header-card {
    background: linear-gradient(135deg, #14532d 0%, #166534 100%);
    color: #ffffff;
    padding: 24px 28px;
    border-radius: 16px;
    margin-bottom: 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 6px 16px rgba(20, 83, 45, 0.2);
  }
  .header-title {
    font-size: 24px;
    font-weight: 800;
    margin: 0 0 6px 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .header-sub {
    font-size: 15px;
    color: #bbf7d0;
    font-weight: 600;
    margin: 0;
  }
  .header-badge {
    background: #fef08a;
    color: #854d0e;
    font-weight: 800;
    font-size: 12px;
    padding: 6px 14px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 2px solid #ca8a04;
  }
  .step-card {
    background: #ffffff;
    border: 2px solid #e2e8f0;
    border-left: 6px solid #16a34a;
    border-radius: 16px;
    padding: 22px 24px;
    margin-bottom: 24px;
    page-break-inside: avoid;
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
  }
  .step-header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 12px;
  }
  .step-circle {
    background: #16a34a;
    color: #ffffff;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 800;
    flex-shrink: 0;
    box-shadow: 0 3px 6px rgba(22, 163, 74, 0.3);
  }
  .step-title {
    font-size: 18px;
    font-weight: 800;
    color: #0f172a;
    margin: 0;
  }
  .step-desc {
    color: #334155;
    font-size: 14px;
    margin-bottom: 14px;
  }
  .step-desc ul {
    margin: 8px 0;
    padding-left: 20px;
  }
  .step-desc li {
    margin-bottom: 6px;
  }
  .screen-box {
    margin-top: 14px;
    border: 2px solid #cbd5e1;
    border-radius: 12px;
    overflow: hidden;
    background: #0f172a;
    text-align: center;
    box-shadow: 0 6px 16px rgba(0,0,0,0.08);
  }
  .screen-box img {
    max-width: 100%;
    height: auto;
    max-height: 420px;
    display: block;
    margin: 0 auto;
    object-fit: contain;
    background: #fff;
  }
  .screen-legend {
    background: #f1f5f9;
    color: #475569;
    font-size: 12px;
    font-weight: 700;
    padding: 8px 14px;
    text-align: left;
    border-top: 1px solid #cbd5e1;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pill-action {
    display: inline-block;
    background: #16a34a;
    color: #ffffff;
    font-weight: 800;
    font-size: 12px;
    padding: 3px 9px;
    border-radius: 6px;
    margin: 0 2px;
  }
  .pill-yellow {
    display: inline-block;
    background: #eab308;
    color: #000;
    font-weight: 800;
    font-size: 12px;
    padding: 3px 9px;
    border-radius: 6px;
    margin: 0 2px;
  }
  .box-tip {
    background: #fefce8;
    border: 2px solid #fef08a;
    border-left: 6px solid #eab308;
    border-radius: 12px;
    padding: 14px 18px;
    margin: 20px 0;
    color: #713f12;
    font-size: 13.5px;
    page-break-inside: avoid;
  }
  .box-alert {
    background: #fef2f2;
    border: 2px solid #fecaca;
    border-left: 6px solid #ef4444;
    border-radius: 12px;
    padding: 14px 18px;
    margin: 20px 0;
    color: #991b1b;
    font-size: 13.5px;
    page-break-inside: avoid;
  }
  .page-break {
    page-break-after: always;
    height: 1px;
  }
  .footer {
    text-align: center;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    margin-top: 36px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
  }
`;

// ==========================================
// 1. GUIA DO VENDEDOR
// ==========================================
function getSellerHtml() {
  const img1 = getBase64Img('seller-1-catalog.png');
  const img2 = getBase64Img('seller-2-cart.png');
  const img3 = getBase64Img('seller-4-payment-modal.png');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Guia do Vendedor · Conflora</title>
  <style>${baseCss}</style>
</head>
<body>
  <div class="container">
    <div class="header-card">
      <div>
        <h1 class="header-title">🌿 Conflora Horta &amp; Viveiro</h1>
        <p class="header-sub">Guia Passo a Passo Oficial · 🛍️ VENDEDOR &amp; BALCÃO</p>
      </div>
      <div class="header-badge">Para Toda a Equipe</div>
    </div>

    <div class="box-tip">
      👶 <strong>Objetivo Deste Guia:</strong> Explicar de forma tão simples e clara que qualquer pessoa consiga abrir o sistema, montar um pedido para o cliente e finalizar sem nenhuma dúvida!
    </div>

    <!-- PASSO 1 -->
    <div class="step-card">
      <div class="step-header">
        <div class="step-circle">1</div>
        <h2 class="step-title">Achar o Produto e Colocar no Pedido</h2>
      </div>
      <div class="step-desc">
        Quando o cliente pedir uma planta, muda ou adubo:
        <ul>
          <li><strong>Onde olhar:</strong> A tela já mostra os produtos em <strong>ordem de A a Z</strong>.</li>
          <li><strong>Procurar digitando:</strong> Clique na 🔍 <em>Lupinha</em> lá no topo e digite o nome (ex: "alfa" para Alface ou "muda" para Mudas).</li>
          <li><strong>Procurar por categoria:</strong> Clique nas abas coloridas (<em>Hortifruti</em>, <em>Mudas e Flores</em>, <em>Adubos</em>).</li>
          <li><strong>Como adicionar:</strong> Basta dar <strong>1 toque ou clique</strong> no cartão do produto! Ele pula direto para a comanda do lado direito.</li>
        </ul>
      </div>
      ${img1 ? `<div class="screen-box"><img src="${img1}"><div class="screen-legend">📸 Tela 1: Produtos organizados de A a Z com busca rápida no topo</div></div>` : ''}
    </div>

    <!-- PASSO 2 -->
    <div class="step-card">
      <div class="step-header">
        <div class="step-circle">2</div>
        <h2 class="step-title">Conferir a Quantidade e o Tipo do Pedido</h2>
      </div>
      <div class="step-desc">
        Olhe para a coluna direita (a comanda do cliente):
        <ul>
          <li><strong>Aumentar quantidade:</strong> Clique no botão <span class="pill-action">+</span>.</li>
          <li><strong>Diminuir quantidade:</strong> Clique no botão <span class="pill-yellow">-</span>.</li>
          <li><strong>Tirar do carrinho:</strong> Clicou errado? Clique no <strong style="color:#ef4444;">X</strong> ao lado do produto para retirar.</li>
          <li><strong>Balcão ou Entrega:</strong>
            <ul>
              <li>Se o cliente vai levar na mão agora: Deixe marcado em <strong>Balcão</strong>.</li>
              <li>Se é para levar na casa dele: Marque <strong>Entrega</strong> e informe o endereço.</li>
            </ul>
          </li>
          <li>O valor total é somado <strong>sozinho e na hora</strong>! Não precisa de calculadora.</li>
        </ul>
      </div>
      ${img2 ? `<div class="screen-box"><img src="${img2}"><div class="screen-legend">📸 Tela 2: Comanda aberta com itens, botões + e -, e valor total automático</div></div>` : ''}
    </div>

    <div class="page-break"></div>

    <!-- PASSO 3 -->
    <div class="step-card">
      <div class="step-header">
        <div class="step-circle">3</div>
        <h2 class="step-title">Finalizar o Pedido e Escolher o Pagamento</h2>
      </div>
      <div class="step-desc">
        Quando terminar de adicionar tudo, clique no botão verde grande <span class="pill-action">PAGAR - F1</span>:
        <ul>
          <li><strong>Opção A - Mandar para o Caixa Central:</strong> Se você só tira o pedido e o cliente vai pagar no balcão do caixa, marque a caixinha <em>"Somente criar comanda e encaminhar ao caixa"</em> e confirme. A comanda pula na tela do caixa na hora!</li>
          <li><strong>Opção B - Você mesmo receber do cliente:</strong>
            <ul>
              <li><strong>💵 Dinheiro:</strong> Digite o valor que o cliente te deu. A tela mostra exatamente quanto você deve voltar de troco.</li>
              <li><strong>⚡ PIX:</strong> O sistema gera o QR Code na tela para o cliente pagar com o celular.</li>
              <li><strong>💳 Cartão Débito / Crédito:</strong> Passe na maquininha física da loja e confirme.</li>
            </ul>
          </li>
        </ul>
      </div>
      ${img3 ? `<div class="screen-box"><img src="${img3}"><div class="screen-legend">📸 Tela 3: Janela de Pagamento com opções de PIX, Cartão, Dinheiro ou Mandar pro Caixa</div></div>` : ''}
    </div>

    <div class="box-alert">
      ⚠️ <strong>Regra Importante:</strong> Se for venda Fiada (A Prazo), sempre selecione o cliente cadastrado na lista para que a dívida fique anotada na ficha dele corretamente!
    </div>

    <div class="footer">
      Conflora Horta &amp; Viveiro · Guia do Vendedor · Sistema Conflora AI
    </div>
  </div>
</body>
</html>`;
}

// ==========================================
// 2. GUIA DO CAIXA
// ==========================================
function getCashierHtml() {
  const img1 = getBase64Img('cashier-1-today-sales.png');
  const img2 = getBase64Img('admin-2-cashier-audit.png');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Guia do Caixa · Conflora</title>
  <style>${baseCss}</style>
</head>
<body>
  <div class="container">
    <div class="header-card" style="background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%);">
      <div>
        <h1 class="header-title">🌿 Conflora Horta &amp; Viveiro</h1>
        <p class="header-sub" style="color: #bfdbfe;">Guia Passo a Passo Oficial · 💵 OPERADOR DE CAIXA</p>
      </div>
      <div class="header-badge" style="background:#dbeafe; color:#1e40af; border-color:#3b82f6;">Fluxo Financeiro</div>
    </div>

    <div class="box-tip">
      👶 <strong>Sua Missão no Caixa:</strong> Receber pagamentos dos clientes, conferir se o dinheiro e os cartões estão certos e fechar o caixa no final do dia sem sobrar nem faltar um centavo!
    </div>

    <!-- PASSO 1 -->
    <div class="step-card" style="border-left-color: #2563eb;">
      <div class="step-header">
        <div class="step-circle" style="background: #2563eb;">1</div>
        <h2 class="step-title">Receber Vendas e Ver Comandas Abertas</h2>
      </div>
      <div class="step-desc">
        Na tela do caixa:
        <ul>
          <li><strong>Comandas dos vendedores:</strong> Clique no botão <span class="pill-action" style="background:#2563eb;">F2 Comandas</span> para ver todos os pedidos que os vendedores enviaram para você cobrar.</li>
          <li><strong>Cobrar direto no balcão:</strong> Você também pode lançar produtos direto igual ao vendedor e clicar em <span class="pill-action" style="background:#16a34a;">F1 Pagar</span>.</li>
          <li><strong>Conferência do Pix:</strong> Quando o cliente pagar em Pix no balcão, confira o comprovante na tela do celular dele ou no extrato do Sicredi antes de liberar a mercadoria!</li>
        </ul>
      </div>
      ${img1 ? `<div class="screen-box"><img src="${img1}"><div class="screen-legend">📸 Tela 1: Frente de Caixa com botões F1 (Pagar), F2 (Comandas) e F3 (Relatório)</div></div>` : ''}
    </div>

    <!-- PASSO 2 -->
    <div class="step-card" style="border-left-color: #2563eb;">
      <div class="step-header">
        <div class="step-circle" style="background: #2563eb;">2</div>
        <h2 class="step-title">Conferência dos Totais Durante o Dia</h2>
      </div>
      <div class="step-desc">
        A qualquer momento do dia você pode acompanhar quanto já entrou:
        <ul>
          <li>Clique no botão <span class="pill-action" style="background:#2563eb;">F3 Relatório</span> no topo da tela.</li>
          <li>O sistema mostra os totais separados por:
            <ul>
              <li><strong>💵 Dinheiro na Gaveta:</strong> Notas e moedas físicas.</li>
              <li><strong>⚡ PIX:</strong> Total que caiu na conta do banco.</li>
              <li><strong>💳 Cartão de Crédito e Débito:</strong> Valores passados na maquininha.</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- PASSO 3 -->
    <div class="step-card" style="border-left-color: #2563eb;">
      <div class="step-header">
        <div class="step-circle" style="background: #2563eb;">3</div>
        <h2 class="step-title">Fechamento de Caixa no Fim do Turno</h2>
      </div>
      <div class="step-desc">
        Na hora de encerrar o expediente:
        <ul>
          <li><strong>1. Imprima a filipeta de fechamento</strong> na maquininha de cartão (relatório de fechamento diário).</li>
          <li><strong>2. Conte o dinheiro físico da gaveta</strong> (notas e moedas).</li>
          <li><strong>3. Preencha na tabela:</strong> Digite no campo <em>"Valor Conferido"</em> exatamente quanto você contou de Dinheiro, quanto deu de Cartão Débito e Cartão Crédito.</li>
          <li><strong>4. Diferença Verde:</strong> O sistema compara com o apurado. Se der <span style="color:#16a34a;font-weight:bold;">R$ 0,00 (Exato)</span>, está tudo perfeito!</li>
          <li><strong>5. Anexe a foto da filipeta da maquininha:</strong> Clique em anexar comprovante para guardar a prova fotográfica.</li>
          <li><strong>6. Enviar para o WhatsApp da Loja:</strong> Clique em <span class="pill-action" style="background:#16a34a;">Enviar PDF no WhatsApp</span>. O resumo vai direto para o dono da loja!</li>
        </ul>
      </div>
      ${img2 ? `<div class="screen-box"><img src="${img2}"><div class="screen-legend">📸 Tela 2: Tabela de Fechamento de Caixa com conferência de valores e anexo de comprovante</div></div>` : ''}
    </div>

    <div class="footer">
      Conflora Horta &amp; Viveiro · Guia do Caixa · Sistema Conflora AI
    </div>
  </div>
</body>
</html>`;
}

// ==========================================
// 3. GUIA DO ENTREGADOR
// ==========================================
function getDriverHtml() {
  const img1 = getBase64Img('driver-1-deliveries-list.png');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Guia do Entregador · Conflora</title>
  <style>${baseCss}</style>
</head>
<body>
  <div class="container">
    <div class="header-card" style="background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%);">
      <div>
        <h1 class="header-title">🌿 Conflora Horta &amp; Viveiro</h1>
        <p class="header-sub" style="color: #ccfbf1;">Guia Passo a Passo Oficial · 🛵 ENTREGADOR</p>
      </div>
      <div class="header-badge" style="background:#ccfbf1; color:#115e59; border-color:#14b8a6;">Entregas Ágeis</div>
    </div>

    <div class="box-tip">
      👶 <strong>Sua Missão como Entregador:</strong> Pegar o pedido no sistema, separar os produtos certos na estufa/horta com carinho, ligar a rota no GPS e levar até a casa do cliente!
    </div>

    <!-- PASSO 1 -->
    <div class="step-card" style="border-left-color: #0d9488;">
      <div class="step-header">
        <div class="step-circle" style="background: #0d9488;">1</div>
        <h2 class="step-title">Ver Pedidos e Assumir a Entrega</h2>
      </div>
      <div class="step-desc">
        No seu celular, abra a aba <strong>🛵 Minhas Entregas</strong>:
        <ul>
          <li>Na coluna amarela <strong>AGUARDANDO ENTREGADOR</strong>, aparecem as novas entregas.</li>
          <li>Toque no pedido do cliente para ver o endereço e o que ele comprou.</li>
          <li>Toque no botão grande amarelo: <span class="pill-yellow">🛵 Assumir e separar este pedido</span>.</li>
          <li>Pronto! O pedido agora é seu e ninguém mais pode pegar.</li>
        </ul>
      </div>
      ${img1 ? `<div class="screen-box"><img src="${img1}"><div class="screen-legend">📸 Tela 1: Painel de Entregas no celular com colunas de status e atualização automática</div></div>` : ''}
    </div>

    <!-- PASSO 2 -->
    <div class="step-card" style="border-left-color: #0d9488;">
      <div class="step-header">
        <div class="step-circle" style="background: #0d9488;">2</div>
        <h2 class="step-title">Separar os Produtos (Checklist Verde)</h2>
      </div>
      <div class="step-desc">
        Ao assumir o pedido, abre o checklist de separação na tela:
        <ul>
          <li>Você vai na horta ou prateleira e pega cada produto.</li>
          <li>Conforme pega o item, toque nele na tela: ele fica com um <strong>ÍCONE DE CHECK VERDE (✅)</strong>.</li>
          <li>Quando você marcar todos os itens, o sistema avisa na hora: <em>"Todos os itens foram separados!"</em></li>
          <li>Toque no botão verde <span class="pill-action" style="background:#16a34a;">🛵 Marcar como Saiu para Entrega</span>.</li>
          <li>Automaticamente o sistema já abre a rota no <strong>Google Maps</strong> com o caminho até a casa do cliente!</li>
        </ul>
      </div>
    </div>

    <div class="page-break"></div>

    <!-- PASSO 3 -->
    <div class="step-card" style="border-left-color: #0d9488;">
      <div class="step-header">
        <div class="step-circle" style="background: #0d9488;">3</div>
        <h2 class="step-title">Aviso de Chegada e Recebimento</h2>
      </div>
      <div class="step-desc">
        Durante o trajeto na cidade:
        <ul>
          <li><strong>Aviso Automático de Chegada:</strong> Quando você estiver a cerca de 500 metros da casa do cliente, o sistema dispara um WhatsApp avisando: <em>"O entregador da Conflora está chegando no seu endereço!"</em></li>
          <li><strong>Ao chegar na casa do cliente:</strong> Na tela do seu celular tem um <strong>Botão Flutuante (Floating Button)</strong> fácil de apertar com o polegar.</li>
          <li>Toque nele para ir direto para a <strong>Forma de Pagamento</strong>:
            <ul>
              <li>Se já estava pago no Pix ou Cartão: Apenas toque em <strong>Finalizar Entrega</strong>.</li>
              <li>Se for pagar na entrega: Receba o dinheiro ou passe a maquininha móvel.</li>
            </ul>
          </li>
        </ul>
      </div>
    </div>

    <div class="footer">
      Conflora Horta &amp; Viveiro · Guia do Entregador · Sistema Conflora AI
    </div>
  </div>
</body>
</html>`;
}

// ==========================================
// 4. GUIA DO ADMINISTRADOR
// ==========================================
function getAdminHtml() {
  const img1 = getBase64Img('admin-1-executive-today.png');
  const img2 = getBase64Img('admin-2-cashier-audit.png');
  const img3 = getBase64Img('admin-3-catalog.png');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Guia do Administrador · Conflora</title>
  <style>${baseCss}</style>
</head>
<body>
  <div class="container">
    <div class="header-card" style="background: linear-gradient(135deg, #78350f 0%, #b45309 100%);">
      <div>
        <h1 class="header-title">🌿 Conflora Horta &amp; Viveiro</h1>
        <p class="header-sub" style="color: #fef3c7;">Guia Passo a Passo Oficial · 👑 DONO &amp; ADMINISTRADOR</p>
      </div>
      <div class="header-badge" style="background:#fef3c7; color:#78350f; border-color:#d97706;">Controle Total</div>
    </div>

    <div class="box-tip">
      👶 <strong>Sua Visão como Gestor:</strong> Acompanhar o dinheiro que entra hoje, conferir o fechamento de cada colaborador, gerenciar os produtos e ter segurança total de dados sem complicações!
    </div>

    <!-- PASSO 1 -->
    <div class="step-card" style="border-left-color: #b45309;">
      <div class="step-header">
        <div class="step-circle" style="background: #b45309;">1</div>
        <h2 class="step-title">Resultados da Loja (Filtro Padrão HOJE)</h2>
      </div>
      <div class="step-desc">
        Acesse o <strong>Painel Gerencial</strong> (` + '`/admin-gerencial`' + `):
        <ul>
          <li>O painel abre sempre pré-filtrado em <strong>HOJE</strong> (o que mais importa no dia a dia).</li>
          <li>Mostra o total faturado, quantidade de comandas, ticket médio e gráfico de vendas por hora.</li>
          <li>Permite comparar com o dia anterior ou trocar o período para Este Mês com apenas 1 clique.</li>
        </ul>
      </div>
      ${img1 ? `<div class="screen-box"><img src="${img1}"><div class="screen-legend">📸 Tela 1: Painel Gerencial com métricas ao vivo e filtro padrão 'HOJE'</div></div>` : ''}
    </div>

    <!-- PASSO 2 -->
    <div class="step-card" style="border-left-color: #b45309;">
      <div class="step-header">
        <div class="step-circle" style="background: #b45309;">2</div>
        <h2 class="step-title">Conferência e Auditoria de Caixas</h2>
      </div>
      <div class="step-desc">
        Na aba <strong>Conferência de Caixas</strong> (` + '`/admin?tab=cashier`' + `):
        <ul>
          <li>Você audita todas as vendas feitas por cada vendedor e operador de caixa.</li>
          <li>Pode conferir o valor que o caixa declarou contra o que o sistema calculou.</li>
          <li>Pode visualizar e baixar a foto anexada da filipeta da maquininha de cartão.</li>
          <li>Pode exportar o relatório oficial em PDF ou enviar direto no WhatsApp com 1 clique.</li>
        </ul>
      </div>
      ${img2 ? `<div class="screen-box"><img src="${img2}"><div class="screen-legend">📸 Tela 2: Auditoria de Fechamentos de Caixa com cards por forma de pagamento</div></div>` : ''}
    </div>

    <div class="page-break"></div>

    <!-- PASSO 3 -->
    <div class="step-card" style="border-left-color: #b45309;">
      <div class="step-header">
        <div class="step-circle" style="background: #b45309;">3</div>
        <h2 class="step-title">Gestão do Catálogo de Produtos (A a Z)</h2>
      </div>
      <div class="step-desc">
        Na aba <strong>Produtos</strong> (` + '`/admin?tab=products`' + `):
        <ul>
          <li>Todos os produtos ficam organizados em <strong>Ordem de A a Z por padrão</strong>.</li>
          <li>Você pode filtrar por categoria (<em>Plantas, Horta, Frutíferas, Pets, etc.</em>).</li>
          <li>Pode clicar no botão verde <span class="pill-action" style="background:#16a34a;">+ ADICIONAR PRODUTO</span> para cadastrar novos itens com fotos nítidas.</li>
          <li>Pode importar planilhas do Excel inteiras mantendo o padrão da loja com enriquecimento automático de imagens e dicas de cultivo!</li>
        </ul>
      </div>
      ${img3 ? `<div class="screen-box"><img src="${img3}"><div class="screen-legend">📸 Tela 3: Cadastro de Produtos com fotos reais, filtros de A a Z e importador de planilhas</div></div>` : ''}
    </div>

    <div class="footer">
      Conflora Horta &amp; Viveiro · Guia do Administrador · Sistema Conflora AI
    </div>
  </div>
</body>
</html>`;
}

// ==========================================
// 5. PORTAL PRINCIPAL DOS GUIAS (INDEX.HTML)
// ==========================================
function getIndexPortalHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Guias Operacionais Didáticos · Conflora AI</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      margin: 0;
      padding: 32px 16px;
    }
    .portal-wrap {
      max-width: 960px;
      margin: 0 auto;
    }
    .portal-header {
      text-align: center;
      margin-bottom: 40px;
    }
    .portal-title {
      font-size: 32px;
      font-weight: 900;
      color: #14532d;
      margin: 0 0 10px 0;
    }
    .portal-subtitle {
      font-size: 16px;
      color: #475569;
      max-width: 600px;
      margin: 0 auto;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }
    .role-card {
      background: #ffffff;
      border-radius: 20px;
      padding: 26px 22px;
      text-decoration: none;
      color: inherit;
      border: 2px solid #e2e8f0;
      box-shadow: 0 4px 14px rgba(0,0,0,0.05);
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
      display: flex;
      flex-direction: column;
    }
    .role-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0,0,0,0.1);
      border-color: #16a34a;
    }
    .role-icon {
      font-size: 42px;
      margin-bottom: 14px;
    }
    .role-name {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 8px 0;
    }
    .role-desc {
      font-size: 13.5px;
      color: #64748b;
      line-height: 1.5;
      margin-bottom: 20px;
      flex-grow: 1;
    }
    .role-links {
      display: flex;
      gap: 8px;
    }
    .role-btn {
      flex: 1;
      text-align: center;
      padding: 10px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 13px;
      text-decoration: none;
    }
    .btn-web {
      background: #16a34a;
      color: #ffffff;
    }
    .btn-pdf {
      background: #f1f5f9;
      color: #334155;
      border: 1px solid #cbd5e1;
    }
  </style>
</head>
<body>
  <div class="portal-wrap">
    <div class="portal-header">
      <div style="font-size: 48px; margin-bottom: 8px;">🌿</div>
      <h1 class="portal-title">Guias Operacionais da Conflora</h1>
      <p class="portal-subtitle">Instruções didáticas passo a passo com capturas reais de telas para treinamento e operação da equipe.</p>
    </div>

    <div class="cards-grid">
      <!-- VENDEDOR -->
      <div class="role-card">
        <div class="role-icon">🛍️</div>
        <h2 class="role-name" style="color: #15803d;">Vendedor &amp; Balcão</h2>
        <p class="role-desc">Como abrir o catálogo de A a Z, buscar itens, colocar no carrinho, alternar balcão/entrega e finalizar ou mandar pro caixa.</p>
        <div class="role-links">
          <a class="role-btn btn-web" href="/guias/vendedor.html">Abrir Guia Web</a>
          <a class="role-btn btn-pdf" href="/guias/guia-vendedor.pdf" target="_blank">Baixar PDF</a>
        </div>
      </div>

      <!-- CAIXA -->
      <div class="role-card">
        <div class="role-icon">💵</div>
        <h2 class="role-name" style="color: #1d4ed8;">Operador de Caixa</h2>
        <p class="role-desc">Como receber comandas dos vendedores, conferir pagamentos em Dinheiro, PIX e Cartão, e realizar o fechamento diário com comprovante.</p>
        <div class="role-links">
          <a class="role-btn btn-web" href="/guias/caixa.html" style="background:#2563eb;">Abrir Guia Web</a>
          <a class="role-btn btn-pdf" href="/guias/guia-caixa.pdf" target="_blank">Baixar PDF</a>
        </div>
      </div>

      <!-- ENTREGADOR -->
      <div class="role-card">
        <div class="role-icon">🛵</div>
        <h2 class="role-name" style="color: #0f766e;">Entregador &amp; Despacho</h2>
        <p class="role-desc">Como assumir pedidos no celular, marcar os checks verdes na separação, iniciar rota no Maps e usar o floating button de entrega.</p>
        <div class="role-links">
          <a class="role-btn btn-web" href="/guias/entregador.html" style="background:#0d9488;">Abrir Guia Web</a>
          <a class="role-btn btn-pdf" href="/guias/guia-entregador.pdf" target="_blank">Baixar PDF</a>
        </div>
      </div>

      <!-- ADMIN -->
      <div class="role-card">
        <div class="role-icon">👑</div>
        <h2 class="role-name" style="color: #b45309;">Dono &amp; Administrador</h2>
        <p class="role-desc">Como visualizar os Resultados da Loja com filtro padrão Hoje, auditar fechamentos de caixa de todos os colaboradores e gerenciar o estoque.</p>
        <div class="role-links">
          <a class="role-btn btn-web" href="/guias/admin.html" style="background:#b45309;">Abrir Guia Web</a>
          <a class="role-btn btn-pdf" href="/guias/guia-admin.pdf" target="_blank">Baixar PDF</a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Execução
async function buildAll() {
  console.log('Gravando páginas HTML dos guias...');
  fs.writeFileSync(path.join(GUIAS_DIR, 'vendedor.html'), getSellerHtml(), 'utf8');
  fs.writeFileSync(path.join(GUIAS_DIR, 'caixa.html'), getCashierHtml(), 'utf8');
  fs.writeFileSync(path.join(GUIAS_DIR, 'entregador.html'), getDriverHtml(), 'utf8');
  fs.writeFileSync(path.join(GUIAS_DIR, 'admin.html'), getAdminHtml(), 'utf8');
  fs.writeFileSync(path.join(GUIAS_DIR, 'index.html'), getIndexPortalHtml(), 'utf8');
  console.log('HTMLs gravados com sucesso!');

  console.log('Compilando PDFs com Playwright...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();

  const files = [
    { html: getSellerHtml(), pdf: 'guia-vendedor.pdf' },
    { html: getCashierHtml(), pdf: 'guia-caixa.pdf' },
    { html: getDriverHtml(), pdf: 'guia-entregador.pdf' },
    { html: getAdminHtml(), pdf: 'guia-admin.pdf' }
  ];

  for (const item of files) {
    console.log(`Gerando ${item.pdf}...`);
    await page.setContent(item.html, { waitUntil: 'load' });
    const targetPdf = path.join(GUIAS_DIR, item.pdf);
    await page.pdf({
      path: targetPdf,
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '12mm', right: '12mm' }
    });
    console.log(`Salvo: ${targetPdf} (${(fs.statSync(targetPdf).size / 1024).toFixed(1)} KB)`);

    // Copia também para o brain directory para garantir artefatos atualizados
    try {
      const brainPdf = path.join(BRAIN_DIR, item.pdf);
      fs.copyFileSync(targetPdf, brainPdf);
      console.log(`Copiado para brain: ${brainPdf}`);
    } catch (e) {
      console.log('Aviso brain copy:', e.message);
    }
  }

  await browser.close();
  console.log('TUDO PRONTO!');
}

buildAll().catch(console.error);
