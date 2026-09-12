from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"anchor {label} expected once, found {count}")
    return text.replace(old, new, 1)

p = Path('fc-chart.js')
s = p.read_text(encoding='utf-8')

s = replace_once(
    s,
    'function dateList(start,end){const out=[];let cur=start;let guard=0;while(cur<=end&&guard<370){out.push(cur);cur=addDays(cur,1);guard++;}return out;}',
    'function dateList(start,end){const out=[];let cur=start;let guard=0;while(cur<=end&&guard<3660){out.push(cur);cur=addDays(cur,1);guard++;}return out;}',
    'date range guard'
)

s = replace_once(
    s,
    '.kpp-fc-run{height:40px;border:0;border-radius:9px;padding:0 14px;background:#2563eb;color:#fff;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}.kpp-fc-run:disabled{opacity:.55;cursor:wait}',
    '.kpp-fc-run{height:40px;border:0;border-radius:9px;padding:0 14px;background:#2563eb;color:#fff;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}.kpp-fc-run:disabled{opacity:.55;cursor:wait}\n      .kpp-fc-rangebar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:-3px 0 12px}.kpp-fc-range-label{font-size:8.5px;font-weight:900;color:#64748b;margin-right:2px}.kpp-fc-range-btn{border:1px solid #cbd5e1;background:#fff;color:#475569;border-radius:999px;padding:6px 10px;font-size:8.5px;font-weight:900;cursor:pointer;white-space:nowrap}.kpp-fc-range-btn:hover{background:#f8fafc}.kpp-fc-range-btn.active{background:#dbeafe;border-color:#93c5fd;color:#1d4ed8}.kpp-fc-range-hint{font-size:8px;color:#94a3b8;margin-left:2px}',
    'range bar css'
)

s = replace_once(
    s,
    '@media(max-width:760px){.kpp-fc-head{padding:12px;align-items:flex-start}.kpp-fc-head-actions{justify-content:flex-start}.kpp-fc-body{padding:10px 10px 12px}.kpp-fc-filters{grid-template-columns:1fr 1fr}',
    '@media(max-width:760px){.kpp-fc-head{padding:12px;align-items:flex-start}.kpp-fc-head-actions{justify-content:flex-start}.kpp-fc-body{padding:10px 10px 12px}.kpp-fc-filters{grid-template-columns:1fr 1fr}.kpp-fc-rangebar{gap:5px}.kpp-fc-range-btn{padding:6px 9px}',
    'mobile range css'
)

s = replace_once(
    s,
    'async function fetchBaselines(db,start,units){const pairs=await Promise.all(units.map(async unit=>{const {data,error}=await db.from("fuel_history").select("id,tanggal,unit,hm_akhir").eq("unit",unit).lt("tanggal",start).not("hm_akhir","is",null).order("tanggal",{ascending:false}).order("id",{ascending:false}).limit(1);if(error)throw error;return [unit,(data||[])[0]||null];}));return new Map(pairs);}',
    'async function fetchBaselines(db,start,units){const pairs=await Promise.all(units.map(async unit=>{const {data,error}=await db.from("fuel_history").select("id,tanggal,unit,hm_akhir").eq("unit",unit).lt("tanggal",start).not("hm_akhir","is",null).order("tanggal",{ascending:false}).order("id",{ascending:false}).limit(1);if(error)throw error;return [unit,(data||[])[0]||null];}));return new Map(pairs);}\n  async function fetchEarliestDate(db,units){const {data,error}=await db.from("fuel_history").select("tanggal").in("unit",units).not("tanggal","is",null).order("tanggal",{ascending:true}).limit(1);if(error)throw error;return (data||[])[0]?.tanggal||null;}',
    'earliest date helper'
)

s = replace_once(
    s,
    'const W=900,H=300,L=48,R=16,T=18,B=38;const plotW=W-L-R,plotH=H-T-B;',
    'const W=Math.max(900,Math.min(3200,90+(dates.length*18))),H=300,L=48,R=16,T=18,B=38;const plotW=W-L-R,plotH=H-T-B;',
    'dynamic chart width'
)

s = replace_once(
    s,
    '</div><div class="kpp-fc-kpis"><div class="kpp-fc-kpi blue">',
    '</div><div class="kpp-fc-rangebar"><span class="kpp-fc-range-label">RENTANG CEPAT</span><button type="button" class="kpp-fc-range-btn active" data-range="mtd">MTD</button><button type="button" class="kpp-fc-range-btn" data-range="30d">30 HARI</button><button type="button" class="kpp-fc-range-btn" data-range="90d">90 HARI</button><button type="button" class="kpp-fc-range-btn" data-range="all">SEMUA DATA</button><span class="kpp-fc-range-hint">Atau ubah tanggal manual.</span></div><div class="kpp-fc-kpis"><div class="kpp-fc-kpi blue">',
    'range bar html'
)

