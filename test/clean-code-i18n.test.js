process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderHomeHtml } = require('../src/http/views-home');

test('1. ARQUITETURA LIMPA E PRINCÍPIOS DE ROBERT C. MARTIN (CLEAN CODE)', () => {
  const html = renderHomeHtml();

  // Meaningful Names in English
  assert.ok(html.includes('calculateChangeAmount'), 'Deve conter função pura de cálculo de troco com nome significativo');
  assert.ok(html.includes('calculateDiscountAmount'), 'Deve conter função pura de desconto com nome significativo');
  assert.ok(html.includes('calculateOrderTotals'), 'Deve conter função pura de totais do pedido');
  assert.ok(html.includes('cartItemsMap'), 'Deve conter mapa de itens no Store do carrinho');
  assert.ok(html.includes('CatalogRepository'), 'Deve conter camada de repositório para o catálogo');
  assert.ok(html.includes('LocalizationService'), 'Deve conter serviço isolado de internacionalização');
  assert.ok(html.includes('CartStore'), 'Deve conter Store previsível para gerenciar o estado');

  // Small Functions & SRP & Sem Efeitos Colaterais
  assert.ok(html.includes('function calculateChangeAmount'), 'Função de troco deve ser pura e desacoplada');
  assert.ok(html.includes('function calculateDiscountAmount'), 'Função de desconto deve ser pura e desacoplada');
  assert.ok(html.includes('function normalizeSearchString'), 'Função de normalização de texto isolada');
});

test('2. SISTEMA DE INTERNACIONALIZAÇÃO (i18n READY)', () => {
  const html = renderHomeHtml();

  // Dicionário estruturado com pt-BR, en-US e es-ES
  assert.ok(html.includes('const TRANSLATIONS ='), 'Deve conter dicionário estruturado TRANSLATIONS');
  assert.ok(html.includes('\'pt-BR\':'), 'Deve conter suporte ao locale pt-BR');
  assert.ok(html.includes('\'en-US\':'), 'Deve conter suporte ao locale en-US');
  assert.ok(html.includes('\'es-ES\':'), 'Deve conter suporte ao locale es-ES');

  // Chaves hierárquicas em inglês
  assert.ok(html.includes('header.searchPlaceholder'), 'Deve conter chave header.searchPlaceholder');
  assert.ok(html.includes('category.all'), 'Deve conter chave category.all');
  assert.ok(html.includes('payment.cashChangeRequired'), 'Deve conter chave payment.cashChangeRequired');
  assert.ok(html.includes('receipt.orderNumber'), 'Deve conter chave receipt.orderNumber');
  assert.ok(html.includes('checkout.submitButton'), 'Deve conter chave checkout.submitButton');
  assert.ok(html.includes('cart.subtotal'), 'Deve conter chave cart.subtotal');
  assert.ok(html.includes('cart.total'), 'Deve conter chave cart.total');

  // Atributos semânticos data-i18n no DOM
  assert.ok(html.includes('data-i18n="cart.title"'), 'Elementos estáticos devem ter data-i18n');
  assert.ok(html.includes('data-i18n="payment.methodLabel"'), 'Seletor de pagamento deve ter data-i18n');
  assert.ok(html.includes('data-i18n="checkout.submitButton"'), 'Botão de finalizar deve ter data-i18n');
  assert.ok(html.includes('data-i18n="header.brandTitle"'), 'Título do header deve ter data-i18n');
  assert.ok(html.includes('data-i18n-placeholder="header.searchPlaceholder"'), 'Input de busca deve ter data-i18n-placeholder');

  // Formatador nativo Intl.NumberFormat baseado no locale ativo
  assert.ok(html.includes('Intl.NumberFormat'), 'Deve utilizar a API nativa Intl.NumberFormat');

  // Seletor de idiomas no topo para alternância instantânea
  assert.ok(html.includes('id="langPtBtn"'), 'Deve conter botão de idioma pt-BR');
  assert.ok(html.includes('id="langEnBtn"'), 'Deve conter botão de idioma en-US');
  assert.ok(html.includes('id="langEsBtn"'), 'Deve conter botão de idioma es-ES');
  assert.ok(html.includes('setLanguage(\'en-US\')'), 'Deve permitir alternância de idioma via setLanguage');
});
