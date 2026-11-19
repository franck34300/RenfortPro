const profileForm=document.querySelector('#profile-search');
function normalizeText(value){return (value||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim();}
function filterProfiles(){
  const skill=normalizeText(document.querySelector('#skill-filter').value);
  const place=normalizeText(document.querySelector('#location-filter').value);
  const availability=document.querySelector('#availability-filter').value;
  let shown=0;
  document.querySelectorAll('#profile-results .profile-card').forEach(card=>{
    const searchable=normalizeText(card.dataset.skill+' '+card.textContent);
    const location=normalizeText(card.dataset.location+' '+card.textContent);
    const matchSkill=!skill||skill.split(/\\s+/).some(term=>searchable.includes(term));
    const matchPlace=!place||place.split(/\\s+/).every(term=>location.includes(term));
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
  document.querySelector('#profile-modal-avatar').textContent=card.querySelector('.avatar')?.textContent||'';
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
document.querySelectorAll('#profile-results .profile-card .button-card').forEach(button=>button.addEventListener('click',e=>{e.preventDefault();openProfile(button.closest('.profile-card'));}));
profileModal?.querySelectorAll('[data-close-profile]').forEach(el=>el.addEventListener('click',()=>{profileModal.hidden=true;document.body.classList.remove('modal-open');}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&profileModal&&!profileModal.hidden){profileModal.hidden=true;document.body.classList.remove('modal-open');}});
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
document.querySelector('header a[href="#connexion"]')?.addEventListener('click',()=>setAuthMode('login'));
accountType?.addEventListener('change',()=>{
  const isCompany=accountType.value==='entreprise';
  companyFields.hidden=!isCompany;
  independentFields.hidden=isCompany;
  document.querySelector('#company-name').required=isCompany;
  document.querySelector('#independent-skills').required=!isCompany;
});
accountType?.dispatchEvent(new Event('change'));

document.querySelector('#signup-independent-photo')?.addEventListener('change',e=>{
  const file=e.target.files?.[0],preview=document.querySelector('#signup-independent-photo-preview');
  if(!file){preview.hidden=true;return;}
  if(!validateImage(file,signupMessage)){e.target.value='';preview.hidden=true;return;}
  preview.src=URL.createObjectURL(file);preview.hidden=false;
});

async function displayAccount(user){
  signupForm.hidden=true;loginForm.hidden=true;accountPanel.hidden=false;
  document.querySelector('#show-signup').classList.remove('active');
  document.querySelector('#show-login').classList.remove('active');
  const {data,error}=await authClient.from('profiles').select('account_type,full_name,company_name,city,skills,description,avatar_url,siret,phone').eq('id',user.id).single();
  if(error){document.querySelector('#account-welcome').textContent='Connexion réussie. Votre profil est en cours de chargement.';document.querySelector('#account-details').replaceChildren();return;}
  const isCompany=data.account_type==='entreprise';
  document.querySelector('#account-welcome').textContent='Bienvenue '+(data.full_name||user.email)+' !';
  const details=document.querySelector('#account-details');details.replaceChildren();
  const rows=[['Type de compte',isCompany?'Entreprise':'Indépendant'],...(isCompany?[['Entreprise',data.company_name]]:[['Compétences',data.skills],['Présentation',data.description]]),['Ville',data.city]];
  rows.filter(row=>row[1]).forEach(([label,value])=>{const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent=value;details.append(dt,dd);});
  const independentPhotoBox=document.querySelector('#independent-photo-setting');
  independentPhotoBox.hidden=isCompany;
  const avatarPreview=document.querySelector('#independent-photo-preview');
  avatarPreview.hidden=!data.avatar_url;avatarPreview.src=data.avatar_url||'';
  const companyBox=document.querySelector('#company-space-setting');
  const showCompany=document.querySelector('#show-company-space');
  const {data:company,error:companyError}=await authClient.from('company_profiles').select('company_name,siret,contact_name,phone,city,image_url').eq('user_id',user.id).maybeSingle();
  if(companyError) console.warn('Company profile read:',companyError.message);
  const companyExists=!!company;
  showCompany.hidden=isCompany||companyExists;
  companyBox.hidden=!(isCompany||companyExists);
  document.querySelector('#company-space-name').value=company?.company_name||(isCompany?data.company_name:'')||'';
  document.querySelector('#company-space-siret').value=company?.siret||(isCompany?data.siret:'')||'';
  document.querySelector('#company-space-contact').value=company?.contact_name||(isCompany?data.full_name:'')||'';
  document.querySelector('#company-space-phone').value=company?.phone||(isCompany?data.phone:'')||'';
  document.querySelector('#company-space-city').value=company?.city||(isCompany?data.city:'')||'';
  const companyPreview=document.querySelector('#company-photo-preview');
  companyPreview.hidden=!company?.image_url;companyPreview.src=company?.image_url||'';
  if(isCompany&&!companyExists){
    const seed={user_id:user.id,company_name:data.company_name||'',siret:data.siret||'',contact_name:data.full_name||'',phone:data.phone||'',city:data.city||''};
    if(seed.company_name){const {error:seedError}=await authClient.from('company_profiles').insert(seed);if(seedError)console.warn('Company profile initialization:',seedError.message);}
  }
}
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
    if(!validateImage(file,null)){preview.hidden=true;return;}
    preview.src=URL.createObjectURL(file);preview.hidden=false;
  });
}
previewImage('independent-photo-file','independent-photo-preview');
previewImage('company-photo-file','company-photo-preview');
async function uploadProfileImage(file,userId,kind){
  const ext=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg';
  const path=userId+'/'+kind+'/'+Date.now()+'.'+ext;
  const {error}=await authClient.storage.from('renfortpro-images').upload(path,file,{contentType:file.type,cacheControl:'3600'});
  if(error)throw error;
  return authClient.storage.from('renfortpro-images').getPublicUrl(path).data.publicUrl;
}
document.querySelector('#save-independent-photo')?.addEventListener('click',async()=>{
  const user=(await authClient.auth.getUser()).data.user,file=document.querySelector('#independent-photo-file').files?.[0],msg=document.querySelector('#independent-photo-message'),btn=document.querySelector('#save-independent-photo');
  if(!validateImage(file,msg))return;
  btn.disabled=true;btn.textContent='Envoi…';showAuthMessage(msg,'');
  try{const url=await uploadProfileImage(file,user.id,'independent');const {error}=await authClient.from('profiles').update({avatar_url:url}).eq('id',user.id);if(error)throw error;document.querySelector('#independent-photo-preview').src=url;showAuthMessage(msg,'Photo de profil enregistrée.');}
  catch(error){showAuthMessage(msg,'Impossible d’enregistrer la photo : '+error.message,true);}
  finally{btn.disabled=false;btn.textContent='Enregistrer ma photo';}
});
document.querySelector('#show-company-space')?.addEventListener('click',()=>{document.querySelector('#company-space-setting').hidden=false;document.querySelector('#show-company-space').hidden=true;});
document.querySelector('#save-company-profile')?.addEventListener('click',async()=>{
  const user=(await authClient.auth.getUser()).data.user,file=document.querySelector('#company-photo-file').files?.[0],msg=document.querySelector('#company-profile-message'),btn=document.querySelector('#save-company-profile');
  const name=document.querySelector('#company-space-name').value.trim(),siret=document.querySelector('#company-space-siret').value.trim();
  if(!name){showAuthMessage(msg,'Le nom de l’entreprise est obligatoire.',true);return;}
  if(siret&&!/^\\d{14}$/.test(siret)){showAuthMessage(msg,'Le SIRET doit contenir 14 chiffres.',true);return;}
  if(file&&!validateImage(file,msg))return;
  btn.disabled=true;btn.textContent='Enregistrement…';showAuthMessage(msg,'');
  try{
    let imageUrl=document.querySelector('#company-photo-preview').src;
    if(file)imageUrl=await uploadProfileImage(file,user.id,'company');
    if(!imageUrl||imageUrl.startsWith('blob:'))imageUrl='';
    const payload={user_id:user.id,company_name:name,siret,contact_name:document.querySelector('#company-space-contact').value.trim(),phone:document.querySelector('#company-space-phone').value.trim(),city:document.querySelector('#company-space-city').value.trim(),image_url:imageUrl,updated_at:new Date().toISOString()};
    const {error}=await authClient.from('company_profiles').upsert(payload,{onConflict:'user_id'});if(error)throw error;
    if(file)document.querySelector('#company-photo-preview').src=imageUrl;
    showAuthMessage(msg,'Espace entreprise enregistré.');document.querySelector('#show-company-space').hidden=true;
  }catch(error){showAuthMessage(msg,'Enregistrement impossible : '+error.message,true);}
  finally{btn.disabled=false;btn.textContent='Enregistrer mon espace entreprise';}
}
);
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
  if(data.session&&data.user){
    const photo=document.querySelector('#signup-independent-photo')?.files?.[0];
    if(type==='independant'&&photo){
      try{
        if(!validateImage(photo,signupMessage))return;
        const url=await uploadProfileImage(photo,data.user.id,'independent');
        const {error:photoError}=await authClient.from('profiles').update({avatar_url:url}).eq('id',data.user.id);
        if(photoError)throw photoError;
      }catch(photoError){
        showAuthMessage(signupMessage,'Compte créé, mais la photo n’a pas pu être enregistrée : '+photoError.message,true);
        await displayAccount(data.user);return;
      }
    }
    showAuthMessage(signupMessage,'Votre compte et votre profil sont créés.');
    await displayAccount(data.user);
  }else{
    const hasPhoto=type==='independant'&&!!document.querySelector('#signup-independent-photo')?.files?.[0];
    showAuthMessage(signupMessage,hasPhoto
      ?'Votre inscription est enregistrée. Confirmez votre adresse e-mail, puis connectez-vous pour enregistrer votre photo de profil.'
      :'Votre inscription est enregistrée. Consultez votre boîte mail pour confirmer votre adresse avant de vous connecter.');
  }
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
