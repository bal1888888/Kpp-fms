// KPP-FMS dashboard reference polish async guard v3
(() => {
  "use strict";

  const STYLE_ID="kppDashboardReferenceGuardV3Style";
  let stockObserver=null;
  let rootObserver=null;

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

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .dashboard-workspace.kpp-reference-v3 .performance-section > .section-head{display:none!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-radial-item.kpp-level-warning .trend-stock-status{background:#fef3c7!important;color:#a16207!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-radial-item.kpp-level-low .trend-stock-status{background:#ffedd5!important;color:#c2410c!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-radial-item.kpp-level-critical .trend-stock-status{background:#fee2e2!important;color:#b91c1c!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-radial-item.kpp-level-safe .trend-stock-status{background:#dcfce7!important;color:#15803d!important}
      .dashboard-workspace.kpp-reference-v3 #stockTrendBars .stock-radial-item.kpp-level-high .trend-stock-status{background:#dbeafe!important;color:#1d4ed8!important}
    `;
    document.head.appendChild(style);
  }

  function patchStock(){
    const host=document.getElementById("stockTrendBars");
    if(!host)return false;
    const items=[...host.querySelectorAll(".stock-radial-item")];
    if(!items.length)return false;
    items.forEach(item=>{
      const pct=parseId(item.querySelector(".stock-trend-ring span")?.textContent);
      if(!Number.isFinite(pct))return;
      const info=state(pct);
      item.classList.remove("kpp-level-critical","kpp-level-low","kpp-level-warning","kpp-level-safe","kpp-level-high");
      item.classList.add(`kpp-level-${info.key}`);
      const status=item.querySelector(".trend-stock-status");
      if(status){status.className=`trend-stock-status ${info.key}`;status.textContent=info.label;}
    });
    return true;
  }

  function ensureObserver(){
    const host=document.getElementById("stockTrendBars");
    if(!host)return false;
    if(!stockObserver){
      stockObserver=new MutationObserver(()=>patchStock());
      stockObserver.observe(host,{childList:true,subtree:true,characterData:true});
    }
    patchStock();
    return true;
  }

  function install(){
    injectStyle();
    ensureObserver();
    const body=document.body;
    if(body&&!rootObserver){
      rootObserver=new MutationObserver(()=>{ensureObserver();patchStock();});
      rootObserver.observe(body,{childList:true,subtree:true});
    }
  }

  document.addEventListener("DOMContentLoaded",install,{once:true});
  let tries=0;
  const timer=setInterval(()=>{tries++;install();if((patchStock()&&document.getElementById("kppStorageColumnHead"))||tries>=180)clearInterval(timer);},120);
})();
