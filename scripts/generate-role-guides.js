// Script completo de captura de telas reais com Playwright e geração dos 4 PDFs operacionais didáticos
const path = require('node:path');
const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

// Tenta requerer @playwright/test de múltiplos caminhos
let chromium;
try {
  ({ chromium } = require('@playwright/test'));
} catch {
  ({ chromium } = require('C:/Users/Junin/confloraai/node_modules/@playwright/test'));
}

process.env.NODE_ENV = 'test';
process.env.OWNER_WHATSAPP_NUMBER = '5564999994321';
process.env.STORE_LAT = '-17.5694';
process.env.STORE_LNG = '-52.5511';
process.env.PIX_MODE = 'MANUAL';
process.env.PIX_KEY = '52998224725';
process.env.PIX_TITULAR = 'Conflora Horta e Viveiro';

const { FirestoreRepository } = require('../src/database/firestore.repository');
const { PdvRepository } = require('../src/orders/pdv.repository');
const { PdvService } = require('../src/orders/pdv.service');
const { createApp } = require('../src/http/app');
const { StoreRepository } = require('../src/storefront/repository');

// Diretórios de saída
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENS_DIR = path.resolve(ROOT_DIR, 'tmp/guide-screens');
const GUIAS_DIR = path.resolve(ROOT_DIR, 'public/guias');

if (!fs.existsSync(SCREENS_DIR)) fs.mkdirSync(SCREENS_DIR, { recursive: true });
if (!fs.existsSync(GUIAS_DIR)) fs.mkdirSync(GUIAS_DIR, { recursive: true });

// Usuários do sistema
const users = {
  seller: { id: 'seller-maria', name: 'Maria Santos', role: 'VENDEDOR', pin: '1111', email: 'maria@conflora.test', active: true },
  cashier: { id: 'cashier-joao', name: 'João Silva', role: 'CAIXA', pin: '2222', email: 'joao@conflora.test', active: true },
  driver: { id: 'driver-carlos', name: 'Carlos Oliveira', role: 'ENTREGADOR', pin: '3333', email: 'carlos@conflora.test', active: true },
  admin: { id: 'admin-junior', name: 'Júnior (Gerente/Admin)', role: 'ADMIN', pin: '9999', email: 'junior@conflora.test', active: true }
};

// Produtos realistas de horta e viveiro com fotos/cores
const sampleProducts = [
  { id: 'prod-alface', name: 'Alface Crespa Orgânica', category: 'Hortifruti', price: 4.50, stockQuantity: 120, status: 'ATIVO', unit: 'UN', imageUrl: '/pdv-assets/dist/alface.png', description: 'Folhas frescas e crocantes colhidas diariamente na horta.' },
  { id: 'prod-tomate', name: 'Tomate Cereja Doce', category: 'Hortifruti', price: 9.90, stockQuantity: 65, status: 'ATIVO', unit: 'KG', imageUrl: '/pdv-assets/dist/tomate.png', description: 'Cultivo natural, super saboroso para saladas.' },
  { id: 'prod-begonia', name: 'Begônia Vermelha no Vaso', category: 'Mudas e Flores', price: 24.00, stockQuantity: 40, status: 'ATIVO', unit: 'UN', imageUrl: '/pdv-assets/dist/begonia.png', description: 'Excelente para varandas e meia sombra com florada constante.' },
  { id: 'prod-samambaia', name: 'Samambaia Americana Cuia 21', category: 'Plantas e Folhagens', price: 42.00, stockQuantity: 25, status: 'ATIVO', unit: 'UN', imageUrl: '/pdv-assets/dist/samambaia.png', description: 'Folhagem volumosa e pendente, ideal para áreas internas iluminadas.' },
  { id: 'prod-adubo', name: 'Adubo NPK 10-10-10 1kg', category: 'Adubos e Substratos', price: 16.50, stockQuantity: 80, status: 'ATIVO', unit: 'UN', imageUrl: '/pdv-assets/dist/adubo.png', description: 'Nutrição completa para folhagens e flores.' },
  { id: 'prod-terra', name: 'Terra Vegetal Adubada 5kg', category: 'Adubos e Substratos', price: 18.00, stockQuantity: 110, status: 'ATIVO', unit: 'UN', imageUrl: '/pdv-assets/dist/terra.png', description: 'Rica em matéria orgânica para plantio e vasos.' },
  { id: 'prod-vaso', name: 'Vaso Cerâmica Artesanal P', category: 'Vasos e Decoração', price: 35.00, stockQuantity: 30, status: 'ATIVO', unit: 'UN', imageUrl: '/pdv-assets/dist/vaso.png', description: 'Acabamento terracota com furo de drenagem.' },
  { id: 'prod-morango', name: 'Muda de Morango Doce', category: 'Mudas e Flores', price: 7.50, stockQuantity: 50, status: 'ATIVO', unit: 'UN', imageUrl: '/pdv-assets/dist/morango.png', description: 'Produz rápido em vasos ou canteiros.' }
];

