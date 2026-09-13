// KPP-FMS CCR Auto Quota v2 hardening
// Source of truth: server preview RPC + server INSERT trigger.
// HM awal jatah = HM akhir pada pengisian fuel valid terakhir.
(() => {
  "use strict";

  let requestSeq=0;
  let lastSnapshot=null;
  let readersPatched=false;
  let editPatched=false;

  const db=()=>window.KPP?.db||window.kppDb||null;
  const upper=value=>String(value??"").trim().toUpperCase();
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:null;};
  const fmt=(value,digits=1)=>new Intl.NumberFormat("id-ID",{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(Number(value)||0);
  const fmtLit=value=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Number(value)||0);

  function els(){
    return {
      unit:document.getElementById("unit"),
      hm:document.getElementById("hm"),
      hmPrevious:document.getElementById("hmPreviousInput"),
      hmPreviousSource:document.getElementById("hmPreviousSource"),
      maxQty:document.getElementById("maxQty"),
      tolerance:document.getElementById("toleranceQty"),
      finalLimit:document.getElementById("finalLimit")
    };
  }

  function ensureStyle(){
    if(document.getElementById("kppCcrAutoQuotaStyle"))return;
    const style=document.createElement("style");
    style.id="kppCcrAutoQuotaStyle";
    style.textContent=`
      .kpp-auto-quota{margin:13px 0 0;border:1px solid #bfdbfe;border-radius:12px;background:linear-gradient(135deg,#eff6ff,#fff);padding:12px}
      .kpp-auto-quota.ready{border-color:#86efac;background:linear-gradient(135deg,#f0fdf4,#fff)}
      .kpp-auto-quota.warn{border-color:#fde68a;background:linear-gradient(135deg,#fffbeb,#fff)}
      .kpp-auto-quota.error{border-color:#fecaca;background:linear-gradient(135deg,#fef2f2,#fff)}
      .kpp-auto-quota-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}
      .kpp-auto-quota-head b{font-size:12px;color:#0f2748}.kpp-auto-quota-head span{font-size:9px;font-weight:900;color:#64748b}
      .kpp-auto-quota-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}
      .kpp-auto-quota-item{background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:9px;min-width:0}
      .kpp-auto-quota-item small{display:block;font-size:8px;color:#64748b;font-weight:900;margin-bottom:4px;text-transform:uppercase}
      .kpp-auto-quota-item strong{display:block;font-size:13px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .kpp-auto-quota-item.quota strong{font-size:18px;color:#166534}
      .kpp-auto-quota-note{margin-top:8px;font-size:9px;line-height:1.45;color:#475569}
      #maxQty.kpp-auto-locked{background:#ecfdf5!important;border-color:#86efac!important;color:#166534!important;font-weight:900!important}
      @media(max-width:760px){.kpp-auto-quota-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:430px){.kpp-auto-quota-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureUi(){
    const {hm,maxQty}=els();
    if(!hm||!maxQty)return null;
    if(hm.parentElement&&!hm.parentElement.querySelector("[data-kpp-hm-lock-note]")){
      const note=document.createElement("div");
      note.className="input-help";
      note.dataset.kppHmLockNote="1";
      note.textContent="HM akhir ini menjadi HM jatah dan dikunci setelah jatah otomatis tersimpan.";
      hm.parentElement.appendChild(note);
    }
    let card=document.getElementById("kppAutoQuotaCard");
    if(!card){
      card=document.createElement("div");
      card.id="kppAutoQuotaCard";
      card.className="kpp-auto-quota";
      card.innerHTML=`
        <div class="kpp-auto-quota-head"><b>JATAH OTOMATIS BERDASARKAN FC</b><span data-auto-state>MENUNGGU UNIT</span></div>
        <div class="kpp-auto-quota-grid">
          <div class="kpp-auto-quota-item"><small>HM PENGISIAN TERAKHIR</small><strong data-auto-start>-</strong></div>
          <div class="kpp-auto-quota-item"><small>HM AKHIR CCR</small><strong data-auto-end>-</strong></div>
          <div class="kpp-auto-quota-item"><small>FC STANDAR</small><strong data-auto-fc>-</strong></div>
          <div class="kpp-auto-quota-item quota"><small>JATAH</small><strong data-auto-quota>-</strong></div>
        </div>
        <div class="kpp-auto-quota-note" data-auto-note>HM awal jatah selalu mengambil HM dari transaksi pengisian fuel valid terakhir.</div>`;
      const grid=document.querySelector(".allocation-fields");
      if(grid?.parentElement)grid.insertAdjacentElement("afterend",card);
      else maxQty.parentElement?.insertAdjacentElement("afterend",card);
    }
    return card;
  }

  function refreshFinalLimit(){
    if(typeof window.updateLimit==="function"){
      try{window.updateLimit();return;}catch(_){/* fallback */}
    }
    const {maxQty,tolerance,finalLimit}=els();
    if(!finalLimit)return;
    const q=Number(maxQty?.value||0),t=Number(tolerance?.value||0);
    finalLimit.textContent=fmtLit((Number.isFinite(q)?q:0)+(Number.isFinite(t)?t:0));
  }

  async function loadSnapshot(unit){
    const client=db();
    if(!client)throw new Error("Database belum siap.");
    const {data,error}=await client.rpc("ccr_auto_quota_preview",{p_unit:unit});
    if(error)throw error;
    const row=data||{};
    return {
      unit:upper(row.unit||unit),
      standard:num(row.fc_standard_lphm),
      lastHm:num(row.last_fueling_hm),
      fuelId:row.last_fueling_id??null,
      source:String(row.source||""),
      reason:String(row.reason||""),
      baselineValid:row.baseline_valid===true,
      autoReady:row.auto_ready===true
    };
  }

  function paint(snapshot,{state,kind="",quotaText="-",note="",showStart=true}={}){
    const card=ensureUi();
    if(!card)return;
    card.className=`kpp-auto-quota${kind?" "+kind:""}`;
    card.querySelector("[data-auto-state]").textContent=state||"-";
    card.querySelector("[data-auto-start]").textContent=showStart&&snapshot?.lastHm!==null?`${fmt(snapshot.lastHm,1)} HM`:"-";
    card.querySelector("[data-auto-end]").textContent=num(els().hm?.value)===null?"-":`${fmt(num(els().hm.value),1)} HM`;
    card.querySelector("[data-auto-fc]").textContent=snapshot?.standard?`${fmt(snapshot.standard,1)} L/HM`:"-";
    card.querySelector("[data-auto-quota]").textContent=quotaText;
    card.querySelector("[data-auto-note]").textContent=note||snapshot?.reason||"-";
  }

  function setManualMode(snapshot,message){
    const {maxQty,hmPrevious,hmPreviousSource}=els();
    if(maxQty){maxQty.readOnly=false;maxQty.classList.remove("kpp-auto-locked");}
    const label=maxQty?.parentElement?.querySelector("label");
    if(label)label.textContent="Qty Jatah Manual (L)";
    if(hmPrevious)hmPrevious.value=snapshot?.baselineValid&&snapshot.lastHm!==null?String(snapshot.lastHm):"";
    if(hmPreviousSource)hmPreviousSource.textContent=snapshot?.source||message;
    paint(snapshot,{state:"MANUAL / BELUM LENGKAP",kind:"warn",quotaText:"MANUAL",note:message});
    refreshFinalLimit();
  }

  function setBlocked(snapshot,message){
    const {maxQty,hmPrevious,hmPreviousSource}=els();
    if(maxQty){maxQty.value="";maxQty.readOnly=true;maxQty.classList.remove("kpp-auto-locked");}
    if(hmPrevious)hmPrevious.value="";
    if(hmPreviousSource)hmPreviousSource.textContent=message;
    paint(snapshot,{state:"BLOKIR • REVIEW HM",kind:"error",quotaText:"-",note:message});
    refreshFinalLimit();
  }

  function applyAuto(snapshot){
    const {hm,maxQty,hmPrevious,hmPreviousSource}=els();
    const hmEnd=num(hm?.value);
    if(hmEnd===null){
      setManualMode(snapshot,"Masukkan HM akhir CCR untuk menghitung jatah otomatis.");
      return;
    }
    if(hmEnd<=snapshot.lastHm){
      setBlocked(snapshot,`HM akhir harus lebih besar dari HM pengisian terakhir ${fmt(snapshot.lastHm,1)} HM.`);
      return;
    }
    const runtime=Math.round((hmEnd-snapshot.lastHm)*10)/10;
    if(runtime>72){
      setBlocked(snapshot,`HM Jalan ${fmt(runtime,1)} sejak pengisian terakhir terlalu besar. Review HM history/HM unit sebelum membuat jatah.`);
      return;
    }
    const quota=Math.round(runtime*snapshot.standard);
    maxQty.value=String(quota);
    maxQty.readOnly=true;
    maxQty.classList.add("kpp-auto-locked");
    const label=maxQty.parentElement?.querySelector("label");
    if(label)label.textContent="Qty Jatah Otomatis (L)";
    if(hmPrevious)hmPrevious.value=String(snapshot.lastHm);
    if(hmPreviousSource)hmPreviousSource.textContent=snapshot.source;
    paint(snapshot,{
      state:"AUTO • TERKUNCI SAAT DISIMPAN",
      kind:"ready",
      quotaText:`${fmtLit(quota)} L`,
      note:`Rumus: (${fmt(hmEnd,1)} - ${fmt(snapshot.lastHm,1)}) HM × ${fmt(snapshot.standard,1)} L/HM = ${fmtLit(quota)} L. Server menghitung ulang sebelum menyimpan.`
    });
    refreshFinalLimit();
  }

  async function refresh(){
    const seq=++requestSeq;
    const {unit:unitInput,maxQty,hmPrevious,hmPreviousSource}=els();
    ensureUi();
    const unit=upper(unitInput?.value);
    if(!unit){
      lastSnapshot=null;
      if(maxQty){maxQty.readOnly=false;maxQty.classList.remove("kpp-auto-locked");}
      if(hmPrevious)hmPrevious.value="";
      if(hmPreviousSource)hmPreviousSource.textContent="HM awal jatah = HM pengisian terakhir.";
      paint(null,{state:"MENUNGGU UNIT",note:"Pilih unit untuk membaca baseline pengisian terakhir dan standar FC."});
      return;
    }
    try{
      const snapshot=await loadSnapshot(unit);
      if(seq!==requestSeq)return;
      lastSnapshot=snapshot;
      if(snapshot.lastHm!==null&&!snapshot.baselineValid){
        setBlocked(snapshot,snapshot.reason||"HM pengisian terakhir belum lolos validasi server.");
        return;
      }
      if(snapshot.lastHm===null){
        setManualMode(snapshot,"Belum ada histori pengisian valid. Jatah otomatis belum bisa dihitung; Qty manual tetap tersedia untuk first-use.");
        return;
      }
      if(!snapshot.standard){
        setManualMode(snapshot,"Standar FC unit belum diisi di Master Unit & HM. Isi standar FC agar jatah menjadi otomatis.");
        return;
      }
      applyAuto(snapshot);
    }catch(error){
      if(seq!==requestSeq)return;
      console.warn("Auto quota CCR:",error?.message||error);
      setBlocked(lastSnapshot,`Preview jatah gagal diverifikasi server: ${error?.message||error}. Jangan simpan sebelum koneksi/akses normal.`);
    }
  }

  function patchLegacyReaders(){
    if(readersPatched)return;
    const originalLoadUnits=window.loadUnits;
    const originalHmReader=window.ambilHmTerakhir;
    if(typeof originalLoadUnits!=="function"||typeof originalHmReader!=="function")return;

    window.loadUnits=async function(){
      const client=db();
      if(!client)throw new Error("Database belum siap.");
      const {data,error}=await client.rpc("ccr_unit_directory");
      if(error)throw error;
      const list=document.getElementById("unitList");
      if(!list)return;
      list.replaceChildren();
      for(const row of (data||[])){
        const option=document.createElement("option");
        option.value=String(row.code_unit||"");
        option.textContent=String(row.egi||"");
        list.appendChild(option);
      }
    };

    window.ambilHmTerakhir=async function(unit){
      const snapshot=await loadSnapshot(upper(unit));
      if(snapshot.baselineValid&&snapshot.lastHm!==null){
        return {hm:snapshot.lastHm,source:snapshot.source};
      }
      return {hm:0,source:snapshot.reason||"Belum ada HM pengisian terakhir yang valid."};
    };
    readersPatched=true;
  }

  async function applyEditLock(){
    const id=Number(document.getElementById("editId")?.value||0);
    if(!id)return;
    const saveBtn=document.getElementById("saveEditBtn");
    const hm=document.getElementById("editHm");
    const qty=document.getElementById("editMaxQty");
    if(hm)hm.readOnly=true;
    if(qty)qty.readOnly=true;
    if(saveBtn)saveBtn.disabled=true;
    try{
      const client=db();
      if(!client)throw new Error("Database belum siap.");
      const {data,error}=await client.from("ccr_allocations")
        .select("id,fc_standard_lphm,operator_checkin_id")
        .eq("id",id).maybeSingle();
      if(error)throw error;
      const autoLocked=num(data?.fc_standard_lphm)!==null&&Number(data.fc_standard_lphm)>0;
      if(hm){
        hm.readOnly=autoLocked||data?.operator_checkin_id!=null;
        hm.title=autoLocked?"HM jatah otomatis terkunci. Batalkan lalu buat jatah baru untuk koreksi.":"";
      }
      if(qty){
        qty.readOnly=autoLocked;
        qty.title=autoLocked?"Qty jatah otomatis terkunci oleh snapshot FC.":"";
      }
      if(saveBtn)saveBtn.disabled=false;
    }catch(error){
      console.warn("CCR edit lock:",error?.message||error);
      if(saveBtn){saveBtn.disabled=true;saveBtn.title="Gagal memverifikasi status lock jatah. Tutup lalu buka ulang setelah koneksi normal.";}
    }
  }

  function patchEdit(){
    if(editPatched||typeof window.openGlEdit!=="function")return;
    editPatched=true;
    const original=window.openGlEdit;
    window.openGlEdit=function(...args){
      const result=original.apply(this,args);
      setTimeout(applyEditLock,0);
      return result;
    };
  }

  function bind(){
    ensureStyle();
    ensureUi();
    patchLegacyReaders();
    patchEdit();
    setTimeout(()=>{patchLegacyReaders();patchEdit();},50);
    setTimeout(()=>{patchLegacyReaders();patchEdit();},500);

    const {unit,hm}=els();
    let inputTimer=0;
    unit?.addEventListener("input",()=>{
      clearTimeout(inputTimer);
      inputTimer=setTimeout(refresh,250);
    });
    unit?.addEventListener("change",()=>setTimeout(refresh,0));
    hm?.addEventListener("input",()=>{
      if(lastSnapshot?.unit===upper(unit?.value)&&lastSnapshot.baselineValid&&lastSnapshot.standard)applyAuto(lastSnapshot);
      else refresh();
    });
    hm?.addEventListener("change",()=>{
      if(lastSnapshot?.unit===upper(unit?.value)&&lastSnapshot.baselineValid&&lastSnapshot.standard)applyAuto(lastSnapshot);
      else refresh();
    });
    document.addEventListener("click",event=>{
      if(event.target?.closest?.(".checkin-use"))setTimeout(refresh,100);
    },true);
    setTimeout(refresh,0);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});
  else bind();
})();
