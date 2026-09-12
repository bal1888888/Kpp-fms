import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('fc-chart.js','utf8');

test('FC defaults to operational MTD instead of rolling 14 days',()=>{
  assert.match(src,/operationalMtdBounds/);
  assert.match(src,/mtdBounds\.start/);
  assert.doesNotMatch(src,/const start=options\.startDate\|\|addDays\(end,-13\)/);
});

test('FC explains active period and gives neutral quick snapshot',()=>{
  assert.match(src,/data-period-pill/);
  assert.match(src,/SNAPSHOT \$\{exactMtd\?'MTD':'PERIODE'\}/);
  assert.match(src,/FC tertinggi:/);
  assert.match(src,/terendah:/);
  assert.match(src,/coverage terbaik:/);
  assert.match(src,/tipe\/EGI yang sama/);
});

test('Dashboard and Logsheet load refreshed FC runtime',()=>{
  for(const file of ['dashboard.html','logsheet.html']){
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/fc-chart\.js\?v=20260912h/);
  }
});
