import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cc=fs.readFileSync("dashboard-command-center-v2.js","utf8");
const badge=fs.readFileSync("dashboard-stock-status-badge-v1.js","utf8");
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
  assert.match(badge,/p<50.*WASPADA/s);
  assert.match(badge,/stockTrendBadge/);
  assert.doesNotMatch(cc,/\.insert\(/);
  assert.doesNotMatch(cc,/\.update\(/);
  assert.doesNotMatch(cc,/\.delete\(/);
  assert.doesNotMatch(cc,/\.upsert\(/);
  assert.doesNotMatch(badge,/\.insert\(/);
  assert.doesNotMatch(badge,/\.update\(/);
  assert.doesNotMatch(badge,/\.delete\(/);
});

test("dashboard runtime loads command center v2 and stock status alignment",()=>{
  assert.match(time,/dashboard-command-center-v2\.js\?v=20260913f1/);
  assert.match(time,/dashboard-stock-status-badge-v1\.js\?v=20260913f1/);
  assert.doesNotMatch(time,/dashboard-command-center-v1\.js/);
  assert.doesNotMatch(time,/dashboard-command-center-hotfix-v1\.js/);
});

test("command center scripts are syntactically valid",()=>{
  assert.doesNotThrow(()=>new Function(cc));
  assert.doesNotThrow(()=>new Function(badge));
});