async function seedData(base, pdvService, pdvRepo) {
  // Cadastrar usuários
  for (const u of Object.values(users)) {
    base.inMemoryUsers.set(u.id, u);
  }

  // Cadastrar produtos
  for (const p of sampleProducts) {
    base.inMemoryProducts.set(p.id, p);
  }

  // Cadastrar clientes
  const c1 = { id: 'cust-ana', name: 'Ana Paula Ferreira', phone: '64999887766', address: 'Rua das Orquídeas, 142, Setor Sul, Mineiros - GO', debtBalance: 0 };
  const c2 = { id: 'cust-roberto', name: 'Roberto Alcantara', phone: '64998765432', address: 'Av. Goiás, 520, Centro, Mineiros - GO', debtBalance: 0 };
  base.inMemoryCustomers.set(c1.id, c1);
  base.inMemoryCustomers.set(c2.id, c2);

  // 1. Pedido Balcão Finalizado com histórico completo
  const order1 = await pdvService.create({
    requestId: randomUUID(),
    items: [
      { productId: 'prod-alface', quantity: 2 },
      { productId: 'prod-tomate', quantity: 1 }
    ],
    orderType: 'PICKUP',
    paymentMethod: 'DINHEIRO',
    cashReceived: 50.00,
    customerId: c1.id,
    customerName: c1.name,
    customerPhone: c1.phone,
    notes: 'Cliente levou na sacola ecológica'
  }, users.seller);

  // Receber no caixa
  await pdvRepo.receive(order1.id, { id: users.cashier.id, name: users.cashier.name, role: users.cashier.role });

  // 2. Pedido Entrega Pronto para Separação
  const orderDeliverySep = await pdvService.create({
    requestId: randomUUID(),
    items: [
      { productId: 'prod-alface', quantity: 3 },
      { productId: 'prod-begonia', quantity: 1 },
      { productId: 'prod-terra', quantity: 1 }
    ],
    orderType: 'DELIVERY',
    freightValue: 8.00,
    paymentMethod: 'PIX',
    customerId: c2.id,
    customerName: c2.name,
    customerPhone: c2.phone,
    customerAddress: c2.address,
    deliveryAddress: c2.address,
    notes: 'Entregar no portão preto'
  }, users.seller);

  // 3. Pedido Entrega Em Rota com Entregador Carlos
  const orderInRoute = await pdvService.create({
    requestId: randomUUID(),
    items: [
      { productId: 'prod-samambaia', quantity: 1 },
      { productId: 'prod-adubo', quantity: 1 }
    ],
    orderType: 'DELIVERY',
    freightValue: 10.00,
    paymentMethod: 'DEBITO',
    customerId: c1.id,
    customerName: c1.name,
    customerPhone: c1.phone,
    customerAddress: c1.address,
    deliveryAddress: c1.address
  }, users.seller);

  // Carlos aceita e inicia entrega
  await pdvService.assignDelivery(orderInRoute.id, users.driver);
  await pdvService.startDelivery(orderInRoute.id, users.driver, {
    route: { distanceMeters: 2800, durationSeconds: 420 }
  });

  // 4. Pedido com Pagamento no Cartão de Crédito
  const orderCredito = await pdvService.create({
    requestId: randomUUID(),
    items: [{ productId: 'prod-vaso', quantity: 1 }],
    orderType: 'PICKUP',
    paymentMethod: 'CREDITO',
    customerName: 'Cliente Balcão'
  }, users.seller);
  await pdvRepo.receive(orderCredito.id, { id: users.cashier.id, name: users.cashier.name, role: users.cashier.role });

  // Adicionar comprovante de maquininha em anexo de exemplo
  const dummyProof = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  base.inMemoryProofs = base.inMemoryProofs || new Map();
  base.inMemoryProofs.set('proof-1', {
    id: 'proof-1',
    targetType: 'CLOSING',
    targetId: 'today-closing',
    fileName: 'fechamento-maquininha-rede.jpg',
    dataUrl: dummyProof,
    uploadedAt: new Date().toISOString()
  });

  return { order1, orderDeliverySep, orderInRoute };
}

