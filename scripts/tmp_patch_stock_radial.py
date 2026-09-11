from pathlib import Path
import json

path = Path('stock.html')
source = path.read_text(encoding='utf-8')

source = source.replace(
    '<!-- KPP-FMS STOCK v9.12: source/destination sounding as transfer authority -->',
    '<!-- KPP-FMS STOCK v9.13: compact radial stock gauges; transaction logic unchanged -->',
    1,
)

marker = '/* ===== KPP-FMS STOCK RADIAL GAUGES v1 ===== */'
if marker not in source:
    css = r'''

/* ===== KPP-FMS STOCK RADIAL GAUGES v1 ===== */
.stock-position-panel .cards{
  grid-template-columns:repeat(auto-fit,minmax(205px,1fr));
  gap:14px;
}
.stock-position-panel .stock-gauge-card,
.stock-position-panel .stock-gauge-card.capacity-safe,
.stock-position-panel .stock-gauge-card.capacity-low,
.stock-position-panel .stock-gauge-card.capacity-critical,
.stock-position-panel .stock-gauge-card.capacity-high{
  min-width:0;
  padding:14px 12px 12px!important;
  display:flex;
  flex-direction:column;
  align-items:center;
  border-left-width:1px!important;
  background:#fff!important;
}
.stock-gauge-context{
  width:100%;
  min-height:19px;
  margin-bottom:6px;
  text-align:center;
  color:#64748b;
  font-size:10px;
  font-weight:800;
  letter-spacing:.02em;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.stock-radial{
  --ring-pct:0;
  --ring-color:#16a34a;
  width:148px;
  aspect-ratio:1;
  border-radius:50%;
  position:relative;
  display:grid;
  place-items:center;
  background:conic-gradient(var(--ring-color) calc(var(--ring-pct) * 1%),#e8edf4 0);
  box-shadow:inset 0 0 0 1px rgba(148,163,184,.12);
}
.stock-radial::before{
  content:"";
  position:absolute;
  inset:13px;
  border-radius:50%;
  background:#fff;
  box-shadow:inset 0 0 0 1px #edf1f6;
}
.stock-radial-inner{
  position:relative;
  z-index:1;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  text-align:center;
  line-height:1.05;
}
.stock-radial-code{
  max-width:112px;
  color:#0f172a;
  font-size:15px;
  font-weight:900;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.stock-radial-percent{
  margin-top:7px;
  color:var(--ring-color);
  font-size:25px;
  font-weight:900;
  letter-spacing:-.03em;
}
.stock-radial-status{
  margin-top:7px;
  padding:4px 9px;
  border-radius:999px;
  color:var(--ring-color);
  background:#f8fafc;
  font-size:9px;
  font-weight:900;
  letter-spacing:.04em;
}
.stock-radial.safe{--ring-color:#16a34a}
.stock-radial.low{--ring-color:#f59e0b}
.stock-radial.critical{--ring-color:#ef4444}
.stock-radial.high{--ring-color:#f97316}
.stock-gauge-metrics{
  width:100%;
  display:grid;
  grid-template-columns:1fr 1fr;
  margin-top:12px;
  border-top:1px solid #eef2f7;
  padding-top:10px;
}
.stock-gauge-metric{
  min-width:0;
  text-align:center;
  padding:0 6px;
}
.stock-gauge-metric + .stock-gauge-metric{border-left:1px solid #e5e7eb}
.stock-gauge-metric strong{
  display:block!important;
  margin:0!important;
  color:#0f172a!important;
  font-size:14px!important;
  line-height:1.2;
  white-space:nowrap;
}
.stock-gauge-metric small{
  display:block;
  margin-top:3px;
  color:#64748b!important;
  font-size:9px!important;
  font-weight:700;
}
.stock-gauge-card .stock-sounding-estimate{
  width:100%;
  min-height:auto;
  margin-top:9px;
  padding:7px 8px;
  border:0;
  border-radius:8px;
  background:#f8fafc;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
}
.stock-gauge-card .stock-sounding-estimate span,
.stock-gauge-card .stock-sounding-estimate b{
  margin:0;
  font-size:9px;
  line-height:1.2;
}
.stock-gauge-card .stock-sounding-estimate b{font-size:10px}
.stock-total-card{min-height:78px}
.stock-total-side{display:flex;justify-content:flex-end}
.stock-total-compact{
  min-width:230px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  padding:10px 12px;
  border:1px solid #e5e7eb;
  border-radius:10px;
  background:#f8fafc;
}
.stock-total-compact span{color:#64748b;font-size:10px;font-weight:800}
.stock-total-compact strong{font-size:13px;white-space:nowrap}
@media(max-width:700px){
  .stock-position-panel .cards{
    grid-template-columns:repeat(2,minmax(0,1fr));
    gap:8px;
  }
  .stock-position-panel .stock-gauge-card{padding:10px 7px 8px!important}
  .stock-radial{width:min(118px,100%)}
  .stock-radial::before{inset:10px}
  .stock-radial-code{max-width:88px;font-size:12px}
  .stock-radial-percent{font-size:20px;margin-top:5px}
  .stock-radial-status{font-size:8px;margin-top:5px;padding:3px 7px}
  .stock-gauge-context{font-size:8px;margin-bottom:5px}
  .stock-gauge-metrics{margin-top:8px;padding-top:8px}
  .stock-gauge-metric{padding:0 3px}
  .stock-gauge-metric strong{font-size:11px!important}
  .stock-gauge-metric small{font-size:8px!important}
  .stock-gauge-card .stock-sounding-estimate{padding:6px;margin-top:7px}
  .stock-gauge-card .stock-sounding-estimate span{font-size:8px}
  .stock-gauge-card .stock-sounding-estimate b{font-size:9px}
  .stock-total-card{flex-direction:row;align-items:center}
  .stock-total-main strong{font-size:25px}
  .stock-total-side{width:auto;min-width:0;justify-content:flex-end}
  .stock-total-compact{min-width:0;display:block;text-align:right;padding:8px 9px}
  .stock-total-compact span,.stock-total-compact strong{display:block}
  .stock-total-compact strong{margin-top:3px;font-size:11px}
}
@media(max-width:360px){
  .stock-radial{width:104px}
  .stock-gauge-metric strong{font-size:10px!important}
}
'''
    source = source.replace('</style>', css + '\n</style>', 1)

