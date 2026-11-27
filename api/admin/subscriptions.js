const { getAdmin } = require("../../lib/firebase-admin");
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
    const [profilesSnapshot, companySnapshot] = await Promise.all([
      db.collection("profiles").get(),
      db.collection("company_profiles").get()
    ]);
    const companyProfiles = new Map();
    companySnapshot.forEach(doc => companyProfiles.set(doc.id, doc.data() || {}));

    const companies = [];
    const knownProfileIds = new Set();
    profilesSnapshot.forEach(doc => {
      knownProfileIds.add(doc.id);
      const profile = doc.data() || {};
      // Le type du compte dans profiles fait foi : un indépendant ne doit
      // jamais être reclassé en entreprise à cause d'un ancien document lié.
      if (profile.account_type !== "entreprise") return;
      const companyProfile = companyProfiles.get(doc.id) || {};
      companies.push({
        name: companyProfile.company_name || profile.company_name || profile.full_name || "Entreprise sans nom",
        city: companyProfile.city || profile.city || "",
        subscribed: Boolean(String(profile.paypal_subscription_id || "").trim())
      });
    });
    // Compatibilité avec les anciens dossiers entreprise sans profil principal.
    companySnapshot.forEach(doc => {
      if (knownProfileIds.has(doc.id)) return;
      const companyProfile = doc.data() || {};
      companies.push({
        name: companyProfile.company_name || companyProfile.full_name || "Entreprise sans nom",
        city: companyProfile.city || "",
        subscribed: Boolean(String(companyProfile.paypal_subscription_id || "").trim())
      });
    });
    companies.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return res.status(200).json({
      companies,
      summary: {
        companies: companies.length,
        subscribed: companies.filter(company => company.subscribed).length
      }
    });
  } catch (error) {
    console.error("Suivi des entreprises RenfortPro:", error);
    return res.status(500).json({ error: "Impossible de charger les entreprises." });
  }
};
