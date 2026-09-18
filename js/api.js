/* ============ storage helpers (Google Apps Script Web App) ============ */
async function storeGet(key){
  try{
    const res = await fetch(`${GAS_URL}?action=get&key=${encodeURIComponent(key)}`);
    const json = await res.json();
    if(json && json.ok){
      if(json.value !== null) localCacheSet(key, json.value);
      return json.value;
    }
    return localCacheGet(key);
  }catch(e){
    console.warn('storeGet offline / fallback ke cache lokal:', key, e);
    return localCacheGet(key);
  }
}

async function storeGetAll(){
  try{
    const res = await fetch(`${GAS_URL}?action=getAll`);
    const json = await res.json();
    if(json && json.ok && json.data){
      for(const k in json.data){ localCacheSet(k, json.data[k]); }
      return json.data;
    }
    return null;
  }catch(e){
    console.warn('storeGetAll gagal, fallback ke cache lokal:', e);
    return null;
  }
}

let pendingSyncCount = 0;

function updateSyncBadge(status, text){
  const dot = document.getElementById('syncDot');
  const txt = document.getElementById('syncText');
  if(!dot || !txt) return;
  if(status === 'syncing'){
    dot.style.background = '#F59E0B'; // Amber
    txt.textContent = text || 'Sinkronisasi cloud...';
  } else if(status === 'synced'){
    dot.style.background = '#10B981'; // Green
    txt.textContent = text || 'Tersinkron ke cloud';
  } else if(status === 'offline'){
    dot.style.background = '#94A3B8'; // Slate
    txt.textContent = text || 'Tersimpan di perangkat';
  }
}

async function storeSet(key, val){
  localCacheSet(key, val);
  pendingSyncCount++;
  updateSyncBadge('syncing');

  try{
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'set', key: key, value: val })
    });
    const json = await res.json();
    pendingSyncCount = Math.max(0, pendingSyncCount - 1);

    if(json && json.ok){
      if(json.updatedAt) lastKnownUpdate = json.updatedAt;
      if(pendingSyncCount === 0) updateSyncBadge('synced');
      return true;
    }
    if(pendingSyncCount === 0) updateSyncBadge('offline');
    return false;
  }catch(e){
    console.error('storeSet background sync gagal:', key, e);
    pendingSyncCount = Math.max(0, pendingSyncCount - 1);
    if(pendingSyncCount === 0) updateSyncBadge('offline');
    return false;
  }
}

/* ============ AUTO SYNC (Google Apps Script Polling & Focus Sync) ============ */
const isOverlayOpen = (id) => { const el = document.getElementById(id); return !!el && el.classList.contains('open'); };
let isSyncing = false;

async function checkRemoteSync(){
  if(isSyncing) return;
  try{
    const res = await fetch(`${GAS_URL}?action=getMeta`);
    const json = await res.json();
    if(json && json.ok && json.latestUpdate){
      if(lastKnownUpdate === 0){
        lastKnownUpdate = json.latestUpdate;
        return;
      }
      if(json.latestUpdate > lastKnownUpdate){
        lastKnownUpdate = json.latestUpdate;
        isSyncing = true;
        const allData = await storeGetAll();
        if(allData){
          await loadAll(allData);
          if(allData['inv:settings:users']){ DB.users = allData['inv:settings:users']; if(isOverlayOpen('usersOverlay')) renderUsers(); }
          if(allData['inv:settings:warehouses']){ DB.warehouses = allData['inv:settings:warehouses']; if(isOverlayOpen('warehouseOverlay')) renderWarehouses(); }
          if(allData['inv:settings:units']){ DB.units = allData['inv:settings:units']; if(isOverlayOpen('unitsOverlay')) renderUnits(); }
          const activeKey = document.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
          renderPage(activeKey);
          refreshAlertBadge();
        }
        isSyncing = false;
      }
    }
  }catch(e){
    isSyncing = false;
  }
}

function setupRealtimeSync(){
  // Sinkronisasi otomatis saat pengguna kembali membuka tab ini
  window.addEventListener('focus', checkRemoteSync);
  // Cek berkala di latar belakang setiap 25 detik
  setInterval(checkRemoteSync, 25000);
}

/* ============ USER ACTIVITY & LIVE SESSIONS (Google Sheets) ============ */
let activeSessionTimer = null;
let currentSessionId = null;

function getClientDeviceInfo(){
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
  let browser = 'Browser';
  if(ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if(ua.includes('Chrome/')) browser = 'Google Chrome';
  else if(ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Apple Safari';
  else if(ua.includes('Firefox/')) browser = 'Mozilla Firefox';

  let os = 'Unknown OS';
  if(ua.includes('Windows')) os = 'Windows';
  else if(ua.includes('Mac OS')) os = 'macOS';
  else if(ua.includes('Android')) os = 'Android';
  else if(ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if(ua.includes('Linux')) os = 'Linux';

  return `${browser} (${os})`;
}

function getOrCreateSessionId(){
  if(currentSessionId) return currentSessionId;
  try {
    let s = sessionStorage.getItem('smartek:session_id');
    if(!s){
      s = 'ses_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
      sessionStorage.setItem('smartek:session_id', s);
    }
    currentSessionId = s;
    return s;
  } catch(e){
    currentSessionId = 'ses_' + Date.now().toString(36);
    return currentSessionId;
  }
}

async function recordActivity(actionType, details = {}){
  const sessionId = getOrCreateSessionId();
  const payload = {
    action: 'logActivity',
    actionType: actionType, // 'DAFTAR_BARU', 'LOGIN', 'LOGOUT'
    userName: details.userName || DB.profile?.name || '-',
    email: details.email || '-',
    role: details.role || DB.currentRole || 'Administrator',
    device: getClientDeviceInfo(),
    sessionId: sessionId,
    note: details.note || '-'
  };

  try{
    fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).catch(()=>{});
  } catch(e){}
}

async function sendSessionHeartbeat(isOnline = true){
  const session = getSavedSession();
  if(!session && isOnline) return;

  const sessionId = getOrCreateSessionId();
  const payload = {
    action: 'liveSession',
    sessionId: sessionId,
    userName: session?.name || DB.profile?.name || '-',
    email: session?.email || '-',
    role: session?.role || DB.currentRole || 'Administrator',
    device: getClientDeviceInfo(),
    isOnline: isOnline
  };

  try{
    if(!isOnline && typeof navigator !== 'undefined' && navigator.sendBeacon){
      navigator.sendBeacon(GAS_URL, JSON.stringify(payload));
    } else {
      fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        keepalive: !isOnline
      }).catch(()=>{});
    }
  } catch(e){}
}

function startSessionHeartbeat(){
  if(activeSessionTimer) clearInterval(activeSessionTimer);
  sendSessionHeartbeat(true);
  activeSessionTimer = setInterval(() => {
    sendSessionHeartbeat(true);
  }, 60000);
}

function stopSessionHeartbeat(){
  if(activeSessionTimer){
    clearInterval(activeSessionTimer);
    activeSessionTimer = null;
  }
  sendSessionHeartbeat(false);
}
