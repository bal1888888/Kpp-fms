// KPP-FMS CCR Auto Quota v1
// HM awal = HM pada pengisian fuel valid terakhir. Jatah = (HM akhir CCR - HM awal) x FC standar.
(() => {
  "use strict";

  let requestSeq=0;
  let lastSnapshot=null;
  let patchedReference=false;
  let patchedEdit=false;

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

    const qtyWrap=maxQty.parentElement;
    const qtyLabel=qtyWrap?.querySelector("label");
    if(qtyLabel&&!qtyLabel.dataset.kppAutoQuota){
      qtyLabel.dataset.kppAutoQuota="1";
      qtyLabel.textContent="Qty Jatah (L)";
    }

    if(hm.parentElement&&!hm.parentElement.querySelector("[data-kpp-hm-lock-note]")){
      const note=document.createElement("div");
      note.className="input-help";
      note.dataset.kppHmLockNote="1";
      note.textContent="HM akhir ini menjadi HM jatah dan dikunci setelah jatah disimpan.";
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
      else qtyWrap?.insertAdjacentElement("afterend",card);
    }
    return card;
  }

  function updateLimit(){
    if(typeof window.updateLimit==="function"){
      try{window.updateLimit();return;}catch(_){/* fallback below */}
    }
    const {maxQty,tolerance,finalLimit}=els();
    if(!finalLimit)return;
    const q=Number(maxQty?.value||0),t=Number(tolerance?.value||0);
    finalLimit.textContent=fmtLit((Number.isFinite(q)?q:0)+(Number.isFinite(t)?t:0));
  }

  function setManualMode(message,{lastHm=null,source=""}={}){
    const {maxQty,hmPrevious,hmPreviousSource,hm}=els();
    const card=ensureUi();
    if(!card)return;
    maxQty.readOnly=false;
    maxQty.classList.remove("kpp-auto-locked");
    const label=maxQty.parentElement?.querySelector("label");
    if(label)label.textContent="Qty Jatah Manual (L)";
    if(lastHm!==null&&hmPrevious){hmPrevious.value=String(lastHm);}
    if(hmPreviousSource){hmPreviousSource.textContent=source||message;}
    card.className="kpp-auto-quota warn";
    card.querySelector("[data-auto-state]").textContent="MANUAL / BELUM LENGKAP";
    card.querySelector("[data-auto-start]").textContent=lastHm===null?"-":`${fmt(lastHm,1)} HM`;
    card.querySelector("[data-auto-end]").textContent=num(hm?.value)===null?"-":`${fmt(num(hm.value),1)} HM`;
    card.querySelector("[data-auto-fc]").textContent=lastSnapshot?.standard?`${fmt(lastSnapshot.standard,1)} L/HM`:"-";
    card.querySelector("[data-auto-quota]").textContent="MANUAL";
    card.querySelector("[data-auto-note]").textContent=message;
    updateLimit();
  }

  function setError(message,snapshot){
    const {maxQty,hmPrevious,hmPreviousSource,hm}=els();
    const card=ensureUi();
    if(!card)return;
    maxQty.value="";
    maxQty.readOnly=true;
    maxQty.classList.remove("kpp-auto-locked");
    if(snapshot?.lastHm!==null&&snapshot?.lastHm!==undefined&&hmPrevious)hmPrevious.value=String(snapshot.lastHm);
    if(hmPreviousSource)hmPreviousSource.textContent=snapshot?.source||message;
    card.className="kpp-auto-quota error";
    card.querySelector("[data-auto-state]").textContent="PERIKSA HM";
    card.querySelector("[data-auto-start]").textContent=snapshot?.lastHm==null?"-":`${fmt(snapshot.lastHm,1)} HM`;
    card.querySelector("[data-auto-end]").textContent=num(hm?.value)===null?"-":`${fmt(num(hm.value),1)} HM`;
    card.querySelector("[data-auto-fc]").textContent=snapshot?.standard?`${fmt(snapshot.standard,1)} L/HM`:"-";
    card.querySelector("[data-auto-quota]").textContent="-";
    card.querySelector("[data-auto-note]").textContent=message;
    updateLimit();
  }

  function applyAuto(snapshot){
    const {hm,maxQty,hmPrevious,hmPreviousSource}=els();
    const card=ensureUi();
    if(!card)return;
    const hmEnd=num(hm?.value);
    if(hmEnd===null){
      setManualMode("Masukkan HM akhir CCR untuk menghitung jatah otomatis.",{lastHm:snapshot.lastHm,source:snapshot.source});
      return;
    }
    if(hmEnd<=snapshot.lastHm){
      setError(`HM akhir harus lebih besar dari HM pengisian terakhir ${fmt(snapshot.lastHm,1)} HM.`,snapshot);
      return;
    }
    const runtime=Math.round((hmEnd-snapshot.lastHm)*10)/10;
    const quota=Math.round(runtime*snapshot.standard);
    maxQty.value=String(quota);
    maxQty.readOnly=true;
    maxQty.classList.add("kpp-auto-locked");
    const label=maxQty.parentElement?.querySelector("label");
    if(label)label.textContent="Qty Jatah Otomatis (L)";
    if(hmPrevious)hmPrevious.value=String(snapshot.lastHm);
    if(hmPreviousSource)hmPreviousSource.textContent=snapshot.source;
    card.className="kpp-auto-quota ready";
    card.querySelector("[data-auto-state]").textContent="AUTO • TERKUNCI SAAT DISIMPAN";
    card.querySelector("[data-auto-start]").textContent=`${fmt(snapshot.lastHm,1)} HM`;
    card.querySelector("[data-auto-end]").textContent=`${fmt(hmEnd,1)} HM`;
    card.querySelector("[data-auto-fc]").textContent=`${fmt(snapshot.standard,1)} L/HM`;
    card.querySelector("[data-auto-quota]").textContent=`${fmtLit(quota)} L`;
    card.querySelector("[data-auto-note]").textContent=`Rumus: (${fmt(hmEnd,1)} - ${fmt(snapshot.lastHm,1)}) HM × ${fmt(snapshot.standard,1)} L/HM = ${fmtLit(quota)} L. Server menghitung ulang sebelum menyimpan.`;
    updateLimit();
  }

  async function loadSnapshot(unit){
    const client=db();
    if(!client)throw new Error("Database belum siap.");

    const [masterResult,fuelResult]=await Promise.all([
      client.from("unit_master")
        .select("code_unit,fc_standard_lphm,active")
        .eq("code_unit",unit)
        .limit(1),
      client.from("fuel_history")
        .select("id,tanggal,jam,hm_akhir,fuel")
        .eq("unit",unit)
        .eq("hm_ref_excluded",false)
        .is("duplicate_of_id",null)
        .gt("fuel",0)
        .not("hm_akhir","is",null)
        .order("tanggal",{ascending:false})
        .order("jam",{ascending:false})
        .order("id",{ascending:false})
        .limit(1)
    ]);

    if(masterResult.error)throw masterResult.error;
    if(fuelResult.error)throw fuelResult.error;
    const master=masterResult.data?.[0]||null;
    const fuel=fuelResult.data?.[0]||null;
    const standard=num(master?.fc_standard_lphm);
    const lastHm=num(fuel?.hm_akhir);
    const source=fuel
      ? `HM pengisian terakhir #${fuel.id} • ${fuel.tanggal}${fuel.jam?" "+String(fuel.jam).slice(0,5):""}`
      : "Belum ada histori pengisian fuel valid.";
    return {unit,standard:standard&&standard>0?standard:null,lastHm,source,fuelId:fuel?.id||null};
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
      const card=document.getElementById("kppAutoQuotaCard");
      if(card){card.className="kpp-auto-quota";card.querySelector("[data-auto-state]").textContent="MENUNGGU UNIT";}
      return;
    }

    try{
      const snapshot=await loadSnapshot(unit);
      if(seq!==requestSeq)return;
      lastSnapshot=snapshot;
      if(snapshot.lastHm===null){
        setManualMode("Belum ada histori pengisian valid. Jatah otomatis belum bisa dihitung; gunakan Qty manual untuk masa transisi.",{lastHm:null,source:snapshot.source});
        return;
      }
      if(!snapshot.standard){
        setManualMode("Standar FC unit belum diisi di Master Unit & HM. Isi standar FC agar jatah menjadi otomatis.",{lastHm:snapshot.lastHm,source:snapshot.source});
        return;
      }
      applyAuto(snapshot);
    }catch(error){
      if(seq!==requestSeq)return;
      console.warn("Auto quota CCR:",error?.message||error);
      setManualMode("Jatah otomatis gagal dimuat. Qty manual tetap tersedia agar operasi tidak terhenti.");
    }
  }

  function patchReference(){
    if(patchedReference||typeof window.loadHmReference!=="function")return;
    patchedReference=true;
    const original=window.loadHmReference;
    window.loadHmReference=async function(...args){
      const result=await original.apply(this,args);
      await refresh();
      return result;
    };
  }

  function lockEditFields(){
    ["editHmPrevious","editHm","editMaxQty"].forEach(id=>{
      const input=document.getElementById(id);
      if(!input)return;
      input.readOnly=true;
      input.title="HM dan jatah otomatis terkunci. Batalkan jatah lalu buat baru untuk koreksi.";
      input.style.background="#f1f5f9";
    });
  }

  function patchEdit(){
    if(patchedEdit||typeof window.openGlEdit!=="function")return;
    patchedEdit=true;
    const original=window.openGlEdit;
    window.openGlEdit=function(...args){
      const result=original.apply(this,args);
      setTimeout(lockEditFields,0);
      return result;
    };
  }

  function bind(){
    ensureStyle();
    ensureUi();
    patchReference();
    patchEdit();

    const {unit,hm}=els();
    let inputTimer=0;
    unit?.addEventListener("input",()=>{
      clearTimeout(inputTimer);
      inputTimer=setTimeout(refresh,250);
    });
    unit?.addEventListener("change",()=>setTimeout(refresh,0));
    hm?.addEventListener("input",()=>{if(lastSnapshot?.unit===upper(unit?.value))applyAutoOrFallback();else refresh();});
    hm?.addEventListener("change",()=>{if(lastSnapshot?.unit===upper(unit?.value))applyAutoOrFallback();else refresh();});
    document.addEventListener("click",event=>{
      if(event.target?.closest?.(".checkin-use"))setTimeout(refresh,80);
    },true);

    function applyAutoOrFallback(){
      if(!lastSnapshot)return;
      if(lastSnapshot.lastHm===null){setManualMode("Belum ada histori pengisian valid. Jatah otomatis belum bisa dihitung; gunakan Qty manual untuk masa transisi.",{source:lastSnapshot.source});return;}
      if(!lastSnapshot.standard){setManualMode("Standar FC unit belum diisi di Master Unit & HM. Isi standar FC agar jatah menjadi otomatis.",{lastHm:lastSnapshot.lastHm,source:lastSnapshot.source});return;}
      applyAuto(lastSnapshot);
    }

    setTimeout(()=>{patchReference();patchEdit();refresh();},0);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});
  else bind();
})();
