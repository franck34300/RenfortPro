const { send, getUser, paypalToken } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Méthode non autorisée." });
  try {
    const user = await getUser(req);
    const planId = process.env.PAYPAL_PLAN_ID;
    if (!planId) return send(res, 500, { error: "Identifiant du forfait PayPal manquant (PAYPAL_PLAN_ID)." });

    const { accessToken, base } = await paypalToken();

    // Vérifie que le forfait configuré correspond bien à 10 EUR par mois.
    const planResponse = await fetch(base + "/v1/billing/plans/" + encodeURIComponent(planId), {
      headers: { Authorization: "Bearer " + accessToken }
    });
    const plan = await planResponse.json();
    if (!planResponse.ok) return send(res, 502, { error: "Impossible de vérifier le forfait PayPal." });

    const monthlyTenEuro = (plan.billing_cycles || []).some(cycle => {
      const frequency = cycle.frequency || {};
      const amount = cycle.pricing_scheme && cycle.pricing_scheme.fixed_price;
      return cycle.tenure_type === "REGULAR" &&
        frequency.interval_unit === "MONTH" &&
        Number(frequency.interval_count) === 1 &&
        amount && amount.currency_code === "EUR" &&
        Number(amount.value) === 10;
    });
    if (!monthlyTenEuro) {
      return send(res, 400, { error: "Le forfait PayPal configuré ne correspond pas à 10 EUR par mois. Vérifiez le forfait avant de poursuivre." });
    }

    const origin = req.headers.origin || ("https://" + req.headers.host);
    const response = await fetch(base + "/v1/billing/subscriptions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: user.localId,
        application_context: {
          brand_name: "RenfortPro",
          locale: "fr-FR",
          user_action: "SUBSCRIBE_NOW",
          shipping_preference: "NO_SHIPPING",
          return_url: origin + "/?paypal=success",
          cancel_url: origin + "/?paypal=cancel"
        }
      })
    });
    const subscription = await response.json();
    if (!response.ok) return send(res, 502, { error: subscription.message || "PayPal n'a pas pu créer l'abonnement." });
    const approval = (subscription.links || []).find(link => link.rel === "approve");
    if (!approval || !subscription.id) return send(res, 502, { error: "Lien de validation PayPal introuvable." });
    return send(res, 200, { subscriptionId: subscription.id, approvalUrl: approval.href });
  } catch (error) {
    return send(res, 401, { error: error.message || "Impossible de créer l'abonnement." });
  }
};
