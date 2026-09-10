import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page = await readFile(new URL('../logsheet.html', import.meta.url), 'utf8');

test('logsheet loads Master MT/FT helper', () => {
  assert.match(page, /<script src="storage-master\.js"><\/script>/);
  assert.match(page, /KPPStorage\.load\(supabaseClient,\{activeOnly:false\}\)/);
  assert.match(page, /KPPStorage\.ftMap\(LOG_STORAGE_ROWS\)/);
});

test('logsheet warehouse and FT filters are generated dynamically', () => {
  assert.match(page, /id="filterWH"><option value="">Semua WH<\/option><\/select>/);
  assert.match(page, /id="filterFuelTruck"><option value="">Semua FT<\/option><\/select>/);
  assert.match(page, /populateStorageFilters\(ALL_DATA\)/);
  assert.doesNotMatch(page, /if\(wh==="FT01"\)/);
  assert.doesNotMatch(page, /if\(wh==="FT02"\)/);
});

test('logsheet validates WH against storage master and summarizes warehouses dynamically', () => {
  assert.match(page, /VALID_WHS\.has\(wh\)/);
  assert.match(page, /warehouseSummaryCards/);
  assert.match(page, /warehouseTotals/);
  assert.doesNotMatch(page, /wh!=="FT01"\s*&&\s*wh!=="FT02"/);
});
