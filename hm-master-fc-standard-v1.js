// KPP-FMS HM Master FC + Quota Tolerance v2
// Menambah standar FC dan Limit Toleransi Penjatahan per unit tanpa mengganggu alur master/HM lama.
(() => {
  "use strict";

  const FC_FIELD_ID="masterFcStandard";
  const TOL_FIELD_ID="masterQuotaTolerance";
  const STYLE_ID="kppHmFcStandardStyle";
  const standards=new Map();
  const tolerances=new Map();
  let tableObserver=null;
  let renderQueued=false;
  let functionsPatched=false;

  const db=()=>window.KPP?.db||window.kppDb||null;
  const normalize=value=>String(value??"").trim().toUpperCase();
  const formatFc=value=>new Intl.NumberFormat("id-ID",{minimumFractionDigits:1,maximumFractionDigits:1}).format(Number(value)||0);
  const formatL=value=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:0}).format(Number(value)||0);

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      .kpp-fc-standard-hint,.kpp-quota-tolerance-hint{margin-top:5px;color:#64748b;font-size:10px;line-height:1.35}
      .kpp-fc-standard-cell,.kpp-quota-tolerance-cell{font-weight:900;white-space:nowrap}
      .kpp-fc-standard-cell{color:#1d4ed8}.kpp-quota-tolerance-cell{color:#0f766e}
      .kpp-fc-standard-pill,.kpp-quota-tolerance-pill{display:inline-flex;align-items:center;justify-content:center;min-height:24px;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:900}
      .kpp-fc-standard-pill{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}
      .kpp-fc-standard-pill.is-empty{background:#f8fafc;border-color:#e2e8f0;color:#94a3b8}
      .kpp-quota-tolerance-pill{background:#ecfdf5;border:1px solid #a7f3d0;color:#047857}
    `;
    document.head.appendChild(style);
  }

  function ensureFields(){
    const capacity=document.getElementById("masterTankCapacity");
    if(!capacity?.parentElement)return false;

    let fc=document.getElementById(FC_FIELD_ID);
    if(!fc){
      const wrap=document.createElement("div");
      wrap.dataset.kppFcStandardField="1";
      wrap.innerHTML=`
        <label>Standar FC (L/HM)</label>
        <input type="number" id="${FC_FIELD_ID}" min="0.1" max="10000" step="0.1" inputmode="decimal" placeholder="Contoh: 65">
        <div class="kpp-fc-standard-hint">Dipakai untuk menghitung Qty Jatah otomatis dari selisih HM.</div>
      `;
      capacity.parentElement.insertAdjacentElement("afterend",wrap);
      fc=document.getElementById(FC_FIELD_ID);
    }

    if(!document.getElementById(TOL_FIELD_ID)){
      const wrap=document.createElement("div");
      wrap.dataset.kppQuotaToleranceField="1";
      wrap.innerHTML=`
        <label>Limit Toleransi Penjatahan (L)</label>
        <input type="number" id="${TOL_FIELD_ID}" min="0" max="1000" step="1" inputmode="numeric" value="10" placeholder="10">
        <div class="kpp-quota-tolerance-hint">Batas tambahan di atas Qty Jatah. Default 10 L. Nilai ini otomatis dikunci di halaman CCR.</div>
      `;
      fc?.parentElement?.insertAdjacentElement("afterend",wrap);
    }
    return true;
  }

  function ensureHeaders(){
    const body=document.getElementById("unitMasterBody");
    const row=body?.closest("table")?.querySelector("thead tr");
    if(!row)return false;

    let fcHeader=row.querySelector('[data-kpp-fc-standard-header="1"]');
    if(!fcHeader){
      const headers=[...row.children];
      const capacityHeader=headers.find(th=>String(th.textContent||"").trim().toUpperCase().includes("KAPASITAS TANGKI"));
      fcHeader=document.createElement("th");
      fcHeader.dataset.kppFcStandardHeader="1";
      fcHeader.textContent="STANDAR FC";
      if(capacityHeader)capacityHeader.insertAdjacentElement("afterend",fcHeader);
      else row.insertBefore(fcHeader,row.lastElementChild);
    }

    if(!row.querySelector('[data-kpp-quota-tolerance-header="1"]')){
      const th=document.createElement("th");
      th.dataset.kppQuotaToleranceHeader="1";
      th.textContent="LIMIT TOLERANSI";
      fcHeader.insertAdjacentElement("afterend",th);
    }
    return true;
  }

  function renderTable(){
    renderQueued=false;
    ensureHeaders();
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

      let fcCell=row.querySelector('td[data-kpp-fc-standard-cell="1"]');
      if(!fcCell){
        fcCell=document.createElement("td");
        fcCell.dataset.kppFcStandardCell="1";
        fcCell.className="kpp-fc-standard-cell";
        const capacityCell=[...row.cells].find(td=>/\bL\b/i.test(td.textContent||"")&&td.cellIndex>=6);
        if(capacityCell)capacityCell.insertAdjacentElement("afterend",fcCell);
        else row.insertBefore(fcCell,row.cells[Math.max(0,row.cells.length-2)]||null);
      }

      let tolCell=row.querySelector('td[data-kpp-quota-tolerance-cell="1"]');
      if(!tolCell){
        tolCell=document.createElement("td");
        tolCell.dataset.kppQuotaToleranceCell="1";
        tolCell.className="kpp-quota-tolerance-cell";
        fcCell.insertAdjacentElement("afterend",tolCell);
      }

      const standard=standards.get(code);
      const hasStandard=Number.isFinite(standard)&&standard>0;
      fcCell.innerHTML=hasStandard
        ? `<span class="kpp-fc-standard-pill">${formatFc(standard)} L/HM</span>`
        : '<span class="kpp-fc-standard-pill is-empty">BELUM DISET</span>';

      const tolerance=tolerances.has(code)?tolerances.get(code):10;
      tolCell.innerHTML=`<span class="kpp-quota-tolerance-pill">${formatL(tolerance)} L</span>`;
    });
  }

  function queueRender(){
    if(renderQueued)return;
    renderQueued=true;
    requestAnimationFrame(renderTable);
  }

  async function loadSettings(){
    const client=db();
    if(!client)return false;
    const {data,error}=await client.from("unit_master").select("code_unit,fc_standard_lphm,quota_tolerance_liter").order("code_unit",{ascending:true});
    if(error){
      console.warn("Gagal memuat standar FC / toleransi unit:",error.message);
      return false;
    }
    standards.clear();
    tolerances.clear();
    (data||[]).forEach(row=>{
      const code=normalize(row.code_unit);
      if(!code)return;
      const fc=row.fc_standard_lphm===null||row.fc_standard_lphm===undefined?null:Number(row.fc_standard_lphm);
      if(Number.isFinite(fc)&&fc>0)standards.set(code,fc);
      const tol=Number(row.quota_tolerance_liter);
      tolerances.set(code,Number.isFinite(tol)&&tol>=0?tol:10);
    });
    queueRender();
    return true;
  }

  function setFieldsForCode(code){
    const key=normalize(code);
    const fcInput=document.getElementById(FC_FIELD_ID);
    const tolInput=document.getElementById(TOL_FIELD_ID);
    if(fcInput){
      const value=standards.get(key);
      fcInput.value=Number.isFinite(value)&&value>0?String(value):"";
    }
    if(tolInput){
      const value=tolerances.has(key)?tolerances.get(key):10;
      tolInput.value=String(value);
    }
  }

  function resetFields(){
    const fc=document.getElementById(FC_FIELD_ID);
    const tol=document.getElementById(TOL_FIELD_ID);
    if(fc)fc.value="";
    if(tol)tol.value="10";
  }

  function patchFunctions(){
    if(functionsPatched)return true;
    if(typeof window.saveUnitMaster!=="function"||typeof window.editUnitMaster!=="function"||typeof window.resetUnitForm!=="function")return false;

    const originalSave=window.saveUnitMaster;
    const originalEdit=window.editUnitMaster;
    const originalReset=window.resetUnitForm;

    window.editUnitMaster=function(code){
      const result=originalEdit.apply(this,arguments);
      setFieldsForCode(code);
      return result;
    };

    window.resetUnitForm=function(){
      const result=originalReset.apply(this,arguments);
      resetFields();
      return result;
    };

    window.saveUnitMaster=async function(){
      const code=normalize(document.getElementById("masterCode")?.value);
      const fcInput=document.getElementById(FC_FIELD_ID);
      const tolInput=document.getElementById(TOL_FIELD_ID);
      const rawFc=String(fcInput?.value??"").trim();
      const fcValue=rawFc===""?null:Number(rawFc);
      const rawTol=String(tolInput?.value??"10").trim();
      const tolValue=rawTol===""?10:Number(rawTol);

      if(rawFc!==""&&(!Number.isFinite(fcValue)||fcValue<=0||fcValue>10000)){
        alert("Standar FC harus lebih dari 0 dan maksimal 10.000 L/HM.");
        fcInput?.focus();
        return;
      }
      if(!Number.isFinite(tolValue)||tolValue<0||tolValue>1000){
        alert("Limit Toleransi Penjatahan harus 0 sampai 1.000 L.");
        tolInput?.focus();
        return;
      }

      const result=await originalSave.apply(this,arguments);
      if(!code)return result;
      const client=db();
      if(!client)return result;

      const {data,error}=await client
        .from("unit_master")
        .update({fc_standard_lphm:fcValue,quota_tolerance_liter:tolValue})
        .eq("code_unit",code)
        .select("code_unit,fc_standard_lphm,quota_tolerance_liter")
        .maybeSingle();

      const status=document.getElementById("unitSaveStatus");
      if(error){
        console.warn("Gagal menyimpan FC / toleransi:",error.message);
        if(status)status.textContent=`${status.textContent||""} ⚠️ FC/toleransi belum tersimpan: ${error.message}`.trim();
        return result;
      }
      if(!data){
        if(status)status.textContent=`${status.textContent||""} ⚠️ FC/toleransi belum tersimpan karena unit ${code} belum ditemukan.`.trim();
        return result;
      }

      if(fcValue===null)standards.delete(code);else standards.set(code,fcValue);
      tolerances.set(code,tolValue);
      queueRender();
      if(status){
        const fcLabel=fcValue===null?"FC kosong":`FC ${formatFc(fcValue)} L/HM`;
        status.textContent=`${status.textContent||""} • ${fcLabel} • Limit toleransi ${formatL(tolValue)} L.`.trim();
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
    tableObserver.observe(body,{childList:true});
    queueRender();
    return true;
  }

  async function install(){
    ensureStyle();
    if(!ensureFields())return false;
    patchFunctions();
    watchTable();
    await loadSettings();
    const code=document.getElementById("masterCode")?.value;
    if(code)setFieldsForCode(code);else resetFields();
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    const ready=ensureFields()&&patchFunctions()&&watchTable();
    if(ready){clearInterval(timer);loadSettings();}
    else if(attempts>=120)clearInterval(timer);
  },100);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
  else install();
})();
