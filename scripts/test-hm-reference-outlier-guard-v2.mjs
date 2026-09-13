import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/20260913090000_hm_reference_outlier_guard_v2.sql', import.meta.url), 'utf8');
const editorGuard = await readFile(new URL('../logsheet-editor-hm-sequence-guard.js', import.meta.url), 'utf8');
const time = await readFile(new URL('../wib-time.js', import.meta.url), 'utf8');

test('server HM reference no longer trusts MAX of all historical rows', () => {
  assert.match(migration, /limit\s+7/i);
  assert.match(migration, /percentile_cont\(0\.5\)/i);
  assert.match(migration, /median_hm\s*\*\s*0\.5/i);
  assert.match(migration, /median_hm\s*\*\s*1\.5/i);
  assert.doesNotMatch(migration, /select\s+max\(h\.hm_akhir::numeric\)[\s\S]*?from\s+public\.fuel_history\s+h[\s\S]*?return\s+next;\s*return;/i);
});

test('HM correction stays authoritative and later growth must be physically plausible', () => {
  assert.match(migration, /HM Master \/ Koreksi Aktual \(server\)/i);
  assert.match(migration, /extract\(epoch\s+from/i);
  assert.match(migration, /\+\s*48/i);
  assert.match(migration, /h\.hm_akhir::numeric\s*<=\s*v_corr\.hm/i);
});

test('outlier migration never rewrites historical fuel rows', () => {
  assert.doesNotMatch(migration, /update\s+public\.fuel_history/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.fuel_history/i);
  assert.doesNotMatch(migration, /truncate\s+(table\s+)?public\.fuel_history/i);
});

test('Logsheet Editor recalculates HM chronologically and does not propagate suspicious jumps', () => {
  assert.match(editorGuard, /function\s+chronologicalBaseline/i);
  assert.match(editorGuard, /\.lt\(\"tanggal\",tanggal\)/);
  assert.match(editorGuard, /\.limit\(7\)/);
  assert.match(editorGuard, /function\s+robustRecentRow/i);
  assert.match(editorGuard, /delta>=0\s*&&\s*delta<=allowedGrowth/);
  assert.match(editorGuard, /r\._hm_sequence_anomaly=true/);
  assert.match(editorGuard, /getBaseline=chronologicalBaseline/);
  assert.match(editorGuard, /recalcAllHM=guardedRecalcAllHM/);
});

test('editor sequence guard is read-only until the existing Save action is used', () => {
  assert.doesNotMatch(editorGuard, /\.insert\s*\(/i);
  assert.doesNotMatch(editorGuard, /\.upsert\s*\(/i);
  assert.doesNotMatch(editorGuard, /\.update\s*\(/i);
  assert.doesNotMatch(editorGuard, /\.delete\s*\(/i);
  assert.doesNotMatch(editorGuard, /\.rpc\s*\(/i);
  assert.doesNotThrow(() => new Function(editorGuard));
});

test('WIB runtime loads HM sequence guard only on Logsheet Editor', () => {
  assert.match(time, /KPP_ACTIVE_PAGE===\"logsheet-editor\"/);
  assert.match(time, /logsheet-editor-hm-sequence-guard\.js\?v=20260913a1/);
});
