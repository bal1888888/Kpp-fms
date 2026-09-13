// KPP-FMS dashboard reference polish async guard v3
// Performance-safe stock visual/status synchronizer. Never observes the whole document.
(() => {
  "use strict";

  const STYLE_ID="kppDashboardReferenceGuardV3Style";
  const LEVEL_CLASSES=["kpp-level-critical","kpp-level-low","kpp-level-warning","kpp-level-safe","kpp-level-high"];
  let stockObserver=null;
  let watchedHost=null;
  let patchQueued=false;

  function parseId(value){
    const raw=String(value??"").replace(/L|%/gi,"").trim();
    if(!raw)return null;
    const clean=raw.replace(/[^0-9,.-]/g,"");
    let normalized=clean;
    if(clean.includes(","))normalized=clean.replace(/\./g,"").replace(",",".");
    else if(/^[-+]?\d{1,3}(?:\.\d{3})+$/.test(clean))normalized=clean.replace(/\./g,"");
    const n=Number(normalized);
    return Number.isFinite(n)?n:null;
  }

  function state(pct){
    const p=Number(pct)||0;
    if(p<20)return {key:"critical",label:"KRITIS"};
    if(p<35)return {key:"low",label:"RENDAH"};
    if(p<50)return {key:"warning",label:"WASPADA"};
    if(p>=90)return {key:"high",label:"TINGGI"};
    return {key:"safe",label:"AMAN"};
  }

  function fmt(value){
    return new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1}).format(Math.abs(Number(value)||0));
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .dashboard-workspace.kpp-reference-v3 .performance-section > .section-head{display:none!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-trend-ring{
        --trend-fill:#11a861;
        --trend-empty:#ef4444;
        overflow:hidden!important;
        background:conic-gradient(
          var(--trend-fill) 0 calc(var(--trend-pct)*1%),
          var(--trend-empty) calc(var(--trend-pct)*1%) 100%
        )!important;
      }
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-trend-ring span{color:#07883f!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .kpp-stock-delta{display:none!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-radial-item.kpp-level-warning .trend-stock-status{background:#fef3c7!important;color:#a16207!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-radial-item.kpp-level-low .trend-stock-status{background:#ffedd5!important;color:#c2410c!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-radial-item.kpp-level-critical .trend-stock-status{background:#fee2e2!important;color:#b91c1c!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-radial-item.kpp-level-safe .trend-stock-status{background:#dcfce7!important;color:#15803d!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-radial-item.kpp-level-high .trend-stock-status{background:#dbeafe!important;color:#1d4ed8!important}
      @media(max-width:760px){
        .dashboard-workspace.kpp-reference-v3 .kpp-cc-kpi,
        .dashboard-workspace.kpp-reference-v3 .overview-card,
        .dashboard-workspace.kpp-reference-v3 .kpp-cc-side-card{box-shadow:0 3px 10px rgba(39,82,126,.055)!important}
        .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-trend-ring,
        .dashboard-workspace.kpp-reference-v3 .kpp-usage-column{box-shadow:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function patchOverallBadge(host,items){
    const badge=document.getElementById("stockTrendBadge");
    if(!badge||!items.length)return;
    const latest=items.at(-1);
    const pct=parseId(latest.querySelector(".stock-trend-ring span")?.textContent)||0;
    const current=parseId(latest.querySelector(".trend-ring-liter")?.textContent)||0;
    const info=state(pct);
    let className="trend-badge flat";
    let label=`${fmt(pct)}% • ${info.label}`;

    if(items.length>1){
      const previous=parseId(items.at(-2).querySelector(".trend-ring-liter")?.textContent)||0;
      if(previous>0){
        const change=((current-previous)/previous)*100;
        if(Math.abs(change)<.05){
          label=`• Stabil ${fmt(pct)}% • ${info.label}`;
        }else if(change>0){
          className="trend-badge stock-up";
          label=`▲ ${fmt(change)}% • ${info.label}`;
        }else{
          className="trend-badge stock-down";
          label=`▼ ${fmt(change)}% • ${info.label}`;
        }
      }
    }

    if(badge.className!==className)badge.className=className;
    if(badge.textContent!==label)badge.textContent=label;
  }

  function patchStock(host=watchedHost){
    if(!host||!host.isConnected)return false;
    const items=[...host.querySelectorAll(".stock-radial-item")];
    if(!items.length)return false;

    items.forEach(item=>{
      const pct=parseId(item.querySelector(".stock-trend-ring span")?.textContent);
      if(!Number.isFinite(pct))return;
      const info=state(pct);
      const expectedLevel=`kpp-level-${info.key}`;

      if(!item.classList.contains(expectedLevel)){
        item.classList.remove(...LEVEL_CLASSES);
        item.classList.add(expectedLevel);
      }

      const status=item.querySelector(".trend-stock-status");
      if(status){
        const expectedClass=`trend-stock-status ${info.key}`;
        if(status.className!==expectedClass)status.className=expectedClass;
        if(status.textContent!==info.label)status.textContent=info.label;
      }
    });

    patchOverallBadge(host,items);
    return true;
  }

  function observeHost(host){
    if(!host)return false;
    if(watchedHost===host&&stockObserver)return true;

    stockObserver?.disconnect();
    watchedHost=host;
    stockObserver=new MutationObserver(()=>{
      if(patchQueued)return;
      patchQueued=true;
      queueMicrotask(()=>{
        patchQueued=false;
        if(!watchedHost?.isConnected)return;
        stockObserver?.disconnect();
        patchStock(watchedHost);
        stockObserver?.observe(watchedHost,{childList:true,subtree:true,characterData:true});
      });
    });
    stockObserver.observe(host,{childList:true,subtree:true,characterData:true});
    patchStock(host);
    return true;
  }

  function install(){
    injectStyle();
    return observeHost(document.getElementById("stockTrendBars"));
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();

  let tries=0;
  const timer=setInterval(()=>{
    tries+=1;
    if(install()||tries>=60)clearInterval(timer);
  },150);
})();
