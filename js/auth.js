/* ============ LANDING SCREEN ============ */
let pendingRole = null;

/* ---- autentikasi sederhana (client-side) ----
   Login pertama kali untuk suatu email = pendaftaran akun (password disimpan).
   Login berikutnya wajib memakai password yang sama, minimal 6 karakter,
   dan email harus berformat valid. */
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

async function attemptAuth(email, password, emailErrId, passwordErrId, intendedRole){
  clearFieldErrors(emailErrId, passwordErrId);
  let ok = true;
  if(!email || !isValidEmail(email)){
    showFieldError(emailErrId, 'Masukkan alamat email yang valid (contoh: nama@email.com)');
    ok = false;
  }
  password = (password || '').trim();
  if(!password || password.length < 6){
    showFieldError(passwordErrId, 'Password minimal 6 karakter');
    ok = false;
  }
  if(!ok) return { ok:false };

  const key = email.toLowerCase();
  const latest = (await storeGet('inv:auth:credentials')) || DB.credentials || {};
  DB.credentials = latest;
  const existing = DB.credentials[key];

  if(existing){
    if(existing.password !== password){
      showFieldError(passwordErrId, 'Password tidak sesuai. Silakan periksa kembali atau klik "Lupa password?".');
      return { ok:false };
    }
    if(intendedRole && existing.role && !roleTrackMatches(existing.role, intendedRole)){
      showFieldError(passwordErrId, `Email ini terdaftar sebagai ${existing.role}. Gunakan peran yang sesuai.`);
      return { ok:false };
    }
    return { ok:true, role: existing.role || intendedRole || 'Administrator' };
  }

  // Akun belum terdaftar di database
  // Jika email adalah admin default (admin@smartek.co.id) atau database akun masih kosong,
  // jadikan Administrator default secara otomatis.
  const isDefaultAdmin = key === 'admin@smartek.co.id';
  const isFirstAccount = Object.keys(DB.credentials).length === 0;
  let roleToSave = intendedRole || ((isDefaultAdmin || isFirstAccount) ? 'Administrator' : 'Pengguna');
  
  if(roleToSave === 'Administrator'){
    const sudahAdaOwner = Object.values(DB.credentials).some(c => c.role === 'Administrator');
    if(sudahAdaOwner && !isDefaultAdmin) roleToSave = 'Admin';
  }

  const updated = { ...DB.credentials, [key]: { password, role: roleToSave, createdAt: Date.now() } };
  const saved = await storeSet('inv:auth:credentials', updated);
  if(!saved){
    showFieldError(passwordErrId, 'Gagal menyimpan akun karena gangguan jaringan. Silakan coba lagi.');
    return { ok:false };
  }
  DB.credentials = updated;
  return { ok:true, role: roleToSave };
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
    enterApp(result.role, email, password.trim());
  } finally {
    if(btn){ btn.disabled = false; }
    if(txt){ txt.textContent = 'Masuk ke Sistem'; }
  }
};