async function captureScreenshots(baseUrl) {
  console.log('Iniciando captura de telas com Playwright (canal Edge)...');
  const browser = await chromium.launch({ channel: 'msedge' });

  // Helper para autenticar no contexto
  async function makeContext(user, viewport = { width: 1280, height: 800 }, isMobile = false) {
    const context = await browser.newContext({
      viewport,
      isMobile,
      userAgent: isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        : undefined
    });
    const page = await context.newPage();
    // Efetuar login via API
    await page.request.post(`${baseUrl}/api/admin/auth/login`, {
      data: { userId: user.id, pin: user.pin }
    });
    return { context, page };
  }

  // --- 1. CAPTURAS DO VENDEDOR ---
  console.log('Capturando telas do Vendedor...');
  {
    const { context, page } = await makeContext(users.seller, { width: 1280, height: 800 });
    await page.goto(`${baseUrl}/caixa`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // Vendedor 1: Catálogo com busca e ordenação A a Z
    await page.screenshot({ path: path.join(SCREENS_DIR, 'seller-1-catalog.png'), fullPage: false });

    // Clicar para adicionar produtos ao carrinho
    const cards = page.locator('button, div').filter({ hasText: 'Alface Crespa' }).first();
    if (await cards.count()) await cards.click();
    await page.waitForTimeout(500);

    const cardsTomate = page.locator('button, div').filter({ hasText: 'Tomate Cereja' }).first();
    if (await cardsTomate.count()) await cardsTomate.click();
    await page.waitForTimeout(500);

    // Vendedor 2: Carrinho com itens
    await page.screenshot({ path: path.join(SCREENS_DIR, 'seller-2-cart.png'), fullPage: false });

    // Vendedor 3: Botão de cliente ou alternar Balcão/Entrega
    try {
      const deliveryToggle = page.locator('button').filter({ hasText: /Entrega|Balcão/i }).first();
      if (await deliveryToggle.count()) {
        await deliveryToggle.click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(SCREENS_DIR, 'seller-3-delivery-mode.png'), fullPage: false });
        // Fechar modal de cliente se abriu
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
    } catch (e) {
      console.log('Aviso ao capturar delivery toggle:', e.message);
    }

    // Vendedor 4: Abrir Modal F1 de Pagamento
    try {
      const btnPay = page.locator('button').filter({ hasText: /Receber|Mandar pro Caixa|F1/i }).first();
      if (await btnPay.count()) {
        await btnPay.click({ force: true });
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(SCREENS_DIR, 'seller-4-payment-modal.png'), fullPage: false });
      }
    } catch (e) {
      console.log('Aviso ao capturar modal F1:', e.message);
    }

    await context.close();
  }

  // --- 2. CAPTURAS DO ENTREGADOR (Mobile Viewport) ---
  console.log('Capturando telas do Entregador (Mobile)...');
  {
    const { context, page } = await makeContext(users.driver, { width: 412, height: 850 }, true);
    await page.goto(`${baseUrl}/caixa?view=deliveries`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // Entregador 1: Painel de Entregas no celular
    await page.screenshot({ path: path.join(SCREENS_DIR, 'driver-1-deliveries-list.png'), fullPage: false });

    // Abrir separação ou conferência de um pedido
    try {
      const orderCard = page.locator('button, div').filter({ hasText: /Roberto Alcantara|Aguardando Entregador|Separar/i }).first();
      if (await orderCard.count()) {
        await orderCard.click();
        await page.waitForTimeout(600);
      }
      const btnSep = page.locator('button').filter({ hasText: /Conferir|Separar/i }).first();
      if (await btnSep.count()) {
        await btnSep.click();
        await page.waitForTimeout(600);
      }
      await page.screenshot({ path: path.join(SCREENS_DIR, 'driver-2-separation.png'), fullPage: false });
    } catch (e) {
      console.log('Aviso ao capturar separação:', e.message);
    }

    // Em rota / Floating Button
    try {
      const cardInRoute = page.locator('text=Em rota').first();
      if (await cardInRoute.count()) {
        await cardInRoute.click();
        await page.waitForTimeout(600);
      }
      await page.screenshot({ path: path.join(SCREENS_DIR, 'driver-3-route-floating.png'), fullPage: false });
    } catch (e) {
      console.log('Aviso ao capturar rota:', e.message);
    }

    await context.close();
  }

  // --- 3. CAPTURAS DO CAIXA (Desktop Viewport) ---
  console.log('Capturando telas do Caixa...');
  {
    const { context, page } = await makeContext(users.cashier, { width: 1280, height: 800 });
    await page.goto(`${baseUrl}/caixa`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    // Caixa 1: Tela de vendas de Hoje
    await page.screenshot({ path: path.join(SCREENS_DIR, 'cashier-1-today-sales.png'), fullPage: false });

    // Caixa 2: Abrir tela/modal de fechamento de caixa
    const btnFechamento = page.locator('button, a').filter({ hasText: /Fechamento de Caixa|Fechar Caixa|Conferência/i }).first();
    if (await btnFechamento.count()) {
      await btnFechamento.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: path.join(SCREENS_DIR, 'cashier-2-closing-table.png'), fullPage: false });

    await context.close();
  }

  // --- 4. CAPTURAS DO ADMINISTRADOR (Desktop Viewport) ---
  console.log('Capturando telas do Administrador...');
  {
    const { context, page } = await makeContext(users.admin, { width: 1366, height: 820 });
    
    // Admin 1: Painel Gerencial / Resultados da Loja (HOJE)
    await page.goto(`${baseUrl}/admin-gerencial`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'admin-1-executive-today.png'), fullPage: false });

    // Admin 2: Painel Geral do Admin / Auditoria de Caixas
    await page.goto(`${baseUrl}/admin?tab=cashier`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'admin-2-cashier-audit.png'), fullPage: false });

    // Admin 3: Catálogo de Produtos ordenado de A a Z
    await page.goto(`${baseUrl}/admin?tab=products`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(SCREENS_DIR, 'admin-3-catalog.png'), fullPage: false });

    await context.close();
  }

  await browser.close();
  console.log('Captura de telas finalizada com sucesso!');
}

// Converte imagem em Data URL base64 para embutir diretamente no HTML/PDF
function imgToBase64(fileName) {
  const filePath = path.join(SCREENS_DIR, fileName);
  if (!fs.existsSync(filePath)) return '';
  const data = fs.readFileSync(filePath).toString('base64');
  return `data:image/png;base64,${data}`;
}

