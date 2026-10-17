const { test, expect } = require("@playwright/test");

async function selectPortuguese(page) {
  const language = page.locator("#languageSelect");
  if (await language.count()) await language.selectOption("pt");
}

test("chat presents a friendly error when an upstream proxy returns HTML", async ({
  page,
}) => {
  await page.route("**/api/storefront/catalog", async route => {
    const response = await route.fetch(); const data = await response.json();
    data.config.assistant.mode = "AI";
    await route.fulfill({ json: data });
  });
  await page.route("**/api/storefront/assistant", (route) =>
    route.fulfill({
      status: 502,
      contentType: "text/html",
      body: "<!DOCTYPE html><h1>Proxy error</h1>",
    }),
  );
  await page.goto("/");
  await selectPortuguese(page);
  await expect(page.locator("#products .product-card").first()).toBeVisible();
  const coachSkip = page.locator("#coachSkip");
  if (await coachSkip.isVisible()) await coachSkip.click();
  await page.locator("#aiFab").click();
  await page.locator("#chatInput").fill("Planta para sombra");
  await page.locator("#chatForm").evaluate((form) => form.requestSubmit());
  await expect(page.locator("#chatMessages")).toContainText(
    "O serviço está temporariamente indisponível",
  );
  await expect(page.locator("#chatMessages")).not.toContainText(
    "Unexpected token",
  );
  await expect(page.locator("#chatInput")).toHaveValue("Planta para sombra");
  await expect(
    page.locator("#chatForm button"),
  ).toBeEnabled();
});

