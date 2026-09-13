// KPP-FMS Logsheet Editor hardening
// - anti-double tetap mengenali transaksi lama walau HM histori pernah diedit
// - filter cepat untuk mencari transaksi pada tanggal yang sedang dibuka
(() => {
  "use strict";

  const FILTER_STYLE_ID="kpp-logsheet-editor-filter-style";
  const FILTER_BAR_ID="kppLogsheetEditorFilters";
  const PATCH_FLAG="KPP_EDITOR_ANTIDOUBLE_INSTALLED";
  const hmCorrectedStableKeys=new Set();

  function numberKey(value){
    if(typeof window.stableNumber==="function")return window.stableNumber(value);
    if(value===null||value===undefined||value==="")return "NULL";
    const n=Number(String(value).replace(",","."));
    if(!Number.isFinite(n))return "NULL";
    return n.toFixed(3).replace(/\.0+$/,"").replace(/(\.\d*?)0+$/,"$1");
  }

  function shiftKey(value){
    if(typeof window.normalizeShift==="function")return window.normalizeShift(value);
    const s=String(value||"").trim().toLowerCase();
    if(s==="1"||s==="shift 1"||s==="s1")return 1;
    if(s==="2"||s==="shift 2"||s==="s2")return 2;
    return "";
  }

  function ftKey(row){
    try{
      if(typeof window.normalizeFT==="function"){
        const ft=window.normalizeFT(row?.fuel_truck);
        if(ft)return ft;
      }
      if(typeof window.inferFTFromWH==="function"){
        const ft=window.inferFTFromWH(row?.wh);
        if(ft)return ft;
      }
    }catch(error){
      console.warn("Anti-double: gagal normalisasi FT",error);
    }
    return String(row?.fuel_truck||"").trim().toUpperCase();
  }

  function stableIdentity(tanggal,row){
    return [
      String(tanggal||""),
      String(row?.unit||"").trim().toUpperCase(),
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

  function rememberHmCorrections(rows){
    (rows||[]).forEach(row=>{
      if(isHmCorrectedRow(row)){
        hmCorrectedStableKeys.add(stableIdentity(row.tanggal,row));
      }
    });
  }

  function installAntiDoublePatch(){
    if(window[PATCH_FLAG])return true;
    if(typeof window.duplicateSignature!=="function")return false;

    const strictSignature=window.duplicateSignature;
    const originalFetchExistingRange=window.fetchExistingRange;
    window.KPP_EDITOR_STRICT_DUPLICATE_SIGNATURE=strictSignature;

    // fetchExistingRange dipakai saat preview import dan tepat sebelum INSERT.
    // Di sini kita ingat transaksi yang HM-nya memang pernah dikoreksi.
    if(typeof originalFetchExistingRange==="function"){
      window.fetchExistingRange=async function(...args){
        const result=await originalFetchExistingRange.apply(this,args);
        rememberHmCorrections(result);
        return result;
      };
    }

    // Data normal tetap memakai fingerprint lama yang mencakup HM, sehingga dua
    // pengisian sah dengan Qty/Shift/FT sama tidak otomatis dianggap sama.
    // Khusus transaksi yang tercatat pernah dikoreksi HM, fallback mengabaikan HM.
    window.duplicateSignature=function(tanggal,row){
      const stable=stableIdentity(tanggal,row);
      if(isHmCorrectedRow(row) || hmCorrectedStableKeys.has(stable)){
        return `HM_EDIT|${stable}`;
      }
      return `STRICT|${strictSignature(tanggal,row)}`;
    };

    window[PATCH_FLAG]=true;
    return true;
  }

  function injectStyle(){
    if(document.getElementById(FILTER_STYLE_ID))return;
    const style=document.createElement("style");
    style.id=FILTER_STYLE_ID;
    style.textContent=`
      .editor-filterbar{
        display:grid;
        grid-template-columns:minmax(220px,1.5fr) repeat(3,minmax(135px,.7fr)) auto;
        gap:8px;
        align-items:end;
        padding:10px;
        margin-bottom:10px;
        border:1px solid #bfdbfe;
        border-radius:10px;
        background:#f8fbff;
      }
      .editor-filterbar .filter-field label{
        display:block;
        margin-bottom:5px;
        color:#475569;
        font-size:10px;
        font-weight:800;
        letter-spacing:.03em;
        text-transform:uppercase;
      }
      .editor-filterbar input,
      .editor-filterbar select{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        border:1px solid #cbd5e1;
        border-radius:8px;
        background:#fff;
        color:#0f172a;
        font-size:12px;
      }
      .editor-filterbar .filter-actions{
        display:flex;
        align-items:center;
        gap:8px;
        min-height:38px;
      }
      .editor-filterbar .filter-reset{
        min-height:38px;
        padding:8px 11px;
        border:1px solid #cbd5e1;
        background:#fff;
        color:#334155;
      }
      .editor-filterbar .filter-count{
        min-width:110px;
        color:#475569;
        font-size:11px;
        font-weight:700;
        white-space:nowrap;
      }
      .editor-antidouble-note{
        margin-top:8px;
        padding:8px 10px;
        border:1px solid #bbf7d0;
        border-left:4px solid #16a34a;
        border-radius:8px;
        background:#f0fdf4;
        color:#166534;
        font-size:11px;
        line-height:1.45;
      }
      @media(max-width:900px){
        .editor-filterbar{grid-template-columns:1fr 1fr}
        .editor-filterbar .filter-search{grid-column:1/-1}
        .editor-filterbar .filter-actions{grid-column:1/-1;justify-content:space-between}
      }
      @media(max-width:520px){
        .editor-filterbar{grid-template-columns:1fr}
        .editor-filterbar .filter-search,
        .editor-filterbar .filter-actions{grid-column:auto}
      }
    `;
    document.head.appendChild(style);
  }

  function rowStatusKey(tr){
    const text=String(tr.querySelector(".row-status")?.textContent||"").toUpperCase();
    if(text.includes("KOSONG"))return "empty";
    if(text.includes("EDIT"))return "edit";
    if(text.includes("BARU"))return "new";
    if(text.includes("SUDAH ADA")||text.includes("TERSIMPAN"))return "existing";
    return "other";
  }

  function rowSearchText(tr){
    return Array.from(tr.querySelectorAll("input,select"))
      .map(el=>String(el.value||""))
      .join(" ")
      .toUpperCase();
  }

  function refreshFtOptions(){
    const select=document.getElementById("editorFilterFt");
    if(!select)return;

    const current=select.value;
    const values=new Set();
    document.querySelectorAll("#gridBody .col-ft option").forEach(option=>{
      const value=String(option.value||"").trim();
      if(value)values.add(value);
    });

    const sorted=[...values].sort((a,b)=>a.localeCompare(b));
    const next=["<option value=\"\">Semua FT</option>"]
      .concat(sorted.map(value=>`<option value="${value}">${value}</option>`));
    select.innerHTML=next.join("");
    if(sorted.includes(current))select.value=current;
  }

  function applyFilters(){
    const body=document.getElementById("gridBody");
    if(!body)return;

    const q=String(document.getElementById("editorFilterText")?.value||"").trim().toUpperCase();
    const shift=String(document.getElementById("editorFilterShift")?.value||"");
    const ft=String(document.getElementById("editorFilterFt")?.value||"");
    const status=String(document.getElementById("editorFilterStatus")?.value||"");

    let visible=0;
    let total=0;

    body.querySelectorAll("tr").forEach(tr=>{
      const statusKey=rowStatusKey(tr);
      const isTransaction=statusKey!=="empty";
      if(isTransaction)total++;

      const text=rowSearchText(tr);
      const rowShift=String(tr.querySelector(".col-shift")?.value||"");
      const rowFt=String(tr.querySelector(".col-ft")?.value||"");

      let show=true;
      if(q && !text.includes(q))show=false;
      if(shift && rowShift!==shift)show=false;
      if(ft && rowFt!==ft)show=false;
      if(status && statusKey!==status)show=false;

      // Saat ada filter aktif, baris kosong tidak ikut memenuhi layar.
      if((q||shift||ft||status) && !isTransaction)show=false;

      tr.style.display=show?"":"none";
      if(show && isTransaction)visible++;
    });

    const count=document.getElementById("editorFilterCount");
    if(count)count.textContent=`Tampil ${visible} / ${total} transaksi`;
  }

  function installFilters(){
    if(document.getElementById(FILTER_BAR_ID))return true;

    const gridBody=document.getElementById("gridBody");
    const tableWrap=gridBody?.closest(".table-wrap");
    if(!gridBody||!tableWrap)return false;

    injectStyle();

    const bar=document.createElement("div");
    bar.id=FILTER_BAR_ID;
    bar.className="editor-filterbar";
    bar.innerHTML=`
      <div class="filter-field filter-search">
        <label>Cari Cepat</label>
        <input id="editorFilterText" type="search" placeholder="Unit, operator, fuelman, HM, Qty..." autocomplete="off">
      </div>
      <div class="filter-field">
        <label>Shift</label>
        <select id="editorFilterShift">
          <option value="">Semua Shift</option>
          <option value="1">Shift 1</option>
          <option value="2">Shift 2</option>
        </select>
      </div>
      <div class="filter-field">
        <label>Fuel Truck</label>
        <select id="editorFilterFt"><option value="">Semua FT</option></select>
      </div>
      <div class="filter-field">
        <label>Status</label>
        <select id="editorFilterStatus">
          <option value="">Semua Status</option>
          <option value="existing">Sudah Ada / Tersimpan</option>
          <option value="edit">Sedang Diedit</option>
          <option value="new">Baru / Import</option>
        </select>
      </div>
      <div class="filter-actions">
        <button id="editorFilterReset" type="button" class="filter-reset">RESET FILTER</button>
        <span id="editorFilterCount" class="filter-count">Tampil 0 / 0 transaksi</span>
      </div>
    `;

    tableWrap.parentNode.insertBefore(bar,tableWrap);

    ["editorFilterText","editorFilterShift","editorFilterFt","editorFilterStatus"].forEach(id=>{
      const el=document.getElementById(id);
      el?.addEventListener(id==="editorFilterText"?"input":"change",applyFilters);
    });

    document.getElementById("editorFilterReset")?.addEventListener("click",()=>{
      document.getElementById("editorFilterText").value="";
      document.getElementById("editorFilterShift").value="";
      document.getElementById("editorFilterFt").value="";
      document.getElementById("editorFilterStatus").value="";
      applyFilters();
    });

    const observer=new MutationObserver(()=>{
      refreshFtOptions();
      applyFilters();
    });
    observer.observe(gridBody,{childList:true,subtree:false});

    refreshFtOptions();
    applyFilters();
    return true;
  }

  function installSafetyNote(){
    if(document.querySelector(".editor-antidouble-note"))return;
    const help=document.querySelector(".help");
    if(!help)return;
    const note=document.createElement("div");
    note.className="editor-antidouble-note";
    note.innerHTML="<b>ANTI-DOUBLE HM EDIT AKTIF.</b> Untuk transaksi yang tercatat pernah dikoreksi HM, import ulang tetap dianggap SUDAH ADA walau nilai HM di file lama berbeda. Data normal tetap dibandingkan dengan fingerprint lengkap agar pengisian sah tidak ikut tertahan.";
    help.insertAdjacentElement("afterend",note);
  }

  function init(){
    let attempts=0;
    const timer=setInterval(()=>{
      attempts++;
      const antiDoubleReady=installAntiDoublePatch();
      const filterReady=installFilters();
      if(antiDoubleReady)installSafetyNote();

      if((antiDoubleReady&&filterReady)||attempts>=80){
        clearInterval(timer);
      }
    },100);
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",init,{once:true});
  }else{
    init();
  }
})();
