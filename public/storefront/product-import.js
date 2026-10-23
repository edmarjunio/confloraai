(() => {
  const translate = (key, fallback) => {
    const translated = typeof window.tr === 'function' ? window.tr(key) : key.tr;
    const looksLikeMissingTranslation = typeof translated === 'string'
      && /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/i.test(translated);
    return typeof translated === 'string' && translated !== key && !looksLikeMissingTranslation
      ? translated
      : fallback;
  };

  const createElement = (tagName, className, text) => {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  const money = value => Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  async function open() {
    const dialog = createElement('dialog', 'product-editor-dialog product-import-dialog');
    const title = createElement('h2', 'product-import-dialog__title', translate(
      'import_products_via_spreadsheet',
      'Importar produtos por planilha',
    ));
    title.id = 'productImportTitle';
    dialog.setAttribute('aria-labelledby', title.id);

    const description = createElement('p', 'product-import-dialog__description', translate(
      'upload_csv_utf_8_or_json_product_list_up_to_2_000_products_and_1_mb_use_unique_codes_',
      'Envie um arquivo CSV UTF-8 ou JSON com até 2.000 produtos e 1 MB. Use códigos únicos. A importação cria produtos e não substitui o estoque já cadastrado.',
    ));

    const close = createElement('button', 'product-import-dialog__close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', translate('common_close', 'Fechar'));

    const header = createElement('header', 'product-import-dialog__header');
    const heading = createElement('div', 'product-import-dialog__heading');
    heading.append(title, description);
    header.append(heading, close);

    const status = createElement('p', 'product-import-dialog__status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    const template = createElement('a', 'action-btn btn-gray product-import-dialog__template', translate(
      'download_csv_template',
      'Baixar modelo CSV',
    ));
    template.href = '/api/admin/products/import/template';

    const file = document.createElement('input');
    file.type = 'file';
    file.accept = '.csv,.json,text/csv,application/json';
    file.className = 'product-import-dialog__file-input';
    file.setAttribute('aria-label', translate('product_file_csv_or_json', 'Arquivo de produtos (CSV ou JSON)'));

    const fileName = createElement('span', 'product-import-dialog__file-name', translate(
      'no_file_selected',
      'Nenhum arquivo selecionado',
    ));
    const fileLabel = createElement('span', 'product-import-dialog__file-label', translate(
      'choose_product_file',
      'Escolha o arquivo CSV ou JSON',
    ));
    const fileHelp = createElement('span', 'product-import-dialog__file-help', translate(
      'maximum_1_mb_utf8_csv_or_json',
      'Tamanho máximo: 1 MB · CSV UTF-8 ou JSON',
    ));
    const fileCard = createElement('label', 'product-import-dialog__file-card');
    fileCard.append(fileLabel, fileHelp, file, fileName);

    const preview = createElement('button', 'action-btn btn-gray product-import-dialog__preview', translate(
      'validate_and_show_preview',
      'Validar arquivo e mostrar prévia',
    ));
    preview.type = 'button';
    preview.disabled = true;

    const rows = createElement('div', 'product-import-dialog__table-wrap');
    const previewPanel = createElement('section', 'product-import-dialog__preview-panel');
    previewPanel.hidden = true;
    const previewTitle = createElement('h3', 'product-import-dialog__preview-title', translate(
      'import_preview',
      'Prévia da importação',
    ));
    previewPanel.append(previewTitle, rows);

    const cancel = createElement('button', 'action-btn btn-gray', translate('common_close', 'Fechar'));
    cancel.type = 'button';
    const commit = createElement('button', 'action-btn btn-green product-import-dialog__confirm', translate(
      'confirm_import',
      'Confirmar importação',
    ));
    commit.type = 'button';
    commit.disabled = true;

    const actions = createElement('footer', 'product-import-dialog__actions');
    actions.append(cancel, commit);

    const content = createElement('div', 'product-import-dialog__content');
    const fileActions = createElement('div', 'product-import-dialog__file-actions');
    fileActions.append(template, preview);
    content.append(fileCard, fileActions, status, previewPanel);

    const surface = createElement('div', 'product-import-dialog__surface');
    surface.append(header, content, actions);
    dialog.append(surface);
    document.body.append(dialog);

    let payload = {};
    let importId = '';

    const request = async (url, body) => {
      const response = await window.ConfloraSession.apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || translate('import_failed', 'Não foi possível importar o arquivo.'));
      return data;
    };

    template.onclick = async event => {
      event.preventDefault();
      try {
        const response = await window.ConfloraSession.apiFetch(template.href);
        if (!response.ok) throw new Error(translate(
          'could_not_download_template_check_your_administrator_access',
          'Não foi possível baixar o modelo. Confira seu acesso de administrador.',
        ));
        const url = URL.createObjectURL(await response.blob());
        const download = createElement('a');
        download.href = url;
        download.download = translate('products_template_conflora_csv', 'modelo-produtos-conflora.csv');
        download.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        status.textContent = error.message;
        status.dataset.state = 'error';
      }
    };

    file.onchange = () => {
      const selectedFile = file.files?.[0];
      fileName.textContent = selectedFile?.name || translate('no_file_selected', 'no_file_selected'.tr);
      fileCard.classList.toggle('has-file', Boolean(selectedFile));
      preview.disabled = !selectedFile;
      commit.disabled = true;
      importId = '';
      previewPanel.hidden = true;
      rows.replaceChildren();
      status.textContent = '';
      delete status.dataset.state;
    };

    preview.onclick = async () => {
      const selectedFile = file.files?.[0];
      if (!selectedFile) return;
      preview.disabled = true;
      commit.disabled = true;
      previewPanel.hidden = true;
      status.textContent = translate('validating_file', 'validating_file'.tr);
      delete status.dataset.state;
      rows.replaceChildren();

      try {
        if (selectedFile.size > 1024 * 1024) {
          throw new Error(translate('select_a_utf_8_csv_or_json_up_to_1_mb', 'Selecione um CSV UTF-8 ou JSON de até 1 MB.'));
        }

        const fileText = await selectedFile.text();
        payload = selectedFile.name.toLowerCase().endsWith('.json')
          ? { products: JSON.parse(fileText) }
          : { csv: fileText };
        const data = await request('/api/admin/import-products/preview', payload);
        importId = data.importId;

        if (data.errors.length) {
          status.textContent = `${data.total} ${translate('catalog_products', 'produtos')}. ${translate('fix_the_errors_below', 'Corrija os erros listados antes de confirmar.')}`;
          status.dataset.state = 'error';
          const errorList = createElement('ul', 'product-import-dialog__errors');
          for (const error of data.errors) {
            const item = createElement('li', '', `${translate('line_code', 'Linha/código')} ${error.line || error.code}: ${error.error}`);
            errorList.append(item);
          }
          rows.append(errorList);
        } else {
          status.textContent = `${data.total} ${translate('catalog_products', 'produtos')}. ${translate('check_names_prices_units_and_stock_before_confirming', 'Confira nomes, preços, unidades e estoque antes de confirmar.')}`;
          status.dataset.state = 'success';
          const table = document.createElement('table');
          table.className = 'product-import-dialog__table';
          const headings = [
            translate('product_code', 'Código'),
            translate('product_name', 'Produto'),
            translate('price', 'Preço'),
            translate('unit', 'Unidade'),
            translate('stock', 'Estoque'),
          ];
          const head = document.createElement('thead');
          const headerRow = document.createElement('tr');
          for (const label of headings) headerRow.append(createElement('th', '', label));
          head.append(headerRow);
          const body = document.createElement('tbody');
          for (const product of data.rows) {
            const row = document.createElement('tr');
            for (const value of [product.sku, product.name, money(product.price), product.unit, product.stockQuantity]) {
              row.append(createElement('td', '', String(value ?? '—')));
            }
            body.append(row);
          }
          table.append(head, body);
          rows.append(table);
        }

        previewPanel.hidden = false;
        commit.disabled = data.errors.length > 0;
      } catch (error) {
        status.textContent = error.message;
        status.dataset.state = 'error';
      } finally {
        preview.disabled = false;
      }
    };

    commit.onclick = async () => {
      commit.disabled = true;
      preview.disabled = true;
      file.disabled = true;
      cancel.disabled = true;
      close.disabled = true;
      status.textContent = translate('importing_products', 'importing_products'.tr);
      delete status.dataset.state;

      try {
        const result = await request('/api/admin/import-products', { ...payload, importId });
        status.textContent = `${result.imported} ${translate('product_s_imported_close_this_window_and_refresh_the_product_list', 'product_s_imported_close_this_window_and_refresh_the_product_list'.tr)}`;
        status.dataset.state = 'success';
        window.dispatchEvent(new window.Event('products-imported'));
      } catch (error) {
        status.textContent = error.message;
        status.dataset.state = 'error';
        preview.disabled = false;
      } finally {
        cancel.disabled = false;
        close.disabled = false;
        file.disabled = false;
      }
    };

    const closeDialog = () => dialog.close();
    close.onclick = closeDialog;
    cancel.onclick = closeDialog;
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.showModal();
    file.focus();
  }

  window.ConfloraProductImport = { open };
})();
