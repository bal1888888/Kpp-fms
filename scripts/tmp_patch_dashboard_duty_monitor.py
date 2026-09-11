from pathlib import Path
import json, re

root=Path(__file__).resolve().parents[1]
dash=root/'dashboard.html'
text=dash.read_text(encoding='utf-8')

css_marker='/* ===== KPP-FMS DUTY MONITOR v1 ===== */'
if css_marker not in text:
    css='''\n\n/* ===== KPP-FMS DUTY MONITOR v1 ===== */
.session-title-block{min-width:0}
.session-period{font-size:10px;color:var(--muted);font-weight:800;margin-top:4px}
.session-count{background:#dbeafe;color:#1d4ed8}
.session-grid{grid-template-columns:repeat(auto-fit,minmax(230px,1fr))}
.session-card{position:relative;border:1px solid #dbe3ee;background:#fff;border-radius:13px;padding:14px;overflow:hidden}
.session-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#94a3b8}
.session-card.monitor-done::before{background:#16a34a}
.session-card.monitor-ready::before{background:#2563eb}
.session-card.monitor-pending::before{background:#f59e0b}
.session-card.monitor-missing::before,.session-card.monitor-anomaly::before{background:#dc2626}
.session-card .name{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:9px}
.session-card .name-main{font-weight:900;font-size:14px;line-height:1.3;min-width:0}
.session-card .duty-label{font-size:10px;color:#475569;font-weight:900;margin-top:3px}
.session-card .meta{font-size:11px;color:#475569;line-height:1.55}
.session-status-badge{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:900;white-space:nowrap;background:#f1f5f9;color:#475569}
.session-status-badge.done{background:#dcfce7;color:#166534}
.session-status-badge.ready{background:#dbeafe;color:#1d4ed8}
.session-status-badge.pending{background:#fef3c7;color:#92400e}
.session-status-badge.missing,.session-status-badge.anomaly{background:#fee2e2;color:#b91c1c}
.session-progress{height:7px;border-radius:999px;background:#e2e8f0;overflow:hidden;margin:10px 0 7px}
.session-progress>span{display:block;height:100%;background:#2563eb;border-radius:999px}
.session-card.monitor-done .session-progress>span{background:#16a34a}
.session-card.monitor-pending .session-progress>span{background:#f59e0b}
.session-card.monitor-missing .session-progress>span,.session-card.monitor-anomaly .session-progress>span{background:#dc2626}
.session-missing{margin-top:6px;font-size:10px;color:#b45309;font-weight:800;white-space:normal}
.session-card.monitor-missing .session-missing,.session-card.monitor-anomaly .session-missing{color:#b91c1c}
.session-empty{grid-column:1/-1}
@media(max-width:560px){
  .session-grid{grid-template-columns:1fr}
  .session-card{padding:12px}
  .session-card .name-main{font-size:13px}
}
'''
    text=text.replace('</style>',css+'\n</style>',1)

text=text.replace('<div class="session-title-wrap">\n          <div>\n            <span class="section-kicker">STATUS SHIFT</span>\n            <h2>Fuelman Bertugas</h2>\n          </div>\n          <span class="session-count" id="activeFuelmanCount">0</span>\n        </div>',
'''<div class="session-title-wrap">
          <div class="session-title-block">
            <span class="section-kicker">STATUS SHIFT</span>
            <h2>Monitoring Petugas Shift</h2>
            <div class="session-period" id="sessionPeriodLabel">-</div>
          </div>
          <span class="session-count" id="activeFuelmanCount">0/0</span>
        </div>''')
text=text.replace('<div class="session-empty">Memuat sesi aktif...</div>','<div class="session-empty">Memuat penanggung jawab shift...</div>')

