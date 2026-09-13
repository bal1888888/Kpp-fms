// KPP-FMS FC chart gap bridge v1
// Keeps invalid/missing FC samples visible as gaps, but bridges them with a dashed guide so the trend is still readable.
(() => {
  "use strict";

  const STYLE_ID="kppFcGapBridgeStyle";
  const BRIDGE_CLASS="kpp-fc-gap-bridge";
  const MARK_CLASS="kpp-fc-gap-mark";
  let observer=null;
  let watchedRoot=null;

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .kpp-fc-gap-note{display:inline-flex;align-items:center;gap:5px;margin-left:8px;padding:3px 7px;border-radius:999px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:7.5px;font-weight:800;white-space:nowrap}
      .kpp-fc-gap-note::before{content:"";width:13px;border-top:2px dashed #f59e0b}
      @media(max-width:760px){.kpp-fc-gap-note{font-size:7px;padding:3px 6px;margin-left:4px}}
    `;
    document.head.appendChild(style);
  }

  function n(value){
    const out=Number(value);
    return Number.isFinite(out)?out:null;
  }

  function uniqueSorted(values){
    return [...new Set(values.filter(Number.isFinite).map(v=>Number(v.toFixed(3))))].sort((a,b)=>a-b);
  }

  function estimateStep(svg){
    const xs=uniqueSorted([...svg.querySelectorAll("circle[data-unit]")].map(c=>n(c.getAttribute("cx"))));
    if(xs.length<2)return null;
    const diffs=[];
    for(let i=1;i<xs.length;i++){
      const d=xs[i]-xs[i-1];
      if(d>0.5)diffs.push(d);
    }
    if(!diffs.length)return null;
    return Math.min(...diffs);
  }

  function removeOld(svg){
    svg.querySelectorAll(`.${BRIDGE_CLASS},.${MARK_CLASS}`).forEach(el=>el.remove());
  }

  function ensureLegend(root,hasGap){
    root.querySelectorAll(".kpp-fc-gap-note").forEach(el=>el.remove());
    if(!hasGap)return;
    const legend=root.querySelector(".kpp-fc-legend");
    if(!legend)return;
    const note=document.createElement("span");
    note.className="kpp-fc-gap-note";
    note.textContent="Tanggal tanpa sampel FC valid";
    note.title="Garis putus-putus hanya menghubungkan dua sampel FC valid. Nilai pada tanggal yang kosong tidak dibuat atau ditebak.";
    legend.appendChild(note);
  }

  function patchSvg(svg,root){
    if(!svg)return false;
    removeOld(svg);
    const step=estimateStep(svg);
    if(!Number.isFinite(step)||step<=0)return false;

    const ns="http://www.w3.org/2000/svg";
    const byUnit=new Map();
    [...svg.querySelectorAll("circle[data-unit]")].forEach(circle=>{
      const unit=String(circle.getAttribute("data-unit")||"");
      if(!unit)return;
      if(!byUnit.has(unit))byUnit.set(unit,[]);
      byUnit.get(unit).push(circle);
    });

    let hasGap=false;
    byUnit.forEach(circles=>{
      circles.sort((a,b)=>n(a.getAttribute("cx"))-n(b.getAttribute("cx")));
      for(let i=1;i<circles.length;i++){
        const a=circles[i-1],b=circles[i];
        const x1=n(a.getAttribute("cx")),y1=n(a.getAttribute("cy"));
        const x2=n(b.getAttribute("cx")),y2=n(b.getAttribute("cy"));
        if(![x1,y1,x2,y2].every(Number.isFinite))continue;
        const slots=(x2-x1)/step;
        if(slots<1.5)continue;
        hasGap=true;

        const color=a.getAttribute("stroke")||b.getAttribute("stroke")||"#2563eb";
        const line=document.createElementNS(ns,"line");
        line.setAttribute("x1",x1);line.setAttribute("y1",y1);
        line.setAttribute("x2",x2);line.setAttribute("y2",y2);
        line.setAttribute("stroke",color);
        line.setAttribute("stroke-width","2");
        line.setAttribute("stroke-dasharray","5 5");
        line.setAttribute("stroke-linecap","round");
        line.setAttribute("opacity","0.7");
        line.setAttribute("pointer-events","none");
        line.setAttribute("class",BRIDGE_CLASS);
        svg.insertBefore(line,a);

        const mark=document.createElementNS(ns,"circle");
        mark.setAttribute("cx",String((x1+x2)/2));
        mark.setAttribute("cy",String((y1+y2)/2));
        mark.setAttribute("r","3");
        mark.setAttribute("fill","#fff7ed");
        mark.setAttribute("stroke","#f59e0b");
        mark.setAttribute("stroke-width","1.5");
        mark.setAttribute("class",MARK_CLASS);
        mark.setAttribute("pointer-events","all");
        const missingCount=Math.max(1,Math.round(slots)-1);
        const title=document.createElementNS(ns,"title");
        title.textContent=`${missingCount} tanggal di antara titik ini tidak punya sampel FC valid. Garis putus-putus hanya penghubung visual, bukan nilai hasil tebakan.`;
        mark.appendChild(title);
        svg.appendChild(mark);
      }
    });

    ensureLegend(root,hasGap);
    return hasGap;
  }

  function patchRoot(root){
    const svg=root?.querySelector(".kpp-fc-chart svg");
    if(!svg){ensureLegend(root,false);return;}
    patchSvg(svg,root);
  }

  function observe(root){
    if(watchedRoot===root)return;
    observer?.disconnect();
    watchedRoot=root;
    observer=new MutationObserver(mutations=>{
      const meaningful=mutations.some(m=>[...m.addedNodes,...m.removedNodes].some(node=>{
        if(node.nodeType!==1)return false;
        return !node.classList?.contains(BRIDGE_CLASS) && !node.classList?.contains(MARK_CLASS) && !node.classList?.contains("kpp-fc-gap-note");
      }));
      if(!meaningful)return;
      observer.disconnect();
      patchRoot(root);
      observer.observe(root,{childList:true,subtree:true});
    });
    observer.observe(root,{childList:true,subtree:true});
    patchRoot(root);
  }

  function install(){
    injectStyle();
    const root=document.getElementById("dashboardFcChart") || document.querySelector(".kpp-fc-widget");
    if(!root)return false;
    observe(root);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()||attempts>=180)clearInterval(timer);
  },100);
  document.addEventListener("DOMContentLoaded",install,{once:true});
})();
