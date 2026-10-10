const { test, expect } = require("@playwright/test");
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const list = [];
  errors.set(page, list);
  page.on("pageerror", (error) => list.push(error.message));
  await page.route(/https:\/\/.*/, (route) => route.abort());
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function visit(page, slug = "garden") {
  await page.goto(`/shop/${slug}`);
  await expect(page.locator("#products .product-card")).toHaveCount(2);
  if (await page.locator("#coachSkip").isVisible()) {
    await page.locator("#coachSkip").click();
  }
}
async function login(page) {
  await page.locator("#accountButton").click();
  await page
    .locator("#accountContent input[name=email]")
    .fill("admin@test.com");
  await page
    .locator("#accountContent input[name=password]")
    .fill("test-password-123");
  await page.locator("#accountContent button[type=submit]").click();
  await expect(page.locator("#accountButton")).toHaveText("Admin");
}
test("desktop catalogue, product page, cart sidebar and checkout use one cart", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await visit(page);
  await page.getByRole("button", { name: "Manjericão", exact: true }).click();
  await expect(page).toHaveURL(/products\/product-1/);
  await expect(page.locator("#productView")).toContainText("Sol direto");
  await page
    .getByRole("button", { name: "Adicionar à sacola", exact: true })
    .click();
  await page.getByRole("button", { name: "← Voltar ao catálogo" }).click();
  await page.locator("#cartButton").click();
  await expect(page.locator("#cartDialog")).toBeVisible();
  await expect(page.locator("#cartDialog")).toHaveJSProperty("open", true);
  expect(
    await page
      .locator("#cartDialog")
      .evaluate((dialog) => dialog.matches(":modal")),
  ).toBe(false);
  await page
    .locator("#products .product-card")
    .filter({ hasText: "Substrato" })
    .getByRole("button", { name: "Adicionar", exact: true })
    .click();
  await expect(page.locator("#cartItems")).toContainText("Substrato");
  if (await page.locator("#coachSkip").isVisible()) {
    await page.locator("#coachSkip").click();
  }
  await page.locator("#checkoutForm input[name=name]").fill("Cliente Web");
  await page.locator("#checkoutForm input[name=phone]").fill("64999999999");
  await page.locator("input[name=fulfillment][value=pickup]").check();
  await expect(page.locator("#checkoutTotal")).toHaveText("R$ 24,00");
  await page.locator("#submitOrder").click();
  await expect(page.locator("#receipt")).toContainText("Pedido recebido");
  await page.screenshot({
    path: "test-results/storefront-desktop-checkout.png",
    fullPage: true,
  });
});
test("mobile bottom sheet, assistant recommendations and tenant-local storage", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await visit(page, "pets");
  await page.locator("#aiFab").click();
  await page.locator("#chatInput").fill("ração gatos");
  await page.locator("#chatForm button").click();
  await expect(
    page
      .locator("#chatMessages .recommendation")
      .filter({ hasText: "Ração para gatos" }),
  ).toBeVisible();
  await page
    .locator("#chatMessages .recommendation")
    .filter({ hasText: "Ração para gatos" })
    .getByRole("button", { name: "Adicionar", exact: true })
    .click();
  await page.getByRole("button", { name: "Não, quero outra opção" }).click();
  await expect(page.locator("#chatMessages")).toContainText("Me conte mais");
  await page.screenshot({
    path: "test-results/storefront-mobile-chat.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Fechar conversa" }).click();
  await page.locator("#mobileCart").click();
  await expect(page.locator("#cartDialog")).toBeVisible();
  expect(
    await page
      .locator("#cartDialog")
      .evaluate((dialog) => dialog.matches(":modal")),
  ).toBe(true);
  await expect(page.locator("#cartItems")).toContainText("Ração para gatos");
  const width = await page
    .locator("html")
    .evaluate((node) => ({
      scroll: node.scrollWidth,
      viewport: node.clientWidth,
    }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
  await page.screenshot({
    path: "test-results/storefront-mobile-cart.png",
    fullPage: true,
  });
  await visit(page, "garden");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await expect(page.locator("#storeName")).toHaveText("Jardim Local");
});
test("admin edits config and generic product specifications, cannot access another tenant", async ({
  page,
}) => {
  await visit(page);
  await login(page);
  await page.goto("/shop/garden/admin");
  await expect(page.locator("#adminView input[name=name]")).toBeVisible();
  await page
    .locator("#adminView input[name=subtitle]")
    .fill("Loja de teste atualizada");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.locator("#subtitle")).toHaveText(
    "Loja de teste atualizada",
  );
  await page.getByRole("button", { name: "Produtos", exact: true }).click();
  await page
    .locator(".admin-product-row")
    .filter({ hasText: "Substrato" })
    .getByRole("button", { name: "Editar" })
    .click();
  await page
    .locator("textarea[name=specs]")
    .fill("Composição: Fibra vegetal\nPeso: 5 kg");
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.locator("#toast")).toHaveText("Produto salvo.");
  await page.goto("/shop/garden/products/product-2");
  await expect(page.locator("#productView")).toContainText("Fibra vegetal");
  await page.goto("/shop/pets/admin");
  await expect(page.locator("#adminView")).toContainText(
    "Entre com a conta administrativa desta loja.",
  );
});
