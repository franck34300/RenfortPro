const admin = require("firebase-admin");

function getAdmin() {
  if (admin.apps.length) return admin;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("Configuration Firebase serveur manquante (FIREBASE_SERVICE_ACCOUNT).");
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error("La variable FIREBASE_SERVICE_ACCOUNT doit contenir le JSON du compte de service Firebase.");
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  return admin;
}

module.exports = { getAdmin };
