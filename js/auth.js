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
  const parentWrap = el.closest('.login-field-wrap') || el.closest('.field');
  if(parentWrap){
    const fieldBox = parentWrap.querySelector('.login-field');
    if(fieldBox) fieldBox.classList.add('has-error');
  }
}
function clearFieldErrors(...ids){
  ids.forEach(id=>{
    const el = document.getElementById(id);
    if(el){
      el.textContent = '';
      el.classList.remove('show');
      const parentWrap = el.closest('.login-field-wrap') || el.closest('.field');
      if(parentWrap){
        const fieldBox = parentWrap.querySelector('.login-field');
        if(fieldBox) fieldBox.classList.remove('has-error');
      }
    }
  });
}

/* ============ SESSION & KREDENSIAL ============ */
const SESSION_STORAGE_KEY = 'smartek:auth_session';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // Tepat 24 Jam

function saveSession(email, role, name){
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      email,
      role,
      name: name || deriveNameFromEmail(email),
      loginAt: Date.now()
    }));
  }catch(e){}
}
function clearSession(){
  try { localStorage.removeItem(SESSION_STORAGE_KEY); }catch(e){}
}
function getSavedSession(){
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(!s || !s.email || !s.loginAt) return null;
    const now = Date.now();
    const age = now - Number(s.loginAt);
    if(age > SESSION_MAX_AGE_MS || age < 0){
      clearSession();
      return null;
    }
    return s;
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
  if(DB.credentials && typeof DB.credentials === 'object'){
    let c = DB.credentials[key];
    if(!c){
      const matchK = Object.keys(DB.credentials).find(k => k.toLowerCase().trim() === key);
      if(matchK) c = DB.credentials[matchK];
    }
    if(c && c.password !== undefined && c.password !== null){
      return {
        email: key,
        name: c.name || deriveNameFromEmail(key),
        password: String(c.password),
        role: c.role || 'Administrator'
      };
    }
  }

  // 2. Cek di DB.users (misal akun yang dibuat di Settings > Pengguna atau akun bawaan)
  if(DB.users && Array.isArray(DB.users)){
    const u = DB.users.find(x => (x.email || '').toLowerCase().trim() === key);
    if(u && u.password !== undefined && u.password !== null){
      const acc = {
        email: key,
        name: u.name || deriveNameFromEmail(key),
        password: String(u.password),
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

  let acc = findAccount(email);
  if(!acc){
    // Jika belum ditemukan di memori lokal, ambil credentials & users langsung dari cloud/Google Sheets
    try {
      const remoteCreds = await storeGet('inv:auth:credentials');
      if(remoteCreds && typeof remoteCreds === 'object'){
        DB.credentials = Object.assign({}, DB.credentials || {}, remoteCreds);
        localCacheSet('inv:auth:credentials', DB.credentials);
        acc = findAccount(email);
      }
      if(!acc){
        const remoteUsers = await storeGet('inv:settings:users');
        if(Array.isArray(remoteUsers)){
          DB.users = remoteUsers;
          localCacheSet('inv:settings:users', DB.users);
          acc = findAccount(email);
        }
      }
    } catch(e) {
      console.warn('Gagal sinkron akun dari cloud:', e);
    }
  }

  if(!acc){
    showFieldError(emailErrId, 'Akun dengan email ini belum terdaftar. Silakan hubungi Administrator untuk pembuatan akun.');
    return { ok: false };
  }

  if(String(acc.password).trim() !== String(password).trim()){
    // Re-check ke cloud sekali lagi jika password berbeda (misal baru diubah di perangkat lain/oleh Admin)
    try {
      const remoteCreds = await storeGet('inv:auth:credentials');
      if(remoteCreds && typeof remoteCreds === 'object'){
        DB.credentials = Object.assign({}, DB.credentials || {}, remoteCreds);
        localCacheSet('inv:auth:credentials', DB.credentials);
        acc = findAccount(email);
      }
    } catch(e){}
  }

  if(!acc || String(acc.password).trim() !== String(password).trim()){
    showFieldError(passwordErrId, 'Password tidak sesuai. Silakan periksa kembali atau klik "Lupa password?".');
    return { ok: false };
  }

  if(intendedRole && acc.role && !roleTrackMatches(acc.role, intendedRole)){
    showFieldError(passwordErrId, `Email ini terdaftar sebagai ${acc.role}. Gunakan peran yang sesuai.`);
    return { ok: false };
  }

  return { ok: true, role: acc.role || 'Administrator', name: acc.name, email: acc.email };
}

/* ============ TWO-FACTOR AUTHENTICATION (OTP) ============ */
let pendingLoginContext = null;
let otpResendTimer = null;
let otpResendCountdown = 60;
let otpListenersAttached = false;

function maskEmail(email){
  if(!email) return '';
  const parts = email.split('@');
  if(parts.length < 2) return email;
  const local = parts[0];
  const domain = parts[1];
  if(local.length <= 2) return local.charAt(0) + '***@' + domain;
  return local.charAt(0) + '***' + local.charAt(local.length - 1) + '@' + domain;
}

window.handleLogin = async function(){
  clearFieldErrors('loginEmailErr','loginPasswordErr');
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn = document.getElementById('loginSubmitBtn');
  const txt = document.getElementById('loginBtnText');

  if(btn){ btn.disabled = true; }
  if(txt){ txt.textContent = 'Memverifikasi akun...'; }
  try{
    const result = await attemptAuth(email, password, 'loginEmailErr', 'loginPasswordErr');
    if(!result.ok) return;

    // Kredensial valid! Siapkan konteks login sementara & buka verifikasi OTP
    pendingLoginContext = {
      role: result.role,
      email: result.email || email,
      password: password.trim(),
      name: result.name
    };

    openOtpModal(pendingLoginContext.email);
  } finally {
    if(btn){ btn.disabled = false; }
    if(txt){ txt.textContent = 'Masuk ke Sistem'; }
  }
};

async function openOtpModal(email){
  const overlay = document.getElementById('otpModalOverlay');
  if(!overlay) return;

  const maskedEl = document.getElementById('otpEmailMasked');
  if(maskedEl) maskedEl.textContent = maskEmail(email);

  clearOtpInputs();
  const errEl = document.getElementById('otpErr');
  if(errEl) errEl.textContent = '';
  const card = document.getElementById('otpFallbackCard');
  if(card){ card.style.display = 'none'; card.innerHTML = ''; }

  overlay.classList.add('open');
  initOtpInputEvents();

  setTimeout(() => {
    const first = document.getElementById('otp1');
    if(first) first.focus();
  }, 120);

  await triggerSendOtp(email);
}

async function triggerSendOtp(email){
  const card = document.getElementById('otpFallbackCard');
  const errEl = document.getElementById('otpErr');

  startOtpCountdown();

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'sendOtp', email: email.toLowerCase().trim() })
    });
    const json = await res.json();

    if(json && json.ok){
      if(json.emailSent !== false){
        smartekToast(`Kode OTP telah dikirim ke ${email}. Cek inbox/spam.`, 4000);
      } else if(json.fallbackOtp && card){
        card.style.display = 'block';
        card.innerHTML = `
          <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px;color:#92400E;font-size:11.5px;line-height:1.45;">
            <div style="font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:5px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Izin Email Belum Aktif di Spreadsheet
            </div>
            Layanan email Google Mail belum diaktifkan pemilik spreadsheet. Gunakan kode OTP verifikasi berikut:<br>
            <div style="text-align:center;font-size:24px;font-weight:bold;letter-spacing:6px;color:#B45309;font-family:monospace;margin:8px 0;background:#fff;padding:8px;border-radius:6px;border:1.5px dashed #F59E0B;">
              ${esc(json.fallbackOtp)}
            </div>
            <button type="button" class="btn btn-primary btn-sm" style="width:100%;font-size:11px;" onclick="fillAndVerifyOtp('${esc(json.fallbackOtp)}')">
              Isi Otomatis &amp; Masuk
            </button>
          </div>
        `;
      }
    } else {
      if(errEl) errEl.textContent = json.error || 'Gagal mengirim kode OTP.';
    }
  } catch(e){
    console.warn('sendOtp failed:', e);
    if(errEl) errEl.textContent = 'Koneksi ke server terganggu saat mengirim OTP.';
  }
}

