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
  function persist() { /* Unsaved edits live only in this screen. */ }
  function configure(next) {
    options = next;
    if (owner === next.userId) return;
    owner = next.userId;
    drafts = new Map(); history = []; mode = 'SET';
    try { window.sessionStorage.removeItem(key()); } catch { /* Storage is optional. */ }
  }
  function summary() {
    element('stockCountingHelp').textContent = mode === 'ENTRY'
      ? 'enter_the_quantity_received_for_example_100_it_will_be_added_to_the_balance_if_you_wa_953a70'.tr
      : 'enter_the_actual_balance_for_example_100_upon_completion_the_stock_will_be_exactly_10_83c36d'.tr;
    element('stockModeEntry').setAttribute('aria-pressed', String(mode === 'ENTRY'));
    element('stockModeCount').setAttribute('aria-pressed', String(mode === 'SET'));
    for (const [id, selected] of [['stockModeEntry', mode === 'ENTRY'], ['stockModeCount', mode === 'SET']]) {
      element(id).className = 'action-btn ' + (selected ? 'btn-green' : 'btn-gray');
      element(id).disabled = saving;
    }
    element('stockDraftSummary').textContent = drafts.size
      ? drafts.size + " " + 'counted_product_s_review_the_numbers_on_the_cards'.tr
      : 'enter_the_quantity_or_tap_the_card_to_count_185703'.tr;
    element('stockSave').textContent = saving ? 'saving'.tr : (mode === 'ENTRY' ? 'save_entries'.tr : 'complete_audit'.tr) + (drafts.size ? ' (' + drafts.size + ')' : '');
    element('stockSave').disabled = saving || !drafts.size;
    element('stockUndo').disabled = saving || !history.length;
    element('stockCardsGrid').setAttribute('aria-busy', String(saving));
  }
  function setMode(next) {
    if (saving || next === mode) return;
    if (drafts.size) { status('save_the_current_count_before_changing_the_operation_type'.tr); return; }
    mode = next; history = []; persist(); status(''); render();
  }
  function updateCard(product) {
    const card = cards.get(String(product.id));
    if (!card) return;
    const draft = drafts.get(String(product.id));
    const unit = options.getUnit(product) === 'KG' ? 'kg'.tr : 'unit'.tr;
    const balance = Number(product.stockQuantity ?? product.estoque ?? 0);
    card.classList.toggle('stock-counted', Boolean(draft));
    card.querySelector('.stock-card-balance strong').textContent = String(balance);
    const input = card.querySelector('input');
    if (document.activeElement !== input) input.value = draft ? draft.amount : '';
    const preview = card.querySelector('.stock-count-preview');
    preview.textContent = draft
      ? (mode === 'ENTRY' ? 'inflow'.tr + draft.amount + ' ' + unit + " " + 'balance'.tr + " " + quantity(balance + draft.amount) : 'counted'.tr + " " + draft.amount + ' ' + unit + " " + 'difference'.tr + " " + quantity(draft.amount - balance))
      : 'not_counted_yet_99d318'.tr;
    for (const button of card.querySelectorAll('button, input')) button.disabled = saving || Boolean(draft?.submitted);
  }
  function refreshBalances() { if (!options) return; for (const product of options.getProducts()) updateCard(product); }
  function change(product, amount) {
    const id = String(product.id);
    const previous = drafts.get(id);
    if (saving || previous?.submitted) return;
    const isKg = options.getUnit(product) === 'KG';
    if (!Number.isFinite(amount) || amount < 0 || (!isKg && !Number.isInteger(amount)) || Math.abs(amount - quantity(amount)) > 0.000001) {
      status(isKg ? 'enter_the_weight_in_kg_up_to_three_decimal_places'.tr : 'enter_an_integer_quantity_equal_to_or_greater_than_zero'.tr); return;
    }
    history.push({ id, previous: previous ? { ...previous } : null });
    if (history.length > 500) history.shift();
    if (mode === 'ENTRY' && amount === 0) drafts.delete(id);
    else drafts.set(id, { amount, expectedStock: previous?.expectedStock ?? Number(product.stockQuantity ?? product.estoque ?? 0), requestId: window.crypto.randomUUID() });
    persist(); updateCard(product); summary();
    status((product.name || product.descricao) + ': ' + amount + (isKg ? 'kg'.tr : 'unit'.tr) + ' na contagem. Falta salvar.');
  }
  function increment(product) { change(product, quantity((drafts.get(String(product.id))?.amount || 0) + 1)); }
  function undo() {
    if (saving || !history.length) return;
    const { id, previous } = history.pop();
    if (drafts.get(id)?.submitted) return;
    if (previous) drafts.set(id, previous); else drafts.delete(id);
    persist(); refreshBalances(); summary(); status('last_change_undone'.tr);
  }
  function createProduct() { if (!saving) options.create(); }
  function render() {
    if (!options) return;
    const query = element('stockSearchInput').value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim();
    const products = options.getProducts().filter(product => {
      const text = [product.name, product.descricao, product.category, product.categoria, product.subcategory, product.subcategoria].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
      return query.split(/\s+/).every(word => text.includes(word));
    });
    element('stockProductsCount').textContent = products.length + " " + 'product_s_05d60b'.tr;
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
      const value = document.createElement('strong'); value.id = 'stk-' + product.id; balance.append(value, options.getUnit(product) === 'KG' ? 'kg'.tr : 'unit'.tr);
      const controls = document.createElement('label'); controls.className = 'stock-count-input';
      controls.textContent = mode === 'ENTRY' ? 'quantity_received'.tr : 'physical_quantity_counted'.tr;
      const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.step = options.getUnit(product) === 'KG' ? '0.001' : '1'; input.inputMode = options.getUnit(product) === 'KG' ? 'decimal' : 'numeric'; input.placeholder = 'ex_100'.tr;
      input.setAttribute('aria-label', controls.textContent + ' de ' + (product.name || product.descricao));
      input.onchange = () => { if (input.value !== '') change(product, Number(input.value)); };
      controls.appendChild(input);
      const preview = document.createElement('p'); preview.className = 'stock-count-preview';
      const action = content.querySelector('.cf-button'); action.textContent = options.getUnit(product) === 'KG' ? 'count_1_kg'.tr : 'count_1_unit'.tr; action.setAttribute('aria-label', action.textContent);
      content.insertBefore(balance, action); content.insertBefore(controls, action); content.insertBefore(preview, action);
      const secondary = document.createElement('button'); secondary.type = 'button'; secondary.className = 'stock-secondary'; secondary.textContent = 'write_off_or_adjustment_with_reason'.tr;
      secondary.onclick = () => {
        if (drafts.has(String(product.id))) { status('save_this_product_s_count_before_making_another_adjustment'.tr); return; }
        options.adjust('EXIT', product.id);
      };
      content.appendChild(secondary); updateCard(product);
      const restart = document.createElement('button'); restart.type = 'button'; restart.className = 'stock-secondary'; restart.textContent = 'restart_this_product'.tr;
      restart.onclick = () => {
        if (saving || drafts.get(String(product.id))?.submitted) return;
        drafts.delete(String(product.id)); history = []; persist(); refreshBalances(); summary();
        status('count_for_this_product_restarted_tap_to_count_again'.tr);
      };
      content.appendChild(restart);
    }
    if (!products.length) {
      const empty = document.createElement('div'); empty.className = 'stock-count-empty';
      const text = document.createElement('p'); text.textContent = 'not_found_register_the_product_and_continue_counting'.tr;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'cf-button'; button.textContent = 'register_this_product'.tr; button.onclick = createProduct;
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
        const response = await window.ConfloraSession.apiFetch('/api/admin/stock/adjustments', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, operation: mode, quantity: draft.amount, expectedStock: mode === 'SET' ? draft.expectedStock : undefined, reason: mode === 'SET' ? 'physical_inventory_count_in_catalog'.tr : 'entry_by_catalog_count'.tr, requestId: draft.requestId }),
        });
        const data = await response.json();
        if (!response.ok) {
          // A rejected write can be corrected; an uncertain response keeps the
          // original request id so retrying cannot record the movement twice.
          draft.submitted = false; persist();
          throw new Error(data.error || 'could_not_save_this_product'.tr);
        }
        drafts.delete(productId); persist(); saved += 1;
        options.updateBalance(productId, data.newStock);
      }
      status(saved + ' produto(s) salvo(s). Pode continuar contando.');
    } catch (error) {
      const message = error instanceof TypeError || error instanceof SyntaxError ? 'could_not_confirm_sending_check_your_connection_and_try_again'.tr : error.message;
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
