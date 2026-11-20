const profileForm=document.querySelector('#profile-search');
async function loadPublicProfiles(){
  const grid=document.querySelector('#profile-results'),count=document.querySelector('#profile-count'),message=document.querySelector('#profile-directory-message');
  try{
    const snapshot=await getDocs(collection(db,'public_profiles'));
    grid.replaceChildren();
    snapshot.forEach(docSnap=>renderPublicProfile(docSnap.data()));
    count.textContent=snapshot.size+' profil'+(snapshot.size>1?'s':'');
    message.textContent=snapshot.empty?'Aucun indépendant n’a encore publié sa fiche.':snapshot.size+' fiche'+(snapshot.size>1?'s':'')+' professionnelle publiée'+(snapshot.size>1?'s':'')+'.';
  }catch(error){
    console.warn('Annuaire public inaccessible:',error);
    grid.replaceChildren();count.textContent='Indisponible';
    message.textContent='Annuaire temporairement indisponible.';
  }
}
function renderPublicProfile(data){
  const card=document.createElement('article');card.className='profile-card profile-card-horizontal';
  const skills=data.skills||'Professionnel indépendant';
  card.dataset.skill=skills;card.dataset.location=data.city||'';card.dataset.availability=data.availability||'À convenir';
  card.dataset.experience=data.experience||'';card.dataset.rate=data.rate||'';card.dataset.description=data.description||'';
  card.dataset.tags=skills.split(/[,;|]/).map(x=>x.trim()).filter(Boolean).slice(0,4).join('|');card.dataset.avatar=data.avatar_url||'';
  const main=document.createElement('div');main.className='profile-card-main';
  const avatar=document.createElement('div');avatar.className='avatar avatar-1';
  avatar.textContent=(data.full_name||'Indépendant').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
  if(data.avatar_url){avatar.style.backgroundImage='url('+data.avatar_url+')';avatar.style.backgroundSize='cover';avatar.style.backgroundPosition='center';avatar.textContent='';}
  const info=document.createElement('div');info.className='profile-card-info';
  const name=document.createElement('h3');name.textContent=data.full_name||'Professionnel indépendant';
  const job=document.createElement('p');job.className='profile-job';job.textContent=skills.split(/[,;|]/)[0].trim();
  const location=document.createElement('span');location.className='location';location.textContent='⌖ '+(data.city||'Localisation non renseignée');
  const tags=document.createElement('div');tags.className='tags profile-card-tags';
  card.dataset.tags=skills.split(/[,;|]/).map(x=>x.trim()).filter(Boolean).slice(0,4).join('|');
  card.dataset.tags.split('|').filter(Boolean).forEach(tag=>{const t=document.createElement('span');t.textContent=tag;tags.append(t);});
  info.append(name,job,location,tags);main.append(avatar,info);card.append(main);
  const button=document.createElement('a');button.href='#connexion';button.className='button button-outline button-card';button.textContent='Voir le profil →';
  button.addEventListener('click',e=>{e.preventDefault();openProfile(card);});card.append(button);
  gridAppend(card);
}
function gridAppend(card){document.querySelector('#profile-results')?.append(card);}

