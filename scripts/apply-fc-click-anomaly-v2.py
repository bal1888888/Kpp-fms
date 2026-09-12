from pathlib import Path
import re

path = Path('fc-chart.js')
s = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global s
    if old not in s:
        raise SystemExit(f'missing anchor: {label}')
    s = s.replace(old, new, 1)

replace_once(
    '  function shortDate(value){const p=String(value).split("-");return p.length===3?`${p[2]}/${p[1]}`:value;}\n',
    '  function shortDate(value){const p=String(value).split("-");return p.length===3?`${p[2]}/${p[1]}`:value;}\n'
    '  function dateGapDays(start,end){const a=Date.parse(`${start}T00:00:00Z`),b=Date.parse(`${end}T00:00:00Z`);return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,Math.round((b-a)/86400000)):null;}\n'
    '  function maxPhysicalHmDelta(previousDate,currentDate){const gap=dateGapDays(previousDate,currentDate);return gap===null?null:Math.max(24,(gap+1)*24);}\n',
    'date helpers'
)

replace_once(
    '      .kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}\n',
    '      .kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}\n'
    '      .kpp-fc-summary-card{margin:12px 0 10px;border:2px solid #2563eb;box-shadow:0 10px 26px rgba(37,99,235,.12)}.kpp-fc-summary-head{background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff}.kpp-fc-summary-head strong{color:#fff;font-size:12px}.kpp-fc-summary-head span{color:#dbeafe;font-weight:800}.kpp-fc-summary-table tbody tr[data-unit]{border-left:4px solid transparent}.kpp-fc-summary-table tbody tr[data-unit]:hover{background:#eff6ff;border-left-color:#60a5fa}.kpp-fc-summary-table tbody tr.focused{background:#dbeafe;border-left-color:#2563eb}.kpp-fc-summary-issue{font-weight:900;color:#b45309}.kpp-fc-summary-issue.has{display:inline-flex;align-items:center;justify-content:center;min-width:24px;padding:3px 7px;border-radius:999px;background:#fff7ed;border:1px solid #fdba74;color:#c2410c}\n'
    '      .kpp-fc-legend-item{border:1px solid #dbeafe;background:#f8fbff;border-radius:999px;padding:5px 8px;cursor:pointer;transition:transform .15s ease,box-shadow .15s ease}.kpp-fc-legend-item:hover{transform:translateY(-1px);box-shadow:0 5px 12px rgba(37,99,235,.12)}.kpp-fc-series-hit,.kpp-fc-series-line,.kpp-fc-series-point,.kpp-fc-issue-marker{cursor:pointer}.kpp-fc-series-line{filter:drop-shadow(0 1px 1px rgba(15,23,42,.12))}\n'
    '      .kpp-fc-issues{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;padding:10px 11px;border:2px solid #f59e0b;border-radius:11px;background:linear-gradient(135deg,#fffbeb,#fff7ed);box-shadow:0 8px 18px rgba(245,158,11,.10)}.kpp-fc-issues[hidden]{display:none!important}.kpp-fc-issues-copy{min-width:190px;flex:1}.kpp-fc-issues-copy strong{display:block;font-size:10px;color:#9a3412;margin-bottom:2px}.kpp-fc-issues-copy span{font-size:8.5px;color:#92400e;line-height:1.35}.kpp-fc-issue-list{display:flex;gap:6px;flex-wrap:wrap}.kpp-fc-issue-chip{border:1px solid #fdba74;background:#fff;color:#9a3412;border-radius:999px;padding:6px 9px;font-size:8.5px;font-weight:900;cursor:pointer}.kpp-fc-issue-chip:hover{background:#ffedd5}.kpp-fc-detail-status{font-weight:900}.kpp-fc-detail-status.good{color:#15803d}.kpp-fc-detail-status.bad{color:#c2410c;background:#fff7ed}\n',
    'FC emphasis styles'
)

