/* ============ ITEMS ============ */
let itemEditingId = null, itemPendingPhoto = null, itemPhotoRemoved = false, itemsPage = 1;
const ITEMS_PAGE_SIZE = 8;
const itemOverlay = document.getElementById('itemOverlay');

function updateItemCatOptions(){
  const cats = [...new Set(itemList().map(i=>i.category).filter(Boolean))].sort();
  const sel = document.getElementById('itemFilterCat');
  const cur = sel.value;
  sel.innerHTML = '<option value="">Semua kategori</option>' + cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  if(cats.includes(cur)) sel.value = cur;
  document.getElementById('catList').innerHTML = cats.map(c=>`<option value="${esc(c)}">`).join('');
}

function renderItems(){
  const btnAdd = document.getElementById('btnAddItem');
  if(btnAdd) btnAdd.style.display = canWrite() ? 'inline-flex' : 'none';
  updateItemCatOptions();
  const search = document.getElementById('itemSearch').value.trim().toLowerCase();
  const catFilter = document.getElementById('itemFilterCat').value;
  const statusFilter = document.getElementById('itemFilterStatus').value;
  const all = itemList();
  let filtered = all.filter(i=>{
    const matchSearch = !search || i.name.toLowerCase().includes(search) || (i.category||'').toLowerCase().includes(search);
    const matchCat = !catFilter || i.category === catFilter;
    const matchStatus = !statusFilter || statusOf(i) === statusFilter;
    return matchSearch && matchCat && matchStatus;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PAGE_SIZE));
  if(itemsPage > totalPages) itemsPage = totalPages;
  const pageItems = filtered.slice((itemsPage-1)*ITEMS_PAGE_SIZE, itemsPage*ITEMS_PAGE_SIZE);

  const tbody = document.getElementById('itemsBody');
  tbody.innerHTML = all.length === 0
    ? `<tr class="empty-row"><td colspan="8">Belum ada barang. Masukkan barang melalui menu Stock In.</td></tr>`
    : filtered.length === 0
    ? `<tr class="empty-row"><td colspan="8">Tidak ada item yang cocok.</td></tr>`
    : pageItems.map(itemRowHtml).join('');

  const start = filtered.length === 0 ? 0 : (itemsPage-1)*ITEMS_PAGE_SIZE+1;
  const end = Math.min(itemsPage*ITEMS_PAGE_SIZE, filtered.length);
  document.getElementById('itemsPagination').innerHTML = `
    <div>Menampilkan ${start} sampai ${end} dari ${filtered.length} item</div>
    <div class="pages">
      <button onclick="itemsGoto(${itemsPage-1})" ${itemsPage<=1?'disabled':''}>‹</button>
      ${Array.from({length: totalPages},(_,i)=>i+1).slice(0,6).map(p=>`<button class="${p===itemsPage?'active':''}" onclick="itemsGoto(${p})">${p}</button>`).join('')}
      <button onclick="itemsGoto(${itemsPage+1})" ${itemsPage>=totalPages?'disabled':''}>›</button>
    </div>`;
}
window.itemsGoto = function(p){ itemsPage = Math.max(1,p); renderItems(); };

function itemRowHtml(item){
  const st = statusOf(item);
  const thumb = item.photo ? `<img class="item-thumb" src="${item.photo}">` : `<div class="item-thumb-empty">—</div>`;
  return `<tr>
    <td><div class="name-cell">${thumb}<b>${esc(item.name)}</b></div></td>
    <td>${esc(item.category||'-')}</td>
    <td>${item.qty||0} ${esc(item.unit||'pcs')}</td>
    <td>${rupiah(item.price)}</td>
    <td>${esc(item.desc||'-')}</td>
    <td><span class="pill ${st}">${st==='habis'?'Habis':st==='rendah'?'Rendah':'Aman'}</span></td>
    <td style="white-space:nowrap;color:var(--muted,#6b7280);font-size:12px;">${fmtDT(item.createdAt)}</td>
    <td>${canWrite() ? `<button class="btn btn-ghost btn-sm" onclick="openItemEdit('${item.id}')">Edit</button>` : ''}</td>
  </tr>`;
}

