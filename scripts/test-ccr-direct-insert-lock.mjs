import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/20260911071500_ccr_direct_insert_lock_v1.sql', import.meta.url), 'utf8');
const ccr = await readFile(new URL('../ccr.html', import.meta.url), 'utf8');

test('authenticated clients cannot directly insert CCR allocations', () => {
  assert.match(migration, /revoke insert on table public\.ccr_allocations from anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.create_ccr_allocation_reliable\(uuid,jsonb,timestamptz\) to authenticated/i);
});

test('CCR page creates allocations through the reliable RPC', () => {
  assert.match(ccr, /create_ccr_allocation_reliable/);
  assert.doesNotMatch(ccr, /\.from\("ccr_allocations"\)\s*\.insert\(/);
});