build_metrics = r'''  function buildMetrics(rows,baselines,units,start,end){
    const perUnit=new Map(units.map(unit=>[unit,{unit,totalFuel:0,validFuel:0,hm:0,samples:0,transactions:0,daily:new Map(),details:[]}]))
    rows.forEach(row=>{const unit=String(row.unit||"").trim().toUpperCase();if(perUnit.has(unit)){const entry=perUnit.get(unit);entry.totalFuel+=num(row.fuel);entry.transactions+=1;}});
    units.forEach(unit=>{
      const entry=perUnit.get(unit);const unitRows=rows.filter(row=>String(row.unit||"").trim().toUpperCase()===unit).sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal))||num(a.id)-num(b.id));
      const base=baselines.get(unit);let previous=base&&Number.isFinite(Number(base.hm_akhir))?Number(base.hm_akhir):null;let previousDate=base?.tanggal||null;let candidate=null;
      unitRows.forEach(row=>{
        const fuel=num(row.fuel);const hmRaw=row.hm_akhir;const hm=hmRaw===null||hmRaw===undefined||hmRaw===""?null:Number(hmRaw);let delta=null;let issue="";
        if(Number.isFinite(hm)){
          if(candidate&&hm>=candidate.hm){const candidateDelta=hm-candidate.hm;const candidateMax=maxPhysicalHmDelta(candidate.date,row.tanggal);if(candidateDelta>0&&(candidateMax===null||candidateDelta<=candidateMax)){delta=candidateDelta;previous=hm;previousDate=row.tanggal;candidate=null;}}
          if(delta===null){
            if(!Number.isFinite(previous)){previous=hm;previousDate=row.tanggal;issue="HM BELUM PUNYA BASELINE";}
            else if(hm>previous){const rawDelta=hm-previous;const physicalMax=maxPhysicalHmDelta(previousDate,row.tanggal);if(physicalMax!==null&&rawDelta>physicalMax){issue="HM ANOMALI";candidate={hm,date:row.tanggal};}else{delta=rawDelta;previous=hm;previousDate=row.tanggal;candidate=null;}}
            else if(hm<previous){issue="HM TURUN/RESET";candidate={hm,date:row.tanggal};}
            else issue="HM TIDAK BERUBAH";
          }
        }else issue="HM KOSONG";
        const validDelta=Number.isFinite(delta)&&delta>0?delta:null;
        if(validDelta!==null){entry.hm+=validDelta;entry.validFuel+=fuel;entry.samples+=1;const day=entry.daily.get(row.tanggal)||{fuel:0,hm:0};day.fuel+=fuel;day.hm+=validDelta;entry.daily.set(row.tanggal,day);}
        if(validDelta===null&&fuel>0&&!issue)issue="HM TIDAK VALID";
        entry.details.push({...row,unit,hm_delta:validDelta,fc:validDelta!==null?fuel/validDelta:null,fc_issue:issue});
      });
    });
    const dates=dateList(start,end);const series=units.map((unit,index)=>{const entry=perUnit.get(unit);return {unit,color:COLORS[index%COLORS.length],values:dates.map(date=>{const d=entry.daily.get(date);return d&&d.hm>0?d.fuel/d.hm:null;})};});
    const list=Array.from(perUnit.values());const totalFuel=list.reduce((sum,x)=>sum+x.totalFuel,0);const validFuel=list.reduce((sum,x)=>sum+x.validFuel,0);const totalHm=list.reduce((sum,x)=>sum+x.hm,0);const samples=list.reduce((sum,x)=>sum+x.samples,0);const transactions=list.reduce((sum,x)=>sum+x.transactions,0);const coverage=transactions>0?(samples/transactions)*100:0;
    const summaries=units.map(unit=>{const x=perUnit.get(unit);const invalidCount=x.details.filter(row=>num(row.fuel)>0&&row.fc===null).length;return {unit,totalFuel:x.totalFuel,validFuel:x.validFuel,hm:x.hm,samples:x.samples,transactions:x.transactions,invalidCount,coverage:x.transactions>0?(x.samples/x.transactions)*100:0,fc:x.hm>0?x.validFuel/x.hm:null};});
    const details=list.flatMap(x=>x.details);const invalidEvents=details.filter(row=>num(row.fuel)>0&&row.fc===null);
    return {dates,series,totalFuel,validFuel,totalHm,samples,transactions,coverage,summaries,details,invalidEvents,avg:totalHm>0?validFuel/totalHm:null};
  }
'''
pattern = r'  function buildMetrics\(rows,baselines,units,start,end\)\{.*?\n  \}\n\n  function renderSummary'
s, count = re.subn(pattern, build_metrics + '\n  function renderSummary', s, count=1, flags=re.S)
if count != 1:
    raise SystemExit('failed replacing buildMetrics')

