/* ============ STOCK IN/OUT (movements) ============ */
let movType = 'in';
const movOverlay = document.getElementById('movOverlay');

function updateItemDatalist(){
  document.getElementById('itemListDatalist').innerHTML = itemList().map(i=>`<option value="${esc(i.name)}">`).join('');
}

function renderMovements(type){
  const search = document.getElementById(type==='in'?'inSearch':'outSearch').value.trim().toLowerCase();
  const list = DB.movements.filter(m=>m.type===type).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const filtered = list.filter(m=>!search || m.itemName.toLowerCase().includes(search) || m.docNo.toLowerCase().includes(search) || (m.operator||'').toLowerCase().includes(search));
  const tbody = document.getElementById(type==='in'?'inBody':'outBody');
  tbody.innerHTML = list.length===0
    ? `<tr class="empty-row"><td colspan="9">Belum ada catatan stok ${type==='in'?'masuk':'keluar'}.</td></tr>`
    : filtered.length===0
    ? `<tr class="empty-row"><td colspan="9">Tidak ditemukan.</td></tr>`
    : filtered.map(m=>`<tr>
        <td>${esc(m.date)}</td>
        <td>${esc(m.docNo)}</td>
        <td><b>${esc(m.itemName)}</b></td>
        <td>${esc(m.party||'-')}</td>
        <td><b>${type==='in'?'+':'-'}${m.qty}</b></td>
        <td>
          <div style="font-weight:600;font-size:12px;color:var(--ink);">${esc(m.operator || 'Admin')}</div>
          <div style="font-size:10.5px;color:var(--ink-soft);">${esc(m.operatorRole || '')}</div>
        </td>
        <td><span class="pill selesai">Selesai</span></td>
        <td style="white-space:nowrap;color:var(--muted,#6b7280);font-size:12px;">${fmtDT(m.createdAt)}</td>
        <td><button class="btn btn-ghost btn-sm" onclick="openMovDeleteConfirm('${m.id}')">Hapus</button></td>
      </tr>`).join('');
}
document.getElementById('inSearch').addEventListener('input', ()=>renderMovements('in'));
document.getElementById('outSearch').addEventListener('input', ()=>renderMovements('out'));

function openMovModal(type){
  movType = type;
  updateItemDatalist();
  document.getElementById('movModalTitle').textContent = type==='in' ? 'Tambah Stok In' : 'Tambah Stok Out';
  document.getElementById('movQtyLabel').textContent = type==='in' ? 'Jumlah masuk' : 'Jumlah keluar';
  document.getElementById('movPartyLabel').textContent = type==='in' ? 'Supplier/Sumber (opsional)' : 'Tujuan (opsional)';
  document.getElementById('movItem').value='';
  document.getElementById('movQty').value=1;
  document.getElementById('movDate').value = todayStr();
  document.getElementById('movParty').value='';
  document.getElementById('movDoc').value='';

  const newCatWrap = document.getElementById('movNewCatWrap');
  if(newCatWrap) newCatWrap.style.display = type === 'in' ? 'block' : 'none';
  const newCatInput = document.getElementById('movNewCat');
  if(newCatInput) newCatInput.value = '';

  const session = getSavedSession();
  const opName = session?.name || DB.profile?.name || 'Administrator';
  const opRole = session?.role || DB.currentRole || 'Administrator';
  const opEl = document.getElementById('movOperatorName');
  if(opEl) opEl.textContent = `${opName} (${opRole})`;

  movOverlay.classList.add('open');
}
document.getElementById('btnAddIn').addEventListener('click', ()=>openMovModal('in'));
document.getElementById('btnAddOut').addEventListener('click', ()=>openMovModal('out'));
document.getElementById('movClose').addEventListener('click', ()=>movOverlay.classList.remove('open'));
document.getElementById('movCancel').addEventListener('click', ()=>movOverlay.classList.remove('open'));
// Sengaja tidak ditutup saat klik backdrop, supaya isian form Stock In/Out tidak hilang.

