import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const helper = await readFile(new URL('../stock-status-hardening.js', import.meta.url), 'utf8');
const storage = await readFile(new URL('../storage-master.js', import.meta.url), 'utf8');

test('stock page memuat status hardening', () => {
  assert.match(storage, /KPP_ACTIVE_PAGE===\"stock\"/);
  assert.match(storage, /stock-status-hardening\.js\?v=20260913a1/);
});

test('zona stock memakai KRITIS RENDAH WASPADA AMAN dan TINGGI', () => {
  assert.match(helper, /if\(p<20\)return \"critical\"/);
  assert.match(helper, /if\(p<35\)return \"low\"/);
  assert.match(helper, /if\(p<50\)return \"caution\"/);
  assert.match(helper, /if\(p>=90\)return \"high\"/);
  assert.match(helper, /if\(state===\"caution\"\)return \"WASPADA\"/);
});

test('status 38,5 persen tidak lagi AMAN', () => {
  const classifySource = helper.slice(helper.indexOf('function classify'), helper.indexOf('function labelFor'));
  const classify = new Function(`${classifySource}; return classify;`)();
  assert.equal(classify(6.6), 'critical');
  assert.equal(classify(20), 'low');
  assert.equal(classify(33.7), 'low');
  assert.equal(classify(38.5), 'caution');
  assert.equal(classify(40.3), 'caution');
  assert.equal(classify(50), 'safe');
  assert.equal(classify(74.4), 'safe');
  assert.equal(classify(90), 'high');
});

test('mutation observer tidak menulis ulang text yang sudah sama', () => {
  assert.match(helper, /statusEl && String\(statusEl\.textContent\|\|\"\"\)\.trim\(\)!==status/);
  assert.match(helper, /if\(next!==raw\)el\.textContent=next/);
  assert.match(helper, /&& raw!==status\)\{/);
});

test('helper valid sebagai JavaScript', () => {
  assert.doesNotThrow(() => new Function(helper));
});
