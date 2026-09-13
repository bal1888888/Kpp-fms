import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const panel=await readFile(new URL('../hm-master-review-panel.js',import.meta.url),'utf8');
const time=await readFile(new URL('../wib-time.js',import.meta.url),'utf8');

test('HM review panel is read-only and analyzes active units',()=>{
  assert.match(panel,/\.from\("unit_master"\)/);
  assert.match(panel,/\.eq\("active",true\)/);
  assert.match(panel,/fetchPaged\("fuel_history"/);
  assert.match(panel,/fetchPaged\("hm_corrections"/);
  assert.doesNotMatch(panel,/\.insert\s*\(/i);
  assert.doesNotMatch(panel,/\.update\s*\(/i);
  assert.doesNotMatch(panel,/\.delete\s*\(/i);
  assert.doesNotMatch(panel,/\.upsert\s*\(/i);
});

test('HM review panel detects large reference gaps and digit inconsistency',()=>{
  assert.match(panel,/diff>72/);
  assert.match(panel,/diff<-72/);
  assert.match(panel,/spreadRatio>=3/);
  assert.match(panel,/ratio>=3\|\|absDiff>=500\|\|spreadRatio>=5/);
});

test('HM review action opens selected unit without auto-correcting it',()=>{
  assert.match(panel,/input\.value=unit/);
  assert.match(panel,/checkUnit\(\)/);
  assert.match(panel,/Tidak ada HM yang diubah otomatis/);
});

test('HM review panel is loaded only on HM Master',()=>{
  assert.match(time,/KPP_ACTIVE_PAGE===\"hm-master\"/);
  assert.match(time,/hm-master-review-panel\.js\?v=20260913d1/);
});

test('HM review panel script is syntactically valid',()=>{
  assert.doesNotThrow(()=>new Function(panel));
});
