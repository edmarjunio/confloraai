(() => {
  const money = value => Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  async function open() {
    const dialog = document.createElement('dialog'); dialog.className = 'product-editor-dialog'; dialog.setAttribute('aria-label', 'Importar produtos por planilha');
    const heading = document.createElement('h2'); heading.textContent = 'Importar produtos por planilha';
    const instructions = document.createElement('p'); instructions.textContent = 'Envie CSV UTF-8 ou JSON (lista de produtos). Até 2.000 produtos e 1 MB. Use códigos únicos; a importação cria produtos e não substitui estoque já cadastrado.';
    const template = document.createElement('a'); template.href = '/api/admin/products/import/template'; template.textContent = 'Baixar modelo CSV'; template.className = 'action-btn btn-gray';
    template.onclick = async event => {
      event.preventDefault();
      try { const response = await window.ConfloraSession.apiFetch(template.href); if (!response.ok) throw new Error('Não foi possível baixar o modelo. Confira seu acesso de administrador.'); const url = URL.createObjectURL(await response.blob()); const download = document.createElement('a'); download.href = url; download.download = 'modelo-produtos-conflora.csv'; download.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      catch (error) { status.textContent = error.message; }
    };
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.csv,.json,text/csv,application/json'; file.setAttribute('aria-label', 'Arquivo de produtos (CSV ou JSON)');
    const preview = document.createElement('button'); preview.type = 'button'; preview.textContent = 'Validar e mostrar prévia'; preview.className = 'action-btn btn-green';
    const commit = document.createElement('button'); commit.type = 'button'; commit.textContent = 'Confirmar importação'; commit.className = 'action-btn btn-green'; commit.disabled = true;
    const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Fechar'; close.className = 'action-btn btn-gray'; close.onclick = () => dialog.close();
    const status = document.createElement('p'); status.setAttribute('role', 'status'); const rows = document.createElement('div'); rows.style.overflowX = 'auto';
    let csv = ''; let payload = {}; let importId = '';
    file.onchange = () => { csv = ''; importId = ''; commit.disabled = true; rows.replaceChildren(); status.textContent = ''; };
    const request = async (url, body) => { const response = await window.ConfloraSession.apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; };
    preview.onclick = async () => {
      commit.disabled = true; preview.disabled = true; rows.replaceChildren();
      try {
        if (!file.files[0] || file.files[0].size > 1024 * 1024) throw new Error('Selecione um CSV UTF-8 ou JSON de até 1 MB.');
        csv = await file.files[0].text(); payload = file.files[0].name.toLowerCase().endsWith('.json') ? { products: JSON.parse(csv) } : { csv }; const data = await request('/api/admin/import-products/preview', payload); importId = data.importId;
        status.textContent = `${data.total} produto(s). ${data.errors.length ? 'Corrija os erros abaixo.' : 'Confira nomes, preços, unidades e estoque antes de confirmar.'}`;
        for (const error of data.errors) { const paragraph = document.createElement('p'); paragraph.textContent = `Linha/código ${error.line || error.code}: ${error.error}`; rows.append(paragraph); }
        const table = document.createElement('table');
        for (const product of data.rows) { const row = document.createElement('tr'); for (const value of [product.sku, product.name, money(product.price), product.unit, product.stockQuantity]) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); } table.append(row); }
        rows.append(table); commit.disabled = data.errors.length > 0;
      } catch (error) { status.textContent = error.message; } finally { preview.disabled = false; }
    };
    commit.onclick = async () => {
      commit.disabled = true; preview.disabled = true; file.disabled = true; close.disabled = true;
      try { const result = await request('/api/admin/import-products', { ...payload, importId }); status.textContent = `${result.imported} produto(s) importados. Feche esta janela e atualize a lista de produtos.`; window.dispatchEvent(new window.Event('products-imported')); }
      catch (error) { status.textContent = error.message; preview.disabled = false; }
      finally { close.disabled = false; file.disabled = false; }
    };
    dialog.append(heading, instructions, template, file, preview, status, rows, commit, close); document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove()); dialog.showModal();
  }
  window.ConfloraProductImport = { open };
})();
