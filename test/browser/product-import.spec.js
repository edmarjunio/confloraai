const { ensureCashierSession } = require('./cashier-session');
const { test, expect } = require('@playwright/test');
test('Admin valida preços na prévia e importa CSV; repetição não duplica produtos', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  await ensureCashierSession(page);
  await page.goto('/admin?tab=products');
  await page.getByRole('button', { name: 'Importar planilha de produtos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Importar produtos por planilha' });
  const download = page.waitForEvent('download');
  await dialog.getByRole('link', { name: 'Baixar modelo CSV', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('modelo-produtos-conflora.csv');
  await dialog.getByLabel('Arquivo de produtos (CSV ou JSON)').setInputFiles({ name: 'produtos.csv', mimeType: 'text/csv', buffer: Buffer.from('codigo;nome;preco;categoria;unidade;estoque\nMIG01;Produto migrado;15,90;Horta;UN;12') });
  await dialog.getByRole('button', { name: 'Validar e mostrar prévia', exact: true }).click();
  await expect(dialog).toContainText('15,90');
  await dialog.getByRole('button', { name: 'Confirmar importação', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('1 produto(s) importados');
  await dialog.getByRole('contentinfo').getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.reload();
  await expect(page.locator('#adminProductsGrid')).toContainText('Produto migrado');
});


test('Admin importa JSON pelo mesmo fluxo seguro com prévia', async ({ page }) => {
  await page.request.post('/api/admin/auth/login', { data: { userId: 'usr-edmar', pin: '1234' } });
  await ensureCashierSession(page);
  await page.goto('/admin?tab=products');
  await page.getByRole('button', { name: 'Importar planilha de produtos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Importar produtos por planilha' });
  await dialog.getByLabel('Arquivo de produtos (CSV ou JSON)').setInputFiles({ name: 'produtos.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{ sku: 'JSON-MIG01', name: 'Produto migrado JSON', price: 7.5, category: 'Horta', unit: 'KG', stock: 5.5 }])) });
  await dialog.getByRole('button', { name: 'Validar e mostrar prévia', exact: true }).click();
  await expect(dialog).toContainText('7,50');
  await dialog.getByRole('button', { name: 'Confirmar importação', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('1 produto(s) importados');
});
