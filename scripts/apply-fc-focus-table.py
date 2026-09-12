from pathlib import Path
import re

p=Path('fc-chart.js')
s=p.read_text(encoding='utf-8')

def replace_once(old,new,label):
    global s
    count=s.count(old)
    if count!=1:
        raise SystemExit(f'{label}: expected 1 anchor, found {count}')
    s=s.replace(old,new,1)

replace_once(
    '.kpp-fc-summary-unit{font-weight:900;color:#0f172a}.kpp-fc-summary-fc{font-weight:900;color:#1d4ed8}.kpp-fc-summary-coverage{font-weight:900}.kpp-fc-summary-coverage.good{color:#15803d}.kpp-fc-summary-coverage.mid{color:#b45309}.kpp-fc-summary-coverage.low{color:#b91c1c}.kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}',
    '.kpp-fc-summary-unit{font-weight:900;color:#0f172a}.kpp-fc-summary-fc{font-weight:900;color:#1d4ed8}.kpp-fc-summary-coverage{font-weight:900}.kpp-fc-summary-coverage.good{color:#15803d}.kpp-fc-summary-coverage.mid{color:#b45309}.kpp-fc-summary-coverage.low{color:#b91c1c}.kpp-fc-summary-table tbody tr[data-unit]{cursor:pointer;transition:background .15s ease,box-shadow .15s ease}.kpp-fc-summary-table tbody tr[data-unit]:hover{background:#eff6ff}.kpp-fc-summary-table tbody tr.focused{background:#dbeafe;box-shadow:inset 3px 0 0 #2563eb}.kpp-fc-focusbar{display:none;align-items:center;justify-content:space-between;gap:10px;margin:0 0 10px;padding:9px 11px;border:1px solid #93c5fd;border-radius:10px;background:#eff6ff}.kpp-fc-focusbar.active{display:flex}.kpp-fc-focusbar strong{font-size:10px;color:#1d4ed8}.kpp-fc-focusbar span{font-size:9px;color:#475569}.kpp-fc-focus-reset{border:1px solid #93c5fd;background:#fff;color:#1d4ed8;border-radius:8px;padding:7px 10px;font-size:9px;font-weight:900;cursor:pointer;white-space:nowrap}.kpp-fc-detail-card{display:none;margin-top:10px;border:1px solid #cbd5e1;border-radius:11px;background:#fff;overflow:hidden}.kpp-fc-detail-card.active{display:block}.kpp-fc-detail-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 11px;border-bottom:1px solid #e2e8f0;background:#f8fafc}.kpp-fc-detail-head strong{font-size:11px}.kpp-fc-detail-head span{font-size:8.5px;color:#64748b}.kpp-fc-detail-wrap{overflow:auto;max-height:420px;-webkit-overflow-scrolling:touch}.kpp-fc-detail-table{width:100%;min-width:1120px;border-collapse:collapse}.kpp-fc-detail-table th{position:sticky;top:0;z-index:1;background:#0f1b34;color:#fff;font-size:8px;padding:8px 7px;text-align:center;white-space:nowrap}.kpp-fc-detail-table td{font-size:8.5px;padding:8px 7px;text-align:center;border-bottom:1px solid #e2e8f0;white-space:nowrap}.kpp-fc-detail-table tbody tr:nth-child(even){background:#f8fafc}.kpp-fc-detail-fc{font-weight:900;color:#1d4ed8}.kpp-fc-detail-qty{font-weight:900}.kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}',
    'focus css'
)

replace_once(
    '.kpp-fc-chart-top{align-items:flex-start;flex-direction:column}.kpp-fc-legend{justify-content:flex-start}.kpp-fc-kpi strong{font-size:14px}}',
    '.kpp-fc-chart-top{align-items:flex-start;flex-direction:column}.kpp-fc-legend{justify-content:flex-start}.kpp-fc-focusbar{align-items:flex-start;flex-direction:column}.kpp-fc-kpi strong{font-size:14px}}',
    'mobile focus css'
)

