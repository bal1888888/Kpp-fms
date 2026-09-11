from pathlib import Path
import json

DASH = Path('dashboard.html')
CSS = Path('dashboard-ui.css')
PKG = Path('package.json')
TEST = Path('scripts/test-dashboard-premium-radial.mjs')
WF = Path('.github/workflows/tmp-dashboard-premium.yml')
SELF = Path('scripts/tmp_dashboard_premium.py')

# ---- dashboard JS ----
text = DASH.read_text(encoding='utf-8')
usage_start = text.find('function renderUsageTrend(rows,endDate){')
stock_start = text.find('\nfunction renderStockTrend(points,endDate){', usage_start)
receipts_start = text.find('\nfunction renderReceipts(rows){', stock_start)
if min(usage_start, stock_start, receipts_start) < 0:
    raise SystemExit('dashboard trend function anchors not found')

new_usage = r'''function renderUsageTrend(rows,endDate){
  const dates=lastDates(endDate,5);
  const sums=Object.fromEntries(dates.map(d=>[d,0]));
  rows.forEach(row=>{if(Object.prototype.hasOwnProperty.call(sums,row.tanggal))sums[row.tanggal]+=n(row.fuel)});

  const activeDates=dates.filter(d=>n(sums[d])>0);
  const values=activeDates.map(d=>n(sums[d]));
  const max=Math.max(...values,1);
  const host=document.getElementById("usageTrendBars");

  if(!activeDates.length){
    host.innerHTML='<div class="trend-radial-empty">Belum ada pemakaian.</div>';
  }else{
    host.innerHTML=activeDates.map((d,i)=>{
      const value=values[i];
      const ringPct=Math.max(6,Math.min((value/max)*100,100));
      const parts=d.split("-");
      const month=["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"][Math.max(0,Number(parts[1])-1)]||parts[1];
      const label=`${parts[2]} ${month}`;
      const compact=value>=1000?`${formatIto(value/1000)}K`:formatAngka(value);
      return `<div class="trend-radial-item usage-radial-item${i===activeDates.length-1?" is-latest":""}">
        <div class="trend-radial-label">${label}</div>
        <div class="usage-trend-ring" style="--usage-pct:${ringPct}" title="${formatAngka(value)} L">
          <div class="usage-ring-inner"><strong>${compact}</strong><small>L</small></div>
        </div>
        <div class="trend-ring-liter">${formatAngka(value)} L</div>
        <div class="trend-ring-caption">PEMAKAIAN</div>
      </div>`;
    }).join("");
  }

  const badge=document.getElementById("usageTrendBadge");
  if(!values.length){badge.className="trend-badge flat";badge.textContent="Belum ada data";return;}
  if(values.length===1){badge.className="trend-badge flat";badge.textContent="1 hari data";return;}
  const latest=values[values.length-1];
  const previous=values[values.length-2];
  if(previous<=0){badge.className="trend-badge up";badge.textContent="▲ Naik";return;}
  const change=((latest-previous)/previous)*100;
  if(Math.abs(change)<0.05){badge.className="trend-badge flat";badge.textContent="• Stabil";}
  else if(change>0){badge.className="trend-badge up";badge.textContent=`▲ ${formatIto(Math.abs(change))}%`;}
  else{badge.className="trend-badge down";badge.textContent=`▼ ${formatIto(Math.abs(change))}%`;}
}
'''

