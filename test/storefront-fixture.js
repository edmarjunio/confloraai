const { defaultStoreConfig } = require("../src/storefront/default-config");
const { validateProduct, digest } = require("../src/storefront/validation");
const { hashPassword } = require("../src/storefront/auth");

async function seedStores(repo) {
  const passwordHash = await hashPassword("test-password-123");
  for (const [slug, name, niche, productName] of [
    ["garden", "Jardim Local", "Viveiro", "Manjericão"],
    ["pets", "Casa Pet", "Pet shop", "Ração para gatos"],
  ]) {
    const config = defaultStoreConfig(slug, name);
    config.identity.niche = niche;
    config.identity.city = "Mineiros";
    config.identity.region = "GO";
    config.categories = [{ id: "main", name: niche, order: 0, isActive: true }];
    config.checkout.enabledPayments = ["PIX", "CARD", "CASH"];
    config.checkout.pix = {
      key: "chave-ilustrativa-de-teste",
      recipientName: name,
    };
    config.checkout.delivery = {
      enabled: true,
      label: "Entrega local",
      serviceAreas: ["Centro"],
      feeMinor: 500,
    };
    config.checkout.pickup.address = "Endereço de teste";
    if (slug === "pets") {
      config.branding.colors.primary = "#2356A3";
    }
    await repo.put(slug, "publicConfig", "current", config);
    await repo.put(slug, "privateConfig", "current", {
      assistant: {
        persona: `Consultor ${niche}`,
        instructions: "Seja breve",
        webSearchEnabled: false,
      },
      integrations: { secret: "never-public" },
    });
    await repo.put(slug, "users", digest("admin@test.com"), {
      id: digest("admin@test.com"),
      email: "admin@test.com",
      name: "Admin",
      role: "ADMIN",
      active: true,
      passwordHash,
    });
    for (const [id, productTitle, price, stock] of [
      ["product-1", productName, 600, 10],
      ["product-2", slug === "garden" ? "Substrato" : "Brinquedo", 1800, 20],
    ]) {
      const product = validateProduct(
        {
          id,
          name: productTitle,
          description: `Produto de ${name}`,
          price: { amountMinor: price },
          categories: ["main"],
          tags: ["Qualidade"],
          specifications: {
            use: {
              label: "Uso",
              value: slug === "garden" ? "Sol direto" : "Gatos adultos",
            },
          },
          contentSections: [
            {
              id: "care",
              title: "Como usar",
              body: "Consulte as instruções do fabricante.",
            },
          ],
          isAvailable: true,
          stock: { tracked: true, quantity: stock },
          saleUnit: { code: "UN", label: "unidade", minimum: 1, increment: 1 },
        },
        slug,
        config,
      );
      await repo.put(slug, "products", id, product);
    }
  }
}
module.exports = { seedStores };