window.handleRegister = async function(){
  clearFieldErrors('regNameErr','regEmailErr','regPasswordErr');
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const roleEl = document.querySelector('input[name="regRole"]:checked');
  const role = roleEl ? roleEl.value : 'Admin';

  let ok = true;
  if(!name){ showFieldError('regNameErr', 'Masukkan nama lengkap'); ok = false; }
  if(!email || !isValidEmail(email)){ showFieldError('regEmailErr', 'Masukkan alamat email valid'); ok = false; }
  if(!password || password.length < 6){ showFieldError('regPasswordErr', 'Password minimal 6 karakter'); ok = false; }
  if(!ok) return;

  const btn = document.getElementById('regSubmitBtn');
  const txt = document.getElementById('regBtnText');
  if(btn) btn.disabled = true;
  if(txt) txt.textContent = 'Mendaftarkan...';

  try{
    const key = email.toLowerCase();
    const latest = (await storeGet('inv:auth:credentials')) || DB.credentials || {};
    if(latest[key]){
      showFieldError('regEmailErr', 'Email ini sudah terdaftar. Silakan pilih tab "Masuk".');
      return;
    }
    const updated = { ...latest, [key]: { name, password, role, createdAt: Date.now() } };
    const saved = await storeSet('inv:auth:credentials', updated);
    if(!saved){
      showFieldError('regPasswordErr', 'Gagal mendaftar karena gangguan koneksi. Silakan coba lagi.');
      return;
    }
    DB.credentials = updated;
    await syncUserFromLogin(email, password, role);
    enterApp(role, email, password);
    smartekToast(`Akun ${role} berhasil dibuat!`);
  } finally {
    if(btn) btn.disabled = false;
    if(txt) txt.textContent = 'Daftar Akun Baru';
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
  clearFieldErrors('loginEmailErr','loginPasswordErr','regNameErr','regEmailErr','regPasswordErr');
};

window.quickFillAdmin = function(){
  switchAuthTab('login');
  document.getElementById('loginEmail').value = 'admin@smartek.co.id';
  document.getElementById('loginPassword').value = 'admin123';
  clearFieldErrors('loginEmailErr','loginPasswordErr');
  smartekToast('Akun demo Admin terisi!');
};

window.toggleInputPw = function(inputId, btn){
  const input = document.getElementById(inputId);
  if(!input) return;
  const isPw = input.type === 'password';
  input.type = isPw ? 'text' : 'password';
  btn.style.color = isPw ? 'var(--red)' : 'var(--ink-soft)';
};

window.handleLogout = function(){
  clearSession();
  document.getElementById('landingScreen').classList.remove('hidden');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  clearFieldErrors('loginEmailErr','loginPasswordErr');
  goPage('dashboard');
  smartekToast('Anda telah keluar');
};

window.openRoleLogin = function(role){
  switchAuthTab('login');
  if(role === 'Administrator' || role === 'Admin'){
    document.getElementById('loginEmail').value = 'admin@smartek.co.id';
    document.getElementById('loginPassword').value = 'admin123';
    smartekToast('Akun Admin terpilih. Klik "Masuk ke Sistem" untuk melanjutkan.');
  } else {
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginPassword').value = '';
    smartekToast('Silakan masuk dengan akun Pengguna.');
  }
  const emailInput = document.getElementById('loginEmail');
  if(emailInput){
    emailInput.focus();
    emailInput.scrollIntoView({ behavior:'smooth', block:'center' });
  }
};

window.closeRoleLogin = function(){
  document.getElementById('roleLoginOverlay').classList.remove('open');
  pendingRole = null;
};

window.submitRoleLogin = async function(){
  const email = document.getElementById('roleLoginEmail').value.trim();
  const password = document.getElementById('roleLoginPassword').value;
  const intendedRole = pendingRole;
  const result = await attemptAuth(email, password, 'roleLoginEmailErr', 'roleLoginPasswordErr', intendedRole);
  if(!result.ok) return;
  closeRoleLogin();
  enterApp(result.role, email, password.trim());
};

window.enterApp = async function(role, email, password, silent = false){
  document.getElementById('landingScreen').classList.add('hidden');
  document.querySelector('.user .role').textContent = role;
  DB.currentRole = role;
  if(email){
    saveSession(email, role, DB.profile?.name);
    if(password) await syncUserFromLogin(email, password, role);
  }
  renderSidebarLockState();
  if(!isPageAllowed(document.querySelector('.nav-item.active')?.dataset.page || 'dashboard')){
    goPage('dashboard');
  }
  renderPage(document.querySelector('.nav-item.active')?.dataset.page || 'dashboard');
  if(!silent) smartekToast(`Masuk sebagai ${role}`);
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
  const latest = (await storeGet('inv:auth:credentials')) || {};
  if(!latest[key]){
    showFieldError('resetEmailErr', 'Email ini belum pernah terdaftar, jadi tidak ada password yang perlu direset.');
    return;
  }
  const updated = { ...latest };
  delete updated[key];
  const saved = await storeSet('inv:auth:credentials', updated);
  if(!saved){
    showFieldError('resetEmailErr', 'Gagal mengatur ulang karena gangguan koneksi. Silakan coba lagi.');
    return;
  }
  DB.credentials = updated;
  closeForgotPassword();
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = '';
  clearFieldErrors('loginEmailErr','loginPasswordErr');
  smartekToast('Password lama sudah dihapus. Masukkan password baru lalu klik Masuk untuk mendaftar ulang.');
};