replace_once(
    'db.from("fuel_history").select("id,tanggal,unit,hm_akhir,hm_jalan,fuel")',
    'db.from("fuel_history").select("id,tanggal,jam,shift,wh,fuel_truck,unit,operator,fuelman_name,hm_akhir,hm_jalan,fuel")',
    'detail query projection'
)

pattern=r'  function buildMetrics\(rows,baselines,units,start,end\)\{.*?\n  \}\n\n  function renderSummary\(host,metrics\)\{.*?\n  \}\n'
new_block='''  function buildMetrics(rows,baselines,units,start,end){
    const perUnit=new Map(units.map(unit=>[unit,{unit,totalFuel:0,validFuel:0,hm:0,samples:0,transactions:0,daily:new Map(),details:[]}]));
    rows.forEach(row=>{const unit=String(row.unit||"").trim().toUpperCase();if(perUnit.has(unit)){const entry=perUnit.get(unit);entry.totalFuel+=num(row.fuel);entry.transactions+=1;}});
    units.forEach(unit=>{
      const entry=perUnit.get(unit);const unitRows=rows.filter(row=>String(row.unit||"").trim().toUpperCase()===unit).sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal))||num(a.id)-num(b.id));
      const base=baselines.get(unit);let previous=base&&Number.isFinite(Number(base.hm_akhir))?Number(base.hm_akhir):null;
      unitRows.forEach(row=>{
        const fuel=num(row.fuel);const hmRaw=row.hm_akhir;const hm=hmRaw===null||hmRaw===undefined||hmRaw===""?null:Number(hmRaw);let delta=null;
        if(Number.isFinite(hm)){
          if(Number.isFinite(previous)&&hm>=previous)delta=hm-previous;
          if(Number.isFinite(previous)&&hm<previous){delta=null;}
          else previous=hm;
        }
        const validDelta=Number.isFinite(delta)&&delta>0?delta:null;
        if(validDelta!==null){entry.hm+=validDelta;entry.validFuel+=fuel;entry.samples+=1;const day=entry.daily.get(row.tanggal)||{fuel:0,hm:0};day.fuel+=fuel;day.hm+=validDelta;entry.daily.set(row.tanggal,day);}
        entry.details.push({...row,unit,hm_delta:validDelta,fc:validDelta!==null?fuel/validDelta:null});
      });
    });
    const dates=dateList(start,end);const series=units.map((unit,index)=>{const entry=perUnit.get(unit);return {unit,color:COLORS[index%COLORS.length],values:dates.map(date=>{const d=entry.daily.get(date);return d&&d.hm>0?d.fuel/d.hm:null;})};});
    const list=Array.from(perUnit.values());const totalFuel=list.reduce((sum,x)=>sum+x.totalFuel,0);const validFuel=list.reduce((sum,x)=>sum+x.validFuel,0);const totalHm=list.reduce((sum,x)=>sum+x.hm,0);const samples=list.reduce((sum,x)=>sum+x.samples,0);const transactions=list.reduce((sum,x)=>sum+x.transactions,0);const coverage=transactions>0?(samples/transactions)*100:0;
    const summaries=units.map(unit=>{const x=perUnit.get(unit);return {unit,totalFuel:x.totalFuel,validFuel:x.validFuel,hm:x.hm,samples:x.samples,transactions:x.transactions,coverage:x.transactions>0?(x.samples/x.transactions)*100:0,fc:x.hm>0?x.validFuel/x.hm:null};});
    const details=list.flatMap(x=>x.details);
    return {dates,series,totalFuel,validFuel,totalHm,samples,transactions,coverage,summaries,details,avg:totalHm>0?validFuel/totalHm:null};
  }

  function renderSummary(host,metrics,focusUnit=""){
    const rows=focusUnit?metrics.summaries.filter(item=>item.unit===focusUnit):metrics.summaries;
    host.innerHTML=rows.map(item=>{const coverageClass=item.coverage>=80?'good':item.coverage>=50?'mid':'low';return `<tr data-unit="${esc(item.unit)}" class="${focusUnit===item.unit?'focused':''}" title="Klik untuk fokus ke ${esc(item.unit)}"><td class="kpp-fc-summary-unit">${esc(item.unit)}</td><td class="kpp-fc-summary-fc">${item.fc===null?'-':fmtFc(item.fc)+' L/HM'}</td><td>${fmt(item.totalFuel)} L</td><td>${fmt(item.hm)} HM</td><td>${item.samples} / ${item.transactions}</td><td class="kpp-fc-summary-coverage ${coverageClass}">${fmtFc(item.coverage)}%</td></tr>`;}).join('')||'<tr><td colspan="6">Belum ada unit dipilih.</td></tr>';
  }

  function focusMetrics(metrics,unit){
    if(!unit)return metrics;
    const summary=metrics.summaries.find(item=>item.unit===unit);if(!summary)return metrics;
    return {...metrics,series:metrics.series.filter(item=>item.unit===unit),summaries:[summary],totalFuel:summary.totalFuel,validFuel:summary.validFuel,totalHm:summary.hm,samples:summary.samples,transactions:summary.transactions,coverage:summary.coverage,avg:summary.fc};
  }

  function displayDate(value){const p=String(value||'').split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:(value||'-');}
  function renderDetail(host,metrics,unit){
    const rows=metrics.details.filter(row=>row.unit===unit);
    host.innerHTML=rows.map((row,index)=>`<tr><td>${index+1}</td><td>${esc(displayDate(row.tanggal))}</td><td>${esc(row.jam?String(row.jam).slice(0,8):'-')}</td><td>${esc(row.shift??'-')}</td><td>${esc(row.wh||'-')}</td><td>${esc(row.fuel_truck||'-')}</td><td><b>${esc(row.unit)}</b></td><td>${row.hm_akhir===null||row.hm_akhir===undefined||row.hm_akhir===''?'-':fmt(row.hm_akhir)}</td><td>${row.hm_delta===null?'-':fmt(row.hm_delta)}</td><td class="kpp-fc-detail-qty">${fmt(row.fuel)} L</td><td class="kpp-fc-detail-fc">${row.fc===null?'-':fmtFc(row.fc)+' L/HM'}</td><td>${esc(row.operator||'-')}</td><td>${esc(row.fuelman_name||'-')}</td></tr>`).join('')||'<tr><td colspan="13">Belum ada transaksi pada periode ini.</td></tr>';
  }
'''
new_s,count=re.subn(pattern,new_block,s,count=1,flags=re.S)
if count!=1:
    raise SystemExit(f'metrics/summary block expected once, found {count}')
