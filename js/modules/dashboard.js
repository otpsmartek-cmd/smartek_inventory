/* ============ DASHBOARD ============ */
function renderDonutSVG(containerId, data){
  const total = data.reduce((s,d)=>s+d.value,0);
  const r = 15.915;
  let offset = 0, circles = '';
  if(!total){
    circles = `<circle cx="18" cy="18" r="${r}" fill="none" stroke="#E5E7EB" stroke-width="4"></circle>`;
  } else {
    data.forEach(d=>{
      const pct = (d.value/total)*100;
      if(pct <= 0) return;
      const target = 100 - offset;
      circles += `<circle cx="18" cy="18" r="${r}" fill="none" stroke="${d.color}" stroke-width="4" stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="100" data-target="${target}" style="transition:stroke-dashoffset .9s cubic-bezier(.16,.84,.24,1)" transform="rotate(-90 18 18)"></circle>`;
      offset += pct;
    });
  }
  const el = document.getElementById(containerId);
  el.innerHTML = `<svg viewBox="0 0 36 36" width="100%" height="100%">${circles}</svg>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    el.querySelectorAll('circle[data-target]').forEach(c => c.setAttribute('stroke-dashoffset', c.dataset.target));
  }));
}

function animateCount(el, endVal, opts={}){
  const suffix = opts.suffix || '';
  const isCurrency = !!opts.currency;
  const startVal = Number((el.dataset.rawVal || '0').replace(/\D/g,'')) || 0;
  const end = Number(endVal) || 0;
  el.dataset.rawVal = end;
  const duration = 700;
  const startTime = performance.now();
  function tick(now){
    const p = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(startVal + (end - startVal) * eased);
    el.textContent = isCurrency ? rupiah(val) : val.toLocaleString('id-ID') + suffix;
    if(p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderGroupedBars(containerId, labels, seriesA, seriesB, colorA, colorB, labelA, labelB){
  const max = Math.max(1, ...seriesA, ...seriesB);
  const bars = labels.map((lab,i)=>{
    const hA = Math.max(2, Math.round((seriesA[i]/max)*100));
    const hB = Math.max(2, Math.round((seriesB[i]/max)*100));
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0;">
      <div style="display:flex;align-items:flex-end;gap:3px;height:85px;">
        <div style="width:14px;background:${colorA};border-radius:3px 3px 0 0;height:${hA}%;" title="${labelA}: ${seriesA[i]}"></div>
        <div style="width:14px;background:${colorB};border-radius:3px 3px 0 0;height:${hB}%;" title="${labelB}: ${seriesB[i]}"></div>
      </div>
      <div style="font-size:9px;color:var(--ink-soft);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60px;">${esc(lab)}</div>
    </div>`;
  }).join('');
  const legend = `<div style="display:flex;gap:12px;margin-bottom:6px;font-size:10.5px;">
    <div style="display:flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:50%;background:${colorA};display:inline-block;"></span>${labelA}</div>
    <div style="display:flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:50%;background:${colorB};display:inline-block;"></span>${labelB}</div>
  </div>`;
  document.getElementById(containerId).innerHTML = legend + `<div style="display:flex;gap:8px;align-items:flex-end;">${bars}</div>`;
}

