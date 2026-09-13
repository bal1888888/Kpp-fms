// KPP-FMS Dashboard daily usage bars v2
// Makes 5-day movement easier to read without changing the liter values.
(() => {
  "use strict";

  const STYLE_ID="kppUsageBarsV2Style";
  const NOTE_CLASS="kpp-usage-scale-note";
  const BASELINE_CLASS="kpp-usage-baseline";
  let hostObserver=null;
  let watchedHost=null;

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .dashboard-workspace #usageTrendBars.usage-bars{
        position:relative!important;
        border-bottom:0!important;
        overflow:visible!important;
      }
      .dashboard-workspace #usageTrendBars .usage-radial-item{
        position:relative!important;
        z-index:2!important;
      }
      .dashboard-workspace #usageTrendBars .usage-trend-ring.kpp-usage-scaled{
        height:calc(var(--usage-height) * 1%)!important;
        min-height:18px!important;
        transition:height .28s ease!important;
      }
      .${BASELINE_CLASS}{
        position:absolute;left:0;right:0;bottom:0;height:1px;background:#cbd5e1;z-index:1;pointer-events:none;
      }
      .${NOTE_CLASS}{
        position:absolute;right:2px;top:1px;z-index:4;padding:2px 5px;border-radius:999px;
        background:#eff6ff;color:#64748b;font-size:6.5px;font-weight:900;letter-spacing:.04em;pointer-events:none;
      }
      @media(max-width:720px){.${NOTE_CLASS}{font-size:6px}}
    `;
    document.head.appendChild(style);
  }

  function parseLiter(text){
    const raw=String(text||"").toUpperCase().replace("L","").trim();
    if(!raw)return null;
    const normalized=raw.replace(/\./g,"").replace(",",".").replace(/[^0-9.-]/g,"");
    const value=Number(normalized);
    return Number.isFinite(value)?value:null;
  }

  function itemValue(item){
    return parseLiter(item.querySelector(".trend-ring-liter")?.textContent);
  }

  function relativeHeight(value,min,max){
    if(!(Number.isFinite(value)&&Number.isFinite(min)&&Number.isFinite(max)))return 55;
    if(max<=min)return 62;
    return 32+((value-min)/(max-min))*56;
  }

  function clearDecorations(host){
    host.querySelector(`.${BASELINE_CLASS}`)?.remove();
    host.querySelector(`.${NOTE_CLASS}`)?.remove();
    host.querySelector(".kpp-usage-trend-svg")?.remove();
  }

  function patchHost(host){
    if(!host)return;
    const items=[...host.querySelectorAll(".usage-radial-item")];
    if(!items.length){clearDecorations(host);return;}

    const values=items.map(itemValue).filter(Number.isFinite);
    if(!values.length){clearDecorations(host);return;}
    const min=Math.min(...values);
    const max=Math.max(...values);

    items.forEach(item=>{
      const value=itemValue(item);
      const bar=item.querySelector(".usage-trend-ring");
      if(!bar||!Number.isFinite(value))return;
      bar.classList.add("kpp-usage-scaled");
      bar.style.setProperty("--usage-height",relativeHeight(value,min,max).toFixed(2));
    });

    clearDecorations(host);

    const baseline=document.createElement("div");
    baseline.className=BASELINE_CLASS;
    host.appendChild(baseline);

    const note=document.createElement("div");
    note.className=NOTE_CLASS;
    note.textContent="SKALA RELATIF 5 HARI";
    note.title="Tinggi batang dinormalisasi agar perubahan harian lebih mudah terlihat; angka liter tetap nilai asli.";
    host.appendChild(note);
  }

  function observeHost(host){
    if(watchedHost===host)return;
    hostObserver?.disconnect();
    watchedHost=host;

    hostObserver=new MutationObserver(mutations=>{
      const operationalChange=mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(node=>{
        if(node.nodeType!==1)return false;
        return !node.classList?.contains(BASELINE_CLASS) && !node.classList?.contains(NOTE_CLASS);
      }));
      if(!operationalChange)return;
      hostObserver.disconnect();
      patchHost(host);
      hostObserver.observe(host,{childList:true,subtree:false});
    });
    hostObserver.observe(host,{childList:true,subtree:false});
    patchHost(host);
  }

  function install(){
    injectStyle();
    const host=document.getElementById("usageTrendBars");
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
