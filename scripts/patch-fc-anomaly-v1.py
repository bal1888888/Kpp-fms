from pathlib import Path
import re

ROOT = Path('.')
fc = ROOT / 'fc-chart.js'
src = fc.read_text(encoding='utf-8')
orig = src

def replace_once(old, new, label):
    global src
    count = src.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, got {count}')
    src = src.replace(old, new, 1)

# 1) Helpers for a loose physical sanity limit on hour-meter growth.
replace_once(
"  function shortDate(value){const p=String(value).split(\"-\");return p.length===3?`${p[2]}/${p[1]}`:value;}\n",
"  function shortDate(value){const p=String(value).split(\"-\");return p.length===3?`${p[2]}/${p[1]}`:value;}\n"
"  function dayDiff(start,end){const a=String(start||'').split('-').map(Number),b=String(end||'').split('-').map(Number);if(a.length!==3||b.length!==3||a.some(v=>!Number.isFinite(v))||b.some(v=>!Number.isFinite(v)))return 0;return Math.max(0,Math.round((Date.UTC(b[0],b[1]-1,b[2])-Date.UTC(a[0],a[1]-1,a[2]))/86400000));}\n"
"  function maxPlausibleHmDelta(previousDate,currentDate){return Math.max(24,(dayDiff(previousDate,currentDate)+1)*24);}\n",
'helper insert')

# 2) Stronger visual hierarchy + anomaly panel/detail row states.
replace_once(
"      .kpp-fc-summary-card{margin-top:10px;border:1px solid #e2e8f0;border-radius:11px;background:#fff;overflow:hidden}",
"      .kpp-fc-summary-card{margin:0 0 10px;border:1px solid #93c5fd;border-radius:12px;background:linear-gradient(180deg,#f8fbff 0,#fff 42%);overflow:hidden;box-shadow:0 8px 22px rgba(37,99,235,.08)}",
'summary prominence')
replace_once(
"      .kpp-fc-summary-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 11px;border-bottom:1px solid #edf1f6}.kpp-fc-summary-head strong{font-size:11px}.kpp-fc-summary-head span{font-size:8.5px;color:#64748b}",
"      .kpp-fc-summary-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:11px 12px;border-bottom:1px solid #dbeafe;background:#eff6ff}.kpp-fc-summary-head strong{font-size:12px;color:#1d4ed8}.kpp-fc-summary-head span{font-size:8.5px;color:#475569}.kpp-fc-summary-issues{font-weight:900;color:#b45309}",
'summary head prominence')
replace_once(
"      .kpp-fc-detail-table tbody tr:nth-child(even){background:#f8fafc}.kpp-fc-detail-fc{font-weight:900;color:#1d4ed8}.kpp-fc-detail-qty{font-weight:900}.kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}",
"      .kpp-fc-detail-table tbody tr:nth-child(even){background:#f8fafc}.kpp-fc-detail-table tbody tr.issue{background:#fff7ed}.kpp-fc-detail-fc{font-weight:900;color:#1d4ed8}.kpp-fc-detail-qty{font-weight:900}.kpp-fc-badge{display:inline-flex;align-items:center;padding:4px 7px;border-radius:999px;font-size:8px;font-weight:900;white-space:nowrap}.kpp-fc-badge.valid{background:#dcfce7;color:#166534}.kpp-fc-badge.issue{background:#ffedd5;color:#9a3412}.kpp-fc-issues{margin:0 0 10px;border:1px solid #fdba74;border-radius:11px;background:#fff7ed;overflow:hidden}.kpp-fc-issues[hidden]{display:none!important}.kpp-fc-issues-head{display:flex;justify-content:space-between;gap:10px;padding:10px 11px;background:#ffedd5;border-bottom:1px solid #fed7aa;color:#9a3412}.kpp-fc-issues-head strong{font-size:10px}.kpp-fc-issues-head span{font-size:8.5px}.kpp-fc-issues-list{display:grid;gap:6px;padding:8px}.kpp-fc-issue-row{display:grid;grid-template-columns:minmax(70px,.7fr) minmax(72px,.8fr) minmax(80px,.8fr) 1.7fr;gap:8px;align-items:center;border:1px solid #fed7aa;border-radius:9px;background:#fff;padding:8px 9px;cursor:pointer}.kpp-fc-issue-row:hover{border-color:#fb923c;background:#fffaf5}.kpp-fc-issue-row b{font-size:9px;color:#9a3412}.kpp-fc-issue-row span{font-size:8.5px;color:#475569}.kpp-fc-legend-item[data-unit]{cursor:pointer;padding:3px 5px;border-radius:7px}.kpp-fc-legend-item[data-unit]:hover{background:#eff6ff}.kpp-fc-chart [data-unit]{cursor:pointer}.kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}",
'issue styles')
replace_once(
"      @media(max-width:760px){.kpp-fc-head{padding:12px;align-items:flex-start}",
"      @media(max-width:760px){.kpp-fc-issue-row{grid-template-columns:1fr 1fr}.kpp-fc-issue-row span:last-child{grid-column:1/-1}.kpp-fc-head{padding:12px;align-items:flex-start}",
'mobile issue layout')