s = replace_once(
    s,
    "const body=host.querySelector('.kpp-fc-body'),toggle=host.querySelector('.kpp-fc-toggle'),trigger=host.querySelector('.kpp-fc-unit-trigger'),menu=host.querySelector('.kpp-fc-unit-menu'),list=host.querySelector('.kpp-fc-unit-list'),search=host.querySelector('.kpp-fc-unit-search'),run=host.querySelector('.kpp-fc-run'),status=host.querySelector('.kpp-fc-status'),periodPill=host.querySelector('[data-period-pill]'),insight=host.querySelector('[data-fc-insight]');",
    "const body=host.querySelector('.kpp-fc-body'),toggle=host.querySelector('.kpp-fc-toggle'),trigger=host.querySelector('.kpp-fc-unit-trigger'),menu=host.querySelector('.kpp-fc-unit-menu'),list=host.querySelector('.kpp-fc-unit-list'),search=host.querySelector('.kpp-fc-unit-search'),run=host.querySelector('.kpp-fc-run'),status=host.querySelector('.kpp-fc-status'),periodPill=host.querySelector('[data-period-pill]'),insight=host.querySelector('[data-fc-insight]'),startInput=host.querySelector('.kpp-fc-start'),endInput=host.querySelector('.kpp-fc-end'),rangeButtons=Array.from(host.querySelectorAll('.kpp-fc-range-btn'));let activeRange=defaultIsMtd?'mtd':'custom';",
    'selectors and range state'
)

s = replace_once(
    s,
    'const updateToggle=()=>{if(toggle)toggle.textContent=collapsed?\'Tampilkan Grafik FC\':\'Sembunyikan Grafik FC\';};updateToggle();',
    'const updateToggle=()=>{if(toggle)toggle.textContent=collapsed?\'Tampilkan Grafik FC\':\'Sembunyikan Grafik FC\';};const updateRangeButtons=()=>{rangeButtons.forEach(btn=>btn.classList.toggle(\'active\',btn.dataset.range===activeRange));};const setRange=(mode,startValue,endValue)=>{activeRange=mode;startInput.value=startValue;endInput.value=endValue;updateRangeButtons();};updateToggle();updateRangeButtons();',
    'range helpers'
)

old_load = "const load=async()=>{const s=host.querySelector('.kpp-fc-start').value,e=host.querySelector('.kpp-fc-end').value;if(!selected.length){status.className='kpp-fc-status error';status.textContent='Pilih minimal 1 unit.';return;}if(!s||!e||s>e){status.className='kpp-fc-status error';status.textContent='Rentang tanggal tidak valid.';return;}run.disabled=true;status.className='kpp-fc-status';status.textContent='Memuat data FC...';try{const [rows,baselines]=await Promise.all([fetchPaged(KPP.db,s,e,selected),fetchBaselines(KPP.db,s,selected)]);const metrics=buildMetrics(rows,baselines,selected,s,e);host.querySelector('[data-kpi=\"avg\"]').textContent=metrics.avg===null?'-':fmtFc(metrics.avg)+' L/HM';host.querySelector('[data-kpi=\"fuel\"]').textContent=fmt(metrics.totalFuel)+' L';host.querySelector('[data-kpi=\"hm\"]').textContent=fmt(metrics.totalHm)+' HM';host.querySelector('[data-kpi=\"count\"]').textContent=`${metrics.samples}/${metrics.transactions} • ${fmtFc(metrics.coverage)}%`;host.querySelector('.kpp-fc-legend').innerHTML=metrics.series.map(s=>`<span class=\"kpp-fc-legend-item\"><i class=\"kpp-fc-dot\" style=\"background:${s.color}\"></i>${esc(s.unit)}</span>`).join('');renderSvg(host.querySelector('.kpp-fc-chart'),metrics);renderSummary(host.querySelector('.kpp-fc-summary-body'),metrics);renderInsight(insight,metrics,s,e,mtdBounds);const exactMtd=s===mtdBounds.start&&e===mtdBounds.end;periodPill.textContent=`${exactMtd?'MTD • ':'PERIODE • '}${shortDate(s)} - ${shortDate(e)}`;status.textContent=`${metrics.samples} sampel HM valid dari ${metrics.transactions} transaksi • ${selected.length} unit dipilih.`;}catch(error){console.error(error);status.className='kpp-fc-status error';status.textContent='Gagal memuat grafik FC: '+error.message;}finally{run.disabled=false;}};"
new_load = "const load=async()=>{const s=startInput.value,e=endInput.value;if(!selected.length){status.className='kpp-fc-status error';status.textContent='Pilih minimal 1 unit.';return;}if(!s||!e||s>e){status.className='kpp-fc-status error';status.textContent='Rentang tanggal tidak valid.';return;}run.disabled=true;rangeButtons.forEach(btn=>btn.disabled=true);status.className='kpp-fc-status';status.textContent='Memuat data FC...';try{const [rows,baselines]=await Promise.all([fetchPaged(KPP.db,s,e,selected),fetchBaselines(KPP.db,s,selected)]);const metrics=buildMetrics(rows,baselines,selected,s,e);host.querySelector('[data-kpi=\"avg\"]').textContent=metrics.avg===null?'-':fmtFc(metrics.avg)+' L/HM';host.querySelector('[data-kpi=\"fuel\"]').textContent=fmt(metrics.totalFuel)+' L';host.querySelector('[data-kpi=\"hm\"]').textContent=fmt(metrics.totalHm)+' HM';host.querySelector('[data-kpi=\"count\"]').textContent=`${metrics.samples}/${metrics.transactions} • ${fmtFc(metrics.coverage)}%`;host.querySelector('.kpp-fc-legend').innerHTML=metrics.series.map(s=>`<span class=\"kpp-fc-legend-item\"><i class=\"kpp-fc-dot\" style=\"background:${s.color}\"></i>${esc(s.unit)}</span>`).join('');renderSvg(host.querySelector('.kpp-fc-chart'),metrics);renderSummary(host.querySelector('.kpp-fc-summary-body'),metrics);renderInsight(insight,metrics,s,e,mtdBounds);const exactMtd=s===mtdBounds.start&&e===mtdBounds.end;const label=exactMtd?'MTD':activeRange==='30d'?'30 HARI':activeRange==='90d'?'90 HARI':activeRange==='all'?'SEMUA DATA':'PERIODE';periodPill.textContent=`${label} • ${shortDate(s)} - ${shortDate(e)}`;status.textContent=`${metrics.samples} sampel HM valid dari ${metrics.transactions} transaksi • ${selected.length} unit dipilih • ${metrics.dates.length} hari.`;}catch(error){console.error(error);status.className='kpp-fc-status error';status.textContent='Gagal memuat grafik FC: '+error.message;}finally{run.disabled=false;rangeButtons.forEach(btn=>btn.disabled=false);}};"
s = replace_once(s, old_load, new_load, 'load function')

