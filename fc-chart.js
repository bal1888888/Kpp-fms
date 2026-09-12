(function(){
  "use strict";
  const COLORS=["#2563eb","#16a34a","#f97316","#7c3aed"];
  const MAX_UNITS=4;

  function esc(value){return String(value??"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));}
  function num(value){const n=Number(value);return Number.isFinite(n)?n:0;}
  function fmt(value,digits=1){return new Intl.NumberFormat("id-ID",{maximumFractionDigits:digits}).format(num(value));}
  function fmtFc(value){return Number.isFinite(value)?new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1}).format(value):"-";}
  function addDays(value,days){
    if(window.KPPTime?.addDays)return window.KPPTime.addDays(value,days);
    const [y,m,d]=String(value).split("-").map(Number);const x=new Date(y,m-1,d);x.setDate(x.getDate()+days);
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
  }
  function dateList(start,end){const out=[];let cur=start;let guard=0;while(cur<=end&&guard<370){out.push(cur);cur=addDays(cur,1);guard++;}return out;}
  function shortDate(value){const p=String(value).split("-");return p.length===3?`${p[2]}/${p[1]}`:value;}

  function ensureStyle(){
    if(document.getElementById("kppFcWidgetStyle"))return;
    const style=document.createElement("style");style.id="kppFcWidgetStyle";style.textContent=`
      .kpp-fc-widget{background:#fff;border:1px solid #e2e8f0;border-radius:15px;box-shadow:0 4px 16px rgba(15,23,42,.045);margin:0 0 18px;overflow:visible;color:#0f172a}
      .kpp-fc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #edf1f6}
      .kpp-fc-head h3{margin:0;font-size:16px;color:#0f172a}.kpp-fc-head p{margin:4px 0 0;font-size:10px;color:#64748b;line-height:1.35}
      .kpp-fc-toggle{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:9px;padding:8px 11px;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}
      .kpp-fc-body{padding:14px 16px 16px}.kpp-fc-body[hidden]{display:none!important}
      .kpp-fc-filters{display:grid;grid-template-columns:minmax(220px,1.35fr) minmax(130px,.8fr) minmax(130px,.8fr) auto;gap:9px;align-items:end;margin-bottom:12px}
      .kpp-fc-field{min-width:0}.kpp-fc-field>label{display:block;margin:0 0 5px;font-size:9px;font-weight:900;color:#475569;letter-spacing:.02em}
      .kpp-fc-field input{width:100%;height:40px;border:1px solid #cbd5e1;border-radius:9px;padding:0 10px;background:#fff;color:#0f172a;font-size:11px}
      .kpp-fc-unit-picker{position:relative}.kpp-fc-unit-trigger{width:100%;min-height:40px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;padding:5px 8px;display:flex;align-items:center;justify-content:space-between;gap:7px;cursor:pointer;text-align:left}
      .kpp-fc-chip-wrap{display:flex;align-items:center;gap:4px;flex-wrap:wrap;min-width:0}.kpp-fc-chip{display:inline-flex;padding:4px 6px;border-radius:6px;background:#dbeafe;color:#1d4ed8;font-size:9px;font-weight:900}.kpp-fc-picker-placeholder{color:#94a3b8;font-size:10px}
      .kpp-fc-unit-menu{position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:15000;background:#fff;border:1px solid #cbd5e1;border-radius:10px;box-shadow:0 18px 40px rgba(15,23,42,.16);padding:8px;max-height:280px;overflow:hidden}
      .kpp-fc-unit-menu[hidden]{display:none!important}.kpp-fc-unit-search{height:34px!important;margin-bottom:6px}.kpp-fc-unit-list{max-height:220px;overflow:auto;padding-right:3px}.kpp-fc-unit-option{display:flex;align-items:center;gap:7px;padding:6px;border-radius:7px;font-size:10px;color:#334155;cursor:pointer}.kpp-fc-unit-option:hover{background:#f1f5f9}.kpp-fc-unit-option input{width:14px;height:14px}
      .kpp-fc-run{height:40px;border:0;border-radius:9px;padding:0 14px;background:#2563eb;color:#fff;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}.kpp-fc-run:disabled{opacity:.55;cursor:wait}
      .kpp-fc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px}.kpp-fc-kpi{border:1px solid #e2e8f0;border-radius:11px;padding:10px 11px;background:#f8fafc}.kpp-fc-kpi small{display:block;font-size:8px;color:#64748b;font-weight:900;margin-bottom:4px}.kpp-fc-kpi strong{font-size:16px;color:#0f172a}.kpp-fc-kpi.blue{background:#eff6ff}.kpp-fc-kpi.green{background:#f0fdf4}.kpp-fc-kpi.amber{background:#fffbeb}.kpp-fc-kpi.purple{background:#f5f3ff}
      .kpp-fc-chart-card{border:1px solid #e2e8f0;border-radius:11px;padding:10px;background:#fff}.kpp-fc-chart-top{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:5px}.kpp-fc-chart-title{font-size:11px;font-weight:900;color:#0f172a}.kpp-fc-legend{display:flex;gap:9px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.kpp-fc-legend-item{display:flex;align-items:center;gap:4px;font-size:8px;color:#475569;font-weight:800}.kpp-fc-dot{width:7px;height:7px;border-radius:50%}
      .kpp-fc-chart{width:100%;overflow-x:auto}.kpp-fc-chart svg{display:block;width:100%;min-width:620px;height:auto}.kpp-fc-empty{padding:28px 10px;text-align:center;color:#64748b;font-size:10px}.kpp-fc-note{margin-top:7px;font-size:8px;color:#64748b;line-height:1.4}.kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}
      @media(max-width:760px){.kpp-fc-head{padding:12px}.kpp-fc-body{padding:10px 10px 12px}.kpp-fc-filters{grid-template-columns:1fr 1fr}.kpp-fc-field.units{grid-column:1/-1}.kpp-fc-run{grid-column:1/-1}.kpp-fc-kpis{grid-template-columns:1fr 1fr}.kpp-fc-chart-card{padding:8px}.kpp-fc-chart-top{align-items:flex-start;flex-direction:column}.kpp-fc-legend{justify-content:flex-start}.kpp-fc-kpi strong{font-size:14px}}
      @media(max-width:420px){.kpp-fc-filters{grid-template-columns:1fr}.kpp-fc-field.units,.kpp-fc-run{grid-column:auto}.kpp-fc-kpis{gap:6px}.kpp-fc-kpi{padding:8px}.kpp-fc-kpi strong{font-size:13px}}
    `;document.head.appendChild(style);
  }

  async function fetchPaged(db,start,end,units){let all=[],from=0;const size=1000;while(true){let q=db.from("fuel_history").select("id,tanggal,unit,hm_akhir,hm_jalan,fuel").gte("tanggal",start).lte("tanggal",end).in("unit",units).order("tanggal",{ascending:true}).order("id",{ascending:true}).range(from,from+size-1);const {data,error}=await q;if(error)throw error;const rows=data||[];all=all.concat(rows);if(rows.length<size)break;from+=size;}return all;}
  async function fetchBaselines(db,start,units){const pairs=await Promise.all(units.map(async unit=>{const {data,error}=await db.from("fuel_history").select("id,tanggal,unit,hm_akhir").eq("unit",unit).lt("tanggal",start).not("hm_akhir","is",null).order("tanggal",{ascending:false}).order("id",{ascending:false}).limit(1);if(error)throw error;return [unit,(data||[])[0]||null];}));return new Map(pairs);}

  function buildMetrics(rows,baselines,units,start,end){
    const perUnit=new Map(units.map(unit=>[unit,{unit,totalFuel:0,validFuel:0,hm:0,samples:0,daily:new Map()}]));
    rows.forEach(row=>{const unit=String(row.unit||"").trim().toUpperCase();if(perUnit.has(unit))perUnit.get(unit).totalFuel+=num(row.fuel);});
    units.forEach(unit=>{
      const entry=perUnit.get(unit);const unitRows=rows.filter(row=>String(row.unit||"").trim().toUpperCase()===unit).sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal))||num(a.id)-num(b.id));
      const base=baselines.get(unit);let previous=base&&Number.isFinite(Number(base.hm_akhir))?Number(base.hm_akhir):null;
      unitRows.forEach(row=>{const hmRaw=row.hm_akhir;const hm=hmRaw===null||hmRaw===undefined||hmRaw===""?null:Number(hmRaw);if(!Number.isFinite(hm)){return;}let delta=null;if(Number.isFinite(previous)&&hm>=previous)delta=hm-previous;if(Number.isFinite(previous)&&hm<previous){delta=null;return;}previous=hm;if(!(delta>0))return;const fuel=num(row.fuel);entry.hm+=delta;entry.validFuel+=fuel;entry.samples+=1;const day=entry.daily.get(row.tanggal)||{fuel:0,hm:0};day.fuel+=fuel;day.hm+=delta;entry.daily.set(row.tanggal,day);});
    });
    const dates=dateList(start,end);const series=units.map((unit,index)=>{const entry=perUnit.get(unit);return {unit,color:COLORS[index%COLORS.length],values:dates.map(date=>{const d=entry.daily.get(date);return d&&d.hm>0?d.fuel/d.hm:null;})};});
    const list=Array.from(perUnit.values());const totalFuel=list.reduce((s,x)=>s+x.totalFuel,0);const validFuel=list.reduce((s,x)=>s+x.validFuel,0);const totalHm=list.reduce((s,x)=>s+x.hm,0);const samples=list.reduce((s,x)=>s+x.samples,0);return {dates,series,totalFuel,totalHm,samples,avg:totalHm>0?validFuel/totalHm:null};
  }

  function renderSvg(host,metrics){
    const {dates,series}=metrics;const values=series.flatMap(s=>s.values.filter(Number.isFinite));
    if(!values.length){host.innerHTML='<div class="kpp-fc-empty">Belum ada pasangan HM berurutan yang valid untuk unit dan periode ini.</div>';return;}
    const W=900,H=300,L=48,R=16,T=18,B=38;const plotW=W-L-R,plotH=H-T-B;const max=Math.max(...values);const yMax=Math.max(5,Math.ceil((max*1.15)/5)*5);const x=i=>L+(dates.length<=1?plotW/2:(i/(dates.length-1))*plotW);const y=v=>T+plotH-(v/yMax)*plotH;
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik trend FC per unit">`;
    for(let i=0;i<=4;i++){const val=(yMax/4)*i;const yy=y(val);svg+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e2e8f0" stroke-width="1"/><text x="${L-8}" y="${yy+3}" text-anchor="end" font-size="9" fill="#64748b">${fmtFc(val)}</text>`;}
    const tickStep=Math.max(1,Math.ceil(dates.length/7));dates.forEach((date,i)=>{if(i%tickStep===0||i===dates.length-1)svg+=`<text x="${x(i)}" y="${H-12}" text-anchor="middle" font-size="8.5" fill="#64748b">${esc(shortDate(date))}</text>`;});
    series.forEach(s=>{const pts=[];s.values.forEach((v,i)=>{if(Number.isFinite(v))pts.push(`${x(i)},${y(v)}`);});if(pts.length>1)svg+=`<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;s.values.forEach((v,i)=>{if(Number.isFinite(v))svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="3.3" fill="#fff" stroke="${s.color}" stroke-width="2"><title>${esc(s.unit)} ${esc(shortDate(dates[i]))}: ${fmtFc(v)} L/HM</title></circle>`;});});
    svg+=`<text x="${W/2}" y="${H-1}" text-anchor="middle" font-size="9" fill="#475569">Tanggal</text><text transform="translate(12 ${H/2}) rotate(-90)" text-anchor="middle" font-size="9" fill="#475569">FC (L/HM)</text></svg>`;host.innerHTML=svg;
  }

  function mount(options){
    ensureStyle();const host=document.getElementById(options.hostId);if(!host||host.dataset.kppFcMounted==="1")return;host.dataset.kppFcMounted="1";
    const collapsible=!!options.collapsible;let collapsed=collapsible&&options.collapsedByDefault!==false;let initialized=false;let units=[];let selected=[];const today=window.KPPTime?.localDate?.()||new Date().toISOString().slice(0,10);const end=options.endDate||today;const start=options.startDate||addDays(end,-13);
    host.innerHTML=`<section class="kpp-fc-widget"><div class="kpp-fc-head"><div><h3>${esc(options.title||"Grafik FC per Unit")}</h3><p>FC = total fuel pada sampel HM valid ÷ total HM jalan. Pilih unit dan rentang tanggal.</p></div>${collapsible?'<button type="button" class="kpp-fc-toggle"></button>':''}</div><div class="kpp-fc-body" ${collapsed?'hidden':''}><div class="kpp-fc-filters"><div class="kpp-fc-field units"><label>PILIH UNIT</label><div class="kpp-fc-unit-picker"><button type="button" class="kpp-fc-unit-trigger"><span class="kpp-fc-chip-wrap"><span class="kpp-fc-picker-placeholder">Memuat unit...</span></span><span>⌄</span></button><div class="kpp-fc-unit-menu" hidden><input class="kpp-fc-unit-search" type="search" placeholder="Cari code unit..."><div class="kpp-fc-unit-list"></div></div></div></div><div class="kpp-fc-field"><label>TANGGAL AWAL</label><input class="kpp-fc-start" type="date" value="${start}"></div><div class="kpp-fc-field"><label>TANGGAL AKHIR</label><input class="kpp-fc-end" type="date" value="${end}"></div><button class="kpp-fc-run" type="button">TAMPILKAN GRAFIK</button></div><div class="kpp-fc-kpis"><div class="kpp-fc-kpi blue"><small>RATA-RATA FC</small><strong data-kpi="avg">-</strong></div><div class="kpp-fc-kpi green"><small>TOTAL FUEL</small><strong data-kpi="fuel">-</strong></div><div class="kpp-fc-kpi amber"><small>TOTAL HM JALAN</small><strong data-kpi="hm">-</strong></div><div class="kpp-fc-kpi purple"><small>JUMLAH PENGISIAN</small><strong data-kpi="count">-</strong></div></div><div class="kpp-fc-chart-card"><div class="kpp-fc-chart-top"><span class="kpp-fc-chart-title">Trend FC per Unit (L/HM)</span><div class="kpp-fc-legend"></div></div><div class="kpp-fc-chart"><div class="kpp-fc-empty">Pilih unit lalu tampilkan grafik.</div></div><div class="kpp-fc-note">HM jalan grafik dihitung dari selisih HM transaksi berurutan per unit. HM turun/reset tidak dipaksa menjadi nilai negatif.</div></div><div class="kpp-fc-status"></div></div></section>`;
    const body=host.querySelector('.kpp-fc-body'),toggle=host.querySelector('.kpp-fc-toggle'),trigger=host.querySelector('.kpp-fc-unit-trigger'),menu=host.querySelector('.kpp-fc-unit-menu'),list=host.querySelector('.kpp-fc-unit-list'),search=host.querySelector('.kpp-fc-unit-search'),run=host.querySelector('.kpp-fc-run'),status=host.querySelector('.kpp-fc-status');
    const updateToggle=()=>{if(toggle)toggle.textContent=collapsed?'Tampilkan Grafik FC':'Sembunyikan Grafik FC';};updateToggle();
    const renderPicker=()=>{const wrap=host.querySelector('.kpp-fc-chip-wrap');wrap.innerHTML=selected.length?selected.map(u=>`<span class="kpp-fc-chip">${esc(u)}</span>`).join(''):'<span class="kpp-fc-picker-placeholder">Pilih maksimal 4 unit</span>';list.innerHTML=units.map(u=>`<label class="kpp-fc-unit-option" data-unit-label="${esc(u.toLowerCase())}"><input type="checkbox" value="${esc(u)}" ${selected.includes(u)?'checked':''}> <span>${esc(u)}</span></label>`).join('');};
    const init=async()=>{
      if(initialized)return true;
      status.className='kpp-fc-status';
      status.textContent='Memuat master unit...';
      try{
        const request=KPP.db.from('unit_master').select('code_unit,active').eq('active',true).order('code_unit',{ascending:true});
        const timeout=new Promise((_,reject)=>setTimeout(()=>reject(new Error('Timeout memuat Master Unit. Coba lagi.')),8000));
        const {data,error}=await Promise.race([request,timeout]);
        if(error)throw error;
        units=(data||[]).map(r=>String(r.code_unit||'').trim().toUpperCase()).filter(Boolean);
        let saved=[];
        try{saved=JSON.parse(localStorage.getItem('kppFcSelectedUnits')||'[]');}catch{}
        selected=saved.filter(u=>units.includes(u)).slice(0,MAX_UNITS);
        if(!selected.length)selected=units.slice(0,Math.min(3,units.length));
        renderPicker();
        initialized=true;
        status.className='kpp-fc-status';
        status.textContent=units.length?`${units.length} unit aktif tersedia.`:'Master unit aktif kosong.';
        if(options.autoLoad!==false&&selected.length)await load();
        return true;
      }catch(error){
        initialized=false;
        units=[];
        selected=[];
        const wrap=host.querySelector('.kpp-fc-chip-wrap');
        if(wrap)wrap.innerHTML='<span class="kpp-fc-picker-placeholder">Gagal memuat unit, klik untuk coba lagi</span>';
        list.innerHTML='';
        status.className='kpp-fc-status error';
        status.textContent='Gagal memuat unit: '+error.message+' Klik PILIH UNIT untuk mencoba lagi.';
        return false;
      }
    };
    const load=async()=>{const s=host.querySelector('.kpp-fc-start').value,e=host.querySelector('.kpp-fc-end').value;if(!selected.length){status.className='kpp-fc-status error';status.textContent='Pilih minimal 1 unit.';return;}if(!s||!e||s>e){status.className='kpp-fc-status error';status.textContent='Rentang tanggal tidak valid.';return;}run.disabled=true;status.className='kpp-fc-status';status.textContent='Memuat data FC...';try{const [rows,baselines]=await Promise.all([fetchPaged(KPP.db,s,e,selected),fetchBaselines(KPP.db,s,selected)]);const metrics=buildMetrics(rows,baselines,selected,s,e);host.querySelector('[data-kpi="avg"]').textContent=metrics.avg===null?'-':fmtFc(metrics.avg)+' L/HM';host.querySelector('[data-kpi="fuel"]').textContent=fmt(metrics.totalFuel)+' L';host.querySelector('[data-kpi="hm"]').textContent=fmt(metrics.totalHm)+' HM';host.querySelector('[data-kpi="count"]').textContent=rows.length+' transaksi';host.querySelector('.kpp-fc-legend').innerHTML=metrics.series.map(s=>`<span class="kpp-fc-legend-item"><i class="kpp-fc-dot" style="background:${s.color}"></i>${esc(s.unit)}</span>`).join('');renderSvg(host.querySelector('.kpp-fc-chart'),metrics);status.textContent=`${metrics.samples} sampel HM valid dari ${rows.length} transaksi.`;}catch(error){console.error(error);status.className='kpp-fc-status error';status.textContent='Gagal memuat grafik FC: '+error.message;}finally{run.disabled=false;}};
    toggle?.addEventListener('click',async()=>{collapsed=!collapsed;body.hidden=collapsed;updateToggle();if(!collapsed){await init();if(initialized&&selected.length&&host.querySelector('[data-kpi="count"]').textContent==='-')await load();}});
    trigger.addEventListener('click',async()=>{const ok=await init();if(!ok){menu.hidden=true;return;}menu.hidden=!menu.hidden;if(!menu.hidden)search.focus();});
    list.addEventListener('change',event=>{const box=event.target.closest('input[type="checkbox"]');if(!box)return;const value=box.value;if(box.checked&&!selected.includes(value)){if(selected.length>=MAX_UNITS){box.checked=false;status.className='kpp-fc-status error';status.textContent='Maksimal 4 unit agar grafik tetap terbaca.';return;}selected.push(value);}else if(!box.checked){selected=selected.filter(u=>u!==value);}localStorage.setItem('kppFcSelectedUnits',JSON.stringify(selected));renderPicker();});
    search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();list.querySelectorAll('.kpp-fc-unit-option').forEach(row=>row.style.display=!q||row.dataset.unitLabel.includes(q)?'flex':'none');});
    document.addEventListener('click',event=>{if(!event.target.closest('.kpp-fc-unit-picker'))menu.hidden=true;});run.addEventListener('click',load);
    if(!collapsed)init();
  }
  window.KPPFC={mount};
})();
