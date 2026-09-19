/* ============ REPORTS ============ */
let reportPeriod = 'harian';
let reportYear = 'all';
const BULAN_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
function reportPeriodLabel(key){
  if(reportPeriod === 'tahunan') return key;
  if(reportPeriod === 'bulanan'){
    const [y,m] = key.split('-');
    return `${BULAN_ID[Number(m)-1] || m}`;
  }
  const d = new Date(key + 'T00:00:00');
  return isNaN(d.getTime()) ? key : `${d.getDate()} ${BULAN_ID[d.getMonth()]}`;
}

function renderLineChart(containerId, labels, seriesA, seriesB, colorA, colorB, labelA, labelB){
  const el = document.getElementById(containerId);
  if(!el) return;

  const w = 700, h = 200;
  const padL = 40, padR = 25, padT = 20, padB = 32;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const rawMax = Math.max(1, ...seriesA, ...seriesB);
  // Bulatkan batas atas (Y-max) agar kelipatan enak dibaca
  const mag = Math.pow(10, Math.max(0, Math.floor(Math.log10(rawMax))));
  const norm = rawMax / mag;
  let mult = 1;
  if(norm <= 1) mult = 1.2;
  else if(norm <= 2) mult = 2.5;
  else if(norm <= 5) mult = 6;
  else mult = 12;
  const max = Math.max(rawMax, Math.ceil(mult * mag));

  const n = labels.length;
  const stepX = n > 1 ? chartW / (n - 1) : 0;
  const getX = (i) => n === 1 ? padL + chartW / 2 : padL + i * stepX;
  const getY = (val) => padT + chartH - (val / max) * chartH;

  const pointsA = seriesA.map((v, i) => ({ x: getX(i), y: getY(v), val: v, label: labels[i] }));
  const pointsB = seriesB.map((v, i) => ({ x: getX(i), y: getY(v), val: v, label: labels[i] }));

  function createPath(pts){
    if(pts.length === 0) return '';
    if(pts.length === 1){
      return `M${(pts[0].x - 30).toFixed(1)},${pts[0].y.toFixed(1)} L${(pts[0].x + 30).toFixed(1)},${pts[0].y.toFixed(1)}`;
    }
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  function createArea(pts){
    if(pts.length === 0) return '';
    if(pts.length === 1){
      const y = pts[0].y.toFixed(1);
      const bY = (padT + chartH).toFixed(1);
      const x1 = (pts[0].x - 30).toFixed(1);
      const x2 = (pts[0].x + 30).toFixed(1);
      return `M${x1},${y} L${x2},${y} L${x2},${bY} L${x1},${bY} Z`;
    }
    const linePart = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const lastX = pts[pts.length - 1].x.toFixed(1);
    const firstX = pts[0].x.toFixed(1);
    const bottomY = (padT + chartH).toFixed(1);
    return `${linePart} L${lastX},${bottomY} L${firstX},${bottomY} Z`;
  }

  // Grid horizontal & label angka sumbu Y
  const ySteps = [0, 0.33, 0.66, 1];
  const gridLines = ySteps.map(f => {
    const yVal = Math.round(f * max);
    const yPos = (padT + chartH - f * chartH).toFixed(1);
    return `
      <line x1="${padL}" y1="${yPos}" x2="${w - padR}" y2="${yPos}" stroke="#ECEEF3" stroke-width="1" stroke-dasharray="3 3"/>
      <text x="${padL - 8}" y="${Number(yPos) + 3.5}" font-size="9" fill="#9CA3AF" text-anchor="end" font-weight="600">${yVal}</text>
    `;
  }).join('');

  // Sumbu X label lengkap
  const xLabels = labels.map((lab, i) => {
    const x = getX(i);
    return `<text x="${x.toFixed(1)}" y="${h - 8}" font-size="9.5" fill="#6B7280" font-weight="600" text-anchor="middle">${esc(String(lab))}</text>`;
  }).join('');

  // Titik data (dots)
  const dotsA = pointsA.map(p => `
    <g>
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#ffffff" stroke="${colorA}" stroke-width="2.5">
        <title>${labelA}: ${p.val} (${p.label})</title>
      </circle>
      ${p.val > 0 ? `<text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" font-size="8.5" font-weight="700" fill="${colorA}" text-anchor="middle">${p.val}</text>` : ''}
    </g>
  `).join('');

  const dotsB = pointsB.map(p => `
    <g>
      <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#ffffff" stroke="${colorB}" stroke-width="2.5">
        <title>${labelB}: ${p.val} (${p.label})</title>
      </circle>
      ${p.val > 0 ? `<text x="${p.x.toFixed(1)}" y="${(p.y - 7).toFixed(1)}" font-size="8.5" font-weight="700" fill="${colorB}" text-anchor="middle">${p.val}</text>` : ''}
    </g>
  `).join('');

  const gradAId = 'gradAreaA_' + containerId;
  const gradBId = 'gradAreaB_' + containerId;

  const svg = `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="200" style="overflow:visible;">
      <defs>
        <linearGradient id="${gradAId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${colorA}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${colorA}" stop-opacity="0.01"/>
        </linearGradient>
        <linearGradient id="${gradBId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${colorB}" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="${colorB}" stop-opacity="0.01"/>
        </linearGradient>
      </defs>

      <!-- Grid lines & sumbu Y -->
      ${gridLines}

      <!-- Gradient Area -->
      <path d="${createArea(pointsA)}" fill="url(#${gradAId})"/>
      <path d="${createArea(pointsB)}" fill="url(#${gradBId})"/>

      <!-- Garis kurva -->
      <path d="${createPath(pointsA)}" fill="none" stroke="${colorA}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${createPath(pointsB)}" fill="none" stroke="${colorB}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Titik & angka nilai -->
      ${dotsA}
      ${dotsB}

      <!-- Label sumbu X -->
      ${xLabels}
    </svg>
  `;

  const totalA = seriesA.reduce((s, v) => s + v, 0);
  const totalB = seriesB.reduce((s, v) => s + v, 0);
  const diff = totalA - totalB;

  const headerLegend = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--line);flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:14px;font-size:11.5px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${colorA};display:inline-block;"></span>
          <span style="color:var(--ink);font-weight:600;">${labelA}:</span>
          <b style="color:${colorA};font-size:12px;">${totalA} unit</b>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${colorB};display:inline-block;"></span>
          <span style="color:var(--ink);font-weight:600;">${labelB}:</span>
          <b style="color:${colorB};font-size:12px;">${totalB} unit</b>
        </div>
      </div>
      <div style="font-size:11px;color:var(--ink-soft);background:#F8F9FD;padding:3px 10px;border-radius:12px;border:1px solid #EBEFF5;">
        Selisih Bersih: <b style="color:${diff >= 0 ? colorA : colorB};">${diff >= 0 ? '+' : ''}${diff} unit</b>
      </div>
    </div>
  `;

  el.innerHTML = headerLegend + svg;
}
window.renderLineChart = renderLineChart;
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
  const totalFinal = items.reduce((s,i)=>s+(Number(i.qty)||0),0);
  const totalValue = items.reduce((s,i)=>s+(Number(i.qty)||0)*(Number(i.price)||0),0);
  document.getElementById('rIn').textContent = totalIn.toLocaleString('id-ID');
  document.getElementById('rOut').textContent = totalOut.toLocaleString('id-ID');
  document.getElementById('rFinal').textContent = totalFinal.toLocaleString('id-ID');
  document.getElementById('rValue').textContent = rupiah(totalValue);

  const byPeriod = {};
  if(reportPeriod === 'harian'){
    // Siapkan rentang 7 hari terakhir agar kurva grafik bersambung dan terbaca jelas
    const now = new Date();
    for(let i = 6; i >= 0; i--){
      const cur = new Date(now.getTime() - i * 86400000);
      const k = cur.toISOString().slice(0, 10);
      byPeriod[k] = { in: 0, out: 0 };
    }
    scoped.forEach(m=>{
      const k = (m.date || '').slice(0, 10);
      if(!k) return;
      if(!byPeriod[k]) byPeriod[k] = { in: 0, out: 0 };
      byPeriod[k][m.type] = (byPeriod[k][m.type] || 0) + (Number(m.qty) || 0);
    });
  } else if(reportPeriod === 'bulanan'){
    // Siapkan 12 bulan kalender lengkap
    const yr = reportYear === 'all' ? new Date().getFullYear() : Number(reportYear);
    for(let m = 1; m <= 12; m++){
      const k = `${yr}-${String(m).padStart(2, '0')}`;
      byPeriod[k] = { in: 0, out: 0 };
    }
    scoped.forEach(m=>{
      const k = (m.date || '').slice(0, 7);
      if(!k) return;
      if(!byPeriod[k]) byPeriod[k] = { in: 0, out: 0 };
      byPeriod[k][m.type] = (byPeriod[k][m.type] || 0) + (Number(m.qty) || 0);
    });
  } else {
    // Tahunan
    scoped.forEach(m=>{
      const k = (m.date || '').slice(0, 4);
      if(!k) return;
      if(!byPeriod[k]) byPeriod[k] = { in: 0, out: 0 };
      byPeriod[k][m.type] = (byPeriod[k][m.type] || 0) + (Number(m.qty) || 0);
    });
    const yKeys = Object.keys(byPeriod);
    if(yKeys.length === 1){
      const yNum = Number(yKeys[0]) || new Date().getFullYear();
      byPeriod[String(yNum - 1)] = { in: 0, out: 0 };
      byPeriod[String(yNum + 1)] = { in: 0, out: 0 };
    }
  }

  const keys = Object.keys(byPeriod).sort();
  const periodNoun = reportPeriod === 'tahunan' ? 'tahun' : reportPeriod === 'bulanan' ? 'bulan' : 'hari';
  document.getElementById('trendNote').textContent = `Menampilkan pergerakan stok dalam ${keys.length} ${periodNoun} terakhir.`;

  renderLineChart('trendChart',
    keys.map(reportPeriodLabel),
    keys.map(k=>byPeriod[k].in),
    keys.map(k=>byPeriod[k].out),
    '#22A559', '#E5484D', 'Stok Masuk', 'Stok Keluar'
  );

  document.getElementById('turnoverPeriodLabel').textContent = reportPeriod === 'tahunan' ? '(semua tahun)' : reportYear === 'all' ? '(semua waktu)' : `(tahun ${reportYear})`;
  const turnover = {};
  items.forEach(i=>{ turnover[i.id] = { name:i.name, category:i.category, in:0, out:0, qty:i.qty }; });
  scoped.forEach(m=>{ if(turnover[m.itemId]) turnover[m.itemId][m.type]+=Number(m.qty)||0; });
  const rows = Object.values(turnover).sort((a,b)=>(b.in+b.out)-(a.in+a.out)).slice(0,10);
  document.getElementById('turnoverBody').innerHTML = (rows.length===0 || rows.every(r=>r.in===0&&r.out===0))
    ? `<tr class="empty-row"><td colspan="5">Belum ada transaksi.</td></tr>`
    : rows.map(r=>`<tr><td><b>${esc(r.name)}</b></td><td>${esc(r.category||'-')}</td><td style="color:var(--green);font-weight:700;">+${r.in}</td><td style="color:#C22222;font-weight:700;">-${r.out}</td><td><b>${r.qty}</b></td></tr>`).join('');
}

window.renderReports = renderReports;

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
