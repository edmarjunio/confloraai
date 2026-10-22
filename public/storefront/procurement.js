import { element, inputField, notify, money, readJsonResponse } from './ui.js';

const labels = { AWAITING_QUOTE: 'Aguardando cotação', FORECAST_CONFIRMED: 'Aguardando cotação', AWAITING_CUSTOMER: 'Aguardando aceite do cliente',
  AWAITING_ARRIVAL: 'Aguardando chegada', READY: 'Disponível: aguardando entrega ou retirada', READY_PICKUP: 'Aguardando retirada',
  AWAITING_DRIVER: 'Aguardando entregador', COMPLETED: 'Finalizada', DECLINED: 'Não confirmada' };
const closed = request => request.status === 'closed' || ['COMPLETED', 'DECLINED'].includes(request.requestStatus);
const button = options => window.createButton3D({ variant: 'secondary', size: 'md', ...options });
const dateLabel = date => date?.split('-').reverse().join('/') || '';
const quantityLabel = item => `${item.quantity} ${item.requestedName}${item.unit === 'KG' ? ' (kg)' : ''}`;

async function api(path, body) {
  const response = await window.ConfloraSession.apiFetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await readJsonResponse(response);
  if (!response.ok) throw new Error(data.error || 'Não foi possível atualizar a encomenda.');
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
    const caption = submitButton.querySelector('.cf-btn-3d__text'); caption.textContent = 'Salvando…';
    try { await submit(); }
    catch (failure) { error.textContent = failure.message; error.hidden = false; }
    finally { form.removeAttribute('aria-busy'); caption.textContent = text; sync(); }
  });
  sync(); return sync;
}

function productField(state, item, index, required = false) {
  const select = element('select', { name: 'product-' + index, 'aria-label': `Produto cadastrado para ${item.requestedName}` });
  select.append(element('option', { value: '', text: required ? 'Selecione o produto' : 'Vincular na chegada' }));
  const products = [...(state.products || [])];
  if (item.productId && !products.some(product => product.id === item.productId)) products.unshift({ id: item.productId, name: item.requestedName });
  for (const product of products) select.append(element('option', { value: product.id, text: product.name }));
  select.value = item.productId || ''; select.required = required;
  return { wrapper: element('label', {}, [document.createTextNode(required ? `Produto para ${item.requestedName}` : 'Produto do catálogo'), select]), input: select };
}

function totals(totalMinor, depositMinor, { paid = false, completed = false } = {}) {
  const group = element('dl', { class: 'procurement-totals', 'aria-label': 'Valores da comanda' });
  const values = [['Total', totalMinor], [paid ? 'Sinal recebido' : 'Sinal de 50%', depositMinor], [completed ? 'Saldo recebido' : 'Na retirada/entrega', totalMinor === null ? null : totalMinor - depositMinor]];
  for (const [label, value] of values) group.append(element('div', {}, [element('dt', { text: label }), element('dd', { text: value === null ? 'A cotar' : money(value) })]));
  return group;
}

