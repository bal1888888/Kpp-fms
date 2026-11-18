/* KPP-FMS: isolated Admin/GL late-receipt UI. Normal saveReceipt() remains unchanged. */
(function(){
  "use strict";
  const roles=new Set(["admin","gl"]);
  const el=id=>document.getElementById(id);
  const key=()=>"kpp-late-receipt-request-v1:"+(window.KPP_SESSION?.user?.id||"unknown");
  const liters=value=>Number(value).toLocaleString("id-ID",{maximumFractionDigits:1})+" L";
  let busy=false;
  function allowed(){return typeof CURRENT_PROFILE!=="undefined"&&roles.has(CURRENT_PROFILE?.role);}
  function message(text,isError){
    const box=el("lateReceiptStatus");if(!box)return;
    box.textContent=text;box.style.color=isError?"#b91c1c":"#065f46";
  }
  function requestId(){
    if(window.crypto?.randomUUID)return window.crypto.randomUUID();
    const a=new Uint8Array(16);window.crypto.getRandomValues(a);
    a[6]=(a[6]&15)|64;a[8]=(a[8]&63)|128;
    return [...a].map((v,i)=>([4,6,8,10].includes(i)?"-":"")+v.toString(16).padStart(2,"0")).join("");
  }
  function pending(){
    const raw=localStorage.getItem(key());if(!raw)return null;
    let r;try{r=JSON.parse(raw);}catch{throw new Error("ID transaksi tertunda tidak terbaca. Periksa Audit; jangan kirim ulang manual.");}
    if(!r||!r.id||!r.payload||!r.reason||!r.recorded_at)throw new Error("Transaksi tertunda tidak lengkap. Periksa Audit sebelum melanjutkan.");
    return r;
  }
  function mount(){
    const base=document.querySelector(".receipt-panel");
    if(!base||el("lateReceiptPanel"))return;
    const section=document.createElement("details");
    section.id="lateReceiptPanel";section.hidden=true;
    section.style.cssText="margin-top:18px;padding:14px;border:1px solid #93c5fd;border-radius:12px;background:#eff6ff";
    section.innerHTML=[
      '<summary style="cursor:pointer;font-weight:800;color:#1e40af;font-size:14px">PENERIMAAN SUSULAN SETELAH CLOSING — ADMIN / GL</summary>',
      '<p style="font-size:12px;line-height:1.6;color:#475569">Gunakan form Penerimaan di atas untuk data flowmeter, sounding, transportir dan DO. Pilih tanggal serta shift ASLI. Closing fisik dan Opening shift berikutnya tidak diubah; saldo sistem Closing dihitung ulang.</p>',
      '<div class="grid"><div><label for="lateReceiptReason">Alasan koreksi (10–500 karakter)</label><textarea id="lateReceiptReason" maxlength="500" rows="2" placeholder="Mengapa penerimaan baru dicatat setelah Closing?"></textarea></div></div>',
      '<div class="actions" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">',
      '<button class="primary" id="lateReceiptSave" type="button" style="min-height:50px">SIMPAN PENERIMAAN SUSULAN</button>',
      '<button class="gray" id="lateReceiptAuditButton" type="button" style="min-height:48px">LIHAT RIWAYAT KOREKSI</button></div>',
      '<div id="lateReceiptStatus" role="status" aria-live="polite" style="margin-top:10px;font-size:12px;white-space:pre-line"></div>',
      '<div id="lateReceiptHistory" aria-live="polite" style="margin-top:10px;font-size:12px"></div>'
    ].join("");
    base.appendChild(section);
    el("lateReceiptSave").addEventListener("click",save);
    el("lateReceiptAuditButton").addEventListener("click",loadAudit);
    ["tanggal","shift"].forEach(id=>el(id)?.addEventListener("change",()=>{
      el("lateReceiptHistory")?.replaceChildren();
      message("Periode berubah. Periksa kembali bukti penerimaan.",false);
    }));
    show();
  }
  function show(){const panel=el("lateReceiptPanel");if(panel)panel.hidden=!allowed();}
  function collect(){
    const {tanggal,shift}=getPeriod();
    const destination=el("receiptDestination")?.value||"";
    const time=el("receiptArrivalTime")?.value||"";
    const reference=(el("receiptReference")?.value||"").trim().toUpperCase().replace(/\s+/g," ");
    const transporter=el("receiptTransporter")?.value||"";
    const doQty=Number(el("receiptDoQty")?.value);
    const doFinal=el("receiptDoFinal")?.value||"";
    const reason=el("lateReceiptReason")?.value.trim()||"";
    if(!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)||![1,2].includes(shift))throw new Error("Tanggal/shift penerimaan belum valid.");
    if(!destination||!STORAGE_ROWS.some(row=>row.code===destination&&row.active!==false))throw new Error("Pilih storage tujuan yang aktif.");
    if(!/^\d{2}:\d{2}$/.test(time))throw new Error("Isi jam kedatangan fisik.");
    if(!reference||!transporter||![10000,16000,24000].includes(doQty)||!["true","false"].includes(doFinal))throw new Error("Lengkapi nomor DO, transportir, Qty DO, dan status bongkaran.");
    if(reason.length<10||reason.length>500)throw new Error("Alasan koreksi harus 10–500 karakter.");
    const m=updateReceiptCalculation();
    if(!m||m.meterStart===null||m.meterEnd===null||!m.tankBefore||!m.tankAfter||
      !(Number(m.transporterQty)>0)||!(Number(m.tankQty)>0))throw new Error("Lengkapi flowmeter dan sounding sebelum/sesudah dengan hasil positif.");
    if(!validateCapacityHard(destination,m.tankAfter.liters,"Penerimaan susulan"))throw new Error("Sonding tujuan melewati kapasitas.");
    const operator=soundingOfficerName()||CURRENT_PROFILE?.display_name||CURRENT_PROFILE?.username;
    if(!operator)throw new Error("Identitas akun belum tersedia.");
    const payload={
      tanggal,jam:time+":00",arrival_at:new Date(tanggal+"T"+time+":00+07:00").toISOString(),
      shift,jenis:"RECEIPT",operation_mode:"BACKFILL",source_storage:null,
      destination_storage:destination,qty:Number(m.transporterQty),do_qty_liter:doQty,
      do_final:doFinal==="true",operator,transporter,document_reference:reference,
      note:"PO/LO "+reference+" | Flowmeter "+m.meterStart+" -> "+m.meterEnd+
        " L | Tangki "+m.tankBefore.matchedHeightCm+" -> "+m.tankAfter.matchedHeightCm+" cm",
      calculation_method:"RECEIPT_FLOWMETER_DO",meter_start_liter:Number(m.meterStart),
      meter_end_liter:Number(m.meterEnd),transporter_measured_qty:Number(m.transporterQty),
      destination_height_before_cm:m.tankBefore.matchedHeightCm,
      destination_liter_before:m.tankBefore.liters,
      destination_height_after_cm:m.tankAfter.matchedHeightCm,
      destination_liter_after:m.tankAfter.liters,
      destination_measured_qty:Number(m.transporterQty),measurement_loss_qty:null,tera_version:TERA.version
    };
    return {tanggal,shift,destination,time,reference,transporter,reason,m,payload};
  }
  async function dispatch(req){
    const {data,error}=await db.rpc("save_late_stock_receipt",{
      p_request_id:req.id,p_payload:req.payload,p_reason:req.reason,p_recorded_at:req.recorded_at
    });
    if(error||!data||typeof data.ok!=="boolean")throw new Error("Status transaksi belum terkonfirmasi. ID tetap tersimpan; tekan SIMPAN lagi untuk mengecek pengiriman yang sama. "+(error?.message||""));
    if(!data.ok){localStorage.removeItem(key());throw new Error(data.message||"Penerimaan ditolak. Isian sounding tidak dihapus.");}
    localStorage.removeItem(key());return data;
  }
  function unchanged(i){
    const p=getPeriod();
    return p.tanggal===i.tanggal&&p.shift===i.shift&&
      el("receiptDestination")?.value===i.destination&&el("receiptArrivalTime")?.value===i.time&&
      el("receiptReference")?.value.trim().toUpperCase().replace(/\s+/g," ")===i.reference&&
      el("receiptTransporter")?.value===i.transporter&&el("lateReceiptReason")?.value.trim()===i.reason;
  }
  async function save(){
    if(busy||!allowed()||STOCK_SAVE_LOCK)return;
    busy=true;const button=el("lateReceiptSave");button.disabled=true;button.textContent="MEMERIKSA PENERIMAAN...";
    try{
      if(!navigator.locks?.request)throw new Error("Browser tidak mendukung kunci antartab. Gunakan Chrome/Edge terbaru.");
      const old=pending();
      if(old){
        const result=await navigator.locks.request(key()+":lock",()=>dispatch(old));
        message("Transaksi sebelumnya dikonfirmasi: ID "+result.movement_id+". Periksa isian baru sebelum menyimpan lagi.",false);
        await loadAudit();return;
      }
      const i=collect();
      const {data:snapshot,error}=await db.rpc("get_stock_closing_fast_snapshot",{
        p_tanggal:i.tanggal,p_shift:i.shift,p_storages:[i.destination]
      });
      if(error||!snapshot?.ok||!Array.isArray(snapshot.rows))throw new Error(error?.message||"Snapshot Closing server tidak dapat diperiksa.");
      const row=snapshot.rows.find(item=>item.storage===i.destination);
      if(!row||!row.opening_exists)throw new Error("Opening storage tujuan tidak ditemukan pada shift asli.");
      if(!row.closing)throw new Error("Storage belum Closing. Gunakan tombol SIMPAN PENERIMAAN normal.");
      if(!Number.isFinite(Number(row.system_qty)))throw new Error("Saldo sistem Closing tidak tersedia.");
      if(!unchanged(i))throw new Error("Periode atau isian berubah. Periksa kembali.");
      if(!confirm("KONFIRMASI PENERIMAAN SUSULAN\n\n"+i.tanggal+" · Shift "+i.shift+" · "+i.time+" WIB\n"+
        i.transporter+" · DO "+i.reference+"\nTujuan: "+i.destination+"\nFlowmeter masuk: "+liters(i.m.transporterQty)+
        "\nAlasan: "+i.reason+"\n\nSaldo sistem Closing akan dihitung ulang. Closing fisik dan Opening shift berikutnya tetap. SIMPAN?"))return;
      if(!unchanged(i))throw new Error("Isian berubah selama konfirmasi. Pengiriman dibatalkan.");
      const req={id:requestId(),payload:i.payload,reason:i.reason,recorded_at:new Date().toISOString()};
      const result=await navigator.locks.request(key()+":lock",async()=>{
        if(pending())throw new Error("Tab lain sedang memiliki transaksi tertunda. Jangan buat ID baru.");
        localStorage.setItem(key(),JSON.stringify(req));return dispatch(req);
      });
      message("BERHASIL · ID "+result.movement_id+(result.replayed?" (konfirmasi ulang)":"")+
        "\n"+i.destination+": "+liters(result.system_before)+" → "+liters(result.system_after)+
        "\nClosing fisik dan Opening shift berikutnya tetap.",false);
      el("lateReceiptReason").value="";
      window.KPPStockDrafts?.clear("receipt");
      void loadAudit();void loadStock().catch(e=>console.warn("Late receipt refresh",e));
    }catch(e){message("BELUM TERKONFIRMASI: "+(e?.message||String(e)),true);}
    finally{busy=false;button.disabled=false;button.textContent="SIMPAN PENERIMAAN SUSULAN";}
  }
  async function loadAudit(){
    if(!allowed())return;
    const box=el("lateReceiptHistory");if(!box)return;
    box.textContent="Memuat audit periode...";
    try{
      const {tanggal,shift}=getPeriod();
      const {data,error}=await db.rpc("list_late_stock_receipts",{p_tanggal:tanggal,p_shift:shift});
      if(error||!data?.ok||!Array.isArray(data.rows))throw new Error(error?.message||"Audit server tidak tersedia.");
      box.replaceChildren();
      if(!data.rows.length){box.textContent="Belum ada penerimaan susulan pada periode ini.";return;}
      for(const row of data.rows){
        const p=document.createElement("p");p.style.cssText="border-bottom:1px solid #bfdbfe;padding:9px 2px;white-space:pre-line";
        p.textContent="ID "+row.movement_id+" · "+row.storage+" · DO "+row.document_reference+
          " · "+row.transporter+" · "+liters(row.measured_liter)+"\nKedatangan "+new Date(row.physical_arrival_at).toLocaleString("id-ID")+
          "\nOleh "+row.actor_name+": "+row.reason;
        box.appendChild(p);
      }
    }catch(e){box.textContent="Riwayat gagal dimuat: "+(e?.message||String(e));}
  }
  document.addEventListener("kpp-auth-ready",()=>{mount();show();});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();