start = source.find('function renderStockCards(stock){')
end = source.find('\nfunction renderClosing', start)
if start < 0 or end < 0:
    raise SystemExit('renderStockCards block not found')

replacement = r'''function renderStockCards(stock){
    const total=Object.values(stock).reduce((sum,value)=>sum+n(value),0);
    const cards=document.getElementById("stockCards");
    cards.innerHTML="";

    STORAGES.forEach(storage=>{
        const row=storageRow(storage);
        const context=row?.warehouse ? row.warehouse : (row?.display_name && row.display_name!==storage ? row.display_name : "");
        const cap=capacity(storage);
        const p=capacityPercent(storage,stock[storage]);
        const state=capacityState(storage,stock[storage]);
        const ringPct=Math.max(0,Math.min(p,100));
        const estimatedHeight=teraHeightForLiters(
            storage,
            Math.max(0,n(stock[storage]))
        );

        const cardClass=state==="critical"?"capacity-critical":state==="low"?"capacity-low":state==="high"?"capacity-high":"capacity-safe";
        const statusText=state==="critical"?"KRITIS":state==="low"?"RENDAH":state==="high"?"TINGGI":"AMAN";
        const soundingText=estimatedHeight===null || estimatedHeight===undefined
            ? "-"
            : "~ "+fmtCm(estimatedHeight);

        cards.innerHTML+=`
        <div class="card stock-gauge-card ${cardClass}">
            <div class="stock-gauge-context">${esc(context||"STORAGE FUEL")}</div>
            <div class="stock-radial ${state}" style="--ring-pct:${ringPct}">
                <div class="stock-radial-inner">
                    <span class="stock-radial-code">${esc(storage)}</span>
                    <span class="stock-radial-percent">${pct(p)}%</span>
                    <span class="stock-radial-status">${statusText}</span>
                </div>
            </div>
            <div class="stock-gauge-metrics">
                <div class="stock-gauge-metric">
                    <strong>${fmt(stock[storage])}</strong>
                    <small>STOCK</small>
                </div>
                <div class="stock-gauge-metric">
                    <strong>${fmt(cap)}</strong>
                    <small>KAPASITAS</small>
                </div>
            </div>
            <div class="stock-sounding-estimate">
                <span>Sonding estimasi</span>
                <b>${soundingText}</b>
            </div>
        </div>`;
    });

    const totalPct=TOTAL_CAPACITY>0 ? (total/TOTAL_CAPACITY)*100 : 0;
    const totalState=totalPct<STOCK_CRITICAL_PCT?"critical":totalPct<STOCK_WARNING_PCT?"low":totalPct>=CAPACITY_WARNING_PCT?"high":"safe";
    const totalCardClass=totalState==="critical"?"capacity-critical":totalState==="low"?"capacity-low":totalState==="high"?"capacity-high":"capacity-safe";
    const totalStatus=totalState==="critical"?"KRITIS":totalState==="low"?"RENDAH":totalState==="high"?"TINGGI":"AMAN";

    document.getElementById("stockTotalWide").innerHTML=`
    <div class="stock-total-card ${totalCardClass}">
        <div class="stock-total-main">
            <small>TOTAL STOCK ALL WHS</small>
            <strong>${fmt(total)}</strong>
        </div>
        <div class="stock-total-side">
            <div class="stock-total-compact">
                <span>MAX ${fmt(TOTAL_CAPACITY)}</span>
                <strong class="capacity-${totalState}-text">${pct(totalPct)}% | ${totalStatus}</strong>
            </div>
        </div>
    </div>`;
}
'''
source = source[:start] + replacement + source[end:]
path.write_text(source, encoding='utf-8')

