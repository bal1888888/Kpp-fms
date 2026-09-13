import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const helper = await readFile(new URL('../logsheet-editor-hardening.js', import.meta.url), 'utf8');
const storage = await readFile(new URL('../storage-master.js', import.meta.url), 'utf8');

test('Logsheet Editor memuat hardening khusus halaman editor', () => {
  assert.match(storage, /KPP_ACTIVE_PAGE===\"logsheet-editor\"/);
  assert.match(storage, /logsheet-editor-hardening\.js\?v=20260913a1/);
});

test('anti-double punya stable identity tanpa HM untuk histori yang dikoreksi', () => {
  const stableStart = helper.indexOf('function stableIdentity');
  const stableEnd = helper.indexOf('function isHmCorrectedRow', stableStart);
  assert.ok(stableStart >= 0 && stableEnd > stableStart, 'stableIdentity harus ada');

  const stableBlock = helper.slice(stableStart, stableEnd);
  assert.match(stableBlock, /row\?\.unit/);
  assert.match(stableBlock, /numberKey\(row\?\.fuel\)/);
  assert.match(stableBlock, /shiftKey\(row\?\.shift\)/);
  assert.match(stableBlock, /ftKey\(row\)/);
  assert.doesNotMatch(stableBlock, /hm_akhir|HM SAAT ISI/i);

  assert.match(helper, /reason\.startsWith\(\"HM DIRAPIKAN\"\)/);
  assert.match(helper, /hmCorrectedStableKeys\.has\(stable\)/);
  assert.match(helper, /return `STRICT\|\$\{strictSignature\(tanggal,row\)\}`/);
});

test('fetchExistingRange mengingat transaksi yang memang pernah dikoreksi HM', () => {
  assert.match(helper, /originalFetchExistingRange/);
  assert.match(helper, /rememberHmCorrections\(result\)/);
});

test('filter editor menyediakan pencarian dan filter operasional', () => {
  assert.match(helper, /editorFilterText/);
  assert.match(helper, /editorFilterShift/);
  assert.match(helper, /editorFilterFt/);
  assert.match(helper, /editorFilterStatus/);
  assert.match(helper, /RESET FILTER/);
  assert.match(helper, /Tampil \$\{visible\} \/ \$\{total\} transaksi/);
});

test('helper valid sebagai JavaScript', () => {
  assert.doesNotThrow(() => new Function(helper));
});