new_stock = r'''function renderStockTrend(points,endDate){
  const dates=lastDates(endDate,5);
  const byDate=Object.fromEntries((points||[]).map(p=>[p.tanggal,n(p.total)]));
  const availableDates=dates.filter(d=>Object.prototype.hasOwnProperty.call(byDate,d));
  const values=availableDates.map(d=>n(byDate[d]));
  const host=document.getElementById("stockTrendBars");

  if(!availableDates.length){
    host.innerHTML='<div class="trend-radial-empty">Belum ada posisi stock.</div>';
  }else{
    host.innerHTML=availableDates.map((d,i)=>{
      const value=values[i];
      const parts=d.split("-");
      const month=["JAN","FEB","MAR","APR","MEI","JUN","JUL","AGU","SEP","OKT","NOV","DES"][Math.max(0,Number(parts[1])-1)]||parts[1];
      const label=`${parts[2]} ${month}`;
      const state=stockLevelState(value);
      const levelPct=TOTAL_CAPACITY>0?(value/TOTAL_CAPACITY)*100:0;
      const ringPct=Math.max(0,Math.min(levelPct,100));
      const stateText=state==="critical"?"KRITIS":state==="low"?"RENDAH":state==="high"?"TINGGI":"AMAN";
      return `<div class="trend-radial-item stock-radial-item ${state}${i===availableDates.length-1?" is-latest":""}">
        <div class="trend-radial-label">${label}</div>
        <div class="stock-trend-ring ${state}" style="--trend-pct:${ringPct}" title="${formatAngka(value)} L">
          <span>${formatIto(levelPct)}%</span>
        </div>
        <div class="trend-ring-liter">${formatAngka(value)} L</div>
        <div class="trend-stock-status ${state}">${stateText}</div>
      </div>`;
    }).join("");
  }

  const badge=document.getElementById("stockTrendBadge");
  if(!values.length){badge.className="trend-badge flat";badge.textContent="Belum ada data";return;}
  const latest=values[values.length-1];
  const previous=values.length>1?values[values.length-2]:0;
  const latestPct=TOTAL_CAPACITY>0?(latest/TOTAL_CAPACITY)*100:0;
  const state=stockLevelState(latest);
  const levelText=state==="critical"?" • KRITIS":state==="low"?" • RENDAH":state==="high"?" • TINGGI":" • AMAN";
  if(values.length===1||previous<=0){badge.className=state==="critical"?"trend-badge stock-down":"trend-badge stock-up";badge.textContent=`${formatIto(latestPct)}%${levelText}`;return;}
  const change=((latest-previous)/previous)*100;
  if(Math.abs(change)<0.05){badge.className="trend-badge flat";badge.textContent=`• Stabil ${formatIto(latestPct)}%${levelText}`;}
  else if(change>0){badge.className="trend-badge stock-up";badge.textContent=`▲ ${formatIto(Math.abs(change))}%${levelText}`;}
  else{badge.className="trend-badge stock-down";badge.textContent=`▼ ${formatIto(Math.abs(change))}%${levelText}`;}
}
'''

text = text[:usage_start] + new_usage + '\n' + new_stock + text[receipts_start:]
DASH.write_text(text, encoding='utf-8')

