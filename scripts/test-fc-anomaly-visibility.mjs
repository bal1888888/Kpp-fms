import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('fc-chart.js','utf8');
test('implausible HM jumps are excluded from FC',()=>{
  assert.match(src,/maxDelta/);
  assert.match(src,/raw<=0/);
  assert.match(src,/Lonjakan HM/);
});
test('FC summary is prominent before chart',()=>{
  assert.ok(src.indexOf('kpp-fc-summary') < src.indexOf('kpp-fc-chart'));
  assert.match(src,/PERLU CEK/);
});
test('grouped FC chart uses daily aggregate series',()=>{
  assert.match(src,/function aggregate/);
  assert.match(src,/function chart/);
  assert.match(src,/g\.daily\.get/);
});
