const { test, expect } = require('@playwright/test');

test('chat mostra envio antes da resposta, Enter envia e Escape limpa sem fechar', async ({ page }) => {
  await page.route(/https:\/\/.*/, route => route.abort());
  await page.route(/\/api\/storefront\/catalog(?:\?.*)?$/, async route => {
    const response = await route.fetch(); const body = await response.json();
    body.config.assistant.mode = 'AI'; body.config.assistant.enabled = true;
    await route.fulfill({ response, json: body });
  });
  let request; let release;
  await page.route('**/api/chat', async route => {
    request = route.request().postDataJSON();
    await new Promise(resolve => { release = resolve; });
    await route.fulfill({ json: { reply: 'Encontrei o produto cadastrado.' } });
  });
  await page.goto('/');
  if (await page.locator('#coachSkip').isVisible()) await page.locator('#coachSkip').click();
  await page.locator('#aiFab').click();
  const input = page.locator('#chatInput');
  await input.fill('Quero manjericão'); await input.press('Enter');
  await expect(page.locator('#chatMessages .bubble.user')).toContainText('Quero manjericão');
  await expect(input).toHaveValue('');
  await expect.poll(() => Boolean(release)).toBe(true);
  expect(Object.keys(request).sort()).toEqual(['history', 'message']);
  release();
  await expect(page.locator('#chatMessages')).toContainText('Encontrei o produto cadastrado.');
  await input.fill('Texto a limpar'); await input.press('Escape');
  await expect(input).toHaveValue(''); await expect(page.locator('#chatDialog')).toBeVisible();
});
