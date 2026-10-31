/* KPP-FMS: isolated Admin/GL late-transfer UI. No change to saveTransfer(). */
(function(){
  "use strict";
  const roles=new Set(["admin","gl"]);
  const element=id=>document.getElementById(id);
  const key=()=> "kpp-late-transfer-request-v1:"+(window.KPP_SESSION?.user?.id||"unknown");
  const liters=value=>Number(value).toLocaleString("id-ID",{maximumFractionDigits:1})+" L";
  let busy=false;

  function allowed(){
    return typeof CURRENT_PROFILE!=="undefined" && roles.has(CURRENT_PROFILE?.role);
  }
  function message(text,isError){
    const e=element("lateTransferStatus");
    if(!e)return;
    e.textContent=text;
    e.style.color=isError?"#b91c1c":"#065f46";
  }
  function requestId(){
    if(window.crypto?.randomUUID)return window.crypto.randomUUID();
    const a=new Uint8Array(16);
    window.crypto.getRandomValues(a);
    a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
    return [...a].map((v,i)=>([4,6,8,10].includes(i)?"-":"")+v.toString(16).padStart(2,"0")).join("");
  }
  function pending(){
    const raw=localStorage.getItem(key());
    if(!raw)return null;
    let r;
    try{r=JSON.parse(raw);}catch{throw new Error("ID transaksi tertunda tidak terbaca. Periksa Audit; jangan kirim ulang secara manual.");}
    if(!r||!r.id||!r.payload||!r.reason||!r.recorded_at)
      throw new Error("Transaksi tertunda tidak lengkap. Periksa Audit sebelum melanjutkan.");
    return r;
  }
  function mount(){
    const base=document.querySelector(".transfer-panel");
    if(!base||element("lateTransferPanel"))return;
    const section=document.createElement("details");
    section.id="lateTransferPanel";
    section.hidden=true;
    section.style.cssText="margin-top:18px;padding:14px;border:1px solid #93c5fd;border-radius:12px;background:#eff6ff";
    section.innerHTML=[
      '<summary style="cursor:pointer;font-weight:800;color:#1e40af;font-size:14px">TRANSFER SUSULAN SETELAH CLOSING — ADMIN / GL</summary>',
      '<p style="font-size:12px;line-height:1.6;color:#475569">Pakai form sonding Transfer di atas untuk MT sumber dan FT tujuan. Pilih tanggal dan shift transfer ASLI. Closing fisik dan Opening berikutnya tetap tidak berubah.</p>',
      '<div class="grid"><div><label for="lateTransferTime">Jam transfer sebenarnya (WIB)</label><input id="lateTransferTime" type="time" step="60"></div>',
      '<div><label for="lateTransferReason">Alasan koreksi (10–500 karakter)</label><textarea id="lateTransferReason" maxlength="500" rows="2" placeholder="Mengapa transfer baru dicatat setelah Closing?"></textarea></div></div>',
      '<div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">',
      '<button class="primary" id="lateTransferSave" type="button" style="min-height:50px">SIMPAN TRANSFER SUSULAN</button>',
      '<button class="gray" id="lateTransferAuditButton" type="button" style="min-height:48px">LIHAT RIWAYAT KOREKSI</button></div>',
      '<div id="lateTransferStatus" role="status" aria-live="polite" style="margin-top:10px;font-size:12px;white-space:pre-line"></div>',
      '<div id="lateTransferHistory" aria-live="polite" style="margin-top:10px;font-size:12px"></div>'
    ].join("");
    base.appendChild(section);
    element("lateTransferSave").addEventListener("click",save);
    element("lateTransferAuditButton").addEventListener("click",loadAudit);
    ["tanggal","shift"].forEach(id=>element(id)?.addEventListener("change",()=>{
      element("lateTransferHistory")?.replaceChildren();
      message("Periode berubah. Periksa lagi bukti transfer.",false);
    }));
    show();
  }
  function show(){
    const panel=element("lateTransferPanel");
    if(panel)panel.hidden=!allowed();
  }
  function collect(){
    const {tanggal,shift}=getPeriod();
    const source=element("transferSource")?.value||"";
    const destination=element("transferDestination")?.value||"";
    const time=element("lateTransferTime")?.value||"";
    const reason=element("lateTransferReason")?.value.trim()||"";
    if(!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)||![1,2].includes(shift))
      throw new Error("Tanggal/shift transfer belum valid.");
    if(!source||!destination||source===destination)
      throw new Error("Pilih MT sumber dan FT tujuan yang berbeda.");
    const src=STORAGE_ROWS.find(row=>row.code===source && row.active!==false);
    const dst=STORAGE_ROWS.find(row=>row.code===destination && row.active!==false);
    if(src?.storage_type!=="MT"||dst?.storage_type!=="FT")
      throw new Error("Transfer susulan hanya mendukung MT sumber ke FT tujuan.");
    if(!/^\d{2}:\d{2}$/.test(time))
      throw new Error("Isi jam fisik transfer sebenarnya.");
    if(reason.length<10||reason.length>500)
      throw new Error("Alasan koreksi harus 10–500 karakter.");
    const m=updateTransferCalculation();
    if(!m||!m.sourceBefore||!m.sourceAfter||!m.destinationBefore||!m.destinationAfter)
      throw new Error("Lengkapi sounding sebelum/sesudah, baik MT maupun FT.");
    if(!(Number(m.sourceQty)>0)||!(Number(m.destinationQty)>0)||!Number.isFinite(Number(m.loss)))
      throw new Error("Sonding MT harus turun dan FT harus naik dengan qty yang valid.");
    if(!validateCapacityHard(destination,m.destinationAfter.liters,"Transfer susulan"))
      throw new Error("Sonding tujuan melewati kapasitas.");
    const operator=soundingOfficerName()||CURRENT_PROFILE?.display_name||CURRENT_PROFILE?.username;
    if(!operator)throw new Error("Identitas akun belum tersedia.");
    const payload={
      tanggal,jam:time+":00",shift,jenis:"TRANSFER",operation_mode:"BACKFILL",
      source_storage:source,destination_storage:destination,operator,
      calculation_method:"TRANSFER_SOURCE_AND_DESTINATION_TERA",tera_version:TERA.version,
      source_height_before_cm:m.sourceBefore.matchedHeightCm,
      source_liter_before:m.sourceBefore.liters,
      source_height_after_cm:m.sourceAfter.matchedHeightCm,
      source_liter_after:m.sourceAfter.liters,
      destination_height_before_cm:m.destinationBefore.matchedHeightCm,
      destination_liter_before:m.destinationBefore.liters,
      destination_height_after_cm:m.destinationAfter.matchedHeightCm,
      destination_liter_after:m.destinationAfter.liters,
      source_measured_qty:Number(m.sourceQty),
      destination_measured_qty:Number(m.destinationQty),
      measurement_loss_qty:Number(m.loss),
      qty:Number(m.destinationQty),
      note:"Dicatat susulan oleh "+operator
    };
    return {tanggal,shift,source,destination,time,reason,m,payload};
  }
  async function dispatch(request){
    const {data,error}=await db.rpc("save_late_stock_transfer",{
      p_request_id:request.id,p_payload:request.payload,
      p_reason:request.reason,p_recorded_at:request.recorded_at
    });
    if(error||!data||typeof data.ok!=="boolean")
      throw new Error("Status transaksi belum terkonfirmasi. ID pengiriman tetap tersimpan. Tekan SIMPAN lagi untuk mengecek pengiriman yang sama. "+(error?.message||""));
    if(!data.ok){
      localStorage.removeItem(key());
      throw new Error(data.message||"Transfer ditolak. Isian sounding tidak dihapus.");
    }
    localStorage.removeItem(key());
    return data;
  }
  function unchanged(input){
    const p=getPeriod();
    return p.tanggal===input.tanggal&&p.shift===input.shift&&
      element("transferSource")?.value===input.source&&
      element("transferDestination")?.value===input.destination&&
      element("lateTransferTime")?.value===input.time&&
      element("lateTransferReason")?.value.trim()===input.reason;
  }
  async function save(){
    if(busy||!allowed()||STOCK_SAVE_LOCK)return;
    busy=true;
    const button=element("lateTransferSave");
    button.disabled=true;button.textContent="MEMERIKSA TRANSFER...";
    try{
      if(!navigator.locks?.request)
        throw new Error("Browser tidak mendukung kunci antartab. Gunakan Chrome/Edge versi terbaru.");
      // An uncertain previous submission must be confirmed before a new request.
      const old=pending();
      if(old){
        const response=await navigator.locks.request(key()+":lock",()=>dispatch(old));
        message("Transaksi sebelumnya dikonfirmasi: ID "+response.movement_id+". Periksa isian baru sebelum simpan lagi.",false);
        await loadAudit();
        return;
      }
      const i=collect();
      const {data:snapshot,error}=await db.rpc("get_stock_closing_fast_snapshot",{
        p_tanggal:i.tanggal,p_shift:i.shift,p_storages:[i.source,i.destination]
      });
      if(error||!snapshot?.ok||!Array.isArray(snapshot.rows))
        throw new Error(error?.message||"Snapshot Closing server tidak dapat diperiksa.");
      const source=snapshot.rows.find(row=>row.storage===i.source);
      const destination=snapshot.rows.find(row=>row.storage===i.destination);
      if(!source||!destination||!source.opening_exists||!destination.opening_exists)
        throw new Error("Opening MT/FT tidak lengkap untuk shift asli.");
      if(!source.closing&&!destination.closing)
        throw new Error("Belum ada Closing; pakai tombol SIMPAN TRANSFER normal.");
      if(!Number.isFinite(Number(source.system_qty))||
         Number(i.m.sourceQty)>Number(source.system_qty))
        throw new Error("Saldo sistem MT sumber tidak mencukupi. Saldo: "+liters(source.system_qty));
      if(!unchanged(i))
        throw new Error("Periode atau isian telah berubah. Periksa kembali.");
      const confirmed=window.confirm(
        "KONFIRMASI TRANSFER SUSULAN\n\n"+i.tanggal+" · Shift "+i.shift+
        " · "+i.time+" WIB\n"+i.source+" → "+i.destination+
        "\nKeluar MT: "+liters(i.m.sourceQty)+
        "\nMasuk FT: "+liters(i.m.destinationQty)+
        "\nSelisih: "+liters(i.m.loss)+
        "\nAlasan: "+i.reason+
        "\n\nStock sistem Closing akan dihitung ulang, tetapi Closing fisik dan Opening shift berikutnya tetap. SIMPAN?"
      );
      if(!confirmed)return;
      if(!unchanged(i))throw new Error("Isian berubah selama konfirmasi. Kirim dibatalkan.");
      const req={id:requestId(),payload:i.payload,reason:i.reason,recorded_at:new Date().toISOString()};
      const result=await navigator.locks.request(key()+":lock",async()=>{
        if(pending())throw new Error("Tab lain sedang memiliki transaksi tertunda. Jangan buat ID baru.");
        localStorage.setItem(key(),JSON.stringify(req));
        return dispatch(req);
      });
      message("BERHASIL · ID "+result.movement_id+(result.replayed?" (konfirmasi ulang)":"")+
        "\n"+i.source+": "+liters(result.source_system_before)+" → "+liters(result.source_system_after)+
        "\n"+i.destination+": "+liters(result.destination_system_before)+" → "+liters(result.destination_system_after)+
        "\nClosing fisik dan Opening shift berikutnya tetap.",false);
      resetSubmittedTransferForm();
      window.KPPStockDrafts?.clear("transfer");
      element("lateTransferTime").value="";
      element("lateTransferReason").value="";
      void loadAudit();
      void loadStock().catch(e=>console.warn("Late transfer refresh",e));
    }catch(e){
      message("BELUM TERKONFIRMASI: "+(e?.message||String(e)),true);
    }finally{
      busy=false;button.disabled=false;button.textContent="SIMPAN TRANSFER SUSULAN";
    }
  }
  async function loadAudit(){
    if(!allowed())return;
    const box=element("lateTransferHistory");
    if(!box)return;
    box.textContent="Memuat audit periode...";
    try{
      const {tanggal,shift}=getPeriod();
      const {data,error}=await db.rpc("list_late_stock_transfers",{p_tanggal:tanggal,p_shift:shift});
      if(error||!data?.ok||!Array.isArray(data.rows))
        throw new Error(error?.message||"Audit server tidak tersedia.");
      box.replaceChildren();
      if(!data.rows.length){box.textContent="Belum ada transfer susulan pada periode ini.";return;}
      for(const row of data.rows){
        const p=document.createElement("p");
        p.style.cssText="border-bottom:1px solid #bfdbfe;padding:9px 2px;white-space:pre-line";
        p.textContent="ID "+row.movement_id+" · "+row.source_storage+" → "+row.destination_storage+
          " · Jam fisik "+row.physical_transfer_time+" WIB\nKeluar: "+
          liters(row.measured_out_liter)+" | Masuk: "+liters(row.measured_in_liter)+
          "\nOleh "+row.actor_name+": "+row.reason;
        box.appendChild(p);
      }
    }catch(e){box.textContent="Riwayat gagal dimuat: "+(e?.message||String(e));}
  }
  document.addEventListener("kpp-auth-ready",()=>{mount();show();});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});
  else mount();
})();
