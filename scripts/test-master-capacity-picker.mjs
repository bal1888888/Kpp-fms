import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const picker = await readFile(new URL('../hm-master-capacity-quick.js', import.meta.url), 'utf8');
const time = await readFile(new URL('../wib-time.js', import.meta.url), 'utf8');

test('HM Master memuat quick capacity picker secara khusus', () => {
  assert.match(time, /KPP_ACTIVE_PAGE===\"hm-master\"/);
  assert.match(time, /hm-master-capacity-quick\.js\?v=20260913a1/);
});

test('quick picker memilih unit existing dan hanya mengubah kapasitas', () => {
  assert.match(picker, /from\(\"unit_master\"\)/);
  assert.match(picker, /select\(\"code_unit,egi,code_ellips,active,tank_capacity_liter\"\)/);
  assert.match(picker, /rpc\(\"set_unit_tank_capacity\"/);
  assert.doesNotMatch(picker, /insert\s*\(/i);
  assert.doesNotMatch(picker, /upsert\s*\(/i);
});

test('quick picker fokus unit yang kapasitasnya belum diisi', () => {
  assert.match(picker, /quickCapacityOnlyMissing/);
  assert.match(picker, /Number\(row\.tank_capacity_liter\) > 0/);
  assert.match(picker, /Lanjut ke unit berikutnya/);
});

test('quick picker membatasi edit ke GL dan Admin', () => {
  assert.match(picker, /role === \"gl\" \|\| role === \"admin\"/);
  assert.match(picker, /kapasitas tangki hanya boleh diubah GL\/Admin/i);
});

test('quick picker valid sebagai JavaScript', () => {
  assert.doesNotThrow(() => new Function(picker));
});
