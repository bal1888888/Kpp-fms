import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const history = await readFile(new URL('../riwayat.html', import.meta.url), 'utf8');
const editor = await readFile(new URL('../logsheet-editor.html', import.meta.url), 'utf8');

for (const [name,page] of [['riwayat',history],['logsheet-editor',editor]]) {
  test(`${name} loads Master MT/FT including inactive history`, () => {
    assert.match(page, /src="storage-master\.js"/);
    assert.match(page, /KPPStorage\.load\([^\n]*\{activeOnly:false\}\)/);
  });
}

test('riwayat resolves FT and WH from Master MT/FT without fixed WH aliases', () => {
  assert.match(history, /HISTORY_FT_MAP/);
  assert.match(history, /HISTORY_WH_TO_FTS/);
  assert.doesNotMatch(history, /if\(wh==="FT02"\)return "FT0073"/);
  assert.doesNotMatch(history, /if\(ft==="FT0075"\)return "FT01"/);
});

test('logsheet editor accepts FT codes from Master MT/FT', () => {
  assert.match(editor, /EDITOR_FT_CODES/);
  assert.match(editor, /whForFT/);
  assert.match(editor, /renderFtOptions/);
  assert.doesNotMatch(editor, /const FT_WH=\{/);
  assert.doesNotMatch(editor, /<option value="FT0073"/);
  assert.match(editor, /Fuel Truck wajib terdaftar di Master MT \/ FT/);
});

test('existing history preserves explicit FT when master lookup is degraded', () => {
  assert.match(editor, /function preserveExistingFT/);
  assert.match(editor, /r\.id&&preserveExistingFT\(r\.fuel_truck\)/);
  assert.match(editor, /fuel_truck:normalizeFT\(r\.fuel_truck\)\|\|preserveExistingFT\(r\.fuel_truck\)\|\|null/);
  assert.match(editor, /renderFtOptions\(r\.fuel_truck\)/);
});

test('new rows still require a registered FT', () => {
  assert.match(editor, /fuel_truck:normalizeFT\(r\.fuel_truck\),\n\s+wh:whForFT\(normalizeFT\(r\.fuel_truck\)\)/);
});


test('FT canonicalizer removes whitespace and keeps dynamic codes', () => {
  const match = editor.match(/function canonicalFT\(v\)\{[\s\S]*?\n\}/);
  assert.ok(match, 'canonicalFT function missing');
  const context = {};
  vm.createContext(context);
  new vm.Script(`${match[0]};this.canonicalFT=canonicalFT;`).runInContext(context);
  assert.equal(context.canonicalFT(' FT 0099 '), 'FT0099');
  assert.equal(context.canonicalFT('73'), 'FT0073');
  assert.equal(context.canonicalFT('not-a-truck'), '');
});