function normalizeText(value){return (value||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();}
const skillSynonyms={
  soudeur:['soudeur','soudeuse','soudure','souder','soudeurs','soudeuses'],
  soudeuse:['soudeur','soudeuse','soudure','souder','soudeurs','soudeuses'],
  soudure:['soudeur','soudeuse','soudure','souder','soudeurs','soudeuses'],
  electricien:['electricien','electricienne','electricite','electrique'],
  electricienne:['electricien','electricienne','electricite','electrique'],
  electricite:['electricien','electricienne','electricite','electrique'],
  plombier:['plombier','plombiere','plomberie'],
  plomberie:['plombier','plombiere','plomberie'],
  peintre:['peintre','peinture'],
  peinture:['peintre','peinture'],
  macon:['macon','maconnerie'],
  maconnerie:['macon','maconnerie'],
  menuisier:['menuisier','menuisiere','menuiserie'],
  menuiserie:['menuisier','menuisiere','menuiserie'],
  metallier:['metallier','metalliere','metallerie','soudeur','soudeuse','soudure'],
  metalliere:['metallier','metalliere','metallerie','soudeur','soudeuse','soudure']
};
function filterProfiles(){
  const skill=normalizeText(document.querySelector('#skill-filter').value);
  const place=normalizeText(document.querySelector('#location-filter').value);
  const availability=document.querySelector('#availability-filter').value;
  const terms=skill?skill.split(/\s+/):[];
  let shown=0;
  document.querySelectorAll('#profile-results .profile-card').forEach(card=>{
    const searchable=normalizeText(card.dataset.skill+' '+card.textContent);
    const location=normalizeText(card.dataset.location+' '+card.textContent);
    const matchSkill=terms.every(term=>{
      const alternatives=skillSynonyms[term]||[term];
      return alternatives.some(alternative=>searchable.includes(alternative));
    });
    const matchPlace=!place||place.split(/\s+/).every(term=>location.includes(term));
    const matchAvailability=!availability||card.dataset.availability===availability;
    card.hidden=!(matchSkill&&matchPlace&&matchAvailability);
    if(!card.hidden)shown++;
  });
  document.querySelector('#profile-count').textContent=shown+' profil'+(shown>1?'s':'');
}
profileForm?.addEventListener('submit',e=>{e.preventDefault();filterProfiles();});
document.querySelector('#availability-filter')?.addEventListener('change',filterProfiles);
document.querySelector('#skill-filter')?.addEventListener('input',filterProfiles);
document.querySelector('#location-filter')?.addEventListener('input',filterProfiles);
const profileModal=document.querySelector('#profile-modal');
function openProfile(card){
  const name=card.querySelector('h3')?.textContent||'Profil';
  document.querySelector('#profile-modal-name').textContent=name;
  document.querySelector('#profile-modal-job').textContent=card.querySelector('p')?.textContent||'';
  const modalAvatar=document.querySelector('#profile-modal-avatar');
  modalAvatar.textContent=card.querySelector('.avatar')?.textContent||'';
  modalAvatar.style.backgroundImage=card.dataset.avatar?'url('+card.dataset.avatar+')':'';
  modalAvatar.style.backgroundSize='cover';modalAvatar.style.backgroundPosition='center';
  document.querySelector('#profile-modal-avatar').className='profile-modal-avatar avatar '+(card.querySelector('.avatar')?.classList[1]||'');
  document.querySelector('#profile-modal-location').textContent='⌖ '+(card.querySelector('.location')?.textContent||'Localisation non renseignée').replace('⌖','').trim();
  document.querySelector('#profile-modal-availability').textContent='Disponibilité : '+(card.dataset.availability||'À convenir');
  document.querySelector('#profile-modal-experience').textContent=card.dataset.experience||'Expérience non précisée';
  document.querySelector('#profile-modal-rate').textContent=card.dataset.rate||'Tarif à convenir';
  document.querySelector('#profile-modal-description').textContent=card.dataset.description||'Description non renseignée';
  const tags=document.querySelector('#profile-modal-tags');tags.replaceChildren();
  (card.dataset.tags||'').split('|').filter(Boolean).forEach(tag=>{const span=document.createElement('span');span.textContent=tag;tags.append(span);});
  profileModal.hidden=false;document.body.classList.add('modal-open');
}

const profileContact=document.querySelector('#profile-modal-contact');
profileContact?.addEventListener('click',e=>{
  if(auth.currentUser){
    e.preventDefault();
    profileContact.textContent='Profil de démonstration — contact bientôt disponible';
  }else{
    setAuthMode('login');
    document.querySelector('#connexion')?.scrollIntoView({behavior:'smooth'});
  }
});
profileModal?.querySelectorAll('[data-close-profile]').forEach(el=>el.addEventListener('click',()=>{profileModal.hidden=true;document.body.classList.remove('modal-open');}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&profileModal&&!profileModal.hidden){profileModal.hidden=true;document.body.classList.remove('modal-open');}});
const missionForm=document.querySelector('#mission-search');
missionForm?.addEventListener('submit',e=>{e.preventDefault();const skill=document.querySelector('#mission-skill').value.toLowerCase().trim();const place=document.querySelector('#mission-location').value.toLowerCase().trim();let shown=0;document.querySelectorAll('#mission-results .mission-card').forEach(card=>{const matchSkill=!skill||card.dataset.skill.includes(skill);const matchPlace=!place||card.dataset.location.includes(place);card.hidden=!(matchSkill&&matchPlace);if(!card.hidden)shown++;});let old=document.querySelector('#mission-count');if(!old){old=document.createElement('span');old.id='mission-count';document.querySelector('#mission-results').before(old);}old.textContent=shown+' mission'+(shown>1?'s':'')+' affichée'+(shown>1?'s':'');});
const menu=document.querySelector('.menu-toggle');menu?.addEventListener('click',()=>document.querySelector('.main-nav').classList.toggle('open'));

