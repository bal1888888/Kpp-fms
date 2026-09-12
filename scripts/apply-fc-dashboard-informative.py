from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)

fc = Path('fc-chart.js')
s = fc.read_text(encoding='utf-8')
s = replace_once(
    s,
    '  const COLORS=["#2563eb","#16a34a","#f97316","#7c3aed"];\n  const MAX_UNITS=4;',
    '  const COLORS=["#2563eb","#16a34a","#f97316","#7c3aed","#dc2626","#0891b2","#ca8a04","#db2777","#4f46e5","#059669"];\n  const MAX_UNITS=10;',
    'palette/max units'
)

style_anchor = '      .kpp-fc-chart{width:100%;overflow-x:auto}.kpp-fc-chart svg{display:block;width:100%;min-width:620px;height:auto}.kpp-fc-empty{padding:28px 10px;text-align:center;color:#64748b;font-size:10px}.kpp-fc-note{margin-top:7px;font-size:8px;color:#64748b;line-height:1.4}.kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}'
style_new = '      .kpp-fc-chart{width:100%;overflow-x:auto}.kpp-fc-chart svg{display:block;width:100%;min-width:620px;height:auto}.kpp-fc-empty{padding:28px 10px;text-align:center;color:#64748b;font-size:10px}.kpp-fc-note{margin-top:7px;font-size:8px;color:#64748b;line-height:1.4}\n      .kpp-fc-summary-card{margin-top:10px;border:1px solid #e2e8f0;border-radius:11px;background:#fff;overflow:hidden}.kpp-fc-summary-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:10px 11px;border-bottom:1px solid #edf1f6}.kpp-fc-summary-head strong{font-size:11px}.kpp-fc-summary-head span{font-size:8.5px;color:#64748b}.kpp-fc-summary-wrap{overflow:auto;-webkit-overflow-scrolling:touch}.kpp-fc-summary-table{width:100%;min-width:720px;border-collapse:collapse}.kpp-fc-summary-table th{position:static;background:#f8fafc;color:#475569;font-size:8px;padding:8px 9px;text-align:center;border-bottom:1px solid #e2e8f0}.kpp-fc-summary-table td{font-size:9px;padding:8px 9px;text-align:center;border-bottom:1px solid #f1f5f9;white-space:nowrap}.kpp-fc-summary-table tr:last-child td{border-bottom:0}.kpp-fc-summary-unit{font-weight:900;color:#0f172a}.kpp-fc-summary-fc{font-weight:900;color:#1d4ed8}.kpp-fc-summary-coverage{font-weight:900}.kpp-fc-summary-coverage.good{color:#15803d}.kpp-fc-summary-coverage.mid{color:#b45309}.kpp-fc-summary-coverage.low{color:#b91c1c}.kpp-fc-status{min-height:15px;margin-top:7px;font-size:9px;color:#64748b}.kpp-fc-status.error{color:#b91c1c}'
s = replace_once(s, style_anchor, style_new, 'summary styles')

