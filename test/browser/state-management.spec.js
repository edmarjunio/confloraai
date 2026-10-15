const { test, expect } = require("@playwright/test");
test.beforeEach(async ({ page }) => {
  page._errors = [];
  page.on("pageerror", (error) => page._errors.push(error.message));
});
test.afterEach(async ({ page }) => expect(page._errors).toEqual([]));

async function loginOperator(page) {
  await page.goto("/pdv");
  const users = await (await page.request.get("/api/admin/auth/users")).json();
  const operator = users.find((user) => user.role === "ADMIN");
  await page
    .getByRole("main")
    .getByLabel("Colaborador")
    .selectOption(operator.id);
  await page.getByRole("main").getByLabel("PIN", { exact: true }).fill("1234");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Entrar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Frente de caixa" }),
  ).toBeVisible();
  return operator;
}

test("cart and locale survive reload without duplicate catalog requests", async ({
  page,
}) => {
  let reads = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/api/stores/garden/products")) reads++;
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shop/garden");
  await page.getByLabel("Buscar", { exact: true }).fill("Manjericão");
  await page.getByRole("button", { name: "Adicionar", exact: true }).click();
  await page.locator('#cartButton').click();
  await expect(page.getByLabel("Quantidade")).toHaveValue("1");
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole('button', { name: 'Equipe', exact: true }).click();
  await page.getByLabel("Idioma").selectOption("en-US");
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  expect(reads).toBe(1);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  const cart = page.locator('#cartButton');
  await expect(page.locator('#cartCount')).toHaveText('1');
  await cart.click();
  await expect(page.locator("dialog input[type=number]").first()).toHaveValue(
    "1",
  );
});

test("a stored paid snapshot cannot approve Pix; backend confirmation updates the screen", async ({
  page,
}) => {
  const operator = await loginOperator(page);
  const pending = {
    id: "pix-test",
    paymentProvider: "SICREDI",
    total: 25,
    paymentStatus: "AGUARDANDO_PAGAMENTO",
    pix: { pixCopiaECola: "test-code" },
  };
  let paid = false;
  await page.route("**/api/caixa/orders/pix-test", (route) =>
    route.fulfill({ json: pending }),
  );
  await page.route("**/api/caixa/orders/pix-test/pix", (route) =>
    route.fulfill({
      json: {
        order: paid
          ? {
              ...pending,
              paymentStatus: "PAGO",
              paymentTransactionId: "E-BANK-CONFIRMED",
            }
          : pending,
      },
    }),
  );
  await page.evaluate(
    ({ operator, pending }) =>
      localStorage.setItem(
        `pdv-attempt:${operator.id}`,
        JSON.stringify({
          requestId: "legacy-attempt",
          order: {
            ...pending,
            paymentStatus: "PAGO",
            paymentTransactionId: "FORGED",
          },
        }),
      ),
    { operator, pending },
  );
  await page.reload();
  await expect(
    page.getByText("Aguardando confirmação do Sicredi…"),
  ).toBeVisible();
  await expect(page.getByText("FORGED")).toHaveCount(0);
  paid = true;
  await page
    .getByRole("button", { name: "Verificar pagamento agora", exact: false })
    .click();
  await expect(page.getByText("E-BANK-CONFIRMED")).toBeVisible();
  const saved = await page.evaluate(
    (id) => JSON.parse(localStorage.getItem(`pdv-attempt:${id}`)),
    operator.id,
  );
  expect(saved.order).toBeUndefined();
  expect(saved.orderId).toBe("pix-test");
});

test("successful inventory mutation refreshes cached data and session logout hides private panels", async ({
  page,
}) => {
  await loginOperator(page);
  await page.goto("/admin");
  const labels = require("../../src/web/i18n/locales/pt-BR.json");
  let reads = 0;
  page.on("request", (req) => {
    if (
      req.url().endsWith("/api/admin/inventory-settings") &&
      req.method() === "GET"
    )
      reads++;
  });
  await page
    .getByRole("button", { name: labels["admin.inventory"], exact: true })
    .click();
  const toggle = page.getByRole("main").getByRole("checkbox");
  await expect(toggle).toBeVisible();
  const before = await toggle.isChecked();
  await toggle.click();
  await expect(toggle).toBeChecked({ checked: !before });
  await expect.poll(() => reads).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Equipe", exact: true }).click();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(
    page.getByRole("main").getByLabel("PIN", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("checkbox")).toHaveCount(0);
});
