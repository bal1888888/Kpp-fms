// KPP-FMS dashboard stock badge threshold alignment v1
(() => {
  "use strict";

  function parseId(value){
    const raw=String(value??"").replace(/L|%/gi,"").trim();
    if(!raw)return null;
    const clean=raw.replace(/[^0-9,.-]/g,"");
    let normalized=clean;
    if(clean.includes(","))normalized=clean.replace(/\./g,"").replace(",",".");
    else if(/^[-+]?\d{1,3}(?:\.\d{3})+$/.test(clean))normalized=clean.replace(/\./g,"");
    const n=Number(normalized);
    return Number.isFinite(n)?n:null;
  }

  function state(pct){
    const p=Number(pct)||0;
    if(p<20)return {key:"critical",label:"KRITIS"};
    if(p<35)return {key:"low",label:"RENDAH"};
    if(p<50)return {key:"warning",label:"WASPADA"};
    if(p>=90)return {key:"high",label:"TINGGI"};
    return {key:"safe",label:"AMAN"};
  }

  function fmt(value){return new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1}).format(Math.abs(Number(value)||0));}

  function patch(){
    const host=document.getElementById("stockTrendBars");
    const badge=document.getElementById("stockTrendBadge");
    if(!host||!badge)return false;
    const items=[...host.querySelectorAll(".stock-radial-item")];
    if(!items.length)return false;
    const latest=items.at(-1);
    const pct=parseId(latest.querySelector(".stock-trend-ring span")?.textContent)||0;
    const current=parseId(latest.querySelector(".trend-ring-liter")?.textContent)||0;
    const info=state(pct);
    let className="trend-badge flat";
    let label=`${fmt(pct)}% • ${info.label}`;
    if(items.length>1){
      const previous=parseId(items.at(-2).querySelector(".trend-ring-liter")?.textContent)||0;
      if(previous>0){
        const change=((current-previous)/previous)*100;
        if(Math.abs(change)<.05){className="trend-badge flat";label=`• Stabil ${fmt(pct)}% • ${info.label}`;}
        else if(change>0){className="trend-badge stock-up";label=`▲ ${fmt(change)}% • ${info.label}`;}
        else{className="trend-badge stock-down";label=`▼ ${fmt(change)}% • ${info.label}`;}
      }
    }
    if(badge.className!==className)badge.className=className;
    if(badge.textContent!==label)badge.textContent=label;
    return true;
  }

  function install(){
    const host=document.getElementById("stockTrendBars");
    if(!host)return false;
    const observer=new MutationObserver(()=>patch());
    observer.observe(host,{childList:true,subtree:true,characterData:true});
    patch();
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>=180)clearInterval(timer);},120);
  document.addEventListener("DOMContentLoaded",install,{once:true});
})();
