// KPP-FMS Logsheet Editor cross-date unit lookup
// Read-only cross-date search. Editing remains date-scoped to avoid saving rows
// from different dates into the selected editor date.
(() => {
  "use strict";

  const PANEL_ID="kppEditorCrossDatePanel";
  const BUTTON_ID="kppEditorCrossDateBtn";
  const STYLE_ID="kppEditorCrossDateStyle";
  let crossDateRows=[];
  let activeUnit="";

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

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      #${BUTTON_ID}{
        min-height:38px;padding:8px 11px;border:1px solid #93c5fd;border-radius:8px;
        background:#eff6ff;color:#1d4ed8;font-weight:900;white-space:nowrap;
      }
      #${BUTTON_ID}:hover{background:#dbeafe}
      #${PANEL_ID}{
        margin:-2px 0 12px;padding:12px;border:1px solid #bfdbfe;border-left:4px solid #2563eb;
        border-radius:10px;background:#f8fbff;color:#0f172a;
      }
      #${PANEL_ID}[hidden]{display:none!important}
      .kpp-crossdate-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .kpp-crossdate-title{font-size:13px;font-weight:900;color:#1e3a8a}
      .kpp-crossdate-meta{margin-top:4px;font-size:11px;color:#64748b;line-height:1.45}
      .kpp-crossdate-actions{display:flex;gap:7px;flex-wrap:wrap}
      .kpp-crossdate-actions button{min-height:34px;padding:7px 10px;border-radius:8px;font-size:10px;font-weight:900;cursor:pointer}
      .kpp-crossdate-export{border:0;background:#16a34a;color:#fff}
      .kpp-crossdate-close{border:1px solid #cbd5e1;background:#fff;color:#475569}
      .kpp-crossdate-dates{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
      .kpp-crossdate-date{border:1px solid #bfdbfe;background:#fff;color:#1d4ed8;border-radius:999px;padding:6px 9px;font-size:10px;font-weight:800;cursor:pointer}
      .kpp-crossdate-date:hover{background:#eff6ff}
      .kpp-crossdate-tablewrap{width:100%;max-width:100%;overflow-x:auto;margin-top:10px;border:1px solid #dbe5f0;border-radius:9px;-webkit-overflow-scrolling:touch}
      .kpp-crossdate-table{width:100%;min-width:760px;border-collapse:collapse;background:#fff}
      .kpp-crossdate-table th{position:static;background:#10243f;color:#fff;font-size:9px;padding:7px 6px;white-space:nowrap}
      .kpp-crossdate-table td{font-size:10px;padding:6px;border-bottom:1px solid #e5e7eb;text-align:center;white-space:nowrap}
      .kpp-crossdate-empty{padding:12px;border:1px dashed #cbd5e1;border-radius:8px;background:#fff;color:#64748b;font-size:11px;text-align:center}
      @media(max-width:900px){
        #${BUTTON_ID}{flex:1 1 145px}
        .kpp-crossdate-head{display:block}.kpp-crossdate-actions{margin-top:9px}
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
        .select("id,tanggal,jam,unit,operator,hm_awal,hm_akhir,hm_jalan,fuel,shift,fuel_truck,wh,fuelman_name")
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

    panel.hidden=false;
    panel.innerHTML=`
      <div class="kpp-crossdate-head">
        <div>
          <div class="kpp-crossdate-title">UNIT ${esc(unit)} • SEMUA TANGGAL</div>
          <div class="kpp-crossdate-meta">${rows.length} transaksi • ${dates.length} tanggal${oldest&&latest?` • ${formatDate(oldest)} s/d ${formatDate(latest)}`:""}. Hasil ini hanya untuk pencarian; editor tetap menyimpan per tanggal agar aman.</div>
        </div>
        <div class="kpp-crossdate-actions">
          <button type="button" class="kpp-crossdate-export">⬇ UNDUH SEMUA TANGGAL</button>
          <button type="button" class="kpp-crossdate-close">TUTUP</button>
        </div>
      </div>
      ${dates.length?`<div class="kpp-crossdate-dates">${dates.map(([date,count])=>`<button type="button" class="kpp-crossdate-date" data-date="${esc(date)}">${formatDate(date)} • ${count}</button>`).join("")}</div>`:""}
      ${rows.length?`
        <div class="kpp-crossdate-tablewrap">
          <table class="kpp-crossdate-table">
            <thead><tr><th>Tanggal</th><th>Jam</th><th>Unit</th><th>HM Awal</th><th>HM Isi</th><th>HM Jalan</th><th>Qty</th><th>Shift</th><th>FT</th></tr></thead>
            <tbody>${rows.slice(0,120).map(row=>`<tr><td>${formatDate(row.tanggal)}</td><td>${esc(String(row.jam||"-").slice(0,5))}</td><td><b>${esc(row.unit||"-")}</b></td><td>${formatNumber(row.hm_awal)}</td><td>${formatNumber(row.hm_akhir)}</td><td>${formatNumber(row.hm_jalan)}</td><td>${formatNumber(row.fuel)} L</td><td>${esc(row.shift||"-")}</td><td>${esc(row.fuel_truck||"-")}</td></tr>`).join("")}</tbody>
          </table>
        </div>
        ${rows.length>120?`<div class="kpp-crossdate-meta">Preview menampilkan 120 transaksi terbaru. File Excel tetap berisi seluruh ${rows.length} transaksi.</div>`:""}
      `:'<div class="kpp-crossdate-empty">Tidak ada transaksi untuk unit tersebut.</div>'}
    `;
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
    if(!dateInput)return;

    if(typeof isDirty!=="undefined" && isDirty){
      const ok=confirm("Ada perubahan editor yang belum disimpan. Buka tanggal lain dan buang perubahan tersebut?");
      if(!ok)return;
    }

    dateInput.value=date;
    await loadDate();
    document.getElementById("editorFilterText").value=activeUnit;
    if(typeof window.KPP_EDITOR_APPLY_FILTERS==="function")window.KPP_EDITOR_APPLY_FILTERS();
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
      FUELMAN:row.fuelman_name||""
    }));

    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.json_to_sheet(out);
    ws["!cols"]=[6,12,9,14,24,12,14,12,13,9,13,12,22].map(wch=>({wch}));
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
      const dateBtn=event.target.closest(".kpp-crossdate-date");
      if(dateBtn){openDate(dateBtn.dataset.date);return;}
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
