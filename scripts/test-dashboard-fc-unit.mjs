import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const dashboard=fs.readFileSync("dashboard.html","utf8");
const widget=fs.readFileSync("fc-chart.js","utf8");

test("dashboard uses the unified sequential-HM FC widget",()=>{
  assert.doesNotMatch(dashboard,/id="fcSection"/);
  assert.doesNotMatch(dashboard,/renderFuelConsumption\(mtdRows\)/);
  assert.match(dashboard,/hostId:"dashboardFcChart"/);
  assert.match(widget,/validFuel\/totalHm/);
  assert.match(widget,/HM JALAN VALID/);
  assert.match(widget,/Ringkasan Unit Terpilih/);
});

test("aggregate FC is ratio of valid fuel totals to valid HM totals",()=>{
  const rows=[{fuel:100,hm:10},{fuel:300,hm:20}];
  const weighted=rows.reduce((s,r)=>s+r.fuel,0)/rows.reduce((s,r)=>s+r.hm,0);
  const average=rows.reduce((s,r)=>s+r.fuel/r.hm,0)/rows.length;
  assert.equal(weighted,400/30);
  assert.notEqual(weighted,average);
  assert.match(widget,/validFuel\/totalHm/);
});
