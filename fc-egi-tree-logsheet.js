(function(){
  "use strict";
  function init(){
    if(window.KPP_ACTIVE_PAGE!=="logsheet") return;
    const picker=document.querySelector(".kpp-fc-picker");
    const list=document.querySelector(".kpp-fc-list");
    if(!picker||!list||picker.dataset.egiTreeReady==="1") return;
    const options=[...list.querySelectorAll(".kpp-fc-option")];
    if(!options.length) return;
    const rows=options.map(o=>{const input=o.querySelector("input"); const span=o.querySelector("span"); return {o,input,unit:(input?.value||span?.textContent||"").trim(),egi:(span?.querySelector("small")?.textContent||"").trim()};});
    const groups=new Map();
    rows.forEach(r=>{let g=groups.get(r.egi||"TANPA EGI");if(!g){g={egi:r.egi||"TANPA EGI",rows:[]};groups.set(g.egi,g)}g.rows.push(r)});
    const wrap=document.createElement("div"); wrap.className="kpp-fc-egi-tree";
    const search=picker.querySelector(".kpp-fc-search");
    if(search){ search.placeholder="Cari EGI atau code unit..."; search.addEventListener("input",()=>filter(search.value)); }
    function state(g){const n=g.rows.length,c=g.rows.filter(r=>r.input.checked).length;return c===0?0:c===n?2:1}
    function sync(g){const st=state(g); if(!g.box)return; g.box.checked=st===2; g.box.indeterminate=st===1; g.count.textContent=`${g.rows.filter(r=>r.input.checked).length}/${g.rows.length}`;}
    function render(){wrap.innerHTML=""; groups.forEach(g=>{const row=document.createElement("div");row.className="kpp-fc-egi-group"; const top=document.createElement("div");top.className="kpp-fc-egi-head"; const arrow=document.createElement("button");arrow.type="button";arrow.className="kpp-fc-egi-arrow";arrow.textContent="▸"; const box=document.createElement("input");box.type="checkbox";box.className="kpp-fc-egi-check"; const title=document.createElement("span");title.className="kpp-fc-egi-title";title.textContent=g.egi; const count=document.createElement("small");count.className="kpp-fc-egi-count"; g.box=box;g.count=count; top.append(arrow,box,title,count); const children=document.createElement("div");children.className="kpp-fc-egi-children";g.rows.forEach(r=>{const child=document.createElement("label");child.className="kpp-fc-egi-child";child.append(r.input,r.o.querySelector("span")||document.createTextNode(r.unit));children.append(child)}); box.addEventListener("change",()=>{g.rows.forEach(r=>r.input.checked=box.checked);sync(g)}); arrow.addEventListener("click",()=>{const open=children.classList.toggle("open");arrow.textContent=open?"▾":"▸"}); row.append(top,children);wrap.append(row);sync(g)});}
    function filter(q){q=q.toLowerCase().trim();wrap.querySelectorAll(".kpp-fc-egi-group").forEach((row,i)=>{const g=[...groups.values()][i];const hit=!q||g.egi.toLowerCase().includes(q)||g.rows.some(r=>r.unit.toLowerCase().includes(q));row.style.display=hit?"":"none";if(q){row.querySelector(".kpp-fc-egi-children")?.classList.add("open");row.querySelector(".kpp-fc-egi-arrow").textContent="▾"}})}
    list.style.display="none"; list.parentElement.insertBefore(wrap,list); picker.dataset.egiTreeReady="1";
    list.addEventListener("change",()=>groups.forEach(sync)); render();
  }
  const css=document.createElement("style");css.textContent=`.kpp-fc-egi-tree{max-height:245px;overflow:auto}.kpp-fc-egi-head{display:flex;align-items:center;gap:7px;padding:7px;border-radius:7px;background:#f8fafc;margin-bottom:2px}.kpp-fc-egi-arrow{border:0;background:transparent;padding:0;min-height:0;width:18px;height:20px;font-size:13px;color:#1d4ed8;cursor:pointer}.kpp-fc-egi-check{width:14px!important;height:14px!important}.kpp-fc-egi-title{font-size:10px;font-weight:900;color:#0f172a;flex:1}.kpp-fc-egi-count{font-size:8px;color:#64748b;font-weight:800}.kpp-fc-egi-children{display:none;padding-left:30px}.kpp-fc-egi-children.open{display:block}.kpp-fc-egi-child{display:flex;align-items:center;gap:7px;padding:5px 7px;font-size:9px;color:#334155}.kpp-fc-egi-child input{width:14px!important;height:14px!important;margin:0!important}.kpp-fc-egi-child:hover{background:#eff6ff;border-radius:6px}`;document.head.appendChild(css);
    const mo=new MutationObserver(()=>init());mo.observe(list,{childList:true,subtree:true});
  }
  const t=setInterval(()=>{if(document.readyState!=="loading")init()},400); setTimeout(()=>clearInterval(t),15000);
})();
