/* Read-only reconciliation for per-shift stock closing audits. No database writes. */
(function(root) {
  "use strict";
  const value=v=>Number(v||0);
  const code=v=>String(v||"").trim().toUpperCase();
  const warehouse=v=>code(v).replace(/^WH\s*/,"").replace(/\s+/g,"");
  function sourceForFuel(row,master) {
    const ft=code(row.fuel_truck);
    const direct=(master||[]).find(x=>code(x.storage_type)==="FT"&&code(x.code)===ft);
    if(direct)return code(direct.code);
    const wh=warehouse(row.wh);
    if(!wh)return "";
    const matches=(master||[]).filter(x=>code(x.storage_type)==="FT"&&warehouse(x.warehouse)===wh);
    return matches.length===1?code(matches[0].code):"";
  }
  function calculate({closing,opening,movements=[],fuels=[],master=[]}) {
    if(!closing || !opening || opening.qty==null)return {complete:false,reason:"Opening shift untuk storage ini tidak ditemukan."};
    const storage=code(closing.storage);
    const details={opening:value(opening.qty),receipt:0,transferIn:0,transferOut:0,usage:0};
    for(const row of movements){
      if(row.jenis==="RECEIPT"&&code(row.destination_storage)===storage)
        details.receipt+=value(row.destination_measured_qty??row.qty);
      if(row.jenis==="TRANSFER"){
        if(code(row.destination_storage)===storage)details.transferIn+=value(row.destination_measured_qty??row.qty);
        if(code(row.source_storage)===storage)details.transferOut+=value(row.source_measured_qty??row.qty);
      }
    }
    let unmapped=0;
    for(const row of fuels){
      if(row.duplicate_of_id!=null)continue;
      const mapped=sourceForFuel(row,master);
      if(!mapped){unmapped++;continue;}
      if(mapped===storage)details.usage+=value(row.fuel);
    }
    const calculated=details.opening+details.receipt+details.transferIn-details.transferOut-details.usage;
    const stored=value(closing.system_qty),physical=value(closing.actual_qty);
    return {...details,complete:unmapped===0,unmapped,calculated,stored,physical,
      storedDifference:stored-calculated,physicalDifference:physical-calculated};
  }
  root.KPPStockReconcile=Object.freeze({calculate,sourceForFuel});
})(typeof window==="undefined"?globalThis:window);
