import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const widget=fs.readFileSync("fc-chart.js","utf8");
const dash=fs.readFileSync("dashboard.html","utf8");
const log=fs.readFileSync("logsheet.html","utf8");
test("FC widget supports EGI grouping and drill-down",()=>{
  assert.match(widget,/MODE ANALISA/);
  assert.match(widget,/PER EGI/);
  assert.match(widget,/PER UNIT/);
  assert.match(widget,/Ringkasan FC per EGI/);
  assert.match(widget,/Detail Unit/);
  assert.match(widget,/allUnits\.filter\(x=>selected\.includes\(x\.egi\)\)/);
});
test("FC aggregate uses weighted total fuel divided by total HM",()=>{
  assert.match(widget,/validFuel\/totalHm/);
  assert.match(widget,/x\.validFuel\+=/);
  assert.match(widget,/x\.hm\+=/);
});
test("Dashboard and logsheet still mount the same KPPFC runtime",()=>{
  assert.match(dash,/hostId:"dashboardFcChart"/);
  assert.match(log,/hostId:"logsheetFcChart"/);
});
console.log("FC EGI widget regression checks passed");
