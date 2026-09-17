import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('fc-chart.js','utf8');
test('FC EGI rows can drill down to unit detail',()=>{
  assert.match(src,/data-group/);
  assert.match(src,/Detail Unit/);
  assert.match(src,/data-unit/);
  assert.match(src,/KEMBALI KE SEMUA/);
});
test('FC unit detail exposes FC, fuel and HM',()=>{
  assert.match(src,/FC AVG/);
  assert.match(src,/FUEL VALID/);
  assert.match(src,/HM VALID/);
  assert.match(src,/coverage/);
});
test('FC query carries source history fields',()=>{
  assert.match(src,/fuel_history/);
  assert.match(src,/hm_akhir/);
  assert.match(src,/fuel/);
});