function progress(request) {
  const current = closed(request) ? 4 : request.requestStatus === 'AWAITING_ARRIVAL' ? request.deposit ? 2 : 1
    : ['READY', 'READY_PICKUP', 'AWAITING_DRIVER'].includes(request.requestStatus) ? 3 : 0;
  const steps = element('ol', { class: 'procurement-steps', 'aria-label': 'Etapas da encomenda' });
  ['Cotação', 'Sinal', 'Chegada', 'Entrega/retirada'].forEach((label, index) => {
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
  heading(form, 'Cotar itens', 'Preencha o valor e a data de chegada de cada item.');
  const rows = request.items.map((item, index) => {
    const group = element('fieldset', { class: 'procurement-item-fields' });
    group.append(element('legend', { text: quantityLabel(item) }));
    const price = inputField(item.unit === 'KG' ? 'Valor por kg (R$)' : 'Valor unitário (R$)', 'price-' + index, item.unitPriceMinor ? item.unitPriceMinor / 100 : '', 'number');
    const amount = price.querySelector('input'); Object.assign(amount, { required: true, min: '0.01', step: '0.01' });
    amount.setAttribute('inputmode', 'decimal'); amount.setAttribute('aria-label', `Valor unitário de ${item.requestedName} (R$)`);
    const date = inputField('Data de chegada', 'arrival-' + index, item.arrivalDate || '', 'date');
    const arrival = date.querySelector('input'); arrival.required = true; arrival.setAttribute('aria-label', `Data da chegada do item: ${item.requestedName}`);
    const product = productField(state, item, index);
    const optional = element('details', { class: 'procurement-optional' }, [element('summary', { text: 'Vincular produto do catálogo (opcional)' }), product.wrapper]);
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
  const confirmed = check(checks, 'Conferi os valores e as datas.', 'confirmed', 'Valores e datas confirmados com o responsável ou fornecedor');
  const legal = check(checks, 'Conferi a comercialização permitida.', 'legal', 'Comercialização permitida conferida');
  action(form, 'Enviar cotação', 'Confirmar cotação e consultar cliente', () => save(request, 'cotacao', { confirmed: confirmed.checked,
    commercializationAllowed: legal.checked, items: rows.map(row => ({ unitPriceMinor: Math.round(Number(row.amount.value) * 100), arrivalDate: row.arrival.value, productId: row.product.value || null })) }));
  return form;
}

function depositForm(request, save) {
  const form = element('form', { class: 'procurement-form' });
  heading(form, `Receber sinal · ${money(request.depositRequiredMinor)}`, 'Confirme apenas depois de conferir o recebimento.');
  const method = element('select', { name: 'method', 'aria-label': 'Forma de pagamento do sinal' });
  for (const [code, label] of [['DINHEIRO', 'Dinheiro'], ['DEBITO', 'Cartão de débito'], ['CREDITO', 'Cartão de crédito'], ['PIX', 'Pix recebido']]) method.append(element('option', { value: code, text: label }));
  form.append(element('label', {}, [document.createTextNode('Forma de pagamento'), method]));
  const pix = element('div', { class: 'procurement-proof', hidden: '' });
  const upload = element('input', { type: 'file', hidden: '', accept: 'image/jpeg,image/png,image/webp,application/pdf', 'aria-label': 'Comprovante do sinal Pix' });
  const uploadButton = button({ text: 'Anexar comprovante', onClick: () => upload.click() });
  const uploadStatus = element('p', { class: 'procurement-hint', role: 'status', text: 'Foto ou PDF, até 3 MB.' });
  const note = inputField('Observação da conferência', 'note', '');
  const noteInput = note.querySelector('input'); noteInput.setAttribute('aria-label', 'Observação da conferência do sinal Pix');
  pix.append(upload, uploadButton, uploadStatus, note);
  const proofSeen = check(pix, 'Conferi o crédito na conta.', 'proofSeen', 'Conferi o valor creditado na conta da Conflora');
  let proofId = '', uploading = false, sync = () => {};
  upload.addEventListener('change', async () => {
    const file = upload.files[0]; proofId = ''; if (!file) { uploadStatus.textContent = 'Foto ou PDF, até 3 MB.'; sync(); return; }
    uploading = true; uploadButton.disabled = true; uploadStatus.textContent = 'Anexando comprovante…'; sync();
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error('Limite do comprovante: 3 MB.');
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Não foi possível ler o comprovante.')); reader.readAsDataURL(file); });
      const result = await api('/api/caixa/payment-proofs', { targetType: 'ORDER', targetId: request.id, dataUrl, fileName: file.name });
      proofId = result.id; uploadStatus.textContent = `Comprovante anexado. ${file.name}`;
    } catch (error) { uploadStatus.textContent = error.message; }
    finally { uploading = false; uploadButton.disabled = false; sync(); }
  });
  form.append(pix);
  const checks = element('div', { class: 'procurement-checks' }); form.append(checks);
  const received = check(checks, `Recebi o sinal de ${money(request.depositRequiredMinor)}.`, 'received', 'Conferi o recebimento efetivo do sinal');
  const chooseMethod = () => { const isPix = method.value === 'PIX'; pix.hidden = !isPix; proofSeen.required = isPix; noteInput.required = isPix; noteInput.minLength = isPix ? 8 : 0; sync(); };
  method.addEventListener('change', chooseMethod);
  sync = action(form, 'Confirmar sinal', 'Confirmar recebimento do sinal', () => save(request, 'sinal', { received: received.checked,
    amountMinor: request.depositRequiredMinor, paymentMethod: method.value, proofSeen: proofSeen.checked, proofId, note: noteInput.value }),
    () => method.value !== 'PIX' || Boolean(proofId && !uploading && proofSeen.checked && noteInput.value.trim().length >= 8));
  chooseMethod(); return form;
}

function arrivalForm(request, state, save) {
  const form = element('form', { class: 'procurement-form' });
  heading(form, 'Confirmar chegada', 'Confira os itens e registre a entrada no estoque antes de continuar.');
  const rows = request.items.map((item, index) => { const row = productField(state, item, index, true); form.append(row.wrapper); return row.input; });
  const checks = element('div', { class: 'procurement-checks' }); form.append(checks);
  const arrived = check(checks, 'Todos os itens chegaram e foram conferidos.', 'arrived', 'Todos os itens chegaram e foram conferidos');
  action(form, 'Confirmar chegada', 'Confirmar chegada e avisar cliente', () => save(request, 'chegada', { confirmed: arrived.checked, items: rows.map(row => ({ productId: row.value })) }));
  return form;
}

function details(request, state, save) {
  const body = element('div', { class: 'procurement-body' }); body.append(progress(request));
  if (['AWAITING_QUOTE', 'FORECAST_CONFIRMED'].includes(request.requestStatus)) body.append(quoteForm(request, state, save));
  else if (request.requestStatus === 'AWAITING_CUSTOMER') {
    const waiting = element('div', { class: 'procurement-waiting' }, [element('p', { text: 'Cotação pronta. Aguarde o aceite do cliente.' })]);
    waiting.append(button({ text: 'Editar cotação', onClick: () => waiting.replaceWith(quoteForm(request, state, save)) })); body.append(waiting);
  } else if (request.requestStatus === 'AWAITING_ARRIVAL') body.append(request.deposit ? arrivalForm(request, state, save) : depositForm(request, save));
  else {
    const hints = { READY: 'Chegada confirmada. Aguarde a escolha de entrega ou retirada pelo cliente.', READY_PICKUP: 'O cliente escolheu retirar na loja. Receba o saldo no caixa.',
      AWAITING_DRIVER: 'Endereço confirmado. Acompanhe a entrega e o saldo no caixa.', COMPLETED: 'Recebimento concluído.', DECLINED: 'O cliente não confirmou a encomenda.' };
    body.append(element('p', { class: 'procurement-hint', text: hints[request.requestStatus] || 'Acompanhe o andamento da comanda.' }));
    if (['READY_PICKUP', 'AWAITING_DRIVER', 'COMPLETED'].includes(request.requestStatus)) body.append(button({ text: 'Abrir caixa e entregas', href: '/pdv', variant: closed(request) ? 'secondary' : 'primary' }));
  }
  return body;
}

export async function renderProcurements(panel, state, view = {}) {
  const { requests } = await api('/api/caixa/encomendas');
  panel.classList.add('procurement-panel');
  const root = element('div', { class: 'procurement-workspace' });
  const title = element('div', {}, [element('h2', { text: 'Encomendas' }), element('p', { class: 'procurement-hint', text: 'Consulte a comanda e conclua a próxima etapa.' })]);
  const refresh = button({ text: 'Atualizar', attributes: { 'aria-label': 'Atualizar encomendas' }, onClick: async () => {
    refresh.disabled = true;
    try { await renderProcurements(panel, state, view); } catch (error) { notify(error.message); refresh.disabled = false; }
  } });
  root.append(element('header', { class: 'procurement-toolbar' }, [title, refresh]));
  const search = element('input', { type: 'search', placeholder: 'Buscar cliente ou item', 'aria-label': 'Buscar encomendas', value: view.search || '' });
  const filter = element('select', { 'aria-label': 'Mostrar encomendas' });
  for (const [value, text] of [['active', 'Em andamento'], ['closed', 'Finalizadas'], ['all', 'Todas']]) filter.append(element('option', { value, text }));
  filter.value = view.filter || 'active';
  root.append(element('div', { class: 'procurement-filters' }, [search, filter]));
  const list = element('div', { class: 'procurement-list' }); root.append(list);
  const save = async (request, route, data) => {
    await api(`/api/caixa/encomendas/${request.id}/${route}`, { version: request.version, ...data });
    notify('Comanda salva. Aviso ao cliente encaminhado para envio.');
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
      const status = element('span', { class: 'procurement-status' + (closed(request) ? ' is-closed' : ''), text: labels[request.requestStatus] || 'Em andamento' });
      const customer = element('div', { class: 'procurement-customer' }, [element('small', { text: 'Comanda #' + request.id.slice(-8).toUpperCase() }),
        element('h3', { text: request.customerName || 'Cliente' }), element('p', { text: request.customerPhone })]);
      card.append(element('header', { class: 'procurement-card-heading' }, [customer, status]));
      const items = element('ul', { class: 'procurement-items' });
      for (const item of request.items) items.append(element('li', {}, [element('span', { text: quantityLabel(item) }),
        element('small', { text: [item.arrivalDate ? 'Chegada ' + dateLabel(item.arrivalDate) : '', item.unitPriceMinor ? money(item.unitPriceMinor) + (item.unit === 'KG' ? '/kg' : '/un.') : ''].filter(Boolean).join(' · ') })]));
      card.append(items);
      const total = Number.isSafeInteger(request.totalMinor) ? request.totalMinor : request.total === null || request.total === undefined ? null : Math.round(request.total * 100);
      card.append(totals(total, request.deposit?.amountMinor ?? request.depositRequiredMinor ?? null, { paid: Boolean(request.deposit), completed: request.requestStatus === 'COMPLETED' }));
      const bodyId = 'procurement-body-' + request.id;
      const toggle = button({ text: 'Abrir comanda', variant: 'quiet', attributes: { 'aria-expanded': 'false', 'aria-controls': bodyId },
        onClick: () => { view.selectedId = view.selectedId === request.id ? null : request.id; draw(); list.querySelector(`[data-request-id="${request.id}"] [aria-expanded]`)?.focus({ preventScroll: true }); } });
      card.append(element('div', { class: 'procurement-card-toggle' }, [toggle]));
      const body = element('div', { id: bodyId, hidden: '' }); card.append(body);
      cached = { card, body, toggle, loaded: false }; cards.set(request.id, cached);
      }
      const expanded = request.id === view.selectedId;
      cached.toggle.setAttribute('aria-expanded', String(expanded));
      cached.toggle.querySelector('.cf-btn-3d__text').textContent = expanded ? 'Recolher comanda' : 'Abrir comanda';
      if (expanded && !cached.loaded) { cached.body.append(details(request, state, save)); cached.loaded = true; }
      cached.body.hidden = !expanded;
      list.append(cached.card);
    }
  };
  search.addEventListener('input', draw); filter.addEventListener('change', draw); draw();
  panel.replaceChildren(root);
}