render_summary = r'''  function renderSummary(host,metrics,focusUnit=""){
    const rows=focusUnit?metrics.summaries.filter(item=>item.unit===focusUnit):metrics.summaries;
    host.innerHTML=rows.map(item=>{const coverageClass=item.coverage>=80?'good':item.coverage>=50?'mid':'low';const issueHtml=item.invalidCount?`<span class="kpp-fc-summary-issue has">${item.invalidCount}</span>`:'<span class="kpp-fc-summary-issue">0</span>';return `<tr data-unit="${esc(item.unit)}" class="${focusUnit===item.unit?'focused':''}" title="Klik untuk fokus ke ${esc(item.unit)}"><td class="kpp-fc-summary-unit">${esc(item.unit)}</td><td class="kpp-fc-summary-fc">${item.fc===null?'-':fmtFc(item.fc)+' L/HM'}</td><td>${fmt(item.totalFuel)} L</td><td>${fmt(item.hm)} HM</td><td>${item.samples} / ${item.transactions}</td><td class="kpp-fc-summary-coverage ${coverageClass}">${fmtFc(item.coverage)}%</td><td>${issueHtml}</td></tr>`;}).join('')||'<tr><td colspan="7">Belum ada unit dipilih.</td></tr>';
  }
'''
pattern = r'  function renderSummary\(host,metrics,focusUnit=""\)\{.*?\n  \}\n\n  function focusMetrics'
s, count = re.subn(pattern, render_summary + '\n  function focusMetrics', s, count=1, flags=re.S)
if count != 1:
    raise SystemExit('failed replacing renderSummary')

render_detail = r'''  function displayDate(value){const p=String(value||'').split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:(value||'-');}
  function renderDetail(host,metrics,unit){
    const rows=metrics.details.filter(row=>row.unit===unit);
    host.innerHTML=rows.map((row,index)=>{const status=row.fc_issue||'VALID';const statusClass=row.fc_issue?'bad':'good';return `<tr><td>${index+1}</td><td>${esc(displayDate(row.tanggal))}</td><td>${esc(row.jam?String(row.jam).slice(0,8):'-')}</td><td>${esc(row.shift??'-')}</td><td>${esc(row.wh||'-')}</td><td>${esc(row.fuel_truck||'-')}</td><td><b>${esc(row.unit)}</b></td><td>${row.hm_awal===null||row.hm_awal===undefined||row.hm_awal===''?'-':fmt(row.hm_awal)}</td><td>${row.hm_akhir===null||row.hm_akhir===undefined||row.hm_akhir===''?'-':fmt(row.hm_akhir)}</td><td>${row.hm_delta===null?'-':fmt(row.hm_delta)}</td><td class="kpp-fc-detail-qty">${fmt(row.fuel)} L</td><td class="kpp-fc-detail-fc">${row.fc===null?'-':fmtFc(row.fc)+' L/HM'}</td><td class="kpp-fc-detail-status ${statusClass}">${esc(status)}</td><td>${esc(row.operator||'-')}</td><td>${esc(row.fuelman_name||'-')}</td></tr>`;}).join('')||'<tr><td colspan="15">Belum ada transaksi pada periode ini.</td></tr>';
  }

  function renderIssues(host,metrics,focusUnit=""){
    const issues=(metrics.invalidEvents||[]).filter(row=>!focusUnit||row.unit===focusUnit);
    if(!issues.length){host.hidden=true;host.innerHTML='';return;}
    const grouped=new Map();issues.forEach(row=>{const current=grouped.get(row.unit)||{unit:row.unit,count:0,fuel:0,reasons:new Set()};current.count+=1;current.fuel+=num(row.fuel);if(row.fc_issue)current.reasons.add(row.fc_issue);grouped.set(row.unit,current);});
    host.hidden=false;
    host.innerHTML=`<div class="kpp-fc-issues-copy"><strong>⚠ PENGISIAN ADA, FC BELUM VALID</strong><span>HM kosong, turun/reset, atau anomali tidak lagi digambar sebagai 0 L/HM. Klik unit untuk membuka detailnya.</span></div><div class="kpp-fc-issue-list">${Array.from(grouped.values()).map(item=>`<button type="button" class="kpp-fc-issue-chip" data-fc-unit="${esc(item.unit)}" title="${esc(Array.from(item.reasons).join(', '))}">${esc(item.unit)} • ${item.count}x • ${fmt(item.fuel)} L</button>`).join('')}</div>`;
  }
'''
pattern = r'  function displayDate\(value\).*?\n  function renderDetail\(host,metrics,unit\)\{.*?\n  \}\n\n  function renderInsight'
s, count = re.subn(pattern, render_detail + '\n  function renderInsight', s, count=1, flags=re.S)
if count != 1:
    raise SystemExit('failed replacing detail renderer')