s=new_s

replace_once(
    '<div class="kpp-fc-insight" data-fc-insight><b>MTD</b><span>${esc(shortDate(start))} - ${esc(shortDate(end))} • Menunggu data unit terpilih.</span></div><div class="kpp-fc-chart-card">',
    '<div class="kpp-fc-insight" data-fc-insight><b>MTD</b><span>${esc(shortDate(start))} - ${esc(shortDate(end))} • Menunggu data unit terpilih.</span></div><div class="kpp-fc-focusbar"><div><strong data-focus-label>FOKUS UNIT</strong><br><span>Unit lain disembunyikan, grafik dan data transaksi hanya menampilkan unit ini.</span></div><button type="button" class="kpp-fc-focus-reset">TAMPILKAN SEMUA UNIT</button></div><div class="kpp-fc-chart-card">',
    'focusbar html'
)
replace_once(
    '<div class="kpp-fc-summary-head"><strong>Ringkasan Unit Terpilih</strong><span>Coverage = sampel HM valid ÷ total transaksi unit.</span></div>',
    '<div class="kpp-fc-summary-head"><strong>Ringkasan FC per Unit</strong><span>Klik satu baris unit untuk fokus. Coverage = sampel HM valid ÷ total transaksi unit.</span></div>',
    'summary head html'
)
replace_once(
    '<tbody class="kpp-fc-summary-body"><tr><td colspan="6">Pilih unit lalu tampilkan grafik.</td></tr></tbody></table></div></div><div class="kpp-fc-status"></div>',
    '<tbody class="kpp-fc-summary-body"><tr><td colspan="6">Pilih unit lalu tampilkan grafik.</td></tr></tbody></table></div></div><div class="kpp-fc-detail-card"><div class="kpp-fc-detail-head"><strong data-detail-title>Detail Transaksi Unit</strong><span>FC transaksi = QTY ÷ HM jalan valid.</span></div><div class="kpp-fc-detail-wrap"><table class="kpp-fc-detail-table"><thead><tr><th>NO</th><th>TANGGAL</th><th>JAM</th><th>SHIFT</th><th>WH</th><th>FUEL TRUCK</th><th>CODE UNIT</th><th>HM</th><th>HM JALAN</th><th>QTY</th><th>FC</th><th>OPERATOR</th><th>FUELMAN</th></tr></thead><tbody class="kpp-fc-detail-body"></tbody></table></div></div><div class="kpp-fc-status"></div>',
    'detail table html'
)

