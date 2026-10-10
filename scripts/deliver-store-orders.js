const { FirestoreRepository } = require("../src/database/firestore.repository");
const { StoreRepository } = require("../src/storefront/repository");
const { identifier, ensure } = require("../src/storefront/validation");
const { deliverOrder } = require("../src/storefront/order-delivery");
async function main() {
  const tenantId = identifier(process.argv[2]);
  const firestore = new FirestoreRepository().firestore;
  ensure(firestore, "Firestore obrigatório.");
  const repo = new StoreRepository({ firestore });
  const snapshot = await firestore
    .collection(`stores/${tenantId}/outbox`)
    .where("status", "in", ["PENDING", "SENDING"])
    .limit(100)
    .get();
  for (const document of snapshot.docs) {
    await deliverOrder(repo, tenantId, document.id);
  }
  console.log(`${snapshot.size} eventos verificados para ${tenantId}.`);
}
if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
