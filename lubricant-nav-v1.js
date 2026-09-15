(function(root){
  "use strict";

  function install(){
    const profile=root.KPP_PROFILE;
    if(!profile || !["gl","admin","atasan"].includes(profile.role)) return;

    const nav=document.querySelector("#kppRoleNav .kpp-sidebar-nav");
    if(nav && !nav.querySelector('a[href="lubricant.html"]')){
      const link=document.createElement("a");
      link.className="kpp-sidebar-link"+(root.KPP_ACTIVE_PAGE==="lubricant"?" active":"");
      link.href="lubricant.html";
      link.dataset.kppMenu="lubricant oli stock yard lo lube skid";
      link.innerHTML='<span class="kpp-sidebar-icon">🛢️</span><span class="kpp-sidebar-text">Lubricant / Oli</span>';

      const stock=nav.querySelector('a[href="stock.html"]');
      if(stock && stock.nextSibling) nav.insertBefore(link,stock.nextSibling);
      else nav.appendChild(link);
    }

    if(root.KPP_ACTIVE_PAGE==="lubricant"){
      const title=document.querySelector(".kpp-topbar-page strong");
      const sub=document.querySelector(".kpp-topbar-page small");
      if(title) title.textContent="Lubricant Stock & Movement";
      if(sub) sub.textContent="KPP TRAM Fuel & Lubricant Management System";
      document.title="Lubricant Stock & Movement - KPP TRAM FMS";
    }
  }

  document.addEventListener("kpp-auth-ready",install);
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>setTimeout(install,0),{once:true});
  else setTimeout(install,0);
})(typeof window!=="undefined"?window:globalThis);
