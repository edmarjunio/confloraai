const { test, expect } = require("@playwright/test");

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
  await expect(page.locator("#products .product-card").first()).toBeVisible();
  await expect(page.locator("#logo")).toHaveAttribute("src", /conflora-logo/);
  await page.locator("#coachSkip").click();
  await page.locator("#accountButton").click();
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
  await expect(page.locator("#accountButton")).toHaveText(
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
  await expect(page.locator("#cartDialog")).toBeVisible();
  expect(
    await page
      .locator("#cartDialog")
      .evaluate((node) => node.matches(":modal")),
  ).toBe(false);
  await page.locator("#checkoutForm input[name=phone]").fill("64999999999");
  await page.locator("input[name=fulfillment][value=pickup]").check();
  await expect(page.locator("#pixKey")).toHaveText("64999351616");
  await page.screenshot({
    path: "test-results/new-main-desktop-detail.png",
    fullPage: true,
  });
  await page.getByRole('button', { name: '← Voltar ao catálogo' }).click();
  await page.locator('#search').fill('');
  await page.locator('#cartButton').click();
  await page.screenshot({ path: 'test-results/new-main-desktop-catalog.png' });
  await page.locator("#submitOrder").click();
  await expect(page.locator("#receipt")).toContainText("Pedido recebido!");
  await page.getByRole("button", { name: "Continuar comprando" }).click();
  await page.locator("#accountButton").click();
  await expect(page.locator("#accountContent")).toContainText("Planta Teste");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.locator("#accountButton")).toHaveText("Entrar");
  expect(errors).toEqual([]);
});

test("main mobile product, bottom sheet and conversational cards follow the approved flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products/test-plant");
  await expect(page.locator("#productView h1")).toHaveText("Planta Teste");
  await page.locator("#coachSkip").click();
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
  expect(
    await page
      .locator("#cartDialog")
      .evaluate((node) => node.matches(":modal")),
  ).toBe(true);
  await page.locator("input[name=fulfillment][value=pickup]").check();
  await page.screenshot({ path: "test-results/new-main-mobile-cart.png" });
  await page.getByRole("button", { name: "Fechar sacola" }).click();
  await page.locator("#aiFab").click();
  await page.locator("#chatInput").fill("Planta Teste");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(
    page.locator("#chatMessages .recommendation").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Não, quero outra opção" }).click();
  await expect(page.locator("#chatMessages")).toContainText("Me conte mais");
  await page.screenshot({ path: "test-results/new-main-mobile-chat.png" });
  const width = await page
    .locator("html")
    .evaluate((node) => ({
      scroll: node.scrollWidth,
      viewport: node.clientWidth,
    }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
});
