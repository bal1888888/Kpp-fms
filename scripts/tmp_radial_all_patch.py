from pathlib import Path
import json
import re


def append_css(path, marker, css):
    text = path.read_text(encoding='utf-8')
    if marker not in text:
        text = text.replace('</style>', '\n' + css.strip() + '\n</style>', 1)
        path.write_text(text, encoding='utf-8')
    return text

# 1) STOCK: force compact 2-column mobile layout.
stock_path = Path('stock.html')
stock = stock_path.read_text(encoding='utf-8')
stock_marker = '/* ===== KPP-FMS STOCK RADIAL MOBILE COMPACT v2 ===== */'
stock_css = r'''
/* ===== KPP-FMS STOCK RADIAL MOBILE COMPACT v2 ===== */
@media(max-width:760px){
  .stock-position-panel{padding:10px!important}
  .stock-position-panel #stockCards.cards{
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:8px!important;
    width:100%!important;
  }
  .stock-position-panel #stockCards .stock-gauge-card{
    width:100%!important;
    min-width:0!important;
    max-width:none!important;
    margin:0!important;
    padding:9px 5px 8px!important;
    border-radius:10px!important;
  }
  .stock-position-panel #stockCards .stock-radial{
    width:104px!important;
    max-width:100%!important;
  }
  .stock-position-panel #stockCards .stock-radial::before{inset:9px!important}
  .stock-position-panel #stockCards .stock-radial-code{font-size:12px!important;max-width:78px!important}
  .stock-position-panel #stockCards .stock-radial-percent{font-size:19px!important;margin-top:4px!important}
  .stock-position-panel #stockCards .stock-radial-status{font-size:7px!important;margin-top:4px!important;padding:3px 6px!important}
  .stock-position-panel #stockCards .stock-gauge-context{font-size:8px!important;min-height:14px!important;margin-bottom:4px!important}
  .stock-position-panel #stockCards .stock-gauge-metrics{margin-top:7px!important;padding-top:7px!important}
  .stock-position-panel #stockCards .stock-gauge-metric{padding:0 2px!important}
  .stock-position-panel #stockCards .stock-gauge-metric strong{font-size:10px!important;white-space:normal!important;line-height:1.1!important}
  .stock-position-panel #stockCards .stock-gauge-metric small{font-size:7px!important;margin-top:2px!important}
  .stock-position-panel #stockCards .stock-sounding-estimate{margin-top:6px!important;padding:5px!important;gap:4px!important}
  .stock-position-panel #stockCards .stock-sounding-estimate span,
  .stock-position-panel #stockCards .stock-sounding-estimate b{font-size:7.5px!important;white-space:nowrap!important}
}
@media(max-width:360px){
  .stock-position-panel #stockCards.cards{gap:6px!important}
  .stock-position-panel #stockCards .stock-radial{width:92px!important}
  .stock-position-panel #stockCards .stock-gauge-metric strong{font-size:9px!important}
}
'''
if stock_marker not in stock:
    stock = stock.replace('</style>', '\n' + stock_css.strip() + '\n</style>', 1)
    stock_path.write_text(stock, encoding='utf-8')