function closeItemModal(){
  itemOverlay.classList.remove('open');
  itemEditingId = null; itemPendingPhoto = null; itemPhotoRemoved = false;
  ['fName','fCat','fDesc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('fUnit').value='pcs';
  document.getElementById('fQty').value=0;
  document.getElementById('fMin').value=5;
  document.getElementById('fPrice').value='';
  document.getElementById('photoInput').value='';
  document.getElementById('photoPreview').style.display='none';
  document.getElementById('photoLabel').style.display='block';
  document.getElementById('photoRemoveBtn').style.display='none';
  document.getElementById('itemDeleteBtn').style.display='none';
}
const btnAddItem = document.getElementById('btnAddItem');
if(btnAddItem){
  btnAddItem.addEventListener('click', ()=>{ closeItemModal(); document.getElementById('itemModalTitle').textContent='Tambah Item'; itemOverlay.classList.add('open'); });
}
window.openItemEdit = function(id){
  const item = DB.items[id]; if(!item) return;
  itemEditingId = id;
  document.getElementById('itemModalTitle').textContent = 'Edit Item';
  document.getElementById('fName').value = item.name||'';
  document.getElementById('fCat').value = item.category||'';
  document.getElementById('fUnit').value = item.unit||'pcs';
  document.getElementById('fQty').value = item.qty||0;
  document.getElementById('fMin').value = item.min||0;
  document.getElementById('fPrice').value = item.price||'';
  document.getElementById('fDesc').value = item.desc||'';
  if(item.photo){
    document.getElementById('photoPreview').src = item.photo;
    document.getElementById('photoPreview').style.display='block';
    document.getElementById('photoLabel').style.display='none';
    document.getElementById('photoRemoveBtn').style.display='inline-block';
  }
  document.getElementById('itemDeleteBtn').style.display='inline-flex';
  itemOverlay.classList.add('open');
};
function resizeImageToDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = e=>{
      const img = new Image();
      img.onload = ()=>{
        const maxW = 700;
        const scale = Math.min(1, maxW/img.width);
        const w = Math.round(img.width*scale), h = Math.round(img.height*scale);
        const canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
document.getElementById('photoInput').addEventListener('change', async e=>{
  const file = e.target.files[0]; if(!file) return;
  try{
    const dataUrl = await resizeImageToDataUrl(file);
    itemPendingPhoto = dataUrl; itemPhotoRemoved = false;
    document.getElementById('photoPreview').src = dataUrl;
    document.getElementById('photoPreview').style.display='block';
    document.getElementById('photoLabel').style.display='none';
    document.getElementById('photoRemoveBtn').style.display='inline-block';
  }catch(err){ smartekToast('Gagal memuat foto'); }
});
document.getElementById('photoRemoveBtn').addEventListener('click', ()=>{
  itemPendingPhoto = null; itemPhotoRemoved = true;
  document.getElementById('photoInput').value='';
  document.getElementById('photoPreview').style.display='none';
  document.getElementById('photoLabel').style.display='block';
  document.getElementById('photoRemoveBtn').style.display='none';
});
document.getElementById('itemClose').addEventListener('click', closeItemModal);
document.getElementById('itemCancel').addEventListener('click', closeItemModal);
// Sengaja tidak ditutup saat klik area luar (backdrop), supaya isian form tidak
// hilang tanpa sengaja. Modal hanya bisa ditutup lewat tombol "×" atau "Batal".

document.getElementById('itemSave').addEventListener('click', ()=>{
  const name = document.getElementById('fName').value.trim();
  const category = document.getElementById('fCat').value.trim();
  const qtyVal = document.getElementById('fQty').value;
  const minVal = document.getElementById('fMin').value;
  const priceVal = document.getElementById('fPrice').value;
  if(!name){ smartekToast('Nama barang wajib diisi'); return; }
  if(!category){ smartekToast('Kategori wajib diisi'); return; }
  if(qtyVal !== '' && Number(qtyVal) < 0){ smartekToast('Jumlah stok tidak boleh negatif'); return; }
  if(minVal !== '' && Number(minVal) < 0){ smartekToast('Ambang stok rendah tidak boleh negatif'); return; }
  if(priceVal !== '' && Number(priceVal) < 0){ smartekToast('Harga tidak boleh negatif'); return; }

  const existing = itemEditingId ? DB.items[itemEditingId] : null;
  const isNew = !itemEditingId;
  const item = {
    id: itemEditingId || uid(),
    name,
    category,
    unit: document.getElementById('fUnit').value.trim() || 'pcs',
    qty: Number(qtyVal)||0,
    min: Number(minVal)||0,
    price: Number(priceVal)||0,
    desc: document.getElementById('fDesc').value.trim(),
    photo: itemPhotoRemoved ? null : (itemPendingPhoto || (existing ? existing.photo : null)),
    createdAt: existing ? existing.createdAt : Date.now()
  };

  // 1. Simpan segera di memori & local cache (Instan 0ms)
  DB.items[item.id] = item;
  if(isNew){
    DB.itemIds.unshift(item.id);
  }
  localCacheSet('inv:item:' + item.id, item);
  localCacheSet('inv:index', DB.itemIds);

  // 2. Tutup modal & perbarui UI langsung tanpa jeda
  closeItemModal();
  renderItems();
  refreshAlertBadge();
  smartekToast(isNew ? 'Item berhasil ditambahkan!' : 'Item berhasil diperbarui!');

  // 3. Sinkronkan ke cloud Google Sheets di balik layar
  saveItem(item).catch(()=>{});
  if(isNew){
    saveIndex().catch(()=>{});
  }
});

const itemConfirmOverlay = document.getElementById('itemConfirmOverlay');
document.getElementById('itemDeleteBtn').addEventListener('click', ()=>{ if(itemEditingId) itemConfirmOverlay.classList.add('open'); });
document.getElementById('itemConfirmCancel').addEventListener('click', ()=>itemConfirmOverlay.classList.remove('open'));
// Modal konfirmasi hapus juga hanya ditutup lewat tombol, bukan klik backdrop.
document.getElementById('itemConfirmYes').addEventListener('click', ()=>{
  itemConfirmOverlay.classList.remove('open');
  if(!itemEditingId) return;
  const id = itemEditingId;

  // 1. Hapus segera dari memori & local cache
  delete DB.items[id];
  DB.itemIds = DB.itemIds.filter(x=>x!==id);
  localCacheSet('inv:index', DB.itemIds);

  // 2. Refresh tampilan langsung
  closeItemModal();
  renderItems();
  refreshAlertBadge();
  smartekToast('Item berhasil dihapus');

  // 3. Sinkronkan di balik layar
  saveIndex().catch(()=>{});
});
document.getElementById('itemSearch').addEventListener('input', ()=>{ itemsPage=1; renderItems(); });
document.getElementById('itemFilterCat').addEventListener('change', ()=>{ itemsPage=1; renderItems(); });
document.getElementById('itemFilterStatus').addEventListener('change', ()=>{ itemsPage=1; renderItems(); });

/* ============ CATEGORIES ============ */
function renderCategories(){
  const search = document.getElementById('catSearch').value.trim().toLowerCase();
  const map = {};
  itemList().forEach(i=>{
    const c = i.category || 'Tanpa kategori';
    if(!map[c]) map[c] = { name:c, count:0, qty:0, warn:0 };
    map[c].count++; map[c].qty += Number(i.qty)||0;
    if(statusOf(i)!=='aman') map[c].warn++;
  });
  const all = Object.values(map).sort((a,b)=>b.count-a.count);
  const filtered = all.filter(c=>!search || c.name.toLowerCase().includes(search));
  const tbody = document.getElementById('catBody');
  tbody.innerHTML = all.length===0
    ? `<tr class="empty-row"><td colspan="5">Belum ada kategori.</td></tr>`
    : filtered.length===0
    ? `<tr class="empty-row"><td colspan="5">Tidak ditemukan.</td></tr>`
    : filtered.map(c=>`<tr><td><b>${esc(c.name)}</b></td><td>${c.count}</td><td>${c.qty.toLocaleString('id-ID')}</td><td>${c.warn>0?`<span class="pill rendah">${c.warn} item</span>`:`<span class="pill aman">Aman</span>`}</td><td><button class="btn btn-ghost btn-sm" onclick="filterItemsByCategory('${esc(c.name)}')">Lihat Item →</button></td></tr>`).join('');
}
window.filterItemsByCategory = function(name){
  goPage('items');
  document.getElementById('itemFilterCat').value = name;
  renderItems();
};
document.getElementById('catSearch').addEventListener('input', renderCategories);
