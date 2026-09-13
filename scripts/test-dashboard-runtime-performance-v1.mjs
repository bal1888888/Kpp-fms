import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const time=fs.readFileSync("wib-time.js","utf8");
const guard=fs.readFileSync("dashboard-reference-polish-guard-v3.js","utf8");

test("dashboard enhancements wait until base DOM is ready",()=>{
  assert.match(time,/onDomReady\(async\(\)=>/);
  assert.match(time,/waitFor\(\(\)=>document\.getElementById\("kppCommandKpis"\)/);
});

test("dashboard does not start redundant usage and stock helper observers",()=>{
  assert.doesNotMatch(time,/dashboard-usage-bars-v2\.js/);
  assert.doesNotMatch(time,/dashboard-stock-delta-v1\.js/);
  assert.doesNotMatch(time,/dashboard-stock-status-badge-v1\.js/);
});

test("stock status guard observes only the stock host and patches idempotently",()=>{
  assert.match(guard,/stockObserver\.observe\(host/);
  assert.doesNotMatch(guard,/observe\(body/);
  assert.doesNotMatch(guard,/rootObserver/);
  assert.match(guard,/if\(status\.className!==expectedClass\)/);
  assert.match(guard,/if\(status\.textContent!==info\.label\)/);
  assert.match(guard,/patchQueued/);
});

test("performance runtime remains syntactically valid",()=>{
  assert.doesNotThrow(()=>new Function(time));
  assert.doesNotThrow(()=>new Function(guard));
});
