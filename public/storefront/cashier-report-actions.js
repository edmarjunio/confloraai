(() => {
  class CashierReportActions extends HTMLElement {
    static get observedAttributes() { return ['scope-label']; }
    attributeChangedCallback() {
      const hint = this.querySelector('div p');
      if (hint) hint.textContent = (this.getAttribute('scope-label') || 'payments_so_far'.tr) + '. Envio para o WhatsApp da loja.';
    }
    connectedCallback() {
      if (this.childElementCount) return;
      this.className = 'cashier-report-actions';
      const description = document.createElement('div');
      const title = document.createElement('strong'); title.textContent = 'cashier_report'.tr;
      const hint = document.createElement('p'); hint.textContent = (this.getAttribute('scope-label') || 'payments_so_far'.tr) + '. Envio para o WhatsApp da loja.';
      description.append(title, hint);
      const actions = document.createElement('div'); actions.className = 'cashier-report-buttons';
      for (const [label, action] of [['Baixar PDF', 'download'], ['send_pdf_on_whatsapp'.tr, 'send']]) {
        const button = document.createElement('button'); button.type = 'button';
        button.className = 'cf-button'; button.dataset.variant = action === 'download' ? 'secondary' : 'primary';
        button.textContent = label; button.onclick = () => this.run(action); actions.appendChild(button);
      }
      this.message = document.createElement('p'); this.message.setAttribute('role', 'status'); this.message.setAttribute('aria-live', 'polite');
      this.message.className = 'cashier-report-status';
      this.append(description, actions, this.message);
    }
    async run(action) {
      if (this.busy) return;
      this.busy = true;
      this.querySelectorAll('button').forEach(button => { button.disabled = true; });
      this.message.textContent = action === 'download' ? 'preparing_pdf'.tr : 'sending_pdf'.tr;
      const params = Object.fromEntries(['from', 'to'].map(key => [key, this.getAttribute(key)]).filter(([, value]) => value));
      try {
        const response = await window.ConfloraSession.apiFetch(action === 'download' ? '/api/caixa/report.pdf?' + new URLSearchParams(params) : '/api/caixa/report/send-whatsapp', action === 'send' ? {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
        } : {});
        if (!response.ok) {
          const data = await response.json(); throw new Error(data.error || 'could_not_generate_the_report'.tr);
        }
        if (action === 'download') {
          const url = URL.createObjectURL(await response.blob());
          const link = document.createElement('a'); link.href = url; link.download = 'cashier_report_pdf'.tr; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 60000);
          this.message.textContent = 'pdf_ready_to_download'.tr;
        } else this.message.textContent = (await response.json()).message;
      } catch (error) {
        this.message.textContent = error instanceof TypeError ? 'connection_failure_please_try_again'.tr : error.message;
      } finally {
        this.busy = false;
        this.querySelectorAll('button').forEach(button => { button.disabled = false; });
      }
    }
  }
  if (!customElements.get('cashier-report-actions')) customElements.define('cashier-report-actions', CashierReportActions);
})();
