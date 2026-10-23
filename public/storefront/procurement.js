import { element, inputField, notify, money, readJsonResponse } from './ui.js';

const labels = { AWAITING_QUOTE: 'awaiting_quote'.tr, FORECAST_CONFIRMED: 'awaiting_quote'.tr, AWAITING_CUSTOMER: 'waiting_for_customer_acceptance'.tr,
  AWAITING_ARRIVAL: 'Aguardando chegada', READY: 'available_awaiting_delivery_or_pickup'.tr, READY_PICKUP: 'awaiting_pickup'.tr,
  AWAITING_DRIVER: 'Aguardando entregador', COMPLETED: 'Finalizada', DECLINED: 'not_confirmed'.tr };
const closed = request => request.status === 'closed' || ['COMPLETED', 'DECLINED'].includes(request.requestStatus);
const button = options => window.createButton3D({ variant: 'secondary', size: 'md', ...options });
const dateLabel = date => date?.split('-').reverse().join('/') || '';
const quantityLabel = item => `${item.quantity} ${item.requestedName}${item.unit === 'KG' ? ' (kg)' : ''}`;

async function api(path, body) {
  const response = await window.ConfloraSession.apiFetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'could_not_update_the_order'.tr);
  return data;
}

function check(form, text, name, accessibleLabel = text) {
  const control = element('input', { type: 'checkbox', name, required: '', 'aria-label': accessibleLabel });
  form.append(element('label', { class: 'procurement-check' }, [control, document.createTextNode(text)]));
  return control;
}

function action(form, text, label, submit, canSubmit = () => true) {
  const error = element('p', { class: 'procurement-error', role: 'alert', hidden: '' });
  const submitButton = button({ text, variant: 'primary', type: 'submit', attributes: { 'aria-label': label } });
  form.append(error, element('div', { class: 'procurement-actions' }, [submitButton]));
  const sync = () => { if (form.getAttribute('aria-busy') !== 'true') submitButton.disabled = !canSubmit(); };
  form.addEventListener('input', sync); form.addEventListener('change', sync);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (!canSubmit() || form.getAttribute('aria-busy') === 'true') return;
    error.hidden = true; submitButton.disabled = true; form.setAttribute('aria-busy', 'true');
    const caption = submitButton.querySelector('.cf-btn-3d__text'); caption.textContent = 'saving'.tr;
    try { await submit(); }
    catch (failure) { error.textContent = failure.message; error.hidden = false; }
    finally { form.removeAttribute('aria-busy'); caption.textContent = text; sync(); }
  });
  sync(); return sync;
}

function productField(state, item, index, required = false) {
  const select = element('select', { name: 'product-' + index, 'aria-label': `${'product_registered_for'.tr} ${item.requestedName}` });
  select.append(element('option', { value: '', text: required ? 'select_product'.tr : 'link_upon_arrival'.tr }));
  const products = [...(state.products || [])];
  if (item.productId && !products.some(product => product.id === item.productId)) products.unshift({ id: item.productId, name: item.requestedName });
  for (const product of products) select.append(element('option', { value: product.id, text: product.name }));
  select.value = item.productId || ''; select.required = required;
  return { wrapper: element('label', {}, [document.createTextNode(required ? `${'product_for'.tr} ${item.requestedName}` : 'catalog_product'.tr), select]), input: select };
}

function totals(totalMinor, depositMinor, { paid = false, completed = false } = {}) {
  const group = element('dl', { class: 'procurement-totals', 'aria-label': 'order_values'.tr });
  const values = [["total_112398".tr, totalMinor], [paid ? 'Sinal recebido' : 'message_50_down_payment'.tr, depositMinor], [completed ? 'Saldo recebido' : 'upon_pickup_delivery'.tr, totalMinor === null ? null : totalMinor - depositMinor]];
  for (const [label, value] of values) group.append(element('div', {}, [element('dt', { text: label }), element('dd', { text: value === null ? 'A cotar' : money(value) })]));
  return group;
}