// Authentification RenfortPro — Firebase Auth + Cloud Firestore.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signInWithPopup, sendEmailVerification,
  signOut, onAuthStateChanged, updateProfile
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAY9foPoP3fEgjXw0bCz0AnbKaC8cuvVaE",
  authDomain: "renfortpro.firebaseapp.com",
  projectId: "renfortpro",
  storageBucket: "renfortpro.firebasestorage.app",
  messagingSenderId: "297512900802",
  appId: "1:297512900802:web:931eaf625d425db314035b",
  measurementId: "G-98Z47H1SK2"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
loadPublicProfiles();
const googleProvider = new GoogleAuthProvider();

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
const headerAccountLink=document.querySelector('header a[href="#connexion"]');
headerAccountLink?.addEventListener('click',e=>{
  e.preventDefault();
  if(!auth.currentUser) setAuthMode('login');
  document.querySelector('#connexion')?.scrollIntoView({behavior:'smooth'});
});
accountType?.addEventListener('change',()=>{
  const isCompany=accountType.value==='entreprise';
  companyFields.hidden=!isCompany;
  independentFields.hidden=isCompany;
  document.querySelector('#company-name').required=isCompany;
  document.querySelector('#independent-skills').required=!isCompany;
});
accountType?.dispatchEvent(new Event('change'));

function validateImage(file,messageTarget){
  if(!file){showAuthMessage(messageTarget,'Choisissez une image avant de continuer.',true);return false;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){showAuthMessage(messageTarget,'Format accepté : JPG, PNG ou WebP.',true);return false;}
  if(file.size>3*1024*1024){showAuthMessage(messageTarget,'L’image ne doit pas dépasser 3 Mo.',true);return false;}
  return true;
}
function previewImage(inputId,previewId){
  document.querySelector('#'+inputId)?.addEventListener('change',e=>{
    const file=e.target.files?.[0],preview=document.querySelector('#'+previewId);
    if(!file){preview.hidden=true;return;}
    if(!validateImage(file,null)){e.target.value='';preview.hidden=true;return;}
    preview.src=URL.createObjectURL(file);preview.hidden=false;
  });
}
previewImage('independent-photo-file','independent-photo-preview');
previewImage('company-photo-file','company-photo-preview');
document.querySelector('#signup-independent-photo')?.addEventListener('change',e=>{
  const file=e.target.files?.[0],preview=document.querySelector('#signup-independent-photo-preview');
  if(!file){preview.hidden=true;return;}
  if(!validateImage(file,signupMessage)){e.target.value='';preview.hidden=true;return;}
  preview.src=URL.createObjectURL(file);preview.hidden=false;
});

