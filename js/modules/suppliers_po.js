/* ============ SUPPLIERS ============ */
let supEditingId = null;
const supOverlay = document.getElementById('supOverlay');
function renderSuppliers(){
  const search = document.getElementById('supSearch').value.trim().toLowerCase();
  const filtered = DB.suppliers.filter(s=>!search || s.name.toLowerCase().includes(search));
  const tbody = document.getElementById('supBody');
  tbody.innerHTML = DB.suppliers.length===0
    ? `<tr class="empty-row"><td colspan="6">Belum ada supplier tercatat.</td></tr>`
    : filtered.length===0
    ? `<tr class="empty-row"><td colspan="6">Tidak ditemukan.</td></tr>`
    : filtered.map(s=>`<tr><td><b>${esc(s.name)}</b></td><td>${esc(s.contact||'-')}</td><td>${esc(s.phone||'-')}</td><td><span class="pill ${s.status}">${s.status==='aktif'?'Aktif':'Nonaktif'}</span></td><td style="white-space:nowrap;color:var(--muted,#6b7280);font-size:12px;">${fmtDT(s.createdAt)}</td><td><button class="btn btn-ghost btn-sm" onclick="openSupplierEdit('${s.id}')">Edit</button></td></tr>`).join('');
}
document.getElementById('supSearch').addEventListener('input', renderSuppliers);
function closeSupModal(){
  supOverlay.classList.remove('open');
  supEditingId = null;
  document.getElementById('supName').value='';
  document.getElementById('supContact').value='';
  document.getElementById('supPhone').value='';
  document.getElementById('supStatus').value='aktif';
  document.getElementById('supDeleteBtn').style.display='none';
}
document.getElementById('btnAddSupplier').addEventListener('click', ()=>{ closeSupModal(); document.getElementById('supModalTitle').textContent='Tambah Supplier'; supOverlay.classList.add('open'); });
window.openSupplierEdit = function(id){
  const s = DB.suppliers.find(x=>x.id===id); if(!s) return;
  supEditingId = id;
  document.getElementById('supModalTitle').textContent = 'Edit Supplier';
  document.getElementById('supName').value = s.name;
  document.getElementById('supContact').value = s.contact||'';
  document.getElementById('supPhone').value = s.phone||'';
  document.getElementById('supStatus').value = s.status||'aktif';
  document.getElementById('supDeleteBtn').style.display='inline-flex';
  supOverlay.classList.add('open');
};
document.getElementById('supClose').addEventListener('click', closeSupModal);
document.getElementById('supCancel').addEventListener('click', closeSupModal);
// Sengaja tidak ditutup saat klik backdrop, supaya isian form Supplier tidak hilang.
document.getElementById('supSave').addEventListener('click', ()=>{
  const name = document.getElementById('supName').value.trim();
  if(!name){ smartekToast('Nama supplier wajib diisi'); return; }

  const payload = { name, contact:document.getElementById('supContact').value.trim(), phone:document.getElementById('supPhone').value.trim(), status:document.getElementById('supStatus').value };
  if(supEditingId){
    const idx = DB.suppliers.findIndex(x=>x.id===supEditingId);
    DB.suppliers[idx] = { ...DB.suppliers[idx], ...payload };
  } else {
    DB.suppliers.unshift({ id: uid(), ...payload, createdAt: Date.now() });
  }

  // 1. Simpan lokal & refresh UI instan
  localCacheSet('inv:suppliers', DB.suppliers);
  closeSupModal();
  renderSuppliers();
  smartekToast('Supplier tersimpan');

  // 2. Background sync
  saveSuppliers().catch(()=>{});
});
const supConfirmOverlay = document.getElementById('supConfirmOverlay');
document.getElementById('supDeleteBtn').addEventListener('click', ()=>{ if(supEditingId) supConfirmOverlay.classList.add('open'); });
document.getElementById('supConfirmCancel').addEventListener('click', ()=>supConfirmOverlay.classList.remove('open'));
// Modal konfirmasi hapus juga hanya ditutup lewat tombol, bukan klik backdrop.
document.getElementById('supConfirmYes').addEventListener('click', ()=>{
  supConfirmOverlay.classList.remove('open');
  DB.suppliers = DB.suppliers.filter(x=>x.id!==supEditingId);
  localCacheSet('inv:suppliers', DB.suppliers);
  closeSupModal();
  renderSuppliers();
  smartekToast('Supplier dihapus');
  saveSuppliers().catch(()=>{});
});

