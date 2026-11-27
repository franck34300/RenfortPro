import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAY9foPoP3fEgjXw0bCz0AnbKaC8cuvVaE",
  authDomain: "renfortpro.firebaseapp.com",
  projectId: "renfortpro",
  storageBucket: "renfortpro.firebasestorage.app",
  messagingSenderId: "297512900802",
  appId: "1:297512900802:web:931eaf625d425db314035b"
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
let currentProfile = null;
let subscriptionActive = false;
let paymentBox = null;
window.__renfortproCompanyAccess = false;

function ensurePaymentBox() {
  const panel = document.querySelector("#account-panel");
  if (!panel || paymentBox) return;
  paymentBox = document.createElement("section");
  paymentBox.id = "renfortpro-payment";
  paymentBox.className = "media-setting";
  paymentBox.style.cssText = "margin:18px 0;padding:20px;border:1px solid #d8dfd7;border-radius:14px;background:#f5f8f3;text-align:left";
  paymentBox.innerHTML = `
    <p class="eyebrow">Accès entreprise</p>
    <h4 style="margin:0 0 8px;color:#194631;font-size:19px">Activez votre espace entreprise</h4>
    <p style="margin:0 0 10px;line-height:1.5">Abonnement de 10 € par mois, renouvelé automatiquement selon les conditions du forfait PayPal. Le montant et la périodicité du forfait sont présentés sur la page PayPal avant votre validation.</p>
    <p style="font-size:12px;color:#66716a;margin:0 0 14px">Vous pouvez continuer à utiliser votre espace indépendant gratuitement. Aucun accès entreprise ne sera ouvert avant confirmation de l'abonnement.</p>
    <button type="button" class="button button-dark" id="renfortpro-pay-button">Payer avec PayPal</button>
    <p id="renfortpro-pay-message" class="auth-message" role="status"></p>
  `;
  const media = panel.querySelector(".account-media-settings");
  panel.insertBefore(paymentBox, media || panel.querySelector("#logout-button"));
  paymentBox.querySelector("#renfortpro-pay-button").addEventListener("click", startSubscription);
}

// Expose a safe UI helper so profile-access refusals can reveal the subscription panel.
window.__renfortproShowPayment = function() {
  ensurePaymentBox();
  if (!paymentBox) return;
  paymentBox.hidden = false;
  paymentBox.scrollIntoView({ behavior: "smooth", block: "center" });
};

function paymentMessage(message, error = false) {
  const target = document.querySelector("#renfortpro-pay-message");
  if (target) {
    target.textContent = message;
    target.classList.toggle("is-error", error);
  }
}

async function apiPost(path, body = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Connectez-vous à votre compte RenfortPro.");
  const token = await user.getIdToken();
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Une erreur est survenue.");
  return data;
}

async function startSubscription() {
  const button = document.querySelector("#renfortpro-pay-button");
  button.disabled = true;
  paymentMessage("Préparation de votre paiement sécurisé…");
  try {
    const result = await apiPost("/api/paypal/create-subscription");
    window.location.assign(result.approvalUrl);
  } catch (error) {
    paymentMessage(error.message, true);
    button.disabled = false;
  }
}

async function verifyAndDisplay(subscriptionId) {
  const result = await apiPost("/api/paypal/verify-subscription", { subscriptionId });
  if (!result.active) {
    paymentMessage("PayPal indique que l'abonnement n'est pas encore actif (" + result.status + ").");
    return false;
  }
  subscriptionActive = true;
  window.__renfortproCompanyAccess = true;
  paymentBox.hidden = true;
  const companyBox = document.querySelector("#company-space-setting");
  const addCompanyButton = document.querySelector("#show-company-space");
  if (companyBox && currentProfile?.account_type === "entreprise") companyBox.hidden = false;
  if (addCompanyButton && currentProfile?.account_type !== "entreprise") addCompanyButton.hidden = false;
  return true;
}

async function handleReturn(user) {
  const params = new URLSearchParams(window.location.search);
  const returnedId = params.get("subscription_id");
  if (params.get("paypal") === "success" && returnedId) {
    paymentMessage("Confirmation de votre abonnement auprès de PayPal…");
    try {
      await verifyAndDisplay(returnedId);
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
    } catch (error) {
      paymentMessage(error.message, true);
    }
  } else if (params.get("paypal") === "cancel") {
    paymentMessage("Paiement annulé. Aucun accès entreprise n'a été activé.");
    window.history.replaceState({}, "", window.location.pathname + window.location.hash);
  }
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    currentProfile = null;
    subscriptionActive = false;
    return;
  }
  try {
    const snap = await getDoc(doc(db, "profiles", user.uid));
    currentProfile = snap.exists() ? snap.data() : null;
    if (!currentProfile) return;
    const isCompany = currentProfile.account_type === "entreprise";
    const companySnap = await getDoc(doc(db, "company_profiles", user.uid));
    const hasCompanyProfile = companySnap.exists();
    const companyButton = document.querySelector("#show-company-space");
    const companyBox = document.querySelector("#company-space-setting");
    ensurePaymentBox();

    // Un indépendant conserve son accès gratuit. Le paiement n'est demandé
    // que s'il choisit d'ajouter un espace entreprise.
    if (!isCompany && companyButton) {
      companyButton.hidden = false;
      companyButton.addEventListener("click", event => {
        if (subscriptionActive) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        paymentBox.hidden = false;
        paymentBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }, true);
    }

    if (companyBox) companyBox.hidden = true;
    paymentBox.hidden = !(isCompany || hasCompanyProfile);

    const params = new URLSearchParams(window.location.search);
    const subscriptionId = params.get("subscription_id") || currentProfile.paypal_subscription_id;
    if (subscriptionId) {
      const result = await apiPost("/api/paypal/verify-subscription", { subscriptionId });
      subscriptionActive = result.active;
      window.__renfortproCompanyAccess = result.active;
      if (result.active) {
        paymentBox.hidden = true;
        if ((isCompany || hasCompanyProfile) && companyBox) companyBox.hidden = false;
        if (!isCompany && companyButton) companyButton.hidden = false;
      } else {
        paymentBox.hidden = (isCompany || hasCompanyProfile) ? false : true;
        if (companyBox) companyBox.hidden = true;
      }
    } else if (isCompany) {
      paymentBox.hidden = false;
    }
    await handleReturn(user);
  } catch (error) {
    ensurePaymentBox();
    paymentBox.hidden = currentProfile?.account_type !== "entreprise";
    paymentMessage("Vérification de l'abonnement impossible : " + error.message, true);
    const companyBox = document.querySelector("#company-space-setting");
    window.__renfortproCompanyAccess = false;
    if (companyBox) companyBox.hidden = true;
  }
});