document.getElementById('movSave').addEventListener('click', ()=>{
  const itemName = document.getElementById('movItem').value.trim();
  if(!itemName){ smartekToast('Nama barang wajib diisi'); return; }
  let item = itemList().find(i=>i.name.toLowerCase()===itemName.toLowerCase());
  if(!item){
    if(movType === 'out'){
      smartekToast('Barang belum terdaftar. Pilih dari daftar barang.');
      return;
    }
    const enteredCat = (document.getElementById('movNewCat')?.value || '').trim();
    item = {
      id: uid(),
      name: itemName,
      category: enteredCat || 'Umum',
      qty: 0,
      min: 5,
      unit: 'pcs',
      price: 0,
      desc: 'Didaftarkan otomatis lewat Stock In',
      photo: null,
      createdAt: Date.now()
    };
  }
  const qty = Number(document.getElementById('movQty').value);
  if(!qty || qty<=0){ smartekToast('Jumlah harus lebih dari 0'); return; }
  if(movType==='out' && (Number(item.qty)||0) < qty){ smartekToast(`Stok tidak cukup. Stok tersedia: ${item.qty}`); return; }

  // 1. Catat informasi akun petugas yang melakukan transaksi
  const session = getSavedSession();
  const operator = session?.name || DB.profile?.name || 'Administrator';
  const operatorEmail = session?.email || DB.profile?.email || '-';
  const operatorRole = session?.role || DB.currentRole || 'Administrator';

  // 2. Perbarui stok & catatan transaksi di memori & local cache instan (0ms)
  const isNewItem = !DB.itemIds.includes(item.id);
  item.qty = movType==='in' ? (Number(item.qty)||0)+qty : (Number(item.qty)||0)-qty;
  DB.items[item.id] = item;
  if(isNewItem){
    DB.itemIds.unshift(item.id);
  }
  localCacheSet('inv:item:' + item.id, item);
  if(isNewItem) localCacheSet('inv:index', DB.itemIds);

  const seq = DB.movements.length + 1;
  const docNoInput = document.getElementById('movDoc').value.trim();
  const movement = {
    id: uid(),
    docNo: docNoInput || `${movType==='in'?'SI':'SO'}-${todayStr().replace(/-/g,'')}-${String(seq).padStart(3,'0')}`,
    type: movType,
    itemId: item.id,
    itemName: item.name,
    qty,
    party: document.getElementById('movParty').value.trim(),
    operator: operator,
    operatorEmail: operatorEmail,
    operatorRole: operatorRole,
    date: document.getElementById('movDate').value || todayStr(),
    createdAt: Date.now()
  };
  DB.movements.unshift(movement);
  localCacheSet('inv:movements', DB.movements);

  // 3. Tutup modal & perbarui tampilan langsung
  movOverlay.classList.remove('open');
  smartekToast(movType==='in' 
    ? (isNewItem ? `Item baru "${item.name}" didaftarkan & stok masuk dicatat!` : 'Stok masuk berhasil dicatat!') 
    : 'Stok keluar berhasil dicatat!');
  renderMovements(movType);
  refreshAlertBadge();

  // 4. Sinkronkan ke cloud Google Sheets di balik layar
  saveItem(item).catch(()=>{});
  if(isNewItem) saveIndex().catch(()=>{});
  saveMovements().catch(()=>{});
});

/* hapus catatan stok masuk/keluar — otomatis kembalikan qty barang */
const movConfirmOverlay = document.getElementById('movConfirmOverlay');
let movDeletingId = null;
window.openMovDeleteConfirm = function(id){
  movDeletingId = id;
  movConfirmOverlay.classList.add('open');
};
document.getElementById('movConfirmCancel').addEventListener('click', ()=>{ movConfirmOverlay.classList.remove('open'); movDeletingId = null; });
// Modal konfirmasi hapus juga hanya ditutup lewat tombol, bukan klik backdrop.
document.getElementById('movConfirmYes').addEventListener('click', ()=>{
  movConfirmOverlay.classList.remove('open');
  if(!movDeletingId) return;
  const m = DB.movements.find(x=>x.id===movDeletingId);
  if(!m){ movDeletingId = null; return; }

  const item = DB.items[m.itemId];
  if(item){
    // Balikkan efek transaksi: stok masuk -> kurangi lagi, stok keluar -> tambahkan lagi
    item.qty = m.type==='in' ? (Number(item.qty)||0) - m.qty : (Number(item.qty)||0) + m.qty;
    if(item.qty < 0) item.qty = 0;
    DB.items[item.id] = item;
    localCacheSet('inv:item:' + item.id, item);
    saveItem(item).catch(()=>{});
  }

  DB.movements = DB.movements.filter(x=>x.id!==movDeletingId);
  localCacheSet('inv:movements', DB.movements);
  saveMovements().catch(()=>{});
  movDeletingId = null;

  renderMovements(m.type);
  refreshAlertBadge();
  smartekToast('Catatan dihapus, stok disesuaikan kembali');
});