# 3) Replace metric engine: reject physically impossible positive HM jumps from FC,
#    preserve fuel transaction visibility, and keep the prior sane baseline.
pattern = re.compile(r"  function buildMetrics\(rows,baselines,units,start,end\)\{.*?\n  \}\n\n  function renderSummary", re.S)
replacement = r'''  function buildMetrics(rows,baselines,units,start,end){
    const perUnit=new Map(units.map(unit=>[unit,{unit,totalFuel:0,validFuel:0,hm:0,samples:0,transactions:0,daily:new Map(),details:[]}]))
    rows.forEach(row=>{const unit=String(row.unit||"").trim().toUpperCase();if(perUnit.has(unit)){const entry=perUnit.get(unit);entry.totalFuel+=num(row.fuel);entry.transactions+=1;}});
    units.forEach(unit=>{
      const entry=perUnit.get(unit);const unitRows=rows.filter(row=>String(row.unit||"").trim().toUpperCase()===unit).sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal))||num(a.id)-num(b.id));
      const base=baselines.get(unit);let previous=base&&Number.isFinite(Number(base.hm_akhir))?Number(base.hm_akhir):null;let previousDate=base?.tanggal||null;
      unitRows.forEach(row=>{
        const fuel=num(row.fuel);const hmRaw=row.hm_akhir;const hm=hmRaw===null||hmRaw===undefined||hmRaw===""?null:Number(hmRaw);const previousHm=Number.isFinite(previous)?previous:null;let delta=null;let rawDelta=null;let issueReason='';
        if(!Number.isFinite(hm))issueReason='HM akhir kosong';
        else if(!Number.isFinite(previous)){issueReason='Belum ada HM pembanding';previous=hm;previousDate=row.tanggal;}
        else{
          rawDelta=hm-previous;
          if(rawDelta<0)issueReason='HM turun dari referensi sebelumnya';
          else if(rawDelta===0)issueReason='HM tidak berubah dari referensi sebelumnya';
          else{
            const maxDelta=maxPlausibleHmDelta(previousDate,row.tanggal);
            if(rawDelta>maxDelta)issueReason=`Lonjakan HM ${fmt(rawDelta)} HM melebihi batas fisik longgar ${fmt(maxDelta)} HM`;
            else{delta=rawDelta;previous=hm;previousDate=row.tanggal;}
          }
        }
        const validDelta=Number.isFinite(delta)&&delta>0?delta:null;
        if(validDelta!==null){entry.hm+=validDelta;entry.validFuel+=fuel;entry.samples+=1;const day=entry.daily.get(row.tanggal)||{fuel:0,hm:0};day.fuel+=fuel;day.hm+=validDelta;entry.daily.set(row.tanggal,day);}
        entry.details.push({...row,unit,hm_previous:previousHm,hm_raw_delta:rawDelta,hm_delta:validDelta,fc:validDelta!==null?fuel/validDelta:null,fc_issue:validDelta===null&&fuel>0?issueReason:'',fc_status:validDelta!==null?'VALID':'CHECK'});
      });
    });
    const dates=dateList(start,end);const series=units.map((unit,index)=>{const entry=perUnit.get(unit);return {unit,color:COLORS[index%COLORS.length],values:dates.map(date=>{const d=entry.daily.get(date);return d&&d.hm>0?d.fuel/d.hm:null;})};});
    const list=Array.from(perUnit.values());const totalFuel=list.reduce((sum,x)=>sum+x.totalFuel,0);const validFuel=list.reduce((sum,x)=>sum+x.validFuel,0);const totalHm=list.reduce((sum,x)=>sum+x.hm,0);const samples=list.reduce((sum,x)=>sum+x.samples,0);const transactions=list.reduce((sum,x)=>sum+x.transactions,0);const coverage=transactions>0?(samples/transactions)*100:0;
    const summaries=units.map(unit=>{const x=perUnit.get(unit);const issues=x.details.filter(row=>row.fc===null&&num(row.fuel)>0).length;return {unit,totalFuel:x.totalFuel,validFuel:x.validFuel,hm:x.hm,samples:x.samples,transactions:x.transactions,coverage:x.transactions>0?(x.samples/x.transactions)*100:0,fc:x.hm>0?x.validFuel/x.hm:null,issues};});
    const details=list.flatMap(x=>x.details);const issues=details.filter(row=>row.fc===null&&num(row.fuel)>0).length;
    return {dates,series,totalFuel,validFuel,totalHm,samples,transactions,coverage,summaries,details,issues,avg:totalHm>0?validFuel/totalHm:null};
  }

  function renderSummary'''
