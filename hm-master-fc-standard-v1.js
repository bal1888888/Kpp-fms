// KPP-FMS HM Master FC Standard v1
// Adds a per-unit FC ceiling (L/HM) without disturbing the existing unit/HM workflow.
(() => {
  "use strict";

  const FIELD_ID="masterFcStandard";
  const STYLE_ID="kppHmFcStandardStyle";
  const standards=new Map();
  let tableObserver=null;
  let renderQueued=false;
  let functionsPatched=false;

  const db=()=>window.KPP?.db||window.kppDb||null;
  const normalize=value=>String(value??"").trim().toUpperCase();
  const formatFc=value=>new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(value)||0);

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .kpp-fc-standard-hint{margin-top:5px;color:#64748b;font-size:10px;line-height:1.35}
      .kpp-fc-standard-cell{font-weight:900;color:#1d4ed8;white-space:nowrap}
      .kpp-fc-standard-cell.is-empty{color:#94a3b8;font-weight:800}
      .kpp-fc-standard-pill{display:inline-flex;align-items:center;justify-content:center;min-height:24px;padding:4px 8px;border-radius:999px;background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:9px;font-weight:900}
      .kpp-fc-standard-pill.is-empty{background:#f8fafc;border-color:#e2e8f0;color:#94a3b8}
    `;
    document.head.appendChild(style);
  }

  function ensureField(){
    if(document.getElementById(FIELD_ID))return true;
    const capacity=document.getElementById("masterTankCapacity");
    if(!capacity?.parentElement)return false;
    const wrap=document.createElement("div");
    wrap.dataset.kppFcStandardField="1";
    wrap.innerHTML=`
      <label>Standar FC (L/HM)</label>
      <input type="number" id="${FIELD_ID}" min="0.1" max="10000" step="0.1" inputmode="decimal" placeholder="Contoh: 65">
      <div class="kpp-fc-standard-hint">Batas maksimum FC rata-rata unit. Jika FC aktual lebih tinggi dari angka ini, monitoring FC akan di-highlight.</div>
    `;
    capacity.parentElement.insertAdjacentElement("afterend",wrap);
    return true;
  }

  function ensureHeader(){
    const body=document.getElementById("unitMasterBody");
    const row=body?.closest("table")?.querySelector("thead tr");
    if(!row)return false;
    if(row.querySelector('[data-kpp-fc-standard-header="1"]'))return true;
    const headers=[...row.children];
    const capacityHeader=headers.find(th=>String(th.textContent||"").trim().toUpperCase().includes("KAPASITAS TANGKI"));
    const th=document.createElement("th");
    th.dataset.kppFcStandardHeader="1";
    th.textContent="STANDAR FC";
    if(capacityHeader)capacityHeader.insertAdjacentElement("afterend",th);
    else row.insertBefore(th,row.lastElementChild);
    return true;
  }

  function renderTable(){
    renderQueued=false;
    ensureHeader();
    const body=document.getElementById("unitMasterBody");
    const table=body?.closest("table");
    if(!body||!table)return;
    const headerCount=table.querySelectorAll("thead th").length;

    [...body.rows].forEach(row=>{
      const colspan=row.querySelector("td[colspan]");
      if(colspan&&row.cells.length===1){colspan.colSpan=headerCount;return;}
      if(row.cells.length<2)return;
      const code=normalize(row.cells[1]?.textContent);
      if(!code)return;
      let cell=row.querySelector('td[data-kpp-fc-standard-cell="1"]');
      if(!cell){
        cell=document.createElement("td");
        cell.dataset.kppFcStandardCell="1";
        cell.className="kpp-fc-standard-cell";
        const capacityCell=[...row.cells].find(td=>/\bL\b/i.test(td.textContent||"")&&td.cellIndex>=6);
        if(capacityCell)capacityCell.insertAdjacentElement("afterend",cell);
        else row.insertBefore(cell,row.cells[Math.max(0,row.cells.length-2)]||null);
      }
      const standard=standards.get(code);
      const hasStandard=Number.isFinite(standard)&&standard>0;
      cell.classList.toggle("is-empty",!hasStandard);
      cell.innerHTML=hasStandard
        ? `<span class="kpp-fc-standard-pill">${formatFc(standard)} L/HM</span>`
        : '<span class="kpp-fc-standard-pill is-empty">BELUM DISET</span>';
    });
  }

  function queueRender(){
    if(renderQueued)return;
    renderQueued=true;
    requestAnimationFrame(renderTable);
  }

  async function loadStandards(){
    const client=db();
    if(!client)return false;
    const {data,error}=await client.from("unit_master").select("code_unit,fc_standard_lphm").order("code_unit",{ascending:true});
    if(error){
      console.warn("Gagal memuat standar FC unit:",error.message);
      return false;
    }
    standards.clear();
    (data||[]).forEach(row=>{
      const code=normalize(row.code_unit);
      const value=row.fc_standard_lphm===null||row.fc_standard_lphm===undefined?null:Number(row.fc_standard_lphm);
      if(code&&Number.isFinite(value)&&value>0)standards.set(code,value);
    });
    queueRender();
    return true;
  }

  function setFieldForCode(code){
    const input=document.getElementById(FIELD_ID);
    if(!input)return;
    const value=standards.get(normalize(code));
    input.value=Number.isFinite(value)&&value>0?String(value):"";
  }

  function patchFunctions(){
    if(functionsPatched)return true;
    if(typeof window.saveUnitMaster!=="function"||typeof window.editUnitMaster!=="function"||typeof window.resetUnitForm!=="function")return false;

    const originalSave=window.saveUnitMaster;
    const originalEdit=window.editUnitMaster;
    const originalReset=window.resetUnitForm;

    window.editUnitMaster=function(code){
      const result=originalEdit.apply(this,arguments);
      setFieldForCode(code);
      return result;
    };

    window.resetUnitForm=function(){
      const result=originalReset.apply(this,arguments);
      const input=document.getElementById(FIELD_ID);
      if(input)input.value="";
      return result;
    };

    window.saveUnitMaster=async function(){
      const code=normalize(document.getElementById("masterCode")?.value);
      const input=document.getElementById(FIELD_ID);
      const raw=String(input?.value??"").trim();
      const value=raw===""?null:Number(raw);
      if(raw!==""&&(!Number.isFinite(value)||value<=0||value>10000)){
        alert("Standar FC harus lebih dari 0 dan maksimal 10.000 L/HM.");
        input?.focus();
        return;
      }

      const result=await originalSave.apply(this,arguments);
      if(!code)return result;
      const client=db();
      if(!client)return result;

      const {data,error}=await client
        .from("unit_master")
        .update({fc_standard_lphm:value})
        .eq("code_unit",code)
        .select("code_unit,fc_standard_lphm")
        .maybeSingle();

      const status=document.getElementById("unitSaveStatus");
      if(error){
        console.warn("Gagal menyimpan standar FC:",error.message);
        if(status)status.textContent=`${status.textContent||""} ⚠️ Standar FC belum tersimpan: ${error.message}`.trim();
        return result;
      }
      if(!data){
        if(status)status.textContent=`${status.textContent||""} ⚠️ Standar FC belum tersimpan karena unit ${code} belum ditemukan.`.trim();
        return result;
      }

      if(value===null)standards.delete(code);else standards.set(code,value);
      queueRender();
      if(status){
        const label=value===null?"dikosongkan":`${formatFc(value)} L/HM`;
        status.textContent=`${status.textContent||""} • Standar FC ${label}.`.trim();
      }
      return result;
    };

    functionsPatched=true;
    return true;
  }

  function watchTable(){
    const body=document.getElementById("unitMasterBody");
    if(!body)return false;
    tableObserver?.disconnect();
    tableObserver=new MutationObserver(queueRender);
    tableObserver.observe(body,{childList:true,subtree:true});
    queueRender();
    return true;
  }

  async function install(){
    ensureStyle();
    if(!ensureField())return false;
    patchFunctions();
    watchTable();
    await loadStandards();
    const code=document.getElementById("masterCode")?.value;
    if(code)setFieldForCode(code);
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    const ready=ensureField()&&patchFunctions()&&watchTable();
    if(ready){clearInterval(timer);loadStandards();}
    else if(attempts>=120)clearInterval(timer);
  },100);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();