start = s.index('  function buildMetrics(rows,baselines,units,start,end){')
end = s.index('  function renderSvg(host,metrics){', start)
new_metrics = '''  function buildMetrics(rows,baselines,units,start,end){
    const perUnit=new Map(units.map(unit=>[unit,{unit,totalFuel:0,validFuel:0,hm:0,samples:0,transactions:0,daily:new Map()}]));
    rows.forEach(row=>{const unit=String(row.unit||"").trim().toUpperCase();if(perUnit.has(unit)){const entry=perUnit.get(unit);entry.totalFuel+=num(row.fuel);entry.transactions+=1;}});
    units.forEach(unit=>{
      const entry=perUnit.get(unit);const unitRows=rows.filter(row=>String(row.unit||"").trim().toUpperCase()===unit).sort((a,b)=>String(a.tanggal).localeCompare(String(b.tanggal))||num(a.id)-num(b.id));
      const base=baselines.get(unit);let previous=base&&Number.isFinite(Number(base.hm_akhir))?Number(base.hm_akhir):null;
      unitRows.forEach(row=>{const hmRaw=row.hm_akhir;const hm=hmRaw===null||hmRaw===undefined||hmRaw===""?null:Number(hmRaw);if(!Number.isFinite(hm)){return;}let delta=null;if(Number.isFinite(previous)&&hm>=previous)delta=hm-previous;if(Number.isFinite(previous)&&hm<previous){delta=null;return;}previous=hm;if(!(delta>0))return;const fuel=num(row.fuel);entry.hm+=delta;entry.validFuel+=fuel;entry.samples+=1;const day=entry.daily.get(row.tanggal)||{fuel:0,hm:0};day.fuel+=fuel;day.hm+=delta;entry.daily.set(row.tanggal,day);});
    });
    const dates=dateList(start,end);const series=units.map((unit,index)=>{const entry=perUnit.get(unit);return {unit,color:COLORS[index%COLORS.length],values:dates.map(date=>{const d=entry.daily.get(date);return d&&d.hm>0?d.fuel/d.hm:null;})};});
    const list=Array.from(perUnit.values());const totalFuel=list.reduce((s,x)=>s+x.totalFuel,0);const validFuel=list.reduce((s,x)=>s+x.validFuel,0);const totalHm=list.reduce((s,x)=>s+x.hm,0);const samples=list.reduce((s,x)=>s+x.samples,0);const transactions=list.reduce((s,x)=>s+x.transactions,0);const coverage=transactions>0?(samples/transactions)*100:0;
    const summaries=units.map(unit=>{const x=perUnit.get(unit);return {unit,totalFuel:x.totalFuel,validFuel:x.validFuel,hm:x.hm,samples:x.samples,transactions:x.transactions,coverage:x.transactions>0?(x.samples/x.transactions)*100:0,fc:x.hm>0?x.validFuel/x.hm:null};});
    return {dates,series,totalFuel,validFuel,totalHm,samples,transactions,coverage,summaries,avg:totalHm>0?validFuel/totalHm:null};
  }

  function renderSummary(host,metrics){
    host.innerHTML=metrics.summaries.map(item=>{const coverageClass=item.coverage>=80?'good':item.coverage>=50?'mid':'low';return `<tr><td class="kpp-fc-summary-unit">${esc(item.unit)}</td><td class="kpp-fc-summary-fc">${item.fc===null?'-':fmtFc(item.fc)+' L/HM'}</td><td>${fmt(item.totalFuel)} L</td><td>${fmt(item.hm)} HM</td><td>${item.samples} / ${item.transactions}</td><td class="kpp-fc-summary-coverage ${coverageClass}">${fmtFc(item.coverage)}%</td></tr>`;}).join('')||'<tr><td colspan="6">Belum ada unit dipilih.</td></tr>';
  }

'''
s = s[:start] + new_metrics + s[end:]

