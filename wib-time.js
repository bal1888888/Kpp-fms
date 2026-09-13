(function(root){
  "use strict";
  const TZ="Asia/Jakarta";
  const DATE_FMT=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"});
  const PARTS_FMT=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
  const DISPLAY_FMT=new Intl.DateTimeFormat("id-ID",{timeZone:TZ,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});

  function parts(date=new Date()){
    return Object.fromEntries(PARTS_FMT.formatToParts(date).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  }
  function localDate(date=new Date()){
    const p=parts(date);
    return `${p.year}-${p.month}-${p.day}`;
  }
  function localTime(date=new Date()){
    const p=parts(date);
    return `${p.hour}:${p.minute}:${p.second}`;
  }
  function addDays(value,days){
    const [y,m,d]=String(value||"").split("-").map(Number);
    if(!y||!m||!d)throw new Error("Tanggal ISO tidak valid: "+value);
    const x=new Date(Date.UTC(y,m-1,d+Number(days||0)));
    return x.toISOString().slice(0,10);
  }
  function daysInMonth(year,month){
    return new Date(Date.UTC(Number(year),Number(month),0)).getUTCDate();
  }
  function operationalShift(date=new Date()){
    const p=parts(date);
    const mins=Number(p.hour)*60+Number(p.minute);
    let tanggal=`${p.year}-${p.month}-${p.day}`;
    let shift=1;
    if(mins>=18*60+30){
      shift=2;
    }else if(mins<6*60+30){
      shift=2;
      tanggal=addDays(tanggal,-1);
    }
    return {tanggal,shift};
  }
  function operationalPeriod(referenceDate){
    const [y,m,d]=String(referenceDate||"").split("-").map(Number);
    if(!y||!m||!d)throw new Error("Tanggal ISO tidak valid: "+referenceDate);
    if(d>=26){
      const start=`${y}-${String(m).padStart(2,"0")}-26`;
      const next=new Date(Date.UTC(y,m,1));
      const end=`${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,"0")}-25`;
      return {start,end};
    }
    const prev=new Date(Date.UTC(y,m-2,1));
    const start=`${prev.getUTCFullYear()}-${String(prev.getUTCMonth()+1).padStart(2,"0")}-26`;
    const end=`${y}-${String(m).padStart(2,"0")}-25`;
    return {start,end};
  }
  function operationalMtdBounds(date=new Date()){
    const end=localDate(date);
    return {start:operationalPeriod(end).start,end};
  }
  function formatDateTime(date=new Date()){
    return DISPLAY_FMT.format(date);
  }
  root.KPPTime=Object.freeze({TZ,parts,localDate,localTime,addDays,daysInMonth,operationalShift,operationalPeriod,operationalMtdBounds,formatDateTime});

  // HM Master enhancement loader. Kept conditional so other pages only receive
  // the shared WIB helpers and no additional network/script work.
  if(typeof document!=="undefined" && root.KPP_ACTIVE_PAGE==="hm-master"){
    const script=document.createElement("script");
    script.src="hm-master-capacity-quick.js?v=20260913a1";
    script.async=true;
    document.head.appendChild(script);
  }
})(typeof window!=="undefined"?window:globalThis);
