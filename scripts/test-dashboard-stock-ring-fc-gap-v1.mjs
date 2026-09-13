import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const guard=fs.readFileSync("dashboard-reference-polish-guard-v3.js","utf8");
const gap=fs.readFileSync("fc-chart-gap-bridge-v1.js","utf8");
const time=fs.readFileSync("wib-time.js","utf8");

test("stock radial keeps current stock green and the remaining capacity red",()=>{
  assert.match(guard,/--trend-fill:#11a861/);
  assert.match(guard,/--trend-empty:#ef4444/);
  assert.match(guard,/background:conic-gradient/);
  assert.match(guard,/kpp-stock-delta/);
});

test("FC missing samples are bridged visually without inventing FC values",()=>{
  assert.match(gap,/stroke-dasharray/);
  assert.match(gap,/Tanggal tanpa sampel FC valid/);
  assert.match(gap,/bukan nilai hasil tebakan/);
  assert.match(gap,/circle\[data-unit\]/);
  assert.doesNotMatch(gap,/interpolat/i);
});

test("dashboard loads consolidated stock guard and FC gap bridge",()=>{
  assert.match(time,/dashboard-reference-polish-guard-v3\.js\?v=20260913h1/);
  assert.match(time,/fc-chart-gap-bridge-v1\.js\?v=20260913a2/);
  assert.doesNotMatch(time,/dashboard-stock-delta-v1\.js/);
});

test("dashboard enhancement scripts are syntactically valid",()=>{
  assert.doesNotThrow(()=>new Function(guard));
  assert.doesNotThrow(()=>new Function(gap));
});
