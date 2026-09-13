import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/20260913091500_new_fuel_hm_jump_guard_v1.sql', import.meta.url), 'utf8');

test('new operational fuel rows reject backwards and impossible HM jumps', () => {
  assert.match(migration, /before\s+insert\s+on\s+public\.fuel_history/i);
  assert.match(migration, /new\.hm_akhir\s*\+\s*0\.001\s*<\s*new\.hm_awal/i);
  assert.match(migration, /v_delta\s*>\s*72/i);
  assert.match(migration, /Perbaiki HM Master\/cek digit HM/i);
});

test('historical Logsheet Editor rows remain outside the operational jump guard', () => {
  assert.match(migration, /coalesce\(new\.hm_ref_excluded,false\)\s*=\s*true/i);
  assert.match(migration, /return\s+new;/i);
});

test('jump guard migration does not rewrite existing fuel history', () => {
  assert.doesNotMatch(migration, /update\s+public\.fuel_history/i);
  assert.doesNotMatch(migration, /delete\s+from\s+public\.fuel_history/i);
  assert.doesNotMatch(migration, /truncate\s+(table\s+)?public\.fuel_history/i);
});
