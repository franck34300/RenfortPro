const { getAdmin } = require("../../lib/firebase-admin");
const { paypalToken } = require("../../lib/paypal");

const ADMIN_EMAIL = "renfortpro.contact@gmail.com";

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET") return res.status(405).json({ error: "Méthode non autorisée." });
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Connexion requise." });

    const admin = getAdmin();
    const decoded = await admin.auth().verifyIdToken(token, true);
    if (!decoded.email || decoded.email.toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Accès réservé à l'administration RenfortPro." });
    }

    const db = admin.firestore();
    const snapshot = await db.collection("profiles").get();
    const planId = process.env.PAYPAL_PLAN_ID;
    if (!planId) throw new Error("PAYPAL_PLAN_ID manquant.");

    // Une entreprise ne compte que si son abonnement PayPal est réellement actif.
    const companyCandidates = snapshot.docs.filter((doc) => {
      const data = doc.data() || {};
      return data.account_type === "entreprise" && String(data.paypal_subscription_id || "").trim();
    });
    const activeCompanyIds = new Set();
    if (companyCandidates.length) {
      const { accessToken, base } = await paypalToken();
      const checks = await Promise.all(companyCandidates.map(async (doc) => {
        const data = doc.data() || {};
        const subscriptionId = String(data.paypal_subscription_id || "").trim();
        const response = await fetch(base + "/v1/billing/subscriptions/" + encodeURIComponent(subscriptionId), {
          headers: { Authorization: "Bearer " + accessToken }
        });
        if (!response.ok) throw new Error("Vérification PayPal impossible pour une entreprise.");
        const subscription = await response.json();
        return subscription.status === "ACTIVE" &&
          subscription.plan_id === planId &&
          subscription.custom_id === doc.id ? doc.id : null;
      }));
      checks.filter(Boolean).forEach((id) => activeCompanyIds.add(id));
    }

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const buckets = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      buckets.push({
        key: date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0"),
        label: new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(date).replace(".", ""),
        count: 0
      });
    }

    let independents = 0;
    let companies = 0;
    let newThisMonth = 0;
    const recent = [];
    const monthKey = now.getUTCFullYear() + "-" + String(now.getUTCMonth() + 1).padStart(2, "0");

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const isCompany = data.account_type === "entreprise";
      if (isCompany && !activeCompanyIds.has(doc.id)) return;
      const type = isCompany ? "entreprise" : "independant";
      if (type === "entreprise") companies++;
      else independents++;

      let created = null;
      if (data.created_at && typeof data.created_at.toDate === "function") created = data.created_at.toDate();
      else if (data.created_at) {
        const parsed = new Date(data.created_at);
        if (!Number.isNaN(parsed.getTime())) created = parsed;
      }
      if (!created) return;

      const key = created.getUTCFullYear() + "-" + String(created.getUTCMonth() + 1).padStart(2, "0");
      const bucket = buckets.find((item) => item.key === key);
      if (bucket) bucket.count++;
      if (key === monthKey) newThisMonth++;

      recent.push({
        type,
        label: type === "entreprise" ? (data.company_name || data.full_name || "Entreprise") : (data.full_name || "Indépendant"),
        city: data.city || "",
        timestamp: created.getTime(),
        date: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(created)
      });
    });

    recent.sort((a, b) => b.timestamp - a.timestamp);
    return res.status(200).json({
      total: independents + companies,
      independents,
      companies,
      newThisMonth,
      months: buckets.map(({ label, count }) => ({ label, count })),
      recent: recent.slice(0, 5).map(({ type, label, city, date }) => ({ type, label, city, date }))
    });
  } catch (error) {
    console.error("Statistiques administrateur RenfortPro:", error);
    return res.status(500).json({ error: "Impossible de charger les statistiques pour le moment." });
  }
};
