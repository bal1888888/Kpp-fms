import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const polish=fs.readFileSync("dashboard-reference-polish-v3.js","utf8");
const guard=fs.readFileSync("dashboard-reference-polish-guard-v3.js","utf8");
const time=fs.readFileSync("wib-time.js","utf8");

test("reference polish keeps the existing sidebar untouched",()=>{
  assert.doesNotMatch(polish,/kppRoleNav\.innerHTML/);
  assert.doesNotMatch(polish,/app-nav\.innerHTML/);
  assert.doesNotMatch(polish,/sidebar\.innerHTML/);
  assert.match(polish,/KPP TRAM FUEL MANAGEMENT SYSTEM/);
});

test("reference layout contains the approved information blocks",()=>{
  assert.match(polish,/kppCommandKpis/);
  assert.match(polish,/Posisi Total Stock/);
  assert.match(polish,/Pemakaian Fuel/);
  assert.match(polish,/Stock \(L\)/);
  assert.match(polish,/Kapasitas/);
  assert.match(polish,/Aktivitas Terbaru|kppActivitySnapshot/);
});

test("stock thresholds remain operationally safe",()=>{
  assert.match(polish,/p < 20.*KRITIS/s);
  assert.match(polish,/p < 35.*RENDAH/s);
  assert.match(polish,/p < 50.*WASPADA/s);
  assert.match(polish,/p >= 90.*TINGGI/s);
  assert.match(guard,/p<50.*WASPADA/s);
});

test("extra dashboard queries are read-only",()=>{
  assert.match(polish,/fuel_history/);
  assert.match(polish,/stock_movements/);
  for(const source of [polish,guard]){
    assert.doesNotMatch(source,/\.insert\(/);
    assert.doesNotMatch(source,/\.update\(/);
    assert.doesNotMatch(source,/\.delete\(/);
    assert.doesNotMatch(source,/\.upsert\(/);
  }
});

test("dashboard runtime loads reference polish after command center",()=>{
  assert.match(time,/dashboard-command-center-v2\.js\?v=20260913f1/);
  assert.match(time,/dashboard-reference-polish-v3\.js\?v=20260913g1/);
  assert.match(time,/dashboard-reference-polish-guard-v3\.js\?v=20260913g1/);
});

test("reference polish scripts are syntactically valid",()=>{
  assert.doesNotThrow(()=>new Function(polish));
  assert.doesNotThrow(()=>new Function(guard));
});
