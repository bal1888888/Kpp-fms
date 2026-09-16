// KPP-FMS Fuelman HM flow v1
// Jatah membaca HM CCR; non-jatah membaca HM operator. Referensi HM selalu dari RPC server.
(() => {
  "use strict";

  const clean=v=>String(v??"").trim();
  const one=data=>Array.isArray(data)?data[0]||null:data||null;

  async function serverHmReference(unit){
    const client=window.KPP?.db||window.kppDb||window.supabaseClient;
    if(!client)throw new Error("Database belum siap.");
    const {data,error}=await client.rpc("fuel_hm_reference_info",{p_unit:clean(unit).toUpperCase()});
    if(error)throw error;
    const row=one(data);
    return row&&Number.isFinite(Number(row.hm))
      ? {hm:Number(row.hm),source:String(row.source||"Referensi HM server")}
      : {hm:0,source:"Belum ada HM sebelumnya"};
  }

  function relabelCcr(){
    const box=document.getElementById("ccrAllocationBox");
    if(box){
      const hmItem=[...box.querySelectorAll(".ccr-item")].find(n=>/HM AKTUAL JATAH|HM PENJATAHAN/i.test(n.textContent||""));
      const small=hmItem?.querySelector("small");
      if(small)small.textContent="HM PENJATAHAN CCR";
    }
    const input=document.getElementById("currentHm");
    if(input?.readOnly && window.currentCCRAllocation){
      const label=input.closest(".form-group")?.querySelector("label");
      if(label)label.textContent="HM Penjatahan CCR";
      input.placeholder="HM dari jatah CCR";
    }
    const mode=document.getElementById("fuelingModeBox");
    if(mode && /MODE CCR/i.test(mode.textContent||"")){
      mode.textContent="MODE CCR • HM Penjatahan dan batas liter mengikuti jatah CCR. Fuelman hanya input Qty aktual.";
    }
  }

  function patch(){
    // Hilangkan pembacaan client-side koreksi + hingga 1000 baris history.
    // Semua caller lama otomatis memakai source of truth server yang sama.
    window.ambilHmTerakhir=serverHmReference;

    const original=window.tampilkanJatahCcr;
    if(typeof original==="function"&&!original.__kppHmFlowV1){
      const wrapped=function(...args){const result=original.apply(this,args);relabelCcr();return result;};
      wrapped.__kppHmFlowV1=true;
      window.tampilkanJatahCcr=wrapped;
    }
    relabelCcr();
  }

  patch();
  document.addEventListener("kpp-auth-ready",()=>setTimeout(patch,0));
})();
