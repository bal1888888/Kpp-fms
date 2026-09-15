// KPP-FMS CCR Direct HM v1
// Operator tetap check-in untuk identitas. Jika HM kedua belum dikirim operator,
// CCR dapat membaca HM unit langsung, mengunci HM tersebut di server, lalu alur jatah lama tetap dipakai.
(() => {
  "use strict";

  let directSelection=null;
  let claiming=false;
  let monitorObserver=null;

  const db=()=>window.KPP?.db||window.kppDb||null;
  const clean=value=>String(value??"").trim();
  const upper=value=>clean(value).toUpperCase();
  const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

  function setText(selector,text){
    const node=document.querySelector(selector);
    if(node)node.textContent=text;
  }

  function installStyle(){
    if(document.getElementById("kppCcrDirectHmStyle"))return;
    const style=document.createElement("style");
    style.id="kppCcrDirectHmStyle";
    style.textContent=`
      .kpp-direct-hm-btn{display:block;width:100%;margin-top:6px;padding:7px 8px;border:0;border-radius:8px;background:#0f766e;color:#fff;font-size:9px;font-weight:900;cursor:pointer}
      .kpp-direct-hm-btn:hover{filter:brightness(1.06)}
      .kpp-direct-hm-note{margin-top:5px;font-size:9px;line-height:1.35;color:#0f766e;font-weight:800}
      .kpp-ccr-hm-source{margin-top:7px;padding:8px 10px;border-radius:9px;background:#ecfeff;border:1px solid #a5f3fc;color:#155e75;font-size:10px;font-weight:800;line-height:1.45}
    `;
    document.head.appendChild(style);
  }

  function relabelUi(){
    setText(".panel-monitor .checkin-head p","Check-in tetap untuk identitas unit/operator. Jika HM operator belum dikirim, CCR bisa baca HM unit langsung.");

    const hm=document.getElementById("hm");
    const hmGroup=hm?.closest(".form-group")||hm?.parentElement;
    const hmLabel=hmGroup?.querySelector("label");
    const hmHelp=hmGroup?.querySelector(".input-help");
    if(hmLabel)hmLabel.textContent="HM Aktual CCR";
    if(hmHelp)hmHelp.textContent="Baca HM unit saat membuat jatah. HM kedua dari operator tidak wajib.";

    const time=document.getElementById("hmTakenTime");
    const timeGroup=time?.closest(".form-group")||time?.parentElement;
    const timeHelp=timeGroup?.querySelector(".input-help");
    if(timeHelp)timeHelp.textContent="Waktu CCR membaca HM unit. Otomatis diisi waktu WIB saat check-in dipilih.";
  }

  function waitingForOperatorHm(row){
    const text=upper(row?.textContent);
    return text.includes("MENUNGGU HM OPERATOR") || text.includes("MENUNGGU OPERATOR MENGIRIM HM AKTUAL");
  }

  function decorateMonitorRows(){
    const body=document.getElementById("monitorBody");
    if(!body)return;
    [...body.querySelectorAll("tr")].forEach(row=>{
      const pick=row.querySelector('button[data-checkin]');
      if(!pick||row.querySelector(".kpp-direct-hm-btn")||!waitingForOperatorHm(row))return;
      const id=clean(pick.dataset.checkin);
      if(!id)return;
      const button=document.createElement("button");
      button.type="button";
      button.className="kpp-direct-hm-btn";
      button.dataset.directCheckin=id;
      button.textContent="CCR INPUT HM";
      pick.insertAdjacentElement("afterend",button);
      const note=document.createElement("div");
      note.className="kpp-direct-hm-note";
      note.textContent="Operator tidak perlu kirim HM kedua.";
      button.insertAdjacentElement("afterend",note);
    });
  }

  function startMonitorObserver(){
    const body=document.getElementById("monitorBody");
    if(!body)return false;
    monitorObserver?.disconnect();
    monitorObserver=new MutationObserver(decorateMonitorRows);
    monitorObserver.observe(body,{childList:true,subtree:true});
    decorateMonitorRows();
    return true;
  }

  async function fetchCheckin(id){
    const client=db();
    if(!client)throw new Error("Database belum siap.");
    const {data,error}=await client
      .from("operator_unit_checkins")
      .select("id,created_at,tanggal,jam,shift,unit,egi,operator_name,nrp,hm_awal,status,hm_actual,hm_actual_at,hm_actual_received_at,hm_actual_source,fuel_history_id,expired_at,expired_reason")
      .eq("id",id)
      .maybeSingle();
    if(error)throw error;
    if(!data)throw new Error("Check-in tidak ditemukan. Refresh monitoring.");
    return data;
  }

  async function ensureNoBusyAllocation(checkinId){
    const client=db();
    const {data,error}=await client
      .from("ccr_allocations")
      .select("id,status,filling_no")
      .eq("operator_checkin_id",checkinId)
      .in("status",["ACTIVE","PENDING_GL","USED"])
      .limit(1);
    if(error)throw error;
    if(data?.length){
      const row=data[0];
      throw new Error(`Check-in ini sudah punya jatah ke-${row.filling_no||"-"} (${row.status}). Selesaikan jatah itu dahulu.`);
    }
  }

  function currentSiteTime(){
    return window.KPPTime?.localTime?.()||"";
  }

  async function selectDirectCheckin(id){
    const status=document.getElementById("formStatus");
    try{
      const row=await fetchCheckin(id);
      const op=window.KPPCCRMonitor?.operationalShift?.();
      if(!op)throw new Error("Jam operasional belum siap.");
      if(row.tanggal!==op.tanggal||row.shift!==op.shift)throw new Error("Check-in bukan milik shift aktif.");
      if(row.status!=="ACTIVE"||row.hm_actual!==null)throw new Error("HM check-in sudah tersedia atau status berubah. Refresh monitoring.");
      if(row.fuel_history_id!==null)throw new Error("Check-in sudah dipakai untuk pengisian.");
      await ensureNoBusyAllocation(row.id);

      if(typeof window.showSelectedCheckin==="function")window.showSelectedCheckin(row);
      document.getElementById("tanggal").value=row.tanggal;
      document.getElementById("shift").value=row.shift;
      document.getElementById("unit").value=row.unit;
      document.getElementById("operator").value=row.operator_name||"";
      document.getElementById("hm").value="";
      document.getElementById("hmTakenTime").value=currentSiteTime();
      document.getElementById("maxQty").value="";
      document.getElementById("toleranceQty").value="0";
      document.getElementById("requestReason").value="";
      document.getElementById("note").value="";

      directSelection={id:row.id,unit:upper(row.unit),tanggal:row.tanggal,shift:row.shift};

      const selected=document.getElementById("checkinSelected");
      if(selected){
        selected.style.display="block";
        selected.innerHTML=`<b>Check-in terpilih:</b> ${esc(row.unit)} - ${esc(row.operator_name)} - NRP ${esc(row.nrp||"—")} - HM Awal ${row.hm_awal??"—"}.<div class="kpp-ccr-hm-source">HM kedua belum dikirim operator. Baca HM unit lalu isi <b>HM Aktual CCR</b>. Saat SIMPAN JATAH, server mengunci HM itu sebagai sumber CCR.</div>`;
      }

      if(typeof window.updateQrDisplay==="function")window.updateQrDisplay();
      if(typeof window.loadHmReference==="function")await window.loadHmReference();
      if(typeof window.refreshFillingNo==="function")await window.refreshFillingNo();
      if(typeof window.updateHmIntel==="function")window.updateHmIntel();
      if(status)status.textContent="Check-in aktif dipilih. Masukkan HM aktual yang dibaca CCR, lalu SIMPAN JATAH.";
      document.getElementById("hm")?.focus();
    }catch(error){
      directSelection=null;
      if(status)status.textContent=`❌ ${error.message}`;
    }
  }

  function identityStillMatches(){
    if(!directSelection)return false;
    return upper(document.getElementById("unit")?.value)===directSelection.unit
      && document.getElementById("tanggal")?.value===directSelection.tanggal
      && document.getElementById("shift")?.value===directSelection.shift;
  }

  async function claimHmAndContinue(event){
    if(!directSelection||claiming)return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const btn=document.getElementById("saveBtn");
    const status=document.getElementById("formStatus");
    const hm=Number(document.getElementById("hm")?.value);
    const taken=clean(document.getElementById("hmTakenTime")?.value);

    if(!identityStillMatches()){
      directSelection=null;
      if(status)status.textContent="❌ Unit/tanggal/shift berubah. Pilih ulang check-in.";
      return;
    }
    if(!Number.isFinite(hm)||hm<0){
      if(status)status.textContent="❌ HM Aktual CCR wajib diisi dengan benar.";
      document.getElementById("hm")?.focus();
      return;
    }
    if(!taken){
      if(status)status.textContent="❌ Jam pembacaan HM CCR wajib diisi.";
      document.getElementById("hmTakenTime")?.focus();
      return;
    }

    claiming=true;
    if(btn){btn.disabled=true;btn.textContent="MENGUNCI HM CCR...";}
    if(status)status.textContent="Mengunci HM CCR ke check-in...";
    try{
      const client=db();
      if(!client)throw new Error("Database belum siap.");
      const {data,error}=await client.rpc("ccr_set_checkin_hm",{
        p_checkin_id:directSelection.id,
        p_hm:hm,
        p_hm_taken_time:taken
      });
      if(error)throw error;
      if(!data?.ok)throw new Error(data?.message||"Server tidak mengonfirmasi HM CCR.");

      directSelection=null;
      claiming=false;
      if(status)status.textContent="✅ HM CCR terkunci. Menyimpan jatah...";
      if(typeof window.save!=="function")throw new Error("Fungsi simpan jatah belum siap. Refresh halaman lalu ulangi.");
      await window.save();
      return;
    }catch(error){
      claiming=false;
      if(btn){btn.disabled=false;btn.textContent="SIMPAN JATAH";}
      if(status)status.textContent=`❌ ${error.message}`;
    }
  }

  function bindEvents(){
    document.addEventListener("click",event=>{
      const button=event.target.closest?.("button[data-direct-checkin]");
      if(!button)return;
      event.preventDefault();
      selectDirectCheckin(button.dataset.directCheckin);
    });

    document.getElementById("saveBtn")?.addEventListener("click",claimHmAndContinue,true);

    ["unit","tanggal","shift"].forEach(id=>{
      document.getElementById(id)?.addEventListener("change",()=>{
        if(directSelection&&!identityStillMatches())directSelection=null;
      });
    });
  }

  function install(){
    installStyle();
    relabelUi();
    bindEvents();
    startMonitorObserver();

    let tries=0;
    const timer=setInterval(()=>{
      tries++;
      relabelUi();
      if(startMonitorObserver()||tries>=80)clearInterval(timer);
    },100);
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>setTimeout(install,0),{once:true});
  else setTimeout(install,0);
})();
