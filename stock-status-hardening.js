// KPP-FMS Stock status hardening
// Status operasional: <20 KRITIS, 20-<35 RENDAH, 35-<50 WASPADA, 50-<90 AMAN, >=90 TINGGI.
(() => {
  "use strict";

  const PATCH_FLAG="KPP_STOCK_STATUS_HARDENING_INSTALLED";
  const STYLE_ID="kpp-stock-status-hardening-style";

  function classify(percent){
    const p=Number(percent);
    if(!Number.isFinite(p))return "safe";
    if(p<20)return "critical";
    if(p<35)return "low";
    if(p<50)return "caution";
    if(p>=90)return "high";
    return "safe";
  }

  function labelFor(state){
    if(state==="critical")return "KRITIS";
    if(state==="low")return "RENDAH";
    if(state==="caution")return "WASPADA";
    if(state==="high")return "TINGGI";
    return "AMAN";
  }

  function cardClassFor(state){
    return `capacity-${state}`;
  }

  function parsePercent(text){
    const match=String(text||"").match(/(-?\d+(?:[.,]\d+)?)\s*%/);
    if(!match)return null;
    const value=Number(match[1].replace(",","."));
    return Number.isFinite(value)?value:null;
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .capacity-caution{border-left-color:#f97316!important}
      .capacity-caution-text{color:#c2410c!important;font-weight:bold}
      .stock-gauge-card.capacity-caution{border-color:#fdba74!important;border-left-color:#f97316!important}
      .stock-radial.caution{--ring-color:#f97316}
      .stock-radial.caution .stock-radial-percent,
      .stock-radial.caution .stock-radial-status{color:#c2410c!important}
    `;
    document.head.appendChild(style);
  }

  function clearCapacityClasses(element){
    if(!element)return;
    ["safe","low","caution","critical","high"].forEach(state=>{
      element.classList.remove(`capacity-${state}`);
    });
  }

  function clearRadialStates(element){
    if(!element)return;
    ["safe","low","caution","critical","high"].forEach(state=>{
      element.classList.remove(state);
    });
  }

  function patchStorageCards(){
    document.querySelectorAll("#stockCards .stock-gauge-card").forEach(card=>{
      const percentEl=card.querySelector(".stock-radial-percent");
      const percent=parsePercent(percentEl?.textContent);
      if(percent===null)return;

      const state=classify(percent);
      const status=labelFor(state);
      const radial=card.querySelector(".stock-radial");
      const statusEl=card.querySelector(".stock-radial-status");

      clearCapacityClasses(card);
      card.classList.add(cardClassFor(state));
      clearRadialStates(radial);
      radial?.classList.add(state);
      if(statusEl && String(statusEl.textContent||"").trim()!==status){
        statusEl.textContent=status;
      }
    });
  }

  function patchTotalStatus(){
    const host=document.getElementById("stockTotalWide");
    if(!host)return;

    const percent=parsePercent(host.textContent);
    if(percent===null)return;

    const state=classify(percent);
    const status=labelFor(state);
    const card=host.querySelector(".stock-total-card");

    clearCapacityClasses(card);
    card?.classList.add(cardClassFor(state));

    host.querySelectorAll("strong,span,b,div").forEach(el=>{
      const raw=String(el.textContent||"").trim();
      if(!raw)return;

      if(/^\d+(?:[.,]\d+)?%\s*\|\s*(AMAN|RENDAH|KRITIS|TINGGI|WASPADA)$/i.test(raw)){
        const next=raw.replace(/(AMAN|RENDAH|KRITIS|TINGGI|WASPADA)$/i,status);
        if(next!==raw)el.textContent=next;
        ["safe","low","caution","critical","high"].forEach(key=>el.classList.remove(`capacity-${key}-text`));
        el.classList.add(`capacity-${state}-text`);
        return;
      }

      // Untuk layout hero baru: hanya nilai status tunggal yang diganti.
      // Badge seperti "AMAN 3" tidak disentuh.
      if(/^(AMAN|RENDAH|KRITIS|TINGGI|WASPADA)$/i.test(raw) && raw!==status){
        el.textContent=status;
      }
    });
  }

  function patchRenderedStatus(){
    injectStyle();
    patchStorageCards();
    patchTotalStatus();
  }

  function install(){
    if(window[PATCH_FLAG]){
      patchRenderedStatus();
      return true;
    }

    if(typeof window.renderStockCards!=="function")return false;

    const originalRender=window.renderStockCards;
    window.KPP_STOCK_ORIGINAL_RENDER=originalRender;

    // capacityState dipakai kartu individual. Override agar status logika dan
    // kelas radial sudah mengenal zona WASPADA sebelum DOM dipoles kembali.
    if(typeof window.capacityPercent==="function"){
      window.capacityState=function(storage,qty){
        return classify(window.capacityPercent(storage,qty));
      };
    }

    window.renderStockCards=function(...args){
      const result=originalRender.apply(this,args);
      patchRenderedStatus();
      return result;
    };

    window[PATCH_FLAG]=true;
    patchRenderedStatus();

    const cards=document.getElementById("stockCards");
    const total=document.getElementById("stockTotalWide");
    const observer=new MutationObserver(()=>patchRenderedStatus());
    if(cards)observer.observe(cards,{childList:true,subtree:true});
    if(total)observer.observe(total,{childList:true,subtree:true,characterData:true});

    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()||attempts>=100)clearInterval(timer);
  },50);

  document.addEventListener("kpp-auth-ready",()=>setTimeout(patchRenderedStatus,0));
})();
