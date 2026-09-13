import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const layout=fs.readFileSync("dashboard-presentation-layout-v1.js","utf8");
const time=fs.readFileSync("wib-time.js","utf8");

test("presentation layout keeps the existing sidebar untouched",()=>{
  assert.doesNotMatch(layout,/kppRoleNav\.innerHTML/);
  assert.doesNotMatch(layout,/app-nav\.innerHTML/);
  assert.doesNotMatch(layout,/sidebar\.innerHTML/);
  assert.match(layout,/kpp-presentation-v1/);
});

test("approved information hierarchy is locked to the mockup",()=>{
  assert.match(layout,/grid-template-areas:\"stock storage\" \"usage activity\"/);
  assert.match(layout,/Trend FC Harian per Unit/);
  assert.match(layout,/Ringkasan FC per Unit/);
  assert.match(layout,/Distribusi per Shift/);
  assert.match(layout,/Penerimaan per Transportir/);
  assert.match(layout,/kppPresentationBottom/);
});

test("storage rows get dedicated tank and fuel-truck visuals",()=>{
  assert.match(layout,/function tankSvg\(/);
  assert.match(layout,/function truckSvg\(/);
  assert.match(layout,/code\.startsWith\(\"FT\"\)/);
  assert.match(layout,/kpp-storage-visual/);
});

test("presentation helpers are display-only and do not mutate database",()=>{
  assert.doesNotMatch(layout,/\.insert\(/);
  assert.doesNotMatch(layout,/\.update\(/);
  assert.doesNotMatch(layout,/\.delete\(/);
  assert.doesNotMatch(layout,/\.upsert\(/);
});

test("runtime loads presentation layout after dashboard polish",()=>{
  assert.match(time,/dashboard-reference-polish-guard-v3\.js\?v=20260913h1/);
  assert.match(time,/fc-chart-gap-bridge-v1\.js\?v=20260913a2/);
  assert.match(time,/dashboard-presentation-layout-v1\.js\?v=20260913a1/);
});

test("presentation script is syntactically valid",()=>{
  assert.doesNotThrow(()=>new Function(layout));
});