async function readProfile(user){
  const ref=doc(db,'profiles',user.uid);
  const snap=await getDoc(ref);
  return snap.exists()?snap.data():null;
}
async function displayAccount(user){
  signupForm.hidden=true;loginForm.hidden=true;accountPanel.hidden=false;
  document.querySelector('#show-signup').classList.remove('active');
  document.querySelector('#show-login').classList.remove('active');
  let data;
  try { data=await readProfile(user); }
  catch(error) {
    document.querySelector('#account-welcome').textContent='Compte connecté, mais profil inaccessible.';
    document.querySelector('#account-details').replaceChildren();
    showAuthMessage(loginMessage,'Vérifiez les règles de sécurité Firestore : '+error.message,true);
    return;
  }
  if(!data){
    document.querySelector('#account-welcome').textContent='Bienvenue ! Votre profil RenfortPro doit être complété.';
    document.querySelector('#account-details').replaceChildren();
    document.querySelector('#independent-photo-setting').hidden=true;
    document.querySelector('#company-space-setting').hidden=true;
    document.querySelector('#show-company-space').hidden=false;
    return;
  }
  const isCompany=data.account_type==='entreprise';
  document.querySelector('#account-welcome').textContent='Bienvenue '+(data.full_name||user.displayName||user.email||'')+' !';
  const details=document.querySelector('#account-details');details.replaceChildren();
  const rows=[['Type de compte',isCompany?'Entreprise':'Indépendant'],...(isCompany?[['Entreprise',data.company_name]]:[['Compétences',data.skills],['Présentation',data.description]]),['Ville',data.city]];
  rows.filter(row=>row[1]).forEach(([label,value])=>{const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent=value;details.append(dt,dd);});
  document.querySelector('#independent-photo-setting').hidden=isCompany;
  const avatarPreview=document.querySelector('#independent-photo-preview');
  avatarPreview.hidden=!data.avatar_url;avatarPreview.src=data.avatar_url||'';
  const companyRef=doc(db,'company_profiles',user.uid);
  let company=null;
  try { const companySnap=await getDoc(companyRef); if(companySnap.exists())company=companySnap.data(); }
  catch(error){console.warn('Company profile read:',error.message);}
  const companyExists=!!company;
  const showCompany=document.querySelector('#show-company-space');
  const companyBox=document.querySelector('#company-space-setting');
  showCompany.hidden=isCompany||companyExists;
  companyBox.hidden=!(isCompany||companyExists)||window.__renfortproCompanyAccess!==true;
  document.querySelector('#company-space-name').value=company?.company_name||(isCompany?data.company_name:'')||'';
  document.querySelector('#company-space-siret').value=company?.siret||(isCompany?data.siret:'')||'';
  document.querySelector('#company-space-contact').value=company?.contact_name||(isCompany?data.full_name:'')||'';
  document.querySelector('#company-space-phone').value=company?.phone||(isCompany?data.phone:'')||'';
  document.querySelector('#company-space-city').value=company?.city||(isCompany?data.city:'')||'';
  const companyPreview=document.querySelector('#company-photo-preview');
  companyPreview.hidden=!company?.image_url;companyPreview.src=company?.image_url||'';
  if(isCompany&&!companyExists&&data.company_name){
    await setDoc(companyRef,{
      company_name:data.company_name||'',siret:data.siret||'',
      contact_name:data.full_name||'',phone:data.phone||'',city:data.city||'',
      created_at:serverTimestamp()
    });
  }
}

