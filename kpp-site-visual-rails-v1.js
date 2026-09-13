// KPP-FMS visual rails v1
// Decorative mining imagery for real empty desktop margins only. Never overlaps working content.
(() => {
  "use strict";

  const STYLE_ID="kppSiteVisualRailsV1Style";
  const LEFT_ID="kppSiteVisualRailLeft";
  const RIGHT_ID="kppSiteVisualRailRight";
  const LEFT_IMAGE="https://commons.wikimedia.org/wiki/Special:Redirect/file/U.S._Marine_Corps_Cpl._Jesus_Garza%2C_a_fuel_truck_operator_with_the_1st_Battalion%2C_7th_Marine_Regiment%2C_refuels_a_mine-resistant%2C_ambush-protected_vehicle_during_a_mission_rehearsal_exercise_at_Forward_Operating_140313-M-OM885-259.jpg?width=1280";
  const RIGHT_IMAGE="https://commons.wikimedia.org/wiki/Special:Redirect/file/Komatsu_HD785-7_%2855087867682%29.jpg?width=1280";
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
        position:fixed;top:0;bottom:0;display:none;pointer-events:none;z-index:3;overflow:hidden;
        background:#eef5fb;opacity:.94;contain:layout paint;
      }
      .kpp-site-visual-photo{position:absolute;inset:0;background-repeat:no-repeat;background-size:cover;filter:saturate(.88) contrast(.98)}
      .kpp-site-visual-rail.left{border-radius:0 24px 24px 0;box-shadow:inset -18px 0 34px rgba(238,245,251,.34),0 12px 34px rgba(37,99,235,.06)}
      .kpp-site-visual-rail.left .kpp-site-visual-photo{background-position:center center}
      .kpp-site-visual-rail.right{border-radius:24px 0 0 24px;box-shadow:inset 18px 0 34px rgba(238,245,251,.38),0 12px 34px rgba(37,99,235,.06)}
      .kpp-site-visual-rail.right .kpp-site-visual-photo{background-position:52% center}
      .kpp-site-visual-veil{position:absolute;inset:0}
      .left .kpp-site-visual-veil{background:linear-gradient(90deg,rgba(238,245,251,.02) 0%,rgba(238,245,251,.04) 48%,rgba(238,245,251,.54) 82%,rgba(238,245,251,.98) 100%)}
      .right .kpp-site-visual-veil{background:linear-gradient(90deg,rgba(238,245,251,.98) 0%,rgba(238,245,251,.48) 20%,rgba(238,245,251,.06) 52%,rgba(238,245,251,.02) 100%)}
      .kpp-site-visual-label{position:absolute;left:20px;right:20px;bottom:58px;color:#fff;text-shadow:0 2px 12px rgba(2,6,23,.72)}
      .kpp-site-visual-label strong{display:block;font-size:22px;line-height:1;font-weight:950;letter-spacing:.02em}
      .kpp-site-visual-label span{display:block;margin-top:6px;font-size:9px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;opacity:.92}
      .right .kpp-site-visual-label{text-align:right}
      .kpp-site-visual-credit{position:absolute;left:16px;right:16px;bottom:18px;color:rgba(255,255,255,.78);font-size:6px;font-weight:700;line-height:1.25;text-shadow:0 1px 5px rgba(2,6,23,.8)}
      .right .kpp-site-visual-credit{text-align:right}
      @media(max-width:${MIN_VIEWPORT-1}px){.kpp-site-visual-rail{display:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureRail(id,side,title,subtitle,credit){
    let el=document.getElementById(id);
    if(el)return el;
    el=document.createElement("div");
    el.id=id;
    el.className=`kpp-site-visual-rail ${side}`;
    el.setAttribute("aria-hidden","true");
    el.innerHTML=`<div class="kpp-site-visual-photo"></div><div class="kpp-site-visual-veil"></div><div class="kpp-site-visual-label"><strong>${title}</strong><span>${subtitle}</span></div><div class="kpp-site-visual-credit">${credit}</div>`;
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
    const selectors=[".dashboard-workspace .container","main .container",".page-shell .container",".app-main .container",".content .container",".container","main"];
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

  function hide(el){if(el){el.style.display="none";el.style.width="0"}}
  function show(el,x,width,image){
    el.style.display="block";
    el.style.left=`${Math.round(x)}px`;
    el.style.width=`${Math.round(width)}px`;
    const photo=el.querySelector(".kpp-site-visual-photo");
    if(photo && !photo.dataset.loaded){photo.style.backgroundImage=`url("${image}")`;photo.dataset.loaded="1"}
  }

  let raf=0;
  function layout(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>{
      const left=document.getElementById(LEFT_ID),right=document.getElementById(RIGHT_ID);
      if(window.innerWidth<MIN_VIEWPORT){hide(left);hide(right);return}
      const anchor=findAnchor();
      if(!anchor){hide(left);hide(right);return}
      const rect=anchor.getBoundingClientRect();
      const sideEdge=fixedSidebarRight();
      const leftGap=Math.floor(rect.left-sideEdge-10);
      const rightGap=Math.floor(window.innerWidth-rect.right-10);
      if(leftGap>=MIN_GAP){const width=Math.min(MAX_LEFT,leftGap);show(left,Math.max(sideEdge+4,rect.left-width-8),width,LEFT_IMAGE)}else hide(left);
      if(rightGap>=MIN_GAP){const width=Math.min(MAX_RIGHT,rightGap);show(right,rect.right+8,width,RIGHT_IMAGE)}else hide(right);
    });
  }

  ensureStyle();
  ensureRail(LEFT_ID,"left","FT075","Fuel Truck • Pengisian Unit","Foto referensi: U.S. Marine Corps / Public Domain");
  ensureRail(RIGHT_ID,"right","HD 7457","Komatsu 785","Foto referensi: Alexandre Prévot / Wikimedia Commons / CC BY-SA");
  layout();
  window.addEventListener("resize",layout,{passive:true});
  window.addEventListener("orientationchange",layout,{passive:true});
  document.addEventListener("transitionend",layout,{passive:true});
  document.addEventListener("click",()=>setTimeout(layout,120),{passive:true});
  if("ResizeObserver" in window){const ro=new ResizeObserver(layout);ro.observe(document.documentElement);const anchor=findAnchor();if(anchor)ro.observe(anchor)}
})();