src, n = pattern.subn(replacement, src, count=1)
if n != 1:
    raise SystemExit(f'buildMetrics replace: expected 1, got {n}')

# 4) Summary + focus metric issues.
pattern = re.compile(r"  function renderSummary\(host,metrics,focusUnit=\"\"\)\{.*?\n  \}\n\n  function focusMetrics", re.S)
replacement = r'''  function renderSummary(host,metrics,focusUnit=""){
    const rows=focusUnit?metrics.summaries.filter(item=>item.unit===focusUnit):metrics.summaries;
    host.innerHTML=rows.map(item=>{const coverageClass=item.coverage>=80?'good':item.coverage>=50?'mid':'low';return `<tr data-unit="${esc(item.unit)}" class="${focusUnit===item.unit?'focused':''}" title="Klik untuk fokus ke ${esc(item.unit)}"><td class="kpp-fc-summary-unit">${esc(item.unit)}</td><td class="kpp-fc-summary-fc">${item.fc===null?'-':fmtFc(item.fc)+' L/HM'}</td><td>${fmt(item.totalFuel)} L</td><td>${fmt(item.hm)} HM</td><td>${item.samples} / ${item.transactions}</td><td class="kpp-fc-summary-coverage ${coverageClass}">${fmtFc(item.coverage)}%</td><td class="kpp-fc-summary-issues">${item.issues||0}</td></tr>`;}).join('')||'<tr><td colspan="7">Belum ada unit dipilih.</td></tr>';
  }

  function focusMetrics'''
src, n = pattern.subn(replacement, src, count=1)
if n != 1:
    raise SystemExit(f'renderSummary replace: expected 1, got {n}')
replace_once(
"    return {...metrics,series:metrics.series.filter(item=>item.unit===unit),summaries:[summary],totalFuel:summary.totalFuel,validFuel:summary.validFuel,totalHm:summary.hm,samples:summary.samples,transactions:summary.transactions,coverage:summary.coverage,avg:summary.fc};",
"    return {...metrics,series:metrics.series.filter(item=>item.unit===unit),summaries:[summary],totalFuel:summary.totalFuel,validFuel:summary.validFuel,totalHm:summary.hm,samples:summary.samples,transactions:summary.transactions,coverage:summary.coverage,issues:summary.issues||0,avg:summary.fc};",
'focus issues')

