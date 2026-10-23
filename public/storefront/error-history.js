(() => {
  let cursor = null;
  let loading = false;
  async function load({ more = false } = {}) {
    const list = document.getElementById('errorHistoryList');
    const status = document.getElementById('errorHistoryStatus');
    const next = document.getElementById('errorHistoryMore');
    if (!list || loading) return;
    loading = true; status.textContent = 'loading_history'.tr;
    try {
      const response = await window.ConfloraSession.apiFetch('/api/admin/errors' + (more && cursor ? '?before=' + encodeURIComponent(cursor) : ''));
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'history_unavailable'.tr);
      if (!more) list.replaceChildren();
      for (const entry of data.entries) {
        const card = document.createElement('details'); card.className = 'cf-error-entry';
        const summary = document.createElement('summary');
        const time = new Date(entry.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        summary.textContent = `${time} · ${entry.source || 'SERVIDOR'} · ${entry.message || 'error_logged'.tr}`;
        const details = document.createElement('pre');
        details.textContent = JSON.stringify(entry, null, 2);
        card.append(summary, details); list.append(card);
      }
      cursor = data.nextCursor; next.hidden = !cursor;
      status.textContent = data.warning || (!list.children.length ? 'no_errors_logged_keep_it_up'.tr : 'history_updated_click_on_a_record_to_view_details'.tr);
    } catch (error) { status.textContent = error.message; }
    finally { loading = false; }
  }
  document.addEventListener('click', event => {
    if (event.target.closest('#errorHistoryRefresh')) load();
    if (event.target.closest('#errorHistoryMore')) load({ more: true });
  });
  window.ConfloraErrorHistory = { load };
  document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('tab-status')?.classList.contains('active')) load(); });
})();