test.beforeAll(async ({ request }) => {
  const users = await (await request.get("/api/admin/auth/users")).json();
  const admin = users.find((user) => user.role === "ADMIN");
  expect(
    (
      await request.post("/api/admin/auth/login", {
        data: { userId: admin.id, pin: "1234" },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await request.post("/api/admin/products", {
        data: {
          id: "test-plant",
          name: "Planta Teste",
          category: "Horta e Temperos",
          price: 25,
          stockQuantity: 100,
          status: "ATIVO",
          description:
            "Produto de demonstração para validar o layout e o fluxo de compra.",
          specifications: {
            light: { label: "Ambiente", value: "Sol direto" },
            water: { label: "Rega", value: "Conforme o solo" },
            soil: { label: "Solo", value: "Bem drenado" },
          },
          contentSections: [
            {
              id: "care",
              title: "Como cuidar",
              body: "Informação ilustrativa do cadastro de teste.",
            },
          ],
        },
      })
    ).ok(),
  ).toBe(true);
  await request.post("/api/auth/logout");
});

test("main URL shows the new layout and uses existing customer accounts, catalogue and orders", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await selectPortuguese(page);
  await expect(page.locator("#products .product-card").first()).toBeVisible();
  await expect(page.locator("#logo")).toHaveAttribute("src", /conflora-logo/);
  const coachSkip = page.locator("#coachSkip");
  if (await coachSkip.isVisible()) await coachSkip.click();
  await page.locator("#accountButton").click();
  await expect(page.locator("#accountDialog")).toBeVisible();
  await expect(page.locator("#googleAccountButton .google-mark")).toBeVisible();
  await page.locator("#accountContent select").selectOption("register");
  await page
    .locator("#accountContent input[name=name]")
    .fill("Cliente Nova Vitrine");
  await page
    .locator("#accountContent input[name=email]")
    .fill("new-storefront@test.com");
  await page
    .locator("#accountContent input[name=password]")
    .fill("password-123");
  await page.locator("#accountContent button[type=submit]").click();
  await expect(page.locator("#headerAccountName")).toHaveText(
    "Cliente Nova Vitrine",
  );
  await page.locator("#search").fill("Planta Teste");
  await page.getByRole("button", { name: "Planta Teste", exact: true }).click();
  await expect(page).toHaveURL(/\/products\/test-plant$/);
  await page.reload();
  await expect(page.locator("#productView h1")).toHaveText("Planta Teste");
  await page
    .getByRole("button", { name: "Adicionar à sacola", exact: true })
    .click();
  await page.locator("#cartButton").click();
  await expect(page.locator("#cartDialog")).toBeVisible();
  expect(
    await page
      .locator("#cartDialog")
      .evaluate((node) => node.matches(":modal")),
  ).toBe(false);
  await page.locator("#checkoutCustomer input[name=name]").fill("Cliente Nova Vitrine");
  await page.locator("#checkoutCustomer input[name=phone]").fill("64999999999");
  await page.locator("input[name=fulfillment][value=pickup]").check();
  await page.locator("input[name=payment][value=CASH]").check();
  await page.locator("#checkoutForm input[name=cash]").fill("100");
  await page.screenshot({
    path: "test-results/new-main-desktop-detail.png",
    fullPage: true,
  });
  await page.locator("#cartCloseButton").click();
  await page.getByRole("button", { name: "← Voltar ao catálogo" }).click();
  await page.locator("#search").fill("");
  await page.locator("#cartButton").click();
  await page.screenshot({ path: "test-results/new-main-desktop-catalog.png" });
  await page.locator("#submitOrder").click();
  await page.locator("#orderReviewConfirm").click();
  await expect(page.locator("#receipt .order-receipt-text")).toContainText("Cliente Nova Vitrine");
  const checkoutReceipt = await page.locator("#receipt .order-receipt-text").innerText();
  await page.locator("#cartCloseButton").click();
  await page.locator("#customerAccountShortcut").click();
  await expect(page.locator("#historyList")).toContainText("Planta Teste");
  const historyOrder = page.locator(".history-order-details").first();
  await historyOrder.locator("summary").click();
  await expect(historyOrder.locator(".order-receipt-text")).toHaveText(checkoutReceipt);
  await page.locator("#historyCloseButton").click();
  await page.locator("#headerAccountIdentity").click();
  await expect(page.locator("#accountContent")).toContainText("Cliente Nova Vitrine");
  await expect(page.locator("#accountContent .account-profile")).toContainText("CLIENTE");
  await page.locator("#accountContent").getByRole("button", { name: "Sair" }).click();
  await expect(page.locator("#accountButton")).toHaveText("Entrar");
  expect(errors).toEqual([]);
});

test("Google login button sends the auth result into the storefront account session", async ({ page }) => {
  await page.goto("/");
  await selectPortuguese(page);
  await page.locator("#accountButton").click();
  await page.evaluate(() => {
    window.authenticateGoogle = async () => ({
      success: true,
      user: { id: "google-demo", name: "Cliente Google", email: "google@test.com", role: "CLIENTE" },
    });
    document.querySelector("#googleAccountButton").disabled = false;
  });
  await page.locator("#googleAccountButton").click();
  await expect(page.locator("#headerAccountName")).toHaveText("Cliente Google");
  await expect(page.locator("#accountDialog")).toBeHidden();
  await page.locator("#headerAccountIdentity").click();
  await expect(page.locator("#accountContent .account-profile")).toContainText("google@test.com");
  await expect(page.locator("#accountContent .account-role")).toHaveText("CLIENTE");
});

test("main mobile product, bottom sheet and conversational cards follow the approved flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products/test-plant");
  await selectPortuguese(page);
  await expect(page.locator("#productView h1")).toHaveText("Planta Teste");
  const coachSkip = page.locator("#coachSkip");
  if (await coachSkip.isVisible()) await coachSkip.click();
  await expect(page.locator(".search")).toBeHidden();
  await page.getByRole("tab", { name: "Especificações" }).click();
  await page
    .getByRole("button", { name: "Adicionar à sacola", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/new-main-mobile-product.png",
    fullPage: true,
  });
  await page.locator("#cartButton").click();
  await expect(page.locator("#cartDialog")).toBeVisible();
  await page.locator("input[name=fulfillment][value=pickup]").check();
  await page.screenshot({ path: "test-results/new-main-mobile-cart.png" });
  await page.getByRole("button", { name: "Fechar sacola" }).click();
  await page.locator("#aiFab").click();
  await page.locator("#chatInput").fill("Planta Teste");
  await page.locator("#chatForm").evaluate((form) => form.requestSubmit());
  await expect(page.locator("#chatMessages .guided-results-grid render-product-card").first()).toBeVisible();
  const compactCard = page.locator('#chatMessages .guided-results-grid render-product-card').first();
  await expect(compactCard).toHaveAttribute('variant', 'cashier');
  expect((await compactCard.boundingBox()).height).toBeLessThan(130);
  await compactCard.locator('[data-action="add"]').click();
  await expect(page.getByRole('button', { name: 'Manter filtro atual', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Manter filtro atual', exact: true }).click();
  await expect(compactCard).toBeVisible();
  await page.screenshot({ path: "test-results/new-main-mobile-chat.png" });
  const width = await page.locator("html").evaluate((node) => ({
    scroll: node.scrollWidth,
    viewport: node.clientWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
});

test("catalog header exposes login, account role and admin settings according to session", async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: null } }),
  );
  await page.goto("/");
  await expect(page.locator("#accountButton")).toBeVisible();
  await expect(page.locator("#headerAccountIdentity")).toBeHidden();
  await expect(page.locator("#cashierShortcut")).toBeHidden();
  await expect(page.locator("#adminSettingsButton")).toBeHidden();
  await page.locator("#accountButton").click();
  await expect(page.locator("#accountDialog")).toBeVisible();
  await page.locator('#accountDialog [data-close]').click();

  await page.unroute("**/api/auth/me");
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "catalog-customer",
          name: "Cliente Demonstração",
          role: "CLIENTE",
        },
      },
    }),
  );
  await page.goto("/");
  await expect(page.locator("#headerAccountIdentity")).toBeVisible();
  await expect(page.locator("#headerAccountName")).toHaveText(
    "Cliente Demonstração",
  );
  await expect(page.locator("#headerAccountRole")).toHaveText("CLIENTE");
  await expect(page.locator("#accountButton")).toBeHidden();
  await expect(page.locator("#cashierShortcut")).toBeHidden();
  await expect(page.locator("#adminSettingsButton")).toBeHidden();
  await page.locator("#headerAccountIdentity").click();
  await expect(page.locator("#accountDialog")).toBeVisible();
  await page.locator('#accountDialog [data-close]').click();

  await page.unroute("**/api/auth/me");
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "catalog-admin",
          name: "Admin Conflora",
          role: "ADMIN",
        },
      },
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("#headerAccountName")).toHaveText("Admin Conflora");
  await expect(page.locator("#headerAccountRole")).toHaveText("ADMIN");
  await expect(page.locator("#cashierShortcut")).toBeVisible();
  await expect(page.locator("#adminSettingsButton")).toBeVisible();
  await page.locator("#adminSettingsButton").click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto("/");
  await expect(page.locator("#cashierShortcut")).toBeVisible();
  await page.locator("#cashierShortcut").click();
  await expect(page).toHaveURL(/\/caixa$/);

  await page.goto("/");
  const headerOrder = await page.locator(".header-actions").evaluate((header) => {
    const ids = [
      "headerAccountIdentity",
      "cartButton",
      "cashierShortcut",
      "adminSettingsButton",
    ];
    return ids.map((id) =>
      [...header.children].findIndex((child) => child.id === id),
    );
  });
  expect(headerOrder[0]).toBeLessThan(headerOrder[1]);
  expect(headerOrder[1]).toBeLessThan(headerOrder[2]);
  expect(headerOrder[2]).toBeLessThan(headerOrder[3]);
  const viewportWidth = await page
    .locator("html")
    .evaluate((html) => ({ scroll: html.scrollWidth, viewport: html.clientWidth }));
  expect(viewportWidth.scroll).toBeLessThanOrEqual(viewportWidth.viewport);
});

