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
  const sumA = seriesA.reduce((s,v)=>s+v,0);
  const sumB = seriesB.reduce((s,v)=>s+v,0);
  const diff = sumA - sumB;

  const summaryStrip = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:8px;padding:6px 9px;background:#F8F9FC;border-radius:8px;border:1px solid #EBEFF5;font-size:10.5px;">
      <div style="display:flex;align-items:center;gap:5px;">
        <span style="width:7px;height:7px;border-radius:50%;background:${colorA};flex-shrink:0;"></span>
        <span style="color:var(--ink-soft);">${labelA}:</span>
        <b style="color:${colorA};">${sumA}</b>
      </div>
      <div style="display:flex;align-items:center;gap:5px;">
        <span style="width:7px;height:7px;border-radius:50%;background:${colorB};flex-shrink:0;"></span>
        <span style="color:var(--ink-soft);">${labelB}:</span>
        <b style="color:${colorB};">${sumB}</b>
      </div>
      <div style="display:flex;align-items:center;gap:4px;">
        <span style="color:var(--ink-soft);">Selisih:</span>
        <b style="color:${diff >= 0 ? colorA : colorB};">${diff >= 0 ? '+' : ''}${diff}</b>
      </div>
    </div>
  `;

  const barWidth = labels.length <= 3 ? 18 : (labels.length <= 5 ? 14 : 10);
  const bars = labels.map((lab,i)=>{
    const hA = Math.max(2, Math.round((seriesA[i]/max)*100));
    const hB = Math.max(2, Math.round((seriesB[i]/max)*100));
    const vA = seriesA[i];
    const vB = seriesB[i];
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;min-width:0;">
      <div style="display:flex;align-items:flex-end;justify-content:center;gap:3px;height:82px;width:100%;">
        <div style="display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;">
          ${vA > 0 ? `<span style="font-size:8.5px;font-weight:700;color:${colorA};line-height:1;margin-bottom:2px;">${vA}</span>` : ''}
          <div style="width:${barWidth}px;background:${colorA};border-radius:3px 3px 0 0;height:${hA}%;" title="${labelA}: ${vA}"></div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;">
          ${vB > 0 ? `<span style="font-size:8.5px;font-weight:700;color:${colorB};line-height:1;margin-bottom:2px;">${vB}</span>` : ''}
          <div style="width:${barWidth}px;background:${colorB};border-radius:3px 3px 0 0;height:${hB}%;" title="${labelB}: ${vB}"></div>
        </div>
      </div>
      <div style="font-size:9px;font-weight:600;color:var(--ink-soft);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:65px;">${esc(lab)}</div>
    </div>`;
  }).join('');

  document.getElementById(containerId).innerHTML = summaryStrip + `<div style="display:flex;gap:8px;align-items:flex-end;padding:0 2px;">${bars}</div>`;
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
  
  const stockHealthEl = document.getElementById('stockHealthBadge');
  if(stockHealthEl){
    if(habis.length > 0){
      stockHealthEl.className = 'pill habis';
      stockHealthEl.textContent = `${habis.length} Stok Habis`;
    } else if(rendah.length > 0){
      stockHealthEl.className = 'pill rendah';
      stockHealthEl.textContent = `${rendah.length} Stok Menipis`;
    } else {
      stockHealthEl.className = 'pill aman';
      stockHealthEl.textContent = 'Kondisi Aman';
    }
  }

  document.getElementById('legendStok').innerHTML = stokData.map(d=>{
    const pct = totalItem ? ((d.value/totalItem)*100).toFixed(0) : '0';
    return `
      <div style="margin-bottom:6px;">
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;margin-bottom:2px;">
          <span style="display:flex;align-items:center;gap:6px;font-weight:600;">
            <span style="width:7px;height:7px;border-radius:50%;background:${d.color};flex-shrink:0;"></span>
            ${d.label}
          </span>
          <span style="font-size:11px;font-weight:700;">${d.value} <span style="font-weight:400;color:var(--ink-soft);font-size:10px;">(${pct}%)</span></span>
        </div>
        <div style="height:4px;background:#F1F3F9;border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${d.color};border-radius:4px;"></div>
        </div>
      </div>
    `;
  }).join('');
  renderDonutSVG('donutStok', stokData);

  const calloutEl = document.getElementById('stockCalloutText');
  if(calloutEl){
    calloutEl.textContent = habis.length > 0 
      ? `Perhatian: Ada ${habis.length} item habis dan ${rendah.length} item menipis yang perlu segera di-restock.`
      : (rendah.length > 0 
          ? `Catatan: ${rendah.length} item mendekati batas minimum stok.`
          : `Seluruh persediaan ${totalItem} jenis barang berada pada level aman.`);
  }

  // Kategori teratas dengan case-folding (misal: ELECTRICAL & Electrical disatukan)
  const catMap = {};
  items.forEach(i=>{
    let raw = (i.category || 'Lainnya').trim();
    if(!raw) raw = 'Lainnya';
    const key = raw.toLowerCase();
    const displayName = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    if(!catMap[key]){
      catMap[key] = { name: displayName, qty: 0, count: 0 };
    }
    catMap[key].qty += (Number(i.qty) || 0);
    catMap[key].count += 1;
  });

  const distinctCount = Object.keys(catMap).length;
  const catBadge = document.getElementById('catTotalBadge');
  if(catBadge) catBadge.textContent = `${distinctCount} Kategori`;

  let catEntries = Object.values(catMap).sort((a,b)=>b.qty - a.qty);
  const totalQtyAll = catEntries.reduce((s,c)=>s+c.qty, 0) || 1;
  const palette = ['#2F6FE4','#22A559','#8B5CF6','#F5A623','#06B6D4','#E5484D'];
  if(catEntries.length > 4){
    const top = catEntries.slice(0,4);
    const restQty = catEntries.slice(4).reduce((s,c)=>s+c.qty, 0);
    const restCount = catEntries.slice(4).reduce((s,c)=>s+c.count, 0);
    catEntries = [...top, { name: 'Lainnya', qty: restQty, count: restCount }];
  }

  const legendKategori = document.getElementById('legendKategori');
  legendKategori.innerHTML = catEntries.length === 0
    ? `<div class="note">Belum ada kategori.</div>`
    : catEntries.map((c, idx)=>{
        const pct = ((c.qty / totalQtyAll) * 100).toFixed(0);
        const col = palette[idx % palette.length];
        return `
          <div style="margin-bottom:6px;">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;margin-bottom:2px;">
              <span style="display:flex;align-items:center;gap:6px;font-weight:600;">
                <span style="width:7px;height:7px;border-radius:50%;background:${col};flex-shrink:0;"></span>
                ${esc(c.name)} <span style="font-size:9.5px;color:var(--ink-soft);font-weight:400;">(${c.qty} unit)</span>
              </span>
              <b style="color:var(--ink);font-size:11px;">${pct}%</b>
            </div>
            <div style="height:4px;background:#F1F3F9;border-radius:4px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${col};border-radius:4px;"></div>
            </div>
          </div>
        `;
      }).join('');
  renderDonutSVG('donutKategori', catEntries.map((c, idx)=>({ label: c.name, value: c.qty, color: palette[idx % palette.length] })));

  const lowItems = [...habis, ...rendah].sort((a,b)=>(Number(a.qty)||0)-(Number(b.qty)||0)).slice(0,5);
  document.getElementById('lowCountBadge').textContent = habis.length + rendah.length;
  document.getElementById('lowStockBody').innerHTML = lowItems.length === 0
    ? `<tr class="empty-row"><td colspan="6">Tidak ada barang dengan stok rendah 🎉</td></tr>`
    : lowItems.map(i=>`<tr><td><b>${esc(i.name)}</b></td><td>${esc(i.category||'-')}</td><td>${i.qty||0}</td><td>${i.min||0}</td><td>${esc(i.desc||'-')}</td><td><span class="pill ${statusOf(i)}">${statusOf(i)==='habis'?'Habis':'Rendah'}</span></td></tr>`).join('');

  // Grafik mutasi per minggu: siapkan setidaknya 3 pekan terakhir agar grafik seimbang dan tidak kosong
  const nowD = new Date();
  const getWeekKey = (date) => {
    const y = date.getFullYear();
    const w = String(Math.ceil((((date - new Date(y,0,1))/86400000)+new Date(y,0,1).getDay()+1)/7)).padStart(2,'0');
    return `${y}-W${w}`;
  };
  const weekMap = {};
  for(let w = 2; w >= 0; w--){
    const targetD = new Date(nowD.getTime() - w * 7 * 86400000);
    weekMap[getWeekKey(targetD)] = { in: 0, out: 0 };
  }
  DB.movements.forEach(m=>{
    const d = new Date(m.date || m.createdAt);
    if(isNaN(d)) return;
    const k = getWeekKey(d);
    if(!weekMap[k]) weekMap[k] = { in:0, out:0 };
    weekMap[k][m.type] += (Number(m.qty) || 0);
  });
  const weekKeys = Object.keys(weekMap).sort();

  const netBadge = document.getElementById('flowNetBadge');
  if(netBadge){
    const net = monthIn - monthOut;
    netBadge.textContent = `Net: ${net >= 0 ? '+' : ''}${net} unit`;
    netBadge.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';
    netBadge.style.background = net >= 0 ? 'var(--green-bg)' : 'var(--red-bg)';
  }

  document.getElementById('barNote').textContent = '';
  renderGroupedBars('barStok',
    weekKeys,
    weekKeys.map(k=>weekMap[k].in),
    weekKeys.map(k=>weekMap[k].out),
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
