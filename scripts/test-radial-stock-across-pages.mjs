import test from "node:test";
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
