import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const js=await readFile(new URL('../fc-chart.js',import.meta.url),'utf8');
const dashboard=await readFile(new URL('../dashboard.html',import.meta.url),'utf8');

test('FC chart exposes the existing KPPFC mount contract',()=>{
  assert.match(js,/window\.KPPFC\s*=\s*\{mount\}/);
  assert.match(dashboard,/dashboardFcChart/);
  assert.match(dashboard,/KPPFC/);
});

test('FC analysis supports EGI grouping and multi-unit expansion',()=>{
  assert.match(js,/MODE ANALISA/);
  assert.match(js,/PER EGI/);
  assert.match(js,/PER UNIT/);
  assert.match(js,/MAX_GROUPS=10/);
  assert.match(js,/allUnits\.filter\(x=>selected\.includes\(x\.egi\)\)/);
  assert.match(js,/Ringkasan FC per EGI/);
  assert.match(js,/Detail Unit/);
});

test('FC aggregate uses total valid fuel divided by total valid HM',()=>{
  assert.match(js,/totalFuel\/totalHm/);
  assert.match(js,/validFuel/);
  assert.match(js,/x\.validFuel\+=/);
  assert.match(js,/x\.hm\+=/);
});

test('FC source is Master Unit EGI plus fuel history',()=>{
  assert.match(js,/unit_master.*code_unit,egi,active/s);
  assert.match(js,/fuel_history.*hm_akhir,fuel/s);
});

test('FC chart javascript parses',()=>{
  assert.doesNotThrow(()=>new vm.Script(js));
});
