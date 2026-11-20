const { send, getUser, paypalToken } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Méthode non autorisée." });
  try {
    const user = await getUser(req);
    const subscriptionId = String((req.body || {}).subscriptionId || "").trim();
    if (!subscriptionId || !/^[A-Z0-9-]{8,}$/i.test(subscriptionId)) {
      return send(res, 400, { error: "Identifiant d'abonnement invalide." });
    }
    const planId = process.env.PAYPAL_PLAN_ID;
    if (!planId) return send(res, 500, { error: "Identifiant du forfait PayPal manquant." });

    const { accessToken, base } = await paypalToken();
    const response = await fetch(base + "/v1/billing/subscriptions/" + encodeURIComponent(subscriptionId), {
      headers: { Authorization: "Bearer " + accessToken }
    });
    const subscription = await response.json();
    if (!response.ok) return send(res, 502, { error: "Vérification PayPal impossible." });

    // Le custom_id lie l'abonnement au compte Firebase connecté.
    if (subscription.custom_id !== user.localId || subscription.plan_id !== planId) {
      return send(res, 403, { error: "Cet abonnement ne correspond pas à ce compte RenfortPro." });
    }
    return send(res, 200, {
      active: subscription.status === "ACTIVE",
      status: subscription.status,
      subscriptionId: subscription.id
    });
  } catch (error) {
    return send(res, 401, { error: error.message || "Vérification impossible." });
  }
};