new_func=r'''async function loadActiveSessions(){
  const host=document.getElementById("activeSessions");
  const countEl=document.getElementById("activeFuelmanCount");
  const periodEl=document.getElementById("sessionPeriodLabel");
  const {tanggal,shift}=currentOperationalShift();
  const shiftLabel=`Shift ${shift}`;
  if(periodEl)periodEl.textContent=`${formatTanggal(tanggal)} • ${shiftLabel}`;

  const [sessionsResult,closingResult]=await Promise.all([
    db.from("fuelman_sessions")
      .select("id,user_id,fuelman_name,username,tanggal,shift,fuel_truck,jam_mulai,jam_selesai,status,duty_type,created_at")
      .eq("tanggal",tanggal)
      .eq("shift",shiftLabel)
      .order("created_at",{ascending:true}),
    db.from("stock_closing")
      .select("storage,session_id,fuelman_user_id,actual_qty,sonding_height_cm")
      .eq("tanggal",tanggal)
      .eq("shift",shift)
  ]);

  const error=sessionsResult.error||closingResult.error;
  if(error){
    host.innerHTML='<div class="session-empty">❌ Gagal membaca monitoring shift: '+escapeHtml(error.message)+'</div>';
    countEl.textContent="0/0";
    return;
  }

  const sessions=sessionsResult.data||[];
  const closings=closingResult.data||[];
  const activeFT=STORAGE_ROWS.filter(row=>row.active!==false&&row.storage_type==="FT");
  const activeMT=STORAGE_ROWS.filter(row=>row.active!==false&&row.storage_type==="MT").map(row=>row.code);

  const latestSession=(rows)=>rows.slice().sort((a,b)=>{
    const activeDelta=(b.status==="ACTIVE"?1:0)-(a.status==="ACTIVE"?1:0);
    if(activeDelta)return activeDelta;
    return String(b.created_at||"").localeCompare(String(a.created_at||""));
  })[0]||null;

  const assignments=[{
    key:"PIC_TRANSFER",
    title:"PIC TRANSFER",
    subtitle:"Tanggung jawab semua MT aktif",
    required:activeMT,
    session:latestSession(sessions.filter(row=>(row.duty_type||"FUELMAN")==="PIC_TRANSFER"))
  },...activeFT.map(ft=>({
    key:ft.code,
    title:ft.code,
    subtitle:"FUELMAN • "+(window.KPPStorage.whCode(ft)||"FT"),
    required:[ft.code],
    session:latestSession(sessions.filter(row=>(row.duty_type||"FUELMAN")==="FUELMAN"&&String(row.fuel_truck||"").toUpperCase()===ft.code))
  }))];

  let assignedCount=0;
  const cards=assignments.map(item=>{
    const session=item.session;
    if(session)assignedCount++;
    const closedSet=new Set(
      closings
        .filter(row=>session&&row.session_id===session.id&&row.fuelman_user_id===session.user_id)
        .map(row=>String(row.storage||"").toUpperCase())
    );
    const closed=item.required.filter(code=>closedSet.has(code));
    const missing=item.required.filter(code=>!closedSet.has(code));
    const total=item.required.length;
    const progress=total?Math.round((closed.length/total)*100):0;

    let state="missing",statusText="BELUM CHECK-IN";
    if(session){
      if(!total){state="anomaly";statusText="MASTER BELUM LENGKAP";}
      else if(!missing.length&&session.status==="ENDED"){state="done";statusText="SELESAI";}
      else if(!missing.length){state="ready";statusText="SIAP END SHIFT";}
      else if(session.status==="ENDED"){state="anomaly";statusText="CEK DATA CLOSING";}
      else{state="pending";statusText="CLOSING BELUM";}
    }

    const person=session?(session.fuelman_name||session.username||"-"):"Belum ada petugas";
    const start=session&&session.jam_mulai?String(session.jam_mulai).slice(0,8):"-";
    const end=session&&session.jam_selesai?String(session.jam_selesai).slice(0,8):"-";
    const requiredText=item.required.length?item.required.join(", "):"Tidak ada storage aktif";
    const missingText=!session
      ?"Menunggu check-in petugas."
      :(!total?"Periksa Master MT/FT.":(missing.length?"Belum Closing: "+missing.join(", "):"Closing tanggung jawab sudah lengkap."));

    return `<div class="session-card monitor-${state}">
      <div class="name">
        <div><div class="name-main">${escapeHtml(person)}</div><div class="duty-label">${escapeHtml(item.title)} • ${escapeHtml(item.subtitle)}</div></div>
        <span class="session-status-badge ${state}">${statusText}</span>
      </div>
      <div class="meta">
        Wajib Closing: ${escapeHtml(requiredText)}<br>
        Mulai: ${escapeHtml(start)}${session&&session.status==="ENDED"?` • Selesai: ${escapeHtml(end)}`:""}
      </div>
      <div class="session-progress"><span style="width:${progress}%"></span></div>
      <div class="meta">Closing ${closed.length}/${total}</div>
      <div class="session-missing">${escapeHtml(missingText)}</div>
    </div>`;
  });

  countEl.textContent=`${assignedCount}/${assignments.length}`;
  host.innerHTML=cards.length?cards.join(""):'<div class="session-empty">Belum ada storage aktif untuk dimonitor.</div>';
}'''

