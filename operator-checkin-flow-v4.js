// KPP-FMS operator check-in flow v4
// Unit jatah CCR cukup check-in awal. HM kedua hanya untuk unit non-jatah.
(() => {
  "use strict";
  let policy=null;
  let applying=false;

  const el=id=>document.getElementById(id);
  const clean=v=>String(v??"").trim();
  const one=data=>Array.isArray(data)?data[0]||null:data||null;

  function note(){
    let n=el("quotaFlowNote");
    if(n)return n;
    n=document.createElement("div");
    n.id="quotaFlowNote";
    n.style.cssText="margin:0 0 15px;padding:12px 13px;border:1px solid #93c5fd;border-radius:11px;background:#eff6ff;color:#1e3a8a;font-size:11px;font-weight:800;line-height:1.55";
    document.querySelector(".mode-tabs")?.insertAdjacentElement("afterend",n);
    return n;
  }

  function quotaMessage(){
    return "UNIT JATAH CCR • Operator cukup check-in awal. Tidak perlu kirim HM kedua. CCR akan membaca dan menginput HM penjatahan; Fuelman memakai HM dari jatah CCR.";
  }

  function applyPolicy(){
    if(applying||!policy)return;
    applying=true;
    try{
      const tabs=document.querySelector(".mode-tabs");
      const checkBtn=el("checkinModeBtn"),actualBtn=el("actualModeBtn"),checkFields=el("checkinFields"),actualFields=el("actualFields"),submit=el("submitBtn"),status=el("status");
      if(!actualBtn||!submit)return;

      if(policy.is_ccr_quota){
        actualBtn.hidden=true;actualBtn.disabled=true;
        if(tabs)tabs.style.gridTemplateColumns="1fr";
        const n=note();n.hidden=false;n.textContent=quotaMessage();
        actualFields?.classList.add("hidden");
        checkBtn?.classList.add("active");
        try{MODE="checkin";}catch(_){/* global binding not ready */}

        if(typeof ACTIVE_CHECKIN!=="undefined"&&ACTIVE_CHECKIN){
          checkFields?.classList.add("hidden");
          submit.disabled=true;
          submit.textContent="CHECK-IN SUDAH TERCATAT";
          if(status){status.textContent=`Check-in ${ACTIVE_CHECKIN.unit||policy.code_unit} sudah aktif. Tunggu CCR membuat jatah. HM kedua tidak diperlukan.`;status.className="status success";}
        }else{
          checkFields?.classList.remove("hidden");
          submit.disabled=false;
          submit.textContent="KIRIM CHECK-IN";
          if(status && /sebelum rest|hm aktual/i.test(status.textContent||"")){status.textContent="Isi identitas dan HM awal. Setelah tersimpan, operator selesai untuk alur jatah CCR.";status.className="status success";}
        }
      }else{
        actualBtn.hidden=false;
        if(tabs)tabs.style.gridTemplateColumns="1fr 1fr";
        const n=el("quotaFlowNote");if(n)n.hidden=true;
      }
    }finally{applying=false;}
  }

  async function loadPolicy(){
    const unit=clean(el("unit")?.value).toUpperCase();
    const token=clean(el("token")?.value);
    if(!unit||!token)return null;
    try{
      const {data,error}=await db.rpc("operator_checkin_flow_info",{p_unit:unit,p_token:token});
      if(error)throw error;
      policy=one(data);
      applyPolicy();
      return policy;
    }catch(error){
      console.warn("Operator flow policy:",error?.message||error);
      return null;
    }
  }

  function patchDone(){
    if(typeof window.showDone!=="function"||window.showDone.__kppFlowV4)return;
    const original=window.showDone;
    const wrapped=function(title,message,lines){
      if(policy?.is_ccr_quota && title==="Check-in Berhasil"){
        message="Check-in awal sudah diterima. Untuk unit jatah CCR, tidak perlu input HM kedua. Tunggu CCR membuat jatah.";
        lines=[...lines,"HM berikutnya: diinput CCR saat penjatahan"];
      }
      return original.call(this,title,message,lines);
    };
    wrapped.__kppFlowV4=true;
    window.showDone=wrapped;
  }

  function guard(){
    el("actualModeBtn")?.addEventListener("click",event=>{
      if(!policy?.is_ccr_quota)return;
      event.preventDefault();event.stopImmediatePropagation();applyPolicy();
    },true);
    el("submitBtn")?.addEventListener("click",event=>{
      if(!policy?.is_ccr_quota)return;
      let mode="checkin";try{mode=MODE;}catch(_){/* noop */}
      if(mode==="actual"||(typeof ACTIVE_CHECKIN!=="undefined"&&ACTIVE_CHECKIN)){
        event.preventDefault();event.stopImmediatePropagation();applyPolicy();
      }
    },true);
  }

  async function boot(){
    patchDone();guard();
    for(let i=0;i<50;i++){
      if(el("unit")?.value&&el("token")?.value){await loadPolicy();break;}
      await new Promise(r=>setTimeout(r,100));
    }
    // validateQr/loadActiveCheckin dapat selesai setelah policy; terapkan lagi.
    setTimeout(applyPolicy,150);
    setTimeout(applyPolicy,500);
    setTimeout(applyPolicy,1200);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
