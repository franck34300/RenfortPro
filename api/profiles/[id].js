const { getAdmin } = require("../../lib/firebase-admin");
const { send, paypalToken } = require("../../lib/paypal");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Méthode non autorisée." });
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) return send(res, 401, { error: "Connectez-vous à votre compte entreprise." });

    const admin = getAdmin();
    const decoded = await admin.auth().verifyIdToken(token);
    const db = admin.firestore();
    const companyRef = db.collection("profiles").doc(decoded.uid);
    const companySnap = await companyRef.get();
    if (!companySnap.exists) return send(res, 403, { error: "Profil entreprise introuvable." });
    const company = companySnap.data() || {};
    const companySpaceSnap = await db.collection("company_profiles").doc(decoded.uid).get();
    if (company.account_type !== "entreprise" && !companySpaceSnap.exists) {
      return send(res, 403, { error: "L'accès aux profils complets est réservé aux entreprises abonnées." });
    }

    // Accès administrateur réservé à l'adresse RenfortPro vérifiée.
    const isRenfortProAdmin =
      String(decoded.email || "").toLowerCase() === "renfortpro.contact@gmail.com" &&
      decoded.email_verified === true;

    // Les entreprises clientes doivent toujours disposer d'un abonnement PayPal actif.
    if (!isRenfortProAdmin) {
      const subscriptionId = String(company.paypal_subscription_id || "").trim();
      const planId = process.env.PAYPAL_PLAN_ID;
      if (!subscriptionId || !planId) {
        return send(res, 403, { error: "Un abonnement entreprise actif est nécessaire pour consulter les profils complets." });
      }

      const { accessToken, base } = await paypalToken();
      const paypalResponse = await fetch(base + "/v1/billing/subscriptions/" + encodeURIComponent(subscriptionId), {
        headers: { Authorization: "Bearer " + accessToken }
      });
      const subscription = await paypalResponse.json();
      if (!paypalResponse.ok) return send(res, 502, { error: "La vérification de l'abonnement PayPal a échoué." });
      if (subscription.custom_id !== decoded.uid || subscription.plan_id !== planId || subscription.status !== "ACTIVE") {
        return send(res, 403, { error: "Votre abonnement PayPal n'est pas actif. L'accès aux profils complets est suspendu." });
      }
    }

    const profileId = String(req.query.id || "").trim();
    if (!profileId || profileId.length > 128) return send(res, 400, { error: "Identifiant de profil invalide." });
    const profileSnap = await db.collection("profiles").doc(profileId).get();
    if (!profileSnap.exists || profileSnap.data()?.account_type !== "independant") {
      return send(res, 404, { error: "Ce profil professionnel n'est plus disponible." });
    }

    const data = profileSnap.data();
    return send(res, 200, {
      profile: {
        full_name: data.full_name || "",
        skills: data.skills || "",
        description: data.description || "",
        experience: data.experience || "",
        rate: data.rate || "",
        city: data.city || "",
        availability: data.availability || "À convenir",
        available_date: data.available_date || "",
        work_time: data.work_time || "",
        available_days: data.available_days || "",
        available_hours: data.available_hours || "",
        mission_duration: data.mission_duration || "",
        mobility: data.mobility || "",
        permits: data.permits || "",
        equipment: data.equipment || "",
        avatar_url: data.avatar_url || "",
        phone: data.phone || "",
        email: data.email || ""
      }
    });
  } catch (error) {
    console.error("Accès profil RenfortPro:", error);
    return send(res, 500, { error: error.message || "Impossible de charger ce profil." });
  }
};