old_selectors="const body=host.querySelector('.kpp-fc-body'),toggle=host.querySelector('.kpp-fc-toggle'),trigger=host.querySelector('.kpp-fc-unit-trigger'),menu=host.querySelector('.kpp-fc-unit-menu'),list=host.querySelector('.kpp-fc-unit-list'),search=host.querySelector('.kpp-fc-unit-search'),run=host.querySelector('.kpp-fc-run'),status=host.querySelector('.kpp-fc-status'),periodPill=host.querySelector('[data-period-pill]'),insight=host.querySelector('[data-fc-insight]'),startInput=host.querySelector('.kpp-fc-start'),endInput=host.querySelector('.kpp-fc-end'),rangeButtons=Array.from(host.querySelectorAll('.kpp-fc-range-btn'));let activeRange=defaultIsMtd?'mtd':'custom';"
new_selectors="const body=host.querySelector('.kpp-fc-body'),toggle=host.querySelector('.kpp-fc-toggle'),trigger=host.querySelector('.kpp-fc-unit-trigger'),menu=host.querySelector('.kpp-fc-unit-menu'),list=host.querySelector('.kpp-fc-unit-list'),search=host.querySelector('.kpp-fc-unit-search'),run=host.querySelector('.kpp-fc-run'),status=host.querySelector('.kpp-fc-status'),periodPill=host.querySelector('[data-period-pill]'),insight=host.querySelector('[data-fc-insight]'),startInput=host.querySelector('.kpp-fc-start'),endInput=host.querySelector('.kpp-fc-end'),rangeButtons=Array.from(host.querySelectorAll('.kpp-fc-range-btn')),summaryBody=host.querySelector('.kpp-fc-summary-body'),focusBar=host.querySelector('.kpp-fc-focusbar'),focusLabel=host.querySelector('[data-focus-label]'),focusReset=host.querySelector('.kpp-fc-focus-reset'),detailCard=host.querySelector('.kpp-fc-detail-card'),detailTitle=host.querySelector('[data-detail-title]'),detailBody=host.querySelector('.kpp-fc-detail-body'),chartTitle=host.querySelector('.kpp-fc-chart-title'),legend=host.querySelector('.kpp-fc-legend');let activeRange=defaultIsMtd?'mtd':'custom',focusedUnit='',lastMetrics=null;"
replace_once(old_selectors,new_selectors,'focus selectors')