render_svg = r'''  function renderSvg(host,metrics){
    const {dates,series}=metrics;const visibleUnits=new Set(series.map(item=>item.unit));const issues=(metrics.invalidEvents||[]).filter(row=>visibleUnits.has(row.unit));const values=series.flatMap(s=>s.values.filter(Number.isFinite));
    if(!values.length&&!issues.length){host.innerHTML='<div class="kpp-fc-empty">Belum ada pasangan HM berurutan yang valid untuk unit dan periode ini.</div>';return;}
    const W=Math.max(900,Math.min(3200,90+(dates.length*18))),H=300,L=48,R=16,T=18,B=38;const plotW=W-L-R,plotH=H-T-B;const max=values.length?Math.max(...values):5;const yMax=Math.max(5,Math.ceil((max*1.15)/5)*5);const x=i=>L+(dates.length<=1?plotW/2:(i/(dates.length-1))*plotW);const y=v=>T+plotH-(v/yMax)*plotH;
    let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Grafik trend FC per unit, klik garis titik atau penanda isu untuk fokus unit">`;
    for(let i=0;i<=4;i++){const val=(yMax/4)*i;const yy=y(val);svg+=`<line x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}" stroke="#e2e8f0" stroke-width="1"/><text x="${L-8}" y="${yy+3}" text-anchor="end" font-size="9" fill="#64748b">${fmtFc(val)}</text>`;}
    const tickStep=Math.max(1,Math.ceil(dates.length/7));dates.forEach((date,i)=>{if(i%tickStep===0||i===dates.length-1)svg+=`<text x="${x(i)}" y="${H-12}" text-anchor="middle" font-size="8.5" fill="#64748b">${esc(shortDate(date))}</text>`;});
    series.forEach(s=>{const pts=[];s.values.forEach((v,i)=>{if(Number.isFinite(v))pts.push(`${x(i)},${y(v)}`);});if(pts.length>1){svg+=`<polyline class="kpp-fc-series-hit" data-fc-unit="${esc(s.unit)}" points="${pts.join(' ')}" fill="none" stroke="transparent" stroke-width="14" stroke-linejoin="round" stroke-linecap="round"/>`;svg+=`<polyline class="kpp-fc-series-line" data-fc-unit="${esc(s.unit)}" points="${pts.join(' ')}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><title>Klik untuk fokus ${esc(s.unit)}</title></polyline>`;}s.values.forEach((v,i)=>{if(Number.isFinite(v))svg+=`<circle class="kpp-fc-series-point" data-fc-unit="${esc(s.unit)}" cx="${x(i)}" cy="${y(v)}" r="4" fill="#fff" stroke="${s.color}" stroke-width="2.4"><title>${esc(s.unit)} ${esc(shortDate(dates[i]))}: ${fmtFc(v)} L/HM • klik untuk fokus</title></circle>`;});});
    const groupedIssues=new Map();issues.forEach(row=>{const key=`${row.unit}|${row.tanggal}`;const current=groupedIssues.get(key)||{unit:row.unit,date:row.tanggal,count:0,fuel:0,reasons:new Set()};current.count+=1;current.fuel+=num(row.fuel);if(row.fc_issue)current.reasons.add(row.fc_issue);groupedIssues.set(key,current);});
    Array.from(groupedIssues.values()).forEach(item=>{const dateIndex=dates.indexOf(item.date);if(dateIndex<0)return;const unitIndex=Math.max(0,series.findIndex(seriesItem=>seriesItem.unit===item.unit));const xx=x(dateIndex),yy=T+plotH-8-(unitIndex%4)*7;const title=`${item.unit} ${shortDate(item.date)}: ${item.count} pengisian, ${fmt(item.fuel)} L • FC belum valid (${Array.from(item.reasons).join(', ')})`;svg+=`<path class="kpp-fc-issue-marker" data-fc-unit="${esc(item.unit)}" d="M ${xx} ${yy-5} L ${xx+5} ${yy} L ${xx} ${yy+5} L ${xx-5} ${yy} Z" fill="#f59e0b" stroke="#9a3412" stroke-width="1.2"><title>${esc(title)} • klik untuk fokus</title></path>`;});
    svg+=`<text x="${W/2}" y="${H-1}" text-anchor="middle" font-size="9" fill="#475569">Tanggal</text><text transform="translate(12 ${H/2}) rotate(-90)" text-anchor="middle" font-size="9" fill="#475569">FC (L/HM)</text></svg>`;host.innerHTML=svg;
  }
'''
pattern = r'  function renderSvg\(host,metrics\)\{.*?\n  \}\n\n  function mount'
s, count = re.subn(pattern, render_svg + '\n  function mount', s, count=1, flags=re.S)
if count != 1:
    raise SystemExit('failed replacing renderSvg')

