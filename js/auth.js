/* ============ LANDING SCREEN ============ */

/* ---- autentikasi sederhana (client-side) ----
   Login memvalidasi kredensial pengguna yang tersimpan di DB.credentials atau DB.users.
   Pendaftaran akun baru membuat user di DB.credentials dan DB.users dengan update optimistik (cache-first),
   lalu sinkronisasi ke cloud Google Apps Script di latar belakang tanpa memblokir pengguna. */
function isValidEmail(email){
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function showFieldError(id, msg){
  const el = document.getElementById(id);
  if(!el) return;
  el.textContent = msg;
  el.classList.add('show');
}
function clearFieldErrors(...ids){
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if(el){ el.textContent = ''; el.classList.remove('show'); }
  });
}

/* ============ SESSION & KREDENSIAL ============ */
const SESSION_STORAGE_KEY = 'smartek:auth_session';

function saveSession(email, role, name){
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      email, role, name: name || deriveNameFromEmail(email), loginAt: Date.now()
    }));
  }catch(e){}
}
function clearSession(){
  try { localStorage.removeItem(SESSION_STORAGE_KEY); }catch(e){}
}
function getSavedSession(){
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

async function loadCredentials(){
  DB.credentials = (await storeGet('inv:auth:credentials')) || {};
}

/* Helper untuk mencari akun di DB.credentials ataupun DB.users */
function findAccount(email){
  const key = (email || '').toLowerCase().trim();
  if(!key) return null;

  // 1. Cek di DB.credentials
  if(DB.credentials && DB.credentials[key]){
    const c = DB.credentials[key];
    return {
      email: key,
      name: c.name || deriveNameFromEmail(key),
      password: c.password,
      role: c.role || 'Administrator'
    };
  }

  // 2. Cek di DB.users (misal akun yang dibuat di Settings > Pengguna atau akun bawaan)
  if(DB.users && Array.isArray(DB.users)){
    const u = DB.users.find(x => (x.email || '').toLowerCase().trim() === key);
    if(u){
      const acc = {
        email: key,
        name: u.name || deriveNameFromEmail(key),
        password: u.password,
        role: u.role || 'Administrator'
      };
      // Auto-heal DB.credentials agar lookup selanjutnya instan
      if(!DB.credentials) DB.credentials = {};
      DB.credentials[key] = { name: acc.name, password: acc.password, role: acc.role, createdAt: Date.now() };
      localCacheSet('inv:auth:credentials', DB.credentials);
      storeSet('inv:auth:credentials', DB.credentials).catch(()=>{});
      return acc;
    }
  }

  return null;
}

async function attemptAuth(email, password, emailErrId, passwordErrId, intendedRole){
  clearFieldErrors(emailErrId, passwordErrId);
  email = (email || '').trim();
  password = (password || '').trim();

  let ok = true;
  if(!email || !isValidEmail(email)){
    showFieldError(emailErrId, 'Masukkan alamat email yang valid (contoh: nama@email.com)');
    ok = false;
  }
  if(!password || password.length < 6){
    showFieldError(passwordErrId, 'Password minimal 6 karakter');
    ok = false;
  }
  if(!ok) return { ok: false };

  const acc = findAccount(email);
  if(!acc){
    showFieldError(emailErrId, 'Akun dengan email ini belum terdaftar. Silakan pilih tab "Daftar Akun" di atas untuk membuat akun baru.');
    return { ok: false };
  }

  if(acc.password !== password){
    showFieldError(passwordErrId, 'Password tidak sesuai. Silakan periksa kembali atau klik "Lupa password?".');
    return { ok: false };
  }

  if(intendedRole && acc.role && !roleTrackMatches(acc.role, intendedRole)){
    showFieldError(passwordErrId, `Email ini terdaftar sebagai ${acc.role}. Gunakan peran yang sesuai.`);
    return { ok: false };
  }

  return { ok: true, role: acc.role || 'Administrator', name: acc.name, email: acc.email };
}

window.handleLogin = async function(){
  clearFieldErrors('loginEmailErr','loginPasswordErr');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginSubmitBtn');
  const txt = document.getElementById('loginBtnText');

  if(btn){ btn.disabled = true; }
  if(txt){ txt.textContent = 'Memverifikasi...'; }
  try{
    const result = await attemptAuth(email, password, 'loginEmailErr', 'loginPasswordErr');
    if(!result.ok) return;
    enterApp(result.role, email, password.trim(), false, result.name);
  } finally {
    if(btn){ btn.disabled = false; }
    if(txt){ txt.textContent = 'Masuk ke Sistem'; }
  }
};

window.switchAuthTab = function(tab){
  const isLogin = tab === 'login';
  const tabL = document.getElementById('tabLoginBtn');
  const tabR = document.getElementById('tabRegisterBtn');
  const viewL = document.getElementById('formLoginView');
  const viewR = document.getElementById('formRegisterView');
  if(tabL) tabL.classList.toggle('active', isLogin);
  if(tabR) tabR.classList.toggle('active', !isLogin);
  if(viewL) viewL.style.display = isLogin ? 'block' : 'none';
  if(viewR) viewR.style.display = isLogin ? 'none' : 'block';
  clearFieldErrors('loginEmailErr','loginPasswordErr');
};

window.toggleInputPw = function(inputId, btn){
  const input = document.getElementById(inputId);
  if(!input) return;
  const isPw = input.type === 'password';
  input.type = isPw ? 'text' : 'password';
  btn.style.color = isPw ? 'var(--red)' : 'var(--ink-soft)';
};

window.handleLogout = function(){
  const session = getSavedSession();
  if(session){
    recordActivity('LOGOUT', { userName: session.name, email: session.email, role: session.role, note: 'Pengguna keluar sistem' });
  }
  stopSessionHeartbeat();
  clearSession();
  document.documentElement.classList.remove('user-authenticated');
  document.getElementById('landingScreen').classList.remove('hidden');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  clearFieldErrors('loginEmailErr','loginPasswordErr');
  goPage('dashboard');
  smartekToast('Anda telah keluar');
};

window.enterApp = async function(role, email, password, silent = false, displayName = null){
  document.documentElement.classList.add('user-authenticated');
  document.getElementById('landingScreen').classList.add('hidden');

  const key = (email || '').toLowerCase().trim();
  let userName = displayName;
  if(!userName && DB.credentials && DB.credentials[key] && DB.credentials[key].name){
    userName = DB.credentials[key].name;
  }
  if(!userName && DB.users && Array.isArray(DB.users)){
    const u = DB.users.find(x => (x.email || '').toLowerCase().trim() === key);
    if(u && u.name) userName = u.name;
  }
  if(!userName && email){
    userName = deriveNameFromEmail(email);
  }
  if(!userName) userName = 'Pengguna';

  // Update UI header profil & avatar
  const roleEl = document.querySelector('.user .role');
  const nameEl = document.querySelector('.user .name');
  const avatarEl = document.querySelector('.user .avatar');
  if(roleEl) roleEl.textContent = role;
  if(nameEl) nameEl.textContent = userName;
  if(avatarEl) avatarEl.textContent = userName.trim().charAt(0).toUpperCase() || 'U';

  DB.currentRole = role;
  if(email){
    saveSession(email, role, userName);
    // Catat lastLogin pengguna di DB.users
    let joinedTime = Date.now();
    if(Array.isArray(DB.users)){
      const idx = DB.users.findIndex(u => (u.email || '').toLowerCase().trim() === key);
      if(idx >= 0){
        DB.users[idx].lastLogin = Date.now();
        if(password) DB.users[idx].password = password;
        if(DB.users[idx].createdAt) joinedTime = DB.users[idx].createdAt;
        localCacheSet('inv:settings:users', DB.users);
      }
    }
    if(DB.credentials && DB.credentials[key] && DB.credentials[key].createdAt){
      joinedTime = DB.credentials[key].createdAt;
    }
    DB.profile = {
      name: userName,
      email: key || email,
      role: role,
      joined: joinedTime
    };
    localCacheSet('inv:settings:profile', DB.profile);
  }

  renderSidebarLockState();
  if(!isPageAllowed(document.querySelector('.nav-item.active')?.dataset.page || 'dashboard')){
    goPage('dashboard');
  }
  renderPage(document.querySelector('.nav-item.active')?.dataset.page || 'dashboard');

  if(!silent){
    smartekToast(`Masuk sebagai ${role}`);
    recordActivity('LOGIN', { userName, email: key, role, note: 'Login pengguna berhasil' });
  }
  startSessionHeartbeat();
};

window.openForgotPassword = function(){
  const prefill = document.getElementById('loginEmail').value.trim();
  document.getElementById('resetEmail').value = prefill;
  clearFieldErrors('resetEmailErr');
  document.getElementById('resetPasswordOverlay').classList.add('open');
};
window.closeForgotPassword = function(){
  document.getElementById('resetPasswordOverlay').classList.remove('open');
};

window.confirmResetPassword = async function(){
  clearFieldErrors('resetEmailErr');
  const email = document.getElementById('resetEmail').value.trim();
  if(!email || !isValidEmail(email)){
    showFieldError('resetEmailErr', 'Masukkan alamat email yang valid');
    return;
  }
  const key = email.toLowerCase();
  const acc = findAccount(key);
  if(!acc){
    showFieldError('resetEmailErr', 'Email ini belum pernah terdaftar, jadi tidak ada password yang perlu direset.');
    return;
  }
  if(DB.credentials && DB.credentials[key]){
    delete DB.credentials[key];
    localCacheSet('inv:auth:credentials', DB.credentials);
    storeSet('inv:auth:credentials', DB.credentials).catch(()=>{});
  }
  if(DB.users && Array.isArray(DB.users)){
    const u = DB.users.find(x => (x.email || '').toLowerCase() === key);
    if(u){
      delete u.password;
      localCacheSet('inv:settings:users', DB.users);
      storeSet('inv:settings:users', DB.users).catch(()=>{});
    }
  }
  closeForgotPassword();
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = '';
  clearFieldErrors('loginEmailErr','loginPasswordErr');
  smartekToast('Password lama berhasil direset. Silakan buat password baru di tab "Daftar Akun".');
};
