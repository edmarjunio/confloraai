// Run deliberately: node scripts/provision-store.js <slug> <name> <admin-email> [--import-legacy]
// Password comes from STORE_ADMIN_PASSWORD, never from command-line arguments.
const { FirestoreRepository } = require("../src/database/firestore.repository");
const { StoreRepository } = require("../src/storefront/repository");
const { defaultStoreConfig } = require("../src/storefront/default-config");
const { hashPassword } = require("../src/storefront/auth");
const {
  identifier,
  ensure,
  digest,
  validateProduct,
  validateConfig,
} = require("../src/storefront/validation");
const fs = require("node:fs");

async function provision() {
  const [slugArg, name, emailArg, ...flags] = process.argv.slice(2);
  const slug = identifier(slugArg);
  const email = (emailArg || "").trim().toLowerCase();
  ensure(
    name && email.includes("@"),
    "Informe slug, nome e e-mail do administrador.",
  );
  const passwordHash = await hashPassword(process.env.STORE_ADMIN_PASSWORD);
  const legacy = new FirestoreRepository();
  ensure(legacy.firestore, "Firestore obrigatório para provisionamento.");
  const repo = new StoreRepository({ firestore: legacy.firestore });
  ensure(
    !(await repo.config(slug)),
    "Loja já existe; nenhum dado foi sobrescrito.",
    409,
  );
  const configFile = flags
    .find((flag) => flag.startsWith("--config="))
    ?.slice(9);
  let config = configFile
    ? validateConfig(
        { ...JSON.parse(fs.readFileSync(configFile, "utf8")), slug },
        slug,
      )
    : defaultStoreConfig(slug, name);
  const products = [];
  const photos = [];
  if (flags.includes("--import-legacy")) {
    const categories = new Map();
    const [productSnapshot, photoSnapshot] = await Promise.all([
      legacy.firestore.collection("products").get(),
      legacy.firestore.collection("product_images").get(),
    ]);
    const photoIds = new Map();
    for (const doc of photoSnapshot.docs) {
      const photo = doc.data();
      if (
        !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          photo.contentType,
        ) ||
        !photo.data
      ) {
        continue;
      }
      const id = digest(doc.id);
      photoIds.set(doc.id, id);
      photos.push({ id, data: photo.data, contentType: photo.contentType });
    }
    const mapImage = (url) => {
      if (typeof url !== "string") {
        return "";
      }
      if (/^https:\/\//.test(url)) {
        return url;
      }
      const photoId = photoIds.get(url.replace(/^\/api\/images\//, ""));
      return photoId ? `/api/stores/${slug}/images/${photoId}` : "";
    };
    for (const document of productSnapshot.docs) {
      const item = { ...document.data(), id: document.id };
      const categoryName = item.category || item.categoria || "Geral";
      const categoryId = digest(categoryName).slice(0, 16);
      categories.set(categoryId, {
        id: categoryId,
        name: categoryName,
        order: categories.size,
        isActive: true,
      });
      const unit = item.unit || item.unidade || "UN";
      products.push({
        id: /^[\w-]+$/.test(String(item.id))
          ? String(item.id)
          : digest(String(item.id)),
        name: item.name || item.descricao,
        description: item.description || item.descriptionAi || "",
        price: {
          amountMinor: Math.round(
            Number(item.price ?? item.valor_num ?? 0) * 100,
          ),
        },
        imageUrl: mapImage(item.imageUrl || item.imageurl),
        images: (item.images || [])
          .map(mapImage)
          .filter(Boolean)
          .map((url) => ({ url, alt: item.name || item.descricao || "" })),
        categories: [categoryId],
        tags: [],
        specifications: {},
        contentSections: [],
        isAvailable: item.status !== "INATIVO",
        stock: {
          tracked: true,
          quantity: Math.max(
            0,
            Number(item.stockQuantity ?? item.estoque ?? 0),
          ),
        },
        saleUnit: {
          code: unit,
          label: unit,
          minimum: unit === "KG" ? 0.1 : 1,
          increment: unit === "KG" ? 0.1 : 1,
        },
      });
    }
    config.categories = [...categories.values()];
  }
  config = validateConfig(config, slug);
  const validatedProducts = products.map((product) =>
    validateProduct(product, slug, config),
  );
  // Publish publicConfig last: partially imported stores cannot be browsed or accept orders.
  for (const photo of photos) {
    await repo.put(slug, "images", photo.id, photo);
  }
  for (const product of validatedProducts) {
    await repo.put(slug, "products", product.id, product);
  }
  await repo.atomic(slug, async (tx) => {
    ensure(
      !(await tx.get("publicConfig", "current")),
      "Loja já existe; nenhum dado foi sobrescrito.",
      409,
    );
    tx.put("publicConfig", "current", config);
    tx.put("privateConfig", "current", {
      assistant: { persona: "", instructions: "", webSearchEnabled: false },
    });
    tx.put("users", digest(email), {
      id: digest(email),
      email,
      name: "Administrador",
      passwordHash,
      role: "ADMIN",
      active: true,
    });
  });
  console.log(
    `Loja criada: /shop/${slug}. ${products.length} produtos importados. Configure logística, PIX e identidade no painel.`,
  );
}
if (require.main === module) {
  provision().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
module.exports = { provision };
