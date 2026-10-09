process.env.NODE_ENV = 'test';
const test = require('node:test');
const assert = require('node:assert/strict');
const { renderHomeHtml } = require('../src/http/views-home');
const { BotanicalConsultantService } = require('../src/ai/botanical-consultant');
const { createApp } = require('../src/http/app');
const { FirestoreRepository } = require('../src/database/firestore.repository');

test('1. DESIGN SYSTEM E LAYOUT RESPONSIVO PRINCIPAL (DESKTOP STICKY & MOBILE BOTTOM SHEET)', () => {
  const html = renderHomeHtml();

  // Design System Cores Conflora
  assert.ok(html.includes('--primary: #2E9348;'), 'Deve conter Verde Botânico #2E9348');
  assert.ok(html.includes('--gold: #F5C518;') || html.includes('--accent-gold: #F5C518;'), 'Deve conter Amarelo Dourado #F5C518');
  assert.ok(html.includes('--text: #1A1A1A;'), 'Deve conter Preto / Grafite #1A1A1A para textos');
  assert.ok(html.includes('--bg: #F8F9FA;'), 'Deve conter Fundo Cinza Sutil #F8F9FA');
  assert.ok(html.includes('--border: #E5E7EB;'), 'Deve conter Divisores e Bordas #E5E7EB');

  // Desktop: Coluna lateral fixa (Sticky) para Sacola e Checkout Express
  assert.ok(html.includes('grid-template-columns: 1fr 390px;'), 'Layout desktop deve conter grid com coluna de sacola de 390px');
  assert.ok(html.includes('.cart-panel'), 'Deve conter classe do painel da sacola');
  assert.ok(html.includes('position: sticky;'), 'Painel da sacola deve ser fixo/sticky no desktop');

  // Mobile: Bottom Sheet com Gaveta Deslizante e Backdrop
  assert.ok(html.includes('id="cartBottomSheetBackdrop"'), 'Deve conter backdrop overlay da bottom sheet no mobile');
  assert.ok(html.includes('bottom-sheet-handle-bar'), 'Deve conter handle visual de puxar da bottom sheet');
  assert.ok(html.includes('bottom-sheet-close-btn'), 'Deve conter botão de fechar da bottom sheet no mobile');
  assert.ok(html.includes('.cart-panel.bottom-sheet-open'), 'Deve conter classe de abertura suave da bottom sheet');
  assert.ok(html.includes('openCartBottomSheet'), 'Deve conter função de abertura da bottom sheet');
  assert.ok(html.includes('closeCartBottomSheet'), 'Deve conter função de fechamento da bottom sheet');

  // Checkout Express em 1 Tela
  assert.ok(html.includes('applyPhoneMask'), 'Deve conter máscara dinâmica de WhatsApp/DDD');
  assert.ok(html.includes('Entrega em Mineiros - GO'), 'Deve conter opção de Entrega em Mineiros - GO');
  assert.ok(html.includes('Retirada no Viveiro'), 'Deve conter opção de Retirada no Viveiro');
  assert.ok(html.includes('id="pixBox"'), 'Deve conter caixa de PIX');
  assert.ok(html.includes('copyPix()'), 'Deve conter botão funcional de Copiar Chave PIX');
});

test('2. COMPONENTE DO AGENTE BOTÂNICO IA (CONFLORA AI: FAB + CHAT DRAWER + MINI-CARDS)', () => {
  const html = renderHomeHtml();

  // Floating Action Button (FAB) com ícone de folha/brilho de IA
  assert.ok(html.includes('id="botanicalAiFab"'), 'Deve conter FAB fixo do Agente Botânico');
  assert.ok(html.includes('toggleBotanicalAiChat()'), 'FAB deve alternar abertura do chat');
  assert.ok(html.includes('ai-fab-icon'), 'Deve conter ícone do FAB com folha/brilho');
  assert.ok(html.includes('ai-fab-badge'), 'Deve conter badge IA');

  // Onboarding Coach Mark
  assert.ok(html.includes('id="aiOnboardingTooltip"'), 'Deve conter tooltip discreto de onboarding');
  assert.ok(html.includes('dismissAiCoachMark'), 'Deve conter dismiss com LocalStorage para o onboarding');

  // Chat Drawer do Agente Botânico
  assert.ok(html.includes('id="botanicalAiDrawer"'), 'Deve conter drawer / gaveta interativa do chat');
  assert.ok(html.includes('id="botanicalAiBackdrop"'), 'Deve conter backdrop do chat no mobile');
  assert.ok(html.includes('id="aiChatMessages"'), 'Deve conter container de mensagens do chat');
  assert.ok(html.includes('id="aiChatInput"'), 'Deve conter input de perguntas ao agente botânico');
  assert.ok(html.includes('id="aiChatSendBtn"'), 'Deve conter botão de envio da mensagem');

  // Chips de Sugestão Rápida de 1 Toque
  assert.ok(html.includes('Planta para sombra'), 'Deve conter sugestão para sombra');
  assert.ok(html.includes('Frutíferas para vasos'), 'Deve conter sugestão para frutíferas em vasos');
  assert.ok(html.includes('Pet-friendly'), 'Deve conter sugestão de plantas pet-friendly');

  // Integração com Sacola direto do Chat sem sair da conversa
  assert.ok(html.includes('addFromAiChat'), 'Deve conter ação de adicionar à sacola direto dos mini-cards do chat');
  assert.ok(html.includes('ai-product-mini-card'), 'Deve conter estilos dos mini-cards recomendados');
});

test('3. BACKEND API: BOTANICAL CONSULTANT SERVICE & ROTA POST /api/ai/botanical-consultant', async () => {
  // Teste de serviço isolado
  const sampleCatalog = [
    { id: 'p1', name: 'Zamioculca Zamiifolia', subcategory: 'Plantas de Sombra', category: 'Plantas / Mudas', price: 45.0 },
    { id: 'p2', name: 'Muda de Jabuticaba Sabará', subcategory: 'Frutíferas para Vasos', category: 'Frutíferas', price: 85.0 },
    { id: 'p3', name: 'Manjericão Italiano Roxo', subcategory: 'Horta & Temperos', category: 'Horta & Temperos', price: 12.0 },
    { id: 'p4', name: 'Substrato Especial com Casca de Arroz', subcategory: 'Adubos & Substratos', category: 'Adubos & Substratos', price: 25.0 },
  ];

  const sombraConsult = await BotanicalConsultantService.consult({
    query: 'Qual planta aguenta ambiente de sombra dentro de casa?',
    catalogProducts: sampleCatalog,
  });

  assert.equal(sombraConsult.success, true);
  assert.equal(sombraConsult.intent, 'SOMBRA');
  assert.ok(sombraConsult.reply.includes('sombra'));
  assert.ok(sombraConsult.recommendations.length > 0);
  assert.equal(sombraConsult.recommendations[0].id, 'p1');

  // Teste de Rota HTTP
  const repo = new FirestoreRepository({ isInMemory: true });
  await repo.saveProduct({
    id: 'prod-horta-01',
    name: 'Alecrim Aromático em Vaso',
    category: 'Horta & Temperos',
    price: 18.0,
  });

  const app = createApp({ messageService: { firestoreRepo: repo } });
  const server = app.listen(0);
  const { port } = server.address();

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/ai/botanical-consultant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'Tem alecrim para tempero?' }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.reply);
    assert.ok(data.recommendations);
    assert.ok(data.recommendations.some(p => p.name.includes('Alecrim')));
  } finally {
    server.close();
  }
});