function progress(request) {
  const current = closed(request) ? 4 : request.requestStatus === 'AWAITING_ARRIVAL' ? request.deposit ? 2 : 1
    : ['READY', 'READY_PICKUP', 'AWAITING_DRIVER'].includes(request.requestStatus) ? 3 : 0;
  const steps = element('ol', { class: 'procurement-steps', 'aria-label': 'order_steps'.tr });
  ['quote'.tr, 'Sinal', 'Chegada', 'delivery_pickup'.tr].forEach((label, index) => {
    steps.append(element('li', { class: index < current ? 'is-done' : index === current ? 'is-current' : '', ...(index === current ? { 'aria-current': 'step' } : {}) },
      [element('span', { class: 'procurement-step-dot', text: String(index + 1), 'aria-hidden': 'true' }), document.createTextNode(label)]));
  });
  return steps;
}

function heading(form, title, hint) {
  form.append(element('div', { class: 'procurement-form-heading' }, [element('h4', { text: title }), element('p', { text: hint })]));
}

function quoteForm(request, state, save) {
  const form = element('form', { class: 'procurement-form' });
  heading(form, 'Cotar itens', 'fill_in_the_price_and_arrival_date_for_each_item'.tr);
  const rows = request.items.map((item, index) => {
    const group = element('fieldset', { class: 'procurement-item-fields' });
    group.append(element('legend', { text: quantityLabel(item) }));
    const price = inputField(item.unit === 'KG' ? 'price_per_kg_r'.tr : 'unit_price_r'.tr, 'price-' + index, item.unitPriceMinor ? item.unitPriceMinor / 100 : '', 'number');
    const amount = price.querySelector('input'); Object.assign(amount, { required: true, min: '0.01', step: '0.01' });
    amount.setAttribute('inputmode', 'decimal'); amount.setAttribute('aria-label', `${'unit_price_of'.tr} ${item.requestedName} (R$)`);
    const date = inputField('arrival_date'.tr, 'arrival-' + index, item.arrivalDate || '', 'date');
    const arrival = date.querySelector('input'); arrival.required = true; arrival.setAttribute('aria-label', `${'item_arrival_date'.tr} ${item.requestedName}`);
    const product = productField(state, item, index);
    const optional = element('details', { class: 'procurement-optional' }, [element('summary', { text: 'link_catalog_product_optional'.tr }), product.wrapper]);
    group.append(element('div', { class: 'procurement-field-grid' }, [price, date]), optional); form.append(group);
    return { amount, arrival, product: product.input, quantity: item.quantity };
  });
  const preview = element('div', { class: 'procurement-preview' }); form.append(preview);
  const updatePreview = () => {
    const valid = rows.every(row => Number(row.amount.value) > 0);
    const total = valid ? rows.reduce((sum, row) => sum + Math.round(Math.round(Number(row.amount.value) * 100) * row.quantity), 0) : null;
    preview.replaceChildren(totals(total, total === null ? null : Math.ceil(total / 2)));
  };
  form.addEventListener('input', updatePreview); updatePreview();
  const checks = element('div', { class: 'procurement-checks' }); form.append(checks);
  const confirmed = check(checks, 'i_checked_the_values_and_dates'.tr, 'confirmed', 'values_and_dates_confirmed_with_the_manager_or_supplier'.tr);
  const legal = check(checks, 'i_checked_the_permitted_commercialization'.tr, 'legal', 'permitted_commercialization_checked'.tr);
  action(form, 'send_quote'.tr, 'confirm_quote_and_consult_customer'.tr, () => save(request, 'cotacao', { confirmed: confirmed.checked,
    commercializationAllowed: legal.checked, items: rows.map(row => ({ unitPriceMinor: Math.round(Number(row.amount.value) * 100), arrivalDate: row.arrival.value, productId: row.product.value || null })) }));
  return form;
}

