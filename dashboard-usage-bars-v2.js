// KPP-FMS Dashboard daily usage bars v2
// Makes 5-day movement easier to read without changing the liter values.
(() => {
  "use strict";

  const STYLE_ID="kppUsageBarsV2Style";
  const SVG_CLASS="kpp-usage-trend-svg";
  const NOTE_CLASS="kpp-usage-scale-note";
  const BASELINE_CLASS="kpp-usage-baseline";
  let hostObserver=null;
  let resizeObserver=null;
  let watchedHost=null;

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .dashboard-workspace #usageTrendBars.usage-bars{
        position:relative!important;
        border-bottom:0!important;
        overflow:visible!important;
      }
      .dashboard-workspace #usageTrendBars .usage-radial-item{
        position:relative!important;
        z-index:2!important;
      }
      .dashboard-workspace #usageTrendBars .usage-trend-ring.kpp-usage-scaled{
        height:calc(var(--usage-height) * 1%)!important;
        min-height:18px!important;
        transition:height .28s ease!important;
      }
      .${SVG_CLASS}{
        position:absolute;inset:0;z-index:3;width:100%;height:100%;pointer-events:none;overflow:visible;
      }
      .${SVG_CLASS} polyline{
        fill:none;stroke:#1d4ed8;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;opacity:.62;
      }
      .${SVG_CLASS} circle{
        fill:#fff;stroke:#1d4ed8;stroke-width:2;opacity:.9;
      }
      .${BASELINE_CLASS}{
        position:absolute;left:0;right:0;bottom:0;height:1px;background:#cbd5e1;z-index:1;pointer-events:none;
      }
      .${NOTE_CLASS}{
        position:absolute;right:2px;top:1px;z-index:4;padding:2px 5px;border-radius:999px;
        background:#eff6ff;color:#64748b;font-size:6.5px;font-weight:900;letter-spacing:.04em;pointer-events:none;
      }
      @media(max-width:720px){
        .${SVG_CLASS} polyline{stroke-width:1.8}
        .${SVG_CLASS} circle{r:2.4}
        .${NOTE_CLASS}{font-size:6px}
      }
    `;
    document.head.appendChild(style);
  }

  function parseLiter(text){
    const raw=String(text||"").toUpperCase().replace("L","").trim();
    if(!raw)return null;
    const normalized=raw.replace(/\./g,"").replace(",",".").replace(/[^0-9.-]/g,"");
    const value=Number(normalized);
    return Number.isFinite(value)?value:null;
  }

  function itemValue(item){
    return parseLiter(item.querySelector(".trend-ring-liter")?.textContent);
  }

  function relativeHeight(value,min,max){
    if(!(Number.isFinite(value)&&Number.isFinite(min)&&Number.isFinite(max)))return 55;
    if(max<=min)return 62;
    // Comparative chart: minimum stays visible, maximum has clear headroom.
    return 32+((value-min)/(max-min))*56;
  }

  function clearDecorations(host){
    host.querySelector(`.${SVG_CLASS}`)?.remove();
    host.querySelector(`.${BASELINE_CLASS}`)?.remove();
    host.querySelector(`.${NOTE_CLASS}`)?.remove();
  }

  function drawLine(host,items){
    host.querySelector(`.${SVG_CLASS}`)?.remove();
    const hostRect=host.getBoundingClientRect();
    if(hostRect.width<=0||hostRect.height<=0)return;

    const points=items.map(item=>{
      const bar=item.querySelector(".usage-trend-ring");
      if(!bar)return null;
      const rect=bar.getBoundingClientRect();
      return {
        x:(rect.left-hostRect.left)+(rect.width/2),
        y:(rect.top-hostRect.top)+1
      };
    }).filter(Boolean);
    if(points.length<2)return;

    const ns="http://www.w3.org/2000/svg";
    const svg=document.createElementNS(ns,"svg");
    svg.setAttribute("class",SVG_CLASS);
    svg.setAttribute("viewBox",`0 0 ${hostRect.width} ${hostRect.height}`);
    svg.setAttribute("preserveAspectRatio","none");

    const poly=document.createElementNS(ns,"polyline");
    poly.setAttribute("points",points.map(p=>`${p.x},${p.y}`).join(" "));
    svg.appendChild(poly);

    points.forEach(point=>{
      const circle=document.createElementNS(ns,"circle");
      circle.setAttribute("cx",point.x);
      circle.setAttribute("cy",point.y);
      circle.setAttribute("r","3");
      svg.appendChild(circle);
    });
    host.appendChild(svg);
  }

  function patchHost(host){
    if(!host)return;
    const items=[...host.querySelectorAll(".usage-radial-item")];
    if(!items.length){clearDecorations(host);return;}

    const values=items.map(itemValue).filter(Number.isFinite);
    if(!values.length){clearDecorations(host);return;}
    const min=Math.min(...values);
    const max=Math.max(...values);

    items.forEach(item=>{
      const value=itemValue(item);
      const bar=item.querySelector(".usage-trend-ring");
      if(!bar||!Number.isFinite(value))return;
      bar.classList.add("kpp-usage-scaled");
      bar.style.setProperty("--usage-height",relativeHeight(value,min,max).toFixed(2));
    });

    clearDecorations(host);
    const baseline=document.createElement("div");
    baseline.className=BASELINE_CLASS;
    host.appendChild(baseline);

    const note=document.createElement("div");
    note.className=NOTE_CLASS;
    note.textContent="SKALA RELATIF 5 HARI";
    note.title="Tinggi batang dinormalisasi agar perubahan harian lebih mudah terlihat; angka liter tetap nilai asli.";
    host.appendChild(note);

    requestAnimationFrame(()=>drawLine(host,items));
  }

  function observeHost(host){
    if(watchedHost===host)return;
    hostObserver?.disconnect();
    resizeObserver?.disconnect();
    watchedHost=host;

    hostObserver=new MutationObserver(mutations=>{
      const operationalChange=mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(node=>{
        if(node.nodeType!==1)return false;
        return !node.classList?.contains(SVG_CLASS) &&
          !node.classList?.contains(BASELINE_CLASS) &&
          !node.classList?.contains(NOTE_CLASS);
      }));
      if(!operationalChange)return;
      hostObserver.disconnect();
      patchHost(host);
      hostObserver.observe(host,{childList:true,subtree:false});
    });
    hostObserver.observe(host,{childList:true,subtree:false});

    if(typeof ResizeObserver!=="undefined"){
      resizeObserver=new ResizeObserver(()=>{
        const items=[...host.querySelectorAll(".usage-radial-item")];
        if(items.length)requestAnimationFrame(()=>drawLine(host,items));
      });
      resizeObserver.observe(host);
    }
    patchHost(host);
  }

  function install(){
    injectStyle();
    const host=document.getElementById("usageTrendBars");
    if(!host)return false;
    observeHost(host);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()||attempts>=160)clearInterval(timer);
  },100);
  document.addEventListener("DOMContentLoaded",install,{once:true});
})();
