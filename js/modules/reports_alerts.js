/* ============ REPORTS ============ */
let reportPeriod = 'harian';
let reportYear = 'all';
const BULAN_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function reportPeriodKey(dateStr){
  if(!dateStr) return '-';
  if(reportPeriod === 'tahunan') return dateStr.slice(0,4);
  if(reportPeriod === 'bulanan') return dateStr.slice(0,7); // YYYY-MM
  return dateStr; // harian: YYYY-MM-DD apa adanya
}
function reportPeriodLabel(key){
  if(reportPeriod === 'tahunan') return key;
  if(reportPeriod === 'bulanan'){
    const [y,m] = key.split('-');
    return `${BULAN_ID[Number(m)-1] || m} ${y}`;
  }
  const d = new Date(key + 'T00:00:00');
  return isNaN(d) ? key : d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
}
function populateReportYearOptions(){
  const years = Array.from(new Set(DB.movements.map(m=>(m.date||'').slice(0,4)).filter(Boolean))).sort((a,b)=>b-a);
  const sel = document.getElementById('reportYear');
  const isTahunan = reportPeriod === 'tahunan';
  sel.style.display = isTahunan ? 'none' : '';
  if(!years.includes(reportYear)) reportYear = 'all';
  sel.innerHTML = `<option value="all">Semua Tahun</option>` + years.map(y=>`<option value="${y}" ${y===reportYear?'selected':''}>${y}</option>`).join('');
  sel.value = reportYear;
}
function movementsForReport(){
  // "Tahunan" selalu menampilkan semua tahun yang ada; "Harian"/"Bulanan" mengikuti filter tahun.
  if(reportPeriod === 'tahunan' || reportYear === 'all') return DB.movements;
  return DB.movements.filter(m => (m.date||'').slice(0,4) === reportYear);
}
function renderReports(){
  populateReportYearOptions();
  const items = itemList();
  const scoped = movementsForReport();
  const totalIn = scoped.filter(m=>m.type==='in').reduce((s,m)=>s+(Number(m.qty)||0),0);
  const totalOut = scoped.filter(m=>m.type==='out').reduce((s,m)=>s+(Number(m.qty)||0),0);
  // Stok Akhir & Nilai Inventori adalah kondisi TERKINI barang, jadi selalu total keseluruhan
  // (tidak ikut difilter per periode) — beda konsepnya dari arus masuk/keluar di atas.
  const totalFinal = items.reduce((s,i)=>s+(Number(i.qty)||0),0);
  const totalValue = items.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0),0);
  document.getElementById('rIn').textContent = totalIn.toLocaleString('id-ID');
  document.getElementById('rOut').textContent = totalOut.toLocaleString('id-ID');
  document.getElementById('rFinal').textContent = totalFinal.toLocaleString('id-ID');
  document.getElementById('rValue').textContent = rupiah(totalValue);

  const byPeriod = {};
  scoped.forEach(m=>{ const k = reportPeriodKey(m.date); if(!byPeriod[k]) byPeriod[k]={in:0,out:0}; byPeriod[k][m.type]+=Number(m.qty)||0; });
  const keys = Object.keys(byPeriod).sort();
  const periodNoun = reportPeriod === 'tahunan' ? 'tahun' : reportPeriod === 'bulanan' ? 'bulan' : 'tanggal';
  document.getElementById('trendNote').textContent = keys.length===0
    ? 'Belum ada transaksi tercatat — grafik akan terisi setelah kamu mencatat di Stock In / Stock Out.'
    : `Menampilkan ${keys.length} ${periodNoun} transaksi.`;
  renderLineChart('trendChart',
    keys.length ? keys.map(reportPeriodLabel) : ['-'],
    keys.length ? keys.map(k=>byPeriod[k].in) : [0],
    keys.length ? keys.map(k=>byPeriod[k].out) : [0],
    '#22A559', '#E5484D', 'Stok Masuk', 'Stok Keluar'
  );

  document.getElementById('turnoverPeriodLabel').textContent = reportPeriod === 'tahunan' ? '(semua tahun)' : reportYear === 'all' ? '(semua waktu)' : `(tahun ${reportYear})`;
  const turnover = {};
  items.forEach(i=>{ turnover[i.id] = { name:i.name, category:i.category, in:0, out:0, qty:i.qty }; });
  scoped.forEach(m=>{ if(turnover[m.itemId]) turnover[m.itemId][m.type]+=Number(m.qty)||0; });
  const rows = Object.values(turnover).sort((a,b)=>(b.in+b.out)-(a.in+a.out)).slice(0,10);
  document.getElementById('turnoverBody').innerHTML = (rows.length===0 || rows.every(r=>r.in===0&&r.out===0))
    ? `<tr class="empty-row"><td colspan="5">Belum ada transaksi.</td></tr>`
    : rows.map(r=>`<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.category||'-')}</td><td style="color:var(--green);">+${r.in}</td><td style="color:#C22222;">-${r.out}</td><td>${r.qty}</td></tr>`).join('');
}
document.getElementById('reportPeriod').addEventListener('change', (e)=>{ reportPeriod = e.target.value; renderReports(); });
document.getElementById('reportYear').addEventListener('change', (e)=>{ reportYear = e.target.value; renderReports(); });

/* ============ ALERTS ============ */
function renderAlerts(){
  const filterType = document.getElementById('alertFilter').value;
  const alerts = itemList().map(i=>{
    const st = statusOf(i);
    return st==='aman' ? null : { item:i, type:st };
  }).filter(Boolean).sort((a,b)=>(a.type==='habis'?0:1)-(b.type==='habis'?0:1));
  const filtered = alerts.filter(a=>!filterType || a.type===filterType);
  const list = document.getElementById('alertList');
  if(alerts.length===0){
    list.innerHTML = `<div class="empty-state"><div style="font-size:28px;">🎉</div><h3>Semua stok dalam kondisi aman</h3><p>Tidak ada barang dengan stok rendah atau habis saat ini.</p></div>`;
    return;
  }
  if(filtered.length===0){ list.innerHTML = `<div class="empty-state"><p>Tidak ada peringatan untuk filter ini.</p></div>`; return; }
  list.innerHTML = filtered.map(a=>{
    const isHabis = a.type==='habis';
    return `<div class="alert-item">
      <div class="alert-ic" style="background:${isHabis?'var(--red-bg)':'var(--amber-bg)'};color:${isHabis?'#C22222':'#B5720B'};">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/></svg>
      </div>
      <div class="alert-body"><div class="alert-title">${isHabis?'Stok Habis':'Stok Rendah'}</div><div class="alert-sub">${esc(a.item.name)} — sisa ${a.item.qty} ${esc(a.item.unit||'pcs')} (min ${a.item.min})</div></div>
      <span class="pill ${a.type}">${isHabis?'Habis':'Rendah'}</span>
      <button class="btn btn-ghost btn-sm" onclick="goPage('items')">Lihat Item</button>
    </div>`;
  }).join('');
}
document.getElementById('alertFilter').addEventListener('change', renderAlerts);
