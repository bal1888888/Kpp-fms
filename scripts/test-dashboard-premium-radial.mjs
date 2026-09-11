import test from "node:test";
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
