process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderHomeHtml } = require('../src/http/views-home');
const { createApp } = require('../src/http/app');
const { FirestoreRepository } = require('../src/database/firestore.repository');

test('1. RESPONSIVIDADE MOBILE-FIRST & RESET TOTAL DE OVERFLOW', () => {
  const html = renderHomeHtml();

  // Meta viewport estrita
  assert.ok(
    html.includes('name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"'),
    'Deve conter meta tag viewport mobile-first com viewport-fit=cover'
  );

  // Box-sizing e reset de overflow global
  assert.ok(html.includes('box-sizing: border-box'), 'Deve conter box-sizing border-box global');
  assert.ok(html.includes('overflow-x: hidden'), 'Deve conter overflow-x: hidden no html e body');
});

test('2. ESCALABILIDADE EXTREMA: BATCH VIRTUALIZATION, BUSCA NFD, DEBOUNCE E LAZY LOADING', () => {
  const html = renderHomeHtml();

  // Sentinela invisível para IntersectionObserver
  assert.ok(html.includes('id="catalogSentinel"'), 'Deve conter sentinela de rolagem infinita');
  assert.ok(html.includes('IntersectionObserver'), 'Deve inicializar IntersectionObserver');

  // Busca reativa com NFD e debounce
  assert.ok(html.includes('.normalize(\'NFD\')'), 'Deve normalizar texto com NFD para ignorar acentos');
  assert.ok(html.includes('150'), 'Deve conter debounce de 150ms na busca');

  // Cache local em localStorage
  assert.ok(html.includes('localStorage.getItem'), 'Deve carregar catálogo instantaneamente do cache local');
  assert.ok(html.includes('conflora_catalog_cache'), 'Chave de cache do catálogo deve existir');

  // Lazy loading e async decoding nas imagens
  assert.ok(html.includes('loading="lazy"'), 'Imagens devem ter loading="lazy"');
  assert.ok(html.includes('decoding="async"'), 'Imagens devem ter decoding="async"');
});

test('3. ORDENAÇÃO A-Z COMO REGRA PADRÃO EM TODAS AS LISTAGENS', () => {
  const html = renderHomeHtml();

  // Ordenação A-Z padrão com pt-BR
  assert.ok(html.includes('localeCompare(b.descricao || b.name || \'\', \'pt-BR\')') || html.includes('localeCompare'), 'Deve ordenar produtos usando localeCompare');
  assert.ok(html.includes('<option value="nome_asc" selected>'), 'Seletor deve ter "Ordem: A a Z" como opção padrão selecionada');
  assert.ok(html.includes('value="nome_desc"'), 'Deve conter opção Z a A');
  assert.ok(html.includes('value="preco_asc"'), 'Deve conter opção Menor Preço');
  assert.ok(html.includes('value="preco_desc"'), 'Deve conter opção Maior Preço');
});

test('4. CARROSSEL DE CATEGORIAS ISOLADO', () => {
  const html = renderHomeHtml();

  // Barra de categorias com scroll horizontal isolado
  assert.ok(html.includes('overflow-x: auto;'), 'Barra de categorias deve ter overflow-x: auto');
  assert.ok(html.includes('flex-wrap: nowrap;'), 'Barra de categorias deve ter flex-wrap: nowrap');
  assert.ok(html.includes('scrollbar-width: none;'), 'Barra de categorias deve ter scrollbar-width: none');
});

test('5. UX ESTILO IFOOD COM ADIÇÃO EM 1 CLIQUE E GRID MOBILE 2 COLUNAS', () => {
  const html = renderHomeHtml();

  // Grid mobile com 2 colunas proporcionais
  assert.ok(html.includes('grid-template-columns: repeat(2, minmax(0, 1fr));'), 'Deve ter grid mobile com 2 colunas proporcionais');

  // Botão '+' que se transforma no seletor '[-] [quantidade] [+]'
  assert.ok(html.includes('card-qty-ctrl'), 'Deve conter estrutura do seletor de quantidade no card');
  assert.ok(html.includes('renderCardButtonHtml'), 'Deve conter função de renderização dinâmica do botão do card');
  assert.ok(html.includes('handleProductAddClick'), 'Deve adicionar à sacola em 1 clique');
});

test('6. SISTEMA DE CUPOM DE DESCONTO', () => {
  const html = renderHomeHtml();

  // Banner no topo com botão 'Usar Cupom'
  assert.ok(html.includes('id="promoBanner"'), 'Deve conter banner de cupom promocional no topo');
  assert.ok(html.includes('applyPromoCouponDirect'), 'Deve conter função de aplicação em 1 toque do cupom');

  // Input de cupom na sacola e validação
  assert.ok(html.includes('id="couponInput"'), 'Deve conter input de cupom');
  assert.ok(html.includes('applyCouponFromInput'), 'Deve conter função de validação de cupom');
  assert.ok(html.includes('CONFLORA10'), 'Deve conter código de cupom homologado');
  assert.ok(html.includes('discountSummaryRow'), 'Deve conter linha de exibição de desconto aplicado');
});