test('mobile chat searches the full catalog after selecting a category and keeps cards readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/'); await selectPortuguese(page);
  if (await page.locator('#coachSkip').isVisible()) await page.locator('#coachSkip').click();
  await page.locator('#aiFab').click();
  await page.locator('#chatMessages').getByRole('button', { name: /Plantas/, exact: false }).first().click();
  await page.locator('#chatInput').fill('Abacate');
  await page.locator('#chatForm').evaluate((form) => form.requestSubmit());
  const card = page.locator('#chatMessages .guided-results-grid render-product-card').filter({ hasText: 'Abacate KG' }).first();
  await expect(card).toBeVisible();
  expect(await card.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await expect(card.locator('.cf-shared-unit')).toHaveCSS('white-space', 'nowrap');
  await card.locator('[data-action="add"]').click();
  const weight = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Quantos quilos de Abacate KG?' }) });
  await expect(weight).toBeVisible();
  await weight.getByRole('button', { name: 'Adicionar ao carrinho', exact: true }).click();
  const actions = page.locator('.chat-next-search'); await expect(actions).toBeVisible();
  expect(await actions.evaluate((node) => parseFloat(window.getComputedStyle(node).paddingLeft))).toBeGreaterThanOrEqual(14);
  await page.screenshot({ path: 'test-results/chat-search-mobile.png' });
});

test('registered customer data completes checkout without overwriting typed data', async ({ page }) => {
  await page.route('**/api/customer/profile', route => route.fulfill({ json: { name: 'Cliente cadastrado', phone: '5564999991234', address: 'Rua das Flores, 20, Centro, Mineiros GO', email: 'cliente@test.com' } }));
  await page.goto('/'); await selectPortuguese(page);
  if (await page.locator('#coachSkip').isVisible()) await page.locator('#coachSkip').click();
  await page.locator('#cartButton').click();
  await expect(page.locator('#checkoutCustomer [name=name]')).toHaveValue('Cliente cadastrado');
  await expect(page.locator('#checkoutCustomer [name=phone]')).toHaveValue('64999991234');
  await expect(page.locator('#checkoutForm [name=address]')).toHaveValue('Rua das Flores, 20, Centro, Mineiros GO');
});