old_html = '    host.innerHTML=`<section class="kpp-fc-widget"><div class="kpp-fc-head"><div><h3>${esc(options.title||"Grafik FC per Unit")}</h3><p>FC = total fuel pada sampel HM valid ÷ total HM jalan. Pilih unit dan rentang tanggal.</p></div>${collapsible?\'<button type="button" class="kpp-fc-toggle"></button>\':\'\'}</div><div class="kpp-fc-body" ${collapsed?\'hidden\':\'\'}><div class="kpp-fc-filters"><div class="kpp-fc-field units"><label>PILIH UNIT</label><div class="kpp-fc-unit-picker"><button type="button" class="kpp-fc-unit-trigger"><span class="kpp-fc-chip-wrap"><span class="kpp-fc-picker-placeholder">Memuat unit...</span></span><span>⌄</span></button><div class="kpp-fc-unit-menu" hidden><input class="kpp-fc-unit-search" type="search" placeholder="Cari code unit..."><div class="kpp-fc-unit-list"></div></div></div></div><div class="kpp-fc-field"><label>TANGGAL AWAL</label><input class="kpp-fc-start" type="date" value="${start}"></div><div class="kpp-fc-field"><label>TANGGAL AKHIR</label><input class="kpp-fc-end" type="date" value="${end}"></div><button class="kpp-fc-run" type="button">TAMPILKAN GRAFIK</button></div><div class="kpp-fc-kpis"><div class="kpp-fc-kpi blue"><small>RATA-RATA FC</small><strong data-kpi="avg">-</strong></div><div class="kpp-fc-kpi green"><small>TOTAL FUEL</small><strong data-kpi="fuel">-</strong></div><div class="kpp-fc-kpi amber"><small>TOTAL HM JALAN</small><strong data-kpi="hm">-</strong></div><div class="kpp-fc-kpi purple"><small>JUMLAH PENGISIAN</small><strong data-kpi="count">-</strong></div></div><div class="kpp-fc-chart-card"><div class="kpp-fc-chart-top"><span class="kpp-fc-chart-title">Trend FC per Unit (L/HM)</span><div class="kpp-fc-legend"></div></div><div class="kpp-fc-chart"><div class="kpp-fc-empty">Pilih unit lalu tampilkan grafik.</div></div><div class="kpp-fc-note">HM jalan grafik dihitung dari selisih HM transaksi berurutan per unit. HM turun/reset tidak dipaksa menjadi nilai negatif.</div></div><div class="kpp-fc-status"></div></div></section>`;'
new_html = '    host.innerHTML=`<section class="kpp-fc-widget"><div class="kpp-fc-head"><div><h3>${esc(options.title||"Grafik FC per Unit")}</h3><p>Bandingkan sampai 10 unit. FC gabungan berbobot HM valid, bukan rata-rata aritmatik antar unit.</p></div>${collapsible?\'<button type="button" class="kpp-fc-toggle"></button>\':\'\'}</div><div class="kpp-fc-body" ${collapsed?\'hidden\':\'\'}><div class="kpp-fc-filters"><div class="kpp-fc-field units"><label>PILIH UNIT (MAKS. 10)</label><div class="kpp-fc-unit-picker"><button type="button" class="kpp-fc-unit-trigger"><span class="kpp-fc-chip-wrap"><span class="kpp-fc-picker-placeholder">Memuat unit...</span></span><span>⌄</span></button><div class="kpp-fc-unit-menu" hidden><input class="kpp-fc-unit-search" type="search" placeholder="Cari code unit..."><div class="kpp-fc-unit-list"></div></div></div></div><div class="kpp-fc-field"><label>TANGGAL AWAL</label><input class="kpp-fc-start" type="date" value="${start}"></div><div class="kpp-fc-field"><label>TANGGAL AKHIR</label><input class="kpp-fc-end" type="date" value="${end}"></div><button class="kpp-fc-run" type="button">TAMPILKAN GRAFIK</button></div><div class="kpp-fc-kpis"><div class="kpp-fc-kpi blue"><small>FC GABUNGAN TERPILIH</small><strong data-kpi="avg">-</strong></div><div class="kpp-fc-kpi green"><small>TOTAL FUEL TERPILIH</small><strong data-kpi="fuel">-</strong></div><div class="kpp-fc-kpi amber"><small>HM JALAN VALID</small><strong data-kpi="hm">-</strong></div><div class="kpp-fc-kpi purple"><small>COVERAGE HM</small><strong data-kpi="count">-</strong></div></div><div class="kpp-fc-chart-card"><div class="kpp-fc-chart-top"><span class="kpp-fc-chart-title">Trend FC Harian per Unit (L/HM)</span><div class="kpp-fc-legend"></div></div><div class="kpp-fc-chart"><div class="kpp-fc-empty">Pilih unit lalu tampilkan grafik.</div></div><div class="kpp-fc-note">HM jalan dihitung dari selisih HM transaksi berurutan per unit. HM turun/reset diabaikan. FC hanya memakai transaksi yang punya pasangan HM valid.</div></div><div class="kpp-fc-summary-card"><div class="kpp-fc-summary-head"><strong>Ringkasan Unit Terpilih</strong><span>Coverage = sampel HM valid ÷ total transaksi unit.</span></div><div class="kpp-fc-summary-wrap"><table class="kpp-fc-summary-table"><thead><tr><th>UNIT</th><th>FC AVG</th><th>FUEL TOTAL</th><th>HM JALAN VALID</th><th>SAMPEL VALID</th><th>COVERAGE HM</th></tr></thead><tbody class="kpp-fc-summary-body"><tr><td colspan="6">Pilih unit lalu tampilkan grafik.</td></tr></tbody></table></div></div><div class="kpp-fc-status"></div></div></section>`;'
s = replace_once(s, old_html, new_html, 'widget html')

s = replace_once(s, "'<span class=\"kpp-fc-picker-placeholder\">Pilih maksimal 4 unit</span>'", "'<span class=\"kpp-fc-picker-placeholder\">Pilih maksimal 10 unit</span>'", 'picker placeholder')
s = replace_once(s, "status.textContent='Maksimal 4 unit agar grafik tetap terbaca.'", "status.textContent='Maksimal 10 unit. Jika grafik terasa ramai, kurangi unit yang dipilih.'", 'max unit message')