# 5) Detail rows show invalid FC loudly instead of looking like zero/missing data.
pattern = re.compile(r"  function renderDetail\(host,metrics,unit\)\{.*?\n  \}\n\n  function renderInsight", re.S)
replacement = r'''  function renderDetail(host,metrics,unit){
    const rows=metrics.details.filter(row=>row.unit===unit);
    host.innerHTML=rows.map((row,index)=>`<tr class="${row.fc===null&&num(row.fuel)>0?'issue':''}"><td>${index+1}</td><td>${esc(displayDate(row.tanggal))}</td><td>${esc(row.jam?String(row.jam).slice(0,8):'-')}</td><td>${esc(row.shift??'-')}</td><td>${esc(row.wh||'-')}</td><td>${esc(row.fuel_truck||'-')}</td><td><b>${esc(row.unit)}</b></td><td>${row.hm_akhir===null||row.hm_akhir===undefined||row.hm_akhir===''?'-':fmt(row.hm_akhir)}</td><td>${row.hm_delta===null?'-':fmt(row.hm_delta)}</td><td class="kpp-fc-detail-qty">${fmt(row.fuel)} L</td><td class="kpp-fc-detail-fc">${row.fc===null?'-':fmtFc(row.fc)+' L/HM'}</td><td><span class="kpp-fc-badge ${row.fc===null?'issue':'valid'}" title="${esc(row.fc_issue||'FC valid')}">${row.fc===null?'PERLU CEK':'VALID'}</span></td><td>${esc(row.operator||'-')}</td><td>${esc(row.fuelman_name||'-')}</td></tr>`).join('')||'<tr><td colspan="14">Belum ada transaksi pada periode ini.</td></tr>';
  }

  function renderIssues(host,metrics,focusUnit=""){
    const rows=metrics.details.filter(row=>(!focusUnit||row.unit===focusUnit)&&row.fc===null&&num(row.fuel)>0);
    if(!rows.length){host.hidden=true;host.innerHTML='';return;}
    const shown=rows.slice(0,8);host.hidden=false;host.innerHTML=`<div class="kpp-fc-issues-head"><strong>⚠ ${rows.length} TRANSAKSI PENGISIAN PERLU CEK HM</strong><span>Fuel tetap dihitung ke total, tetapi transaksi ini tidak dipakai menghitung FC.</span></div><div class="kpp-fc-issues-list">${shown.map(row=>`<div class="kpp-fc-issue-row" data-unit="${esc(row.unit)}" title="Klik untuk fokus ke ${esc(row.unit)}"><b>${esc(row.unit)}</b><span>${esc(shortDate(row.tanggal))}</span><span><strong>${fmt(row.fuel)} L</strong> • HM ${row.hm_akhir===null||row.hm_akhir===undefined||row.hm_akhir===''?'-':fmt(row.hm_akhir)}</span><span>${esc(row.fc_issue||'HM belum membentuk FC valid')}</span></div>`).join('')}${rows.length>shown.length?`<div class="kpp-fc-note">+ ${rows.length-shown.length} transaksi lain. Fokus satu unit untuk mempersempit daftar.</div>`:''}</div>`;
  }

  function renderInsight'''
src, n = pattern.subn(replacement, src, count=1)
if n != 1:
    raise SystemExit(f'renderDetail replace: expected 1, got {n}')

