const FIREBASE_API_KEY = "AIzaSyAY9foPoP3fEgjXw0bCz0AnbKaC8cuvVaE";

function send(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json").send(body);
}

async function getUser(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("Connexion Firebase requise.");
  const response = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_API_KEY,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }) }
  );
  const data = await response.json();
  if (!response.ok || !data.users || !data.users[0]) throw new Error("Session expirée. Reconnectez-vous.");
  return data.users[0];
}

function paypalPlanId() {
  return process.env.PAYPAL_PLAN_ID || process.env.ID_PAYPAL_PLAN || "";
}

async function paypalToken() {
  const id = process.env.PAYPAL_CLIENT_ID || process.env.ID_CLIENT_PAYPAL;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  const mode = String(process.env.PAYPAL_MODE || process.env["MODE PAYPAL"] || "").trim().toLowerCase();
  if (!id || !secret) throw new Error("Identifiants PayPal absents dans les variables Vercel.");
  const base = mode === "live" || mode === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
  const response = await fetch(base + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error("Authentification PayPal impossible.");
  return { accessToken: data.access_token, base };
}

module.exports = { send, getUser, paypalToken, paypalPlanId };