old_load = "host.querySelector('[data-kpi=\"avg\"]').textContent=metrics.avg===null?'-':fmtFc(metrics.avg)+' L/HM';host.querySelector('[data-kpi=\"fuel\"]').textContent=fmt(metrics.totalFuel)+' L';host.querySelector('[data-kpi=\"hm\"]').textContent=fmt(metrics.totalHm)+' HM';host.querySelector('[data-kpi=\"count\"]').textContent=rows.length+' transaksi';host.querySelector('.kpp-fc-legend').innerHTML=metrics.series.map(s=>`<span class=\"kpp-fc-legend-item\"><i class=\"kpp-fc-dot\" style=\"background:${s.color}\"></i>${esc(s.unit)}</span>`).join('');renderSvg(host.querySelector('.kpp-fc-chart'),metrics);status.textContent=`${metrics.samples} sampel HM valid dari ${rows.length} transaksi.`;"
new_load = "host.querySelector('[data-kpi=\"avg\"]').textContent=metrics.avg===null?'-':fmtFc(metrics.avg)+' L/HM';host.querySelector('[data-kpi=\"fuel\"]').textContent=fmt(metrics.totalFuel)+' L';host.querySelector('[data-kpi=\"hm\"]').textContent=fmt(metrics.totalHm)+' HM';host.querySelector('[data-kpi=\"count\"]').textContent=`${metrics.samples}/${metrics.transactions} • ${fmtFc(metrics.coverage)}%`;host.querySelector('.kpp-fc-legend').innerHTML=metrics.series.map(s=>`<span class=\"kpp-fc-legend-item\"><i class=\"kpp-fc-dot\" style=\"background:${s.color}\"></i>${esc(s.unit)}</span>`).join('');renderSvg(host.querySelector('.kpp-fc-chart'),metrics);renderSummary(host.querySelector('.kpp-fc-summary-body'),metrics);status.textContent=`${metrics.samples} sampel HM valid dari ${metrics.transactions} transaksi • ${selected.length} unit dipilih.`;"
s = replace_once(s, old_load, new_load, 'load metrics rendering')
fc.write_text(s, encoding='utf-8')

# Dashboard: remove the obsolete all-unit MTD block, keep transaction-level FC helper.
dash = Path('dashboard.html')
d = dash.read_text(encoding='utf-8')
d = replace_once(d, '<script src="fc-chart.js?v=20260912c"></script>', '<script src="fc-chart.js?v=20260912d"></script>', 'dashboard fc cache bust')
section_start = d.index('  <div class="section" id="fcSection">')
section_end = d.index('  <div class="operations-grid">', section_start)
d = d[:section_start] + d[section_end:]
fn_start = d.index('function buildFcByUnit(rows){')
fn_end = d.index('function localDate(){', fn_start)
d = d[:fn_start] + d[fn_end:]
d = d.replace('    renderFuelConsumption(mtdRows);\n', '', 1)
dash.write_text(d, encoding='utf-8')

# Logsheet uses the same widget. Cache-bust there as well.
log = Path('logsheet.html')
l = log.read_text(encoding='utf-8')
l = replace_once(l, 'fc-chart.js?v=20260912c', 'fc-chart.js?v=20260912d', 'logsheet fc cache bust')
log.write_text(l, encoding='utf-8')

# Regression guard.
test = Path('scripts/test-fc-dashboard-informative.mjs')
test.write_text('''import fs from "node:fs";\n\nconst fc=fs.readFileSync("fc-chart.js","utf8");\nconst dash=fs.readFileSync("dashboard.html","utf8");\nconst log=fs.readFileSync("logsheet.html","utf8");\nconst ok=(cond,msg)=>{if(!cond){console.error("FAIL:",msg);process.exit(1);}};\nok(fc.includes("const MAX_UNITS=10"),"FC picker should allow 10 units");\nok(fc.includes("Ringkasan Unit Terpilih"),"selected-unit summary should exist");\nok(fc.includes("COVERAGE HM"),"coverage KPI should exist");\nok(fc.includes("metrics.samples}/${metrics.transactions}"),"coverage KPI should show valid/total samples");\nok(fc.includes("Maksimal 10 unit"),"10-unit guard copy should exist");\nok(!dash.includes('id="fcSection"'),"legacy duplicate MTD FC section should be removed");\nok(!dash.includes("renderFuelConsumption(mtdRows)"),"legacy FC renderer should not run");\nok(dash.includes("fc-chart.js?v=20260912d"),"dashboard should use new FC asset version");\nok(log.includes("fc-chart.js?v=20260912d"),"logsheet should use new FC asset version");\nconsole.log("FC dashboard informative checks passed");\n''', encoding='utf-8')
