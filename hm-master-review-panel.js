// KPP-FMS HM Master review panel
// Read-only detector for suspicious HM reference/history gaps.
(() => {
  "use strict";

  const PANEL_ID="kppHmReviewPanel";
  const STYLE_ID="kppHmReviewStyle";
  const PAGE_SIZE=1000;

  function esc(value){
    return String(value??"")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#39;");
  }

  function num(value){
    if(value===null||value===undefined||value==="")return null;
    const n=Number(value);
    return Number.isFinite(n)?n:null;
  }

  function fmt(value){
    const n=num(value);
    return n===null?"-":n.toLocaleString("id-ID",{maximumFractionDigits:1});
  }

  function rowKey(row){
    return `${row?.tanggal||"0000-00-00"}T${String(row?.jam||"00:00:00").slice(0,8)}|${String(row?.id||"").padStart(20,"0")}`;
  }

  function median(values){
    const a=values.slice().sort((x,y)=>x-y);
    if(!a.length)return null;
    const m=Math.floor(a.length/2);
    return a.length%2?a[m]:(a[m-1]+a[m])/2;
  }

  function elapsedHours(a,b){
    const start=Date.parse(`${a.tanggal}T${String(a.jam||"00:00:00").slice(0,8)}Z`);
    const end=Date.parse(`${b.tanggal}T${String(b.jam||"00:00:00").slice(0,8)}Z`);
    if(!Number.isFinite(start)||!Number.isFinite(end)||end<start)return 0;
    return (end-start)/3600000;
  }

  async function fetchPaged(table,select){
    let from=0;
    const all=[];
    while(true){
      const {data,error}=await db.from(table).select(select)
        .order("tanggal",{ascending:false})
        .order("id",{ascending:false})
        .range(from,from+PAGE_SIZE-1);
      if(error)throw error;
      const part=data||[];
      all.push(...part);
      if(part.length<PAGE_SIZE)break;
      from+=PAGE_SIZE;
    }
    return all;
  }

  function deriveReference(histories,corrections){
    const trusted=histories
      .filter(r=>r.hm_ref_excluded!==true&&num(r.hm_akhir)!==null&&num(r.hm_akhir)>=0)
      .sort((a,b)=>rowKey(b).localeCompare(rowKey(a)));
    const corr=corrections
      .filter(r=>num(r.hm)!==null&&num(r.hm)>=0)
      .sort((a,b)=>rowKey(b).localeCompare(rowKey(a)))[0]||null;

    if(corr){
      let ref=num(corr.hm);
      const after=trusted
        .filter(r=>rowKey(r)>rowKey(corr))
        .slice(0,30);
      for(const row of after){
        const hm=num(row.hm_akhir);
        const allowed=Math.max(48,elapsedHours(corr,row)+48);
        if(hm!==null&&hm>=ref&&hm-ref<=allowed)ref=Math.max(ref,hm);
      }
      return {value:ref,source:ref>num(corr.hm)?"Setelah koreksi":"HM Master / Koreksi"};
    }

    const recent=trusted.slice(0,7);
    if(!recent.length)return {value:null,source:"Belum ada reference"};
    if(recent.length<3)return {value:num(recent[0].hm_akhir),source:"Transaksi terbaru"};

    const med=median(recent.map(r=>num(r.hm_akhir)).filter(v=>v!==null));
    const cluster=recent.map(r=>num(r.hm_akhir)).filter(v=>v!==null&&v>=Math.max(0,med*.5)&&v<=med*1.5);
    return {
      value:cluster.length?Math.max(...cluster):num(recent[0].hm_akhir),
      source:cluster.length?"Cluster transaksi terbaru":"Transaksi terbaru"
    };
  }

  function analyzeUnit(unit,histories,corrections){
    const all=histories
      .filter(r=>num(r.hm_akhir)!==null&&num(r.hm_akhir)>=0)
      .sort((a,b)=>rowKey(b).localeCompare(rowKey(a)));
    if(!all.length&&!corrections.length)return null;

    const ref=deriveReference(histories,corrections);
    const latest=all[0]||null;
    const latestHm=latest?num(latest.hm_akhir):null;
    const diff=ref.value!==null&&latestHm!==null?latestHm-ref.value:null;
    const absDiff=diff===null?0:Math.abs(diff);
    const ratio=ref.value>0&&latestHm>0?Math.max(ref.value/latestHm,latestHm/ref.value):1;

    const recent=all.slice(0,7).map(r=>num(r.hm_akhir)).filter(v=>v!==null&&v>0);
    const spreadRatio=recent.length>=3?Math.max(...recent)/Math.max(1,Math.min(...recent)):1;
    const reasons=[];

    if(ref.value===null&&latestHm!==null)reasons.push("Belum ada HM reference resmi");
    if(diff!==null&&diff>72)reasons.push("Histori terbaru jauh di atas reference");
    if(diff!==null&&diff<-72)reasons.push("Reference jauh di atas histori terbaru");
    if(spreadRatio>=3)reasons.push("Pola digit HM terbaru tidak konsisten");

    if(!reasons.length)return null;

    const critical=ratio>=3||absDiff>=500||spreadRatio>=5;
    return {
      unit,
      reference:ref.value,
      referenceSource:ref.source,
      latest:latestHm,
      latestDate:latest?.tanggal||null,
      latestExcluded:latest?.hm_ref_excluded===true,
      diff,
      reason:reasons.join(" • "),
      severity:critical?"critical":"warn"
    };
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement("style");
    style.id=STYLE_ID;
    style.textContent=`
      #${PANEL_ID}{border-left:4px solid #f59e0b;background:linear-gradient(180deg,#fff,#fffbeb)}
      #${PANEL_ID} h3::before{background:#f59e0b}
      .hm-review-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
      .hm-review-copy{font-size:11px;color:#64748b;line-height:1.55;max-width:760px}
      .hm-review-refresh{background:#fff;border:1px solid #fbbf24;color:#92400e;min-height:36px;padding:8px 11px}
      .hm-review-summary{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}
      .hm-review-chip{padding:6px 9px;border-radius:999px;font-size:10px;font-weight:900;border:1px solid #fde68a;background:#fff7ed;color:#92400e}
      .hm-review-table-wrap{max-height:360px;overflow:auto;border:1px solid #fde68a;border-radius:11px;background:#fff}
      .hm-review-table{min-width:780px}
      .hm-review-table tr.hm-critical td{background:#fff7f7}
      .hm-review-table tr.hm-warn td{background:#fffdf5}
      .hm-review-badge{display:inline-block;padding:4px 7px;border-radius:999px;font-size:9px;font-weight:900}
      .hm-review-badge.critical{background:#fee2e2;color:#b91c1c}
      .hm-review-badge.warn{background:#fef3c7;color:#92400e}
      .hm-review-open{padding:7px 9px;background:#2563eb;color:#fff;font-size:10px}
      .hm-review-empty{padding:14px;text-align:center;color:#166534;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;font-size:11px;font-weight:800}
    `;
    document.head.appendChild(style);
  }

  function render(panel,issues){
    const critical=issues.filter(x=>x.severity==="critical").length;
    const warn=issues.length-critical;
    panel.innerHTML=`
      <div class="hm-review-head">
        <div>
          <h3>HM Perlu Dicek</h3>
          <div class="hm-review-copy">Panel audit read-only. Sistem membandingkan HM reference dengan histori terbaru dan pola digit HM. Tidak ada HM yang diubah otomatis. Cek display unit lalu simpan koreksi lewat HM Master bila memang salah.</div>
        </div>
        <button type="button" class="hm-review-refresh">↻ CEK ULANG</button>
      </div>
      <div class="hm-review-summary">
        <span class="hm-review-chip">Perlu dicek: <b>${issues.length}</b></span>
        <span class="hm-review-chip">Prioritas tinggi: <b>${critical}</b></span>
        <span class="hm-review-chip">Waspada: <b>${warn}</b></span>
      </div>
      ${issues.length?`
        <div class="hm-review-table-wrap">
          <table class="hm-review-table">
            <thead><tr><th>Status</th><th>Unit</th><th>HM Reference</th><th>Histori Terbaru</th><th>Selisih</th><th>Alasan</th><th>Aksi</th></tr></thead>
            <tbody>${issues.map(issue=>`<tr class="hm-${issue.severity}">
              <td><span class="hm-review-badge ${issue.severity}">${issue.severity==="critical"?"PRIORITAS":"WASPADA"}</span></td>
              <td><b>${esc(issue.unit)}</b></td>
              <td>${fmt(issue.reference)}<div style="font-size:9px;color:#64748b;margin-top:3px">${esc(issue.referenceSource)}</div></td>
              <td>${fmt(issue.latest)}<div style="font-size:9px;color:#64748b;margin-top:3px">${esc(issue.latestDate||"-")}${issue.latestExcluded?" • Editor":""}</div></td>
              <td>${issue.diff===null?"-":`${issue.diff>0?"+":""}${fmt(issue.diff)}`}</td>
              <td style="text-align:left;white-space:normal;min-width:220px">${esc(issue.reason)}</td>
              <td><button type="button" class="hm-review-open" data-unit="${esc(issue.unit)}">CEK UNIT</button></td>
            </tr>`).join("")}</tbody>
          </table>
        </div>
      `:'<div class="hm-review-empty">✅ Tidak ada anomali HM besar yang terdeteksi pada unit aktif.</div>'}
    `;
  }

  async function loadReview(){
    const panel=document.getElementById(PANEL_ID);
    if(!panel)return;
    panel.innerHTML='<div class="hm-review-empty" style="color:#475569;background:#f8fafc;border-color:#e2e8f0">Memeriksa HM unit aktif...</div>';

    try{
      const [unitRes,histories,corrections]=await Promise.all([
        db.from("unit_master").select("code_unit,active").eq("active",true).order("code_unit",{ascending:true}),
        fetchPaged("fuel_history","id,tanggal,jam,unit,hm_akhir,hm_ref_excluded,hm_ref_excluded_reason"),
        fetchPaged("hm_corrections","id,tanggal,jam,unit,hm")
      ]);
      if(unitRes.error)throw unitRes.error;

      const byUnit=new Map();
      histories.forEach(row=>{
        const unit=String(row.unit||"").trim().toUpperCase();
        if(!unit)return;
        if(!byUnit.has(unit))byUnit.set(unit,[]);
        byUnit.get(unit).push(row);
      });
      const corrByUnit=new Map();
      corrections.forEach(row=>{
        const unit=String(row.unit||"").trim().toUpperCase();
        if(!unit)return;
        if(!corrByUnit.has(unit))corrByUnit.set(unit,[]);
        corrByUnit.get(unit).push(row);
      });

      const issues=(unitRes.data||[])
        .map(row=>String(row.code_unit||"").trim().toUpperCase())
        .filter(Boolean)
        .map(unit=>analyzeUnit(unit,byUnit.get(unit)||[],corrByUnit.get(unit)||[]))
        .filter(Boolean)
        .sort((a,b)=>{
          if(a.severity!==b.severity)return a.severity==="critical"?-1:1;
          return Math.abs(b.diff||0)-Math.abs(a.diff||0);
        });
      render(panel,issues);
    }catch(error){
      console.error(error);
      panel.innerHTML=`<div class="hm-review-empty" style="color:#b91c1c;background:#fef2f2;border-color:#fecaca">Gagal membaca audit HM: ${esc(error.message)}</div>`;
    }
  }

  function openUnit(unit){
    if(typeof showTab==="function")showTab("hm");
    const input=document.getElementById("unitInput");
    if(input)input.value=unit;
    if(typeof checkUnit==="function")checkUnit();
    input?.scrollIntoView({behavior:"smooth",block:"center"});
  }

  function install(){
    if(typeof db==="undefined")return false;
    const tab=document.getElementById("tabHm");
    if(!tab)return false;
    if(document.getElementById(PANEL_ID))return true;
    injectStyle();

    const panel=document.createElement("div");
    panel.id=PANEL_ID;
    panel.className="panel";
    const firstPanel=tab.querySelector(":scope > .panel");
    if(firstPanel)firstPanel.insertAdjacentElement("afterend",panel);
    else tab.prepend(panel);

    panel.addEventListener("click",event=>{
      if(event.target.closest(".hm-review-refresh")){loadReview();return;}
      const button=event.target.closest(".hm-review-open");
      if(button)openUnit(button.dataset.unit);
    });
    loadReview();
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{
    attempts++;
    if(install()||attempts>=160)clearInterval(timer);
  },100);
  document.addEventListener("DOMContentLoaded",install,{once:true});
})();