# 2) DAILY REPORT: use radial gauges for storage level cards.
daily_path = Path('daily-report.html')
daily = daily_path.read_text(encoding='utf-8')
daily_marker = '/* ===== KPP-FMS DAILY STOCK RADIAL v1 ===== */'
daily_css = r'''
/* ===== KPP-FMS DAILY STOCK RADIAL v1 ===== */
#stockCards.cards{grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
.daily-stock-gauge{display:flex;flex-direction:column;align-items:center;padding:12px 10px!important;background:#fff!important}
.daily-stock-context{width:100%;text-align:center;color:#64748b;font-size:9px;font-weight:800;min-height:14px;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.daily-stock-radial{--ring-pct:0;--ring-color:#16a34a;width:126px;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(var(--ring-color) calc(var(--ring-pct)*1%),#e8edf4 0)}
.daily-stock-radial::before{content:"";position:absolute;inset:11px;border-radius:50%;background:#fff;box-shadow:inset 0 0 0 1px #edf1f6}
.daily-stock-radial-inner{position:relative;z-index:1;text-align:center;display:flex;flex-direction:column;align-items:center;line-height:1.05}
.daily-stock-code{font-size:13px;font-weight:900;color:#0f172a}
.daily-stock-pct{margin-top:5px;font-size:21px;font-weight:900;color:var(--ring-color)}
.daily-stock-status{margin-top:5px;padding:3px 7px;border-radius:999px;font-size:8px;font-weight:900;color:var(--ring-color);background:#f8fafc}
.daily-stock-radial.safe{--ring-color:#16a34a}.daily-stock-radial.low{--ring-color:#f59e0b}.daily-stock-radial.critical{--ring-color:#ef4444}.daily-stock-radial.high{--ring-color:#f97316}
.daily-stock-metrics{width:100%;display:grid;grid-template-columns:1fr 1fr;margin-top:9px;padding-top:8px;border-top:1px solid #eef2f7}
.daily-stock-metric{text-align:center;padding:0 4px;min-width:0}.daily-stock-metric+.daily-stock-metric{border-left:1px solid #e5e7eb}
.daily-stock-metric strong{display:block!important;color:#0f172a!important;font-size:12px!important;line-height:1.15}.daily-stock-metric small{font-size:8px!important;color:#64748b!important;margin:2px 0 0!important}
.daily-stock-gauge .stock-sounding-estimate{width:100%;margin-top:7px;padding:5px 6px;border-radius:7px;background:#f8fafc}
.daily-total-compact{padding:8px 10px;border-radius:9px;background:#f8fafc;border:1px solid #e5e7eb;font-size:11px;font-weight:800;text-align:right}
@media(max-width:600px){
  #stockCards.cards{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important}
  .daily-stock-gauge{padding:8px 5px!important;min-width:0!important}
  .daily-stock-radial{width:96px!important}.daily-stock-radial::before{inset:8px!important}
  .daily-stock-code{font-size:11px!important}.daily-stock-pct{font-size:17px!important;margin-top:4px!important}.daily-stock-status{font-size:7px!important;margin-top:4px!important;padding:2px 5px!important}
  .daily-stock-context{font-size:7.5px!important}.daily-stock-metric{padding:0 2px!important}.daily-stock-metric strong{font-size:9px!important;white-space:normal!important}.daily-stock-metric small{font-size:7px!important}
  .daily-stock-gauge .stock-sounding-estimate span,.daily-stock-gauge .stock-sounding-estimate b{font-size:7.5px!important}
}
'''
if daily_marker not in daily:
    daily = daily.replace('</style>', '\n' + daily_css.strip() + '\n</style>', 1)

start = daily.find('function renderStock(stock){')
if start < 0:
    raise SystemExit('daily renderStock not found')
next_match = re.search(r'\nfunction\s+\w+\s*\(', daily[start+1:])
if not next_match:
    raise SystemExit('next function after daily renderStock not found')
end = start + 1 + next_match.start()
block = daily[start:end]
card_pattern = re.compile(r'host\.innerHTML\+=`.*?`\s*;', re.S)
new_card = r'''host.innerHTML+=`
      <div class="card daily-stock-gauge ${cardClass}">
        <div class="daily-stock-context">${suffix ? suffix.replace(/^\s*\/\s*/,"") : "STORAGE FUEL"}</div>
        <div class="daily-stock-radial ${cls}" style="--ring-pct:${width}">
          <div class="daily-stock-radial-inner">
            <span class="daily-stock-code">${storage}</span>
            <span class="daily-stock-pct">${pctFmt(pct)}%</span>
            <span class="daily-stock-status">${statusText}</span>
          </div>
        </div>
        <div class="daily-stock-metrics">
          <div class="daily-stock-metric"><strong>${fmt(stock[storage])} L</strong><small>STOCK</small></div>
          <div class="daily-stock-metric"><strong>${fmt(cap)} L</strong><small>KAPASITAS</small></div>
        </div>
        <div class="stock-sounding-estimate"><span>Sonding estimasi</span><b>~ ${fmtSonding(sounding)} cm</b></div>
      </div>
    `;'''
block2, count = card_pattern.subn(new_card, block, count=1)
if count != 1:
    raise SystemExit(f'daily stock card template replace count={count}')
# Remove any remaining horizontal capacity bars from renderStock total block.
block2 = re.sub(r'\s*<div class=\\?"capacity-bar\\?">\s*<div class=\\?"capacity-fill[^>]*></div>\s*</div>', '', block2, flags=re.S)
block2 = block2.replace('<div class="stock-total-note">Status total stock mengikuti level kapasitas storage.</div>', '')
daily = daily[:start] + block2 + daily[end:]
daily_path.write_text(daily, encoding='utf-8')

