import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('fc-chart.js','utf8');
test('FC defaults to operational MTD',()=>{
  assert.match(src,/operationalMtdBounds/);
  assert.match(src,/mtd\.start/);
  assert.doesNotMatch(src,/addDays\(end,-13\)/);
});
test('FC explains grouped EGI period and weighted formula',()=>{
  assert.match(src,/Analisa FC per EGI/);
  assert.match(src,/total fuel valid ÷ total HM valid/);
  assert.match(src,/data-pill/);
});