replace_once(
    'select("id,tanggal,jam,shift,wh,fuel_truck,unit,operator,fuelman_name,hm_akhir,hm_jalan,fuel")',
    'select("id,tanggal,jam,shift,wh,fuel_truck,unit,operator,fuelman_name,hm_awal,hm_akhir,hm_jalan,fuel")',
    'detail query hm_awal'
)

# Reorder the important interaction summary above the graph, and add the visible issue panel.
template_start = s.index('    host.innerHTML=`<section class="kpp-fc-widget">')
focus_start = s.index('<div class="kpp-fc-focusbar">', template_start)
chart_start = s.index('<div class="kpp-fc-chart-card">', focus_start)
summary_start = s.index('<div class="kpp-fc-summary-card">', chart_start)
detail_start = s.index('<div class="kpp-fc-detail-card">', summary_start)
focus_fragment = s[focus_start:chart_start]
chart_fragment = s[chart_start:summary_start]
summary_fragment = s[summary_start:detail_start]
summary_fragment = summary_fragment.replace('<th>COVERAGE HM</th></tr>', '<th>COVERAGE HM</th><th>FC BELUM VALID</th></tr>')
summary_fragment = summary_fragment.replace('Klik satu baris unit untuk fokus. Coverage = sampel HM valid ÷ total transaksi unit.', 'KLIK UNIT untuk fokus grafik + buka seluruh detail transaksi. Coverage = sampel HM valid ÷ total transaksi.')
chart_fragment = chart_fragment.replace('Trend FC Harian per Unit (L/HM)', 'Trend FC Harian per Unit (L/HM) • Klik garis / titik / label unit')
chart_fragment = chart_fragment.replace('HM jalan dihitung dari selisih HM transaksi berurutan per unit. HM turun/reset diabaikan. FC hanya memakai transaksi yang punya pasangan HM valid.', 'HM jalan dihitung dari HM transaksi berurutan. HM anomali, kosong, atau reset ditandai sebagai isu dan tidak pernah digambar sebagai 0 L/HM.')
issue_fragment = '<div class="kpp-fc-issues" hidden></div>'
s = s[:focus_start] + issue_fragment + summary_fragment + focus_fragment + chart_fragment + s[detail_start:]