# 3) DASHBOARD: stock 5-day view becomes compact mini radial gauges, not stock bars.
dash_path = Path('dashboard.html')
dash = dash_path.read_text(encoding='utf-8')
dash_marker = '/* ===== KPP-FMS DASHBOARD STOCK RADIAL TREND v1 ===== */'
dash_css = r'''
/* ===== KPP-FMS DASHBOARD STOCK RADIAL TREND v1 ===== */
#stockTrendBars.usage-bars{height:auto!important;min-height:132px;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;padding:8px 2px!important;border-bottom:0!important;overflow-x:auto!important;scrollbar-width:thin}
.stock-trend-ring-item{flex:1 0 72px;min-width:72px;display:flex;flex-direction:column;align-items:center;text-align:center}
.stock-trend-ring{--trend-pct:0;--trend-color:#16a34a;width:62px;aspect-ratio:1;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(var(--trend-color) calc(var(--trend-pct)*1%),#e8edf4 0)}
.stock-trend-ring::before{content:"";position:absolute;inset:7px;border-radius:50%;background:#fff}
.stock-trend-ring span{position:relative;z-index:1;font-size:10px;font-weight:900;color:var(--trend-color)}
.stock-trend-ring.safe{--trend-color:#16a34a}.stock-trend-ring.low{--trend-color:#f59e0b}.stock-trend-ring.critical{--trend-color:#ef4444}.stock-trend-ring.high{--trend-color:#f97316}
.stock-trend-ring-value{font-size:8px;font-weight:800;color:#334155;margin-top:5px;white-space:nowrap}.stock-trend-ring-date{font-size:8px;color:#64748b;margin-top:2px}
@media(max-width:560px){#stockTrendBars.usage-bars{gap:6px!important;min-height:116px}.stock-trend-ring-item{flex-basis:62px;min-width:62px}.stock-trend-ring{width:54px}.stock-trend-ring span{font-size:8.5px}.stock-trend-ring-value,.stock-trend-ring-date{font-size:7px}}
'''
if dash_marker not in dash:
    dash = dash.replace('</style>', '\n' + dash_css.strip() + '\n</style>', 1)

start = dash.find('function renderStockTrend(points,endDate){')
if start < 0:
    raise SystemExit('dashboard renderStockTrend not found')
next_match = re.search(r'\nfunction\s+\w+\s*\(', dash[start+1:])
if not next_match:
    raise SystemExit('next function after renderStockTrend not found')
end = start + 1 + next_match.start()
block = dash[start:end]
map_pattern = re.compile(r'host\.innerHTML=dates\.map\(\(d,i\)=>\{.*?\}\)\.join\(""\);', re.S)
new_map = r'''host.innerHTML=dates.map((d,i)=>{
    const parts=d.split("-");
    const label=`${parts[2]}/${parts[1]}`;
    const state=stockLevelState(values[i]);
    const levelPct=TOTAL_CAPACITY>0?(values[i]/TOTAL_CAPACITY)*100:0;
    const ringPct=Math.max(0,Math.min(levelPct,100));
    return `<div class="stock-trend-ring-item">
      <div class="stock-trend-ring ${state}" style="--trend-pct:${ringPct}" title="${formatAngka(values[i])} L">
        <span>${formatIto(levelPct)}%</span>
      </div>
      <div class="stock-trend-ring-value">${formatAngka(values[i])} L</div>
      <div class="stock-trend-ring-date">${label}</div>
    </div>`;
  }).join("");'''
block2, count = map_pattern.subn(new_map, block, count=1)
if count != 1:
    raise SystemExit(f'dashboard stock trend replace count={count}')
dash = dash[:start] + block2 + dash[end:]
dash_path.write_text(dash, encoding='utf-8')

# Regression test.
test_path = Path('scripts/test-radial-stock-across-pages.mjs')
test_path.write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const stock=await readFile(new URL("../stock.html",import.meta.url),"utf8");
const daily=await readFile(new URL("../daily-report.html",import.meta.url),"utf8");
const dashboard=await readFile(new URL("../dashboard.html",import.meta.url),"utf8");

function fnBlock(source,name,nextName){
  const start=source.indexOf(`function ${name}`);
  const end=nextName?source.indexOf(`\nfunction ${nextName}`,start):source.length;
  return source.slice(start,end>start?end:source.length);
}

test("stock mobile forces two radial cards per row",()=>{
  assert.match(stock,/STOCK RADIAL MOBILE COMPACT v2/);
  assert.match(stock,/#stockCards\.cards\{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
});

test("daily report uses radial storage gauges",()=>{
  const block=fnBlock(daily,"renderStock(stock){");
  assert.match(daily,/DAILY STOCK RADIAL v1/);
  assert.match(block,/daily-stock-radial/);
  assert.match(block,/daily-stock-code/);
  assert.doesNotMatch(block,/capacity-bar/);
});

test("dashboard stock trend uses mini radial gauges",()=>{
  const block=fnBlock(dashboard,"renderStockTrend(points,endDate){");
  assert.match(dashboard,/DASHBOARD STOCK RADIAL TREND v1/);
  assert.match(block,/stock-trend-ring/);
  assert.doesNotMatch(block,/stock-trend-bar/);
});
''', encoding='utf-8')

package_path = Path('package.json')
package = json.loads(package_path.read_text(encoding='utf-8'))
test_name = 'scripts/test-radial-stock-across-pages.mjs'
if test_name not in package['scripts']['check']:
    package['scripts']['check'] += ' ' + test_name
package_path.write_text(json.dumps(package, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

# Cleanup temporary runner files before final commit.
for temp in [Path('scripts/tmp_radial_all_patch.py'), Path('.github/workflows/tmp-radial-all.yml')]:
    if temp.exists():
        temp.unlink()
