// KPP-FMS Dashboard stock radial visual v3
// Keeps current stock green, renders missing capacity in red, and removes per-day delta text badges.
(() => {
  "use strict";

  const STYLE_ID="kppStockRadialVisualV3Style";
  const LEGACY_BADGE_CLASS="kpp-stock-delta";
  let observer=null;
  let watchedHost=null;

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      #stockTrendBars .stock-radial-item{
        background:linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
        border:1px solid #dbe7f1;
        border-radius:16px;
        box-shadow:0 7px 18px rgba(15,23,42,.06);
      }
      #stockTrendBars .stock-radial-item.is-latest{
        border-color:#22c55e;
        box-shadow:0 8px 22px rgba(34,197,94,.13);
      }
      #stockTrendBars .stock-trend-ring{
        --trend-fill:#11a861;
        --trend-empty:#ef4444;
        overflow:hidden!important;
        background:conic-gradient(
          var(--trend-fill) 0 calc(var(--trend-pct)*1%),
          var(--trend-empty) calc(var(--trend-pct)*1%) 100%
        )!important;
        box-shadow:0 5px 14px rgba(15,23,42,.08);
      }
      #stockTrendBars .stock-trend-ring::before{
        box-shadow:inset 0 0 0 1px rgba(15,23,42,.035);
      }
      #stockTrendBars .stock-trend-ring span{
        color:#07883f!important;
        text-shadow:0 1px 0 rgba(255,255,255,.75);
      }
      #stockTrendBars .${LEGACY_BADGE_CLASS}{display:none!important}
      @media(max-width:560px){
        #stockTrendBars .stock-radial-item{
          box-shadow:0 4px 12px rgba(15,23,42,.055);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function cleanLegacyBadges(host){
    if(!host)return;
    host.querySelectorAll(`.${LEGACY_BADGE_CLASS}`).forEach(el=>el.remove());
  }

  function observeHost(host){
    if(!host||watchedHost===host)return;
    observer?.disconnect();
    watchedHost=host;
    cleanLegacyBadges(host);
    observer=new MutationObserver(()=>cleanLegacyBadges(host));
    observer.observe(host,{childList:true,subtree:true});
  }

  function install(){
    injectStyle();
    const host=document.getElementById("stockTrendBars");
    if(!host)return false;
    observeHost(host);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()||attempts>=160)clearInterval(timer);
  },100);
  document.addEventListener("DOMContentLoaded",install,{once:true});
})();