s = s.replace('<th>CODE UNIT</th><th>HM</th><th>HM JALAN</th><th>QTY</th><th>FC</th><th>OPERATOR</th><th>FUELMAN</th>', '<th>CODE UNIT</th><th>HM AWAL</th><th>HM AKHIR</th><th>HM JALAN</th><th>QTY</th><th>FC</th><th>STATUS FC</th><th>OPERATOR</th><th>FUELMAN</th>', 1)
s = s.replace('min-width:1120px', 'min-width:1320px', 1)

old_const = "summaryBody=host.querySelector('.kpp-fc-summary-body'),focusBar=host.querySelector('.kpp-fc-focusbar')"
new_const = "summaryBody=host.querySelector('.kpp-fc-summary-body'),issueHost=host.querySelector('.kpp-fc-issues'),chartHost=host.querySelector('.kpp-fc-chart'),focusBar=host.querySelector('.kpp-fc-focusbar')"
replace_once(old_const, new_const, 'host references')

render_current = r'''    const updateToggle=()=>{if(toggle)toggle.textContent=collapsed?'Tampilkan Grafik FC':'Sembunyikan Grafik FC';};
    const updateRangeButtons=()=>{rangeButtons.forEach(btn=>btn.classList.toggle('active',btn.dataset.range===activeRange));};
    const clearFocus=()=>{focusedUnit='';};
    const setRange=(mode,startValue,endValue)=>{activeRange=mode;clearFocus();startInput.value=startValue;endInput.value=endValue;updateRangeButtons();};
    const renderCurrentView=()=>{
      if(!lastMetrics)return;const view=focusMetrics(lastMetrics,focusedUnit);
      host.querySelector('[data-kpi="avg"]').textContent=view.avg===null?'-':fmtFc(view.avg)+' L/HM';
      host.querySelector('[data-kpi="fuel"]').textContent=fmt(view.totalFuel)+' L';
      host.querySelector('[data-kpi="hm"]').textContent=fmt(view.totalHm)+' HM';
      host.querySelector('[data-kpi="count"]').textContent=`${view.samples}/${view.transactions} • ${fmtFc(view.coverage)}%`;
      legend.innerHTML=view.series.map(item=>`<button type="button" class="kpp-fc-legend-item" data-fc-unit="${esc(item.unit)}"><i class="kpp-fc-dot" style="background:${item.color}"></i>${esc(item.unit)}</button>`).join('');
      renderSvg(chartHost,view);renderSummary(summaryBody,lastMetrics,focusedUnit);renderIssues(issueHost,lastMetrics,focusedUnit);renderInsight(insight,view,startInput.value,endInput.value,mtdBounds);
      focusBar.classList.toggle('active',!!focusedUnit);detailCard.classList.toggle('active',!!focusedUnit);
      chartTitle.textContent=focusedUnit?`Trend FC Harian ${focusedUnit} (L/HM) • Klik titik untuk lihat fokus`:'Trend FC Harian per Unit (L/HM) • Klik garis / titik / label unit';
      if(focusedUnit){focusLabel.textContent=`FOKUS UNIT ${focusedUnit}`;detailTitle.textContent=`Detail Transaksi ${focusedUnit}`;renderDetail(detailBody,lastMetrics,focusedUnit);}else{detailBody.innerHTML='';}
    };
    const focusUnit=unit=>{if(!lastMetrics||!unit||!lastMetrics.summaries.some(item=>item.unit===unit))return;focusedUnit=unit;renderCurrentView();status.className='kpp-fc-status';status.textContent=`Fokus ${focusedUnit}: unit lain disembunyikan. Detail transaksi lengkap sudah dibuka di bawah grafik.`;};
    updateToggle();updateRangeButtons();
'''
pattern = r'    const updateToggle=.*?;updateToggle\(\);updateRangeButtons\(\);\n'
s, count = re.subn(pattern, render_current, s, count=1, flags=re.S)
if count != 1:
    raise SystemExit('failed replacing current-view controller')

