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

async function storeSet(key, val){
  localCacheSet(key, val);
  try{
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'set', key: key, value: val })
    });
    const json = await res.json();
    if(json && json.ok){
      if(json.updatedAt) lastKnownUpdate = json.updatedAt;
      return true;
    }
    return false;
  }catch(e){
    console.error('storeSet gagal:', key, e);
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