# ---- premium CSS ----
css = CSS.read_text(encoding='utf-8')
marker = '/* ===== KPP-FMS PREMIUM RADIAL PERFORMANCE v2 ===== */'
if marker not in css:
    css += r'''

/* ===== KPP-FMS PREMIUM RADIAL PERFORMANCE v2 ===== */
.dashboard-workspace .performance-section{
  border-color:#c9d9ed;
  background:linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)!important;
}
.dashboard-workspace .performance-section .usage-card,
.dashboard-workspace .performance-section .stock-trend-card{
  position:relative;
  overflow:hidden;
  padding:18px!important;
}
.dashboard-workspace .performance-section .usage-card{
  border:1px solid #bfdbfe!important;
  background:linear-gradient(160deg,#ffffff 0%,#f3f8ff 100%)!important;
  box-shadow:0 10px 28px rgba(37,99,235,.07)!important;
}
.dashboard-workspace .performance-section .stock-trend-card{
  border:1px solid #86efac!important;
  background:linear-gradient(160deg,#ffffff 0%,#f0fdf4 100%)!important;
  box-shadow:0 12px 30px rgba(22,163,74,.10)!important;
}
.dashboard-workspace .performance-section .stock-trend-card::before,
.dashboard-workspace .performance-section .usage-card::before{
  content:"";position:absolute;left:0;right:0;top:0;height:4px;
}
.dashboard-workspace .performance-section .stock-trend-card::before{background:linear-gradient(90deg,#16a34a,#4ade80)}
.dashboard-workspace .performance-section .usage-card::before{background:linear-gradient(90deg,#2563eb,#60a5fa)}
.dashboard-workspace .performance-section .overview-title{font-size:16px;font-weight:900;color:#10213a}
.dashboard-workspace .performance-section .overview-sub{font-size:10px;color:#718197}

.dashboard-workspace #usageTrendBars.usage-bars,
.dashboard-workspace #stockTrendBars.usage-bars{
  height:auto!important;
  min-height:0!important;
  display:grid!important;
  grid-template-columns:repeat(auto-fit,minmax(64px,1fr))!important;
  align-items:stretch!important;
  gap:9px!important;
  padding:9px 0 0!important;
  border-bottom:0!important;
  overflow:visible!important;
}
.dashboard-workspace .trend-radial-item{
  min-width:0;
  padding:9px 5px 8px;
  border:1px solid #e1e8f2;
  border-radius:14px;
  background:rgba(255,255,255,.92);
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:flex-start;
  text-align:center;
  box-shadow:0 5px 16px rgba(15,23,42,.045);
}
.dashboard-workspace .trend-radial-item.is-latest{
  transform:translateY(-2px);
  box-shadow:0 10px 20px rgba(15,23,42,.09);
}
.dashboard-workspace .stock-radial-item.is-latest{border-color:#4ade80;background:#f7fff9}
.dashboard-workspace .usage-radial-item.is-latest{border-color:#93c5fd;background:#f8fbff}
.dashboard-workspace .trend-radial-label{
  width:100%;margin-bottom:7px;color:#20324d;font-size:11px;font-weight:900;letter-spacing:.04em;white-space:nowrap;
}
.dashboard-workspace .trend-ring-liter{
  margin-top:7px;color:#0f172a;font-size:10px;font-weight:900;line-height:1.15;white-space:nowrap;
}
.dashboard-workspace .trend-ring-caption{
  margin-top:3px;color:#6b7d94;font-size:7px;font-weight:900;letter-spacing:.08em;
}
.dashboard-workspace .trend-stock-status{
  margin-top:4px;padding:3px 6px;border-radius:999px;font-size:7px;font-weight:900;letter-spacing:.05em;
}
.dashboard-workspace .trend-stock-status.safe{background:#dcfce7;color:#166534}
.dashboard-workspace .trend-stock-status.low{background:#fef3c7;color:#92400e}
.dashboard-workspace .trend-stock-status.critical{background:#fee2e2;color:#991b1b}
.dashboard-workspace .trend-stock-status.high{background:#ffedd5;color:#9a3412}

.dashboard-workspace .stock-trend-ring{
  width:76px!important;aspect-ratio:1!important;border-radius:50%!important;display:grid!important;place-items:center!important;
  position:relative!important;background:conic-gradient(var(--trend-color) calc(var(--trend-pct)*1%),#e8edf4 0)!important;
  box-shadow:0 0 0 5px rgba(255,255,255,.8),0 7px 16px rgba(15,23,42,.08);
}
.dashboard-workspace .stock-trend-ring::before{inset:8px!important}
.dashboard-workspace .stock-trend-ring span{font-size:12px!important}

.dashboard-workspace .usage-trend-ring{
  --usage-pct:0;
  width:76px;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;position:relative;
  background:conic-gradient(#2563eb calc(var(--usage-pct)*1%),#e8edf4 0);
  box-shadow:0 0 0 5px rgba(255,255,255,.8),0 7px 16px rgba(37,99,235,.10);
}
.dashboard-workspace .usage-trend-ring::before{content:"";position:absolute;inset:8px;border-radius:50%;background:#fff}
.dashboard-workspace .usage-ring-inner{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;line-height:1}
.dashboard-workspace .usage-ring-inner strong{color:#1d4ed8;font-size:12px;font-weight:900;letter-spacing:-.02em}
.dashboard-workspace .usage-ring-inner small{margin-top:3px;color:#64748b;font-size:7px;font-weight:900}
.dashboard-workspace .trend-radial-empty{grid-column:1/-1;padding:18px;border:1px dashed #cbd5e1;border-radius:12px;background:#fff;color:#64748b;font-size:11px;font-weight:800;text-align:center}

@media(max-width:720px){
  .dashboard-workspace .performance-section{padding:15px!important}
  .dashboard-workspace .performance-section .usage-card,
  .dashboard-workspace .performance-section .stock-trend-card{padding:14px 10px!important}
  .dashboard-workspace #usageTrendBars.usage-bars,
  .dashboard-workspace #stockTrendBars.usage-bars{
    grid-template-columns:repeat(auto-fit,minmax(54px,1fr))!important;
    gap:5px!important;
    padding-top:8px!important;
  }
  .dashboard-workspace .trend-radial-item{padding:7px 2px 6px;border-radius:11px}
  .dashboard-workspace .trend-radial-label{font-size:8px;margin-bottom:5px;letter-spacing:0}
  .dashboard-workspace .stock-trend-ring,
  .dashboard-workspace .usage-trend-ring{width:50px!important}
  .dashboard-workspace .stock-trend-ring::before,
  .dashboard-workspace .usage-trend-ring::before{inset:6px!important}
  .dashboard-workspace .stock-trend-ring span{font-size:8px!important}
  .dashboard-workspace .usage-ring-inner strong{font-size:8px}.dashboard-workspace .usage-ring-inner small{font-size:6px;margin-top:2px}
  .dashboard-workspace .trend-ring-liter{font-size:7px;margin-top:5px}
  .dashboard-workspace .trend-ring-caption,.dashboard-workspace .trend-stock-status{font-size:6px}
  .dashboard-workspace .trend-stock-status{padding:2px 4px;margin-top:3px}
  .dashboard-workspace .trend-radial-item.is-latest{transform:none}
  .dashboard-workspace .performance-section .overview-title{font-size:15px}
}
@media(max-width:360px){
  .dashboard-workspace #usageTrendBars.usage-bars,
  .dashboard-workspace #stockTrendBars.usage-bars{grid-template-columns:repeat(auto-fit,minmax(48px,1fr))!important;gap:4px!important}
  .dashboard-workspace .stock-trend-ring,.dashboard-workspace .usage-trend-ring{width:45px!important}
  .dashboard-workspace .trend-ring-liter{font-size:6.5px}
}
'''
    CSS.write_text(css, encoding='utf-8')