if 'function escapeHtml(value)' not in text:
    insert='''\nfunction escapeHtml(value){\n  return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));\n}\n'''
    text=text.replace('function cell(t){const x=document.createElement("td");x.textContent=t;return x}\n', 'function cell(t){const x=document.createElement("td");x.textContent=t;return x}\n'+insert,1)

pattern=r'async function loadActiveSessions\(\)\{.*?\n\}\n\nfunction renderLatest'
updated,n=re.subn(pattern,new_func+'\n\nfunction renderLatest',text,count=1,flags=re.S)
if n!=1:
    raise SystemExit(f'loadActiveSessions replacement count={n}')
dash.write_text(updated,encoding='utf-8')

# Regression test.
test_path=root/'scripts/test-dashboard-duty-monitor.mjs'
test_path.write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst dashboard=fs.readFileSync(new URL("../dashboard.html",import.meta.url),"utf8");\n\ntest("dashboard monitors current operational duty assignments",()=>{\n  assert.match(dashboard,/Monitoring Petugas Shift/);\n  assert.match(dashboard,/sessionPeriodLabel/);\n  assert.match(dashboard,/\.eq\("tanggal",tanggal\)/);\n  assert.match(dashboard,/\.eq\("shift",shiftLabel\)/);\n  assert.match(dashboard,/duty_type/);\n  assert.match(dashboard,/PIC_TRANSFER/);\n  assert.match(dashboard,/storage_type==="FT"/);\n  assert.match(dashboard,/storage_type==="MT"/);\n});\n\ntest("closing progress is bound to the accountable session and user",()=>{\n  assert.match(dashboard,/row\.session_id===session\.id/);\n  assert.match(dashboard,/row\.fuelman_user_id===session\.user_id/);\n  assert.match(dashboard,/SIAP END SHIFT/);\n  assert.match(dashboard,/CLOSING BELUM/);\n  assert.match(dashboard,/BELUM CHECK-IN/);\n  assert.match(dashboard,/SELESAI/);\n});\n\ntest("monitor dynamically follows active Master MT and FT",()=>{\n  assert.match(dashboard,/STORAGE_ROWS\.filter\(row=>row\.active!==false&&row\.storage_type==="FT"\)/);\n  assert.match(dashboard,/STORAGE_ROWS\.filter\(row=>row\.active!==false&&row\.storage_type==="MT"\)/);\n  assert.match(dashboard,/Wajib Closing/);\n  assert.match(dashboard,/Closing \$\{closed\.length\}\/\$\{total\}/);\n});\n''',encoding='utf-8')

pkg_path=root/'package.json'
pkg=json.loads(pkg_path.read_text(encoding='utf-8'))
check=pkg['scripts']['check']
needle='scripts/test-stock-mobile-cleanup-v2.mjs'
if 'scripts/test-dashboard-duty-monitor.mjs' not in check:
    check=check.replace(needle,needle+' scripts/test-dashboard-duty-monitor.mjs')
pkg['scripts']['check']=check
pkg_path.write_text(json.dumps(pkg,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

# Remove temporary machinery before the final commit.
for rel in ['scripts/tmp_patch_dashboard_duty_monitor.py','.github/workflows/tmp-dashboard-duty-monitor.yml']:
    p=root/rel
    if p.exists(): p.unlink()
