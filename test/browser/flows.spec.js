const { test, expect } = require("@playwright/test");
const path = require("node:path");
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const list = [];
  errors.set(page, list);
  page.on("pageerror", (error) => list.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  // Imagens e analytics externos não fazem parte da lógica sob teste.
  await page.route(/https:\/\/.*/, (route) => route.abort());
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function pinLogin(page, name, pin) {
  await page.goto("/admin");
  await expect(page.locator("#loginModal")).toHaveClass(/open/);
  await page
    .locator("#userSelectList")
    .getByText(name, { exact: true })
    .click();
  await page.locator("#loginPinInput").fill(pin);
  await page
    .getByRole("button", {
      name: /Entrar com PIN|Acessar Painel|Entrar no Painel/,
    })
    .click();
  await expect(page.locator("#loginModal")).not.toHaveClass(/open/);
}
test("Admin: login, todas as 11 telas, upload real e confirmação de substituição", async ({
  page,
}) => {
  await pinLogin(page, "Edmar Júnio (Izibola)", "1234");
  for (const tab of [
    "analytics",
    "cashier",
    "diff",
    "orders",
    "stock",
    "price",
    "products",
    "team",
    "notifs",
    "status",
    "import",
  ]) {
    await page.locator("#tabBtn-" + tab).click();
    await expect(page.locator("#tab-" + tab)).toHaveClass(/active/);
  }
  await expect(page.locator("#btnSubmitImport")).toBeDisabled();
  await page
    .locator("#importFile")
    .setInputFiles(path.join(__dirname, "../fixtures/lista-de-produtos.xlsx"));
  await page.locator("#btnValidateImport").click();
  await expect(page.locator("#importFeedback")).toContainText(
    "745 produtos válidos",
  );
  await expect(page.locator("#importFeedback")).toContainText("3 inativos");
  await page.locator("#confirmReplace").check();
  await page.locator("#btnSubmitImport").click();
  await expect(page.locator("#importFeedback")).toContainText(
    "745 produtos importados com sucesso",
  );
  const products = (await (await page.request.get("/api/inventory")).json())
    .products;
  expect(products).toHaveLength(745);
  expect(products.some((p) => p.id === "test-plant")).toBe(false);
  await page.screenshot({
    path: "test-results/importacao-validada.png",
    fullPage: true,
  });
  await page.reload();
  await expect(page.locator("#loggedUserRole")).toHaveText("ADMIN");
  await expect(page.locator("#loginModal")).not.toHaveClass(/open/);
});
test("Caixa: login, cinco telas permitidas, bloqueios e venda no balcão", async ({
  page,
}) => {
  await pinLogin(page, "Atendente do Caixa", "0000");
  for (const tab of ["cashier", "diff", "stock", "price", "notifs"]) {
    await page.locator("#tabBtn-" + tab).click();
    await expect(page.locator("#tab-" + tab)).toHaveClass(/active/);
  }
  for (const tab of [
    "analytics",
    "orders",
    "products",
    "team",
    "import",
    "status",
  ]) {
    await expect(page.locator("#tabBtn-" + tab)).toBeHidden();
  }
  expect(
    (await page.request.post("/api/admin/import-data", { data: {} })).status(),
  ).toBe(403);
  await page.locator("#tabBtn-cashier").click();
  await page.locator('button[onclick="openManualOrderModal()"]').click();
  await page.locator("#mCustName").fill("Teste Caixa");
  await page.locator("#mQty").fill("1");
  await page.locator("#manualOrderModal button[type=submit]").click();
  await expect(page.locator("#manualOrderModal")).not.toHaveClass(/open/);
  const orders = await (await page.request.get("/api/admin/orders")).json();
  expect(orders.some((o) => o.customerName === "Teste Caixa")).toBe(true);
});
test("Cliente: cadastro, senha, busca, sacola, pedido, três abas e logout", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#authOpenBtn").click();
  await page.locator("button[onclick=\"switchAuthTab('register')\"]").click();
  await page.locator("#regNameInput").fill("Cliente Teste");
  await page.locator("#regEmailInput").fill("browser@test.com");
  await page.locator("#regPassInput").fill("senha123");
  await page.locator("#regPhoneInput").fill("64999999999");
  await page.locator("#authContentRegister button[type=submit]").click();
  await expect(page.locator("#userHeaderName")).toHaveText("Cliente");
  await page.locator("#searchInput").fill("ABACAXI");
  await expect(page.locator("#productsGrid")).toContainText("ABACAXI");
  await page
    .locator("#productsGrid button")
    .filter({ hasText: /Adicionar|Comprar|\+/ })
    .first()
    .click();
  await page.locator("#custName").fill("Cliente Teste");
  await page.locator("#custPhone").fill("64999999999");
  await page.locator("#custAddress").fill("Rua Teste, 123");
  await page.locator("#submitOrderBtn").click();
  await page.locator('[onclick="openCustomerPortalModal()"]').first().click();
  for (const tab of ["Orders", "Favs", "Loyalty"]) {
    await page.locator("#cTab" + tab + "Btn").click();
    await expect(page.locator("#cTab" + tab + "Content")).toBeVisible();
  }
  await page.locator('[onclick="closeCustomerPortalModal()"]').first().click();
  await page.locator('[onclick="logoutCurrentUser()"]').click();
  await expect(page.locator("#authOpenBtn")).toBeVisible();
  await page.locator("#authOpenBtn").click();
  await page.locator("button[onclick=\"switchAuthTab('login')\"]").click();
  await page.locator("#loginEmailInput").fill("browser@test.com");
  await page.locator("#loginPassInput").fill("senha123");
  await page.locator("#authContentLogin button[type=submit]").click();
  await expect(page.locator("#userHeaderName")).toHaveText("Cliente");
  expect((await page.request.get("/api/admin/orders")).status()).toBe(403);
  await page.goto("/admin");
  await expect(page.locator("#tabBtn-cashier")).toBeHidden();
});

