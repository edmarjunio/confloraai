const { test, expect } = require("@playwright/test");
test("Conflora settings keep the official logo, save colors and support guided product selection on mobile", async ({
  page,
}) => {
  await page.request.post("/api/admin/auth/login", {
    data: { userId: "usr-edmar", pin: "1234" },
  });
  await page.request.post("/api/admin/products", {
    headers: { 'X-Product-Content-Confirmed': 'true' },
    data: {
      id: "glue-test",
      name: "Cola Multiuso 2m",
      category: "Construção",
      subcategory: "Adesivos",
      price: 12,
      stockQuantity: 10,
      status: "ATIVO",
      description: "Resistente à água conforme rótulo.",
      tagsAi: "adesivo, cola",
    },
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/configuracoes");
  if (await page.locator("#coachSkip").isVisible()) {
    await page.locator("#coachSkip").click();
  }
  const form = page.locator("#adminView form");
  await expect(form).toBeVisible();
  await form.locator("[name=name]").fill("Loja de Construção");
  await form.locator("[name=niche]").fill("Materiais de construção");
  await form.locator("[name=primary]").fill("#2345ab");
  await form.locator("[name=synonyms]").fill("cola, adesivo");
  await expect(form.locator("[name=logo]")).toHaveCount(0);
  await form.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.locator("#storeName")).toHaveText("Loja de Construção");
  await page.reload();
  await expect(page.locator("#logo")).toHaveAttribute(
    "src",
    /conflora-logo(?:-[a-f0-9]{16})?\.(?:png|webp)$/,
  );
  expect(
    await page
      .locator("html")
      .evaluate((node) => node.style.getPropertyValue("--primary-color")),
  ).toBe("#2345ab");
  await page.screenshot({
    path: "test-results/store-settings-mobile.png",
    fullPage: true,
  });
  let aiRequests = 0;
  page.on("request", (req) => {
    if (req.url().endsWith("/assistant")) {
      aiRequests++;
    }
  });
  await page.locator("#aiFab").click();
  await page
    .locator("#chatMessages")
    .getByRole("button", { name: "Construção", exact: true })
    .click();
  await page
    .locator("#chatMessages")
    .getByRole("button", { name: "Adesivos", exact: true })
    .click();
  await expect(page.locator("#chatMessages .guided-results-grid render-product-card")).toHaveCount(1);
  await page.locator("#chatInput").fill("cola multiuzo 2m");
  await page.locator("#chatForm").evaluate((chatForm) => chatForm.requestSubmit());
  await expect(page.locator("#chatMessages")).toContainText("nomes parecidos");
  const productCard = page.locator('#chatMessages render-product-card').filter({ hasText: 'Cola Multiuso 2m' });
  await productCard.locator('.chat-mini-photo').click();
  await expect(page.locator("#productView")).toContainText(
    "Resistente à água conforme rótulo.",
  );
  await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(page.locator("#cartButton")).toContainText("1");
  expect(aiRequests).toBe(0);
  expect(
    await page
      .locator("html")
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: "test-results/generic-guide-mobile.png" });
});