function depositForm(request, save) {
  const form = element('form', { class: 'procurement-form' });
  heading(form, `Receber sinal · ${money(request.depositRequiredMinor)}`, 'confirm_only_after_checking_receipt'.tr);
  const method = element('select', { name: 'method', 'aria-label': 'down_payment_method'.tr });
  for (const [code, label] of [['DINHEIRO', 'cart_cash_option'.tr], ['DEBITO', 'cart_debit_option'.tr], ['CREDITO', 'cart_card_option'.tr], ["PIX", 'Pix recebido']]) method.append(element('option', { value: code, text: label }));
  form.append(element('label', {}, [document.createTextNode('cart_payment_title'.tr), method]));
  const pix = element('div', { class: 'procurement-proof', hidden: '' });
  const upload = element('input', { type: 'file', hidden: '', accept: 'image/jpeg,image/png,image/webp,application/pdf', 'aria-label': 'pix_down_payment_receipt'.tr });
  const uploadButton = button({ text: 'attach_receipt'.tr, onClick: () => upload.click() });
  const uploadStatus = element('p', { class: 'procurement-hint', role: 'status', text: 'photo_or_pdf_up_to_3_mb'.tr });
  const note = inputField('verification_note'.tr, 'note', '');
  const noteInput = note.querySelector('input'); noteInput.setAttribute('aria-label', 'pix_down_payment_verification_note'.tr);
  pix.append(upload, uploadButton, uploadStatus, note);
  const proofSeen = check(pix, 'i_verified_the_credit_in_the_account'.tr, 'proofSeen', 'i_verified_the_amount_credited_to_conflora_s_account'.tr);
  let proofId = '', uploading = false, sync = () => {};
  upload.addEventListener('change', async () => {
    const file = upload.files[0]; proofId = ''; if (!file) { uploadStatus.textContent = 'photo_or_pdf_up_to_3_mb'.tr; sync(); return; }
    uploading = true; uploadButton.disabled = true; uploadStatus.textContent = 'attaching_receipt'.tr; sync();
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error('receipt_limit_3_mb'.tr);
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('could_not_read_the_receipt'.tr)); reader.readAsDataURL(file); });
      const result = await api('/api/caixa/payment-proofs', { targetType: 'ORDER', targetId: request.id, dataUrl, fileName: file.name });
      proofId = result.id; uploadStatus.textContent = `Comprovante anexado. ${file.name}`;
    } catch (error) { uploadStatus.textContent = error.message; }
    finally { uploading = false; uploadButton.disabled = false; sync(); }
  });
  form.append(pix);
  const checks = element('div', { class: 'procurement-checks' }); form.append(checks);
  const received = check(checks, `${'i_received_the_down_payment_of'.tr} ${money(request.depositRequiredMinor)}.`, 'received', 'i_checked_the_actual_receipt_of_the_down_payment'.tr);
  const chooseMethod = () => { const isPix = method.value === 'PIX'; pix.hidden = !isPix; proofSeen.required = isPix; noteInput.required = isPix; noteInput.minLength = isPix ? 8 : 0; sync(); };
  method.addEventListener('change', chooseMethod);
  sync = action(form, 'confirm_down_payment'.tr, 'confirm_down_payment_receipt'.tr, () => save(request, 'sinal', { received: received.checked,
    amountMinor: request.depositRequiredMinor, paymentMethod: method.value, proofSeen: proofSeen.checked, proofId, note: noteInput.value }),
    () => method.value !== 'PIX' || Boolean(proofId && !uploading && proofSeen.checked && noteInput.value.trim().length >= 8));
  chooseMethod(); return form;
}