old_events = "    document.addEventListener('click',event=>{if(!event.target.closest('.kpp-fc-unit-picker'))menu.hidden=true;});run.addEventListener('click',load);summaryBody.addEventListener('click',event=>{const row=event.target.closest('tr[data-unit]');if(!row||!lastMetrics)return;focusedUnit=row.dataset.unit||'';renderCurrentView();status.className='kpp-fc-status';status.textContent=`Fokus ${focusedUnit}: unit lain disembunyikan. Klik TAMPILKAN SEMUA UNIT untuk kembali.`;});focusReset.addEventListener('click',()=>{clearFocus();renderCurrentView();status.className='kpp-fc-status';status.textContent=`Kembali menampilkan ${selected.length} unit terpilih.`;});\n"
new_events = "    document.addEventListener('click',event=>{if(!event.target.closest('.kpp-fc-unit-picker'))menu.hidden=true;});\n    run.addEventListener('click',load);\n    summaryBody.addEventListener('click',event=>{const row=event.target.closest('tr[data-unit]');if(row)focusUnit(row.dataset.unit||'');});\n    legend.addEventListener('click',event=>{const target=event.target.closest('[data-fc-unit]');if(target)focusUnit(target.dataset.fcUnit||'');});\n    chartHost.addEventListener('click',event=>{const target=event.target.closest('[data-fc-unit]');if(target)focusUnit(target.dataset.fcUnit||'');});\n    issueHost.addEventListener('click',event=>{const target=event.target.closest('[data-fc-unit]');if(target)focusUnit(target.dataset.fcUnit||'');});\n    focusReset.addEventListener('click',()=>{clearFocus();renderCurrentView();status.className='kpp-fc-status';status.textContent=`Kembali menampilkan ${selected.length} unit terpilih.`;});\n"
replace_once(old_events, new_events, 'focus event handlers')

s = s.replace('Klik baris unit untuk fokus.', 'Klik ringkasan, label, garis, atau titik unit untuk fokus.', 1)

path.write_text(s, encoding='utf-8')

# Cache bust the runtime and keep existing static assertions aligned.
for file_name in ['dashboard.html','logsheet.html']:
    p = Path(file_name)
    text = p.read_text(encoding='utf-8')
    if 'fc-chart.js?v=20260912g' not in text:
        raise SystemExit(f'missing FC runtime version in {file_name}')
    p.write_text(text.replace('fc-chart.js?v=20260912g','fc-chart.js?v=20260912h'), encoding='utf-8')

for p in Path('scripts').glob('*.mjs'):
    text = p.read_text(encoding='utf-8')
    if 'fc-chart.js?v=20260912g' in text:
        p.write_text(text.replace('fc-chart.js?v=20260912g','fc-chart.js?v=20260912h'), encoding='utf-8')

Path('scripts/test-fc-click-anomaly-v2.mjs').write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const fc=fs.readFileSync('fc-chart.js','utf8');

test('FC summary is promoted above the graph and exposes issue counts',()=>{
  assert.ok(fc.indexOf('kpp-fc-summary-card') < fc.indexOf('kpp-fc-chart-card'));
  assert.match(fc,/FC BELUM VALID/);
  assert.match(fc,/KLIK UNIT untuk fokus grafik/);
});

test('graph, legend, issue chips and summary rows can focus a unit',()=>{
  assert.match(fc,/data-fc-unit=/);
  assert.match(fc,/chartHost\.addEventListener\('click'/);
  assert.match(fc,/legend\.addEventListener\('click'/);
  assert.match(fc,/issueHost\.addEventListener\('click'/);
  assert.match(fc,/summaryBody\.addEventListener\('click'/);
});

test('physically impossible HM jump is an issue, never a zero FC point',()=>{
  assert.match(fc,/maxPhysicalHmDelta/);
  assert.match(fc,/issue="HM ANOMALI"/);
  assert.match(fc,/FC BELUM VALID/);
  assert.match(fc,/tidak pernah digambar sebagai 0 L\/HM/);
});

test('focused detail exposes HM evidence and status',()=>{
  assert.match(fc,/hm_awal,hm_akhir,hm_jalan/);
  assert.match(fc,/HM AWAL/);
  assert.match(fc,/HM AKHIR/);
  assert.match(fc,/STATUS FC/);
  assert.match(fc,/fc_issue/);
});

for(const file of ['dashboard.html','logsheet.html']){
  test(`${file} loads FC runtime h`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/fc-chart\.js\?v=20260912h/);
  });
}
''', encoding='utf-8')

print('FC click + anomaly patch applied')
