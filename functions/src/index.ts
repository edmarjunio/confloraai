/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {initializeApp} from "firebase-admin/app";
import {getFirestore} from "firebase-admin/firestore";
import {createHash} from "node:crypto";
// import {onRequest} from "firebase-functions/https";
// import * as logger from "firebase-functions/logger";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({maxInstances: 10});

initializeApp();
// Identity-only invalidation; stale events cannot publish their old product payload.
// Disabled until an ADMIN explicitly authorizes the first synchronization.
export const queueWhatsAppProduct = onDocumentWritten({document: "products/{productId}", region: "southamerica-east1", retry: true}, async (event) => {
  const db = getFirestore();
  const settings = await db.doc("store_settings/whatsapp_commerce").get();
  if (!settings.data()?.enabled || !settings.data()?.initialSyncAuthorizedAt) return;
  const productId = event.params.productId;
  const id = "meta-product-" + createHash("sha256").update(JSON.stringify(productId)).digest("hex");
  const ref = db.doc(`pdv_outbox/${id}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const old = snap.data() || {};
    const leased = Number(old.leaseUntil || 0) > Date.now();
    tx.set(ref, {...old, id, productId, kind: "meta-product-sync",
      requestedGeneration: Number(old.requestedGeneration || 0) + 1,
      status: leased ? old.status : "CATALOG_PENDING", attempts: leased ? old.attempts : 0,
      nextAttemptAt: 0, updatedAt: new Date().toISOString(), requestedBy: "product-trigger"});
  });
});

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
