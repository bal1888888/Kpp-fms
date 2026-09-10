import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/20260911065000_ccr_allocation_reliable_v1.sql', import.meta.url), 'utf8');
const ccr = await readFile(new URL('../ccr.html', import.meta.url), 'utf8');

test('CCR allocation RPC journals request before acknowledging success', () => {
  assert.match(migration, /create or replace function public\.create_ccr_allocation_reliable/i);
  assert.match(migration, /private\.submission_receipts/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /action,payload_hash,recorded_at,response/);
  assert.match(migration, /'create_ccr_allocation'/);
});

test('CCR allocation RPC binds server identity and active operational shift', () => {
  assert.match(migration, /auth\.uid\(\) is null or v_role not in \('ccr','gl','admin','atasan'\)/);
  assert.match(migration, /p_payload->>'tanggal'.*v_date/s);
  assert.match(migration, /p_payload->>'shift'.*v_shift/s);
  assert.match(migration, /created_by,[\s\S]*created_by_name,[\s\S]*created_by_role/);
  assert.match(migration, /auth\.uid\(\),[\s\S]*v_actor_name,[\s\S]*v_role/);
});

test('CCR page uses persistent request id and reliable RPC instead of direct insert', () => {
  assert.match(ccr, /kpp-ccr-allocation-pending-v1/);
  assert.match(ccr, /create_ccr_allocation_reliable/);
  assert.match(ccr, /crypto\.randomUUID\(\)/);
  assert.doesNotMatch(ccr, /\.from\("ccr_allocations"\)\s*\.insert\(payload\)/);
});
