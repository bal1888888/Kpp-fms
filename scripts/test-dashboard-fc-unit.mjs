import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dashboard=fs.readFileSync('dashboard.html','utf8');

test('dashboard exposes HM Jalan and weighted FC per unit',()=>{
  assert.match(dashboard,/Fuel Consumption per Unit/);
  assert.match(dashboard,/HM Jalan Valid/);
  assert.match(dashboard,/entry\.fc:|fc:entry\.hm>0\?entry\.fuel\/entry\.hm/);
  assert.match(dashboard,/renderFuelConsumption\(mtdRows\)/);
  assert.match(dashboard,/L\/HM/);
});

test('FC excludes invalid, excluded, zero-runtime and mismatched HM rows',()=>{
  assert.match(dashboard,/hm_ref_excluded===true/);
  assert.match(dashboard,/akhir<=awal/);
  assert.match(dashboard,/Math\.abs\(stored-expected\)>0\.11/);
  assert.match(dashboard,/stored<=0/);
});

test('aggregate FC is ratio of totals, not average of row ratios',()=>{
  const rows=[{fuel:100,hm:10},{fuel:300,hm:20}];
  const weighted=rows.reduce((s,r)=>s+r.fuel,0)/rows.reduce((s,r)=>s+r.hm,0);
  const average=rows.reduce((s,r)=>s+r.fuel/r.hm,0)/rows.length;
  assert.equal(weighted,400/30);
  assert.notEqual(weighted,average);
  assert.match(dashboard,/entry\.fuel\/entry\.hm/);
});
