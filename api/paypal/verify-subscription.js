const { send, getUser, paypalToken, paypalPlanId } = require("../../lib/paypal");
const { getAdmin } = require("../../lib/firebase-admin");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Méthode non autorisée." });
  try {
    const user = await getUser(req);
    const subscriptionId = String((req.body || {}).subscriptionId || "").trim();
    if (!subscriptionId || !/^[A-Z0-9-]{8,}$/i.test(subscriptionId)) {
      return send(res, 400, { error: "Identifiant d'abonnement invalide." });
    }
    const planId = paypalPlanId();
    if (!planId) return send(res, 500, { error: "Identifiant du forfait PayPal manquant." });

    const { accessToken, base } = await paypalToken();
    const response = await fetch(base + "/v1/billing/subscriptions/" + encodeURIComponent(subscriptionId), {
      headers: { Authorization: "Bearer " + accessToken }
    });
    const subscription = await response.json();
    if (!response.ok) return send(res, 502, { error: "Vérification PayPal impossible." });

    if (subscription.custom_id !== user.localId || subscription.plan_id !== planId) {
      return send(res, 403, { error: "Cet abonnement ne correspond pas à ce compte RenfortPro." });
    }

    const admin = getAdmin();
    await admin.firestore().collection("profiles").doc(user.localId).set({
      paypal_subscription_id: subscription.id,
      paypal_subscription_status: subscription.status,
      paypal_subscription_start_time: subscription.start_time || null,
      paypal_subscription_updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return send(res, 200, {
      active: subscription.status === "ACTIVE",
      status: subscription.status,
      subscriptionId: subscription.id
    });
  } catch (error) {
    console.error("Vérification abonnement PayPal RenfortPro:", error);
    return send(res, 500, { error: error.message || "Vérification impossible." });
  }
};