function startOtpCountdown(){
  const resendBtn = document.getElementById('otpResendBtn');
  const timerTxt = document.getElementById('otpTimerTxt');
  const span = document.getElementById('otpCountdown');

  if(otpResendTimer) clearInterval(otpResendTimer);
  otpResendCountdown = 60;
  if(resendBtn) resendBtn.disabled = true;
  if(timerTxt) timerTxt.style.display = 'block';
  if(span) span.textContent = '60';

  otpResendTimer = setInterval(() => {
    otpResendCountdown--;
    if(span) span.textContent = otpResendCountdown.toString();
    if(otpResendCountdown <= 0){
      clearInterval(otpResendTimer);
      if(resendBtn) resendBtn.disabled = false;
      if(timerTxt) timerTxt.style.display = 'none';
    }
  }, 1000);
}

function initOtpInputEvents(){
  if(otpListenersAttached) return;
  otpListenersAttached = true;

  const boxes = [1,2,3,4,5,6].map(n => document.getElementById('otp' + n)).filter(Boolean);

  boxes.forEach((input, idx) => {
    input.addEventListener('input', () => {
      const val = input.value.replace(/\D/g, '');
      input.value = val ? val.slice(-1) : '';
      input.classList.remove('error');
      const errEl = document.getElementById('otpErr');
      if(errEl) errEl.textContent = '';

      if(val && idx < boxes.length - 1){
        boxes[idx + 1].focus();
      }

      const currentCode = boxes.map(b => b.value.trim()).join('');
      if(currentCode.length === 6){
        window.submitOtpVerification();
      }
    });

    input.addEventListener('keydown', (e) => {
      if(e.key === 'Backspace' && !input.value && idx > 0){
        boxes[idx - 1].focus();
      } else if(e.key === 'Enter'){
        e.preventDefault();
        window.submitOtpVerification();
      }
    });

    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      if(!paste) return;
      paste.split('').forEach((ch, i) => {
        if(boxes[i]) boxes[i].value = ch;
      });
      const nextIdx = Math.min(paste.length, boxes.length - 1);
      if(boxes[nextIdx]) boxes[nextIdx].focus();
      if(paste.length === 6){
        window.submitOtpVerification();
      }
    });
  });
}

