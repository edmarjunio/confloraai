(() => {
  class CashierReportActions extends HTMLElement {
    static get observedAttributes() { return ['scope-label']; }
    attributeChangedCallback() {
      const hint = this.querySelector('div p');
      if (hint) hint.textContent = (this.getAttribute('scope-label') || 'Recebimentos até agora') + '. Envio para o WhatsApp da loja.';
    }
    connectedCallback() {
      if (this.childElementCount) return;
      this.className = 'cashier-report-actions';
      const description = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = 'Relatório do caixa';
      const hint = document.createElement('p'); hint.textContent = (this.getAttribute('scope-label') || 'Recebimentos até agora') + '. Envio para o WhatsApp da loja.';
      description.append(title, hint);
      const actions = document.createElement('div'); actions.className = 'cashier-report-buttons';
      for (const [label, action] of [['FECHAR CAIXA', 'close'], ['Baixar PDF', 'download'], ['Enviar PDF no WhatsApp', 'send']]) {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'cf-button'; button.dataset.variant = action === 'download' ? 'secondary' : 'primary';
        button.textContent = label; button.onclick = () => this.run(action); actions.appendChild(button);
      }
      this.message = document.createElement('p'); this.message.setAttribute('role', 'status'); this.message.setAttribute('aria-live', 'polite');
      this.message.className = 'cashier-report-status';
      this.append(description, actions, this.message);
    }
    async run(action) {
      if (action === 'close') return window.openCashierClosing(this.getAttribute('to'));
      if (this.busy) return;
      this.busy = true;
      this.querySelectorAll('button').forEach(button => { button.disabled = true; });
      this.message.textContent = action === 'download' ? 'Preparando PDF…' : 'Enviando PDF…';
      const params = Object.fromEntries(['from', 'to'].map(key => [key, this.getAttribute(key)]).filter(([, value]) => value));
      try {
        const response = await window.ConfloraSession.apiFetch(action === 'download' ? '/api/caixa/report.pdf?' + new URLSearchParams(params) : '/api/caixa/report/send-whatsapp', action === 'send' ? {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
        } : {});
        if (!response.ok) {
          const data = await response.json(); throw new Error(data.error || 'Não foi possível gerar o relatório.');
        }
        if (action === 'download') {
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement('a'); link.href = url; link.download = 'relatorio-caixa.pdf'; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          this.message.textContent = 'PDF pronto para baixar.';
        } else this.message.textContent = (await response.json()).message;
      } catch (error) {
        this.message.textContent = error instanceof TypeError ? 'Falha de conexão. Tente novamente.' : error.message;
      } finally {
        this.busy = false;
        this.querySelectorAll('button').forEach(button => { button.disabled = false; });
      }
    }
  }
  if (!customElements.get('cashier-report-actions')) customElements.define('cashier-report-actions', CashierReportActions);
})();

