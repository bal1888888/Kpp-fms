import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stock = await readFile(new URL('../stock.html', import.meta.url), 'utf8');

test('stock source still exposes current 20/35/90 thresholds for follow-up audit', () => {
  assert.match(stock, /const STOCK_CRITICAL_PCT=20/);
  assert.match(stock, /const STOCK_WARNING_PCT=35/);
  assert.match(stock, /const CAPACITY_WARNING_PCT=90/);
});
