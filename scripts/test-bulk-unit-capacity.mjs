import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../hm-master.html', import.meta.url), 'utf8');

test('bulk capacity helper is GL/Admin only and uses existing guarded RPC', () => {
  assert.match(html, /id="bulkCapacityPanel"/);
  assert.match(html, /if\(!canEditTankCapacity\(\)\)/);
  assert.match(html, /db\.rpc\("set_unit_tank_capacity"/);
  assert.match(html, /bulkPanel\.style\.display=allowed\?"":"none"/);
});

test('bulk capacity preview blocks unknown, inactive, duplicate and invalid rows', () => {
  assert.match(html, /DUPLIKAT UNIT/);
  assert.match(html, /UNIT TIDAK ADA/);
  assert.match(html, /UNIT TIDAK AKTIF/);
  assert.match(html, /KAPASITAS TIDAK VALID/);
  assert.match(html, /blocking\.length>0/);
});

test('bulk capacity helper never guesses capacity and supports controlled concurrency', () => {
  assert.match(html, /Tidak ada kapasitas yang ditebak otomatis/);
  assert.match(html, /Math\.min\(5,payload\.length\)/);
  assert.match(html, /p_capacity_liter:item\.capacity/);
  assert.doesNotMatch(html, /tank_capacity_liter\s*:\s*item\.capacity/);
});