(() => {
  const money = value => Number(value || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
  const methods = { DINHEIRO:'Dinheiro', PIX:'Pix', CREDITO:'Cartão de crédito', DEBITO:'Cartão de débito' };
  window.openCashierClosing = async date => {
    if (document.getElementById('cashierClosingDialog')) return;
    date ||= new Intl.DateTimeFormat('en-CA', {timeZone:'America/Sao_Paulo'}).format(new Date());
    const dialog = document.createElement('dialog'); dialog.id = 'cashierClosingDialog';
    dialog.style.cssText = 'width:min(620px,calc(100vw - 24px));max-height:90dvh;overflow:auto;overscroll-behavior:contain;border:0;border-radius:22px;padding:24px;color:#16381f;background:white;box-shadow:0 24px 80px #0005';
    dialog.innerHTML = '<form><div data-header style="display:flex;justify-content:space-between;gap:16px"><div><h2 style="margin:0">Fechar caixa</h2><p>Confira → confirme → anexe o relatório</p></div><button type="button" data-close style="border:0;border-radius:50%;background:#f1f5f9;width:36px;height:36px;flex-shrink:0;cursor:pointer" aria-label="Fechar">✕</button></div><p data-status role="status">Carregando valores…</p><label>Caixa de <select data-cashier style="width:100%;padding:12px;margin:8px 0"></select></label><div data-values></div><section data-proof hidden><h3>Foto do relatório do dia</h3><p>Fotografe a tela de relatório diário da maquininha. A foto ficará vinculada ao fechamento.</p><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment"><img data-preview alt="Prévia do relatório" hidden style="max-width:100%;max-height:180px;object-fit:contain"></section><p data-warning>Esta operação não poderá ser desfeita. Após fechar, não será possível registrar novos recebimentos neste caixa hoje.</p><div data-actions style="display:flex;gap:12px;margin-top:20px"><button type="button" data-cancel style="border:1px solid #cbd5e1;border-radius:12px;padding:12px;background:white;cursor:pointer">Cancelar</button><button type="submit" data-submit style="background:#15803d;color:white;border:0;border-radius:12px;padding:14px 22px;font-weight:800">Conferir e continuar</button></div></form>';
    document.body.append(dialog); dialog.showModal();
    const oldOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    let previewUrl;
    dialog.addEventListener('close', () => { document.body.style.overflow = oldOverflow; if(previewUrl) URL.revokeObjectURL(previewUrl); dialog.remove(); });
    dialog.querySelector('[data-close]').onclick = dialog.querySelector('[data-cancel]').onclick = () => dialog.close();
    const status = dialog.querySelector('[data-status]'), select = dialog.querySelector('select'), submit = dialog.querySelector('[data-submit]');
    let rows = [], step = 1, busy = false;
    const paint = () => {
      const row = rows.find(r => r.id === select.value);
      const values = dialog.querySelector('[data-values]'); values.replaceChildren(); step = 1;
      dialog.querySelector('[data-proof]').hidden = true;
      submit.textContent = 'Conferir e continuar'; submit.disabled = !row || Boolean(row.closing) || row.pendingReceipts;
      status.textContent = row?.closing ? '✓ Caixa fechado. Os valores estão registrados e não podem ser alterados.' : 'Data: ' + date.split('-').reverse().join('/') + '. Informe o que você conferiu, mesmo quando for zero.';
      if(row?.pendingReceipts) status.textContent = 'Há pagamentos parciais pendentes. Finalize ou concilie esses pedidos antes de fechar.';
      for (const [key,label] of Object.entries(methods)) {
        const field = document.createElement('label'); field.style.cssText = 'display:grid;grid-template-columns:1fr 140px;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid #e2e8f0';
        const text = document.createElement('span'); text.textContent = label + ' · Sistema: ' + money(row?.expected[key]);
        const input = document.createElement('input'); input.name = key; input.type = 'number'; input.step = '0.01'; input.min = '0'; input.required = true; input.placeholder = 'Conferido R$'; input.setAttribute('aria-label', label + ' conferido'); input.style.cssText = 'width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:10px';
        if(row?.closing) { input.value = row.closing.counted[key]; input.disabled = true; }
        field.append(text,input); values.append(field);
      }
    };
    try {
      const response = await window.ConfloraSession.apiFetch('/api/caixa/closing?date=' + encodeURIComponent(date));
      const data = await response.json(); if(!response.ok) throw new Error(data.error);
      rows = data.cashiers;
      for(const row of rows) { const option = document.createElement('option'); option.value = row.id; option.textContent = row.name + (row.closing ? ' · Fechado' : ' · Aberto'); select.append(option); }
      select.onchange = paint; paint();
    } catch(error) { status.textContent = error.message; submit.disabled = true; }
    const fileInput = dialog.querySelector('input[type=file]');
    fileInput.onchange = () => { if(previewUrl) URL.revokeObjectURL(previewUrl); const file = fileInput.files[0]; const image = dialog.querySelector('[data-preview]'); image.hidden = !file; if(file) { previewUrl = URL.createObjectURL(file); image.src = previewUrl; } };
    dialog.querySelector('form').onsubmit = async event => {
      event.preventDefault(); if(busy) return;
      if(step === 1) {
        if(!window.confirm('Deseja fechar este caixa? Esta operação não poderá ser desfeita. Para concluir, anexe a foto do relatório diário da maquininha.')) return;
        step = 2; select.disabled = true; dialog.querySelector('[data-values]').hidden = true; dialog.querySelectorAll('[data-values] input').forEach(input => input.readOnly = true);
        dialog.querySelector('[data-proof]').hidden = false; fileInput.required = true; submit.textContent = 'Anexar foto e finalizar fechamento'; status.textContent = 'Última etapa: comprove os valores do dia.'; fileInput.focus(); return;
      }
      const file = fileInput.files[0];
      if(!file || file.size > 3*1024*1024) { status.textContent = 'Escolha uma foto de até 3 MB.'; return; }
      busy = true; submit.disabled = true; status.textContent = 'Registrando fechamento…';
      try {
        const proofDataUrl = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
        const counted = Object.fromEntries(Object.keys(methods).map(key => [key,Number(dialog.querySelector('[name='+key+']').value)]));
        const response = await window.ConfloraSession.apiFetch('/api/caixa/closing', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date,cashierId:select.value,counted,expected:rows.find(r=>r.id===select.value).expected,proofDataUrl})});
        const data = await response.json(); if(!response.ok) throw new Error(data.error || 'Falha ao fechar caixa.');
        status.textContent = data.allClosed ? '✓ Todos os caixas fechados. Resumo na fila de envio para o WhatsApp do Júnior.' : '✓ Caixa fechado. O resumo será enviado ao Júnior quando todos os caixas forem finalizados.';
        window.dispatchEvent(new window.Event('cashier-closed'));
        submit.hidden = true; dialog.querySelector('[data-proof]').hidden = true; dialog.querySelector('[data-warning]').hidden = true; dialog.querySelector('[data-cancel]').textContent = 'Concluir';
      } catch(error) { status.textContent = error.message; submit.disabled = false; } finally { busy = false; }
    };
  };
})();
