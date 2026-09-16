// KPP-FMS CCR Quota Input v3
// CCR memilih check-in, memasukkan HM penjatahan, lalu Qty Jatah dihitung otomatis dan dikunci.
(() => {
  "use strict";

  const client=()=>window.KPP?.db||window.kppDb||null;
  const clean=v=>String(v??"").trim();
  const upper=v=>clean(v).toUpperCase();
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt=v=>Number.isFinite(Number(v))?new Intl.NumberFormat("id-ID",{maximumFractionDigits:1}).format(Number(v)):"—";
  let picking=false;
  let observer=null;

  function currentTime(){
    return window.KPPTime?.localTime?.().slice(0,5)
      || window.KPPCCRMonitor?.siteParts?.()?.time?.slice(0,5)
      || "";
  }

  function relabel(){
    const monitorHelp=document.querySelector(".panel-monitor .checkin-head p");
    if(monitorHelp)monitorHelp.textContent="Pilih check-in unit. HM penjatahan diisi CCR, lalu Qty Jatah dihitung otomatis dari selisih HM × FC.";

    const hm=document.getElementById("hm");
    const hmWrap=hm?.parentElement;
    const hmLabel=hmWrap?.querySelector("label");
    const hmHelp=hmWrap?.querySelector(".input-help");
    if(hmLabel)hmLabel.textContent="HM Penjatahan CCR";
    if(hmHelp)hmHelp.textContent="Masukkan HM yang dibaca CCR saat unit akan diberi jatah. HM ini tidak dikunci sebelum jatah disimpan.";

    const time=document.getElementById("hmTakenTime");
    const timeHelp=time?.parentElement?.querySelector(".input-help");
    if(timeHelp)timeHelp.textContent="Waktu CCR membaca HM unit untuk penjatahan.";
  }

  function decorateRows(){
    const body=document.getElementById("monitorBody");
    if(!body)return false;
    [...body.querySelectorAll("tr")].forEach(row=>{
      const original=row.querySelector('button[data-checkin]');
      if(!original)return;
      const id=clean(original.dataset.checkin);
      if(!id)return;

      original.style.display="none";
      const oldHelp=[...original.parentElement.querySelectorAll(".input-help")].find(el=>/menunggu operator mengirim hm aktual/i.test(el.textContent||""));
      if(oldHelp)oldHelp.style.display="none";

      let button=row.querySelector("button[data-kpp-quota-checkin]");
      if(!button){
        button=document.createElement("button");
        button.type="button";
        button.className="btn-blue monitor-pick";
        button.dataset.kppQuotaCheckin=id;
        original.insertAdjacentElement("afterend",button);
        const note=document.createElement("div");
        note.className="input-help";
        note.dataset.kppQuotaPickHelp="1";
        note.textContent="Pilih → CCR isi HM penjatahan";
        button.insertAdjacentElement("afterend",note);
      }
      button.textContent=clean(original.textContent)||"PILIH";
      button.disabled=picking;
    });
    return true;
  }

  function startObserver(){
    const body=document.getElementById("monitorBody");
    if(!body)return false;
    observer?.disconnect();
    observer=new MutationObserver(decorateRows);
    observer.observe(body,{childList:true,subtree:true});
    decorateRows();
    return true;
  }

  async function fetchCheckin(id){
    const db=client();
    if(!db)throw new Error("Database belum siap.");
    const {data,error}=await db.from("operator_unit_checkins")
      .select("id,created_at,tanggal,jam,shift,unit,egi,operator_name,nrp,hm_awal,status,hm_actual,hm_actual_at,hm_actual_received_at,fuel_history_id")
      .eq("id",id).maybeSingle();
    if(error)throw error;
    if(!data)throw new Error("Check-in tidak ditemukan. Refresh monitoring.");
    return data;
  }

  async function ensureAvailable(row){
    const op=window.KPPCCRMonitor?.operationalShift?.();
    if(!op)throw new Error("Jam operasional belum siap.");
    if(row.tanggal!==op.tanggal||row.shift!==op.shift)throw new Error("Check-in bukan milik shift aktif.");
    if(!["ACTIVE","READY"].includes(row.status))throw new Error(`Check-in tidak dapat dipilih. Status: ${row.status}.`);
    if(row.fuel_history_id!==null)throw new Error("Check-in sudah dipakai untuk pengisian.");

    const db=client();
    const {data,error}=await db.from("ccr_allocations")
      .select("id,status,filling_no")
      .eq("operator_checkin_id",row.id)
      .in("status",["ACTIVE","PENDING_GL","USED"])
      .limit(1);
    if(error)throw error;
    if(data?.length){
      const a=data[0];
      throw new Error(`Check-in sudah punya jatah ke-${a.filling_no||"-"} (${a.status}). Selesaikan dahulu.`);
    }
  }

  async function selectCheckin(id){
    if(picking)return;
    picking=true;
    decorateRows();
    const status=document.getElementById("formStatus");
    try{
      const row=await fetchCheckin(id);
      await ensureAvailable(row);

      const unit=document.getElementById("unit");
      unit.value=row.unit;
      unit.dispatchEvent(new Event("input",{bubbles:true}));

      if(typeof CURRENT_OPERATOR_CHECKIN!=="undefined")CURRENT_OPERATOR_CHECKIN=row;

      document.getElementById("tanggal").value=row.tanggal;
      document.getElementById("shift").value=row.shift;
      document.getElementById("operator").value=row.operator_name||"";
      document.getElementById("operator").readOnly=true;

      const hm=document.getElementById("hm");
      hm.value="";
      hm.readOnly=false;
      hm.placeholder=`HM sekarang, minimal ${fmt(row.hm_awal)}`;

      const hmTime=document.getElementById("hmTakenTime");
      hmTime.value=currentTime();
      hmTime.readOnly=false;

      document.getElementById("maxQty").value="";
      document.getElementById("toleranceQty").value="0";
      document.getElementById("requestReason").value="";
      document.getElementById("note").value="";

      const selected=document.getElementById("checkinSelected");
      if(selected){
        selected.style.display="block";
        selected.innerHTML=`<b>Check-in terpilih:</b> ${esc(row.unit)} • ${esc(row.operator_name)} • NRP ${esc(row.nrp||"—")} • HM check-in ${fmt(row.hm_awal)}.<br><b>CCR isi HM penjatahan sekarang.</b> Sistem memakai HM pengisian terakhir sebagai baseline dan mengunci Qty Jatah otomatis.`;
      }

      if(typeof updateQrDisplay==="function")updateQrDisplay();
      if(typeof loadHmReference==="function")await loadHmReference();
      if(typeof refreshFillingNo==="function")await refreshFillingNo();
      if(typeof updateHmIntel==="function")updateHmIntel();
      if(typeof updateLimit==="function")updateLimit();
      if(status)status.textContent="Check-in dipilih. Masukkan HM Penjatahan CCR; Qty Jatah akan dihitung otomatis dan dikunci.";
      hm.focus();
    }catch(error){
      if(status)status.textContent=`❌ ${error.message}`;
    }finally{
      picking=false;
      decorateRows();
    }
  }

  async function saveQuota(event){
    event.preventDefault();
    event.stopImmediatePropagation();

    const btn=document.getElementById("saveBtn");
    const status=document.getElementById("formStatus");
    btn.disabled=true;
    btn.textContent="MENYIMPAN...";
    status.textContent="Memeriksa ritasi dan HM penjatahan...";

    try{
      const pendingBeforeInput=readCcrAllocationPending();
      if(pendingBeforeInput){
        status.textContent="Memeriksa pengiriman jatah sebelumnya...";
        const recovered=await submitCcrAllocationReliable();
        if(recovered.error)throw recovered.error;
        const row=recovered.data;
        alert(`✅ Jatah ${row?.unit||""} pengisian ke-${row?.filling_no||"-"} sudah terkonfirmasi di server.`);
        location.reload();
        return;
      }

      const enteredHm=document.getElementById("hm").value;
      const enteredTime=document.getElementById("hmTakenTime").value;

      if(typeof CURRENT_OPERATOR_CHECKIN!=="undefined"&&CURRENT_OPERATOR_CHECKIN){
        const fresh=await fetchCheckin(CURRENT_OPERATOR_CHECKIN.id);
        await ensureAvailable(fresh);
        if(upper(fresh.unit)!==upper(document.getElementById("unit").value)
          || fresh.tanggal!==document.getElementById("tanggal").value
          || fresh.shift!==document.getElementById("shift").value){
          throw new Error("Pilihan unit/tanggal/shift berubah. Pilih ulang check-in.");
        }
        CURRENT_OPERATOR_CHECKIN=fresh;
        document.getElementById("operator").value=fresh.operator_name||"";
      }

      document.getElementById("hm").value=enteredHm;
      document.getElementById("hm").readOnly=false;
      document.getElementById("hmTakenTime").value=enteredTime;
      document.getElementById("hmTakenTime").readOnly=false;

      const next=await refreshFillingNo();
      const err=validate(next);
      if(err)throw new Error(err);

      const unit=upper(document.getElementById("unit").value);
      const payload={
        tanggal:document.getElementById("tanggal").value,
        shift:document.getElementById("shift").value,
        unit,
        barcode_code:unit,
        nrp:CURRENT_OPERATOR_CHECKIN?.nrp||null,
        operator_unit:clean(document.getElementById("operator").value),
        hm_previous_ref:CURRENT_HM_REF.hm>0?Number(CURRENT_HM_REF.hm):null,
        hm_previous_source:CURRENT_HM_REF.source||null,
        hm_ccr:num(document.getElementById("hm").value),
        hm_taken_time:document.getElementById("hmTakenTime").value,
        hm_work_since_previous:(CURRENT_HM_REF.hm>0&&num(document.getElementById("hm").value)!==null&&num(document.getElementById("hm").value)>=CURRENT_HM_REF.hm)
          ? Math.round((num(document.getElementById("hm").value)-CURRENT_HM_REF.hm)*10)/10
          : null,
        max_qty:num(document.getElementById("maxQty").value),
        tolerance_qty:num(document.getElementById("toleranceQty").value)||0,
        request_reason:next>=2?clean(document.getElementById("requestReason").value):null,
        note:clean(document.getElementById("note").value)||null,
        created_by:window.KPP_SESSION?.user?.id||null,
        created_by_name:PROFILE?.display_name||null,
        created_by_role:PROFILE?.role||null,
        operator_checkin_id:CURRENT_OPERATOR_CHECKIN?.id||null,
        operator_hm_awal:CURRENT_OPERATOR_CHECKIN?.hm_awal??null,
        operator_checkin_at:CURRENT_OPERATOR_CHECKIN?.created_at||null
      };

      const result=await submitCcrAllocationReliable(payload);
      if(result.error){
        const m=String(result.error.message||"");
        if(m.includes("ccr_one_pending_per_unit"))throw new Error(`${unit} masih punya pengajuan PENDING GL. Selesaikan pengajuan itu dulu.`);
        if(m.includes("ccr_one_active_per_unit"))throw new Error(`${unit} masih punya jatah ACTIVE. Selesaikan jatah itu dahulu.`);
        throw result.error;
      }

      const data=result.data;
      const limit=Number(data.max_qty||0)+Number(data.tolerance_qty||0);
      if(data.status==="ACTIVE"){
        status.innerHTML=`✅ <b>${esc(data.unit)} — Pengisian ke-${data.filling_no} ACTIVE.</b> ${esc(data.operator_unit)} • HM ${fmt(data.hm_ccr)} • Jatah ${fmt(data.max_qty)} L • Batas ${fmt(limit)} L.`;
      }else{
        status.innerHTML=`🟡 <b>${esc(data.unit)} — Pengisian ke-${data.filling_no} PENDING GL.</b> Jatah ${fmt(data.max_qty)} L menunggu approval.`;
      }

      if(typeof loadRows==="function")await loadRows();
      if(typeof CURRENT_OPERATOR_CHECKIN!=="undefined")CURRENT_OPERATOR_CHECKIN=null;
      CHECKIN_MONITOR?.clearSelection?.();
      if(typeof loadOperatorCheckins==="function")await loadOperatorCheckins();

      document.getElementById("operator").value="";
      document.getElementById("operator").readOnly=false;
      document.getElementById("hm").value="";
      document.getElementById("hm").readOnly=false;
      document.getElementById("hmTakenTime").value=currentTime();
      document.getElementById("hmTakenTime").readOnly=false;
      document.getElementById("maxQty").value="";
      document.getElementById("toleranceQty").value="0";
      document.getElementById("requestReason").value="";
      document.getElementById("note").value="";
      const selected=document.getElementById("checkinSelected");
      if(selected){selected.style.display="none";selected.textContent="";}

      await refreshFillingNo();
      updateLimit();
      updateHmIntel();
    }catch(error){
      console.error(error);
      status.textContent=`❌ ${error.message}`;
    }finally{
      btn.disabled=false;
      btn.textContent="💾 SIMPAN JATAH";
    }
  }

  function bind(){
    relabel();
    startObserver();

    document.addEventListener("click",event=>{
      const button=event.target.closest?.("button[data-kpp-quota-checkin]");
      if(!button)return;
      event.preventDefault();
      selectCheckin(button.dataset.kppQuotaCheckin);
    },true);

    document.getElementById("saveBtn")?.addEventListener("click",saveQuota,true);

    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      relabel();
      if(startObserver()||tries>=80)clearInterval(timer);
    },100);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(bind,0),{once:true});
  else setTimeout(bind,0);
})();
