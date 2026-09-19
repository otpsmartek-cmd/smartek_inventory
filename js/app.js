function setupAuthKeyListeners(){
  const loginFields = [document.getElementById('loginEmail'), document.getElementById('loginPassword')];
  loginFields.forEach(input=>{
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
  setupLandingCopyGuard();
  setupAuthKeyListeners();
  setupRealtimeSync();

  // 1. LANGSUNG MUAT DARI CACHE LOKAL (INSTAN 0ms)
  loadFromLocalCache();

  // 2. CEK & RESTORE SESI SECARA INSTAN TANPA MENUNGGU JARINGAN
  const savedSession = getSavedSession();
  if(savedSession && savedSession.email && savedSession.role){
    enterApp(savedSession.role, savedSession.email, null, true, savedSession.name);
  }

  // 3. RENDER TAMPILAN DASHBOARD AWAL
  document.getElementById('fMin').value = DB.notifSettings?.defaultMin || 5;
  if(!savedSession){
    document.querySelector('.user .name').textContent = DB.profile?.name || 'Admin';
    document.querySelector('.user .role').textContent = DB.profile?.role || 'Administrator';
    document.querySelector('.user .avatar').textContent = (DB.profile?.name || 'A').trim().charAt(0).toUpperCase() || 'A';
    DB.currentRole = DB.profile?.role || 'Administrator';
  }
  renderSidebarLockState();
  renderDashboard();

  // 4. SINKRONKAN DATA TERBARU DARI CLOUD SECARA ASINKRON (DI BALIK LAYAR)
  try{
    const allData = await storeGetAll();
    if(allData){
      await loadAll(allData);
      if(allData['inv:settings:company']) DB.company = allData['inv:settings:company'];
      if(allData['inv:settings:users']) DB.users = allData['inv:settings:users'];
      if(allData['inv:settings:warehouses']) DB.warehouses = allData['inv:settings:warehouses'];
      if(allData['inv:settings:units']) DB.units = allData['inv:settings:units'];
      if(allData['inv:settings:notif']) DB.notifSettings = allData['inv:settings:notif'];
      if(allData['inv:settings:profile']) DB.profile = allData['inv:settings:profile'];
      if(allData['inv:auth:credentials']){
        DB.credentials = allData['inv:auth:credentials'];
        localCacheSet('inv:auth:credentials', DB.credentials);
      }

      // Sinkronisasi otomatis (auto-heal) antara DB.users dan DB.credentials
      if(Array.isArray(DB.users) && DB.credentials){
        let credsChanged = false;
        DB.users.forEach(u => {
          if(u.email && u.password){
            const k = u.email.toLowerCase().trim();
            if(!DB.credentials[k]){
              DB.credentials[k] = { name: u.name, password: u.password, role: u.role || 'Administrator', createdAt: Date.now() };
              credsChanged = true;
            }
          }
        });
        if(credsChanged){
          localCacheSet('inv:auth:credentials', DB.credentials);
          storeSet('inv:auth:credentials', DB.credentials).catch(()=>{});
        }
      }

      const activeKey = document.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
      renderPage(activeKey);
      refreshAlertBadge();
    }
  }catch(e){
    console.warn('Latar belakang sinkronisasi cloud info:', e);
  }

  // 5. Tandai sesi offline saat pengguna menutup tab / browser
  window.addEventListener('beforeunload', () => {
    sendSessionHeartbeat(false);
  });
})();
