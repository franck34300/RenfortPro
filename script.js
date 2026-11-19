const profileForm=document.querySelector('#profile-search');
profileForm?.addEventListener('submit',e=>{e.preventDefault();const skill=document.querySelector('#skill-filter').value.toLowerCase().trim();const place=document.querySelector('#location-filter').value.toLowerCase().trim();let shown=0;document.querySelectorAll('#profile-results .profile-card').forEach(card=>{const matchSkill=!skill||card.dataset.skill.includes(skill);const matchPlace=!place||card.dataset.location.includes(place);card.hidden=!(matchSkill&&matchPlace);if(!card.hidden)shown++;});document.querySelector('#profile-count').textContent=shown+' profil'+(shown>1?'s':'');});
const missionForm=document.querySelector('#mission-search');
missionForm?.addEventListener('submit',e=>{e.preventDefault();const skill=document.querySelector('#mission-skill').value.toLowerCase().trim();const place=document.querySelector('#mission-location').value.toLowerCase().trim();let shown=0;document.querySelectorAll('#mission-results .mission-card').forEach(card=>{const matchSkill=!skill||card.dataset.skill.includes(skill);const matchPlace=!place||card.dataset.location.includes(place);card.hidden=!(matchSkill&&matchPlace);if(!card.hidden)shown++;});let old=document.querySelector('#mission-count');if(!old){old=document.createElement('span');old.id='mission-count';document.querySelector('#mission-results').before(old);}old.textContent=shown+' mission'+(shown>1?'s':'')+' affichée'+(shown>1?'s':'');});
const menu=document.querySelector('.menu-toggle');menu?.addEventListener('click',()=>document.querySelector('.main-nav').classList.toggle('open'));

// Authentification RenfortPro — projet Supabase indépendant.
const SUPABASE_URL='https://bsuvuedqugpmvcklhmnu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_37MDF5o0IyLtddRl6zYC4Q_mmEYBF-S';
const authClient=window.supabase?.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
const signupForm=document.querySelector('#signup-form');
const loginForm=document.querySelector('#login-form');
const accountPanel=document.querySelector('#account-panel');
const signupMessage=document.querySelector('#signup-message');
const loginMessage=document.querySelector('#login-message');
const accountType=document.querySelector('#account-type');
const companyFields=document.querySelector('#company-fields');
const independentFields=document.querySelector('#independent-fields');

function showAuthMessage(target,message,isError=false){if(!target)return;target.textContent=message;target.classList.toggle('is-error',isError);}
function setAuthMode(mode){
  const signup=mode==='signup';
  signupForm.hidden=!signup;
  loginForm.hidden=signup;
  accountPanel.hidden=true;
  document.querySelector('#show-signup')?.classList.toggle('active',signup);
  document.querySelector('#show-login')?.classList.toggle('active',!signup);
}
document.querySelector('#show-signup')?.addEventListener('click',()=>setAuthMode('signup'));
document.querySelector('#show-login')?.addEventListener('click',()=>setAuthMode('login'));
accountType?.addEventListener('change',()=>{
  const isCompany=accountType.value==='entreprise';
  companyFields.hidden=!isCompany;
  independentFields.hidden=isCompany;
  document.querySelector('#company-name').required=isCompany;
  document.querySelector('#independent-skills').required=!isCompany;
});
accountType?.dispatchEvent(new Event('change'));

