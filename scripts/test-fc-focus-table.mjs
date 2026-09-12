import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('fc-chart.js','utf8');

test('FC summary rows can focus one unit',()=>{
  assert.match(src,/tr data-unit=/);
  assert.match(src,/function focusMetrics\(metrics,unit\)/);
  assert.match(src,/summaryBody\.addEventListener\('click'/);
  assert.match(src,/TAMPILKAN SEMUA UNIT/);
  assert.match(src,/unit lain disembunyikan/i);
});

test('focused unit exposes transaction detail table with FC',()=>{
  assert.match(src,/kpp-fc-detail-table/);
  assert.match(src,/Detail Transaksi/);
  assert.match(src,/FC transaksi = QTY/);
  assert.match(src,/function renderDetail\(host,metrics,unit\)/);
  assert.match(src,/fuel\/validDelta/);
});

test('FC query carries detail fields without changing source table',()=>{
  assert.match(src,/id,tanggal,jam,shift,wh,fuel_truck,unit,operator,fuelman_name,hm_akhir,hm_jalan,fuel/);
  assert.match(src,/from\(\"fuel_history\"\)/);
});

test('all-unit summary remains the default view',()=>{
  assert.match(src,/renderSummary\(summaryBody,lastMetrics,focusedUnit\)/);
  assert.match(src,/clearFocus\(\)/);
  assert.match(src,/Ringkasan FC per Unit/);
});

for(const file of ['dashboard.html','logsheet.html']){
  test(`${file} loads FC focus-table runtime`,()=>{
    const html=fs.readFileSync(file,'utf8');
    assert.match(html,/fc-chart\.js\?v=20260912h/);
  });
}
