// KPP-FMS V1 Finalization panel
// HM legacy review + bulk FC standard import + release readiness snapshot.
(() => {
  "use strict";

  const ROOT_ID="kppV1Finalization";
  let rows=[];
  let profile=null;

  const db=()=>window.KPP?.db||window.kppDb||null;
  const clean=v=>String(v??"").trim();
  const upper=v=>clean(v).toUpperCase();
  const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
  const fmt=(v,d=1)=>Number.isFinite(Number(v))?new Intl.NumberFormat("id-ID",{minimumFractionDigits:d,maximumFractionDigits:d}).format(Number(v)):"-";
  const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

  function ensureStyle(){
    if(document.getElementById("kppV1FinalizationStyle"))return;
    const style=document.createElement("style");
    style.id="kppV1FinalizationStyle";
    style.textContent=`
      #${ROOT_ID}{margin:0 0 18px}
      .kpp-v1-shell{border:1px solid #bfdbfe;border-radius:16px;background:linear-gradient(135deg,#eff6ff,#fff 62%);box-shadow:0 8px 24px rgba(15,23,42,.06);overflow:hidden}
      .kpp-v1-head{padding:15px 16px;display:flex;gap:12px;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #dbeafe}
      .kpp-v1-head h3{margin:0;color:#0f2748;font-size:16px}.kpp-v1-head p{margin:4px 0 0;color:#64748b;font-size:11px;line-height:1.45}
      .kpp-v1-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.kpp-v1-actions button{padding:8px 11px}
      .kpp-v1-ready{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:6px 10px;font-size:10px;font-weight:900;white-space:nowrap}
      .kpp-v1-ready.ok{background:#dcfce7;color:#166534;border:1px solid #86efac}.kpp-v1-ready.wait{background:#fef3c7;color:#92400e;border:1px solid #fde68a}
      .kpp-v1-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;padding:12px 16px}
      .kpp-v1-kpi{border:1px solid #e2e8f0;border-radius:11px;background:#fff;padding:10px;min-width:0}.kpp-v1-kpi small{display:block;color:#64748b;font-size:8px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}.kpp-v1-kpi strong{display:block;margin-top:4px;font-size:19px;color:#0f172a}.kpp-v1-kpi.bad strong{color:#b91c1c}.kpp-v1-kpi.warn strong{color:#b45309}.kpp-v1-kpi.good strong{color:#15803d}
      .kpp-v1-body{display:none;padding:0 16px 16px}.kpp-v1-body.open{display:block}
      .kpp-v1-toolbar{display:grid;grid-template-columns:minmax(180px,1.4fr) minmax(130px,.7fr) minmax(130px,.7fr) auto;gap:8px;margin:4px 0 10px}.kpp-v1-toolbar input,.kpp-v1-toolbar select{margin:0}
      .kpp-v1-table-wrap{max-height:460px;overflow:auto;border:1px solid #e2e8f0;border-radius:12px;background:#fff}.kpp-v1-table{min-width:1080px}.kpp-v1-table th{position:sticky;top:0;z-index:1}.kpp-v1-table td{text-align:left;vertical-align:top}.kpp-v1-table td.num{text-align:right;white-space:nowrap}
      .kpp-v1-status{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:9px;font-weight:900;white-space:nowrap}.kpp-v1-status.valid{background:#dcfce7;color:#166534}.kpp-v1-status.review{background:#fee2e2;color:#991b1b}.kpp-v1-status.no-history{background:#fef3c7;color:#92400e}
      .kpp-v1-reason{font-size:10px;line-height:1.45;color:#64748b;max-width:360px}.kpp-v1-unit{font-weight:900;color:#0f2748}.kpp-v1-muted{color:#94a3b8}
      .kpp-v1-fc{margin-top:12px;padding:12px;border:1px solid #dbeafe;border-radius:12px;background:#f8fbff;display:grid;grid-template-columns:minmax(260px,1fr) minmax(300px,1.1fr);gap:12px}.kpp-v1-fc textarea{min-height:150px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11px}.kpp-v1-fc-preview{max-height:190px;overflow:auto;border:1px solid #e2e8f0;border-radius:10px;background:#fff}.kpp-v1-fc-preview table{min-width:420px}.kpp-v1-fc-note{font-size:10px;line-height:1.5;color:#64748b;margin-top:6px}.kpp-v1-fc-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}
      .kpp-v1-foot{font-size:10px;color:#64748b;margin-top:8px;line-height:1.5}
      @media(max-width:1050px){.kpp-v1-kpis{grid-template-columns:repeat(3,1fr)}.kpp-v1-toolbar{grid-template-columns:1fr 1fr}.kpp-v1-fc{grid-template-columns:1fr}}
      @media(max-width:620px){.kpp-v1-head{flex-direction:column}.kpp-v1-actions{justify-content:flex-start}.kpp-v1-kpis{grid-template-columns:1fr 1fr}.kpp-v1-toolbar{grid-template-columns:1fr}.kpp-v1-body{padding-inline:10px}.kpp-v1-kpis{padding-inline:10px}}
    `;
    document.head.appendChild(style);
  }

  function ensureRoot(){
    if(document.getElementById(ROOT_ID))return document.getElementById(ROOT_ID);
    const container=document.querySelector(".container");
    const tabBar=container?.querySelector(".tab-bar");
    if(!container||!tabBar)return null;
    const root=document.createElement("div");
    root.id=ROOT_ID;
    root.innerHTML=`
      <div class="kpp-v1-shell">
        <div class="kpp-v1-head">
          <div><h3>🧭 V1.0 FINALIZATION CONTROL</h3><p>Review HM legacy, lengkapi FC standar, dan pantau release gate tanpa mengubah histori lama secara otomatis.</p></div>
          <div class="kpp-v1-actions">
            <span id="kppV1ReadyBadge" class="kpp-v1-ready wait">MEMUAT...</span>
            <button class="secondary" type="button" id="kppV1RefreshBtn">↻ REFRESH</button>
            <button class="primary" type="button" id="kppV1ToggleBtn">BUKA REVIEW</button>
          </div>
        </div>
        <div class="kpp-v1-kpis">
          <div class="kpp-v1-kpi"><small>Unit Aktif</small><strong id="kppV1Units">-</strong></div>
          <div class="kpp-v1-kpi good"><small>HM Valid</small><strong id="kppV1HmValid">-</strong></div>
          <div class="kpp-v1-kpi bad"><small>Review HM</small><strong id="kppV1HmReview">-</strong></div>
          <div class="kpp-v1-kpi warn"><small>Belum Histori</small><strong id="kppV1NoHistory">-</strong></div>
          <div class="kpp-v1-kpi warn"><small>FC Belum Diisi</small><strong id="kppV1FcMissing">-</strong></div>
          <div class="kpp-v1-kpi bad"><small>Health Critical</small><strong id="kppV1Critical">-</strong></div>
        </div>
        <div class="kpp-v1-body" id="kppV1Body">
          <div class="kpp-v1-toolbar">
            <input id="kppV1Search" placeholder="Cari unit / EGI / alasan review...">
            <select id="kppV1Status"><option value="ALL">SEMUA STATUS</option><option value="REVIEW">REVIEW HM</option><option value="NO_HISTORY">BELUM HISTORI</option><option value="VALID">VALID</option></select>
            <select id="kppV1FcFilter"><option value="ALL">SEMUA FC</option><option value="MISSING">FC BELUM DIISI</option><option value="READY">FC SUDAH DIISI</option></select>
            <button class="secondary" type="button" id="kppV1ExportBtn">EXPORT CSV</button>
          </div>
          <div class="kpp-v1-table-wrap"><table class="kpp-v1-table"><thead><tr><th>UNIT</th><th>STATUS</th><th>HM PENGISIAN TERAKHIR</th><th>HM TEpercaya</th><th>RIWAYAT</th><th>FC STD</th><th>ALASAN</th><th>AKSI</th></tr></thead><tbody id="kppV1ReviewBody"><tr><td colspan="8">Memuat review...</td></tr></tbody></table></div>
          <div class="kpp-v1-fc">
            <div>
              <b style="font-size:12px;color:#0f2748">Bulk Standar FC</b>
              <div class="kpp-v1-fc-note">Paste dua kolom dari Excel: <b>UNIT</b> dan <b>FC L/HM</b>. Nilai tidak pernah ditebak sistem. Hanya data yang kamu masukkan yang disimpan.</div>
              <textarea id="kppV1FcInput" placeholder="DT7441    70\nDT7442    70\nEX241     35"></textarea>
              <div class="kpp-v1-fc-actions"><button class="primary" type="button" id="kppV1FcPreviewBtn">PREVIEW FC</button><button class="green" type="button" id="kppV1FcSaveBtn" disabled>SIMPAN FC VALID</button><button class="secondary" type="button" id="kppV1FcClearBtn">BERSIHKAN</button></div>
              <div class="status" id="kppV1FcStatus"></div>
            </div>
            <div><div class="kpp-v1-fc-preview"><table><thead><tr><th>UNIT</th><th>FC</th><th>STATUS</th></tr></thead><tbody id="kppV1FcPreviewBody"><tr><td colspan="3">Belum ada preview.</td></tr></tbody></table></div></div>
          </div>
          <div class="kpp-v1-foot">REVIEW HM tidak menghapus histori. Gunakan HM Master untuk membuat titik koreksi resmi. Unit tanpa histori boleh first-use/manual sampai memiliki transaksi valid.</div>
        </div>
      </div>`;
    tabBar.insertAdjacentElement("beforebegin",root);
    return root;
  }

  function paintReadiness(s){
    const map={kppV1Units:s?.active_units,kppV1HmValid:s?.hm_valid,kppV1HmReview:s?.hm_review,kppV1NoHistory:s?.hm_no_history,kppV1FcMissing:s?.fc_missing,kppV1Critical:s?.health_critical};
    Object.entries(map).forEach(([id,v])=>{const el=document.getElementById(id);if(el)el.textContent=v??"-";});
    const badge=document.getElementById("kppV1ReadyBadge");
    if(!badge)return;
    const ready=s?.release_ready===true;
    badge.className=`kpp-v1-ready ${ready?"ok":"wait"}`;
    badge.textContent=ready?"V1 RELEASE GATE READY":"V1 MASIH ADA BLOCKER";
  }

  function statusLabel(row){
    if(row.review_status==="VALID")return '<span class="kpp-v1-status valid">VALID</span>';
    if(row.review_status==="NO_HISTORY")return '<span class="kpp-v1-status no-history">BELUM HISTORI</span>';
    return '<span class="kpp-v1-status review">REVIEW HM</span>';
  }

  function filteredRows(){
    const q=upper(document.getElementById("kppV1Search")?.value);
    const status=document.getElementById("kppV1Status")?.value||"ALL";
    const fc=document.getElementById("kppV1FcFilter")?.value||"ALL";
    return rows.filter(r=>{
      if(status!=="ALL"&&r.review_status!==status)return false;
      const hasFc=num(r.fc_standard_lphm)!==null&&Number(r.fc_standard_lphm)>0;
      if(fc==="MISSING"&&hasFc)return false;
      if(fc==="READY"&&!hasFc)return false;
      if(q&&!upper([r.unit,r.egi,r.reason,r.trusted_hm_source].join(" ")).includes(q))return false;
      return true;
    });
  }

  function render(){
    const body=document.getElementById("kppV1ReviewBody");
    if(!body)return;
    const list=filteredRows();
    if(!list.length){body.innerHTML='<tr><td colspan="8">Tidak ada unit sesuai filter.</td></tr>';return;}
    body.innerHTML=list.map(r=>{
      const fc=num(r.fc_standard_lphm);
      const when=r.last_fueling_date?`${esc(r.last_fueling_date)}${r.last_fueling_time?" "+esc(String(r.last_fueling_time).slice(0,5)):""}`:"-";
      return `<tr>
        <td><div class="kpp-v1-unit">${esc(r.unit)}</div><div class="kpp-v1-muted" style="font-size:9px">${esc(r.egi||"")}</div></td>
        <td>${statusLabel(r)}</td>
        <td class="num"><b>${r.last_hm==null?"-":fmt(r.last_hm,1)}</b><div class="kpp-v1-muted" style="font-size:9px">${when}</div></td>
        <td class="num"><b>${r.trusted_hm==null?"-":fmt(r.trusted_hm,1)}</b><div class="kpp-v1-muted" style="font-size:9px">${esc(r.trusted_hm_source||"")}</div></td>
        <td class="num">${Number(r.fuel_rows||0)}</td>
        <td class="num">${fc&&fc>0?`${fmt(fc,1)} L/HM`:'<span class="kpp-v1-muted">BELUM</span>'}</td>
        <td><div class="kpp-v1-reason">${esc(r.reason||"")}</div></td>
        <td><button class="small-btn" type="button" data-kpp-review-unit="${esc(r.unit)}">BUKA HM</button></td>
      </tr>`;
    }).join("");
  }

  async function load(){
    const client=db();
    if(!client)return;
    const reviewBody=document.getElementById("kppV1ReviewBody");
    if(reviewBody)reviewBody.innerHTML='<tr><td colspan="8">Memuat review HM...</td></tr>';
    const [queue,ready]=await Promise.all([
      client.rpc("hm_legacy_review_queue"),
      client.rpc("kpp_v1_readiness_snapshot")
    ]);
    if(queue.error){if(reviewBody)reviewBody.innerHTML=`<tr><td colspan="8">❌ ${esc(queue.error.message)}</td></tr>`;return;}
    rows=Array.isArray(queue.data)?queue.data:[];
    paintReadiness(ready.error?null:ready.data);
    render();
  }

  function openHm(unit){
    if(typeof window.showTab==="function")window.showTab("hm");
    const input=document.getElementById("unitInput");
    if(input)input.value=unit;
    const bulk=document.getElementById("bulkHmSearch");
    if(bulk)bulk.value=unit;
    if(typeof window.renderBulkHmTable==="function")window.renderBulkHmTable();
    if(typeof window.checkUnit==="function")window.checkUnit();
    document.getElementById("tabHm")?.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function exportCsv(){
    const data=filteredRows();
    const fields=["unit","egi","review_status","last_hm","last_fueling_date","last_fueling_time","trusted_hm","fuel_rows","fc_standard_lphm","reason"];
    const quote=v=>`"${String(v??"").replaceAll('"','""')}"`;
    const csv=[fields.join(","),...data.map(r=>fields.map(f=>quote(r[f])).join(","))].join("\r\n");
    const blob=new Blob(["\ufeff",csv],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`KPP_HM_REVIEW_${window.KPPTime?.localDate?.()||"export"}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function parseFc(){
    const input=document.getElementById("kppV1FcInput");
    const lines=String(input?.value||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const seen=new Set();
    return lines.map((line,index)=>{
      const parts=line.split(/[\t;, ]+/).filter(Boolean);
      const unit=upper(parts[0]);
      const raw=String(parts[1]??"").replace(",",".");
      const fc=num(raw);
      let error="";
      if(!unit)error="Unit kosong";
      else if(fc===null||fc<=0||fc>10000)error="FC tidak valid";
      else if(seen.has(unit))error="Unit duplicate";
      else if(rows.length&&!rows.some(r=>upper(r.unit)===unit))error="Unit tidak aktif/tidak ada";
      seen.add(unit);
      return {line:index+1,unit,fc,error};
    });
  }

  function previewFc(){
    const parsed=parseFc();
    const body=document.getElementById("kppV1FcPreviewBody");
    const btn=document.getElementById("kppV1FcSaveBtn");
    const status=document.getElementById("kppV1FcStatus");
    if(!parsed.length){body.innerHTML='<tr><td colspan="3">Tempel data UNIT + FC terlebih dahulu.</td></tr>';btn.disabled=true;status.textContent="";return;}
    const bad=parsed.filter(x=>x.error);
    body.innerHTML=parsed.map(x=>`<tr><td>${esc(x.unit||"-")}</td><td>${x.fc===null?"-":fmt(x.fc,1)}</td><td style="font-weight:800;color:${x.error?'#b91c1c':'#15803d'}">${esc(x.error||"SIAP")}</td></tr>`).join("");
    btn.disabled=bad.length>0;
    status.textContent=bad.length?`⚠️ ${bad.length} baris perlu diperbaiki.`:`✅ ${parsed.length} standar FC siap disimpan.`;
  }

  async function saveFc(){
    const parsed=parseFc();
    if(!parsed.length||parsed.some(x=>x.error))return previewFc();
    const btn=document.getElementById("kppV1FcSaveBtn");
    const status=document.getElementById("kppV1FcStatus");
    btn.disabled=true;status.textContent="Menyimpan standar FC...";
    const payload=parsed.map(x=>({unit:x.unit,fc_standard_lphm:x.fc}));
    const {data,error}=await db().rpc("set_unit_fc_standards_bulk",{p_rows:payload});
    if(error){status.textContent=`❌ ${error.message}`;btn.disabled=false;return;}
    status.textContent=`✅ ${Number(data?.updated||payload.length)} standar FC tersimpan.`;
    await load();
    previewFc();
  }

  function bind(root){
    root.querySelector("#kppV1ToggleBtn")?.addEventListener("click",()=>{
      const body=document.getElementById("kppV1Body");
      body.classList.toggle("open");
      document.getElementById("kppV1ToggleBtn").textContent=body.classList.contains("open")?"TUTUP REVIEW":"BUKA REVIEW";
    });
    root.querySelector("#kppV1RefreshBtn")?.addEventListener("click",load);
    root.querySelector("#kppV1Search")?.addEventListener("input",render);
    root.querySelector("#kppV1Status")?.addEventListener("change",render);
    root.querySelector("#kppV1FcFilter")?.addEventListener("change",render);
    root.querySelector("#kppV1ExportBtn")?.addEventListener("click",exportCsv);
    root.querySelector("#kppV1FcPreviewBtn")?.addEventListener("click",previewFc);
    root.querySelector("#kppV1FcSaveBtn")?.addEventListener("click",saveFc);
    root.querySelector("#kppV1FcClearBtn")?.addEventListener("click",()=>{document.getElementById("kppV1FcInput").value="";previewFc();});
    root.querySelector("#kppV1ReviewBody")?.addEventListener("click",e=>{
      const btn=e.target.closest("[data-kpp-review-unit]");if(btn)openHm(btn.dataset.kppReviewUnit);
    });
  }

  function install(){
    ensureStyle();
    const root=ensureRoot();
    if(!root)return false;
    if(!root.dataset.bound){root.dataset.bound="1";bind(root);}
    return true;
  }

  function boot(){
    if(!install())return;
    if(window.KPP_PROFILE){profile=window.KPP_PROFILE;load();}
  }

  document.addEventListener("kpp-auth-ready",e=>{profile=e.detail?.profile||null;if(install())load();});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