// Hébergement des images via Cloudinary (préréglage non signé).
// Firebase reste utilisé pour les comptes et les données ; aucun stockage Firebase payant.
const CLOUDINARY_CLOUD_NAME = 'dudff0pyk';
const CLOUDINARY_UPLOAD_PRESET = 'renfortpro_unsigned';
async function uploadProfileImage(file,userId,kind){
  if(!validateImage(file,null))throw new Error('Format ou taille de fichier non accepté.');
  const body=new FormData();
  body.append('file',file);
  body.append('upload_preset',CLOUDINARY_UPLOAD_PRESET);
  body.append('folder','renfortpro/'+userId);
  body.append('context','type='+kind);
  const response=await fetch('https://api.cloudinary.com/v1_1/'+CLOUDINARY_CLOUD_NAME+'/image/upload',{method:'POST',body});
  const result=await response.json();
  if(!response.ok||!result.secure_url)throw new Error(result.error?.message||'Cloudinary n’a pas accepté cette image.');
  return result.secure_url;
}
document.querySelector('#save-independent-photo')?.addEventListener('click',async()=>{
  const user=auth.currentUser,file=document.querySelector('#independent-photo-file').files?.[0],msg=document.querySelector('#independent-photo-message'),btn=document.querySelector('#save-independent-photo');
  if(!validateImage(file,msg))return;
  btn.disabled=true;btn.textContent='Envoi…';showAuthMessage(msg,'');
  try{
    const url=await uploadProfileImage(file,user.uid,'independent');
    await updateDoc(doc(db,'profiles',user.uid),{avatar_url:url});
    const preview=document.querySelector('#independent-photo-preview');preview.src=url;preview.hidden=false;
    showAuthMessage(msg,'Photo de profil enregistrée.');
  }catch(error){showAuthMessage(msg,'Photo non enregistrée : '+error.message,true);}
  finally{btn.disabled=false;btn.textContent='Enregistrer ma photo';}
});
document.querySelector('#show-company-space')?.addEventListener('click',()=>{document.querySelector('#company-space-setting').hidden=false;document.querySelector('#show-company-space').hidden=true;});
document.querySelector('#save-company-profile')?.addEventListener('click',async()=>{
  const user=auth.currentUser,file=document.querySelector('#company-photo-file').files?.[0],msg=document.querySelector('#company-profile-message'),btn=document.querySelector('#save-company-profile');
  const name=document.querySelector('#company-space-name').value.trim(),siret=document.querySelector('#company-space-siret').value.trim();
  if(!name){showAuthMessage(msg,'Le nom de l’entreprise est obligatoire.',true);return;}
  if(siret&&!/^\d{14}$/.test(siret)){showAuthMessage(msg,'Le SIRET doit contenir 14 chiffres.',true);return;}
  if(file&&!validateImage(file,msg))return;
  btn.disabled=true;btn.textContent='Enregistrement…';showAuthMessage(msg,'');
  try{
    const companyPreview=document.querySelector('#company-photo-preview');
    let imageUrl=companyPreview.hidden?'':companyPreview.src;
    if(file)imageUrl=await uploadProfileImage(file,user.uid,'company');
    if(!imageUrl||imageUrl.startsWith('blob:'))imageUrl='';
    await setDoc(doc(db,'company_profiles',user.uid),{
      company_name:name,siret,
      contact_name:document.querySelector('#company-space-contact').value.trim(),
      phone:document.querySelector('#company-space-phone').value.trim(),
      city:document.querySelector('#company-space-city').value.trim(),
      image_url:imageUrl,updated_at:serverTimestamp()
    },{merge:true});
    if(imageUrl){const preview=document.querySelector('#company-photo-preview');preview.src=imageUrl;preview.hidden=false;}
    showAuthMessage(msg,'Espace entreprise enregistré.');document.querySelector('#show-company-space').hidden=true;
  }catch(error){showAuthMessage(msg,'Enregistrement impossible : '+error.message,true);}
  finally{btn.disabled=false;btn.textContent='Enregistrer mon espace entreprise';}
});

async function createProfileForUser(user,metadata){
  const ref=doc(db,'profiles',user.uid);
  const existing=await getDoc(ref);
  if(!existing.exists()){
    await setDoc(ref,{
      account_type:metadata.account_type||'independant',
      full_name:metadata.full_name||user.displayName||'',
      company_name:metadata.company_name||'',
      siret:metadata.siret||'',
      phone:metadata.phone||'',
      city:metadata.city||'',
      skills:metadata.skills||'',
      description:metadata.description||'',
      avatar_url:'',
      email:user.email||'',
      created_at:serverTimestamp()
    });
  }
  const type=metadata.account_type||'';
  if(type==='entreprise'){
    const companyRef=doc(db,'company_profiles',user.uid);
    const companySnap=await getDoc(companyRef);
    if(!companySnap.exists()){
      await setDoc(companyRef,{
        company_name:metadata.company_name||'',siret:metadata.siret||'',
        contact_name:metadata.full_name||'',phone:metadata.phone||'',
        city:metadata.city||'',image_url:'',created_at:serverTimestamp()
      });
    }
  }
}