test('7. FORMA DE PAGAMENTO EM DINHEIRO COM CÁLCULO DE TROCO', () => {
  const html = renderHomeHtml();

  // Seletor de pagamento: Pix, Cartão e Dinheiro
  assert.ok(html.includes('setPayment(\'PIX\')'), 'Deve conter seletor Pix');
  assert.ok(html.includes('setPayment(\'CARTAO\')'), 'Deve conter seletor Cartão');
  assert.ok(html.includes('setPayment(\'DINHEIRO\')'), 'Deve conter seletor Dinheiro');

  // Campo de dinheiro e cálculo de troco
  assert.ok(html.includes('id="cashTenderedInput"'), 'Deve conter campo para informar dinheiro em mãos');
  assert.ok(html.includes('calculateChange'), 'Deve conter função de cálculo de troco em tempo real');
  assert.ok(html.includes('id="changeResultBox"'), 'Deve conter elemento visual de resultado do troco');
  assert.ok(html.includes('id="cashQuickChips"'), 'Deve conter atalhos rápidos de valores em dinheiro');
});

test('8. BOTÕES FLUTUANTES (FABs) AO ROLAR A TELA', () => {
  const html = renderHomeHtml();

  // Grupo flutuante de FABs (Voltar ao Topo e Filtro de Categorias; sacola flutuante removida pois já tem a barra fixa inferior)
  assert.ok(html.includes('id="fabsGroup"'), 'Deve conter container do grupo flutuante de FABs');
  assert.ok(html.includes('scrollToTop()'), 'Deve conter botão de voltar ao topo com scroll suave');
  assert.ok(html.includes('scrollToFilters()'), 'Deve conter botão de rolagem para categorias/filtro');
  assert.strictEqual(html.includes('id="fabCartBadge"'), false, 'Não deve conter botão flutuante duplicado da sacola');
});

test('9. BARRA FIXA INFERIOR NO MOBILE COM SAFE AREA', () => {
  const html = renderHomeHtml();

  // Barra fixa no rodapé com safe area inset
  assert.ok(html.includes('id="mobileCartFloatBar"'), 'Deve conter barra fixa inferior da sacola');
  assert.ok(html.includes('safe-area-inset-bottom'), 'Deve respeitar safe area inferior de celulares modernos');
  assert.ok(html.includes('Ver Sacola ➔'), 'Deve conter chamada para ação Ver Sacola');
});

test('10. FINALIZAÇÃO, RECIBO DO CLIENTE E NOTIFICAÇÃO DO PROPRIETÁRIO VIA WHATSAPP', async () => {
  const html = renderHomeHtml();

  // Modal do comprovante digital do cliente
  assert.ok(html.includes('id="orderReceiptModal"'), 'Deve conter modal de comprovante digital do cliente');
  assert.ok(html.includes('id="receiptPaperContent"'), 'Deve conter área formatada do comprovante');
  assert.ok(html.includes('copyReceiptText()'), 'Deve conter botão de copiar comprovante');
  assert.ok(html.includes('printReceipt()'), 'Deve conter botão de imprimir / salvar');
  assert.ok(html.includes('id="receiptOwnerWaLink"'), 'Deve conter link de notificação WhatsApp para o proprietário');
  assert.ok(html.includes('5564999351616'), 'Deve conter telefone WhatsApp do proprietário da loja');

  // Teste de API do Backend: POST /api/orders persiste cupom, desconto e dados de troco
  const repo = new FirestoreRepository({ isInMemory: true });
  const app = createApp({ messageService: { firestoreRepo: repo } });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Cliente Teste iFood UX',
        customerPhone: '5564999998888',
        orderType: 'DELIVERY',
        deliveryAddress: 'Rua 10, N 100, Centro, Mineiros - GO',
        paymentMethod: 'DINHEIRO',
        subtotal: 100.0,
        coupon: 'CONFLORA10',
        discount: 10.0,
        cashTendered: 100.0,
        changeDue: 10.0,
        items: [
          { productId: 'p1', name: 'Muda de Jabuticaba Híbrida', quantity: 2, price: 50.0 }
        ],
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.order);
    assert.equal(data.order.coupon, 'CONFLORA10');
    assert.equal(data.order.discount, 10);
    assert.equal(data.order.total, 90);
    assert.equal(data.order.cashTendered, 100);
    assert.equal(data.order.changeDue, 10);
  } finally {
    server.close();
  }
});
