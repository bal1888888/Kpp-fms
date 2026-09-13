// KPP-FMS Dashboard stock movement indicators v2
// Adds compact per-day stock change badges directly on each stock radial ring.
(() => {
  "use strict";

  const STYLE_ID="kppStockDeltaV2Style";
  const CHIP_CLASS="kpp-stock-delta";
  let observer=null;
  let watchedHost=null;

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      #stockTrendBars .stock-trend-ring{overflow:visible!important}
      #stockTrendBars .${CHIP_CLASS}{
        position:absolute;z-index:6;right:-7px;top:5px;
        display:inline-flex;align-items:center;justify-content:center;gap:2px;
        min-height:16px;padding:2px 5px;border-radius:999px;border:1px solid transparent;
        box-shadow:0 2px 7px rgba(15,23,42,.12);
        font-size:6.5px;font-weight:900;line-height:1;white-space:nowrap;letter-spacing:.01em;
      }
      #stockTrendBars .${CHIP_CLASS}.up{background:#dcfce7;border-color:#86efac;color:#166534}
      #stockTrendBars .${CHIP_CLASS}.down{background:#ffedd5;border-color:#fdba74;color:#c2410c}
      #stockTrendBars .${CHIP_CLASS}.flat{background:#f1f5f9;border-color:#cbd5e1;color:#64748b}
      #stockTrendBars .${CHIP_CLASS}.start{background:#dbeafe;border-color:#93c5fd;color:#1d4ed8}
      @media(max-width:560px){
        #stockTrendBars .${CHIP_CLASS}{right:-8px;top:4px;min-height:14px;font-size:5.8px;padding:2px 4px}
      }
    `;
    document.head.appendChild(style);
  }

  function parseLiter(text){
    const raw=String(text||"").toUpperCase().replace(/L/g,"").trim();
    if(!raw)return null;
    const normalized=raw.replace(/\./g,"").replace(",",".").replace(/[^0-9.-]/g,"");
    const value=Number(normalized);
    return Number.isFinite(value)?value:null;
  }

  function formatLiter(value){
    return new Intl.NumberFormat("id-ID",{maximumFractionDigits:1}).format(Math.abs(Number(value)||0));
  }

  function formatCompact(value){
    const v=Math.abs(Number(value)||0);
    if(v>=1000000)return `${new Intl.NumberFormat("id-ID",{maximumFractionDigits:1}).format(v/1000000)}M`;
    if(v>=1000)return `${new Intl.NumberFormat("id-ID",{maximumFractionDigits:1}).format(v/1000)}K`;
    return new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(v);
  }

  function formatPct(value){
    return new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1}).format(Math.abs(Number(value)||0));
  }

  function itemValue(item){
    return parseLiter(item.querySelector(".trend-ring-liter")?.textContent);
  }

  function itemLabel(item){
    return String(item.querySelector(".trend-radial-label")?.textContent||"").trim();
  }

  function removeExisting(host){
    host.querySelectorAll(`.${CHIP_CLASS}`).forEach(el=>el.remove());
  }

  function patchHost(host){
    if(!host)return;
    const items=[...host.querySelectorAll(".stock-radial-item")];
    removeExisting(host);
    if(!items.length)return;

    items.forEach((item,index)=>{
      const current=itemValue(item);
      const ring=item.querySelector(".stock-trend-ring");
      if(!Number.isFinite(current)||!ring)return;

      const chip=document.createElement("div");
      chip.className=CHIP_CLASS;

      if(index===0){
        chip.classList.add("start");
        chip.textContent="AWAL";
        chip.title="Posisi awal pada rentang 5 hari yang tampil.";
      }else{
        const previous=itemValue(items[index-1]);
        if(!Number.isFinite(previous))return;
        const diff=current-previous;
        const pct=previous!==0?(diff/previous)*100:0;
        const previousLabel=itemLabel(items[index-1])||"posisi sebelumnya";

        if(Math.abs(diff)<0.5){
          chip.classList.add("flat");
          chip.textContent="TETAP";
          chip.title=`Stock tetap dibanding ${previousLabel}.`;
        }else if(diff>0){
          chip.classList.add("up");
          chip.textContent=`▲+${formatCompact(diff)}`;
          chip.title=`Stock bertambah ${formatLiter(diff)} L (${formatPct(pct)}%) dibanding ${previousLabel}.`;
        }else{
          chip.classList.add("down");
          chip.textContent=`▼${formatCompact(diff)}`;
          chip.title=`Stock berkurang ${formatLiter(diff)} L (${formatPct(pct)}%) dibanding ${previousLabel}.`;
        }
      }

      ring.appendChild(chip);
    });
  }

  function observeHost(host){
    if(watchedHost===host)return;
    observer?.disconnect();
    watchedHost=host;

    observer=new MutationObserver(mutations=>{
      const operationalChange=mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(node=>{
        if(node.nodeType!==1)return false;
        return !node.classList?.contains(CHIP_CLASS);
      }));
      if(!operationalChange)return;
      observer.disconnect();
      patchHost(host);
      observer.observe(host,{childList:true,subtree:true});
    });

    observer.observe(host,{childList:true,subtree:true});
    patchHost(host);
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