function arrivalForm(request, state, save) {
  const form = element('form', { class: 'procurement-form' });
  heading(form, 'confirm_arrival'.tr, 'check_the_items_and_register_the_stock_entry_before_continuing'.tr);
  const rows = request.items.map((item, index) => { const row = productField(state, item, index, true); form.append(row.wrapper); return row.input; });
  const checks = element('div', { class: 'procurement-checks' }); form.append(checks);
  const arrived = check(checks, 'all_items_have_arrived_and_been_checked'.tr, 'arrived', 'all_items_have_arrived_and_been_checked_d02cf5'.tr);
  action(form, 'confirm_arrival'.tr, 'confirm_arrival_and_notify_customer'.tr, () => save(request, 'chegada', { confirmed: arrived.checked, items: rows.map(row => ({ productId: row.value })) }));
  return form;
}

function details(request, state, save) {
  const body = element('div', { class: 'procurement-body' }); body.append(progress(request));
  if (['AWAITING_QUOTE', 'FORECAST_CONFIRMED'].includes(request.requestStatus)) body.append(quoteForm(request, state, save));
  else if (request.requestStatus === 'AWAITING_CUSTOMER') {
    const waiting = element('div', { class: 'procurement-waiting' }, [element('p', { text: 'quote_ready_wait_for_customer_acceptance'.tr })]);
    waiting.append(button({ text: 'edit_quote'.tr, onClick: () => waiting.replaceWith(quoteForm(request, state, save)) })); body.append(waiting);
  } else if (request.requestStatus === 'AWAITING_ARRIVAL') body.append(request.deposit ? arrivalForm(request, state, save) : depositForm(request, save));
  else {
    const hints = { READY: 'arrival_confirmed_wait_for_the_customer_to_choose_delivery_or_pickup'.tr, READY_PICKUP: 'the_customer_chose_store_pickup_receive_the_balance_at_the_cash_register'.tr,
      AWAITING_DRIVER: 'address_confirmed_track_delivery_and_balance_at_the_cash_register'.tr, COMPLETED: 'receipt_completed'.tr, DECLINED: 'the_customer_did_not_confirm_the_order'.tr };
    body.append(element('p', { class: 'procurement-hint', text: hints[request.requestStatus] || 'track_the_order_progress'.tr }));
    if (['READY_PICKUP', 'AWAITING_DRIVER', 'COMPLETED'].includes(request.requestStatus)) body.append(button({ text: 'open_cash_register_and_deliveries'.tr, href: '/pdv', variant: closed(request) ? 'secondary' : 'primary' }));
  }
  return body;
}

