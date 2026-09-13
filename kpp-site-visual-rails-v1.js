// KPP-FMS visual rails v2
// Isi ruang kosong desktop dengan visual site tanpa menabrak sidebar atau area data.
(() => {
  "use strict";

  const STYLE_ID="kppSiteVisualRailsV2Style";
  const LEFT_ID="kppSiteVisualRailLeft";
  const RIGHT_ID="kppSiteVisualRailRight";
  const LEFT_IMAGE="assets/kpp-rail-ft075.webp";
  const RIGHT_IMAGE="assets/kpp-rail-hd7457.webp";
  const MIN_VIEWPORT=1180;
  const MIN_GAP=112;
  const MAX_LEFT=330;
  const MAX_RIGHT=360;

  const activePage=String(window.KPP_ACTIVE_PAGE||"").trim();
  const path=(location.pathname||"").toLowerCase();
  if(!activePage || /(?:^|\/)index\.html$/.test(path) || /(?:^|\/)login\.html$/.test(path))return;

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .kpp-site-visual-rail{
        position:fixed;
        top:0;
        bottom:0;
        display:none;
        pointer-events:none;
        z-index:2;
        overflow:hidden;
        background:#07182d;
        border:1px solid rgba(96,165,250,.08);
        box-shadow:0 0 34px rgba(2,6,23,.12);
        contain:layout paint;
      }
      .kpp-site-visual-rail.left{border-radius:0 22px 22px 0}
      .kpp-site-visual-rail.right{border-radius:22px 0 0 22px}
      .kpp-site-visual-photo{
        position:absolute;
        inset:0;
        background-repeat:no-repeat;
        background-size:cover;
        background-position:center center;
        filter:saturate(.95) contrast(1.03) brightness(.90);
        transform:scale(1.015);
      }
      .kpp-site-visual-rail.left .kpp-site-visual-photo{background-position:center center}
      .kpp-site-visual-rail.right .kpp-site-visual-photo{background-position:center center}
      .kpp-site-visual-veil{
        position:absolute;
        inset:0;
        background:linear-gradient(180deg,rgba(5,19,36,.08) 0%,rgba(5,19,36,.02) 52%,rgba(5,19,36,.44) 100%);
      }
      .kpp-site-visual-rail.left .kpp-site-visual-veil{
        background:
          linear-gradient(90deg,rgba(7,24,45,.08) 0%,rgba(7,24,45,.02) 64%,rgba(7,24,45,.72) 100%),
          linear-gradient(180deg,rgba(7,24,45,.08),rgba(7,24,45,.02) 62%,rgba(7,24,45,.42));
      }
      .kpp-site-visual-rail.right .kpp-site-visual-veil{
        background:
          linear-gradient(90deg,rgba(7,24,45,.70) 0%,rgba(7,24,45,.05) 34%,rgba(7,24,45,.02) 100%),
          linear-gradient(180deg,rgba(7,24,45,.08),rgba(7,24,45,.02) 62%,rgba(7,24,45,.42));
      }
      .kpp-site-visual-label{
        position:absolute;
        left:18px;
        right:18px;
        bottom:48px;
        color:#fff;
        text-shadow:0 2px 14px rgba(2,6,23,.95);
      }
      .kpp-site-visual-label strong{
        display:block;
        font-size:clamp(18px,1.55vw,27px);
        line-height:1;
        font-weight:950;
        letter-spacing:.02em;
      }
      .kpp-site-visual-label span{
        display:block;
        margin-top:6px;
        font-size:8px;
        font-weight:850;
        letter-spacing:.09em;
        text-transform:uppercase;
        opacity:.9;
      }
      .kpp-site-visual-rail.right .kpp-site-visual-label{text-align:right}
      .kpp-site-visual-accent{
        width:42px;
        height:3px;
        margin-top:12px;
        border-radius:999px;
        background:#22c55e;
        box-shadow:0 0 16px rgba(34,197,94,.30);
      }
      .kpp-site-visual-rail.right .kpp-site-visual-accent{margin-left:auto}
      @media(max-width:${MIN_VIEWPORT-1}px){.kpp-site-visual-rail{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureRail(id,side,title,subtitle){
    let el=document.getElementById(id);
    if(el)return el;
    el=document.createElement("div");
    el.id=id;
    el.className=`kpp-site-visual-rail ${side}`;
    el.setAttribute("aria-hidden","true");
    el.innerHTML=`
      <div class="kpp-site-visual-photo"></div>
      <div class="kpp-site-visual-veil"></div>
      <div class="kpp-site-visual-label">
        <strong>${title}</strong>
        <span>${subtitle}</span>
        <div class="kpp-site-visual-accent"></div>
      </div>`;
    document.body.appendChild(el);
    return el;
  }

  function visibleRect(el){
    if(!el)return null;
    const r=el.getBoundingClientRect();
    if(r.width<240 || r.height<150)return null;
    const cs=getComputedStyle(el);
    if(cs.display==="none" || cs.visibility==="hidden")return null;
    return r;
  }

  function findAnchor(){
    const selectors=[
      ".dashboard-workspace .container",
      "main .container",
      ".page-shell .container",
      ".app-main .container",
      ".content .container",
      ".container",
      "main"
    ];
    for(const selector of selectors){
      for(const node of document.querySelectorAll(selector)){
        const r=visibleRect(node);
        if(r && r.top<window.innerHeight*1.25)return node;
      }
    }
    return null;
  }

  function fixedSidebarRight(){
    const candidates=[...document.querySelectorAll("aside,[class*='sidebar'],[class*='side-nav'],[class*='sidenav'],[class*='side_menu'],[class*='sidemenu']")];
    let edge=0;
    for(const el of candidates){
      const r=el.getBoundingClientRect();
      if(r.width<48 || r.width>380 || r.height<window.innerHeight*.55 || r.left>18)continue;
      const cs=getComputedStyle(el);
      if(cs.display==="none" || cs.visibility==="hidden")continue;
      if(!["fixed","sticky","absolute"].includes(cs.position))continue;
      edge=Math.max(edge,Math.max(0,r.right));
    }
    return edge;
  }

  function hide(el){
    if(!el)return;
    el.style.display="none";
    el.style.width="0";
  }

  function show(el,x,width,image){
    el.style.display="block";
    el.style.left=`${Math.round(x)}px`;
    el.style.width=`${Math.round(width)}px`;
    const photo=el.querySelector(".kpp-site-visual-photo");
    if(photo && !photo.dataset.loaded){
      photo.style.backgroundImage=`url("${image}")`;
      photo.dataset.loaded="1";
    }
  }

  let raf=0;
  function layout(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const left=document.getElementById(LEFT_ID);
      const right=document.getElementById(RIGHT_ID);
      if(window.innerWidth<MIN_VIEWPORT){hide(left);hide(right);return}

      const anchor=findAnchor();
      if(!anchor){hide(left);hide(right);return}

      const rect=anchor.getBoundingClientRect();
      const sideEdge=fixedSidebarRight();
      const leftGap=Math.floor(rect.left-sideEdge-6);
      const rightGap=Math.floor(window.innerWidth-rect.right-6);

      if(leftGap>=MIN_GAP){
        const width=Math.min(MAX_LEFT,leftGap);
        const x=Math.max(sideEdge,rect.left-width-4);
        show(left,x,width,LEFT_IMAGE);
      }else hide(left);

      if(rightGap>=MIN_GAP){
        const width=Math.min(MAX_RIGHT,rightGap);
        const x=Math.min(window.innerWidth-width,rect.right+4);
        show(right,x,width,RIGHT_IMAGE);
      }else hide(right);
    });
  }

  ensureStyle();
  ensureRail(LEFT_ID,"left","FT075","Fuel Truck • Pengisian Unit");
  ensureRail(RIGHT_ID,"right","HD 7457","Komatsu 785");
  layout();

  window.addEventListener("resize",layout,{passive:true});
  window.addEventListener("orientationchange",layout,{passive:true});
  document.addEventListener("transitionend",layout,{passive:true});
  document.addEventListener("click",()=>setTimeout(layout,100),{passive:true});
  if("ResizeObserver" in window){
    const ro=new ResizeObserver(layout);
    ro.observe(document.documentElement);
    const anchor=findAnchor();
    if(anchor)ro.observe(anchor);
  }
})();
