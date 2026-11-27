const { getAdmin } = require("../../lib/firebase-admin");
const MAX_FOUNDERS = 100;
function createdAtMillis(value) {
  if (value && typeof value.toMillis === "function") return value.toMillis();
  if (value && typeof value.toDate === "function") return value.toDate().getTime();
  if (value) { const parsed = new Date(value).getTime(); if (Number.isFinite(parsed)) return parsed; }
  return Number.MAX_SAFE_INTEGER;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée." });
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Connexion requise." });
    const admin = getAdmin();
    const decoded = await admin.auth().verifyIdToken(token, true);
    const db = admin.firestore();
    const profileRef = db.collection("profiles").doc(decoded.uid);
    const counterRef = db.collection("system_counters").doc("independent_founders");
    const publicRef = db.collection("public_directory").doc(decoded.uid);

    const result = await db.runTransaction(async (transaction) => {
      const [profileSnap, counterSnap] = await Promise.all([transaction.get(profileRef), transaction.get(counterRef)]);
      if (!profileSnap.exists || profileSnap.data().account_type === "entreprise") {
        return { founder: false, founderNumber: null, assigned: counterSnap.exists ? Number(counterSnap.data().assigned || 0) : 0 };
      }
      const profile = profileSnap.data() || {};
      const existingNumber = Number(profile.founder_number);
      if (Number.isInteger(existingNumber) && existingNumber >= 1 && existingNumber <= MAX_FOUNDERS) {
        return { founder: true, founderNumber: existingNumber, assigned: counterSnap.exists ? Number(counterSnap.data().assigned || 0) : existingNumber };
      }

      if (!counterSnap.exists) {
        const querySnap = await transaction.get(db.collection("profiles"));
        const candidates = querySnap.docs.filter((candidate) => candidate.data().account_type !== "entreprise").sort((a, b) => {
          const difference = createdAtMillis(a.data().created_at) - createdAtMillis(b.data().created_at);
          return difference || a.id.localeCompare(b.id);
        });
        const eligible = candidates.slice(0, MAX_FOUNDERS);
        const publicSnapshots = await Promise.all(eligible.map((candidate) => transaction.get(db.collection("public_directory").doc(candidate.id))));
        let currentNumber = null;
        eligible.forEach((candidate, index) => {
          const founderNumber = index + 1;
          transaction.update(candidate.ref, { founder_number: founderNumber, founder_since: admin.firestore.FieldValue.serverTimestamp() });
          if (publicSnapshots[index].exists) transaction.set(publicSnapshots[index].ref, { founder_number: founderNumber }, { merge: true });
          if (candidate.id === decoded.uid) currentNumber = founderNumber;
        });
        transaction.set(counterRef, { assigned: eligible.length, updated_at: admin.firestore.FieldValue.serverTimestamp() });
        return { founder: currentNumber !== null, founderNumber: currentNumber, assigned: eligible.length };
      }

      const assigned = Math.max(0, Number(counterSnap.data().assigned || 0));
      if (assigned >= MAX_FOUNDERS) return { founder: false, founderNumber: null, assigned: MAX_FOUNDERS };
      const publicSnap = await transaction.get(publicRef);
      const nextNumber = assigned + 1;
      transaction.update(profileRef, { founder_number: nextNumber, founder_since: admin.firestore.FieldValue.serverTimestamp() });
      if (publicSnap.exists) transaction.set(publicRef, { founder_number: nextNumber }, { merge: true });
      transaction.set(counterRef, { assigned: nextNumber, updated_at: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return { founder: true, founderNumber: nextNumber, assigned: nextNumber };
    });
    return res.status(200).json({ ...result, foundersRemaining: Math.max(0, MAX_FOUNDERS - Number(result.assigned || 0)) });
  } catch (error) {
    console.error("Attribution membre fondateur RenfortPro:", error);
    return res.status(500).json({ error: "Impossible d'attribuer le statut de membre fondateur." });
  }
};