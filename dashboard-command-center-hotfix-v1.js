// KPP-FMS Dashboard Command Center numeric/capacity hardening v1
(() => {
  "use strict";

  function parseIdNumber(value){
    const raw=String(value??"").replace(/L\/hari|hari|L|%/gi,"").trim();
    if(!raw)return null;
    const clean=raw.replace(/[^0-9,.-]/g,"");
    let normalized=clean;
    if(clean.includes(",")){
      normalized=clean.replace(/\./g,"").replace(",",".");
    }else if(/^[-+]?\d{1,3}(?:\.\d{3})+$/.test(clean)){
      normalized=clean.replace(/\./g,"");
    }
    const n=Number(normalized);
    return Number.isFinite(n)?n:null;
  }

  function levelState(pct){
    const p=Number(pct)||0;
    if(p<20)return "critical";
    if(p<35)return "low";
    if(p<50)return "warning";
    if(p>=90)return "high";
    return "safe";
  }

  function formatPct(v){
    return new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Number(v)||0)+"%";
  }

  async function patchStorage(){
    const panel=document.getElementById("kppStorageSnapshot");
    if(!panel||!window.KPPStorage||!window.KPP?.db)return false;
    const rows=[...panel.querySelectorAll(".kpp-storage-row")];
    if(!rows.length)return false;
    const master=await window.KPPStorage.load(window.KPP.db,{activeOnly:true});
    const byCode=Object.fromEntries(master.map(row=>[String(row.code||"").toUpperCase(),row]));
    rows.forEach(row=>{
      const name=row.querySelector(".kpp-storage-name");
      const code=String(name?.childNodes?.[0]?.textContent||"").trim().toUpperCase();
      const item=byCode[code];
      if(!item)return;
      const liter=parseIdNumber(row.querySelector(".kpp-storage-liter")?.textContent)||0;
      const cap=Number(item.nominal_capacity_liter)||0;
      const pct=cap>0?Math.max(0,Math.min(100,(liter/cap)*100)):0;
      const cls=levelState(pct);
      const fill=row.querySelector(".kpp-storage-fill");
      const level=row.querySelector(".kpp-storage-level");
      const track=row.querySelector(".kpp-storage-track");
      if(fill){fill.style.width=pct.toFixed(1)+"%";fill.className="kpp-storage-fill "+cls;}
      if(level){level.textContent=formatPct(pct);level.className="kpp-storage-level "+cls;}
      if(track)track.title=`Kapasitas ${new Intl.NumberFormat("id-ID").format(cap)} L`;
    });
    return true;
  }

  function patchUsage(){
    const cards=[...document.querySelectorAll(".kpp-usage-day-card")];
    if(!cards.length)return false;
    const values=cards.map(card=>parseIdNumber(card.querySelector(".kpp-usage-liter")?.textContent));
    const valid=values.filter(Number.isFinite);
    if(!valid.length)return false;
    const min=Math.min(...valid),max=Math.max(...valid),span=Math.max(1,max-min);
    cards.forEach((card,i)=>{
      const value=values[i];
      if(!Number.isFinite(value))return;
      const bar=card.querySelector(".kpp-usage-column");
      const delta=card.querySelector(".kpp-usage-delta");
      const h=max===min?65:35+((value-min)/span)*60;
      if(bar)bar.style.setProperty("--bar-h",h.toFixed(1)+"%");
      if(!delta)return;
      if(i===0||!Number.isFinite(values[i-1])||values[i-1]<=0){delta.className="kpp-usage-delta start";delta.textContent="AWAL";return;}
      const pct=((value-values[i-1])/values[i-1])*100;
      if(Math.abs(pct)<.05){delta.className="kpp-usage-delta flat";delta.textContent="• STABIL";}
      else if(pct>0){delta.className="kpp-usage-delta up";delta.textContent=`▲ ${new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1}).format(Math.abs(pct))}%`;}
      else{delta.className="kpp-usage-delta down";delta.textContent=`▼ ${new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1}).format(Math.abs(pct))}%`;}
    });
    return true;
  }

  function install(){
    patchUsage();
    patchStorage().catch(()=>{});
    const root=document.querySelector(".dashboard-workspace .container");
    if(!root)return false;
    const observer=new MutationObserver(()=>{
      patchUsage();
      patchStorage().catch(()=>{});
    });
    observer.observe(root,{childList:true,subtree:true});
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(install()||tries>=180)clearInterval(timer);
  },120);
  document.addEventListener("DOMContentLoaded",install,{once:true});
})();