# 6) Break lines across missing dates. Do not visually bridge data gaps.
pattern = re.compile(r"  function renderSvg\(host,metrics\)\{.*?\n  \}\n\n  function mount", re.S)
replacement = r'''  function renderSvg(host,metrics){
    const {dates,series}=metrics;const values=series.flatMap(s=>s.values.filter(Number.isFinite));
    if(!values.length){host.innerHTML='<div class="kpp-fc-empty">Belum ada pasangan HM berurutan yang valid untuk unit dan periode ini.</div>';return;}
    const W=Math.max(900,Math.min(3200,90+(dates.length*18))),H=300,L=48,R=16,T=18,B=38;const plotW=W-L-R,plotH=H-T-B;const max=Math.max(...values);const yMax=Math.max(5,Math.ceil((max*1.15)/5)*5);const x=i=>L+(dates.length<=1?plotW/2:(i/(dates.length-1))*plotW);const y=v=>T+plotH-(v/yMax)*plotH;
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik trend FC per unit">`;
    for(let i=0;i<=4;i++){const val=(yMax/4)*i;const yy=y(val);svg+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e2e8f0" stroke-width="1"/><text x="${L-8}" y="${yy+3}" text-anchor="end" font-size="9" fill="#64748b">${fmtFc(val)}</text>`;}
    const tickStep=Math.max(1,Math.ceil(dates.length/7));dates.forEach((date,i)=>{if(i%tickStep===0||i===dates.length-1)svg+=`<text x="${x(i)}" y="${H-12}" text-anchor="middle" font-size="8.5" fill="#64748b">${esc(shortDate(date))}</text>`;});
    series.forEach(s=>{let segment=[];const flush=()=>{if(segment.length>1)svg+=`<polyline data-unit="${esc(s.unit)}" points="${segment.join(' ')}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;segment=[];};s.values.forEach((v,i)=>{if(Number.isFinite(v))segment.push(`${x(i)},${y(v)}`);else flush();});flush();s.values.forEach((v,i)=>{if(Number.isFinite(v))svg+=`<circle data-unit="${esc(s.unit)}" cx="${x(i)}" cy="${y(v)}" r="3.3" fill="#fff" stroke="${s.color}" stroke-width="2"><title>${esc(s.unit)} ${esc(shortDate(dates[i]))}: ${fmtFc(v)} L/HM</title></circle>`;});});
    svg+=`<text x="${W/2}" y="${H-1}" text-anchor="middle" font-size="9" fill="#475569">Tanggal</text><text transform="translate(12 ${H/2}) rotate(-90)" text-anchor="middle" font-size="9" fill="#475569">FC (L/HM)</text></svg>`;host.innerHTML=svg;
  }

  function mount'''
src, n = pattern.subn(replacement, src, count=1)
if n != 1:
    raise SystemExit(f'renderSvg replace: expected 1, got {n}')

# 7) Reorder the summary above the chart and add anomaly callout.
focus_marker = '<div class="kpp-fc-focusbar">'
chart_marker = '<div class="kpp-fc-chart-card">'
summary_marker = '<div class="kpp-fc-summary-card">'
detail_marker = '<div class="kpp-fc-detail-card">'
fi, ci, si, di = (src.index(focus_marker), src.index(chart_marker), src.index(summary_marker), src.index(detail_marker))
if not (fi < ci < si < di):
    raise SystemExit('unexpected FC block order')
focus_block = src[fi:ci]
chart_block = src[ci:si]
summary_block = src[si:di]
summary_block = summary_block.replace('<th>COVERAGE HM</th></tr>', '<th>COVERAGE HM</th><th>PERLU CEK</th></tr>')
summary_block = summary_block.replace('colspan="6"', 'colspan="7"')
issue_block = '<div class="kpp-fc-issues" data-fc-issues hidden></div>'
src = src[:fi] + summary_block + issue_block + focus_block + chart_block + src[di:]
replace_once('<th>FC</th><th>OPERATOR</th>', '<th>FC</th><th>STATUS FC</th><th>OPERATOR</th>', 'detail status header')

# 8) Wire anomaly host + clickable legend/chart/anomaly rows.
replace_once(
"rangeButtons=Array.from(host.querySelectorAll('.kpp-fc-range-btn')),summaryBody=host.querySelector('.kpp-fc-summary-body'),focusBar=host.querySelector('.kpp-fc-focusbar')",
"rangeButtons=Array.from(host.querySelectorAll('.kpp-fc-range-btn')),summaryBody=host.querySelector('.kpp-fc-summary-body'),issuesHost=host.querySelector('[data-fc-issues]'),focusBar=host.querySelector('.kpp-fc-focusbar')",
'issues host binding')

