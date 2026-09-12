import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('fc-chart.js','utf8');

test('implausible positive HM jumps are excluded from FC but remain visible',()=>{
  assert.match(src,/maxPlausibleHmDelta/);
  assert.match(src,/rawDelta>maxDelta/);
  assert.match(src,/Lonjakan HM/);
  assert.match(src,/TRANSAKSI PENGISIAN PERLU CEK HM/);
  assert.match(src,/Fuel tetap dihitung ke total/);
});

test('FC summary is prominent and placed before the chart',()=>{
  assert.ok(src.indexOf('<div class="kpp-fc-summary-card">') < src.indexOf('<div class="kpp-fc-chart-card">'));
  assert.match(src,/PERLU CEK/);
  assert.match(src,/data-fc-issues/);
});

test('missing dates break the SVG line instead of drawing fake continuity',()=>{
  assert.match(src,/let segment=\[\]/);
  assert.match(src,/else flush\(\)/);
  assert.match(src,/polyline data-unit=/);
});

test('focus works from legend, chart and anomaly list',()=>{
  assert.match(src,/legend\.addEventListener\('click'/);
  assert.match(src,/kpp-fc-chart'\)\.addEventListener\('click'/);
  assert.match(src,/issuesHost\.addEventListener\('click'/);
});

for(const file of ['dashboard.html','logsheet.html']){
  test(`${file} cache-busts the FC anomaly runtime`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/fc-chart\.js\?v=20260912h/);
  });
}
