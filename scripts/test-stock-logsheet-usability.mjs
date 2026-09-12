import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const stock = await readFile(new URL('../stock.html', import.meta.url), 'utf8');
const logsheet = await readFile(new URL('../logsheet.html', import.meta.url), 'utf8');

test('stock radial gauge scales to card content instead of overflowing', () => {
  assert.match(stock, /\.stock-radial\{[\s\S]*?width:min\(132px,100%\);[\s\S]*?max-width:100%;/);
  assert.doesNotMatch(stock, /\.stock-radial\{[\s\S]{0,180}?width:148px;/);
});

test('logsheet shows HM Jalan next to HM and exports the same column', () => {
  assert.match(logsheet, /<th>HM<\/th><th>HM JALAN<\/th><th>QTY ISSUED<\/th>/);
  assert.match(logsheet, /function buildHmJalanMap\(data\)/);
  assert.match(logsheet, /HM_JALAN_MAP=buildHmJalanMap\(ALL_DATA\)/);
  assert.match(logsheet, /if\(Number\.isFinite\(previous\) && hm>=previous\)\{\s*jalan=hm-previous;/);
  assert.doesNotMatch(logsheet, /return akhir-awal/);
  assert.match(logsheet, /function getHmJalan\(item\)/);
  assert.match(logsheet, /row\.appendChild\(td\(hmJalan!==null \? formatAngka\(hmJalan\) : "-"\)\)/);
  assert.match(logsheet, /"HM",\s*"HM JALAN",\s*"QTY ISSUED"/);
  assert.match(logsheet, /const totalCell=ws\.getCell\("L7"\)/);
  assert.match(logsheet, /const statusCell=row\.getCell\(15\)/);
});

test('HM cleanup reason is optional in UI while audit fallback remains server-side', () => {
  assert.match(logsheet, /Alasan Rapikan \(Opsional\)/);
  assert.match(logsheet, /p_reason:reason\|\|null/);
  assert.doesNotMatch(logsheet, /Alasan rapikan HM wajib diisi/);
});