/* ============ PURCHASE ORDERS ============ */
const poOverlay = document.getElementById('poOverlay');
function renderPOs(){
  document.getElementById('supListDatalist').innerHTML = DB.suppliers.map(s=>`<option value="${esc(s.name)}">`).join('');
  const search = document.getElementById('poSearch').value.trim().toLowerCase();
  const filtered = DB.purchaseOrders.filter(p=>!search || p.poNumber.toLowerCase().includes(search) || p.supplierName.toLowerCase().includes(search));
  const tbody = document.getElementById('poBody');
  tbody.innerHTML = DB.purchaseOrders.length===0
    ? `<tr class="empty-row"><td colspan="7">Belum ada purchase order.</td></tr>`
    : filtered.length===0
    ? `<tr class="empty-row"><td colspan="7">Tidak ditemukan.</td></tr>`
    : filtered.map(p=>`<tr>
        <td><b>${esc(p.poNumber)}</b></td><td>${esc(p.supplierName)}</td><td>${esc(p.date)}</td><td>${p.totalItem}</td><td>${rupiah(p.totalValue)}</td>
        <td><select onchange="updatePOStatus('${p.id}', this.value)" style="border:1px solid var(--line);border-radius:6px;padding:3px 6px;font-size:11px;">
          <option value="draft" ${p.status==='draft'?'selected':''}>Draft</option>
          <option value="proses" ${p.status==='proses'?'selected':''}>Proses</option>
          <option value="selesai" ${p.status==='selesai'?'selected':''}>Selesai</option>
        </select></td>
        <td style="white-space:nowrap;color:var(--muted,#6b7280);font-size:12px;">${fmtDT(p.createdAt)}</td>
      </tr>`).join('');
}
window.updatePOStatus = function(id, status){
  const idx = DB.purchaseOrders.findIndex(p=>p.id===id);
  if(idx>=0){
    DB.purchaseOrders[idx].status = status;
    localCacheSet('inv:pos', DB.purchaseOrders);
    smartekToast('Status PO diperbarui');
    renderPOs();
    savePOs().catch(()=>{});
  }
};
document.getElementById('poSearch').addEventListener('input', renderPOs);
document.getElementById('btnAddPO').addEventListener('click', ()=>{
  document.getElementById('poSupplier').value='';
  document.getElementById('poNumber').value='';
  document.getElementById('poDate').value = todayStr();
  document.getElementById('poTotalItem').value=0;
  document.getElementById('poTotalValue').value=0;
  document.getElementById('poStatus').value='draft';
  poOverlay.classList.add('open');
});
document.getElementById('poClose').addEventListener('click', ()=>poOverlay.classList.remove('open'));
document.getElementById('poCancel').addEventListener('click', ()=>poOverlay.classList.remove('open'));
// Sengaja tidak ditutup saat klik backdrop, supaya isian form Purchase Order tidak hilang.
document.getElementById('poSave').addEventListener('click', ()=>{
  const supplierName = document.getElementById('poSupplier').value.trim();
  if(!supplierName){ smartekToast('Supplier wajib diisi'); return; }

  const seq = DB.purchaseOrders.length + 1;
  const poNumberInput = document.getElementById('poNumber').value.trim();
  const po = {
    id: uid(),
    poNumber: poNumberInput || `PO-${todayStr().replace(/-/g,'')}-${String(seq).padStart(3,'0')}`,
    supplierName,
    date: document.getElementById('poDate').value || todayStr(),
    totalItem: Number(document.getElementById('poTotalItem').value)||0,
    totalValue: Number(document.getElementById('poTotalValue').value)||0,
    status: document.getElementById('poStatus').value,
    createdAt: Date.now()
  };
  DB.purchaseOrders.unshift(po);
  localCacheSet('inv:pos', DB.purchaseOrders);
  poOverlay.classList.remove('open');
  smartekToast('Purchase order tersimpan');
  renderPOs();

  savePOs().catch(()=>{});
});
