const { getAdmin } = require("../../lib/firebase-admin");
const ADMIN_EMAIL = "renfortpro.contact@gmail.com";

function toDate(value) {
  if (value && typeof value.toDate === "function") return value.toDate();
  if (value) { const parsed = new Date(value); if (!Number.isNaN(parsed.getTime())) return parsed; }
  return null;
}
function isCompleteProfile(data, isCompany) {
  if (isCompany) return Boolean(String(data.company_name || "").trim() && String(data.full_name || "").trim() && String(data.city || "").trim());
  return Boolean(String(data.full_name || "").trim() && String(data.skills || "").trim() && String(data.city || "").trim());
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
    if (!decoded.email || decoded.email.toLowerCase() !== ADMIN_EMAIL) return res.status(403).json({ error: "Accès réservé à l'administration RenfortPro." });

    const snapshot = await admin.firestore().collection("profiles").get();
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
    const buckets = [];
    for (let i = 0; i < 6; i++) {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
      buckets.push({ key: date.getUTCFullYear() + "-" + String(date.getUTCMonth() + 1).padStart(2, "0"), label: new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" }).format(date).replace(".", ""), count: 0 });
    }

    let independents = 0, companies = 0, completeProfiles = 0, completeIndependents = 0, completeCompanies = 0, founders = 0, newThisMonth = 0;
    const recent = [];
    const monthKey = now.getUTCFullYear() + "-" + String(now.getUTCMonth() + 1).padStart(2, "0");
    snapshot.forEach((profileDoc) => {
      const data = profileDoc.data() || {};
      const isCompany = data.account_type === "entreprise";
      const isIndependent = data.account_type === "independant";
      if (!isCompany && !isIndependent) return;
      if (isCompany) companies++; else independents++;
      const complete = isCompany
        ? Boolean(String(data.company_name || "").trim() && String(data.full_name || "").trim() && String(data.city || "").trim())
        : Boolean(String(data.full_name || "").trim() && String(data.skills || "").trim() && String(data.city || "").trim());
      if (complete) { completeProfiles++; if (isCompany) completeCompanies++; else completeIndependents++; }
      const founderNumber = Number(data.founder_number);
      if (isIndependent && Number.isInteger(founderNumber) && founderNumber >= 1 && founderNumber <= 100) founders++;
      const created = toDate(data.created_at);
      if (!created) return;
      const key = created.getUTCFullYear() + "-" + String(created.getUTCMonth() + 1).padStart(2, "0");
      const bucket = buckets.find((item) => item.key === key);
      if (bucket) bucket.count++;
      if (key === monthKey) newThisMonth++;
      recent.push({
        type: isCompany ? "entreprise" : "independant",
        label: isCompany ? (data.company_name || data.full_name || "Entreprise") : (data.full_name || "Indépendant"),
        city: data.city || "", timestamp: created.getTime(),
        date: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(created)
      });
    });
    recent.sort((a, b) => b.timestamp - a.timestamp);
    return res.status(200).json({
      total: independents + companies, independents, companies, completeProfiles, completeIndependents, completeCompanies,
      founders, foundersRemaining: Math.max(0, 100 - founders), newThisMonth,
      months: buckets.map(({ label, count }) => ({ label, count })),
      recent: recent.slice(0, 5).map(({ type, label, city, date }) => ({ type, label, city, date }))
    });
  } catch (error) {
    console.error("Statistiques administrateur RenfortPro:", error);
    return res.status(500).json({ error: "Impossible de charger les statistiques pour le moment." });
  }
};