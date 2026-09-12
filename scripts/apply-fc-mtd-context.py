from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    if text.count(old) != 1:
        raise SystemExit(f"anchor not unique: {label} ({text.count(old)})")
    return text.replace(old, new, 1)

fc_path = Path('fc-chart.js')
fc = fc_path.read_text(encoding='utf-8')

fc = replace_once(
    fc,
    ".kpp-fc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #edf1f6}\n      .kpp-fc-head h3{margin:0;font-size:16px;color:#0f172a}.kpp-fc-head p{margin:4px 0 0;font-size:10px;color:#64748b;line-height:1.35}\n      .kpp-fc-toggle{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:9px;padding:8px 11px;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}",
    ".kpp-fc-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 16px;border-bottom:1px solid #edf1f6}\n      .kpp-fc-head h3{margin:0;font-size:16px;color:#0f172a}.kpp-fc-head p{margin:4px 0 0;font-size:10px;color:#64748b;line-height:1.35}\n      .kpp-fc-head-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.kpp-fc-period-pill{display:inline-flex;align-items:center;min-height:30px;padding:6px 9px;border-radius:999px;background:#eef6ff;border:1px solid #bfdbfe;color:#1d4ed8;font-size:9px;font-weight:900;white-space:nowrap}\n      .kpp-fc-toggle{border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8;border-radius:9px;padding:8px 11px;font-size:10px;font-weight:900;cursor:pointer;white-space:nowrap}",
    'header css'
)

fc = replace_once(
    fc,
    ".kpp-fc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px}.kpp-fc-kpi{border:1px solid #e2e8f0;border-radius:11px;padding:10px 11px;background:#f8fafc}.kpp-fc-kpi small{display:block;font-size:8px;color:#64748b;font-weight:900;margin-bottom:4px}.kpp-fc-kpi strong{font-size:16px;color:#0f172a}.kpp-fc-kpi.blue{background:#eff6ff}.kpp-fc-kpi.green{background:#f0fdf4}.kpp-fc-kpi.amber{background:#fffbeb}.kpp-fc-kpi.purple{background:#f5f3ff}",
    ".kpp-fc-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:8px}.kpp-fc-kpi{border:1px solid #e2e8f0;border-radius:11px;padding:10px 11px;background:#f8fafc}.kpp-fc-kpi small{display:block;font-size:8px;color:#64748b;font-weight:900;margin-bottom:4px}.kpp-fc-kpi strong{font-size:16px;color:#0f172a}.kpp-fc-kpi.blue{background:#eff6ff}.kpp-fc-kpi.green{background:#f0fdf4}.kpp-fc-kpi.amber{background:#fffbeb}.kpp-fc-kpi.purple{background:#f5f3ff}\n      .kpp-fc-insight{display:flex;gap:8px;align-items:flex-start;padding:9px 11px;margin:0 0 12px;border:1px solid #dbe5f1;border-radius:10px;background:#f8fafc;color:#334155;font-size:9px;line-height:1.45}.kpp-fc-insight b{color:#0f172a;white-space:nowrap}.kpp-fc-insight span{min-width:0}",
    'kpi css'
)

fc = replace_once(
    fc,
    "@media(max-width:760px){.kpp-fc-head{padding:12px}.kpp-fc-body{padding:10px 10px 12px}.kpp-fc-filters{grid-template-columns:1fr 1fr}",
    "@media(max-width:760px){.kpp-fc-head{padding:12px;align-items:flex-start}.kpp-fc-head-actions{justify-content:flex-start}.kpp-fc-body{padding:10px 10px 12px}.kpp-fc-filters{grid-template-columns:1fr 1fr}",
    'mobile header css'
)

