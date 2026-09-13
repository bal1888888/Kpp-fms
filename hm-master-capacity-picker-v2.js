// KPP-FMS HM Master capacity picker v2.
// Primary flow: choose an existing unit, enter max tank capacity, save, continue.
(() => {
  "use strict";

  const PANEL_ID="kppCapacityPickerV2";
  const STYLE_ID="kppCapacityPickerV2Style";
  let rows=[];
  let loading=false;

  function canEdit(){
    const role=String(window.KPP_PROFILE?.role||"").trim().toLowerCase();
    return role==="gl"||role==="admin";
  }
  function esc(v){
    return String(v??"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function fmt(v){
    const n=Number(v);
    return Number.isFinite(n)&&n>0?`${n.toLocaleString("id-ID",{maximumFractionDigits:2})} L`:"Belum diisi";
  }
  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      #${PANEL_ID}{border-top:4px solid #16a34a!important;background:linear-gradient(180deg,#fff,#f8fffb)!important}
      #${PANEL_ID} h3::before{background:#16a34a!important}
      .kpp-cap-picker-grid{display:grid;grid-template-columns:minmax(230px,1.25fr) minmax(220px,1fr);gap:12px;align-items:end;margin-top:14px}
      .kpp-cap-picker-meta{margin-top:10px;padding:11px 13px;border:1px solid #dbe5f0;border-radius:11px;background:#f8fafc;color:#334155;font-size:12px;line-height:1.55}
      .kpp-cap-picker-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}
      .kpp-cap-picker-actions button{min-width:165px}
      .kpp-cap-picker-check{display:inline-flex!important;align-items:center;gap:8px;margin:0!important;font-size:11px!important;text-transform:none!important;letter-spacing:0!important;color:#475569!important}
      .kpp-cap-picker-check input{width:auto!important;margin:0!important;accent-color:#2563eb}
      .kpp-cap-picker-status{margin-top:10px;font-size:12px;font-weight:800;color:#334155}
      .kpp-cap-advanced-btn{background:#e2e8f0;color:#334155}
      @media(max-width:700px){.kpp-cap-picker-grid{grid-template-columns:1fr}.kpp-cap-picker-actions{display:grid;grid-template-columns:1fr}.kpp-cap-picker-actions button{width:100%;min-width:0}}
    `;
    document.head.appendChild(style);
  }
  function selectedRow(){
    const code=String(document.getElementById("kppCapUnit")?.value||"").trim().toUpperCase();
    return rows.find(r=>String(r.code_unit||"").trim().toUpperCase()===code)||null;
  }
  function updateMeta(){
    const row=selectedRow();
    const meta=document.getElementById("kppCapMeta");
    const input=document.getElementById("kppCapValue");
    const save=document.getElementById("kppCapSave");
    if(!meta||!input||!save)return;
    if(!row){
      meta.textContent="Pilih unit terlebih dahulu.";
      input.value="";
      save.disabled=true;
      return;
    }
    meta.innerHTML=`<b>${esc(row.code_unit)}</b> • ${esc(row.egi||"EGI belum diisi")}<br>Kapasitas sekarang: <b>${esc(fmt(row.tank_capacity_liter))}</b>`;
    input.value=Number(row.tank_capacity_liter)>0?String(row.tank_capacity_liter):"";
    save.disabled=!canEdit();
    setTimeout(()=>input.focus({preventScroll:true}),0);
  }
  function fillSelect(preferred=""){
    const select=document.getElementById("kppCapUnit");
    const onlyMissing=document.getElementById("kppCapOnlyMissing")?.checked!==false;
    const count=document.getElementById("kppCapCount");
    if(!select)return;
    const active=rows
      .filter(r=>r.active!==false)
      .filter(r=>!onlyMissing||!(Number(r.tank_capacity_liter)>0))
      .sort((a,b)=>String(a.code_unit||"").localeCompare(String(b.code_unit||""),"id",{numeric:true}));
    select.innerHTML='<option value="">-- Pilih Unit --</option>'+active.map(r=>`<option value="${esc(r.code_unit)}">${esc(r.code_unit)} • ${esc(r.egi||"-")} • ${esc(fmt(r.tank_capacity_liter))}</option>`).join("");
    const missing=rows.filter(r=>r.active!==false&&!(Number(r.tank_capacity_liter)>0)).length;
    if(count)count.textContent=`${active.length} unit tampil • ${missing} belum diisi`;
    const wanted=String(preferred||"").trim().toUpperCase();
    if(wanted&&active.some(r=>String(r.code_unit||"").trim().toUpperCase()===wanted))select.value=wanted;
    else if(onlyMissing&&active.length)select.value=String(active[0].code_unit||"");
    else select.value="";
    updateMeta();
  }
  async function loadRows(preferred=""){
    if(loading||typeof db==="undefined")return;
    loading=true;
    const status=document.getElementById("kppCapStatus");
    if(status)status.textContent="Memuat Master Unit...";
    try{
      const {data,error}=await db.from("unit_master")
        .select("code_unit,egi,active,tank_capacity_liter")
        .order("code_unit",{ascending:true});
      if(error)throw error;
      rows=Array.isArray(data)?data:[];
      fillSelect(preferred);
      if(status)status.textContent=canEdit()?"Pilih unit, isi kapasitas maksimum tangki, lalu Simpan.":"Mode lihat saja. Kapasitas hanya dapat diubah GL/Admin.";
    }catch(err){
      if(status)status.textContent=`❌ Gagal memuat unit: ${err?.message||err}`;
    }finally{loading=false}
  }
  async function save(){
    const row=selectedRow();
    const input=document.getElementById("kppCapValue");
    const status=document.getElementById("kppCapStatus");
    const btn=document.getElementById("kppCapSave");
    if(!row||!input||!status||!btn)return;
    if(!canEdit()){status.textContent="❌ Hanya GL/Admin yang boleh mengubah kapasitas tangki.";return}
    const capacity=Number(String(input.value||"").replace(",","."));
    if(!Number.isFinite(capacity)||capacity<=0||capacity>100000){
      status.textContent="❌ Kapasitas harus lebih dari 0 dan maksimal 100.000 liter.";
      input.focus();
      return;
    }
    const code=String(row.code_unit||"").trim().toUpperCase();
    btn.disabled=true;
    status.textContent=`⏳ Menyimpan ${code}...`;
    try{
      const {error}=await db.rpc("set_unit_tank_capacity",{p_unit:code,p_capacity_liter:capacity});
      if(error)throw error;
      status.textContent=`✅ ${code} = ${fmt(capacity)} tersimpan.`;
      if(typeof loadUnitMaster==="function"){
        try{await loadUnitMaster()}catch(_e){}
      }
      await loadRows();
    }catch(err){
      status.textContent=`❌ ${err?.message||err}`;
      btn.disabled=false;
    }
  }
  function toggleAdvanced(){
    const old=document.getElementById("bulkCapacityPanel");
    const btn=document.getElementById("kppCapAdvanced");
    if(!old)return;
    const show=old.style.display==="none";
    old.style.display=show?"":"none";
    if(btn)btn.textContent=show?"SEMBUNYIKAN MODE PASTE EXCEL":"MODE PASTE EXCEL";
  }
  function install(){
    if(document.getElementById(PANEL_ID))return true;
    const tab=document.getElementById("tabUnit");
    if(!tab||typeof db==="undefined")return false;
    injectStyle();

    const old=document.getElementById("bulkCapacityPanel");
    if(old)old.style.display="none";

    const panel=document.createElement("div");
    panel.id=PANEL_ID;
    panel.className="panel";
    panel.innerHTML=`
      <h3>2. Isi Kapasitas Tangki Unit</h3>
      <div class="info">Tidak perlu ketik CODE UNIT. Pilih unit dari daftar, lalu isi <b>Max Kapasitas Tangki</b>. Data EGI dan unit dibaca otomatis.</div>
      <div class="kpp-cap-picker-grid">
        <div><label>Pilih Unit</label><select id="kppCapUnit"><option value="">Memuat unit...</option></select></div>
        <div><label>Max Kapasitas Tangki (Liter)</label><input id="kppCapValue" type="number" min="1" max="100000" step="0.01" inputmode="decimal" placeholder="Contoh: 1380"></div>
      </div>
      <div id="kppCapMeta" class="kpp-cap-picker-meta">Pilih unit terlebih dahulu.</div>
      <div class="kpp-cap-picker-actions">
        <button id="kppCapSave" type="button" class="green" disabled>SIMPAN KAPASITAS</button>
        <label class="kpp-cap-picker-check"><input id="kppCapOnlyMissing" type="checkbox" checked> Hanya unit yang kapasitasnya belum diisi</label>
        <button id="kppCapAdvanced" type="button" class="kpp-cap-advanced-btn">MODE PASTE EXCEL</button>
        <span id="kppCapCount" style="font-size:11px;color:#64748b;font-weight:700"></span>
      </div>
      <div id="kppCapStatus" class="kpp-cap-picker-status"></div>`;

    if(old)tab.insertBefore(panel,old);
    else{
      const panels=Array.from(tab.children).filter(el=>el.classList?.contains("panel"));
      const anchor=panels[2]||null;
      if(anchor)tab.insertBefore(panel,anchor);else tab.appendChild(panel);
    }

    document.getElementById("kppCapUnit")?.addEventListener("change",updateMeta);
    document.getElementById("kppCapOnlyMissing")?.addEventListener("change",()=>fillSelect());
    document.getElementById("kppCapSave")?.addEventListener("click",save);
    document.getElementById("kppCapAdvanced")?.addEventListener("click",toggleAdvanced);
    document.getElementById("kppCapValue")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();save()}});
    loadRows();
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{tries++;if(install()||tries>=160)clearInterval(timer)},50);
  document.addEventListener("DOMContentLoaded",install,{once:true});
  document.addEventListener("kpp-auth-ready",()=>{install();loadRows(document.getElementById("kppCapUnit")?.value||"")});
})();