export async function renderProcurements(panel, state, view = {}) {
  const { requests } = await api('/api/caixa/encomendas');
  panel.classList.add('procurement-panel');
  const root = element('div', { class: 'procurement-workspace' });
  const title = element('div', {}, [element('h2', { text: 'orders_9d78f6'.tr }), element('p', { class: 'procurement-hint', text: 'check_the_order_and_complete_the_next_step'.tr })]);
  const refresh = button({ text: 'refresh'.tr, attributes: { 'aria-label': 'Atualizar encomendas' }, onClick: async () => {
    refresh.disabled = true;
    try { await renderProcurements(panel, state, view); } catch (error) { notify(error.message); refresh.disabled = false; }
  } });
  root.append(element('header', { class: 'procurement-toolbar' }, [title, refresh]));
  const search = element('input', { type: 'search', placeholder: 'search_customer_or_item'.tr, 'aria-label': 'search_orders'.tr, value: view.search || '' });
  const filter = element('select', { 'aria-label': 'Mostrar encomendas' });
  for (const [value, text] of [['active', 'in_progress'.tr], ['closed', 'Finalizadas'], ['all', 'all'.tr]]) filter.append(element('option', { value, text }));
  filter.value = view.filter || 'active';
  root.append(element('div', { class: 'procurement-filters' }, [search, filter]));
  const list = element('div', { class: 'procurement-list' }); root.append(list);
  const save = async (request, route, data) => {
    await api(`/api/caixa/encomendas/${request.id}/${route}`, { version: request.version, ...data });
    notify('order_saved_customer_notice_forwarded_for_sending'.tr);
    await renderProcurements(panel, state, { ...view, selectedId: request.id });
  };
  const sorted = [...requests].sort((left, right) => Number(closed(left)) - Number(closed(right)) || String(right.createdAt).localeCompare(String(left.createdAt)));
  if (view.selectedId === undefined) view.selectedId = sorted.find(request => !closed(request))?.id || null;
  const cards = new Map();
  const draw = () => {
    view.filter = filter.value; view.search = search.value;
    const query = search.value.trim().toLocaleLowerCase('pt-BR');
    const visible = sorted.filter(request => (filter.value === 'all' || closed(request) === (filter.value === 'closed')) &&
      (!query || [request.customerName, request.customerPhone, request.id, ...request.items.map(item => item.requestedName)].join(' ').toLocaleLowerCase('pt-BR').includes(query)));
    list.replaceChildren();
    if (!visible.length) list.append(element('p', { class: 'procurement-empty', role: 'status', text: requests.length ? 'Nenhuma encomenda neste filtro.' : 'Nenhuma encomenda registrada.' }));
    for (const request of visible) {
      let cached = cards.get(request.id);
      if (!cached) {
      const card = element('cf-card', { padding: 'md', class: 'procurement-card', 'data-request-id': request.id });
      const status = element('span', { class: 'procurement-status' + (closed(request) ? ' is-closed' : ''), text: labels[request.requestStatus] || 'in_progress'.tr });
      const customer = element('div', { class: 'procurement-customer' }, [element('small', { text: 'Comanda #' + request.id.slice(-8).toUpperCase() }),
        element('h3', { text: request.customerName || 'customer'.tr }), element('p', { text: request.customerPhone })]);
      card.append(element('header', { class: 'procurement-card-heading' }, [customer, status]));
      const items = element('ul', { class: 'procurement-items' });
      for (const item of request.items) items.append(element('li', {}, [element('span', { text: quantityLabel(item) }),
        element('small', { text: [item.arrivalDate ? 'Chegada ' + dateLabel(item.arrivalDate) : '', item.unitPriceMinor ? money(item.unitPriceMinor) + (item.unit === 'KG' ? '/kg' : '/un.') : ''].filter(Boolean).join(' · ') })]));
      card.append(items);
      const total = Number.isSafeInteger(request.totalMinor) ? request.totalMinor : request.total === null || request.total === undefined ? null : Math.round(request.total * 100);
      card.append(totals(total, request.deposit?.amountMinor ?? request.depositRequiredMinor ?? null, { paid: Boolean(request.deposit), completed: request.requestStatus === 'COMPLETED' }));
      const bodyId = 'procurement-body-' + request.id;
      const toggle = button({ text: 'open_ticket'.tr, variant: 'quiet', attributes: { 'aria-expanded': 'false', 'aria-controls': bodyId },
        onClick: () => { view.selectedId = view.selectedId === request.id ? null : request.id; draw(); list.querySelector(`[data-request-id="${request.id}"] [aria-expanded]`)?.focus({ preventScroll: true }); } });
      card.append(element('div', { class: 'procurement-card-toggle' }, [toggle]));
      const body = element('div', { id: bodyId, hidden: '' }); card.append(body);
      cached = { card, body, toggle, loaded: false }; cards.set(request.id, cached);
      }
      const expanded = request.id === view.selectedId;
      cached.toggle.setAttribute('aria-expanded', String(expanded));
      cached.toggle.querySelector('.cf-btn-3d__text').textContent = expanded ? 'collapse_ticket'.tr : 'open_ticket'.tr;
      if (expanded && !cached.loaded) { cached.body.append(details(request, state, save)); cached.loaded = true; }
      cached.body.hidden = !expanded;
      list.append(cached.card);
    }
  };
  search.addEventListener('input', draw); filter.addEventListener('change', draw); draw();
  panel.replaceChildren(root);
}