// Estilo CSS compartilhado para os PDFs com visual moderno e tipografia vetorial limpa
const sharedPdfCss = `
  @page {
    size: A4;
    margin: 12mm 14mm 14mm 14mm;
    @bottom-right {
      content: "Página " counter(page) " de " counter(pages);
      font-size: 8pt;
      color: #64748b;
    }
  }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1e293b;
    background: #ffffff;
    line-height: 1.5;
    font-size: 10pt;
    margin: 0;
    padding: 0;
  }
  .header-card {
    background: linear-gradient(135deg, #124d2d 0%, #1b683e 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-brand {
    font-size: 18pt;
    font-weight: 800;
    letter-spacing: -0.5px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .header-badge {
    background: #eab308;
    color: #124d2d;
    font-weight: 800;
    font-size: 9pt;
    padding: 4px 10px;
    border-radius: 999px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .header-role {
    font-size: 14pt;
    font-weight: 700;
    margin-top: 4px;
    color: #d1fae5;
  }
  .step-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-left: 4px solid #16a34a;
    border-radius: 10px;
    padding: 14px 18px;
    margin-bottom: 18px;
    page-break-inside: avoid;
  }
  .step-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .step-num {
    background: #16a34a;
    color: white;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10pt;
    font-weight: 800;
    flex-shrink: 0;
  }
  .step-title {
    font-size: 12pt;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }
  .step-desc {
    color: #334155;
    font-size: 9.5pt;
    margin-bottom: 10px;
    line-height: 1.45;
  }
  .screen-wrap {
    margin-top: 10px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.06);
    background: #ffffff;
    text-align: center;
  }
  .screen-wrap img {
    max-width: 100%;
    max-height: 260px;
    display: block;
    margin: 0 auto;
    object-fit: contain;
  }
  .screen-caption {
    background: #f1f5f9;
    padding: 6px 12px;
    font-size: 8pt;
    color: #475569;
    font-weight: 600;
    border-top: 1px solid #e2e8f0;
    text-align: left;
  }
  .tip-box {
    background: #fefce8;
    border: 1px solid #fef08a;
    border-left: 4px solid #eab308;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 9pt;
    color: #713f12;
    margin-top: 12px;
    page-break-inside: avoid;
  }
  .alert-box {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-left: 4px solid #ef4444;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 9pt;
    color: #991b1b;
    margin-top: 12px;
    page-break-inside: avoid;
  }
  .faq-box {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-left: 4px solid #22c55e;
    border-radius: 8px;
    padding: 12px 16px;
    font-size: 9pt;
    color: #14532d;
    margin-top: 16px;
    page-break-inside: avoid;
  }
  .btn-highlight {
    background: #16a34a;
    color: white;
    padding: 2px 7px;
    border-radius: 4px;
    font-weight: 700;
    font-size: 8.5pt;
    display: inline-block;
  }
  .btn-yellow {
    background: #eab308;
    color: #000;
    padding: 2px 7px;
    border-radius: 4px;
    font-weight: 700;
    font-size: 8.5pt;
    display: inline-block;
  }
  .page-break {
    page-break-after: always;
  }
  .footer-note {
    text-align: center;
    color: #64748b;
    font-size: 8pt;
    margin-top: 25px;
    border-top: 1px solid #e2e8f0;
    padding-top: 10px;
  }
`;