fc = replace_once(
    fc,
    "  function renderSvg(host,metrics){",
    "  function renderInsight(host,metrics,start,end,mtdBounds){\n    const valid=metrics.summaries.filter(item=>Number.isFinite(item.fc));\n    const exactMtd=start===mtdBounds.start&&end===mtdBounds.end;\n    if(!valid.length){host.innerHTML=`<b>${exactMtd?'MTD':'PERIODE'}</b><span>${esc(shortDate(start))} - ${esc(shortDate(end))} • Belum ada FC valid untuk unit terpilih.</span>`;return;}\n    const highest=valid.reduce((best,item)=>!best||item.fc>best.fc?item:best,null);\n    const lowest=valid.reduce((best,item)=>!best||item.fc<best.fc?item:best,null);\n    const coverage=metrics.summaries.reduce((best,item)=>!best||item.coverage>best.coverage?item:best,null);\n    host.innerHTML=`<b>SNAPSHOT ${exactMtd?'MTD':'PERIODE'}</b><span>${esc(shortDate(start))} - ${esc(shortDate(end))} • FC tertinggi: <strong>${esc(highest.unit)} ${fmtFc(highest.fc)} L/HM</strong> • terendah: <strong>${esc(lowest.unit)} ${fmtFc(lowest.fc)} L/HM</strong> • coverage terbaik: <strong>${esc(coverage.unit)} ${fmtFc(coverage.coverage)}%</strong>. Bandingkan efisiensi idealnya pada tipe/EGI yang sama.</span>`;\n  }\n\n  function renderSvg(host,metrics){",
    'insight helper'
)

fc = replace_once(
    fc,
    "    const collapsible=!!options.collapsible;let collapsed=collapsible&&options.collapsedByDefault!==false;let initialized=false;let units=[];let selected=[];const today=window.KPPTime?.localDate?.()||new Date().toISOString().slice(0,10);const end=options.endDate||today;const start=options.startDate||addDays(end,-13);",
    "    const collapsible=!!options.collapsible;let collapsed=collapsible&&options.collapsedByDefault!==false;let initialized=false;let units=[];let selected=[];const today=window.KPPTime?.localDate?.()||new Date().toISOString().slice(0,10);const mtdBounds=window.KPPTime?.operationalMtdBounds?.()||{start:addDays(today,-13),end:today};const end=options.endDate||mtdBounds.end||today;const start=options.startDate||mtdBounds.start||addDays(end,-13);const defaultIsMtd=!options.startDate&&!options.endDate;",
    'default period'
)

old_header = "    host.innerHTML=`<section class=\"kpp-fc-widget\"><div class=\"kpp-fc-head\"><div><h3>${esc(options.title||\"Grafik FC per Unit\")}</h3><p>Bandingkan sampai 10 unit. FC gabungan berbobot HM valid, bukan rata-rata aritmatik antar unit.</p></div>${collapsible?'<button type=\"button\" class=\"kpp-fc-toggle\"></button>':''}</div><div class=\"kpp-fc-body\" ${collapsed?'hidden':''}>"
new_header = "    host.innerHTML=`<section class=\"kpp-fc-widget\"><div class=\"kpp-fc-head\"><div><h3>${esc(options.title||\"Grafik FC per Unit\")}</h3><p>Default mengikuti MTD operasional tanggal 26 sampai 25. Bandingkan sampai 10 unit dengan satu logika HM berurutan.</p></div><div class=\"kpp-fc-head-actions\"><span class=\"kpp-fc-period-pill\" data-period-pill>${defaultIsMtd?'MTD • ':''}${esc(shortDate(start))} - ${esc(shortDate(end))}</span>${collapsible?'<button type=\"button\" class=\"kpp-fc-toggle\"></button>':''}</div></div><div class=\"kpp-fc-body\" ${collapsed?'hidden':''}>"
fc = replace_once(fc, old_header, new_header, 'header html')

fc = replace_once(
    fc,
    "</div><div class=\"kpp-fc-chart-card\"><div class=\"kpp-fc-chart-top\">",
    "</div><div class=\"kpp-fc-insight\" data-fc-insight><b>MTD</b><span>${esc(shortDate(start))} - ${esc(shortDate(end))} • Menunggu data unit terpilih.</span></div><div class=\"kpp-fc-chart-card\"><div class=\"kpp-fc-chart-top\">",
    'insight html'
)

