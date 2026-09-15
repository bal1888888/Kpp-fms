(function(root){
  "use strict";
  const state={products:[],storages:[],balances:[],units:[],usages:[]};
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const esc=v=>String(v??"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
  const fmt=(v,d=0)=>new Intl.NumberFormat("id-ID",{minimumFractionDigits:d,maximumFractionDigits:d}).format(num(v));
  const db=()=>root.KPP?.db;
  const byId=(rows,id)=>rows.find(r=>Number(r.id)===Number(id));
  const productById=id=>byId(state.products,id);
  const storageById=id=>byId(state.storages,id);
  const balance=(storageId,productId)=>state.balances.find(b=>Number(b.storage_id)===Number(storageId)&&Number(b.product_id)===Number(productId));
  const todayWib=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());

  function inject(){
    if($("#lubeUsagePanel")) return;
    const panel=document.createElement("section");
    panel.className="panel lube-usage-panel";
    panel.id="lubeUsagePanel";
    panel.innerHTML=`
      <div class="panel-head lube-usage-head">
        <div><span class="eyebrow">PEMAKAIAN KE UNIT</span><h2>Oil Logsheet Mekanik</h2><p>Oli keluar dari LO / Lube Skid ke unit. Grease keluar langsung dari Yard. Job WELL / TRACK bisa dipilih dari Planner Inbox, sementara pekerjaan breakdown tetap bisa dicatat MANUAL.</p></div>
        <span class="usage-badge">STEP 5 • AKTIF</span>
      </div>
      <div class="lube-usage-layout">
        <article class="lube-usage-card">
          <h3>🛠️ Catat Pemakaian Lubricant</h3>
          <div class="lube-usage-note"><b>Patokan stock:</b> OIL hanya boleh keluar dari LO / Lube Skid. GREASE tetap Yard → Unit. Saldo dikurangi server-side dalam transaksi yang sama dengan logsheet.</div>
          <div class="form-grid">
            <div class="field"><label>Storage Sumber</label><select id="usageSource"><option value="">-- Pilih sumber --</option></select></div>
            <div class="field"><label>Jenis Oli / Grease</label><select id="usageProduct"><option value="">-- Pilih sumber dulu --</option></select></div>
            <div class="field wide"><label>Unit</label><input id="usageUnit" list="usageUnitList" autocomplete="off" placeholder="Ketik / pilih code unit"><datalist id="usageUnitList"></datalist></div>
            <div class="field"><label>Qty</label><input id="usageQty" type="number" min="0" step="0.01" placeholder="Liter / kg"></div>
            <div class="field"><label>Shift</label><select id="usageShift"><option value="">-- Opsional --</option><option value="1">Shift 1</option><option value="2">Shift 2</option></select></div>
            <div class="field"><label>Sumber Planner</label><select id="usagePlanner"><option value="WELL">WELL</option><option value="TRACK">TRACK</option><option value="MANUAL" selected>MANUAL</option></select></div>
            <div class="field"><label>No. WO / Referensi</label><input id="usagePlannerRef" placeholder="WO / task / ref planner"></div>
            <div class="field"><label>HM Unit</label><input id="usageHm" type="number" min="0" step="0.1" placeholder="Opsional"></div>
            <div class="field"><label>Nama Mekanik</label><input id="usageMechanic" placeholder="Wajib diisi"></div>
            <div class="field"><label>NRP Mekanik</label><input id="usageMechanicNrp" placeholder="Angka / huruf diperbolehkan"></div>
            <div class="field wide"><label>Catatan Pekerjaan</label><textarea id="usageNote" placeholder="Contoh: top up final drive / PM service / repair"></textarea></div>
          </div>
          <div class="lube-usage-preview" id="usagePreview">Pilih storage sumber dan produk untuk melihat saldo sebelum pemakaian.</div>
          <div class="form-actions"><button type="button" class="btn btn-primary" id="usageSave">SIMPAN PEMAKAIAN</button></div>
          <div class="lube-usage-status" id="usageStatus"></div>
        </article>
        <aside class="lube-usage-card">
          <h3>📊 Ringkasan Hari Ini</h3>
          <div class="lube-usage-summary">
            <div><small>TRANSAKSI</small><strong id="usageTodayCount">0</strong></div>
            <div><small>UNIT UNIK</small><strong id="usageTodayUnits">0</strong></div>
            <div><small>OIL</small><strong id="usageTodayOil">0 L</strong></div>
            <div><small>GREASE</small><strong id="usageTodayGrease">0 KG</strong></div>
          </div>
          <div class="preview"><b>Planner trace:</b> job WELL / TRACK yang dipilih akan otomatis berubah OPEN → USED bersamaan dengan transaksi stock. MANUAL tetap tersedia untuk breakdown tanpa WO.</div>
          <div class="preview" id="usageLatest">Belum ada pemakaian unit.</div>
        </aside>
      </div>
      <div class="lube-usage-tools">
        <input id="usageSearch" type="search" placeholder="Cari unit, produk, storage, mekanik, planner...">
        <button type="button" class="btn btn-soft" id="usageExport">UNDUH CSV LOGSHEET</button>
      </div>
      <div class="lube-usage-log">
        <table><thead><tr><th>Waktu</th><th>Unit</th><th>Produk</th><th>Dari</th><th>Qty</th><th>Planner</th><th>Mekanik</th><th>HM / Shift</th><th>Catatan</th></tr></thead><tbody id="usageBody"><tr><td colspan="9">Memuat logsheet...</td></tr></tbody></table>
      </div>`;
    const master=$$(".panel").find(p=>(p.textContent||"").includes("MASTER DATA"));
    if(master) master.insertAdjacentElement("beforebegin",panel); else $(".lube-wrap")?.appendChild(panel);
    bind();
    activateFlowStep();
  }

  function activateFlowStep(){
    const step=$$(".lube-flow-step").find(n=>(n.textContent||"").includes("Pemakaian ke Unit"));
    if(!step) return;
    step.classList.remove("future");step.classList.add("usage-live");
    const small=$("small",step);if(small)small.textContent="Aktif: Planner Inbox WELL/TRACK + Oil Logsheet + pemakaian manual.";
  }

  function bind(){
    $("#usageSource")?.addEventListener("change",()=>{renderProducts();renderPreview();});
    $("#usageProduct")?.addEventListener("change",renderPreview);
    $("#usageQty")?.addEventListener("input",renderPreview);
    $("#usageSave")?.addEventListener("click",saveUsage);
    $("#usageSearch")?.addEventListener("input",renderLog);
    $("#usageExport")?.addEventListener("click",exportCsv);
  }

  async function load(){
    if(!db()) return;
    try{
      const [products,storages,balances,usages,units]=await Promise.all([
        db().from("lubricant_products").select("*").eq("active",true).order("category").order("alias"),
        db().from("lubricant_storages").select("*").eq("active",true).order("storage_type").order("code"),
        db().from("lubricant_stock_balances").select("*").order("storage_id").order("product_id"),
        db().from("lubricant_unit_usages").select("*").order("created_at",{ascending:false}).limit(300),
        db().rpc("lubricant_unit_directory")
      ]);
      for(const r of [products,storages,balances,usages,units]) if(r.error) throw r.error;
      state.products=products.data||[];state.storages=storages.data||[];state.balances=balances.data||[];state.usages=usages.data||[];state.units=units.data||[];
      renderSources();renderUnits();renderProducts();renderPreview();renderSummary();renderLog();
    }catch(error){
      console.error("lubricant usage load",error);
      const body=$("#usageBody");if(body)body.innerHTML=`<tr><td colspan="9" class="lube-usage-empty">Gagal memuat logsheet: ${esc(error.message)}</td></tr>`;
    }
  }

  function renderSources(){
    const sel=$("#usageSource");if(!sel)return;
    const current=sel.value;
    const rows=state.storages.filter(s=>s.storage_type==="YARD"||["LO","LUBE_SKID"].includes(s.storage_type));
    sel.innerHTML='<option value="">-- Pilih sumber --</option>'+rows.map(s=>`<option value="${esc(s.code)}">${esc(s.code)} • ${esc(s.storage_type.replace("_"," "))}</option>`).join("");
    if([...sel.options].some(o=>o.value===current))sel.value=current;
  }

  function renderUnits(){
    const list=$("#usageUnitList");if(!list)return;
    list.innerHTML=state.units.map(u=>`<option value="${esc(u.code_unit)}">${esc([u.egi,u.code_ellips].filter(Boolean).join(" • "))}</option>`).join("");
  }

  function source(){return state.storages.find(s=>s.code===$("#usageSource")?.value)}
  function selectedProduct(){return state.products.find(p=>p.code===$("#usageProduct")?.value)}

  function renderProducts(){
    const sel=$("#usageProduct");if(!sel)return;
    const src=source();const current=sel.value;
    if(!src){sel.innerHTML='<option value="">-- Pilih sumber dulu --</option>';return;}
    let rows=[];
    if(src.storage_type==="YARD") rows=state.products.filter(p=>p.category==="GREASE");
    else{
      const productIds=new Set(state.balances.filter(b=>Number(b.storage_id)===Number(src.id)).map(b=>Number(b.product_id)));
      rows=state.products.filter(p=>p.category==="OIL"&&productIds.has(Number(p.id)));
    }
    sel.innerHTML='<option value="">-- Pilih produk --</option>'+rows.map(p=>{const q=num(balance(src.id,p.id)?.quantity);return `<option value="${esc(p.code)}">${esc(p.alias||p.name)} • saldo ${fmt(q,p.base_unit==="KG"?1:0)} ${esc(p.base_unit)}</option>`}).join("");
    if([...sel.options].some(o=>o.value===current))sel.value=current;
  }

  function renderPreview(){
    const host=$("#usagePreview");if(!host)return;
    const src=source();const p=selectedProduct();const qty=num($("#usageQty")?.value);
    if(!src||!p){host.textContent="Pilih storage sumber dan produk untuk melihat saldo sebelum pemakaian.";return;}
    const before=num(balance(src.id,p.id)?.quantity);const after=before-qty;
    host.innerHTML=`<strong>${esc(src.code)} • ${esc(p.alias||p.name)}</strong><br>Saldo tersedia ${fmt(before,p.base_unit==="KG"?1:0)} ${esc(p.base_unit)}${qty>0?` → setelah pemakaian <b>${fmt(after,p.base_unit==="KG"?1:0)} ${esc(p.base_unit)}</b>`:""}${qty>before?'<br><b style="color:#b91c1c">Qty melebihi saldo tersedia.</b>':""}`;
  }

  function setStatus(msg,type=""){
    const n=$("#usageStatus");if(!n)return;n.textContent=msg||"";n.className=`lube-usage-status ${type}`.trim();
  }

  function validUnit(value){return state.units.some(u=>String(u.code_unit||"").toUpperCase()===String(value||"").trim().toUpperCase())}

  async function saveUsage(){
    const src=source();const p=selectedProduct();const unit=$("#usageUnit")?.value.trim().toUpperCase();const qty=num($("#usageQty")?.value);const mechanic=$("#usageMechanic")?.value.trim();
    if(!src||!p){setStatus("Pilih storage sumber dan produk.","err");return;}
    if(!unit||!validUnit(unit)){setStatus("Pilih code unit yang terdaftar di Master Unit.","err");return;}
    if(qty<=0){setStatus("Qty pemakaian wajib lebih dari 0.","err");return;}
    if(!mechanic){setStatus("Nama mekanik wajib diisi.","err");return;}
    const before=num(balance(src.id,p.id)?.quantity);if(qty>before){setStatus(`Stock ${src.code} tidak cukup. Tersedia ${fmt(before,2)} ${p.base_unit}.`,"err");return;}
    const button=$("#usageSave");button.disabled=true;setStatus("Menyimpan pemakaian dan mengurangi stock...");
    try{
      const hmRaw=$("#usageHm")?.value;const shiftRaw=$("#usageShift")?.value;const plannerJobId=Number(root.KPP_LUBE_SELECTED_PLANNER_JOB_ID)||null;
      const {data,error}=await db().rpc("lubricant_issue_to_unit_v2",{
        p_request_id:crypto.randomUUID(),p_source_code:src.code,p_product_code:p.code,p_unit_code:unit,p_quantity:qty,
        p_planner_source:$("#usagePlanner")?.value||"MANUAL",p_planner_ref:$("#usagePlannerRef")?.value.trim()||null,
        p_mechanic_name:mechanic,p_mechanic_nrp:$("#usageMechanicNrp")?.value.trim()||null,
        p_hm:hmRaw===""?null:Number(hmRaw),p_shift:shiftRaw===""?null:Number(shiftRaw),p_note:$("#usageNote")?.value.trim()||null,
        p_planner_job_id:plannerJobId
      });
      if(error)throw error;if(data?.ok===false)throw new Error(data.message||"Pemakaian gagal disimpan.");
      setStatus(`Pemakaian ${p.alias||p.name} ke ${unit} tersimpan. Stock ${src.code} sudah berkurang.${plannerJobId?" Planner job sudah ditandai USED.":""}`,"ok");
      $("#usageQty").value="";$("#usagePlannerRef").value="";$("#usageHm").value="";$("#usageNote").value="";
      root.dispatchEvent(new CustomEvent("kpp:lube-usage-saved",{detail:{plannerJobId}}));
      await load();
      $("#lubeRefreshBtn")?.click();
    }catch(error){console.error(error);setStatus(error.message||"Gagal menyimpan pemakaian.","err");}
    finally{button.disabled=false;}
  }

  function renderSummary(){
    const today=todayWib();const rows=state.usages.filter(u=>u.tanggal===today);
    const units=new Set(rows.map(u=>u.unit_code));
    const oil=rows.filter(u=>productById(u.product_id)?.category==="OIL").reduce((a,u)=>a+num(u.quantity),0);
    const grease=rows.filter(u=>productById(u.product_id)?.category==="GREASE").reduce((a,u)=>a+num(u.quantity),0);
    $("#usageTodayCount").textContent=String(rows.length);$("#usageTodayUnits").textContent=String(units.size);$("#usageTodayOil").textContent=`${fmt(oil)} L`;$("#usageTodayGrease").textContent=`${fmt(grease,1)} KG`;
    const latest=state.usages[0];
    $("#usageLatest").innerHTML=latest?`Terakhir: <b>${esc(latest.unit_code)}</b> • ${esc(productById(latest.product_id)?.alias||productById(latest.product_id)?.name||"-")} • ${fmt(latest.quantity,1)} ${esc(latest.base_unit)}<br><small>${new Date(latest.created_at).toLocaleString("id-ID",{timeZone:"Asia/Jakarta"})} • ${esc(latest.mechanic_name)}</small>`:"Belum ada pemakaian unit.";
  }

  function filtered(){
    const q=($("#usageSearch")?.value||"").trim().toLowerCase();if(!q)return state.usages;
    return state.usages.filter(u=>{
      const p=productById(u.product_id);const s=storageById(u.source_storage_id);
      return [u.unit_code,p?.alias,p?.name,s?.code,u.mechanic_name,u.mechanic_nrp,u.planner_source,u.planner_ref,u.note].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }

  function renderLog(){
    const body=$("#usageBody");if(!body)return;const rows=filtered();
    if(!rows.length){body.innerHTML='<tr><td colspan="9" class="lube-usage-empty">Belum ada pemakaian yang cocok dengan filter.</td></tr>';return;}
    body.innerHTML=rows.map(u=>{const p=productById(u.product_id);const s=storageById(u.source_storage_id);return `<tr>
      <td><b>${new Date(u.created_at).toLocaleDateString("id-ID",{timeZone:"Asia/Jakarta"})}</b><small>${new Date(u.created_at).toLocaleTimeString("id-ID",{timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit"})}</small></td>
      <td><b>${esc(u.unit_code)}</b></td>
      <td><b>${esc(p?.alias||p?.name||"-")}</b><small>${esc(p?.name||"")}</small></td>
      <td><b>${esc(s?.code||"-")}</b><small>${esc((s?.storage_type||"").replace("_"," "))}</small></td>
      <td><b>${fmt(u.quantity,u.base_unit==="KG"?1:1)} ${esc(u.base_unit)}</b></td>
      <td><b>${esc(u.planner_source)}</b><small>${esc(u.planner_ref||"Tanpa referensi")}</small></td>
      <td><b>${esc(u.mechanic_name)}</b><small>${esc(u.mechanic_nrp||"NRP -")}</small></td>
      <td><b>${u.hm==null?"HM -":`HM ${fmt(u.hm,1)}`}</b><small>${u.shift?`Shift ${u.shift}`:"Shift -"}</small></td>
      <td>${esc(u.note||"-")}<small>${esc(u.created_by_name||"")}</small></td>
    </tr>`}).join("");
  }

  function csvCell(v){const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
  function exportCsv(){
    const rows=filtered();if(!rows.length){setStatus("Tidak ada data logsheet untuk diunduh.","err");return;}
    const header=["Tanggal","Waktu","Unit","Produk","Storage","Qty","Satuan","Planner","Referensi","Mekanik","NRP","HM","Shift","Catatan","Dicatat Oleh"];
    const data=rows.map(u=>{const p=productById(u.product_id),s=storageById(u.source_storage_id),d=new Date(u.created_at);return [u.tanggal,d.toLocaleTimeString("id-ID",{timeZone:"Asia/Jakarta"}),u.unit_code,p?.alias||p?.name||"",s?.code||"",u.quantity,u.base_unit,u.planner_source,u.planner_ref||"",u.mechanic_name,u.mechanic_nrp||"",u.hm??"",u.shift??"",u.note||"",u.created_by_name||""]});
    const text="\uFEFF"+[header,...data].map(r=>r.map(csvCell).join(",")).join("\n");
    const blob=new Blob([text],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`oil-logsheet-${todayWib()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function boot(attempt=0){
    inject();activateFlowStep();
    if(db()){load();return;}
    if(attempt<30)setTimeout(()=>boot(attempt+1),200);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>boot());else boot();
})(window);