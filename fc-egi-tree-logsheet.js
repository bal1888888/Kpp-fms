(function(){
  "use strict";
  const MAX_GROUPS=10;
  let busy=false;
  async function init(){
    if(busy)return;
    const pickers=[...document.querySelectorAll(".kpp-fc-picker")];
    if(!pickers.length)return;
    busy=true;
    try{
      let master=[];
      if(window.KPP?.db){
        const {data}=await window.KPP.db.from("unit_master").select("code_unit,egi,active").eq("active",true).order("egi",{ascending:true}).order("code_unit",{ascending:true});
        master=(data||[]).map(r=>({unit:String(r.code_unit||"").trim().toUpperCase(),egi:String(r.egi||"").trim()||"TANPA EGI"})).filter(x=>x.unit);
      }
      const egiByUnit=new Map(master.map(x=>[x.unit,x.egi]));
      pickers.forEach(picker=>{
        if(picker.dataset.egiTreeReady==="1")return;
        const list=picker.querySelector(".kpp-fc-list"),options=list?[...list.querySelectorAll(".kpp-fc-option")]:[];
        if(!list||!options.length)return;
        const rows=options.map(o=>{const input=o.querySelector("input");const span=o.querySelector("span");const unit=String(input?.value||span?.textContent||"").trim().split(/\s+/)[0].toUpperCase();return{input,unit,egi:egiByUnit.get(unit)||String(span?.querySelector("small")?.textContent||"").trim()||"TANPA EGI"}}).filter(x=>x.input&&x.unit);
        const groups=new Map();rows.forEach(r=>{if(!groups.has(r.egi))groups.set(r.egi,{egi:r.egi,rows:[]});groups.get(r.egi).rows.push(r)});
        const wrap=document.createElement("div");wrap.className="kpp-fc-egi-tree";
        const search=picker.querySelector(".kpp-fc-search");
        const sync=g=>{const c=g.rows.filter(r=>r.input.checked).length;g.box.checked=c===g.rows.length&&c>0;g.box.indeterminate=c>0&&c<g.rows.length;g.count.textContent=c?`${c}/${g.rows.length}`:`${g.rows.length} unit`};
        const selectedGroups=()=>[...groups.values()].filter(g=>g.rows.some(r=>r.input.checked)).length;
        groups.forEach(g=>{
          const row=document.createElement("div");row.className="kpp-fc-egi-group";
          const head=document.createElement("div");head.className="kpp-fc-egi-head";
          const arrow=document.createElement("button");arrow.type="button";arrow.className="kpp-fc-egi-arrow";arrow.textContent="▸";
          const box=document.createElement("input");box.type="checkbox";box.className="kpp-fc-egi-check";g.box=box;
          const title=document.createElement("span");title.className="kpp-fc-egi-title";title.textContent=g.egi;
          const count=document.createElement("small");count.className="kpp-fc-egi-count";g.count=count;
          const children=document.createElement("div");children.className="kpp-fc-egi-children";
          g.rows.forEach(r=>{const child=document.createElement("label");child.className="kpp-fc-egi-child";child.append(r.input,document.createTextNode(r.unit));r.input.addEventListener("change",()=>sync(g));children.append(child)});
          box.addEventListener("change",()=>{if(box.checked&&selectedGroups()>=MAX_GROUPS&&g.rows.every(r=>!r.input.checked)){box.checked=false;return}g.rows.forEach(r=>{r.input.checked=box.checked;r.input.dispatchEvent(new Event("change",{bubbles:true}))});sync(g)});
          arrow.addEventListener("click",()=>{const open=children.classList.toggle("open");arrow.textContent=open?"▾":"▸"});
          head.append(arrow,box,title,count);row.append(head,children);wrap.append(row);sync(g);
        });
        list.style.display="none";list.parentElement.insertBefore(wrap,list);picker.dataset.egiTreeReady="1";
        if(search){search.placeholder="Cari EGI atau code unit...";search.addEventListener("input",()=>{const q=search.value.toLowerCase().trim();[...wrap.children].forEach((row,i)=>{const g=[...groups.values()][i],hit=!q||g.egi.toLowerCase().includes(q)||g.rows.some(r=>r.unit.toLowerCase().includes(q));row.style.display=hit?"":"none";if(q&&hit){row.querySelector(".kpp-fc-egi-children").classList.add("open");row.querySelector(".kpp-fc-egi-arrow").textContent="▾"}})})}
      });
    }finally{busy=false}
  }
  const css=document.createElement("style");css.textContent=`.kpp-fc-egi-tree{max-height:245px;overflow:auto}.kpp-fc-egi-head{display:flex;align-items:center;gap:7px;padding:7px;border-radius:7px;background:#f8fafc;margin-bottom:2px}.kpp-fc-egi-arrow{border:0;background:transparent;padding:0;width:18px;height:20px;font-size:13px;color:#1d4ed8;cursor:pointer}.kpp-fc-egi-check{width:14px!important;height:14px!important}.kpp-fc-egi-title{font-size:10px;font-weight:900;color:#0f172a;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kpp-fc-egi-count{font-size:8px;color:#64748b;font-weight:800;white-space:nowrap}.kpp-fc-egi-children{display:none;padding-left:30px}.kpp-fc-egi-children.open{display:block}.kpp-fc-egi-child{display:flex;align-items:center;gap:7px;padding:5px 7px;font-size:9px;color:#334155;cursor:pointer}.kpp-fc-egi-child input{width:14px!important;height:14px!important;margin:0!important}.kpp-fc-egi-child:hover{background:#eff6ff;border-radius:6px}`;document.head.appendChild(css);
  const timer=setInterval(init,500);setTimeout(()=>clearInterval(timer),30000);
})();
