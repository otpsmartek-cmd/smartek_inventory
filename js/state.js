/* Cache lokal (localStorage) untuk akses instan & dukungan offline */
function localCacheGet(key){
  try { const v = localStorage.getItem('smartek:cache:' + key); return v ? JSON.parse(v) : null; } catch(e){ return null; }
}
function localCacheSet(key, val){
  try { localStorage.setItem('smartek:cache:' + key, JSON.stringify(val)); } catch(e){}
}

/* ============ state ============ */
let DB = {
  itemIds: [],
  items: {},
  suppliers: [],
  purchaseOrders: [],
  movements: [],
  currentRole: 'Administrator',
  credentials: {},
  profile: { name: 'Admin Smartek', email: 'admin@smartek.co.id', role: 'Administrator', joined: '' },
  company: { name: '', address: '', phone: '', email: '' },
  users: [],
  warehouses: [],
  units: ['pcs', 'box', 'kg', 'meter'],
  notifSettings: { defaultMin: 5, badgeEnabled: true }
};

/* Memuat seluruh data dari localCache secara sinkron (0ms, instan) */
function loadFromLocalCache(){
  try {
    const idx = localCacheGet('inv:index');
    if(Array.isArray(idx)) DB.itemIds = idx;

    DB.items = {};
    for(const id of DB.itemIds){
      const it = localCacheGet('inv:item:' + id);
      if(it) DB.items[id] = it;
    }

    const sup = localCacheGet('inv:suppliers');
    if(Array.isArray(sup)) DB.suppliers = sup;

    const pos = localCacheGet('inv:pos');
    if(Array.isArray(pos)) DB.purchaseOrders = pos;

    const mov = localCacheGet('inv:movements');
    if(Array.isArray(mov)) DB.movements = mov;

    const prof = localCacheGet('inv:settings:profile');
    if(prof) DB.profile = prof;

    const comp = localCacheGet('inv:settings:company');
    if(comp) DB.company = comp;

    const usr = localCacheGet('inv:settings:users');
    if(Array.isArray(usr)) DB.users = usr;

    const wh = localCacheGet('inv:settings:warehouses');
    if(Array.isArray(wh)) DB.warehouses = wh;

    const un = localCacheGet('inv:settings:units');
    if(Array.isArray(un)) DB.units = un;

    const notif = localCacheGet('inv:settings:notif');
    if(notif) DB.notifSettings = notif;

    const creds = localCacheGet('inv:auth:credentials');
    if(creds) DB.credentials = creds;
  } catch(e){
    console.warn('loadFromLocalCache error:', e);
  }
}

async function loadAll(allData = null){
  if(!allData) allData = (await storeGetAll()) || {};
  const idx = (allData && allData['inv:index']) || (await storeGet('inv:index')) || [];
  DB.itemIds = idx;
  const items = {};
  for(const id of DB.itemIds){
    const it = (allData && allData['inv:item:' + id]) || (await storeGet('inv:item:' + id));
    if(it) items[id] = it;
  }
  DB.items = items;
  DB.suppliers = (allData && allData['inv:suppliers']) || (await storeGet('inv:suppliers')) || [];
  DB.purchaseOrders = (allData && allData['inv:pos']) || (await storeGet('inv:pos')) || [];
  DB.movements = (allData && allData['inv:movements']) || (await storeGet('inv:movements')) || [];
}
function itemList(){ return DB.itemIds.map(id => DB.items[id]).filter(Boolean).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)); }
async function saveIndex(){ await storeSet('inv:index', DB.itemIds); }
async function saveItem(item){ await storeSet('inv:item:' + item.id, item); }
async function saveSuppliers(){ await storeSet('inv:suppliers', DB.suppliers); }
async function savePOs(){ await storeSet('inv:pos', DB.purchaseOrders); }
async function saveMovements(){ await storeSet('inv:movements', DB.movements); }

function statusOf(item){
  const q = Number(item.qty)||0, m = Number(item.min)||0;
  if(q === 0) return 'habis';
  if(q <= m) return 'rendah';
  return 'aman';
}