pattern = re.compile(r"    const updateToggle=\(\)=>\{.*?updateToggle\(\);updateRangeButtons\(\);", re.S)
replacement = r'''    const updateToggle=()=>{if(toggle)toggle.textContent=collapsed?'Tampilkan Grafik FC':'Sembunyikan Grafik FC';};
    const updateRangeButtons=()=>{rangeButtons.forEach(btn=>btn.classList.toggle('active',btn.dataset.range===activeRange));};
    const clearFocus=()=>{focusedUnit='';};
    const setRange=(mode,startValue,endValue)=>{activeRange=mode;clearFocus();startInput.value=startValue;endInput.value=endValue;updateRangeButtons();};
    const renderCurrentView=()=>{if(!lastMetrics)return;const view=focusMetrics(lastMetrics,focusedUnit);host.querySelector('[data-kpi="avg"]').textContent=view.avg===null?'-':fmtFc(view.avg)+' L/HM';host.querySelector('[data-kpi="fuel"]').textContent=fmt(view.totalFuel)+' L';host.querySelector('[data-kpi="hm"]').textContent=fmt(view.totalHm)+' HM';host.querySelector('[data-kpi="count"]').textContent=`${view.samples}/${view.transactions} • ${fmtFc(view.coverage)}%`;legend.innerHTML=view.series.map(item=>`<span class="kpp-fc-legend-item" data-unit="${esc(item.unit)}"><i class="kpp-fc-dot" style="background:${item.color}"></i>${esc(item.unit)}</span>`).join('');renderSvg(host.querySelector('.kpp-fc-chart'),view);renderSummary(summaryBody,lastMetrics,focusedUnit);renderIssues(issuesHost,lastMetrics,focusedUnit);renderInsight(insight,view,startInput.value,endInput.value,mtdBounds);focusBar.classList.toggle('active',!!focusedUnit);detailCard.classList.toggle('active',!!focusedUnit);chartTitle.textContent=focusedUnit?`Trend FC Harian ${focusedUnit} (L/HM)`:'Trend FC Harian per Unit (L/HM)';if(focusedUnit){focusLabel.textContent=`FOKUS UNIT ${focusedUnit}`;detailTitle.textContent=`Detail Transaksi ${focusedUnit}`;renderDetail(detailBody,lastMetrics,focusedUnit);}else{detailBody.innerHTML='';}};
    const focusUnit=(unit)=>{if(!lastMetrics||!unit)return;focusedUnit=unit;renderCurrentView();status.className='kpp-fc-status';status.textContent=`Fokus ${focusedUnit}: unit lain disembunyikan. Klik TAMPILKAN SEMUA UNIT untuk kembali.`;};
    updateToggle();updateRangeButtons();'''
src, n = pattern.subn(replacement, src, count=1)
if n != 1:
    raise SystemExit(f'renderCurrentView replace: expected 1, got {n}')

replace_once(
"status.textContent=`${lastMetrics.samples} sampel HM valid dari ${lastMetrics.transactions} transaksi • ${selected.length} unit dipilih • ${lastMetrics.dates.length} hari. Klik baris unit untuk fokus.`;",
"status.textContent=`${lastMetrics.samples} sampel HM valid dari ${lastMetrics.transactions} transaksi • ${lastMetrics.issues} perlu cek • ${selected.length} unit dipilih • ${lastMetrics.dates.length} hari. Klik ringkasan, legend, grafik, atau peringatan untuk fokus.`;",
'load status issues')

