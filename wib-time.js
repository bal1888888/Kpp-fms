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

  function loadPageStyle(href){
    if(typeof document==="undefined")return false;
    const base=href.split("?")[0];
    const existing=[...document.querySelectorAll('link[rel="stylesheet"]')].find(link=>link.href&&link.href.includes(base)&&link.href.includes("20260913navy1"));
    if(existing)return true;
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href=href;
    link.dataset.kppGlobalPolish="navy1";
    document.head.appendChild(link);
    return true;
  }

  function loadPageScript(src,{async=true}={}){
    if(typeof document==="undefined")return Promise.resolve(false);
    return new Promise(resolve=>{
      const existing=[...document.scripts].find(s=>s.src&&s.src.includes(src.split("?")[0]));
      if(existing){resolve(true);return;}
      const script=document.createElement("script");
      script.src=src;
      script.async=async;
      script.onload=()=>resolve(true);
      script.onerror=()=>{
        console.warn("Gagal memuat enhancement:",src);
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  function onDomReady(callback){
    if(typeof document==="undefined")return;
    if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",callback,{once:true});
    else callback();
  }

  function waitFor(test,{timeout=5000,interval=60}={}){
    return new Promise(resolve=>{
      const started=Date.now();
      const check=()=>{
        let ready=false;
        try{ready=!!test();}catch(_){ready=false;}
        if(ready){resolve(true);return;}
        if(Date.now()-started>=timeout){resolve(false);return;}
        setTimeout(check,interval);
      };
      check();
    });
  }

  /* Selalu muat polish global terbaru sesudah stylesheet lama supaya tema konsisten di semua halaman. */
  loadPageStyle("kpp-ui-polish.css?v=20260913navy1");
  loadPageScript("lubricant-nav-v1.js?v=20260915a2");

  if(root.KPP_ACTIVE_PAGE==="hm-master"){
    loadPageScript("hm-master-capacity-picker-v2.js?v=20260913b1");
    loadPageScript("hm-master-review-panel.js?v=20260913d1");
    loadPageScript("hm-master-fc-standard-v1.js?v=20260913a1");
    loadPageScript("hm-master-v1-finalization.js?v=20260913a1");
  }

  if(root.KPP_ACTIVE_PAGE==="ccr"){
    onDomReady(async()=>{
      await loadPageScript("ccr-quota-input-v4.js?v=20260916b1",{async:false});
    });
  }

  if(root.KPP_ACTIVE_PAGE==="pengisian"){
    onDomReady(async()=>{
      await loadPageScript("fuel-hm-flow-v1.js?v=20260916b1",{async:false});
    });
  }

  if(root.KPP_ACTIVE_PAGE==="logsheet-editor"){
    loadPageScript("logsheet-editor-hardening.js?v=20260913c2");
    loadPageScript("logsheet-editor-hm-sequence-guard.js?v=20260913a1");
    loadPageScript("logsheet-editor-crossdate-search.js?v=20260913c4");
  }

  if(root.KPP_ACTIVE_PAGE==="dashboard"){
    onDomReady(async()=>{
      await loadPageScript("dashboard-command-center-v2.js?v=20260913f2",{async:false});
      await waitFor(()=>document.getElementById("kppCommandKpis")&&document.getElementById("stockTrendBars"),{timeout:6000,interval:80});
      await loadPageScript("dashboard-reference-polish-v3.js?v=20260913g2",{async:false});
      await loadPageScript("dashboard-reference-polish-guard-v3.js?v=20260913h1",{async:false});
      await loadPageScript("fc-chart-gap-bridge-v1.js?v=20260913a2",{async:false});
      await loadPageScript("dashboard-presentation-layout-v1.js?v=20260913a1",{async:false});
      await loadPageScript("dashboard-presentation-polish-v2.js?v=20260913a1",{async:false});
      await loadPageScript("dashboard-compact-trends-v3.js?v=20260913a1",{async:false});
      await loadPageScript("dashboard-visual-balance-v4.js?v=20260913a2",{async:false});
      await loadPageScript("fc-standard-alert-v1.js?v=20260913a1",{async:false});
    });
  }
})(typeof window!=="undefined"?window:globalThis);