test("Admin: editar produto importado, criar/excluir produto e colaborador, entrada de estoque", async ({
  page,
}) => {
  await pinLogin(page, "Edmar Júnio (Izibola)", "1234");
  await page.locator("#tabBtn-products").click();
  const imported = page
    .locator("#adminProductsTableBody tr")
    .filter({ hasText: "ABACAXI" })
    .first();
  await imported.getByRole("button", { name: /Editar/ }).click();
  await page.locator("#formProdPrice").fill("12.34");
  await page.locator("#prodForm button[type=submit]").click();
  await expect(imported).toContainText("12,34");
  await page.locator("#formProdName").fill("Produto E2E");
  await page.locator("#formProdCat").fill("Teste");
  await page.locator("#formProdPrice").fill("10");
  await page.locator("#formProdStock").fill("5");
  await page.locator("#prodForm button[type=submit]").click();
  const created = page
    .locator("#adminProductsTableBody tr")
    .filter({ hasText: "Produto E2E" });
  await expect(created).toHaveCount(1);
  await page.locator("#tabBtn-stock").click();
  await page.locator("#stockSearchInput").fill("Produto E2E");
  await page
    .locator("#stockCardsGrid")
    .getByRole("button", { name: "+5", exact: true })
    .click();
  await expect(page.locator("#stockCardsGrid")).toContainText("10");
  await page.locator("#tabBtn-products").click();
  await created.getByRole("button", { name: /Excluir/ }).click();
  await expect(created).toHaveCount(0);
  await page.locator("#tabBtn-team").click();
  await page.locator('[onclick="openNewUserModal()"]').click();
  await page.locator("#uName").fill("Operador E2E");
  await page.locator("#uEmail").fill("operator-e2e@test.com");
  await page.locator("#uPin").fill("8877");
  await page.locator("#userModal button[type=submit]").click();
  const user = page
    .locator("#teamTableBody tr")
    .filter({ hasText: "Operador E2E" });
  await expect(user).toHaveCount(1);
  await user.locator("select").selectOption("CLIENTE");
  await expect(user.locator("select")).toHaveValue("CLIENTE");
  await user.getByRole("button", { name: "Excluir" }).click();
  await expect(user).toHaveCount(0);
  await page.locator('[onclick="openLoginModal()"]').click();
  await expect(page.locator("#loginModal")).toHaveClass(/open/);
});

test("Login inválido mantém painel bloqueado e Google sem configuração informa indisponibilidade", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(page.locator("#loginModal")).toHaveClass(/open/);
  await page.locator("#loginPinInput").fill("9999");
  await page.getByRole("button", { name: "Entrar com PIN" }).click();
  await expect(page.locator("#loginModal")).toHaveClass(/open/);
  await expect(page.locator("#tabBtn-import")).toBeHidden();
  await expect(page.locator("#adminGoogleLoginButton")).toBeDisabled();
  await expect(page.locator("[data-google-status]")).not.toBeEmpty();
});
