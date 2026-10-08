process.env.APP_TEST_MODE = "local";
process.env.NODE_ENV = "test";
const path = require("node:path");
const { LocalDatabase } = require("../src/testing/local-database");
const { FirestoreRepository } = require("../src/database/firestore.repository");
const { CatalogRepository } = require("../src/catalog/catalog.repository");
const { createApp } = require("../src/http/app");
async function start() {
  const directory = path.resolve(
    process.env.LOCAL_TEST_DATA_DIR || ".local-test-data",
  );
  const db = new LocalDatabase(directory);
  const repo = new FirestoreRepository({
    firestoreInstance: db,
    isInMemory: true,
  });
  repo.isLocalTest = true;
  if ((await db.collection("users").get()).empty) {
    await repo.saveUser({
      id: "test-admin",
      name: "Administrador de teste",
      email: "admin@test.invalid",
      pin: "1234",
      role: "ADMIN",
      active: true,
    });
    await repo.saveUser({
      id: "test-cashier",
      name: "Operador de teste",
      email: "cashier@test.invalid",
      pin: "1234",
      role: "CAIXA",
      active: true,
    });
  }
  if (
    (await db.collection("products").get()).empty &&
    !(await db.collection("catalog_settings").doc("current").get()).exists
  ) {
    await repo.saveProduct({
      id: "demo-plant",
      name: "Planta de teste",
      canonicalName: "Planta de teste",
      price: 45,
      category: "Teste",
      status: "ATIVO",
      stockQuantity: 10,
      estoque: 10,
      stockVersion: 0,
    });
  }
  const catalogRepo = new CatalogRepository({ firestoreRepo: repo });
  await catalogRepo.refreshCatalog();
  const disabled = async () => ({ success: true, simulated: true });
  const messageService = {
    firestoreRepo: repo,
    catalogRepo,
    whatsappClient: {
      sendTextMessage: disabled,
      sendImageMessage: disabled,
      markAsRead: disabled,
    },
    handleCustomerMessage: async ({ message }) => ({
      reply: "Modo de teste: IA e WhatsApp desativados. " + message,
      simulated: true,
    }),
  };
  const app = createApp({
    messageService,
    taskQueueClient: { enqueueCustomerMessage: disabled },
  });
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "127.0.0.1";
  const server = app.listen(port, host, () =>
    console.log(
      "Teste local: http://localhost:" +
        port +
        " | ADMIN/CAIXA: PIN 1234 | sem conexão com produção.",
    ),
  );
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
start().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
