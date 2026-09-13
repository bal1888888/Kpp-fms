import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cc=fs.readFileSync("dashboard-command-center-v2.js","utf8");
const guard=fs.readFileSync("dashboard-reference-polish-guard-v3.js","utf8");
const time=fs.readFileSync("wib-time.js","utf8");

test("command center keeps existing sidebar untouched and upgrades dashboard content",()=>{
  assert.match(cc,/kpp-command-center-v2/);
  assert.match(cc,/Total Stock \(All WHS\)/);
  assert.match(cc,/Pemakaian Kemarin/);
  assert.match(cc,/Usage MTD/);
  assert.match(cc,/Average MTD/);
  assert.match(cc,/ITO \/ Day of Cover/);
  assert.doesNotMatch(cc,/kppRoleNav\.innerHTML/);
  assert.doesNotMatch(cc,/auth\.js/);
});

test("usage is rendered as five informative daily cards",()=>{
  assert.match(cc,/kpp-usage-day-grid/);
  assert.match(cc,/kpp-usage-day-card/);
  assert.match(cc,/kpp-usage-column/);
  assert.match(cc,/parseIdNumber/);
  assert.match(cc,/AWAL/);
});

test("stock state includes warning band and storage snapshot is read only",()=>{
  assert.match(cc,/p<50.*WASPADA/s);
  assert.match(cc,/Stock per Tanki \/ WH/);
  assert.match(cc,/stock_opening/);
  assert.match(cc,/stock_movements/);
  assert.match(cc,/stock_closing/);
  assert.match(cc,/nominal_capacity_liter/);
  assert.match(guard,/p<50.*WASPADA/s);
  assert.match(guard,/stockTrendBadge/);
  for(const source of [cc,guard]){
    assert.doesNotMatch(source,/\.insert\(/);
    assert.doesNotMatch(source,/\.update\(/);
    assert.doesNotMatch(source,/\.delete\(/);
    assert.doesNotMatch(source,/\.upsert\(/);
  }
});

test("dashboard runtime defers command center until DOM ready and removes redundant helpers",()=>{
  assert.match(time,/onDomReady\(async\(\)=>/);
  assert.match(time,/dashboard-command-center-v2\.js\?v=20260913f2/);
  assert.match(time,/dashboard-reference-polish-guard-v3\.js\?v=20260913h1/);
  assert.doesNotMatch(time,/dashboard-usage-bars-v2\.js/);
  assert.doesNotMatch(time,/dashboard-stock-delta-v1\.js/);
  assert.doesNotMatch(time,/dashboard-stock-status-badge-v1\.js/);
});

test("command center scripts are syntactically valid",()=>{
  assert.doesNotThrow(()=>new Function(cc));
  assert.doesNotThrow(()=>new Function(guard));
});
