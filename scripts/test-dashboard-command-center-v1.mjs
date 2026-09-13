import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cc=fs.readFileSync("dashboard-command-center-v1.js","utf8");
const hardening=fs.readFileSync("dashboard-command-center-hotfix-v1.js","utf8");
const time=fs.readFileSync("wib-time.js","utf8");

test("command center keeps existing sidebar untouched and upgrades dashboard content",()=>{
  assert.match(cc,/kpp-command-center-v1/);
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
  assert.match(cc,/usageDelta/);
  assert.match(hardening,/parseIdNumber/);
});

test("stock state includes warning band and storage snapshot is read only",()=>{
  assert.match(cc,/p < 50.*WASPADA/s);
  assert.match(cc,/Stock per Tanki \/ WH/);
  assert.match(cc,/stock_opening/);
  assert.match(cc,/stock_movements/);
  assert.match(cc,/stock_closing/);
  assert.match(hardening,/nominal_capacity_liter/);
  assert.doesNotMatch(cc,/\.insert\(/);
  assert.doesNotMatch(cc,/\.update\(/);
  assert.doesNotMatch(cc,/\.delete\(/);
  assert.doesNotMatch(cc,/\.upsert\(/);
  assert.doesNotMatch(hardening,/\.insert\(/);
  assert.doesNotMatch(hardening,/\.update\(/);
  assert.doesNotMatch(hardening,/\.delete\(/);
  assert.doesNotMatch(hardening,/\.upsert\(/);
});

test("dashboard runtime loads command center enhancer and hardening",()=>{
  assert.match(time,/dashboard-command-center-v1\.js\?v=20260913e1/);
  assert.match(time,/dashboard-command-center-hotfix-v1\.js\?v=20260913e1/);
});

test("command center scripts are syntactically valid",()=>{
  assert.doesNotThrow(()=>new Function(cc));
  assert.doesNotThrow(()=>new Function(hardening));
});
