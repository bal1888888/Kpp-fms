// KPP-FMS CCR Quota Input v4
// Satu modul untuk memilih check-in, membaca baseline server, input HM CCR, lock Qty Jatah,
// dan mengambil Limit Toleransi Penjatahan dari Master Unit.
(() => {
  "use strict";

  const db=()=>window.KPP?.db||window.kppDb||null;
  const clean=v=>String(v??"").trim();
  const upper=v=>clean(v).toUpperCase();
  const number=v=>{if(v===null||v===undefined||clean(v)==="")return null;const n=Number(v);return Number.isFinite(n)?n:null;};
  const fmt=(v,d=1)=>Number.isFinite(Number(v))?new Intl.NumberFormat("id-ID",{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(v)):"—";
  const fmtL=v=>Number.isFinite(Number(v))?new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Number(v)):"—";
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  let snapshot=null;
  let snapshotSeq=0;
  let picking=false;
  let observer=null;
  let inputTimer=0;
  let editPatched=false;

  function el(id){return document.getElementById(id);}
  function currentTime(){
    return window.KPPTime?.localTime?.().slice(0,5)
      || window.KPPCCRMonitor?.siteParts?.()?.time?.slice(0,5)
      || "";
  }

  function setRef(row){
    const last=number(row?.last_fueling_hm);
    const valid=row?.baseline_valid===true && last!==null;
    CURRENT_HM_REF={hm:valid?last:0,source:valid?String(row.source||""):String(row?.reason||"Belum ada HM pengisian valid.")};
    HM_REFERENCE_LOADING=false;
    const input=el("hmPreviousInput");
    const source=el("hmPreviousSource");
    if(input)input.value=valid?fmt(last,1):"Belum ada";
    if(source)source.textContent=CURRENT_HM_REF.source;
    if(typeof updateHmIntel==="function")updateHmIntel();
  }

  function setTolerance(row){
    const input=el("toleranceQty");
    if(!input)return;
    const value=number(row?.quota_tolerance_liter);
    input.readOnly=true;
    input.classList.add("kpp-tolerance-locked");
    input.value=value===null?"":String(value);
    input.title=value===null
      ?"Pilih unit untuk membaca Limit Toleransi Penjatahan dari Master Unit."
      :`Terkunci dari Master Unit: ${fmtL(value)} L`;
    if(typeof updateLimit==="function")updateLimit();
  }

  function quotaCard(){
    let card=el("kppAutoQuotaCardV4");
    if(card)return card;
    const maxQty=el("maxQty");
    if(!maxQty)return null;
    card=document.createElement("div");
    card.id="kppAutoQuotaCardV4";
    card.className="kpp-auto-quota-v4";
    card.innerHTML=`<div class="kpp-aq-head"><b>JATAH OTOMATIS BERDASARKAN FC</b><span data-state>MENUNGGU UNIT</span></div>
      <div class="kpp-aq-grid">
        <div><small>HM PENGISIAN TERAKHIR</small><strong data-start>-</strong></div>
        <div><small>HM PENJATAHAN CCR</small><strong data-end>-</strong></div>
        <div><small>FC STANDAR</small><strong data-fc>-</strong></div>
        <div class="quota"><small>QTY JATAH</small><strong data-quota>-</strong></div>
      </div><p data-note>Pilih check-in lalu isi HM yang dibaca CCR.</p>`;
    const grid=document.querySelector(".allocation-fields");
    if(grid?.parentElement)grid.insertAdjacentElement("afterend",card);
    else maxQty.parentElement?.insertAdjacentElement("afterend",card);
    return card;
  }

  function ensureStyle(){
    if(el("kppCcrQuotaV4Style"))return;
    const style=document.createElement("style");
    style.id="kppCcrQuotaV4Style";
    style.textContent=`
      .kpp-auto-quota-v4{margin:13px 0 0;border:1px solid #bfdbfe;border-radius:12px;background:linear-gradient(135deg,#eff6ff,#fff);padding:12px}
      .kpp-auto-quota-v4.ready{border-color:#86efac;background:linear-gradient(135deg,#f0fdf4,#fff)}
      .kpp-auto-quota-v4.warn{border-color:#fde68a;background:linear-gradient(135deg,#fffbeb,#fff)}
      .kpp-auto-quota-v4.error{border-color:#fecaca;background:linear-gradient(135deg,#fef2f2,#fff)}
      .kpp-aq-head{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:9px}.kpp-aq-head b{font-size:12px;color:#0f2748}.kpp-aq-head span{font-size:9px;font-weight:900;color:#64748b}
      .kpp-aq-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.kpp-aq-grid>div{background:#fff;border:1px solid #e2e8f0;border-radius:9px;padding:9px;min-width:0}.kpp-aq-grid small{display:block;font-size:8px;color:#64748b;font-weight:900;margin-bottom:4px}.kpp-aq-grid strong{display:block;font-size:13px;color:#0f172a;overflow:hidden;text-overflow:ellipsis}.kpp-aq-grid .quota strong{font-size:18px;color:#166534}.kpp-auto-quota-v4 p{margin:8px 0 0;font-size:9px;line-height:1.45;color:#475569}
      #maxQty.kpp-quota-locked{background:#ecfdf5!important;border-color:#86efac!important;color:#166534!important;font-weight:900!important}
      #toleranceQty.kpp-tolerance-locked{background:#eff6ff!important;border-color:#93c5fd!important;color:#1d4ed8!important;font-weight:900!important}
      @media(max-width:760px){.kpp-aq-grid{grid-template-columns:1fr 1fr}}@media(max-width:430px){.kpp-aq-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function paint({state="-",kind="",quota="-",note=""}={}){
    const card=quotaCard();if(!card)return;
    card.className=`kpp-auto-quota-v4${kind?" "+kind:""}`;
    card.querySelector("[data-state]").textContent=state;
    card.querySelector("[data-start]").textContent=snapshot?.baseline_valid&&number(snapshot.last_fueling_hm)!==null?`${fmt(snapshot.last_fueling_hm,1)} HM`:"-";
    card.querySelector("[data-end]").textContent=number(el("hm")?.value)===null?"-":`${fmt(el("hm").value,1)} HM`;
    card.querySelector("[data-fc]").textContent=number(snapshot?.fc_standard_lphm)>0?`${fmt(snapshot.fc_standard_lphm,1)} L/HM`:"-";
    card.querySelector("[data-quota]").textContent=quota;
    card.querySelector("[data-note]").textContent=note||snapshot?.reason||"-";
  }

  function setManual(note){
    const q=el("maxQty");
    if(q){q.readOnly=false;q.classList.remove("kpp-quota-locked");}
    const label=q?.parentElement?.querySelector("label");if(label)label.textContent="Qty Jatah Manual (L)";
    paint({state:"MANUAL",kind:"warn",quota:"MANUAL",note});
    if(typeof updateLimit==="function")updateLimit();
  }

  function setBlocked(note){
    const q=el("maxQty");
    if(q){q.value="";q.readOnly=true;q.classList.remove("kpp-quota-locked");}
    paint({state:"REVIEW HM",kind:"error",quota:"-",note});
    if(typeof updateLimit==="function")updateLimit();
  }

  function applyQuota(){
    const q=el("maxQty");
    if(!q)return;
    const baseline=number(snapshot?.last_fueling_hm);
    const standard=number(snapshot?.fc_standard_lphm);
    const hm=number(el("hm")?.value);

    if(!snapshot){setManual("Pilih unit untuk membaca baseline dan FC dari server.");return;}
    if(baseline!==null && snapshot.baseline_valid!==true){setBlocked(snapshot.reason||"Baseline HM belum valid.");return;}
    if(baseline===null){setManual("Belum ada pengisian fuel valid sebagai baseline. Qty manual tersedia untuk first-use.");return;}
    if(!(standard>0)){setManual("FC standard belum tersedia. Qty jatah tetap manual.");return;}

    q.readOnly=true;
    q.classList.add("kpp-quota-locked");
    const label=q.parentElement?.querySelector("label");if(label)label.textContent="Qty Jatah Otomatis (L)";

    if(hm===null){q.value="";paint({state:"ISI HM CCR",quota:"-",note:"Masukkan HM penjatahan yang dibaca CCR. Qty dihitung otomatis dan tidak bisa diketik manual."});return;}
    if(hm<=baseline){q.value="";setBlocked(`HM Penjatahan CCR harus lebih besar dari HM pengisian terakhir ${fmt(baseline,1)} HM.`);return;}
    const runtime=Math.round((hm-baseline)*10)/10;
    if(runtime>72){q.value="";setBlocked(`Selisih ${fmt(runtime,1)} HM terlalu besar. Review HM unit/history sebelum membuat jatah.`);return;}
    const quota=Math.round(runtime*standard);
    if(!(quota>0)){q.value="";setBlocked("Hasil jatah otomatis tidak valid.");return;}
    q.value=String(quota);
    paint({state:"AUTO • QTY TERKUNCI",kind:"ready",quota:`${fmtL(quota)} L`,note:`(${fmt(hm,1)} - ${fmt(baseline,1)}) HM × ${fmt(standard,1)} L/HM = ${fmtL(quota)} L. Server menghitung ulang saat disimpan.`});
    if(typeof updateLimit==="function")updateLimit();
  }

  async function loadSnapshot(unit){
    const client=db();if(!client)throw new Error("Database belum siap.");
    const seq=++snapshotSeq;
    HM_REFERENCE_LOADING=true;
    const {data,error}=await client.rpc("ccr_auto_quota_preview",{p_unit:upper(unit)});
    if(error)throw error;
    if(seq!==snapshotSeq)return null;
    snapshot=data||{};
    setRef(snapshot);
    setTolerance(snapshot);
    applyQuota();
    return snapshot;
  }

  async function refreshSnapshot(){
    const unit=upper(el("unit")?.value);
    if(!unit){
      snapshot=null;CURRENT_HM_REF={hm:0,source:"Belum pilih unit"};HM_REFERENCE_LOADING=false;setRef(null);setTolerance(null);setManual("Pilih check-in atau unit terlebih dahulu.");return;
    }
    try{await loadSnapshot(unit);}catch(error){HM_REFERENCE_LOADING=false;snapshot=null;setTolerance(null);setBlocked(`Referensi HM gagal dibaca: ${error.message}`);}
  }

  function relabel(){
    const help=document.querySelector(".panel-monitor .checkin-head p");
    if(help)help.textContent="Pilih check-in unit. Untuk unit jatah, operator tidak perlu kirim HM kedua; CCR mengisi HM penjatahan.";
    const panelState=document.querySelector(".panel-allocation .panel-state");if(panelState)panelState.textContent="HM CCR";
    const hm=el("hm"),wrap=hm?.parentElement;
    const label=wrap?.querySelector("label"),hint=wrap?.querySelector(".input-help");
    if(label)label.textContent="HM Penjatahan CCR";
    if(hint)hint.textContent="Masukkan HM yang dibaca CCR saat membuat jatah. Field ini baru terkunci setelah jatah tersimpan.";
    const timeHelp=el("hmTakenTime")?.parentElement?.querySelector(".input-help");if(timeHelp)timeHelp.textContent="Waktu CCR membaca HM unit untuk penjatahan.";

    const tolerance=el("toleranceQty");
    if(tolerance){
      tolerance.readOnly=true;
      tolerance.classList.add("kpp-tolerance-locked");
      const toleranceWrap=tolerance.parentElement;
      const toleranceLabel=toleranceWrap?.querySelector("label");
      if(toleranceLabel)toleranceLabel.textContent="Limit Toleransi Penjatahan (L)";
      let toleranceHelp=toleranceWrap?.querySelector('[data-kpp-tolerance-help="1"]');
      if(!toleranceHelp){
        toleranceHelp=document.createElement("div");
        toleranceHelp.className="input-help";
        toleranceHelp.dataset.kppToleranceHelp="1";
        toleranceWrap?.appendChild(toleranceHelp);
      }
      if(toleranceHelp)toleranceHelp.textContent="Otomatis dari Master Unit dan dikunci untuk CCR. Perubahan master berlaku untuk jatah berikutnya.";
    }
  }

  function decorateRows(){
    const body=el("monitorBody");if(!body)return false;
    [...body.querySelectorAll("tr")].forEach(row=>{
      const original=row.querySelector('button[data-checkin]');if(!original)return;
      const id=clean(original.dataset.checkin);if(!id)return;
      original.style.display="none";
      [...original.parentElement.querySelectorAll(".input-help")].forEach(n=>{if(/menunggu operator mengirim hm aktual/i.test(n.textContent||""))n.style.display="none";});
      let button=row.querySelector("button[data-kpp-quota-checkin]");
      if(!button){
        button=document.createElement("button");button.type="button";button.className="btn-blue monitor-pick";button.dataset.kppQuotaCheckin=id;original.insertAdjacentElement("afterend",button);
        const note=document.createElement("div");note.className="input-help";note.dataset.kppQuotaPickHelp="1";note.textContent="Pilih → CCR isi HM penjatahan";button.insertAdjacentElement("afterend",note);
      }
      const desired=clean(original.textContent)||"PILIH";
      if(button.textContent!==desired)button.textContent=desired;
      button.disabled=picking;
      const statusCell=row.children?.[10];
      if(statusCell&&/MENUNGGU HM OPERATOR/i.test(statusCell.textContent||""))statusCell.textContent="CHECK-IN AKTIF";
    });
    return true;
  }

  function watchRows(){
    const body=el("monitorBody");if(!body)return false;
    observer?.disconnect();
    observer=new MutationObserver(()=>decorateRows());
    observer.observe(body,{childList:true});
    decorateRows();
    return true;
  }

  async function fetchCheckin(id){
    const client=db();if(!client)throw new Error("Database belum siap.");
    const {data,error}=await client.from("operator_unit_checkins").select("id,created_at,tanggal,jam,shift,unit,egi,operator_name,nrp,hm_awal,status,hm_actual,hm_actual_at,hm_actual_received_at,fuel_history_id").eq("id",id).maybeSingle();
    if(error)throw error;if(!data)throw new Error("Check-in tidak ditemukan. Refresh monitoring.");return data;
  }

  async function ensureAvailable(row){
    const op=window.KPPCCRMonitor?.operationalShift?.();if(!op)throw new Error("Jam operasional belum siap.");
    if(row.tanggal!==op.tanggal||row.shift!==op.shift)throw new Error("Check-in bukan milik shift aktif.");
    if(!["ACTIVE","READY"].includes(row.status))throw new Error(`Check-in tidak dapat dipilih. Status: ${row.status}.`);
    if(row.fuel_history_id!==null)throw new Error("Check-in sudah dipakai untuk pengisian.");
    const {data,error}=await db().from("ccr_allocations").select("id,status,filling_no").eq("operator_checkin_id",row.id).in("status",["ACTIVE","PENDING_GL","USED"]).limit(1);
    if(error)throw error;
    if(data?.length)throw new Error(`Check-in sudah punya jatah ke-${data[0].filling_no||"-"} (${data[0].status}). Selesaikan dahulu.`);
  }

  async function selectCheckin(id){
    if(picking)return;picking=true;decorateRows();
    const status=el("formStatus");
    try{
      const row=await fetchCheckin(id);await ensureAvailable(row);
      const unit=el("unit");unit.value=row.unit;
      CURRENT_OPERATOR_CHECKIN=row;
      el("tanggal").value=row.tanggal;el("shift").value=row.shift;el("operator").value=row.operator_name||"";el("operator").readOnly=true;
      el("hm").value="";el("hm").readOnly=false;el("hm").placeholder=`HM penjatahan, minimal ${fmt(row.hm_awal,1)}`;
      el("hmTakenTime").value=currentTime();el("hmTakenTime").readOnly=false;
      el("maxQty").value="";setTolerance(null);el("requestReason").value="";el("note").value="";
      const selected=el("checkinSelected");if(selected){selected.style.display="block";selected.innerHTML=`<b>Check-in terpilih:</b> ${esc(row.unit)} • ${esc(row.operator_name)} • NRP ${esc(row.nrp||"—")} • HM check-in ${fmt(row.hm_awal,1)}.<br><b>CCR isi HM penjatahan.</b> Operator unit jatah tidak perlu mengirim HM kedua.`;}
      if(typeof updateQrDisplay==="function")updateQrDisplay();
      await loadSnapshot(row.unit);
      if(typeof refreshFillingNo==="function")await refreshFillingNo();
      if(typeof updateHmIntel==="function")updateHmIntel();
      if(status)status.textContent="Check-in dipilih. Masukkan HM Penjatahan CCR; Qty Jatah dihitung otomatis dan Limit Toleransi diambil dari Master Unit.";
      el("hm").focus();
    }catch(error){if(status)status.textContent=`❌ ${error.message}`;}
    finally{picking=false;decorateRows();}
  }

  function patchEditTolerance(){
    if(editPatched||typeof window.openGlEdit!=="function")return false;
    editPatched=true;
    const original=window.openGlEdit;
    window.openGlEdit=function(...args){
      const result=original.apply(this,args);
      const tolerance=el("editTolerance");
      if(tolerance){
        tolerance.readOnly=true;
        tolerance.title="Limit toleransi adalah snapshot dari Master Unit dan tidak dapat diedit pada jatah yang sudah dibuat.";
      }
      return result;
    };
    return true;
  }

  async function saveQuota(event){
    event.preventDefault();event.stopImmediatePropagation();
    const btn=el("saveBtn"),status=el("formStatus");btn.disabled=true;btn.textContent="MENYIMPAN...";status.textContent="Memeriksa HM penjatahan, toleransi master, dan jatah server...";
    try{
      const pending=readCcrAllocationPending();
      if(pending){const recovered=await submitCcrAllocationReliable();if(recovered.error)throw recovered.error;alert(`✅ Jatah ${recovered.data?.unit||""} pengisian ke-${recovered.data?.filling_no||"-"} sudah terkonfirmasi di server.`);location.reload();return;}
      if(CURRENT_OPERATOR_CHECKIN){const fresh=await fetchCheckin(CURRENT_OPERATOR_CHECKIN.id);await ensureAvailable(fresh);if(upper(fresh.unit)!==upper(el("unit").value)||fresh.tanggal!==el("tanggal").value||fresh.shift!==el("shift").value)throw new Error("Pilihan unit/tanggal/shift berubah. Pilih ulang check-in.");CURRENT_OPERATOR_CHECKIN=fresh;el("operator").value=fresh.operator_name||"";}
      const next=await refreshFillingNo();
      await refreshSnapshot();
      applyQuota();
      const err=validate(next);if(err)throw new Error(err);
      const unit=upper(el("unit").value);
      const payload={tanggal:el("tanggal").value,shift:el("shift").value,unit,barcode_code:unit,nrp:CURRENT_OPERATOR_CHECKIN?.nrp||null,operator_unit:clean(el("operator").value),hm_previous_ref:CURRENT_HM_REF.hm>0?Number(CURRENT_HM_REF.hm):null,hm_previous_source:CURRENT_HM_REF.source||null,hm_ccr:number(el("hm").value),hm_taken_time:el("hmTakenTime").value,hm_work_since_previous:(CURRENT_HM_REF.hm>0&&number(el("hm").value)!==null&&number(el("hm").value)>=CURRENT_HM_REF.hm)?Math.round((number(el("hm").value)-CURRENT_HM_REF.hm)*10)/10:null,max_qty:number(el("maxQty").value),tolerance_qty:number(el("toleranceQty").value),request_reason:next>=2?clean(el("requestReason").value):null,note:clean(el("note").value)||null,created_by:window.KPP_SESSION?.user?.id||null,created_by_name:PROFILE?.display_name||null,created_by_role:PROFILE?.role||null,operator_checkin_id:CURRENT_OPERATOR_CHECKIN?.id||null,operator_hm_awal:CURRENT_OPERATOR_CHECKIN?.hm_awal??null,operator_checkin_at:CURRENT_OPERATOR_CHECKIN?.created_at||null};
      const result=await submitCcrAllocationReliable(payload);if(result.error)throw result.error;
      const data=result.data,limit=Number(data.max_qty||0)+Number(data.tolerance_qty||0);
      status.innerHTML=data.status==="ACTIVE"?`✅ <b>${esc(data.unit)} — Pengisian ke-${data.filling_no} ACTIVE.</b> HM CCR ${fmt(data.hm_ccr,1)} • Jatah ${fmtL(data.max_qty)} L • Toleransi ${fmtL(data.tolerance_qty)} L • Batas ${fmtL(limit)} L.`:`🟡 <b>${esc(data.unit)} — Pengisian ke-${data.filling_no} PENDING GL.</b> Jatah ${fmtL(data.max_qty)} L + toleransi ${fmtL(data.tolerance_qty)} L menunggu approval.`;
      if(typeof loadRows==="function")await loadRows();CURRENT_OPERATOR_CHECKIN=null;CHECKIN_MONITOR?.clearSelection?.();if(typeof loadOperatorCheckins==="function")await loadOperatorCheckins();
      el("operator").value="";el("operator").readOnly=false;el("hm").value="";el("hm").readOnly=false;el("hmTakenTime").value=currentTime();el("maxQty").value="";el("maxQty").readOnly=false;el("maxQty").classList.remove("kpp-quota-locked");setTolerance(null);el("requestReason").value="";el("note").value="";const selected=el("checkinSelected");if(selected){selected.style.display="none";selected.textContent="";}snapshot=null;await refreshFillingNo();if(typeof updateLimit==="function")updateLimit();if(typeof updateHmIntel==="function")updateHmIntel();
    }catch(error){console.error(error);status.textContent=`❌ ${error.message}`;}
    finally{btn.disabled=false;btn.textContent="💾 SIMPAN JATAH";}
  }

  function bind(){
    ensureStyle();quotaCard();relabel();patchEditTolerance();
    let tries=0;const timer=setInterval(()=>{tries++;relabel();patchEditTolerance();if(watchRows()||tries>=60)clearInterval(timer);},100);
    document.addEventListener("click",event=>{const button=event.target.closest?.("button[data-kpp-quota-checkin]");if(!button)return;event.preventDefault();selectCheckin(button.dataset.kppQuotaCheckin);},true);
    el("saveBtn")?.addEventListener("click",saveQuota,true);
    el("hm")?.addEventListener("input",applyQuota);
    el("hm")?.addEventListener("change",applyQuota);
    el("unit")?.addEventListener("input",()=>{clearTimeout(inputTimer);inputTimer=setTimeout(refreshSnapshot,300);});
    el("unit")?.addEventListener("change",()=>setTimeout(refreshSnapshot,0));
    setTimeout(()=>{const unit=upper(el("unit")?.value);if(unit)refreshSnapshot();else{setTolerance(null);setManual("Pilih check-in atau unit terlebih dahulu.");}},0);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
})();
