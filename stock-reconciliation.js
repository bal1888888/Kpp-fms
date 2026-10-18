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
    const closingAt=Date.parse(closing.created_at||"");
    let chronologyComplete=Number.isFinite(closingAt);
    const afterClosing=row=>{
      const created=Date.parse(row.created_at||"");
      if(!Number.isFinite(created)){chronologyComplete=false;return false;}
      return Number.isFinite(closingAt) && created>closingAt;
    };
    const details={
      opening:value(opening.qty),receipt:0,transferIn:0,transferOut:0,usage:0,
      lateReceipt:0,lateTransferIn:0,lateTransferOut:0,lateUsage:0
    };
    for(const row of movements){
      const destination=code(row.destination_storage)===storage;
      const source=code(row.source_storage)===storage;
      if(row.jenis==="RECEIPT"&&destination){
        const received=value(row.destination_measured_qty??row.qty);
        details.receipt+=received;
        if(afterClosing(row))details.lateReceipt+=received;
      }
      if(row.jenis==="TRANSFER"&&(source||destination)){
        const later=afterClosing(row);
        if(destination){
          const received=value(row.destination_measured_qty??row.qty);
          details.transferIn+=received;
          if(later)details.lateTransferIn+=received;
        }
        if(source){
          const supplied=value(row.source_measured_qty??row.qty);
          details.transferOut+=supplied;
          if(later)details.lateTransferOut+=supplied;
        }
      }
    }
    let unmapped=0;
    for(const row of fuels){
      if(row.duplicate_of_id!=null)continue;
      const mapped=sourceForFuel(row,master);
      if(!mapped){unmapped++;continue;}
      if(mapped===storage){
        const qty=value(row.fuel);
        details.usage+=qty;
        if(afterClosing(row))details.lateUsage+=qty;
      }
    }
    const calculated=details.opening+details.receipt+details.transferIn-details.transferOut-details.usage;
    const stored=value(closing.system_qty),physical=value(closing.actual_qty);
    const storedDifference=stored-calculated;
    // Historic system snapshot vs today's ledger:
    // fuel posted later increases the difference; inbound movements lower it,
    // while outbound movements posted later increase it.
    const lateImpact=details.lateUsage+details.lateTransferOut-details.lateReceipt-details.lateTransferIn;
    const unexplainedDifference=storedDifference-lateImpact;
    return {...details,complete:unmapped===0,unmapped,chronologyComplete,calculated,stored,physical,
      storedDifference,physicalDifference:physical-calculated,lateImpact,unexplainedDifference};
  }
  root.KPPStockReconcile=Object.freeze({calculate,sourceForFuel});
})(typeof window==="undefined"?globalThis:window);
