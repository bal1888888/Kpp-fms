(function(){
  "use strict";
  const MAX_GROUPS=10;
  function init(){
    document.querySelectorAll(".kpp-fc-picker").forEach(picker=>{
      const list=picker.querySelector(".kpp-fc-list");
      if(!list||picker.dataset.egiTreeReady==="1")return;
      const options=[...list.querySelectorAll(".kpp-fc-option")];
      if(!options.length)return;
      const rows=options.map(o=>{const input=o.querySelector("input");const span=o.querySelector("span");return{input,span,unit:String(input?.value||"").trim().toUpperCase(),egi:String(span?.querySelector("small")?.textContent||"").trim()||"TANPA EGI"}}).filter(x=>x.input&&x.unit);
      if(!rows.length)return;
      const groups=new Map();rows.forEach(r=>{if(!groups.has(r.egi))groups.set(r.egi,{egi:r.egi,rows:[]});groups.get(r.egi).rows.push(r)});
      const wrap=document.createElement("div");wrap.className="kpp-fc-egi-tree";
      const search=picker.querySelector(".kpp-fc-search");
      function selectedGroups(){let n=0;groups.forEach(g=>{if(g.rows.some(r=>r.input.checked))n++});return n}
      function sync(g){if(!g.box)return;const c=g.rows.filter(r=>r.input.checked).length;g.box.checked=c===g.rows.length;g.box.indeterminate=c>0&&c<g.rows.length;g.count.textContent=c?`${c}/${g.rows.length}`:`${g.rows.length} unit`}
      function fire(input){input.dispatchEvent(new Event("change",{bubbles:true}))}
      function render(){wrap.innerHTML="";groups.forEach(g=>{const row=document.createElement("div");row.className="kpp-fc-egi-group";const head=document.createElement("div");head.className="kpp-fc-egi-head";const arrow=document.createElement("button");arrow.type="button";arrow.className="kpp-fc-egi-arrow";arrow.textContent="▸";const box=document.createElement("input");box.type="checkbox";box.className="kpp-fc-egi-check";const title=document.createElement("span");title.className="kpp-fc-egi-title";title.textContent=g.egi;const count=document.createElement("small");count.className="kpp-fc-egi-count";g.box=box;g.count=count;head.append(arrow,box,title,count);const children=document.createElement("div");children.className="kpp-fc-egi-children";g.rows.forEach(r=>{const child=document.createElement("label");child.className="kpp-fc-egi-child";child.append(r.input,document.createTextNode(r.unit));r.input.addEventListener("change",()=>sync(g));children.append(child)});box.addEventListener("change",()=>{if(box.checked&&selectedGroups()>=MAX_GROUPS&&g.rows.every(r=>!r.input.checked)){box.checked=false;box.indeterminate=false;return}g.rows.forEach(r=>{r.input.checked=box.checked;fire(r.input)});sync(g)});arrow.addEventListener("click",()=>{const open=children.classList.toggle("open");arrow.textContent=open?"▾":"▸"});row.append(head,children);wrap.append(row);sync(g)})}
      function filter(q){q=String(q||"").toLowerCase().trim();[...wrap.children].forEach((row,i)=>{const g=[...groups.values()][i];const hit=!q||g.egi.toLowerCase().includes(q)||g.rows.some(r=>r.unit.toLowerCase().includes(q));row.style.display=hit?"":"none";if(q&&hit){row.querySelector(".kpp-fc-egi-children").classList.add("open");row.querySelector(".kpp-fc-egi-arrow").textContent="▾"}})}
      list.style.display="none";list.parentElement.insertBefore(wrap,list);picker.dataset.egiTreeReady="1";
      if(search){search.placeholder="Cari EGI atau code unit...";search.addEventListener("input",()=>filter(search.value))}
      render();
    });
  }
  const css=document.createElement("style");css.textContent=`.kpp-fc-egi-tree{max-height:245px;overflow:auto}.kpp-fc-egi-head{display:flex;align-items:center;gap:7px;padding:7px;border-radius:7px;background:#f8fafc;margin-bottom:2px}.kpp-fc-egi-arrow{border:0;background:transparent;padding:0;width:18px;height:20px;font-size:13px;color:#1d4ed8;cursor:pointer}.kpp-fc-egi-check{width:14px!important;height:14px!important}.kpp-fc-egi-title{font-size:10px;font-weight:900;color:#0f172a;flex:1}.kpp-fc-egi-count{font-size:8px;color:#64748b;font-weight:800}.kpp-fc-egi-children{display:none;padding-left:30px}.kpp-fc-egi-children.open{display:block}.kpp-fc-egi-child{display:flex;align-items:center;gap:7px;padding:5px 7px;font-size:9px;color:#334155;cursor:pointer}.kpp-fc-egi-child input{width:14px!important;height:14px!important;margin:0!important}.kpp-fc-egi-child:hover{background:#eff6ff;border-radius:6px}`;document.head.appendChild(css);
  const timer=setInterval(init,300);setTimeout(()=>clearInterval(timer),20000);
})();