test_path = Path('scripts/test-stock-radial-ui.mjs')
test_path.write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source=await readFile(new URL("../stock.html",import.meta.url),"utf8");
const start=source.indexOf("function renderStockCards(stock){");
const end=source.indexOf("\nfunction renderClosing",start);
const renderBlock=source.slice(start,end);

test("stock position uses compact radial gauges",()=>{
  assert.match(source,/KPP-FMS STOCK RADIAL GAUGES v1/);
  assert.match(source,/conic-gradient\(var\(--ring-color\)/);
  assert.match(renderBlock,/class=\"stock-radial \$\{state\}\"/);
  assert.match(renderBlock,/class=\"stock-radial-code\">\$\{esc\(storage\)\}/);
});

test("stock cards no longer render horizontal capacity bars",()=>{
  assert.doesNotMatch(renderBlock,/stock-capacity-bar/);
  assert.doesNotMatch(renderBlock,/stock-capacity-fill/);
  assert.match(renderBlock,/Math\.max\(0,Math\.min\(p,100\)\)/);
});

test("radial UI preserves stock metrics and sounding estimate",()=>{
  assert.match(renderBlock,/\$\{fmt\(stock\[storage\]\)\}/);
  assert.match(renderBlock,/\$\{fmt\(cap\)\}/);
  assert.match(renderBlock,/Sonding estimasi/);
  assert.match(renderBlock,/TOTAL STOCK ALL WHS/);
});
''', encoding='utf-8')

package_path = Path('package.json')
package = json.loads(package_path.read_text(encoding='utf-8'))
test_name = 'scripts/test-stock-radial-ui.mjs'
check = package['scripts']['check']
if test_name not in check:
    package['scripts']['check'] = check + ' ' + test_name
package_path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
