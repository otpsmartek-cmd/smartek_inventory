/* ============ SETTINGS: Informasi Perusahaan ============ */
async function loadCompany(){ DB.company = (await storeGet('inv:settings:company')) || { name:'', address:'', phone:'', email:'' }; }
window.openCompanyModal = function(){
  document.getElementById('coName').value = DB.company.name || '';
  document.getElementById('coAddress').value = DB.company.address || '';
  document.getElementById('coPhone').value = DB.company.phone || '';
  document.getElementById('coEmail').value = DB.company.email || '';
  document.getElementById('companyOverlay').classList.add('open');
};
window.closeCompanyModal = function(){ document.getElementById('companyOverlay').classList.remove('open'); };
window.saveCompany = async function(){
  DB.company = {
    name: document.getElementById('coName').value.trim(),
    address: document.getElementById('coAddress').value.trim(),
    phone: document.getElementById('coPhone').value.trim(),
    email: document.getElementById('coEmail').value.trim()
  };
  await storeSet('inv:settings:company', DB.company);
  closeCompanyModal();
  smartekToast('Informasi perusahaan tersimpan');
};

/* ============ SETTINGS: Pengguna ============ */
async function loadUsers(){ DB.users = (await storeGet('inv:settings:users')) || [ { id: uid(), name:'Admin Smartek', email:'admin@smartek.co.id', role:'Administrator' } ]; }
function deriveNameFromEmail(email){
  const local = (email || '').split('@')[0] || email;
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  if(!cleaned) return email;
  return cleaned.split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
/* Setiap kali ada yang berhasil login, otomatis catat/perbarui namanya di daftar
   Settings > Pengguna, lengkap dengan role dan passwordnya (disamarkan di tabel,
   bisa ditampilkan lewat tombol "Lihat"). */
async function syncUserFromLogin(email, password, role, displayName = null){
  const key = (email || '').toLowerCase().trim();
  if(!key) return;
  const list = Array.isArray(DB.users) ? [...DB.users] : [];
  const idx = list.findIndex(u => (u.email || '').toLowerCase().trim() === key);
  const now = Date.now();
  const name = displayName || (idx >= 0 && list[idx].name ? list[idx].name : deriveNameFromEmail(email));
  if(idx >= 0){
    list[idx] = { ...list[idx], name, role, password: password || list[idx].password, lastLogin: now };
  } else {
    list.unshift({ id: uid(), name, email: key, role, password, lastLogin: now });
  }
  DB.users = list;
  localCacheSet('inv:settings:users', list);
  const overlay = document.getElementById('usersOverlay');
  if(overlay && overlay.classList.contains('open')) renderUsers();

  // Background sync ke server
  storeSet('inv:settings:users', list).catch(()=>{});
}
function renderUsers(){
  document.getElementById('usersBody').innerHTML = DB.users.length === 0
    ? `<tr class="empty-row"><td colspan="5">Belum ada pengguna.</td></tr>`
    : DB.users.map(u=>`<tr>
        <td><b>${esc(u.name)}</b></td>
        <td>${esc(u.email || '-')}</td>
        <td>${esc(u.role)}</td>
        <td>${u.password ? `
          <span id="pwmask-${u.id}" style="font-family:monospace;letter-spacing:1px;">••••••••</span>
          <span id="pwplain-${u.id}" style="display:none;font-family:monospace;">${esc(u.password)}</span>
          <button type="button" class="btn btn-ghost btn-sm" style="margin-left:4px;" onclick="togglePwVisible('${u.id}')" id="pwbtn-${u.id}">Lihat</button>
        ` : `<span style="color:var(--ink-soft);font-size:11px;">-</span>`}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="deleteUser('${u.id}')">Hapus</button></td>
      </tr>`).join('');
}
window.togglePwVisible = function(id){
  const mask = document.getElementById('pwmask-'+id);
  const plain = document.getElementById('pwplain-'+id);
  const btn = document.getElementById('pwbtn-'+id);
  if(!mask || !plain || !btn) return;
  const showing = plain.style.display !== 'none';
  plain.style.display = showing ? 'none' : 'inline';
  mask.style.display = showing ? 'inline' : 'none';
  btn.textContent = showing ? 'Lihat' : 'Sembunyikan';
};
window.openUsersModal = function(){ renderUsers(); document.getElementById('usersOverlay').classList.add('open'); };
window.closeUsersModal = function(){ document.getElementById('usersOverlay').classList.remove('open'); };
window.addUser = async function(){
  const btn = document.getElementById('addUserBtn');
  if(btn && btn.dataset.busy === '1') return;
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim();
  const role = document.getElementById('userRole').value;
  const pwInput = document.getElementById('userPassword');
  const password = (pwInput && pwInput.value.trim()) ? pwInput.value.trim() : '123456';

  if(!name){ smartekToast('Nama pengguna wajib diisi'); return; }
  if(!email || !isValidEmail(email)){ smartekToast('Alamat email tidak valid'); return; }

  const key = email.toLowerCase();
  const newUser = { id: uid(), name, email: key, role, password, lastLogin: null };
  DB.users = [newUser, ...(DB.users || []).filter(u => (u.email || '').toLowerCase() !== key)];
  localCacheSet('inv:settings:users', DB.users);

  // Sinkronkan ke DB.credentials
  if(!DB.credentials) DB.credentials = {};
  DB.credentials[key] = { name, password, role, createdAt: Date.now() };
  localCacheSet('inv:auth:credentials', DB.credentials);

  renderUsers();
  document.getElementById('userName').value = '';
  document.getElementById('userEmail').value = '';
  if(pwInput) pwInput.value = '';
  smartekToast('Pengguna berhasil ditambahkan!');

  // Non-blocking sync ke cloud
  Promise.all([
    storeSet('inv:settings:users', DB.users),
    storeSet('inv:auth:credentials', DB.credentials)
  ]).catch(()=>{});
};
window.deleteUser = async function(id){
  const target = DB.users.find(u => u.id === id);
  DB.users = DB.users.filter(u=>u.id!==id);
  localCacheSet('inv:settings:users', DB.users);

  if(target && target.email){
    const key = target.email.toLowerCase().trim();
    if(DB.credentials && DB.credentials[key]){
      delete DB.credentials[key];
      localCacheSet('inv:auth:credentials', DB.credentials);
      storeSet('inv:auth:credentials', DB.credentials).catch(()=>{});
    }
  }

  renderUsers();
  smartekToast('Pengguna dihapus');
  storeSet('inv:settings:users', DB.users).catch(()=>{});
};

/* ============ SETTINGS: Gudang ============ */
async function loadWarehouses(){ DB.warehouses = (await storeGet('inv:settings:warehouses')) || []; }
function renderWarehouses(){
  document.getElementById('warehouseBody').innerHTML = DB.warehouses.length === 0
    ? `<tr class="empty-row"><td colspan="3">Belum ada gudang tercatat.</td></tr>`
    : DB.warehouses.map(w=>`<tr><td><b>${esc(w.name)}</b></td><td>${esc(w.address||'-')}</td><td><button class="btn btn-ghost btn-sm" onclick="deleteWarehouse('${w.id}')">Hapus</button></td></tr>`).join('');
}
window.openWarehouseModal = function(){ renderWarehouses(); document.getElementById('warehouseOverlay').classList.add('open'); };
window.closeWarehouseModal = function(){ document.getElementById('warehouseOverlay').classList.remove('open'); };
window.addWarehouse = function(){
  const name = document.getElementById('whName').value.trim();
  const address = document.getElementById('whAddress').value.trim();
  if(!name){ smartekToast('Nama gudang wajib diisi'); return; }

  DB.warehouses.unshift({ id: uid(), name, address });
  localCacheSet('inv:settings:warehouses', DB.warehouses);
  document.getElementById('whName').value='';
  document.getElementById('whAddress').value='';
  renderWarehouses();
  smartekToast('Gudang ditambahkan');

  storeSet('inv:settings:warehouses', DB.warehouses).catch(()=>{});
};
window.deleteWarehouse = function(id){
  DB.warehouses = DB.warehouses.filter(w=>w.id!==id);
  localCacheSet('inv:settings:warehouses', DB.warehouses);
  renderWarehouses();
  smartekToast('Gudang dihapus');
  storeSet('inv:settings:warehouses', DB.warehouses).catch(()=>{});
};

/* ============ SETTINGS: Satuan ============ */
async function loadUnits(){ DB.units = (await storeGet('inv:settings:units')) || ['pcs','box','kg','meter']; }
function renderUnits(){
  document.getElementById('unitsChips').innerHTML = DB.units.length === 0
    ? `<div class="note">Belum ada satuan.</div>`
    : DB.units.map(u=>`<span style="display:inline-flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--line);border-radius:20px;padding:6px 8px 6px 12px;font-size:12px;">${esc(u)}<button onclick="deleteUnit('${esc(u)}')" style="border:none;background:none;cursor:pointer;color:var(--ink-soft);font-size:14px;line-height:1;padding:0 2px;">×</button></span>`).join('');
}
window.openUnitsModal = function(){ renderUnits(); document.getElementById('unitsOverlay').classList.add('open'); };
window.closeUnitsModal = function(){ document.getElementById('unitsOverlay').classList.remove('open'); };
window.addUnit = function(){
  const val = document.getElementById('unitInput').value.trim();
  if(!val){ return; }
  if(DB.units.includes(val)){ smartekToast('Satuan sudah ada'); return; }

  DB.units.push(val);
  localCacheSet('inv:settings:units', DB.units);
  document.getElementById('unitInput').value='';
  renderUnits();
  storeSet('inv:settings:units', DB.units).catch(()=>{});
};
window.deleteUnit = function(val){
  DB.units = DB.units.filter(u=>u!==val);
  localCacheSet('inv:settings:units', DB.units);
  renderUnits();
  storeSet('inv:settings:units', DB.units).catch(()=>{});
};

/* ============ SETTINGS: Notifikasi ============ */
async function loadNotifSettings(){ DB.notifSettings = (await storeGet('inv:settings:notif')) || { defaultMin:5, badgeEnabled:true }; }
window.openNotifSettingsModal = function(){
  document.getElementById('notifDefaultMin').value = DB.notifSettings.defaultMin;
  document.getElementById('notifBadgeEnabled').checked = DB.notifSettings.badgeEnabled;
  document.getElementById('notifSettingsOverlay').classList.add('open');
};
window.closeNotifSettingsModal = function(){ document.getElementById('notifSettingsOverlay').classList.remove('open'); };
window.saveNotifSettings = async function(){
  DB.notifSettings = {
    defaultMin: Number(document.getElementById('notifDefaultMin').value) || 0,
    badgeEnabled: document.getElementById('notifBadgeEnabled').checked
  };
  await storeSet('inv:settings:notif', DB.notifSettings);
  document.getElementById('fMin').value = DB.notifSettings.defaultMin; // pengaruh ke form tambah item berikutnya
  closeNotifSettingsModal();
  refreshAlertBadge();
  smartekToast('Pengaturan notifikasi tersimpan');
};

/* ============ SETTINGS: Backup ============ */
window.openBackupModal = function(){ document.getElementById('backupNote').textContent=''; document.getElementById('backupOverlay').classList.add('open'); };
window.closeBackupModal = function(){ document.getElementById('backupOverlay').classList.remove('open'); };
window.downloadBackup = function(){
  const payload = {
    exportedAt: new Date().toISOString(),
    items: itemList(),
    suppliers: DB.suppliers,
    purchaseOrders: DB.purchaseOrders,
    movements: DB.movements,
    company: DB.company,
    users: DB.users,
    warehouses: DB.warehouses,
    units: DB.units,
    notifSettings: DB.notifSettings
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `smartek-inventory-backup-${todayStr()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  smartekToast('Cadangan data diunduh');
};
document.getElementById('restoreFileInput').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    if(!data || !Array.isArray(data.items)) throw new Error('Format file tidak dikenali');

    DB.itemIds = data.items.map(i=>i.id);
    DB.items = {};
    for(const it of data.items){ DB.items[it.id] = it; await saveItem(it); }
    await saveIndex();

    DB.suppliers = data.suppliers || []; await saveSuppliers();
    DB.purchaseOrders = data.purchaseOrders || []; await savePOs();
    DB.movements = data.movements || []; await saveMovements();
    DB.company = data.company || DB.company; await storeSet('inv:settings:company', DB.company);
    DB.users = data.users || DB.users; await storeSet('inv:settings:users', DB.users);
    DB.warehouses = data.warehouses || []; await storeSet('inv:settings:warehouses', DB.warehouses);
    DB.units = data.units || DB.units; await storeSet('inv:settings:units', DB.units);
    DB.notifSettings = data.notifSettings || DB.notifSettings; await storeSet('inv:settings:notif', DB.notifSettings);

    document.getElementById('backupNote').textContent = 'Data berhasil dipulihkan.';
    smartekToast('Data berhasil dipulihkan dari cadangan');
    refreshAlertBadge();
    renderPage(document.querySelector('.nav-item.active').dataset.page);
  }catch(err){
    document.getElementById('backupNote').textContent = 'Gagal memulihkan: file tidak valid.';
    smartekToast('Gagal memulihkan data');
  }
  e.target.value = '';
});

/* ============ PROFILE ============ */
async function loadProfile(){
  DB.profile = (await storeGet('inv:settings:profile')) || {
    name:'Admin Smartek', email:'admin@smartek.co.id', role:'Administrator', joined: todayStr()
  };
}
function formatJoinedDate(dateStr){
  try{
    const d = new Date(dateStr);
    if(isNaN(d)) return dateStr;
    return d.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
  }catch(e){ return dateStr; }
}
function renderProfile(){
  document.getElementById('profileName').textContent = DB.profile.name;
  document.getElementById('profileRoleLabel').textContent = DB.profile.role;
  document.getElementById('profileEmail').textContent = DB.profile.email;
  document.getElementById('profileRoleValue').textContent = DB.profile.role;
  document.getElementById('profileJoined').textContent = formatJoinedDate(DB.profile.joined);
}
window.openProfileEditModal = function(){
  document.getElementById('peName').value = DB.profile.name;
  document.getElementById('peEmail').value = DB.profile.email;
  document.getElementById('peRole').value = DB.profile.role;
  document.getElementById('profileEditOverlay').classList.add('open');
};
window.closeProfileEditModal = function(){ document.getElementById('profileEditOverlay').classList.remove('open'); };
window.saveProfileEdit = async function(){
  const name = document.getElementById('peName').value.trim();
  if(!name){ smartekToast('Nama wajib diisi'); return; }
  DB.profile = {
    ...DB.profile,
    name,
    email: document.getElementById('peEmail').value.trim()
    // Role SENGAJA tidak diikutkan di sini — peran hanya boleh berubah lewat
    // proses login/daftar (attemptAuth), bukan diedit bebas dari form profil,
    // supaya orang tidak bisa menaikkan perannya sendiri jadi Administrator.
  };
  await storeSet('inv:settings:profile', DB.profile);
  document.querySelector('.user .name').textContent = DB.profile.name;
  document.querySelector('.user .avatar').textContent = DB.profile.name.trim().charAt(0).toUpperCase() || 'A';
  renderProfile();
  closeProfileEditModal();
  smartekToast('Profil tersimpan');
};
