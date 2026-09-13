import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const delta=await readFile(new URL('../dashboard-stock-delta-v1.js',import.meta.url),'utf8');
const time=await readFile(new URL('../wib-time.js',import.meta.url),'utf8');

test('stock radial visual uses green fill and red missing-capacity remainder',()=>{
  assert.match(delta,/--trend-fill:#11a861/);
  assert.match(delta,/--trend-empty:#ef4444/);
  assert.match(delta,/conic-gradient\(/);
  assert.match(delta,/var\(--trend-pct\)/);
});

test('stock radial visual removes old AWAL and naik-turun badges without touching source data',()=>{
  assert.match(delta,/LEGACY_BADGE_CLASS="kpp-stock-delta"/);
  assert.match(delta,/cleanLegacyBadges/);
  assert.doesNotMatch(delta,/chip\.textContent/);
  assert.doesNotMatch(delta,/▲\+/);
  assert.doesNotMatch(delta,/▼/);
  assert.doesNotMatch(delta,/\.from\(/);
  assert.doesNotMatch(delta,/\.update\(/);
  assert.doesNotMatch(delta,/\.insert\(/);
  assert.doesNotMatch(delta,/\.delete\(/);
});

test('dashboard runtime loads refreshed stock radial enhancement',()=>{
  assert.match(time,/dashboard-stock-delta-v1\.js\?v=20260913a3/);
});

test('stock radial script is syntactically valid',()=>{
  assert.doesNotThrow(()=>new Function(delta));
});