fc = replace_once(
    fc,
    "    const body=host.querySelector('.kpp-fc-body'),toggle=host.querySelector('.kpp-fc-toggle'),trigger=host.querySelector('.kpp-fc-unit-trigger'),menu=host.querySelector('.kpp-fc-unit-menu'),list=host.querySelector('.kpp-fc-unit-list'),search=host.querySelector('.kpp-fc-unit-search'),run=host.querySelector('.kpp-fc-run'),status=host.querySelector('.kpp-fc-status');",
    "    const body=host.querySelector('.kpp-fc-body'),toggle=host.querySelector('.kpp-fc-toggle'),trigger=host.querySelector('.kpp-fc-unit-trigger'),menu=host.querySelector('.kpp-fc-unit-menu'),list=host.querySelector('.kpp-fc-unit-list'),search=host.querySelector('.kpp-fc-unit-search'),run=host.querySelector('.kpp-fc-run'),status=host.querySelector('.kpp-fc-status'),periodPill=host.querySelector('[data-period-pill]'),insight=host.querySelector('[data-fc-insight]');",
    'query selectors'
)

old_load = "renderSvg(host.querySelector('.kpp-fc-chart'),metrics);renderSummary(host.querySelector('.kpp-fc-summary-body'),metrics);status.textContent=`${metrics.samples} sampel HM valid dari ${metrics.transactions} transaksi • ${selected.length} unit dipilih.`;"
new_load = "renderSvg(host.querySelector('.kpp-fc-chart'),metrics);renderSummary(host.querySelector('.kpp-fc-summary-body'),metrics);renderInsight(insight,metrics,s,e,mtdBounds);const exactMtd=s===mtdBounds.start&&e===mtdBounds.end;periodPill.textContent=`${exactMtd?'MTD • ':'PERIODE • '}${shortDate(s)} - ${shortDate(e)}`;status.textContent=`${metrics.samples} sampel HM valid dari ${metrics.transactions} transaksi • ${selected.length} unit dipilih.`;"
fc = replace_once(fc, old_load, new_load, 'load render')

fc_path.write_text(fc, encoding='utf-8')

for html_name in ('dashboard.html','logsheet.html'):
    path=Path(html_name)
    text=path.read_text(encoding='utf-8')
    text=replace_once(text,'fc-chart.js?v=20260912d','fc-chart.js?v=20260912e',html_name+' cache bust')
    path.write_text(text,encoding='utf-8')

test=Path('scripts/test-fc-mtd-context.mjs')
test.write_text("""import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst src=fs.readFileSync('fc-chart.js','utf8');\n\ntest('FC defaults to operational MTD instead of rolling 14 days',()=>{\n  assert.match(src,/operationalMtdBounds/);\n  assert.match(src,/mtdBounds\.start/);\n  assert.doesNotMatch(src,/const start=options\.startDate\|\|addDays\(end,-13\)/);\n});\n\ntest('FC explains active period and gives neutral quick snapshot',()=>{\n  assert.match(src,/data-period-pill/);\n  assert.match(src,/SNAPSHOT \$\{exactMtd\?'MTD':'PERIODE'\}/);\n  assert.match(src,/FC tertinggi:/);\n  assert.match(src,/terendah:/);\n  assert.match(src,/coverage terbaik:/);\n  assert.match(src,/tipe\/EGI yang sama/);\n});\n\ntest('Dashboard and Logsheet load refreshed FC runtime',()=>{\n  for(const file of ['dashboard.html','logsheet.html']){\n    const html=fs.readFileSync(file,'utf8');\n    assert.match(html,/fc-chart\.js\?v=20260912e/);\n  }\n});\n""",encoding='utf-8')

print('FC MTD context patch applied')