// 1. GERADOR DO GUIA DO VENDEDOR
function renderSellerHtml() {
  const imgCat = imgToBase64('seller-1-catalog.png');
  const imgCart = imgToBase64('seller-2-cart.png');
  const imgPay = imgToBase64('seller-4-payment-modal.png');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Guia Rápido · Vendedor e Atendente</title>
  <style>${sharedPdfCss}</style>
</head>
<body>
  <div class="header-card">
    <div>
      <div class="header-brand">🌿 Conflora Horta &amp; Viveiro</div>
      <div class="header-role">Guia Prático do Vendedor e Balcão</div>
    </div>
    <div class="header-badge">Passo a Passo Oficial</div>
  </div>

  <div class="step-box">
    <div class="step-header">
      <div class="step-num">1</div>
      <h2 class="step-title">Abrir a Loja e Escolher o Produto</h2>
    </div>
    <div class="step-desc">
      A tela já mostra todos os produtos organizados em <strong>ordem de A a Z</strong>. Você não precisa se perder procurando:
      <ul>
        <li><strong>Busca Rápida:</strong> Clique no campo da 🔍 <em>Lupinha</em> no topo e digite as primeiras letras (ex: "alfa" para Alface ou "beg" para Begônia).</li>
        <li><strong>Filtro de Categoria:</strong> Se preferir, clique nas abas (<em>Hortifruti</em>, <em>Mudas e Flores</em>, <em>Adubos</em>).</li>
        <li><strong>Adicionar ao Pedido:</strong> Basta clicar uma vez no cartão do produto. Ele já vai direto para a comanda!</li>
      </ul>
    </div>
    ${imgCat ? `<div class="screen-wrap"><img src="${imgCat}"><div class="screen-caption">Tela Inicial do PDV: Catálogo de A a Z e busca instantânea no topo</div></div>` : ''}
  </div>

  <div class="step-box">
    <div class="step-header">
      <div class="step-num">2</div>
      <h2 class="step-title">Conferir o Carrinho e Quantidades</h2>
    </div>
    <div class="step-desc">
      Na coluna do carrinho (ou ao abrir a sacola no celular):
      <ul>
        <li>Clique no botão <span class="btn-highlight">+</span> para aumentar a quantidade ou no <span class="btn-yellow">-</span> para diminuir.</li>
        <li>O total a pagar calcula <strong>automaticamente</strong> na hora. Nada de fazer conta de cabeça!</li>
        <li><strong>Cliente Balcão vs Entrega:</strong> O padrão é "Balcão". Se for para levar na casa do cliente, marque a opção 🛵 <strong>Entrega</strong> e informe o endereço.</li>
      </ul>
    </div>
    ${imgCart ? `<div class="screen-wrap"><img src="${imgCart}"><div class="screen-caption">Carrinho do Pedido: Itens selecionados, alteração de quantidade e cálculo automático</div></div>` : ''}
  </div>

  <div class="page-break"></div>

  <div class="step-box">
    <div class="step-header">
      <div class="step-num">3</div>
      <h2 class="step-title">Finalizar a Venda ou Mandar pro Caixa</h2>
    </div>
    <div class="step-desc">
      Para concluir o pedido, clique no botão verde <span class="btn-highlight">Receber / Mandar pro Caixa (F1)</span>:
      <ul>
        <li><strong>Se o cliente for pagar no Caixa Central:</strong> Clique na opção <em>"Enviar Comanda para o Caixa"</em>. Pronto! A comanda já pula na tela do caixa instantaneamente.</li>
        <li><strong>Se você mesmo for receber no Balcão:</strong>
          <ul>
            <li><strong>Dinheiro:</strong> Digite o valor que o cliente te entregou. O sistema diz o troco exato na tela.</li>
            <li><strong>PIX:</strong> Mostre o QR Code na tela para o cliente escanear.</li>
            <li><strong>Cartão Débito ou Crédito:</strong> Passe na maquininha e confirme.</li>
          </ul>
        </li>
      </ul>
    </div>
    ${imgPay ? `<div class="screen-wrap"><img src="${imgPay}"><div class="screen-caption">Modal de Pagamento (F1): Escolha entre mandar para o caixa ou receber direto</div></div>` : ''}
  </div>

  <div class="tip-box">
    💡 <strong>Dica de Ouro para o Vendedor:</strong> Não precisa ter medo de errar! Se você adicionou um item errado, basta clicar no <span style="color:#ef4444;font-weight:bold;">X</span> vermelho ao lado do produto para retirar do carrinho.
  </div>

  <div class="alert-box">
    ⚠️ <strong>Atenção:</strong> Sempre confirme se o cliente vai levar na hora (Balcão) ou se é para viagem/entrega (Entrega), para que a taxa de entrega e o endereço entrem corretamente no pedido.
  </div>

  <div class="footer-note">
    Conflora Horta &amp; Viveiro · Guia Operacional Simplificado · Dúvidas procure a gerência
  </div>
</body>
</html>`;
}

// 2. GERADOR DO GUIA DO ENTREGADOR
function renderDriverHtml() {
  const imgList = imgToBase64('driver-1-deliveries-list.png');
  const imgSep = imgToBase64('driver-2-separation.png');
  const imgRoute = imgToBase64('driver-3-route-floating.png');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Guia Rápido · Entregador</title>
  <style>${sharedPdfCss}</style>
</head>
<body>
  <div class="header-card" style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);">
    <div>
      <div class="header-brand">🛵 Conflora Entregas</div>
      <div class="header-role">Guia Prático do Entregador e Separação</div>
    </div>
    <div class="header-badge" style="background:#a7f3d0;color:#064e3b;">100% no Celular</div>
  </div>

  <div class="step-box" style="border-left-color: #0d9488;">
    <div class="step-header">
      <div class="step-num" style="background: #0d9488;">1</div>
      <h2 class="step-title">Abrir as Entregas no Celular e Captar</h2>
    </div>
    <div class="step-desc">
      Sua tela no celular foi feita para ser <strong>super simples e rápida</strong>, sem botões complicados:
      <ul>
        <li>Entre no sistema com seu PIN. Você já cai direto na lista de entregas do dia.</li>
        <li>Veja os pedidos que estão prontos aguardando saída.</li>
        <li>Clique no botão <span class="btn-highlight" style="background:#0d9488;">Captar Entrega</span> no pedido que você vai levar.</li>
        <li>O sistema vai perguntar: <em>"Deseja conferir e separar os itens?"</em>. Clique em <strong>SIM</strong>!</li>
      </ul>
    </div>
    ${imgList ? `<div class="screen-wrap"><img src="${imgList}"><div class="screen-caption">Painel do Entregador: Pedidos aguardando e em rota</div></div>` : ''}
  </div>

  <div class="step-box" style="border-left-color: #16a34a;">
    <div class="step-header">
      <div class="step-num">2</div>
      <h2 class="step-title">Separação na Horta com CHECK VERDE ✅</h2>
    </div>
    <div class="step-desc">
      Para você nunca esquecer um pé de alface ou um saco de adubo para trás:
      <ul>
        <li>A tela mostra a lista certinha de tudo o que vai para esse cliente.</li>
        <li>Pegou o produto na horta ou prateleira e colocou na caixa? <strong>Dê um toque no item</strong>.</li>
        <li>Ele ganha um <strong>CHECK VERDE ✅</strong>!</li>
        <li><strong>Aviso Automático:</strong> Assim que você marcar todos os itens, a tela te avisa: <em>"Tudo conferido! Deseja marcar como SAIU PARA ENTREGA?"</em>. É só clicar em <strong>Confirmar Saída</strong>!</li>
      </ul>
    </div>
    ${imgSep ? `<div class="screen-wrap"><img src="${imgSep}"><div class="screen-caption">Tela de Separação: Dê um toque em cada item conferido até ficar tudo verdinho</div></div>` : ''}
  </div>

  <div class="page-break"></div>

  <div class="step-box" style="border-left-color: #0284c7;">
    <div class="step-header">
      <div class="step-num" style="background:#0284c7;">3</div>
      <h2 class="step-title">Rota no GPS e Aviso de 500m no WhatsApp</h2>
    </div>
    <div class="step-desc">
      Durante a corrida, tudo fica fácil na palma da sua mão:
      <ul>
        <li>Clique em <strong>"Abrir no Google Maps / Waze"</strong> para traçar a rota até a casa do cliente.</li>
        <li><strong>Aviso no WhatsApp do Cliente:</strong> Quando você estiver chegando (cerca de 500 metros), o sistema pode avisar no WhatsApp do cliente: <em>"🛵 O entregador está chegando no seu endereço!"</em>. O cliente já fica esperando no portão!</li>
        <li><strong>Botão Flutuante:</strong> Use o botão flutuante redondo verde que fica sempre ao alcance do seu polegar para avançar de etapa rapidamente.</li>
      </ul>
    </div>
    ${imgRoute ? `<div class="screen-wrap"><img src="${imgRoute}"><div class="screen-caption">Em Rota: Navegação GPS e Botão Flutuante de Fácil Acesso no Celular</div></div>` : ''}
  </div>

  <div class="step-box" style="border-left-color: #eab308;">
    <div class="step-header">
      <div class="step-num" style="background:#ca8a04;">4</div>
      <h2 class="step-title">Chegada no Cliente e Recebimento</h2>
    </div>
    <div class="step-desc">
      Chegou no cliente? Clique no botão flutuante <span class="btn-highlight">Cheguei / Receber</span>:
      <ul>
        <li>A tela fica limpa e minimalista: <strong>esconde todo o histórico passado</strong> e mostra apenas o que interessa: a forma de receber!</li>
        <li>Se o cliente <strong>já pagou antes por PIX</strong>: vai aparecer "PAGO" em verde bem grande. É só entregar a mercadoria e clicar em <strong>Concluir Entrega</strong>.</li>
        <li>Se o cliente <strong>vai pagar na entrega</strong>: escolha se é Dinheiro ou Cartão na maquininha e confirme.</li>
        <li>Pronto! A entrega é finalizada e você já pode pegar o próximo pedido.</li>
      </ul>
    </div>
  </div>

  <div class="tip-box">
    💡 <strong>Dica de Ouro para o Entregador:</strong> Sempre marque o CHECK VERDE de cada produto enquanto coloca na caixa. Isso garante 100% de precisão e evita ter que voltar na horta buscar produto esquecido!
  </div>

  <div class="footer-note">
    Conflora Horta &amp; Viveiro · Guia do Entregador · Conectando a horta ao cliente
  </div>
</body>
</html>`;
}