signupForm?.addEventListener('submit',async e=>{
  e.preventDefault();
  const type=accountType.value,siret=document.querySelector('#company-siret').value.trim();
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
  try{
    const credential=await createUserWithEmailAndPassword(auth,document.querySelector('#signup-email').value.trim(),document.querySelector('#signup-password').value);
    if(metadata.full_name)await updateProfile(credential.user,{displayName:metadata.full_name});
    await createProfileForUser(credential.user,metadata);
    try{await sendEmailVerification(credential.user);}catch(error){console.warn('Email verification:',error.message);}
    const photo=document.querySelector('#signup-independent-photo')?.files?.[0];
    if(type==='independant'&&photo){
      try{
        const avatarUrl=await uploadProfileImage(photo,credential.user.uid,'independent');
        await updateDoc(doc(db,'profiles',credential.user.uid),{avatar_url:avatarUrl});
        showAuthMessage(signupMessage,'Compte créé et photo de profil enregistrée. Un e-mail de vérification vous a été envoyé.');
      }catch(imageError){
        showAuthMessage(signupMessage,'Compte créé, mais la photo n’a pas pu être envoyée : '+imageError.message,true);
      }
    }else showAuthMessage(signupMessage,'Votre compte est créé. Un e-mail de vérification vient de vous être envoyé.');
    await displayAccount(credential.user);
  }catch(error){
    const messages={
      'auth/email-already-in-use':'Cette adresse e-mail possède déjà un compte. Connectez-vous.',
      'auth/weak-password':'Le mot de passe doit contenir au moins 6 caractères.',
      'auth/invalid-email':'Cette adresse e-mail n’est pas valide.',
      'permission-denied':'Firestore refuse l’écriture. Vérifiez les règles de sécurité.'
    };
    showAuthMessage(signupMessage,messages[error.code]||'Création impossible : '+error.message,true);
  }finally{submit.disabled=false;submit.textContent='Créer mon compte';}
});

async function googleSignIn(){
  try{
    const credential=await signInWithPopup(auth,googleProvider);
    const existing=await readProfile(credential.user);
    if(!existing){
      const type=accountType?.value||'independant';
      const metadata={
        account_type:type,
        full_name:credential.user.displayName||'',
        company_name:type==='entreprise'?document.querySelector('#company-name').value.trim():'',
        siret:type==='entreprise'?document.querySelector('#company-siret').value.trim():'',
        phone:document.querySelector('#signup-phone').value.trim(),
        city:document.querySelector('#signup-city').value.trim(),
        skills:type==='independant'?document.querySelector('#independent-skills').value.trim():'',
        description:type==='independant'?document.querySelector('#independent-description').value.trim():''
      };
      await createProfileForUser(credential.user,metadata);
    }
    await displayAccount(credential.user);
  }catch(error){
    showAuthMessage(loginMessage,'Connexion Google impossible : '+error.message,true);
  }
}
document.querySelector('#google-login')?.addEventListener('click',googleSignIn);
document.querySelector('#google-signup')?.addEventListener('click',googleSignIn);

loginForm?.addEventListener('submit',async e=>{
  e.preventDefault();
  const submit=loginForm.querySelector('button[type="submit"]');
  submit.disabled=true;submit.textContent='Connexion…';showAuthMessage(loginMessage,'');
  try{
    const credential=await signInWithEmailAndPassword(auth,document.querySelector('#login-email').value.trim(),document.querySelector('#login-password').value);
    await displayAccount(credential.user);
  }catch(error){
    showAuthMessage(loginMessage,'Connexion impossible : vérifiez votre adresse e-mail et votre mot de passe.',true);
  }finally{submit.disabled=false;submit.textContent='Me connecter';}
});
document.querySelector('#logout-button')?.addEventListener('click',async()=>{
  try{await signOut(auth);setAuthMode('login');}
  catch(error){showAuthMessage(loginMessage,'La déconnexion a échoué : '+error.message,true);}
});
onAuthStateChanged(auth,user=>{
  if(headerAccountLink) headerAccountLink.textContent=user?'Mon compte':'Se connecter';
  if(profileContact) profileContact.textContent=user?'Contacter (profil exemple)':'Créer un compte pour contacter →';
  if(user)displayAccount(user);
  else setAuthMode('login');
});
