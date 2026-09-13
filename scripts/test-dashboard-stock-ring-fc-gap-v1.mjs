import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const delta=fs.readFileSync("dashboard-stock-delta-v1.js","utf8");
const gap=fs.readFileSync("fc-chart-gap-bridge-v1.js","utf8");
const time=fs.readFileSync("wib-time.js","utf8");

test("stock radial keeps current stock green and the remaining capacity red",()=>{
  assert.match(delta,/--trend-fill:#11a861/);
  assert.match(delta,/--trend-empty:#ef4444/);
  assert.match(delta,/background:conic-gradient/);
  assert.match(delta,/cleanLegacyBadges/);
  assert.doesNotMatch(delta,/ring\.appendChild\(chip\)/);
});

test("FC missing samples are bridged visually without inventing FC values",()=>{
  assert.match(gap,/stroke-dasharray/);
  assert.match(gap,/Tanggal tanpa sampel FC valid/);
  assert.match(gap,/bukan nilai hasil tebakan/);
  assert.match(gap,/circle\[data-unit\]/);
  assert.doesNotMatch(gap,/interpolat/i);
});

test("dashboard loads current stock radial visual and FC gap bridge",()=>{
  assert.match(time,/dashboard-stock-delta-v1\.js\?v=20260913a3/);
  assert.match(time,/fc-chart-gap-bridge-v1\.js\?v=20260913a1/);
});

test("dashboard enhancement scripts are syntactically valid",()=>{
  assert.doesNotThrow(()=>new Function(delta));
  assert.doesNotThrow(()=>new Function(gap));
});
