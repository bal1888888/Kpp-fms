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
    const meterStart=optionalNumber(input.meterStart,"Flowmeter awal");
    const meterEnd=optionalNumber(input.meterEnd,"Flowmeter akhir");
    const destinationQty=optionalNumber(input.destinationQty,"Qty masuk tujuan");

    let sourceQty=null;
    if(meterStart!==null && meterEnd!==null){
      if(meterEnd<=meterStart){
        throw new Error("Flowmeter akhir harus lebih besar dari flowmeter awal.");
      }
      sourceQty=roundLiter(meterEnd-meterStart);
    }

    const loss=
      sourceQty!==null && destinationQty!==null
        ? roundLiter(sourceQty-destinationQty)
        : null;

    return Object.freeze({meterStart,meterEnd,sourceQty,destinationQty,loss});
  }

  root.KPPTransferAudit=Object.freeze({calculate});
})(typeof window!=="undefined"?window:globalThis);
