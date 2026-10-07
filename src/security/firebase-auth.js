const { initializeApp, getApps, cert, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const config = require('../config/env');

/** Verify a Firebase ID token using the configured project's credentials. */
async function verifyFirebaseToken(idToken) {
  const app = getApps().find((entry) => entry.name === 'conflora-auth') || initializeApp({
    projectId: config.firebase.projectId,
    credential: config.gcp.keyFilename ? cert(config.gcp.keyFilename) : applicationDefault(),
  }, 'conflora-auth');
  return getAuth(app).verifyIdToken(idToken);
}

module.exports = { verifyFirebaseToken };
