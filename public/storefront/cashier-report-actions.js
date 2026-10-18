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
      for (const [label, action] of [['Baixar PDF', 'download'], ['Enviar PDF no WhatsApp', 'send']]) {
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
      this.message.textContent = action === 'download' ? 'Preparando PDF…' : 'Enviando PDF…';
      const params = Object.fromEntries(['from', 'to'].map(key => [key, this.getAttribute(key)]).filter(([, value]) => value));
      try {
        const response = await window.fetch(action === 'download' ? '/api/caixa/report.pdf?' + new URLSearchParams(params) : '/api/caixa/report/send-whatsapp', action === 'send' ? {
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
