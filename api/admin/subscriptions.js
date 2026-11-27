const { getAdmin } = require("../../lib/firebase-admin");
const { paypalToken, paypalPlanId } = require("../../lib/paypal");
const ADMIN_EMAIL = "renfortpro.contact@gmail.com";

const STATUS_LABELS = {
  ACTIVE: "Abonné actif",
  APPROVAL_PENDING: "En attente de validation",
  APPROVED: "Validation reçue",
  SUSPENDED: "Suspendu",
  CANCELLED: "Résilié",
  EXPIRED: "Expiré"
};

function dateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

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
    const [profilesSnapshot, companySnapshot] = await Promise.all([
      db.collection("profiles").get(),
      db.collection("company_profiles").get()
    ]);
    const companyProfiles = new Map();
    companySnapshot.forEach(doc => companyProfiles.set(doc.id, doc.data() || {}));

    const companies = [];
    profilesSnapshot.forEach(doc => {
      const profile = doc.data() || {};
      const companyProfile = companyProfiles.get(doc.id) || {};
      const subscriptionId = String(profile.paypal_subscription_id || "").trim();
      if (profile.account_type !== "entreprise" && !companyProfiles.has(doc.id) && !subscriptionId) return;

      companies.push({
        uid: doc.id,
        name: companyProfile.company_name || profile.company_name || profile.full_name || "Entreprise sans nom",
        city: companyProfile.city || profile.city || "",
        subscriptionId,
        storedStatus: profile.paypal_subscription_status || "",
        storedStart: profile.paypal_subscription_start_time || null,
        createdAt: profile.paypal_subscription_created_at || null
      });
    });

    let access = null;
    let planId = "";
    if (companies.some(company => company.subscriptionId)) {
      planId = paypalPlanId();
      if (!planId) throw new Error("Identifiant du forfait PayPal manquant dans les variables d'environnement.");
      access = await paypalToken();
    }

    const results = [];
    for (const company of companies) {
      if (!company.subscriptionId) {
        results.push({
          name: company.name,
          city: company.city,
          status: "NOT_SUBSCRIBED",
          statusLabel: "Non abonnée",
          startDate: null,
          nextBillingDate: null
        });
        continue;
      }

      try {
        const response = await fetch(access.base + "/v1/billing/subscriptions/" + encodeURIComponent(company.subscriptionId), {
          headers: { Authorization: "Bearer " + access.accessToken }
        });
        const subscription = await response.json();
        if (!response.ok) throw new Error("PayPal n'a pas pu vérifier cet abonnement.");
        if (subscription.custom_id !== company.uid || subscription.plan_id !== planId) {
          throw new Error("L'abonnement PayPal ne correspond pas au compte RenfortPro.");
        }
        const status = String(subscription.status || company.storedStatus || "UNKNOWN");
        results.push({
          name: company.name,
          city: company.city,
          status,
          statusLabel: STATUS_LABELS[status] || "Statut : " + status,
          startDate: dateValue(subscription.start_time) || dateValue(company.storedStart),
          nextBillingDate: dateValue(subscription.billing_info && subscription.billing_info.next_billing_time)
        });
      } catch (error) {
        console.error("Suivi abonnement PayPal RenfortPro:", company.uid, error);
        results.push({
          name: company.name,
          city: company.city,
          status: "UNAVAILABLE",
          statusLabel: "Vérification indisponible",
          startDate: dateValue(company.storedStart),
          nextBillingDate: null
        });
      }
    }

    results.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    const summary = {
      active: results.filter(item => item.status === "ACTIVE").length,
      pending: results.filter(item => item.status === "APPROVAL_PENDING" || item.status === "APPROVED").length,
      notSubscribed: results.filter(item => item.status === "NOT_SUBSCRIBED").length,
      other: results.filter(item => !["ACTIVE", "APPROVAL_PENDING", "APPROVED", "NOT_SUBSCRIBED"].includes(item.status)).length
    };
    return res.status(200).json({ companies: results, summary });
  } catch (error) {
    console.error("Suivi des abonnements administrateur RenfortPro:", error);
    return res.status(500).json({ error: error.message || "Impossible de charger les abonnements." });
  }
};
