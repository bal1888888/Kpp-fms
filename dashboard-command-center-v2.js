// KPP-FMS Dashboard Command Center v2
// Informative dashboard enhancement. Keeps the existing auth/sidebar/navigation untouched.
(() => {
  "use strict";

  const STYLE_ID="kppDashboardCommandCenterV2Style";
  const ROOT_CLASS="kpp-command-center-v2";
  const KPI_ID="kppCommandKpis";
  const STORAGE_ID="kppStorageSnapshot";
  const ACTIVITY_ID="kppActivitySnapshot";
  let usageObserver=null;
  let activityObserver=null;
  let sourceObserver=null;
  let storageBusy=false;
  let storageLoadedFor="";

  const nf0=new Intl.NumberFormat("id-ID",{maximumFractionDigits:0});
  const nf1=new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1});

  function parseIdNumber(value){
    const raw=String(value??"").replace(/L\/hari|hari|L|%/gi,"").trim();
    if(!raw)return null;
    const clean=raw.replace(/[^0-9,.-]/g,"");
    let normalized=clean;
    if(clean.includes(","))normalized=clean.replace(/\./g,"").replace(",",".");
    else if(/^[-+]?\d{1,3}(?:\.\d{3})+$/.test(clean))normalized=clean.replace(/\./g,"");
    const n=Number(normalized);
    return Number.isFinite(n)?n:null;
  }

  function text(el,fallback="-"){
    const value=String(el?.textContent||"").trim();
    return value||fallback;
  }

  function clampPct(value){return Math.max(0,Math.min(100,Number(value)||0));}

  function levelState(pct){
    const p=Number(pct)||0;
    if(p<20)return {key:"critical",label:"KRITIS"};
    if(p<35)return {key:"low",label:"RENDAH"};
    if(p<50)return {key:"warning",label:"WASPADA"};
    if(p>=90)return {key:"high",label:"TINGGI"};
    return {key:"safe",label:"AMAN"};
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .dashboard-workspace.${ROOT_CLASS}{--cc-line:#dfe8f3;--cc-navy:#0f2748;--cc-blue:#2563eb}
      .dashboard-workspace.${ROOT_CLASS} .container{max-width:1500px!important;padding-top:12px!important}
      .dashboard-workspace.${ROOT_CLASS} .executive-grid{display:none!important}
      .dashboard-workspace.${ROOT_CLASS} .top-bar{margin-bottom:12px!important}
      #${KPI_ID}{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 12px}
      .kpp-cc-kpi{position:relative;min-width:0;padding:13px 12px 11px 51px;background:linear-gradient(180deg,#fff,#fbfdff);border:1px solid var(--cc-line);border-radius:16px;box-shadow:0 5px 16px rgba(15,23,42,.055);overflow:hidden}
      .kpp-cc-kpi::after{content:"";position:absolute;width:74px;height:74px;border-radius:50%;right:-30px;bottom:-36px;background:var(--kpi-soft,rgba(37,99,235,.07))}
      .kpp-cc-kpi-icon{position:absolute;left:12px;top:13px;width:31px;height:31px;border-radius:9px;display:grid;place-items:center;background:var(--kpi-bg,#eff6ff);color:var(--kpi-color,#2563eb);font-size:16px;font-weight:900}
      .kpp-cc-kpi-label{font-size:9px;font-weight:900;color:#64748b;letter-spacing:.035em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .kpp-cc-kpi-value{font-size:20px;line-height:1.15;font-weight:900;color:var(--cc-navy);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .kpp-cc-kpi-foot{margin-top:5px;min-height:14px;font-size:8px;font-weight:900;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kpp-cc-kpi-foot.good{color:#15803d}.kpp-cc-kpi-foot.bad{color:#dc2626}.kpp-cc-kpi-foot.warn{color:#b45309}
      .kpp-cc-kpi.stock{--kpi-bg:#dcfce7;--kpi-color:#15803d;--kpi-soft:rgba(22,163,74,.07)}.kpp-cc-kpi.yesterday{--kpi-bg:#dbeafe;--kpi-color:#1d4ed8;--kpi-soft:rgba(37,99,235,.07)}.kpp-cc-kpi.mtd{--kpi-bg:#ffedd5;--kpi-color:#c2410c;--kpi-soft:rgba(249,115,22,.07)}.kpp-cc-kpi.avg{--kpi-bg:#ede9fe;--kpi-color:#6d28d9;--kpi-soft:rgba(124,58,237,.07)}.kpp-cc-kpi.ito{--kpi-bg:#ccfbf1;--kpi-color:#0f766e;--kpi-soft:rgba(15,170,164,.07)}

      .dashboard-workspace.${ROOT_CLASS} .performance-section{padding:14px!important;border-radius:18px!important;background:#f8fbff!important;border-color:#dbe7f3!important}
      .dashboard-workspace.${ROOT_CLASS} .performance-section>.section-head{margin-bottom:12px!important}.dashboard-workspace.${ROOT_CLASS} .performance-section>.section-head h2{font-size:18px!important}
      .kpp-performance-shell{display:grid;grid-template-columns:minmax(0,2.1fr) minmax(285px,.9fr);gap:12px;align-items:start}.kpp-performance-main,.kpp-performance-side{display:grid;gap:12px;min-width:0}
      .kpp-performance-main .overview-card,.kpp-cc-side-card{background:#fff!important;border:1px solid var(--cc-line)!important;border-radius:16px!important;box-shadow:0 5px 16px rgba(15,23,42,.045)!important;padding:14px!important;min-width:0}.kpp-performance-main .overview-title{font-size:16px!important;color:var(--cc-navy)!important}.kpp-performance-main .overview-sub{font-size:9px!important}.kpp-performance-main .stock-trend-card{order:1}.kpp-performance-main .usage-card{order:2}.kpp-performance-receipt{margin-top:12px!important}

      #stockTrendBars.usage-bars{display:grid!important;grid-template-columns:repeat(5,minmax(100px,1fr))!important;height:auto!important;min-height:0!important;gap:9px!important;padding:4px 0 0!important;overflow:visible!important;border:0!important}
      #stockTrendBars .stock-radial-item{min-width:0!important;flex:none!important;padding:10px 7px 9px!important;border-radius:14px!important;background:#fff!important}#stockTrendBars .trend-radial-label{font-size:9px!important;font-weight:900!important;color:var(--cc-navy)!important;margin-bottom:4px!important}#stockTrendBars .stock-trend-ring{width:72px!important;margin:0 auto!important}#stockTrendBars .stock-trend-ring::before{inset:8px!important}#stockTrendBars .stock-trend-ring span{font-size:11px!important}#stockTrendBars .trend-ring-liter{font-size:9px!important;font-weight:900!important;color:var(--cc-navy)!important;margin-top:5px!important}
      #stockTrendBars .trend-stock-status{display:inline-flex!important;align-items:center;justify-content:center;margin-top:5px!important;min-height:18px;padding:2px 7px;border-radius:999px;font-size:7px!important;font-weight:900!important}#stockTrendBars .kpp-level-critical .trend-stock-status{background:#fee2e2!important;color:#b91c1c!important}#stockTrendBars .kpp-level-low .trend-stock-status{background:#ffedd5!important;color:#c2410c!important}#stockTrendBars .kpp-level-warning .trend-stock-status{background:#fef3c7!important;color:#a16207!important}#stockTrendBars .kpp-level-safe .trend-stock-status{background:#dcfce7!important;color:#15803d!important}#stockTrendBars .kpp-level-high .trend-stock-status{background:#dbeafe!important;color:#1d4ed8!important}

      #usageTrendBars.usage-bars{display:block!important;height:auto!important;min-height:0!important;padding:4px 0 0!important;border:0!important;overflow:visible!important}.kpp-usage-day-grid{display:grid;grid-template-columns:repeat(5,minmax(100px,1fr));gap:9px}.kpp-usage-day-card{min-height:150px;padding:9px 8px 8px;border:1px solid #dbe7f3;border-radius:14px;background:linear-gradient(180deg,#fff,#fbfdff);display:flex;flex-direction:column;align-items:center;overflow:hidden}.kpp-usage-day-card.is-latest{border-color:#60a5fa;box-shadow:0 6px 16px rgba(37,99,235,.11)}.kpp-usage-date{font-size:9px;font-weight:900;color:var(--cc-navy)}.kpp-usage-liter{font-size:11px;font-weight:900;color:var(--cc-navy);margin-top:4px;white-space:nowrap}.kpp-usage-delta{margin-top:3px;min-height:16px;padding:2px 6px;border-radius:999px;font-size:7px;font-weight:900;line-height:12px}.kpp-usage-delta.up{background:#fee2e2;color:#b91c1c}.kpp-usage-delta.down{background:#dcfce7;color:#166534}.kpp-usage-delta.flat{background:#f1f5f9;color:#64748b}.kpp-usage-delta.start{background:#eff6ff;color:#2563eb}.kpp-usage-chartbox{position:relative;width:100%;height:78px;margin-top:auto;border-bottom:1px solid #cbd5e1;display:flex;align-items:flex-end;justify-content:center;padding:0 9px}.kpp-usage-chartbox::before,.kpp-usage-chartbox::after{content:"";position:absolute;left:6px;right:6px;height:1px;background:#eef2f7}.kpp-usage-chartbox::before{top:26px}.kpp-usage-chartbox::after{top:51px}.kpp-usage-column{position:relative;z-index:1;width:min(34px,70%);height:var(--bar-h,55%);min-height:8px;border-radius:7px 7px 2px 2px;background:linear-gradient(180deg,#60a5fa,#2563eb);box-shadow:0 4px 10px rgba(37,99,235,.15)}.kpp-usage-caption{font-size:7px;color:#64748b;font-weight:800;margin-top:4px}

      .kpp-cc-side-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:9px}.kpp-cc-side-card-title{font-size:13px;font-weight:900;color:var(--cc-navy)}.kpp-cc-side-card-sub{font-size:8px;color:#64748b;margin-top:2px}.kpp-cc-side-link{font-size:8px;font-weight:900;color:#2563eb;text-decoration:none;white-space:nowrap;padding:5px 7px;border-radius:8px;background:#eff6ff}
      .kpp-storage-list{display:grid;gap:7px}.kpp-storage-row{display:grid;grid-template-columns:minmax(74px,.9fr) minmax(70px,.8fr) minmax(90px,1.2fr) 38px;gap:7px;align-items:center;padding:6px 0;border-bottom:1px solid #eef2f7}.kpp-storage-row:last-child{border-bottom:0}.kpp-storage-name{font-size:9px;font-weight:900;color:var(--cc-navy)}.kpp-storage-wh{display:block;font-size:7px;color:#64748b;font-weight:700;margin-top:1px}.kpp-storage-liter{font-size:8px;font-weight:800;color:#334155;white-space:nowrap}.kpp-storage-track{height:8px;border-radius:999px;background:#e7edf5;overflow:hidden}.kpp-storage-fill{height:100%;border-radius:999px;background:#16a34a}.kpp-storage-fill.warning{background:#f59e0b}.kpp-storage-fill.low{background:#f97316}.kpp-storage-fill.critical{background:#ef4444}.kpp-storage-fill.high{background:#2563eb}.kpp-storage-level{font-size:7px;font-weight:900;text-align:center;padding:3px 4px;border-radius:999px;background:#dcfce7;color:#15803d}.kpp-storage-level.warning{background:#fef3c7;color:#a16207}.kpp-storage-level.low{background:#ffedd5;color:#c2410c}.kpp-storage-level.critical{background:#fee2e2;color:#b91c1c}.kpp-storage-level.high{background:#dbeafe;color:#1d4ed8}.kpp-storage-empty{padding:13px 8px;text-align:center;color:#64748b;font-size:9px;border:1px dashed #cbd5e1;border-radius:10px}
      .kpp-activity-list{display:grid;gap:3px}.kpp-activity-row{display:grid;grid-template-columns:29px minmax(0,1fr) auto;gap:7px;align-items:center;padding:6px 0;border-bottom:1px solid #eef2f7}.kpp-activity-row:last-child{border-bottom:0}.kpp-activity-icon{width:29px;height:29px;border-radius:8px;display:grid;place-items:center;background:#dbeafe;color:#1d4ed8;font-size:13px}.kpp-activity-main{min-width:0}.kpp-activity-title{font-size:9px;font-weight:900;color:var(--cc-navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kpp-activity-meta{font-size:7px;color:#64748b;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kpp-activity-time{font-size:7px;color:#64748b;white-space:nowrap}
      .dashboard-workspace.${ROOT_CLASS} #dashboardFcChart,.dashboard-workspace.${ROOT_CLASS} .operations-grid{margin-top:12px}
      @media(max-width:1180px){#${KPI_ID}{grid-template-columns:repeat(3,minmax(0,1fr))}.kpp-performance-shell{grid-template-columns:minmax(0,1.65fr) minmax(260px,.9fr)}}@media(max-width:900px){#${KPI_ID}{grid-template-columns:repeat(2,minmax(0,1fr))}.kpp-performance-shell{grid-template-columns:1fr}.kpp-performance-side{grid-template-columns:1fr 1fr}}@media(max-width:700px){.dashboard-workspace.${ROOT_CLASS} .container{padding-left:8px!important;padding-right:8px!important}#stockTrendBars.usage-bars,.kpp-usage-day-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.kpp-performance-side{grid-template-columns:1fr}.kpp-cc-kpi-value{font-size:17px}.kpp-storage-row{grid-template-columns:minmax(72px,.9fr) minmax(70px,.8fr) minmax(80px,1fr) 36px}}@media(max-width:430px){#${KPI_ID}{grid-template-columns:1fr}.kpp-usage-day-card{min-height:142px}}
    `;
    document.head.appendChild(style);
  }

  function buildKpis(){
    let host=document.getElementById(KPI_ID);
    if(host)return host;
    const performance=document.querySelector(".performance-section");
    if(!performance)return null;
    host=document.createElement("div");host.id=KPI_ID;
    host.innerHTML=`<div class="kpp-cc-kpi stock"><div class="kpp-cc-kpi-icon">⛽</div><div class="kpp-cc-kpi-label">Total Stock (All WHS)</div><div class="kpp-cc-kpi-value" data-kpi="stock">0 L</div><div class="kpp-cc-kpi-foot" data-foot="stock">Menunggu posisi stock</div></div><div class="kpp-cc-kpi yesterday"><div class="kpp-cc-kpi-icon">▥</div><div class="kpp-cc-kpi-label">Pemakaian Kemarin</div><div class="kpp-cc-kpi-value" data-kpi="yesterday">0 L</div><div class="kpp-cc-kpi-foot" data-foot="yesterday">vs. hari sebelumnya</div></div><div class="kpp-cc-kpi mtd"><div class="kpp-cc-kpi-icon">▣</div><div class="kpp-cc-kpi-label">Usage MTD</div><div class="kpp-cc-kpi-value" data-kpi="mtd">0 L</div><div class="kpp-cc-kpi-foot" data-foot="mtd">periode berjalan</div></div><div class="kpp-cc-kpi avg"><div class="kpp-cc-kpi-icon">↗</div><div class="kpp-cc-kpi-label">Average MTD</div><div class="kpp-cc-kpi-value" data-kpi="avg">0 L/hari</div><div class="kpp-cc-kpi-foot" data-foot="avg">rata-rata harian</div></div><div class="kpp-cc-kpi ito"><div class="kpp-cc-kpi-icon">◷</div><div class="kpp-cc-kpi-label">ITO / Day of Cover</div><div class="kpp-cc-kpi-value" data-kpi="ito">0 hari</div><div class="kpp-cc-kpi-foot" data-foot="ito">stock ÷ pemakaian</div></div>`;
    performance.parentNode.insertBefore(host,performance);return host;
  }

  function footClass(value){
    const s=String(value||"").toUpperCase();
    if(s.includes("WASPADA"))return "warn";
    if(s.includes("KRITIS")||s.includes("RENDAH")||s.includes("▲"))return "bad";
    if(s.includes("AMAN")||s.includes("STABIL")||s.includes("▼"))return "good";
    return "";
  }

  function patchStockStatuses(){
    [...document.querySelectorAll("#stockTrendBars .stock-radial-item")].forEach(item=>{
      const pct=parseIdNumber(item.querySelector(".stock-trend-ring span")?.textContent)||0;
      const state=levelState(pct);item.classList.remove("kpp-level-critical","kpp-level-low","kpp-level-warning","kpp-level-safe","kpp-level-high");item.classList.add(`kpp-level-${state.key}`);
      const status=item.querySelector(".trend-stock-status");if(status&&status.textContent!==state.label)status.textContent=state.label;
    });
  }

  function syncKpis(){
    const host=buildKpis();if(!host)return;patchStockStatuses();
    const stockItems=[...document.querySelectorAll("#stockTrendBars .stock-radial-item")];const latest=stockItems.find(x=>x.classList.contains("is-latest"))||stockItems.at(-1);
    const set=(key,value,foot)=>{const v=host.querySelector(`[data-kpi="${key}"]`),f=host.querySelector(`[data-foot="${key}"]`);if(v&&v.textContent!==value)v.textContent=value;if(f&&foot){if(f.textContent!==foot)f.textContent=foot;f.className=`kpp-cc-kpi-foot ${footClass(foot)}`;}};
    if(latest){const liter=text(latest.querySelector(".trend-ring-liter"),"0 L"),pct=parseIdNumber(latest.querySelector(".stock-trend-ring span")?.textContent)||0,state=levelState(pct);set("stock",liter,`${nf1.format(pct)}% • ${state.label}`);}
    set("yesterday",text(document.getElementById("usageYesterday"),"0 L"),text(document.getElementById("usageTrendBadge"),"vs. hari sebelumnya"));
    set("mtd",text(document.getElementById("totalFuelMTD"),"0 L"),text(document.getElementById("mtdCompareBadge"),"periode berjalan"));
    set("avg",text(document.getElementById("avgMTD"),"0 L/hari"),text(document.getElementById("activeDays"),"rata-rata harian"));
    set("ito",text(document.getElementById("ito"),"0 hari"),"day of cover dari pemakaian kemarin");
  }

  function setupPerformance(){
    const performance=document.querySelector(".performance-section");if(!performance||performance.dataset.commandCenter==="2")return !!performance;
    const overview=performance.querySelector(".overview-grid"),stock=overview?.querySelector(".stock-trend-card"),usage=overview?.querySelector(".usage-card"),receipt=overview?.querySelector(".receipt-card");if(!overview||!stock||!usage||!receipt)return false;
    const h=performance.querySelector(":scope > .section-head h2"),k=performance.querySelector(":scope > .section-head .section-kicker");if(h)h.textContent="Monitoring Fuel 5 Hari";if(k)k.textContent="COMMAND CENTER";
    const ut=usage.querySelector(".overview-title"),us=usage.querySelector(".overview-sub");if(ut)ut.textContent="Pemakaian Fuel";if(us)us.textContent="Realisasi harian dan perubahan vs hari sebelumnya.";
    const shell=document.createElement("div"),main=document.createElement("div"),side=document.createElement("div");shell.className="kpp-performance-shell";main.className="kpp-performance-main";side.className="kpp-performance-side";
    const storage=document.createElement("div");storage.id=STORAGE_ID;storage.className="kpp-cc-side-card";storage.innerHTML=`<div class="kpp-cc-side-card-head"><div><div class="kpp-cc-side-card-title">Stock per Tanki / WH</div><div class="kpp-cc-side-card-sub">Posisi akhir H-1 per storage aktif</div></div><a class="kpp-cc-side-link" href="stock.html">Lihat Semua →</a></div><div class="kpp-storage-list"><div class="kpp-storage-empty">Memuat posisi storage...</div></div>`;
    const activity=document.createElement("div");activity.id=ACTIVITY_ID;activity.className="kpp-cc-side-card";activity.innerHTML=`<div class="kpp-cc-side-card-head"><div><div class="kpp-cc-side-card-title">Aktivitas Terbaru</div><div class="kpp-cc-side-card-sub">Transaksi pengisian terakhir</div></div><a class="kpp-cc-side-link" href="logsheet.html">Lihat Semua →</a></div><div class="kpp-activity-list"><div class="kpp-storage-empty">Memuat aktivitas...</div></div>`;
    main.append(stock,usage);side.append(storage,activity);shell.append(main,side);overview.replaceWith(shell);receipt.classList.add("kpp-performance-receipt");performance.append(receipt);performance.dataset.commandCenter="2";return true;
  }

  function patchUsage(){
    const host=document.getElementById("usageTrendBars");if(!host)return false;const source=[...host.querySelectorAll(".usage-radial-item")];if(!source.length)return false;
    const items=source.map(item=>({label:text(item.querySelector(".trend-radial-label"),"-"),liter:text(item.querySelector(".trend-ring-liter"),"0 L"),value:parseIdNumber(item.querySelector(".trend-ring-liter")?.textContent)})).filter(x=>Number.isFinite(x.value));if(!items.length)return false;
    const values=items.map(x=>x.value),min=Math.min(...values),max=Math.max(...values),span=Math.max(1,max-min);const grid=document.createElement("div");grid.className="kpp-usage-day-grid";
    grid.innerHTML=items.map((item,i)=>{const h=max===min?65:35+((item.value-min)/span)*60;let cls="start",delta="AWAL";if(i>0&&values[i-1]>0){const pct=((item.value-values[i-1])/values[i-1])*100;if(Math.abs(pct)<.05){cls="flat";delta="• STABIL";}else if(pct>0){cls="up";delta=`▲ ${nf1.format(Math.abs(pct))}%`;}else{cls="down";delta=`▼ ${nf1.format(Math.abs(pct))}%`;}}return `<div class="kpp-usage-day-card${i===items.length-1?" is-latest":""}"><div class="kpp-usage-date">${item.label}</div><div class="kpp-usage-liter">${item.liter}</div><div class="kpp-usage-delta ${cls}">${delta}</div><div class="kpp-usage-chartbox"><div class="kpp-usage-column" style="--bar-h:${h.toFixed(1)}%" title="${item.liter}"></div></div><div class="kpp-usage-caption">PEMAKAIAN</div></div>`;}).join("");
    host.replaceChildren(grid);return true;
  }

  function watchUsage(){
    const host=document.getElementById("usageTrendBars");if(!host)return false;usageObserver?.disconnect();usageObserver=new MutationObserver(()=>{if(host.querySelector(".usage-radial-item"))queueMicrotask(patchUsage);});usageObserver.observe(host,{childList:true,subtree:false});if(host.querySelector(".usage-radial-item"))patchUsage();return true;
  }

  function renderActivities(){
    const panel=document.getElementById(ACTIVITY_ID),tbody=document.getElementById("transactionTable");if(!panel||!tbody)return;const target=panel.querySelector(".kpp-activity-list"),rows=[...tbody.querySelectorAll("tr")].slice(0,5);if(!rows.length){target.innerHTML='<div class="kpp-storage-empty">Belum ada transaksi terbaru.</div>';return;}
    target.innerHTML=rows.map(row=>{const c=[...row.querySelectorAll("td")].map(td=>text(td,"-"));return `<div class="kpp-activity-row"><div class="kpp-activity-icon">⛽</div><div class="kpp-activity-main"><div class="kpp-activity-title">Pengisian • ${c[3]||"-"}</div><div class="kpp-activity-meta">${c[11]||"-"} L • Shift ${c[13]||"-"} • ${c[6]||"-"}</div></div><div class="kpp-activity-time">${c[2]||c[1]||"-"}</div></div>`;}).join("");
  }

  function watchActivities(){const tbody=document.getElementById("transactionTable");if(!tbody)return false;activityObserver?.disconnect();activityObserver=new MutationObserver(renderActivities);activityObserver.observe(tbody,{childList:true});renderActivities();return true;}

  function sourceForFuel(row,storageRows){const direct=String(row?.fuel_truck||"").trim().toUpperCase();if(direct&&storageRows.some(s=>s.storage_type==="FT"&&s.code===direct))return direct;const wh=window.KPPStorage.normalizeWarehouse(row?.wh);return storageRows.find(s=>s.storage_type==="FT"&&window.KPPStorage.whCode(s)===wh)?.code||"";}
  async function hasShiftData(db,tanggal,shift){const tables=["stock_opening","stock_movements","fuel_history","stock_closing"];const results=await Promise.all(tables.map(t=>db.from(t).select("id").eq("tanggal",tanggal).eq("shift",shift).limit(1)));const err=results.find(r=>r.error)?.error;if(err)throw err;return results.some(r=>(r.data||[]).length>0);}
  async function calculateStorageSnapshot(tanggal){const db=window.KPP?.db;if(!db||!window.KPPStorage)throw new Error("Database/storage helper belum siap");const storageRows=await window.KPPStorage.load(db,{activeOnly:true});const shift=await hasShiftData(db,tanggal,2)?2:1;const [o,m,f,c]=await Promise.all([db.from("stock_opening").select("storage,qty").eq("tanggal",tanggal).eq("shift",shift),db.from("stock_movements").select("jenis,qty,source_storage,destination_storage,source_measured_qty,destination_measured_qty").eq("tanggal",tanggal).eq("shift",shift),db.from("fuel_history").select("fuel,fuel_truck,wh").eq("tanggal",tanggal).eq("shift",shift),db.from("stock_closing").select("storage,actual_qty").eq("tanggal",tanggal).eq("shift",shift)]);const err=o.error||m.error||f.error||c.error;if(err)throw err;const stock=Object.fromEntries(storageRows.map(r=>[r.code,0]));(o.data||[]).forEach(r=>{if(r.storage in stock)stock[r.storage]=Number(r.qty)||0;});(m.data||[]).forEach(r=>{if(r.jenis==="RECEIPT"&&r.destination_storage in stock)stock[r.destination_storage]+=Number(r.destination_measured_qty??r.qty)||0;if(r.jenis==="TRANSFER"){if(r.source_storage in stock)stock[r.source_storage]-=Number(r.source_measured_qty??r.qty)||0;if(r.destination_storage in stock)stock[r.destination_storage]+=Number(r.destination_measured_qty??r.qty)||0;}});(f.data||[]).forEach(r=>{const s=sourceForFuel(r,storageRows);if(s in stock)stock[s]-=Number(r.fuel)||0;});(c.data||[]).forEach(r=>{if(r.storage in stock&&r.actual_qty!==null&&r.actual_qty!==undefined)stock[r.storage]=Number(r.actual_qty)||0;});return {tanggal,shift,storageRows,stock};}

  function renderStorage(snapshot){const panel=document.getElementById(STORAGE_ID);if(!panel)return;const sub=panel.querySelector(".kpp-cc-side-card-sub");if(sub)sub.textContent=`Posisi ${snapshot.tanggal.split("-").reverse().join("/")} • Shift ${snapshot.shift}`;const list=panel.querySelector(".kpp-storage-list");list.innerHTML=snapshot.storageRows.map(row=>{const value=Number(snapshot.stock[row.code])||0,cap=Number(row.nominal_capacity_liter)||0,pct=cap>0?clampPct(value/cap*100):0,state=levelState(pct),wh=row.storage_type==="FT"?(window.KPPStorage.whCode(row)||""):"";return `<div class="kpp-storage-row"><div class="kpp-storage-name">${row.code}${wh?`<span class="kpp-storage-wh">${wh}</span>`:""}</div><div class="kpp-storage-liter">${nf1.format(value)} L</div><div class="kpp-storage-track" title="Kapasitas ${nf0.format(cap)} L"><div class="kpp-storage-fill ${state.key}" style="width:${pct.toFixed(1)}%"></div></div><div class="kpp-storage-level ${state.key}">${nf0.format(pct)}%</div></div>`;}).join("")||'<div class="kpp-storage-empty">Master storage aktif belum tersedia.</div>';}

  async function loadStorage(force=false){const panel=document.getElementById(STORAGE_ID);if(!panel||storageBusy)return;const today=window.KPPTime?.localDate?.();if(!today)return;const tanggal=window.KPPTime.addDays(today,-1);if(!force&&storageLoadedFor===tanggal)return;storageBusy=true;try{const snapshot=await calculateStorageSnapshot(tanggal);renderStorage(snapshot);storageLoadedFor=tanggal;}catch(err){const list=panel.querySelector(".kpp-storage-list");if(list)list.innerHTML=`<div class="kpp-storage-empty">Gagal membaca posisi storage: ${String(err?.message||err)}</div>`;}finally{storageBusy=false;}}

  function watchSources(){const targets=["stockTrendBars","stockTrendBadge","usageYesterday","usageTrendBadge","totalFuelMTD","mtdCompareBadge","avgMTD","activeDays","ito"].map(id=>document.getElementById(id)).filter(Boolean);if(!targets.length)return false;sourceObserver?.disconnect();sourceObserver=new MutationObserver(()=>syncKpis());targets.forEach(el=>sourceObserver.observe(el,{childList:true,subtree:true,characterData:true}));return true;}

  function install(){injectStyle();document.body?.classList.add(ROOT_CLASS);if(!setupPerformance())return false;buildKpis();watchUsage();watchActivities();watchSources();syncKpis();loadStorage(false);const refresh=document.getElementById("refreshBtn");if(refresh&&refresh.dataset.ccV2!=="1"){refresh.dataset.ccV2="1";refresh.addEventListener("click",()=>{storageLoadedFor="";setTimeout(()=>loadStorage(true),500);});}return true;}

  let attempts=0;const timer=setInterval(()=>{attempts++;if(install()||attempts>=180)clearInterval(timer);},100);document.addEventListener("DOMContentLoaded",install,{once:true});
})();
