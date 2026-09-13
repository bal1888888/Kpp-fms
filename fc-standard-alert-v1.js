// KPP-FMS FC Standard Alert v1
// Highlights only FC averages that exceed the per-unit ceiling in unit_master.
(() => {
  "use strict";

  const STYLE_ID="kppFcStandardAlertStyle";
  const standards=new Map();
  const observers=[];
  let queued=false;

  const db=()=>window.KPP?.db||window.kppDb||null;
  const normalize=value=>String(value??"").trim().toUpperCase();
  const format=value=>new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(value)||0);

  function parseIdNumber(value){
    const raw=String(value??"").replace(/L\s*\/\s*HM|L\/HM|L|HM/gi,"").trim();
    const clean=raw.replace(/[^0-9,.-]/g,"");
    if(!clean)return null;
    let normalized=clean;
    if(clean.includes(","))normalized=clean.replace(/\./g,"").replace(",",".");
    else if(/^[-+]?\d{1,3}(?:\.\d{3})+$/.test(clean))normalized=clean.replace(/\./g,"");
    const n=Number(normalized);
    return Number.isFinite(n)?n:null;
  }

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      /* Hanya nilai DI ATAS standar yang diberi alarm. Di bawah/sama dengan standar tetap normal. */
      .kpp-fc-summary-table tbody tr.kpp-fc-over-standard{
        background:linear-gradient(90deg,#fff1f2 0%,#fff7f7 55%,#fff 100%)!important;
        box-shadow:inset 4px 0 0 #ef4444!important;
      }
      .kpp-fc-summary-table tbody tr.kpp-fc-over-standard:hover{background:#ffe4e6!important}
      .kpp-fc-summary-table tr.kpp-fc-over-standard .kpp-fc-summary-unit,
      .kpp-fc-summary-table tr.kpp-fc-over-standard .kpp-fc-summary-fc{color:#b91c1c!important}
      .kpp-fc-summary-table tr.kpp-fc-over-standard .kpp-fc-summary-fc[data-fc-standard]::after{
        content:"  • > STD " attr(data-fc-standard);
        color:#dc2626;font-size:7px;font-weight:950;white-space:nowrap;
      }

      #kppPresentationFcSummary .kpp-pv-summary-row.kpp-fc-over-standard{
        background:linear-gradient(90deg,#fff1f2,#fff7f7)!important;
        box-shadow:inset 3px 0 0 #ef4444!important;
      }
      #kppPresentationFcSummary .kpp-pv-summary-row.kpp-fc-over-standard .kpp-pv-summary-unit,
      #kppPresentationFcSummary .kpp-pv-summary-row.kpp-fc-over-standard .kpp-pv-summary-fc{color:#b91c1c!important}
      #kppPresentationFcSummary .kpp-pv-summary-row.kpp-fc-over-standard .kpp-pv-summary-fc[data-fc-standard]::after{
        content:"\A> STD " attr(data-fc-standard);
        white-space:pre;color:#dc2626;font-size:6px;font-weight:950;line-height:1.1;
      }
    `;
    document.head.appendChild(style);
  }

  function markRow(row,unit,fc,fcCell){
    const standard=standards.get(normalize(unit));
    const over=Number.isFinite(fc)&&Number.isFinite(standard)&&standard>0&&fc>standard;
    row.classList.toggle("kpp-fc-over-standard",over);
    if(over){
      const label=`${format(standard)} L/HM`;
      row.dataset.fcStandard=String(standard);
      row.title=`FC rata-rata ${format(fc)} L/HM melebihi standar ${label}.`;
      if(fcCell){
        fcCell.dataset.fcStandard=label;
        fcCell.title=row.title;
      }
    }else{
      delete row.dataset.fcStandard;
      if(row.title?.startsWith("FC rata-rata"))row.removeAttribute("title");
      if(fcCell){
        delete fcCell.dataset.fcStandard;
        if(fcCell.title?.startsWith("FC rata-rata"))fcCell.removeAttribute("title");
      }
    }
  }

  function applyDetailedSummary(){
    document.querySelectorAll(".kpp-fc-summary-table tbody tr[data-unit]").forEach(row=>{
      const cells=row.querySelectorAll("td");
      const unit=normalize(row.dataset.unit||cells[0]?.textContent);
      const fc=parseIdNumber(cells[1]?.textContent);
      markRow(row,unit,fc,cells[1]);
    });
  }

  function applyCompactSummary(){
    document.querySelectorAll("#kppPresentationFcSummary .kpp-pv-summary-row:not(.head)").forEach(row=>{
      const unitEl=row.querySelector(".kpp-pv-summary-unit");
      const fcEl=row.querySelector(".kpp-pv-summary-fc");
      if(!unitEl||!fcEl)return;
      const unit=normalize(unitEl.textContent);
      const fc=parseIdNumber(fcEl.textContent);
      markRow(row,unit,fc,fcEl);
    });
  }

  function applyAll(){
    queued=false;
    applyDetailedSummary();
    applyCompactSummary();
  }

  function queueApply(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(applyAll);
  }

  async function loadStandards(){
    const client=db();
    if(!client)return false;
    const {data,error}=await client
      .from("unit_master")
      .select("code_unit,fc_standard_lphm")
      .eq("active",true)
      .order("code_unit",{ascending:true});
    if(error){
      console.warn("Gagal memuat standar FC:",error.message);
      return false;
    }
    standards.clear();
    (data||[]).forEach(row=>{
      const unit=normalize(row.code_unit);
      const standard=Number(row.fc_standard_lphm);
      if(unit&&Number.isFinite(standard)&&standard>0)standards.set(unit,standard);
    });
    queueApply();
    return true;
  }

  function stopWatching(){
    while(observers.length)observers.pop().disconnect();
  }

  function watchTarget(target){
    if(!target)return;
    const observer=new MutationObserver(queueApply);
    observer.observe(target,{childList:true,subtree:true,characterData:true});
    observers.push(observer);
  }

  async function watchFcPanels(){
    stopWatching();
    let attempts=0;
    while(attempts<80){
      const detailed=document.querySelector("#dashboardFcChart .kpp-fc-summary-table tbody")||document.querySelector(".kpp-fc-summary-table tbody");
      const compact=document.querySelector("#kppPresentationFcSummary .kpp-pv-summary");
      if(detailed||compact){
        watchTarget(detailed);
        if(compact&&compact!==detailed)watchTarget(compact);
        queueApply();
        return true;
      }
      await new Promise(resolve=>setTimeout(resolve,100));
      attempts++;
    }
    return false;
  }

  async function install(){
    ensureStyle();
    let attempts=0;
    while(!db()&&attempts<80){await new Promise(r=>setTimeout(r,100));attempts++;}
    await loadStandards();
    await watchFcPanels();
    queueApply();
  }

  window.KPPFCStandard={
    refresh:async()=>{
      await loadStandards();
      await watchFcPanels();
      queueApply();
    }
  };

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();
