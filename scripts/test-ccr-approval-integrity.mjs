import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const page = await readFile(new URL('../ccr-approval.html', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/20260911070000_ccr_approval_audit_stamp_v1.sql', import.meta.url), 'utf8');

test('approval page shows real HM only', () => {
  assert.doesNotMatch(page, /estimateHm\s*\(/);
  assert.doesNotMatch(page, /Est\. HM Sekarang/i);
  assert.doesNotMatch(page, /estimasi saat ini/i);
  assert.match(page, /<th>HM Aktual<\/th>/);
});

test('approval page sends only state transition and rejection reason', () => {
  assert.match(page, /\.update\(\{status:"ACTIVE"\}\)/);
  assert.match(page, /\.update\(\{status:"REJECTED",rejected_reason:/);
  assert.doesNotMatch(page, /approved_by:/);
  assert.doesNotMatch(page, /rejected_by:/);
});

test('database stamps approval and rejection identity from authenticated actor', () => {
  assert.match(migration, /new\.approved_by := auth\.uid\(\)/);
  assert.match(migration, /new\.approved_at := now\(\)/);
  assert.match(migration, /new\.rejected_by := auth\.uid\(\)/);
  assert.match(migration, /new\.rejected_at := now\(\)/);
  assert.match(migration, /v_role not in \('gl','admin','atasan'\)/);
  assert.match(migration, /new\.approved_by := old\.approved_by/);
  assert.match(migration, /new\.rejected_by := old\.rejected_by/);
});
