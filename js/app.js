function setupAuthKeyListeners(){
  const emailInput = document.getElementById('loginEmail');
  const pwInput = document.getElementById('loginPassword');
  [emailInput, pwInput].forEach(input=>{
    if(!input) return;
    input.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter'){
        e.preventDefault();
        window.handleLogin();
      }
    });
  });
}


function setupLandingCopyGuard(){
  const landing = document.getElementById('landingScreen');
  if(!landing) return;
  const isFormField = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  landing.addEventListener('copy', (e)=>{ if(!isFormField(e.target)) e.preventDefault(); });
  landing.addEventListener('cut', (e)=>{ if(!isFormField(e.target)) e.preventDefault(); });
  landing.addEventListener('contextmenu', (e)=>{ if(!isFormField(e.target)) e.preventDefault(); });
  landing.addEventListener('dragstart', (e)=>{ if(!isFormField(e.target)) e.preventDefault(); });
  landing.addEventListener('selectstart', (e)=>{ if(!isFormField(e.target)) e.preventDefault(); });
}

(async function init(){
  const allData = await storeGetAll();
  await loadAll(allData);
  if(allData){
    if(allData['inv:settings:company']) DB.company = allData['inv:settings:company']; else await loadCompany();
    if(allData['inv:settings:users']) DB.users = allData['inv:settings:users']; else await loadUsers();
    if(allData['inv:settings:warehouses']) DB.warehouses = allData['inv:settings:warehouses']; else await loadWarehouses();
    if(allData['inv:settings:units']) DB.units = allData['inv:settings:units']; else await loadUnits();
    if(allData['inv:settings:notif']) DB.notifSettings = allData['inv:settings:notif']; else await loadNotifSettings();
    if(allData['inv:settings:profile']) DB.profile = allData['inv:settings:profile']; else await loadProfile();
    if(allData['inv:auth:credentials']) DB.credentials = allData['inv:auth:credentials']; else await loadCredentials();
  } else {
    await Promise.all([loadCompany(), loadUsers(), loadWarehouses(), loadUnits(), loadNotifSettings(), loadProfile(), loadCredentials()]);
  }
  document.getElementById('fMin').value = DB.notifSettings?.defaultMin || 5;
  document.querySelector('.user .name').textContent = DB.profile.name;
  document.querySelector('.user .role').textContent = DB.profile.role;
  document.querySelector('.user .avatar').textContent = DB.profile.name.trim().charAt(0).toUpperCase() || 'A';
  DB.currentRole = DB.profile.role;
  renderSidebarLockState();
  renderDashboard();
  // card tilt removed for performance
  setupLandingCopyGuard();
  setupAuthKeyListeners();
  setupRealtimeSync();

  // Auto-restore session jika pengguna sudah pernah login sebelumnya
  const savedSession = getSavedSession();
  if(savedSession && savedSession.email && savedSession.role){
    enterApp(savedSession.role, savedSession.email, null, true);
  }
})();