function renderLineChart(containerId, labels, seriesA, seriesB, colorA, colorB, labelA, labelB){
  const w = 600, h = 170, pad = 26;
  const max = Math.max(1, ...seriesA, ...seriesB);
  const stepX = labels.length > 1 ? (w-2*pad)/(labels.length-1) : 0;
  const midX = labels.length === 1 ? w/2 : null;
  function pathFor(series){
    if(labels.length === 1){
      const y = h-pad - (series[0]/max)*(h-2*pad);
      return `M${midX},${y.toFixed(1)} L${midX},${y.toFixed(1)}`;
    }
    return series.map((v,i)=>{
      const x = pad + i*stepX;
      const y = h-pad - (v/max)*(h-2*pad);
      return `${i===0?'M':'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }
  const gridLines = [0,0.25,0.5,0.75,1].map(f=>{
    const y = h-pad - f*(h-2*pad);
    return `<line x1="${pad}" y1="${y}" x2="${w-pad}" y2="${y}" stroke="#EFEFF3" stroke-width="1"/>`;
  }).join('');
  const labelEls = labels.map((lab,i)=>{
    const x = labels.length===1 ? midX : pad + i*stepX;
    return `<text x="${x}" y="${h-6}" font-size="9" fill="#6B7280" text-anchor="middle">${esc(String(lab).slice(-5))}</text>`;
  }).join('');
  const svg = `<svg viewBox="0 0 ${w} ${h}" width="100%" height="170" preserveAspectRatio="none">
    ${gridLines}
    <path d="${pathFor(seriesA)}" fill="none" stroke="${colorA}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    <path d="${pathFor(seriesB)}" fill="none" stroke="${colorB}" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
    ${labelEls}
  </svg>`;
  document.getElementById(containerId).innerHTML =
    `<div style="display:flex;gap:14px;margin-bottom:8px;font-size:11px;">
      <div style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:${colorA};display:inline-block;"></span>${labelA}</div>
      <div style="display:flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:50%;background:${colorB};display:inline-block;"></span>${labelB}</div>
    </div>` + svg;
}

function renderDashboard(){
  const items = itemList();
  const totalItem = items.length;
  const stokTersedia = items.reduce((s,i)=>s+(Number(i.qty)||0),0);
  const habis = items.filter(i=>statusOf(i)==='habis');
  const rendah = items.filter(i=>statusOf(i)==='rendah');
  const aman = items.filter(i=>statusOf(i)==='aman');

  const now = new Date();
  const thisMonth = now.toISOString().slice(0,7);
  const monthIn = DB.movements.filter(m=>m.type==='in' && (m.date||'').slice(0,7)===thisMonth).reduce((s,m)=>s+(Number(m.qty)||0),0);
  const monthOut = DB.movements.filter(m=>m.type==='out' && (m.date||'').slice(0,7)===thisMonth).reduce((s,m)=>s+(Number(m.qty)||0),0);

  animateCount(document.getElementById('dTotalItem'), totalItem);
  animateCount(document.getElementById('dStokTersedia'), stokTersedia);
  animateCount(document.getElementById('dStokMasuk'), monthIn);
  animateCount(document.getElementById('dStokKeluar'), monthOut);
  animateCount(document.getElementById('donutTotal'), totalItem);
  refreshAlertBadge();

  const stokData = [
    { label:'Stok Aman', value:aman.length, color:'#22A559' },
    { label:'Stok Rendah', value:rendah.length, color:'#F5A623' },
    { label:'Stok Habis', value:habis.length, color:'#E5484D' },
  ];
  document.getElementById('legendStok').innerHTML = stokData.map(d=>{
    const pct = totalItem ? ((d.value/totalItem)*100).toFixed(1) : '0.0';
    return `<div class="legend-item"><span class="dot" style="background:${d.color}"></span><div><b>${d.label}</b><span class="pct">${d.value} (${pct}%)</span></div></div>`;
  }).join('');
  renderDonutSVG('donutStok', stokData);

  const catMap = {};
  items.forEach(i=>{ const c=i.category||'Lainnya'; catMap[c]=(catMap[c]||0)+(Number(i.qty)||0); });
  let catEntries = Object.entries(catMap).sort((a,b)=>b[1]-a[1]);
  const totalQtyAll = catEntries.reduce((s,[,v])=>s+v,0) || 1;
  const palette = ['#2F6FE4','#22A559','#8B5CF6','#F5A623','#9CA3AF','#E5484D'];
  if(catEntries.length > 5){ const top=catEntries.slice(0,5); const rest=catEntries.slice(5).reduce((s,[,v])=>s+v,0); catEntries=[...top,['Lainnya',rest]]; }
  const legendKategori = document.getElementById('legendKategori');
  legendKategori.innerHTML = catEntries.length === 0
    ? `<div class="note">Belum ada kategori.</div>`
    : catEntries.map(([name,val],idx)=>{
        const pct = ((val/totalQtyAll)*100).toFixed(0);
        return `<div class="cat-row"><div class="left"><span class="dot" style="background:${palette[idx%palette.length]}"></span>${esc(name)}</div><b>${pct}%</b></div>`;
      }).join('');
  renderDonutSVG('donutKategori', catEntries.map(([name,val],idx)=>({ label:name, value:val, color:palette[idx%palette.length] })));

  const lowItems = [...habis, ...rendah].sort((a,b)=>(Number(a.qty)||0)-(Number(b.qty)||0)).slice(0,5);
  document.getElementById('lowCountBadge').textContent = habis.length + rendah.length;
  document.getElementById('lowStockBody').innerHTML = lowItems.length === 0
    ? `<tr class="empty-row"><td colspan="6">Tidak ada barang dengan stok rendah 🎉</td></tr>`
    : lowItems.map(i=>`<tr><td><b>${esc(i.name)}</b></td><td>${esc(i.category||'-')}</td><td>${i.qty||0}</td><td>${i.min||0}</td><td>${esc(i.desc||'-')}</td><td><span class="pill ${statusOf(i)}">${statusOf(i)==='habis'?'Habis':'Rendah'}</span></td></tr>`).join('');

  // grafik masuk/keluar per minggu (dari movements nyata, kalau kosong tampilkan pesan)
  const weekMap = {};
  DB.movements.forEach(m=>{
    const d = new Date(m.date);
    if(isNaN(d)) return;
    const weekKey = `${d.getFullYear()}-W${String(Math.ceil((((d - new Date(d.getFullYear(),0,1))/86400000)+new Date(d.getFullYear(),0,1).getDay()+1)/7)).padStart(2,'0')}`;
    if(!weekMap[weekKey]) weekMap[weekKey] = { in:0, out:0 };
    weekMap[weekKey][m.type] += Number(m.qty)||0;
  });
  const weekKeys = Object.keys(weekMap).sort();
  document.getElementById('barNote').textContent = weekKeys.length === 0
    ? 'Belum ada transaksi stok masuk/keluar — mulai catat di halaman Stock In / Stock Out.'
    : '';
  renderGroupedBars('barStok',
    weekKeys.length ? weekKeys : ['Belum ada data'],
    weekKeys.length ? weekKeys.map(k=>weekMap[k].in) : [0],
    weekKeys.length ? weekKeys.map(k=>weekMap[k].out) : [0],
    '#22A559', '#E5484D', 'Stok Masuk', 'Stok Keluar'
  );

  // aktivitas terbaru nyata
  const acts = [...DB.movements].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,5);
  const activityList = document.getElementById('activityList');
  activityList.innerHTML = acts.length === 0
    ? `<div class="note">Belum ada aktivitas tercatat.</div>`
    : acts.map(m=>{
        const isIn = m.type === 'in';
        return `<div class="activity-item">
          <div class="act-icon" style="background:${isIn?'var(--green-bg)':'var(--red-bg)'};color:${isIn?'#178A47':'#C22222'};">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${isIn?'<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>':'<path d="M12 5v14"/><path d="M19 12l-7 7-7-7"/>'}</svg>
          </div>
          <div class="act-body"><div><div class="act-title">${isIn?'Stok Masuk':'Stok Keluar'}</div><div class="act-sub">${esc(m.itemName)} · ${m.qty} unit</div></div><div class="act-time">${fmtDT(m.createdAt)}</div></div>
        </div>`;
      }).join('');
}
