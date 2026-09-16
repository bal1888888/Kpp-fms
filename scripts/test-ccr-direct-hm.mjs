import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [oldMigration,newMigration,loader]=await Promise.all([
  readFile('supabase/migrations/20260915113500_ccr_direct_hm_v1.sql','utf8'),
  readFile('supabase/migrations/20260916113000_ccr_quota_checkin_hm_v2.sql','utf8'),
  readFile('wib-time.js','utf8')
]);

test('RPC direct HM lama tetap ada untuk kompatibilitas tetapi tidak lagi dimuat di CCR',()=>{
  assert.match(oldMigration,/create or replace function public\.ccr_set_checkin_hm/i);
  assert.doesNotMatch(loader,/ccr-direct-hm-v1\.js/);
  assert.match(loader,/ccr-auto-quota-v1\.js/);
});

test('unit dengan FC standard langsung READY memakai HM check-in',()=>{
  assert.match(newMigration,/u\.fc_standard_lphm is not null and u\.fc_standard_lphm > 0/i);
  assert.match(newMigration,/case when v_auto_quota then round\(p_hm_awal,1\) else null end/i);
  assert.match(newMigration,/case when v_auto_quota then 'READY' else 'ACTIVE' end/i);
  assert.match(newMigration,/hm_actual_source/i);
  assert.match(newMigration,/private\.kpp_shift_is_current/i);
});

test('backfill hanya menyentuh check-in aktif unit jatah dan recovery DT7441 hanya baris HM sehat',()=>{
  assert.match(newMigration,/c\.status='ACTIVE'/i);
  assert.match(newMigration,/c\.hm_actual is null/i);
  assert.match(newMigration,/upper\(trim\(h\.unit\)\)='DT7441'/i);
  assert.match(newMigration,/h\.tanggal>=date '2026-09-12'/i);
  assert.match(newMigration,/\(h\.hm_akhir-h\.hm_awal\)<=72/i);
});