old_helpers="const updateToggle=()=>{if(toggle)toggle.textContent=collapsed?'Tampilkan Grafik FC':'Sembunyikan Grafik FC';};const updateRangeButtons=()=>{rangeButtons.forEach(btn=>btn.classList.toggle('active',btn.dataset.range===activeRange));};const setRange=(mode,startValue,endValue)=>{activeRange=mode;startInput.value=startValue;endInput.value=endValue;updateRangeButtons();};updateToggle();updateRangeButtons();"
new_helpers="const updateToggle=()=>{if(toggle)toggle.textContent=collapsed?'Tampilkan Grafik FC':'Sembunyikan Grafik FC';};const updateRangeButtons=()=>{rangeButtons.forEach(btn=>btn.classList.toggle('active',btn.dataset.range===activeRange));};const clearFocus=()=>{focusedUnit='';};const setRange=(mode,startValue,endValue)=>{activeRange=mode;clearFocus();startInput.value=startValue;endInput.value=endValue;updateRangeButtons();};const renderCurrentView=()=>{if(!lastMetrics)return;const view=focusMetrics(lastMetrics,focusedUnit);host.querySelector('[data-kpi=\\\"avg\\\"]').textContent=view.avg===null?'-':fmtFc(view.avg)+' L/HM';host.querySelector('[data-kpi=\\\"fuel\\\"]').textContent=fmt(view.totalFuel)+' L';host.querySelector('[data-kpi=\\\"hm\\\"]').textContent=fmt(view.totalHm)+' HM';host.querySelector('[data-kpi=\\\"count\\\"]').textContent=`${view.samples}/${view.transactions} • ${fmtFc(view.coverage)}%`;legend.innerHTML=view.series.map(item=>`<span class=\\\"kpp-fc-legend-item\\\"><i class=\\\"kpp-fc-dot\\\" style=\\\"background:${item.color}\\\"></i>${esc(item.unit)}</span>`).join('');renderSvg(host.querySelector('.kpp-fc-chart'),view);renderSummary(summaryBody,lastMetrics,focusedUnit);renderInsight(insight,view,startInput.value,endInput.value,mtdBounds);focusBar.classList.toggle('active',!!focusedUnit);detailCard.classList.toggle('active',!!focusedUnit);chartTitle.textContent=focusedUnit?`Trend FC Harian ${focusedUnit} (L/HM)`:'Trend FC Harian per Unit (L/HM)';if(focusedUnit){focusLabel.textContent=`FOKUS UNIT ${focusedUnit}`;detailTitle.textContent=`Detail Transaksi ${focusedUnit}`;renderDetail(detailBody,lastMetrics,focusedUnit);}else{detailBody.innerHTML='';}};updateToggle();updateRangeButtons();"
replace_once(old_helpers,new_helpers,'focus render helpers')

load_pattern=r"    const load=async\(\)=>\{.*?\};\n    toggle\?\.addEventListener"
load_repl="""    const load=async()=>{const s=startInput.value,e=endInput.value;if(!selected.length){status.className='kpp-fc-status error';status.textContent='Pilih minimal 1 unit.';return;}if(!s||!e||s>e){status.className='kpp-fc-status error';status.textContent='Rentang tanggal tidak valid.';return;}run.disabled=true;rangeButtons.forEach(btn=>btn.disabled=true);status.className='kpp-fc-status';status.textContent='Memuat data FC...';try{const [rows,baselines]=await Promise.all([fetchPaged(KPP.db,s,e,selected),fetchBaselines(KPP.db,s,selected)]);lastMetrics=buildMetrics(rows,baselines,selected,s,e);if(focusedUnit&&!selected.includes(focusedUnit))clearFocus();renderCurrentView();const exactMtd=s===mtdBounds.start&&e===mtdBounds.end;const label=exactMtd?'MTD':activeRange==='30d'?'30 HARI':activeRange==='90d'?'90 HARI':activeRange==='all'?'SEMUA DATA':'PERIODE';periodPill.textContent=`${label} • ${shortDate(s)} - ${shortDate(e)}`;status.textContent=`${lastMetrics.samples} sampel HM valid dari ${lastMetrics.transactions} transaksi • ${selected.length} unit dipilih • ${lastMetrics.dates.length} hari. Klik baris unit untuk fokus.`;}catch(error){console.error(error);status.className='kpp-fc-status error';status.textContent='Gagal memuat grafik FC: '+error.message;}finally{run.disabled=false;rangeButtons.forEach(btn=>btn.disabled=false);}};
    toggle?.addEventListener"""
new_s,count=re.subn(load_pattern,load_repl,s,count=1,flags=re.S)
if count!=1:
    raise SystemExit(f'load block expected once, found {count}')
s=new_s

