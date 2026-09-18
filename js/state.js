/* Cache lokal (localStorage) untuk akses instan & dukungan offline */
function localCacheGet(key){
  try { const v = localStorage.getItem('smartek:cache:' + key); return v ? JSON.parse(v) : null; } catch(e){ return null; }
}
function localCacheSet(key, val){
  try { localStorage.setItem('smartek:cache:' + key, JSON.stringify(val)); } catch(e){}
}

/* ============ state ============ */
let DB = { itemIds: [], items: {}, suppliers: [], purchaseOrders: [], movements: [], currentRole: 'Administrator', credentials: {} };

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
async function deleteItemStore(id){ /* leave orphan key harmless, just drop from index */ }
async function saveSuppliers(){ await storeSet('inv:suppliers', DB.suppliers); }
async function savePOs(){ await storeSet('inv:pos', DB.purchaseOrders); }
async function saveMovements(){ await storeSet('inv:movements', DB.movements); }

function statusOf(item){
  const q = Number(item.qty)||0, m = Number(item.min)||0;
  if(q === 0) return 'habis';
  if(q <= m) return 'rendah';
  return 'aman';
}
