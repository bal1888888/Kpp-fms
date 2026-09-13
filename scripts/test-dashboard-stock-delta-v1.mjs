import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const legacy=await readFile(new URL('../dashboard-stock-delta-v1.js',import.meta.url),'utf8');
const guard=await readFile(new URL('../dashboard-reference-polish-guard-v3.js',import.meta.url),'utf8');
const time=await readFile(new URL('../wib-time.js',import.meta.url),'utf8');

test('consolidated stock guard preserves green fill and red missing-capacity remainder',()=>{
  assert.match(guard,/--trend-fill:#11a861/);
  assert.match(guard,/--trend-empty:#ef4444/);
  assert.match(guard,/conic-gradient\(/);
  assert.match(guard,/var\(--trend-pct\)/);
});

test('legacy stock delta helper remains read-only but is no longer loaded on dashboard',()=>{
  assert.doesNotMatch(legacy,/\.from\(/);
  assert.doesNotMatch(legacy,/\.update\(/);
  assert.doesNotMatch(legacy,/\.insert\(/);
  assert.doesNotMatch(legacy,/\.delete\(/);
  assert.doesNotMatch(time,/dashboard-stock-delta-v1\.js/);
  assert.match(time,/dashboard-reference-polish-guard-v3\.js\?v=20260913h1/);
});

test('stock guard is syntactically valid',()=>{
  assert.doesNotThrow(()=>new Function(guard));
});
