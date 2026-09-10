(function(root){
  "use strict";

  function optionalNumber(value,label){
    if(value===null || value===undefined || String(value).trim()==="")return null;
    const number=Number(value);
    if(!Number.isFinite(number) || number<0){
      throw new Error(label+" harus berupa angka 0 atau lebih.");
    }
    return number;
  }

  function roundLiter(value){
    return Math.round((Number(value)+Number.EPSILON)*10)/10;
  }

  function calculate(input={}){
    const sourceSoundingQty=optionalNumber(input.sourceSoundingQty,"Qty sounding sumber");
    const destinationQty=optionalNumber(input.destinationQty,"Qty masuk tujuan");
    const sourceQty=sourceSoundingQty;

    const loss=
      sourceQty!==null && destinationQty!==null
        ? roundLiter(sourceQty-destinationQty)
        : null;

    return Object.freeze({
      sourceQty,
      sourceSoundingQty,
      destinationQty,
      loss
    });
  }

  root.KPPTransferAudit=Object.freeze({calculate});
})(typeof window!=="undefined"?window:globalThis);