window.submitOtpVerification = async function(){
  if(!pendingLoginContext) return;
  const boxes = [1,2,3,4,5,6].map(n => document.getElementById('otp' + n));
  const code = boxes.map(b => (b ? b.value.trim() : '')).join('');
  const errEl = document.getElementById('otpErr');
  const submitBtn = document.getElementById('otpSubmitBtn');
  const submitTxt = document.getElementById('otpSubmitTxt');

  if(code.length < 6){
    if(errEl) errEl.textContent = 'Masukkan 6 digit kode OTP yang lengkap';
    boxes.forEach(b => { if(b && !b.value) b.classList.add('error'); });
    return;
  }

  if(submitBtn) submitBtn.disabled = true;
  if(submitTxt) submitTxt.textContent = 'Memverifikasi...';
  if(errEl) errEl.textContent = '';

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'verifyOtp',
        email: pendingLoginContext.email.toLowerCase().trim(),
        code: code
      })
    });
    const json = await res.json();

    if(json && json.ok){
      closeOtpModal();
      const ctx = pendingLoginContext;
      pendingLoginContext = null;
      enterApp(ctx.role, ctx.email, ctx.password, false, ctx.name);
      smartekToast(`Verifikasi OTP berhasil! Selamat datang, ${ctx.name}.`, 3500);
      return;
    }

    if(errEl) errEl.textContent = json.error || 'Kode OTP salah. Silakan coba lagi.';
    boxes.forEach(b => { if(b) b.classList.add('error'); });
  } catch(err){
    console.error('verifyOtp error:', err);
    if(errEl) errEl.textContent = 'Gagal memverifikasi OTP. Periksa koneksi internet Anda.';
  } finally {
    if(submitBtn) submitBtn.disabled = false;
    if(submitTxt) submitTxt.textContent = 'Verifikasi & Masuk';
  }
};

window.resendOtpCode = async function(){
  if(!pendingLoginContext) return;
  const resendBtn = document.getElementById('otpResendBtn');
  if(resendBtn && resendBtn.disabled) return;
  clearOtpInputs();
  const errEl = document.getElementById('otpErr');
  if(errEl) errEl.textContent = '';
  await triggerSendOtp(pendingLoginContext.email);
};

window.cancelOtpVerification = function(){
  closeOtpModal();
  pendingLoginContext = null;
};

