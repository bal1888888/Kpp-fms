// KPP-FMS dashboard presentation layout v1
// Locks the dashboard information hierarchy to the approved mockup while leaving the existing left sidebar untouched.
(() => {
  "use strict";

  const STYLE_ID="kppDashboardPresentationV1Style";
  const ROOT_CLASS="kpp-presentation-v1";
  const BOTTOM_ID="kppPresentationBottom";
  const FC_CARD_ID="kppPresentationFcTrend";
  const FC_SUMMARY_ID="kppPresentationFcSummary";
  const SHIFT_ID="kppPresentationShift";
  const RECEIPT_ID="kppPresentationReceipt";

  let storageObserver=null;
  let receiptObserver=null;
  let fcObserver=null;
  let shiftObserver=null;
  let rafToken=0;

  const esc=(value)=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

  function parseIdNumber(value){
    const raw=String(value??"").replace(/L\/hari|hari|L|%/gi,"").trim();
    if(!raw)return 0;
    const clean=raw.replace(/[^0-9,.-]/g,"");
    let normalized=clean;
    if(clean.includes(","))normalized=clean.replace(/\./g,"").replace(",",".");
    else if(/^[-+]?\d{1,3}(?:\.\d{3})+$/.test(clean))normalized=clean.replace(/\./g,"");
    const n=Number(normalized);
    return Number.isFinite(n)?n:0;
  }

  function fmt0(value){return new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Number(value)||0);}
  function fmt1(value){return new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(value)||0);}

  function tankSvg(){
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v2h1.5A1.5 1.5 0 0 1 20 7.5v11A1.5 1.5 0 0 1 18.5 20h-13A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H7V4Zm1.5 2v2h7V6h-7Zm-1 5v6h9v-6h-9Zm1.5 1.5h6v3H9v-3Z" fill="currentColor"/><path d="M3 20.5h18V22H3z" fill="currentColor"/></svg>`;
  }

  function truckSvg(){
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h11v10h1.2l1.5-4H20l2 3v4h-1.2a3 3 0 0 1-5.6 0H9.8a3 3 0 0 1-5.6 0H3V5Zm2 2v8h8V7H5Zm11 6-.8 2H20v-.4L18.9 13H16ZM7 16.5A1.5 1.5 0 1 0 7 19.5a1.5 1.5 0 0 0 0-3Zm11 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z" fill="currentColor"/></svg>`;
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .dashboard-workspace.${ROOT_CLASS}{--pv-navy:#0b2f61;--pv-blue:#226fe8;--pv-green:#17b567;--pv-line:#dbe7f3;--pv-soft:#f5f9fd}
      .dashboard-workspace.${ROOT_CLASS} .kpp-performance-shell{display:grid!important;grid-template-columns:minmax(0,2.45fr) minmax(320px,1fr)!important;grid-template-areas:"stock storage" "usage activity"!important;gap:12px!important;align-items:stretch!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-performance-main,.dashboard-workspace.${ROOT_CLASS} .kpp-performance-side{display:contents!important}
      .dashboard-workspace.${ROOT_CLASS} .stock-trend-card{grid-area:stock!important;margin:0!important;min-width:0!important}
      .dashboard-workspace.${ROOT_CLASS} .usage-card{grid-area:usage!important;margin:0!important;min-width:0!important}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot{grid-area:storage!important;margin:0!important;min-width:0!important}
      .dashboard-workspace.${ROOT_CLASS} #kppActivitySnapshot{grid-area:activity!important;margin:0!important;min-width:0!important}
      .dashboard-workspace.${ROOT_CLASS} .stock-trend-card,.dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot{min-height:292px!important;height:100%!important}
      .dashboard-workspace.${ROOT_CLASS} .usage-card,.dashboard-workspace.${ROOT_CLASS} #kppActivitySnapshot{min-height:236px!important;height:100%!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-performance-receipt{display:none!important}

      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot{padding:13px 12px 10px!important;overflow:hidden!important}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot .kpp-cc-side-card-sub{display:none!important}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageColumnHead{grid-template-columns:minmax(118px,1.15fr) minmax(74px,.72fr) minmax(102px,1fr) 43px!important;gap:8px!important;padding:6px 2px 7px!important}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot .kpp-storage-row{grid-template-columns:minmax(118px,1.15fr) minmax(74px,.72fr) minmax(102px,1fr) 43px!important;gap:8px!important;padding:7px 2px!important;min-width:0!important}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot .kpp-storage-name{display:grid!important;grid-template-columns:27px minmax(0,1fr)!important;grid-template-rows:auto auto!important;column-gap:7px!important;align-items:center!important;min-width:0!important;line-height:1.05!important}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot .kpp-storage-visual{grid-row:1/3;width:27px;height:27px;border-radius:8px;display:grid;place-items:center;background:#eef5ff;color:#164da8;flex:0 0 auto}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot .kpp-storage-visual svg{width:18px;height:18px;display:block}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot .kpp-storage-code{grid-column:2;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;font-weight:950;color:#0b2f61}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot .kpp-storage-wh{grid-column:2!important;display:block!important;margin:2px 0 0!important;font-size:7px!important;color:#64748b!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot .kpp-storage-liter{font-size:8px!important;font-weight:900!important;color:#0f2748!important;overflow:hidden;text-overflow:ellipsis}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot .kpp-storage-track{height:9px!important}
      .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot .kpp-storage-level{font-size:7px!important;padding:4px 3px!important}

      #${BOTTOM_ID}{display:grid;grid-template-columns:minmax(0,1.8fr) minmax(220px,1fr) minmax(220px,.9fr) minmax(260px,1.18fr);gap:12px;margin:12px 0 0;align-items:stretch}
      #${BOTTOM_ID} .kpp-pv-card{min-width:0;background:#fff;border:1px solid var(--pv-line);border-radius:15px;box-shadow:0 5px 16px rgba(39,82,126,.055);padding:12px;overflow:hidden}
      #${BOTTOM_ID} .kpp-pv-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px;min-height:30px}
      #${BOTTOM_ID} .kpp-pv-titlewrap{display:flex;align-items:center;gap:8px;min-width:0}
      #${BOTTOM_ID} .kpp-pv-icon{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:linear-gradient(145deg,#2f78ee,#1e5bc4);color:#fff;font-size:14px;font-weight:900;flex:0 0 auto}
      #${BOTTOM_ID} .kpp-pv-title{font-size:12px;font-weight:950;color:var(--pv-navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${BOTTOM_ID} .kpp-pv-link{border:1px solid #dbeafe;background:#eff6ff;color:#1d4ed8;border-radius:8px;padding:5px 7px;font-size:7px;font-weight:900;cursor:pointer;white-space:nowrap}

      #${FC_CARD_ID} .kpp-pv-fc-chart{height:126px;overflow:hidden;border-top:1px solid #edf2f7;padding-top:5px}
      #${FC_CARD_ID} .kpp-pv-fc-chart svg{display:block;width:100%!important;min-width:0!important;height:120px!important}
      #${FC_CARD_ID} .kpp-pv-empty{height:120px;display:grid;place-items:center;color:#64748b;font-size:8px;background:#f8fafc;border-radius:9px}
      #${FC_CARD_ID} .kpp-pv-fc-meta{display:flex;gap:6px;align-items:center;color:#64748b;font-size:7px;font-weight:800}
      #${FC_CARD_ID} .kpp-pv-dot{width:7px;height:7px;border-radius:50%;background:#2563eb}

      #${FC_SUMMARY_ID} .kpp-pv-summary{display:grid;gap:0;border:1px solid #e7eef6;border-radius:10px;overflow:hidden}
      #${FC_SUMMARY_ID} .kpp-pv-summary-row{display:grid;grid-template-columns:minmax(0,1fr) 72px;gap:8px;align-items:center;padding:7px 9px;border-bottom:1px solid #eef2f7;font-size:8px}
      #${FC_SUMMARY_ID} .kpp-pv-summary-row:last-child{border-bottom:0}
      #${FC_SUMMARY_ID} .kpp-pv-summary-row.head{background:#f5f8fc;color:#64748b;font-weight:900;text-transform:uppercase;font-size:7px}
      #${FC_SUMMARY_ID} .kpp-pv-summary-unit{font-weight:900;color:#0f2748;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      #${FC_SUMMARY_ID} .kpp-pv-summary-fc{text-align:right;font-weight:950;color:#0b2f61}

      #${SHIFT_ID} .kpp-pv-shift-body{display:grid;grid-template-columns:96px minmax(0,1fr);gap:10px;align-items:center;min-height:132px}
      #${SHIFT_ID} .kpp-pv-shift-ring{width:92px;height:92px;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(#1d73eb 0 var(--s1),#19b867 var(--s1) 100%)}
      #${SHIFT_ID} .kpp-pv-shift-ring::before{content:"";position:absolute;inset:17px;border-radius:50%;background:#fff}
      #${SHIFT_ID} .kpp-pv-shift-ring strong{position:relative;z-index:1;font-size:11px;color:#0b2f61;text-align:center;line-height:1.05}
      #${SHIFT_ID} .kpp-pv-shift-ring small{display:block;font-size:6px;color:#64748b;margin-top:3px}
      #${SHIFT_ID} .kpp-pv-shift-list{display:grid;gap:9px}
      #${SHIFT_ID} .kpp-pv-shift-row{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:6px;align-items:center;font-size:8px;color:#475569}
      #${SHIFT_ID} .kpp-pv-shift-dot{width:8px;height:8px;border-radius:50%}
      #${SHIFT_ID} .kpp-pv-shift-dot.s1{background:#1d73eb}#${SHIFT_ID} .kpp-pv-shift-dot.s2{background:#19b867}
      #${SHIFT_ID} .kpp-pv-shift-value{font-weight:950;color:#0b2f61;white-space:nowrap}

      #${RECEIPT_ID} .kpp-pv-receipt-top{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:3px 0 9px;border-bottom:1px solid #edf2f7;margin-bottom:6px}
      #${RECEIPT_ID} .kpp-pv-receipt-label{font-size:7px;color:#64748b;font-weight:800}
      #${RECEIPT_ID} .kpp-pv-receipt-total{font-size:16px;line-height:1;font-weight:950;color:#0b2f61;margin-top:3px;white-space:nowrap}
      #${RECEIPT_ID} .kpp-pv-receipt-delta{font-size:7px;font-weight:900;color:#15803d;background:#dcfce7;border-radius:999px;padding:4px 6px;white-space:nowrap}
      #${RECEIPT_ID} .kpp-pv-receipt-list{display:grid;gap:5px}
      #${RECEIPT_ID} .kpp-pv-receipt-row{display:grid;grid-template-columns:60px minmax(45px,1fr) 62px 38px;gap:6px;align-items:center;font-size:7px}
      #${RECEIPT_ID} .kpp-pv-receipt-company{font-weight:900;color:#0f2748;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #${RECEIPT_ID} .kpp-pv-receipt-track{height:6px;border-radius:999px;background:#e8eef6;overflow:hidden}
      #${RECEIPT_ID} .kpp-pv-receipt-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#3b82f6,#1d6ee8)}
      #${RECEIPT_ID} .kpp-pv-receipt-value{text-align:right;font-weight:900;color:#0b2f61;white-space:nowrap}
      #${RECEIPT_ID} .kpp-pv-receipt-pct{text-align:right;font-weight:900;color:#2563eb;white-space:nowrap}

      .dashboard-workspace.${ROOT_CLASS} #dashboardFcChart{display:none!important;margin-top:12px!important}
      .dashboard-workspace.${ROOT_CLASS}[data-fc-detail="open"] #dashboardFcChart{display:block!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid{display:block!important;margin-top:12px!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:first-child{display:none!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:nth-child(2){padding:13px!important;margin-bottom:12px!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:nth-child(2) .section-head{margin-bottom:9px!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:nth-child(2) .session-grid{grid-template-columns:repeat(3,minmax(190px,1fr))!important;gap:8px!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:nth-child(2) .session-card{padding:11px!important}

      @media(max-width:1180px){
        .dashboard-workspace.${ROOT_CLASS} .kpp-performance-shell{grid-template-columns:minmax(0,1.9fr) minmax(295px,1fr)!important}
        #${BOTTOM_ID}{grid-template-columns:1.6fr 1fr 1fr!important}
        #${RECEIPT_ID}{grid-column:2/4!important}
      }
      @media(max-width:900px){
        .dashboard-workspace.${ROOT_CLASS} .kpp-performance-shell{grid-template-columns:1fr!important;grid-template-areas:"stock" "storage" "usage" "activity"!important}
        .dashboard-workspace.${ROOT_CLASS} .stock-trend-card,.dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot,.dashboard-workspace.${ROOT_CLASS} .usage-card,.dashboard-workspace.${ROOT_CLASS} #kppActivitySnapshot{min-height:0!important}
        #${BOTTOM_ID}{grid-template-columns:1fr 1fr!important}
        #${FC_CARD_ID}{grid-column:1/-1!important}
        #${RECEIPT_ID}{grid-column:auto!important}
        .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:nth-child(2) .session-grid{grid-template-columns:1fr 1fr!important}
      }
      @media(max-width:640px){
        #${BOTTOM_ID}{grid-template-columns:1fr!important}
        #${FC_CARD_ID},#${FC_SUMMARY_ID},#${SHIFT_ID},#${RECEIPT_ID}{grid-column:auto!important}
        .dashboard-workspace.${ROOT_CLASS} #kppStorageColumnHead{grid-template-columns:minmax(108px,1.05fr) minmax(68px,.68fr) minmax(78px,.86fr) 40px!important}
        .dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot .kpp-storage-row{grid-template-columns:minmax(108px,1.05fr) minmax(68px,.68fr) minmax(78px,.86fr) 40px!important}
        .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:nth-child(2) .session-grid{grid-template-columns:1fr!important}
      }
    `;
    document.head.appendChild(style);
  }

  function patchStorageIcons(){
    const rows=[...document.querySelectorAll("#kppStorageSnapshot .kpp-storage-row")];
    rows.forEach(row=>{
      const name=row.querySelector(".kpp-storage-name");
      if(!name||name.dataset.visualReady==="1")return;
      const code=(name.childNodes[0]?.textContent||name.textContent||"").trim().toUpperCase();
      const wh=name.querySelector(".kpp-storage-wh");
      const whHtml=wh?wh.outerHTML:"";
      const isFt=code.startsWith("FT");
      name.innerHTML=`<span class="kpp-storage-visual ${isFt?"ft":"tank"}">${isFt?truckSvg():tankSvg()}</span><span class="kpp-storage-code">${esc(code)}</span>${whHtml}`;
      name.dataset.visualReady="1";
    });
  }

  function ensureBottom(){
    let grid=document.getElementById(BOTTOM_ID);
    if(grid)return grid;
    const performance=document.querySelector(".performance-section");
    if(!performance)return null;
    grid=document.createElement("div");
    grid.id=BOTTOM_ID;
    grid.innerHTML=`
      <section id="${FC_CARD_ID}" class="kpp-pv-card">
        <div class="kpp-pv-head"><div class="kpp-pv-titlewrap"><span class="kpp-pv-icon">↗</span><div><div class="kpp-pv-title">Trend FC Harian per Unit (L/HM)</div><div class="kpp-pv-fc-meta"><span class="kpp-pv-dot"></span><span data-fc-unit>Menunggu data</span></div></div></div><button class="kpp-pv-link" type="button" data-action="fc-detail">Detail</button></div>
        <div class="kpp-pv-fc-chart"><div class="kpp-pv-empty">Memuat trend FC...</div></div>
      </section>
      <section id="${FC_SUMMARY_ID}" class="kpp-pv-card">
        <div class="kpp-pv-head"><div class="kpp-pv-titlewrap"><span class="kpp-pv-icon">▧</span><div class="kpp-pv-title">Ringkasan FC per Unit</div></div></div>
        <div class="kpp-pv-summary"><div class="kpp-pv-summary-row head"><span>UNIT</span><span>FC AVG</span></div><div class="kpp-pv-summary-row"><span class="kpp-pv-summary-unit">Memuat...</span><span class="kpp-pv-summary-fc">-</span></div></div>
      </section>
      <section id="${SHIFT_ID}" class="kpp-pv-card">
        <div class="kpp-pv-head"><div class="kpp-pv-titlewrap"><span class="kpp-pv-icon">◔</span><div class="kpp-pv-title">Distribusi per Shift</div></div></div>
        <div class="kpp-pv-shift-body"><div class="kpp-pv-shift-ring" style="--s1:50%"><strong><span data-shift-total>0 L</span><small>Total</small></strong></div><div class="kpp-pv-shift-list"></div></div>
      </section>
      <section id="${RECEIPT_ID}" class="kpp-pv-card">
        <div class="kpp-pv-head"><div class="kpp-pv-titlewrap"><span class="kpp-pv-icon">▰</span><div class="kpp-pv-title">Penerimaan per Transportir</div></div><span class="kpp-pv-link">MTD</span></div>
        <div class="kpp-pv-receipt-top"><div><div class="kpp-pv-receipt-label">Total Penerimaan MTD</div><div class="kpp-pv-receipt-total" data-receipt-total>0 L</div></div><div class="kpp-pv-receipt-delta">Periode berjalan</div></div>
        <div class="kpp-pv-receipt-list"></div>
      </section>`;
    performance.insertAdjacentElement("afterend",grid);
    grid.querySelector('[data-action="fc-detail"]')?.addEventListener("click",()=>{
      const root=document.querySelector(".dashboard-workspace");
      const open=root?.dataset.fcDetail==="open";
      if(root)root.dataset.fcDetail=open?"closed":"open";
      const btn=grid.querySelector('[data-action="fc-detail"]');
      if(btn)btn.textContent=open?"Detail":"Tutup";
      if(!open)document.getElementById("dashboardFcChart")?.scrollIntoView({behavior:"smooth",block:"start"});
    });
    return grid;
  }

  function syncReceipt(){
    const card=document.getElementById(RECEIPT_ID);if(!card)return;
    const total=parseIdNumber(document.getElementById("receiptMTDTotal")?.textContent);
    const totalEl=card.querySelector("[data-receipt-total]");if(totalEl)totalEl.textContent=`${fmt1(total)} L`;
    const rows=[...document.querySelectorAll("#receiptTransporterBars .receipt-row")].slice(0,4).map(row=>({
      company:String(row.querySelector(".receipt-company")?.textContent||"-").trim(),
      qty:parseIdNumber(row.querySelector(".receipt-value")?.textContent)
    }));
    const list=card.querySelector(".kpp-pv-receipt-list");if(!list)return;
    if(!rows.length){list.innerHTML='<div class="kpp-pv-empty">Belum ada penerimaan.</div>';return;}
    const max=Math.max(...rows.map(r=>r.qty),1);
    list.innerHTML=rows.map(r=>{
      const pct=total>0?r.qty/total*100:0;
      const width=Math.max(r.qty>0?5:0,r.qty/max*100);
      return `<div class="kpp-pv-receipt-row"><span class="kpp-pv-receipt-company" title="${esc(r.company)}">${esc(r.company)}</span><span class="kpp-pv-receipt-track"><span class="kpp-pv-receipt-fill" style="display:block;width:${width.toFixed(1)}%"></span></span><span class="kpp-pv-receipt-value">${fmt0(r.qty)}</span><span class="kpp-pv-receipt-pct">${fmt1(pct)}%</span></div>`;
    }).join("");
  }

  function syncShift(){
    const card=document.getElementById(SHIFT_ID);if(!card)return;
    const s1=parseIdNumber(document.getElementById("shift1Fuel")?.textContent);
    const s2=parseIdNumber(document.getElementById("shift2Fuel")?.textContent);
    const total=s1+s2;
    const p1=total>0?s1/total*100:50;
    const ring=card.querySelector(".kpp-pv-shift-ring");if(ring)ring.style.setProperty("--s1",`${p1.toFixed(1)}%`);
    const totalEl=card.querySelector("[data-shift-total]");if(totalEl)totalEl.textContent=`${fmt0(total)} L`;
    const list=card.querySelector(".kpp-pv-shift-list");if(list)list.innerHTML=`
      <div class="kpp-pv-shift-row"><span class="kpp-pv-shift-dot s1"></span><span>Shift 1</span><span class="kpp-pv-shift-value">${fmt0(s1)} L</span></div>
      <div class="kpp-pv-shift-row"><span class="kpp-pv-shift-dot s2"></span><span>Shift 2</span><span class="kpp-pv-shift-value">${fmt0(s2)} L</span></div>
      <div class="kpp-pv-shift-row"><span></span><span>Kontribusi S1</span><span class="kpp-pv-shift-value">${fmt1(total>0?s1/total*100:0)}%</span></div>`;
  }

  function syncFc(){
    const trend=document.getElementById(FC_CARD_ID),summary=document.getElementById(FC_SUMMARY_ID);if(!trend||!summary)return;
    const srcSvg=document.querySelector("#dashboardFcChart .kpp-fc-chart svg");
    const chart=trend.querySelector(".kpp-pv-fc-chart");
    if(srcSvg&&chart){
      const clone=srcSvg.cloneNode(true);
      clone.removeAttribute("width");clone.removeAttribute("height");
      chart.replaceChildren(clone);
    }
    const legendUnit=document.querySelector("#dashboardFcChart .kpp-fc-legend-item[data-unit]")?.getAttribute("data-unit")||document.querySelector("#dashboardFcChart .kpp-fc-legend-item")?.textContent?.trim()||"FC unit";
    const unitEl=trend.querySelector("[data-fc-unit]");if(unitEl)unitEl.textContent=legendUnit;

    const tableRows=[...document.querySelectorAll("#dashboardFcChart .kpp-fc-summary-table tbody tr")].slice(0,5);
    const box=summary.querySelector(".kpp-pv-summary");if(!box)return;
    if(!tableRows.length){
      box.innerHTML='<div class="kpp-pv-summary-row head"><span>UNIT</span><span>FC AVG</span></div><div class="kpp-pv-summary-row"><span class="kpp-pv-summary-unit">Belum ada data</span><span class="kpp-pv-summary-fc">-</span></div>';
      return;
    }
    box.innerHTML='<div class="kpp-pv-summary-row head"><span>UNIT</span><span>FC AVG (L/HM)</span></div>'+tableRows.map(row=>{
      const cells=[...row.querySelectorAll("td")].map(td=>td.textContent.trim());
      return `<div class="kpp-pv-summary-row"><span class="kpp-pv-summary-unit">${esc(cells[0]||"-")}</span><span class="kpp-pv-summary-fc">${esc(cells[1]||"-")}</span></div>`;
    }).join("");
  }

  function scheduleSync(){
    if(rafToken)return;
    rafToken=requestAnimationFrame(()=>{rafToken=0;patchStorageIcons();syncReceipt();syncShift();syncFc();});
  }

  function attachObservers(){
    const storage=document.querySelector("#kppStorageSnapshot .kpp-storage-list");
    if(storage&&!storageObserver){storageObserver=new MutationObserver(scheduleSync);storageObserver.observe(storage,{childList:true});}
    const receipt=document.getElementById("receiptTransporterBars");
    if(receipt&&!receiptObserver){receiptObserver=new MutationObserver(scheduleSync);receiptObserver.observe(receipt,{childList:true});}
    const fc=document.getElementById("dashboardFcChart");
    if(fc&&!fcObserver){fcObserver=new MutationObserver(scheduleSync);fcObserver.observe(fc,{childList:true,subtree:true});}
    const s1=document.getElementById("shift1Fuel"),s2=document.getElementById("shift2Fuel");
    if(!shiftObserver&&(s1||s2)){
      shiftObserver=new MutationObserver(scheduleSync);
      [s1,s2].filter(Boolean).forEach(el=>shiftObserver.observe(el,{childList:true,subtree:true,characterData:true}));
    }
  }

  function install(){
    const root=document.querySelector(".dashboard-workspace");if(!root)return false;
    const shell=document.querySelector(".kpp-performance-shell");if(!shell)return false;
    root.classList.add(ROOT_CLASS);
    if(!root.dataset.fcDetail)root.dataset.fcDetail="closed";
    injectStyle();ensureBottom();patchStorageIcons();syncReceipt();syncShift();syncFc();attachObservers();
    return true;
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()&&document.querySelector("#kppStorageSnapshot .kpp-storage-row")&&document.getElementById(BOTTOM_ID))clearInterval(timer);
    else if(tries>=40)clearInterval(timer);
  },150);
})();
