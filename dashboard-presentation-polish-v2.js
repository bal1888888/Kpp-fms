// KPP-FMS dashboard presentation polish v2
(() => {
  "use strict";
  const STYLE_ID="kppDashboardPresentationPolishV2Style";
  const ROOT_CLASS="kpp-presentation-polish-v2";

  function style(){
    if(document.getElementById(STYLE_ID))return;
    const el=document.createElement("style");
    el.id=STYLE_ID;
    el.textContent=`
      .dashboard-workspace.${ROOT_CLASS}{--pv2-line:#dce7f2;background:radial-gradient(circle at 88% 3%,rgba(59,130,246,.055),transparent 27%),radial-gradient(circle at 12% 22%,rgba(34,197,94,.035),transparent 24%),linear-gradient(180deg,#f8fbfe 0%,#f3f7fb 52%,#f7fafe 100%)!important}
      .dashboard-workspace.${ROOT_CLASS} .container{width:100%!important;max-width:none!important;margin-left:0!important;margin-right:0!important;padding-left:10px!important;padding-right:10px!important;padding-bottom:26px!important}
      .dashboard-workspace.${ROOT_CLASS} .performance-section,.dashboard-workspace.${ROOT_CLASS} #dashboardFcChart,.dashboard-workspace.${ROOT_CLASS} .operations-grid,.dashboard-workspace.${ROOT_CLASS} .container>.section:last-child{width:100%!important;max-width:none!important}

      .dashboard-workspace.${ROOT_CLASS} .trend-badge.kpp-pv2-trend{display:inline-flex!important;align-items:center!important;gap:7px!important;min-height:34px!important;padding:6px 9px!important;border-radius:13px!important;border:1px solid transparent!important;box-shadow:none!important;line-height:1!important;white-space:nowrap!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-pv2-trend-icon{width:19px;height:19px;display:grid;place-items:center;flex:0 0 auto;font-size:16px;font-weight:950;line-height:1}
      .dashboard-workspace.${ROOT_CLASS} .kpp-pv2-trend-copy{display:flex;flex-direction:column;gap:2px;min-width:0;text-align:left}
      .dashboard-workspace.${ROOT_CLASS} .kpp-pv2-trend-copy strong{font-size:8px;font-weight:950;line-height:1.05}
      .dashboard-workspace.${ROOT_CLASS} .kpp-pv2-trend-copy small{font-size:6px;font-weight:800;line-height:1.1;opacity:.76}
      .dashboard-workspace.${ROOT_CLASS} .trend-badge.kpp-pv2-trend.good{background:#ecfdf3!important;color:#15803d!important;border-color:#c7f0d6!important}
      .dashboard-workspace.${ROOT_CLASS} .trend-badge.kpp-pv2-trend.bad{background:#fff1f2!important;color:#dc2626!important;border-color:#ffe0e3!important}
      .dashboard-workspace.${ROOT_CLASS} .trend-badge.kpp-pv2-trend.flat{background:#eff6ff!important;color:#2563eb!important;border-color:#dbeafe!important}

      .dashboard-workspace.${ROOT_CLASS} .stock-trend-card,.dashboard-workspace.${ROOT_CLASS} #kppStorageSnapshot{min-height:250px!important}
      .dashboard-workspace.${ROOT_CLASS} .usage-card,.dashboard-workspace.${ROOT_CLASS} #kppActivitySnapshot{min-height:218px!important}
      .dashboard-workspace.${ROOT_CLASS} .stock-trend-card,.dashboard-workspace.${ROOT_CLASS} .usage-card{padding:11px 12px 10px!important}
      .dashboard-workspace.${ROOT_CLASS} .stock-trend-card .overview-head,.dashboard-workspace.${ROOT_CLASS} .usage-card .overview-head{margin-bottom:7px!important}
      .dashboard-workspace.${ROOT_CLASS} #stockTrendBars.usage-bars{gap:7px!important;padding-top:0!important}
      .dashboard-workspace.${ROOT_CLASS} #stockTrendBars .stock-radial-item{min-height:166px!important;padding:9px 6px 8px!important;border-radius:12px!important}
      .dashboard-workspace.${ROOT_CLASS} #stockTrendBars .trend-radial-label{font-size:9px!important;margin-bottom:5px!important}
      .dashboard-workspace.${ROOT_CLASS} #stockTrendBars .stock-trend-ring{width:78px!important;box-shadow:0 4px 10px rgba(15,39,72,.055)!important}
      .dashboard-workspace.${ROOT_CLASS} #stockTrendBars .stock-trend-ring::before{inset:9px!important}
      .dashboard-workspace.${ROOT_CLASS} #stockTrendBars .stock-trend-ring span{font-size:12px!important}
      .dashboard-workspace.${ROOT_CLASS} #stockTrendBars .trend-ring-liter{font-size:9px!important;margin-top:6px!important}
      .dashboard-workspace.${ROOT_CLASS} #stockTrendBars .trend-stock-status{font-size:7px!important;min-height:18px!important;padding:2px 7px!important;margin-top:5px!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-usage-day-grid{gap:7px!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-usage-day-card{min-height:166px!important;padding:9px 6px 7px!important;border-radius:12px!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-usage-date{font-size:9px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-liter{font-size:11px!important;margin-top:3px!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-usage-delta{font-size:7px!important;min-height:16px!important;line-height:12px!important;margin-top:3px!important;padding:2px 6px!important}
      .dashboard-workspace.${ROOT_CLASS} .kpp-usage-chartbox{height:70px!important;margin-top:5px!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-column{width:min(32px,62%)!important;box-shadow:0 3px 8px rgba(37,104,220,.13)!important}.dashboard-workspace.${ROOT_CLASS} .kpp-usage-caption{font-size:6px!important}

      .dashboard-workspace.${ROOT_CLASS} #kppPresentationShift{display:none!important}
      .dashboard-workspace.${ROOT_CLASS} #kppPresentationBottom{grid-template-columns:minmax(0,1.75fr) minmax(220px,.9fr) minmax(260px,1.05fr)!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid{display:grid!important;grid-template-columns:minmax(360px,.82fr) minmax(0,1.18fr)!important;gap:0!important;align-items:stretch!important;margin-top:12px!important;border:1px solid var(--pv2-line)!important;border-radius:16px!important;background:rgba(255,255,255,.86)!important;box-shadow:0 5px 16px rgba(39,82,126,.045)!important;overflow:hidden!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section{display:block!important;min-width:0!important;height:100%!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important;background:transparent!important;padding:14px 18px!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:first-child{border-right:1px solid var(--pv2-line)!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section .section-head{margin-bottom:10px!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:first-child .shift-container{gap:10px!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:first-child .shift-card{padding:13px!important;min-height:96px!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:first-child .shift-icon{width:42px!important;height:42px!important;font-size:16px!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:first-child .shift-card h3{font-size:11px!important}.dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:first-child .shift-fuel{font-size:18px!important}
      .dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:nth-child(2) .session-grid{grid-template-columns:repeat(2,minmax(210px,1fr))!important;gap:9px!important}.dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:nth-child(2) .session-card{padding:11px!important}

      .dashboard-workspace.${ROOT_CLASS} .kpp-cc-kpi,.dashboard-workspace.${ROOT_CLASS} .overview-card,.dashboard-workspace.${ROOT_CLASS} .kpp-cc-side-card,.dashboard-workspace.${ROOT_CLASS} #kppPresentationBottom .kpp-pv-card,.dashboard-workspace.${ROOT_CLASS} .container>.section:last-child{box-shadow:0 5px 15px rgba(31,68,108,.045)!important}

      @media(max-width:1180px){.dashboard-workspace.${ROOT_CLASS} .operations-grid{grid-template-columns:1fr!important}.dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:first-child{border-right:0!important;border-bottom:1px solid var(--pv2-line)!important}.dashboard-workspace.${ROOT_CLASS} #kppPresentationBottom{grid-template-columns:minmax(0,1.5fr) minmax(210px,.85fr) minmax(240px,1fr)!important}}
      @media(max-width:900px){.dashboard-workspace.${ROOT_CLASS} #kppPresentationBottom{grid-template-columns:1fr 1fr!important}.dashboard-workspace.${ROOT_CLASS} #kppPresentationReceipt{grid-column:1/-1!important}}
      @media(max-width:700px){.dashboard-workspace.${ROOT_CLASS} .container{padding-left:7px!important;padding-right:7px!important}.dashboard-workspace.${ROOT_CLASS} #kppPresentationBottom{grid-template-columns:1fr!important}.dashboard-workspace.${ROOT_CLASS} #kppPresentationReceipt{grid-column:auto!important}.dashboard-workspace.${ROOT_CLASS} .operations-grid>.section{padding:12px!important}.dashboard-workspace.${ROOT_CLASS} .operations-grid>.section:nth-child(2) .session-grid{grid-template-columns:1fr!important}}
    `;
    document.head.appendChild(el);
  }

  function info(text,kind){
    const raw=String(text||"").replace(/\s+/g," ").trim();
    const match=raw.match(/([+-]?\d+(?:[.,]\d+)?)\s*%/);
    const value=match?Math.abs(Number(match[1].replace(",","."))||0):0;
    const lower=raw.toLowerCase();
    let dir="flat";
    if(/[▲↗]/.test(raw)||lower.includes("naik"))dir="up";
    else if(/[▼↘]/.test(raw)||lower.includes("turun"))dir="down";
    const good=dir==="flat"?null:(kind==="stock"?dir==="up":dir==="down");
    return {dir,value,good};
  }

  function decorate(el,kind){
    if(!el||el.querySelector(".kpp-pv2-trend-copy"))return;
    const i=info(el.textContent,kind);
    let title="Stabil",icon="•",tone="flat";
    if(i.dir==="up"){title=`Naik +${i.value.toLocaleString("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1})}%`;icon="↗";tone=i.good?"good":"bad";}
    if(i.dir==="down"){title=`Turun -${i.value.toLocaleString("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1})}%`;icon="↘";tone=i.good?"good":"bad";}
    el.className=`trend-badge kpp-pv2-trend ${tone}`;
    el.innerHTML=`<span class="kpp-pv2-trend-icon">${icon}</span><span class="kpp-pv2-trend-copy"><strong>${title}</strong><small>vs. hari sebelumnya</small></span>`;
  }

  function watch(id,kind){
    const el=document.getElementById(id);if(!el)return;
    decorate(el,kind);
    new MutationObserver(()=>decorate(el,kind)).observe(el,{childList:true,subtree:true,characterData:true});
  }

  const root=document.querySelector(".dashboard-workspace");
  if(!root)return;
  root.classList.add(ROOT_CLASS);
  style();
  watch("stockTrendBadge","stock");
  watch("usageTrendBadge","usage");
})();
