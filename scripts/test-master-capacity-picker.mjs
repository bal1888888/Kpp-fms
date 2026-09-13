import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const picker = await readFile(new URL('../hm-master-capacity-picker-v2.js', import.meta.url), 'utf8');
const time = await readFile(new URL('../wib-time.js', import.meta.url), 'utf8');

test('HM Master memuat capacity picker v2 secara khusus', () => {
  assert.match(time, /KPP_ACTIVE_PAGE===\"hm-master\"/);
  assert.match(time, /hm-master-capacity-picker-v2\.js\?v=20260913b1/);
});

test('capacity picker memilih unit existing dan hanya mengubah kapasitas', () => {
  assert.match(picker, /from\(\"unit_master\"\)/);
  assert.match(picker, /select\(\"code_unit,egi,active,tank_capacity_liter\"\)/);
  assert.match(picker, /rpc\(\"set_unit_tank_capacity\"/);
  assert.doesNotMatch(picker, /insert\s*\(/i);
  assert.doesNotMatch(picker, /upsert\s*\(/i);
});

test('capacity picker fokus unit yang kapasitasnya belum diisi', () => {
  assert.match(picker, /kppCapOnlyMissing/);
  assert.match(picker, /Number\(r\.tank_capacity_liter\)>0/);
  assert.match(picker, /await loadRows\(\)/);
});

test('capacity picker membatasi edit ke GL dan Admin', () => {
  assert.match(picker, /role===\"gl\"\|\|role===\"admin\"/);
  assert.match(picker, /Hanya GL\/Admin yang boleh mengubah kapasitas tangki/i);
});

test('mode paste Excel lama tetap tersedia tetapi tersembunyi default', () => {
  assert.match(picker, /bulkCapacityPanel/);
  assert.match(picker, /old\.style\.display=\"none\"/);
  assert.match(picker, /MODE PASTE EXCEL/);
});

test('capacity picker valid sebagai JavaScript', () => {
  assert.doesNotThrow(() => new Function(picker));
});