old_events = "document.addEventListener('click',event=>{if(!event.target.closest('.kpp-fc-unit-picker'))menu.hidden=true;});run.addEventListener('click',load);summaryBody.addEventListener('click',event=>{const row=event.target.closest('tr[data-unit]');if(!row||!lastMetrics)return;focusedUnit=row.dataset.unit||'';renderCurrentView();status.className='kpp-fc-status';status.textContent=`Fokus ${focusedUnit}: unit lain disembunyikan. Klik TAMPILKAN SEMUA UNIT untuk kembali.`;});focusReset.addEventListener('click',()=>{clearFocus();renderCurrentView();status.className='kpp-fc-status';status.textContent=`Kembali menampilkan ${selected.length} unit terpilih.`;});"
new_events = "document.addEventListener('click',event=>{if(!event.target.closest('.kpp-fc-unit-picker'))menu.hidden=true;});run.addEventListener('click',load);summaryBody.addEventListener('click',event=>{const row=event.target.closest('tr[data-unit]');if(row)focusUnit(row.dataset.unit||'');});legend.addEventListener('click',event=>{const item=event.target.closest('[data-unit]');if(item)focusUnit(item.dataset.unit||'');});host.querySelector('.kpp-fc-chart').addEventListener('click',event=>{const item=event.target.closest('[data-unit]');if(item)focusUnit(item.dataset.unit||'');});issuesHost.addEventListener('click',event=>{const item=event.target.closest('[data-unit]');if(item)focusUnit(item.dataset.unit||'');});focusReset.addEventListener('click',()=>{clearFocus();renderCurrentView();status.className='kpp-fc-status';status.textContent=`Kembali menampilkan ${selected.length} unit terpilih.`;});"
replace_once(old_events, new_events, 'focus events')

# 9) Cache-bust both consumers.
for name in ['dashboard.html','logsheet.html']:
    p = ROOT / name
    text = p.read_text(encoding='utf-8')
    if 'fc-chart.js?v=20260912g' not in text:
        raise SystemExit(f'{name}: expected old FC asset version')
    p.write_text(text.replace('fc-chart.js?v=20260912g','fc-chart.js?v=20260912h'), encoding='utf-8')

# 10) Existing regression expects the old cache token.
test_focus = ROOT / 'scripts/test-fc-focus-table.mjs'
t = test_focus.read_text(encoding='utf-8')
t = t.replace('fc-chart\\.js\\?v=20260912g','fc-chart\\.js\\?v=20260912h')
test_focus.write_text(t, encoding='utf-8')

# 11) Add regression focused on the real DT7443-style failure mode and graph gaps.
new_test = ROOT / 'scripts/test-fc-anomaly-visibility.mjs'
new_test.write_text("""import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst src=fs.readFileSync('fc-chart.js','utf8');\n\ntest('implausible positive HM jumps are excluded from FC but remain visible',()=>{\n  assert.match(src,/maxPlausibleHmDelta/);\n  assert.match(src,/rawDelta>maxDelta/);\n  assert.match(src,/Lonjakan HM/);\n  assert.match(src,/TRANSAKSI PENGISIAN PERLU CEK HM/);\n  assert.match(src,/Fuel tetap dihitung ke total/);\n});\n\ntest('FC summary is prominent and placed before the chart',()=>{\n  assert.ok(src.indexOf('kpp-fc-summary-card') < src.indexOf('kpp-fc-chart-card'));\n  assert.match(src,/PERLU CEK/);\n  assert.match(src,/data-fc-issues/);\n});\n\ntest('missing dates break the SVG line instead of drawing fake continuity',()=>{\n  assert.match(src,/let segment=\[\]/);\n  assert.match(src,/else flush\(\)/);\n  assert.match(src,/polyline data-unit=/);\n});\n\ntest('focus works from legend, chart and anomaly list',()=>{\n  assert.match(src,/legend\.addEventListener\('click'/);\n  assert.match(src,/kpp-fc-chart'\)\.addEventListener\('click'/);\n  assert.match(src,/issuesHost\.addEventListener\('click'/);\n});\n\nfor(const file of ['dashboard.html','logsheet.html']){\n  test(`${file} cache-busts the FC anomaly runtime`,()=>{\n    const html=fs.readFileSync(file,'utf8');\n    assert.match(html,/fc-chart\\.js\\?v=20260912h/);\n  });\n}\n""", encoding='utf-8')

if src == orig:
    raise SystemExit('fc-chart.js unchanged')
fc.write_text(src, encoding='utf-8')
print('FC anomaly visibility patch applied')