// 3. GERADOR DO GUIA DO CAIXA
function renderCashierHtml() {
  const imgSales = imgToBase64('cashier-1-today-sales.png');
  const imgClose = imgToBase64('cashier-2-closing-table.png');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Guia Rápido · Operador de Caixa</title>
  <style>${sharedPdfCss}</style>
</head>
<body>
  <div class="header-card" style="background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);">
    <div>
      <div class="header-brand">💵 Conflora Caixa &amp; Finanças</div>
      <div class="header-role">Guia Prático do Operador de Caixa</div>
    </div>
    <div class="header-badge" style="background:#bfdbfe;color:#1e3a8a;">Operação Diária</div>
  </div>

  <div class="step-box" style="border-left-color: #2563eb;">
    <div class="step-header">
      <div class="step-num" style="background:#2563eb;">1</div>
      <h2 class="step-title">Tela de Vendas Padrão "HOJE"</h2>
    </div>
    <div class="step-desc">
      Para evitar confusão com vendas de ontem ou de semanas passadas:
      <ul>
        <li>O sistema sempre abre automaticamente com o filtro <strong>"HOJE"</strong> selecionado.</li>
        <li>Sua tela mostra apenas o que o caixa precisa ver:
          <ul>
            <li><strong>Comandas Pendentes:</strong> Pedidos enviados pelos vendedores aguardando pagamento.</li>
            <li><strong>Histórico de Vendas de Hoje:</strong> Todas as vendas já recebidas hoje para você conferir a qualquer momento.</li>
          </ul>
        </li>
      </ul>
    </div>
    ${imgSales ? `<div class="screen-wrap"><img src="${imgSales}"><div class="screen-caption">Tela do Caixa: Histórico limpo das vendas do dia de HOJE</div></div>` : ''}
  </div>

  <div class="step-box" style="border-left-color: #16a34a;">
    <div class="step-header">
      <div class="step-num" style="background:#16a34a;">2</div>
      <h2 class="step-title">Recebimento de Pedidos no Balcão</h2>
    </div>
    <div class="step-desc">
      Quando o cliente chega ao caixa para pagar:
      <ul>
        <li>Clique na comanda do cliente na lista.</li>
        <li><strong>Em Dinheiro:</strong> Digite o valor que o cliente te entregou. O sistema calcula o troco na hora em destaque verde.</li>
        <li><strong>No Cartão (Débito ou Crédito):</strong> Passe o cartão na maquininha física da loja. Assim que a maquininha aprovar, confirme o recebimento no sistema.</li>
        <li><strong>No PIX:</strong> Confirme a notificação do Pix no sistema ou confira o comprovante.</li>
        <li><strong>No Fiado / Conta de Cliente:</strong> Selecione o cliente cadastrado para registrar a pendência.</li>
      </ul>
    </div>
  </div>

  <div class="page-break"></div>

  <div class="step-box" style="border-left-color: #d97706;">
    <div class="step-header">
      <div class="step-num" style="background:#d97706;">3</div>
      <h2 class="step-title">Fechamento de Caixa: A Tabela dos 5 Métodos</h2>
    </div>
    <div class="step-desc">
      No final do dia (ou troca de turno), clique no botão <span class="btn-highlight" style="background:#d97706;">Fechamento de Caixa</span>:
      <ul>
        <li>Aparecerá a tabela com as 5 formas de pagamento:
          <ol>
            <li>💵 <strong>Dinheiro</strong> (o que está na gaveta física)</li>
            <li>⚡ <strong>PIX</strong> (o que entrou na conta)</li>
            <li>💳 <strong>Cartão de Débito</strong> (total do relatório da maquininha)</li>
            <li>💳 <strong>Cartão de Crédito</strong> (total do relatório da maquininha)</li>
            <li>📝 <strong>Fiado / A Prazo</strong> (vendas autorizadas no saldo)</li>
          </ol>
        </li>
        <li>No campo <strong>"Valor Conferido"</strong>, digite o valor real que você contou na gaveta e tirou na maquininha.</li>
        <li>O sistema calcula a <strong>diferença em tempo real</strong>: se ficar R$ 0,00 verdinho, o caixa bateu 100%!</li>
      </ul>
    </div>
    ${imgClose ? `<div class="screen-wrap"><img src="${imgClose}"><div class="screen-caption">Tela de Fechamento de Caixa: Conferência dos 5 métodos e cálculo de diferença</div></div>` : ''}
  </div>

  <div class="step-box" style="border-left-color: #9333ea;">
    <div class="step-header">
      <div class="step-num" style="background:#9333ea;">4</div>
      <h2 class="step-title">Anexar Foto da Maquininha e Fechar</h2>
    </div>
    <div class="step-desc">
      Para dar total segurança a você e à gerência:
      <ul>
        <li>Tire uma foto nítida do papelzinho do <strong>Fechamento / Resumo Diário</strong> emitido pela maquininha de cartão.</li>
        <li>Clique no botão 📷 <strong>"Anexar Comprovante / Foto"</strong> e selecione a foto.</li>
        <li>Clique em <span class="btn-highlight" style="background:#16a34a;">Confirmar Fechamento do Caixa</span>.</li>
        <li>Pronto! O sistema arquiva seu fechamento com data, hora, seu nome e gera o resumo para a administração.</li>
      </ul>
    </div>
  </div>

  <div class="tip-box">
    💡 <strong>Dica de Ouro para o Caixa:</strong> Nunca deixe para contar as notas com pressa no escuro. Conte o dinheiro com calma na gaveta antes de abrir o fechamento de caixa, e tire a foto da maquininha com boa iluminação!
  </div>

  <div class="footer-note">
    Conflora Horta &amp; Viveiro · Guia do Caixa · Transparência e tranquilidade financeira
  </div>
</body>
</html>`;
}

// 4. GERADOR DO GUIA DO ADMINISTRADOR E GERENTE
function renderAdminHtml() {
  const imgExec = imgToBase64('admin-1-executive-today.png');
  const imgAudit = imgToBase64('admin-2-cashier-audit.png');
  const imgCat = imgToBase64('admin-3-catalog.png');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Guia Rápido · Administrador e Gerente</title>
  <style>${sharedPdfCss}</style>
</head>
<body>
  <div class="header-card" style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%);">
    <div>
      <div class="header-brand">👑 Conflora Painel Gerencial</div>
      <div class="header-role">Guia Prático do Administrador e Gerente</div>
    </div>
    <div class="header-badge" style="background:#fef08a;color:#854d0e;">Visão 360°</div>
  </div>

  <div class="step-box" style="border-left-color: #3b82f6;">
    <div class="step-header">
      <div class="step-num" style="background:#3b82f6;">1</div>
      <h2 class="step-title">Resultados da Loja em Tempo Real (Filtro "HOJE")</h2>
    </div>
    <div class="step-desc">
      Ao entrar em <strong>Resultados da Loja (/admin-gerencial)</strong>:
      <ul>
        <li>O painel sempre abre com o filtro <strong>HOJE</strong> selecionado por padrão.</li>
        <li>Você acompanha o batimento cardíaco da empresa:
          <ul>
            <li><strong>Faturamento Total:</strong> Soma de todas as vendas do dia.</li>
            <li><strong>Ticket Médio:</strong> Valor médio gasto por cliente.</li>
            <li><strong>Divisão por Meio de Pagamento:</strong> Quanto entrou em Dinheiro, PIX, Débito, Crédito e Fiado.</li>
            <li><strong>Botão WhatsApp:</strong> Envia com um único clique o resumo executivo do dia formatado para o WhatsApp dos sócios.</li>
          </ul>
        </li>
      </ul>
    </div>
    ${imgExec ? `<div class="screen-wrap"><img src="${imgExec}"><div class="screen-caption">Painel Executivo: Métricas do dia, divisão por pagamento e envio para WhatsApp</div></div>` : ''}
  </div>

  <div class="step-box" style="border-left-color: #10b981;">
    <div class="step-header">
      <div class="step-num" style="background:#10b981;">2</div>
      <h2 class="step-title">Raio-X Completo de Comandas Finalizadas</h2>
    </div>
    <div class="step-desc">
      Ao clicar em qualquer pedido finalizado no histórico, você vê todos os detalhes da operação:
      <ul>
        <li>👤 <strong>Quem Comprou:</strong> Nome do cliente, telefone e endereço.</li>
        <li>🏷️ <strong>Quem Vendeu:</strong> Nome do colaborador que atendeu no balcão (ou "Autoatendimento / WhatsApp").</li>
        <li>🛵 <strong>Quem Entregou:</strong> Nome do entregador e tempo que ele levou na rota.</li>
        <li>⏱️ <strong>Duração Total:</strong> Tempo exato desde o primeiro clique no pedido até a entrega ou recebimento final.</li>
      </ul>
    </div>
  </div>

  <div class="page-break"></div>

  <div class="step-box" style="border-left-color: #8b5cf6;">
    <div class="step-header">
      <div class="step-num" style="background:#8b5cf6;">3</div>
      <h2 class="step-title">Auditoria de Fechamentos e Fotos das Maquininhas</h2>
    </div>
    <div class="step-desc">
      No menu de <strong>Fechamento dos Caixas</strong>:
      <ul>
        <li>Veja a lista de todos os turnos e caixas fechados pelos operadores.</li>
        <li>O sistema compara o <em>Valor Calculado pelo Sistema</em> versus o <em>Valor Declarado pelo Caixa</em>. Se houver divergência, é destacado em vermelho.</li>
        <li>Clique para abrir a <strong>Foto do Comprovante da Maquininha</strong> anexada pelo caixa. Você audita o dia sem precisar catar papéis soltos na gaveta!</li>
      </ul>
    </div>
    ${imgAudit ? `<div class="screen-wrap"><img src="${imgAudit}"><div class="screen-caption">Auditoria de Caixas: Comparativo de valores informados e comprovantes anexados</div></div>` : ''}
  </div>

  <div class="step-box" style="border-left-color: #f59e0b;">
    <div class="step-header">
      <div class="step-num" style="background:#f59e0b;">4</div>
      <h2 class="step-title">Gestão do Catálogo de Produtos e Planilhas</h2>
    </div>
    <div class="step-desc">
      Na aba <strong>Produtos</strong>:
      <ul>
        <li>Listagem com ordenação padrão de <strong>A a Z</strong>, exatamente como o cliente vê na tela inicial.</li>
        <li>Busca rápida por nome e filtro por categorias.</li>
        <li><strong>Importar da Planilha:</strong> Importe a planilha de produtos do seu sistema legado em segundos. O sistema preenche fotos, descrições e dados automaticamente!</li>
      </ul>
    </div>
    ${imgCat ? `<div class="screen-wrap"><img src="${imgCat}"><div class="screen-caption">Catálogo de Produtos do Admin: Ordenação A-Z, busca rápida e importação</div></div>` : ''}
  </div>

  <div class="tip-box">
    💡 <strong>Dica de Ouro para a Gestão:</strong> No fim do expediente, basta abrir o painel gerencial, conferir se os caixas fecharam com R$ 0,00 de diferença e clicar no botão de enviar para o WhatsApp. Em menos de 2 minutos você tem o fechamento do dia na palma da mão!
  </div>

  <div class="footer-note">
    Conflora Horta &amp; Viveiro · Guia da Administração · Controle, eficiência e dados em tempo real
  </div>
</body>
</html>`;
}

