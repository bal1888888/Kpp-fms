(function(root){
  "use strict";
  const state={jobs:[],units:[],parsedRows:[]};
  const $=(s,c=document)=>c.querySelector(s);
  const $$=(s,c=document)=>Array.from(c.querySelectorAll(s));
  const esc=v=>String(v??"").replace(/[&<>'"]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  const db=()=>root.KPP?.db;
  const norm=v=>String(v??"").trim().toLowerCase().replace(/[^a-z0-9]/g,"");

  function inject(){
    if($("#lubePlannerPanel"))return;
    const usage=$("#lubeUsagePanel");
    if(!usage)return;
    const panel=document.createElement("section");
    panel.className="panel lube-planner-panel";
    panel.id="lubePlannerPanel";
    panel.innerHTML=`
      <div class="panel-head lube-planner-head">
        <div><span class="eyebrow">PLANNER INBOX</span><h2>WELL / TRACK → Oil Logsheet</h2><p>Job dari export planner masuk ke inbox. Pilih job, data unit/WO/shift/mekanik otomatis masuk ke Oil Logsheet dan job terkunci USED setelah pemakaian tersimpan.</p></div>
        <span class="lube-planner-badge">BRIDGE V1 • AKTIF</span>
      </div>
      <div class="lube-planner-grid">
        <article class="lube-planner-card">
          <h3>📋 Job Planner Terbuka</h3>
          <div class="lube-planner-stats">
            <div><small>OPEN</small><strong id="plannerOpenCount">0</strong></div>
            <div><small>WELL</small><strong id="plannerWellCount">0</strong></div>
            <div><small>TRACK</small><strong id="plannerTrackCount">0</strong></div>
          </div>
          <div class="lube-planner-tools">
            <select id="plannerFilterSource"><option value="">WELL + TRACK</option><option value="WELL">WELL</option><option value="TRACK">TRACK</option></select>
            <input id="plannerSearch" type="search" placeholder="Cari WO, unit, pekerjaan, mekanik...">
          </div>
          <div class="lube-planner-list" id="plannerJobList"><div class="lube-planner-empty">Memuat job planner...</div></div>
        </article>
        <article class="lube-planner-card">
          <h3>📥 Import Export Planner</h3>
          <div class="lube-planner-import-note"><b>Format yang dibaca:</b> WO/REF, UNIT, PEKERJAAN, TANGGAL, SHIFT, MEKANIK, NRP. Bisa paste dari Excel atau upload CSV. Header umum seperti <code>Work Order</code>, <code>Equipment</code>, <code>Description</code> juga dikenali.</div>
          <div class="form-grid">
            <div class="field"><label>Sumber</label><select id="plannerImportSource"><option value="WELL">WELL</option><option value="TRACK">TRACK</option></select></div>
            <div class="field"><label>File CSV / TSV</label><input id="plannerFile" type="file" accept=".csv,.txt,.tsv,text/csv,text/plain"></div>
            <div class="field wide"><label>Paste Data</label><textarea id="plannerPaste" class="lube-planner-textarea" placeholder="WO\tUNIT\tPEKERJAAN\tTANGGAL\tSHIFT\tMEKANIK\tNRP\nWO-123\tEX241\tPM Service\t2026-09-15\t1\tBudi\tNRP001"></textarea></div>
          </div>
          <div class="lube-planner-preview" id="plannerImportPreview">Belum ada data untuk diimport.</div>
          <div class="form-actions"><button type="button" class="btn btn-primary" id="plannerImportBtn" disabled>IMPORT KE INBOX</button></div>
          <div class="lube-planner-status" id="plannerStatus"></div>
        </article>
      </div>`;
    usage.insertAdjacentElement("beforebegin",panel);

    const usageCard=$(".lube-usage-card",usage);
    if(usageCard&&!$("#plannerSelectionBadge")){
      const badge=document.createElement("div");
      badge.id="plannerSelectionBadge";
      badge.className="lube-planner-selected";
      badge.innerHTML='<span id="plannerSelectionText"></span><button type="button" class="btn btn-soft" id="plannerSelectionClear">LEPAS JOB</button>';
      const note=$(".lube-usage-note",usageCard);
      if(note)note.insertAdjacentElement("afterend",badge);else usageCard.prepend(badge);
    }
    bind();
  }

  function bind(){
    $("#plannerFilterSource")?.addEventListener("change",renderJobs);
    $("#plannerSearch")?.addEventListener("input",renderJobs);
    $("#plannerPaste")?.addEventListener("input",previewImport);
    $("#plannerFile")?.addEventListener("change",readFile);
    $("#plannerImportBtn")?.addEventListener("click",importRows);
    $("#plannerSelectionClear")?.addEventListener("click",()=>clearSelection(true));
    root.addEventListener("kpp:lube-usage-saved",async()=>{clearSelection(false);await load();});
  }

  async function load(){
    if(!db())return;
    try{
      const [jobs,units]=await Promise.all([
        db().from("lubricant_planner_jobs").select("*").order("planned_date",{ascending:true,nullsFirst:false}).order("created_at",{ascending:false}).limit(500),
        db().rpc("lubricant_unit_directory")
      ]);
      if(jobs.error)throw jobs.error;if(units.error)throw units.error;
      state.jobs=jobs.data||[];state.units=units.data||[];
      renderStats();renderJobs();previewImport();
    }catch(error){
      console.error("planner inbox load",error);
      const host=$("#plannerJobList");if(host)host.innerHTML=`<div class="lube-planner-empty">Gagal memuat planner: ${esc(error.message)}</div>`;
    }
  }

  function renderStats(){
    const open=state.jobs.filter(j=>j.status==="OPEN");
    $("#plannerOpenCount").textContent=String(open.length);
    $("#plannerWellCount").textContent=String(open.filter(j=>j.source==="WELL").length);
    $("#plannerTrackCount").textContent=String(open.filter(j=>j.source==="TRACK").length);
  }

  function filteredJobs(){
    const source=$("#plannerFilterSource")?.value||"";
    const q=($("#plannerSearch")?.value||"").trim().toLowerCase();
    return state.jobs.filter(j=>j.status==="OPEN"&&(!source||j.source===source)&&(!q||[j.external_ref,j.unit_code,j.work_description,j.mechanic_name,j.mechanic_nrp,j.planned_date].filter(Boolean).join(" ").toLowerCase().includes(q)));
  }

  function renderJobs(){
    const host=$("#plannerJobList");if(!host)return;
    const rows=filteredJobs();
    if(!rows.length){host.innerHTML='<div class="lube-planner-empty">Tidak ada job OPEN. Import export WELL/TRACK di panel sebelah.</div>';return;}
    host.innerHTML=rows.map(j=>`<div class="lube-planner-job" data-id="${j.id}">
      <div><b>${esc(j.external_ref)} <span class="job-source">${esc(j.source)}</span></b><small><b>${esc(j.unit_code)}</b>${j.planned_date?` • ${esc(j.planned_date)}`:""}${j.shift?` • Shift ${j.shift}`:""}</small><small>${esc(j.work_description||"Tanpa deskripsi pekerjaan")}</small><small>${esc(j.mechanic_name||"Mekanik belum ditentukan")}${j.mechanic_nrp?` • ${esc(j.mechanic_nrp)}`:""}</small></div>
      <button type="button" class="btn btn-primary planner-use-job" data-id="${j.id}">PAKAI JOB</button>
    </div>`).join("");
    $$(".planner-use-job",host).forEach(btn=>btn.addEventListener("click",()=>selectJob(Number(btn.dataset.id))));
  }

  function selectJob(id){
    const job=state.jobs.find(j=>Number(j.id)===Number(id)&&j.status==="OPEN");if(!job)return;
    root.KPP_LUBE_SELECTED_PLANNER_JOB_ID=job.id;
    const unit=$("#usageUnit"),planner=$("#usagePlanner"),ref=$("#usagePlannerRef"),shift=$("#usageShift"),mechanic=$("#usageMechanic"),nrp=$("#usageMechanicNrp"),note=$("#usageNote");
    if(unit){unit.value=job.unit_code;unit.readOnly=true;}
    if(planner){planner.value=job.source;planner.disabled=true;}
    if(ref){ref.value=job.external_ref;ref.readOnly=true;}
    if(shift&&job.shift)shift.value=String(job.shift);
    if(mechanic&&job.mechanic_name&&!mechanic.value.trim())mechanic.value=job.mechanic_name;
    if(nrp&&job.mechanic_nrp&&!nrp.value.trim())nrp.value=job.mechanic_nrp;
    if(note&&job.work_description&&!note.value.trim())note.value=job.work_description;
    const badge=$("#plannerSelectionBadge"),text=$("#plannerSelectionText");
    if(text)text.innerHTML=`Planner terpilih: <b>${esc(job.source)} • ${esc(job.external_ref)} • ${esc(job.unit_code)}</b>${job.work_description?`<br>${esc(job.work_description)}`:""}`;
    badge?.classList.add("show");
    $("#lubeUsagePanel")?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function clearSelection(resetFields){
    root.KPP_LUBE_SELECTED_PLANNER_JOB_ID=null;
    const unit=$("#usageUnit"),planner=$("#usagePlanner"),ref=$("#usagePlannerRef");
    if(unit)unit.readOnly=false;
    if(planner){planner.disabled=false;if(resetFields)planner.value="MANUAL";}
    if(ref){ref.readOnly=false;if(resetFields)ref.value="";}
    $("#plannerSelectionBadge")?.classList.remove("show");
  }

  async function readFile(event){
    const file=event.target.files?.[0];if(!file)return;
    try{$("#plannerPaste").value=await file.text();previewImport();setStatus(`File ${file.name} dibaca. Cek preview lalu import.`);}catch(error){setStatus(error.message||"Gagal membaca file.","err");}
  }

  function parseDelimited(text){
    const raw=String(text||"").replace(/^\uFEFF/,"").trim();if(!raw)return [];
    const first=raw.split(/\r?\n/)[0];
    const counts={"\t":(first.match(/\t/g)||[]).length,",":(first.match(/,/g)||[]).length,";":(first.match(/;/g)||[]).length};
    const delimiter=Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
    const rows=[];let row=[],cell="",quoted=false;
    for(let i=0;i<raw.length;i++){
      const ch=raw[i];
      if(ch==='"'){
        if(quoted&&raw[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
      }else if(ch===delimiter&&!quoted){row.push(cell.trim());cell="";}
      else if((ch==='\n'||ch==='\r')&&!quoted){
        if(ch==='\r'&&raw[i+1]==='\n')i++;
        row.push(cell.trim());if(row.some(v=>v!==""))rows.push(row);row=[];cell="";
      }else cell+=ch;
    }
    row.push(cell.trim());if(row.some(v=>v!==""))rows.push(row);
    return rows;
  }

  const aliases={
    external_ref:["ref","reference","wo","nowo","workorder","workorderno","workordernumber","task","taskid","jobid","nomorwo"],
    unit_code:["unit","unitcode","codeunit","equipment","equipmentcode","fleet","kodeunit"],
    work_description:["description","workdescription","job","jobdescription","pekerjaan","activity","taskdescription","uraian"],
    planned_date:["date","planneddate","plandate","tanggal","scheduleddate","schedule"],
    shift:["shift"],mechanic_name:["mechanic","mechanicname","mekanik","namamekanik"],mechanic_nrp:["nrp","mechanicnrp","nrpmekanik"]
  };

  function headerIndex(headers,key){const set=new Set(aliases[key]);return headers.findIndex(h=>set.has(norm(h)))}
  function normalizeDate(value){
    const v=String(value||"").trim();if(!v)return "";
    if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
    let m=v.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);if(m)return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    m=v.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);if(m)return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
    return v;
  }
  function normalizeShift(value){const m=String(value||"").match(/[12]/);return m?m[0]:""}

  function parseImport(){
    const rows=parseDelimited($("#plannerPaste")?.value||"");if(!rows.length)return [];
    const headers=rows[0];const refIdx=headerIndex(headers,"external_ref"),unitIdx=headerIndex(headers,"unit_code");
    const hasHeader=refIdx>=0&&unitIdx>=0;
    const idx=hasHeader?{
      external_ref:refIdx,unit_code:unitIdx,work_description:headerIndex(headers,"work_description"),planned_date:headerIndex(headers,"planned_date"),shift:headerIndex(headers,"shift"),mechanic_name:headerIndex(headers,"mechanic_name"),mechanic_nrp:headerIndex(headers,"mechanic_nrp")
    }:{external_ref:0,unit_code:1,work_description:2,planned_date:3,shift:4,mechanic_name:5,mechanic_nrp:6};
    const data=hasHeader?rows.slice(1):rows;
    return data.map((r,i)=>({
      row_number:i+1+(hasHeader?2:1),external_ref:String(r[idx.external_ref]||"").trim(),unit_code:String(r[idx.unit_code]||"").trim().toUpperCase(),work_description:idx.work_description>=0?String(r[idx.work_description]||"").trim():"",planned_date:idx.planned_date>=0?normalizeDate(r[idx.planned_date]):"",shift:idx.shift>=0?normalizeShift(r[idx.shift]):"",mechanic_name:idx.mechanic_name>=0?String(r[idx.mechanic_name]||"").trim():"",mechanic_nrp:idx.mechanic_nrp>=0?String(r[idx.mechanic_nrp]||"").trim():""
    })).filter(r=>r.external_ref||r.unit_code||r.work_description);
  }

  function validUnit(code){return state.units.some(u=>String(u.code_unit||"").trim().toUpperCase()===String(code||"").trim().toUpperCase())}
  function previewImport(){
    state.parsedRows=parseImport();
    const host=$("#plannerImportPreview"),button=$("#plannerImportBtn");if(!host||!button)return;
    if(!state.parsedRows.length){host.textContent="Belum ada data untuk diimport.";button.disabled=true;return;}
    const invalid=state.parsedRows.filter(r=>!r.external_ref||!r.unit_code||!validUnit(r.unit_code));
    const examples=invalid.slice(0,3).map(r=>`baris ${r.row_number}: ${!r.external_ref?"REF kosong":!r.unit_code?"unit kosong":`unit ${r.unit_code} tidak ada di Master`}`).join(" • ");
    host.innerHTML=`Terbaca <b>${state.parsedRows.length} job</b>. Valid <b>${state.parsedRows.length-invalid.length}</b>, bermasalah <b>${invalid.length}</b>.${examples?`<br>${esc(examples)}`:""}`;
    button.disabled=invalid.length>0||state.parsedRows.length>500;
  }

  function setStatus(message,type=""){
    const n=$("#plannerStatus");if(!n)return;n.textContent=message||"";n.className=`lube-planner-status ${type}`.trim();
  }

  async function importRows(){
    if(!state.parsedRows.length)return;
    const source=$("#plannerImportSource")?.value||"WELL",button=$("#plannerImportBtn");button.disabled=true;setStatus("Mengimport job ke Planner Inbox...");
    try{
      const rows=state.parsedRows.map(({row_number,...r})=>({...r,planned_date:r.planned_date||null,shift:r.shift||null,mechanic_name:r.mechanic_name||null,mechanic_nrp:r.mechanic_nrp||null,work_description:r.work_description||null}));
      const {data,error}=await db().rpc("lubricant_planner_upsert_jobs",{p_source:source,p_rows:rows});
      if(error)throw error;if(data?.ok===false)throw new Error(data.message||"Import gagal.");
      setStatus(`Import selesai: ${data.imported||0} job masuk/update, ${data.skipped_used||0} job USED dilewati.`,"ok");
      $("#plannerPaste").value="";$("#plannerFile").value="";state.parsedRows=[];previewImport();await load();
    }catch(error){console.error(error);setStatus(error.message||"Gagal import planner.","err");}
    finally{button.disabled=false;previewImport();}
  }

  function boot(attempt=0){
    inject();
    if(!$("#lubePlannerPanel")){if(attempt<30)setTimeout(()=>boot(attempt+1),100);return;}
    if(db()){load();return;}
    if(attempt<30)setTimeout(()=>boot(attempt+1),200);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>boot());else boot();
})(window);
