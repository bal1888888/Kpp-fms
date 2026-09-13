import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const delta=await readFile(new URL('../dashboard-stock-delta-v1.js',import.meta.url),'utf8');
const time=await readFile(new URL('../wib-time.js',import.meta.url),'utf8');

test('stock delta indicator compares each stock day with the previous visible day',()=>{
  assert.match(delta,/function\s+patchHost\(host\)/);
  assert.match(delta,/\.stock-radial-item/);
  assert.match(delta,/const diff=current-previous/);
  assert.match(delta,/▲ \$\{formatLiter\(diff\)\} L/);
  assert.match(delta,/▼ \$\{formatLiter\(diff\)\} L/);
  assert.match(delta,/TETAP/);
});

test('stock delta indicator uses dashboard theme colors and does not alter source data',()=>{
  assert.match(delta,/background:#ecfdf5/);
  assert.match(delta,/background:#fff7ed/);
  assert.doesNotMatch(delta,/\.from\(/);
  assert.doesNotMatch(delta,/\.update\(/);
  assert.doesNotMatch(delta,/\.insert\(/);
  assert.doesNotMatch(delta,/\.delete\(/);
});

test('dashboard runtime loads stock delta enhancement',()=>{
  assert.match(time,/dashboard-stock-delta-v1\.js\?v=20260913a1/);
});

test('stock delta script is syntactically valid',()=>{
  assert.doesNotThrow(()=>new Function(delta));
});
