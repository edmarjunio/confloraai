/* Physical counting drafts belong to this operator and this tab. */
(() => {
  let options;
  let owner = '';
  let mode = 'SET';
  let drafts = new Map();
  let history = [];
  let saving = false;
  const cards = new Map();
  const element = id => document.getElementById(id);
  const quantity = value => Number(Number(value).toFixed(3));
  const key = () => 'conflora:stock-count:' + owner;
  const status = text => { element('stockCountingStatus').textContent = text; };
  function persist() {
    try { window.sessionStorage.setItem(key(), JSON.stringify({ mode, drafts: [...drafts] })); }
    catch { status('A contagem está nesta tela. Mantenha a aba aberta até salvar.'); }
  }
  function configure(next) {
    options = next;
    if (owner === next.userId) return;
    owner = next.userId;
    drafts = new Map(); history = []; mode = 'SET';
    try {
      const saved = JSON.parse(window.sessionStorage.getItem(key()) || 'null');
      if (saved && ['ENTRY', 'SET'].includes(saved.mode) && Array.isArray(saved.drafts)) {
        mode = saved.mode; drafts = new Map(saved.drafts);
      }
    } catch { /* A malformed draft must not block access to stock. */ }
  }
  function summary() {
    element('stockCountingHelp').textContent = mode === 'ENTRY'
      ? 'Digite a quantidade recebida, por exemplo 100. Ela será somada ao saldo. Se quer deixar o saldo exatamente em 100, use Conferir o que tenho.'
      : 'Digite o saldo real, por exemplo 100. Ao concluir, o estoque será exatamente 100, mesmo se antes estava negativo. Para contar aos poucos, cada toque soma +1.';
    element('stockModeEntry').setAttribute('aria-pressed', String(mode === 'ENTRY'));
    element('stockModeCount').setAttribute('aria-pressed', String(mode === 'SET'));
    for (const [id, selected] of [['stockModeEntry', mode === 'ENTRY'], ['stockModeCount', mode === 'SET']]) {
      element(id).className = 'action-btn ' + (selected ? 'btn-green' : 'btn-gray');
      element(id).disabled = saving;
    }
    element('stockDraftSummary').textContent = drafts.size
      ? drafts.size + ' produto(s) contado(s) · revise os números nos cartões'
      : 'Digite a quantidade ou toque no cartão para contar';
    element('stockSave').textContent = saving ? 'Salvando…' : (mode === 'ENTRY' ? 'Salvar entradas' : 'Concluir conferência') + (drafts.size ? ' (' + drafts.size + ')' : '');
    element('stockSave').disabled = saving || !drafts.size;
    element('stockUndo').disabled = saving || !history.length;
    element('stockCardsGrid').setAttribute('aria-busy', String(saving));
  }
  function setMode(next) {
    if (saving || next === mode) return;
    if (drafts.size) { status('Salve a contagem atual antes de mudar o tipo de operação.'); return; }
    mode = next; history = []; persist(); status(''); render();
  }
  function updateCard(product) {
    const card = cards.get(String(product.id));
    if (!card) return;
    const draft = drafts.get(String(product.id));
    const unit = options.getUnit(product) === 'KG' ? 'kg' : 'un.';
    const balance = Number(product.stockQuantity ?? product.estoque ?? 0);
    card.classList.toggle('stock-counted', Boolean(draft));
    card.querySelector('.stock-card-balance strong').textContent = String(balance);
    const input = card.querySelector('input');
    if (document.activeElement !== input) input.value = draft ? draft.amount : '';
    const preview = card.querySelector('.stock-count-preview');
    preview.textContent = draft
      ? (mode === 'ENTRY' ? 'Entrada: +' + draft.amount + ' ' + unit + ' → saldo ' + quantity(balance + draft.amount) : 'Contado: ' + draft.amount + ' ' + unit + ' · diferença ' + quantity(draft.amount - balance))
      : 'Ainda não contado';
    for (const button of card.querySelectorAll('button, input')) button.disabled = saving || Boolean(draft?.submitted);
  }
  function refreshBalances() { if (!options) return; for (const product of options.getProducts()) updateCard(product); }
  function change(product, amount) {
    const id = String(product.id);
    const previous = drafts.get(id);
    if (saving || previous?.submitted) return;
    const isKg = options.getUnit(product) === 'KG';
    if (!Number.isFinite(amount) || amount < 0 || (!isKg && !Number.isInteger(amount)) || Math.abs(amount - quantity(amount)) > 0.000001) {
      status(isKg ? 'Informe o peso em kg, com até três casas decimais.' : 'Informe uma quantidade inteira, igual ou maior que zero.'); return;
    }
    history.push({ id, previous: previous ? { ...previous } : null });
    if (history.length > 500) history.shift();
    if (mode === 'ENTRY' && amount === 0) drafts.delete(id);
    else drafts.set(id, { amount, expectedStock: previous?.expectedStock ?? Number(product.stockQuantity ?? product.estoque ?? 0), requestId: window.crypto.randomUUID() });
    persist(); updateCard(product); summary();
    status((product.name || product.descricao) + ': ' + amount + (isKg ? ' kg' : ' un.') + ' na contagem. Falta salvar.');
  }
  function increment(product) { change(product, quantity((drafts.get(String(product.id))?.amount || 0) + 1)); }
  function undo() {
    if (saving || !history.length) return;
    const { id, previous } = history.pop();
    if (drafts.get(id)?.submitted) return;
    if (previous) drafts.set(id, previous); else drafts.delete(id);
    persist(); refreshBalances(); summary(); status('Última alteração desfeita.');
  }
  function createProduct() { if (!saving) options.create(); }
  function render() {
    if (!options) return;
    const query = element('stockSearchInput').value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
    const products = options.getProducts().filter(product => {
      const text = [product.name, product.descricao, product.category, product.categoria, product.subcategory, product.subcategoria].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
      return query.split(/\s+/).every(word => text.includes(word));
    });
    element('stockProductsCount').textContent = products.length + ' produto(s)';
    const grid = element('stockCardsGrid'); grid.replaceChildren(); cards.clear();
    const fragment = document.createDocumentFragment();
    for (const product of products) {
      const card = document.createElement('render-product-card');
      card.setAttribute('variant', 'stock'); card.product = product;
      card.addEventListener('cf-product-card-action', event => {
        if (['open', 'edit', 'add'].includes(event.detail.action)) increment(product);
      });
      fragment.appendChild(card); cards.set(String(product.id), card);
    }
    grid.appendChild(fragment);
    for (const product of products) {
      const card = cards.get(String(product.id));
      card.classList.add('stock-card'); card.dataset.productId = product.id;
      card.querySelector('.cf-shared-store-price').remove();
      const content = card.querySelector('.product-content');
      const balance = document.createElement('p'); balance.className = 'stock-card-balance';
      balance.append('Saldo atual: ');
      const value = document.createElement('strong'); value.id = 'stk-' + product.id; balance.append(value, options.getUnit(product) === 'KG' ? ' kg' : ' un.');
      const controls = document.createElement('label'); controls.className = 'stock-count-input';
      controls.textContent = mode === 'ENTRY' ? 'Quantidade recebida' : 'Quantidade física contada';
      const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.step = options.getUnit(product) === 'KG' ? '0.001' : '1'; input.inputMode = options.getUnit(product) === 'KG' ? 'decimal' : 'numeric'; input.placeholder = 'Ex.: 100';
      input.setAttribute('aria-label', controls.textContent + ' de ' + (product.name || product.descricao));
      input.onchange = () => { if (input.value !== '') change(product, Number(input.value)); };
      controls.appendChild(input);
      const preview = document.createElement('p'); preview.className = 'stock-count-preview';
      const action = content.querySelector('.cf-button'); action.textContent = options.getUnit(product) === 'KG' ? '＋ Contar 1 kg' : '＋ Contar 1 unidade'; action.setAttribute('aria-label', action.textContent);
      content.insertBefore(balance, action); content.insertBefore(controls, action); content.insertBefore(preview, action);
      const secondary = document.createElement('button'); secondary.type = 'button'; secondary.className = 'stock-secondary'; secondary.textContent = 'Baixa ou ajuste com motivo';
      secondary.onclick = () => {
        if (drafts.has(String(product.id))) { status('Salve a contagem deste produto antes de fazer outro ajuste.'); return; }
        options.adjust('EXIT', product.id);
      };
      content.appendChild(secondary); updateCard(product);
      const restart = document.createElement('button'); restart.type = 'button'; restart.className = 'stock-secondary'; restart.textContent = 'Recomeçar este produto';
      restart.onclick = () => {
        if (saving || drafts.get(String(product.id))?.submitted) return;
        drafts.delete(String(product.id)); history = []; persist(); refreshBalances(); summary();
        status('Contagem deste produto reiniciada. Toque para contar novamente.');
      };
      content.appendChild(restart);
    }
    if (!products.length) {
      const empty = document.createElement('div'); empty.className = 'stock-count-empty';
      const text = document.createElement('p'); text.textContent = 'Não encontrou? Cadastre o produto e continue a contagem.';
      const button = document.createElement('button'); button.type = 'button'; button.className = 'cf-button'; button.textContent = '＋ Cadastrar este produto'; button.onclick = createProduct;
      empty.append(text, button); grid.appendChild(empty);
    }
    summary();
  }
  async function save() {
    if (saving || !drafts.size) return;
    const invalid = [...element('stockCardsGrid').querySelectorAll('input')].find(input => !input.checkValidity());
    if (invalid) { invalid.reportValidity(); return; }
    saving = true; history = []; summary(); refreshBalances(); let saved = 0;
    try {
      for (const [productId, draft] of drafts) {
        draft.submitted = true; persist();
        const response = await window.fetch('/api/admin/stock/adjustments', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, operation: mode, quantity: draft.amount, expectedStock: mode === 'SET' ? draft.expectedStock : undefined, reason: mode === 'SET' ? 'Conferência física por contagem no catálogo' : 'Entrada por contagem no catálogo', requestId: draft.requestId }),
        });
        const data = await response.json();
        if (!response.ok) {
          // A rejected write can be corrected; an uncertain response keeps the
          // original request id so retrying cannot record the movement twice.
          draft.submitted = false; persist();
          throw new Error(data.error || 'Não foi possível salvar este produto.');
        }
        drafts.delete(productId); persist(); saved += 1;
        options.updateBalance(productId, data.newStock);
      }
      status(saved + ' produto(s) salvo(s). Pode continuar contando.');
    } catch (error) {
      const message = error instanceof TypeError || error instanceof SyntaxError ? 'Não foi possível confirmar o envio. Confira a conexão e tente novamente.' : error.message;
      status((saved ? saved + ' produto(s) salvo(s). ' : '') + message + ' A contagem restante continua nesta aba. Tente salvar novamente; em caso de saldo alterado, atualize e reconte o produto.');
    } finally {
      saving = false; refreshBalances(); summary(); options.refreshMovements();
    }
  }
  window.addEventListener('beforeunload', event => {
    if (!drafts.size) return;
    event.preventDefault(); event.returnValue = '';
  });
  window.StockCounting = { configure, render, setMode, change, undo, save, createProduct, refreshBalances };
})();