async function compileAllPdfs() {
  console.log('Iniciando compilação dos 4 PDFs com Playwright...');
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();

  const guides = [
    { name: 'guia-vendedor.pdf', html: renderSellerHtml() },
    { name: 'guia-entregador.pdf', html: renderDriverHtml() },
    { name: 'guia-caixa.pdf', html: renderCashierHtml() },
    { name: 'guia-admin.pdf', html: renderAdminHtml() }
  ];

  for (const guide of guides) {
    console.log(`Compilando ${guide.name}...`);
    await page.setContent(guide.html, { waitUntil: 'load' });
    const pdfPath = path.join(GUIAS_DIR, guide.name);
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '12mm',
        right: '12mm'
      }
    });
    console.log(`✅ Salvo: ${pdfPath} (${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB)`);
  }

  await browser.close();
}

async function main() {
  console.log('=== GERADOR AUTOMATIZADO DE GUIAS EM PDF DA CONFLORA ===');
  const base = new FirestoreRepository({ isInMemory: true });
  const storeRepo = new StoreRepository();
  const pdvRepo = new PdvRepository(base);
  const pdvService = new PdvService({
    repository: pdvRepo,
    whatsapp: {
      sendTextMessage: async () => ({ messages: [{ id: 'wamid.test' }] }),
      sendImageBuffer: async () => ({ messages: [{ id: 'wamid.image' }] })
    },
    pix: { createCharge: async () => ({ qrCodeBase64: 'data:image/png;base64,mock' }) },
    ownerPhone: '5564999994321'
  });

  const app = createApp({
    storeRepository: storeRepo,
    messageService: {
      firestoreRepo: base,
      catalogRepo: { items: [], refreshCatalog: async () => {} },
      whatsappClient: {
        sendTextMessage: async () => ({ messages: [{ id: 'wamid.test' }] }),
        sendImageBuffer: async () => ({ messages: [{ id: 'wamid.image' }] })
      }
    }
  });

  // Semear dados
  console.log('Semeando catálogo, colaboradores e pedidos de exemplo...');
  await seedData(base, pdvService, pdvRepo);

  // Iniciar servidor local
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Servidor de teste operacional em ${baseUrl}`);

  try {
    await captureScreenshots(baseUrl);
    await compileAllPdfs();
    console.log('=== TODOS OS 4 GUIAS FORAM GERADOS COM SUCESSO! ===');
  } catch (err) {
    console.error('Erro na geração dos guias:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