async function displayAccount(user){
  signupForm.hidden=true;
  loginForm.hidden=true;
  accountPanel.hidden=false;
  document.querySelector('#show-signup').classList.remove('active');
  document.querySelector('#show-login').classList.remove('active');
  const {data,error}=await authClient.from('profiles').select('account_type,full_name,company_name,city,skills,description').eq('id',user.id).single();
  if(error){
    document.querySelector('#account-welcome').textContent='Connexion réussie. Votre profil est en cours de chargement.';
    document.querySelector('#account-details').replaceChildren();
    return;
  }
  const isCompany=data.account_type==='entreprise';
  document.querySelector('#account-welcome').textContent='Bienvenue '+(data.full_name||user.email)+' !';
  const details=document.querySelector('#account-details');
  details.replaceChildren();
  const rows=[
    ['Type de compte',isCompany?'Entreprise':'Indépendant'],
    ...(isCompany?[['Entreprise',data.company_name]]:[['Compétences',data.skills],['Présentation',data.description]]),
    ['Ville',data.city]
  ];
  rows.filter(row=>row[1]).forEach(([label,value])=>{
    const dt=document.createElement('dt');dt.textContent=label;
    const dd=document.createElement('dd');dd.textContent=value;
    details.append(dt,dd);
  });
}
signupForm?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!authClient){showAuthMessage(signupMessage,'Le service de compte ne se charge pas. Actualisez la page.',true);return;}
  const type=accountType.value;
  const siret=document.querySelector('#company-siret').value.trim();
  if(type==='entreprise'&&siret&&!/^\d{14}$/.test(siret)){showAuthMessage(signupMessage,'Le SIRET doit contenir 14 chiffres.',true);return;}
  const submit=signupForm.querySelector('button[type="submit"]');
  submit.disabled=true;submit.textContent='Création en cours…';showAuthMessage(signupMessage,'');
  const metadata={
    account_type:type,
    full_name:document.querySelector('#signup-name').value.trim(),
    company_name:type==='entreprise'?document.querySelector('#company-name').value.trim():'',
    siret:type==='entreprise'?siret:'',
    phone:document.querySelector('#signup-phone').value.trim(),
    city:document.querySelector('#signup-city').value.trim(),
    skills:type==='independant'?document.querySelector('#independent-skills').value.trim():'',
    description:type==='independant'?document.querySelector('#independent-description').value.trim():''
  };
  const {data,error}=await authClient.auth.signUp({
    email:document.querySelector('#signup-email').value.trim(),
    password:document.querySelector('#signup-password').value,
    options:{data:metadata,emailRedirectTo:window.location.origin}
  });
  submit.disabled=false;submit.textContent='Créer mon compte';
  if(error){showAuthMessage(signupMessage,error.message==='User already registered'?'Cette adresse e-mail possède déjà un compte. Connectez-vous.':error.message,true);return;}
  if(data.session&&data.user){showAuthMessage(signupMessage,'Votre compte est créé.');await displayAccount(data.user);}
  else{showAuthMessage(signupMessage,'Votre inscription est enregistrée. Consultez votre boîte mail pour confirmer votre adresse avant de vous connecter.');}
});
loginForm?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!authClient){showAuthMessage(loginMessage,'Le service de compte ne se charge pas. Actualisez la page.',true);return;}
  const submit=loginForm.querySelector('button[type="submit"]');
  submit.disabled=true;submit.textContent='Connexion…';showAuthMessage(loginMessage,'');
  const {data,error}=await authClient.auth.signInWithPassword({
    email:document.querySelector('#login-email').value.trim(),
    password:document.querySelector('#login-password').value
  });
  submit.disabled=false;submit.textContent='Me connecter';
  if(error){showAuthMessage(loginMessage,'Connexion impossible : vérifiez votre adresse e-mail et votre mot de passe.',true);return;}
  await displayAccount(data.user);
});
document.querySelector('#logout-button')?.addEventListener('click',async()=>{
  const {error}=await authClient.auth.signOut();
  if(error){showAuthMessage(loginMessage,'La déconnexion a échoué. Réessayez.',true);return;}
  setAuthMode('login');
});
if(authClient){
  authClient.auth.getSession().then(({data})=>{if(data.session)displayAccount(data.session.user);});
  authClient.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_OUT')setAuthMode('login');
    if(event==='SIGNED_IN'&&session?.user)displayAccount(session.user);
  });
}else{
  showAuthMessage(signupMessage,'Le service de compte ne se charge pas. Vérifiez votre connexion internet.',true);
}
