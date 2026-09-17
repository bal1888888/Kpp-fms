import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('fc-chart.js','utf8');
test('FC offers MTD, 30 day, 90 day and all-history presets',()=>{
  assert.match(src,/data-range="mtd"/);
  assert.match(src,/data-range="30"/);
  assert.match(src,/data-range="90"/);
  assert.match(src,/data-range="all"/);
  assert.match(src,/SEMUA DATA/);
});
test('FC supports long date ranges and bounded date generation',()=>{
  assert.match(src,/g<3660/);
  assert.match(src,/m\.dates\.length\*18/);
});
