/* ============ util ============ */
function esc(s){ return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function rupiah(n){ return 'Rp' + Number(n||0).toLocaleString('id-ID'); }
function smartekToast(msg, duration = 3000){
  const el = document.getElementById('toastEl');
  if(!el) return;
  el.textContent = msg; el.classList.add('show');
  if(el._toastTimer) clearTimeout(el._toastTimer);
  el._toastTimer = setTimeout(()=>el.classList.remove('show'), duration);
}
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function fmtDT(ts){
  if(!ts) return '-';
  const d = new Date(ts);
  const tgl = d.toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
  const jam = d.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
  return `${tgl}, ${jam}`;
}

/* ============ nav / routing ============ */
const NAV = [
  { key:'dashboard', label:'Dashboard', icon:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>', title:'Dashboard', sub:'Pantau dan kelola inventori dengan mudah' },
  { key:'items', label:'Items', icon:'<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>', title:'Items', sub:'Daftar semua item inventori' },
  { key:'categories', label:'Categories', icon:'<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>', title:'Categories', sub:'Kategori barang' },
  { key:'stock-in', label:'Stock In', icon:'<path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7z"/>', title:'Stock In', sub:'Catat barang masuk' },
  { key:'stock-out', label:'Stock Out', icon:'<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>', title:'Stock Out', sub:'Catat barang keluar' },
  { key:'suppliers', label:'Suppliers', icon:'<circle cx="9" cy="7" r="3.5"/><path d="M2 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/>', title:'Suppliers', sub:'Daftar pemasok barang' },
  { key:'purchase-orders', label:'Purchase Orders', icon:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h6M9 16h6"/>', title:'Purchase Orders', sub:'Daftar purchase order' },
  { key:'reports', label:'Reports', icon:'<path d="M4 20V10M12 20V4M20 20v-7"/>', title:'Reports', sub:'Laporan inventori' },
  { key:'alerts', label:'Alerts', icon:'<path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>', title:'Alerts', sub:'Peringatan stok' },
  { key:'settings', label:'Settings', icon:'<circle cx="12" cy="12" r="3"/>', title:'Settings', sub:'Pengaturan sistem' },
  { key:'profile', hidden:true, title:'Profile', sub:'Profil pengguna' },
];
document.getElementById('navList').innerHTML = NAV.filter(n=>!n.hidden).map(n => `
  <button class="nav-item ${n.key==='dashboard'?'active':''}" data-page="${n.key}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${n.icon}</svg>${n.label}
  </button>`).join('');

/* ============ ROLE-BASED ACCESS ============ */
const PAGE_ACCESS = {
  'dashboard': ['Administrator','Admin','Staff Gudang','Pengguna','Viewer'],
  'items': ['Administrator','Admin','Staff Gudang','Pengguna','Viewer'],
  'categories': ['Administrator','Admin','Staff Gudang','Pengguna','Viewer'],
  'stock-in': ['Administrator','Admin','Staff Gudang'],
  'stock-out': ['Administrator','Admin','Staff Gudang'],
  'suppliers': ['Administrator','Admin','Staff Gudang'],
  'purchase-orders': ['Administrator','Admin','Staff Gudang'],
  'reports': ['Administrator','Admin','Staff Gudang'],
  'alerts': ['Administrator','Admin','Staff Gudang','Pengguna','Viewer'],
  'settings': ['Administrator'],
  'profile': ['Administrator','Admin','Staff Gudang','Pengguna','Viewer'],
};
function isPageAllowed(key){ return (PAGE_ACCESS[key]||[]).includes(DB.currentRole); }
function canWrite(){
  return DB.currentRole === 'Administrator' || DB.currentRole === 'Admin' || DB.currentRole === 'Staff Gudang';
}
function roleTrackMatches(existingRole, intendedRole){
  if(!intendedRole) return true;
  const ex = (existingRole || '').toLowerCase();
  const it = (intendedRole || '').toLowerCase();
  if(it.includes('admin')) return ex.includes('admin');
  return ex === it;
}

function renderSidebarLockState(){
  document.querySelectorAll('.nav-item[data-page]').forEach(btn=>{
    const key = btn.dataset.page;
    const allowed = isPageAllowed(key);
    btn.classList.toggle('locked', !allowed);
    let lockIc = btn.querySelector('.lock-ic');
    if(!allowed && !lockIc){
      btn.insertAdjacentHTML('beforeend', `<svg class="lock-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="12" height="12" style="margin-left:auto;"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>`);
    } else if(allowed && lockIc){
      lockIc.remove();
    }
  });
}

function goPage(key){
  if(!key || !PAGE_ACCESS[key]){ return; }
  if(!isPageAllowed(key)){
    smartekToast(`Halaman ini memerlukan akses ${PAGE_ACCESS[key].join('/')}`);
    return;
  }
  closeMobileSidebar();
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.page === key));
  document.querySelectorAll('.bottom-nav-item[data-bottom-page]').forEach(b => b.classList.toggle('active', b.dataset.bottomPage === key));
  document.querySelectorAll('.page-section').forEach(s => s.classList.toggle('active', s.id === 'page-' + key));
  const nav = NAV.find(n => n.key === key);
  if(nav){ document.getElementById('pageTitle').textContent = nav.title; document.getElementById('pageSubtitle').textContent = nav.sub; }
  renderPage(key);
}
document.querySelectorAll('.nav-item[data-page]').forEach(b => b.addEventListener('click', () => goPage(b.dataset.page)));

function renderPage(key){
  if(key === 'dashboard') renderDashboard();
  else if(key === 'items') renderItems();
  else if(key === 'categories') renderCategories();
  else if(key === 'stock-in') renderMovements('in');
  else if(key === 'stock-out') renderMovements('out');
  else if(key === 'suppliers') renderSuppliers();
  else if(key === 'purchase-orders') renderPOs();
  else if(key === 'reports') renderReports();
  else if(key === 'alerts') renderAlerts();
  else if(key === 'profile') renderProfile();
}

function refreshAlertBadge(){
  const alertItems = itemList()
    .map(i => ({ item:i, type: statusOf(i) }))
    .filter(a => a.type !== 'aman');
  const badgeEl = document.getElementById('alertBadge');
  const showBadge = !DB.notifSettings || DB.notifSettings.badgeEnabled !== false;
  badgeEl.textContent = alertItems.length;
  badgeEl.style.display = (showBadge && alertItems.length > 0) ? 'flex' : 'none';
  document.getElementById('notifCount').textContent = `${alertItems.length} peringatan`;

  const notifList = document.getElementById('notifList');
  if(alertItems.length === 0){
    notifList.innerHTML = `<div class="notif-empty">🎉 Semua stok dalam kondisi aman</div>`;
  } else {
    notifList.innerHTML = alertItems.slice(0,8).map(a=>{
      const isHabis = a.type === 'habis';
      return `<div class="notif-item" onclick="goPage('items'); closeNotif();">
        <div class="notif-ic" style="background:${isHabis?'var(--red-bg)':'var(--amber-bg)'};color:${isHabis?'#C22222':'#B5720B'};">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
        </div>
        <div class="notif-body">
          <div class="notif-title">${isHabis?'Stok Habis':'Stok Rendah'} — ${esc(a.item.name)}</div>
          <div class="notif-sub">Sisa ${a.item.qty} ${esc(a.item.unit||'pcs')} (min ${a.item.min})</div>
        </div>
      </div>`;
    }).join('');
  }
}

const notifWrap = document.getElementById('notifWrap');
const notifDropdown = document.getElementById('notifDropdown');
function closeNotif(){ notifDropdown.classList.remove('open'); }
document.getElementById('notifBtn').addEventListener('click', (e)=>{
  e.stopPropagation();
  notifDropdown.classList.toggle('open');
});
document.addEventListener('click', (e)=>{
  if(!notifWrap.contains(e.target)) closeNotif();
});

/* ============ MOBILE NAVIGATION CONTROLS ============ */
window.openMobileSidebar = function(){
  document.getElementById('appSidebar')?.classList.add('open');
  document.getElementById('sidebarBackdrop')?.classList.add('open');
  document.body.style.overflow = 'hidden';
};
window.closeMobileSidebar = function(){
  document.getElementById('appSidebar')?.classList.remove('open');
  document.getElementById('sidebarBackdrop')?.classList.remove('open');
  document.body.style.overflow = '';
};
document.getElementById('btnMobileMenu')?.addEventListener('click', openMobileSidebar);
document.getElementById('btnCloseSidebar')?.addEventListener('click', closeMobileSidebar);
document.getElementById('sidebarBackdrop')?.addEventListener('click', closeMobileSidebar);