# ---- regression test ----
TEST.write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const dashboard=await readFile(new URL("../dashboard.html",import.meta.url),"utf8");
const css=await readFile(new URL("../dashboard-ui.css",import.meta.url),"utf8");

function between(source,start,end){
  const a=source.indexOf(start);
  const b=source.indexOf(end,a+start.length);
  assert.ok(a>=0,`missing ${start}`);
  assert.ok(b>a,`missing ${end}`);
  return source.slice(a,b);
}

test("daily usage only renders dates with usage",()=>{
  const block=between(dashboard,"function renderUsageTrend(rows,endDate){","function renderStockTrend(points,endDate){");
  assert.match(block,/activeDates=dates\.filter\(d=>n\(sums\[d\]\)>0\)/);
  assert.match(block,/usage-trend-ring/);
  assert.match(block,/usage-radial-item/);
  assert.doesNotMatch(block,/usage-bar\"/);
});

test("stock trend shows readable premium radial items",()=>{
  const block=between(dashboard,"function renderStockTrend(points,endDate){","function renderReceipts(rows){");
  assert.match(block,/availableDates=dates\.filter/);
  assert.match(block,/trend-radial-label/);
  assert.match(block,/trend-stock-status/);
  assert.match(block,/is-latest/);
});

test("premium dashboard radial css keeps phone layout compact",()=>{
  assert.match(css,/KPP-FMS PREMIUM RADIAL PERFORMANCE v2/);
  assert.match(css,/#usageTrendBars\.usage-bars/);
  assert.match(css,/#stockTrendBars\.usage-bars/);
  assert.match(css,/grid-template-columns:repeat\(auto-fit,minmax\(54px,1fr\)\)!important/);
});
''',encoding='utf-8')

pkg=json.loads(PKG.read_text(encoding='utf-8'))
check=pkg.get('scripts',{}).get('check','')
test_cmd='node --test scripts/test-dashboard-premium-radial.mjs'
if test_cmd not in check:
    pkg['scripts']['check']=check.rstrip()+' && '+test_cmd
    PKG.write_text(json.dumps(pkg,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')

# Cleanup temporary runner files so they never land in main.
for p in (WF,SELF):
    if p.exists():
        p.unlink()
