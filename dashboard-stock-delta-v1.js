// KPP-FMS Dashboard stock movement indicators v1
// Adds per-day stock change chips without changing stock values or status logic.
(() => {
  "use strict";

  const STYLE_ID="kppStockDeltaV1Style";
  const CHIP_CLASS="kpp-stock-delta";
  let observer=null;
  let watchedHost=null;

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .${CHIP_CLASS}{
        display:inline-flex;align-items:center;justify-content:center;gap:3px;
        margin-top:4px;padding:3px 6px;border-radius:999px;border:1px solid transparent;
        font-size:7px;font-weight:900;line-height:1;white-space:nowrap;letter-spacing:.01em;
      }
      .${CHIP_CLASS}.up{background:#ecfdf5;border-color:#bbf7d0;color:#15803d}
      .${CHIP_CLASS}.down{background:#fff7ed;border-color:#fed7aa;color:#c2410c}
      .${CHIP_CLASS}.flat{background:#f1f5f9;border-color:#e2e8f0;color:#64748b}
      .${CHIP_CLASS}.start{background:#eff6ff;border-color:#bfdbfe;color:#2563eb}
      @media(max-width:560px){
        .${CHIP_CLASS}{font-size:6.5px;padding:3px 5px;margin-top:3px}
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
      if(!Number.isFinite(current))return;

      const chip=document.createElement("div");
      chip.className=CHIP_CLASS;

      if(index===0){
        chip.classList.add("start");
        chip.textContent="• AWAL";
        chip.title="Posisi awal pada rentang 5 hari yang tampil.";
      }else{
        const previous=itemValue(items[index-1]);
        if(!Number.isFinite(previous))return;
        const diff=current-previous;
        const pct=previous!==0?(diff/previous)*100:0;
        const previousLabel=itemLabel(items[index-1])||"posisi sebelumnya";

        if(Math.abs(diff)<0.5){
          chip.classList.add("flat");
          chip.textContent="• TETAP";
          chip.title=`Stock tetap dibanding ${previousLabel}.`;
        }else if(diff>0){
          chip.classList.add("up");
          chip.textContent=`▲ ${formatLiter(diff)} L`;
          chip.title=`Stock bertambah ${formatLiter(diff)} L (${formatPct(pct)}%) dibanding ${previousLabel}.`;
        }else{
          chip.classList.add("down");
          chip.textContent=`▼ ${formatLiter(diff)} L`;
          chip.title=`Stock berkurang ${formatLiter(diff)} L (${formatPct(pct)}%) dibanding ${previousLabel}.`;
        }
      }

      const status=item.querySelector(".trend-stock-status");
      if(status)status.insertAdjacentElement("afterend",chip);
      else item.appendChild(chip);
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
