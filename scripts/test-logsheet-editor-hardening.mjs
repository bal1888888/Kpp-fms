import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const helper = await readFile(new URL('../logsheet-editor-hardening.js', import.meta.url), 'utf8');
const storage = await readFile(new URL('../storage-master.js', import.meta.url), 'utf8');

test('Logsheet Editor memuat hardening khusus halaman editor', () => {
  assert.match(storage, /KPP_ACTIVE_PAGE===\"logsheet-editor\"/);
  assert.match(storage, /logsheet-editor-hardening\.js\?v=20260913a1/);
});

test('anti-double fingerprint tidak bergantung pada HM', () => {
  const start = helper.indexOf('window.duplicateSignature=function');
  const end = helper.indexOf('window[PATCH_FLAG]=true', start);
  assert.ok(start >= 0 && end > start, 'override duplicateSignature harus ada');

  const block = helper.slice(start, end);
  assert.match(block, /row\?\.unit/);
  assert.match(block, /numberKey\(row\?\.fuel\)/);
  assert.match(block, /shiftKey\(row\?\.shift\)/);
  assert.match(block, /ftKey\(row\)/);
  assert.doesNotMatch(block, /hm_akhir|HM SAAT ISI/i);
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