replace_once(
    "list.addEventListener('change',event=>{const box=event.target.closest('input[type=\"checkbox\"]');if(!box)return;const value=box.value;if(box.checked&&!selected.includes(value)){if(selected.length>=MAX_UNITS){box.checked=false;status.className='kpp-fc-status error';status.textContent='Maksimal 10 unit. Jika grafik terasa ramai, kurangi unit yang dipilih.';return;}selected.push(value);}else if(!box.checked){selected=selected.filter(u=>u!==value);}localStorage.setItem('kppFcSelectedUnits',JSON.stringify(selected));renderPicker();});",
    "list.addEventListener('change',event=>{const box=event.target.closest('input[type=\"checkbox\"]');if(!box)return;const value=box.value;if(box.checked&&!selected.includes(value)){if(selected.length>=MAX_UNITS){box.checked=false;status.className='kpp-fc-status error';status.textContent='Maksimal 10 unit. Jika grafik terasa ramai, kurangi unit yang dipilih.';return;}selected.push(value);}else if(!box.checked){selected=selected.filter(u=>u!==value);}clearFocus();localStorage.setItem('kppFcSelectedUnits',JSON.stringify(selected));renderPicker();});",
    'selection clears focus'
)
replace_once(
    "document.addEventListener('click',event=>{if(!event.target.closest('.kpp-fc-unit-picker'))menu.hidden=true;});run.addEventListener('click',load);",
    "document.addEventListener('click',event=>{if(!event.target.closest('.kpp-fc-unit-picker'))menu.hidden=true;});run.addEventListener('click',load);summaryBody.addEventListener('click',event=>{const row=event.target.closest('tr[data-unit]');if(!row||!lastMetrics)return;focusedUnit=row.dataset.unit||'';renderCurrentView();status.className='kpp-fc-status';status.textContent=`Fokus ${focusedUnit}: unit lain disembunyikan. Klik TAMPILKAN SEMUA UNIT untuk kembali.`;});focusReset.addEventListener('click',()=>{clearFocus();renderCurrentView();status.className='kpp-fc-status';status.textContent=`Kembali menampilkan ${selected.length} unit terpilih.`;});",
    'focus row events'
)
replace_once(
    "[startInput,endInput].forEach(input=>input.addEventListener('change',()=>{activeRange='custom';updateRangeButtons();}));",
    "[startInput,endInput].forEach(input=>input.addEventListener('change',()=>{activeRange='custom';clearFocus();updateRangeButtons();}));",
    'manual date clears focus'
)

p.write_text(s,encoding='utf-8')

for name in ('dashboard.html','logsheet.html','scripts/test-fc-data-contract.mjs','scripts/test-fc-mtd-context.mjs','scripts/test-fc-dashboard-informative.mjs','scripts/test-fc-range-presets.mjs'):
    path=Path(name)
    text=path.read_text(encoding='utf-8').replace('20260912f','20260912g')
    path.write_text(text,encoding='utf-8')

Path('scripts/test-fc-focus-table.mjs').write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('fc-chart.js','utf8');

test('FC summary rows can focus one unit',()=>{
  assert.match(src,/tr data-unit=/);
  assert.match(src,/function focusMetrics\(metrics,unit\)/);
  assert.match(src,/summaryBody\.addEventListener\('click'/);
  assert.match(src,/TAMPILKAN SEMUA UNIT/);
  assert.match(src,/unit lain disembunyikan/i);
});

test('focused unit exposes transaction detail table with FC',()=>{
  assert.match(src,/kpp-fc-detail-table/);
  assert.match(src,/Detail Transaksi/);
  assert.match(src,/FC transaksi = QTY/);
  assert.match(src,/function renderDetail\(host,metrics,unit\)/);
  assert.match(src,/fuel\/validDelta/);
});

test('FC query carries detail fields without changing source table',()=>{
  assert.match(src,/id,tanggal,jam,shift,wh,fuel_truck,unit,operator,fuelman_name,hm_akhir,hm_jalan,fuel/);
  assert.match(src,/from\(\"fuel_history\"\)/);
});

test('all-unit summary remains the default view',()=>{
  assert.match(src,/renderSummary\(summaryBody,lastMetrics,focusedUnit\)/);
  assert.match(src,/clearFocus\(\)/);
  assert.match(src,/Ringkasan FC per Unit/);
});

for(const file of ['dashboard.html','logsheet.html']){
  test(`${file} loads FC focus-table runtime`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/fc-chart\.js\?v=20260912g/);
  });
}
''',encoding='utf-8')

print('FC focus table patch applied')