function closeOtpModal(){
  const overlay = document.getElementById('otpModalOverlay');
  if(overlay) overlay.classList.remove('open');
  if(otpResendTimer) clearInterval(otpResendTimer);
  clearOtpInputs();
}

function clearOtpInputs(){
  [1,2,3,4,5,6].forEach(n => {
    const b = document.getElementById('otp' + n);
    if(b){ b.value = ''; b.classList.remove('error'); }
  });
}

window.fillAndVerifyOtp = function(code){
  if(!code) return;
  const boxes = [1,2,3,4,5,6].map(n => document.getElementById('otp' + n));
  String(code).trim().slice(0, 6).split('').forEach((ch, idx) => {
    if(boxes[idx]) boxes[idx].value = ch;
  });
  window.submitOtpVerification();
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

window.handleLogout = function(isExpired = false){
  const session = getSavedSession();
  if(session){
    recordActivity('LOGOUT', {
      userName: session.name,
      email: session.email,
      role: session.role,
      note: isExpired ? 'Sesi login berakhir (24 jam)' : 'Pengguna keluar sistem'
    });
  }
  stopSessionHeartbeat();
  clearSession();
  document.documentElement.classList.remove('user-authenticated');
  document.getElementById('landingScreen').classList.remove('hidden');
  document.getElementById('loginEmail').value = '';
  document.getElementById('loginPassword').value = '';
  clearFieldErrors('loginEmailErr','loginPasswordErr');
  goPage('dashboard');
  if(isExpired){
    smartekToast('Sesi login telah berakhir (24 jam). Silakan masuk kembali.', 4500);
  } else {
    smartekToast('Anda telah keluar');
  }
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
  const box = document.getElementById('resetResultBox');
  if(box){ box.style.display = 'none'; box.innerHTML = ''; }
  const btn = document.getElementById('resetSubmitBtn');
  if(btn){ btn.style.display = 'inline-flex'; btn.disabled = false; btn.textContent = 'Kirim Password ke Email'; }
  document.getElementById('resetPasswordOverlay').classList.add('open');
};
window.closeForgotPassword = function(){
  const box = document.getElementById('resetResultBox');
  if(box){ box.style.display = 'none'; box.innerHTML = ''; }
  const btn = document.getElementById('resetSubmitBtn');
  if(btn){ btn.style.display = 'inline-flex'; btn.disabled = false; }
  document.getElementById('resetPasswordOverlay').classList.remove('open');
};

window.confirmResetPassword = async function(){
  clearFieldErrors('resetEmailErr');
  const email = document.getElementById('resetEmail').value.trim();
  const box = document.getElementById('resetResultBox');
  if(box){ box.style.display = 'none'; box.innerHTML = ''; }

  if(!email || !isValidEmail(email)){
    showFieldError('resetEmailErr', 'Masukkan alamat email yang valid');
    return;
  }
  const key = email.toLowerCase();
  let acc = findAccount(key);
  if(!acc){
    try {
      const remoteCreds = await storeGet('inv:auth:credentials');
      if(remoteCreds && typeof remoteCreds === 'object'){
        DB.credentials = Object.assign({}, DB.credentials || {}, remoteCreds);
        localCacheSet('inv:auth:credentials', DB.credentials);
        acc = findAccount(key);
      }
    } catch(e){}
  }
  if(!acc){
    showFieldError('resetEmailErr', 'Email ini belum terdaftar di sistem.');
    return;
  }

  const btn = document.getElementById('resetSubmitBtn');
  const origText = btn ? btn.innerHTML : 'Kirim Password ke Email';
  if(btn){ btn.disabled = true; btn.textContent = 'Memproses ke Server...'; }

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'resetPassword', email: key })
    });
    const json = await res.json();

    if(json && json.ok && json.tempPassword){
      if(!DB.credentials) DB.credentials = {};
      if(!DB.credentials[key]) DB.credentials[key] = { name: acc.name, role: acc.role, createdAt: Date.now() };
      DB.credentials[key].password = json.tempPassword;
      localCacheSet('inv:auth:credentials', DB.credentials);

      if(Array.isArray(DB.users)){
        const u = DB.users.find(x => (x.email || '').toLowerCase() === key);
        if(u) { u.password = json.tempPassword; localCacheSet('inv:settings:users', DB.users); }
      }

      document.getElementById('loginEmail').value = email;
      clearFieldErrors('loginEmailErr','loginPasswordErr');

      if(box){
        box.style.display = 'block';
        if(btn) btn.style.display = 'none';

        if(json.emailSent !== false){
          box.innerHTML = `
            <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:8px;padding:14px;color:#065F46;">
              <div style="font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                Kata Sandi Baru Berhasil Dikirim!
              </div>
              <div style="font-size:12px;line-height:1.5;">
                Kata sandi baru telah dikirim ke <b>${esc(email)}</b>.<br>Silakan periksa folder <b>Kotak Masuk</b> atau <b>Spam</b> Anda.
              </div>
              <button type="button" class="btn btn-primary btn-sm" style="margin-top:12px;width:100%;" onclick="closeForgotPassword()">
                Kembali ke Halaman Masuk
              </button>
            </div>
          `;
          smartekToast(`Kata sandi baru telah dikirim ke ${email}.`, 4000);
        } else {
          box.innerHTML = `
            <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:14px;color:#92400E;">
              <div style="font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Kata Sandi Baru Berhasil Dibuat
              </div>
              <div style="font-size:12px;line-height:1.45;margin-bottom:10px;">
                Izin kirim email Google Apps Script belum diaktifkan pemilik spreadsheet. Berikut kata sandi sementara Anda:
              </div>
              <div style="background:#FFFFFF;border:1.5px dashed #F59E0B;border-radius:6px;padding:10px;text-align:center;font-size:20px;font-weight:bold;letter-spacing:3px;color:#B45309;font-family:monospace;margin-bottom:10px;">
                ${esc(json.tempPassword)}
              </div>
              <button type="button" class="btn btn-primary btn-sm" style="width:100%;" onclick="useTempPasswordAndLogin('${esc(json.tempPassword)}')">
                Gunakan Password Ini &amp; Masuk
              </button>
            </div>
          `;
          smartekToast(`Password sementara akun Anda: ${json.tempPassword}`, 5000);
        }
      }
      return;
    }

    if(json && !json.ok){
      showFieldError('resetEmailErr', json.error || 'Gagal memproses reset password');
      return;
    }
  } catch(err){
    console.warn('resetPassword cloud call failed, using local temporary password:', err);
    const tempPw = 'SMK' + Math.random().toString(36).substring(2, 7).toUpperCase();
    if(!DB.credentials) DB.credentials = {};
    if(!DB.credentials[key]) DB.credentials[key] = { name: acc.name, role: acc.role, createdAt: Date.now() };
    DB.credentials[key].password = tempPw;
    localCacheSet('inv:auth:credentials', DB.credentials);

    if(Array.isArray(DB.users)){
      const u = DB.users.find(x => (x.email || '').toLowerCase() === key);
      if(u) { u.password = tempPw; localCacheSet('inv:settings:users', DB.users); }
    }

    document.getElementById('loginEmail').value = email;
    clearFieldErrors('loginEmailErr','loginPasswordErr');

    if(box){
      box.style.display = 'block';
      if(btn) btn.style.display = 'none';
      box.innerHTML = `
        <div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:14px;color:#92400E;">
          <div style="font-weight:700;font-size:13px;margin-bottom:6px;">Kata Sandi Baru Telah Dibuat</div>
          <div style="font-size:12px;line-height:1.45;margin-bottom:10px;">Gunakan kata sandi sementara berikut untuk masuk:</div>
          <div style="background:#FFFFFF;border:1.5px dashed #F59E0B;border-radius:6px;padding:10px;text-align:center;font-size:20px;font-weight:bold;letter-spacing:3px;color:#B45309;font-family:monospace;margin-bottom:10px;">
            ${tempPw}
          </div>
          <button type="button" class="btn btn-primary btn-sm" style="width:100%;" onclick="useTempPasswordAndLogin('${tempPw}')">
            Gunakan Password Ini &amp; Masuk
          </button>
        </div>
      `;
    }
    smartekToast(`Password sementara Anda: ${tempPw}`, 5000);
  } finally {
    if(btn && (!box || box.style.display === 'none')){
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
};

window.useTempPasswordAndLogin = function(tempPw){
  const email = document.getElementById('resetEmail').value.trim();
  closeForgotPassword();
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = tempPw;
  clearFieldErrors('loginEmailErr','loginPasswordErr');
  smartekToast('Password terpasang! Silakan klik Masuk ke Sistem.', 3500);
};
