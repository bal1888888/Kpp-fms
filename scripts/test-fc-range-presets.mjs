import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('fc-chart.js','utf8');

test('FC offers MTD, 30 day, 90 day and all-history presets',()=>{
  assert.match(src,/data-range=\"mtd\"/);
  assert.match(src,/data-range=\"30d\"/);
  assert.match(src,/data-range=\"90d\"/);
  assert.match(src,/data-range=\"all\"/);
  assert.match(src,/SEMUA DATA/);
});

test('all-history preset finds earliest selected-unit transaction',()=>{
  assert.match(src,/async function fetchEarliestDate/);
  assert.match(src,/order\(\"tanggal\",\{ascending:true\}\)\.limit\(1\)/);
  assert.match(src,/fetchEarliestDate\(KPP\.db,selected\)/);
});

test('long date ranges remain renderable and chart becomes horizontally roomy',()=>{
  assert.match(src,/guard<3660/);
  assert.match(src,/dates\.length\*18/);
  assert.match(src,/lastMetrics\.dates\.length} hari/);
});

test('manual date changes leave quick preset mode',()=>{
  assert.match(src,/activeRange='custom'/);
  assert.match(src,/Atau ubah tanggal manual/);
});

for(const file of ['dashboard.html','logsheet.html']){
  test(`${file} loads refreshed FC runtime`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/fc-chart\.js\?v=20260912h/);
  });
}
