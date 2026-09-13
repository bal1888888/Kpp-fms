// KPP-FMS Logsheet Editor cross-date unit lookup
// Cross-date mode is discovery-only. Editing always opens one selected date.
(() => {
  "use strict";

  const PANEL_ID="kppEditorCrossDatePanel";
  const BUTTON_ID="kppEditorCrossDateBtn";
  const STYLE_ID="kppEditorCrossDateStyle";
  let crossDateRows=[];
  let activeUnit="";
  let duplicateState={duplicateIds:new Set(),byDate:new Map(),strictKeys:new Set(),stableKeys:new Set()};

  function esc(value){
    return String(value??"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function unitKey(value){
    return String(value||"").trim().toUpperCase();
  }

  function formatDate(value){
    const p=String(value||"").split("-");
    return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:String(value||"-");
  }

  function formatNumber(value){
    if(value===null||value===undefined||value==="")return "-";
    const n=Number(value);
    return Number.isFinite(n)?n.toLocaleString("id-ID",{maximumFractionDigits:1}):String(value);
  }

  function numberKey(value){
    if(value===null||value===undefined||value==="")return "NULL";
    const n=Number(String(value).replace(",","."));
    if(!Number.isFinite(n))return "NULL";
    return n.toFixed(3).replace(/\.0+$/,"").replace(/(\.\d*?)0+$/,"$1");
  }

  function shiftKey(value){
    const s=String(value||"").trim().toLowerCase();
    if(s==="1"||s==="shift 1"||s==="s1")return "1";
    if(s==="2"||s==="shift 2"||s==="s2")return "2";
    return "";
  }

  function ftKey(row){
    let ft=String(row?.fuel_truck||"").trim().toUpperCase().replace(/\s/g,"");
    if(ft==="73"||ft==="0073"||ft==="FT73")ft="FT0073";
    if(ft==="75"||ft==="0075"||ft==="FT75")ft="FT0075";
    if(ft)return ft;
    const wh=String(row?.wh||"").trim().toUpperCase();
    if(wh==="WH FT02")return "FT0073";
    if(wh==="WH FT01")return "FT0075";
    return wh;
  }

  function strictSignature(tanggal,row){
    return [
      String(tanggal||row?.tanggal||""),
      unitKey(row?.unit),
      numberKey(row?.hm_akhir),
      numberKey(row?.fuel),
      shiftKey(row?.shift),
      ftKey(row)
    ].join("|");
  }

  function stableIdentity(tanggal,row){
    return [
      String(tanggal||row?.tanggal||""),
      unitKey(row?.unit),
      numberKey(row?.fuel),
      shiftKey(row?.shift),
      ftKey(row)
    ].join("|");
  }

  function isHmCorrectedRow(row){
    if(row?.hm_ref_excluded!==true)return false;
    const reason=String(row?.hm_ref_excluded_reason||"").trim().toUpperCase();
    return reason.startsWith("HM DIRAPIKAN") ||
      reason.includes("KOREKSI HM") ||
      reason.includes("HM DIKOREKSI") ||
      reason.includes("EDIT HM");
  }

  function addFlaggedGroup(group,duplicateIds,byDate,keySet,keyValue){
    if(!group||group.length<2)return;
    group.forEach(row=>{
      if(row?.id!==null&&row?.id!==undefined)duplicateIds.add(String(row.id));
      const date=String(row?.tanggal||"");
      if(!byDate.has(date))byDate.set(date,new Set());
      if(row?.id!==null&&row?.id!==undefined)byDate.get(date).add(String(row.id));
    });
    if(keySet&&keyValue)keySet.add(keyValue);
  }

  function buildDuplicateState(rows){
    const duplicateIds=new Set();
    const byDate=new Map();
    const strictKeys=new Set();
    const stableKeys=new Set();
    const strictGroups=new Map();
    const stableGroups=new Map();
    const sessionGroups=new Map();

    (rows||[]).forEach(row=>{
      const strict=strictSignature(row.tanggal,row);
      if(!strictGroups.has(strict))strictGroups.set(strict,[]);
      strictGroups.get(strict).push(row);

      const stable=stableIdentity(row.tanggal,row);
      if(!stableGroups.has(stable))stableGroups.set(stable,[]);
      stableGroups.get(stable).push(row);

      const sid=String(row?.session_id||"").trim();
      if(sid){
        if(!sessionGroups.has(sid))sessionGroups.set(sid,[]);
        sessionGroups.get(sid).push(row);
      }
    });

    strictGroups.forEach((group,key)=>{
      if(group.length>1)addFlaggedGroup(group,duplicateIds,byDate,strictKeys,key);
    });

    stableGroups.forEach((group,key)=>{
      if(group.length>1 && group.some(isHmCorrectedRow)){
        addFlaggedGroup(group,duplicateIds,byDate,stableKeys,key);
      }
    });

    sessionGroups.forEach(group=>{
      if(group.length>1)addFlaggedGroup(group,duplicateIds,byDate,null,null);
    });

    return {duplicateIds,byDate,strictKeys,stableKeys};
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      #${BUTTON_ID}{min-height:38px;padding:8px 11px;border:1px solid #93c5fd;border-radius:8px;background:#eff6ff;color:#1d4ed8;font-weight:900;white-space:nowrap}
      #${BUTTON_ID}:hover{background:#dbeafe}
      #${PANEL_ID}{margin:-2px 0 12px;padding:12px;border:1px solid #bfdbfe;border-left:4px solid #2563eb;border-radius:10px;background:#f8fbff;color:#0f172a}
      #${PANEL_ID}[hidden]{display:none!important}
      .kpp-crossdate-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .kpp-crossdate-title{font-size:13px;font-weight:900;color:#1e3a8a}
      .kpp-crossdate-meta{margin-top:4px;font-size:11px;color:#64748b;line-height:1.45}
      .kpp-crossdate-hint{margin-top:9px;padding:8px 10px;border:1px solid #dbeafe;border-radius:8px;background:#fff;color:#334155;font-size:10px;font-weight:700}
      .kpp-crossdate-actions{display:flex;gap:7px;flex-wrap:wrap}
      .kpp-crossdate-actions button{min-height:34px;padding:7px 10px;border-radius:8px;font-size:10px;font-weight:900;cursor:pointer}
      .kpp-crossdate-export{border:0;background:#16a34a;color:#fff}
      .kpp-crossdate-close{border:1px solid #cbd5e1;background:#fff;color:#475569}
      .kpp-crossdate-summary-double{display:inline-flex;align-items:center;margin-top:7px;padding:5px 8px;border:1px solid #fecaca;border-radius:8px;background:#fff1f2;color:#b91c1c;font-size:10px;font-weight:900}
      .kpp-crossdate-tablewrap{width:100%;max-width:100%;max-height:58vh;overflow:auto;margin-top:10px;border:1px solid #dbe5f0;border-radius:9px;background:#fff;-webkit-overflow-scrolling:touch}
      .kpp-crossdate-table{width:100%;min-width:980px;border-collapse:collapse;background:#fff}
      .kpp-crossdate-table th{position:sticky;top:0;z-index:2;background:#10243f;color:#fff;font-size:9px;padding:8px 6px;white-space:nowrap}
      .kpp-crossdate-table td{font-size:10px;padding:7px 6px;border-bottom:1px solid #e5e7eb;text-align:center;white-space:nowrap}
      .kpp-crossdate-table tr:hover td{background:#eff6ff}
      .kpp-crossdate-table tr.has-double td{background:#fff7f7}
      .kpp-crossdate-double{display:inline-flex;align-items:center;padding:3px 7px;border:1px solid #fecaca;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:8px;font-weight:900;white-space:nowrap}
      .kpp-crossdate-ok{color:#64748b;font-size:9px;font-weight:800}
      .kpp-crossdate-edit{border:1px solid #93c5fd;background:#eff6ff;color:#1d4ed8;border-radius:7px;padding:6px 9px;min-height:0;font-size:9px;font-weight:900;cursor:pointer;white-space:nowrap}
      .kpp-crossdate-edit:hover{background:#dbeafe}
      .kpp-crossdate-empty{padding:12px;border:1px dashed #cbd5e1;border-radius:8px;background:#fff;color:#64748b;font-size:11px;text-align:center}
      #gridBody tr.kpp-editor-double-row td{background:#fff7f7!important}
      #gridBody tr.kpp-editor-double-row td.row-no{background:#fee2e2!important;color:#b91c1c!important}
      .kpp-editor-double-badge{display:inline-flex;align-items:center;margin:3px 0 0 5px;padding:3px 6px;border:1px solid #fecaca;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:8px;font-weight:900;white-space:nowrap}
      @media(max-width:900px){
        #${BUTTON_ID}{flex:1 1 145px}
        .kpp-crossdate-head{display:block}
        .kpp-crossdate-actions{margin-top:9px}
        .kpp-crossdate-tablewrap{max-height:52vh}
      }
    `;
    document.head.appendChild(style);
  }

  async function fetchUnitRows(unit){
    const pageSize=1000;
    let from=0;
    const all=[];
    while(true){
      const {data,error}=await db
        .from("fuel_history")
        .select("id,tanggal,jam,unit,operator,hm_awal,hm_akhir,hm_jalan,fuel,shift,fuel_truck,wh,fuelman_name,session_id,hm_ref_excluded,hm_ref_excluded_reason")
        .ilike("unit",unit)
        .order("tanggal",{ascending:false})
        .order("jam",{ascending:false,nullsFirst:false})
        .order("id",{ascending:false})
        .range(from,from+pageSize-1);
      if(error)throw error;
      const part=data||[];
      all.push(...part);
      if(part.length<pageSize)break;
      from+=pageSize;
    }
    return all;
  }

  function groupDates(rows){
    const map=new Map();
    rows.forEach(row=>map.set(row.tanggal,(map.get(row.tanggal)||0)+1));
    return [...map.entries()].sort((a,b)=>String(b[0]).localeCompare(String(a[0])));
  }

  function renderPanel(unit,rows){
    const panel=document.getElementById(PANEL_ID);
    if(!panel)return;
    const dates=groupDates(rows);
    const latest=dates[0]?.[0]||null;
    const oldest=dates[dates.length-1]?.[0]||null;
    const duplicateRows=duplicateState.duplicateIds.size;

    panel.hidden=false;
    panel.innerHTML=`
      <div class="kpp-crossdate-head">
        <div>
          <div class="kpp-crossdate-title">UNIT ${esc(unit)} • SEMUA TANGGAL</div>
          <div class="kpp-crossdate-meta">${rows.length} transaksi • ${dates.length} tanggal${oldest&&latest?` • ${formatDate(oldest)} s/d ${formatDate(latest)}`:""}.</div>
          ${duplicateRows?`<div class="kpp-crossdate-summary-double">⚠ ${duplicateRows} BARIS TERIDENTIFIKASI DOUBLE / POTENSI DOUBLE</div>`:""}
        </div>
        <div class="kpp-crossdate-actions">
          <button type="button" class="kpp-crossdate-export">⬇ UNDUH SEMUA TANGGAL</button>
          <button type="button" class="kpp-crossdate-close">TUTUP</button>
        </div>
      </div>
      <div class="kpp-crossdate-hint">Riwayat semua tanggal ditampilkan di bawah. Klik <b>EDIT TANGGAL</b> pada transaksi yang mau diperbaiki; editor akan membuka tanggal itu dan tetap memfilter unit ${esc(unit)}.</div>
      ${rows.length?`
        <div class="kpp-crossdate-tablewrap">
          <table class="kpp-crossdate-table">
            <thead>
              <tr><th>TANGGAL</th><th>JAM</th><th>UNIT</th><th>HM AWAL</th><th>HM ISI</th><th>HM JALAN</th><th>QTY</th><th>SHIFT</th><th>FT</th><th>STATUS</th><th>AKSI</th></tr>
            </thead>
            <tbody>
              ${rows.map(row=>{
                const flagged=duplicateState.duplicateIds.has(String(row.id));
                return `<tr class="${flagged?"has-double":""}">
                  <td>${formatDate(row.tanggal)}</td>
                  <td>${esc(String(row.jam||"-").slice(0,5))}</td>
                  <td><b>${esc(row.unit||"-")}</b></td>
                  <td>${formatNumber(row.hm_awal)}</td>
                  <td>${formatNumber(row.hm_akhir)}</td>
                  <td>${formatNumber(row.hm_jalan)}</td>
                  <td>${formatNumber(row.fuel)} L</td>
                  <td>${esc(row.shift||"-")}</td>
                  <td>${esc(row.fuel_truck||"-")}</td>
                  <td>${flagged?'<span class="kpp-crossdate-double">⚠ DOUBLE</span>':'<span class="kpp-crossdate-ok">OK</span>'}</td>
                  <td><button type="button" class="kpp-crossdate-edit" data-date="${esc(row.tanggal)}">EDIT TANGGAL</button></td>
                </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      `:'<div class="kpp-crossdate-empty">Tidak ada transaksi untuk unit tersebut.</div>'}
    `;
  }

  function domRowData(tr,date){
    return {
      tanggal:date,
      unit:tr.querySelector(".col-unit")?.value||"",
      hm_akhir:tr.querySelector(".col-hm")?.value||null,
      fuel:tr.querySelector(".col-qty")?.value||null,
      shift:tr.querySelector(".col-shift")?.value||"",
      fuel_truck:tr.querySelector(".col-ft")?.value||"",
      wh:tr.querySelector(".wh-auto")?.textContent||""
    };
  }

  function markEditorDuplicates(date){
    const body=document.getElementById("gridBody");
    if(!body)return;

    body.querySelectorAll("tr").forEach(tr=>{
      tr.classList.remove("kpp-editor-double-row");
      tr.querySelector(".kpp-editor-double-badge")?.remove();
      const data=domRowData(tr,date);
      if(unitKey(data.unit)!==activeUnit)return;
      const strict=strictSignature(date,data);
      const stable=stableIdentity(date,data);
      const flagged=duplicateState.strictKeys.has(strict)||duplicateState.stableKeys.has(stable);
      if(!flagged)return;
      tr.classList.add("kpp-editor-double-row");
      const status=tr.querySelector(".row-status");
      if(status){
        const badge=document.createElement("span");
        badge.className="kpp-editor-double-badge";
        badge.textContent="⚠ DOUBLE";
        status.appendChild(badge);
      }
    });
  }

  async function searchAllDates(){
    const input=document.getElementById("editorFilterText");
    const button=document.getElementById(BUTTON_ID);
    const panel=document.getElementById(PANEL_ID);
    const unit=unitKey(input?.value);

    if(!unit){
      alert("Ketik CODE UNIT dulu di Cari Cepat, contoh DT7441.");
      input?.focus();
      return;
    }
    if(!/^[A-Z0-9._/-]+$/.test(unit)){
      alert("Pencarian semua tanggal khusus CODE UNIT. Ketik kode unit secara lengkap, contoh DT7441.");
      input?.focus();
      return;
    }

    button.disabled=true;
    button.textContent="MENCARI...";
    if(panel){panel.hidden=false;panel.innerHTML='<div class="kpp-crossdate-empty">Mencari seluruh tanggal unit...</div>';}

    try{
      const result=await fetchUnitRows(unit);
      activeUnit=unit;
      crossDateRows=result;
      duplicateState=buildDuplicateState(result);
      renderPanel(unit,result);
    }catch(error){
      console.error(error);
      if(panel){panel.hidden=false;panel.innerHTML=`<div class="kpp-crossdate-empty" style="color:#b91c1c">Gagal mencari semua tanggal: ${esc(error.message)}</div>`;}
    }finally{
      button.disabled=false;
      button.textContent="SEMUA TANGGAL";
    }
  }

  async function openDate(date){
    if(typeof loadDate!=="function")return;
    const dateInput=document.getElementById("editorDate");
    const filterInput=document.getElementById("editorFilterText");
    const panel=document.getElementById(PANEL_ID);
    if(!dateInput)return;

    if(typeof isDirty!=="undefined" && isDirty){
      const ok=confirm("Ada perubahan editor yang belum disimpan. Buka tanggal lain dan buang perubahan tersebut?");
      if(!ok)return;
    }

    dateInput.value=date;
    await loadDate();
    if(filterInput){
      filterInput.value=activeUnit;
      filterInput.dispatchEvent(new Event("input",{bubbles:true}));
    }
    markEditorDuplicates(date);
    if(panel)panel.hidden=true;
    document.getElementById("gridBody")?.closest(".panel")?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function exportAllDates(){
    if(!crossDateRows.length||!activeUnit)return;
    if(typeof XLSX==="undefined"){
      alert("Library Excel belum tersedia.");
      return;
    }

    const out=crossDateRows.map((row,index)=>({
      NO:index+1,
      TANGGAL:row.tanggal||"",
      JAM:String(row.jam||"").slice(0,5),
      "CODE UNIT":row.unit||"",
      "OPERATOR UNIT":row.operator||"",
      "HM AWAL":row.hm_awal??"",
      "HM SAAT ISI":row.hm_akhir??"",
      "HM JALAN":row.hm_jalan??"",
      "QTY ISSUED":row.fuel??"",
      SHIFT:row.shift??"",
      "FUEL TRUCK":row.fuel_truck||"",
      WH:row.wh||"",
      FUELMAN:row.fuelman_name||"",
      "INDIKASI DOUBLE":duplicateState.duplicateIds.has(String(row.id))?"DOUBLE / CEK":""
    }));

    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.json_to_sheet(out);
    ws["!cols"]=[6,12,9,14,24,12,14,12,13,9,13,12,22,18].map(wch=>({wch}));
    XLSX.utils.book_append_sheet(wb,ws,"SEMUA TANGGAL");
    XLSX.writeFile(wb,`Logsheet_${activeUnit}_Semua_Tanggal.xlsx`);
  }

  function install(){
    const filter=document.getElementById("kppLogsheetEditorFilters");
    const actions=filter?.querySelector(".filter-actions");
    if(!filter||!actions||typeof db==="undefined")return false;
    if(document.getElementById(BUTTON_ID))return true;

    injectStyle();

    const button=document.createElement("button");
    button.id=BUTTON_ID;
    button.type="button";
    button.textContent="SEMUA TANGGAL";
    button.title="Cari CODE UNIT yang diketik di seluruh tanggal Logsheet";
    actions.insertBefore(button,actions.firstChild);

    const panel=document.createElement("div");
    panel.id=PANEL_ID;
    panel.hidden=true;
    filter.insertAdjacentElement("afterend",panel);

    button.addEventListener("click",searchAllDates);
    document.getElementById("editorFilterText")?.addEventListener("keydown",event=>{
      if(event.key==="Enter"&&event.ctrlKey){
        event.preventDefault();
        searchAllDates();
      }
    });

    panel.addEventListener("click",event=>{
      const editBtn=event.target.closest(".kpp-crossdate-edit");
      if(editBtn){openDate(editBtn.dataset.date);return;}
      if(event.target.closest(".kpp-crossdate-export")){exportAllDates();return;}
      if(event.target.closest(".kpp-crossdate-close")){panel.hidden=true;}
    });
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()||attempts>=160)clearInterval(timer);
  },100);
  document.addEventListener("DOMContentLoaded",install,{once:true});
})();