old_tail = "document.addEventListener('click',event=>{if(!event.target.closest('.kpp-fc-unit-picker'))menu.hidden=true;});run.addEventListener('click',load);\n    if(!collapsed)init();"
new_tail = "document.addEventListener('click',event=>{if(!event.target.closest('.kpp-fc-unit-picker'))menu.hidden=true;});run.addEventListener('click',load);\n    [startInput,endInput].forEach(input=>input.addEventListener('change',()=>{activeRange='custom';updateRangeButtons();}));\n    rangeButtons.forEach(btn=>btn.addEventListener('click',async()=>{const ok=await init();if(!ok)return;const mode=btn.dataset.range;if(mode==='mtd')setRange('mtd',mtdBounds.start,mtdBounds.end);else if(mode==='30d')setRange('30d',addDays(today,-29),today);else if(mode==='90d')setRange('90d',addDays(today,-89),today);else if(mode==='all'){if(!selected.length){status.className='kpp-fc-status error';status.textContent='Pilih minimal 1 unit untuk mencari seluruh historinya.';return;}status.className='kpp-fc-status';status.textContent='Mencari transaksi pertama unit terpilih...';try{const earliest=await fetchEarliestDate(KPP.db,selected);if(!earliest){status.className='kpp-fc-status error';status.textContent='Belum ada histori untuk unit terpilih.';return;}setRange('all',earliest,today);}catch(error){status.className='kpp-fc-status error';status.textContent='Gagal mencari tanggal awal histori: '+error.message;return;}}await load();}));\n    if(!collapsed)init();"
s = replace_once(s, old_tail, new_tail, 'preset events')

p.write_text(s, encoding='utf-8')

for name in ('dashboard.html','logsheet.html','scripts/test-fc-dashboard-informative.mjs','scripts/test-fc-data-contract.mjs','scripts/test-fc-mtd-context.mjs'):
    path=Path(name)
    text=path.read_text(encoding='utf-8')
    text=text.replace('fc-chart.js?v=20260912e','fc-chart.js?v=20260912f')
    path.write_text(text,encoding='utf-8')

Path('scripts/test-fc-range-presets.mjs').write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('fc-chart.js','utf8');

test('FC offers MTD, 30 day, 90 day and all-history presets',()=>{
  assert.match(src,/data-range=\\"mtd\\"/);
  assert.match(src,/data-range=\\"30d\\"/);
  assert.match(src,/data-range=\\"90d\\"/);
  assert.match(src,/data-range=\\"all\\"/);
  assert.match(src,/SEMUA DATA/);
});

test('all-history preset finds earliest selected-unit transaction',()=>{
  assert.match(src,/async function fetchEarliestDate/);
  assert.match(src,/order\\(\\"tanggal\\",\\{ascending:true\\}\\)\\.limit\\(1\\)/);
  assert.match(src,/fetchEarliestDate\\(KPP\\.db,selected\\)/);
});

test('long date ranges remain renderable and chart becomes horizontally roomy',()=>{
  assert.match(src,/guard<3660/);
  assert.match(src,/dates\\.length\\*18/);
  assert.match(src,/metrics\\.dates\\.length} hari/);
});

test('manual date changes leave quick preset mode',()=>{
  assert.match(src,/activeRange='custom'/);
  assert.match(src,/Atau ubah tanggal manual/);
});

for(const file of ['dashboard.html','logsheet.html']){
  test(`${file} loads refreshed FC runtime`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/fc-chart\\.js\\?v=20260912f/);
  });
}
""",encoding='utf-8')

print('FC range presets patch applied')
