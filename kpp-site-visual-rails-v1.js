// KPP-FMS visual rails v1
// Decorative mining imagery for real empty desktop margins only. Never overlaps working content.
(() => {
  "use strict";

  const STYLE_ID="kppSiteVisualRailsV1Style";
  const LEFT_ID="kppSiteVisualRailLeft";
  const RIGHT_ID="kppSiteVisualRailRight";
  const IMAGE_URL="assets/kpp-site-visual-rails.webp";
  const MIN_VIEWPORT=1180;
  const MIN_GAP=132;
  const MAX_LEFT=265;
  const MAX_RIGHT=300;

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
        z-index:3;
        overflow:hidden;
        background:#eef5fb;
        opacity:.92;
        filter:saturate(.92) contrast(.98);
        contain:layout paint;
      }
      .kpp-site-visual-rail::before{
        content:"";
        position:absolute;
        inset:0;
        background-image:url("${IMAGE_URL}");
        background-repeat:no-repeat;
        background-size:auto 100vh;
      }
      .kpp-site-visual-rail.left{
        border-radius:0 24px 24px 0;
        box-shadow:inset -20px 0 34px rgba(238,245,251,.34),0 12px 34px rgba(37,99,235,.06);
      }
      .kpp-site-visual-rail.left::before{background-position:-68px center;}
      .kpp-site-visual-rail.left::after{
        content:"";
        position:absolute;
        inset:0;
        background:linear-gradient(90deg,rgba(238,245,251,.02) 0%,rgba(238,245,251,.05) 54%,rgba(238,245,251,.56) 82%,rgba(238,245,251,.98) 100%);
      }
      .kpp-site-visual-rail.right{
        border-radius:24px 0 0 24px;
        box-shadow:inset 20px 0 34px rgba(238,245,251,.38),0 12px 34px rgba(37,99,235,.06);
      }
      .kpp-site-visual-rail.right::before{background-position:right center;}
      .kpp-site-visual-rail.right::after{
        content:"";
        position:absolute;
        inset:0;
        background:
          linear-gradient(180deg,rgba(238,245,251,.99) 0%,rgba(238,245,251,.96) 18%,rgba(238,245,251,.78) 31%,rgba(238,245,251,.20) 48%,rgba(238,245,251,.04) 62%),
          linear-gradient(90deg,rgba(238,245,251,.99) 0%,rgba(238,245,251,.52) 18%,rgba(238,245,251,.08) 48%,rgba(238,245,251,.02) 100%);
      }
      @media(max-width:${MIN_VIEWPORT-1}px){.kpp-site-visual-rail{display:none!important;}}
      @media(prefers-reduced-motion:reduce){.kpp-site-visual-rail{transition:none!important;}}
    `;
    document.head.appendChild(style);
  }

  function ensureRail(id,side){
    let el=document.getElementById(id);
    if(el)return el;
    el=document.createElement("div");
    el.id=id;
    el.className=`kpp-site-visual-rail ${side}`;
    el.setAttribute("aria-hidden","true");
    document.body.appendChild(el);
    return el;
  }

  function visibleRect(el){
    if(!el)return null;
    const r=el.getBoundingClientRect();
    if(r.width<260 || r.height<160)return null;
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
      const nodes=[...document.querySelectorAll(selector)];
      for(const node of nodes){
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

  let raf=0;
  function layout(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const left=document.getElementById(LEFT_ID);
      const right=document.getElementById(RIGHT_ID);
      if(window.innerWidth<MIN_VIEWPORT){hide(left);hide(right);return;}

      const anchor=findAnchor();
      if(!anchor){hide(left);hide(right);return;}
      const rect=anchor.getBoundingClientRect();
      const sideEdge=fixedSidebarRight();

      const leftGap=Math.floor(rect.left-sideEdge-10);
      const rightGap=Math.floor(window.innerWidth-rect.right-10);

      if(leftGap>=MIN_GAP){
        const width=Math.min(MAX_LEFT,leftGap);
        const x=Math.max(sideEdge+4,rect.left-width-8);
        left.style.display="block";
        left.style.left=`${Math.round(x)}px`;
        left.style.width=`${Math.round(width)}px`;
      }else hide(left);

      if(rightGap>=MIN_GAP){
        const width=Math.min(MAX_RIGHT,rightGap);
        right.style.display="block";
        right.style.left=`${Math.round(rect.right+8)}px`;
        right.style.width=`${Math.round(width)}px`;
      }else hide(right);
    });
  }

  ensureStyle();
  ensureRail(LEFT_ID,"left");
  ensureRail(RIGHT_ID,"right");
  layout();

  window.addEventListener("resize",layout,{passive:true});
  window.addEventListener("orientationchange",layout,{passive:true});
  document.addEventListener("transitionend",layout,{passive:true});
  document.addEventListener("click",()=>setTimeout(layout,120),{passive:true});

  if("ResizeObserver" in window){
    const ro=new ResizeObserver(layout);
    ro.observe(document.documentElement);
    const anchor=findAnchor();
    if(anchor)ro.observe(anchor);
  }
})();
